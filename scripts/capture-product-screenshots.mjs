import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

import { _electron as electron } from "playwright";
import electronPath from "electron";

const OUTPUT_DIR = resolve(process.env.TERMDOCK_CAPTURE_OUTPUT_DIR ?? "docs/assets/screenshots");
const PREVIEW_DIR = join(OUTPUT_DIR, "preview");
const GROUP_NAME = (process.env.TERMDOCK_CAPTURE_GROUP ?? "test").trim();
const SESSION_NAME = (process.env.TERMDOCK_CAPTURE_SESSION ?? "wsl").trim();
const EXECUTABLE_PATH = process.env.TERMDOCK_CAPTURE_EXECUTABLE?.trim() || null;
const VIEWPORT = {
  width: Number(process.env.TERMDOCK_CAPTURE_WIDTH ?? 1440),
  height: Number(process.env.TERMDOCK_CAPTURE_HEIGHT ?? 900)
};

function asErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function cssStringLiteral(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function textSelector(baseSelector, labels) {
  return labels.map((label) => `${baseSelector}:has-text(${cssStringLiteral(label)})`).join(", ");
}

function byText(page, baseSelector, labels) {
  return page.locator(textSelector(baseSelector, labels)).first();
}

async function isVisible(locator) {
  return (await locator.count()) > 0 && (await locator.first().isVisible());
}

async function waitForCondition(check, { timeout = 15_000, interval = 120, description } = {}) {
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
  const suffix = lastError ? `: ${asErrorMessage(lastError)}` : "";
  throw new Error(`Timed out waiting for ${description ?? "condition"}${suffix}`);
}

async function closeMenusAndDialogs(page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const modalCloseButton = page
      .locator(
        ".modal--settings .modal__header .icon-button, .modal--operation-center .modal__header .icon-button, .modal--retry-center .modal__header .icon-button"
      )
      .last();
    if (await isVisible(modalCloseButton)) {
      await modalCloseButton.click();
      await page.waitForTimeout(220);
      continue;
    }

    const approvalCancel = page
      .locator(".app-inline-hint-panel__actions .secondary-button:has-text('Cancel')")
      .first();
    if (await isVisible(approvalCancel)) {
      await approvalCancel.click();
      await page.waitForTimeout(220);
      continue;
    }

    const appDialogPrimary = page
      .locator(
        ".modal.app-dialog .primary-button:has-text('OK'), .modal.app-dialog .primary-button:has-text('Done'), .modal.app-dialog .primary-button:has-text('Cancel')"
      )
      .first();
    if (await isVisible(appDialogPrimary)) {
      await appDialogPrimary.click();
      await page.waitForTimeout(220);
      continue;
    }
    break;
  }
}

async function closeElectronApp(app, timeout = 8_000) {
  let closed = false;
  const appProcess = typeof app.process === "function" ? app.process() : null;
  const appProcessId = appProcess?.pid;
  try {
    await Promise.race([
      app.close().then(() => {
        closed = true;
      }),
      new Promise((resolvePromise) => {
        setTimeout(resolvePromise, timeout);
      })
    ]);
  } finally {
    if (!closed && appProcess && !appProcess.killed) {
      appProcess.kill();
    }
    if (!closed && appProcessId && process.platform === "win32") {
      await new Promise((resolvePromise) => {
        const child = spawn("taskkill", ["/PID", String(appProcessId), "/T", "/F"], {
          stdio: "ignore"
        });
        child.on("close", () => resolvePromise());
        child.on("error", () => resolvePromise());
      });
    }
  }
}

async function captureShot(page, fileName) {
  const fullPath = join(OUTPUT_DIR, fileName);
  const previewPath = join(PREVIEW_DIR, fileName);
  await page.waitForTimeout(260);
  await page.screenshot({ path: fullPath, fullPage: false });
  await copyFile(fullPath, previewPath);
  return fileName;
}

async function openSettingsSection(page, label) {
  const settingsButton = page.locator("button[aria-label='Open settings'], button[aria-label='打开设置']").first();
  if (!(await isVisible(settingsButton))) {
    throw new Error("Settings button not found.");
  }
  await settingsButton.click();
  await page.locator(".modal--settings").waitFor({ state: "visible", timeout: 8_000 });

  const navButton = page.locator(".settings-nav__button", { hasText: label }).first();
  if (!(await isVisible(navButton))) {
    throw new Error(`Settings section not found: ${label}`);
  }
  await navButton.click();
  await waitForCondition(
    async () => await navButton.evaluate((element) => element.classList.contains("is-active")),
    { description: `settings nav activation for ${label}` }
  );
  await page.waitForTimeout(260);
}

async function closeSettingsModal(page) {
  const done = byText(page, ".modal--settings .primary-button", ["Done", "完成"]);
  if (await isVisible(done)) {
    await done.click();
    await page.waitForTimeout(220);
  }
}

async function ensureEnglishInterface(page) {
  await openSettingsSection(page, "Workspace");
  const languageSelect = page
    .locator(
      ".modal--settings label:has-text('Language') select, .modal--settings label:has-text('语言') select"
    )
    .first();
  if (await isVisible(languageSelect)) {
    await languageSelect.selectOption("en");
    await page.waitForTimeout(220);
  }
  await closeSettingsModal(page);
  await waitForCondition(
    async () => isVisible(page.locator("button[aria-label='Open settings']").first()),
    { description: "English interface restore" }
  );
}

async function openGroupSession(page) {
  const backButton = page.locator(".session-explorer__back, button[aria-label='Back to groups']").first();
  if (await isVisible(backButton)) {
    await backButton.click();
    await page.waitForTimeout(260);
  }

  const groupButton = page
    .locator(".session-folder-list__main", { hasText: GROUP_NAME })
    .first();
  if (await isVisible(groupButton)) {
    await groupButton.click();
    await page.waitForTimeout(260);
  }

  const sessionButton = page
    .locator(".session-list__main", { hasText: SESSION_NAME })
    .first();
  if (!(await isVisible(sessionButton))) {
    throw new Error(`Session "${SESSION_NAME}" was not found under group "${GROUP_NAME}".`);
  }

  await sessionButton.click();
  await page.waitForTimeout(180);
  await page.keyboard.press("Enter");
  await waitForCondition(
    async () => (await page.locator(".terminal-pane.is-active .xterm").count()) > 0,
    { description: `activate terminal tab for ${SESSION_NAME}` }
  );
}

async function waitForConnectedTerminal(page) {
  const activeTerminal = page.locator(".terminal-pane.is-active .xterm").first();
  await activeTerminal.waitFor({ state: "visible", timeout: 20_000 });

  await waitForCondition(
    async () => {
      const errorStatus = page.locator(".terminal-pane.is-active .terminal-pane__status.is-error").first();
      if (await isVisible(errorStatus)) {
        const message = ((await errorStatus.textContent()) ?? "").replace(/\s+/g, " ").trim();
        throw new Error(message || "Terminal connection failed.");
      }

      const connectingStatus = page
        .locator(".terminal-pane.is-active .terminal-pane__status.is-connecting")
        .first();
      if (await isVisible(connectingStatus)) {
        return false;
      }

      return (await page.locator(".terminal-pane.is-active .xterm").count()) > 0;
    },
    { timeout: 45_000, description: "terminal connection ready" }
  );
}

async function runShellCommand(page, command) {
  const terminalCanvas = page.locator(".terminal-pane.is-active .terminal-pane__canvas").first();
  if (!(await isVisible(terminalCanvas))) {
    throw new Error("Active terminal pane not found.");
  }
  await terminalCanvas.click();
  await page.keyboard.type(command);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(420);
}

async function waitForSftpDirectory(page) {
  await waitForCondition(
    async () => {
      const pathValue = ((await page.locator(".sftp-path-input").first().inputValue()) ?? "").trim();
      return pathValue.length > 0 && !pathValue.includes("...") ? pathValue : false;
    },
    { description: "SFTP directory listing" }
  );
  await waitForCondition(
    async () => (await page.locator(".sftp-list__item").count()) > 0,
    { description: "SFTP entries visible" }
  );
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(PREVIEW_DIR, { recursive: true });

  const launchEnv = { ...process.env };
  delete launchEnv.ELECTRON_RUN_AS_NODE;
  delete launchEnv.TERMDOCK_SMOKE_USER_DATA_DIR;

  let app = null;
  const captured = [];

  try {
    console.log(`Capturing README screenshots with group="${GROUP_NAME}", session="${SESSION_NAME}"`);
    console.log("Close any running TermDock window before this script starts.");

    app = await electron.launch({
      executablePath: EXECUTABLE_PATH ?? electronPath,
      args: EXECUTABLE_PATH ? [] : ["."],
      env: {
        ...launchEnv,
        TERMDOCK_DISABLE_GPU: "1",
        TERMDOCK_OPEN_DEVTOOLS: "0"
      }
    });

    const page = await app.firstWindow();
    await page.setViewportSize(VIEWPORT);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1800);

    await ensureEnglishInterface(page);
    await openGroupSession(page);
    await waitForConnectedTerminal(page);
    await runShellCommand(page, "clear");
    await runShellCommand(page, "pwd");
    await waitForSftpDirectory(page);

    captured.push(await captureShot(page, "terminal-workspace.png"));
    captured.push(await captureShot(page, "sftp-file-browser.png"));

    const terminalCanvas = page.locator(".terminal-pane.is-active .terminal-pane__canvas").first();
    await terminalCanvas.click();
    await page.keyboard.type("rm -rf /tmp/termdock-readme-demo");
    await page.keyboard.press("Enter");
    const approvalBar = page.locator(".app-inline-hint-panel").first();
    await approvalBar.waitFor({ state: "visible", timeout: 8_000 });
    captured.push(await captureShot(page, "dangerous-command-guardrails.png"));
    const cancelApproval = approvalBar.locator(".secondary-button:has-text('Cancel')").first();
    if (await isVisible(cancelApproval)) {
      await cancelApproval.click();
      await page.waitForTimeout(220);
    }

    const operationCenterTrigger = byText(page, "button", ["Operation Center", "操作中心"]);
    if (!(await isVisible(operationCenterTrigger))) {
      throw new Error("Operation Center trigger not found.");
    }
    await operationCenterTrigger.click();
    await page.locator(".modal--operation-center").waitFor({ state: "visible", timeout: 10_000 });
    captured.push(await captureShot(page, "operation-center.png"));
    await closeMenusAndDialogs(page);

    const retryCenterTrigger = byText(page, "button", ["Retry Center", "重试中心"]);
    if (!(await isVisible(retryCenterTrigger))) {
      throw new Error("Retry Center trigger not found.");
    }
    await retryCenterTrigger.click();
    await page.locator(".modal--retry-center").waitFor({ state: "visible", timeout: 10_000 });
    captured.push(await captureShot(page, "retry-center.png"));
    await closeMenusAndDialogs(page);

    await openSettingsSection(page, "Port Fwd");
    captured.push(await captureShot(page, "port-forwarding-settings.png"));
    await closeSettingsModal(page);

    const manifestPath = join(OUTPUT_DIR, "capture-manifest.json");
    await writeFile(
      manifestPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          group: GROUP_NAME,
          session: SESSION_NAME,
          viewport: VIEWPORT,
          outputDir: OUTPUT_DIR,
          previewDir: PREVIEW_DIR,
          files: captured
        },
        null,
        2
      ),
      "utf8"
    );

    console.log("Captured screenshots:");
    for (const fileName of captured) {
      console.log(`- ${join(OUTPUT_DIR, fileName)}`);
      console.log(`- ${join(PREVIEW_DIR, fileName)}`);
    }
    console.log(`Manifest: ${manifestPath}`);
  } finally {
    if (app) {
      await closeElectronApp(app);
    }
  }
}

void main().catch((error) => {
  console.error(asErrorMessage(error));
  process.exit(1);
});
