import { app, BrowserWindow, Menu } from "electron";
import type { BrowserWindowConstructorOptions, MenuItemConstructorOptions } from "electron";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { initializeAutoUpdate } from "./auto-update.js";
import { registerSftpHandlers } from "./ipc/register-sftp-handlers.js";
import { registerSessionHandlers } from "./ipc/register-session-handlers.js";
import { registerStorageHandlers } from "./ipc/register-storage-handlers.js";
import { registerAppBackupHandlers } from "./ipc/register-app-backup-handlers.js";
import { registerSystemHandlers } from "./ipc/register-system-handlers.js";
import { registerTerminalHandlers } from "./ipc/register-terminal-handlers.js";
import { appLogger } from "./logging/app-logger.js";
import { createCredentialStore } from "./security/credential-store.js";
import { DualWriteSessionStore } from "./storage/dual-write-session-store.js";
import { SessionStore } from "./storage/session-store.js";
import { SqliteDisconnectReportStore } from "./storage/sqlite/sqlite-disconnect-report-store.js";
import { SqlitePortForwardEventStore } from "./storage/sqlite/sqlite-port-forward-event-store.js";
import { SqliteWorkbenchStore } from "./storage/sqlite/sqlite-workbench-store.js";
import { SqlitePreferenceStore } from "./storage/sqlite/sqlite-preference-store.js";
import { SqliteSessionStore } from "./storage/sqlite/sqlite-session-store.js";
import { SqliteTransferStore } from "./storage/sqlite/sqlite-transfer-store.js";
import { TerminalService } from "./terminal/terminal-service.js";

const isMac = process.platform === "darwin";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..", "..");
const shouldDisableGpu =
  process.env.TERMDOCK_DISABLE_GPU === "1" ||
  process.env.TERMDOCK_DISABLE_GPU === "true";
const shouldOpenDevtools =
  process.env.TERMDOCK_OPEN_DEVTOOLS === "1" ||
  process.env.TERMDOCK_OPEN_DEVTOOLS === "true";
const OPEN_SETTINGS_CHANNEL = "app:openSettings";
const runtimeIconCandidates = resolveRuntimeIconCandidates();
const runtimeWindowIconPath = runtimeIconCandidates[0] ?? null;
const smokeUserDataOverride = process.env.TERMDOCK_SMOKE_USER_DATA_DIR?.trim() ?? "";

if (smokeUserDataOverride) {
  const smokeUserDataPath = resolve(smokeUserDataOverride);
  app.setPath("userData", smokeUserDataPath);
  app.setPath("sessionData", join(smokeUserDataPath, "session-data"));
}

// Required for per-pixel alpha on Windows before app ready.
if (process.platform === "win32") {
  app.commandLine.appendSwitch("enable-transparent-visuals");
}

if (shouldDisableGpu) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

function focusExistingWindow(): void {
  const existingWindow = BrowserWindow.getAllWindows().find((windowRef) => !windowRef.isDestroyed());
  if (!existingWindow) {
    return;
  }
  if (existingWindow.isMinimized()) {
    existingWindow.restore();
  }
  existingWindow.show();
  existingWindow.focus();
}

const WINDOW_TITLEBAR_OVERLAY_HEIGHT = 36;

function createWindow(): void {
  // Transparent client area is always on so Tech can show the desktop between
  // floating panels. Default theme paints an opaque CSS fill over the whole stage.
  // Windows needs hidden title bar + overlay controls; framed transparent windows
  // commonly paint solid white on Win10/11.
  const windowOptions: BrowserWindowConstructorOptions = {
    width: 1680,
    height: 960,
    minWidth: 1200,
    minHeight: 720,
    title: "TermDock",
    autoHideMenuBar: !isMac,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    // Shadow on layered Win windows often forces an opaque white underlay.
    hasShadow: isMac,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  };
  if (isMac) {
    windowOptions.titleBarStyle = "hiddenInset";
  } else {
    // Framed transparent windows paint white on many Windows setups.
    windowOptions.frame = false;
  }
  if (!isMac && runtimeWindowIconPath) {
    windowOptions.icon = runtimeWindowIconPath;
  }
  const mainWindow = new BrowserWindow(windowOptions);
  // Re-assert after construction — some Windows builds reset the clear color.
  mainWindow.setBackgroundColor("#00000000");
  if (isMac) {
    setupApplicationMenu(mainWindow);
  } else {
    Menu.setApplicationMenu(null);
    mainWindow.setMenu(null);
    mainWindow.setAutoHideMenuBar(true);
    mainWindow.setMenuBarVisibility(false);
  }
  mainWindow.once("ready-to-show", () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.setBackgroundColor("#00000000");
      mainWindow.show();
    }
  });
  const markTransparentChrome = () => {
    if (mainWindow.isDestroyed()) {
      return;
    }
    void mainWindow.webContents
      .executeJavaScript(
        `(() => {
          const root = document.documentElement;
          root.dataset.windowTransparent = "1";
          root.style.setProperty("--window-titlebar-height", "${WINDOW_TITLEBAR_OVERLAY_HEIGHT}px");
        })();`
      )
      .catch((error: Error) => {
        appLogger.log("warn", "main:window", "Failed to mark transparent chrome.", error);
      });
  };
  mainWindow.webContents.on("dom-ready", markTransparentChrome);
  mainWindow.webContents.on("did-finish-load", markTransparentChrome);
  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      appLogger.log(
        "error",
        "main:window",
        `Renderer load failed (${errorCode}): ${errorDescription}`,
        { validatedURL }
      );
      if (!mainWindow.isDestroyed() && !mainWindow.isVisible()) {
        mainWindow.show();
      }
    }
  );
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    appLogger.log("error", "main:window", `Renderer process gone: ${details.reason}`, details);
  });
  mainWindow.on("unresponsive", () => {
    appLogger.log("warn", "main:window", "Main window became unresponsive.");
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
    if (shouldOpenDevtools) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
    mainWindow.webContents.on("did-finish-load", () => {
      void mainWindow.webContents
        .executeJavaScript("typeof window.termdock")
        .then((result) => {
          if (result !== "object") {
            appLogger.log(
              "error",
              "main:window",
              `[TermDock] Desktop bridge missing in renderer. typeof window.termdock = ${String(
                result
              )}`
            );
          }
        })
        .catch((error: Error) => {
          appLogger.log("error", "main:window", "Bridge probe failed.", error);
        });
    });
    return;
  }

  void mainWindow.loadFile(join(__dirname, "..", "..", "dist", "index.html"));
}

function emitOpenSettings(targetWindow?: BrowserWindow | null): void {
  const fallbackWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  const windowRef = targetWindow ?? fallbackWindow;
  if (!windowRef || windowRef.isDestroyed()) {
    return;
  }
  windowRef.webContents.send(OPEN_SETTINGS_CHANNEL);
}

function setupApplicationMenu(mainWindow: BrowserWindow): void {
  const settingsItem: MenuItemConstructorOptions = {
    label: "Settings...",
    accelerator: isMac ? "Command+," : "Ctrl+,",
    click: () => {
      emitOpenSettings(mainWindow);
    }
  };

  const template: MenuItemConstructorOptions[] = isMac
    ? [
        {
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            settingsItem,
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" }
          ]
        },
        { role: "fileMenu" },
        { role: "editMenu" },
        { role: "viewMenu" },
        { role: "windowMenu" },
        { role: "help" }
      ]
    : [
        {
          label: "File",
          submenu: [settingsItem, { type: "separator" }, { role: "quit" }]
        },
        { role: "editMenu" },
        { role: "viewMenu" },
        { role: "windowMenu" },
        { role: "help" }
      ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on("second-instance", () => {
  focusExistingWindow();
});

async function bootstrap(): Promise<void> {
  await app.whenReady();
  appLogger.initialize();
  installGlobalErrorLogging();

  const dbPath = join(app.getPath("userData"), "db", "sessions.json");
  const sqlitePath = join(app.getPath("userData"), "db", "termdock.sqlite");
  const jsonSessionStore = new SessionStore(dbPath);
  const forceJsonStore =
    process.env.TERMDOCK_SESSION_STORE?.trim().toLowerCase() === "json";
  let sessionStore: SessionStore | DualWriteSessionStore = jsonSessionStore;
  let transferStore: SqliteTransferStore | null = null;
  let disconnectReportStore: SqliteDisconnectReportStore | null = null;
  let portForwardEventStore: SqlitePortForwardEventStore | null = null;
  let workbenchStore: SqliteWorkbenchStore | null = null;
  let preferenceStore: SqlitePreferenceStore | null = null;
  try {
    const sqliteSessionStore = new SqliteSessionStore(sqlitePath);
    const sqliteDb = sqliteSessionStore.getDatabase();
    transferStore = new SqliteTransferStore(sqliteDb);
    disconnectReportStore = new SqliteDisconnectReportStore(sqliteDb);
    portForwardEventStore = new SqlitePortForwardEventStore(sqliteDb);
    workbenchStore = new SqliteWorkbenchStore(sqliteDb);
    preferenceStore = new SqlitePreferenceStore(sqliteDb);
    if (forceJsonStore) {
      console.warn(
        "[sqlite] TERMDOCK_SESSION_STORE=json — sessions use JSON; durable SQLite stores remain available."
      );
    } else {
      sessionStore = new DualWriteSessionStore(jsonSessionStore, sqliteSessionStore);
    }
  } catch (error) {
    console.warn("[sqlite] unavailable; falling back to sessions.json / localStorage:", error);
  }
  const credentialStore = await createCredentialStore();

  const terminalService = new TerminalService(sessionStore, credentialStore);
  registerSessionHandlers(sessionStore, credentialStore);
  registerStorageHandlers({
    transferStore,
    disconnectReportStore,
    portForwardEventStore,
    workbenchStore,
    preferenceStore
  });
  registerAppBackupHandlers({
    sessionStore,
    credentialStore,
    transferStore,
    disconnectReportStore,
    portForwardEventStore,
    workbenchStore,
    preferenceStore
  });
  registerSystemHandlers(terminalService);
  registerTerminalHandlers(terminalService);
  registerSftpHandlers(terminalService);

  if (isMac) {
    await applyMacDockIcon();
  }
  createWindow();
  initializeAutoUpdate();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

app.on("window-all-closed", () => {
  if (!isMac) {
    app.quit();
  }
});

if (hasSingleInstanceLock) {
  void bootstrap().catch((error: Error) => {
    appLogger.log("error", "main:bootstrap", "Bootstrap failed.", error);
  });
}

function resolveRuntimeIconCandidates(): string[] {
  const candidates =
    process.platform === "darwin"
      ? [join(projectRoot, "build", "icon-source.png"), join(projectRoot, "build", "icon.icns")]
      : process.platform === "win32"
        ? [join(projectRoot, "build", "icon.ico"), join(projectRoot, "build", "icon-source.png")]
        : [join(projectRoot, "build", "icon-source.png")];
  return candidates.filter((candidate) => existsSync(candidate));
}

async function applyMacDockIcon(): Promise<void> {
  if (!app.dock || runtimeIconCandidates.length === 0) {
    return;
  }
  for (const iconPath of runtimeIconCandidates) {
    try {
      await Promise.resolve(app.dock.setIcon(iconPath));
      return;
    } catch (error) {
      appLogger.log(
        "warn",
        "main:icon",
        `Failed to set dock icon from ${iconPath}.`,
        error
      );
    }
  }
}

function installGlobalErrorLogging(): void {
  process.on("uncaughtException", (error) => {
    appLogger.log("error", "main:uncaughtException", "Unhandled exception in main process.", error);
  });
  process.on("unhandledRejection", (reason) => {
    appLogger.log("error", "main:unhandledRejection", "Unhandled promise rejection.", reason);
  });
}
