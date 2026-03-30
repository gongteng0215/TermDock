export type RemoteOpenFileAutoSyncEventType =
  | "conflict-remote-changed"
  | "upload-failed";

export type RemoteOpenFilePrepareReuseState =
  | "new"
  | "reuse-clean"
  | "reuse-local-draft";

export type RemoteOpenFileLocalDraftState = "modified" | "syncing";

export interface RemoteOpenFilePrepareOptions {
  discardLocalChanges?: boolean;
}

export interface RemoteOpenFilePrepareResult {
  localPath: string;
  alreadyOpen: boolean;
  reuseState: RemoteOpenFilePrepareReuseState;
  localDraftState?: RemoteOpenFileLocalDraftState;
}

export interface RemoteOpenFileAutoSyncEvent {
  type: RemoteOpenFileAutoSyncEventType;
  tabId: string;
  remotePath: string;
  localPath: string;
  message: string;
}
