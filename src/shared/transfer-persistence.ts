/** Shared shapes for Phase 4 transfer history / pending-restore persistence. */

export type PersistedTransferDirection = "upload" | "download";

export type PersistedTransferStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "canceled";

export interface PersistedTransferHistoryItem {
  key: string;
  sessionId: string;
  direction: PersistedTransferDirection;
  status: PersistedTransferStatus;
  name: string;
  localPath: string;
  remotePath: string;
  updatedAt: number;
  attemptCount: number;
  message?: string;
}

export interface PersistedTransferPendingRestoreItem {
  key: string;
  sessionId: string;
  direction: PersistedTransferDirection;
  localPath: string;
  remotePath: string;
  name: string;
}
