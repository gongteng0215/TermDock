import { useCallback, type Dispatch, type SetStateAction } from "react";

import type { TerminalConnectionStatus } from "../shared/terminal";

interface DisconnectReportFailureSampleLike {
  direction: "upload" | "download";
  name: string;
  message: string;
  updatedAt: number;
}

interface DisconnectReportLike {
  id: string;
  createdAt: string;
  tabId: string;
  tabTitle: string;
  sessionId: string;
  sessionName: string;
  target: string;
  trigger: "status" | "error";
  status?: TerminalConnectionStatus;
  message: string;
  activeTabId: string | null;
  wasActiveTab: boolean;
  openTabCount: number;
  connectedTabCount: number;
  autoReconnect: boolean;
  reconnectDelaySeconds: number;
  uploadRunning: number;
  uploadQueued: number;
  downloadRunning: number;
  downloadQueued: number;
  pausedUpload: boolean;
  pausedDownload: boolean;
  portForwardTotal: number;
  portForwardDegraded: number;
  portForwardBusy: boolean;
  serverHealthLoading: boolean;
  serverProcessLoading: boolean;
  serverHealthError?: string;
  serverProcessError?: string;
  recentFailures: DisconnectReportFailureSampleLike[];
}

type ShowAppAlert = (
  message: string,
  options?: {
    title?: string;
    confirmLabel?: string;
    detailText?: string;
  }
) => Promise<void>;

type ShowAppConfirm = (
  message: string,
  options?: {
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
  }
) => Promise<boolean>;

type WriteAppLog = (
  level: "info" | "warn" | "error",
  scope: string,
  message: string,
  context?: unknown
) => void;

interface UseDisconnectDiagnosticsActionsArgs {
  appVersion: string;
  classifyTransferFailureReason: (message: string) => string;
  clearDisconnectReportFingerprintsForTabIds: (tabIds: string[]) => void;
  copyTextToClipboard: (text: string) => Promise<boolean>;
  disconnectReports: DisconnectReportLike[];
  escapeCsvCell: (value: string | number | null | undefined) => string;
  hasCustomizedDisconnectReportView: boolean;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setDisconnectReports: Dispatch<SetStateAction<DisconnectReportLike[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  showAppAlert: ShowAppAlert;
  showAppConfirm: ShowAppConfirm;
  systemApi: Window["termdock"]["system"] | null;
  toLogMessage: (value: unknown) => string;
  visibleDisconnectReports: DisconnectReportLike[];
  writeAppLog: WriteAppLog;
}

export function useDisconnectDiagnosticsActions({
  appVersion,
  classifyTransferFailureReason,
  clearDisconnectReportFingerprintsForTabIds,
  copyTextToClipboard,
  disconnectReports,
  escapeCsvCell,
  hasCustomizedDisconnectReportView,
  setActiveTabId,
  setDisconnectReports,
  setError,
  showAppAlert,
  showAppConfirm,
  systemApi,
  toLogMessage,
  visibleDisconnectReports,
  writeAppLog
}: UseDisconnectDiagnosticsActionsArgs) {
  const copyDisconnectReportJson = useCallback(
    async (report: DisconnectReportLike) => {
      try {
        const payload = {
          appVersion,
          copiedAtIso: new Date().toISOString(),
          report
        };
        const copied = await copyTextToClipboard(`${JSON.stringify(payload, null, 2)}\n`);
        if (!copied) {
          throw new Error("Clipboard unavailable.");
        }
        await showAppAlert("Disconnect report JSON copied to clipboard.", {
          title: "Diagnostics"
        });
      } catch (caughtError) {
        const message = toLogMessage(caughtError);
        setError(message);
        writeAppLog(
          "error",
          "renderer:diagnostics",
          "Failed to copy disconnect report JSON.",
          caughtError
        );
      }
    },
    [appVersion, copyTextToClipboard, setError, showAppAlert, toLogMessage, writeAppLog]
  );

  const copyVisibleDisconnectReportJsonById = useCallback(
    (reportId: string) => {
      const report = visibleDisconnectReports.find((entry) => entry.id === reportId) ?? null;
      if (!report) {
        return;
      }
      void copyDisconnectReportJson(report);
    },
    [copyDisconnectReportJson, visibleDisconnectReports]
  );

  const focusVisibleDisconnectReportTab = useCallback(
    (reportId: string) => {
      const report = visibleDisconnectReports.find((entry) => entry.id === reportId) ?? null;
      if (!report) {
        return;
      }
      setActiveTabId(report.tabId);
    },
    [setActiveTabId, visibleDisconnectReports]
  );

  const exportDisconnectReportsJson = useCallback(async () => {
    if (visibleDisconnectReports.length === 0) {
      await showAppAlert("No matching disconnect reports for the current filter.", {
        title: "Diagnostics"
      });
      return;
    }
    const payload = {
      appVersion,
      exportedAtIso: new Date().toISOString(),
      reportCount: visibleDisconnectReports.length,
      totalReportCount: disconnectReports.length,
      reports: visibleDisconnectReports
    };
    const exportText = `${JSON.stringify(payload, null, 2)}\n`;
    try {
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Disconnect Reports (JSON)",
          defaultFileName: `termdock-disconnect-reports-${Date.now()}${
            hasCustomizedDisconnectReportView ? "-filtered" : ""
          }.json`,
          text: exportText,
          filters: [
            {
              name: "JSON",
              extensions: ["json"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copied = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copied
              ? `Disconnect reports exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `Disconnect reports exported:\n${result.outputPath}`,
            {
              title: "Diagnostics"
            }
          );
          return;
        }
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("Disconnect reports JSON copied to clipboard.", {
          title: "Diagnostics"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the disconnect reports below manually.", {
        title: "Diagnostics",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:diagnostics",
        "Failed to export disconnect reports.",
        caughtError
      );
    }
  }, [
    appVersion,
    copyTextToClipboard,
    disconnectReports.length,
    hasCustomizedDisconnectReportView,
    setError,
    showAppAlert,
    systemApi,
    toLogMessage,
    visibleDisconnectReports,
    writeAppLog
  ]);

  const exportDisconnectReportsCsv = useCallback(async () => {
    if (visibleDisconnectReports.length === 0) {
      await showAppAlert("No matching disconnect reports for the current filter.", {
        title: "Diagnostics"
      });
      return;
    }
    const lines: string[] = [];
    lines.push("# TermDock Disconnect Reports");
    lines.push(`generatedAtIso,${escapeCsvCell(new Date().toISOString())}`);
    lines.push(`reportCount,${visibleDisconnectReports.length}`);
    lines.push(`totalReportCount,${disconnectReports.length}`);
    lines.push("");
    lines.push(
      [
        "id",
        "createdAt",
        "sessionName",
        "target",
        "tabTitle",
        "trigger",
        "status",
        "message",
        "connectedTabCount",
        "openTabCount",
        "uploadRunning",
        "uploadQueued",
        "downloadRunning",
        "downloadQueued",
        "portForwardTotal",
        "portForwardDegraded",
        "autoReconnect",
        "reconnectDelaySeconds",
        "recentFailures"
      ].join(",")
    );
    for (const report of visibleDisconnectReports) {
      const recentFailures = report.recentFailures
        .slice(0, 5)
        .map(
          (failure) =>
            `${failure.direction}:${failure.name} (${classifyTransferFailureReason(
              failure.message
            )})`
        )
        .join(" | ");
      lines.push(
        [
          escapeCsvCell(report.id),
          escapeCsvCell(report.createdAt),
          escapeCsvCell(report.sessionName),
          escapeCsvCell(report.target),
          escapeCsvCell(report.tabTitle),
          escapeCsvCell(report.trigger),
          escapeCsvCell(report.status ?? ""),
          escapeCsvCell(report.message),
          escapeCsvCell(report.connectedTabCount),
          escapeCsvCell(report.openTabCount),
          escapeCsvCell(report.uploadRunning),
          escapeCsvCell(report.uploadQueued),
          escapeCsvCell(report.downloadRunning),
          escapeCsvCell(report.downloadQueued),
          escapeCsvCell(report.portForwardTotal),
          escapeCsvCell(report.portForwardDegraded),
          escapeCsvCell(report.autoReconnect ? "true" : "false"),
          escapeCsvCell(report.reconnectDelaySeconds),
          escapeCsvCell(recentFailures)
        ].join(",")
      );
    }
    const exportText = `${lines.join("\n")}\n`;
    try {
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Disconnect Reports (CSV)",
          defaultFileName: `termdock-disconnect-reports-${Date.now()}${
            hasCustomizedDisconnectReportView ? "-filtered" : ""
          }.csv`,
          text: exportText,
          filters: [
            {
              name: "CSV",
              extensions: ["csv"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copied = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copied
              ? `Disconnect reports CSV exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `Disconnect reports CSV exported:\n${result.outputPath}`,
            {
              title: "Diagnostics"
            }
          );
          return;
        }
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("Disconnect reports CSV copied to clipboard.", {
          title: "Diagnostics"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the disconnect reports CSV below manually.", {
        title: "Diagnostics",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:diagnostics",
        "Failed to export disconnect reports CSV.",
        caughtError
      );
    }
  }, [
    classifyTransferFailureReason,
    copyTextToClipboard,
    disconnectReports.length,
    escapeCsvCell,
    hasCustomizedDisconnectReportView,
    setError,
    showAppAlert,
    systemApi,
    toLogMessage,
    visibleDisconnectReports,
    writeAppLog
  ]);

  const copyLatestDisconnectReport = useCallback(async () => {
    const latestReport = disconnectReports[0];
    if (!latestReport) {
      await showAppAlert("No disconnect reports captured yet.", {
        title: "Diagnostics"
      });
      return;
    }
    await copyDisconnectReportJson(latestReport);
  }, [copyDisconnectReportJson, disconnectReports, showAppAlert]);

  const copyLatestVisibleDisconnectReport = useCallback(async () => {
    const latestReport = visibleDisconnectReports[0];
    if (!latestReport) {
      await showAppAlert("No matching disconnect reports for the current filter.", {
        title: "Diagnostics"
      });
      return;
    }
    await copyDisconnectReportJson(latestReport);
  }, [copyDisconnectReportJson, showAppAlert, visibleDisconnectReports]);

  const clearVisibleDisconnectReportsHistory = useCallback(async () => {
    if (visibleDisconnectReports.length === 0) {
      return;
    }
    const visibleIds = new Set(visibleDisconnectReports.map((entry) => entry.id));
    const visibleTabIds = visibleDisconnectReports.map((entry) => entry.tabId);
    const confirmed = await showAppConfirm(
      `Clear ${visibleDisconnectReports.length} visible disconnect report(s)?`,
      {
        title: "Diagnostics",
        confirmLabel: "Clear Visible",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    setDisconnectReports((prev) => prev.filter((entry) => !visibleIds.has(entry.id)));
    clearDisconnectReportFingerprintsForTabIds(visibleTabIds);
    await showAppAlert("Visible disconnect reports cleared.", {
      title: "Diagnostics"
    });
  }, [
    clearDisconnectReportFingerprintsForTabIds,
    setDisconnectReports,
    showAppAlert,
    showAppConfirm,
    visibleDisconnectReports
  ]);

  const clearDisconnectReportsHistory = useCallback(async () => {
    if (disconnectReports.length === 0) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Clear ${disconnectReports.length} disconnect report(s)?`,
      {
        title: "Diagnostics",
        confirmLabel: "Clear",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    setDisconnectReports([]);
    clearDisconnectReportFingerprintsForTabIds(
      disconnectReports.map((entry) => entry.tabId)
    );
    await showAppAlert("Disconnect reports cleared.", {
      title: "Diagnostics"
    });
  }, [
    clearDisconnectReportFingerprintsForTabIds,
    disconnectReports,
    setDisconnectReports,
    showAppAlert,
    showAppConfirm
  ]);

  return {
    clearDisconnectReportsHistory,
    clearVisibleDisconnectReportsHistory,
    copyDisconnectReportJson,
    copyLatestDisconnectReport,
    copyLatestVisibleDisconnectReport,
    copyVisibleDisconnectReportJsonById,
    exportDisconnectReportsCsv,
    exportDisconnectReportsJson,
    focusVisibleDisconnectReportTab
  };
}
