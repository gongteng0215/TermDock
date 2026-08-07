export type SftpEntryKind = "directory" | "file" | "symlink" | "other";
export type SftpTransferDirection = "upload" | "download";
export type SftpTransferStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "canceled";

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

export interface SftpTransferRunOptions {
  rateLimitBytesPerSecond?: number;
}

export interface SftpTransferEvent {
  tabId: string;
  /**
   * Background operations such as a saved sync profile do not always have an
   * open terminal tab. Keep their session identity explicit so the renderer
   * can retain history and associate the work with the right server.
   */
  sessionId?: string;
  /** Stable group identifier for a saved sync run, when applicable. */
  syncRunId?: string;
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

export interface RemotePathWriteAccess {
  path: string;
  exists: boolean;
  isDirectory: boolean;
  isPrivilegedSystemPath: boolean;
  fileWritable: boolean | null;
  parentWritable: boolean | null;
  /** True when the current SSH user can create/overwrite via SFTP at this path. */
  effectiveWritable: boolean;
  modeOctal: string | null;
  uid: number | null;
  gid: number | null;
}

export interface StagePrivilegedUploadResult {
  stagedRemotePath: string;
  intendedRemotePath: string;
  suggestedTerminalCommand: string;
  modeOctal: string;
}

export interface PrivilegedUploadSaveResult {
  success: boolean;
  stagedRemotePath: string;
  intendedRemotePath: string;
  suggestedTerminalCommand: string;
  message?: string;
}

export const REMOTE_PRIVILEGED_STAGING_DIRECTORY = "termdock-staging";

export function isPrivilegedSystemRemotePath(remotePath: string): boolean {
  const normalized = remotePath.trim().replaceAll("\\", "/");
  return /^\/(?:etc|usr|boot|bin|sbin)(?:\/|$)/i.test(normalized);
}

export function buildPrivilegedInstallCommand(
  stagedRemotePath: string,
  intendedRemotePath: string,
  modeOctal = "644"
): string {
  const safeMode = /^\d{3,4}$/.test(modeOctal) ? modeOctal : "644";
  const staged = shellSingleQuote(stagedRemotePath);
  const intended = shellSingleQuote(intendedRemotePath);
  // Remove the staging copy after a successful install so leftovers do not accumulate.
  return `sudo install -m ${safeMode} ${staged} ${intended} && rm -f -- ${staged}`;
}

export function buildPrivilegedStagingRelativePath(
  intendedRemotePath: string,
  relativePath?: string
): string {
  const trimmedRelative = relativePath?.trim().replaceAll("\\", "/").replace(/^\/+/, "") ?? "";
  if (trimmedRelative) {
    return trimmedRelative;
  }
  const baseName = intendedRemotePath.replaceAll("\\", "/").split("/").filter(Boolean).pop();
  return baseName && baseName.length > 0 ? baseName : "upload.bin";
}

function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}
