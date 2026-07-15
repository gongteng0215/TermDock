import { UiIcon } from "./ui-icon";

type ErrorSettingsAction =
  | "connection"
  | "workspace"
  | "safety"
  | "hotkeys"
  | "serverHealth"
  | "fileOpening"
  | "sftp"
  | "portForwarding"
  | "diagnostics";

export interface GlobalErrorBarProps {
  canCopyLatestDisconnectReport: boolean;
  canExportBugReport: boolean;
  canOpenCommandHistoryManager: boolean;
  canOpenLogs: boolean;
  canOpenOperationCenter: boolean;
  canOpenRetryCenter: boolean;
  canOpenSessionTemplateManager: boolean;
  canOpenSnippetManager: boolean;
  canReconnect: boolean;
  error: string | null;
  hint: string;
  onCopyError: () => void;
  onCopyLatestDisconnect: () => void;
  onDismiss: () => void;
  onExportBugReport: () => void;
  onOpenConnectionSettings: () => void;
  onOpenCommandHistoryManager: () => void;
  onOpenDiagnostics: () => void;
  onOpenFileOpeningSettings: () => void;
  onOpenHotkeysSettings: () => void;
  onOpenLogDirectory: () => void;
  onOpenOperationCenter: () => void;
  onOpenPortForwardingSettings: () => void;
  onOpenRetryCenter: () => void;
  onOpenSafetySettings: () => void;
  onOpenServerHealthSettings: () => void;
  onOpenSessionTemplateManager: () => void;
  onOpenSftpSettings: () => void;
  onOpenSnippetManager: () => void;
  onOpenWorkspaceSettings: () => void;
  onReconnect: () => void;
  settingsAction: ErrorSettingsAction | null;
}

export function GlobalErrorBar({
  canCopyLatestDisconnectReport,
  canExportBugReport,
  canOpenCommandHistoryManager,
  canOpenLogs,
  canOpenOperationCenter,
  canOpenRetryCenter,
  canOpenSessionTemplateManager,
  canOpenSnippetManager,
  canReconnect,
  error,
  hint,
  onCopyError,
  onCopyLatestDisconnect,
  onDismiss,
  onExportBugReport,
  onOpenConnectionSettings,
  onOpenCommandHistoryManager,
  onOpenDiagnostics,
  onOpenFileOpeningSettings,
  onOpenHotkeysSettings,
  onOpenLogDirectory,
  onOpenOperationCenter,
  onOpenPortForwardingSettings,
  onOpenRetryCenter,
  onOpenSafetySettings,
  onOpenServerHealthSettings,
  onOpenSessionTemplateManager,
  onOpenSftpSettings,
  onOpenSnippetManager,
  onOpenWorkspaceSettings,
  onReconnect,
  settingsAction
}: GlobalErrorBarProps) {
  if (!error) {
    return null;
  }

  return (
    <div className="error-bar" role="status">
      <p className="error-bar__message">{error}</p>
      {hint ? <p className="hint error-bar__hint">{hint}</p> : null}
      <div className="error-bar__actions">
        {canReconnect ? (
          <button className="secondary-button secondary-button--small" onClick={onReconnect} type="button">
            Reconnect
          </button>
        ) : null}
        {canOpenLogs ? (
          <button className="secondary-button secondary-button--small" onClick={onOpenLogDirectory} type="button">
            Open Logs
          </button>
        ) : null}
        {settingsAction === "connection" ? (
          <button
            className="secondary-button secondary-button--small"
            onClick={onOpenConnectionSettings}
            type="button"
          >
            Connection Settings
          </button>
        ) : null}
        {settingsAction === "fileOpening" ? (
          <button
            className="secondary-button secondary-button--small"
            onClick={onOpenFileOpeningSettings}
            type="button"
          >
            File Opening
          </button>
        ) : null}
        {settingsAction === "hotkeys" ? (
          <button className="secondary-button secondary-button--small" onClick={onOpenHotkeysSettings} type="button">
            Hotkeys
          </button>
        ) : null}
        {settingsAction === "workspace" ? (
          <button
            className="secondary-button secondary-button--small"
            onClick={onOpenWorkspaceSettings}
            type="button"
          >
            Workspace
          </button>
        ) : null}
        {settingsAction === "safety" ? (
          <button className="secondary-button secondary-button--small" onClick={onOpenSafetySettings} type="button">
            Safety
          </button>
        ) : null}
        {settingsAction === "serverHealth" ? (
          <button
            className="secondary-button secondary-button--small"
            onClick={onOpenServerHealthSettings}
            type="button"
          >
            Monitor
          </button>
        ) : null}
        {settingsAction === "sftp" ? (
          <button className="secondary-button secondary-button--small" onClick={onOpenSftpSettings} type="button">
            SFTP Settings
          </button>
        ) : null}
        {settingsAction === "portForwarding" ? (
          <button
            className="secondary-button secondary-button--small"
            onClick={onOpenPortForwardingSettings}
            type="button"
          >
            Port Fwd
          </button>
        ) : null}
        {canOpenRetryCenter ? (
          <button className="secondary-button secondary-button--small" onClick={onOpenRetryCenter} type="button">
            Retry Center
          </button>
        ) : null}
        {canOpenSnippetManager ? (
          <button className="secondary-button secondary-button--small" onClick={onOpenSnippetManager} type="button">
            Snippet Manager
          </button>
        ) : null}
        {canOpenSessionTemplateManager ? (
          <button
            className="secondary-button secondary-button--small"
            onClick={onOpenSessionTemplateManager}
            type="button"
          >
            Session Templates
          </button>
        ) : null}
        {canOpenCommandHistoryManager ? (
          <button
            className="secondary-button secondary-button--small"
            onClick={onOpenCommandHistoryManager}
            type="button"
          >
            Command History
          </button>
        ) : null}
        {canOpenOperationCenter ? (
          <button className="secondary-button secondary-button--small" onClick={onOpenOperationCenter} type="button">
            Operation Center
          </button>
        ) : null}
        {canExportBugReport ? (
          <button className="secondary-button secondary-button--small" onClick={onExportBugReport} type="button">
            Export Bug Report
          </button>
        ) : null}
        <button className="secondary-button secondary-button--small" onClick={onOpenDiagnostics} type="button">
          Diagnostics
        </button>
        <button className="secondary-button secondary-button--small" onClick={onCopyError} type="button">
          Copy Error
        </button>
        {canCopyLatestDisconnectReport ? (
          <button
            className="secondary-button secondary-button--small"
            onClick={onCopyLatestDisconnect}
            type="button"
          >
            Copy Latest Disconnect
          </button>
        ) : null}
        <button aria-label="Dismiss error" className="icon-button" onClick={onDismiss} title="Dismiss" type="button">
          <UiIcon name="close" />
        </button>
      </div>
    </div>
  );
}
