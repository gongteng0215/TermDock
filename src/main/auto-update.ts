import { app, dialog } from "electron";
import electronUpdater from "electron-updater";
import type { ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from "electron-updater";

import { appLogger } from "./logging/app-logger.js";

const { autoUpdater } = electronUpdater;
const AUTO_UPDATE_CHECK_DELAY_MS = 8_000;
const DISABLE_AUTO_UPDATE_ENV = "TERMDOCK_DISABLE_AUTO_UPDATE";
const SMOKE_USER_DATA_ENV = "TERMDOCK_SMOKE_USER_DATA_DIR";

let hasInitializedAutoUpdate = false;

export function initializeAutoUpdate(): void {
  if (hasInitializedAutoUpdate) {
    return;
  }
  hasInitializedAutoUpdate = true;

  if (!shouldEnableAutoUpdate()) {
    appLogger.log("info", "main:auto-update", "Auto update checks are disabled for this run.");
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = app.getVersion().includes("-");
  autoUpdater.logger = {
    info: (message?: unknown) => {
      appLogger.log("info", "main:auto-update", String(message ?? ""));
    },
    warn: (message?: unknown) => {
      appLogger.log("warn", "main:auto-update", String(message ?? ""));
    },
    error: (message?: unknown) => {
      appLogger.log("error", "main:auto-update", String(message ?? ""));
    }
  };

  autoUpdater.on("checking-for-update", () => {
    appLogger.log("info", "main:auto-update", "Checking for updates.");
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    appLogger.log("info", "main:auto-update", `Update available: ${info.version}.`, {
      version: info.version,
      releaseDate: info.releaseDate
    });
  });

  autoUpdater.on("update-not-available", (info: UpdateInfo) => {
    appLogger.log("info", "main:auto-update", `No update available: ${info.version}.`, {
      version: info.version,
      releaseDate: info.releaseDate
    });
  });

  autoUpdater.on("download-progress", (info: ProgressInfo) => {
    appLogger.log("debug", "main:auto-update", "Update download progress.", {
      percent: Math.round(info.percent),
      transferred: info.transferred,
      total: info.total,
      bytesPerSecond: info.bytesPerSecond
    });
  });

  autoUpdater.on("update-downloaded", (event: UpdateDownloadedEvent) => {
    void promptToInstallDownloadedUpdate(event);
  });

  autoUpdater.on("error", (error: Error, message?: string) => {
    appLogger.log("error", "main:auto-update", message ?? "Auto update check failed.", error);
  });

  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((error: Error) => {
      appLogger.log("error", "main:auto-update", "Failed to start auto update check.", error);
    });
  }, AUTO_UPDATE_CHECK_DELAY_MS);
}

function shouldEnableAutoUpdate(): boolean {
  if (!app.isPackaged) {
    return false;
  }
  if (process.env[SMOKE_USER_DATA_ENV]?.trim()) {
    return false;
  }
  const disabledValue = process.env[DISABLE_AUTO_UPDATE_ENV]?.trim().toLowerCase();
  return disabledValue !== "1" && disabledValue !== "true";
}

async function promptToInstallDownloadedUpdate(event: UpdateDownloadedEvent): Promise<void> {
  appLogger.log("info", "main:auto-update", `Update downloaded: ${event.version}.`, {
    version: event.version,
    releaseDate: event.releaseDate
  });

  const result = await dialog.showMessageBox({
    type: "info",
    buttons: ["Restart and Install", "Later"],
    defaultId: 0,
    cancelId: 1,
    title: "TermDock Update Ready",
    message: `TermDock ${event.version} is ready to install.`,
    detail: "Restart TermDock now to finish installing the update."
  });

  if (result.response !== 0) {
    appLogger.log("info", "main:auto-update", "User postponed installing downloaded update.", {
      version: event.version
    });
    return;
  }

  appLogger.log("info", "main:auto-update", "Restarting to install downloaded update.", {
    version: event.version
  });
  autoUpdater.quitAndInstall(false, true);
}
