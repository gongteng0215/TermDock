import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { _electron as electron } from "playwright";
import electronPath from "electron";

function toStamp(inputDate) {
  return inputDate.toISOString().replace(/[:.]/g, "-");
}

function asErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function waitForAny(page, selectors, timeout = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    for (const selector of selectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        return selector;
      }
    }
    await page.waitForTimeout(80);
  }
  return null;
}

async function isVisible(locator) {
  return (await locator.count()) > 0 && (await locator.first().isVisible());
}

async function closeMenusAndDialogs(page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const appDialog = page.locator(".modal.app-dialog");
    if ((await appDialog.count()) > 0) {
      const primary = page
        .locator(
          ".modal.app-dialog .primary-button:has-text('OK'), .modal.app-dialog .primary-button:has-text('Done'), .modal.app-dialog .primary-button:has-text('Save'), .modal.app-dialog .primary-button:has-text('Add'), .modal.app-dialog .primary-button:has-text('Create')"
        )
        .first();
      const secondary = page
        .locator(".modal.app-dialog .secondary-button:has-text('Cancel')")
        .first();
      if (await isVisible(primary)) {
        await primary.click();
        await page.waitForTimeout(220);
        continue;
      }
      if (await isVisible(secondary)) {
        await secondary.click();
        await page.waitForTimeout(220);
        continue;
      }
    }

    const contextMenu = page.locator(".sftp-context-menu");
    if ((await contextMenu.count()) > 0) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(180);
      continue;
    }
    break;
  }
}

async function ensureSession(page, sessionName, groupId) {
  return page.evaluate(
    async ({ sessionNameValue, groupIdValue }) => {
      const sessions = await window.termdock.sessions.list();
      const existing = sessions.find((entry) => entry.name === sessionNameValue);
      if (existing) {
        if ((existing.groupId ?? "") !== groupIdValue) {
          await window.termdock.sessions.update(existing.id, { groupId: groupIdValue });
        }
        return {
          created: false,
          id: existing.id
        };
      }

      const created = await window.termdock.sessions.create({
        name: sessionNameValue,
        host: "127.0.0.1",
        port: 22,
        username: "smoke",
        authType: "password",
        privateKeyPath: "",
        groupId: groupIdValue,
        remark: "auto-seeded by smoke script",
        favorite: false,
        secret: "smoke"
      });
      return {
        created: true,
        id: created.id
      };
    },
    {
      sessionNameValue: sessionName,
      groupIdValue: groupId
    }
  );
}

async function main() {
  const stamp = toStamp(new Date());
  const outputDir = resolve("artifacts", "smoke", stamp);
  await mkdir(outputDir, { recursive: true });

  const launchEnv = { ...process.env };
  delete launchEnv.ELECTRON_RUN_AS_NODE;

  const steps = [];
  const pushStep = (name, status, note = "") => {
    steps.push({ name, status, note });
    const suffix = note ? ` - ${note}` : "";
    console.log(`[${status.toUpperCase()}] ${name}${suffix}`);
  };

  const app = await electron.launch({
    executablePath: electronPath,
    args: ["."],
    env: {
      ...launchEnv,
      TERMDOCK_DISABLE_GPU: "1",
      TERMDOCK_OPEN_DEVTOOLS: "0"
    }
  });

  let shotIndex = 1;
  const screenshotList = [];
  const recordShot = async (page, label) => {
    const fileName = `${String(shotIndex).padStart(2, "0")}-${label}.png`;
    shotIndex += 1;
    const targetPath = join(outputDir, fileName);
    await page.waitForTimeout(220);
    await page.screenshot({ path: targetPath, fullPage: true });
    screenshotList.push(fileName);
    return fileName;
  };

  const runStep = async (name, fn) => {
    try {
      const note = await fn();
      pushStep(name, "pass", note ?? "");
    } catch (error) {
      pushStep(name, "fail", asErrorMessage(error));
      try {
        await closeMenusAndDialogs(pageRef.current);
      } catch {
        // Best effort cleanup.
      }
    }
  };

  const pageRef = { current: null };

  try {
    const page = await app.firstWindow();
    pageRef.current = page;

    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1800);

    await runStep("home screenshot (initial)", async () => {
      const fileName = await recordShot(page, "home-initial");
      return fileName;
    });

    await runStep("seed smoke sessions", async () => {
      const grouped = await ensureSession(page, "smoke-group-session", "smoke-group");
      const ungrouped = await ensureSession(page, "smoke-ungrouped-session", "");
      const total = await page.evaluate(async () => (await window.termdock.sessions.list()).length);
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1300);
      const fileName = await recordShot(page, "home-after-seed");
      return `total=${total}, groupedCreated=${grouped.created}, ungroupedCreated=${ungrouped.created}, shot=${fileName}`;
    });

    await runStep("monkeypatch file dialogs for export/import actions", async () => {
      const patched = await page.evaluate(() => {
        const bridge = window.termdock;
        if (!bridge?.system) {
          return false;
        }
        try {
          bridge.system.saveTextFile = async (options) => {
            const base =
              typeof options?.defaultFileName === "string" && options.defaultFileName.trim().length > 0
                ? options.defaultFileName.trim()
                : "export.json";
            const safeBase = base.replace(/[^a-zA-Z0-9_.-]/g, "_");
            return {
              canceled: false,
              outputPath: `C:/tmp/termdock-smoke-${Date.now()}-${safeBase}`
            };
          };
          bridge.system.pickAndReadTextFile = async () => ({
            canceled: false,
            filePath: "C:/tmp/termdock-smoke-import.json",
            text: JSON.stringify({
              commands: ["echo smoke_import_one", "echo smoke_import_two"]
            })
          });
          return true;
        } catch {
          return false;
        }
      });
      if (!patched) {
        throw new Error("bridge system methods are not writable");
      }
      return "patched";
    });

    await runStep("sessions blank-area context menu", async () => {
      const sessionSection = page.locator(".panel--right .panel__section").first();
      if (!(await isVisible(sessionSection))) {
        throw new Error("session panel not found");
      }
      await sessionSection.click({ button: "right" });
      await page.locator(".sftp-context-menu").waitFor({ state: "visible", timeout: 3000 });
      const fileName = await recordShot(page, "sessions-context-blank");
      await closeMenusAndDialogs(page);
      return fileName;
    });

    await runStep("sessions root export menu actions", async () => {
      const sessionSection = page.locator(".panel--right .panel__section").first();
      await sessionSection.click({ button: "right" });
      await page.locator(".sftp-context-menu").waitFor({ state: "visible", timeout: 3000 });

      const exportSessions = page
        .locator(".sftp-context-menu__item:has-text('Export All Sessions...')")
        .first();
      const exportGroups = page
        .locator(".sftp-context-menu__item:has-text('Export All Groups...')")
        .first();

      if (!(await isVisible(exportSessions)) || !(await isVisible(exportGroups))) {
        throw new Error("export actions not found in root context menu");
      }

      await exportSessions.click();
      await page.waitForTimeout(250);
      await closeMenusAndDialogs(page);

      await sessionSection.click({ button: "right" });
      await page.locator(".sftp-context-menu").waitFor({ state: "visible", timeout: 3000 });
      await exportGroups.click();
      await page.waitForTimeout(250);
      const fileName = await recordShot(page, "sessions-context-export-actions");
      await closeMenusAndDialogs(page);
      return fileName;
    });

    await runStep("group context menu and open group", async () => {
      const folderRow = page.locator(".session-folder-list__item").first();
      if (!(await isVisible(folderRow))) {
        throw new Error("no group rows visible");
      }
      await folderRow.click({ button: "right" });
      await page.locator(".sftp-context-menu").waitFor({ state: "visible", timeout: 3000 });
      const menuShot = await recordShot(page, "sessions-context-group");
      await closeMenusAndDialogs(page);

      const groupMain = page.locator(".session-folder-list__main").first();
      await groupMain.click();
      await page.waitForTimeout(320);
      const groupShot = await recordShot(page, "sessions-group-view");
      return `${menuShot}, ${groupShot}`;
    });

    await runStep("session list context menu", async () => {
      const sessionRow = page.locator(".session-list__item").first();
      if (!(await isVisible(sessionRow))) {
        throw new Error("no session row visible in group view");
      }
      await sessionRow.click({ button: "right" });
      await page.locator(".sftp-context-menu").waitFor({ state: "visible", timeout: 3000 });
      const fileName = await recordShot(page, "sessions-context-session");
      await closeMenusAndDialogs(page);
      return fileName;
    });

    await runStep("open session tab and prevent duplicate tabs", async () => {
      const sessionButton = page.locator(".session-list__main").first();
      if (!(await isVisible(sessionButton))) {
        throw new Error("session button missing");
      }
      const tabLocator = page.locator(".terminal-tabs .tab");
      const before = await tabLocator.count();

      await sessionButton.dblclick();
      await page.waitForTimeout(900);
      const afterFirstOpen = await tabLocator.count();

      await sessionButton.dblclick();
      await page.waitForTimeout(700);
      const afterSecondOpen = await tabLocator.count();

      const fileName = await recordShot(page, "session-open-duplicate-check");
      if (afterFirstOpen <= before) {
        throw new Error(`tab did not open: before=${before}, afterFirst=${afterFirstOpen}`);
      }
      if (afterSecondOpen !== afterFirstOpen) {
        throw new Error(
          `duplicate tab created: afterFirst=${afterFirstOpen}, afterSecond=${afterSecondOpen}`
        );
      }
      return `before=${before}, afterFirst=${afterFirstOpen}, afterSecond=${afterSecondOpen}, shot=${fileName}`;
    });

    await runStep("close tab then reopen same session", async () => {
      const closeButton = page.locator(".terminal-tabs .tab.is-active .tab__close").first();
      if (await isVisible(closeButton)) {
        await closeButton.click();
        await page.waitForTimeout(450);
      }

      const sessionButton = page.locator(".session-list__main").first();
      await sessionButton.dblclick();
      await page.waitForTimeout(900);
      const tabCount = await page.locator(".terminal-tabs .tab").count();
      const fileName = await recordShot(page, "session-close-reopen");
      if (tabCount <= 0) {
        throw new Error("reopen failed: no tabs after reopening session");
      }
      return `tabCount=${tabCount}, shot=${fileName}`;
    });

    await runStep("back to groups button and return", async () => {
      const backButton = page.locator("button[aria-label='Back to groups']").first();
      if (!(await isVisible(backButton))) {
        throw new Error("Back to groups button not visible");
      }
      const inGroupShot = await recordShot(page, "sessions-back-button-visible");
      await backButton.click();
      await page.waitForTimeout(280);
      const groupListVisible = await isVisible(page.locator(".session-folder-list").first());
      const outGroupShot = await recordShot(page, "sessions-back-to-groups");
      if (!groupListVisible) {
        throw new Error("group list not visible after back");
      }
      return `${inGroupShot}, ${outGroupShot}`;
    });

    await runStep("open settings and capture all sections", async () => {
      const settingsButton = page.getByRole("button", { name: "Open settings" }).first();
      if (!(await isVisible(settingsButton))) {
        throw new Error("settings button not found");
      }
      await settingsButton.click();
      await page.locator(".modal--settings").waitFor({ state: "visible", timeout: 5000 });
      const shots = [];
      shots.push(await recordShot(page, "settings-connection"));

      const sections = [
        { label: "Hotkeys", slug: "settings-hotkeys" },
        { label: "Monitor", slug: "settings-monitor" },
        { label: "File Open", slug: "settings-file-open" },
        { label: "SFTP", slug: "settings-sftp" },
        { label: "Port Fwd", slug: "settings-port-fwd" },
        { label: "Diagnostics", slug: "settings-diagnostics" }
      ];

      for (const section of sections) {
        const navButton = page.locator(".settings-nav__button", { hasText: section.label }).first();
        if (!(await isVisible(navButton))) {
          throw new Error(`settings nav missing: ${section.label}`);
        }
        await navButton.click();
        await page.waitForTimeout(260);
        shots.push(await recordShot(page, section.slug));
      }

      const refreshDiagnostics = page
        .locator(".modal--settings button:has-text('Refresh Diagnostics')")
        .first();
      if (await isVisible(refreshDiagnostics)) {
        await refreshDiagnostics.click();
        await page.waitForTimeout(300);
        shots.push(await recordShot(page, "settings-diagnostics-refreshed"));
      }

      const doneButton = page.locator(".modal--settings .primary-button:has-text('Done')").first();
      if (await isVisible(doneButton)) {
        await doneButton.click();
      } else {
        const closeButton = page.locator(".modal--settings .modal__header .icon-button").first();
        await closeButton.click();
      }
      await page.waitForTimeout(260);
      return shots.join(", ");
    });

    await runStep("open command history manager", async () => {
      const manageButton = page
        .locator(".panel__section--command-history .secondary-button:has-text('Manage')")
        .first();
      if (!(await isVisible(manageButton))) {
        throw new Error("manage button not found");
      }
      await manageButton.click();
      await page
        .locator(".modal--command-history-manager")
        .waitFor({ state: "visible", timeout: 5000 });
      const fileName = await recordShot(page, "command-history-manager-open");
      return fileName;
    });

    await runStep("command history add entry", async () => {
      const addButton = page
        .locator(".command-history-manager__toolbar .secondary-button:has-text('Add')")
        .first();
      if (!(await isVisible(addButton))) {
        throw new Error("add button not found");
      }
      await addButton.click();
      const inputSelector = await waitForAny(page, [".app-dialog__input", ".app-dialog__textarea"]);
      if (!inputSelector) {
        throw new Error("add prompt input not found");
      }
      const input = page.locator(inputSelector).first();
      await input.fill("echo smoke_add");
      const confirm = page
        .locator(".modal.app-dialog .primary-button:has-text('Add'), .modal.app-dialog .primary-button:has-text('OK')")
        .first();
      if (!(await isVisible(confirm))) {
        throw new Error("add confirm button not found");
      }
      await confirm.click();
      await page.waitForTimeout(320);
      const fileName = await recordShot(page, "command-history-add");
      return fileName;
    });

    await runStep("command history edit entry", async () => {
      const editButton = page.locator(".command-history-manager__edit").first();
      if (!(await isVisible(editButton))) {
        throw new Error("edit button not found");
      }
      await editButton.click();
      const inputSelector = await waitForAny(page, [".app-dialog__input", ".app-dialog__textarea"]);
      if (!inputSelector) {
        throw new Error("edit input not found");
      }
      const input = page.locator(inputSelector).first();
      await input.fill("echo smoke_edit");
      const save = page
        .locator(".modal.app-dialog .primary-button:has-text('Save'), .modal.app-dialog .primary-button:has-text('OK')")
        .first();
      if (!(await isVisible(save))) {
        throw new Error("save button not found");
      }
      await save.click();
      await page.waitForTimeout(320);
      const fileName = await recordShot(page, "command-history-edit");
      return fileName;
    });

    await runStep("command history export/import", async () => {
      const exportButton = page
        .locator(".command-history-manager__toolbar .secondary-button:has-text('Export')")
        .first();
      const importButton = page
        .locator(".command-history-manager__toolbar .secondary-button:has-text('Import')")
        .first();

      if (!(await isVisible(exportButton)) || !(await isVisible(importButton))) {
        throw new Error("export/import buttons not found");
      }

      await exportButton.click();
      await page.waitForTimeout(240);
      const exportShot = await recordShot(page, "command-history-export");
      await closeMenusAndDialogs(page);

      await importButton.click();
      await page.waitForTimeout(300);
      const importShot = await recordShot(page, "command-history-import");
      await closeMenusAndDialogs(page);

      return `${exportShot}, ${importShot}`;
    });

    await runStep("command history manager delete selected", async () => {
      const checkbox = page.locator(".command-history-manager__checkbox input").first();
      const deleteButton = page
        .locator(".modal--command-history-manager .secondary-button:has-text('Delete Selected')")
        .first();
      if (!(await isVisible(checkbox)) || !(await isVisible(deleteButton))) {
        throw new Error("checkbox or delete selected button not found");
      }
      await checkbox.check();
      await deleteButton.click();
      await page.waitForTimeout(260);
      const fileName = await recordShot(page, "command-history-delete-selected");
      return fileName;
    });

    await runStep("close command history manager", async () => {
      const done = page
        .locator(".modal--command-history-manager .primary-button:has-text('Done')")
        .first();
      if (!(await isVisible(done))) {
        throw new Error("manager done button missing");
      }
      await done.click();
      await page.waitForTimeout(260);
      const fileName = await recordShot(page, "home-after-command-history-manager");
      return fileName;
    });

    await runStep("command history panel context menu", async () => {
      const scopeSelect = page
        .locator(".panel__section--command-history .command-history-panel__filters select")
        .first();
      if (await isVisible(scopeSelect)) {
        await scopeSelect.selectOption("allTabs");
        await page.waitForTimeout(200);
      }
      let item = page.locator(".command-history-panel__item").first();
      if (!(await isVisible(item))) {
        await page.evaluate(() => {
          window.dispatchEvent(
            new CustomEvent("termdock:terminal-command-history-append", {
              detail: {
                tabId: "__smoke__",
                command: "echo smoke_context_menu"
              }
            })
          );
        });
        await page.waitForTimeout(260);
        item = page.locator(".command-history-panel__item").first();
      }
      if (!(await isVisible(item))) {
        throw new Error("no command history item in side panel (all tabs, fallback append failed)");
      }
      await item.click({ button: "right" });
      await page.locator(".sftp-context-menu").waitFor({ state: "visible", timeout: 3000 });
      const menuShot = await recordShot(page, "command-history-panel-context-menu");
      const copyAction = page.locator(".sftp-context-menu__item:has-text('Copy')").first();
      if (await isVisible(copyAction)) {
        await copyAction.click();
      } else {
        await closeMenusAndDialogs(page);
      }
      await page.waitForTimeout(180);
      return menuShot;
    });

    await runStep("open operation center", async () => {
      const trigger = page.locator("button:has-text('Operation Center')").first();
      if (!(await isVisible(trigger))) {
        throw new Error("operation center trigger not found");
      }
      await trigger.click();
      await page
        .locator(".modal--operation-center")
        .waitFor({ state: "visible", timeout: 5000 });
      const fileName = await recordShot(page, "operation-center-open");
      const done = page
        .locator(".modal--operation-center .primary-button:has-text('Done')")
        .first();
      if (await isVisible(done)) {
        await done.click();
        await page.waitForTimeout(220);
      }
      return fileName;
    });

    await runStep("open retry center", async () => {
      const trigger = page.locator("button:has-text('Retry Center')").first();
      if (!(await isVisible(trigger))) {
        throw new Error("retry center trigger not found");
      }
      await trigger.click();
      await page.locator(".modal--retry-center").waitFor({ state: "visible", timeout: 5000 });
      const openShot = await recordShot(page, "retry-center-open");

      const viewSelect = page.locator(".modal--retry-center select").nth(4);
      if (await isVisible(viewSelect)) {
        await viewSelect.selectOption("groupedByReason");
        await page.waitForTimeout(240);
      }
      const groupedShot = await recordShot(page, "retry-center-grouped-view");

      const done = page.locator(".modal--retry-center .primary-button:has-text('Done')").first();
      if (!(await isVisible(done))) {
        throw new Error("retry center done button not found");
      }
      await done.click();
      await page.waitForTimeout(220);
      return `${openShot}, ${groupedShot}`;
    });

    await runStep("final home screenshot", async () => {
      const fileName = await recordShot(page, "home-final");
      return fileName;
    });

    const counts = {
      pass: steps.filter((entry) => entry.status === "pass").length,
      fail: steps.filter((entry) => entry.status === "fail").length,
      skip: steps.filter((entry) => entry.status === "skip").length
    };
    const summaryPath = join(outputDir, "summary.json");
    await writeFile(
      summaryPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          outputDir,
          counts,
          screenshots: screenshotList,
          steps
        },
        null,
        2
      ),
      "utf8"
    );

    console.log(`Summary written: ${summaryPath}`);
    console.log(`Screenshots dir: ${outputDir}`);
    console.log(`Counts: pass=${counts.pass}, fail=${counts.fail}, skip=${counts.skip}`);
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
