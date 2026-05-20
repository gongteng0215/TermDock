import type {
  CommandHistoryManagerLabels,
  OperationCenterLabels,
  RetryCenterLabels
} from "../i18n";
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

export interface OperationCenterModalProps {
  open: boolean;
  labels: OperationCenterLabels;
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

export interface CommandHistoryManagerModalProps {
  open: boolean;
  labels: CommandHistoryManagerLabels;
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

export interface RetryCenterModalProps {
  open: boolean;
  labels: RetryCenterLabels;
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
  labels,
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

  const disconnectedTransferTabCount = transferTabSummaries.filter((entry) => !entry.connected).length;

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-label={labels.title}
        aria-modal="true"
        className="modal modal--operation-center"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal__header">
          <h3>{labels.title}</h3>
          <button className="icon-button" onClick={onClose} type="button">
            <UiIcon name="close" />
          </button>
        </div>
        <p className="hint">{labels.description}</p>
        <div className="operation-center__grid">
          <article className="operation-center__card operation-center__card--wide">
            <div className="operation-center__card-header">
              <p className="operation-center__title">{labels.groupedControls}</p>
              <span
                className={
                  hasActivity || canRetryAllFailedTransfers
                    ? "operation-center__state is-active"
                    : "operation-center__state is-idle"
                }
              >
                {hasActivity || canRetryAllFailedTransfers ? labels.ready : labels.idle}
              </span>
            </div>
            <div className="operation-center__control-groups">
              <section className="operation-center__control-group">
                <p className="operation-center__control-title">{labels.transfers}</p>
                <p className="operation-center__meta">
                  {labels.transfersMeta(transferTabSummaries.length, failedRetryCandidateTotal)}
                </p>
                <div className="operation-center__actions">
                  <button
                    className="secondary-button secondary-button--small"
                    disabled={!canRetryAllFailedTransfers}
                    onClick={onRetryAllFailedTransfers}
                    type="button"
                  >
                    {labels.retryAllFailed}
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    disabled={transferTabSummaries.length === 0 || isBulkCancelingTabs}
                    onClick={onCancelAllTransfersAcrossTabs}
                    type="button"
                  >
                    {isBulkCancelingTabs ? labels.canceling : labels.cancelAllActive}
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    disabled={disconnectedTransferTabCount === 0 || isReconnectingTabs}
                    onClick={onReconnectDisconnectedTabs}
                    type="button"
                  >
                    {isReconnectingTabs ? labels.reconnecting : labels.reconnectDisconnected}
                  </button>
                </div>
              </section>
              <section className="operation-center__control-group">
                <p className="operation-center__control-title">{labels.activeTab}</p>
                <p className="operation-center__meta">
                  {labels.activeTabMeta(uploadSummary.failed, downloadSummary.failed)}
                </p>
                <div className="operation-center__actions">
                  <button
                    className="secondary-button secondary-button--small"
                    disabled={!hasActiveTab}
                    onClick={onCancelActiveUploads}
                    type="button"
                  >
                    {labels.cancelUploads}
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    disabled={!hasActiveTab}
                    onClick={onCancelActiveDownloads}
                    type="button"
                  >
                    {labels.cancelDownloads}
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    disabled={!canRetryFailedUploads}
                    onClick={onRetryActiveUploads}
                    type="button"
                  >
                    {labels.retryUploads}
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    disabled={!canRetryFailedDownloads}
                    onClick={onRetryActiveDownloads}
                    type="button"
                  >
                    {labels.retryDownloads}
                  </button>
                </div>
              </section>
              <section className="operation-center__control-group">
                <p className="operation-center__control-title">{labels.tools}</p>
                <p className="operation-center__meta">
                  {labels.toolsMeta(portForwardSummary.total, recentAppJobs.length)}
                </p>
                <div className="operation-center__actions">
                  <button
                    className="secondary-button secondary-button--small"
                    onClick={onOpenPortForward}
                    type="button"
                  >
                    {labels.portFwd}
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    onClick={onOpenDiagnostics}
                    type="button"
                  >
                    {labels.diagnostics}
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    disabled={finishedAppJobCount === 0}
                    onClick={onClearFinishedAppJobs}
                    type="button"
                  >
                    {labels.clearJobs}
                  </button>
                </div>
              </section>
            </div>
          </article>

          <article className="operation-center__card">
            <div className="operation-center__card-header">
              <p className="operation-center__title">{labels.uploadQueue}</p>
              <span
                className={
                  uploadSummary.running + uploadSummary.queued > 0
                    ? "operation-center__state is-active"
                    : "operation-center__state is-idle"
                }
              >
                {uploadSummary.running + uploadSummary.queued > 0 ? labels.active : labels.idle}
              </span>
            </div>
            <p className="operation-center__meta">
              {labels.queueMeta(uploadSummary.activeTabCount, uploadSummary.running, uploadSummary.queued)}
            </p>
            <p className="operation-center__meta">
              {labels.progressMeta(
                uploadSummary.completed,
                uploadSummary.total,
                uploadSummary.failed,
                uploadSummary.canceled
              )}
            </p>
            <div className="operation-center__actions">
              <button
                className="secondary-button secondary-button--small"
                disabled={!hasActiveTab}
                onClick={onCancelActiveUploads}
                type="button"
              >
                {labels.cancelActiveTab}
              </button>
              <button
                className="secondary-button secondary-button--small"
                disabled={!canRetryFailedUploads}
                onClick={onRetryActiveUploads}
                type="button"
              >
                {labels.retryActiveTab}
              </button>
            </div>
          </article>

          <article className="operation-center__card">
            <div className="operation-center__card-header">
              <p className="operation-center__title">{labels.downloadQueue}</p>
              <span
                className={
                  downloadSummary.running + downloadSummary.queued > 0
                    ? "operation-center__state is-active"
                    : "operation-center__state is-idle"
                }
              >
                {downloadSummary.running + downloadSummary.queued > 0 ? labels.active : labels.idle}
              </span>
            </div>
            <p className="operation-center__meta">
              {labels.queueMeta(
                downloadSummary.activeTabCount,
                downloadSummary.running,
                downloadSummary.queued
              )}
            </p>
            <p className="operation-center__meta">
              {labels.progressMeta(
                downloadSummary.completed,
                downloadSummary.total,
                downloadSummary.failed,
                downloadSummary.canceled
              )}
            </p>
            <div className="operation-center__actions">
              <button
                className="secondary-button secondary-button--small"
                disabled={!hasActiveTab}
                onClick={onCancelActiveDownloads}
                type="button"
              >
                {labels.cancelActiveTab}
              </button>
              <button
                className="secondary-button secondary-button--small"
                disabled={!canRetryFailedDownloads}
                onClick={onRetryActiveDownloads}
                type="button"
              >
                {labels.retryActiveTab}
              </button>
            </div>
          </article>

          <article className="operation-center__card">
            <div className="operation-center__card-header">
              <p className="operation-center__title">{labels.remoteDelete}</p>
              <span
                className={
                  deleteProgressLabel
                    ? "operation-center__state is-active"
                    : "operation-center__state is-idle"
                }
              >
                {deleteProgressLabel ? labels.running : labels.idle}
              </span>
            </div>
            {deleteProgressLabel ? (
              <p className="operation-center__meta operation-center__meta--wrap">
                {deleteProgressLabel}
              </p>
            ) : (
              <p className="operation-center__meta">{labels.noActiveDelete}</p>
            )}
            <p className="operation-center__meta operation-center__meta--muted">
              {labels.deleteCancellationUnavailable}
            </p>
          </article>

          <article className="operation-center__card">
            <div className="operation-center__card-header">
              <p className="operation-center__title">{labels.portForwardingOps}</p>
              <span
                className={
                  portForwardBusy
                    ? "operation-center__state is-active"
                    : "operation-center__state is-idle"
                }
              >
                {portForwardBusy ? labels.working : labels.idle}
              </span>
            </div>
            <p className="operation-center__meta">
              {labels.portForwardMeta(
                portForwardSummary.activeTabCount,
                portForwardSummary.total,
                portForwardSummary.degraded
              )}
            </p>
            <p className="operation-center__meta">
              {labels.activeTabStatus(portForwardSummary.activeTabStatus?.trim() || labels.noRecentStatus)}
            </p>
            <div className="operation-center__actions">
              <button
                className="secondary-button secondary-button--small"
                onClick={onOpenPortForward}
                type="button"
              >
                {labels.openPortFwd}
              </button>
              <button
                className="secondary-button secondary-button--small"
                onClick={onOpenDiagnostics}
                type="button"
              >
                {labels.openDiagnostics}
              </button>
            </div>
          </article>

          <article className="operation-center__card operation-center__card--wide">
            <div className="operation-center__card-header">
              <p className="operation-center__title">{labels.activityTimeline}</p>
              <span
                className={
                  timelineItems.length > 0
                    ? "operation-center__state is-active"
                    : "operation-center__state is-idle"
                }
              >
                {timelineItems.length > 0 ? labels.itemCount(timelineItems.length) : labels.idle}
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
                {labels.noActivityTimeline}
              </p>
            )}
          </article>

          <article className="operation-center__card operation-center__card--wide">
            <div className="operation-center__card-header">
              <p className="operation-center__title">{labels.trackedAppJobs}</p>
              <span
                className={
                  runningAppJobCount > 0
                    ? "operation-center__state is-active"
                    : recentAppJobs.length > 0
                      ? "operation-center__state is-success"
                      : "operation-center__state is-idle"
                }
              >
                {labels.appJobState(runningAppJobCount, recentAppJobs.length)}
              </span>
            </div>
            {recentAppJobs.length > 0 ? (
              <ul className="operation-center__tab-list">
                {recentAppJobs.map((job) => (
                  <li className="operation-center__tab-item" key={job.id}>
                    <div className="operation-center__tab-main">
                      <p className="operation-center__tab-title">{job.title}</p>
                      <p className="operation-center__meta">
                        {labels.appJobMeta(job.categoryLabel, job.startedAtLabel, job.durationLabel)}
                      </p>
                      <p className="operation-center__meta operation-center__meta--wrap">{job.detail}</p>
                      {job.outputPath ? (
                        <p className="operation-center__meta operation-center__meta--wrap">
                          {labels.outputPath(job.outputPath)}
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
                          {labels.copyPath}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="operation-center__meta">{labels.noTrackedAppJobs}</p>
            )}
            <div className="operation-center__actions">
              <button
                className="secondary-button secondary-button--small"
                disabled={finishedAppJobCount === 0}
                onClick={onClearFinishedAppJobs}
                type="button"
              >
                {labels.clearFinished}
              </button>
              <button
                className="secondary-button secondary-button--small"
                disabled={!hasSnippetJobs}
                onClick={onOpenSnippets}
                type="button"
              >
                {labels.openSnippets}
              </button>
              <button
                className="secondary-button secondary-button--small"
                disabled={!hasDiagnosticsJobs}
                onClick={onOpenDiagnosticsJobs}
                type="button"
              >
                {labels.openDiagnostics}
              </button>
            </div>
          </article>

          <article className="operation-center__card operation-center__card--wide">
            <div className="operation-center__card-header">
              <p className="operation-center__title">{labels.allTabsTransferActivity}</p>
              <span
                className={
                  transferTabSummaries.length > 0
                    ? "operation-center__state is-active"
                    : "operation-center__state is-idle"
                }
              >
                {transferTabSummaries.length > 0 ? labels.tabCount(transferTabSummaries.length) : labels.idle}
              </span>
            </div>
            {transferTabSummaries.length > 0 ? (
              <ul className="operation-center__tab-list">
                {transferTabSummaries.map((summary) => (
                  <li className="operation-center__tab-item" key={summary.tabId}>
                    <div className="operation-center__tab-main">
                      <p className="operation-center__tab-title">{summary.title}</p>
                      <p className="operation-center__meta">
                        {labels.transferTabMeta(
                          summary.uploadRunning,
                          summary.uploadQueued,
                          summary.downloadRunning,
                          summary.downloadQueued,
                          summary.totalActive
                        )}
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
                        {summary.connected ? labels.connected : labels.disconnected}
                      </span>
                      <button
                        className="secondary-button secondary-button--small"
                        onClick={() => onFocusTab(summary.tabId)}
                        type="button"
                      >
                        {labels.focusTab}
                      </button>
                      <button
                        className="secondary-button secondary-button--small"
                        disabled={summary.connected || isReconnectingTabs}
                        onClick={() => onReconnectTab(summary.tabId)}
                        type="button"
                      >
                        {labels.reconnectTab}
                      </button>
                      <button
                        className="secondary-button secondary-button--small"
                        disabled={isBulkCancelingTabs}
                        onClick={() => onCancelTabTasks(summary.tabId)}
                        type="button"
                      >
                        {labels.cancelTabTasks}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="operation-center__meta">{labels.noTransferActivity}</p>
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
                {isReconnectingTabs ? labels.reconnecting : labels.reconnectDisconnectedTabs}
              </button>
              <button
                className="secondary-button secondary-button--small"
                disabled={transferTabSummaries.length === 0 || isBulkCancelingTabs}
                onClick={onCancelAllTransfersAcrossTabs}
                type="button"
              >
                {isBulkCancelingTabs ? labels.canceling : labels.cancelAllTransfersAllTabs}
              </button>
            </div>
          </article>
        </div>
        {!hasActivity ? (
          <p className="hint operation-center__idle-note">
            {labels.noHighLatencyActivity}
          </p>
        ) : null}
        <div className="modal__actions">
          <button
            className="secondary-button"
            disabled={!canRetryAllFailedTransfers}
            onClick={onRetryAllFailedTransfers}
            title={labels.retryAllFailedTitle}
            type="button"
          >
            {labels.retryAllFailedWithCount(failedRetryCandidateTotal)}
          </button>
          <button className="primary-button" onClick={onClose} type="button">
            {labels.done}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RetryCenterModal({
  open,
  labels,
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
        aria-label={labels.title}
        aria-modal="true"
        className="modal modal--retry-center"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal__header">
          <h3>{labels.title}</h3>
          <button className="icon-button" onClick={onClose} type="button">
            <UiIcon name="close" />
          </button>
        </div>
        <p className="hint">{labels.description}</p>
        <div className="retry-center__filters">
          <label>
            {labels.scope}
            <select onChange={(event) => onScopeChange(event.target.value as TransferHistoryScope)} value={scope}>
              <option value="activeSession">{labels.activeSession}</option>
              <option value="allSessions">{labels.allSessions}</option>
            </select>
          </label>
          <label>
            {labels.direction}
            <select
              onChange={(event) => onDirectionChange(event.target.value as TransferHistoryDirectionFilter)}
              value={direction}
            >
              <option value="all">{labels.all}</option>
              <option value="upload">{labels.upload}</option>
              <option value="download">{labels.download}</option>
            </select>
          </label>
          <label>
            {labels.status}
            <select onChange={(event) => onStatusChange(event.target.value as TransferHistoryStatusFilter)} value={status}>
              <option value="all">{labels.all}</option>
              <option value="failed">{labels.failed}</option>
              <option value="completed">{labels.completed}</option>
              <option value="canceled">{labels.canceled}</option>
              <option value="queued">{labels.queued}</option>
              <option value="running">{labels.running}</option>
            </select>
          </label>
          <label>
            {labels.timeRange}
            <select onChange={(event) => onTimeRangeChange(event.target.value as TransferHistoryTimeRange)} value={timeRange}>
              <option value="all">{labels.all}</option>
              <option value="5m">{labels.last5m}</option>
              <option value="30m">{labels.last30m}</option>
              <option value="1h">{labels.last1h}</option>
              <option value="24h">{labels.last24h}</option>
            </select>
          </label>
          <label>
            {labels.view}
            <select onChange={(event) => onListModeChange(event.target.value as RetryCenterListMode)} value={listMode}>
              <option value="flat">{labels.flatList}</option>
              <option value="groupedByReason">{labels.groupedByFailure}</option>
            </select>
          </label>
          <label>
            {labels.failureReason}
            <select onChange={(event) => onFailureReasonFilterChange(event.target.value)} value={failureReasonFilter}>
              <option value={failureReasonAllValue}>
                {labels.allFailureReasons(failureReasonOptions.reduce((total, entry) => total + entry.total, 0))}
              </option>
              {failureReasonOptions.map((entry) => (
                <option key={entry.reason} value={entry.reason}>
                  {`${entry.reason} (${entry.total})`}
                </option>
              ))}
            </select>
          </label>
          <label>
            {labels.defaultRetryScope}
            <select
              onChange={(event) => onLastRetryScopeChange(event.target.value as RetryCenterRetryScope)}
              value={lastRetryScope}
            >
              <option value="all">{labels.allRetryable}</option>
              <option value="upload">{labels.uploadOnly}</option>
              <option value="download">{labels.downloadOnly}</option>
            </select>
          </label>
          <label>
            {labels.retryConfirmThreshold}
            <input
              max={maxRetryBatchConfirmThreshold}
              min={minRetryBatchConfirmThreshold}
              onChange={(event) => onRetryBatchConfirmThresholdChange(Number(event.target.value))}
              type="number"
              value={retryBatchConfirmThreshold}
            />
          </label>
          <p className="hint">
            {labels.largeBatchHint}
          </p>
          <label className="retry-center__search">
            {labels.search}
            <input
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={labels.searchPlaceholder}
              value={query}
            />
          </label>
          <button
            className="secondary-button secondary-button--small retry-center__filter-reset"
            disabled={!hasCustomizedView}
            onClick={onResetFilters}
            type="button"
          >
            {labels.resetFilters}
          </button>
          <button
            aria-pressed={autoUseLastRetryScope}
            className="secondary-button secondary-button--small retry-center__filter-reset"
            onClick={onToggleAutoUseLastRetryScope}
            title={labels.autoRetryScopeTitle}
            type="button"
          >
            {autoUseLastRetryScope ? labels.autoRetryScopeOn : labels.autoRetryScopeOff}
          </button>
        </div>
        <p className="hint retry-center__summary">
          {labels.summary({
            entryCount,
            totalHistoryCount,
            selectedCount,
            selectedFailedCount,
            visibleFailedCount,
            failedUploadCandidateCount,
            failedDownloadCandidateCount,
            selectedFailureReasonLabel,
            lastRetryScopeLabel,
            autoUseLastRetryScope,
            retryBatchConfirmThreshold,
            isGroupedView,
            groupCount: groupedEntries.length,
            collapsedGroupCount: collapsedGroupKeySet.size
          })}
        </p>
        <div className="retry-center__analytics">
          <article className="retry-center__metric">
            <p className="retry-center__metric-label">{labels.failureRatio}</p>
            <p className="retry-center__metric-value">{formatPercent(analytics.failedRatioPercent)}</p>
            <p className="retry-center__metric-meta">
              {labels.failedRatio(analytics.failedCount, analytics.totalCount)}
            </p>
          </article>
          <article className="retry-center__metric">
            <p className="retry-center__metric-label">{labels.directionBreakdown}</p>
            <p className="retry-center__metric-value">
              U {analytics.directionCounts.upload} | D {analytics.directionCounts.download}
            </p>
            <p className="retry-center__metric-meta">
              {labels.statusBreakdown(
                analytics.statusCounts.completed,
                analytics.statusCounts.failed,
                analytics.statusCounts.canceled
              )}
            </p>
          </article>
          <article className="retry-center__metric">
            <p className="retry-center__metric-label">{labels.topSessionsGroups}</p>
            <p className="retry-center__metric-meta">
              {analytics.topSessions.length > 0
                ? analytics.topSessions.map((entry) => `${entry.sessionName} (${entry.total})`).join(" | ")
                : labels.noVisibleRecords}
            </p>
            <p className="retry-center__metric-meta">
              {analytics.topGroups.length > 0
                ? analytics.topGroups.map((entry) => `${entry.groupName} (${entry.total})`).join(" | ")
                : labels.noGroupData}
            </p>
          </article>
          <article className="retry-center__metric">
            <p className="retry-center__metric-label">{labels.topFailureReasons}</p>
            <p className="retry-center__metric-meta retry-center__metric-meta--wrap">
              {analytics.topFailureReasons.length > 0
                ? analytics.topFailureReasons.map((entry) => `${entry.reason} (${entry.total})`).join(" | ")
                : labels.noFailedRecords}
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
                      title={labels.filterByFailureReasonTitle(entry.reason)}
                      type="button"
                    >
                      {`${entry.reason} (${entry.totalVisible})`}
                    </button>
                    <button
                      className="secondary-button secondary-button--small"
                      disabled={!hasActiveTab || entry.activeSessionVisibleFailed <= 0}
                      onClick={() => onRetryVisibleFailureReason(entry.reason)}
                      title={labels.retryFailureReasonTitle(entry.reason)}
                      type="button"
                    >
                      {labels.retryWithCount(entry.activeSessionVisibleFailed)}
                    </button>
                    <button
                      className="secondary-button secondary-button--small"
                      disabled={entry.totalVisible <= 0}
                      onClick={() => onClearVisibleFailureReason(entry.reason)}
                      title={labels.deleteFailureReasonTitle(entry.reason)}
                      type="button"
                    >
                      {labels.deleteWithCount(entry.totalVisible)}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="retry-center__metric-meta">
              {labels.failureReasonHelp}
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
              {labels.expandAllGroups}
            </button>
            <button
              className="secondary-button secondary-button--small"
              disabled={!canCollapseAllGroups}
              onClick={onCollapseAllGroups}
              type="button"
            >
              {labels.collapseAllGroups}
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
                          aria-label={collapsed ? labels.expandGroup : labels.collapseGroup}
                          className="secondary-button secondary-button--small"
                          onClick={() => onToggleGroupCollapsed(group.key)}
                          type="button"
                        >
                          {collapsed ? labels.expand : labels.collapse}
                        </button>
                        <div className="retry-center__group-info">
                          <p className="retry-center__group-title" title={group.label}>
                            {group.label}
                          </p>
                          <p className="retry-center__group-meta">
                            {labels.groupMeta(
                              group.total,
                              group.failedCount,
                              group.activeSessionFailedCount
                            )}
                          </p>
                        </div>
                        <div className="retry-center__group-header-actions">
                          <button
                            className="secondary-button secondary-button--small"
                            onClick={() => onSelectGroupEntries(group.key)}
                            type="button"
                          >
                            {labels.selectWithCount(group.total)}
                          </button>
                          <button
                            className="secondary-button secondary-button--small"
                            disabled={!hasActiveTab || group.activeSessionFailedCount <= 0}
                            onClick={() => onRetryGroupFailedEntries(group.key)}
                            title={labels.retryGroupFailedTitle}
                            type="button"
                          >
                            {labels.retryFailedWithCount(group.activeSessionFailedCount)}
                          </button>
                          <button
                            className="secondary-button secondary-button--small"
                            onClick={() => onClearGroupEntries(group.key)}
                            type="button"
                          >
                            {labels.deleteCount(group.total)}
                          </button>
                          <button
                            className="secondary-button secondary-button--small"
                            onClick={() => onExportGroupHistoryJson(group.key)}
                            type="button"
                          >
                            {labels.exportJson}
                          </button>
                          <button
                            className="secondary-button secondary-button--small"
                            onClick={() => onExportGroupHistoryCsv(group.key)}
                            type="button"
                          >
                            {labels.exportCsv}
                          </button>
                        </div>
                      </div>
                      {collapsed ? null : (
                        <RetryCenterEntriesList
                          entries={group.entries}
                          formatHistoryTimestamp={formatHistoryTimestamp}
                          labels={labels}
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
                labels={labels}
                onToggleEntrySelection={onToggleEntrySelection}
                selectionSet={selectionSet}
              />
            )
          ) : (
            <p className="hint">{labels.noHistoryMatches}</p>
          )}
        </div>
        <div className="modal__actions retry-center__actions">
          <button
            className="secondary-button"
            disabled={entries.length === 0}
            onClick={onSelectAllVisible}
            type="button"
          >
            {labels.selectVisible}
          </button>
          <button
            className="secondary-button"
            disabled={selectedCount === 0}
            onClick={onClearSelection}
            type="button"
          >
            {labels.clearSelection}
          </button>
          <button
            className="secondary-button"
            disabled={entries.length === 0}
            onClick={onExportVisibleHistoryJson}
            type="button"
          >
            {labels.exportVisibleJson}
          </button>
          <button
            className="secondary-button"
            disabled={entries.length === 0}
            onClick={onExportVisibleHistoryCsv}
            type="button"
          >
            {labels.exportVisibleCsv}
          </button>
          <button
            className="secondary-button"
            disabled={!canExportAnalytics}
            onClick={onExportAnalyticsJson}
            type="button"
          >
            {labels.exportAnalyticsJson}
          </button>
          <button
            className="secondary-button"
            disabled={!canExportAnalytics}
            onClick={onExportAnalyticsCsv}
            type="button"
          >
            {labels.exportAnalyticsCsv}
          </button>
          <button
            className="secondary-button"
            disabled={!canRetryFailedUploads}
            onClick={onRetryFailedUploads}
            title={labels.retryFailedUploadsTitle}
            type="button"
          >
            {labels.retryFailedUploads(failedUploadCandidateCount)}
          </button>
          <button
            className="secondary-button"
            disabled={!canRetryFailedDownloads}
            onClick={onRetryFailedDownloads}
            title={labels.retryFailedDownloadsTitle}
            type="button"
          >
            {labels.retryFailedDownloads(failedDownloadCandidateCount)}
          </button>
          <button
            className="secondary-button"
            disabled={!canRetryAllFailedTransfers}
            onClick={onRetryAllFailedTransfers}
            title={labels.retryAllFailedTitle}
            type="button"
          >
            {labels.retryAllFailed(failedRetryCandidateTotal)}
          </button>
          <button
            className="secondary-button"
            disabled={!canRetryVisibleEntries}
            onClick={onRetryVisibleEntries}
            title={labels.retryVisibleFailedTitle}
            type="button"
          >
            {labels.retryVisibleFailed}
          </button>
          <button
            className="secondary-button"
            disabled={!canRetrySelectedEntries}
            onClick={onRetrySelectedEntries}
            title={labels.retrySelectedFailedTitle}
            type="button"
          >
            {labels.retrySelectedFailed}
          </button>
          <button
            className="secondary-button"
            disabled={!canClearSelectedEntries}
            onClick={onClearSelectedEntries}
            type="button"
          >
            {labels.deleteSelected}
          </button>
          <button
            className="secondary-button"
            disabled={!canClearVisibleEntries}
            onClick={onClearVisibleEntries}
            type="button"
          >
            {labels.deleteVisible}
          </button>
          <button
            className="secondary-button"
            disabled={!canClearAllEntries}
            onClick={onClearAllEntries}
            type="button"
          >
            {labels.deleteAll}
          </button>
          <button className="primary-button" onClick={onClose} type="button">
            {labels.done}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CommandHistoryManagerModal({
  open,
  labels,
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
        aria-label={labels.title}
        aria-modal="true"
        className="modal modal--command-history-manager"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal__header">
          <h3>{labels.title}</h3>
          <button className="icon-button" onClick={onClose} type="button">
            <UiIcon name="close" />
          </button>
        </div>
        <p className="hint">{labels.description}</p>
        <p className="hint command-history-manager__summary">
          {labels.summary(visibleCount, selectedCount, totalCount)}
        </p>
        <div className="command-history-manager__toolbar">
          <button className="secondary-button secondary-button--small" onClick={onAdd} type="button">
            {labels.add}
          </button>
          <button className="secondary-button secondary-button--small" onClick={onImport} type="button">
            {labels.import}
          </button>
          <button
            className="secondary-button secondary-button--small"
            disabled={!canExport}
            onClick={onExport}
            type="button"
          >
            {labels.export}
          </button>
          <button
            className="secondary-button secondary-button--small"
            disabled={!canToggleSelectVisible}
            onClick={onToggleSelectVisible}
            type="button"
          >
            {allVisibleSelected ? labels.unselectVisible : labels.selectVisible}
          </button>
          <button
            className="secondary-button secondary-button--small"
            disabled={!canClearSelection}
            onClick={onClearSelection}
            type="button"
          >
            {labels.clearSelection}
          </button>
        </div>
        <div className="command-history-manager__list-shell">
          {entries.length === 0 ? (
            <p className="hint command-history-manager__empty">{labels.empty}</p>
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
                      {labels.edit}
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
            {labels.deleteSelected(selectedCount)}
          </button>
          <button
            className="secondary-button"
            disabled={visibleCount === 0}
            onClick={onDeleteVisible}
            type="button"
          >
            {labels.deleteVisible(visibleCount)}
          </button>
          <button
            className="secondary-button"
            disabled={totalCount === 0}
            onClick={onDeleteAll}
            type="button"
          >
            {labels.deleteAll(totalCount)}
          </button>
          <button className="primary-button" onClick={onClose} type="button">
            {labels.done}
          </button>
        </div>
      </div>
    </div>
  );
}

function RetryCenterEntriesList({
  entries,
  labels,
  selectionSet,
  onToggleEntrySelection,
  formatHistoryTimestamp
}: {
  entries: RetryCenterEntryView[];
  labels: RetryCenterLabels;
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
              {labels.statusLabel(entry.status)}
            </span>
            <div className="retry-center__body">
              <p className="retry-center__name">{entry.name}</p>
              <p className="retry-center__path" title={`${entry.localPath} -> ${entry.remotePath}`}>
                {`${entry.localPath} -> ${entry.remotePath}`}
              </p>
              <p className="retry-center__meta">
                {labels.entryMeta(
                  formatHistoryTimestamp(entry.updatedAt),
                  labels.directionLabel(entry.direction),
                  entry.attemptCount,
                  entry.message
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
