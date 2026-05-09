import type { ReactNode } from "react";

import { UiIcon } from "./ui-icon";

interface WorkbenchTopbarProps {
  isMacPlatform: boolean;
  autoReconnectLabel: string;
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
  status: string;
  canCancel: boolean;
  onCancel: () => void;
}

interface TransferDockPanelView {
  title: string;
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

interface TransferDockProps {
  bindingLabel: string;
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

interface AppInlineHintPanelProps {
  approval: DangerousCommandApprovalView | null;
  hintMessage: AppInlineHintMessageView | null;
  onCancelApproval: () => void;
  onAllowInTab: () => void;
  onAllowInGroup: () => void;
  onSavePolicy: () => void;
  onRunOnce: () => void;
  onDismissHint: () => void;
}

interface WorkbenchLayoutProps {
  isEditorFocusMode: boolean;
  leftSidebar: ReactNode;
  centerPane: ReactNode;
  rightSidebar: ReactNode;
}

export function WorkbenchTopbar({
  isMacPlatform,
  autoReconnectLabel,
  workspaceProfile
}: WorkbenchTopbarProps) {
  if (!isMacPlatform) {
    return null;
  }

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <strong>TermDock</strong>
        <span>SSH + SFTP Workbench</span>
      </div>
      <div className="topbar__meta">
        <span className="topbar__meta-dot" />
        <span className="topbar__meta-label">{autoReconnectLabel}</span>
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
  bindingLabel,
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
  return (
    <section className="transfer-dock">
      <div className="transfer-dock__heading">
        <h3>Transfers</h3>
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
            Restore Pending <span className="transfer-dock__count">({pendingRestoreCount})</span>
          </button>
          <button
            className="secondary-button sftp-transfer-panel__clear transfer-dock__action-button"
            disabled={pendingRestoreCount === 0}
            onClick={onDiscardPending}
            type="button"
          >
            Discard Pending
          </button>
          <button
            className="secondary-button sftp-transfer-panel__clear transfer-dock__action-button"
            disabled={!canRetryAllFailed}
            onClick={onRetryAllFailed}
            title="Retry all failed upload/download candidates with retry-scope strategy"
            type="button"
          >
            Retry All Failed <span className="transfer-dock__count">({failedRetryCandidateTotal})</span>
          </button>
          <button
            className="secondary-button sftp-transfer-panel__clear transfer-dock__action-button"
            onClick={onOpenRetryCenter}
            type="button"
          >
            Retry Center
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
            Operation Center <span className="transfer-dock__count">({operationCenterActiveCount})</span>
          </button>
        </div>
      </div>
      <div className="transfer-dock__grid">
        <TransferDockPanel panel={uploadPanel} />
        <TransferDockPanel panel={downloadPanel} />
      </div>
    </section>
  );
}

function TransferDockPanel({ panel }: { panel: TransferDockPanelView }) {
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
            Retry Failed ({panel.retryFailedCount})
          </button>
          <button
            className="secondary-button sftp-transfer-panel__clear"
            disabled={panel.clearFinishedDisabled}
            onClick={panel.onClearFinished}
            type="button"
          >
            Clear Finished
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
      {panel.pauseMessage ? (
        <p className="hint sftp-transfer-panel__batch-progress">{panel.pauseMessage}</p>
      ) : null}
      {panel.historyMessage ? (
        <p className="hint sftp-transfer-panel__batch-progress">{panel.historyMessage}</p>
      ) : null}
      {panel.transfers.length > 0 ? (
        <ul className="sftp-transfer-list transfer-dock__list">
          {panel.transfers.map((transfer) => (
            <li className={`sftp-transfer sftp-transfer--${transfer.status}`} key={transfer.transferId}>
              <span className="sftp-transfer__icon">
                <UiIcon name={transfer.direction} />
              </span>
              <span className="sftp-transfer__name">{transfer.name}</span>
              <span className="sftp-transfer__progress">{transfer.progressLabel}</span>
              {transfer.canCancel ? (
                <button
                  aria-label={`Cancel ${transfer.direction}`}
                  className="icon-button sftp-transfer__cancel"
                  onClick={transfer.onCancel}
                  title={`Cancel ${transfer.direction}`}
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
  approval,
  hintMessage,
  onCancelApproval,
  onAllowInTab,
  onAllowInGroup,
  onSavePolicy,
  onRunOnce,
  onDismissHint
}: AppInlineHintPanelProps) {
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
    ? `${approval.severity === "critical" ? "Critical" : "Risk"} command from ${approval.sourceLabel}: ${approval.preview} | ${approval.contextSummary} | ${approval.ruleSummary}`
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
            Cancel
          </button>
          <button className="secondary-button secondary-button--small" onClick={onAllowInTab} type="button">
            Allow In Tab
          </button>
          {approval.allowInGroup ? (
            <button className="secondary-button secondary-button--small" onClick={onAllowInGroup} type="button">
              Allow In Group
            </button>
          ) : null}
          <button className="secondary-button secondary-button--small" onClick={onSavePolicy} type="button">
            Save Policy...
          </button>
          <button className="primary-button primary-button--small" onClick={onRunOnce} type="button">
            Run Once
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
