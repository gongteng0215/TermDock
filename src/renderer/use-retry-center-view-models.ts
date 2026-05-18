import { useMemo } from "react";

import type { SftpTransferEvent } from "../shared/sftp";

type TransferHistoryScope = "activeSession" | "allSessions";
type TransferHistoryDirectionFilter = "all" | SftpTransferEvent["direction"];
type TransferHistoryStatusFilter = "all" | SftpTransferEvent["status"];
type TransferHistoryTimeRange = "all" | "5m" | "30m" | "1h" | "24h";
type RetryCenterListMode = "flat" | "groupedByReason";
type RetryCenterRetryScope = "all" | "upload" | "download";

interface SessionLike {
  id: string;
  name: string;
  groupId?: string | null;
}

interface TransferHistoryEntryLike {
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

interface RetryCenterViewPreferencesLike {
  scope: TransferHistoryScope;
  direction: TransferHistoryDirectionFilter;
  status: TransferHistoryStatusFilter;
  timeRange: TransferHistoryTimeRange;
  listMode: RetryCenterListMode;
  failureReason: string;
  lastRetryScope: RetryCenterRetryScope;
  autoUseLastRetryScope: boolean;
  retryBatchConfirmThreshold: number;
  query: string;
}

interface RetryCenterLabelsLike {
  all: string;
  uploadOnly: string;
  downloadOnly: string;
  allRetryable: string;
}

interface UseRetryCenterViewModelsArgs {
  activeSessionId: string | null;
  activeTabId: string | null;
  autoUseLastRetryScope: boolean;
  classifyTransferFailureReason: (message?: string) => string;
  collapsedGroupKeys: string[];
  defaultViewPreferences: RetryCenterViewPreferencesLike;
  direction: TransferHistoryDirectionFilter;
  failureReasonAllValue: string;
  failureReasonFilter: string;
  getTransferFailureSuggestion: (reason: string) => string | null;
  labels: RetryCenterLabelsLike;
  lastRetryScope: RetryCenterRetryScope;
  listMode: RetryCenterListMode;
  query: string;
  retryBatchConfirmThreshold: number;
  scope: TransferHistoryScope;
  selection: string[];
  sessions: SessionLike[];
  status: TransferHistoryStatusFilter;
  timeRange: TransferHistoryTimeRange;
  toIsoTimestamp: (timestamp: number) => string;
  transferHistory: TransferHistoryEntryLike[];
}

function resolveTransferHistoryTimeRangeCutoff(
  timeRange: TransferHistoryTimeRange,
  now: number
): number | null {
  switch (timeRange) {
    case "5m":
      return now - 5 * 60 * 1000;
    case "30m":
      return now - 30 * 60 * 1000;
    case "1h":
      return now - 60 * 60 * 1000;
    case "24h":
      return now - 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

export function useRetryCenterViewModels({
  activeSessionId,
  activeTabId,
  autoUseLastRetryScope,
  classifyTransferFailureReason,
  collapsedGroupKeys,
  defaultViewPreferences,
  direction,
  failureReasonAllValue,
  failureReasonFilter,
  getTransferFailureSuggestion,
  labels,
  lastRetryScope,
  listMode,
  query,
  retryBatchConfirmThreshold,
  scope,
  selection,
  sessions,
  status,
  timeRange,
  toIsoTimestamp,
  transferHistory
}: UseRetryCenterViewModelsArgs) {
  const retryCenterSessionMetaById = useMemo(() => {
    const map = new Map<string, { sessionName: string; groupName: string }>();
    for (const session of sessions) {
      map.set(session.id, {
        sessionName: session.name.trim() || session.id,
        groupName: session.groupId?.trim() || "Ungrouped"
      });
    }
    return map;
  }, [sessions]);

  const retryCenterEntriesWithoutFailureReasonFilter = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const cutoffMs = resolveTransferHistoryTimeRangeCutoff(timeRange, Date.now());
    const filtered = transferHistory.filter((entry) => {
      if (scope === "activeSession" && (!activeSessionId || entry.sessionId !== activeSessionId)) {
        return false;
      }
      if (direction !== "all" && entry.direction !== direction) {
        return false;
      }
      if (status !== "all" && entry.status !== status) {
        return false;
      }
      if (cutoffMs !== null && entry.updatedAt < cutoffMs) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return (
        entry.name.toLowerCase().includes(normalizedQuery) ||
        entry.localPath.toLowerCase().includes(normalizedQuery) ||
        entry.remotePath.toLowerCase().includes(normalizedQuery) ||
        (entry.message ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
    return filtered.sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 400);
  }, [activeSessionId, direction, query, scope, status, timeRange, transferHistory]);

  const retryCenterFailureReasonOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of retryCenterEntriesWithoutFailureReasonFilter) {
      if (entry.status !== "failed") {
        continue;
      }
      const reason = classifyTransferFailureReason(entry.message);
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([reason, total]) => ({ reason, total }))
      .sort((left, right) => {
        if (right.total !== left.total) {
          return right.total - left.total;
        }
        return left.reason.localeCompare(right.reason);
      })
      .slice(0, 24);
  }, [classifyTransferFailureReason, retryCenterEntriesWithoutFailureReasonFilter]);

  const retryCenterResolvedFailureReasonFilter = useMemo(() => {
    if (failureReasonFilter === failureReasonAllValue) {
      return failureReasonAllValue;
    }
    return retryCenterFailureReasonOptions.some((entry) => entry.reason === failureReasonFilter)
      ? failureReasonFilter
      : failureReasonAllValue;
  }, [failureReasonAllValue, failureReasonFilter, retryCenterFailureReasonOptions]);

  const retryCenterEntries = useMemo(() => {
    if (retryCenterResolvedFailureReasonFilter === failureReasonAllValue) {
      return retryCenterEntriesWithoutFailureReasonFilter;
    }
    return retryCenterEntriesWithoutFailureReasonFilter.filter(
      (entry) =>
        entry.status === "failed" &&
        classifyTransferFailureReason(entry.message) === retryCenterResolvedFailureReasonFilter
    );
  }, [
    classifyTransferFailureReason,
    failureReasonAllValue,
    retryCenterEntriesWithoutFailureReasonFilter,
    retryCenterResolvedFailureReasonFilter
  ]);

  const retryCenterGroupedEntries = useMemo(() => {
    const grouped = new Map<
      string,
      {
        key: string;
        label: string;
        order: number;
        total: number;
        failedCount: number;
        activeSessionFailedCount: number;
        latestUpdatedAt: number;
        entries: TransferHistoryEntryLike[];
      }
    >();
    for (const entry of retryCenterEntries) {
      const groupReason =
        entry.status === "failed"
          ? classifyTransferFailureReason(entry.message)
          : `Status: ${entry.status}`;
      const groupKey = entry.status === "failed" ? `failed:${groupReason}` : `status:${entry.status}`;
      const groupLabel = entry.status === "failed" ? `Failed: ${groupReason}` : groupReason;
      const current = grouped.get(groupKey);
      if (!current) {
        grouped.set(groupKey, {
          key: groupKey,
          label: groupLabel,
          order: entry.status === "failed" ? 0 : 1,
          total: 1,
          failedCount: entry.status === "failed" ? 1 : 0,
          activeSessionFailedCount:
            entry.status === "failed" && !!activeSessionId && entry.sessionId === activeSessionId
              ? 1
              : 0,
          latestUpdatedAt: entry.updatedAt,
          entries: [entry]
        });
        continue;
      }
      current.total += 1;
      current.latestUpdatedAt = Math.max(current.latestUpdatedAt, entry.updatedAt);
      if (entry.status === "failed") {
        current.failedCount += 1;
        if (activeSessionId && entry.sessionId === activeSessionId) {
          current.activeSessionFailedCount += 1;
        }
      }
      current.entries.push(entry);
    }
    return Array.from(grouped.values()).sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }
      if (right.total !== left.total) {
        return right.total - left.total;
      }
      if (right.latestUpdatedAt !== left.latestUpdatedAt) {
        return right.latestUpdatedAt - left.latestUpdatedAt;
      }
      return left.label.localeCompare(right.label);
    });
  }, [activeSessionId, classifyTransferFailureReason, retryCenterEntries]);

  const retryCenterCollapsedGroupKeySet = useMemo(
    () => new Set(collapsedGroupKeys),
    [collapsedGroupKeys]
  );

  const retryCenterAnalytics = useMemo(() => {
    const statusCounts: Record<SftpTransferEvent["status"], number> = {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      canceled: 0
    };
    const directionCounts: Record<SftpTransferEvent["direction"], number> = {
      upload: 0,
      download: 0
    };
    const sessionCounts = new Map<
      string,
      {
        sessionId: string;
        sessionName: string;
        groupName: string;
        total: number;
        failed: number;
      }
    >();
    const groupCounts = new Map<string, number>();
    const failureReasonCounts = new Map<string, number>();
    for (const entry of retryCenterEntries) {
      directionCounts[entry.direction] += 1;
      statusCounts[entry.status] += 1;
      const sessionMeta = retryCenterSessionMetaById.get(entry.sessionId);
      const sessionName = sessionMeta?.sessionName ?? entry.sessionId;
      const groupName = sessionMeta?.groupName ?? "Unknown";
      const currentSessionCount = sessionCounts.get(entry.sessionId);
      if (!currentSessionCount) {
        sessionCounts.set(entry.sessionId, {
          sessionId: entry.sessionId,
          sessionName,
          groupName,
          total: 1,
          failed: entry.status === "failed" ? 1 : 0
        });
      } else {
        currentSessionCount.total += 1;
        if (entry.status === "failed") {
          currentSessionCount.failed += 1;
        }
      }
      if (entry.status === "failed") {
        const failureReason = classifyTransferFailureReason(entry.message);
        failureReasonCounts.set(failureReason, (failureReasonCounts.get(failureReason) ?? 0) + 1);
      }
      groupCounts.set(groupName, (groupCounts.get(groupName) ?? 0) + 1);
    }
    const totalCount = retryCenterEntries.length;
    const failedCount = statusCounts.failed;
    const failedRatioPercent = totalCount > 0 ? (failedCount / totalCount) * 100 : 0;
    const topSessions = Array.from(sessionCounts.values())
      .sort((left, right) => {
        if (right.total !== left.total) {
          return right.total - left.total;
        }
        if (right.failed !== left.failed) {
          return right.failed - left.failed;
        }
        return left.sessionName.localeCompare(right.sessionName);
      })
      .slice(0, 3);
    const topGroups = Array.from(groupCounts.entries())
      .map(([groupName, total]) => ({ groupName, total }))
      .sort((left, right) => {
        if (right.total !== left.total) {
          return right.total - left.total;
        }
        return left.groupName.localeCompare(right.groupName);
      })
      .slice(0, 3);
    const topFailureReasons = Array.from(failureReasonCounts.entries())
      .map(([reason, total]) => ({ reason, total }))
      .sort((left, right) => {
        if (right.total !== left.total) {
          return right.total - left.total;
        }
        return left.reason.localeCompare(right.reason);
      })
      .slice(0, 5);
    return {
      totalCount,
      failedCount,
      failedRatioPercent,
      directionCounts,
      statusCounts,
      topSessions,
      topGroups,
      topFailureReasons
    };
  }, [classifyTransferFailureReason, retryCenterEntries, retryCenterSessionMetaById]);

  const retryCenterVisibleExportEntries = useMemo(
    () =>
      retryCenterEntries.map((entry) => {
        const sessionMeta = retryCenterSessionMetaById.get(entry.sessionId);
        return {
          key: entry.key,
          sessionId: entry.sessionId,
          sessionName: sessionMeta?.sessionName ?? entry.sessionId,
          groupName: sessionMeta?.groupName ?? "Unknown",
          direction: entry.direction,
          status: entry.status,
          name: entry.name,
          localPath: entry.localPath,
          remotePath: entry.remotePath,
          attemptCount: entry.attemptCount,
          updatedAt: entry.updatedAt,
          updatedAtIso: toIsoTimestamp(entry.updatedAt),
          message: entry.message ?? ""
        };
      }),
    [retryCenterEntries, retryCenterSessionMetaById, toIsoTimestamp]
  );

  const retryCenterVisibleExportEntryByKey = useMemo(() => {
    const next = new Map<string, (typeof retryCenterVisibleExportEntries)[number]>();
    for (const entry of retryCenterVisibleExportEntries) {
      next.set(entry.key, entry);
    }
    return next;
  }, [retryCenterVisibleExportEntries]);

  const retryCenterSelectionSet = useMemo(() => new Set(selection), [selection]);

  const selectedRetryCenterEntries = useMemo(
    () => retryCenterEntries.filter((entry) => retryCenterSelectionSet.has(entry.key)),
    [retryCenterEntries, retryCenterSelectionSet]
  );

  const selectedRetryCenterFailedEntries = useMemo(
    () =>
      selectedRetryCenterEntries.filter(
        (entry) => entry.status === "failed" && !!activeSessionId && entry.sessionId === activeSessionId
      ),
    [activeSessionId, selectedRetryCenterEntries]
  );

  const visibleRetryCenterFailedEntries = useMemo(
    () =>
      retryCenterEntries.filter(
        (entry) => entry.status === "failed" && !!activeSessionId && entry.sessionId === activeSessionId
      ),
    [activeSessionId, retryCenterEntries]
  );

  const visibleRetryCenterFailedReasonCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of visibleRetryCenterFailedEntries) {
      const reason = classifyTransferFailureReason(entry.message);
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
    return counts;
  }, [classifyTransferFailureReason, visibleRetryCenterFailedEntries]);

  const retryCenterTopFailureReasonRetryRows = useMemo(
    () =>
      retryCenterAnalytics.topFailureReasons.map((entry) => ({
        reason: entry.reason,
        totalVisible: entry.total,
        activeSessionVisibleFailed: visibleRetryCenterFailedReasonCounts.get(entry.reason) ?? 0,
        isCurrentFilter:
          retryCenterResolvedFailureReasonFilter !== failureReasonAllValue &&
          retryCenterResolvedFailureReasonFilter === entry.reason
      })),
    [
      failureReasonAllValue,
      retryCenterAnalytics.topFailureReasons,
      retryCenterResolvedFailureReasonFilter,
      visibleRetryCenterFailedReasonCounts
    ]
  );

  const retryCenterFailureSuggestionRows = useMemo(
    () =>
      retryCenterTopFailureReasonRetryRows
        .map((entry) => ({
          reason: entry.reason,
          suggestion: getTransferFailureSuggestion(entry.reason)
        }))
        .filter(
          (entry): entry is { reason: string; suggestion: string } =>
            typeof entry.suggestion === "string" && entry.suggestion.length > 0
        ),
    [getTransferFailureSuggestion, retryCenterTopFailureReasonRetryRows]
  );

  const isRetryCenterGroupedView = listMode === "groupedByReason";
  const canRetrySelectedRetryCenterEntries =
    !!activeTabId && selectedRetryCenterFailedEntries.length > 0;
  const canRetryVisibleRetryCenterEntries =
    !!activeTabId && visibleRetryCenterFailedEntries.length > 0;
  const canClearSelectedRetryCenterEntries = selectedRetryCenterEntries.length > 0;
  const canClearVisibleRetryCenterEntries = retryCenterEntries.length > 0;
  const canClearAllRetryCenterEntries = transferHistory.length > 0;
  const canExportRetryCenterAnalytics = transferHistory.length > 0;
  const canCollapseAllRetryCenterGroups =
    retryCenterGroupedEntries.length > 0 &&
    retryCenterGroupedEntries.some((entry) => !retryCenterCollapsedGroupKeySet.has(entry.key));
  const canExpandAllRetryCenterGroups =
    retryCenterGroupedEntries.length > 0 &&
    retryCenterGroupedEntries.some((entry) => retryCenterCollapsedGroupKeySet.has(entry.key));

  const retryCenterSelectedFailureReasonLabel =
    retryCenterResolvedFailureReasonFilter === failureReasonAllValue
      ? labels.all
      : retryCenterResolvedFailureReasonFilter;

  const retryCenterFailureReasonExportValue =
    retryCenterResolvedFailureReasonFilter === failureReasonAllValue
      ? "all"
      : retryCenterResolvedFailureReasonFilter;

  const retryCenterLastRetryScopeLabel =
    lastRetryScope === "upload"
      ? labels.uploadOnly
      : lastRetryScope === "download"
        ? labels.downloadOnly
        : labels.allRetryable;

  const hasCustomizedRetryCenterView =
    scope !== defaultViewPreferences.scope ||
    direction !== defaultViewPreferences.direction ||
    status !== defaultViewPreferences.status ||
    timeRange !== defaultViewPreferences.timeRange ||
    listMode !== defaultViewPreferences.listMode ||
    retryCenterResolvedFailureReasonFilter !== defaultViewPreferences.failureReason ||
    lastRetryScope !== defaultViewPreferences.lastRetryScope ||
    autoUseLastRetryScope !== defaultViewPreferences.autoUseLastRetryScope ||
    retryBatchConfirmThreshold !== defaultViewPreferences.retryBatchConfirmThreshold ||
    query.trim().length > 0;

  return {
    canClearAllRetryCenterEntries,
    canClearSelectedRetryCenterEntries,
    canClearVisibleRetryCenterEntries,
    canCollapseAllRetryCenterGroups,
    canExpandAllRetryCenterGroups,
    canExportRetryCenterAnalytics,
    canRetrySelectedRetryCenterEntries,
    canRetryVisibleRetryCenterEntries,
    hasCustomizedRetryCenterView,
    isRetryCenterGroupedView,
    retryCenterAnalytics,
    retryCenterCollapsedGroupKeySet,
    retryCenterEntries,
    retryCenterFailureReasonExportValue,
    retryCenterFailureReasonOptions,
    retryCenterFailureSuggestionRows,
    retryCenterGroupedEntries,
    retryCenterLastRetryScopeLabel,
    retryCenterResolvedFailureReasonFilter,
    retryCenterSelectedFailureReasonLabel,
    retryCenterSelectionSet,
    retryCenterTopFailureReasonRetryRows,
    retryCenterVisibleExportEntryByKey,
    retryCenterVisibleExportEntries,
    selectedRetryCenterEntries,
    selectedRetryCenterFailedEntries,
    visibleRetryCenterFailedEntries
  };
}
