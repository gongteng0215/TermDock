export type RemoteOpenFileAutoSyncEventType =
  | "conflict-remote-changed"
  | "upload-failed";

export type RemoteOpenFilePrepareReuseState =
  | "new"
  | "reuse-clean"
  | "reuse-local-draft";

export type RemoteOpenFileLocalDraftState = "modified" | "syncing";

export type RemoteOpenFileFailureReason = "permission-denied" | "other";

export interface RemoteOpenFilePrepareOptions {
  discardLocalChanges?: boolean;
}

export interface RemoteOpenFileAutoSyncOptions {
  autoSyncEnabled?: boolean;
  /** When true, save-back uses staging + sudo install instead of direct SFTP overwrite. */
  privilegedSaveMode?: boolean;
}

export interface RemoteOpenFilePrepareResult {
  localPath: string;
  alreadyOpen: boolean;
  reuseState: RemoteOpenFilePrepareReuseState;
  localDraftState?: RemoteOpenFileLocalDraftState;
}

export interface RemoteOpenFileRecoveryHint {
  stagedRemotePath?: string;
  suggestedTerminalCommand?: string;
}

export interface RemoteOpenFileAutoSyncEvent {
  type: RemoteOpenFileAutoSyncEventType;
  tabId: string;
  remotePath: string;
  localPath: string;
  message: string;
  failureReason?: RemoteOpenFileFailureReason;
  recovery?: RemoteOpenFileRecoveryHint;
  autoSyncEnabled?: boolean;
  privilegedSaveMode?: boolean;
}
