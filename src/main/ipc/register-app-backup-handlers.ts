import { ipcMain } from "electron";

import type {
  AppBackupExportInput,
  AppBackupImportInput,
  AppBackupPreviewInput
} from "../../shared/app-backup.js";
import {
  exportAppBackup,
  importAppBackup,
  previewAppBackup,
  type AppBackupStores
} from "../storage/app-backup.js";

export function registerAppBackupHandlers(stores: AppBackupStores): void {
  ipcMain.handle(
    "storage:exportAppBackup",
    async (_event, input: Omit<AppBackupExportInput, never>) =>
      exportAppBackup(stores, {
        appVersion: input.appVersion,
        includeCredentials: input.includeCredentials === true,
        passphrase: input.passphrase,
        includePrivateKeyFiles: input.includePrivateKeyFiles === true
      })
  );

  ipcMain.handle("storage:previewAppBackup", async (_event, input: AppBackupPreviewInput) =>
    previewAppBackup(input)
  );

  ipcMain.handle("storage:importAppBackup", async (_event, input: AppBackupImportInput) =>
    importAppBackup(stores, {
      fileText: input.fileText,
      sessionDuplicateStrategy: input.sessionDuplicateStrategy,
      restoreCredentials: input.restoreCredentials === true,
      passphrase: input.passphrase,
      includePrivateKeyFiles: input.includePrivateKeyFiles === true
    })
  );
}
