import {
  buildPrivilegedInstallCommand,
  buildPrivilegedStagingRelativePath,
  isPrivilegedSystemRemotePath,
  type StagePrivilegedUploadResult
} from "../shared/sftp";
import type { RemoteOpenFileAutoSyncEvent } from "../shared/system";

export function isPermissionDeniedMessage(message?: string | null): boolean {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("permission denied") || normalized.includes("access denied");
}

export function buildSuggestedInstallCommand(
  intendedRemotePath: string,
  stagedRemotePath?: string | null
): string {
  const staged =
    stagedRemotePath?.trim() ||
    `~/termdock-staging/${buildPrivilegedStagingRelativePath(intendedRemotePath)}`;
  return buildPrivilegedInstallCommand(staged, intendedRemotePath);
}

export function getRemoteOpenFileRecoveryCommand(
  event: RemoteOpenFileAutoSyncEvent | null | undefined
): string | null {
  if (!event) {
    return null;
  }
  const fromEvent = event.recovery?.suggestedTerminalCommand?.trim();
  if (fromEvent) {
    return fromEvent;
  }
  if (event.failureReason === "permission-denied" || isPermissionDeniedMessage(event.message)) {
    return buildSuggestedInstallCommand(event.remotePath, event.recovery?.stagedRemotePath);
  }
  return null;
}

export function shouldOfferPrivilegedRecovery(input: {
  message?: string | null;
  remotePath?: string | null;
  failureReason?: string | null;
}): boolean {
  if (input.failureReason === "permission-denied") {
    return true;
  }
  if (isPermissionDeniedMessage(input.message)) {
    return true;
  }
  return Boolean(input.remotePath && isPrivilegedSystemRemotePath(input.remotePath));
}

export function formatStagedRecoveryHint(result: StagePrivilegedUploadResult): string {
  return `Staged to ${result.stagedRemotePath}. Run in terminal: ${result.suggestedTerminalCommand}`;
}
