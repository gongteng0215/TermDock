import { app, BrowserWindow, Menu } from "electron";
import type { BrowserWindowConstructorOptions, MenuItemConstructorOptions } from "electron";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { registerSftpHandlers } from "./ipc/register-sftp-handlers.js";
import { registerSessionHandlers } from "./ipc/register-session-handlers.js";
import { registerSystemHandlers } from "./ipc/register-system-handlers.js";
import { registerTerminalHandlers } from "./ipc/register-terminal-handlers.js";
import { createCredentialStore } from "./security/credential-store.js";
import { SessionStore } from "./storage/session-store.js";
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

if (shouldDisableGpu) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
}

function createWindow(): void {
  const windowOptions: BrowserWindowConstructorOptions = {
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 640,
    title: "TermDock",
    titleBarStyle: isMac ? "hiddenInset" : "default",
    backgroundColor: "#0b0e12",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  };
  if (!isMac && runtimeWindowIconPath) {
    windowOptions.icon = runtimeWindowIconPath;
  }
  const mainWindow = new BrowserWindow(windowOptions);
  setupApplicationMenu(mainWindow);
  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[TermDock] Renderer load failed (${errorCode}): ${errorDescription} | ${validatedURL}`
      );
    }
  );

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
            console.error(
              `[TermDock] Desktop bridge missing in renderer. typeof window.termdock = ${String(
                result
              )}`
            );
          }
        })
        .catch((error: Error) => {
          console.error("[TermDock] Bridge probe failed:", error.message);
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

async function bootstrap(): Promise<void> {
  const dbPath = join(app.getPath("userData"), "db", "sessions.json");
  const sessionStore = new SessionStore(dbPath);
  const credentialStore = await createCredentialStore();

  const terminalService = new TerminalService(sessionStore, credentialStore);
  registerSessionHandlers(sessionStore, credentialStore);
  registerSystemHandlers();
  registerTerminalHandlers(terminalService);
  registerSftpHandlers(terminalService);

  await app.whenReady();
  if (isMac) {
    await applyMacDockIcon();
  }
  createWindow();

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

void bootstrap().catch((error: Error) => {
  console.error("[TermDock] bootstrap failed:", error.message);
});

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
      console.warn(
        `[TermDock] Failed to set dock icon from ${iconPath}: ${(error as Error).message}`
      );
    }
  }
}
