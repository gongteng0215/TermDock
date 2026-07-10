/**
 * POSIX write-bit helpers shared by main-process SFTP probes.
 * Keep pure so unit-style checks stay free of Electron/ssh2.
 */

export interface RemoteIdentity {
  uid: number;
  gids: number[];
}

export interface RemoteStatBits {
  mode: number;
  uid: number;
  gid: number;
}

export function canWriteWithIdentity(stats: RemoteStatBits, identity: RemoteIdentity): boolean {
  if (identity.uid === 0) {
    return true;
  }
  const mode = stats.mode & 0o777;
  if (stats.uid === identity.uid) {
    return (mode & 0o200) !== 0;
  }
  if (identity.gids.includes(stats.gid)) {
    return (mode & 0o020) !== 0;
  }
  return (mode & 0o002) !== 0;
}

export function formatModeOctal(mode: number | null | undefined): string | null {
  if (typeof mode !== "number" || !Number.isFinite(mode)) {
    return null;
  }
  return (mode & 0o7777).toString(8).padStart(3, "0");
}

export function isDirectoryMode(mode: number): boolean {
  return (mode & 0o170000) === 0o040000;
}

/**
 * For an existing file: SFTP overwrite typically needs write on the file itself.
 * For a missing path: creating the file needs write+execute on the parent directory.
 * For a directory target (upload cwd): need write+execute on the directory.
 */
export function computeEffectiveWritable(input: {
  exists: boolean;
  isDirectory: boolean;
  pathWritable: boolean | null;
  parentWritable: boolean | null;
}): boolean {
  if (!input.exists) {
    return input.parentWritable === true;
  }
  if (input.isDirectory) {
    return input.pathWritable === true;
  }
  return input.pathWritable === true;
}
