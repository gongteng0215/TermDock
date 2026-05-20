import { useCallback, type Dispatch, type SetStateAction } from "react";

interface DisconnectReportLike {
  id: string;
  createdAt: string;
}

interface LogInfo {
  logDirectoryPath: string;
  logFilePath: string;
}

interface SystemApiLike {
  exportBugReport?: (payload?: {
    settingsSnapshot?: unknown;
    runtimeSnapshot?: unknown;
    disconnectReports?: unknown;
  }) => Promise<{
    canceled: boolean;
    outputPath: string | null;
    generatedAtIso?: string;
    logFileCount?: number;
  }>;
  getLogInfo?: () => Promise<LogInfo>;
  openLocalPath?: (localPath: string, preferredProgramPath?: string | null) => Promise<void>;
}

type ShowAppAlert = (
  message: string,
  options?: {
    title?: string;
    confirmLabel?: string;
    detailText?: string;
  }
) => Promise<void>;

type WriteAppLog = (
  level: "info" | "warn" | "error",
  scope: string,
  message: string,
  details?: unknown
) => void;

interface UseGlobalDiagnosticsActionsArgs<TDisconnectReport extends DisconnectReportLike> {
  appVersion: string;
  copyTextToClipboard: (text: string) => Promise<boolean>;
  disconnectReports: TDisconnectReport[];
  error: string | null;
  finishOperationCenterAppJob: (
    jobId: string,
    status: "succeeded" | "failed",
    details?: {
      detail?: string;
      outputPath?: string;
    }
  ) => void;
  logInfo: LogInfo | null;
  removeOperationCenterAppJob: (jobId: string) => void;
  runtimeSnapshotBase: {
    activeTabId: string | null;
    disconnectReportCount: number;
    openTabCount: number;
    selectedSessionId: string | null;
    sessionCount: number;
    sessionGroupCount: number;
  };
  setError: Dispatch<SetStateAction<string | null>>;
  setIsExportingBugReport: Dispatch<SetStateAction<boolean>>;
  setLogInfo: Dispatch<SetStateAction<LogInfo | null>>;
  settingsSnapshot: unknown;
  showAppAlert: ShowAppAlert;
  startOperationCenterAppJob: (input: {
    category: "sessions" | "snippets" | "diagnostics";
    title: string;
    description: string;
  }) => string;
  systemApi: SystemApiLike | null;
  toLogMessage: (value: unknown) => string;
  writeAppLog: WriteAppLog;
}

export function useGlobalDiagnosticsActions<TDisconnectReport extends DisconnectReportLike>({
  appVersion,
  copyTextToClipboard,
  disconnectReports,
  error,
  finishOperationCenterAppJob,
  logInfo,
  removeOperationCenterAppJob,
  runtimeSnapshotBase,
  setError,
  setIsExportingBugReport,
  setLogInfo,
  settingsSnapshot,
  showAppAlert,
  startOperationCenterAppJob,
  systemApi,
  toLogMessage,
  writeAppLog
}: UseGlobalDiagnosticsActionsArgs<TDisconnectReport>) {
  const dismissGlobalError = useCallback(() => {
    setError(null);
  }, [setError]);

  const copyGlobalErrorMessage = useCallback(async () => {
    if (!error) {
      return;
    }
    try {
      const copied = await copyTextToClipboard(error);
      if (!copied) {
        throw new Error("Clipboard unavailable.");
      }
      await showAppAlert("Error message copied to clipboard.", {
        title: "Diagnostics"
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:error-bar",
        "Failed to copy global error message.",
        caughtError
      );
    }
  }, [copyTextToClipboard, error, setError, showAppAlert, toLogMessage, writeAppLog]);

  const refreshLogInfo = useCallback(async (): Promise<void> => {
    if (!systemApi?.getLogInfo) {
      setError("Log bridge unavailable. Restart `pnpm dev`.");
      return;
    }
    const info = await systemApi.getLogInfo();
    setLogInfo(info);
  }, [setError, setLogInfo, systemApi]);

  const refreshDiagnosticsLogInfo = useCallback(() => {
    void refreshLogInfo().catch((caughtError) => {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:diagnostics", "Failed to refresh log info.", caughtError);
    });
  }, [refreshLogInfo, setError, toLogMessage, writeAppLog]);

  const openLogDirectory = useCallback(async () => {
    try {
      if (!systemApi?.openLocalPath || !systemApi.getLogInfo) {
        throw new Error("Log bridge unavailable. Restart `pnpm dev`.");
      }
      const info = logInfo ?? (await systemApi.getLogInfo());
      setLogInfo(info);
      await systemApi.openLocalPath(info.logDirectoryPath);
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:diagnostics", "Failed to open log directory.", caughtError);
    }
  }, [logInfo, setError, setLogInfo, systemApi, toLogMessage, writeAppLog]);

  const copyLogFilePath = useCallback(async () => {
    try {
      if (!systemApi?.getLogInfo) {
        throw new Error("Log bridge unavailable. Restart `pnpm dev`.");
      }
      const info = logInfo ?? (await systemApi.getLogInfo());
      setLogInfo(info);
      const copied = await copyTextToClipboard(info.logFilePath);
      if (!copied) {
        throw new Error("Clipboard unavailable.");
      }
      await showAppAlert("Log file path copied to clipboard.", {
        title: "Diagnostics"
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:diagnostics", "Failed to copy log file path.", caughtError);
    }
  }, [
    copyTextToClipboard,
    logInfo,
    setError,
    setLogInfo,
    showAppAlert,
    systemApi,
    toLogMessage,
    writeAppLog
  ]);

  const exportBugReportBundle = useCallback(async () => {
    let operationJobId: string | null = null;
    try {
      if (!systemApi?.exportBugReport) {
        throw new Error("Bug report bridge unavailable. Restart `pnpm dev`.");
      }
      setIsExportingBugReport(true);
      operationJobId = startOperationCenterAppJob({
        category: "diagnostics",
        title: "Bug Report Export",
        description: "Bundling logs, runtime metadata, and disconnect-report context."
      });
      const disconnectReportSnapshot = {
        capturedAtIso: new Date().toISOString(),
        totalReports: disconnectReports.length,
        latestReportId: disconnectReports[0]?.id ?? "",
        latestCreatedAt: disconnectReports[0]?.createdAt ?? "",
        reports: disconnectReports.slice(0, 64)
      };
      const result = await systemApi.exportBugReport({
        settingsSnapshot: {
          appVersion,
          ...((settingsSnapshot as Record<string, unknown>) ?? {})
        },
        runtimeSnapshot: {
          capturedAtIso: new Date().toISOString(),
          ...runtimeSnapshotBase
        },
        disconnectReports: disconnectReportSnapshot
      });
      if (result.canceled || !result.outputPath) {
        if (operationJobId) {
          removeOperationCenterAppJob(operationJobId);
        }
        return;
      }
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "succeeded", {
          detail: `Exported bug report bundle with ${disconnectReports.length} disconnect report${disconnectReports.length === 1 ? "" : "s"}.`,
          outputPath: result.outputPath
        });
      }
      const copied = await copyTextToClipboard(result.outputPath);
      await showAppAlert(
        copied
          ? `Bug report exported.\nPath copied to clipboard:\n${result.outputPath}`
          : `Bug report exported:\n${result.outputPath}`,
        {
          title: "Diagnostics"
        }
      );
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "failed", {
          detail: message
        });
      }
      setError(message);
      writeAppLog("error", "renderer:diagnostics", "Failed to export bug report.", caughtError);
    } finally {
      setIsExportingBugReport(false);
    }
  }, [
    appVersion,
    copyTextToClipboard,
    disconnectReports,
    finishOperationCenterAppJob,
    removeOperationCenterAppJob,
    runtimeSnapshotBase,
    setError,
    setIsExportingBugReport,
    settingsSnapshot,
    showAppAlert,
    startOperationCenterAppJob,
    systemApi,
    toLogMessage,
    writeAppLog
  ]);

  const exportBugReportFromError = useCallback(() => {
    void exportBugReportBundle();
  }, [exportBugReportBundle]);

  return {
    copyGlobalErrorMessage,
    copyLogFilePath,
    dismissGlobalError,
    exportBugReportBundle,
    exportBugReportFromError,
    openLogDirectory,
    refreshDiagnosticsLogInfo
  };
}
