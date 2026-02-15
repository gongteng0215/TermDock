import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { IpcRendererEvent } from "electron";

import type {
  SessionCreateInput,
  SessionRecord,
  SessionTestConnectionResult,
  SessionUpdateInput
} from "../shared/session.js";
import type {
  SftpDirectoryListResult,
  SftpEntryKind,
  SftpTransferEvent
} from "../shared/sftp.js";
import type { TerminalEvent } from "../shared/terminal.js";

const api = {
  app: {
    onOpenSettings: (listener: () => void) => {
      const wrapped = () => {
        listener();
      };
      ipcRenderer.on("app:openSettings", wrapped);
      return () => {
        ipcRenderer.removeListener("app:openSettings", wrapped);
      };
    }
  },
  sessions: {
    list: () => ipcRenderer.invoke("sessions:list") as Promise<SessionRecord[]>,
    create: (input: SessionCreateInput) =>
      ipcRenderer.invoke("sessions:create", input) as Promise<SessionRecord>,
    testConnection: (input: SessionCreateInput) =>
      ipcRenderer.invoke("sessions:testConnection", input) as Promise<SessionTestConnectionResult>,
    update: (id: string, patch: SessionUpdateInput) =>
      ipcRenderer.invoke("sessions:update", id, patch) as Promise<SessionRecord>,
    remove: (id: string) => ipcRenderer.invoke("sessions:delete", id) as Promise<void>
  },
  system: {
    pickPrivateKey: () =>
      ipcRenderer.invoke("system:pickPrivateKey") as Promise<string | null>,
    pickUploadFile: () =>
      ipcRenderer.invoke("system:pickUploadFile") as Promise<string | null>,
    pickDownloadTarget: (defaultName: string) =>
      ipcRenderer.invoke("system:pickDownloadTarget", defaultName) as Promise<string | null>,
    pickOpenProgram: () =>
      ipcRenderer.invoke("system:pickOpenProgram") as Promise<string | null>,
    createTempOpenFilePath: (defaultName: string) =>
      ipcRenderer.invoke("system:createTempOpenFilePath", defaultName) as Promise<string>,
    openLocalPath: (localPath: string, preferredProgramPath?: string | null) =>
      ipcRenderer.invoke("system:openLocalPath", localPath, preferredProgramPath) as Promise<void>,
    expandUploadPaths: (inputPaths: string[]) =>
      ipcRenderer.invoke("system:expandUploadPaths", inputPaths) as Promise<
        Array<{
          localPath: string;
          relativeDirectory: string;
        }>
      >,
    getPathForDroppedFile: async (file: unknown) => {
      try {
        const pathValue = webUtils.getPathForFile(file as Parameters<typeof webUtils.getPathForFile>[0]);
        return pathValue || null;
      } catch {
        return null;
      }
    }
  },
  terminal: {
    connect: (tabId: string, sessionId: string) =>
      ipcRenderer.invoke("terminal:connect", tabId, sessionId) as Promise<void>,
    write: (tabId: string, data: string) =>
      ipcRenderer.invoke("terminal:write", tabId, data) as Promise<void>,
    resize: (tabId: string, cols: number, rows: number) =>
      ipcRenderer.invoke("terminal:resize", tabId, cols, rows) as Promise<void>,
    close: (tabId: string) =>
      ipcRenderer.invoke("terminal:close", tabId) as Promise<void>,
    onEvent: (listener: (event: TerminalEvent) => void) => {
      const wrapped = (
        _event: IpcRendererEvent,
        payload: TerminalEvent
      ) => {
        listener(payload);
      };
      ipcRenderer.on("terminal:event", wrapped);
      return () => {
        ipcRenderer.removeListener("terminal:event", wrapped);
      };
    }
  },
  sftp: {
    listDirectory: (tabId: string, path?: string) =>
      ipcRenderer.invoke("sftp:listDirectory", tabId, path) as Promise<SftpDirectoryListResult>,
    createDirectory: (tabId: string, parentPath: string, name: string) =>
      ipcRenderer.invoke("sftp:createDirectory", tabId, parentPath, name) as Promise<void>,
    renamePath: (tabId: string, sourcePath: string, nextName: string) =>
      ipcRenderer.invoke("sftp:renamePath", tabId, sourcePath, nextName) as Promise<void>,
    deletePath: (tabId: string, targetPath: string, kind: SftpEntryKind) =>
      ipcRenderer.invoke("sftp:deletePath", tabId, targetPath, kind) as Promise<void>,
    uploadFile: (
      tabId: string,
      transferId: string,
      localPath: string,
      remoteDirectory: string
    ) =>
      ipcRenderer.invoke(
        "sftp:uploadFile",
        tabId,
        transferId,
        localPath,
        remoteDirectory
      ) as Promise<void>,
    cancelUpload: (tabId: string, transferId: string) =>
      ipcRenderer.invoke("sftp:cancelUpload", tabId, transferId) as Promise<boolean>,
    cancelDownload: (tabId: string, transferId: string) =>
      ipcRenderer.invoke("sftp:cancelDownload", tabId, transferId) as Promise<boolean>,
    downloadFile: (
      tabId: string,
      transferId: string,
      remotePath: string,
      localPath: string
    ) =>
      ipcRenderer.invoke(
        "sftp:downloadFile",
        tabId,
        transferId,
        remotePath,
        localPath
      ) as Promise<void>,
    onTransferEvent: (listener: (event: SftpTransferEvent) => void) => {
      const wrapped = (
        _event: IpcRendererEvent,
        payload: SftpTransferEvent
      ) => {
        listener(payload);
      };
      ipcRenderer.on("sftp:transfer:event", wrapped);
      return () => {
        ipcRenderer.removeListener("sftp:transfer:event", wrapped);
      };
    }
  }
};

contextBridge.exposeInMainWorld("termdock", api);
