import { useState, type ReactNode } from "react";

import type { AppLanguage, TransferDockLabels, WorkbenchTopbarLabels } from "../i18n";
import { beginWindowDrag } from "../window-drag";
import { translateAppText } from "../i18n";
import { UiIcon } from "./ui-icon";

interface WorkbenchTopbarProps {
  isMacPlatform: boolean;
  onOpenOperations: () => void;
  showAutoReconnect: boolean;
  autoReconnectLabel: string;
  labels: WorkbenchTopbarLabels;
  workspaceProfile: {
    id: string;
    shortLabel: string;
  } | null;
}

interface TransferDockNoticeView {
  level: "info" | "warn";
  message: string;
}

interface TransferDockItemView {
  transferId: string;
  direction: "upload" | "download";
  name: string;
  progressLabel: string;
  timeLabel?: string | null;
  status: string;
  canCancel: boolean;
  onCancel: () => void;
}

interface TransferDockPanelView {
  title: string;
  runningCount: number;
  queuedCount: number;
  activeCount: number;
  concurrencyStatus: string | null;
  retryFailedCount: number;
  retryFailedDisabled: boolean;
  onRetryFailed: () => void;
  clearFinishedDisabled: boolean;
  onClearFinished: () => void;
  cancelAllDisabled: boolean;
  onCancelAll: () => void;
  cancelAllLabel: string;
  cancelAllTitle: string;
  progressSummary: string;
  pauseMessage?: string | null;
  historyMessage?: string | null;
  transfers: TransferDockItemView[];
  emptyLabel: string;
}

export interface TransferDockProps {
  forceExpanded?: boolean;
  bindingLabel: string;
  labels: TransferDockLabels;
  notice: TransferDockNoticeView | null;
  pendingRestoreCount: number;
  onRestorePending: () => void;
  onDiscardPending: () => void;
  canRetryAllFailed: boolean;
  failedRetryCandidateTotal: number;
  onRetryAllFailed: () => void;
  onOpenRetryCenter: () => void;
  hasOperationCenterActivity: boolean;
  operationCenterActiveCount: number;
  onOpenOperationCenter: () => void;
  uploadPanel: TransferDockPanelView;
  downloadPanel: TransferDockPanelView;
}

interface AppInlineHintMessageView {
  level: "info" | "warn";
  message: string;
}

interface DangerousCommandApprovalView {
  severity: "warn" | "critical";
  sourceLabel: string;
  commandText: string;
  preview: string;
  contextSummary: string;
  ruleSummary: string;
  allowInGroup: boolean;
}

export interface AppInlineHintPanelProps {
  language: AppLanguage;
  approval: DangerousCommandApprovalView | null;
  hintMessage: AppInlineHintMessageView | null;
  onCancelApproval: () => void;
  onAllowInTab: () => void;
  onAllowInGroup: () => void;
  onSavePolicy: () => void;
  onRunOnce: () => void;
  onDismissHint: () => void;
  /** Tech/cockpit only — Default keeps the empty placeholder row. */
  hideWhenEmpty?: boolean;
}

interface WorkbenchLayoutProps {
  isEditorFocusMode: boolean;
  leftSidebar: ReactNode;
  centerPane: ReactNode;
  rightSidebar: ReactNode;
}

export function WorkbenchTopbar({
  isMacPlatform,
  onOpenOperations,
  showAutoReconnect,
  autoReconnectLabel,
  labels,
  workspaceProfile
}: WorkbenchTopbarProps) {
  // Windows used to rely on the native title bar, so this row was Mac-only.
  // The app window is now frameless (transparent Tech shell), so Default also
  // needs this strip — otherwise content runs under the overlay window controls.
  return (
    <header
      className={isMacPlatform ? "topbar topbar--mac" : "topbar topbar--windows"}
      onMouseDown={isMacPlatform ? undefined : beginWindowDrag}
    >
      <div className="topbar__brand">
        <strong>TermDock</strong>
        <span>{labels.subtitle}</span>
      </div>
      <div className="topbar__meta">
        <button className="secondary-button secondary-button--small topbar__operations-button" onClick={onOpenOperations} title="Open Operations Hub (Ctrl/Cmd+P)" type="button">Operations</button>
        {showAutoReconnect ? (
          <>
            <span className="topbar__meta-dot" />
            <span className="topbar__meta-label">{autoReconnectLabel}</span>
          </>
        ) : null}
        {workspaceProfile ? (
          <span className={`workspace-profile-badge workspace-profile-badge--${workspaceProfile.id}`}>
            {workspaceProfile.shortLabel}
          </span>
        ) : null}
      </div>
    </header>
  );
}

export function WorkbenchLayout({
  isEditorFocusMode,
  leftSidebar,
  centerPane,
  rightSidebar
}: WorkbenchLayoutProps) {
  return (
    <main className={isEditorFocusMode ? "layout is-terminal-editor-focus" : "layout"}>
      {leftSidebar}
      {centerPane}
      {rightSidebar}
    </main>
  );
}

export function TransferDock({
  forceExpanded = false,
  bindingLabel,
  labels,
  notice,
  pendingRestoreCount,
  onRestorePending,
  onDiscardPending,
  canRetryAllFailed,
  failedRetryCandidateTotal,
  onRetryAllFailed,
  onOpenRetryCenter,
  hasOperationCenterActivity,
  operationCenterActiveCount,
  onOpenOperationCenter,
  uploadPanel,
  downloadPanel
}: TransferDockProps) {
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false);
  const hasTransferActivity =
    uploadPanel.activeCount > 0 ||
    downloadPanel.activeCount > 0 ||
    Boolean(uploadPanel.pauseMessage || downloadPanel.pauseMessage) ||
    Boolean(uploadPanel.historyMessage || downloadPanel.historyMessage) ||
    pendingRestoreCount > 0 ||
    failedRetryCandidateTotal > 0 ||
    operationCenterActiveCount > 0 ||
    Boolean(notice);

  const canManuallyToggle = !forceExpanded && !hasTransferActivity;
  const isCompact = canManuallyToggle && !isManuallyExpanded;

  return (
    <section className={isCompact ? "transfer-dock transfer-dock--compact" : "transfer-dock"}>
      <div className="transfer-dock__heading">
        <h3>{labels.title}</h3>
        {canManuallyToggle ? (
          <button
            aria-expanded={!isCompact}
            className="secondary-button secondary-button--small transfer-dock__toggle"
            onClick={() => setIsManuallyExpanded((previous) => !previous)}
            type="button"
          >
            {isCompact ? "Show details" : "Hide details"}
          </button>
        ) : null}
        <div className="transfer-dock__heading-actions">
          <div className="transfer-dock__heading-meta">
            <span className="hint transfer-dock__binding">{bindingLabel}</span>
            <span
              className={
                notice
                  ? `hint transfer-dock__notice transfer-dock__notice--${notice.level}`
                  : "hint transfer-dock__notice transfer-dock__notice--placeholder"
              }
            >
              {notice?.message ?? "\u00A0"}
            </span>
          </div>
          <button
            className="secondary-button sftp-transfer-panel__clear transfer-dock__action-button"
            disabled={pendingRestoreCount === 0}
            onClick={onRestorePending}
            type="button"
          >
            {labels.restorePending} <span className="transfer-dock__count">({pendingRestoreCount})</span>
          </button>
          <button
            className="secondary-button sftp-transfer-panel__clear transfer-dock__action-button"
            disabled={pendingRestoreCount === 0}
            onClick={onDiscardPending}
            type="button"
          >
            {labels.discardPending}
          </button>
          <button
            className="secondary-button sftp-transfer-panel__clear transfer-dock__action-button"
            disabled={!canRetryAllFailed}
            onClick={onRetryAllFailed}
            title={labels.retryAllFailedTitle}
            type="button"
          >
            {labels.retryAllFailed} <span className="transfer-dock__count">({failedRetryCandidateTotal})</span>
          </button>
          <button
            className="secondary-button sftp-transfer-panel__clear transfer-dock__action-button"
            onClick={onOpenRetryCenter}
            type="button"
          >
            {labels.retryCenter}
          </button>
          <button
            className={
              hasOperationCenterActivity
                ? "secondary-button sftp-transfer-panel__clear transfer-dock__action-button operation-center__trigger is-active"
                : "secondary-button sftp-transfer-panel__clear transfer-dock__action-button operation-center__trigger"
            }
            onClick={onOpenOperationCenter}
            type="button"
          >
            {labels.operationCenter} <span className="transfer-dock__count">({operationCenterActiveCount})</span>
          </button>
        </div>
      </div>
      {!isCompact ? (
        <div className="transfer-dock__grid">
          <TransferDockPanel labels={labels} panel={uploadPanel} />
          <TransferDockPanel labels={labels} panel={downloadPanel} />
        </div>
      ) : null}
    </section>
  );
}

function TransferDockPanel({
  labels,
  panel
}: {
  labels: TransferDockLabels;
  panel: TransferDockPanelView;
}) {
  return (
    <section className="transfer-dock__panel">
      <div className="sftp-transfer-panel__header">
        <p className="hint sftp-transfer-panel__title">{panel.title}</p>
        <div className="sftp-transfer-panel__actions">
          <button
            className="secondary-button sftp-transfer-panel__clear"
            disabled={panel.retryFailedDisabled}
            onClick={panel.onRetryFailed}
            type="button"
          >
            {labels.retryFailed} ({panel.retryFailedCount})
          </button>
          <button
            className="secondary-button sftp-transfer-panel__clear"
            disabled={panel.clearFinishedDisabled}
            onClick={panel.onClearFinished}
            type="button"
          >
            {labels.clearFinished}
          </button>
          <button
            aria-label={panel.cancelAllLabel}
            className="icon-button icon-button--danger sftp-transfer-panel__bulk-cancel"
            disabled={panel.cancelAllDisabled}
            onClick={panel.onCancelAll}
            title={panel.cancelAllTitle}
            type="button"
          >
            <UiIcon name="close" />
          </button>
        </div>
      </div>
      <p className="hint sftp-transfer-panel__batch-progress">{panel.progressSummary}</p>
      {panel.concurrencyStatus ? (
        <p className="hint sftp-transfer-panel__concurrency-status">{panel.concurrencyStatus}</p>
      ) : null}
      {panel.pauseMessage ? (
        <p className="hint sftp-transfer-panel__batch-progress">{panel.pauseMessage}</p>
      ) : null}
      {panel.historyMessage ? (
        <p className="hint sftp-transfer-panel__batch-progress">{panel.historyMessage}</p>
      ) : null}
      {panel.transfers.length > 0 ? (
        <ul className="sftp-transfer-list transfer-dock__list">
          {panel.transfers.map((transfer) => (
            <li
              aria-label={
                transfer.timeLabel
                  ? `${transfer.name}, ${transfer.progressLabel}, ${transfer.timeLabel}`
                  : `${transfer.name}, ${transfer.progressLabel}`
              }
              className={`sftp-transfer sftp-transfer--${transfer.status}`}
              key={transfer.transferId}
              title={transfer.timeLabel ? `${transfer.name} — ${transfer.timeLabel}` : transfer.name}
            >
              <span className="sftp-transfer__icon">
                <UiIcon name={transfer.direction} />
              </span>
              <span className="sftp-transfer__meta">
                <span className="sftp-transfer__name">{transfer.name}</span>
                {transfer.timeLabel ? <span className="sftp-transfer__time">{transfer.timeLabel}</span> : null}
              </span>
              <span className="sftp-transfer__progress">{transfer.progressLabel}</span>
              {transfer.canCancel ? (
                <button
                  aria-label={labels.cancelTransfer(transfer.direction)}
                  className="icon-button sftp-transfer__cancel"
                  onClick={transfer.onCancel}
                  title={labels.cancelTransfer(transfer.direction)}
                  type="button"
                >
                  <UiIcon name="close" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint transfer-dock__empty">{panel.emptyLabel}</p>
      )}
    </section>
  );
}

export function AppInlineHintPanel({
  language,
  approval,
  hintMessage,
  onCancelApproval,
  onAllowInTab,
  onAllowInGroup,
  onSavePolicy,
  onRunOnce,
  onDismissHint,
  hideWhenEmpty = false
}: AppInlineHintPanelProps) {
  if (hideWhenEmpty && !approval && !hintMessage) {
    return null;
  }

  const textClassName = approval
    ? approval.severity === "critical"
      ? "app-inline-hint-panel__text is-warn"
      : "app-inline-hint-panel__text is-info"
    : hintMessage
      ? hintMessage.level === "warn"
        ? "app-inline-hint-panel__text is-warn"
        : "app-inline-hint-panel__text is-info"
      : "app-inline-hint-panel__text is-placeholder";

  const title = approval
    ? `${approval.sourceLabel}: ${approval.commandText}${
        approval.contextSummary ? ` | ${approval.contextSummary}` : ""
      }`
    : hintMessage?.message ?? "";

  const text = approval
    ? `${
        approval.severity === "critical"
          ? translateAppText(language, "Critical")
          : translateAppText(language, "Risk")
      }${translateAppText(language, " command from ")}${approval.sourceLabel}: ${approval.preview} | ${approval.contextSummary} | ${approval.ruleSummary}`
    : hintMessage?.message ?? "\u00A0";

  return (
    <section
      className={approval ? "app-inline-hint-panel is-actionable" : "app-inline-hint-panel"}
      aria-live={approval ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <p className={textClassName} title={title}>
        {text}
      </p>
      {approval ? (
        <div className="app-inline-hint-panel__actions">
          <button className="secondary-button secondary-button--small" onClick={onCancelApproval} type="button">
            {translateAppText(language, "Cancel")}
          </button>
          <button className="secondary-button secondary-button--small" onClick={onAllowInTab} type="button">
            {translateAppText(language, "Allow In Tab")}
          </button>
          {approval.allowInGroup ? (
            <button className="secondary-button secondary-button--small" onClick={onAllowInGroup} type="button">
              {translateAppText(language, "Allow In Group")}
            </button>
          ) : null}
          <button className="secondary-button secondary-button--small" onClick={onSavePolicy} type="button">
            {translateAppText(language, "Save Policy...")}
          </button>
          <button className="primary-button primary-button--small" onClick={onRunOnce} type="button">
            {translateAppText(language, "Run Once")}
          </button>
        </div>
      ) : hintMessage ? (
        <button className="icon-button app-inline-hint-panel__close" onClick={onDismissHint} type="button">
          <UiIcon name="close" />
        </button>
      ) : (
        <span className="app-inline-hint-panel__spacer" aria-hidden="true" />
      )}
    </section>
  );
}
