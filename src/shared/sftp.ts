export type SftpEntryKind = "directory" | "file" | "symlink" | "other";
export type SftpTransferDirection = "upload" | "download";
export type SftpTransferStatus = "queued" | "running" | "completed" | "failed";

export interface SftpEntry {
  name: string;
  path: string;
  kind: SftpEntryKind;
  permissions: string;
  links: number;
  owner: string;
  group: string;
  size: number;
  modifiedAt?: string;
}

export interface SftpDirectoryListResult {
  tabId: string;
  cwd: string;
  parent: string | null;
  entries: SftpEntry[];
}

export interface SftpTransferEvent {
  tabId: string;
  transferId: string;
  direction: SftpTransferDirection;
  status: SftpTransferStatus;
  name: string;
  localPath: string;
  remotePath: string;
  transferredBytes: number;
  totalBytes: number;
  message?: string;
}
