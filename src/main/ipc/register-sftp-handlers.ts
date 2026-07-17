import { ipcMain } from "electron";

import type { SftpEntryKind, SftpTransferRunOptions } from "../../shared/sftp.js";
import { TerminalService } from "../terminal/terminal-service.js";

export function registerSftpHandlers(terminalService: TerminalService): void {
  ipcMain.handle(
    "sftp:listDirectory",
    async (_event, tabId: string, path?: string) =>
      terminalService.listDirectory(tabId, path)
  );
  ipcMain.handle(
    "sftp:createDirectory",
    async (_event, tabId: string, parentPath: string, name: string) =>
      terminalService.createDirectory(tabId, parentPath, name)
  );
  ipcMain.handle(
    "sftp:renamePath",
    async (_event, tabId: string, sourcePath: string, nextName: string) =>
      terminalService.renamePath(tabId, sourcePath, nextName)
  );
  ipcMain.handle(
    "sftp:deletePath",
    async (_event, tabId: string, targetPath: string, kind: SftpEntryKind) =>
      terminalService.deletePath(tabId, targetPath, kind)
  );
  ipcMain.handle(
    "sftp:cancelDeletePath",
    async (_event, tabId: string, targetPath: string) =>
      terminalService.cancelDeletePath(tabId, targetPath)
  );
  ipcMain.handle(
    "sftp:getRemotePathWriteAccess",
    async (_event, tabId: string, remotePath: string) =>
      terminalService.getRemotePathWriteAccess(tabId, remotePath)
  );
  ipcMain.handle(
    "sftp:resolveRemoteStagingRoot",
    async (_event, tabId: string) => terminalService.resolveRemoteStagingRoot(tabId)
  );
  ipcMain.handle(
    "sftp:stagePrivilegedUpload",
    async (
      _event,
      tabId: string,
      localPath: string,
      intendedRemotePath: string,
      relativeStagingPath?: string
    ) =>
      terminalService.stagePrivilegedUpload(
        tabId,
        localPath,
        intendedRemotePath,
        relativeStagingPath
      )
  );
  ipcMain.handle(
    "sftp:tryPrivilegedUploadSave",
    async (
      _event,
      tabId: string,
      localPath: string,
      intendedRemotePath: string,
      relativeStagingPath?: string
    ) =>
      terminalService.tryPrivilegedUploadSave(
        tabId,
        localPath,
        intendedRemotePath,
        relativeStagingPath
      )
  );
  ipcMain.handle(
    "sftp:cleanupPrivilegedStagingFile",
    async (_event, tabId: string, stagedRemotePath: string) =>
      terminalService.cleanupPrivilegedStagingFile(tabId, stagedRemotePath)
  );
  ipcMain.handle(
    "sftp:uploadFile",
    async (
      _event,
      tabId: string,
      transferId: string,
      localPath: string,
      remoteDirectory: string,
      options?: SftpTransferRunOptions
    ) =>
      terminalService.uploadFile(tabId, transferId, localPath, remoteDirectory, options)
  );
  ipcMain.handle(
    "sftp:uploadFileToPath",
    async (
      _event,
      tabId: string,
      transferId: string,
      localPath: string,
      remotePath: string,
      options?: SftpTransferRunOptions
    ) =>
      terminalService.uploadFileToPath(tabId, transferId, localPath, remotePath, options)
  );
  ipcMain.handle(
    "sftp:cancelUpload",
    async (_event, tabId: string, transferId: string) =>
      terminalService.cancelUpload(tabId, transferId)
  );
  ipcMain.handle(
    "sftp:cancelDownload",
    async (_event, tabId: string, transferId: string) =>
      terminalService.cancelDownload(tabId, transferId)
  );
  ipcMain.handle(
    "sftp:downloadFile",
    async (
      _event,
      tabId: string,
      transferId: string,
      remotePath: string,
      localPath: string,
      options?: SftpTransferRunOptions
    ) =>
      terminalService.downloadFile(tabId, transferId, remotePath, localPath, options)
  );
}
