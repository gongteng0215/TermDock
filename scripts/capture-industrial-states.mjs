import { mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { basename, join, resolve, sep } from "node:path";

import { _electron as electron } from "playwright";
import electronPath from "electron";

import { startSmokeSshFixture } from "./smoke-ssh-fixture.mjs";

const OUTPUT_DIR = resolve(
  process.env.TERMDOCK_INDUSTRIAL_CAPTURE_OUTPUT_DIR ??
    join("artifacts", "industrial-audit", "populated")
);
const USER_DATA_DIR = join(OUTPUT_DIR, "user-data");
const VIEWPORT = {
  width: Number(process.env.TERMDOCK_CAPTURE_WIDTH ?? 1680),
  height: Number(process.env.TERMDOCK_CAPTURE_HEIGHT ?? 960)
};
const CAPTURE_THEME = process.env.TERMDOCK_CAPTURE_SHELL_THEME ?? "industrial";
const CAPTURE_HEALTH_ONLY = process.env.TERMDOCK_CAPTURE_HEALTH_ONLY === "1";
const LONG_REMOTE_FILE_NAME =
  "production-api-gateway-configuration-with-a-very-long-release-and-region-name-2026-08-18.yaml";
const MULTI_SELECT_REMOTE_FILE_NAMES = [
  "release-manifest-prod.json",
  "release-notes-prod.txt"
];
const LARGE_REMOTE_DIRECTORY_NAME = "large-directory-virtualization";
const LARGE_REMOTE_ENTRY_COUNT = 240;

function asErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function waitForCondition(
  check,
  { timeout = 20_000, interval = 120, description = "condition" } = {}
) {
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
    await new Promise((resolvePromise) => setTimeout(resolvePromise, interval));
  }
  const suffix = lastError ? `: ${asErrorMessage(lastError)}` : "";
  throw new Error(`Timed out waiting for ${description}${suffix}`);
}

async function isVisible(locator) {
  return (await locator.count()) > 0 && (await locator.first().isVisible());
}

async function waitForAppMounted(page) {
  await waitForCondition(
    () => page.evaluate(() => Boolean(document.querySelector(".app"))),
    { description: "TermDock app mount" }
  );
}

async function closeElectronApp(app, timeout = 8_000) {
  let closed = false;
  const appProcess = typeof app.process === "function" ? app.process() : null;
  const processId = appProcess?.pid;
  try {
    await Promise.race([
      app.close().then(() => {
        closed = true;
      }),
      new Promise((resolvePromise) => setTimeout(resolvePromise, timeout))
    ]);
  } finally {
    if (!closed && appProcess && !appProcess.killed) {
      appProcess.kill();
    }
    if (!closed && processId && process.platform === "win32") {
      await new Promise((resolvePromise) => {
        const child = spawn("taskkill", ["/PID", String(processId), "/T", "/F"], {
          stdio: "ignore"
        });
        child.on("close", resolvePromise);
        child.on("error", resolvePromise);
      });
    }
  }
}

async function trustLocalFixtureIfPrompted(page) {
  const dialog = page.locator(".modal.app-dialog", { hasText: "Trust SSH Host" }).first();
  try {
    await dialog.waitFor({ state: "visible", timeout: 6_000 });
  } catch {
    return false;
  }
  await dialog.getByRole("button", { name: "Trust Host" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 6_000 });
  return true;
}

async function capture(page, fileName) {
  const targetPath = join(OUTPUT_DIR, fileName);
  await page.waitForTimeout(260);
  await page.screenshot({ path: targetPath, fullPage: false, timeout: 20_000 });
  console.log(targetPath);
}

async function removeGeneratedPath(targetPath) {
  const resolvedOutputDir = resolve(OUTPUT_DIR);
  const resolvedTarget = resolve(targetPath);
  if (!resolvedTarget.startsWith(`${resolvedOutputDir}${sep}`)) {
    throw new Error(`Refusing to remove capture data outside ${resolvedOutputDir}`);
  }
  await rm(resolvedTarget, { force: true, recursive: true });
}

async function seedSessions(page, fixture) {
  const definitions = [
    ["Production Gateway", "Production", "prod", ["edge", "critical"], "Platform"],
    ["API Node 01", "Production", "prod", ["api", "blue"], "Backend"],
    ["API Node 02", "Production", "prod", ["api", "green"], "Backend"],
    ["PostgreSQL Primary", "Production", "prod", ["database", "critical"], "Data"],
    ["Redis Cache", "Production", "prod", ["cache"], "Backend"],
    ["Staging Web", "Staging", "staging", ["web", "preview"], "Frontend"],
    ["Dev Sandbox", "Development", "dev", ["sandbox"], "Platform"]
  ];

  await page.evaluate(
    async ({ definitionsValue, connection }) => {
      const existingSessions = await window.termdock.sessions.list();
      for (const [name, groupId, environment, tags, owner] of definitionsValue) {
        const payload = {
          host: connection.host,
          port: connection.port,
          username: connection.username,
          authType: "password",
          privateKeyPath: "",
          groupId,
          remark: `Isolated Industrial visual fixture for ${name}`,
          environment,
          tags,
          owner,
          favorite: name === "Production Gateway" || name === "PostgreSQL Primary",
          secret: connection.password
        };
        const existing = existingSessions.find((entry) => entry.name === name);
        if (existing) {
          await window.termdock.sessions.update(existing.id, payload);
        } else {
          await window.termdock.sessions.create({ name, ...payload });
        }
      }
    },
    {
      definitionsValue: definitions,
      connection: {
        host: fixture.host,
        port: fixture.port,
        username: fixture.username,
        password: fixture.password
      }
    }
  );
}

async function setCapturePreferences(page) {
  await page.evaluate((theme) => {
    window.localStorage.setItem("termdock.ui-theme.v1", theme);
    window.localStorage.setItem("termdock.ui-density.v1", "compact");
    window.localStorage.setItem("termdock.sftp-explorer-view-mode.v1", "compact");
    window.localStorage.setItem("termdock.first-run-onboarding-dismissed.v1", "true");
    window.localStorage.setItem("termdock.command-history-inspector-collapsed.v1", "false");
  }, CAPTURE_THEME);
}

async function openProductionSession(page) {
  const productionGroup = page
    .locator(".session-folder-list__main", { hasText: "Production" })
    .first();
  await productionGroup.waitFor({ state: "visible", timeout: 8_000 });
  await productionGroup.click();

  const session = page.locator(".session-list__main", { hasText: "Production Gateway" }).first();
  await session.waitFor({ state: "visible", timeout: 8_000 });
  await session.click();
  await page.keyboard.press("Enter");
  await trustLocalFixtureIfPrompted(page);

  const terminal = page.locator(".terminal-pane.is-active .xterm").first();
  await terminal.waitFor({ state: "visible", timeout: 20_000 });
  await page
    .locator(".terminal-pane.is-active .terminal-pane__status.is-connecting")
    .first()
    .waitFor({ state: "hidden", timeout: 20_000 });
}

async function verifyDuplicateTerminalTab(page) {
  const tabs = page.locator(".terminal-tabs .tab");
  const originalCount = await tabs.count();
  const sourceTab = page.locator(".terminal-tabs .tab.is-active").first();
  const sourceTabId = await sourceTab.getAttribute("data-tab-id");
  await sourceTab.click({ button: "right" });
  const duplicateAction = page.locator(".terminal-context-menu__item", { hasText: "Duplicate Tab" }).first();
  await duplicateAction.waitFor({ state: "visible", timeout: 5_000 });
  await capture(page, `00-tab-context-menu-${VIEWPORT.width}x${VIEWPORT.height}.png`);
  await duplicateAction.click();
  await waitForCondition(
    async () => (await tabs.count()) === originalCount + 1,
    { description: "duplicated terminal tab" }
  );
  const duplicateTab = page.locator(".terminal-tabs .tab.is-active").first();
  const duplicateTabId = await duplicateTab.getAttribute("data-tab-id");
  if (!sourceTabId || !duplicateTabId || duplicateTabId === sourceTabId) {
    throw new Error("Duplicate Tab did not activate a distinct terminal tab.");
  }
  await duplicateTab.locator(".tab__close").click();
  await waitForCondition(
    async () => (await tabs.count()) === originalCount,
    { description: "duplicated terminal tab cleanup" }
  );
}

async function runTerminalCommand(page, command) {
  const canvas = page.locator(".terminal-pane.is-active .terminal-pane__canvas").first();
  await canvas.click();
  await page.keyboard.type(command);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(360);
}

async function populateHistoryAndHealth(page) {
  for (const command of [
    "pwd",
    "uptime",
    "df -h",
    "systemctl --failed",
    "journalctl -p err -n 20"
  ]) {
    await runTerminalCommand(page, command);
  }

  await waitForCondition(
    async () => (await page.locator(".server-health-meter").count()) >= 3,
    { timeout: 25_000, description: "server health metrics" }
  );
  await waitForCondition(
    async () => (await page.locator(".command-history-panel__item").count()) >= 3,
    { timeout: 12_000, description: "command history rows" }
  );
}

async function captureFleetHealthDashboard(page) {
  await page.getByTitle("Pin this session for Fleet Health monitoring").first().click();
  const checkButton = page.getByTitle("Run a Fleet Health check now").first();
  await checkButton.waitFor({ state: "visible", timeout: 8_000 });
  for (let sample = 0; sample < 2; sample += 1) {
    await checkButton.click();
    await page.waitForTimeout(500);
    await waitForCondition(
      async () => !(await checkButton.isDisabled()),
      { timeout: 20_000, description: `Fleet Health sample ${sample + 1}` }
    );
  }
  await page.getByTitle("Open Fleet Health for this fixed monitor").first().click();
  const hub = page.getByRole("dialog", { name: "Operations Hub" });
  await hub.waitFor({ state: "visible", timeout: 8_000 });
  await hub.locator(".operations-hub__nav").getByRole("button", { name: "Fleet Health" }).click();
  await hub.locator(".fleet-overview__summary", { hasText: "Production Gateway" }).click();
  await hub.locator(".fleet-trend-dashboard").waitFor({ state: "visible", timeout: 8_000 });
  const hubLayout = await hub.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }));
  if (hubLayout.scrollWidth > hubLayout.clientWidth + 1) {
    throw new Error(`Fleet Health dashboard overflowed horizontally: ${JSON.stringify(hubLayout)}`);
  }
  await capture(page, "00c-fleet-health-overview-1680x960.png");
  await hub.locator(".operations-hub__fleet").evaluate((scroller) => {
    const incidents = scroller.querySelector(".fleet-incidents");
    if (incidents instanceof HTMLElement) {
      scroller.scrollTop = Math.max(0, incidents.offsetTop - scroller.offsetTop - 8);
    }
  });
  await capture(page, "00d-fleet-health-dashboard-1680x960.png");
  await page.keyboard.press("Escape");
}

async function getActiveTabId(page) {
  const tabId = await page.locator(".terminal-pane.is-active").first().getAttribute("data-tab-id");
  if (!tabId) {
    throw new Error("Active terminal tab id was not found.");
  }
  return tabId;
}

async function startTransferBatch(page, tabId, localPaths) {
  await page.getByRole("button", { name: "Open transfers" }).click();
  await page.locator("[data-testid='cockpit-transfers'].is-focus").waitFor({
    state: "visible",
    timeout: 8_000
  });

  await page.evaluate(
    ({ activeTabId, paths }) => {
      for (const [index, localPath] of paths.entries()) {
        const transferId = `industrial-visual-${Date.now()}-${index}`;
        void window.termdock.sftp
          .uploadFile(activeTabId, transferId, localPath, "/")
          .catch(() => undefined);
      }
    },
    { activeTabId: tabId, paths: localPaths }
  );

  await waitForCondition(
    async () => (await page.locator(".sftp-transfer").count()) > 0,
    { timeout: 15_000, description: "transfer rows" }
  );
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(USER_DATA_DIR, { recursive: true });
  await mkdir(join(USER_DATA_DIR, "session-data"), { recursive: true });

  const fixture = await startSmokeSshFixture({
    rootDir: join(OUTPUT_DIR, "fixture-remote"),
    maxConcurrentSftpSessions: 8,
    writeDelayMs: 800
  });
  await writeFile(
    join(fixture.rootDir, LONG_REMOTE_FILE_NAME),
    "service: production-api-gateway\nregion: ap-east-1\n",
    "utf8"
  );
  await Promise.all(
    MULTI_SELECT_REMOTE_FILE_NAMES.map((fileName, index) =>
      writeFile(join(fixture.rootDir, fileName), `fixture ${index + 1}\n`, "utf8")
    )
  );
  const largeRemoteDirectory = join(fixture.rootDir, LARGE_REMOTE_DIRECTORY_NAME);
  await mkdir(largeRemoteDirectory, { recursive: true });
  await Promise.all(
    Array.from({ length: LARGE_REMOTE_ENTRY_COUNT }, (_value, index) => {
      const suffix = String(index).padStart(4, "0");
      return writeFile(
        join(largeRemoteDirectory, `virtual-entry-${suffix}.log`),
        `virtualized fixture row ${suffix}\n`,
        "utf8"
      );
    })
  );
  const uploadPaths = [];
  for (let index = 0; index < 6; index += 1) {
    const filePath = join(OUTPUT_DIR, `industrial-payload-${index + 1}.bin`);
    await writeFile(filePath, Buffer.alloc(8 * 1024 * 1024, 65 + index));
    uploadPaths.push(filePath);
  }

  const launchEnv = { ...process.env };
  delete launchEnv.ELECTRON_RUN_AS_NODE;
  delete launchEnv.VITE_DEV_SERVER_URL;
  delete launchEnv.ELECTRON_ENABLE_LOGGING;

  let app = null;
  try {
    app = await electron.launch({
      executablePath: electronPath,
      args: ["."],
      env: {
        ...launchEnv,
        TERMDOCK_DISABLE_GPU: "1",
        TERMDOCK_OPEN_DEVTOOLS: "0",
        TERMDOCK_SMOKE_USER_DATA_DIR: USER_DATA_DIR
      }
    });

    const page = await app.firstWindow();
    await page.setViewportSize(VIEWPORT);
    await waitForAppMounted(page);
    await setCapturePreferences(page);
    await seedSessions(page, fixture);
    await page.reload();
    await waitForAppMounted(page);
    await page.waitForTimeout(1_000);

    await openProductionSession(page);
    await verifyDuplicateTerminalTab(page);
    await populateHistoryAndHealth(page);
    if (CAPTURE_HEALTH_ONLY) {
      const healthPanel = page.locator(
        CAPTURE_THEME === "default"
          ? ".panel__section--server-health"
          : "[data-testid='cockpit-health']"
      ).first();
      if (CAPTURE_THEME !== "default" && !(await healthPanel.isVisible())) {
        const monitorDockAction = page.getByRole("button", { name: "Open monitor" }).first();
        await monitorDockAction.waitFor({ state: "visible", timeout: 5_000 });
        await monitorDockAction.click();
      }
      await healthPanel.waitFor({ state: "visible", timeout: 8_000 });
      if (CAPTURE_THEME === "default") {
        const regions = await healthPanel.evaluate((panel) => {
          const selectors = [
            ".server-health__heading-title",
            ".server-health__actions",
            ".server-health__target-row",
            ".server-health-dashboard__resources",
            ".server-health-dashboard__facts"
          ];
          return selectors.map((selector) => {
            const element = panel.querySelector(selector);
            if (!(element instanceof HTMLElement)) return null;
            const rect = element.getBoundingClientRect();
            return { selector, top: rect.top, bottom: rect.bottom, width: rect.width };
          }).filter(Boolean);
        });
        for (let index = 1; index < regions.length; index += 1) {
          if (regions[index].top < regions[index - 1].bottom - 1) {
            throw new Error(`Server Health regions overlap: ${JSON.stringify(regions)}`);
          }
        }
      } else {
        const layout = await healthPanel.evaluate((panel) => ({
          clientHeight: panel.clientHeight,
          scrollHeight: panel.scrollHeight,
          clientWidth: panel.clientWidth,
          scrollWidth: panel.scrollWidth
        }));
        if (layout.scrollHeight > layout.clientHeight + 1 || layout.scrollWidth > layout.clientWidth + 1) {
          throw new Error(`Cockpit Server Health overflowed: ${JSON.stringify(layout)}`);
        }
      }
      await capture(
        page,
        `00-server-health-${CAPTURE_THEME}-${VIEWPORT.width}x${VIEWPORT.height}.png`
      );
      return;
    }
    await captureFleetHealthDashboard(page);

    const largeDirectoryEntry = page
      .locator(".sftp-list__name--directory", { hasText: LARGE_REMOTE_DIRECTORY_NAME })
      .first();
    await largeDirectoryEntry.waitFor({ state: "visible", timeout: 8_000 });
    await largeDirectoryEntry.click();
    await page.locator(".sftp-list--virtual").waitFor({ state: "visible", timeout: 8_000 });
    await page.locator(".sftp-result-actions", { hasText: `Showing ${LARGE_REMOTE_ENTRY_COUNT} of ${LARGE_REMOTE_ENTRY_COUNT}` }).waitFor({
      state: "visible",
      timeout: 8_000
    });
    const mountedLargeDirectoryRows = await page.locator(".sftp-list__item").count();
    if (mountedLargeDirectoryRows >= LARGE_REMOTE_ENTRY_COUNT) {
      throw new Error("Large SFTP directory rendered every row instead of virtualizing.");
    }
    const sftpFilterInput = page.getByRole("searchbox", { name: "Filter SFTP entries" });
    await sftpFilterInput.fill("virtual-entry-0237");
    await page.locator(".sftp-result-actions", { hasText: `Showing 1 of ${LARGE_REMOTE_ENTRY_COUNT}` }).waitFor({
      state: "visible",
      timeout: 5_000
    });
    await page.getByRole("button", { name: "Select All Results" }).click();
    await page.locator(".sftp-selection-preview", { hasText: "1 item selected" }).waitFor({
      state: "visible",
      timeout: 5_000
    });
    await capture(page, "00-sftp-large-directory-filter-1680x960.png");
    await page.getByRole("button", { name: "Clear Selection" }).click();
    await sftpFilterInput.fill("");
    await page.getByRole("combobox", { name: "Sort SFTP entries" }).selectOption("modifiedAt");
    await page.getByRole("button", { name: "Sort ascending" }).click();
    await page.getByRole("button", { name: "Go to parent directory" }).click();

    const longSftpEntry = page
      .locator(".sftp-list__item", { hasText: "production-api-gateway-configuration" })
      .first();
    await longSftpEntry.waitFor({ state: "visible", timeout: 8_000 });
    await longSftpEntry.click();
    await page.locator(".sftp-selection-preview", { hasText: LONG_REMOTE_FILE_NAME }).waitFor({
      state: "visible",
      timeout: 5_000
    });
    await longSftpEntry.click({ button: "right" });
    await page.locator(".sftp-context-menu__context", { hasText: LONG_REMOTE_FILE_NAME }).waitFor({
      state: "visible",
      timeout: 5_000
    });
    await capture(page, "00-sftp-long-path-menu-1680x960.png");
    await page.keyboard.press("Escape");
    for (const fileName of MULTI_SELECT_REMOTE_FILE_NAMES) {
      await page
        .locator(".sftp-list__item", { hasText: fileName })
        .first()
        .click({ modifiers: ["Control"] });
    }
    await page.locator(".sftp-selection-preview", { hasText: "3 items selected" }).waitFor({
      state: "visible",
      timeout: 5_000
    });
    await longSftpEntry.click({ button: "right" });
    await page.getByRole("button", { name: "Download Selected" }).waitFor({
      state: "visible",
      timeout: 5_000
    });
    await page.getByRole("button", { name: "Copy Selected Paths" }).waitFor({
      state: "visible",
      timeout: 5_000
    });
    await capture(page, "00a-sftp-multi-selection-menu-1680x960.png");
    await page.getByRole("button", { name: "Delete Selected" }).click();
    const batchDeleteDialog = page.locator(".modal.app-dialog", {
      hasText: "Delete 3 selected entries"
    });
    await batchDeleteDialog.waitFor({ state: "visible", timeout: 5_000 });
    const deleteTargets = await batchDeleteDialog.locator("textarea").inputValue();
    for (const fileName of [LONG_REMOTE_FILE_NAME, ...MULTI_SELECT_REMOTE_FILE_NAMES]) {
      if (!deleteTargets.includes(fileName)) {
        throw new Error(`Batch delete confirmation is missing ${fileName}.`);
      }
    }
    await capture(page, "00b-sftp-batch-delete-confirm-1680x960.png");
    await batchDeleteDialog.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Clear Selection" }).click();
    await page.locator(".sftp-selection-preview").waitFor({ state: "hidden", timeout: 5_000 });
    await longSftpEntry.click();
    await page
      .locator(".sftp-list__item", { hasText: MULTI_SELECT_REMOTE_FILE_NAMES[1] })
      .first()
      .click({ modifiers: ["Shift"] });
    const rangeSelectionCount = await page.locator(".sftp-list__item.is-selected").count();
    if (rangeSelectionCount < 2) {
      throw new Error(`Expected a range selection, found ${rangeSelectionCount} selected row(s).`);
    }
    await page.getByRole("button", { name: "Clear Selection" }).click();
    await capture(page, "01-populated-workbench-1680x960.png");

    const tabId = await getActiveTabId(page);
    await startTransferBatch(page, tabId, uploadPaths);
    await capture(page, "02-transfer-batch-1680x960.png");

    await waitForCondition(
      async () => (await page.locator(".sftp-transfer--running").count()) === 0,
      { timeout: 45_000, description: "transfer batch completion" }
    ).catch(() => undefined);
    await capture(page, "03-transfer-settled-1680x960.png");

    const dockMetrics = await page.evaluate(() => {
      const dock = document.querySelector(".cockpit-bottom-dock");
      const hitgrid = document.querySelector(".cockpit-bottom-dock__hitgrid");
      return {
        dock: dock
          ? {
              width: dock.getBoundingClientRect().width,
              display: getComputedStyle(dock).display
            }
          : null,
        hitgrid: hitgrid
          ? {
              width: hitgrid.getBoundingClientRect().width,
              display: getComputedStyle(hitgrid).display,
              columns: getComputedStyle(hitgrid).gridTemplateColumns
            }
          : null,
        items: Array.from(document.querySelectorAll(".cockpit-bottom-dock__item")).map(
          (element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
              label: element.textContent?.trim() ?? "",
              left: Math.round(rect.left),
              width: Math.round(rect.width),
              display: style.display,
              visibility: style.visibility,
              opacity: style.opacity,
              color: style.color
            };
          }
        )
      };
    });

    await page.getByRole("button", { name: "Open history" }).click();
    await page.setViewportSize({ width: 1200, height: 760 });
    await page.waitForTimeout(500);
    await capture(page, "04-populated-history-1200x760.png");

    const layoutMetrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      innerHeight: window.innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
      theme: document.documentElement.dataset.uiTheme
    }));
    await writeFile(
      join(OUTPUT_DIR, "capture-manifest.json"),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          fixture: `${fixture.host}:${fixture.port}`,
          payloads: uploadPaths.map((filePath) => basename(filePath)),
          layoutMetrics,
          dockMetrics
        },
        null,
        2
      ),
      "utf8"
    );
    console.log(JSON.stringify(layoutMetrics));
  } finally {
    if (app) {
      await closeElectronApp(app);
    }
    await fixture.close().catch(() => undefined);
    await Promise.all([
      removeGeneratedPath(USER_DATA_DIR),
      removeGeneratedPath(fixture.rootDir),
      ...uploadPaths.map((filePath) => removeGeneratedPath(filePath))
    ]).catch(() => undefined);
  }
}

void main().catch((error) => {
  console.error(asErrorMessage(error));
  process.exit(1);
});
