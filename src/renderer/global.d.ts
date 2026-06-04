import type {
  SessionCreateInput,
  SessionRecord,
  SshConfigParseResult,
  SessionTestConnectionResult,
  SessionUpdateInput
} from "../shared/session";
import type {
  SessionMigrationExportResult,
  SessionMigrationImportInput,
  SessionMigrationImportResult
} from "../shared/session-migration";
import type {
  SftpDirectoryListResult,
  SftpEntryKind,
  SftpTransferRunOptions,
  SftpTransferEvent
} from "../shared/sftp";
import type {
  CreatePortForwardInput,
  PortForwardEventRecord,
  PortForwardRecord,
  ServerHealthSnapshot,
  ServerProcessSnapshot,
  TerminalEvent
} from "../shared/terminal";
import type {
  RemoteOpenFileAutoSyncEvent,
  RemoteOpenFilePrepareOptions,
  RemoteOpenFilePrepareResult
} from "../shared/system";

interface TermDockApi {
  app: {
    onOpenSettings: (listener: () => void) => () => void;
  };
  sessions: {
    list: () => Promise<SessionRecord[]>;
    create: (input: SessionCreateInput) => Promise<SessionRecord>;
    testConnection: (input: SessionCreateInput) => Promise<SessionTestConnectionResult>;
    update: (id: string, patch: SessionUpdateInput) => Promise<SessionRecord>;
    remove: (id: string) => Promise<void>;
    parseSshConfig: (filePath?: string) => Promise<SshConfigParseResult>;
    exportEncryptedMigration: (input: {
      passphrase: string;
      appVersion: string;
      includePrivateKeyFiles: boolean;
    }) => Promise<SessionMigrationExportResult>;
    importEncryptedMigration: (input: SessionMigrationImportInput) => Promise<SessionMigrationImportResult>;
  };
  system: {
    pickPrivateKey: () => Promise<string | null>;
    pickSshConfigFile: () => Promise<string | null>;
    pickUploadFile: () => Promise<string | null>;
    pickDownloadTarget: (defaultName: string) => Promise<string | null>;
    pickDownloadDirectory: (defaultName?: string) => Promise<string | null>;
    pickOpenProgram: () => Promise<string | null>;
    readClipboardText: () => Promise<string>;
    writeClipboardText: (value: string) => Promise<void>;
    writeLog: (
      level: "debug" | "info" | "warn" | "error",
      source: string,
      message: string,
      details?: unknown
    ) => Promise<void>;
    getLogInfo: () => Promise<{
      logDirectoryPath: string;
      logFilePath: string;
    }>;
    getAutoUpdateStatus: () => Promise<{
      availability: "disabled" | "idle" | "checking" | "available" | "not-available" | "downloaded" | "error";
      statusLabel: string;
      currentVersion: string;
      lastCheckedAtIso: string | null;
      latestVersion: string | null;
      downloadedVersion: string | null;
      downloadProgressPercent: number | null;
      updateReadyToInstall: boolean;
    }>;
    checkForUpdates: () => Promise<{
      status: "disabled" | "checking" | "available" | "not-available";
      version?: string;
    }>;
    exportBugReport: (payload?: {
      settingsSnapshot?: unknown;
      runtimeSnapshot?: unknown;
      disconnectReports?: unknown;
    }) => Promise<{
      canceled: boolean;
      outputPath: string | null;
      generatedAtIso?: string;
      logFileCount?: number;
    }>;
    saveTextFile: (payload: {
      title?: string;
      defaultFileName?: string;
      text: string;
      filters?: Array<{
        name: string;
        extensions: string[];
      }>;
    }) => Promise<{
      canceled: boolean;
      outputPath: string | null;
    }>;
    pickAndReadTextFile: (payload?: {
      title?: string;
      buttonLabel?: string;
      filters?: Array<{
        name: string;
        extensions: string[];
      }>;
    }) => Promise<{
      canceled: boolean;
      filePath: string | null;
      text: string;
    }>;
    readTextFileAtPath: (filePath: string) => Promise<string>;
    writeTextFileAtPath: (filePath: string, text: string) => Promise<void>;
    createTempOpenFilePath: (defaultName: string) => Promise<string>;
    prepareRemoteOpenFile: (
      tabId: string,
      remotePath: string,
      defaultName: string,
      options?: RemoteOpenFilePrepareOptions
    ) => Promise<RemoteOpenFilePrepareResult>;
    enableRemoteFileAutoSync: (
      tabId: string,
      remotePath: string,
      localPath: string
    ) => Promise<void>;
    onRemoteOpenFileEvent: (
      listener: (event: RemoteOpenFileAutoSyncEvent) => void
    ) => () => void;
    disposeRemoteOpenFiles: (tabId?: string | null) => Promise<void>;
    openLocalPath: (localPath: string, preferredProgramPath?: string | null) => Promise<void>;
    expandUploadPaths: (
      inputPaths: string[]
    ) => Promise<
      Array<{
        localPath: string;
        relativeDirectory: string;
      }>
    >;
    scanLocalPathEntries: (
      inputPath: string
    ) => Promise<{
      kind: "file" | "directory" | "other" | "missing";
      path: string;
      files: string[];
      directories: string[];
    }>;
    getPathForDroppedFile: (file: File) => Promise<string | null>;
  };
  terminal: {
    connect: (tabId: string, sessionId: string) => Promise<void>;
    write: (tabId: string, data: string) => Promise<void>;
    resize: (tabId: string, cols: number, rows: number) => Promise<void>;
    getServerHealth: (tabId: string) => Promise<ServerHealthSnapshot>;
    getServerProcesses: (tabId: string) => Promise<ServerProcessSnapshot>;
    listPortForwards: (tabId: string) => Promise<PortForwardRecord[]>;
    listPortForwardEvents: (tabId: string, limit?: number) => Promise<PortForwardEventRecord[]>;
    createPortForward: (tabId: string, input: CreatePortForwardInput) => Promise<PortForwardRecord>;
    removePortForward: (tabId: string, forwardId: string) => Promise<void>;
    close: (tabId: string) => Promise<void>;
    onEvent: (listener: (event: TerminalEvent) => void) => () => void;
  };
  sftp: {
    listDirectory: (tabId: string, path?: string) => Promise<SftpDirectoryListResult>;
    createDirectory: (tabId: string, parentPath: string, name: string) => Promise<void>;
    renamePath: (tabId: string, sourcePath: string, nextName: string) => Promise<void>;
    deletePath: (tabId: string, targetPath: string, kind: SftpEntryKind) => Promise<void>;
    uploadFile: (
      tabId: string,
      transferId: string,
      localPath: string,
      remoteDirectory: string,
      options?: SftpTransferRunOptions
    ) => Promise<void>;
    uploadFileToPath: (
      tabId: string,
      transferId: string,
      localPath: string,
      remotePath: string,
      options?: SftpTransferRunOptions
    ) => Promise<void>;
    cancelUpload: (tabId: string, transferId: string) => Promise<boolean>;
    cancelDownload: (tabId: string, transferId: string) => Promise<boolean>;
    downloadFile: (
      tabId: string,
      transferId: string,
      remotePath: string,
      localPath: string,
      options?: SftpTransferRunOptions
    ) => Promise<void>;
    onTransferEvent: (listener: (event: SftpTransferEvent) => void) => () => void;
  };
}

declare global {
  interface Window {
    termdock: TermDockApi;
  }
}

export {};
