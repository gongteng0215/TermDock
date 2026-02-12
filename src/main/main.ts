import { app, BrowserWindow } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { registerSessionHandlers } from "./ipc/register-session-handlers.js";
import { registerSystemHandlers } from "./ipc/register-system-handlers.js";
import { registerTerminalHandlers } from "./ipc/register-terminal-handlers.js";
import { createCredentialStore } from "./security/credential-store.js";
import { SessionStore } from "./storage/session-store.js";
import { TerminalService } from "./terminal/terminal-service.js";

const isMac = process.platform === "darwin";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const shouldDisableGpu =
  process.env.TERMDOCK_DISABLE_GPU === "1" ||
  process.env.TERMDOCK_DISABLE_GPU === "true";
const shouldOpenDevtools =
  process.env.TERMDOCK_OPEN_DEVTOOLS === "1" ||
  process.env.TERMDOCK_OPEN_DEVTOOLS === "true";

if (shouldDisableGpu) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
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

async function bootstrap(): Promise<void> {
  const dbPath = join(app.getPath("userData"), "db", "sessions.json");
  const sessionStore = new SessionStore(dbPath);
  const credentialStore = await createCredentialStore();

  const terminalService = new TerminalService(sessionStore, credentialStore);
  registerSessionHandlers(sessionStore, credentialStore);
  registerSystemHandlers();
  registerTerminalHandlers(terminalService);

  await app.whenReady();
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

void bootstrap();
