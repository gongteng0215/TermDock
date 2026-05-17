import { useCallback, useMemo } from "react";

type PortForwardEventFilter = "all" | "errors" | "lifecycle" | "status";
type PortForwardEventTimeRange = "all" | "5m" | "30m" | "1h" | "24h";
type PortForwardEventLevel = "info" | "error";
type PortForwardEventType = "created" | "removed" | "statusRecovered" | "statusDegraded";

interface PortForwardPresetLike {
  id: string;
  name: string;
  sessionId: string;
  updatedAt: number;
  autoRestore: boolean;
}

interface PortForwardRecordLike {
  id: string;
  status: string;
  createdAt: string;
  totalConnections: number;
  failedConnections: number;
  lastActivityAt?: string | null;
  lastError?: string | null;
  lastErrorAt?: string | null;
}

interface PortForwardEventLike {
  id: string;
  sessionId: string;
  createdAt: string;
  level: PortForwardEventLevel;
  type: PortForwardEventType;
  errorCode?: string | null;
  correlationKey?: string | null;
  connectionId?: string | null;
  message: string;
}

interface PortForwardEventViewDefaults {
  filter: PortForwardEventFilter;
  timeRange: PortForwardEventTimeRange;
  errorCode: string;
  correlationQuery: string;
}

interface UsePortForwardingViewModelsArgs<
  TPreset extends PortForwardPresetLike,
  TRecord extends PortForwardRecordLike,
  TEvent extends PortForwardEventLike
> {
  activeSessionId: string | null;
  activeTabTitle: string | null;
  defaultEventViewPreferences: PortForwardEventViewDefaults;
  formatPercent: (value: number) => string;
  formatPortForwardEventCorrelation: (event: TEvent) => string;
  formatPortForwardEventSummary: (event: TEvent) => string;
  formatPortForwardEventType: (type: TEvent["type"]) => string;
  formatPortForwardPreset: (preset: TPreset) => string;
  formatPortForwardRecord: (record: TRecord) => string;
  formatPortForwardTimestamp: (isoString?: string) => string;
  getPortForwardStatusLabel: (record: TRecord) => string;
  isActiveTabConnected: boolean;
  portForwardEventCorrelationQuery: string;
  portForwardEventErrorCode: string;
  portForwardEventFilter: PortForwardEventFilter;
  portForwardEventHistory: TEvent[];
  portForwardEventTimeRange: PortForwardEventTimeRange;
  portForwardPresets: TPreset[];
  portForwards: TRecord[];
  resolvePortForwardEventTimeRangeCutoff: (
    range: PortForwardEventTimeRange,
    nowMs: number
  ) => number | null;
  setPortForwardEventCorrelationQuery: (value: string) => void;
  setPortForwardEventErrorCode: (value: string) => void;
  setPortForwardEventFilter: (value: PortForwardEventFilter) => void;
  setPortForwardEventTimeRange: (value: PortForwardEventTimeRange) => void;
}

export function usePortForwardingViewModels<
  TPreset extends PortForwardPresetLike,
  TRecord extends PortForwardRecordLike,
  TEvent extends PortForwardEventLike
>({
  activeSessionId,
  activeTabTitle,
  defaultEventViewPreferences,
  formatPercent,
  formatPortForwardEventCorrelation,
  formatPortForwardEventSummary,
  formatPortForwardEventType,
  formatPortForwardPreset,
  formatPortForwardRecord,
  formatPortForwardTimestamp,
  getPortForwardStatusLabel,
  isActiveTabConnected,
  portForwardEventCorrelationQuery,
  portForwardEventErrorCode,
  portForwardEventFilter,
  portForwardEventHistory,
  portForwardEventTimeRange,
  portForwardPresets,
  portForwards,
  resolvePortForwardEventTimeRangeCutoff,
  setPortForwardEventCorrelationQuery,
  setPortForwardEventErrorCode,
  setPortForwardEventFilter,
  setPortForwardEventTimeRange
}: UsePortForwardingViewModelsArgs<TPreset, TRecord, TEvent>) {
  const activePortForwardPresets = useMemo(() => {
    if (!activeSessionId) {
      return [] as TPreset[];
    }
    return portForwardPresets
      .filter((preset) => preset.sessionId === activeSessionId)
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }, [activeSessionId, portForwardPresets]);

  const activePortForwardEventHistory = useMemo(() => {
    if (!activeSessionId) {
      return [] as TEvent[];
    }
    return portForwardEventHistory
      .filter((entry) => entry.sessionId === activeSessionId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [activeSessionId, portForwardEventHistory]);

  const portForwardEventErrorCodeOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const entry of activePortForwardEventHistory) {
      const code = entry.errorCode?.trim();
      if (code) {
        codes.add(code);
      }
    }
    return ["all", ...Array.from(codes).sort((left, right) => left.localeCompare(right))];
  }, [activePortForwardEventHistory]);

  const visiblePortForwardEventHistory = useMemo(() => {
    let filtered = activePortForwardEventHistory;
    if (portForwardEventFilter === "errors") {
      filtered = filtered.filter((entry) => entry.level === "error");
    } else if (portForwardEventFilter === "lifecycle") {
      filtered = filtered.filter(
        (entry) => entry.type === "created" || entry.type === "removed"
      );
    } else if (portForwardEventFilter === "status") {
      filtered = filtered.filter(
        (entry) =>
          entry.type === "statusDegraded" || entry.type === "statusRecovered"
      );
    }

    const cutoffMs = resolvePortForwardEventTimeRangeCutoff(
      portForwardEventTimeRange,
      Date.now()
    );
    if (cutoffMs !== null) {
      filtered = filtered.filter((entry) => {
        const eventTimeMs = new Date(entry.createdAt).getTime();
        return Number.isFinite(eventTimeMs) && eventTimeMs >= cutoffMs;
      });
    }

    const normalizedErrorCode = portForwardEventErrorCode.trim().toLowerCase();
    if (normalizedErrorCode && normalizedErrorCode !== "all") {
      filtered = filtered.filter(
        (entry) =>
          (entry.errorCode ?? "").trim().toLowerCase() === normalizedErrorCode
      );
    }

    const normalizedCorrelationQuery =
      portForwardEventCorrelationQuery.trim().toLowerCase();
    if (!normalizedCorrelationQuery) {
      return filtered;
    }

    return filtered.filter((entry) => {
      const correlation = (entry.correlationKey ?? "").toLowerCase();
      const connection = (entry.connectionId ?? "").toLowerCase();
      return (
        correlation.includes(normalizedCorrelationQuery) ||
        connection.includes(normalizedCorrelationQuery)
      );
    });
  }, [
    activePortForwardEventHistory,
    portForwardEventErrorCode,
    portForwardEventCorrelationQuery,
    portForwardEventFilter,
    portForwardEventTimeRange,
    resolvePortForwardEventTimeRangeCutoff
  ]);

  const portForwardVisibleEventAnalytics = useMemo(() => {
    const levelCounts: Record<PortForwardEventLevel, number> = {
      info: 0,
      error: 0
    };
    const typeCounts: Record<PortForwardEventType, number> = {
      created: 0,
      removed: 0,
      statusRecovered: 0,
      statusDegraded: 0
    };
    const errorCodeCounts = new Map<string, number>();
    const correlationCounts = new Map<string, number>();
    let earliestTimestampMs: number | null = null;
    let latestTimestampMs: number | null = null;

    for (const event of visiblePortForwardEventHistory) {
      levelCounts[event.level] += 1;
      typeCounts[event.type] += 1;
      const errorCode = event.errorCode?.trim();
      if (errorCode) {
        errorCodeCounts.set(errorCode, (errorCodeCounts.get(errorCode) ?? 0) + 1);
      }
      const correlation = event.correlationKey?.trim();
      if (correlation) {
        correlationCounts.set(correlation, (correlationCounts.get(correlation) ?? 0) + 1);
      }
      const timestampMs = new Date(event.createdAt).getTime();
      if (!Number.isFinite(timestampMs)) {
        continue;
      }
      if (earliestTimestampMs === null || timestampMs < earliestTimestampMs) {
        earliestTimestampMs = timestampMs;
      }
      if (latestTimestampMs === null || timestampMs > latestTimestampMs) {
        latestTimestampMs = timestampMs;
      }
    }

    const topErrorCodes = Array.from(errorCodeCounts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }
        return left.code.localeCompare(right.code);
      })
      .slice(0, 5);
    const topCorrelations = Array.from(correlationCounts.entries())
      .map(([correlationKey, count]) => ({ correlationKey, count }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }
        return left.correlationKey.localeCompare(right.correlationKey);
      })
      .slice(0, 5);
    const totalVisible = visiblePortForwardEventHistory.length;
    const totalErrors = levelCounts.error;
    const errorRatioPercent = totalVisible > 0 ? (totalErrors / totalVisible) * 100 : 0;

    return {
      totalVisible,
      totalErrors,
      errorRatioPercent,
      levelCounts,
      typeCounts,
      topErrorCodes,
      topCorrelations,
      earliestVisibleAt: earliestTimestampMs
        ? new Date(earliestTimestampMs).toISOString()
        : "",
      latestVisibleAt: latestTimestampMs
        ? new Date(latestTimestampMs).toISOString()
        : ""
    };
  }, [visiblePortForwardEventHistory]);

  const hasCustomizedPortForwardEventView =
    portForwardEventFilter !== defaultEventViewPreferences.filter ||
    portForwardEventTimeRange !== defaultEventViewPreferences.timeRange ||
    portForwardEventErrorCode !== defaultEventViewPreferences.errorCode ||
    portForwardEventCorrelationQuery.trim().length > 0;

  const resetPortForwardEventViewFilters = useCallback(() => {
    setPortForwardEventFilter(defaultEventViewPreferences.filter);
    setPortForwardEventTimeRange(defaultEventViewPreferences.timeRange);
    setPortForwardEventErrorCode(defaultEventViewPreferences.errorCode);
    setPortForwardEventCorrelationQuery(defaultEventViewPreferences.correlationQuery);
  }, [
    defaultEventViewPreferences,
    setPortForwardEventCorrelationQuery,
    setPortForwardEventErrorCode,
    setPortForwardEventFilter,
    setPortForwardEventTimeRange
  ]);

  const portForwardActiveTabSummary = activeTabTitle
    ? `${activeTabTitle} (${isActiveTabConnected ? "connected" : "disconnected"})`
    : "None";

  const portForwardPresetViews = useMemo(
    () =>
      activePortForwardPresets.map((preset) => ({
        id: preset.id,
        name: preset.name,
        summary: formatPortForwardPreset(preset),
        updatedAtLabel: new Date(preset.updatedAt).toLocaleString(),
        autoRestore: preset.autoRestore
      })),
    [activePortForwardPresets, formatPortForwardPreset]
  );

  const portForwardRecordViews = useMemo(
    () =>
      portForwards.map((forward) => ({
        id: forward.id,
        title: formatPortForwardRecord(forward),
        statusLabel: getPortForwardStatusLabel(forward),
        statusTone:
          forward.status === "degraded"
            ? ("degraded" as const)
            : ("active" as const),
        createdAtLabel: new Date(forward.createdAt).toLocaleString(),
        connectionsLabel: `Connections ${forward.totalConnections} (failed ${forward.failedConnections})`,
        lastActivityLabel: forward.lastActivityAt
          ? formatPortForwardTimestamp(forward.lastActivityAt)
          : null,
        lastErrorLabel: forward.lastError
          ? `Last error (${formatPortForwardTimestamp(forward.lastErrorAt ?? undefined)}): ${forward.lastError}`
          : null
      })),
    [
      formatPortForwardRecord,
      formatPortForwardTimestamp,
      getPortForwardStatusLabel,
      portForwards
    ]
  );

  const portForwardEventViews = useMemo(
    () =>
      visiblePortForwardEventHistory.map((event) => ({
        id: event.id,
        title: `${formatPortForwardEventType(event.type)} ${formatPortForwardEventSummary(event)}`,
        meta: `${formatPortForwardTimestamp(event.createdAt)} | ${event.level.toUpperCase()}`,
        correlation: formatPortForwardEventCorrelation(event) || null,
        message: event.message,
        isError: event.level === "error"
      })),
    [
      formatPortForwardEventCorrelation,
      formatPortForwardEventSummary,
      formatPortForwardEventType,
      formatPortForwardTimestamp,
      visiblePortForwardEventHistory
    ]
  );

  const portForwardAnalyticsView = useMemo(
    () => ({
      errorRatioLabel: formatPercent(portForwardVisibleEventAnalytics.errorRatioPercent),
      errorsLabel: `Errors ${portForwardVisibleEventAnalytics.totalErrors}/${portForwardVisibleEventAnalytics.totalVisible}`,
      typeBreakdownPrimary: `created ${portForwardVisibleEventAnalytics.typeCounts.created} | removed ${portForwardVisibleEventAnalytics.typeCounts.removed}`,
      typeBreakdownSecondary: `degraded ${portForwardVisibleEventAnalytics.typeCounts.statusDegraded} | recovered ${portForwardVisibleEventAnalytics.typeCounts.statusRecovered}`,
      topErrorCodesLabel:
        portForwardVisibleEventAnalytics.topErrorCodes.length > 0
          ? portForwardVisibleEventAnalytics.topErrorCodes
              .map((entry) => `${entry.code} (${entry.count})`)
              .join(" | ")
          : "No error code data",
      topCorrelationsLabel:
        portForwardVisibleEventAnalytics.topCorrelations.length > 0
          ? portForwardVisibleEventAnalytics.topCorrelations
              .map((entry) => `${entry.correlationKey} (${entry.count})`)
              .join(" | ")
          : "No correlation key data"
    }),
    [formatPercent, portForwardVisibleEventAnalytics]
  );

  const portForwardEventSummaryLabel = `Session history ${activePortForwardEventHistory.length}, visible ${visiblePortForwardEventHistory.length}${
    portForwardEventTimeRange !== "all" ? `, range ${portForwardEventTimeRange}` : ""
  }${portForwardEventErrorCode !== "all" ? `, code ${portForwardEventErrorCode}` : ""}`;

  return {
    activePortForwardEventHistory,
    activePortForwardPresets,
    hasCustomizedPortForwardEventView,
    portForwardActiveTabSummary,
    portForwardAnalyticsView,
    portForwardEventErrorCodeOptions,
    portForwardEventSummaryLabel,
    portForwardEventViews,
    portForwardPresetViews,
    portForwardRecordViews,
    portForwardVisibleEventAnalytics,
    resetPortForwardEventViewFilters,
    visiblePortForwardEventHistory
  };
}
