import { app, dialog } from "electron";
import electronUpdater from "electron-updater";
import type { ProgressInfo, UpdateCheckResult, UpdateDownloadedEvent, UpdateInfo } from "electron-updater";

import { appLogger } from "./logging/app-logger.js";

const { autoUpdater } = electronUpdater;
const AUTO_UPDATE_CHECK_DELAY_MS = 8_000;
const DISABLE_AUTO_UPDATE_ENV = "TERMDOCK_DISABLE_AUTO_UPDATE";
const SMOKE_USER_DATA_ENV = "TERMDOCK_SMOKE_USER_DATA_DIR";

let hasInitializedAutoUpdate = false;
let autoUpdateStatus: AutoUpdateStatusSnapshot = {
  availability: "disabled",
  statusLabel: "Auto updates are unavailable in development builds.",
  currentVersion: app.getVersion(),
  lastCheckedAtIso: null,
  latestVersion: null,
  downloadedVersion: null,
  downloadProgressPercent: null,
  updateReadyToInstall: false
};

export interface ManualUpdateCheckResult {
  status: "disabled" | "checking" | "available" | "not-available";
  version?: string;
}

export interface AutoUpdateStatusSnapshot {
  availability: "disabled" | "idle" | "checking" | "available" | "not-available" | "downloaded" | "error";
  statusLabel: string;
  currentVersion: string;
  lastCheckedAtIso: string | null;
  latestVersion: string | null;
  downloadedVersion: string | null;
  downloadProgressPercent: number | null;
  updateReadyToInstall: boolean;
}

export function getAutoUpdateStatus(): AutoUpdateStatusSnapshot {
  return {
    ...autoUpdateStatus
  };
}

export function initializeAutoUpdate(): void {
  if (hasInitializedAutoUpdate) {
    return;
  }
  hasInitializedAutoUpdate = true;

  if (!shouldEnableAutoUpdate()) {
    autoUpdateStatus = {
      ...autoUpdateStatus,
      availability: "disabled",
      statusLabel: "Auto updates are disabled for this run.",
      downloadProgressPercent: null,
      latestVersion: null,
      downloadedVersion: null,
      updateReadyToInstall: false
    };
    appLogger.log("info", "main:auto-update", "Auto update checks are disabled for this run.");
    return;
  }

  autoUpdateStatus = {
    ...autoUpdateStatus,
    availability: "idle",
    statusLabel: "Ready to check for updates.",
    currentVersion: app.getVersion(),
    downloadProgressPercent: null,
    latestVersion: null,
    downloadedVersion: null,
    updateReadyToInstall: false
  };

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
    autoUpdateStatus = {
      ...autoUpdateStatus,
      availability: "checking",
      statusLabel: "Checking for updates...",
      currentVersion: app.getVersion(),
      lastCheckedAtIso: new Date().toISOString(),
      latestVersion: null,
      downloadedVersion: null,
      downloadProgressPercent: null,
      updateReadyToInstall: false
    };
    appLogger.log("info", "main:auto-update", "Checking for updates.");
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    autoUpdateStatus = {
      ...autoUpdateStatus,
      availability: "available",
      statusLabel: `Update ${info.version} is downloading in the background.`,
      latestVersion: info.version,
      downloadedVersion: null,
      downloadProgressPercent: 0,
      updateReadyToInstall: false
    };
    appLogger.log("info", "main:auto-update", `Update available: ${info.version}.`, {
      version: info.version,
      releaseDate: info.releaseDate
    });
  });

  autoUpdater.on("update-not-available", (info: UpdateInfo) => {
    autoUpdateStatus = {
      ...autoUpdateStatus,
      availability: "not-available",
      statusLabel: info.version
        ? `You're up to date. Latest version: ${info.version}.`
        : "You're up to date.",
      latestVersion: info.version,
      downloadedVersion: null,
      downloadProgressPercent: null,
      updateReadyToInstall: false
    };
    appLogger.log("info", "main:auto-update", `No update available: ${info.version}.`, {
      version: info.version,
      releaseDate: info.releaseDate
    });
  });

  autoUpdater.on("download-progress", (info: ProgressInfo) => {
    autoUpdateStatus = {
      ...autoUpdateStatus,
      availability: "available",
      statusLabel: `Downloading update${autoUpdateStatus.latestVersion ? ` ${autoUpdateStatus.latestVersion}` : ""} (${Math.round(info.percent)}%).`,
      downloadProgressPercent: Math.round(info.percent)
    };
    appLogger.log("debug", "main:auto-update", "Update download progress.", {
      percent: Math.round(info.percent),
      transferred: info.transferred,
      total: info.total,
      bytesPerSecond: info.bytesPerSecond
    });
  });

  autoUpdater.on("update-downloaded", (event: UpdateDownloadedEvent) => {
    autoUpdateStatus = {
      ...autoUpdateStatus,
      availability: "downloaded",
      statusLabel: `Update ${event.version} is ready to install.`,
      latestVersion: event.version,
      downloadedVersion: event.version,
      downloadProgressPercent: 100,
      updateReadyToInstall: true
    };
    void promptToInstallDownloadedUpdate(event);
  });

  autoUpdater.on("error", (error: Error, message?: string) => {
    autoUpdateStatus = {
      ...autoUpdateStatus,
      availability: "error",
      statusLabel: message ?? error.message ?? "Update check failed.",
      downloadProgressPercent: null,
      updateReadyToInstall: false
    };
    appLogger.log("error", "main:auto-update", message ?? "Auto update check failed.", error);
  });

  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((error: Error) => {
      appLogger.log("error", "main:auto-update", "Failed to start auto update check.", error);
    });
  }, AUTO_UPDATE_CHECK_DELAY_MS);
}

export async function checkForUpdatesManually(): Promise<ManualUpdateCheckResult> {
  if (!shouldEnableAutoUpdate()) {
    autoUpdateStatus = {
      ...autoUpdateStatus,
      availability: "disabled",
      statusLabel: "Auto updates are disabled for this run.",
      currentVersion: app.getVersion(),
      downloadProgressPercent: null,
      latestVersion: null,
      downloadedVersion: null,
      updateReadyToInstall: false
    };
    appLogger.log(
      "info",
      "main:auto-update",
      "Manual update check skipped because auto updates are disabled for this run."
    );
    return { status: "disabled" };
  }

  try {
    appLogger.log("info", "main:auto-update", "Manual update check requested.");
    const result = (await autoUpdater.checkForUpdates()) as UpdateCheckResult | null;
    if (!result) {
      return { status: "checking" };
    }
    if (result.isUpdateAvailable) {
      return {
        status: "available",
        version: result.updateInfo.version
      };
    }
    return {
      status: "not-available",
      version: result.updateInfo.version
    };
  } catch (error) {
    appLogger.log("error", "main:auto-update", "Manual update check failed.", error);
    throw error;
  }
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
