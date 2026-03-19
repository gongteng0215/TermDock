import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

import { _electron as electron } from "playwright";
import electronPath from "electron";

import { startSmokeSshFixture } from "./smoke-ssh-fixture.mjs";

function toStamp(inputDate) {
  return inputDate.toISOString().replace(/[:.]/g, "-");
}

function asErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function readOptionalEnv(name) {
  const value = process.env[name];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toReportPath(value) {
  return value.replace(/\\/g, "/");
}

function extractEvidence(note) {
  if (!note) {
    return [];
  }
  return note.match(/[A-Za-z0-9][A-Za-z0-9_.-]*\.(?:png|json|md|txt|zip)/g) ?? [];
}

function readSmokeConfig() {
  const executablePath = readOptionalEnv("TERMDOCK_SMOKE_EXECUTABLE");
  const mode = executablePath ? "packaged" : "dev";
  return {
    executablePath,
    mode,
    label:
      readOptionalEnv("TERMDOCK_SMOKE_LABEL") ??
      (mode === "packaged" ? "Packaged App" : "Local Automation"),
    platform: readOptionalEnv("TERMDOCK_SMOKE_PLATFORM") ?? process.platform,
    realSshStatus: readOptionalEnv("TERMDOCK_SMOKE_REAL_SSH_STATUS"),
    realSshScreenshot: readOptionalEnv("TERMDOCK_SMOKE_REAL_SSH_SCREENSHOT")
  };
}

function createMarkdownReport({
  generatedAt,
  outputDir,
  config,
  counts,
  screenshots,
  steps
}) {
  const lines = [
    `# TermDock Full Test Matrix (${config.label})`,
    "",
    `Run timestamp: ${generatedAt}`,
    `Output dir: ${toReportPath(outputDir)}`,
    "",
    "## Summary",
    `- PASS: ${counts.pass}`,
    `- FAIL: ${counts.fail}`,
    `- SKIP: ${counts.skip}`,
    "",
    "## Execution",
    `- Launch mode: ${config.mode}`,
    `- Platform: ${config.platform}`
  ];

  if (config.executablePath) {
    lines.push(`- Executable: \`${toReportPath(config.executablePath)}\``);
  } else {
    lines.push("- Executable: `electron` against current workspace");
  }

  lines.push("", "## Covered areas");
  lines.push("- Sessions explorer context menus (blank/group/session)");
  lines.push("- Group open/back navigation");
  lines.push("- Same-session keyboard-open dedupe");
  lines.push("- Session list double-click fresh-tab behavior");
  lines.push("- Close and reopen same session");
  lines.push("- Embedded local SSH fixture connect/auth lifecycle");
  lines.push("- Dangerous-command guardrails Settings > Safety UI and approval bar on a live SSH session");
  lines.push("- Embedded local SFTP fixture list/upload/download/delete flow");
  lines.push(
    "- Settings sections (Connection/Workspace/Safety/Hotkeys/Monitor/File Open/SFTP/Port Fwd/Diagnostics)"
  );
  lines.push("- Command snippet manager (group/snippet/prompt-set baseline)");
  lines.push("- Command history manager (add/edit/export/import/delete)");
  lines.push("- Command history side panel context menu");
  lines.push("- Operation Center modal + tracked app-job baseline");
  lines.push("- Retry Center modal + grouped view");

  const passedSteps = steps.filter((entry) => entry.status === "pass");
  const failedSteps = steps.filter((entry) => entry.status === "fail");
  const skippedSteps = steps.filter((entry) => entry.status === "skip");

  lines.push("", "## Passed");
  if (passedSteps.length === 0) {
    lines.push("- None");
  } else {
    for (const step of passedSteps) {
      lines.push(step.note ? `- ${step.name} -> ${step.note}` : `- ${step.name}`);
    }
  }

  lines.push("", "## Failed");
  if (failedSteps.length === 0) {
    lines.push("- None");
  } else {
    for (const step of failedSteps) {
      lines.push(`- ${step.name}`);
      lines.push(`  - result: ${step.note || "step failed"}`);
      const evidence = extractEvidence(step.note);
      if (evidence.length > 0) {
        lines.push(`  - evidence: ${evidence.join(", ")}`);
      }
    }
  }

  if (skippedSteps.length > 0) {
    lines.push("", "## Skipped");
    for (const step of skippedSteps) {
      lines.push(step.note ? `- ${step.name} -> ${step.note}` : `- ${step.name}`);
    }
  }

  lines.push("", "## Real SSH extension");
  if (config.realSshStatus) {
    lines.push(`- ${config.realSshStatus}`);
    if (config.realSshScreenshot) {
      const relativePath = toReportPath(relative(process.cwd(), config.realSshScreenshot));
      lines.push(`- Screenshot: \`${relativePath}\``);
    }
  } else {
    lines.push("- Not included in this run.");
  }

  lines.push("", "## Not fully covered in this run");
  lines.push("- Conflict strategy behaviors (`overwrite` / `skip` / `rename`) with real remote conflicts");
  lines.push("- Upload/download cancel semantics under real file-transfer load");
  lines.push("- Retry Center requeue with real failed transfer samples");
  lines.push("- Remote file external editor save-back path against a live server");
  lines.push("- Port forwarding creation/use/teardown with real remote sockets");
  lines.push("- Server Health metrics/process/service snapshots from a non-fixture live host");
  lines.push("- Unexpected disconnect auto-capture report with real connection interruptions");
  lines.push("- Host-specific auth variants (key auth, jump host, agent, MFA) against real infrastructure");

  lines.push("", "## Artifacts");
  lines.push("- `summary.json`");
  lines.push("- `full-test-matrix.md`");
  lines.push(`- screenshots \`01\`..\`${String(screenshots.length).padStart(2, "0")}\``);

  return `${lines.join("\n")}\n`;
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
  if (!page) {
    return;
  }
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

    const approvalBar = page.locator(".app-inline-hint-panel");
    if ((await approvalBar.count()) > 0) {
      const cancelApproval = page
        .locator(".app-inline-hint-panel__actions .secondary-button:has-text('Cancel')")
        .first();
      if (await isVisible(cancelApproval)) {
        await cancelApproval.click();
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

async function waitForCondition(check, { timeout = 10_000, interval = 120, description } = {}) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeout) {
    try {
      const result = await check();
      if (result) {
        return result;
      }
      lastError = null;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => {
      setTimeout(resolvePromise, interval);
    });
  }
  if (lastError) {
    throw lastError;
  }
  throw new Error(`Timed out waiting for ${description ?? "condition"}.`);
}

async function waitForMissingPath(targetPath, timeout = 10_000) {
  await waitForCondition(
    async () => {
      try {
        await stat(targetPath);
        return false;
      } catch (error) {
        if (error && typeof error === "object" && error.code === "ENOENT") {
          return true;
        }
        throw error;
      }
    },
    {
      timeout,
      description: `missing path ${targetPath}`
    }
  );
}

async function waitForFileContents(targetPath, expectedText, timeout = 10_000) {
  await waitForCondition(
    async () => {
      try {
        const actualText = await readFile(targetPath, "utf8");
        return actualText === expectedText;
      } catch (error) {
        if (error && typeof error === "object" && error.code === "ENOENT") {
          return false;
        }
        throw error;
      }
    },
    {
      timeout,
      description: `file contents for ${targetPath}`
    }
  );
}

async function getActiveTabId(page) {
  const tabId = await page.locator(".terminal-pane.is-active").first().getAttribute("data-tab-id");
  if (!tabId || !tabId.trim()) {
    throw new Error("Active terminal tab id not found in DOM.");
  }
  return tabId.trim();
}

async function ensureSession(page, sessionName, groupId, connection) {
  return page.evaluate(
    async ({ sessionNameValue, groupIdValue, connectionValue }) => {
      const sessions = await window.termdock.sessions.list();
      const existing = sessions.find((entry) => entry.name === sessionNameValue);
      const payload = {
        host: connectionValue.host,
        port: connectionValue.port,
        username: connectionValue.username,
        authType: "password",
        privateKeyPath: "",
        groupId: groupIdValue,
        remark: connectionValue.remark,
        favorite: false,
        secret: connectionValue.password
      };
      if (existing) {
        await window.termdock.sessions.update(existing.id, payload);
        return {
          created: false,
          id: existing.id
        };
      }

      const created = await window.termdock.sessions.create({
        name: sessionNameValue,
        ...payload
      });
      return {
        created: true,
        id: created.id
      };
    },
    {
      sessionNameValue: sessionName,
      groupIdValue: groupId,
      connectionValue: connection
    }
  );
}

async function main() {
  const smokeConfig = readSmokeConfig();
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

  const fixture = await startSmokeSshFixture({
    rootDir: join(outputDir, "fixture-remote")
  });
  const uploadSourcePath = join(outputDir, "fixture-upload.txt");
  const uploadSourceContents = [
    "TermDock smoke upload source",
    `Generated at ${new Date().toISOString()}`
  ].join("\n");
  const uploadSourceFileName = basename(uploadSourcePath);
  const uploadedRemoteLocalPath = join(fixture.rootDir, uploadSourceFileName);
  const downloadTargetPath = join(outputDir, "fixture-download.txt");
  await writeFile(uploadSourcePath, uploadSourceContents, "utf8");
  pushStep(
    "start local SSH/SFTP fixture",
    "pass",
    `host=${fixture.host}:${fixture.port}, root=${toReportPath(relative(process.cwd(), fixture.rootDir))}`
  );

  let app = null;

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
    app = await electron.launch({
      executablePath: smokeConfig.executablePath ?? electronPath,
      args: smokeConfig.executablePath ? [] : ["."],
      env: {
        ...launchEnv,
        TERMDOCK_DISABLE_GPU: "1",
        TERMDOCK_OPEN_DEVTOOLS: "0"
      }
    });

    const page = await app.firstWindow();
    pageRef.current = page;

    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1800);

    await runStep("home screenshot (initial)", async () => {
      const fileName = await recordShot(page, "home-initial");
      return fileName;
    });

    await runStep("seed smoke sessions", async () => {
      const sessionConnection = {
        host: fixture.host,
        port: fixture.port,
        username: fixture.username,
        password: fixture.password,
        remark: `auto-seeded by smoke script (fixture ${fixture.host}:${fixture.port})`
      };
      const grouped = await ensureSession(
        page,
        "smoke-group-session",
        "smoke-group",
        sessionConnection
      );
      const ungrouped = await ensureSession(
        page,
        "smoke-ungrouped-session",
        "",
        sessionConnection
      );
      const total = await page.evaluate(async () => (await window.termdock.sessions.list()).length);
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1300);
      const fileName = await recordShot(page, "home-after-seed");
      return `fixturePort=${fixture.port}, total=${total}, groupedCreated=${grouped.created}, ungroupedCreated=${ungrouped.created}, shot=${fileName}`;
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

    await runStep("open session tab via keyboard and keep dedupe", async () => {
      const sessionButton = page.locator(".session-list__main").first();
      if (!(await isVisible(sessionButton))) {
        throw new Error("session button missing");
      }
      const tabLocator = page.locator(".terminal-tabs .tab");
      const before = await tabLocator.count();

      await sessionButton.click();
      await page.waitForTimeout(180);
      await page.keyboard.press("Enter");
      const afterFirstOpen = await waitForCondition(
        async () => {
          const currentCount = await tabLocator.count();
          return currentCount > before ? currentCount : false;
        },
        {
          timeout: 8_000,
          description: "first opened terminal tab"
        }
      );

      await sessionButton.click();
      await page.waitForTimeout(180);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(700);
      const afterSecondOpen = await tabLocator.count();

      const fileName = await recordShot(page, "session-open-dedupe-check");
      if (afterFirstOpen <= before) {
        throw new Error(`tab did not open: before=${before}, afterFirst=${afterFirstOpen}`);
      }
      if (afterSecondOpen !== afterFirstOpen) {
        throw new Error(
          `dedupe failed: afterFirst=${afterFirstOpen}, afterSecond=${afterSecondOpen}`
        );
      }
      return `before=${before}, afterFirst=${afterFirstOpen}, afterSecond=${afterSecondOpen}, shot=${fileName}`;
    });

    await runStep("live SSH session connected", async () => {
      const connectedStatus = page.locator(".terminal-pane__status.is-connected").first();
      await connectedStatus.waitFor({ state: "visible", timeout: 15_000 });
      const statusText = (await connectedStatus.textContent())?.trim() ?? "";
      const fileName = await recordShot(page, "live-ssh-connected");
      return `${statusText}, fixture=${fixture.host}:${fixture.port}, shot=${fileName}`;
    });

    await runStep("live SFTP directory loaded", async () => {
      const seedEntry = page
        .locator(".sftp-list__item", { hasText: fixture.remoteSeedFileName })
        .first();
      await seedEntry.waitFor({ state: "visible", timeout: 15_000 });
      const currentPath = (await page.locator(".sftp-current-path").first().textContent())?.trim() ?? "";
      const fileName = await recordShot(page, "live-sftp-directory");
      return `${currentPath}, seed=${fixture.remoteSeedFileName}, shot=${fileName}`;
    });

    await runStep("dangerous command approval bar on live SSH session", async () => {
      const terminalCanvas = page.locator(".terminal-pane.is-active .terminal-pane__canvas").first();
      if (!(await isVisible(terminalCanvas))) {
        throw new Error("active terminal pane not found");
      }
      await terminalCanvas.click();
      await page.keyboard.type("rm -rf /tmp/termdock-smoke");
      await page.keyboard.press("Enter");
      const approvalBar = page.locator(".app-inline-hint-panel").first();
      if (!(await isVisible(approvalBar))) {
        throw new Error("dangerous command approval bar not visible");
      }
      const runOnce = approvalBar.locator(".primary-button:has-text('Run Once')").first();
      const cancel = approvalBar.locator(".secondary-button:has-text('Cancel')").first();
      if (!(await isVisible(runOnce)) || !(await isVisible(cancel))) {
        throw new Error("approval actions not visible");
      }
      const beforeShot = await recordShot(page, "dangerous-command-approval-bar");
      await runOnce.click();
      await page.waitForTimeout(320);
      const afterShot = await recordShot(page, "dangerous-command-approval-after");
      return `${beforeShot}, ${afterShot}`;
    });

    await runStep("live SFTP upload file", async () => {
      const activeTabId = await getActiveTabId(page);
      await page.evaluate(
        async ({ tabIdValue, localPathValue }) => {
          const transferId = `smoke-up-${Date.now()}`;
          await window.termdock.sftp.uploadFile(tabIdValue, transferId, localPathValue, "/");
        },
        {
          tabIdValue: activeTabId,
          localPathValue: uploadSourcePath
        }
      );
      await waitForFileContents(uploadedRemoteLocalPath, uploadSourceContents, 15_000);
      const uploadedEntry = page.locator(".sftp-list__item", { hasText: uploadSourceFileName }).first();
      await uploadedEntry.waitFor({ state: "visible", timeout: 15_000 });
      const fileName = await recordShot(page, "live-sftp-upload");
      return `remote=${toReportPath(uploadedRemoteLocalPath)}, shot=${fileName}`;
    });

    await runStep("live SFTP download file", async () => {
      const activeTabId = await getActiveTabId(page);
      await page.evaluate(
        async ({ tabIdValue, remotePathValue, localPathValue }) => {
          const transferId = `smoke-down-${Date.now()}`;
          await window.termdock.sftp.downloadFile(
            tabIdValue,
            transferId,
            remotePathValue,
            localPathValue
          );
        },
        {
          tabIdValue: activeTabId,
          remotePathValue: fixture.remoteSeedPath,
          localPathValue: downloadTargetPath
        }
      );
      await waitForFileContents(downloadTargetPath, fixture.remoteSeedContents, 15_000);
      const fileName = await recordShot(page, "live-sftp-download");
      return `local=${toReportPath(downloadTargetPath)}, shot=${fileName}`;
    });

    await runStep("live SFTP delete uploaded file", async () => {
      const activeTabId = await getActiveTabId(page);
      await page.evaluate(
        async ({ tabIdValue, remotePathValue }) => {
          await window.termdock.sftp.deletePath(tabIdValue, remotePathValue, "file");
        },
        {
          tabIdValue: activeTabId,
          remotePathValue: `/${uploadSourceFileName}`
        }
      );
      await waitForMissingPath(uploadedRemoteLocalPath, 15_000);
      const refreshButton = page.locator("button[aria-label='Refresh directory']").first();
      if (!(await isVisible(refreshButton))) {
        throw new Error("SFTP refresh button not found after delete");
      }
      await refreshButton.click();
      await waitForCondition(
        async () => {
          const count = await page.locator(".sftp-list__item", { hasText: uploadSourceFileName }).count();
          return count === 0;
        },
        {
          timeout: 15_000,
          description: `deleted SFTP entry ${uploadSourceFileName}`
        }
      );
      const fileName = await recordShot(page, "live-sftp-delete");
      return `deleted=${uploadSourceFileName}, shot=${fileName}`;
    });

    await runStep("session list double-click opens fresh tab", async () => {
      const sessionButton = page.locator(".session-list__main").first();
      if (!(await isVisible(sessionButton))) {
        throw new Error("session button missing");
      }
      const tabLocator = page.locator(".terminal-tabs .tab");
      const before = await tabLocator.count();
      await sessionButton.dblclick();
      await page.waitForTimeout(900);
      const afterOpen = await tabLocator.count();
      const fileName = await recordShot(page, "session-open-double-click-new-tab");
      if (afterOpen !== before + 1) {
        throw new Error(`double-click did not open a fresh tab: before=${before}, after=${afterOpen}`);
      }
      return `before=${before}, after=${afterOpen}, shot=${fileName}`;
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
        { label: "Workspace", slug: "settings-workspace" },
        { label: "Safety", slug: "settings-safety" },
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
        if (section.label === "Workspace") {
          const workspaceSyncToggle = page
            .locator(
              ".modal--settings label.settings-checkbox:has-text('Sync global Safety pack/template to workspace profile')"
            )
            .first();
          const workspacePresets = page.locator(".settings-safety-preset").filter({
            has: page.locator(".settings-safety-preset__count", {
              hasText: "Safety default:"
            })
          });

          if (!(await isVisible(workspaceSyncToggle))) {
            throw new Error("workspace profile sync toggle not visible");
          }
          if ((await workspacePresets.count()) < 4) {
            throw new Error("workspace profile presets not visible");
          }
        }
        if (section.label === "Safety") {
          const safetyToggle = page.locator(".modal--settings label.settings-checkbox").first();
          const safetyRule = page.locator(".settings-safety-rule input").first();
          const customPatterns = page.locator(".settings-safety__textarea").first();
          const resetSafetyRules = page
            .locator(".modal--settings .modal__actions .secondary-button:has-text('Reset Safety Rules')")
            .first();

          if (
            !(await isVisible(safetyToggle)) ||
            !(await isVisible(safetyRule)) ||
            !(await isVisible(customPatterns)) ||
            !(await isVisible(resetSafetyRules))
          ) {
            throw new Error("safety controls not visible");
          }

          await safetyRule.uncheck();
          await customPatterns.fill("rm -rf /tmp/termdock-smoke");
          await resetSafetyRules.click();
          await page.waitForTimeout(260);

          if (!(await safetyRule.isChecked())) {
            throw new Error("safety rule did not reset");
          }
          if ((await customPatterns.inputValue()).trim().length !== 0) {
            throw new Error("safety patterns did not reset");
          }
        }
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

    await runStep("open snippet manager baseline", async () => {
      const snippetButton = page
        .locator(".panel__section--command-history .secondary-button:has-text('Snippets')")
        .first();
      if (!(await isVisible(snippetButton))) {
        throw new Error("snippet manager button not found");
      }
      await snippetButton.click();
      await page.locator(".modal--snippet-manager").waitFor({ state: "visible", timeout: 5000 });
      try {
        const newGroupButton = page
          .locator(".modal--snippet-manager .secondary-button:has-text('New Group')")
          .first();
        const newSnippetButton = page
          .locator(".modal--snippet-manager .secondary-button:has-text('New Snippet')")
          .first();
        if (!(await isVisible(newGroupButton)) || !(await isVisible(newSnippetButton))) {
          throw new Error("snippet manager primary actions not visible");
        }

        await newGroupButton.click();
        await page.waitForTimeout(220);
        await newSnippetButton.click();
        await page.waitForTimeout(260);

        const promptSetField = page
          .locator(".modal--snippet-manager .snippet-manager__field", {
            hasText: "Reusable Prompt Set"
          })
          .first();
        const newPromptSetButton = page
          .locator(".modal--snippet-manager .secondary-button:has-text('New Prompt Set')")
          .first();
        if (!(await isVisible(promptSetField)) || !(await isVisible(newPromptSetButton))) {
          throw new Error("prompt set controls not visible");
        }

        await newPromptSetButton.click();
        await page.waitForTimeout(260);

        const promptSetNameField = page
          .locator(".modal--snippet-manager .snippet-manager__field", {
            hasText: "Prompt Set Name"
          })
          .first();
        const addPromptSetVariableButton = page
          .locator(".modal--snippet-manager .secondary-button:has-text('Add Variable')")
          .first();
        if (
          !(await isVisible(promptSetNameField)) ||
          !(await isVisible(addPromptSetVariableButton))
        ) {
          throw new Error("prompt set variable controls not visible");
        }

        return await recordShot(page, "snippet-manager-baseline");
      } finally {
        const doneButton = page
          .locator(".modal--snippet-manager .primary-button:has-text('Done')")
          .first();
        if (await isVisible(doneButton)) {
          await doneButton.click();
          await page.waitForTimeout(220);
        }
      }
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
      const trackedJobsTitle = page
        .locator(".modal--operation-center .operation-center__title", {
          hasText: "Tracked App Jobs"
        })
        .first();
      if (!(await isVisible(trackedJobsTitle))) {
        throw new Error("tracked app jobs card not visible");
      }
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

    const generatedAt = new Date().toISOString();
    const counts = {
      pass: steps.filter((entry) => entry.status === "pass").length,
      fail: steps.filter((entry) => entry.status === "fail").length,
      skip: steps.filter((entry) => entry.status === "skip").length
    };
    const summaryPath = join(outputDir, "summary.json");
    const reportPath = join(outputDir, "full-test-matrix.md");
    await writeFile(
      summaryPath,
      JSON.stringify(
        {
          generatedAt,
          outputDir,
          mode: smokeConfig.mode,
          label: smokeConfig.label,
          platform: smokeConfig.platform,
          executablePath: smokeConfig.executablePath,
          reportPath,
          counts,
          screenshots: screenshotList,
          steps
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(
      reportPath,
      createMarkdownReport({
        generatedAt,
        outputDir,
        config: smokeConfig,
        counts,
        screenshots: screenshotList,
        steps
      }),
      "utf8"
    );

    console.log(`Summary written: ${summaryPath}`);
    console.log(`Report written: ${reportPath}`);
    console.log(`Screenshots dir: ${outputDir}`);
    console.log(`Counts: pass=${counts.pass}, fail=${counts.fail}, skip=${counts.skip}`);
    if (counts.fail > 0) {
      process.exitCode = 2;
    }
  } finally {
    if (app) {
      await app.close();
    }
    await fixture.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
