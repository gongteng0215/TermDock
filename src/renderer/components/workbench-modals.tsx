import { UiIcon } from "./ui-icon";

type TransferHistoryScope = "activeSession" | "allSessions";
type TransferHistoryDirectionFilter = "all" | "upload" | "download";
type TransferHistoryStatusFilter = "all" | "queued" | "running" | "completed" | "failed" | "canceled";
type TransferHistoryTimeRange = "all" | "5m" | "30m" | "1h" | "24h";
type RetryCenterListMode = "flat" | "groupedByReason";
type RetryCenterRetryScope = "all" | "upload" | "download";

interface OperationCenterQueueSummaryView {
  activeTabCount: number;
  running: number;
  queued: number;
  completed: number;
  total: number;
  failed: number;
  canceled: number;
}

interface OperationCenterRecentAppJobView {
  id: string;
  title: string;
  categoryLabel: string;
  startedAtLabel: string;
  durationLabel: string;
  detail: string;
  outputPath?: string | null;
  stateClassName: string;
  stateLabel: string;
}

interface OperationCenterTransferTabSummaryView {
  tabId: string;
  title: string;
  uploadRunning: number;
  uploadQueued: number;
  downloadRunning: number;
  downloadQueued: number;
  totalActive: number;
  connected: boolean;
}

interface OperationCenterPortForwardSummaryView {
  activeTabCount: number;
  total: number;
  degraded: number;
  activeTabStatus?: string | null;
}

interface OperationCenterTimelineItemView {
  id: string;
  title: string;
  meta: string;
  detail: string;
  stateClassName: string;
  stateLabel: string;
}

interface OperationCenterModalProps {
  open: boolean;
  onClose: () => void;
  uploadSummary: OperationCenterQueueSummaryView;
  downloadSummary: OperationCenterQueueSummaryView;
  hasActiveTab: boolean;
  onCancelActiveUploads: () => void;
  onRetryActiveUploads: () => void;
  canRetryFailedUploads: boolean;
  onCancelActiveDownloads: () => void;
  onRetryActiveDownloads: () => void;
  canRetryFailedDownloads: boolean;
  deleteProgressLabel: string | null;
  portForwardBusy: boolean;
  portForwardSummary: OperationCenterPortForwardSummaryView;
  onOpenPortForward: () => void;
  onOpenDiagnostics: () => void;
  runningAppJobCount: number;
  recentAppJobs: OperationCenterRecentAppJobView[];
  onCopyAppJobOutputPath: (jobId: string) => void;
  finishedAppJobCount: number;
  onClearFinishedAppJobs: () => void;
  hasSnippetJobs: boolean;
  onOpenSnippets: () => void;
  hasDiagnosticsJobs: boolean;
  onOpenDiagnosticsJobs: () => void;
  timelineItems: OperationCenterTimelineItemView[];
  transferTabSummaries: OperationCenterTransferTabSummaryView[];
  onFocusTab: (tabId: string) => void;
  onReconnectTab: (tabId: string) => void;
  isReconnectingTabs: boolean;
  onCancelTabTasks: (tabId: string) => void;
  isBulkCancelingTabs: boolean;
  onReconnectDisconnectedTabs: () => void;
  onCancelAllTransfersAcrossTabs: () => void;
  hasActivity: boolean;
  canRetryAllFailedTransfers: boolean;
  failedRetryCandidateTotal: number;
  onRetryAllFailedTransfers: () => void;
}

interface RetryCenterFailureReasonOptionView {
  reason: string;
  total: number;
}

interface RetryCenterEntryView {
  key: string;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  name: string;
  localPath: string;
  remotePath: string;
  updatedAt: number;
  direction: "upload" | "download";
  attemptCount: number;
  message?: string;
}

interface RetryCenterGroupView {
  key: string;
  label: string;
  total: number;
  failedCount: number;
  activeSessionFailedCount: number;
  entries: RetryCenterEntryView[];
}

interface RetryCenterAnalyticsView {
  failedRatioPercent: number;
  failedCount: number;
  totalCount: number;
  directionCounts: {
    upload: number;
    download: number;
  };
  statusCounts: {
    completed: number;
    failed: number;
    canceled: number;
  };
  topSessions: Array<{
    sessionName: string;
    total: number;
  }>;
  topGroups: Array<{
    groupName: string;
    total: number;
  }>;
  topFailureReasons: Array<{
    reason: string;
    total: number;
  }>;
}

interface RetryCenterFailureSuggestionRowView {
  reason: string;
  suggestion: string;
}

interface RetryCenterTopFailureReasonRetryRowView {
  reason: string;
  totalVisible: number;
  activeSessionVisibleFailed: number;
  isCurrentFilter: boolean;
}

interface CommandHistoryManagerEntryView {
  id: string;
  command: string;
  selected: boolean;
  metaLabel: string;
  title: string;
}

interface CommandHistoryManagerModalProps {
  open: boolean;
  onClose: () => void;
  visibleCount: number;
  selectedCount: number;
  totalCount: number;
  entries: CommandHistoryManagerEntryView[];
  onAdd: () => void;
  onImport: () => void;
  onExport: () => void;
  canExport: boolean;
  canToggleSelectVisible: boolean;
  allVisibleSelected: boolean;
  onToggleSelectVisible: () => void;
  canClearSelection: boolean;
  onClearSelection: () => void;
  onPasteEntry: (entryId: string) => void;
  onToggleEntrySelection: (entryId: string) => void;
  onEditEntry: (entryId: string) => void;
  onDeleteSelected: () => void;
  onDeleteVisible: () => void;
  onDeleteAll: () => void;
}

interface RetryCenterModalProps {
  open: boolean;
  onClose: () => void;
  scope: TransferHistoryScope;
  onScopeChange: (value: TransferHistoryScope) => void;
  direction: TransferHistoryDirectionFilter;
  onDirectionChange: (value: TransferHistoryDirectionFilter) => void;
  status: TransferHistoryStatusFilter;
  onStatusChange: (value: TransferHistoryStatusFilter) => void;
  timeRange: TransferHistoryTimeRange;
  onTimeRangeChange: (value: TransferHistoryTimeRange) => void;
  listMode: RetryCenterListMode;
  onListModeChange: (value: RetryCenterListMode) => void;
  failureReasonAllValue: string;
  failureReasonFilter: string;
  onFailureReasonFilterChange: (value: string) => void;
  failureReasonOptions: RetryCenterFailureReasonOptionView[];
  lastRetryScope: RetryCenterRetryScope;
  onLastRetryScopeChange: (value: RetryCenterRetryScope) => void;
  minRetryBatchConfirmThreshold: number;
  maxRetryBatchConfirmThreshold: number;
  retryBatchConfirmThreshold: number;
  onRetryBatchConfirmThresholdChange: (value: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
  hasCustomizedView: boolean;
  onResetFilters: () => void;
  autoUseLastRetryScope: boolean;
  onToggleAutoUseLastRetryScope: () => void;
  entryCount: number;
  totalHistoryCount: number;
  selectedCount: number;
  selectedFailedCount: number;
  visibleFailedCount: number;
  failedUploadCandidateCount: number;
  failedDownloadCandidateCount: number;
  selectedFailureReasonLabel: string;
  lastRetryScopeLabel: string;
  isGroupedView: boolean;
  groupedEntries: RetryCenterGroupView[];
  collapsedGroupKeySet: Set<string>;
  canExpandAllGroups: boolean;
  onExpandAllGroups: () => void;
  canCollapseAllGroups: boolean;
  onCollapseAllGroups: () => void;
  onToggleGroupCollapsed: (groupKey: string) => void;
  selectionSet: Set<string>;
  onToggleEntrySelection: (entryKey: string) => void;
  entries: RetryCenterEntryView[];
  analytics: RetryCenterAnalyticsView;
  failureSuggestionRows: RetryCenterFailureSuggestionRowView[];
  topFailureReasonRetryRows: RetryCenterTopFailureReasonRetryRowView[];
  hasActiveTab: boolean;
  onSelectGroupEntries: (groupKey: string) => void;
  onRetryGroupFailedEntries: (groupKey: string) => void;
  onClearGroupEntries: (groupKey: string) => void;
  onExportGroupHistoryJson: (groupKey: string) => void;
  onExportGroupHistoryCsv: (groupKey: string) => void;
  onRetryVisibleFailureReason: (reason: string) => void;
  onClearVisibleFailureReason: (reason: string) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onExportVisibleHistoryJson: () => void;
  onExportVisibleHistoryCsv: () => void;
  canExportAnalytics: boolean;
  onExportAnalyticsJson: () => void;
  onExportAnalyticsCsv: () => void;
  canRetryFailedUploads: boolean;
  onRetryFailedUploads: () => void;
  canRetryFailedDownloads: boolean;
  onRetryFailedDownloads: () => void;
  canRetryAllFailedTransfers: boolean;
  failedRetryCandidateTotal: number;
  onRetryAllFailedTransfers: () => void;
  canRetryVisibleEntries: boolean;
  onRetryVisibleEntries: () => void;
  canRetrySelectedEntries: boolean;
  onRetrySelectedEntries: () => void;
  canClearSelectedEntries: boolean;
  onClearSelectedEntries: () => void;
  canClearVisibleEntries: boolean;
  onClearVisibleEntries: () => void;
  canClearAllEntries: boolean;
  onClearAllEntries: () => void;
  formatHistoryTimestamp: (timestamp: number) => string;
  formatPercent: (value: number) => string;
}

export function OperationCenterModal({
  open,
  onClose,
  uploadSummary,
  downloadSummary,
  hasActiveTab,
  onCancelActiveUploads,
  onRetryActiveUploads,
  canRetryFailedUploads,
  onCancelActiveDownloads,
  onRetryActiveDownloads,
  canRetryFailedDownloads,
  deleteProgressLabel,
  portForwardBusy,
  portForwardSummary,
  onOpenPortForward,
  onOpenDiagnostics,
  runningAppJobCount,
  recentAppJobs,
  onCopyAppJobOutputPath,
  finishedAppJobCount,
  onClearFinishedAppJobs,
  hasSnippetJobs,
  onOpenSnippets,
  hasDiagnosticsJobs,
  onOpenDiagnosticsJobs,
  timelineItems,
  transferTabSummaries,
  onFocusTab,
  onReconnectTab,
  isReconnectingTabs,
  onCancelTabTasks,
  isBulkCancelingTabs,
  onReconnectDisconnectedTabs,
  onCancelAllTransfersAcrossTabs,
  hasActivity,
  canRetryAllFailedTransfers,
  failedRetryCandidateTotal,
  onRetryAllFailedTransfers
}: OperationCenterModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-label="Operation Center"
        aria-modal="true"
        className="modal modal--operation-center"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal__header">
          <h3>Operation Center</h3>
          <button className="icon-button" onClick={onClose} type="button">
            <UiIcon name="close" />
          </button>
        </div>
        <p className="hint">
          Consolidated view for long-running operations across open workspace tabs.
        </p>
        <div className="operation-center__grid">
          <article className="operation-center__card">
            <div className="operation-center__card-header">
              <p className="operation-center__title">Upload Queue</p>
              <span
                className={
                  uploadSummary.running + uploadSummary.queued > 0
                    ? "operation-center__state is-active"
                    : "operation-center__state is-idle"
                }
              >
                {uploadSummary.running + uploadSummary.queued > 0 ? "Active" : "Idle"}
              </span>
            </div>
            <p className="operation-center__meta">
              tabs {uploadSummary.activeTabCount} | running {uploadSummary.running} | queued{" "}
              {uploadSummary.queued}
            </p>
            <p className="operation-center__meta">
              progress {uploadSummary.completed}/{uploadSummary.total} | failed {uploadSummary.failed} |
              canceled {uploadSummary.canceled}
            </p>
            <div className="operation-center__actions">
              <button
                className="secondary-button secondary-button--small"
                disabled={!hasActiveTab}
                onClick={onCancelActiveUploads}
                type="button"
              >
                Cancel Active Tab
              </button>
              <button
                className="secondary-button secondary-button--small"
                disabled={!canRetryFailedUploads}
                onClick={onRetryActiveUploads}
                type="button"
              >
                Retry Active Tab
              </button>
            </div>
          </article>

          <article className="operation-center__card">
            <div className="operation-center__card-header">
              <p className="operation-center__title">Download Queue</p>
              <span
                className={
                  downloadSummary.running + downloadSummary.queued > 0
                    ? "operation-center__state is-active"
                    : "operation-center__state is-idle"
                }
              >
                {downloadSummary.running + downloadSummary.queued > 0 ? "Active" : "Idle"}
              </span>
            </div>
            <p className="operation-center__meta">
              tabs {downloadSummary.activeTabCount} | running {downloadSummary.running} | queued{" "}
              {downloadSummary.queued}
            </p>
            <p className="operation-center__meta">
              progress {downloadSummary.completed}/{downloadSummary.total} | failed {downloadSummary.failed} |
              canceled {downloadSummary.canceled}
            </p>
            <div className="operation-center__actions">
              <button
                className="secondary-button secondary-button--small"
                disabled={!hasActiveTab}
                onClick={onCancelActiveDownloads}
                type="button"
              >
                Cancel Active Tab
              </button>
              <button
                className="secondary-button secondary-button--small"
                disabled={!canRetryFailedDownloads}
                onClick={onRetryActiveDownloads}
                type="button"
              >
                Retry Active Tab
              </button>
            </div>
          </article>

          <article className="operation-center__card">
            <div className="operation-center__card-header">
              <p className="operation-center__title">Remote Delete</p>
              <span
                className={
                  deleteProgressLabel
                    ? "operation-center__state is-active"
                    : "operation-center__state is-idle"
                }
              >
                {deleteProgressLabel ? "Running" : "Idle"}
              </span>
            </div>
            {deleteProgressLabel ? (
              <p className="operation-center__meta operation-center__meta--wrap">
                {deleteProgressLabel}
              </p>
            ) : (
              <p className="operation-center__meta">No active delete operation.</p>
            )}
            <p className="operation-center__meta operation-center__meta--muted">
              Delete cancellation is not available yet in current backend flow.
            </p>
          </article>

          <article className="operation-center__card">
            <div className="operation-center__card-header">
              <p className="operation-center__title">Port Forwarding Ops</p>
              <span
                className={
                  portForwardBusy
                    ? "operation-center__state is-active"
                    : "operation-center__state is-idle"
                }
              >
                {portForwardBusy ? "Working" : "Idle"}
              </span>
            </div>
            <p className="operation-center__meta">
              tabs {portForwardSummary.activeTabCount} | active forwards {portForwardSummary.total} |
              degraded {portForwardSummary.degraded}
            </p>
            <p className="operation-center__meta">
              active tab status: {portForwardSummary.activeTabStatus?.trim() || "No recent status message."}
            </p>
            <div className="operation-center__actions">
              <button
                className="secondary-button secondary-button--small"
                onClick={onOpenPortForward}
                type="button"
              >
                Open Port Fwd
              </button>
              <button
                className="secondary-button secondary-button--small"
                onClick={onOpenDiagnostics}
                type="button"
              >
                Open Diagnostics
              </button>
            </div>
          </article>

          <article className="operation-center__card operation-center__card--wide">
            <div className="operation-center__card-header">
              <p className="operation-center__title">Activity Timeline</p>
              <span
                className={
                  timelineItems.length > 0
                    ? "operation-center__state is-active"
                    : "operation-center__state is-idle"
                }
              >
                {timelineItems.length > 0 ? `${timelineItems.length} item(s)` : "Idle"}
              </span>
            </div>
            {timelineItems.length > 0 ? (
              <ul className="operation-center__timeline">
                {timelineItems.map((item) => (
                  <li className="operation-center__timeline-item" key={item.id}>
                    <span className={item.stateClassName}>{item.stateLabel}</span>
                    <div className="operation-center__tab-main">
                      <p className="operation-center__tab-title">{item.title}</p>
                      <p className="operation-center__meta">{item.meta}</p>
                      <p className="operation-center__meta operation-center__meta--wrap">
                        {item.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="operation-center__meta">
                No transfer, port-forward, delete, or tracked app-job activity yet.
              </p>
            )}
          </article>

          <article className="operation-center__card operation-center__card--wide">
            <div className="operation-center__card-header">
              <p className="operation-center__title">Tracked App Jobs</p>
              <span
                className={
                  runningAppJobCount > 0
                    ? "operation-center__state is-active"
                    : recentAppJobs.length > 0
                      ? "operation-center__state is-success"
                      : "operation-center__state is-idle"
                }
              >
                {runningAppJobCount > 0
                  ? `${runningAppJobCount} running`
                  : recentAppJobs.length > 0
                    ? `${recentAppJobs.length} recent`
                    : "Idle"}
              </span>
            </div>
            {recentAppJobs.length > 0 ? (
              <ul className="operation-center__tab-list">
                {recentAppJobs.map((job) => (
                  <li className="operation-center__tab-item" key={job.id}>
                    <div className="operation-center__tab-main">
                      <p className="operation-center__tab-title">{job.title}</p>
                      <p className="operation-center__meta">
                        {job.categoryLabel} | started {job.startedAtLabel} | duration {job.durationLabel}
                      </p>
                      <p className="operation-center__meta operation-center__meta--wrap">{job.detail}</p>
                      {job.outputPath ? (
                        <p className="operation-center__meta operation-center__meta--wrap">
                          output: {job.outputPath}
                        </p>
                      ) : null}
                    </div>
                    <div className="operation-center__tab-actions">
                      <span className={job.stateClassName}>{job.stateLabel}</span>
                      {job.outputPath ? (
                        <button
                          className="secondary-button secondary-button--small"
                          onClick={() => onCopyAppJobOutputPath(job.id)}
                          type="button"
                        >
                          Copy Path
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="operation-center__meta">No tracked session/snippet/diagnostics jobs yet.</p>
            )}
            <div className="operation-center__actions">
              <button
                className="secondary-button secondary-button--small"
                disabled={finishedAppJobCount === 0}
                onClick={onClearFinishedAppJobs}
                type="button"
              >
                Clear Finished
              </button>
              <button
                className="secondary-button secondary-button--small"
                disabled={!hasSnippetJobs}
                onClick={onOpenSnippets}
                type="button"
              >
                Open Snippets
              </button>
              <button
                className="secondary-button secondary-button--small"
                disabled={!hasDiagnosticsJobs}
                onClick={onOpenDiagnosticsJobs}
                type="button"
              >
                Open Diagnostics
              </button>
            </div>
          </article>

          <article className="operation-center__card operation-center__card--wide">
            <div className="operation-center__card-header">
              <p className="operation-center__title">All Tabs Transfer Activity</p>
              <span
                className={
                  transferTabSummaries.length > 0
                    ? "operation-center__state is-active"
                    : "operation-center__state is-idle"
                }
              >
                {transferTabSummaries.length > 0 ? `${transferTabSummaries.length} tab(s)` : "Idle"}
              </span>
            </div>
            {transferTabSummaries.length > 0 ? (
              <ul className="operation-center__tab-list">
                {transferTabSummaries.map((summary) => (
                  <li className="operation-center__tab-item" key={summary.tabId}>
                    <div className="operation-center__tab-main">
                      <p className="operation-center__tab-title">{summary.title}</p>
                      <p className="operation-center__meta">
                        U(r{summary.uploadRunning}/q{summary.uploadQueued}) | D(r
                        {summary.downloadRunning}/q{summary.downloadQueued}) | total {summary.totalActive}
                      </p>
                    </div>
                    <div className="operation-center__tab-actions">
                      <span
                        className={
                          summary.connected
                            ? "operation-center__state is-active"
                            : "operation-center__state is-idle"
                        }
                      >
                        {summary.connected ? "Connected" : "Disconnected"}
                      </span>
                      <button
                        className="secondary-button secondary-button--small"
                        onClick={() => onFocusTab(summary.tabId)}
                        type="button"
                      >
                        Focus Tab
                      </button>
                      <button
                        className="secondary-button secondary-button--small"
                        disabled={summary.connected || isReconnectingTabs}
                        onClick={() => onReconnectTab(summary.tabId)}
                        type="button"
                      >
                        Reconnect Tab
                      </button>
                      <button
                        className="secondary-button secondary-button--small"
                        disabled={isBulkCancelingTabs}
                        onClick={() => onCancelTabTasks(summary.tabId)}
                        type="button"
                      >
                        Cancel Tab Tasks
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="operation-center__meta">No queued/running transfer activity across tabs.</p>
            )}
            <div className="operation-center__actions">
              <button
                className="secondary-button secondary-button--small"
                disabled={
                  transferTabSummaries.filter((entry) => !entry.connected).length === 0 ||
                  isReconnectingTabs
                }
                onClick={onReconnectDisconnectedTabs}
                type="button"
              >
                {isReconnectingTabs ? "Reconnecting..." : "Reconnect Disconnected Tabs"}
              </button>
              <button
                className="secondary-button secondary-button--small"
                disabled={transferTabSummaries.length === 0 || isBulkCancelingTabs}
                onClick={onCancelAllTransfersAcrossTabs}
                type="button"
              >
                {isBulkCancelingTabs ? "Canceling..." : "Cancel All Transfers (All Tabs)"}
              </button>
            </div>
          </article>
        </div>
        {!hasActivity ? (
          <p className="hint operation-center__idle-note">
            No high-latency operation is active right now. Queues and long jobs are idle.
          </p>
        ) : null}
        <div className="modal__actions">
          <button
            className="secondary-button"
            disabled={!canRetryAllFailedTransfers}
            onClick={onRetryAllFailedTransfers}
            title="Retry all failed upload/download candidates with retry-scope strategy"
            type="button"
          >
            Retry All Failed ({failedRetryCandidateTotal})
          </button>
          <button className="primary-button" onClick={onClose} type="button">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function RetryCenterModal({
  open,
  onClose,
  scope,
  onScopeChange,
  direction,
  onDirectionChange,
  status,
  onStatusChange,
  timeRange,
  onTimeRangeChange,
  listMode,
  onListModeChange,
  failureReasonAllValue,
  failureReasonFilter,
  onFailureReasonFilterChange,
  failureReasonOptions,
  lastRetryScope,
  onLastRetryScopeChange,
  minRetryBatchConfirmThreshold,
  maxRetryBatchConfirmThreshold,
  retryBatchConfirmThreshold,
  onRetryBatchConfirmThresholdChange,
  query,
  onQueryChange,
  hasCustomizedView,
  onResetFilters,
  autoUseLastRetryScope,
  onToggleAutoUseLastRetryScope,
  entryCount,
  totalHistoryCount,
  selectedCount,
  selectedFailedCount,
  visibleFailedCount,
  failedUploadCandidateCount,
  failedDownloadCandidateCount,
  selectedFailureReasonLabel,
  lastRetryScopeLabel,
  isGroupedView,
  groupedEntries,
  collapsedGroupKeySet,
  canExpandAllGroups,
  onExpandAllGroups,
  canCollapseAllGroups,
  onCollapseAllGroups,
  onToggleGroupCollapsed,
  selectionSet,
  onToggleEntrySelection,
  entries,
  analytics,
  failureSuggestionRows,
  topFailureReasonRetryRows,
  hasActiveTab,
  onSelectGroupEntries,
  onRetryGroupFailedEntries,
  onClearGroupEntries,
  onExportGroupHistoryJson,
  onExportGroupHistoryCsv,
  onRetryVisibleFailureReason,
  onClearVisibleFailureReason,
  onSelectAllVisible,
  onClearSelection,
  onExportVisibleHistoryJson,
  onExportVisibleHistoryCsv,
  canExportAnalytics,
  onExportAnalyticsJson,
  onExportAnalyticsCsv,
  canRetryFailedUploads,
  onRetryFailedUploads,
  canRetryFailedDownloads,
  onRetryFailedDownloads,
  canRetryAllFailedTransfers,
  failedRetryCandidateTotal,
  onRetryAllFailedTransfers,
  canRetryVisibleEntries,
  onRetryVisibleEntries,
  canRetrySelectedEntries,
  onRetrySelectedEntries,
  canClearSelectedEntries,
  onClearSelectedEntries,
  canClearVisibleEntries,
  onClearVisibleEntries,
  canClearAllEntries,
  onClearAllEntries,
  formatHistoryTimestamp,
  formatPercent
}: RetryCenterModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-label="Transfer Retry Center"
        aria-modal="true"
        className="modal modal--retry-center"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal__header">
          <h3>Transfer Retry Center</h3>
          <button className="icon-button" onClick={onClose} type="button">
            <UiIcon name="close" />
          </button>
        </div>
        <p className="hint">
          Persistent transfer history across restarts. Retry works for failed entries bound to the
          active session tab.
        </p>
        <div className="retry-center__filters">
          <label>
            Scope
            <select onChange={(event) => onScopeChange(event.target.value as TransferHistoryScope)} value={scope}>
              <option value="activeSession">Active Session</option>
              <option value="allSessions">All Sessions</option>
            </select>
          </label>
          <label>
            Direction
            <select
              onChange={(event) => onDirectionChange(event.target.value as TransferHistoryDirectionFilter)}
              value={direction}
            >
              <option value="all">All</option>
              <option value="upload">Upload</option>
              <option value="download">Download</option>
            </select>
          </label>
          <label>
            Status
            <select onChange={(event) => onStatusChange(event.target.value as TransferHistoryStatusFilter)} value={status}>
              <option value="all">All</option>
              <option value="failed">Failed</option>
              <option value="completed">Completed</option>
              <option value="canceled">Canceled</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
            </select>
          </label>
          <label>
            Time Range
            <select onChange={(event) => onTimeRangeChange(event.target.value as TransferHistoryTimeRange)} value={timeRange}>
              <option value="all">All</option>
              <option value="5m">Last 5m</option>
              <option value="30m">Last 30m</option>
              <option value="1h">Last 1h</option>
              <option value="24h">Last 24h</option>
            </select>
          </label>
          <label>
            View
            <select onChange={(event) => onListModeChange(event.target.value as RetryCenterListMode)} value={listMode}>
              <option value="flat">Flat List</option>
              <option value="groupedByReason">Grouped by Failure</option>
            </select>
          </label>
          <label>
            Failure Reason
            <select onChange={(event) => onFailureReasonFilterChange(event.target.value)} value={failureReasonFilter}>
              <option value={failureReasonAllValue}>
                All ({failureReasonOptions.reduce((total, entry) => total + entry.total, 0)})
              </option>
              {failureReasonOptions.map((entry) => (
                <option key={entry.reason} value={entry.reason}>
                  {`${entry.reason} (${entry.total})`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Default Retry Scope
            <select
              onChange={(event) => onLastRetryScopeChange(event.target.value as RetryCenterRetryScope)}
              value={lastRetryScope}
            >
              <option value="all">All Retryable</option>
              <option value="upload">Upload Only</option>
              <option value="download">Download Only</option>
            </select>
          </label>
          <label>
            Retry Confirm Threshold
            <input
              max={maxRetryBatchConfirmThreshold}
              min={minRetryBatchConfirmThreshold}
              onChange={(event) => onRetryBatchConfirmThresholdChange(Number(event.target.value))}
              type="number"
              value={retryBatchConfirmThreshold}
            />
          </label>
          <p className="hint">
            Set <code>0</code> to disable large-batch retry confirmations.
          </p>
          <label className="retry-center__search">
            Search
            <input
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="name/local/remote/message"
              value={query}
            />
          </label>
          <button
            className="secondary-button secondary-button--small retry-center__filter-reset"
            disabled={!hasCustomizedView}
            onClick={onResetFilters}
            type="button"
          >
            Reset Filters
          </button>
          <button
            aria-pressed={autoUseLastRetryScope}
            className="secondary-button secondary-button--small retry-center__filter-reset"
            onClick={onToggleAutoUseLastRetryScope}
            title="Automatically use last retry scope and skip retry-scope chooser"
            type="button"
          >
            {autoUseLastRetryScope ? "Auto Retry Scope: On" : "Auto Retry Scope: Off"}
          </button>
        </div>
        <p className="hint retry-center__summary">
          Visible {entryCount} / Total {totalHistoryCount}, Selected {selectedCount}, Selected failed
          (active session) {selectedFailedCount}, Visible failed (active session) {visibleFailedCount},
          Dock failed candidates U {failedUploadCandidateCount} / D {failedDownloadCandidateCount},
          Failure reason {selectedFailureReasonLabel}, Default scope {lastRetryScopeLabel}
          {autoUseLastRetryScope ? " (auto)" : ""}, Large retry confirm{" "}
          {retryBatchConfirmThreshold <= 0 ? "off" : `>=${retryBatchConfirmThreshold}`}
          {isGroupedView
            ? `, Groups ${groupedEntries.length}, Collapsed ${collapsedGroupKeySet.size}`
            : ""}
        </p>
        <div className="retry-center__analytics">
          <article className="retry-center__metric">
            <p className="retry-center__metric-label">Failure Ratio</p>
            <p className="retry-center__metric-value">{formatPercent(analytics.failedRatioPercent)}</p>
            <p className="retry-center__metric-meta">
              Failed {analytics.failedCount}/{analytics.totalCount}
            </p>
          </article>
          <article className="retry-center__metric">
            <p className="retry-center__metric-label">Direction Breakdown</p>
            <p className="retry-center__metric-value">
              U {analytics.directionCounts.upload} | D {analytics.directionCounts.download}
            </p>
            <p className="retry-center__metric-meta">
              completed {analytics.statusCounts.completed} | failed {analytics.statusCounts.failed} |
              canceled {analytics.statusCounts.canceled}
            </p>
          </article>
          <article className="retry-center__metric">
            <p className="retry-center__metric-label">Top Sessions / Groups</p>
            <p className="retry-center__metric-meta">
              {analytics.topSessions.length > 0
                ? analytics.topSessions.map((entry) => `${entry.sessionName} (${entry.total})`).join(" | ")
                : "No visible records"}
            </p>
            <p className="retry-center__metric-meta">
              {analytics.topGroups.length > 0
                ? analytics.topGroups.map((entry) => `${entry.groupName} (${entry.total})`).join(" | ")
                : "No group data"}
            </p>
          </article>
          <article className="retry-center__metric">
            <p className="retry-center__metric-label">Top Failure Reasons</p>
            <p className="retry-center__metric-meta retry-center__metric-meta--wrap">
              {analytics.topFailureReasons.length > 0
                ? analytics.topFailureReasons.map((entry) => `${entry.reason} (${entry.total})`).join(" | ")
                : "No failed records"}
            </p>
            {failureSuggestionRows.length > 0 ? (
              <ul className="retry-center__reason-suggestions">
                {failureSuggestionRows.map((entry) => (
                  <li className="retry-center__reason-suggestion" key={entry.reason}>
                    <strong>{entry.reason}:</strong> {entry.suggestion}
                  </li>
                ))}
              </ul>
            ) : null}
            {topFailureReasonRetryRows.length > 0 ? (
              <div className="retry-center__reason-actions">
                {topFailureReasonRetryRows.map((entry) => (
                  <div className="retry-center__reason-row" key={entry.reason}>
                    <button
                      className={
                        entry.isCurrentFilter
                          ? "secondary-button secondary-button--small is-active"
                          : "secondary-button secondary-button--small"
                      }
                      onClick={() => onFailureReasonFilterChange(entry.reason)}
                      title={`Filter by failure reason "${entry.reason}"`}
                      type="button"
                    >
                      {`${entry.reason} (${entry.totalVisible})`}
                    </button>
                    <button
                      className="secondary-button secondary-button--small"
                      disabled={!hasActiveTab || entry.activeSessionVisibleFailed <= 0}
                      onClick={() => onRetryVisibleFailureReason(entry.reason)}
                      title={`Retry "${entry.reason}" failed transfers in active session with scope strategy`}
                      type="button"
                    >
                      {`Retry (${entry.activeSessionVisibleFailed})`}
                    </button>
                    <button
                      className="secondary-button secondary-button--small"
                      disabled={entry.totalVisible <= 0}
                      onClick={() => onClearVisibleFailureReason(entry.reason)}
                      title={`Delete visible failed history records with reason "${entry.reason}"`}
                      type="button"
                    >
                      {`Delete (${entry.totalVisible})`}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="retry-center__metric-meta">
              Visible failed history only. Quick retry targets active-session entries and follows
              retry-scope strategy (chooser or auto last scope); delete removes visible failed
              history by reason.
            </p>
          </article>
        </div>
        {isGroupedView && groupedEntries.length > 0 ? (
          <div className="retry-center__group-actions">
            <button
              className="secondary-button secondary-button--small"
              disabled={!canExpandAllGroups}
              onClick={onExpandAllGroups}
              type="button"
            >
              Expand All Groups
            </button>
            <button
              className="secondary-button secondary-button--small"
              disabled={!canCollapseAllGroups}
              onClick={onCollapseAllGroups}
              type="button"
            >
              Collapse All Groups
            </button>
          </div>
        ) : null}
        <div className="retry-center__list-shell">
          {entries.length > 0 ? (
            isGroupedView ? (
              <ul className="retry-center__group-list">
                {groupedEntries.map((group) => {
                  const collapsed = collapsedGroupKeySet.has(group.key);
                  return (
                    <li className="retry-center__group-item" key={group.key}>
                      <div className="retry-center__group-header">
                        <button
                          aria-label={collapsed ? "Expand group" : "Collapse group"}
                          className="secondary-button secondary-button--small"
                          onClick={() => onToggleGroupCollapsed(group.key)}
                          type="button"
                        >
                          {collapsed ? "Expand" : "Collapse"}
                        </button>
                        <div className="retry-center__group-info">
                          <p className="retry-center__group-title" title={group.label}>
                            {group.label}
                          </p>
                          <p className="retry-center__group-meta">
                            {group.total} item(s), failed {group.failedCount}, retryable{" "}
                            {group.activeSessionFailedCount}
                          </p>
                        </div>
                        <div className="retry-center__group-header-actions">
                          <button
                            className="secondary-button secondary-button--small"
                            onClick={() => onSelectGroupEntries(group.key)}
                            type="button"
                          >
                            {`Select (${group.total})`}
                          </button>
                          <button
                            className="secondary-button secondary-button--small"
                            disabled={!hasActiveTab || group.activeSessionFailedCount <= 0}
                            onClick={() => onRetryGroupFailedEntries(group.key)}
                            title="Retry failed active-session records in this group (scope selectable)"
                            type="button"
                          >
                            {`Retry Failed (${group.activeSessionFailedCount})`}
                          </button>
                          <button
                            className="secondary-button secondary-button--small"
                            onClick={() => onClearGroupEntries(group.key)}
                            type="button"
                          >
                            {`Delete (${group.total})`}
                          </button>
                          <button
                            className="secondary-button secondary-button--small"
                            onClick={() => onExportGroupHistoryJson(group.key)}
                            type="button"
                          >
                            Export JSON
                          </button>
                          <button
                            className="secondary-button secondary-button--small"
                            onClick={() => onExportGroupHistoryCsv(group.key)}
                            type="button"
                          >
                            Export CSV
                          </button>
                        </div>
                      </div>
                      {collapsed ? null : (
                        <RetryCenterEntriesList
                          entries={group.entries}
                          formatHistoryTimestamp={formatHistoryTimestamp}
                          onToggleEntrySelection={onToggleEntrySelection}
                          selectionSet={selectionSet}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <RetryCenterEntriesList
                entries={entries}
                formatHistoryTimestamp={formatHistoryTimestamp}
                onToggleEntrySelection={onToggleEntrySelection}
                selectionSet={selectionSet}
              />
            )
          ) : (
            <p className="hint">No transfer history records match the current filters.</p>
          )}
        </div>
        <div className="modal__actions retry-center__actions">
          <button
            className="secondary-button"
            disabled={entries.length === 0}
            onClick={onSelectAllVisible}
            type="button"
          >
            Select Visible
          </button>
          <button
            className="secondary-button"
            disabled={selectedCount === 0}
            onClick={onClearSelection}
            type="button"
          >
            Clear Selection
          </button>
          <button
            className="secondary-button"
            disabled={entries.length === 0}
            onClick={onExportVisibleHistoryJson}
            type="button"
          >
            Export Visible JSON
          </button>
          <button
            className="secondary-button"
            disabled={entries.length === 0}
            onClick={onExportVisibleHistoryCsv}
            type="button"
          >
            Export Visible CSV
          </button>
          <button
            className="secondary-button"
            disabled={!canExportAnalytics}
            onClick={onExportAnalyticsJson}
            type="button"
          >
            Export Analytics JSON
          </button>
          <button
            className="secondary-button"
            disabled={!canExportAnalytics}
            onClick={onExportAnalyticsCsv}
            type="button"
          >
            Export Analytics CSV
          </button>
          <button
            className="secondary-button"
            disabled={!canRetryFailedUploads}
            onClick={onRetryFailedUploads}
            title="Retry failed upload candidates for the active tab/session"
            type="button"
          >
            Retry Failed Uploads ({failedUploadCandidateCount})
          </button>
          <button
            className="secondary-button"
            disabled={!canRetryFailedDownloads}
            onClick={onRetryFailedDownloads}
            title="Retry failed download candidates for the active tab/session"
            type="button"
          >
            Retry Failed Downloads ({failedDownloadCandidateCount})
          </button>
          <button
            className="secondary-button"
            disabled={!canRetryAllFailedTransfers}
            onClick={onRetryAllFailedTransfers}
            title="Retry all failed upload/download candidates with retry-scope strategy"
            type="button"
          >
            Retry All Failed ({failedRetryCandidateTotal})
          </button>
          <button
            className="secondary-button"
            disabled={!canRetryVisibleEntries}
            onClick={onRetryVisibleEntries}
            title="Retry visible failed records with scope selection"
            type="button"
          >
            Retry Visible Failed
          </button>
          <button
            className="secondary-button"
            disabled={!canRetrySelectedEntries}
            onClick={onRetrySelectedEntries}
            title="Retry selected failed records with scope selection"
            type="button"
          >
            Retry Selected Failed
          </button>
          <button
            className="secondary-button"
            disabled={!canClearSelectedEntries}
            onClick={onClearSelectedEntries}
            type="button"
          >
            Delete Selected
          </button>
          <button
            className="secondary-button"
            disabled={!canClearVisibleEntries}
            onClick={onClearVisibleEntries}
            type="button"
          >
            Delete Visible
          </button>
          <button
            className="secondary-button"
            disabled={!canClearAllEntries}
            onClick={onClearAllEntries}
            type="button"
          >
            Delete All
          </button>
          <button className="primary-button" onClick={onClose} type="button">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function CommandHistoryManagerModal({
  open,
  onClose,
  visibleCount,
  selectedCount,
  totalCount,
  entries,
  onAdd,
  onImport,
  onExport,
  canExport,
  canToggleSelectVisible,
  allVisibleSelected,
  onToggleSelectVisible,
  canClearSelection,
  onClearSelection,
  onPasteEntry,
  onToggleEntrySelection,
  onEditEntry,
  onDeleteSelected,
  onDeleteVisible,
  onDeleteAll
}: CommandHistoryManagerModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-label="Command History Manager"
        aria-modal="true"
        className="modal modal--command-history-manager"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal__header">
          <h3>Command History Manager</h3>
          <button className="icon-button" onClick={onClose} type="button">
            <UiIcon name="close" />
          </button>
        </div>
        <p className="hint">Batch manage command records from current filter result.</p>
        <p className="hint command-history-manager__summary">
          Visible {visibleCount} | Selected {selectedCount} | Total {totalCount}
        </p>
        <div className="command-history-manager__toolbar">
          <button className="secondary-button secondary-button--small" onClick={onAdd} type="button">
            Add
          </button>
          <button className="secondary-button secondary-button--small" onClick={onImport} type="button">
            Import
          </button>
          <button
            className="secondary-button secondary-button--small"
            disabled={!canExport}
            onClick={onExport}
            type="button"
          >
            Export
          </button>
          <button
            className="secondary-button secondary-button--small"
            disabled={!canToggleSelectVisible}
            onClick={onToggleSelectVisible}
            type="button"
          >
            {allVisibleSelected ? "Unselect Visible" : "Select Visible"}
          </button>
          <button
            className="secondary-button secondary-button--small"
            disabled={!canClearSelection}
            onClick={onClearSelection}
            type="button"
          >
            Clear Selection
          </button>
        </div>
        <div className="command-history-manager__list-shell">
          {entries.length === 0 ? (
            <p className="hint command-history-manager__empty">No command history entries.</p>
          ) : (
            <ul className="command-history-manager__list">
              {entries.map((entry) => (
                <li className="command-history-manager__item" key={entry.id}>
                  <div
                    className="command-history-manager__row"
                    onDoubleClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest("button, input")) {
                        return;
                      }
                      onPasteEntry(entry.id);
                    }}
                    title={entry.title}
                  >
                    <label className="command-history-manager__checkbox">
                      <input
                        checked={entry.selected}
                        onChange={() => onToggleEntrySelection(entry.id)}
                        type="checkbox"
                      />
                      <span className="command-history-manager__command">
                        <code>{entry.command}</code>
                      </span>
                    </label>
                    <button
                      className="secondary-button secondary-button--small command-history-manager__edit"
                      onClick={() => onEditEntry(entry.id)}
                      type="button"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="hint command-history-manager__meta">{entry.metaLabel}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="modal__actions">
          <button
            className="secondary-button"
            disabled={selectedCount === 0}
            onClick={onDeleteSelected}
            type="button"
          >
            Delete Selected ({selectedCount})
          </button>
          <button
            className="secondary-button"
            disabled={visibleCount === 0}
            onClick={onDeleteVisible}
            type="button"
          >
            Delete Visible ({visibleCount})
          </button>
          <button
            className="secondary-button"
            disabled={totalCount === 0}
            onClick={onDeleteAll}
            type="button"
          >
            Delete All ({totalCount})
          </button>
          <button className="primary-button" onClick={onClose} type="button">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function RetryCenterEntriesList({
  entries,
  selectionSet,
  onToggleEntrySelection,
  formatHistoryTimestamp
}: {
  entries: RetryCenterEntryView[];
  selectionSet: Set<string>;
  onToggleEntrySelection: (entryKey: string) => void;
  formatHistoryTimestamp: (timestamp: number) => string;
}) {
  return (
    <ul className="retry-center__list">
      {entries.map((entry) => {
        const selected = selectionSet.has(entry.key);
        return (
          <li className={selected ? "retry-center__item is-selected" : "retry-center__item"} key={entry.key}>
            <label className="retry-center__checkbox">
              <input
                checked={selected}
                onChange={() => onToggleEntrySelection(entry.key)}
                type="checkbox"
              />
            </label>
            <span className={`retry-center__status retry-center__status--${entry.status}`}>
              {entry.status}
            </span>
            <div className="retry-center__body">
              <p className="retry-center__name">{entry.name}</p>
              <p className="retry-center__path" title={`${entry.localPath} -> ${entry.remotePath}`}>
                {`${entry.localPath} -> ${entry.remotePath}`}
              </p>
              <p className="retry-center__meta">
                {formatHistoryTimestamp(entry.updatedAt)} | {entry.direction} | attempts {entry.attemptCount}
                {entry.message ? ` | ${entry.message}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
