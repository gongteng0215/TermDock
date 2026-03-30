import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { IpcRendererEvent } from "electron";

import type {
  SessionCreateInput,
  SessionRecord,
  SshConfigParseResult,
  SessionTestConnectionResult,
  SessionUpdateInput
} from "../shared/session.js";
import type {
  SftpDirectoryListResult,
  SftpEntryKind,
  SftpTransferRunOptions,
  SftpTransferEvent
} from "../shared/sftp.js";
import type {
  CreatePortForwardInput,
  PortForwardEventRecord,
  PortForwardRecord,
  ServerHealthSnapshot,
  ServerProcessSnapshot,
  TerminalEvent
} from "../shared/terminal.js";
import type {
  RemoteOpenFileAutoSyncEvent,
  RemoteOpenFilePrepareOptions,
  RemoteOpenFilePrepareResult
} from "../shared/system.js";

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
    remove: (id: string) => ipcRenderer.invoke("sessions:delete", id) as Promise<void>,
    parseSshConfig: (filePath?: string) =>
      ipcRenderer.invoke("sessions:parseSshConfig", filePath) as Promise<SshConfigParseResult>
  },
  system: {
    pickPrivateKey: () =>
      ipcRenderer.invoke("system:pickPrivateKey") as Promise<string | null>,
    pickSshConfigFile: () =>
      ipcRenderer.invoke("system:pickSshConfigFile") as Promise<string | null>,
    pickUploadFile: () =>
      ipcRenderer.invoke("system:pickUploadFile") as Promise<string | null>,
    pickDownloadTarget: (defaultName: string) =>
      ipcRenderer.invoke("system:pickDownloadTarget", defaultName) as Promise<string | null>,
    pickDownloadDirectory: (defaultName?: string) =>
      ipcRenderer.invoke("system:pickDownloadDirectory", defaultName) as Promise<string | null>,
    pickOpenProgram: () =>
      ipcRenderer.invoke("system:pickOpenProgram") as Promise<string | null>,
    readClipboardText: () =>
      ipcRenderer.invoke("system:readClipboardText") as Promise<string>,
    writeClipboardText: (value: string) =>
      ipcRenderer.invoke("system:writeClipboardText", value) as Promise<void>,
    writeLog: (
      level: "debug" | "info" | "warn" | "error",
      source: string,
      message: string,
      details?: unknown
    ) =>
      ipcRenderer.invoke("system:writeLog", level, source, message, details) as Promise<void>,
    getLogInfo: () =>
      ipcRenderer.invoke("system:getLogInfo") as Promise<{
        logDirectoryPath: string;
        logFilePath: string;
      }>,
    exportBugReport: (payload?: {
      settingsSnapshot?: unknown;
      runtimeSnapshot?: unknown;
      disconnectReports?: unknown;
    }) =>
      ipcRenderer.invoke("system:exportBugReport", payload) as Promise<{
        canceled: boolean;
        outputPath: string | null;
        generatedAtIso?: string;
        logFileCount?: number;
      }>,
    saveTextFile: (payload: {
      title?: string;
      defaultFileName?: string;
      text: string;
      filters?: Array<{
        name: string;
        extensions: string[];
      }>;
    }) =>
      ipcRenderer.invoke("system:saveTextFile", payload) as Promise<{
        canceled: boolean;
        outputPath: string | null;
      }>,
    pickAndReadTextFile: (payload?: {
      title?: string;
      buttonLabel?: string;
      filters?: Array<{
        name: string;
        extensions: string[];
      }>;
    }) =>
      ipcRenderer.invoke("system:pickAndReadTextFile", payload) as Promise<{
        canceled: boolean;
        filePath: string | null;
        text: string;
      }>,
    readTextFileAtPath: (filePath: string) =>
      ipcRenderer.invoke("system:readTextFileAtPath", filePath) as Promise<string>,
    writeTextFileAtPath: (filePath: string, text: string) =>
      ipcRenderer.invoke("system:writeTextFileAtPath", filePath, text) as Promise<void>,
    createTempOpenFilePath: (defaultName: string) =>
      ipcRenderer.invoke("system:createTempOpenFilePath", defaultName) as Promise<string>,
    prepareRemoteOpenFile: (
      tabId: string,
      remotePath: string,
      defaultName: string,
      options?: RemoteOpenFilePrepareOptions
    ) =>
      ipcRenderer.invoke(
        "system:prepareRemoteOpenFile",
        tabId,
        remotePath,
        defaultName,
        options
      ) as Promise<RemoteOpenFilePrepareResult>,
    enableRemoteFileAutoSync: (tabId: string, remotePath: string, localPath: string) =>
      ipcRenderer.invoke(
        "system:enableRemoteFileAutoSync",
        tabId,
        remotePath,
        localPath
      ) as Promise<void>,
    onRemoteOpenFileEvent: (listener: (event: RemoteOpenFileAutoSyncEvent) => void) => {
      const wrapped = (
        _event: IpcRendererEvent,
        payload: RemoteOpenFileAutoSyncEvent
      ) => {
        listener(payload);
      };
      ipcRenderer.on("system:remoteOpenFileEvent", wrapped);
      return () => {
        ipcRenderer.removeListener("system:remoteOpenFileEvent", wrapped);
      };
    },
    disposeRemoteOpenFiles: (tabId?: string | null) =>
      ipcRenderer.invoke("system:disposeRemoteOpenFiles", tabId) as Promise<void>,
    openLocalPath: (localPath: string, preferredProgramPath?: string | null) =>
      ipcRenderer.invoke("system:openLocalPath", localPath, preferredProgramPath) as Promise<void>,
    expandUploadPaths: (inputPaths: string[]) =>
      ipcRenderer.invoke("system:expandUploadPaths", inputPaths) as Promise<
        Array<{
          localPath: string;
          relativeDirectory: string;
        }>
      >,
    scanLocalPathEntries: (inputPath: string) =>
      ipcRenderer.invoke("system:scanLocalPathEntries", inputPath) as Promise<{
        kind: "file" | "directory" | "other" | "missing";
        path: string;
        files: string[];
        directories: string[];
      }>,
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
    getServerHealth: (tabId: string) =>
      ipcRenderer.invoke("terminal:getServerHealth", tabId) as Promise<ServerHealthSnapshot>,
    getServerProcesses: (tabId: string) =>
      ipcRenderer.invoke("terminal:getServerProcesses", tabId) as Promise<ServerProcessSnapshot>,
    listPortForwards: (tabId: string) =>
      ipcRenderer.invoke("terminal:listPortForwards", tabId) as Promise<PortForwardRecord[]>,
    listPortForwardEvents: (tabId: string, limit?: number) =>
      ipcRenderer.invoke("terminal:listPortForwardEvents", tabId, limit) as Promise<
        PortForwardEventRecord[]
      >,
    createPortForward: (tabId: string, input: CreatePortForwardInput) =>
      ipcRenderer.invoke("terminal:createPortForward", tabId, input) as Promise<PortForwardRecord>,
    removePortForward: (tabId: string, forwardId: string) =>
      ipcRenderer.invoke("terminal:removePortForward", tabId, forwardId) as Promise<void>,
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
      remoteDirectory: string,
      options?: SftpTransferRunOptions
    ) =>
      ipcRenderer.invoke(
        "sftp:uploadFile",
        tabId,
        transferId,
        localPath,
        remoteDirectory,
        options
      ) as Promise<void>,
    uploadFileToPath: (
      tabId: string,
      transferId: string,
      localPath: string,
      remotePath: string,
      options?: SftpTransferRunOptions
    ) =>
      ipcRenderer.invoke(
        "sftp:uploadFileToPath",
        tabId,
        transferId,
        localPath,
        remotePath,
        options
      ) as Promise<void>,
    cancelUpload: (tabId: string, transferId: string) =>
      ipcRenderer.invoke("sftp:cancelUpload", tabId, transferId) as Promise<boolean>,
    cancelDownload: (tabId: string, transferId: string) =>
      ipcRenderer.invoke("sftp:cancelDownload", tabId, transferId) as Promise<boolean>,
    downloadFile: (
      tabId: string,
      transferId: string,
      remotePath: string,
      localPath: string,
      options?: SftpTransferRunOptions
    ) =>
      ipcRenderer.invoke(
        "sftp:downloadFile",
        tabId,
        transferId,
        remotePath,
        localPath,
        options
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
