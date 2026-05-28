import type { TransferDockProps } from "./components/workbench-shell";
import {
  buildTransferDockPanelProps,
  buildTransferDockProps
} from "./workbench-overlay-props";

export interface TransferLike {
  transferId: string;
  name: string;
  status: string;
}

interface TransferProgressStatsLike {
  completed: number;
  total: number;
  failed: number;
  canceled: number;
  running: number;
  queued: number;
}

interface TransferQueueStatsLike {
  running: number;
  queued: number;
}

export interface BuildTransferDockCompositePropsArgs<TTransfer extends TransferLike> {
  activeTabId: string | null;
  activeTerminalTabTitle: string | null;
  cancelAllActiveDownloads: () => Promise<void>;
  cancelAllActiveUploads: () => Promise<void>;
  cancelSftpDownload: (transfer: TTransfer) => Promise<void>;
  cancelSftpUpload: (transfer: TTransfer) => Promise<void>;
  canClearFinishedDownloads: boolean;
  canClearFinishedUploads: boolean;
  canRetryAllFailedTransfers: boolean;
  canRetryFailedDownloads: boolean;
  canRetryFailedUploads: boolean;
  clearFinishedTransfers: (direction: "upload" | "download") => void;
  discardPendingTransferRestoreQueue: () => Promise<void>;
  downloadConcurrency: number;
  failedDownloadHistoryCount: number;
  failedDownloadRetryCandidateCount: number;
  failedRetryCandidateTotal: number;
  failedUploadHistoryCount: number;
  failedUploadRetryCandidateCount: number;
  formatTransferProgress: (transfer: TTransfer) => string;
  formatTransferTimestamp: (transfer: TTransfer) => string | null;
  hasOperationCenterActivity: boolean;
  isActiveDownloadQueuePaused: boolean;
  isActiveUploadQueuePaused: boolean;
  labels: TransferDockProps["labels"];
  nextSftpTransferWindowOpeningLabel: string | null;
  notice: TransferDockProps["notice"];
  onOpenOperationCenter: () => void;
  onOpenRetryCenter: () => void;
  operationCenterActiveCount: number;
  pendingRestoreCount: number;
  restorePendingTransferRestoreQueue: () => Promise<void>;
  retryAllFailedTransfersWithScopeChoice: () => Promise<void>;
  retryFailedDownloads: () => Promise<void>;
  retryFailedUploads: () => Promise<void>;
  sftpTransferScheduleSummary: string;
  uploadConcurrency: number;
  uploadPauseReason: string | null;
  downloadPauseReason: string | null;
  activeUploadProgressStats: TransferProgressStatsLike;
  activeUploadQueueStats: TransferQueueStatsLike;
  activeDownloadProgressStats: TransferProgressStatsLike;
  activeDownloadQueueStats: TransferQueueStatsLike;
  activeUploadTransfers: TTransfer[];
  activeDownloadTransfers: TTransfer[];
}

function buildTransferPauseMessage({
  labels,
  isPaused,
  pauseReason,
  scheduleSummary,
  nextWindowLabel,
  disconnectedMessage
}: {
  labels: TransferDockProps["labels"];
  isPaused: boolean;
  pauseReason: string | null;
  scheduleSummary: string;
  nextWindowLabel: string | null;
  disconnectedMessage: string;
}) {
  if (!isPaused) {
    return null;
  }
  if (pauseReason === "schedule-window") {
    return labels.schedulePaused(scheduleSummary, nextWindowLabel);
  }
  return disconnectedMessage;
}

export function buildTransferDockCompositeProps<TTransfer extends TransferLike>({
  activeTabId,
  activeTerminalTabTitle,
  cancelAllActiveDownloads,
  cancelAllActiveUploads,
  cancelSftpDownload,
  cancelSftpUpload,
  canClearFinishedDownloads,
  canClearFinishedUploads,
  canRetryAllFailedTransfers,
  canRetryFailedDownloads,
  canRetryFailedUploads,
  clearFinishedTransfers,
  discardPendingTransferRestoreQueue,
  downloadConcurrency,
  failedDownloadHistoryCount,
  failedDownloadRetryCandidateCount,
  failedRetryCandidateTotal,
  failedUploadHistoryCount,
  failedUploadRetryCandidateCount,
  formatTransferProgress,
  formatTransferTimestamp,
  hasOperationCenterActivity,
  isActiveDownloadQueuePaused,
  isActiveUploadQueuePaused,
  labels,
  nextSftpTransferWindowOpeningLabel,
  notice,
  onOpenOperationCenter,
  onOpenRetryCenter,
  operationCenterActiveCount,
  pendingRestoreCount,
  restorePendingTransferRestoreQueue,
  retryAllFailedTransfersWithScopeChoice,
  retryFailedDownloads,
  retryFailedUploads,
  sftpTransferScheduleSummary,
  uploadConcurrency,
  uploadPauseReason,
  downloadPauseReason,
  activeUploadProgressStats,
  activeUploadQueueStats,
  activeDownloadProgressStats,
  activeDownloadQueueStats,
  activeUploadTransfers,
  activeDownloadTransfers
}: BuildTransferDockCompositePropsArgs<TTransfer>): TransferDockProps {
  const uploadPanel = buildTransferDockPanelProps({
    cancelAllAction: cancelAllActiveUploads,
    cancelAllDisabled: !activeTabId,
    cancelAllLabel: labels.cancelAllUploadsLabel,
    cancelAllTitle: labels.cancelAllUploadsTitle,
    canCancelTransfer: (transfer) => transfer.status === "queued" || transfer.status === "running",
    clearFinishedAction: () => {
      clearFinishedTransfers("upload");
    },
    clearFinishedDisabled: !canClearFinishedUploads,
    emptyLabel: labels.uploadEmpty,
    getTransferDirection: () => "upload",
    getTransferId: (transfer) => transfer.transferId,
    getTransferName: (transfer) => transfer.name,
    getTransferProgressLabel: formatTransferProgress,
    getTransferStatus: (transfer) => transfer.status,
    getTransferTimeLabel: formatTransferTimestamp,
    historyMessage:
      failedUploadHistoryCount > 0 ? labels.storedFailedRetries(failedUploadHistoryCount) : null,
    onCancelTransferAction: cancelSftpUpload,
    pauseMessage: buildTransferPauseMessage({
      labels,
      isPaused: isActiveUploadQueuePaused,
      pauseReason: uploadPauseReason,
      scheduleSummary: sftpTransferScheduleSummary,
      nextWindowLabel: nextSftpTransferWindowOpeningLabel,
      disconnectedMessage: labels.uploadDisconnectedPaused
    }),
    progressSummary: labels.progressSummary(
      activeUploadProgressStats.completed,
      activeUploadProgressStats.total,
      activeUploadProgressStats.failed,
      activeUploadProgressStats.canceled,
      activeUploadProgressStats.running,
      activeUploadProgressStats.queued
    ),
    retryFailedAction: retryFailedUploads,
    retryFailedCount: failedUploadRetryCandidateCount,
    retryFailedDisabled: !canRetryFailedUploads,
    title: labels.uploadsTitle(
      activeUploadQueueStats.running,
      activeUploadQueueStats.queued,
      uploadConcurrency
    ),
    transfers: activeUploadTransfers
  });

  const downloadPanel = buildTransferDockPanelProps({
    cancelAllAction: cancelAllActiveDownloads,
    cancelAllDisabled: !activeTabId,
    cancelAllLabel: labels.cancelAllDownloadsLabel,
    cancelAllTitle: labels.cancelAllDownloadsTitle,
    canCancelTransfer: (transfer) => transfer.status === "queued" || transfer.status === "running",
    clearFinishedAction: () => {
      clearFinishedTransfers("download");
    },
    clearFinishedDisabled: !canClearFinishedDownloads,
    emptyLabel: labels.downloadEmpty,
    getTransferDirection: () => "download",
    getTransferId: (transfer) => transfer.transferId,
    getTransferName: (transfer) => transfer.name,
    getTransferProgressLabel: formatTransferProgress,
    getTransferStatus: (transfer) => transfer.status,
    getTransferTimeLabel: formatTransferTimestamp,
    historyMessage:
      failedDownloadHistoryCount > 0
        ? labels.storedFailedRetries(failedDownloadHistoryCount)
        : null,
    onCancelTransferAction: cancelSftpDownload,
    pauseMessage: buildTransferPauseMessage({
      labels,
      isPaused: isActiveDownloadQueuePaused,
      pauseReason: downloadPauseReason,
      scheduleSummary: sftpTransferScheduleSummary,
      nextWindowLabel: nextSftpTransferWindowOpeningLabel,
      disconnectedMessage: labels.downloadDisconnectedPaused
    }),
    progressSummary: labels.progressSummary(
      activeDownloadProgressStats.completed,
      activeDownloadProgressStats.total,
      activeDownloadProgressStats.failed,
      activeDownloadProgressStats.canceled,
      activeDownloadProgressStats.running,
      activeDownloadProgressStats.queued
    ),
    retryFailedAction: retryFailedDownloads,
    retryFailedCount: failedDownloadRetryCandidateCount,
    retryFailedDisabled: !canRetryFailedDownloads,
    title: labels.downloadsTitle(
      activeDownloadQueueStats.running,
      activeDownloadQueueStats.queued,
      downloadConcurrency
    ),
    transfers: activeDownloadTransfers
  });

  return buildTransferDockProps({
    bindingLabel: activeTerminalTabTitle
      ? labels.boundTo(activeTerminalTabTitle)
      : labels.emptyBinding,
    canRetryAllFailed: canRetryAllFailedTransfers,
    discardPendingTransferRestoreQueue,
    downloadPanel,
    failedRetryCandidateTotal,
    hasOperationCenterActivity,
    labels,
    notice,
    onOpenOperationCenter,
    onOpenRetryCenter,
    operationCenterActiveCount,
    pendingRestoreCount,
    restorePendingTransferRestoreQueue,
    retryAllFailedTransfersWithScopeChoice,
    uploadPanel
  });
}
