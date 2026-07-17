import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import type { SessionRecord } from "../shared/session";
import type { SftpTransferEvent } from "../shared/sftp";
import type { TerminalTab } from "./terminal-workspace-types";

interface PendingUploadJobLike {
  tabId: string;
  transferId: string;
  batchId: string;
  localPath: string;
  remoteDirectory: string;
  remotePath: string;
  name: string;
  missingDirectoryRetryCount?: number;
  channelOpenRetryCount?: number;
  notBeforeAt?: number;
}

interface PendingDownloadJobLike {
  tabId: string;
  transferId: string;
  batchId: string;
  localPath: string;
  remotePath: string;
  name: string;
}

interface PendingTransferRestoreItemLike {
  key: string;
  sessionId: string;
  direction: SftpTransferEvent["direction"];
  localPath: string;
  remotePath: string;
  name: string;
}

interface SftpTransferPreferencesLike {
  scheduleWindowEnabled: boolean;
  scheduleWindowStartMinutes: number;
  scheduleWindowEndMinutes: number;
  scheduleWindowDays: number[];
  uploadConcurrency: number;
  uploadRateLimitKiBps: number;
  downloadConcurrency: number;
  downloadRateLimitKiBps: number;
}

interface TransferBatchProgressLike {
  batchId: string;
  total: number;
  completed: number;
  failed: number;
  canceled: number;
  queued: number;
  running: number;
  processed: number;
  done: boolean;
}

interface DownloadTargetEntryLike {
  name: string;
  localPath: string;
  remotePath: string;
}

interface UploadTargetEntryLike {
  name: string;
  localPath: string;
  remotePath: string;
}

type SetTabPauseState = Dispatch<SetStateAction<Record<string, true>>>;
type SetPendingTransferRestoreState = Dispatch<SetStateAction<PendingTransferRestoreItemLike[]>>;
type SetPendingTransferRestoreResolvedState = Dispatch<SetStateAction<boolean>>;
type SetTransferBatchState = Dispatch<
  SetStateAction<Record<string, { batchId: string; total: number }>>
>;
type SftpApi = Window["termdock"]["sftp"];
type ApplySftpTransferEvent = (event: SftpTransferEvent & { batchId?: string }) => void;
type SetSftpError = (message: string | null, tabId?: string | null) => void;
type TransferDockNoticeLevel = "info" | "warn";
type ShowTransferDockNotice = (
  tabId: string,
  level: TransferDockNoticeLevel,
  message: string,
  durationMs?: number
) => void;
type WriteAppLog = (
  level: "info" | "warn" | "error",
  scope: string,
  message: string,
  context?: Record<string, unknown>
) => void;
type ShowAppAlert = (
  message: string,
  options?: {
    title?: string;
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

interface UseSftpTransferQueueRuntimeArgs {
  applySftpTransferEvent: ApplySftpTransferEvent;
  claimUploadDirectoryBarrier: (tabId: string, remoteDirectory: string) => string | null;
  connectedTabIdsRef: MutableRefObject<Set<string>>;
  downloadQueueRef: MutableRefObject<PendingDownloadJobLike[]>;
  ensureRemoteDirectoryForUpload: (tabId: string, remoteDirectory: string) => Promise<void>;
  findNextSftpTransferWindowTransition: (
    preferences: SftpTransferPreferencesLike
  ) => { at: Date } | null;
  getEffectiveUploadConcurrencyForTab: (tabId: string) => number;
  getSftpChannelOpenRetryDelayMs: (retryCount: number) => number;
  invalidateUploadDirectoryBranchForTab: (tabId: string, remoteDirectory: string) => void;
  isDrainingDownloadQueueRef: MutableRefObject<boolean>;
  isDrainingUploadQueueRef: MutableRefObject<boolean>;
  isRemotePathMissingError: (message: string) => boolean;
  isSftpChannelOpenFailureError: (message: string) => boolean;
  isTabNotConnectedError: (message: string) => boolean;
  isTransferCanceledMessage: (message: string) => boolean;
  isWithinSftpTransferScheduleWindow: (preferences: SftpTransferPreferencesLike) => boolean;
  markUploadDirectoryReady: (tabId: string, directoryKey: string | null) => void;
  noteUploadChannelBackpressureForTab: (tabId: string, message: string) => void;
  noteUploadSuccessForTab: (tabId: string) => void;
  normalizeRemoteDirectoryPath: (value: string) => string;
  readyUploadDirectoriesRef: MutableRefObject<Map<string, Set<string>>>;
  releaseUploadDirectoryBarrier: (tabId: string, directoryKey: string | null) => void;
  resolveSftpTransferRateLimitBytesPerSecond: (value: number) => number | null | undefined;
  runningDownloadIdsRef: MutableRefObject<Map<string, string>>;
  runningUploadCountsByTabRef: MutableRefObject<Map<string, number>>;
  runningUploadIdsRef: MutableRefObject<Map<string, string>>;
  setPausedDownloadTabs: SetTabPauseState;
  setPausedUploadTabs: SetTabPauseState;
  setSchedulePausedDownloadTabs: SetTabPauseState;
  setSchedulePausedUploadTabs: SetTabPauseState;
  setSftpError: SetSftpError;
  sftpApi: SftpApi | null;
  sftpTransferPreferences: SftpTransferPreferencesLike;
  transferWindowEvaluationIntervalMs: number;
  uploadChannelOpenRetryLimit: number;
  uploadQueueRef: MutableRefObject<PendingUploadJobLike[]>;
  uploadQueueRetryTimerRef: MutableRefObject<number | null>;
  warmingUploadDirectoriesRef: MutableRefObject<Map<string, Set<string>>>;
  writeAppLog: WriteAppLog;
}

interface UsePendingTransferRestoreRuntimeArgs {
  activeTabId: string | null;
  arePendingTransferRestoreItemsEqual: (
    left: PendingTransferRestoreItemLike[],
    right: PendingTransferRestoreItemLike[]
  ) => boolean;
  collectPendingTransferRestoreSnapshot: () => PendingTransferRestoreItemLike[];
  enqueueDownloadTargets: (
    tabId: string,
    targets: DownloadTargetEntryLike[],
    options?: { suppressEmptyError?: boolean }
  ) => number;
  enqueueUploadTargets: (
    tabId: string,
    targets: UploadTargetEntryLike[],
    options?: { suppressEmptyError?: boolean }
  ) => number;
  openTerminalTab: (session: SessionRecord) => string | null;
  pendingTransferRestoreItems: PendingTransferRestoreItemLike[];
  pendingTransferRestoreResolved: boolean;
  sessionsRef: MutableRefObject<SessionRecord[]>;
  setPendingTransferRestoreItems: SetPendingTransferRestoreState;
  setPendingTransferRestoreResolved: SetPendingTransferRestoreResolvedState;
  sftpTransfersDependency: unknown;
  showAppAlert: ShowAppAlert;
  showAppConfirm: ShowAppConfirm;
  showTransferDockNotice: ShowTransferDockNotice;
  storageKey: string;
  persistPendingRestore?: (items: PendingTransferRestoreItemLike[]) => void;
  terminalTabsDependency: unknown;
  terminalTabsRef: MutableRefObject<TerminalTab[]>;
}

interface UseSftpTransferBatchNotificationsArgs {
  activeDownloadBatchProgress: TransferBatchProgressLike | null;
  activeTabId: string | null;
  activeUploadBatchProgress: TransferBatchProgressLike | null;
  buildBatchFailureDetailText: (
    tabId: string,
    batchId: string,
    direction: "upload" | "download",
    failedCount: number
  ) => string | undefined;
  setDownloadBatchByTab: SetTransferBatchState;
  setUploadBatchByTab: SetTransferBatchState;
  showTransferDockNotice: ShowTransferDockNotice;
  writeAppLog: WriteAppLog;
}

function areKeySetsEqual(left: Record<string, true>, right: Record<string, true>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => key in right)
  );
}

export function useSftpTransferQueueRuntime({
  applySftpTransferEvent,
  claimUploadDirectoryBarrier,
  connectedTabIdsRef,
  downloadQueueRef,
  ensureRemoteDirectoryForUpload,
  findNextSftpTransferWindowTransition,
  getEffectiveUploadConcurrencyForTab,
  getSftpChannelOpenRetryDelayMs,
  invalidateUploadDirectoryBranchForTab,
  isDrainingDownloadQueueRef,
  isDrainingUploadQueueRef,
  isRemotePathMissingError,
  isSftpChannelOpenFailureError,
  isTabNotConnectedError,
  isTransferCanceledMessage,
  isWithinSftpTransferScheduleWindow,
  markUploadDirectoryReady,
  noteUploadChannelBackpressureForTab,
  noteUploadSuccessForTab,
  normalizeRemoteDirectoryPath,
  readyUploadDirectoriesRef,
  releaseUploadDirectoryBarrier,
  resolveSftpTransferRateLimitBytesPerSecond,
  runningDownloadIdsRef,
  runningUploadCountsByTabRef,
  runningUploadIdsRef,
  setPausedDownloadTabs,
  setPausedUploadTabs,
  setSchedulePausedDownloadTabs,
  setSchedulePausedUploadTabs,
  setSftpError,
  sftpApi,
  sftpTransferPreferences,
  transferWindowEvaluationIntervalMs,
  uploadChannelOpenRetryLimit,
  uploadQueueRef,
  uploadQueueRetryTimerRef,
  warmingUploadDirectoriesRef,
  writeAppLog
}: UseSftpTransferQueueRuntimeArgs) {
  const syncScheduledTransferPauseState = useCallback(() => {
    if (!sftpTransferPreferences.scheduleWindowEnabled) {
      setSchedulePausedUploadTabs((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      setSchedulePausedDownloadTabs((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      return true;
    }

    const windowOpen = isWithinSftpTransferScheduleWindow(sftpTransferPreferences);
    if (windowOpen) {
      setSchedulePausedUploadTabs((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      setSchedulePausedDownloadTabs((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      return true;
    }

    const nextPausedUploadTabs: Record<string, true> = {};
    for (const job of uploadQueueRef.current) {
      nextPausedUploadTabs[job.tabId] = true;
    }

    const nextPausedDownloadTabs: Record<string, true> = {};
    for (const job of downloadQueueRef.current) {
      nextPausedDownloadTabs[job.tabId] = true;
    }

    setSchedulePausedUploadTabs((prev) =>
      areKeySetsEqual(prev, nextPausedUploadTabs) ? prev : nextPausedUploadTabs
    );
    setSchedulePausedDownloadTabs((prev) =>
      areKeySetsEqual(prev, nextPausedDownloadTabs) ? prev : nextPausedDownloadTabs
    );
    return false;
  }, [
    downloadQueueRef,
    isWithinSftpTransferScheduleWindow,
    setSchedulePausedDownloadTabs,
    setSchedulePausedUploadTabs,
    sftpTransferPreferences,
    uploadQueueRef
  ]);

  const drainUploadQueue = useCallback(() => {
    if (!sftpApi || isDrainingUploadQueueRef.current) {
      return;
    }
    if (uploadQueueRetryTimerRef.current !== null) {
      window.clearTimeout(uploadQueueRetryTimerRef.current);
      uploadQueueRetryTimerRef.current = null;
    }
    if (!syncScheduledTransferPauseState()) {
      return;
    }
    isDrainingUploadQueueRef.current = true;
    try {
      while (runningUploadIdsRef.current.size < sftpTransferPreferences.uploadConcurrency) {
        const now = Date.now();
        let earliestRetryAt: number | null = null;
        const nextIndex = uploadQueueRef.current.findIndex((job) => {
          if (!connectedTabIdsRef.current.has(job.tabId)) {
            return false;
          }
          if (typeof job.notBeforeAt === "number" && job.notBeforeAt > now) {
            earliestRetryAt =
              earliestRetryAt === null ? job.notBeforeAt : Math.min(earliestRetryAt, job.notBeforeAt);
            return false;
          }
          const runningCount = runningUploadCountsByTabRef.current.get(job.tabId) ?? 0;
          if (runningCount >= getEffectiveUploadConcurrencyForTab(job.tabId)) {
            return false;
          }
          const normalizedDirectory = normalizeRemoteDirectoryPath(job.remoteDirectory);
          if (!normalizedDirectory) {
            return true;
          }
          const readyDirectories = readyUploadDirectoriesRef.current.get(job.tabId);
          if (readyDirectories?.has(normalizedDirectory)) {
            return true;
          }
          const warmingDirectories = warmingUploadDirectoriesRef.current.get(job.tabId);
          return !warmingDirectories?.has(normalizedDirectory);
        });
        if (nextIndex < 0) {
          if (earliestRetryAt !== null) {
            const delayMs = Math.max(0, earliestRetryAt - now);
            uploadQueueRetryTimerRef.current = window.setTimeout(() => {
              uploadQueueRetryTimerRef.current = null;
              drainUploadQueue();
            }, delayMs);
          }
          break;
        }

        const [nextJob] = uploadQueueRef.current.splice(nextIndex, 1);
        const directoryBarrierKey = claimUploadDirectoryBarrier(nextJob.tabId, nextJob.remoteDirectory);
        runningUploadIdsRef.current.set(nextJob.transferId, nextJob.tabId);
        runningUploadCountsByTabRef.current.set(
          nextJob.tabId,
          (runningUploadCountsByTabRef.current.get(nextJob.tabId) ?? 0) + 1
        );

        void (async () => {
          await ensureRemoteDirectoryForUpload(nextJob.tabId, nextJob.remoteDirectory);
          await sftpApi.uploadFileToPath(
            nextJob.tabId,
            nextJob.transferId,
            nextJob.localPath,
            nextJob.remotePath,
            {
              rateLimitBytesPerSecond: resolveSftpTransferRateLimitBytesPerSecond(
                sftpTransferPreferences.uploadRateLimitKiBps
              ) ?? undefined
            }
          );
          markUploadDirectoryReady(nextJob.tabId, directoryBarrierKey);
          noteUploadSuccessForTab(nextJob.tabId);
        })()
          .catch((caughtError) => {
            const message = (caughtError as Error)?.message ?? "Upload failed.";
            if (isTransferCanceledMessage(message)) {
              return;
            }
            if (isRemotePathMissingError(message)) {
              const retryCount = nextJob.missingDirectoryRetryCount ?? 0;
              if (retryCount < 1) {
                invalidateUploadDirectoryBranchForTab(nextJob.tabId, nextJob.remoteDirectory);
                uploadQueueRef.current.unshift({
                  ...nextJob,
                  missingDirectoryRetryCount: retryCount + 1,
                  notBeforeAt: Date.now() + 150
                });
                applySftpTransferEvent({
                  tabId: nextJob.tabId,
                  transferId: nextJob.transferId,
                  direction: "upload",
                  status: "queued",
                  batchId: nextJob.batchId,
                  name: nextJob.name,
                  localPath: nextJob.localPath,
                  remotePath: nextJob.remotePath,
                  transferredBytes: 0,
                  totalBytes: 0,
                  message: "retrying after remote directory refresh"
                });
                writeAppLog(
                  "warn",
                  "renderer:sftp-transfer",
                  "Upload hit missing remote path. Cleared the affected remote-directory branch and requeued once.",
                  {
                    tabId: nextJob.tabId,
                    transferId: nextJob.transferId,
                    remoteDirectory: nextJob.remoteDirectory,
                    remotePath: nextJob.remotePath
                  }
                );
                return;
              }
            }
            if (isSftpChannelOpenFailureError(message)) {
              const retryCount = nextJob.channelOpenRetryCount ?? 0;
              if (retryCount < uploadChannelOpenRetryLimit) {
                const backoffMs = getSftpChannelOpenRetryDelayMs(retryCount);
                noteUploadChannelBackpressureForTab(nextJob.tabId, message);
                uploadQueueRef.current.unshift({
                  ...nextJob,
                  channelOpenRetryCount: retryCount + 1,
                  notBeforeAt: Date.now() + backoffMs
                });
                applySftpTransferEvent({
                  tabId: nextJob.tabId,
                  transferId: nextJob.transferId,
                  direction: "upload",
                  status: "queued",
                  batchId: nextJob.batchId,
                  name: nextJob.name,
                  localPath: nextJob.localPath,
                  remotePath: nextJob.remotePath,
                  transferredBytes: 0,
                  totalBytes: 0,
                  message: `retrying after SSH channel-open backpressure (${retryCount + 1}/${uploadChannelOpenRetryLimit})`
                });
                writeAppLog(
                  "warn",
                  "renderer:sftp-transfer",
                  "Upload hit SSH channel-open backpressure. Requeued with backoff.",
                  {
                    tabId: nextJob.tabId,
                    transferId: nextJob.transferId,
                    remotePath: nextJob.remotePath,
                    retryCount: retryCount + 1,
                    backoffMs,
                    message
                  }
                );
                uploadQueueRetryTimerRef.current = window.setTimeout(() => {
                  uploadQueueRetryTimerRef.current = null;
                  drainUploadQueue();
                }, backoffMs);
                return;
              }
            }
            if (isTabNotConnectedError(message)) {
              connectedTabIdsRef.current.delete(nextJob.tabId);
              setPausedUploadTabs((prev) => {
                if (prev[nextJob.tabId]) {
                  return prev;
                }
                return {
                  ...prev,
                  [nextJob.tabId]: true
                };
              });
              uploadQueueRef.current.unshift({
                ...nextJob,
                notBeforeAt: undefined
              });
              setSftpError(
                "Terminal tab disconnected. Reconnect to resume queued uploads.",
                nextJob.tabId
              );
              return;
            }
            setPausedUploadTabs((prev) => {
              if (!prev[nextJob.tabId]) {
                return prev;
              }
              const next = { ...prev };
              delete next[nextJob.tabId];
              return next;
            });
            setSftpError(message, nextJob.tabId);
            applySftpTransferEvent({
              tabId: nextJob.tabId,
              transferId: nextJob.transferId,
              direction: "upload",
              status: "failed",
              batchId: nextJob.batchId,
              name: nextJob.name,
              localPath: nextJob.localPath,
              remotePath: nextJob.remotePath,
              transferredBytes: 0,
              totalBytes: 0,
              message
            });
          })
          .finally(() => {
            runningUploadIdsRef.current.delete(nextJob.transferId);
            const nextRunningCount = (runningUploadCountsByTabRef.current.get(nextJob.tabId) ?? 1) - 1;
            if (nextRunningCount <= 0) {
              runningUploadCountsByTabRef.current.delete(nextJob.tabId);
            } else {
              runningUploadCountsByTabRef.current.set(nextJob.tabId, nextRunningCount);
            }
            releaseUploadDirectoryBarrier(nextJob.tabId, directoryBarrierKey);
            drainUploadQueue();
          });
      }
    } finally {
      isDrainingUploadQueueRef.current = false;
    }
  }, [
    applySftpTransferEvent,
    claimUploadDirectoryBarrier,
    connectedTabIdsRef,
    ensureRemoteDirectoryForUpload,
    getEffectiveUploadConcurrencyForTab,
    getSftpChannelOpenRetryDelayMs,
    invalidateUploadDirectoryBranchForTab,
    isDrainingUploadQueueRef,
    isRemotePathMissingError,
    isSftpChannelOpenFailureError,
    isTabNotConnectedError,
    isTransferCanceledMessage,
    markUploadDirectoryReady,
    noteUploadChannelBackpressureForTab,
    noteUploadSuccessForTab,
    normalizeRemoteDirectoryPath,
    readyUploadDirectoriesRef,
    releaseUploadDirectoryBarrier,
    resolveSftpTransferRateLimitBytesPerSecond,
    runningUploadCountsByTabRef,
    runningUploadIdsRef,
    setPausedUploadTabs,
    setSftpError,
    sftpApi,
    sftpTransferPreferences.uploadConcurrency,
    sftpTransferPreferences.uploadRateLimitKiBps,
    syncScheduledTransferPauseState,
    uploadChannelOpenRetryLimit,
    uploadQueueRef,
    uploadQueueRetryTimerRef,
    warmingUploadDirectoriesRef,
    writeAppLog
  ]);

  const drainDownloadQueue = useCallback(() => {
    if (!sftpApi || isDrainingDownloadQueueRef.current) {
      return;
    }
    if (!syncScheduledTransferPauseState()) {
      return;
    }
    isDrainingDownloadQueueRef.current = true;
    try {
      while (runningDownloadIdsRef.current.size < sftpTransferPreferences.downloadConcurrency) {
        const nextIndex = downloadQueueRef.current.findIndex((job) =>
          connectedTabIdsRef.current.has(job.tabId)
        );
        if (nextIndex < 0) {
          break;
        }
        const [nextJob] = downloadQueueRef.current.splice(nextIndex, 1);
        runningDownloadIdsRef.current.set(nextJob.transferId, nextJob.tabId);
        void sftpApi
          .downloadFile(
            nextJob.tabId,
            nextJob.transferId,
            nextJob.remotePath,
            nextJob.localPath,
            {
              rateLimitBytesPerSecond: resolveSftpTransferRateLimitBytesPerSecond(
                sftpTransferPreferences.downloadRateLimitKiBps
              ) ?? undefined
            }
          )
          .catch((caughtError) => {
            const message = (caughtError as Error)?.message ?? "Download failed.";
            if (isTransferCanceledMessage(message)) {
              return;
            }
            if (isTabNotConnectedError(message)) {
              connectedTabIdsRef.current.delete(nextJob.tabId);
              setPausedDownloadTabs((prev) => {
                if (prev[nextJob.tabId]) {
                  return prev;
                }
                return {
                  ...prev,
                  [nextJob.tabId]: true
                };
              });
              downloadQueueRef.current.unshift(nextJob);
              setSftpError(
                "Terminal tab disconnected. Reconnect to resume queued downloads.",
                nextJob.tabId
              );
              return;
            }
            setPausedDownloadTabs((prev) => {
              if (!prev[nextJob.tabId]) {
                return prev;
              }
              const next = { ...prev };
              delete next[nextJob.tabId];
              return next;
            });
            setSftpError(message, nextJob.tabId);
            applySftpTransferEvent({
              tabId: nextJob.tabId,
              transferId: nextJob.transferId,
              direction: "download",
              status: "failed",
              batchId: nextJob.batchId,
              name: nextJob.name,
              localPath: nextJob.localPath,
              remotePath: nextJob.remotePath,
              transferredBytes: 0,
              totalBytes: 0,
              message
            });
          })
          .finally(() => {
            runningDownloadIdsRef.current.delete(nextJob.transferId);
            drainDownloadQueue();
          });
      }
    } finally {
      isDrainingDownloadQueueRef.current = false;
    }
  }, [
    applySftpTransferEvent,
    connectedTabIdsRef,
    downloadQueueRef,
    isDrainingDownloadQueueRef,
    isTabNotConnectedError,
    isTransferCanceledMessage,
    resolveSftpTransferRateLimitBytesPerSecond,
    runningDownloadIdsRef,
    setPausedDownloadTabs,
    setSftpError,
    sftpApi,
    sftpTransferPreferences.downloadConcurrency,
    sftpTransferPreferences.downloadRateLimitKiBps,
    syncScheduledTransferPauseState
  ]);

  useEffect(() => {
    let boundaryTimerId: number | null = null;
    const clearBoundaryTimer = () => {
      if (boundaryTimerId !== null) {
        window.clearTimeout(boundaryTimerId);
        boundaryTimerId = null;
      }
    };
    const scheduleBoundaryEvaluation = () => {
      clearBoundaryTimer();
      const nextTransition = findNextSftpTransferWindowTransition(sftpTransferPreferences);
      if (!nextTransition) {
        return;
      }
      const delayMs = Math.max(250, nextTransition.at.getTime() - Date.now() + 250);
      boundaryTimerId = window.setTimeout(() => {
        boundaryTimerId = null;
        evaluateTransferScheduleWindow();
      }, delayMs);
    };
    const evaluateTransferScheduleWindow = () => {
      const windowOpen = syncScheduledTransferPauseState();
      if (windowOpen) {
        drainUploadQueue();
        drainDownloadQueue();
      }
      scheduleBoundaryEvaluation();
    };

    evaluateTransferScheduleWindow();
    const timerId = window.setInterval(
      evaluateTransferScheduleWindow,
      transferWindowEvaluationIntervalMs
    );
    return () => {
      clearBoundaryTimer();
      window.clearInterval(timerId);
    };
  }, [
    drainDownloadQueue,
    drainUploadQueue,
    findNextSftpTransferWindowTransition,
    sftpTransferPreferences,
    syncScheduledTransferPauseState,
    transferWindowEvaluationIntervalMs
  ]);

  useEffect(() => {
    drainUploadQueue();
    drainDownloadQueue();
  }, [drainDownloadQueue, drainUploadQueue]);

  return {
    drainDownloadQueue,
    drainUploadQueue,
    syncScheduledTransferPauseState
  };
}

export function usePendingTransferRestoreRuntime({
  activeTabId,
  arePendingTransferRestoreItemsEqual,
  collectPendingTransferRestoreSnapshot,
  enqueueDownloadTargets,
  enqueueUploadTargets,
  openTerminalTab,
  pendingTransferRestoreItems,
  pendingTransferRestoreResolved,
  sessionsRef,
  setPendingTransferRestoreItems,
  setPendingTransferRestoreResolved,
  sftpTransfersDependency,
  showAppAlert,
  showAppConfirm,
  showTransferDockNotice,
  storageKey,
  persistPendingRestore,
  terminalTabsDependency,
  terminalTabsRef
}: UsePendingTransferRestoreRuntimeArgs) {
  const pendingTransferRestoreNoticeShownRef = useRef(false);

  const clearPendingTransferRestoreQueue = useCallback(
    (markResolved = true) => {
      setPendingTransferRestoreItems([]);
      if (markResolved) {
        setPendingTransferRestoreResolved(true);
      }
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Ignore storage failures; runtime state still applies.
      }
      persistPendingRestore?.([]);
    },
    [
      persistPendingRestore,
      setPendingTransferRestoreItems,
      setPendingTransferRestoreResolved,
      storageKey
    ]
  );

  const discardPendingTransferRestoreQueue = useCallback(async () => {
    if (pendingTransferRestoreItems.length === 0) {
      clearPendingTransferRestoreQueue(true);
      return;
    }
    const confirmed = await showAppConfirm(
      `Discard ${pendingTransferRestoreItems.length} saved pending transfer task(s) from previous run?`,
      {
        title: "Discard Pending Queue",
        confirmLabel: "Discard",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    clearPendingTransferRestoreQueue(true);
    if (activeTabId) {
      showTransferDockNotice(activeTabId, "warn", "Discarded saved pending transfer queue.");
    }
  }, [
    activeTabId,
    clearPendingTransferRestoreQueue,
    pendingTransferRestoreItems.length,
    showAppConfirm,
    showTransferDockNotice
  ]);

  const restorePendingTransferRestoreQueue = useCallback(async () => {
    if (pendingTransferRestoreItems.length === 0) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Restore ${pendingTransferRestoreItems.length} saved pending transfer task(s)? Missing sessions will be skipped.`,
      {
        title: "Restore Pending Queue",
        confirmLabel: "Restore",
        cancelLabel: "Cancel"
      }
    );
    if (!confirmed) {
      return;
    }

    const uploadTargetsByTab = new Map<string, UploadTargetEntryLike[]>();
    const downloadTargetsByTab = new Map<string, DownloadTargetEntryLike[]>();
    let skippedMissingSessions = 0;
    let skippedInvalidEntries = 0;
    let openedTabs = 0;

    for (const item of pendingTransferRestoreItems) {
      const session = sessionsRef.current.find((entry) => entry.id === item.sessionId) ?? null;
      if (!session) {
        skippedMissingSessions += 1;
        continue;
      }
      const localPath = item.localPath.trim();
      const remotePath = item.remotePath.trim();
      const name = item.name.trim();
      if (!localPath || !remotePath || !name) {
        skippedInvalidEntries += 1;
        continue;
      }

      let tabId = terminalTabsRef.current.find((tab) => tab.sessionId === session.id)?.id ?? null;
      if (!tabId) {
        const openedTabId = openTerminalTab(session);
        if (!openedTabId) {
          skippedInvalidEntries += 1;
          continue;
        }
        tabId = openedTabId;
        openedTabs += 1;
      }

      if (item.direction === "upload") {
        const targets = uploadTargetsByTab.get(tabId) ?? [];
        if (
          !targets.some(
            (entry) =>
              entry.localPath.trim() === localPath && entry.remotePath.trim() === remotePath
          )
        ) {
          targets.push({
            name,
            localPath,
            remotePath
          });
        }
        uploadTargetsByTab.set(tabId, targets);
      } else {
        const targets = downloadTargetsByTab.get(tabId) ?? [];
        if (
          !targets.some(
            (entry) =>
              entry.localPath.trim() === localPath && entry.remotePath.trim() === remotePath
          )
        ) {
          targets.push({
            name,
            localPath,
            remotePath
          });
        }
        downloadTargetsByTab.set(tabId, targets);
      }
    }

    let queuedUploads = 0;
    let queuedDownloads = 0;
    for (const [tabId, targets] of uploadTargetsByTab.entries()) {
      queuedUploads += enqueueUploadTargets(tabId, targets, { suppressEmptyError: true });
    }
    for (const [tabId, targets] of downloadTargetsByTab.entries()) {
      queuedDownloads += enqueueDownloadTargets(tabId, targets, { suppressEmptyError: true });
    }

    clearPendingTransferRestoreQueue(true);
    await showAppAlert(
      `Restore completed.\nQueued uploads: ${queuedUploads}\nQueued downloads: ${queuedDownloads}\nOpened tabs: ${openedTabs}\nSkipped missing sessions: ${skippedMissingSessions}\nSkipped invalid entries: ${skippedInvalidEntries}`,
      {
        title: "Restore Pending Queue"
      }
    );
  }, [
    clearPendingTransferRestoreQueue,
    enqueueDownloadTargets,
    enqueueUploadTargets,
    openTerminalTab,
    pendingTransferRestoreItems,
    sessionsRef,
    showAppAlert,
    showAppConfirm,
    terminalTabsRef
  ]);

  useEffect(() => {
    const snapshot = collectPendingTransferRestoreSnapshot();
    const shouldPreservePendingRestore =
      !pendingTransferRestoreResolved &&
      pendingTransferRestoreItems.length > 0 &&
      snapshot.length === 0;
    if (shouldPreservePendingRestore) {
      return;
    }
    if (!arePendingTransferRestoreItemsEqual(pendingTransferRestoreItems, snapshot)) {
      setPendingTransferRestoreItems(snapshot);
    }
    try {
      if (snapshot.length === 0) {
        window.localStorage.removeItem(storageKey);
      } else {
        window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
      }
    } catch {
      // Ignore storage failures; runtime state still applies.
    }
    persistPendingRestore?.(snapshot);
  }, [
    arePendingTransferRestoreItemsEqual,
    collectPendingTransferRestoreSnapshot,
    pendingTransferRestoreItems,
    pendingTransferRestoreResolved,
    persistPendingRestore,
    setPendingTransferRestoreItems,
    sftpTransfersDependency,
    storageKey,
    terminalTabsDependency
  ]);

  useEffect(() => {
    if (pendingTransferRestoreResolved || pendingTransferRestoreItems.length === 0) {
      pendingTransferRestoreNoticeShownRef.current = false;
      return;
    }
    if (pendingTransferRestoreNoticeShownRef.current) {
      return;
    }
    const targetTabId = activeTabId ?? terminalTabsRef.current[0]?.id ?? "";
    if (!targetTabId) {
      return;
    }
    pendingTransferRestoreNoticeShownRef.current = true;
    showTransferDockNotice(
      targetTabId,
      "warn",
      `Detected ${pendingTransferRestoreItems.length} pending transfer task(s) from previous run.`
    );
  }, [
    activeTabId,
    pendingTransferRestoreItems.length,
    pendingTransferRestoreResolved,
    showTransferDockNotice,
    terminalTabsRef
  ]);

  return {
    clearPendingTransferRestoreQueue,
    discardPendingTransferRestoreQueue,
    restorePendingTransferRestoreQueue
  };
}

export function useSftpTransferBatchNotifications({
  activeDownloadBatchProgress,
  activeTabId,
  activeUploadBatchProgress,
  buildBatchFailureDetailText,
  setDownloadBatchByTab,
  setUploadBatchByTab,
  showTransferDockNotice,
  writeAppLog
}: UseSftpTransferBatchNotificationsArgs) {
  const uploadBatchNoticeRef = useRef<Set<string>>(new Set());
  const downloadBatchNoticeRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!activeTabId || !activeUploadBatchProgress || !activeUploadBatchProgress.done) {
      return;
    }
    const batchId = activeUploadBatchProgress.batchId;
    if (uploadBatchNoticeRef.current.has(batchId)) {
      return;
    }
    uploadBatchNoticeRef.current.add(batchId);
    const { completed, failed, canceled, total } = activeUploadBatchProgress;
    const detailParts = [`${completed}/${total} completed`];
    if (failed > 0) {
      detailParts.push(`${failed} failed`);
    }
    if (canceled > 0) {
      detailParts.push(`${canceled} canceled`);
    }
    const summaryMessage = `Upload batch finished: ${detailParts.join(", ")}.`;
    const failureDetailText = buildBatchFailureDetailText(activeTabId, batchId, "upload", failed);
    writeAppLog(failed > 0 ? "warn" : "info", "renderer:sftp-batch", "Upload batch finished.", {
      tabId: activeTabId,
      batchId,
      completed,
      failed,
      canceled,
      total
    });
    if (failureDetailText) {
      writeAppLog("warn", "renderer:sftp-batch", "Upload batch failure details.", {
        tabId: activeTabId,
        batchId,
        detailText: failureDetailText
      });
    }
    showTransferDockNotice(
      activeTabId,
      failed > 0 ? "warn" : "info",
      failed > 0 ? `${summaryMessage} Open Retry Center for failed items.` : summaryMessage,
      failed > 0 ? 12000 : 5000
    );
    setUploadBatchByTab((prev) => {
      const current = prev[activeTabId];
      if (!current || current.batchId !== batchId) {
        return prev;
      }
      const next = { ...prev };
      delete next[activeTabId];
      return next;
    });
  }, [
    activeTabId,
    activeUploadBatchProgress,
    buildBatchFailureDetailText,
    setUploadBatchByTab,
    showTransferDockNotice,
    writeAppLog
  ]);

  useEffect(() => {
    if (!activeTabId || !activeDownloadBatchProgress || !activeDownloadBatchProgress.done) {
      return;
    }
    const batchId = activeDownloadBatchProgress.batchId;
    if (downloadBatchNoticeRef.current.has(batchId)) {
      return;
    }
    downloadBatchNoticeRef.current.add(batchId);
    const { completed, failed, canceled, total } = activeDownloadBatchProgress;
    const detailParts = [`${completed}/${total} completed`];
    if (failed > 0) {
      detailParts.push(`${failed} failed`);
    }
    if (canceled > 0) {
      detailParts.push(`${canceled} canceled`);
    }
    const summaryMessage = `Download batch finished: ${detailParts.join(", ")}.`;
    const failureDetailText = buildBatchFailureDetailText(activeTabId, batchId, "download", failed);
    writeAppLog(
      failed > 0 ? "warn" : "info",
      "renderer:sftp-batch",
      "Download batch finished.",
      {
        tabId: activeTabId,
        batchId,
        completed,
        failed,
        canceled,
        total
      }
    );
    if (failureDetailText) {
      writeAppLog("warn", "renderer:sftp-batch", "Download batch failure details.", {
        tabId: activeTabId,
        batchId,
        detailText: failureDetailText
      });
    }
    showTransferDockNotice(
      activeTabId,
      failed > 0 ? "warn" : "info",
      failed > 0 ? `${summaryMessage} Open Retry Center for failed items.` : summaryMessage,
      failed > 0 ? 12000 : 5000
    );
    setDownloadBatchByTab((prev) => {
      const current = prev[activeTabId];
      if (!current || current.batchId !== batchId) {
        return prev;
      }
      const next = { ...prev };
      delete next[activeTabId];
      return next;
    });
  }, [
    activeDownloadBatchProgress,
    activeTabId,
    buildBatchFailureDetailText,
    setDownloadBatchByTab,
    showTransferDockNotice,
    writeAppLog
  ]);
}
