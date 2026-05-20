import { useMemo } from "react";

import type { SettingsSectionId } from "./components/settings-modal-content";

interface SystemApiLike {
  getLogInfo?: unknown;
  openLocalPath?: unknown;
}

interface TransferHistoryEntryLike {
  status: string;
}

interface UseGlobalErrorRecoveryArgs<TTransfer extends TransferHistoryEntryLike> {
  activeSessionId: string | null;
  activeTabId: string | null;
  classifyTransferFailureReason: (message?: string) => string;
  disconnectReportCount: number;
  error: string | null;
  getTransferFailureSuggestion: (reason: string) => string | null;
  hasOperationCenterActivity: boolean;
  isActiveTabConnected: boolean;
  systemApi: SystemApiLike | null;
  terminalApi: unknown | null;
  transferHistory: TTransfer[];
}

export interface GlobalErrorRecovery {
  canCopyLatestDisconnectReport: boolean;
  canExportBugReport: boolean;
  canOpenLogs: boolean;
  canOpenOperationCenter: boolean;
  canOpenRetryCenter: boolean;
  canReconnect: boolean;
  hint: string;
  settingsAction: SettingsSectionId | null;
}

function isReconnectRecoverableError(message: string): boolean {
  return /(not connected|disconnected|connection lost|connection reset|broken pipe|handshake|timed out|timeout)/i.test(
    message
  );
}

function isBridgeUnavailableError(message: string): boolean {
  return /(bridge unavailable|bridge is not ready|restart `pnpm dev`)/i.test(message);
}

function isClipboardUnavailableError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /clipboard unavailable/i.test(message);
}

function isPreferredOpenerConfigurationError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /(configured windows opener was not found|quote paths with spaces|preferred (?:program|opener)|file opening)/i.test(
    message
  );
}

function isHotkeyRecoverableError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /(invalid hotkey file|hotkey|shortcut conflict|shortcut binding)/i.test(message);
}

function isPortForwardRecoverableError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /(port forwarding|forwarded connection|listen port|target host|target port|forwarding policy|already exists on .*:\d+)/i.test(
    message
  );
}

function isSafetyRecoverableError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /(dangerous command|safety (?:bundle|guardrail|settings)|safety bundles?|policy bundles?|guard preferences)/i.test(
    message
  );
}

function isWorkspaceRecoverableError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /(workspace profile|workspace safety sync|workspace settings|profile sync)/i.test(message);
}

function isServerHealthRecoverableError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /(server monitor|server health|health snapshot|process details|failed services|monitor command)/i.test(
    message
  );
}

function isDiagnosticsRecoverableError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /(diagnostics|log bridge|log info|log directory|bug report|disconnect report|snapshot export)/i.test(
    message
  );
}

function isRemotePathMissingError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /(no such file|no such file or directory|cannot find the path|path does not exist)/i.test(
    message
  );
}

function isSftpChannelOpenFailureError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /(channel open failure|administratively prohibited|open failed|unable to start subsystem:?\s*sftp|subsystem request failed)/i.test(
    message
  );
}

function resolveTransferRecoveryReasonForError(
  message: string | undefined,
  classifyTransferFailureReason: (value?: string) => string
): string | null {
  const normalized = message?.trim() ?? "";
  if (!normalized) {
    return null;
  }
  if (isRemotePathMissingError(normalized) || isSftpChannelOpenFailureError(normalized)) {
    return classifyTransferFailureReason(normalized);
  }
  if (
    /(upload|download|transfer|sftp|remote file|remote path|remote directory|retry failed|queue paused)/i.test(
      normalized
    )
  ) {
    return classifyTransferFailureReason(normalized);
  }
  const classified = classifyTransferFailureReason(normalized);
  if (
    classified === "Target already exists" ||
    classified === "Storage full or quota limit"
  ) {
    return classified;
  }
  return null;
}

export function useGlobalErrorRecovery<TTransfer extends TransferHistoryEntryLike>({
  activeSessionId,
  activeTabId,
  classifyTransferFailureReason,
  disconnectReportCount,
  error,
  getTransferFailureSuggestion,
  hasOperationCenterActivity,
  isActiveTabConnected,
  systemApi,
  terminalApi,
  transferHistory
}: UseGlobalErrorRecoveryArgs<TTransfer>): GlobalErrorRecovery {
  return useMemo(() => {
    const message = error?.trim() ?? "";
    if (!message) {
      return {
        canReconnect: false,
        canOpenLogs: false,
        canCopyLatestDisconnectReport: false,
        canOpenRetryCenter: false,
        canOpenOperationCenter: false,
        canExportBugReport: false,
        settingsAction: null,
        hint: ""
      };
    }

    const reconnectLike = isReconnectRecoverableError(message);
    const bridgeLike = isBridgeUnavailableError(message);
    const clipboardLike = isClipboardUnavailableError(message);
    const openerLike = isPreferredOpenerConfigurationError(message);
    const hotkeyLike = isHotkeyRecoverableError(message);
    const portForwardLike = isPortForwardRecoverableError(message);
    const safetyLike = isSafetyRecoverableError(message);
    const workspaceLike = isWorkspaceRecoverableError(message);
    const serverHealthLike = isServerHealthRecoverableError(message);
    const diagnosticsLike = isDiagnosticsRecoverableError(message);
    const transferReason = resolveTransferRecoveryReasonForError(
      message,
      classifyTransferFailureReason
    );
    const canReconnect =
      reconnectLike &&
      !!terminalApi &&
      !!activeTabId &&
      !!activeSessionId &&
      !isActiveTabConnected;
    const canOpenRetryCenter =
      !!transferReason && transferHistory.some((entry) => entry.status === "failed");
    const canOpenOperationCenter = !!(
      (transferReason || reconnectLike || portForwardLike) &&
      hasOperationCenterActivity
    );
    const canExportBugReport = !!(
      bridgeLike ||
      transferReason ||
      portForwardLike ||
      diagnosticsLike ||
      serverHealthLike
    );

    let settingsAction: SettingsSectionId | null = null;
    if (openerLike) {
      settingsAction = "fileOpening";
    } else if (hotkeyLike) {
      settingsAction = "hotkeys";
    } else if (safetyLike) {
      settingsAction = "safety";
    } else if (workspaceLike) {
      settingsAction = "workspace";
    } else if (portForwardLike) {
      settingsAction = "portForwarding";
    } else if (serverHealthLike) {
      settingsAction = "serverHealth";
    } else if (transferReason) {
      settingsAction = "sftp";
    } else if (reconnectLike && !canReconnect) {
      settingsAction = "connection";
    } else if (diagnosticsLike) {
      settingsAction = "diagnostics";
    }

    let hint = "";
    if (openerLike) {
      hint =
        "Preferred file opener looks invalid. Open File Opening settings and fix the configured command or path.";
    } else if (hotkeyLike) {
      hint =
        "Hotkey import or shortcut configuration issue detected. Open Hotkeys to review conflicts or re-import a valid file.";
    } else if (safetyLike) {
      hint =
        "Safety guardrail or shared-bundle issue detected. Open Safety to review policy packs, templates, sync file, or approvals.";
    } else if (workspaceLike) {
      hint =
        "Workspace profile issue detected. Open Workspace to review the active profile and Safety sync defaults.";
    } else if (portForwardLike) {
      hint = canOpenOperationCenter
        ? "Port-forwarding issue detected. Review bind/target settings, then check Operation Center for affected work."
        : "Port-forwarding issue detected. Review bind/target settings and active forwards in Port Fwd settings.";
    } else if (serverHealthLike) {
      hint =
        "Server health collection issue detected. Open Monitor settings to review alert thresholds, then use Diagnostics if the remote command keeps failing.";
    } else if (transferReason) {
      hint = getTransferFailureSuggestion(transferReason) ?? "";
      if (canOpenRetryCenter) {
        hint = hint
          ? `${hint} Retry Center can requeue failed items after the root cause is fixed.`
          : "Retry Center can requeue failed items after the root cause is fixed.";
      }
    } else if (diagnosticsLike) {
      hint = canExportBugReport
        ? "Diagnostics issue detected. Open Diagnostics, export a bug report, or copy the error for handoff."
        : "Diagnostics issue detected. Open Diagnostics or copy the error for handoff.";
    } else if (bridgeLike) {
      hint = "Bridge/runtime issue detected. Open logs or export a bug report.";
    } else if (reconnectLike) {
      hint = canOpenOperationCenter
        ? "Connection issue detected. Reconnect may recover quickly. Operation Center can show interrupted work."
        : "Connection issue detected. Reconnect may recover quickly.";
    } else if (clipboardLike) {
      hint =
        "Clipboard is unavailable in the current environment. Use the manual-copy fallback from the active workflow.";
    }

    return {
      canReconnect,
      canOpenLogs: !!(systemApi?.openLocalPath && systemApi.getLogInfo),
      canCopyLatestDisconnectReport: disconnectReportCount > 0,
      canOpenRetryCenter,
      canOpenOperationCenter,
      canExportBugReport,
      settingsAction,
      hint
    };
  }, [
    activeSessionId,
    activeTabId,
    classifyTransferFailureReason,
    disconnectReportCount,
    error,
    getTransferFailureSuggestion,
    hasOperationCenterActivity,
    isActiveTabConnected,
    systemApi,
    terminalApi,
    transferHistory
  ]);
}
