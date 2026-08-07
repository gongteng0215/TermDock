import { useMemo } from "react";

import type { SftpTransferEvent } from "../shared/sftp";

interface SftpTransferLike extends SftpTransferEvent {
  transferId: string;
  tabId: string;
  createdAt: number;
  updatedAt: number;
  batchId?: string;
}

interface SftpTransferHistoryItemLike {
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

interface TransferBatchLike {
  batchId: string;
  total: number;
}

interface TerminalTabLike {
  id: string;
  title: string;
}

interface PortForwardRecordLike {
  id: string;
  tabId: string;
  status: string;
  createdAt: string;
  totalConnections: number;
  failedConnections: number;
  lastActivityAt?: string | null;
  lastError?: string | null;
  lastErrorAt?: string | null;
}

interface PortForwardEventLike {
  key: string;
  tabId: string;
  createdAt: string;
  level: "info" | "error";
  type: string;
  message: string;
}

interface OperationCenterAppJobLike {
  id: string;
  category: "sessions" | "snippets" | "diagnostics";
  title: string;
  description: string;
  status: "running" | "succeeded" | "failed" | "canceled";
  startedAt: number;
  finishedAt?: number;
  detail?: string;
  outputPath?: string;
}

interface DeleteProgressLike {
  kind: "file" | "directory" | "symlink" | "other";
  name: string;
  path?: string;
  tabId?: string;
}

interface UseSftpActivityViewModelsArgs<
  TTransfer extends SftpTransferLike,
  TPortForwardRecord extends PortForwardRecordLike,
  TPortForwardEvent extends PortForwardEventLike,
  TTerminalTab extends TerminalTabLike,
  TOperationCenterAppJob extends OperationCenterAppJobLike
> {
  activePortForwardStatusMessage: string | null;
  activeSessionId: string | null;
  activeTabId: string | null;
  allPortForwards: TPortForwardRecord[];
  connectedTabIds: Set<string>;
  createTransferRetryKey: (
    direction: SftpTransferEvent["direction"],
    localPath: string,
    remotePath: string
  ) => string;
  formatHistoryTimestamp: (timestamp: number) => string;
  formatOperationCenterAppJobCategoryLabel: (
    category: TOperationCenterAppJob["category"]
  ) => string;
  formatOperationCenterAppJobDuration: (
    startedAt: number,
    finishedAt?: number
  ) => string;
  formatOperationCenterAppJobStatusLabel: (
    status: TOperationCenterAppJob["status"]
  ) => string;
  formatOperationCenterTransferStatus: (status: TTransfer["status"]) => string;
  formatPortForwardEventSummary: (event: TPortForwardEvent) => string;
  formatPortForwardEventType: (type: TPortForwardEvent["type"]) => string;
  formatPortForwardRecord: (record: TPortForwardRecord) => string;
  formatPortForwardTimestamp: (isoString?: string) => string;
  getOperationCenterAppJobStateClass: (
    status: TOperationCenterAppJob["status"]
  ) => string;
  getOperationCenterTransferStateClass: (status: TTransfer["status"]) => string;
  getPortForwardStatusLabel: (record: TPortForwardRecord) => string;
  operationCenterAppJobs: TOperationCenterAppJob[];
  portForwardBusy: boolean;
  portForwardEventHistory: TPortForwardEvent[];
  sftpDeleteProgress: DeleteProgressLike | null;
  sftpTransfers: TTransfer[];
  terminalTabs: TTerminalTab[];
  transferHistory: SftpTransferHistoryItemLike[];
  uploadBatchByTab: Record<string, TransferBatchLike>;
  downloadBatchByTab: Record<string, TransferBatchLike>;
}

function countTransferStatuses<TTransfer extends SftpTransferLike>(transfers: TTransfer[]) {
  return {
    total: transfers.length,
    queued: transfers.filter((transfer) => transfer.status === "queued").length,
    running: transfers.filter((transfer) => transfer.status === "running").length,
    completed: transfers.filter((transfer) => transfer.status === "completed").length,
    failed: transfers.filter((transfer) => transfer.status === "failed").length,
    canceled: transfers.filter((transfer) => transfer.status === "canceled").length
  };
}

function getTransferDisplayPriority(status: SftpTransferEvent["status"]): number {
  if (status === "running") {
    return 0;
  }
  if (status === "queued") {
    return 1;
  }
  if (status === "failed") {
    return 2;
  }
  return 3;
}

function selectVisibleTransfers<TTransfer extends SftpTransferLike>(
  transfers: TTransfer[],
  tabId: string,
  direction: SftpTransferEvent["direction"]
): TTransfer[] {
  return transfers
    .filter((transfer) => transfer.tabId === tabId && transfer.direction === direction)
    .sort((left, right) => {
      const priorityDifference =
        getTransferDisplayPriority(left.status) - getTransferDisplayPriority(right.status);
      return priorityDifference !== 0 ? priorityDifference : right.updatedAt - left.updatedAt;
    })
    .slice(0, 10);
}

function buildRetryCandidates<
  TTransfer extends Pick<SftpTransferLike, "localPath" | "remotePath" | "updatedAt" | "name">,
  THistory extends Pick<
    SftpTransferHistoryItemLike,
    "localPath" | "remotePath" | "updatedAt" | "name"
  >
>(
  direction: SftpTransferEvent["direction"],
  runtimeTransfers: TTransfer[],
  historyTransfers: THistory[],
  createTransferRetryKey: (
    direction: SftpTransferEvent["direction"],
    localPath: string,
    remotePath: string
  ) => string
) {
  const dedup = new Set<string>();
  const targets: Array<{
    name: string;
    localPath: string;
    remotePath: string;
  }> = [];

  const pushTarget = (transfer: {
    name: string;
    localPath: string;
    remotePath: string;
  }) => {
    const key = createTransferRetryKey(
      direction,
      transfer.localPath.trim(),
      transfer.remotePath.trim()
    );
    if (dedup.has(key)) {
      return;
    }
    dedup.add(key);
    targets.push({
      name: transfer.name,
      localPath: transfer.localPath,
      remotePath: transfer.remotePath
    });
  };

  for (const transfer of [...runtimeTransfers].sort((left, right) => left.updatedAt - right.updatedAt)) {
    pushTarget(transfer);
  }
  for (const transfer of [...historyTransfers].sort((left, right) => left.updatedAt - right.updatedAt)) {
    pushTarget(transfer);
  }

  return targets;
}

export function useSftpActivityViewModels<
  TTransfer extends SftpTransferLike,
  TPortForwardRecord extends PortForwardRecordLike,
  TPortForwardEvent extends PortForwardEventLike,
  TTerminalTab extends TerminalTabLike,
  TOperationCenterAppJob extends OperationCenterAppJobLike
>({
  activePortForwardStatusMessage,
  activeSessionId,
  activeTabId,
  allPortForwards,
  connectedTabIds,
  createTransferRetryKey,
  formatHistoryTimestamp,
  formatOperationCenterAppJobCategoryLabel,
  formatOperationCenterAppJobDuration,
  formatOperationCenterAppJobStatusLabel,
  formatOperationCenterTransferStatus,
  formatPortForwardEventSummary,
  formatPortForwardEventType,
  formatPortForwardRecord,
  formatPortForwardTimestamp,
  getOperationCenterAppJobStateClass,
  getOperationCenterTransferStateClass,
  getPortForwardStatusLabel,
  operationCenterAppJobs,
  portForwardBusy,
  portForwardEventHistory,
  sftpDeleteProgress,
  sftpTransfers,
  terminalTabs,
  transferHistory,
  uploadBatchByTab,
  downloadBatchByTab
}: UseSftpActivityViewModelsArgs<
  TTransfer,
  TPortForwardRecord,
  TPortForwardEvent,
  TTerminalTab,
  TOperationCenterAppJob
>) {
  const activeUploadTransfers = useMemo(() => {
    if (!activeTabId) {
      return [] as TTransfer[];
    }
    return selectVisibleTransfers(sftpTransfers, activeTabId, "upload");
  }, [activeTabId, sftpTransfers]);

  const failedUploadTransfers = useMemo(() => {
    if (!activeTabId) {
      return [] as TTransfer[];
    }
    return sftpTransfers.filter(
      (transfer) =>
        transfer.tabId === activeTabId &&
        transfer.direction === "upload" &&
        transfer.status === "failed"
    );
  }, [activeTabId, sftpTransfers]);

  const activeDownloadTransfers = useMemo(() => {
    if (!activeTabId) {
      return [] as TTransfer[];
    }
    return selectVisibleTransfers(sftpTransfers, activeTabId, "download");
  }, [activeTabId, sftpTransfers]);

  const failedDownloadTransfers = useMemo(() => {
    if (!activeTabId) {
      return [] as TTransfer[];
    }
    return sftpTransfers.filter(
      (transfer) =>
        transfer.tabId === activeTabId &&
        transfer.direction === "download" &&
        transfer.status === "failed"
    );
  }, [activeTabId, sftpTransfers]);

  const failedUploadHistory = useMemo(() => {
    if (!activeSessionId) {
      return [] as SftpTransferHistoryItemLike[];
    }
    return transferHistory.filter(
      (entry) =>
        entry.sessionId === activeSessionId &&
        entry.direction === "upload" &&
        entry.status === "failed"
    );
  }, [activeSessionId, transferHistory]);

  const failedDownloadHistory = useMemo(() => {
    if (!activeSessionId) {
      return [] as SftpTransferHistoryItemLike[];
    }
    return transferHistory.filter(
      (entry) =>
        entry.sessionId === activeSessionId &&
        entry.direction === "download" &&
        entry.status === "failed"
    );
  }, [activeSessionId, transferHistory]);

  const failedUploadRetryCandidates = useMemo(
    () =>
      buildRetryCandidates(
        "upload",
        failedUploadTransfers,
        failedUploadHistory,
        createTransferRetryKey
      ),
    [createTransferRetryKey, failedUploadHistory, failedUploadTransfers]
  );

  const failedDownloadRetryCandidates = useMemo(
    () =>
      buildRetryCandidates(
        "download",
        failedDownloadTransfers,
        failedDownloadHistory,
        createTransferRetryKey
      ),
    [createTransferRetryKey, failedDownloadHistory, failedDownloadTransfers]
  );

  const activeUploadQueueStats = useMemo(() => {
    if (!activeTabId) {
      return {
        total: 0,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        canceled: 0
      };
    }
    return countTransferStatuses(
      sftpTransfers.filter(
        (transfer) => transfer.tabId === activeTabId && transfer.direction === "upload"
      )
    );
  }, [activeTabId, sftpTransfers]);

  const activeUploadBatchProgress = useMemo(() => {
    if (!activeTabId) {
      return null;
    }
    const batch = uploadBatchByTab[activeTabId];
    if (!batch) {
      return null;
    }
    const batchTransfers = sftpTransfers.filter(
      (transfer) =>
        transfer.tabId === activeTabId &&
        transfer.direction === "upload" &&
        transfer.batchId === batch.batchId
    );
    const counts = countTransferStatuses(batchTransfers);
    const processed = counts.completed + counts.failed + counts.canceled;
    return {
      ...batch,
      ...counts,
      processed,
      done: batch.total > 0 && processed >= batch.total
    };
  }, [activeTabId, sftpTransfers, uploadBatchByTab]);

  const activeUploadProgressStats = useMemo(() => {
    if (activeUploadBatchProgress) {
      return {
        completed: activeUploadBatchProgress.completed,
        total: activeUploadBatchProgress.total,
        failed: activeUploadBatchProgress.failed,
        canceled: activeUploadBatchProgress.canceled,
        running: activeUploadBatchProgress.running,
        queued: activeUploadBatchProgress.queued
      };
    }
    return {
      completed: activeUploadQueueStats.completed,
      total: activeUploadQueueStats.total,
      failed: activeUploadQueueStats.failed,
      canceled: activeUploadQueueStats.canceled,
      running: activeUploadQueueStats.running,
      queued: activeUploadQueueStats.queued
    };
  }, [activeUploadBatchProgress, activeUploadQueueStats]);

  const activeDownloadQueueStats = useMemo(() => {
    if (!activeTabId) {
      return {
        total: 0,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        canceled: 0
      };
    }
    return countTransferStatuses(
      sftpTransfers.filter(
        (transfer) => transfer.tabId === activeTabId && transfer.direction === "download"
      )
    );
  }, [activeTabId, sftpTransfers]);

  const activeDownloadBatchProgress = useMemo(() => {
    if (!activeTabId) {
      return null;
    }
    const batch = downloadBatchByTab[activeTabId];
    if (!batch) {
      return null;
    }
    const batchTransfers = sftpTransfers.filter(
      (transfer) =>
        transfer.tabId === activeTabId &&
        transfer.direction === "download" &&
        transfer.batchId === batch.batchId
    );
    const counts = countTransferStatuses(batchTransfers);
    const processed = counts.completed + counts.failed + counts.canceled;
    return {
      ...batch,
      ...counts,
      processed,
      done: batch.total > 0 && processed >= batch.total
    };
  }, [activeTabId, downloadBatchByTab, sftpTransfers]);

  const activeDownloadProgressStats = useMemo(() => {
    if (activeDownloadBatchProgress) {
      return {
        completed: activeDownloadBatchProgress.completed,
        total: activeDownloadBatchProgress.total,
        failed: activeDownloadBatchProgress.failed,
        canceled: activeDownloadBatchProgress.canceled,
        running: activeDownloadBatchProgress.running,
        queued: activeDownloadBatchProgress.queued
      };
    }
    return {
      completed: activeDownloadQueueStats.completed,
      total: activeDownloadQueueStats.total,
      failed: activeDownloadQueueStats.failed,
      canceled: activeDownloadQueueStats.canceled,
      running: activeDownloadQueueStats.running,
      queued: activeDownloadQueueStats.queued
    };
  }, [activeDownloadBatchProgress, activeDownloadQueueStats]);

  const operationCenterUploadSummary = useMemo(() => {
    const openTabIds = new Set(terminalTabs.map((tab) => tab.id));
    const relevantTransfers = sftpTransfers.filter(
      (transfer) =>
        transfer.direction === "upload" &&
        (openTabIds.has(transfer.tabId) || Boolean(transfer.syncRunId))
    );
    return {
      ...countTransferStatuses(relevantTransfers),
      activeTabCount: new Set(relevantTransfers.map((transfer) => transfer.tabId)).size
    };
  }, [sftpTransfers, terminalTabs]);

  const operationCenterDownloadSummary = useMemo(() => {
    const openTabIds = new Set(terminalTabs.map((tab) => tab.id));
    const relevantTransfers = sftpTransfers.filter(
      (transfer) =>
        transfer.direction === "download" &&
        (openTabIds.has(transfer.tabId) || Boolean(transfer.syncRunId))
    );
    return {
      ...countTransferStatuses(relevantTransfers),
      activeTabCount: new Set(relevantTransfers.map((transfer) => transfer.tabId)).size
    };
  }, [sftpTransfers, terminalTabs]);

  const operationCenterPortForwardSummary = useMemo(() => {
    const tabIds = new Set(allPortForwards.map((entry) => entry.tabId));
    const degraded = allPortForwards.filter((entry) => entry.status === "degraded").length;
    return {
      total: allPortForwards.length,
      degraded,
      activeTabCount: tabIds.size,
      activeTabStatus: activePortForwardStatusMessage
    };
  }, [activePortForwardStatusMessage, allPortForwards]);

  const canClearFinishedUploads =
    !!activeTabId &&
    activeUploadQueueStats.completed + activeUploadQueueStats.failed + activeUploadQueueStats.canceled >
      0;
  const canClearFinishedDownloads =
    !!activeTabId &&
    activeDownloadQueueStats.completed +
      activeDownloadQueueStats.failed +
      activeDownloadQueueStats.canceled >
      0;
  const canRetryFailedUploads = !!activeTabId && failedUploadRetryCandidates.length > 0;
  const canRetryFailedDownloads = !!activeTabId && failedDownloadRetryCandidates.length > 0;
  const failedRetryCandidateTotal =
    failedUploadRetryCandidates.length + failedDownloadRetryCandidates.length;
  const canRetryAllFailedTransfers = !!activeTabId && failedRetryCandidateTotal > 0;

  const operationCenterTransferTabSummaries = useMemo(() => {
    const byTabId = new Map<
      string,
      {
        tabId: string;
        title: string;
        connected: boolean;
        uploadRunning: number;
        uploadQueued: number;
        downloadRunning: number;
        downloadQueued: number;
        totalActive: number;
      }
    >();
    for (const tab of terminalTabs) {
      byTabId.set(tab.id, {
        tabId: tab.id,
        title: tab.title,
        connected: connectedTabIds.has(tab.id),
        uploadRunning: 0,
        uploadQueued: 0,
        downloadRunning: 0,
        downloadQueued: 0,
        totalActive: 0
      });
    }
    for (const transfer of sftpTransfers) {
      if (transfer.status !== "queued" && transfer.status !== "running") {
        continue;
      }
      const current = byTabId.get(transfer.tabId) ?? {
        tabId: transfer.tabId,
        title: transfer.syncRunId ? "Background Sync" : transfer.tabId,
        connected: connectedTabIds.has(transfer.tabId),
        uploadRunning: 0,
        uploadQueued: 0,
        downloadRunning: 0,
        downloadQueued: 0,
        totalActive: 0
      };
      if (transfer.direction === "upload") {
        if (transfer.status === "running") {
          current.uploadRunning += 1;
        } else {
          current.uploadQueued += 1;
        }
      } else if (transfer.status === "running") {
        current.downloadRunning += 1;
      } else {
        current.downloadQueued += 1;
      }
      byTabId.set(transfer.tabId, current);
    }
    return Array.from(byTabId.values())
      .map((entry) => ({
        ...entry,
        totalActive:
          entry.uploadRunning +
          entry.uploadQueued +
          entry.downloadRunning +
          entry.downloadQueued
      }))
      .filter((entry) => entry.totalActive > 0)
      .sort((left, right) => {
        if (right.totalActive !== left.totalActive) {
          return right.totalActive - left.totalActive;
        }
        return left.title.localeCompare(right.title);
      })
      .slice(0, 12);
  }, [connectedTabIds, sftpTransfers, terminalTabs]);

  const operationCenterRecentAppJobs = useMemo(
    () =>
      [...operationCenterAppJobs]
        .sort((left, right) => {
          const rightTime = right.finishedAt ?? right.startedAt;
          const leftTime = left.finishedAt ?? left.startedAt;
          return rightTime - leftTime;
        })
        .slice(0, 8),
    [operationCenterAppJobs]
  );

  const operationCenterRunningAppJobCount = useMemo(
    () => operationCenterAppJobs.filter((entry) => entry.status === "running").length,
    [operationCenterAppJobs]
  );

  const operationCenterRecentAppJobViews = useMemo(
    () =>
      operationCenterRecentAppJobs.map((job) => ({
        id: job.id,
        title: job.title,
        categoryLabel: formatOperationCenterAppJobCategoryLabel(job.category),
        startedAtLabel: formatHistoryTimestamp(job.startedAt),
        durationLabel: formatOperationCenterAppJobDuration(job.startedAt, job.finishedAt),
        detail: job.detail?.trim() || job.description,
        outputPath: job.outputPath,
        stateClassName: getOperationCenterAppJobStateClass(job.status),
        stateLabel: formatOperationCenterAppJobStatusLabel(job.status),
        canCancel: job.status === "running"
      })),
    [
      formatHistoryTimestamp,
      formatOperationCenterAppJobCategoryLabel,
      formatOperationCenterAppJobDuration,
      formatOperationCenterAppJobStatusLabel,
      getOperationCenterAppJobStateClass,
      operationCenterRecentAppJobs
    ]
  );

  const operationCenterDeleteProgressLabel = sftpDeleteProgress
    ? `Deleting ${sftpDeleteProgress.kind === "directory" ? "directory" : "file"} "${sftpDeleteProgress.name}"...`
    : null;

  const operationCenterTimelineItems = useMemo(() => {
    const timelineItems: Array<{
      id: string;
      title: string;
      meta: string;
      detail: string;
      stateClassName: string;
      stateLabel: string;
      timestamp: number;
    }> = [];
    const tabTitleById = new Map(terminalTabs.map((tab) => [tab.id, tab.title]));

    for (const transfer of sftpTransfers.slice(0, 18)) {
      if (!tabTitleById.has(transfer.tabId) && !transfer.syncRunId) {
        continue;
      }
      const directionLabel = transfer.direction === "upload" ? "Upload" : "Download";
      const tabTitle = tabTitleById.get(transfer.tabId) ?? (transfer.syncRunId ? "Background Sync" : transfer.tabId);
      const route =
        transfer.direction === "upload"
          ? `${transfer.localPath} -> ${transfer.remotePath}`
          : `${transfer.remotePath} -> ${transfer.localPath}`;
      const message = transfer.message?.trim();
      timelineItems.push({
        id: `transfer:${transfer.transferId}:${transfer.updatedAt}`,
        title: `${directionLabel}: ${transfer.name || "transfer"}`,
        meta: `${tabTitle} | ${formatHistoryTimestamp(transfer.updatedAt)}`,
        detail: message ? `${route} | ${message}` : route,
        stateClassName: getOperationCenterTransferStateClass(transfer.status),
        stateLabel: formatOperationCenterTransferStatus(transfer.status),
        timestamp: transfer.updatedAt
      });
    }

    if (sftpDeleteProgress) {
      timelineItems.push({
        id: `delete:${sftpDeleteProgress.name}:${Date.now()}`,
        title: "Remote Delete",
        meta: "Active now",
        detail: operationCenterDeleteProgressLabel ?? "Delete operation running.",
        stateClassName: "operation-center__state is-active",
        stateLabel: "Running",
        timestamp: Date.now()
      });
    }

    for (const forward of allPortForwards.slice(0, 12)) {
      const createdAt = new Date(forward.lastActivityAt ?? forward.lastErrorAt ?? forward.createdAt);
      const timestamp = Number.isFinite(createdAt.getTime()) ? createdAt.getTime() : 0;
      timelineItems.push({
        id: `port-forward:${forward.tabId}:${forward.id}:${forward.status}`,
        title: `Port Forward: ${formatPortForwardRecord(forward)}`,
        meta: `${tabTitleById.get(forward.tabId) ?? forward.tabId} | ${formatPortForwardTimestamp(
          forward.lastActivityAt ?? forward.lastErrorAt ?? forward.createdAt
        )}`,
        detail:
          forward.lastError?.trim() ||
          `connections ${forward.totalConnections} | failed ${forward.failedConnections}`,
        stateClassName:
          forward.status === "degraded"
            ? "operation-center__state is-failed"
            : "operation-center__state is-active",
        stateLabel: getPortForwardStatusLabel(forward),
        timestamp
      });
    }

    for (const event of portForwardEventHistory.slice(0, 12)) {
      if (!tabTitleById.has(event.tabId)) {
        continue;
      }
      const createdAt = new Date(event.createdAt);
      const timestamp = Number.isFinite(createdAt.getTime()) ? createdAt.getTime() : 0;
      timelineItems.push({
        id: `port-forward-event:${event.key}`,
        title: `${formatPortForwardEventType(event.type)} ${formatPortForwardEventSummary(event)}`,
        meta: `${formatPortForwardTimestamp(event.createdAt)} | ${event.level.toUpperCase()}`,
        detail: event.message,
        stateClassName:
          event.level === "error"
            ? "operation-center__state is-failed"
            : "operation-center__state is-success",
        stateLabel: event.level === "error" ? "Error" : "Event",
        timestamp
      });
    }

    for (const job of operationCenterRecentAppJobs) {
      timelineItems.push({
        id: `app-job:${job.id}:${job.finishedAt ?? job.startedAt}`,
        title: job.title,
        meta: `${formatOperationCenterAppJobCategoryLabel(job.category)} | ${formatHistoryTimestamp(
          job.finishedAt ?? job.startedAt
        )}`,
        detail: job.detail?.trim() || job.description,
        stateClassName: getOperationCenterAppJobStateClass(job.status),
        stateLabel: formatOperationCenterAppJobStatusLabel(job.status),
        timestamp: job.finishedAt ?? job.startedAt
      });
    }

    return timelineItems
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, 10)
      .map((item) => ({
        id: item.id,
        title: item.title,
        meta: item.meta,
        detail: item.detail,
        stateClassName: item.stateClassName,
        stateLabel: item.stateLabel
      }));
  }, [
    allPortForwards,
    formatHistoryTimestamp,
    formatOperationCenterAppJobCategoryLabel,
    formatOperationCenterAppJobStatusLabel,
    formatOperationCenterTransferStatus,
    formatPortForwardEventSummary,
    formatPortForwardEventType,
    formatPortForwardRecord,
    formatPortForwardTimestamp,
    getOperationCenterAppJobStateClass,
    getOperationCenterTransferStateClass,
    getPortForwardStatusLabel,
    operationCenterDeleteProgressLabel,
    operationCenterRecentAppJobs,
    portForwardEventHistory,
    sftpDeleteProgress,
    sftpTransfers,
    terminalTabs
  ]);

  const operationCenterFinishedAppJobCount = useMemo(
    () => operationCenterAppJobs.filter((entry) => entry.status !== "running").length,
    [operationCenterAppJobs]
  );

  const hasOperationCenterSnippetJobs = useMemo(
    () => operationCenterAppJobs.some((entry) => entry.category === "snippets"),
    [operationCenterAppJobs]
  );

  const hasOperationCenterDiagnosticsJobs = useMemo(
    () => operationCenterAppJobs.some((entry) => entry.category === "diagnostics"),
    [operationCenterAppJobs]
  );

  const operationCenterActiveCount =
    operationCenterTransferTabSummaries.length +
    (sftpDeleteProgress ? 1 : 0) +
    (portForwardBusy ? 1 : 0) +
    operationCenterRunningAppJobCount;
  const hasOperationCenterActivity = operationCenterActiveCount > 0;

  return {
    activeDownloadBatchProgress,
    activeDownloadProgressStats,
    activeDownloadQueueStats,
    activeDownloadTransfers,
    activeUploadBatchProgress,
    activeUploadProgressStats,
    activeUploadQueueStats,
    activeUploadTransfers,
    canClearFinishedDownloads,
    canClearFinishedUploads,
    canRetryAllFailedTransfers,
    canRetryFailedDownloads,
    canRetryFailedUploads,
    failedDownloadHistoryCount: failedDownloadHistory.length,
    failedDownloadRetryCandidates,
    failedRetryCandidateTotal,
    failedUploadHistoryCount: failedUploadHistory.length,
    failedUploadRetryCandidates,
    hasOperationCenterActivity,
    hasOperationCenterDiagnosticsJobs,
    hasOperationCenterSnippetJobs,
    operationCenterActiveCount,
    operationCenterDeleteProgressLabel,
    operationCenterDownloadSummary,
    operationCenterFinishedAppJobCount,
    operationCenterPortForwardSummary,
    operationCenterRecentAppJobViews,
    operationCenterRunningAppJobCount,
    operationCenterTimelineItems,
    operationCenterTransferTabSummaries,
    operationCenterUploadSummary
  };
}
