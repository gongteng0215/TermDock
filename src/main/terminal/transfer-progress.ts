export const TRANSFER_PROGRESS_REPORT_INTERVAL_MS = 125;
export const TRANSFER_PROGRESS_REPORT_BYTES = 256 * 1024;

export interface TransferProgressThrottleState {
  lastReportedBytes: number;
  lastReportedAt: number;
}

export function shouldReportTransferProgress(
  state: TransferProgressThrottleState,
  nextTransferredBytes: number,
  totalBytes: number,
  now: number,
  force = false
): boolean {
  if (force) {
    return true;
  }
  if (state.lastReportedBytes < 0) {
    return true;
  }
  if (nextTransferredBytes >= totalBytes) {
    return true;
  }
  const bytesDelta = nextTransferredBytes - state.lastReportedBytes;
  const timeDelta = now - state.lastReportedAt;
  return (
    bytesDelta >= TRANSFER_PROGRESS_REPORT_BYTES ||
    timeDelta >= TRANSFER_PROGRESS_REPORT_INTERVAL_MS
  );
}
