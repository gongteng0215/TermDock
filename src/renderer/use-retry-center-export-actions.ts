import { useCallback } from "react";

import type { SftpTransferEvent } from "../shared/sftp";

type TransferHistoryScope = "activeSession" | "allSessions";
type TransferHistoryDirectionFilter = "all" | SftpTransferEvent["direction"];
type TransferHistoryStatusFilter = "all" | SftpTransferEvent["status"];
type TransferHistoryTimeRange = "all" | "5m" | "30m" | "1h" | "24h";
type RetryCenterListMode = "flat" | "groupedByReason";
type RetryCenterGroupExportScope = "all" | "failed" | "retryable";

interface RetryCenterHistoryEntryLike {
  key: string;
  sessionId: string;
  direction: SftpTransferEvent["direction"];
  status: SftpTransferEvent["status"];
  name: string;
  localPath: string;
  remotePath: string;
  updatedAt: number;
  attemptCount: number;
  message?: string;
}

interface RetryCenterVisibleExportEntryLike extends RetryCenterHistoryEntryLike {
  sessionName: string;
  groupName: string;
  updatedAtIso: string;
}

interface RetryCenterGroupLike {
  key: string;
  label: string;
  total: number;
  failedCount: number;
  activeSessionFailedCount: number;
  entries: RetryCenterHistoryEntryLike[];
}

interface RetryCenterAnalyticsLike {
  failedRatioPercent: number;
  failedCount: number;
  directionCounts: {
    upload: number;
    download: number;
  };
  statusCounts: {
    queued: number;
    running: number;
    completed: number;
    failed: number;
    canceled: number;
  };
  topSessions: Array<{
    sessionId: string;
    sessionName: string;
    groupName: string;
    total: number;
    failed: number;
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

interface ChoiceOption {
  value: string;
  label: string;
}

interface ShowAppAlertOptions {
  title?: string;
  detailText?: string;
}

interface SaveTextFileOptions {
  title: string;
  defaultFileName: string;
  text: string;
  filters: Array<{
    name: string;
    extensions: string[];
  }>;
}

interface SaveTextFileResult {
  canceled: boolean;
  outputPath?: string | null;
}

interface SystemApiLike {
  saveTextFile?: (options: SaveTextFileOptions) => Promise<SaveTextFileResult>;
}

interface UseRetryCenterExportActionsArgs {
  activeSessionId: string | null;
  analytics: RetryCenterAnalyticsLike;
  appVersion: string;
  classifyTransferFailureReason: (message?: string) => string;
  copyTextToClipboard: (text: string) => Promise<boolean>;
  direction: TransferHistoryDirectionFilter;
  escapeCsvCell: (value: string | number | null | undefined) => string;
  failureReasonExportValue: string;
  groupedEntries: RetryCenterGroupLike[];
  listMode: RetryCenterListMode;
  query: string;
  scope: TransferHistoryScope;
  selectedCount: number;
  setError: (message: string | null) => void;
  showAppAlert: (message: string, options?: ShowAppAlertOptions) => Promise<void>;
  showAppChoice: (
    message: string,
    choices: ChoiceOption[],
    options?: { title?: string; cancelLabel?: string }
  ) => Promise<string | null>;
  status: TransferHistoryStatusFilter;
  systemApi: SystemApiLike | null;
  timeRange: TransferHistoryTimeRange;
  toIsoTimestamp: (timestamp: number) => string;
  toLogMessage: (error: unknown) => string;
  totalHistoryCount: number;
  visibleEntries: RetryCenterHistoryEntryLike[];
  visibleExportEntries: RetryCenterVisibleExportEntryLike[];
  visibleExportEntryByKey: Map<string, RetryCenterVisibleExportEntryLike>;
  writeAppLog: (
    level: "info" | "warn" | "error",
    scope: string,
    message: string,
    context?: unknown
  ) => void;
}

function buildDateSegment(iso: string) {
  return iso.replace(/[:]/g, "-");
}

function buildScopeSegment(scope: TransferHistoryScope) {
  return scope === "activeSession" ? "active-session" : "all-sessions";
}

export function useRetryCenterExportActions({
  activeSessionId,
  analytics,
  appVersion,
  classifyTransferFailureReason,
  copyTextToClipboard,
  direction,
  escapeCsvCell,
  failureReasonExportValue,
  groupedEntries,
  listMode,
  query,
  scope,
  selectedCount,
  setError,
  showAppAlert,
  showAppChoice,
  status,
  systemApi,
  timeRange,
  toIsoTimestamp,
  toLogMessage,
  totalHistoryCount,
  visibleEntries,
  visibleExportEntries,
  visibleExportEntryByKey,
  writeAppLog
}: UseRetryCenterExportActionsArgs) {
  const saveOrCopyText = useCallback(
    async ({
      clipboardMessage,
      defaultFileName,
      exportText,
      saveTitle,
      scopeTitle,
      filters
    }: {
      clipboardMessage: string;
      defaultFileName: string;
      exportText: string;
      saveTitle: string;
      scopeTitle: string;
      filters: Array<{ name: string; extensions: string[] }>;
    }) => {
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: saveTitle,
          defaultFileName,
          text: exportText,
          filters
        });
        if (!result.canceled && result.outputPath) {
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `${scopeTitle} exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `${scopeTitle} exported:\n${result.outputPath}`,
            {
              title: "Retry Center"
            }
          );
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert(clipboardMessage, {
          title: "Retry Center"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the export below manually.", {
        title: "Retry Center",
        detailText: exportText
      });
    },
    [copyTextToClipboard, showAppAlert, systemApi]
  );

  const exportRetryCenterVisibleHistoryJson = useCallback(async () => {
    try {
      const generatedAtIso = new Date().toISOString();
      const exportPayload = {
        exportedAtIso: generatedAtIso,
        appVersion,
        filters: {
          scope,
          direction,
          status,
          timeRange,
          listMode,
          failureReason: failureReasonExportValue,
          query: query.trim()
        },
        stats: {
          visibleCount: visibleEntries.length,
          totalHistoryCount,
          selectedCount,
          failedVisibleCount: analytics.failedCount,
          failedVisibleRatioPercent: Number(analytics.failedRatioPercent.toFixed(2)),
          directionCounts: analytics.directionCounts,
          statusCounts: analytics.statusCounts,
          topSessions: analytics.topSessions,
          topGroups: analytics.topGroups,
          topFailureReasons: analytics.topFailureReasons
        },
        entries: visibleExportEntries
      };
      const exportText = `${JSON.stringify(exportPayload, null, 2)}\n`;
      await saveOrCopyText({
        clipboardMessage: "Retry Center JSON copied to clipboard.",
        defaultFileName: `termdock-retry-center-${buildScopeSegment(scope)}-${buildDateSegment(generatedAtIso)}.json`,
        exportText,
        saveTitle: "Export Retry Center (JSON)",
        scopeTitle: "Retry Center JSON",
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:retry-center", "Failed to export retry center JSON.", caughtError);
    }
  }, [
    analytics,
    appVersion,
    direction,
    failureReasonExportValue,
    listMode,
    query,
    saveOrCopyText,
    scope,
    selectedCount,
    setError,
    status,
    timeRange,
    toLogMessage,
    totalHistoryCount,
    visibleEntries.length,
    visibleExportEntries,
    writeAppLog
  ]);

  const exportRetryCenterVisibleHistoryCsv = useCallback(async () => {
    try {
      const generatedAtIso = new Date().toISOString();
      const lines: string[] = [];
      lines.push("# TermDock Retry Center Export");
      lines.push("# Format: CSV");
      lines.push(`# Generated: ${generatedAtIso}`);
      lines.push(`# AppVersion: ${appVersion}`);
      lines.push(
        `# Filters: scope=${scope}, direction=${direction}, status=${status}, timeRange=${timeRange}, listMode=${listMode}, failureReason=${failureReasonExportValue}, query=${query.trim() || "-"}`
      );
      lines.push(
        `# Counts: visible=${visibleEntries.length}, total=${totalHistoryCount}, selected=${selectedCount}`
      );
      lines.push(
        `# TopFailureReasons: ${
          analytics.topFailureReasons.length > 0
            ? analytics.topFailureReasons.map((entry) => `${entry.reason}(${entry.total})`).join(" | ")
            : "-"
        }`
      );
      lines.push("");
      lines.push(
        [
          "key",
          "sessionId",
          "sessionName",
          "groupName",
          "direction",
          "status",
          "name",
          "localPath",
          "remotePath",
          "attemptCount",
          "updatedAt",
          "updatedAtIso",
          "message"
        ].join(",")
      );
      for (const entry of visibleExportEntries) {
        lines.push(
          [
            entry.key,
            entry.sessionId,
            entry.sessionName,
            entry.groupName,
            entry.direction,
            entry.status,
            entry.name,
            entry.localPath,
            entry.remotePath,
            entry.attemptCount,
            entry.updatedAt,
            entry.updatedAtIso,
            entry.message
          ]
            .map((value) => escapeCsvCell(value))
            .join(",")
        );
      }
      const exportText = `${lines.join("\n")}\n`;
      await saveOrCopyText({
        clipboardMessage: "Retry Center CSV copied to clipboard.",
        defaultFileName: `termdock-retry-center-${buildScopeSegment(scope)}-${buildDateSegment(generatedAtIso)}.csv`,
        exportText,
        saveTitle: "Export Retry Center (CSV)",
        scopeTitle: "Retry Center CSV",
        filters: [{ name: "CSV", extensions: ["csv"] }]
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:retry-center", "Failed to export retry center CSV.", caughtError);
    }
  }, [
    analytics.topFailureReasons,
    appVersion,
    direction,
    escapeCsvCell,
    failureReasonExportValue,
    listMode,
    query,
    saveOrCopyText,
    scope,
    selectedCount,
    setError,
    status,
    timeRange,
    toLogMessage,
    totalHistoryCount,
    visibleEntries.length,
    visibleExportEntries,
    writeAppLog
  ]);

  const chooseRetryCenterGroupExportScope = useCallback(
    async (groupKey: string, format: "json" | "csv"): Promise<RetryCenterGroupExportScope | null> => {
      const group = groupedEntries.find((entry) => entry.key === groupKey);
      if (!group || group.entries.length === 0) {
        await showAppAlert("No visible records in this group to export.", {
          title: "Retry Center"
        });
        return null;
      }
      const choices: ChoiceOption[] = [
        {
          value: "all",
          label: `All (${group.total})`
        }
      ];
      if (group.failedCount > 0) {
        choices.push({
          value: "failed",
          label: `Failed (${group.failedCount})`
        });
      }
      if (group.activeSessionFailedCount > 0) {
        choices.push({
          value: "retryable",
          label: `Retryable Active Session (${group.activeSessionFailedCount})`
        });
      }
      if (choices.length === 1) {
        return "all";
      }
      const choice = await showAppChoice(
        `Choose ${format.toUpperCase()} export scope for "${group.label}".`,
        choices,
        {
          title: "Retry Center",
          cancelLabel: "Cancel"
        }
      );
      if (choice !== "all" && choice !== "failed" && choice !== "retryable") {
        return null;
      }
      return choice;
    },
    [groupedEntries, showAppAlert, showAppChoice]
  );

  const getRetryCenterGroupEntriesForExportScope = useCallback(
    (group: RetryCenterGroupLike, exportScope: RetryCenterGroupExportScope): RetryCenterHistoryEntryLike[] => {
      if (exportScope === "all") {
        return group.entries;
      }
      if (exportScope === "failed") {
        return group.entries.filter((entry) => entry.status === "failed");
      }
      if (!activeSessionId) {
        return [];
      }
      return group.entries.filter(
        (entry) => entry.status === "failed" && entry.sessionId === activeSessionId
      );
    },
    [activeSessionId]
  );

  const exportRetryCenterGroupHistoryJson = useCallback(
    async (groupKey: string, exportScope: RetryCenterGroupExportScope = "all") => {
      const group = groupedEntries.find((entry) => entry.key === groupKey);
      if (!group || group.entries.length === 0) {
        await showAppAlert("No visible records in this group to export.", {
          title: "Retry Center"
        });
        return;
      }
      const scopedEntries = getRetryCenterGroupEntriesForExportScope(group, exportScope);
      if (scopedEntries.length === 0) {
        await showAppAlert(`No "${exportScope}" records available in this group.`, {
          title: "Retry Center"
        });
        return;
      }
      try {
        const generatedAtIso = new Date().toISOString();
        const exportEntries = scopedEntries.map((entry) => {
          const exportEntry = visibleExportEntryByKey.get(entry.key);
          return {
            key: entry.key,
            sessionId: entry.sessionId,
            sessionName: exportEntry?.sessionName ?? entry.sessionId,
            groupName: exportEntry?.groupName ?? "Unknown",
            direction: entry.direction,
            status: entry.status,
            name: entry.name,
            localPath: entry.localPath,
            remotePath: entry.remotePath,
            attemptCount: entry.attemptCount,
            updatedAt: entry.updatedAt,
            updatedAtIso: exportEntry?.updatedAtIso ?? toIsoTimestamp(entry.updatedAt),
            failureReason:
              entry.status === "failed" ? classifyTransferFailureReason(entry.message) : "",
            message: entry.message ?? ""
          };
        });
        const exportPayload = {
          exportedAtIso: generatedAtIso,
          appVersion,
          filters: {
            scope,
            direction,
            status,
            timeRange,
            listMode,
            failureReason: failureReasonExportValue,
            groupExportScope: exportScope,
            query: query.trim()
          },
          group: {
            key: group.key,
            label: group.label,
            total: group.total,
            failedCount: group.failedCount,
            activeSessionFailedCount: group.activeSessionFailedCount,
            exportedCount: scopedEntries.length
          },
          entries: exportEntries
        };
        const exportText = `${JSON.stringify(exportPayload, null, 2)}\n`;
        const groupSegment =
          group.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 48) || "group";
        await saveOrCopyText({
          clipboardMessage: "Retry Center group JSON copied to clipboard.",
          defaultFileName: `termdock-retry-center-group-${groupSegment}-${exportScope}-${buildDateSegment(generatedAtIso)}.json`,
          exportText,
          saveTitle: "Export Retry Center Group (JSON)",
          scopeTitle: "Retry Center group JSON",
          filters: [{ name: "JSON", extensions: ["json"] }]
        });
      } catch (caughtError) {
        const message = toLogMessage(caughtError);
        setError(message);
        writeAppLog(
          "error",
          "renderer:retry-center",
          "Failed to export retry center group JSON.",
          caughtError
        );
      }
    },
    [
      appVersion,
      classifyTransferFailureReason,
      direction,
      failureReasonExportValue,
      getRetryCenterGroupEntriesForExportScope,
      groupedEntries,
      listMode,
      query,
      saveOrCopyText,
      scope,
      setError,
      showAppAlert,
      status,
      timeRange,
      toIsoTimestamp,
      toLogMessage,
      visibleExportEntryByKey,
      writeAppLog
    ]
  );

  const exportRetryCenterGroupHistoryCsv = useCallback(
    async (groupKey: string, exportScope: RetryCenterGroupExportScope = "all") => {
      const group = groupedEntries.find((entry) => entry.key === groupKey);
      if (!group || group.entries.length === 0) {
        await showAppAlert("No visible records in this group to export.", {
          title: "Retry Center"
        });
        return;
      }
      const scopedEntries = getRetryCenterGroupEntriesForExportScope(group, exportScope);
      if (scopedEntries.length === 0) {
        await showAppAlert(`No "${exportScope}" records available in this group.`, {
          title: "Retry Center"
        });
        return;
      }
      try {
        const generatedAtIso = new Date().toISOString();
        const lines: string[] = [];
        lines.push("# TermDock Retry Center Group Export");
        lines.push("# Format: CSV");
        lines.push(`# Generated: ${generatedAtIso}`);
        lines.push(`# AppVersion: ${appVersion}`);
        lines.push(
          `# Filters: scope=${scope}, direction=${direction}, status=${status}, timeRange=${timeRange}, listMode=${listMode}, failureReason=${failureReasonExportValue}, groupExportScope=${exportScope}, query=${query.trim() || "-"}`
        );
        lines.push(
          `# Group: key=${group.key}, label=${group.label}, total=${group.total}, failed=${group.failedCount}, activeSessionFailed=${group.activeSessionFailedCount}, exportedCount=${scopedEntries.length}`
        );
        lines.push("");
        lines.push(
          [
            "key",
            "sessionId",
            "sessionName",
            "groupName",
            "direction",
            "status",
            "name",
            "localPath",
            "remotePath",
            "attemptCount",
            "updatedAt",
            "updatedAtIso",
            "failureReason",
            "message"
          ].join(",")
        );
        for (const entry of scopedEntries) {
          const exportEntry = visibleExportEntryByKey.get(entry.key);
          lines.push(
            [
              entry.key,
              entry.sessionId,
              exportEntry?.sessionName ?? entry.sessionId,
              exportEntry?.groupName ?? "Unknown",
              entry.direction,
              entry.status,
              entry.name,
              entry.localPath,
              entry.remotePath,
              entry.attemptCount,
              entry.updatedAt,
              exportEntry?.updatedAtIso ?? toIsoTimestamp(entry.updatedAt),
              entry.status === "failed" ? classifyTransferFailureReason(entry.message) : "",
              entry.message ?? ""
            ]
              .map((value) => escapeCsvCell(value))
              .join(",")
          );
        }
        const exportText = `${lines.join("\n")}\n`;
        const groupSegment =
          group.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 48) || "group";
        await saveOrCopyText({
          clipboardMessage: "Retry Center group CSV copied to clipboard.",
          defaultFileName: `termdock-retry-center-group-${groupSegment}-${exportScope}-${buildDateSegment(generatedAtIso)}.csv`,
          exportText,
          saveTitle: "Export Retry Center Group (CSV)",
          scopeTitle: "Retry Center group CSV",
          filters: [{ name: "CSV", extensions: ["csv"] }]
        });
      } catch (caughtError) {
        const message = toLogMessage(caughtError);
        setError(message);
        writeAppLog(
          "error",
          "renderer:retry-center",
          "Failed to export retry center group CSV.",
          caughtError
        );
      }
    },
    [
      appVersion,
      classifyTransferFailureReason,
      direction,
      escapeCsvCell,
      failureReasonExportValue,
      getRetryCenterGroupEntriesForExportScope,
      groupedEntries,
      listMode,
      query,
      saveOrCopyText,
      scope,
      setError,
      showAppAlert,
      status,
      timeRange,
      toIsoTimestamp,
      toLogMessage,
      visibleExportEntryByKey,
      writeAppLog
    ]
  );

  const exportRetryCenterGroupHistoryJsonWithScopeChoice = useCallback(
    async (groupKey: string) => {
      const exportScope = await chooseRetryCenterGroupExportScope(groupKey, "json");
      if (!exportScope) {
        return;
      }
      await exportRetryCenterGroupHistoryJson(groupKey, exportScope);
    },
    [chooseRetryCenterGroupExportScope, exportRetryCenterGroupHistoryJson]
  );

  const exportRetryCenterGroupHistoryCsvWithScopeChoice = useCallback(
    async (groupKey: string) => {
      const exportScope = await chooseRetryCenterGroupExportScope(groupKey, "csv");
      if (!exportScope) {
        return;
      }
      await exportRetryCenterGroupHistoryCsv(groupKey, exportScope);
    },
    [chooseRetryCenterGroupExportScope, exportRetryCenterGroupHistoryCsv]
  );

  const exportRetryCenterAnalyticsJson = useCallback(async () => {
    try {
      const generatedAtIso = new Date().toISOString();
      const failedVisibleEntries = visibleExportEntries
        .filter((entry) => entry.status === "failed")
        .slice(0, 40);
      const exportPayload = {
        exportedAtIso: generatedAtIso,
        appVersion,
        filters: {
          scope,
          direction,
          status,
          timeRange,
          listMode,
          failureReason: failureReasonExportValue,
          query: query.trim()
        },
        stats: {
          visibleCount: visibleEntries.length,
          totalHistoryCount,
          selectedCount,
          failedVisibleCount: analytics.failedCount,
          failedVisibleRatioPercent: Number(analytics.failedRatioPercent.toFixed(2)),
          directionCounts: analytics.directionCounts,
          statusCounts: analytics.statusCounts,
          topSessions: analytics.topSessions,
          topGroups: analytics.topGroups,
          topFailureReasons: analytics.topFailureReasons
        },
        samples: {
          latestFailedEntries: failedVisibleEntries
        }
      };
      const exportText = `${JSON.stringify(exportPayload, null, 2)}\n`;
      await saveOrCopyText({
        clipboardMessage: "Retry Center analytics JSON copied to clipboard.",
        defaultFileName: `termdock-retry-center-analytics-${buildScopeSegment(scope)}-${buildDateSegment(generatedAtIso)}.json`,
        exportText,
        saveTitle: "Export Retry Center Analytics (JSON)",
        scopeTitle: "Retry Center analytics JSON",
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:retry-center",
        "Failed to export retry center analytics JSON.",
        caughtError
      );
    }
  }, [
    analytics,
    appVersion,
    direction,
    failureReasonExportValue,
    listMode,
    query,
    saveOrCopyText,
    scope,
    selectedCount,
    setError,
    status,
    timeRange,
    toLogMessage,
    totalHistoryCount,
    visibleEntries.length,
    visibleExportEntries,
    writeAppLog
  ]);

  const exportRetryCenterAnalyticsCsv = useCallback(async () => {
    try {
      const generatedAtIso = new Date().toISOString();
      const lines: string[] = [];
      lines.push("# TermDock Retry Center Analytics");
      lines.push(`# Generated: ${generatedAtIso}`);
      lines.push(`# AppVersion: ${appVersion}`);
      lines.push(
        `# Filters: scope=${scope}, direction=${direction}, status=${status}, timeRange=${timeRange}, listMode=${listMode}, failureReason=${failureReasonExportValue}, query=${query.trim() || "-"}`
      );
      lines.push("");
      lines.push("metric,value");
      lines.push(`visibleCount,${escapeCsvCell(visibleEntries.length)}`);
      lines.push(`totalHistoryCount,${escapeCsvCell(totalHistoryCount)}`);
      lines.push(`selectedCount,${escapeCsvCell(selectedCount)}`);
      lines.push(`failedVisibleCount,${escapeCsvCell(analytics.failedCount)}`);
      lines.push(
        `failedVisibleRatioPercent,${escapeCsvCell(Number(analytics.failedRatioPercent.toFixed(2)))}`
      );
      lines.push("");
      lines.push("direction,count");
      lines.push(`upload,${escapeCsvCell(analytics.directionCounts.upload)}`);
      lines.push(`download,${escapeCsvCell(analytics.directionCounts.download)}`);
      lines.push("");
      lines.push("status,count");
      lines.push(`queued,${escapeCsvCell(analytics.statusCounts.queued)}`);
      lines.push(`running,${escapeCsvCell(analytics.statusCounts.running)}`);
      lines.push(`completed,${escapeCsvCell(analytics.statusCounts.completed)}`);
      lines.push(`failed,${escapeCsvCell(analytics.statusCounts.failed)}`);
      lines.push(`canceled,${escapeCsvCell(analytics.statusCounts.canceled)}`);
      lines.push("");
      lines.push("topSessionId,topSessionName,topGroupName,total,failed");
      if (analytics.topSessions.length === 0) {
        lines.push(["-", "-", "-", 0, 0].map((value) => escapeCsvCell(value)).join(","));
      } else {
        for (const entry of analytics.topSessions) {
          lines.push(
            [entry.sessionId, entry.sessionName, entry.groupName, entry.total, entry.failed]
              .map((value) => escapeCsvCell(value))
              .join(",")
          );
        }
      }
      lines.push("");
      lines.push("topGroupName,total");
      if (analytics.topGroups.length === 0) {
        lines.push(["-", 0].map((value) => escapeCsvCell(value)).join(","));
      } else {
        for (const entry of analytics.topGroups) {
          lines.push([entry.groupName, entry.total].map((value) => escapeCsvCell(value)).join(","));
        }
      }
      lines.push("");
      lines.push("topFailureReason,total");
      if (analytics.topFailureReasons.length === 0) {
        lines.push(["-", 0].map((value) => escapeCsvCell(value)).join(","));
      } else {
        for (const entry of analytics.topFailureReasons) {
          lines.push([entry.reason, entry.total].map((value) => escapeCsvCell(value)).join(","));
        }
      }
      const exportText = `${lines.join("\n")}\n`;
      await saveOrCopyText({
        clipboardMessage: "Retry Center analytics CSV copied to clipboard.",
        defaultFileName: `termdock-retry-center-analytics-${buildScopeSegment(scope)}-${buildDateSegment(generatedAtIso)}.csv`,
        exportText,
        saveTitle: "Export Retry Center Analytics (CSV)",
        scopeTitle: "Retry Center analytics CSV",
        filters: [{ name: "CSV", extensions: ["csv"] }]
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:retry-center",
        "Failed to export retry center analytics CSV.",
        caughtError
      );
    }
  }, [
    analytics,
    appVersion,
    direction,
    escapeCsvCell,
    failureReasonExportValue,
    listMode,
    query,
    saveOrCopyText,
    scope,
    selectedCount,
    setError,
    status,
    timeRange,
    toLogMessage,
    totalHistoryCount,
    visibleEntries.length,
    writeAppLog
  ]);

  return {
    exportRetryCenterAnalyticsCsv,
    exportRetryCenterAnalyticsJson,
    exportRetryCenterGroupHistoryCsvWithScopeChoice,
    exportRetryCenterGroupHistoryJsonWithScopeChoice,
    exportRetryCenterVisibleHistoryCsv,
    exportRetryCenterVisibleHistoryJson
  };
}
