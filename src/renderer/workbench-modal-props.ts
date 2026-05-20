import type {
  OperationCenterModalProps,
  RetryCenterModalProps
} from "./components/workbench-modals";

interface BuildOperationCenterModalPropsArgs
  extends Omit<
    OperationCenterModalProps,
    | "onCancelActiveDownloads"
    | "onCancelActiveUploads"
    | "onCancelAllTransfersAcrossTabs"
    | "onCancelTabTasks"
    | "onClearFinishedAppJobs"
    | "onCopyAppJobOutputPath"
    | "onReconnectDisconnectedTabs"
    | "onReconnectTab"
    | "onRetryActiveDownloads"
    | "onRetryActiveUploads"
    | "onRetryAllFailedTransfers"
  > {
  cancelAllActiveDownloads: () => Promise<void>;
  cancelAllActiveUploads: () => Promise<void>;
  cancelAllTransfersAcrossTabs: () => Promise<void>;
  cancelTransferTasksForTab: (tabId: string) => Promise<void>;
  clearFinishedOperationCenterAppJobs: () => void;
  copyOperationCenterAppJobOutputPath: (jobId: string) => Promise<void>;
  reconnectDisconnectedOperationTabs: () => Promise<void>;
  reconnectOperationTabById: (tabId: string) => Promise<unknown>;
  retryAllFailedTransfersWithScopeChoice: () => Promise<void>;
  retryFailedDownloads: () => Promise<void>;
  retryFailedUploads: () => Promise<void>;
}

export function buildOperationCenterModalProps({
  cancelAllActiveDownloads,
  cancelAllActiveUploads,
  cancelAllTransfersAcrossTabs,
  cancelTransferTasksForTab,
  clearFinishedOperationCenterAppJobs,
  copyOperationCenterAppJobOutputPath,
  reconnectDisconnectedOperationTabs,
  reconnectOperationTabById,
  retryAllFailedTransfersWithScopeChoice,
  retryFailedDownloads,
  retryFailedUploads,
  ...modalProps
}: BuildOperationCenterModalPropsArgs): OperationCenterModalProps {
  return {
    ...modalProps,
    onCancelActiveDownloads: () => {
      void cancelAllActiveDownloads();
    },
    onCancelActiveUploads: () => {
      void cancelAllActiveUploads();
    },
    onCancelAllTransfersAcrossTabs: () => {
      void cancelAllTransfersAcrossTabs();
    },
    onCancelTabTasks: (tabId) => {
      void cancelTransferTasksForTab(tabId);
    },
    onClearFinishedAppJobs: clearFinishedOperationCenterAppJobs,
    onCopyAppJobOutputPath: (jobId) => {
      void copyOperationCenterAppJobOutputPath(jobId);
    },
    onReconnectDisconnectedTabs: () => {
      void reconnectDisconnectedOperationTabs();
    },
    onReconnectTab: (tabId) => {
      void reconnectOperationTabById(tabId);
    },
    onRetryActiveDownloads: () => {
      void retryFailedDownloads();
    },
    onRetryActiveUploads: () => {
      void retryFailedUploads();
    },
    onRetryAllFailedTransfers: () => {
      void retryAllFailedTransfersWithScopeChoice();
    }
  };
}

interface BuildRetryCenterModalPropsArgs
  extends Omit<
    RetryCenterModalProps,
    | "onClearAllEntries"
    | "onClearGroupEntries"
    | "onClearSelectedEntries"
    | "onClearVisibleEntries"
    | "onClearVisibleFailureReason"
    | "onExportAnalyticsCsv"
    | "onExportAnalyticsJson"
    | "onExportGroupHistoryCsv"
    | "onExportGroupHistoryJson"
    | "onExportVisibleHistoryCsv"
    | "onExportVisibleHistoryJson"
    | "onRetryAllFailedTransfers"
    | "onRetryBatchConfirmThresholdChange"
    | "onRetryFailedDownloads"
    | "onRetryFailedUploads"
    | "onRetryGroupFailedEntries"
    | "onRetrySelectedEntries"
    | "onRetryVisibleEntries"
    | "onRetryVisibleFailureReason"
    | "onToggleAutoUseLastRetryScope"
  > {
  changeRetryBatchConfirmThreshold: (value: number) => void;
  clearAllRetryCenterEntries: () => Promise<void>;
  clearRetryCenterGroupEntries: (groupKey: string) => Promise<void>;
  clearSelectedRetryCenterEntries: () => Promise<void>;
  clearVisibleRetryCenterEntries: () => Promise<void>;
  clearVisibleRetryCenterEntriesByFailureReason: (reason: string) => Promise<void>;
  exportRetryCenterAnalyticsCsv: () => Promise<void>;
  exportRetryCenterAnalyticsJson: () => Promise<void>;
  exportRetryCenterGroupHistoryCsvWithScopeChoice: (groupKey: string) => Promise<void>;
  exportRetryCenterGroupHistoryJsonWithScopeChoice: (groupKey: string) => Promise<void>;
  exportRetryCenterVisibleHistoryCsv: () => Promise<void>;
  exportRetryCenterVisibleHistoryJson: () => Promise<void>;
  retryAllFailedTransfersWithScopeChoice: () => Promise<void>;
  retryFailedDownloads: () => Promise<void>;
  retryFailedUploads: () => Promise<void>;
  retryRetryCenterGroupFailedEntries: (groupKey: string) => Promise<void>;
  retrySelectedRetryCenterEntriesWithScopeChoice: () => Promise<void>;
  retryVisibleRetryCenterEntriesWithScopeChoice: (reason?: string) => Promise<void>;
  toggleRetryCenterAutoUseLastRetryScope: () => void;
}

export function buildRetryCenterModalProps({
  changeRetryBatchConfirmThreshold,
  clearAllRetryCenterEntries,
  clearRetryCenterGroupEntries,
  clearSelectedRetryCenterEntries,
  clearVisibleRetryCenterEntries,
  clearVisibleRetryCenterEntriesByFailureReason,
  exportRetryCenterAnalyticsCsv,
  exportRetryCenterAnalyticsJson,
  exportRetryCenterGroupHistoryCsvWithScopeChoice,
  exportRetryCenterGroupHistoryJsonWithScopeChoice,
  exportRetryCenterVisibleHistoryCsv,
  exportRetryCenterVisibleHistoryJson,
  retryAllFailedTransfersWithScopeChoice,
  retryFailedDownloads,
  retryFailedUploads,
  retryRetryCenterGroupFailedEntries,
  retrySelectedRetryCenterEntriesWithScopeChoice,
  retryVisibleRetryCenterEntriesWithScopeChoice,
  toggleRetryCenterAutoUseLastRetryScope,
  ...modalProps
}: BuildRetryCenterModalPropsArgs): RetryCenterModalProps {
  return {
    ...modalProps,
    onClearAllEntries: () => {
      void clearAllRetryCenterEntries();
    },
    onClearGroupEntries: (groupKey) => {
      void clearRetryCenterGroupEntries(groupKey);
    },
    onClearSelectedEntries: () => {
      void clearSelectedRetryCenterEntries();
    },
    onClearVisibleEntries: () => {
      void clearVisibleRetryCenterEntries();
    },
    onClearVisibleFailureReason: (reason) => {
      void clearVisibleRetryCenterEntriesByFailureReason(reason);
    },
    onExportAnalyticsCsv: () => {
      void exportRetryCenterAnalyticsCsv();
    },
    onExportAnalyticsJson: () => {
      void exportRetryCenterAnalyticsJson();
    },
    onExportGroupHistoryCsv: (groupKey) => {
      void exportRetryCenterGroupHistoryCsvWithScopeChoice(groupKey);
    },
    onExportGroupHistoryJson: (groupKey) => {
      void exportRetryCenterGroupHistoryJsonWithScopeChoice(groupKey);
    },
    onExportVisibleHistoryCsv: () => {
      void exportRetryCenterVisibleHistoryCsv();
    },
    onExportVisibleHistoryJson: () => {
      void exportRetryCenterVisibleHistoryJson();
    },
    onRetryAllFailedTransfers: () => {
      void retryAllFailedTransfersWithScopeChoice();
    },
    onRetryBatchConfirmThresholdChange: changeRetryBatchConfirmThreshold,
    onRetryFailedDownloads: () => {
      void retryFailedDownloads();
    },
    onRetryFailedUploads: () => {
      void retryFailedUploads();
    },
    onRetryGroupFailedEntries: (groupKey) => {
      void retryRetryCenterGroupFailedEntries(groupKey);
    },
    onRetrySelectedEntries: () => {
      void retrySelectedRetryCenterEntriesWithScopeChoice();
    },
    onRetryVisibleEntries: () => {
      void retryVisibleRetryCenterEntriesWithScopeChoice();
    },
    onRetryVisibleFailureReason: (reason) => {
      void retryVisibleRetryCenterEntriesWithScopeChoice(reason);
    },
    onToggleAutoUseLastRetryScope: toggleRetryCenterAutoUseLastRetryScope
  };
}
