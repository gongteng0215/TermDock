import { useMemo } from "react";

import type { TerminalConnectionStatus } from "../shared/terminal";

type DisconnectReportScope = "allSessions" | "activeSession";
type DisconnectReportTriggerFilter = "all" | "status" | "error";
type DisconnectReportTimeRange = "all" | "5m" | "30m" | "1h" | "24h";

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
  pausedUpload: boolean;
  pausedDownload: boolean;
  uploadRunning: number;
  uploadQueued: number;
  downloadRunning: number;
  downloadQueued: number;
  portForwardTotal: number;
  portForwardDegraded: number;
  portForwardBusy: boolean;
  serverHealthLoading: boolean;
  serverProcessLoading: boolean;
  serverHealthError?: string;
  serverProcessError?: string;
  connectedTabCount: number;
  openTabCount: number;
  autoReconnect: boolean;
  reconnectDelaySeconds: number;
  recentFailures: DisconnectReportFailureSampleLike[];
}

interface TerminalTabLike {
  id: string;
}

interface DisconnectReportViewDefaultsLike {
  scope: DisconnectReportScope;
  trigger: DisconnectReportTriggerFilter;
  timeRange: DisconnectReportTimeRange;
  query: string;
}

interface UseDisconnectDiagnosticsViewModelsArgs {
  activeSessionId: string | null;
  classifyTransferFailureReason: (message: string) => string;
  disconnectCaptureEnabled: boolean;
  disconnectReportDefaults: DisconnectReportViewDefaultsLike;
  disconnectReportQuery: string;
  disconnectReportScope: DisconnectReportScope;
  disconnectReportTimeRange: DisconnectReportTimeRange;
  disconnectReportTriggerFilter: DisconnectReportTriggerFilter;
  disconnectReports: DisconnectReportLike[];
  formatPortForwardTimestamp: (isoString?: string) => string;
  logInfo: {
    logDirectoryPath: string;
    logFilePath: string;
  } | null;
  resolveDisconnectReportTimeRangeCutoff: (
    range: DisconnectReportTimeRange,
    nowMs: number
  ) => number | null;
  terminalTabs: TerminalTabLike[];
}

export function useDisconnectDiagnosticsViewModels({
  activeSessionId,
  classifyTransferFailureReason,
  disconnectCaptureEnabled,
  disconnectReportDefaults,
  disconnectReportQuery,
  disconnectReportScope,
  disconnectReportTimeRange,
  disconnectReportTriggerFilter,
  disconnectReports,
  formatPortForwardTimestamp,
  logInfo,
  resolveDisconnectReportTimeRangeCutoff,
  terminalTabs
}: UseDisconnectDiagnosticsViewModelsArgs) {
  const visibleDisconnectReports = useMemo(() => {
    let filtered = disconnectReports;
    if (disconnectReportScope === "activeSession") {
      if (!activeSessionId) {
        return [] as DisconnectReportLike[];
      }
      filtered = filtered.filter((entry) => entry.sessionId === activeSessionId);
    }
    if (disconnectReportTriggerFilter !== "all") {
      filtered = filtered.filter((entry) => entry.trigger === disconnectReportTriggerFilter);
    }
    const cutoffMs = resolveDisconnectReportTimeRangeCutoff(disconnectReportTimeRange, Date.now());
    if (cutoffMs !== null) {
      filtered = filtered.filter((entry) => {
        const createdAtMs = new Date(entry.createdAt).getTime();
        return Number.isFinite(createdAtMs) && createdAtMs >= cutoffMs;
      });
    }
    const normalizedQuery = disconnectReportQuery.trim().toLowerCase();
    if (normalizedQuery) {
      filtered = filtered.filter((entry) =>
        [
          entry.sessionName,
          entry.target,
          entry.tabTitle,
          entry.message,
          entry.trigger,
          entry.status ?? ""
        ].some((value) => value.toLowerCase().includes(normalizedQuery))
      );
    }
    return filtered
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [
    activeSessionId,
    disconnectReportQuery,
    disconnectReportScope,
    disconnectReportTimeRange,
    disconnectReportTriggerFilter,
    disconnectReports,
    resolveDisconnectReportTimeRangeCutoff
  ]);

  const openTerminalTabIdSet = useMemo(
    () => new Set(terminalTabs.map((tab) => tab.id)),
    [terminalTabs]
  );

  const diagnosticsLogDirectoryPath = logInfo?.logDirectoryPath ?? "Not loaded yet";
  const diagnosticsLogFilePath = logInfo?.logFilePath ?? "Not loaded yet";
  const diagnosticsDisconnectCaptureHint = disconnectCaptureEnabled
    ? "Unexpected disconnects are auto-captured with connection and transfer context. Use export when reporting random disconnect issues."
    : "Auto capture is disabled. Re-enable it to collect future disconnect reports automatically.";
  const diagnosticsDisconnectEmptyStateLabel =
    disconnectReports.length === 0
      ? "No disconnect reports captured yet."
      : "No disconnect reports match the current filter.";

  const diagnosticsDisconnectReportViews = useMemo(
    () =>
      visibleDisconnectReports.slice(0, 50).map((report) => {
        const transferActive =
          report.uploadRunning +
          report.uploadQueued +
          report.downloadRunning +
          report.downloadQueued;
        return {
          id: report.id,
          title: `${formatPortForwardTimestamp(report.createdAt)} | ${report.sessionName}`,
          metaLines: [
            `${report.tabTitle} | ${report.target}`,
            `Trigger: ${
              report.trigger === "error"
                ? `error (${report.message})`
                : `${report.status ?? "closed"} (${report.message})`
            }`,
            `Transfers active: ${transferActive} (up ${report.uploadRunning}/${report.uploadQueued}, down ${report.downloadRunning}/${report.downloadQueued}) | Port forwards: ${report.portForwardTotal} (${report.portForwardDegraded} degraded)`,
            `Tabs: ${report.connectedTabCount}/${report.openTabCount} connected | Auto reconnect: ${
              report.autoReconnect ? `on (${report.reconnectDelaySeconds}s)` : "off"
            }`
          ],
          recentFailuresLabel:
            report.recentFailures.length > 0
              ? report.recentFailures
                  .slice(0, 3)
                  .map(
                    (failure) =>
                      `${failure.direction}:${failure.name} (${classifyTransferFailureReason(
                        failure.message
                      )})`
                  )
                  .join(" | ")
              : null,
          canFocusTab: openTerminalTabIdSet.has(report.tabId)
        };
      }),
    [
      classifyTransferFailureReason,
      formatPortForwardTimestamp,
      openTerminalTabIdSet,
      visibleDisconnectReports
    ]
  );

  const hasCustomizedDisconnectReportView =
    disconnectReportScope !== disconnectReportDefaults.scope ||
    disconnectReportTriggerFilter !== disconnectReportDefaults.trigger ||
    disconnectReportTimeRange !== disconnectReportDefaults.timeRange ||
    disconnectReportQuery.trim().length > 0;

  return {
    diagnosticsDisconnectCaptureHint,
    diagnosticsDisconnectEmptyStateLabel,
    diagnosticsDisconnectReportViews,
    diagnosticsLogDirectoryPath,
    diagnosticsLogFilePath,
    hasCustomizedDisconnectReportView,
    visibleDisconnectReports
  };
}
