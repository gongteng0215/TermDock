import type {
  BuildTransferDockCompositePropsArgs,
  TransferLike
} from "./transfer-dock-props";

type TransferDockActionArgs<TTransfer extends TransferLike> = Pick<
  BuildTransferDockCompositePropsArgs<TTransfer>,
  | "cancelAllActiveDownloads"
  | "cancelAllActiveUploads"
  | "cancelSftpDownload"
  | "cancelSftpUpload"
  | "clearFinishedTransfers"
  | "discardPendingTransferRestoreQueue"
  | "onOpenOperationCenter"
  | "onOpenRetryCenter"
  | "restorePendingTransferRestoreQueue"
  | "retryAllFailedTransfersWithScopeChoice"
  | "retryFailedDownloads"
  | "retryFailedUploads"
>;

type TransferDockValueArgs<TTransfer extends TransferLike> = Pick<
  BuildTransferDockCompositePropsArgs<TTransfer>,
  | "activeDownloadProgressStats"
  | "activeDownloadQueueStats"
  | "activeDownloadTransfers"
  | "activeTabId"
  | "activeTerminalTabTitle"
  | "activeUploadProgressStats"
  | "activeUploadQueueStats"
  | "activeUploadTransfers"
  | "canClearFinishedDownloads"
  | "canClearFinishedUploads"
  | "canRetryAllFailedTransfers"
  | "canRetryFailedDownloads"
  | "canRetryFailedUploads"
  | "downloadConcurrency"
  | "downloadPauseReason"
  | "failedDownloadHistoryCount"
  | "failedDownloadRetryCandidateCount"
  | "failedRetryCandidateTotal"
  | "failedUploadHistoryCount"
  | "failedUploadRetryCandidateCount"
  | "formatTransferProgress"
  | "formatTransferTimestamp"
  | "hasOperationCenterActivity"
  | "isActiveDownloadQueuePaused"
  | "isActiveUploadQueuePaused"
  | "labels"
  | "nextSftpTransferWindowOpeningLabel"
  | "notice"
  | "operationCenterActiveCount"
  | "pendingRestoreCount"
  | "sftpTransferScheduleSummary"
  | "uploadConcurrency"
  | "uploadEffectiveConcurrency"
  | "uploadConcurrencyBackpressureReason"
  | "uploadPauseReason"
>;

interface BuildTransferDockCompositeArgsInput<TTransfer extends TransferLike> {
  actions: TransferDockActionArgs<TTransfer>;
  values: TransferDockValueArgs<TTransfer>;
}

export function buildTransferDockCompositeArgs<TTransfer extends TransferLike>({
  actions,
  values
}: BuildTransferDockCompositeArgsInput<TTransfer>): BuildTransferDockCompositePropsArgs<TTransfer> {
  return {
    ...values,
    ...actions
  };
}
