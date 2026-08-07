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
  AppBackupExportInput,
  AppBackupExportResult,
  AppBackupImportInput,
  AppBackupImportResult,
  AppBackupPreviewInput,
  AppBackupPreviewResult
} from "../shared/app-backup";
import type { PersistedAppPreferences } from "../shared/app-preference-persistence";
import type { PersistedDisconnectReportItem } from "../shared/disconnect-report-persistence";
import type {
  PersistedCommandSnippetGroup,
  PersistedCommandSnippetScopedValueRecord
} from "../shared/command-snippet-persistence";
import type { PersistedPortForwardEventHistoryItem } from "../shared/port-forward-event-persistence";
import type {
  PersistedSessionQuickProfile,
  PersistedSessionTemplateRecord
} from "../shared/session-workbench-persistence";
import type {
  PersistedTransferHistoryItem,
  PersistedTransferPendingRestoreItem
} from "../shared/transfer-persistence";
import type {
  PrivilegedUploadSaveResult,
  RemotePathWriteAccess,
  SftpDirectoryListResult,
  SftpEntryKind,
  SftpTransferRunOptions,
  SftpTransferEvent,
  StagePrivilegedUploadResult
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
  RemoteOpenFileAutoSyncOptions,
  RemoteOpenFilePrepareOptions,
  RemoteOpenFilePrepareResult
} from "../shared/system";
import type {
  FleetHealthOverviewItem,
  HealthIncident,
  HealthIncidentEvent,
  HealthIncidentEvidence,
  HealthObservation,
  HealthIncidentStatus,
  HealthTrendPoint,
  HealthTrendRange,
  OperationsEvent,
  PinnedMonitor,
  Runbook,
  RunbookRun,
  RunbookStartInput,
  SyncPlan,
  SyncProfile,
  SyncRun,
  TrustedHostKey,
  WorkspacePackageExportInput,
  WorkspacePackageExportResult,
  WorkspacePackageImportInput,
  WorkspacePackageImportResult,
  WorkspacePackagePreviewInput,
  WorkspacePackagePreviewResult
} from "../shared/operations";

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
    minimizeWindow: () => Promise<void>;
    toggleMaximizeWindow: () => Promise<boolean>;
    closeWindow: () => Promise<void>;
    startWindowDrag: (payload: { screenX: number; screenY: number }) => void;
    stopWindowDrag: () => void;
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
      localPath: string,
      options?: RemoteOpenFileAutoSyncOptions
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
    respondHostKeyPrompt: (tabId: string, promptId: string, decision: "trust" | "replace" | "reject") => Promise<void>;
    respondKeyboardInteractivePrompt: (tabId: string, promptId: string, responses: string[]) => Promise<void>;
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
    cancelDeletePath: (tabId: string, targetPath: string) => Promise<boolean>;
    getRemotePathWriteAccess: (tabId: string, remotePath: string) => Promise<RemotePathWriteAccess>;
    resolveRemoteStagingRoot: (tabId: string) => Promise<string>;
    stagePrivilegedUpload: (
      tabId: string,
      localPath: string,
      intendedRemotePath: string,
      relativeStagingPath?: string
    ) => Promise<StagePrivilegedUploadResult>;
    tryPrivilegedUploadSave: (
      tabId: string,
      localPath: string,
      intendedRemotePath: string,
      relativeStagingPath?: string
    ) => Promise<PrivilegedUploadSaveResult>;
    cleanupPrivilegedStagingFile: (tabId: string, stagedRemotePath: string) => Promise<void>;
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
  operations: {
    listTrustedHostKeys: () => Promise<TrustedHostKey[]>;
    trustHostKey: (input: Omit<TrustedHostKey, "endpoint" | "firstTrustedAt" | "lastTrustedAt">) => Promise<TrustedHostKey>;
    removeTrustedHostKey: (endpoint: string) => Promise<void>;
    listRunbooks: () => Promise<Runbook[]>;
    saveRunbook: (input: Partial<Runbook>) => Promise<Runbook>;
    removeRunbook: (id: string) => Promise<void>;
    listRunbookRuns: (limit?: number) => Promise<RunbookRun[]>;
    clearRunbookRuns: () => Promise<void>;
    startRunbook: (input: RunbookStartInput) => Promise<RunbookRun>;
    cancelRunbook: (runId: string) => Promise<boolean>;
    onEvent: (listener: (event: OperationsEvent) => void) => () => void;
    listSyncProfiles: () => Promise<SyncProfile[]>;
    saveSyncProfile: (input: Partial<SyncProfile>) => Promise<SyncProfile>;
    removeSyncProfile: (id: string) => Promise<void>;
    listSyncRuns: (limit?: number) => Promise<SyncRun[]>;
    clearSyncRuns: () => Promise<void>;
    planSync: (profileId: string) => Promise<SyncPlan>;
    startSync: (profileId: string, planId: string) => Promise<SyncRun>;
    cancelSync: (runId: string) => Promise<boolean>;
    listPinnedMonitors: () => Promise<PinnedMonitor[]>;
    savePinnedMonitor: (input: PinnedMonitor) => Promise<PinnedMonitor>;
    removePinnedMonitor: (sessionId: string) => Promise<void>;
    listHealthObservations: (sessionId: string, limit?: number) => Promise<HealthObservation[]>;
    listFleetHealthOverview: () => Promise<FleetHealthOverviewItem[]>;
    listHealthTrend: (sessionId: string, range: HealthTrendRange) => Promise<HealthTrendPoint[]>;
    listHealthIncidents: (status?: HealthIncidentStatus, limit?: number) => Promise<HealthIncident[]>;
    listHealthIncidentEvents: (incidentId: string) => Promise<HealthIncidentEvent[]>;
    acknowledgeHealthIncident: (incidentId: string) => Promise<HealthIncident | null>;
    exportHealthIncidentEvidence: (incidentId: string) => Promise<HealthIncidentEvidence>;
    collectPinnedHealth: (sessionId: string) => Promise<HealthObservation>;
    exportWorkspace: (input: WorkspacePackageExportInput) => Promise<WorkspacePackageExportResult>;
    previewWorkspace: (input: WorkspacePackagePreviewInput) => Promise<WorkspacePackagePreviewResult>;
    importWorkspace: (input: WorkspacePackageImportInput) => Promise<WorkspacePackageImportResult>;
  };
  storage: {
    getTransferHistory: () => Promise<PersistedTransferHistoryItem[]>;
    replaceTransferHistory: (items: PersistedTransferHistoryItem[]) => Promise<void>;
    getPendingTransferRestore: () => Promise<PersistedTransferPendingRestoreItem[]>;
    replacePendingTransferRestore: (items: PersistedTransferPendingRestoreItem[]) => Promise<void>;
    getDisconnectReports: () => Promise<PersistedDisconnectReportItem[]>;
    replaceDisconnectReports: (items: PersistedDisconnectReportItem[]) => Promise<void>;
    getPortForwardEventHistory: () => Promise<PersistedPortForwardEventHistoryItem[]>;
    replacePortForwardEventHistory: (items: PersistedPortForwardEventHistoryItem[]) => Promise<void>;
    getSessionQuickProfiles: () => Promise<PersistedSessionQuickProfile[]>;
    replaceSessionQuickProfiles: (items: PersistedSessionQuickProfile[]) => Promise<void>;
    getSessionTemplates: () => Promise<PersistedSessionTemplateRecord[]>;
    replaceSessionTemplates: (items: PersistedSessionTemplateRecord[]) => Promise<void>;
    getCommandSnippetGroups: () => Promise<PersistedCommandSnippetGroup[]>;
    replaceCommandSnippetGroups: (items: PersistedCommandSnippetGroup[]) => Promise<void>;
    getCommandSnippetScopedValues: () => Promise<
      Record<string, PersistedCommandSnippetScopedValueRecord>
    >;
    replaceCommandSnippetScopedValues: (
      values: Record<string, PersistedCommandSnippetScopedValueRecord>
    ) => Promise<void>;
    getAppPreferences: () => Promise<PersistedAppPreferences>;
    setAppPreference: (key: string, value: unknown) => Promise<void>;
    replaceAppPreferences: (entries: PersistedAppPreferences) => Promise<void>;
    exportAppBackup: (input: AppBackupExportInput) => Promise<AppBackupExportResult>;
    previewAppBackup: (input: AppBackupPreviewInput) => Promise<AppBackupPreviewResult>;
    importAppBackup: (input: AppBackupImportInput) => Promise<AppBackupImportResult>;
  };
}

declare global {
  interface Window {
    termdock: TermDockApi;
  }
}

export {};
