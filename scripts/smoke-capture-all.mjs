import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
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

async function allocateLocalPort(host = "127.0.0.1") {
  return await new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to resolve ephemeral port.")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolvePromise(port);
      });
    });
  });
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
  lines.push("- SSH config import preview and post-import open-first-session action");
  lines.push("- Session export/import menu entries plus encrypted migration export/import preview");
  lines.push("- Group open/back navigation");
  lines.push("- Same-session keyboard-open dedupe");
  lines.push("- Session list double-click fresh-tab behavior");
  lines.push("- Editor-focus multi-tab inactive-tab compaction");
  lines.push("- Close and reopen same session");
  lines.push("- Embedded local SSH fixture connect/auth lifecycle");
  lines.push("- Alternate-screen editor focus mode layout tightening and recovery");
  lines.push("- Editor-focus theme, typography, font stack, text rhythm, cursor shape, and inactive-tab compaction");
  lines.push("- Windows preferred-opener parser/launch path with quoted-path success and broken-path failure on Windows hosts");
  lines.push("- Dangerous-command guardrails Settings > Safety UI and approval bar on a live SSH session");
  lines.push(
    "- Embedded local SFTP fixture list/upload/download/delete flow, including batch-upload recovery under directory-race and channel-pressure faults"
  );
  lines.push("- Embedded remote-open-file save-back conflict notification path");
  lines.push("- Unexpected fixture shutdown -> Diagnostics disconnect report capture path");
  lines.push(
    "- Settings sections (Connection/Workspace/Safety/Hotkeys/Monitor/File Open/SFTP/Port Fwd/Diagnostics), including interface language, transfer pack save/apply, sync controls, and schedule resume hints"
  );
  lines.push("- Recoverable global error bar routing for invalid hotkey imports and safety bundle sync failures");
  lines.push("- Command snippet manager (group/snippet/prompt-set baseline)");
  lines.push("- Command history manager (add/edit/export/import/delete) plus Simplified Chinese interface check");
  lines.push("- Command history side panel context menu");
  lines.push("- Operation Center modal + tracked app-job baseline + activity timeline + grouped controls");
  lines.push("- Retry Center modal + grouped view + Simplified Chinese interface check");

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
  lines.push("- Remote file external-editor save-back path against a non-fixture live host");
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

async function waitForSmokeHook(page, hookName, timeout = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const available = await page.evaluate((name) => typeof window[name] === "function", hookName);
    if (available) {
      return true;
    }
    await page.waitForTimeout(80);
  }
  return false;
}

async function describeVisibleUi(page) {
  const [modals, hints, errors] = await Promise.all([
    page.locator(".modal.app-dialog").evaluateAll((elements) =>
      elements.map((element) => element.textContent?.replace(/\s+/g, " ").trim() ?? "")
    ),
    page.locator(".app-hint-message, .app-inline-hint-panel, .app-error-bar").evaluateAll((elements) =>
      elements.map((element) => element.textContent?.replace(/\s+/g, " ").trim() ?? "")
    ),
    page.locator(".global-error-bar, .error-banner").evaluateAll((elements) =>
      elements.map((element) => element.textContent?.replace(/\s+/g, " ").trim() ?? "")
    )
  ]);
  return {
    modals: modals.filter(Boolean),
    hints: hints.filter(Boolean),
    errors: errors.filter(Boolean)
  };
}

async function isVisible(locator) {
  return (await locator.count()) > 0 && (await locator.first().isVisible());
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

function settingsButton(page) {
  return page.locator("button[aria-label='Open settings'], button[aria-label='打开设置']").first();
}

function settingsDoneButton(page) {
  return byText(page, ".modal--settings .primary-button", ["Done", "完成"]);
}

function settingsNavButton(page, labels) {
  return byText(page, ".settings-nav__button", labels);
}

async function selectInterfaceLanguage(page, language) {
  const workspaceNav = settingsNavButton(page, ["Workspace", "工作区"]);
  await workspaceNav.click();
  await waitForCondition(
    async () => await workspaceNav.evaluate((element) => element.classList.contains("is-active")),
    {
      timeout: 5_000,
      description: "workspace settings nav activation for language switch"
    }
  );
  const languageSelect = page
    .locator(
      ".modal--settings label:has-text('Language') select, .modal--settings label:has-text('语言') select"
    )
    .first();
  if (!(await isVisible(languageSelect))) {
    throw new Error("interface language selector not visible");
  }
  await languageSelect.selectOption(language);
  await page.waitForTimeout(220);
}

async function openSettingsModal(page) {
  const trigger = settingsButton(page);
  if (!(await isVisible(trigger))) {
    throw new Error("settings button not found");
  }
  await trigger.click();
  await page.locator(".modal--settings").waitFor({ state: "visible", timeout: 5000 });
}

async function restoreEnglishInterface(page) {
  await openSettingsModal(page);
  await selectInterfaceLanguage(page, "en");
  await settingsDoneButton(page).click();
  await page.waitForTimeout(260);
}

async function waitForInterfaceLanguage(page, language, timeout = 5_000) {
  const expectedSettingsLabel = language === "zh-CN" ? "打开设置" : "Open settings";
  await waitForCondition(
    async () => {
      const localizedSettingsTrigger = page
        .locator(`button[aria-label='${expectedSettingsLabel}']`)
        .first();
      return isVisible(localizedSettingsTrigger);
    },
    {
      timeout,
      description: `interface language ${language}`
    }
  );
}

async function closeMenusAndDialogs(page, { closeTopLevelModals = false } = {}) {
  if (!page) {
    return;
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const appDialog = page.locator(".modal.app-dialog");
    if ((await appDialog.count()) > 0) {
      const primary = page
        .locator(
          ".modal.app-dialog .primary-button:has-text('OK'), .modal.app-dialog .primary-button:has-text('确定'), .modal.app-dialog .primary-button:has-text('Done'), .modal.app-dialog .primary-button:has-text('完成'), .modal.app-dialog .primary-button:has-text('Save'), .modal.app-dialog .primary-button:has-text('保存'), .modal.app-dialog .primary-button:has-text('Add'), .modal.app-dialog .primary-button:has-text('添加'), .modal.app-dialog .primary-button:has-text('Create'), .modal.app-dialog .primary-button:has-text('创建')"
        )
        .first();
      const secondary = page
        .locator(".modal.app-dialog .secondary-button:has-text('Cancel'), .modal.app-dialog .secondary-button:has-text('取消')")
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

    if (closeTopLevelModals) {
      const modalCloseButton = page
        .locator(
          ".modal--settings .modal__header .icon-button, .modal--snippet-manager .modal__header .icon-button, .modal--command-history-manager .modal__header .icon-button, .modal--operation-center .modal__header .icon-button, .modal--retry-center .modal__header .icon-button"
        )
        .last();
      if (await isVisible(modalCloseButton)) {
        await modalCloseButton.click();
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

async function removeLocalPathIfPresent(targetPath) {
  if (!targetPath || !String(targetPath).trim()) {
    return;
  }
  await rm(targetPath, {
    force: true,
    recursive: true
  }).catch(() => {
    // Best effort cleanup for smoke-created local files.
  });
}

async function getActiveTabId(page) {
  const tabId = await page.locator(".terminal-pane.is-active").first().getAttribute("data-tab-id");
  if (!tabId || !tabId.trim()) {
    throw new Error("Active terminal tab id not found in DOM.");
  }
  return tabId.trim();
}

async function runSmokeShellCommand(page, command) {
  const terminalCanvas = page.locator(".terminal-pane.is-active .terminal-pane__canvas").first();
  if (!(await isVisible(terminalCanvas))) {
    throw new Error("active terminal pane not found");
  }
  await terminalCanvas.click();
  await page.keyboard.type(command);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(260);
}

async function enterSmokeAlternateScreen(page, message = "TermDock editor focus smoke") {
  await runSmokeShellCommand(page, `printf '\\033[?1049h\\033[2J\\033[H${message}'`);
}

async function exitSmokeAlternateScreen(page) {
  await runSmokeShellCommand(page, "printf '\\033[?1049l'");
}

async function ensureAlternateScreenExited(page) {
  try {
    await exitSmokeAlternateScreen(page);
  } catch {
    // Best effort fallback for smoke cleanup.
  }
  try {
    await waitForCondition(
      async () => {
        const focusedLayouts = await page.locator(".layout.is-terminal-editor-focus").count();
        return focusedLayouts === 0;
      },
      {
        timeout: 4_000,
        description: "editor focus mode cleanup"
      }
    );
  } catch {
    // If cleanup cannot confirm, let the next step surface the real state.
  }
}

async function ensureSmokeGroupSessionVisible(page) {
  let sessionButton = page.locator(".session-list__main").first();
  if (await isVisible(sessionButton)) {
    return sessionButton;
  }

  const groupButton = page
    .locator(".session-folder-list__main", { hasText: "smoke-group" })
    .first();
  if (await isVisible(groupButton)) {
    await groupButton.click();
    await page.waitForTimeout(260);
  }

  sessionButton = page.locator(".session-list__main").first();
  if (!(await isVisible(sessionButton))) {
    throw new Error("session button missing");
  }
  return sessionButton;
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
  const smokeUserDataDir = readOptionalEnv("TERMDOCK_SMOKE_USER_DATA_DIR") ?? join(outputDir, "user-data");

  const launchEnv = { ...process.env };
  delete launchEnv.ELECTRON_RUN_AS_NODE;

  const steps = [];
  const pushStep = (name, status, note = "") => {
    steps.push({ name, status, note });
    const suffix = note ? ` - ${note}` : "";
    console.log(`[${status.toUpperCase()}] ${name}${suffix}`);
  };

  const throttledUploadSourceDir = join(outputDir, "fixture upload batch");
  const throttledUploadSourceDirName = basename(throttledUploadSourceDir);
  const throttledUploadFileSpecs = Array.from({ length: 6 }, (_value, index) => ({
    name: `stress-${index + 1}.txt`,
    contents: [
      "TermDock throttled upload smoke fixture",
      `Index: ${index + 1}`,
      `Generated at ${new Date().toISOString()}`
    ].join("\n")
  }));
  const fixture = await startSmokeSshFixture({
    rootDir: join(outputDir, "fixture-remote"),
    maxConcurrentSftpSessions: 4,
    transientMissingWriteDirectories: [`/${throttledUploadSourceDirName}`]
  });
  const uploadSourcePath = join(outputDir, "fixture-upload.txt");
  const uploadSourceContents = [
    "TermDock smoke upload source",
    `Generated at ${new Date().toISOString()}`
  ].join("\n");
  const uploadSourceFileName = basename(uploadSourcePath);
  const uploadedRemoteLocalPath = join(fixture.rootDir, uploadSourceFileName);
  const throttledUploadRemoteLocalDir = join(fixture.rootDir, throttledUploadSourceDirName);
  const throttledUploadExpectedFiles = throttledUploadFileSpecs.map((fileSpec) => ({
    ...fileSpec,
    localPath: join(throttledUploadRemoteLocalDir, fileSpec.name)
  }));
  const downloadTargetPath = join(outputDir, "fixture-download.txt");
  const openerHarnessDir = join(outputDir, "opener harness with spaces");
  const openerHarnessScriptPath = join(openerHarnessDir, "capture-open.cmd");
  const openerHarnessLogPath = join(openerHarnessDir, "args.txt");
  const openerTargetPath = join(outputDir, "fixture-open-target.txt");
  const portForwardBindPort = await allocateLocalPort();
  const remoteConflictContents = [
    fixture.remoteSeedContents,
    "Remote fixture mutation before save-back."
  ].join("\n");
  let remoteOpenConflictLocalPath = "";
  let remoteOpenReloadedLocalPath = "";
  let remoteOpenTabId = "";
  const smokeCreatedLocalPaths = new Set();
  await writeFile(uploadSourcePath, uploadSourceContents, "utf8");
  await mkdir(throttledUploadSourceDir, { recursive: true });
  await Promise.all(
    throttledUploadFileSpecs.map((fileSpec) =>
      writeFile(join(throttledUploadSourceDir, fileSpec.name), fileSpec.contents, "utf8")
    )
  );
  await writeFile(openerTargetPath, "TermDock opener smoke target\n", "utf8");
  pushStep(
    "start local SSH/SFTP fixture",
    "pass",
    `host=${fixture.host}:${fixture.port}, root=${toReportPath(relative(process.cwd(), fixture.rootDir))}`
  );

  let app = null;
  let fixtureClosed = false;

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
        await closeMenusAndDialogs(pageRef.current, { closeTopLevelModals: true });
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
        TERMDOCK_OPEN_DEVTOOLS: "0",
        TERMDOCK_SMOKE_USER_DATA_DIR: smokeUserDataDir
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

    await runStep("windows preferred opener parser launches quoted path and rejects broken path", async () => {
      if (process.platform !== "win32") {
        return "not applicable on non-Windows host";
      }
      await mkdir(openerHarnessDir, { recursive: true });
      await writeFile(
        openerHarnessScriptPath,
        ['@echo off', 'setlocal EnableExtensions', '> "%~dp0args.txt" echo %*', ""].join("\r\n"),
        "utf8"
      );
      const quotedProgramSpec = `"${openerHarnessScriptPath}" --reuse-window smoke-token`;
      await page.evaluate(
        async ({ targetPathValue, programSpecValue }) =>
          window.termdock.system.openLocalPath(targetPathValue, programSpecValue),
        {
          targetPathValue: openerTargetPath,
          programSpecValue: quotedProgramSpec
        }
      );
      const loggedArguments = await waitForCondition(
        async () => {
          try {
            const logText = await readFile(openerHarnessLogPath, "utf8");
            if (
              logText.includes("--reuse-window") &&
              logText.includes("smoke-token") &&
              logText.includes(openerTargetPath)
            ) {
              return logText.trim();
            }
          } catch {
            // Wait for helper output.
          }
          return false;
        },
        {
          timeout: 10_000,
          description: "quoted Windows opener helper output"
        }
      );
      const brokenProgramSpec = `${openerHarnessScriptPath} --reuse-window smoke-token`;
      const invalidMessage = await page.evaluate(
        async ({ targetPathValue, programSpecValue }) => {
          try {
            await window.termdock.system.openLocalPath(targetPathValue, programSpecValue);
            return "";
          } catch (error) {
            if (error instanceof Error) {
              return error.message;
            }
            return String(error);
          }
        },
        {
          targetPathValue: openerTargetPath,
          programSpecValue: brokenProgramSpec
        }
      );
      if (!invalidMessage.includes("Configured Windows opener was not found:")) {
        throw new Error(`expected explicit invalid opener error, got: ${invalidMessage || "(empty)"}`);
      }
      return `logged=${loggedArguments}; invalid=${invalidMessage}`;
    });

    await runStep("monkeypatch file dialogs for export/import actions", async () => {
      const patched = await page.evaluate(() => {
        const bridge = window.termdock;
        if (!bridge?.system) {
          return false;
        }
        try {
          const textFiles = {};
          window.__termdockSmokeTextFiles = textFiles;
          window.__termdockSmokeLastSavedTextFile = null;
          window.__termdockSmokePickedTextFile = {
            filePath: "C:/tmp/termdock-smoke-import.json",
            text: JSON.stringify({
              commands: ["echo smoke_import_one", "echo smoke_import_two"]
            })
          };
          window.__termdockSmokePickedSshConfigPath = "C:/tmp/termdock-smoke-ssh-config";
          window.__termdockSmokeSshConfigResult = {
            filePath: "C:/tmp/termdock-smoke-ssh-config",
            candidates: [
              {
                hostAlias: "smoke-imported",
                name: "smoke-imported",
                host: "127.0.0.1",
                port: 52199,
                username: "smoke",
                authType: "password",
                sourceLine: 1
              }
            ],
            warnings: [
              "C:/tmp/termdock-smoke-ssh-config:4: IdentityFile \"C:/missing/termdock-smoke-key\" for Host \"smoke-imported\" does not exist or is not a regular file after expansion.",
              "C:/tmp/termdock-smoke-ssh-config:5: ProxyJump is not imported yet; sessions that require a bastion host may need manual setup."
            ]
          };
          bridge.system.pickSshConfigFile = async () =>
            window.__termdockSmokePickedSshConfigPath ?? null;
          bridge.sessions.parseSshConfig = async () => window.__termdockSmokeSshConfigResult;
          bridge.sessions.exportEncryptedMigration = async (input) => ({
            file: {
              format: "termdock-session-migration",
              version: 1,
              exportedAtIso: new Date().toISOString(),
              appVersion: input?.appVersion ?? "smoke",
              crypto: {
                kdf: "scrypt",
                cipher: "aes-256-gcm",
                salt: "c21va2Utc2FsdA==",
                iv: "c21va2UtaXY=",
                authTag: "c21va2UtdGFn"
              },
              summary: {
                sessionCount: 2,
                passwordSecretCount: 2,
                privateKeySecretCount: 0,
                embeddedPrivateKeyFileCount: input?.includePrivateKeyFiles ? 1 : 0
              },
              ciphertext: "smoke-ciphertext"
            },
            warnings: []
          });
          bridge.sessions.importEncryptedMigration = async (input) => {
            if (input?.passphrase !== "smoke migration passphrase") {
              throw new Error("Could not decrypt migration file. Check the passphrase and file contents.");
            }
            return {
              payload: {
                exportedAtIso: new Date().toISOString(),
                appVersion: "smoke",
                sessionCount: 2,
                includesPasswords: true,
                includesPrivateKeyFiles: false,
                sessions: [
                  {
                    name: "smoke-group-session",
                    host: "127.0.0.1",
                    port: 59999,
                    username: "smoke",
                    authType: "password",
                    privateKeyPath: "",
                    groupId: "smoke-group",
                    remark: "smoke migration preview",
                    favorite: false,
                    secret: "smoke-restored-password"
                  },
                  {
                    name: "smoke-ungrouped-session",
                    host: "127.0.0.1",
                    port: 59999,
                    username: "smoke",
                    authType: "password",
                    privateKeyPath: "",
                    groupId: "",
                    remark: "smoke migration preview",
                    favorite: false,
                    secret: "smoke-restored-password"
                  }
                ]
              },
              warnings: []
            };
          };
          bridge.system.saveTextFile = async (options) => {
            const base =
              typeof options?.defaultFileName === "string" && options.defaultFileName.trim().length > 0
                ? options.defaultFileName.trim()
                : "export.json";
            const safeBase = base.replace(/[^a-zA-Z0-9_.-]/g, "_");
            const outputPath = `C:/tmp/termdock-smoke-${Date.now()}-${safeBase}`;
            const text = typeof options?.text === "string" ? options.text : "";
            textFiles[outputPath] = text;
            window.__termdockSmokeLastSavedTextFile = {
              outputPath,
              text
            };
            if (!Array.isArray(window.__termdockSmokeCreatedLocalPaths)) {
              window.__termdockSmokeCreatedLocalPaths = [];
            }
            window.__termdockSmokeCreatedLocalPaths.push(outputPath);
            return {
              canceled: false,
              outputPath
            };
          };
          bridge.system.pickAndReadTextFile = async () => ({
            canceled: false,
            filePath: window.__termdockSmokePickedTextFile?.filePath ?? "C:/tmp/termdock-smoke-import.json",
            text:
              window.__termdockSmokePickedTextFile?.text ??
              JSON.stringify({
                commands: ["echo smoke_import_one", "echo smoke_import_two"]
              })
          });
          bridge.system.readTextFileAtPath = async (filePath) => textFiles[filePath] ?? "";
          bridge.system.writeTextFileAtPath = async (filePath, text) => {
            const normalizedText = typeof text === "string" ? text : "";
            textFiles[filePath] = normalizedText;
            window.__termdockSmokeLastSavedTextFile = {
              outputPath: filePath,
              text: normalizedText
            };
          };
          bridge.system.openLocalPath = async (localPath) => {
            if (!Array.isArray(window.__termdockSmokeOpenedLocalPaths)) {
              window.__termdockSmokeOpenedLocalPaths = [];
            }
            window.__termdockSmokeOpenedLocalPaths.push(localPath);
          };
          window.__termdockSmokeCreatedLocalPaths = [];
          window.__termdockSmokeOpenedLocalPaths = [];
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
      const importEncryptedMigration = page
        .locator(".sftp-context-menu__item:has-text('Import Encrypted Migration...')")
        .first();
      const exportEncryptedMigration = page
        .locator(".sftp-context-menu__item:has-text('Export Encrypted Migration...')")
        .first();

      if (
        !(await isVisible(exportSessions)) ||
        !(await isVisible(exportGroups)) ||
        !(await isVisible(importEncryptedMigration)) ||
        !(await isVisible(exportEncryptedMigration))
      ) {
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

    await runStep("encrypted session migration import preview", async () => {
      await page.evaluate(() => {
        window.__termdockSmokePickedTextFile = {
          filePath: "C:/tmp/termdock-smoke-import.tdmigration",
          text: "__TERMDOCK_SMOKE_MIGRATION__"
        };
      });
      const hookReady = await waitForSmokeHook(page, "__termdockSmokeImportEncryptedMigration");
      if (!hookReady) {
        throw new Error("encrypted migration import smoke hook is unavailable");
      }
      const hookStarted = await page.evaluate(() => {
        if (typeof window.__termdockSmokeImportEncryptedMigration !== "function") {
          return false;
        }
        window.__termdockSmokeImportEncryptedMigration();
        return true;
      });
      if (!hookStarted) {
        throw new Error("encrypted migration import smoke hook did not start");
      }

      const importPassphraseDialog = page
        .locator(".modal.app-dialog", { hasText: "Enter the migration passphrase." })
        .first();
      try {
        await importPassphraseDialog.waitFor({ state: "visible", timeout: 5_000 });
      } catch (error) {
        const visibleUi = await describeVisibleUi(page);
        throw new Error(
          `encrypted migration passphrase prompt missing; ui=${JSON.stringify(visibleUi)}; cause=${asErrorMessage(error)}`
        );
      }
      await importPassphraseDialog.locator(".app-dialog__input").first().fill("smoke migration passphrase");
      await importPassphraseDialog.locator(".primary-button:has-text('Decrypt')").first().click();

      const previewDialog = page
        .locator(".modal.app-dialog", { hasText: "Encrypted Migration Preview" })
        .first();
      await previewDialog.waitFor({ state: "visible", timeout: 8_000 });
      const previewText = await previewDialog.textContent();
      for (const expected of [
        "Importable sessions:",
        "Encrypted passwords restored:",
        "smoke-group-session",
        "password restored"
      ]) {
        if (!previewText?.includes(expected)) {
          throw new Error(`encrypted migration preview missing "${expected}"`);
        }
      }
      const previewShot = await recordShot(page, "encrypted-migration-import-preview");
      await previewDialog.locator(".primary-button:has-text('Continue')").first().click();

      const groupDialog = page
        .locator(".modal.app-dialog", { hasText: "Group Strategy" })
        .first();
      await groupDialog.waitFor({ state: "visible", timeout: 5_000 });
      const groupText = await groupDialog.textContent();
      for (const expected of [
        "Choose target group strategy for imported sessions.",
        "Keep Group from File",
        "Force Active Group",
        "Move to Ungrouped"
      ]) {
        if (!groupText?.includes(expected)) {
          throw new Error(`encrypted migration group choice missing "${expected}"`);
        }
      }
      await groupDialog.locator(".secondary-button:has-text('Cancel')").first().click();
      await page.waitForTimeout(220);
      return previewShot;
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

    await runStep("ssh config import preview and open first imported session", async () => {
      const sessionSection = page.locator(".panel--right .panel__section").first();
      if (!(await isVisible(sessionSection))) {
        throw new Error("session panel not found");
      }
      const tabLocator = page.locator(".terminal-tabs .tab");
      const beforeTabs = await tabLocator.count();

      const hookReady = await waitForSmokeHook(page, "__termdockSmokeImportSshConfig");
      if (!hookReady) {
        throw new Error("SSH config import smoke hook is unavailable");
      }
      const hookStarted = await page.evaluate(() => {
        if (typeof window.__termdockSmokeImportSshConfig !== "function") {
          return false;
        }
        window.__termdockSmokeImportSshConfig();
        return true;
      });
      if (!hookStarted) {
        throw new Error("SSH config import smoke hook did not start");
      }

      const targetGroupDialog = page.locator(".modal.app-dialog", { hasText: "SSH Config Import" }).first();
      await targetGroupDialog.waitFor({ state: "visible", timeout: 5_000 });
      const targetGroupInput = targetGroupDialog.locator(".app-dialog__input").first();
      await targetGroupInput.fill("smoke-imports");
      await targetGroupDialog.locator(".primary-button:has-text('Review Import')").first().click();

      const previewDialog = page.locator(".modal.app-dialog", { hasText: "SSH Config Preview" }).first();
      await previewDialog.waitFor({ state: "visible", timeout: 5_000 });
      const previewText = await previewDialog.textContent();
      for (const expected of [
        "New sessions: 1",
        "Duplicate targets: 0",
        "Private-key sessions: 0",
        "Target group: smoke-imports",
        "IdentityFile \"C:/missing/termdock-smoke-key\"",
        "ProxyJump is not imported yet",
        "smoke-imported"
      ]) {
        if (!previewText?.includes(expected)) {
          throw new Error(`SSH config preview missing "${expected}"`);
        }
      }
      const previewShot = await recordShot(page, "ssh-config-import-preview");
      await previewDialog.locator(".primary-button:has-text('Import')").first().click();

      const openDialog = page.locator(".modal.app-dialog", { hasText: "Open the first imported session now?" }).first();
      await openDialog.waitFor({ state: "visible", timeout: 5_000 });
      await openDialog.locator("button:has-text('Open First Imported')").first().click();

      const afterTabs = await waitForCondition(
        async () => {
          const current = await tabLocator.count();
          return current > beforeTabs ? current : false;
        },
        {
          timeout: 8_000,
          description: "imported session terminal tab"
        }
      );
      await page.locator(".terminal-tabs .tab", { hasText: "smoke-imported" }).first().waitFor({
        state: "visible",
        timeout: 5_000
      });
      const openedShot = await recordShot(page, "ssh-config-import-open-first");
      const importedTabCloseButton = page
        .locator(".terminal-tabs .tab", { hasText: "smoke-imported" })
        .first()
        .locator(".tab__close")
        .first();
      if (await isVisible(importedTabCloseButton)) {
        await importedTabCloseButton.click();
        await page.waitForTimeout(320);
      }
      await closeMenusAndDialogs(page);
      return `before=${beforeTabs}, after=${afterTabs}, shots=${previewShot}, ${openedShot}`;
    });

    await runStep("open session tab via keyboard and keep dedupe", async () => {
      const backButton = page.locator(".session-explorer__back, button[aria-label='Back to groups']").first();
      if (await isVisible(backButton)) {
        await backButton.click();
        await page.waitForTimeout(260);
      }
      const groupButton = page
        .locator(".session-folder-list__main", { hasText: "smoke-group" })
        .first();
      if (await isVisible(groupButton)) {
        await groupButton.click();
        await page.waitForTimeout(260);
      }
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
      const activeTerminal = page.locator(".terminal-pane.is-active .xterm").first();
      await activeTerminal.waitFor({ state: "visible", timeout: 15_000 });
      await page
        .locator(".terminal-pane.is-active .terminal-pane__status.is-connecting")
        .first()
        .waitFor({ state: "hidden", timeout: 15_000 });
      const fileName = await recordShot(page, "live-ssh-connected");
      return `fixture=${fixture.host}:${fixture.port}, shot=${fileName}`;
    });

    await runStep("alternate-screen editor focus mode tightens layout and restores", async () => {
      await enterSmokeAlternateScreen(page);
      await page.locator(".layout.is-terminal-editor-focus").first().waitFor({
        state: "visible",
        timeout: 8_000
      });
      await page
        .locator(".terminal-pane.is-active.is-editor-focus .terminal-pane__canvas")
        .first()
        .waitFor({ state: "visible", timeout: 8_000 });
      const focusShot = await recordShot(page, "editor-focus-mode-active");

      await exitSmokeAlternateScreen(page);
      await waitForCondition(
        async () => {
          const focusedLayouts = await page.locator(".layout.is-terminal-editor-focus").count();
          return focusedLayouts === 0;
        },
        {
          timeout: 8_000,
          description: "editor focus mode to exit"
        }
      );
      const restoredShot = await recordShot(page, "editor-focus-mode-restored");
      return `${focusShot}, ${restoredShot}`;
    });

    await runStep("workspace editor focus theme applies selected palette", async () => {
      const settingsButton = page.getByRole("button", { name: "Open settings" }).first();
      if (!(await isVisible(settingsButton))) {
        throw new Error("settings button not found");
      }
      await settingsButton.click();
      await page.locator(".modal--settings").waitFor({ state: "visible", timeout: 5_000 });
      const workspaceNav = page.locator(".settings-nav__button", { hasText: "Workspace" }).first();
      await workspaceNav.click();
      await waitForCondition(
        async () => await workspaceNav.evaluate((element) => element.classList.contains("is-active")),
        {
          timeout: 5_000,
          description: "workspace settings nav activation for editor theme smoke"
        }
      );
      const paperThemePreset = page
        .locator(".settings-terminal-theme-preset[data-editor-theme='paper']")
        .first();
      if (!(await isVisible(paperThemePreset))) {
        throw new Error("paper editor theme preset not visible");
      }
      await paperThemePreset.click();
      await page.waitForTimeout(180);
      await page.locator(".modal--settings .primary-button:has-text('Done')").first().click();
      await page.waitForTimeout(260);

      await enterSmokeAlternateScreen(page, "TermDock editor theme smoke");
      await page
        .locator(".terminal-stage.is-editor-focus[data-editor-theme='paper']")
        .first()
        .waitFor({ state: "visible", timeout: 8_000 });
      const themedCanvas = page
        .locator(
          ".terminal-pane.is-active.is-editor-focus[data-editor-theme='paper'] .terminal-pane__canvas"
        )
        .first();
      await themedCanvas.waitFor({ state: "visible", timeout: 8_000 });
      const canvasBorderColor = await themedCanvas.evaluate(
        (element) => window.getComputedStyle(element).borderTopColor
      );
      if (!canvasBorderColor.includes("176, 148, 92")) {
        throw new Error(`paper editor theme did not update canvas border color: ${canvasBorderColor}`);
      }
      const themeShot = await recordShot(page, "editor-focus-mode-paper-theme");
      await exitSmokeAlternateScreen(page);

      await settingsButton.click();
      await page.locator(".modal--settings").waitFor({ state: "visible", timeout: 5_000 });
      const workspaceNavRestore = page
        .locator(".settings-nav__button", { hasText: "Workspace" })
        .first();
      await workspaceNavRestore.click();
      await page
        .locator(".settings-terminal-theme-preset[data-editor-theme='midnight']")
        .first()
        .click();
      await page.waitForTimeout(150);
      await page.locator(".modal--settings .primary-button:has-text('Done')").first().click();
      await page.waitForTimeout(220);

      return `theme=paper, border=${canvasBorderColor}, shot=${themeShot}`;
    });

    await runStep("workspace editor focus typography applies selected preset", async () => {
      const settingsButton = page.getByRole("button", { name: "Open settings" }).first();
      if (!(await isVisible(settingsButton))) {
        throw new Error("settings button not found");
      }
      await settingsButton.click();
      await page.locator(".modal--settings").waitFor({ state: "visible", timeout: 5_000 });
      const workspaceNav = page.locator(".settings-nav__button", { hasText: "Workspace" }).first();
      await workspaceNav.click();
      await waitForCondition(
        async () => await workspaceNav.evaluate((element) => element.classList.contains("is-active")),
        {
          timeout: 5_000,
          description: "workspace settings nav activation for editor typography smoke"
        }
      );
      const readingPreset = page
        .locator(".settings-terminal-typography-preset[data-editor-typography='reading']")
        .first();
      if (!(await isVisible(readingPreset))) {
        throw new Error("reading editor typography preset not visible");
      }
      await readingPreset.click();
      await page.waitForTimeout(180);
      await page.locator(".modal--settings .primary-button:has-text('Done')").first().click();
      await page.waitForTimeout(260);

      let readingPaddingTop = "";
      let typographyShot = "";
      try {
        await enterSmokeAlternateScreen(page, "TermDock editor typography smoke");
        await page
          .locator(".terminal-stage.is-editor-focus[data-editor-typography='reading']")
          .first()
          .waitFor({ state: "visible", timeout: 8_000 });
        const readingPane = page
          .locator(".terminal-pane.is-active.is-editor-focus[data-editor-typography='reading']")
          .first();
        await readingPane.waitFor({ state: "visible", timeout: 8_000 });
        readingPaddingTop = await readingPane.evaluate(
          (element) => window.getComputedStyle(element).paddingTop
        );
        if (readingPaddingTop !== "12px") {
          throw new Error(
            `reading editor typography did not update pane padding as expected: ${readingPaddingTop}`
          );
        }
        typographyShot = await recordShot(page, "editor-focus-mode-reading-typography");
      } finally {
        await ensureAlternateScreenExited(page);
      }

      await settingsButton.click();
      await page.locator(".modal--settings").waitFor({ state: "visible", timeout: 5_000 });
      const workspaceNavRestore = page
        .locator(".settings-nav__button", { hasText: "Workspace" })
        .first();
      await workspaceNavRestore.click();
      await page
        .locator(".settings-terminal-typography-preset[data-editor-typography='balanced']")
        .first()
        .click();
      await page.waitForTimeout(150);
      await page.locator(".modal--settings .primary-button:has-text('Done')").first().click();
      await page.waitForTimeout(220);

      return `typography=reading, paddingTop=${readingPaddingTop}, shot=${typographyShot}`;
    });

    await runStep("workspace editor focus font preset applies selected stack", async () => {
      const settingsButton = page.getByRole("button", { name: "Open settings" }).first();
      if (!(await isVisible(settingsButton))) {
        throw new Error("settings button not found");
      }
      await settingsButton.click();
      await page.locator(".modal--settings").waitFor({ state: "visible", timeout: 5_000 });
      const workspaceNav = page.locator(".settings-nav__button", { hasText: "Workspace" }).first();
      await workspaceNav.click();
      await waitForCondition(
        async () => await workspaceNav.evaluate((element) => element.classList.contains("is-active")),
        {
          timeout: 5_000,
          description: "workspace settings nav activation for editor font smoke"
        }
      );
      const draftingPreset = page
        .locator(".settings-terminal-font-preset[data-editor-font='drafting']")
        .first();
      if (!(await isVisible(draftingPreset))) {
        throw new Error("drafting editor font preset not visible");
      }
      await draftingPreset.click();
      await page.waitForTimeout(180);
      await page.locator(".modal--settings .primary-button:has-text('Done')").first().click();
      await page.waitForTimeout(260);

      let fontFamily = "";
      let fontShot = "";
      try {
        await enterSmokeAlternateScreen(page, "TermDock editor font smoke");
        await page
          .locator(".terminal-stage.is-editor-focus[data-editor-font='drafting']")
          .first()
          .waitFor({ state: "visible", timeout: 8_000 });
        const draftingPane = page
          .locator(".terminal-pane.is-active.is-editor-focus[data-editor-font='drafting']")
          .first();
        await draftingPane.waitFor({ state: "visible", timeout: 8_000 });
        const xtermSurface = draftingPane.locator(".xterm").first();
        await xtermSurface.waitFor({ state: "visible", timeout: 8_000 });
        fontFamily = await xtermSurface.evaluate(
          (element) => window.getComputedStyle(element).fontFamily
        );
        if (!fontFamily.includes("IBM Plex Mono")) {
          throw new Error(`drafting editor font did not update xterm font-family: ${fontFamily}`);
        }
        fontShot = await recordShot(page, "editor-focus-mode-drafting-font");
      } finally {
        await ensureAlternateScreenExited(page);
      }

      await settingsButton.click();
      await page.locator(".modal--settings").waitFor({ state: "visible", timeout: 5_000 });
      const workspaceNavRestore = page
        .locator(".settings-nav__button", { hasText: "Workspace" })
        .first();
      await workspaceNavRestore.click();
      await page
        .locator(".settings-terminal-font-preset[data-editor-font='system']")
        .first()
        .click();
      await page.waitForTimeout(150);
      await page.locator(".modal--settings .primary-button:has-text('Done')").first().click();
      await page.waitForTimeout(220);

      return `font=drafting, fontFamily=${fontFamily}, shot=${fontShot}`;
    });

    await runStep("workspace editor focus rhythm preset applies selected spacing", async () => {
      const settingsButton = page.getByRole("button", { name: "Open settings" }).first();
      if (!(await isVisible(settingsButton))) {
        throw new Error("settings button not found");
      }
      await settingsButton.click();
      await page.locator(".modal--settings").waitFor({ state: "visible", timeout: 5_000 });
      const workspaceNav = page.locator(".settings-nav__button", { hasText: "Workspace" }).first();
      await workspaceNav.click();
      await waitForCondition(
        async () => await workspaceNav.evaluate((element) => element.classList.contains("is-active")),
        {
          timeout: 5_000,
          description: "workspace settings nav activation for editor rhythm smoke"
        }
      );
      const openPreset = page
        .locator(".settings-terminal-rhythm-preset[data-editor-rhythm='open']")
        .first();
      if (!(await isVisible(openPreset))) {
        throw new Error("open editor rhythm preset not visible");
      }
      await openPreset.click();
      await page.waitForTimeout(180);
      await page.locator(".modal--settings .primary-button:has-text('Done')").first().click();
      await page.waitForTimeout(260);

      let metrics = null;
      let rhythmShot = "";
      try {
        await enterSmokeAlternateScreen(page, "TermDock editor rhythm smoke");
        await page
          .locator(".terminal-stage.is-editor-focus[data-editor-rhythm='open']")
          .first()
          .waitFor({ state: "visible", timeout: 8_000 });
        const openPane = page
          .locator(".terminal-pane.is-active.is-editor-focus[data-editor-rhythm='open']")
          .first();
        await openPane.waitFor({ state: "visible", timeout: 8_000 });
        const xtermSurface = openPane.locator(".xterm").first();
        await xtermSurface.waitFor({ state: "visible", timeout: 8_000 });
        metrics = await xtermSurface.evaluate((element) => {
          const style = window.getComputedStyle(element);
          return {
            letterSpacing: style.letterSpacing,
            fontWeight: style.fontWeight
          };
        });
        if (metrics.letterSpacing !== "0.8px" || metrics.fontWeight !== "600") {
          throw new Error(
            `open editor rhythm did not update xterm metrics: ${JSON.stringify(metrics)}`
          );
        }
        rhythmShot = await recordShot(page, "editor-focus-mode-open-rhythm");
      } finally {
        await ensureAlternateScreenExited(page);
      }

      await settingsButton.click();
      await page.locator(".modal--settings").waitFor({ state: "visible", timeout: 5_000 });
      const workspaceNavRestore = page
        .locator(".settings-nav__button", { hasText: "Workspace" })
        .first();
      await workspaceNavRestore.click();
      await page
        .locator(".settings-terminal-rhythm-preset[data-editor-rhythm='steady']")
        .first()
        .click();
      await page.waitForTimeout(150);
      await page.locator(".modal--settings .primary-button:has-text('Done')").first().click();
      await page.waitForTimeout(220);

      return `rhythm=open, metrics=${JSON.stringify(metrics)}, shot=${rhythmShot}`;
    });

    await runStep("workspace editor focus cursor preset applies selected shape", async () => {
      const settingsButton = page.getByRole("button", { name: "Open settings" }).first();
      if (!(await isVisible(settingsButton))) {
        throw new Error("settings button not found");
      }
      await settingsButton.click();
      await page.locator(".modal--settings").waitFor({ state: "visible", timeout: 5_000 });
      const workspaceNav = page.locator(".settings-nav__button", { hasText: "Workspace" }).first();
      await workspaceNav.click();
      await waitForCondition(
        async () => await workspaceNav.evaluate((element) => element.classList.contains("is-active")),
        {
          timeout: 5_000,
          description: "workspace settings nav activation for editor cursor smoke"
        }
      );
      const underlinePreset = page
        .locator(".settings-terminal-cursor-preset[data-editor-cursor='underline']")
        .first();
      if (!(await isVisible(underlinePreset))) {
        throw new Error("underline editor cursor preset not visible");
      }
      await underlinePreset.click();
      await page.waitForTimeout(180);
      await page.locator(".modal--settings .primary-button:has-text('Done')").first().click();
      await page.waitForTimeout(260);

      let cursorClassName = "";
      let cursorShot = "";
      try {
        await enterSmokeAlternateScreen(page, "TermDock editor cursor smoke");
        await page
          .locator(".terminal-stage.is-editor-focus[data-editor-cursor='underline']")
          .first()
          .waitFor({ state: "visible", timeout: 8_000 });
        cursorClassName = await page
          .locator(
            ".terminal-pane.is-active.is-editor-focus[data-editor-cursor='underline'] .xterm .xterm-cursor"
          )
          .first()
          .evaluate((element) => element.className);
        if (!cursorClassName.includes("xterm-cursor-underline")) {
          throw new Error(
            `underline editor cursor did not update xterm cursor class: ${cursorClassName}`
          );
        }
        cursorShot = await recordShot(page, "editor-focus-mode-underline-cursor");
      } finally {
        await ensureAlternateScreenExited(page);
      }

      await settingsButton.click();
      await page.locator(".modal--settings").waitFor({ state: "visible", timeout: 5_000 });
      const workspaceNavRestore = page
        .locator(".settings-nav__button", { hasText: "Workspace" })
        .first();
      await workspaceNavRestore.click();
      await page
        .locator(".settings-terminal-cursor-preset[data-editor-cursor='block']")
        .first()
        .click();
      await page.waitForTimeout(150);
      await page.locator(".modal--settings .primary-button:has-text('Done')").first().click();
      await page.waitForTimeout(220);

      return `cursor=underline, class=${cursorClassName}, shot=${cursorShot}`;
    });

    await runStep("live SFTP directory loaded", async () => {
      const seedEntry = page
        .locator(".sftp-list__name", { hasText: fixture.remoteSeedFileName })
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
      await approvalBar.waitFor({ state: "visible", timeout: 8_000 });
      const runOnce = approvalBar.locator(".primary-button:has-text('Run Once')").first();
      const cancel = approvalBar.locator(".secondary-button:has-text('Cancel')").first();
      await runOnce.waitFor({ state: "visible", timeout: 8_000 });
      await cancel.waitFor({ state: "visible", timeout: 8_000 });
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
      const uploadedEntry = page.locator(".sftp-list__name", { hasText: uploadSourceFileName }).first();
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
          const count = await page.locator(".sftp-list__name", { hasText: uploadSourceFileName }).count();
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

    await runStep("live SFTP batch upload recovers from directory race and channel pressure", async () => {
      const dropZone = page.locator(".sftp-drop-zone").first();
      await dropZone.waitFor({ state: "visible", timeout: 10_000 });
      await page.evaluate(
        ({ localDirectoryPathValue }) => {
          const dropZoneElement = document.querySelector(".sftp-drop-zone");
          if (!(dropZoneElement instanceof HTMLElement)) {
            throw new Error("SFTP drop zone not found.");
          }
          const dataTransfer = new DataTransfer();
          const droppedEntry = new File(["termdock"], "fixture-upload-batch");
          Object.defineProperty(droppedEntry, "path", {
            configurable: true,
            value: localDirectoryPathValue
          });
          dataTransfer.items.add(droppedEntry);
          dropZoneElement.dispatchEvent(
            new DragEvent("dragover", {
              bubbles: true,
              cancelable: true,
              dataTransfer
            })
          );
          dropZoneElement.dispatchEvent(
            new DragEvent("drop", {
              bubbles: true,
              cancelable: true,
              dataTransfer
            })
          );
        },
        {
          localDirectoryPathValue: throttledUploadSourceDir
        }
      );

      for (const expectedFile of throttledUploadExpectedFiles) {
        await waitForFileContents(expectedFile.localPath, expectedFile.contents, 40_000);
      }

      const refreshButton = page.locator("button[aria-label='Refresh directory']").first();
      await refreshButton.click();
      const uploadedDirectoryEntry = page
        .locator(".sftp-list__name", { hasText: throttledUploadSourceDirName })
        .first();
      await uploadedDirectoryEntry.waitFor({ state: "visible", timeout: 15_000 });
      await waitForCondition(
        async () => {
          const errorCount = await page.locator(".hint.sftp-error").count();
          return errorCount === 0;
        },
        {
          timeout: 5_000,
          description: "batch upload completed without persistent SFTP error banner"
        }
      );
      const fileName = await recordShot(page, "live-sftp-batch-upload-retry");
      return `remoteDir=${toReportPath(relative(process.cwd(), throttledUploadRemoteLocalDir))}, files=${throttledUploadExpectedFiles.length}, shot=${fileName}`;
    });

    await runStep("remote open file save-back conflict shows UI warning", async () => {
      const activeTabId = await getActiveTabId(page);
      remoteOpenTabId = activeTabId;
      const localTempPath = await page.evaluate(
        async ({ tabIdValue, remotePathValue, defaultNameValue }) => {
          const prepared = await window.termdock.system.prepareRemoteOpenFile(
            tabIdValue,
            remotePathValue,
            defaultNameValue
          );
          await window.termdock.sftp.downloadFile(
            tabIdValue,
            `smoke-open-${Date.now()}`,
            remotePathValue,
            prepared.localPath
          );
          await window.termdock.system.enableRemoteFileAutoSync(
            tabIdValue,
            remotePathValue,
            prepared.localPath
          );
          return prepared.localPath;
        },
        {
          tabIdValue: activeTabId,
          remotePathValue: fixture.remoteSeedPath,
          defaultNameValue: fixture.remoteSeedFileName
        }
      );
      await waitForFileContents(localTempPath, fixture.remoteSeedContents, 15_000);
      await writeFile(join(fixture.rootDir, fixture.remoteSeedFileName), remoteConflictContents, "utf8");
      await new Promise((resolvePromise) => {
        setTimeout(resolvePromise, 120);
      });
      const localEditedContents = [
        fixture.remoteSeedContents,
        "Local temp edit that should not overwrite remote changes."
      ].join("\n");
      await writeFile(localTempPath, localEditedContents, "utf8");
      const expectedWarningPrefix = "Remote file changed before save-back. Local changes were not synced:";
      await waitForCondition(
        async () => {
          const appHintText = (
            (await page.locator(".app-inline-hint-panel__text.is-warn").first().textContent()) ?? ""
          ).replace(/\s+/g, " ").trim();
          const sftpErrorText = (
            (await page.locator(".hint.sftp-error").first().textContent()) ?? ""
          ).replace(/\s+/g, " ").trim();
          if (
            appHintText.includes(expectedWarningPrefix) &&
            sftpErrorText.includes(expectedWarningPrefix)
          ) {
            return {
              appHintText,
              sftpErrorText
            };
          }
          return false;
        },
        {
          timeout: 15_000,
          description: "remote open file conflict warning"
        }
      );
      await waitForFileContents(join(fixture.rootDir, fixture.remoteSeedFileName), remoteConflictContents, 15_000);
      const fileName = await recordShot(page, "remote-open-file-conflict");
      remoteOpenConflictLocalPath = localTempPath;
      smokeCreatedLocalPaths.add(localTempPath);
      return `local=${toReportPath(localTempPath)}, remote=${fixture.remoteSeedPath}, shot=${fileName}`;
    });

    await runStep("remote open file reopen prompts for stale draft and reload replaces it", async () => {
      const seedEntry = page.locator(".sftp-list__name", { hasText: fixture.remoteSeedFileName }).first();
      await seedEntry.dblclick();
      const choiceDialog = page.locator(".app-dialog[aria-label='Remote File Already Open']").first();
      await choiceDialog.waitFor({ state: "visible", timeout: 10_000 });
      const reuseButton = choiceDialog.locator("button:has-text('Use Local Draft')").first();
      const reloadButton = choiceDialog.locator("button:has-text('Discard Draft + Reload')").first();
      if (!(await isVisible(reuseButton)) || !(await isVisible(reloadButton))) {
        throw new Error("remote-open-file choice dialog actions not visible");
      }
      const beforeShot = await recordShot(page, "remote-open-file-reopen-choice");
      await reloadButton.click();
      await choiceDialog.waitFor({ state: "hidden", timeout: 15_000 });
      const reopenedState = await waitForCondition(
        async () => {
          const activeTabId = await getActiveTabId(page);
          const prepared = await page.evaluate(
            async ({ tabIdValue, remotePathValue, defaultNameValue }) =>
              window.termdock.system.prepareRemoteOpenFile(
                tabIdValue,
                remotePathValue,
                defaultNameValue
              ),
            {
              tabIdValue: activeTabId,
              remotePathValue: fixture.remoteSeedPath,
              defaultNameValue: fixture.remoteSeedFileName
            }
          );
          if (
            !prepared.alreadyOpen ||
            prepared.reuseState !== "reuse-clean" ||
            prepared.localPath === remoteOpenConflictLocalPath
          ) {
            return false;
          }
          return prepared;
        },
        {
          timeout: 15_000,
          description: "reloaded remote-open local path"
        }
      );
      const reopenedLocalPath = reopenedState.localPath;
      if (reopenedLocalPath === remoteOpenConflictLocalPath) {
        throw new Error("remote-open-file reload reused stale local draft path");
      }
      remoteOpenReloadedLocalPath = reopenedLocalPath;
      smokeCreatedLocalPaths.add(reopenedLocalPath);
      await waitForMissingPath(remoteOpenConflictLocalPath, 15_000);
      await waitForFileContents(reopenedLocalPath, remoteConflictContents, 15_000);
      await waitForCondition(
        async () => (await page.locator(".hint.sftp-error").count()) === 0,
        {
          timeout: 10_000,
          description: "cleared remote open file warning after reload"
        }
      );
      const afterShot = await recordShot(page, "remote-open-file-reload-replaced");
      return `old=${toReportPath(remoteOpenConflictLocalPath)}, new=${toReportPath(reopenedLocalPath)}, shots=${beforeShot}, ${afterShot}`;
    });

    await runStep("session list double-click opens fresh tab", async () => {
      const sessionButton = await ensureSmokeGroupSessionVisible(page);
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

    await runStep("editor focus mode compacts inactive tabs when multiple tabs are open", async () => {
      const sessionButton = await ensureSmokeGroupSessionVisible(page);
      await sessionButton.dblclick();
      await page.waitForTimeout(700);
      const activeTerminal = page.locator(".terminal-pane.is-active .terminal-pane__canvas").first();
      await activeTerminal.waitFor({ state: "visible", timeout: 10_000 });
      await enterSmokeAlternateScreen(page, "TermDock compact editor tabs smoke");
      try {
        await page.locator(".layout.is-terminal-editor-focus").first().waitFor({
          state: "visible",
          timeout: 8_000
        });
        const tabMetrics = await page
          .locator(".terminal-tabs.is-editor-focus .tab")
          .evaluateAll((elements) =>
            elements.map((element) => ({
              className: element.className,
              width: element.getBoundingClientRect().width
            }))
          );
        const activeMetric = tabMetrics.find((entry) => entry.className.includes("is-active"));
        const inactiveMetric = tabMetrics.find((entry) => !entry.className.includes("is-active"));
        if (!activeMetric || !inactiveMetric) {
          throw new Error(`editor focus tab metrics incomplete: ${JSON.stringify(tabMetrics)}`);
        }
        const activeWidth = activeMetric.width;
        const collapsedWidth = inactiveMetric.width;
        if (!(collapsedWidth < activeWidth)) {
          throw new Error(
            `inactive editor tab did not compact: activeWidth=${activeWidth}, collapsedWidth=${collapsedWidth}, metrics=${JSON.stringify(tabMetrics)}`
          );
        }
        const compactShot = await recordShot(page, "editor-focus-mode-multi-tab-compact");
        return `activeWidth=${activeWidth.toFixed(1)}, collapsedWidth=${collapsedWidth.toFixed(1)}, shot=${compactShot}`;
      } finally {
        await exitSmokeAlternateScreen(page);
        await waitForCondition(
          async () => (await page.locator(".layout.is-terminal-editor-focus").count()) === 0,
          {
            timeout: 8_000,
            description: "editor focus mode to exit after multi-tab compact check"
          }
        );
      }
    });

    await runStep("close tab then reopen same session", async () => {
      const closeButton = remoteOpenTabId
        ? page.locator(`.terminal-tabs .tab[data-tab-id="${remoteOpenTabId}"] .tab__close`).first()
        : page.locator(".terminal-tabs .tab.is-active .tab__close").first();
      if (await isVisible(closeButton)) {
        await closeButton.click();
        await page.waitForTimeout(450);
        if (remoteOpenReloadedLocalPath) {
          await waitForMissingPath(remoteOpenReloadedLocalPath, 15_000);
        }
      }

      const sessionButton = page.locator(".session-list__main").first();
      await sessionButton.dblclick();
      await page.waitForTimeout(900);
      const tabCount = await page.locator(".terminal-tabs .tab").count();
      const fileName = await recordShot(page, "session-close-reopen");
      if (tabCount <= 0) {
        throw new Error("reopen failed: no tabs after reopening session");
      }
      return `tabCount=${tabCount}, cleaned=${remoteOpenReloadedLocalPath ? toReportPath(remoteOpenReloadedLocalPath) : "n/a"}, shot=${fileName}`;
    });

    await runStep("live port forwarding create baseline", async () => {
      const activeTabId = await getActiveTabId(page);
      const created = await page.evaluate(
        async ({ tabIdValue, bindPortValue, targetPortValue }) =>
          window.termdock.terminal.createPortForward(tabIdValue, {
            type: "local",
            bindHost: "127.0.0.1",
            bindPort: bindPortValue,
            targetHost: "127.0.0.1",
            targetPort: targetPortValue
          }),
        {
          tabIdValue: activeTabId,
          bindPortValue: portForwardBindPort,
          targetPortValue: fixture.port
        }
      );
      if (!created?.id) {
        throw new Error("port forwarding create did not return a forward id");
      }
      return `${created.type} ${created.bindHost}:${created.bindPort} -> 127.0.0.1:${fixture.port}`;
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
        await waitForCondition(
          async () =>
            await navButton.evaluate((element) => element.classList.contains("is-active")),
          {
            timeout: 5_000,
            description: `settings nav activation for ${section.label}`
          }
        );
        await page.waitForTimeout(260);
        if (section.label === "Workspace") {
          const languageSelect = page
            .locator(".modal--settings label:has-text('Language') select")
            .first();
          const workspaceSyncToggle = page
            .locator(
              ".modal--settings label.settings-checkbox:has-text('Sync global Safety pack/template to workspace profile')"
            )
            .first();
          const editorFocusToggle = page
            .locator(
              ".modal--settings label.settings-checkbox:has-text('Auto-focus alternate-screen terminal editors')"
            )
            .first();
          const editorThemePresets = page.locator(".settings-terminal-theme-preset");
          const editorTypographyPresets = page.locator(".settings-terminal-typography-preset");
          const editorFontPresets = page.locator(".settings-terminal-font-preset");
          const editorRhythmPresets = page.locator(".settings-terminal-rhythm-preset");
          const editorCursorPresets = page.locator(".settings-terminal-cursor-preset");
          const workspacePresets = page.locator(".settings-safety-preset").filter({
            has: page.locator(".settings-safety-preset__count", {
              hasText: "Safety default:"
            })
          });

          if (
            !(await isVisible(languageSelect)) ||
            !(await isVisible(workspaceSyncToggle)) ||
            !(await isVisible(editorFocusToggle)) ||
            (await editorThemePresets.count()) < 3 ||
            (await editorTypographyPresets.count()) < 3 ||
            (await editorFontPresets.count()) < 3 ||
            (await editorRhythmPresets.count()) < 3 ||
            (await editorCursorPresets.count()) < 3
          ) {
            throw new Error("workspace profile sync toggle not visible");
          }
          const languageOptions = await languageSelect.locator("option").allTextContents();
          if (!languageOptions.some((label) => label.includes("简体中文"))) {
            throw new Error("Simplified Chinese language option not visible");
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
        if (section.label === "SFTP") {
          const uploadThreads = page.locator(".modal--settings label:has-text('Upload Threads') input").first();
          const downloadThreads = page
            .locator(".modal--settings label:has-text('Download Threads') input")
            .first();
          const uploadLimit = page
            .locator(".modal--settings label:has-text('Upload Limit (KiB/s)') input")
            .first();
          const downloadLimit = page
            .locator(".modal--settings label:has-text('Download Limit (KiB/s)') input")
            .first();
          const scheduleToggle = page
            .locator(
              ".modal--settings label.settings-checkbox:has-text('Restrict queued transfers to a schedule window')"
            )
            .first();
          const startWindow = page.locator(".modal--settings label:has-text('Window Start') input").first();
          const endWindow = page.locator(".modal--settings label:has-text('Window End') input").first();
          const weeknightsPreset = page
            .locator(".settings-safety-preset", {
              has: page.locator(".settings-safety-preset__title", { hasText: "Weeknights" })
            })
            .first();
          const autoPullToggle = page
            .locator(
              ".modal--settings label.settings-checkbox:has-text('Auto-pull linked sync file on launch')"
            )
            .first();
          const autoPushToggle = page
            .locator(
              ".modal--settings label.settings-checkbox:has-text('Auto-push local pack changes to the linked sync file')"
            )
            .first();
          const originalScheduleEnabled = await scheduleToggle.isChecked();
          const originalStartWindow = await startWindow.inputValue();
          const originalEndWindow = await endWindow.inputValue();

          await waitForCondition(
            async () => {
              if (
                !(await isVisible(uploadThreads)) ||
                !(await isVisible(downloadThreads)) ||
                !(await isVisible(uploadLimit)) ||
                !(await isVisible(downloadLimit)) ||
                !(await isVisible(scheduleToggle))
              ) {
                return false;
              }
              await uploadLimit.scrollIntoViewIfNeeded();
              await autoPushToggle.scrollIntoViewIfNeeded();
              return (
                (await isVisible(startWindow)) &&
                (await isVisible(endWindow)) &&
                (await autoPullToggle.count()) > 0 &&
                (await autoPushToggle.count()) > 0 &&
                (await weeknightsPreset.count()) > 0
              );
            },
            {
              timeout: 5_000,
              description: "SFTP transfer controls"
            }
          );
          const originalAutoPullEnabled = await autoPullToggle.locator("input").isChecked();
          const originalAutoPushEnabled = await autoPushToggle.locator("input").isChecked();
          const saveCurrentPack = page
            .locator(".modal--settings .secondary-button:has-text('Save Current...')")
            .first();
          if (!(await isVisible(saveCurrentPack))) {
            throw new Error("transfer policy pack save button not visible");
          }
          const packName = `Smoke Transfer Pack ${Date.now().toString(36)}`;
          const originalUploadThreads = await uploadThreads.inputValue();
          await saveCurrentPack.click();
          await page.locator(".modal.app-dialog").waitFor({ state: "visible", timeout: 5_000 });
          const packNameInput = page.locator(".app-dialog__input").first();
          await packNameInput.fill(packName);
          const nextButton = page
            .locator(".modal.app-dialog .primary-button:has-text('Next')")
            .first();
          await nextButton.click();
          await page.locator(".modal.app-dialog").waitFor({ state: "visible", timeout: 5_000 });
          const packDescriptionInput = page.locator(".app-dialog__textarea").first();
          await packDescriptionInput.fill("smoke transfer policy pack");
          const savePackButton = page
            .locator(".modal.app-dialog .primary-button:has-text('Save')")
            .first();
          await savePackButton.click();
          await page.waitForTimeout(220);
          const okButton = page
            .locator(".modal.app-dialog .primary-button:has-text('OK')")
            .first();
          if (await isVisible(okButton)) {
            await okButton.click();
            await page.waitForTimeout(220);
          }

          await uploadThreads.fill("1");
          await uploadThreads.blur();
          await page.waitForTimeout(180);
          const applySavedPack = page
            .locator(".settings-safety-preset", {
              has: page.locator(".settings-safety-preset__title", { hasText: packName })
            })
            .locator(".secondary-button:has-text('Apply')")
            .first();
          if (!(await isVisible(applySavedPack))) {
            throw new Error("saved transfer policy pack apply button not visible");
          }
          await applySavedPack.click();
          const confirmApplyButton = page
            .locator(".modal.app-dialog .primary-button:has-text('Apply')")
            .first();
          await confirmApplyButton.click();
          await page.waitForTimeout(260);
          if ((await uploadThreads.inputValue()) !== originalUploadThreads) {
            throw new Error("transfer policy pack apply did not restore upload threads");
          }

          const pushSyncButton = page
            .locator(".modal--settings .secondary-button:has-text('Push Sync')")
            .first();
          const pullSyncButton = page
            .locator(".modal--settings .secondary-button:has-text('Pull Sync')")
            .first();
          const changeSyncButton = page
            .locator(".modal--settings .secondary-button:has-text('Choose Sync File')")
            .first();
          if (
            !(await isVisible(pushSyncButton)) ||
            !(await isVisible(pullSyncButton)) ||
            !(await isVisible(changeSyncButton))
          ) {
            throw new Error("transfer policy pack sync controls not visible");
          }
          await autoPullToggle.scrollIntoViewIfNeeded();
          await autoPullToggle.click();
          await page.waitForTimeout(120);
          await autoPushToggle.click();
          await page.waitForTimeout(120);
          if (!(await autoPullToggle.locator("input").isChecked())) {
            throw new Error("transfer policy auto-pull toggle did not change");
          }
          if (!(await autoPushToggle.locator("input").isChecked())) {
            throw new Error("transfer policy auto-push toggle did not change");
          }
          await weeknightsPreset.scrollIntoViewIfNeeded();
          await weeknightsPreset.click();
          await page.waitForTimeout(220);
          if (!(await scheduleToggle.isChecked())) {
            throw new Error("schedule preset did not enable schedule window");
          }
          if (
            !(await weeknightsPreset.evaluate((element) => element.classList.contains("is-active")))
          ) {
            throw new Error("schedule preset did not become active");
          }

          const futureWindow = await page.evaluate(() => {
            const now = new Date();
            const start = new Date(now.getTime() + 2 * 60 * 60 * 1000);
            const end = new Date(now.getTime() + 3 * 60 * 60 * 1000);
            const format = (value) =>
              `${value.getHours().toString().padStart(2, "0")}:${value
                .getMinutes()
                .toString()
                .padStart(2, "0")}`;
            return {
              start: format(start),
              end: format(end)
            };
          });
          if (!(await scheduleToggle.isChecked())) {
            await scheduleToggle.click();
          }
          await startWindow.fill(futureWindow.start);
          await startWindow.blur();
          await endWindow.fill(futureWindow.end);
          await endWindow.blur();
          await page.waitForTimeout(260);
          const nextResumeHint = page
            .locator(".modal--settings .hint", {
              hasText: "Next queued transfer resume:"
            })
            .first();
          if (!(await isVisible(nextResumeHint))) {
            throw new Error("SFTP schedule next-resume hint not visible");
          }
          if (!originalScheduleEnabled && (await scheduleToggle.isChecked())) {
            await scheduleToggle.click();
            await page.waitForTimeout(180);
          } else if (originalScheduleEnabled) {
            await startWindow.fill(originalStartWindow);
            await startWindow.blur();
            await endWindow.fill(originalEndWindow);
            await endWindow.blur();
            await page.waitForTimeout(180);
          }
          if ((await autoPullToggle.locator("input").isChecked()) !== originalAutoPullEnabled) {
            await autoPullToggle.click();
            await page.waitForTimeout(120);
          }
          if ((await autoPushToggle.locator("input").isChecked()) !== originalAutoPushEnabled) {
            await autoPushToggle.click();
            await page.waitForTimeout(120);
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

    await runStep("global error bar routes invalid hotkey error back to hotkeys settings", async () => {
      const invalidMessage = await page.evaluate(() => {
        if (typeof window.__termdockSmokeSetGlobalError !== "function") {
          throw new Error("smoke global error setter not installed");
        }
        const message = "Invalid hotkey file: no recognized hotkey actions.";
        window.__termdockSmokeSetGlobalError(message);
        return message;
      });
      await waitForCondition(
        async () => {
          const message =
            ((await page.locator(".error-bar__message").first().textContent()) ?? "").trim();
          return message.includes("Invalid hotkey file") ? message : false;
        },
        {
          timeout: 8_000,
          description: "invalid hotkey global error bar message"
        }
      );
      const hotkeysAction = page.locator(".error-bar button:has-text('Hotkeys')").first();
      if (!(await isVisible(hotkeysAction))) {
        throw new Error("hotkeys recovery action not visible in global error bar");
      }
      const errorShot = await recordShot(page, "global-error-hotkeys-action");
      await hotkeysAction.click();
      await page.locator(".modal--settings").waitFor({ state: "visible", timeout: 5_000 });
      const reopenedHotkeysNav = page.locator(".settings-nav__button", { hasText: "Hotkeys" }).first();
      const hotkeysActive = await waitForCondition(
        async () =>
          (await reopenedHotkeysNav.count()) > 0 &&
          (await reopenedHotkeysNav.evaluate((element) => element.classList.contains("is-active"))),
        {
          timeout: 5_000,
          description: "global error route back to hotkeys settings"
        }
      );
      if (!hotkeysActive) {
        throw new Error("global error hotkeys action did not reopen hotkeys settings");
      }
      const routeShot = await recordShot(page, "global-error-hotkeys-routed");
      const restoreDoneButton = page
        .locator(".modal--settings .primary-button:has-text('Done')")
        .first();
      if (await isVisible(restoreDoneButton)) {
        await restoreDoneButton.click();
      }
      await page.waitForTimeout(220);
      const dismissErrorButton = page.locator(".error-bar .icon-button[aria-label='Dismiss error']").first();
      if (await isVisible(dismissErrorButton)) {
        await dismissErrorButton.click();
        await page.waitForTimeout(180);
      }
      return `message=${invalidMessage}; shots=${errorShot}, ${routeShot}`;
    });

    await runStep("global error bar routes safety bundle errors back to safety settings", async () => {
      const safetyMessage = await page.evaluate(() => {
        if (typeof window.__termdockSmokeSetGlobalError !== "function") {
          throw new Error("smoke global error setter not installed");
        }
        const message = "Failed to pull safety bundles from sync file.";
        window.__termdockSmokeSetGlobalError(message);
        return message;
      });
      await waitForCondition(
        async () => {
          const message =
            ((await page.locator(".error-bar__message").first().textContent()) ?? "").trim();
          return message.includes("safety bundles") ? message : false;
        },
        {
          timeout: 8_000,
          description: "safety bundle global error bar message"
        }
      );
      const safetyAction = page.locator(".error-bar button:has-text('Safety')").first();
      if (!(await isVisible(safetyAction))) {
        throw new Error("safety recovery action not visible in global error bar");
      }
      const errorShot = await recordShot(page, "global-error-safety-action");
      await safetyAction.click();
      await page.locator(".modal--settings").waitFor({ state: "visible", timeout: 5_000 });
      const reopenedSafetyNav = page.locator(".settings-nav__button", { hasText: "Safety" }).first();
      const safetyActive = await waitForCondition(
        async () =>
          (await reopenedSafetyNav.count()) > 0 &&
          (await reopenedSafetyNav.evaluate((element) => element.classList.contains("is-active"))),
        {
          timeout: 5_000,
          description: "global error route back to safety settings"
        }
      );
      if (!safetyActive) {
        throw new Error("global error safety action did not reopen safety settings");
      }
      const routeShot = await recordShot(page, "global-error-safety-routed");
      const restoreDoneButton = page
        .locator(".modal--settings .primary-button:has-text('Done')")
        .first();
      if (await isVisible(restoreDoneButton)) {
        await restoreDoneButton.click();
      }
      await page.waitForTimeout(220);
      const dismissErrorButton = page.locator(".error-bar .icon-button[aria-label='Dismiss error']").first();
      if (await isVisible(dismissErrorButton)) {
        await dismissErrorButton.click();
        await page.waitForTimeout(180);
      }
      return `message=${safetyMessage}; shots=${errorShot}, ${routeShot}`;
    });

    await runStep("workspace editor focus toggle disables auto layout until re-enabled", async () => {
      const settingsButton = page.getByRole("button", { name: "Open settings" }).first();
      if (!(await isVisible(settingsButton))) {
        throw new Error("settings button not found");
      }
      await settingsButton.click();
      await page.locator(".modal--settings").waitFor({ state: "visible", timeout: 5_000 });
      const workspaceNav = page.locator(".settings-nav__button", { hasText: "Workspace" }).first();
      await workspaceNav.click();
      await waitForCondition(
        async () => await workspaceNav.evaluate((element) => element.classList.contains("is-active")),
        {
          timeout: 5_000,
          description: "workspace settings nav activation"
        }
      );
      const editorFocusToggle = page
        .locator(
          ".modal--settings label.settings-checkbox:has-text('Auto-focus alternate-screen terminal editors') input"
        )
        .first();
      if (!(await isVisible(editorFocusToggle))) {
        throw new Error("workspace editor focus toggle not visible");
      }
      const originalEnabled = await editorFocusToggle.isChecked();
      if (originalEnabled) {
        await editorFocusToggle.uncheck();
        await page.waitForTimeout(180);
      }
      const doneButton = page.locator(".modal--settings .primary-button:has-text('Done')").first();
      await doneButton.click();
      await page.waitForTimeout(260);

      await enterSmokeAlternateScreen(page, "TermDock editor focus disabled smoke");
      await page.waitForTimeout(700);
      const focusedLayouts = await page.locator(".layout.is-terminal-editor-focus").count();
      if (focusedLayouts !== 0) {
        throw new Error("editor focus layout still activated while the workspace toggle was disabled");
      }
      if (!(await isVisible(page.locator(".panel--left").first())) || !(await isVisible(page.locator(".panel--right").first()))) {
        throw new Error("side panels should remain visible when editor focus toggle is disabled");
      }
      const disabledShot = await recordShot(page, "editor-focus-mode-disabled");
      await exitSmokeAlternateScreen(page);

      if (originalEnabled) {
        await settingsButton.click();
        await page.locator(".modal--settings").waitFor({ state: "visible", timeout: 5_000 });
        const workspaceNavRestore = page.locator(".settings-nav__button", { hasText: "Workspace" }).first();
        await workspaceNavRestore.click();
        await waitForCondition(
          async () =>
            await workspaceNavRestore.evaluate((element) => element.classList.contains("is-active")),
          {
            timeout: 5_000,
            description: "workspace settings nav restore activation"
          }
        );
        const restoreToggle = page
          .locator(
            ".modal--settings label.settings-checkbox:has-text('Auto-focus alternate-screen terminal editors') input"
          )
          .first();
        if (!(await restoreToggle.isChecked())) {
          await restoreToggle.check();
          await page.waitForTimeout(180);
        }
        const doneRestore = page.locator(".modal--settings .primary-button:has-text('Done')").first();
        await doneRestore.click();
        await page.waitForTimeout(220);
      }

      return disabledShot;
    });

    await runStep("open snippet manager baseline", async () => {
      const snippetButton = page
        .locator(".panel__section--command-history .secondary-button:has-text('Snippets')")
        .first();
      if (!(await isVisible(snippetButton))) {
        throw new Error("snippet manager button not found");
      }
      await snippetButton.click();
      await page.locator(".modal--snippet-manager").waitFor({ state: "visible", timeout: 10000 });
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
        .waitFor({ state: "visible", timeout: 10000 });
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

    await runStep("command history manager localized zh-cn", async () => {
      await openSettingsModal(page);
      await selectInterfaceLanguage(page, "zh-CN");
      await settingsDoneButton(page).click();
      await page.waitForTimeout(260);

      const manageButton = byText(page, ".panel__section--command-history .secondary-button", [
        "Manage",
        "管理"
      ]);
      if (!(await isVisible(manageButton))) {
        throw new Error("manage button not found for localized command history manager");
      }
      await manageButton.click();
      await page
        .locator(".modal--command-history-manager")
        .waitFor({ state: "visible", timeout: 10000 });
      const zhTitle = page.locator(".modal--command-history-manager h3:has-text('命令历史管理')").first();
      const zhAddButton = page
        .locator(".command-history-manager__toolbar .secondary-button:has-text('添加')")
        .first();
      const zhDeleteButton = page
        .locator(".modal--command-history-manager .secondary-button:has-text('删除已选（')")
        .first();
      if (
        !(await isVisible(zhTitle)) ||
        !(await isVisible(zhAddButton)) ||
        !(await isVisible(zhDeleteButton))
      ) {
        throw new Error("localized command history manager controls not visible");
      }
      const zhShot = await recordShot(page, "command-history-manager-zh-cn");
      await page.locator(".modal--command-history-manager .primary-button:has-text('完成')").first().click();
      await page.waitForTimeout(220);

      await restoreEnglishInterface(page);
      return zhShot;
    });

    await runStep("session import dialogs localized zh-cn", async () => {
      let restoredEnglish = false;
      try {
        await openSettingsModal(page);
        await selectInterfaceLanguage(page, "zh-CN");
        await settingsDoneButton(page).click();
        await page.waitForTimeout(260);
        await waitForInterfaceLanguage(page, "zh-CN");

        await page.evaluate(() => {
          window.__termdockSmokeSshConfigResult = {
            filePath: "C:/tmp/termdock-smoke-ssh-config-zh",
            candidates: [
              {
                hostAlias: "smoke-imported-zh",
                name: "smoke-imported-zh",
                host: "127.0.0.1",
                port: 52202,
                username: "smoke",
                authType: "password",
                sourceLine: 1
              }
            ],
            warnings: [
              "C:/tmp/termdock-smoke-ssh-config-zh:5: ProxyJump is not imported yet; sessions that require a bastion host may need manual setup."
            ]
          };
          window.__termdockSmokePickedTextFile = {
            filePath: "C:/tmp/termdock-smoke-sessions-import.json",
            text: JSON.stringify({
              sessions: [
                {
                  id: "smoke-json-import-1",
                  name: "smoke-json-imported",
                  host: "127.0.0.1",
                  port: 52201,
                  username: "smoke",
                  authType: "password",
                  privateKeyPath: "",
                  groupId: "json-import-group",
                  remark: "smoke json preview",
                  favorite: false
                },
                {
                  name: "",
                  host: "127.0.0.1",
                  port: 22,
                  username: "",
                  authType: "password"
                }
              ]
            })
          };
        });

        const sessionSection = page.locator(".panel--right .panel__section").first();
        if (!(await isVisible(sessionSection))) {
          throw new Error("session panel not found for zh-cn import dialogs");
        }

        await sessionSection.click({ button: "right" });
        await page.locator(".sftp-context-menu").waitFor({ state: "visible", timeout: 3000 });
        const zhImportSshConfigItem = page
          .locator(".sftp-context-menu__item:has-text('导入 SSH 配置...')")
          .first();
        if (!(await isVisible(zhImportSshConfigItem))) {
          throw new Error("localized SSH config import menu item not visible");
        }
        await closeMenusAndDialogs(page);
        const zhHookReady = await waitForSmokeHook(page, "__termdockSmokeImportSshConfig");
        if (!zhHookReady) {
          throw new Error("localized SSH config import smoke hook is unavailable");
        }
        const zhHookStarted = await page.evaluate(() => {
          if (typeof window.__termdockSmokeImportSshConfig !== "function") {
            return false;
          }
          window.__termdockSmokeImportSshConfig();
          return true;
        });
        if (!zhHookStarted) {
          throw new Error("localized SSH config import smoke hook did not start");
        }

        const zhSshTargetGroupDialog = page
          .locator(".modal.app-dialog", {
            hasText: "为导入会话设置目标分组。留空则导入到未分组。"
          })
          .first();
        await zhSshTargetGroupDialog.waitFor({ state: "visible", timeout: 5_000 });
        const zhSshGroupInput = zhSshTargetGroupDialog.locator(".app-dialog__input").first();
        await zhSshGroupInput.fill("zh-smoke-imports");
        await zhSshTargetGroupDialog.locator(".primary-button:has-text('查看导入计划')").first().click();

        const zhSshPreviewDialog = page
          .locator(".modal.app-dialog", { hasText: "SSH 配置预览" })
          .first();
        await zhSshPreviewDialog.waitFor({ state: "visible", timeout: 5_000 });
        const zhSshPreviewText = await zhSshPreviewDialog.textContent();
        for (const expected of [
          "要从 termdock-smoke-ssh-config-zh 导入 1 个 Host 条目吗？",
          "解析到的主机：1",
          "新建会话：1",
          "重复目标：0",
          "私钥会话：0",
          "目标分组：zh-smoke-imports",
          "重复项策略：跳过重复项",
          "ProxyJump is not imported yet",
          "smoke-imported-zh"
        ]) {
          if (!zhSshPreviewText?.includes(expected)) {
            throw new Error(
              `localized SSH config preview missing "${expected}"; text=${JSON.stringify(zhSshPreviewText ?? "")}`
            );
          }
        }
        const zhSshShot = await recordShot(page, "zh-cn-ssh-config-import-preview");
        await zhSshPreviewDialog.locator(".secondary-button:has-text('取消')").first().click();
        await page.waitForTimeout(220);

        await sessionSection.click({ button: "right" });
        await page.locator(".sftp-context-menu").waitFor({ state: "visible", timeout: 3000 });
        const zhImportSessionsJsonItem = page
          .locator(".sftp-context-menu__item:has-text('导入会话 JSON...')")
          .first();
        if (!(await isVisible(zhImportSessionsJsonItem))) {
          throw new Error("localized session JSON import menu item not visible");
        }
        await closeMenusAndDialogs(page);
        const zhJsonHookReady = await waitForSmokeHook(page, "__termdockSmokeImportSessionsJson");
        if (!zhJsonHookReady) {
          throw new Error("localized session JSON import smoke hook is unavailable");
        }
        const zhJsonHookStarted = await page.evaluate(() => {
          if (typeof window.__termdockSmokeImportSessionsJson !== "function") {
            return false;
          }
          window.__termdockSmokeImportSessionsJson();
          return true;
        });
        if (!zhJsonHookStarted) {
          throw new Error("localized session JSON import smoke hook did not start");
        }

        let zhJsonShot = "";
        try {
          const zhJsonPreviewDialog = page
            .locator(".modal.app-dialog", { hasText: "会话 JSON 预览" })
            .first();
          await zhJsonPreviewDialog.waitFor({ state: "visible", timeout: 5_000 });
          const zhJsonPreviewText = await zhJsonPreviewDialog.textContent();
          for (const expected of [
            "导入前请先检查已解析的会话。",
            "可导入会话：1",
            "smoke-json-imported",
            "警告：",
            "第 2 行缺少必填字段（name/host/username），已跳过。"
          ]) {
            if (!zhJsonPreviewText?.includes(expected)) {
              throw new Error(
                `localized session JSON preview missing "${expected}"; text=${JSON.stringify(zhJsonPreviewText ?? "")}`
              );
            }
          }
          zhJsonShot = await recordShot(page, "zh-cn-session-json-import-preview");
          await zhJsonPreviewDialog.locator(".primary-button:has-text('继续')").first().click();

          const zhJsonGroupDialog = page
            .locator(".modal.app-dialog", { hasText: "分组策略" })
            .first();
          await zhJsonGroupDialog.waitFor({ state: "visible", timeout: 5_000 });
          const zhJsonGroupText = await zhJsonGroupDialog.textContent();
          for (const expected of [
            "为导入会话选择目标分组策略。",
            "保留文件中的分组",
            "强制使用当前分组",
            "移动到未分组"
          ]) {
            if (!zhJsonGroupText?.includes(expected)) {
              throw new Error(`localized session JSON group choice missing "${expected}"`);
            }
          }
          await zhJsonGroupDialog.locator(".secondary-button:has-text('取消')").first().click();
          await page.waitForTimeout(220);
        } finally {
          await closeMenusAndDialogs(page, { closeTopLevelModals: true });
        }

        await sessionSection.click({ button: "right" });
        await page.locator(".sftp-context-menu").waitFor({ state: "visible", timeout: 3000 });
        const zhImportEncryptedItem = page
          .locator(".sftp-context-menu__item:has-text('导入加密迁移包...')")
          .first();
        if (!(await isVisible(zhImportEncryptedItem))) {
          throw new Error("localized encrypted migration import menu item not visible");
        }
        await closeMenusAndDialogs(page);
        await page.evaluate(() => {
          window.__termdockSmokePickedTextFile = {
            filePath: "C:/tmp/termdock-smoke-session-migration.tdmigration",
            text: "__TERMDOCK_SMOKE_MIGRATION__"
          };
        });
        const zhEncryptedHookReady = await waitForSmokeHook(
          page,
          "__termdockSmokeImportEncryptedMigration"
        );
        if (!zhEncryptedHookReady) {
          throw new Error("localized encrypted migration import smoke hook is unavailable");
        }
        const zhEncryptedHookStarted = await page.evaluate(() => {
          if (typeof window.__termdockSmokeImportEncryptedMigration !== "function") {
            return false;
          }
          window.__termdockSmokeImportEncryptedMigration();
          return true;
        });
        if (!zhEncryptedHookStarted) {
          throw new Error("localized encrypted migration import smoke hook did not start");
        }

        const zhEncryptedPassphraseDialog = page
          .locator(".modal.app-dialog", {
            hasText: /导入加密迁移包|输入迁移口令。/u
          })
          .first();
        try {
          await zhEncryptedPassphraseDialog.waitFor({ state: "visible", timeout: 5_000 });
        } catch (error) {
          const visibleUi = await describeVisibleUi(page);
          throw new Error(
            `localized encrypted migration prompt missing; ui=${JSON.stringify(visibleUi)}; cause=${asErrorMessage(error)}`
          );
        }
        const zhEncryptedPassphraseText = await zhEncryptedPassphraseDialog.textContent();
        for (const expected of ["导入加密迁移包", "输入迁移口令。", "解密", "取消"]) {
          if (!zhEncryptedPassphraseText?.includes(expected)) {
            throw new Error(
              `localized encrypted migration prompt missing "${expected}"; text=${JSON.stringify(zhEncryptedPassphraseText ?? "")}`
            );
          }
        }
        const zhEncryptedPromptShot = await recordShot(page, "zh-cn-encrypted-migration-passphrase");
        await zhEncryptedPassphraseDialog.locator(".app-dialog__input").first().fill("smoke migration passphrase");
        await zhEncryptedPassphraseDialog.locator(".primary-button:has-text('解密')").first().click();

        const zhEncryptedPreviewDialog = page
          .locator(".modal.app-dialog", { hasText: "加密迁移预览" })
          .first();
        await zhEncryptedPreviewDialog.waitFor({ state: "visible", timeout: 8_000 });
        const zhEncryptedPreviewText = await zhEncryptedPreviewDialog.textContent();
        for (const expected of ["可导入会话：2", "已恢复加密密码：2", "私钥会话：0", "已恢复密码"]) {
          if (!zhEncryptedPreviewText?.includes(expected)) {
            throw new Error(
              `localized encrypted migration preview missing "${expected}"; text=${JSON.stringify(zhEncryptedPreviewText ?? "")}`
            );
          }
        }
        const zhEncryptedPreviewShot = await recordShot(page, "zh-cn-encrypted-migration-preview");
        await zhEncryptedPreviewDialog.locator(".primary-button:has-text('继续')").first().click();

        const zhEncryptedGroupDialog = page
          .locator(".modal.app-dialog", { hasText: "分组策略" })
          .first();
        await zhEncryptedGroupDialog.waitFor({ state: "visible", timeout: 5_000 });
        const zhEncryptedGroupText = await zhEncryptedGroupDialog.textContent();
        for (const expected of [
          "为导入会话选择目标分组策略。",
          "保留文件中的分组",
          "强制使用当前分组",
          "移动到未分组"
        ]) {
          if (!zhEncryptedGroupText?.includes(expected)) {
            throw new Error(
              `localized encrypted migration group choice missing "${expected}"; text=${JSON.stringify(zhEncryptedGroupText ?? "")}`
            );
          }
        }
        const zhEncryptedGroupShot = await recordShot(page, "zh-cn-encrypted-migration-group-choice");
        await zhEncryptedGroupDialog.locator(".secondary-button:has-text('取消')").first().click();
        await page.waitForTimeout(220);

        await restoreEnglishInterface(page);
        await waitForInterfaceLanguage(page, "en");
        await page.evaluate(() => {
          window.__termdockSmokeSshConfigResult = {
            filePath: "C:/tmp/termdock-smoke-ssh-config",
            candidates: [
              {
                hostAlias: "smoke-imported",
                name: "smoke-imported",
                host: "127.0.0.1",
                port: 52199,
                username: "smoke",
                authType: "password",
                sourceLine: 1
              }
            ],
            warnings: [
              "C:/tmp/termdock-smoke-ssh-config:4: IdentityFile \"C:/missing/termdock-smoke-key\" for Host \"smoke-imported\" does not exist or is not a regular file after expansion.",
              "C:/tmp/termdock-smoke-ssh-config:5: ProxyJump is not imported yet; sessions that require a bastion host may need manual setup."
            ]
          };
        });
        restoredEnglish = true;
        return `${zhSshShot}, ${zhJsonShot}, ${zhEncryptedPromptShot}, ${zhEncryptedPreviewShot}, ${zhEncryptedGroupShot}`;
      } finally {
        if (!restoredEnglish) {
          try {
            await closeMenusAndDialogs(page, { closeTopLevelModals: true });
            await restoreEnglishInterface(page);
            await waitForInterfaceLanguage(page, "en");
          } catch {
            // Best effort cleanup so later smoke steps keep using the expected locale.
          }
        }
      }
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
      const trigger = byText(page, "button", ["Operation Center", "操作中心"]);
      if (!(await isVisible(trigger))) {
        throw new Error("operation center trigger not found");
      }
      await trigger.click();
      await page
        .locator(".modal--operation-center")
        .waitFor({ state: "visible", timeout: 10000 });
      const trackedJobsTitle = page
        .locator(".modal--operation-center .operation-center__title", {
          hasText: "Tracked App Jobs"
        })
        .first();
      if (!(await isVisible(trackedJobsTitle))) {
        throw new Error("tracked app jobs card not visible");
      }
      const timelineTitle = page
        .locator(".modal--operation-center .operation-center__title", {
          hasText: "Activity Timeline"
        })
        .first();
      if (!(await isVisible(timelineTitle))) {
        throw new Error("operation center activity timeline not visible");
      }
      const timelineItem = page.locator(".modal--operation-center .operation-center__timeline-item").first();
      if (!(await isVisible(timelineItem))) {
        throw new Error("operation center activity timeline has no items");
      }
      const groupedControlsTitle = page
        .locator(".modal--operation-center .operation-center__title", {
          hasText: "Grouped Controls"
        })
        .first();
      if (!(await isVisible(groupedControlsTitle))) {
        throw new Error("operation center grouped controls not visible");
      }
      const groupedControls = page.locator(".modal--operation-center .operation-center__control-group");
      if ((await groupedControls.count()) < 3) {
        throw new Error("operation center grouped controls are incomplete");
      }
      const portForwardCard = page
        .locator(".modal--operation-center .operation-center__card", {
          has: page.locator(".operation-center__title", { hasText: "Port Forwarding Ops" })
        })
        .first();
      if (!(await isVisible(portForwardCard))) {
        throw new Error("port forwarding ops card not visible");
      }
      await waitForCondition(
        async () => {
          const text = ((await portForwardCard.textContent()) ?? "").replace(/\s+/g, " ").trim();
          return text.includes("tabs ") && text.includes("active forwards") ? text : false;
        },
        {
          timeout: 10_000,
          description: "operation center port forwarding summary"
        }
      );
      const fileName = await recordShot(page, "operation-center-open");
      const done = byText(page, ".modal--operation-center .primary-button", ["Done", "完成"]);
      if (await isVisible(done)) {
        await done.click();
        await page.waitForTimeout(220);
      }
      return fileName;
    });

    await runStep("open retry center", async () => {
      const trigger = byText(page, "button", ["Retry Center", "重试中心"]);
      if (!(await isVisible(trigger))) {
        throw new Error("retry center trigger not found");
      }
      await trigger.click();
      await page.locator(".modal--retry-center").waitFor({ state: "visible", timeout: 10000 });
      const openShot = await recordShot(page, "retry-center-open");

      const viewSelect = page.locator(".modal--retry-center select").nth(4);
      if (await isVisible(viewSelect)) {
        await viewSelect.selectOption("groupedByReason");
        await page.waitForTimeout(240);
      }
      const groupedShot = await recordShot(page, "retry-center-grouped-view");

      const done = byText(page, ".modal--retry-center .primary-button", ["Done", "完成"]);
      if (!(await isVisible(done))) {
        throw new Error("retry center done button not found");
      }
      await done.click();
      await page.waitForTimeout(220);

      await openSettingsModal(page);
      await selectInterfaceLanguage(page, "zh-CN");
      const zhDone = settingsDoneButton(page);
      if (!(await isVisible(zhDone))) {
        throw new Error("localized settings done button not visible");
      }
      await zhDone.click();
      await page.waitForTimeout(260);

      const zhTrigger = page.locator("button:has-text('重试中心')").first();
      if (!(await isVisible(zhTrigger))) {
        throw new Error("localized retry center trigger not found");
      }
      await zhTrigger.click();
      await page.locator(".modal--retry-center").waitFor({ state: "visible", timeout: 10000 });
      const zhTitle = page.locator(".modal--retry-center h3:has-text('传输重试中心')").first();
      if (!(await isVisible(zhTitle))) {
        throw new Error("localized retry center title not visible");
      }
      const zhRetryAction = page
        .locator(".modal--retry-center .secondary-button:has-text('重试所有失败项')")
        .first();
      if (!(await isVisible(zhRetryAction))) {
        throw new Error("localized retry center retry-all action not visible");
      }
      const zhShot = await recordShot(page, "retry-center-zh-cn");
      await page.locator(".modal--retry-center .primary-button:has-text('完成')").first().click();
      await page.waitForTimeout(220);

      await restoreEnglishInterface(page);
      return `${openShot}, ${groupedShot}, ${zhShot}`;
    });

    await runStep("unexpected fixture shutdown captures disconnect report", async () => {
      if (!fixtureClosed) {
        await fixture.close();
        fixtureClosed = true;
      }

      const settingsTrigger = settingsButton(page);
      if (!(await isVisible(settingsTrigger))) {
        throw new Error("settings button not found after fixture shutdown");
      }
      await settingsTrigger.click();
      await page.locator(".modal--settings").waitFor({ state: "visible", timeout: 5000 });

      const diagnosticsNav = settingsNavButton(page, ["Diagnostics", "诊断"]);
      if (!(await isVisible(diagnosticsNav))) {
        throw new Error("diagnostics nav button not found");
      }
      await diagnosticsNav.click();
      await page.waitForTimeout(260);

      const disconnectScope = page
        .locator(".modal--settings .settings-disconnect-reports-toolbar select")
        .first();
      if (await isVisible(disconnectScope)) {
        await disconnectScope.selectOption("allSessions");
      }
      const resetFilters = page
        .locator(
          ".modal--settings .settings-disconnect-reports-toolbar button:has-text('Reset Filters'), .modal--settings .settings-disconnect-reports-toolbar button:has-text('重置筛选')"
        )
        .first();
      if (await isVisible(resetFilters) && !(await resetFilters.isDisabled())) {
        await resetFilters.click();
        await page.waitForTimeout(220);
      }

      const summaryText = await waitForCondition(
        async () => {
          const heading = page
            .locator(".modal--settings .settings-port-forward-section__title", {
              hasText: /Disconnect Reports \(|断开报告 \(/u
            })
            .first();
          if (!(await isVisible(heading))) {
            return false;
          }
          const text = ((await heading.textContent()) ?? "").replace(/\s+/g, " ").trim();
          const match =
            text.match(/Disconnect Reports \((\d+)\/(\d+)\)/i) ??
            text.match(/断开报告 \((\d+)\/(\d+)\)/u);
          if (!match) {
            return false;
          }
          const visibleCount = Number.parseInt(match[1] ?? "0", 10);
          const totalCount = Number.parseInt(match[2] ?? "0", 10);
          if (visibleCount <= 0 || totalCount <= 0) {
            return false;
          }
          return text;
        },
        {
          timeout: 15_000,
          description: "disconnect report captured after fixture shutdown"
        }
      );

      const copyLatestVisible = page
        .locator(
          ".modal--settings button:has-text('Copy Latest Visible'), .modal--settings button:has-text('复制最新可见项')"
        )
        .first();
      if (!(await isVisible(copyLatestVisible)) || (await copyLatestVisible.isDisabled())) {
        throw new Error("disconnect report actions did not enable after fixture shutdown");
      }

      const fileName = await recordShot(page, "diagnostics-disconnect-report-captured");
      const done = settingsDoneButton(page);
      if (await isVisible(done)) {
        await done.click();
        await page.waitForTimeout(220);
      }
      return `${summaryText}, shot=${fileName}`;
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
    if (pageRef.current) {
      try {
        await closeMenusAndDialogs(pageRef.current, { closeTopLevelModals: true });
      } catch {
        // Best effort UI cleanup before shutting down the app.
      }
      try {
        const createdPaths = await pageRef.current.evaluate(() =>
          Array.isArray(window.__termdockSmokeCreatedLocalPaths)
            ? window.__termdockSmokeCreatedLocalPaths.slice()
            : []
        );
        for (const targetPath of createdPaths) {
          smokeCreatedLocalPaths.add(targetPath);
        }
      } catch {
        // Ignore runtime read failures during shutdown cleanup.
      }
    }
    smokeCreatedLocalPaths.add(downloadTargetPath);
    smokeCreatedLocalPaths.add(remoteOpenConflictLocalPath);
    smokeCreatedLocalPaths.add(remoteOpenReloadedLocalPath);
    for (const targetPath of smokeCreatedLocalPaths) {
      await removeLocalPathIfPresent(targetPath);
    }
    if (app) {
      await app.close();
    }
    if (!fixtureClosed) {
      await fixture.close();
    }
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
