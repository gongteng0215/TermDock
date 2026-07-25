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
  SessionMigrationExportResult,
  SessionMigrationImportInput,
  SessionMigrationImportResult
} from "../shared/session-migration.js";
import type {
  PrivilegedUploadSaveResult,
  RemotePathWriteAccess,
  SftpDirectoryListResult,
  SftpEntryKind,
  SftpTransferRunOptions,
  SftpTransferEvent,
  StagePrivilegedUploadResult
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
  RemoteOpenFileAutoSyncOptions,
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
      ipcRenderer.invoke("sessions:parseSshConfig", filePath) as Promise<SshConfigParseResult>,
    exportEncryptedMigration: (input: {
      passphrase: string;
      appVersion: string;
      includePrivateKeyFiles: boolean;
    }) =>
      ipcRenderer.invoke("sessions:exportEncryptedMigration", input) as Promise<SessionMigrationExportResult>,
    importEncryptedMigration: (input: SessionMigrationImportInput) =>
      ipcRenderer.invoke("sessions:importEncryptedMigration", input) as Promise<SessionMigrationImportResult>
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
    minimizeWindow: () => ipcRenderer.invoke("system:minimizeWindow") as Promise<void>,
    toggleMaximizeWindow: () =>
      ipcRenderer.invoke("system:toggleMaximizeWindow") as Promise<boolean>,
    closeWindow: () => ipcRenderer.invoke("system:closeWindow") as Promise<void>,
    startWindowDrag: (payload: { screenX: number; screenY: number }) => {
      ipcRenderer.send("system:windowDragStart", payload);
    },
    stopWindowDrag: () => {
      ipcRenderer.send("system:windowDragStop");
    },
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
    getAutoUpdateStatus: () =>
      ipcRenderer.invoke("system:getAutoUpdateStatus") as Promise<{
        availability: "disabled" | "idle" | "checking" | "available" | "not-available" | "downloaded" | "error";
        statusLabel: string;
        currentVersion: string;
        lastCheckedAtIso: string | null;
        latestVersion: string | null;
        downloadedVersion: string | null;
        downloadProgressPercent: number | null;
        updateReadyToInstall: boolean;
      }>,
    checkForUpdates: () =>
      ipcRenderer.invoke("system:checkForUpdates") as Promise<{
        status: "disabled" | "checking" | "available" | "not-available";
        version?: string;
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
    enableRemoteFileAutoSync: (
      tabId: string,
      remotePath: string,
      localPath: string,
      options?: RemoteOpenFileAutoSyncOptions
    ) =>
      ipcRenderer.invoke(
        "system:enableRemoteFileAutoSync",
        tabId,
        remotePath,
        localPath,
        options
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
    cancelDeletePath: (tabId: string, targetPath: string) =>
      ipcRenderer.invoke("sftp:cancelDeletePath", tabId, targetPath) as Promise<boolean>,
    getRemotePathWriteAccess: (tabId: string, remotePath: string) =>
      ipcRenderer.invoke("sftp:getRemotePathWriteAccess", tabId, remotePath) as Promise<RemotePathWriteAccess>,
    resolveRemoteStagingRoot: (tabId: string) =>
      ipcRenderer.invoke("sftp:resolveRemoteStagingRoot", tabId) as Promise<string>,
    stagePrivilegedUpload: (
      tabId: string,
      localPath: string,
      intendedRemotePath: string,
      relativeStagingPath?: string
    ) =>
      ipcRenderer.invoke(
        "sftp:stagePrivilegedUpload",
        tabId,
        localPath,
        intendedRemotePath,
        relativeStagingPath
      ) as Promise<StagePrivilegedUploadResult>,
    tryPrivilegedUploadSave: (
      tabId: string,
      localPath: string,
      intendedRemotePath: string,
      relativeStagingPath?: string
    ) =>
      ipcRenderer.invoke(
        "sftp:tryPrivilegedUploadSave",
        tabId,
        localPath,
        intendedRemotePath,
        relativeStagingPath
      ) as Promise<PrivilegedUploadSaveResult>,
    cleanupPrivilegedStagingFile: (tabId: string, stagedRemotePath: string) =>
      ipcRenderer.invoke(
        "sftp:cleanupPrivilegedStagingFile",
        tabId,
        stagedRemotePath
      ) as Promise<void>,
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
  },
  storage: {
    getTransferHistory: () =>
      ipcRenderer.invoke("storage:getTransferHistory") as Promise<
        import("../shared/transfer-persistence.js").PersistedTransferHistoryItem[]
      >,
    replaceTransferHistory: (
      items: import("../shared/transfer-persistence.js").PersistedTransferHistoryItem[]
    ) => ipcRenderer.invoke("storage:replaceTransferHistory", items) as Promise<void>,
    getPendingTransferRestore: () =>
      ipcRenderer.invoke("storage:getPendingTransferRestore") as Promise<
        import("../shared/transfer-persistence.js").PersistedTransferPendingRestoreItem[]
      >,
    replacePendingTransferRestore: (
      items: import("../shared/transfer-persistence.js").PersistedTransferPendingRestoreItem[]
    ) =>
      ipcRenderer.invoke("storage:replacePendingTransferRestore", items) as Promise<void>,
    getDisconnectReports: () =>
      ipcRenderer.invoke("storage:getDisconnectReports") as Promise<
        import("../shared/disconnect-report-persistence.js").PersistedDisconnectReportItem[]
      >,
    replaceDisconnectReports: (
      items: import("../shared/disconnect-report-persistence.js").PersistedDisconnectReportItem[]
    ) => ipcRenderer.invoke("storage:replaceDisconnectReports", items) as Promise<void>,
    getPortForwardEventHistory: () =>
      ipcRenderer.invoke("storage:getPortForwardEventHistory") as Promise<
        import("../shared/port-forward-event-persistence.js").PersistedPortForwardEventHistoryItem[]
      >,
    replacePortForwardEventHistory: (
      items: import("../shared/port-forward-event-persistence.js").PersistedPortForwardEventHistoryItem[]
    ) => ipcRenderer.invoke("storage:replacePortForwardEventHistory", items) as Promise<void>,
    getSessionQuickProfiles: () =>
      ipcRenderer.invoke("storage:getSessionQuickProfiles") as Promise<
        import("../shared/session-workbench-persistence.js").PersistedSessionQuickProfile[]
      >,
    replaceSessionQuickProfiles: (
      items: import("../shared/session-workbench-persistence.js").PersistedSessionQuickProfile[]
    ) => ipcRenderer.invoke("storage:replaceSessionQuickProfiles", items) as Promise<void>,
    getSessionTemplates: () =>
      ipcRenderer.invoke("storage:getSessionTemplates") as Promise<
        import("../shared/session-workbench-persistence.js").PersistedSessionTemplateRecord[]
      >,
    replaceSessionTemplates: (
      items: import("../shared/session-workbench-persistence.js").PersistedSessionTemplateRecord[]
    ) => ipcRenderer.invoke("storage:replaceSessionTemplates", items) as Promise<void>,
    getCommandSnippetGroups: () =>
      ipcRenderer.invoke("storage:getCommandSnippetGroups") as Promise<
        import("../shared/command-snippet-persistence.js").PersistedCommandSnippetGroup[]
      >,
    replaceCommandSnippetGroups: (
      items: import("../shared/command-snippet-persistence.js").PersistedCommandSnippetGroup[]
    ) => ipcRenderer.invoke("storage:replaceCommandSnippetGroups", items) as Promise<void>,
    getCommandSnippetScopedValues: () =>
      ipcRenderer.invoke("storage:getCommandSnippetScopedValues") as Promise<
        Record<
          string,
          import("../shared/command-snippet-persistence.js").PersistedCommandSnippetScopedValueRecord
        >
      >,
    replaceCommandSnippetScopedValues: (
      values: Record<
        string,
        import("../shared/command-snippet-persistence.js").PersistedCommandSnippetScopedValueRecord
      >
    ) =>
      ipcRenderer.invoke("storage:replaceCommandSnippetScopedValues", values) as Promise<void>,
    getAppPreferences: () =>
      ipcRenderer.invoke("storage:getAppPreferences") as Promise<
        import("../shared/app-preference-persistence.js").PersistedAppPreferences
      >,
    setAppPreference: (key: string, value: unknown) =>
      ipcRenderer.invoke("storage:setAppPreference", key, value) as Promise<void>,
    replaceAppPreferences: (
      entries: import("../shared/app-preference-persistence.js").PersistedAppPreferences
    ) => ipcRenderer.invoke("storage:replaceAppPreferences", entries) as Promise<void>,
    exportAppBackup: (
      input: import("../shared/app-backup.js").AppBackupExportInput
    ) =>
      ipcRenderer.invoke("storage:exportAppBackup", input) as Promise<
        import("../shared/app-backup.js").AppBackupExportResult
      >,
    previewAppBackup: (
      input: import("../shared/app-backup.js").AppBackupPreviewInput
    ) =>
      ipcRenderer.invoke("storage:previewAppBackup", input) as Promise<
        import("../shared/app-backup.js").AppBackupPreviewResult
      >,
    importAppBackup: (
      input: import("../shared/app-backup.js").AppBackupImportInput
    ) =>
      ipcRenderer.invoke("storage:importAppBackup", input) as Promise<
        import("../shared/app-backup.js").AppBackupImportResult
      >
  }
};

contextBridge.exposeInMainWorld("termdock", api);
