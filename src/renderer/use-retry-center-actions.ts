import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";

import type { SftpTransferEvent } from "../shared/sftp";

type RetryCenterRetryScope = "all" | "upload" | "download";

interface RetryCenterEntryLike {
  key: string;
  sessionId: string;
  direction: SftpTransferEvent["direction"];
  status: SftpTransferEvent["status"];
  name: string;
  localPath: string;
  remotePath: string;
  message?: string;
}

interface RetryCenterGroupLike<TEntry extends RetryCenterEntryLike = RetryCenterEntryLike> {
  key: string;
  label: string;
  total: number;
  failedCount: number;
  activeSessionFailedCount: number;
  entries: TEntry[];
}

interface FailedRetryCandidate {
  name: string;
  localPath: string;
  remotePath: string;
}

interface DownloadTargetLike {
  name: string;
  localPath: string;
  remotePath: string;
}

interface ChoiceOption {
  value: string;
  label: string;
}

interface UseRetryCenterActionsArgs<TEntry extends RetryCenterEntryLike = RetryCenterEntryLike> {
  activeSessionId: string | null;
  activeTabId: string | null;
  classifyTransferFailureReason: (message?: string) => string;
  createTransferRetryKey: (
    direction: SftpTransferEvent["direction"],
    localPath: string,
    remotePath: string
  ) => string;
  enqueueDownloadTargets: (
    tabId: string,
    targets: DownloadTargetLike[],
    options?: { suppressEmptyError?: boolean }
  ) => number;
  enqueueUploadTargets: (
    tabId: string,
    targets: DownloadTargetLike[],
    options?: { suppressEmptyError?: boolean }
  ) => number;
  failedDownloadRetryCandidates: FailedRetryCandidate[];
  failedRetryCandidateTotal: number;
  failedUploadRetryCandidates: FailedRetryCandidate[];
  resolveDownloadTargetConflicts: (
    targets: DownloadTargetLike[],
    options: { tabId: string; sessionId?: string }
  ) => Promise<DownloadTargetLike[] | null>;
  retryBatchConfirmThreshold: number;
  retryCenterAutoUseLastRetryScope: boolean;
  retryCenterEntries: TEntry[];
  retryCenterGroupedEntries: Array<RetryCenterGroupLike<TEntry>>;
  retryCenterLastRetryScope: RetryCenterRetryScope;
  selectedRetryCenterEntries: TEntry[];
  selectedRetryCenterFailedEntries: TEntry[];
  setRetryCenterLastRetryScope: Dispatch<SetStateAction<RetryCenterRetryScope>>;
  setRetryCenterSelection: Dispatch<SetStateAction<string[]>>;
  setTransferHistory: Dispatch<SetStateAction<TEntry[]>>;
  showAppAlert: (
    message: string,
    options?: { title?: string; confirmLabel?: string; detailText?: string }
  ) => Promise<void>;
  showAppChoice: (
    message: string,
    choices: ChoiceOption[],
    options?: { title?: string; cancelLabel?: string }
  ) => Promise<string | null>;
  showAppConfirm: (
    message: string,
    options?: {
      title?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      danger?: boolean;
    }
  ) => Promise<boolean>;
  terminalTabs: Array<{ id: string; sessionId: string }>;
  totalHistoryCount: number;
  visibleRetryCenterFailedEntries: TEntry[];
  markTransferHistoryRetryQueued: (
    direction: SftpTransferEvent["direction"],
    entries: Array<{ localPath: string; remotePath: string }>
  ) => void;
}

function buildRetryTargetMaps(entries: RetryCenterEntryLike[], createTransferRetryKey: UseRetryCenterActionsArgs["createTransferRetryKey"]) {
  const uploadTargetMap = new Map<string, FailedRetryCandidate>();
  const downloadTargetMap = new Map<string, FailedRetryCandidate>();
  for (const entry of entries) {
    const key = createTransferRetryKey(entry.direction, entry.localPath, entry.remotePath);
    const target = {
      name: entry.name,
      localPath: entry.localPath,
      remotePath: entry.remotePath
    };
    if (entry.direction === "upload") {
      uploadTargetMap.set(key, target);
      continue;
    }
    downloadTargetMap.set(key, target);
  }
  return {
    downloadTargets: Array.from(downloadTargetMap.values()),
    uploadTargets: Array.from(uploadTargetMap.values())
  };
}

export function useRetryCenterActions<TEntry extends RetryCenterEntryLike>({
  activeSessionId,
  activeTabId,
  classifyTransferFailureReason,
  createTransferRetryKey,
  enqueueDownloadTargets,
  enqueueUploadTargets,
  failedDownloadRetryCandidates,
  failedRetryCandidateTotal,
  failedUploadRetryCandidates,
  markTransferHistoryRetryQueued,
  resolveDownloadTargetConflicts,
  retryBatchConfirmThreshold,
  retryCenterAutoUseLastRetryScope,
  retryCenterEntries,
  retryCenterGroupedEntries,
  retryCenterLastRetryScope,
  selectedRetryCenterEntries,
  selectedRetryCenterFailedEntries,
  setRetryCenterLastRetryScope,
  setRetryCenterSelection,
  setTransferHistory,
  showAppAlert,
  showAppChoice,
  showAppConfirm,
  terminalTabs,
  totalHistoryCount,
  visibleRetryCenterFailedEntries
}: UseRetryCenterActionsArgs<TEntry>) {
  const confirmRetryBatchIfNeeded = useCallback(
    async (count: number, label: string): Promise<boolean> => {
      if (retryBatchConfirmThreshold <= 0 || count < retryBatchConfirmThreshold) {
        return true;
      }
      return showAppConfirm(
        `Requeue ${count} failed transfer task(s) for ${label}? This exceeds your retry confirmation threshold (${retryBatchConfirmThreshold}).`,
        {
          title: "Retry Confirmation",
          confirmLabel: "Retry",
          cancelLabel: "Cancel"
        }
      );
    },
    [retryBatchConfirmThreshold, showAppConfirm]
  );

  const getRetryCenterEntriesForRetryScope = useCallback(
    <TTarget extends RetryCenterEntryLike>(
      entries: TTarget[],
      retryScope: RetryCenterRetryScope
    ): TTarget[] => {
      if (retryScope === "upload") {
        return entries.filter((entry) => entry.direction === "upload");
      }
      if (retryScope === "download") {
        return entries.filter((entry) => entry.direction === "download");
      }
      return entries;
    },
    []
  );

  const chooseRetryCenterRetryScopeByCounts = useCallback(
    async (
      counts: {
        all: number;
        upload: number;
        download: number;
      },
      message: string
    ): Promise<RetryCenterRetryScope | null> => {
      if (counts.all <= 0) {
        return null;
      }
      const choices: ChoiceOption[] = [
        {
          value: "all",
          label: `All Retryable (${counts.all})`
        }
      ];
      if (counts.upload > 0) {
        choices.push({
          value: "upload",
          label: `Upload Only (${counts.upload})`
        });
      }
      if (counts.download > 0) {
        choices.push({
          value: "download",
          label: `Download Only (${counts.download})`
        });
      }
      if (choices.length === 1) {
        setRetryCenterLastRetryScope("all");
        return "all";
      }
      if (retryCenterAutoUseLastRetryScope) {
        const preferredChoice = choices.find((entry) => entry.value === retryCenterLastRetryScope);
        if (preferredChoice) {
          setRetryCenterLastRetryScope(preferredChoice.value as RetryCenterRetryScope);
          return preferredChoice.value as RetryCenterRetryScope;
        }
      }
      let dialogChoices = choices;
      const preferredChoice = choices.find((entry) => entry.value === retryCenterLastRetryScope);
      if (preferredChoice) {
        const remainingChoices = choices.filter((entry) => entry.value !== retryCenterLastRetryScope);
        dialogChoices = [
          {
            ...preferredChoice,
            label: `${preferredChoice.label} (Last Used)`
          },
          ...remainingChoices
        ];
      }
      const choice = await showAppChoice(message, dialogChoices, {
        title: "Retry Center",
        cancelLabel: "Cancel"
      });
      if (choice !== "all" && choice !== "upload" && choice !== "download") {
        return null;
      }
      setRetryCenterLastRetryScope(choice);
      return choice;
    },
    [
      retryCenterAutoUseLastRetryScope,
      retryCenterLastRetryScope,
      setRetryCenterLastRetryScope,
      showAppChoice
    ]
  );

  const chooseRetryCenterRetryScope = useCallback(
    async (baseEntries: RetryCenterEntryLike[], message: string): Promise<RetryCenterRetryScope | null> =>
      chooseRetryCenterRetryScopeByCounts(
        {
          all: baseEntries.length,
          upload: baseEntries.filter((entry) => entry.direction === "upload").length,
          download: baseEntries.filter((entry) => entry.direction === "download").length
        },
        message
      ),
    [chooseRetryCenterRetryScopeByCounts]
  );

  const queueRetryEntries = useCallback(
    async (tabId: string, sessionId: string | undefined, entries: TEntry[]): Promise<number> => {
      const { uploadTargets, downloadTargets } = buildRetryTargetMaps(entries, createTransferRetryKey);
      let queuedCount = 0;

      if (uploadTargets.length > 0) {
        const uploadQueued = enqueueUploadTargets(tabId, uploadTargets, {
          suppressEmptyError: true
        });
        queuedCount += uploadQueued;
        if (uploadQueued > 0) {
          markTransferHistoryRetryQueued(
            "upload",
            uploadTargets.map((entry) => ({
              localPath: entry.localPath,
              remotePath: entry.remotePath
            }))
          );
        }
      }

      if (downloadTargets.length > 0) {
        const resolvedTargets = await resolveDownloadTargetConflicts(downloadTargets, {
          tabId,
          sessionId
        });
        if (resolvedTargets && resolvedTargets.length > 0) {
          const downloadQueued = enqueueDownloadTargets(tabId, resolvedTargets, {
            suppressEmptyError: true
          });
          queuedCount += downloadQueued;
          if (downloadQueued > 0) {
            markTransferHistoryRetryQueued(
              "download",
              resolvedTargets.map((entry) => ({
                localPath: entry.localPath,
                remotePath: entry.remotePath
              }))
            );
          }
        }
      }

      return queuedCount;
    },
    [
      createTransferRetryKey,
      enqueueDownloadTargets,
      enqueueUploadTargets,
      markTransferHistoryRetryQueued,
      resolveDownloadTargetConflicts
    ]
  );

  const getRetryCenterGroupEntriesForRetryScope = useCallback(
    (
      group: RetryCenterGroupLike<TEntry>,
      retryScope: RetryCenterRetryScope
    ): TEntry[] => {
      if (!activeSessionId) {
        return [];
      }
      const retryableEntries = group.entries.filter(
        (entry) => entry.status === "failed" && entry.sessionId === activeSessionId
      );
      return getRetryCenterEntriesForRetryScope(retryableEntries, retryScope);
    },
    [activeSessionId, getRetryCenterEntriesForRetryScope]
  );

  const retryRetryCenterGroupFailedEntries = useCallback(
    async (groupKey: string) => {
      if (!activeTabId || !activeSessionId) {
        await showAppAlert("Open a terminal tab for the target session first.", {
          title: "Retry Center"
        });
        return;
      }
      const targetGroup = retryCenterGroupedEntries.find((entry) => entry.key === groupKey);
      if (!targetGroup) {
        return;
      }
      const retryableEntries = getRetryCenterGroupEntriesForRetryScope(targetGroup, "all");
      if (retryableEntries.length === 0) {
        await showAppAlert("No active-session failed records can be retried for this group.", {
          title: "Retry Center"
        });
        return;
      }
      const retryScope = await chooseRetryCenterRetryScope(
        retryableEntries,
        `Choose retry scope for "${targetGroup.label}".`
      );
      if (!retryScope) {
        return;
      }
      const targetEntries = getRetryCenterGroupEntriesForRetryScope(targetGroup, retryScope);
      if (targetEntries.length === 0) {
        await showAppAlert("No transfer tasks were requeued.", {
          title: "Retry Center"
        });
        return;
      }
      const confirmed = await confirmRetryBatchIfNeeded(
        targetEntries.length,
        `group "${targetGroup.label}"`
      );
      if (!confirmed) {
        return;
      }
      const queuedCount = await queueRetryEntries(activeTabId, activeSessionId, targetEntries);
      if (queuedCount <= 0) {
        await showAppAlert("No transfer tasks were requeued.", {
          title: "Retry Center"
        });
        return;
      }
      const targetKeys = new Set(targetEntries.map((entry) => entry.key));
      setRetryCenterSelection((prev) => prev.filter((key) => !targetKeys.has(key)));
      const scopeLabel =
        retryScope === "upload"
          ? "upload-only"
          : retryScope === "download"
            ? "download-only"
            : "all retryable";
      await showAppAlert(
        `Requeued ${queuedCount} failed transfer task(s) from group "${targetGroup.label}" (${scopeLabel}).`,
        {
          title: "Retry Center"
        }
      );
    },
    [
      activeSessionId,
      activeTabId,
      chooseRetryCenterRetryScope,
      confirmRetryBatchIfNeeded,
      getRetryCenterGroupEntriesForRetryScope,
      queueRetryEntries,
      retryCenterGroupedEntries,
      setRetryCenterSelection,
      showAppAlert
    ]
  );

  const clearRetryCenterGroupEntries = useCallback(
    async (groupKey: string) => {
      const targetGroup = retryCenterGroupedEntries.find((entry) => entry.key === groupKey);
      if (!targetGroup || targetGroup.entries.length === 0) {
        return;
      }
      const confirmed = await showAppConfirm(
        `Delete ${targetGroup.total} visible history record(s) in group "${targetGroup.label}"?`,
        {
          title: "Retry Center",
          confirmLabel: "Delete Group",
          cancelLabel: "Cancel",
          danger: true
        }
      );
      if (!confirmed) {
        return;
      }
      const targetKeys = new Set(targetGroup.entries.map((entry) => entry.key));
      setTransferHistory((prev) => prev.filter((entry) => !targetKeys.has(entry.key)));
      setRetryCenterSelection((prev) => prev.filter((key) => !targetKeys.has(key)));
    },
    [retryCenterGroupedEntries, setRetryCenterSelection, setTransferHistory, showAppConfirm]
  );

  const retrySelectedRetryCenterEntries = useCallback(
    async (retryScope: RetryCenterRetryScope = "all") => {
      if (!activeTabId || !activeSessionId) {
        await showAppAlert("Open a terminal tab for the target session first.", {
          title: "Retry Center"
        });
        return;
      }
      if (selectedRetryCenterFailedEntries.length === 0) {
        return;
      }
      const targetEntries = getRetryCenterEntriesForRetryScope(
        selectedRetryCenterFailedEntries,
        retryScope
      );
      if (targetEntries.length === 0) {
        await showAppAlert("No transfer tasks were requeued.", {
          title: "Retry Center"
        });
        return;
      }
      const confirmed = await confirmRetryBatchIfNeeded(
        targetEntries.length,
        "selected retry-center records"
      );
      if (!confirmed) {
        return;
      }
      const queuedCount = await queueRetryEntries(activeTabId, activeSessionId, targetEntries);
      if (queuedCount <= 0) {
        await showAppAlert("No transfer tasks were requeued.", {
          title: "Retry Center"
        });
        return;
      }
      const selectedKeys = new Set(targetEntries.map((entry) => entry.key));
      setRetryCenterSelection((prev) => prev.filter((key) => !selectedKeys.has(key)));
      const scopeSuffix =
        retryScope === "upload"
          ? " (upload-only)"
          : retryScope === "download"
            ? " (download-only)"
            : "";
      await showAppAlert(`Requeued ${queuedCount} transfer task(s) from history${scopeSuffix}.`, {
        title: "Retry Center"
      });
    },
    [
      activeSessionId,
      activeTabId,
      confirmRetryBatchIfNeeded,
      getRetryCenterEntriesForRetryScope,
      queueRetryEntries,
      selectedRetryCenterFailedEntries,
      setRetryCenterSelection,
      showAppAlert
    ]
  );

  const retrySelectedRetryCenterEntriesWithScopeChoice = useCallback(async () => {
    if (!activeTabId || !activeSessionId) {
      await showAppAlert("Open a terminal tab for the target session first.", {
        title: "Retry Center"
      });
      return;
    }
    if (selectedRetryCenterFailedEntries.length === 0) {
      return;
    }
    const retryScope = await chooseRetryCenterRetryScope(
      selectedRetryCenterFailedEntries,
      "Choose retry scope for selected failed records."
    );
    if (!retryScope) {
      return;
    }
    await retrySelectedRetryCenterEntries(retryScope);
  }, [
    activeSessionId,
    activeTabId,
    chooseRetryCenterRetryScope,
    retrySelectedRetryCenterEntries,
    selectedRetryCenterFailedEntries,
    showAppAlert
  ]);

  const retryVisibleRetryCenterEntries = useCallback(
    async (failureReason?: string, retryScope: RetryCenterRetryScope = "all") => {
      if (!activeTabId || !activeSessionId) {
        await showAppAlert("Open a terminal tab for the target session first.", {
          title: "Retry Center"
        });
        return;
      }
      const scopedVisibleEntries =
        typeof failureReason === "string" && failureReason.trim()
          ? visibleRetryCenterFailedEntries.filter(
              (entry) => classifyTransferFailureReason(entry.message) === failureReason
            )
          : visibleRetryCenterFailedEntries;
      const targetEntries = getRetryCenterEntriesForRetryScope(scopedVisibleEntries, retryScope);
      if (targetEntries.length === 0) {
        if (failureReason) {
          await showAppAlert(
            `No visible failed records for reason "${failureReason}" under the active session.`,
            {
              title: "Retry Center"
            }
          );
        }
        return;
      }
      const retryLabel =
        typeof failureReason === "string" && failureReason.trim()
          ? `visible failure reason "${failureReason}"`
          : "visible failed records";
      const confirmed = await confirmRetryBatchIfNeeded(targetEntries.length, retryLabel);
      if (!confirmed) {
        return;
      }
      const queuedCount = await queueRetryEntries(activeTabId, activeSessionId, targetEntries);
      if (queuedCount <= 0) {
        await showAppAlert("No transfer tasks were requeued.", {
          title: "Retry Center"
        });
        return;
      }
      const visibleKeys = new Set(targetEntries.map((entry) => entry.key));
      setRetryCenterSelection((prev) => prev.filter((key) => !visibleKeys.has(key)));
      const scopeSuffix =
        retryScope === "upload"
          ? " (upload-only)"
          : retryScope === "download"
            ? " (download-only)"
            : "";
      if (failureReason) {
        await showAppAlert(
          `Requeued ${queuedCount} visible failed transfer task(s) for reason "${failureReason}"${scopeSuffix}.`,
          {
            title: "Retry Center"
          }
        );
        return;
      }
      await showAppAlert(`Requeued ${queuedCount} visible failed transfer task(s)${scopeSuffix}.`, {
        title: "Retry Center"
      });
    },
    [
      activeSessionId,
      activeTabId,
      classifyTransferFailureReason,
      confirmRetryBatchIfNeeded,
      getRetryCenterEntriesForRetryScope,
      queueRetryEntries,
      setRetryCenterSelection,
      showAppAlert,
      visibleRetryCenterFailedEntries
    ]
  );

  const retryVisibleRetryCenterEntriesWithScopeChoice = useCallback(
    async (failureReason?: string) => {
      if (!activeTabId || !activeSessionId) {
        await showAppAlert("Open a terminal tab for the target session first.", {
          title: "Retry Center"
        });
        return;
      }
      const baseEntries =
        typeof failureReason === "string" && failureReason.trim()
          ? visibleRetryCenterFailedEntries.filter(
              (entry) => classifyTransferFailureReason(entry.message) === failureReason
            )
          : visibleRetryCenterFailedEntries;
      if (baseEntries.length === 0) {
        if (failureReason) {
          await showAppAlert(
            `No visible failed records for reason "${failureReason}" under the active session.`,
            {
              title: "Retry Center"
            }
          );
        }
        return;
      }
      const message =
        typeof failureReason === "string" && failureReason.trim()
          ? `Choose retry scope for visible "${failureReason}" failures.`
          : "Choose retry scope for visible failed records.";
      const retryScope = await chooseRetryCenterRetryScope(baseEntries, message);
      if (!retryScope) {
        return;
      }
      await retryVisibleRetryCenterEntries(failureReason, retryScope);
    },
    [
      activeSessionId,
      activeTabId,
      chooseRetryCenterRetryScope,
      classifyTransferFailureReason,
      retryVisibleRetryCenterEntries,
      showAppAlert,
      visibleRetryCenterFailedEntries
    ]
  );

  const clearVisibleRetryCenterEntriesByFailureReason = useCallback(
    async (failureReason: string) => {
      const normalizedReason = failureReason.trim();
      if (!normalizedReason) {
        return;
      }
      const targetEntries = retryCenterEntries.filter(
        (entry) =>
          entry.status === "failed" && classifyTransferFailureReason(entry.message) === normalizedReason
      );
      if (targetEntries.length === 0) {
        await showAppAlert(
          `No visible failed history records found for reason "${normalizedReason}".`,
          {
            title: "Retry Center"
          }
        );
        return;
      }
      const confirmed = await showAppConfirm(
        `Delete ${targetEntries.length} visible failed history record(s) with reason "${normalizedReason}"?`,
        {
          title: "Retry Center",
          confirmLabel: "Delete Reason",
          cancelLabel: "Cancel",
          danger: true
        }
      );
      if (!confirmed) {
        return;
      }
      const targetKeys = new Set(targetEntries.map((entry) => entry.key));
      setTransferHistory((prev) => prev.filter((entry) => !targetKeys.has(entry.key)));
      setRetryCenterSelection((prev) => prev.filter((key) => !targetKeys.has(key)));
    },
    [
      classifyTransferFailureReason,
      retryCenterEntries,
      setRetryCenterSelection,
      setTransferHistory,
      showAppAlert,
      showAppConfirm
    ]
  );

  const clearSelectedRetryCenterEntries = useCallback(async () => {
    if (selectedRetryCenterEntries.length === 0) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Delete ${selectedRetryCenterEntries.length} selected history record(s)?`,
      {
        title: "Retry Center",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    const selectedKeys = new Set(selectedRetryCenterEntries.map((entry) => entry.key));
    setTransferHistory((prev) => prev.filter((entry) => !selectedKeys.has(entry.key)));
    setRetryCenterSelection([]);
  }, [selectedRetryCenterEntries, setRetryCenterSelection, setTransferHistory, showAppConfirm]);

  const clearVisibleRetryCenterEntries = useCallback(async () => {
    if (retryCenterEntries.length === 0) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Delete ${retryCenterEntries.length} visible history record(s)?`,
      {
        title: "Retry Center",
        confirmLabel: "Delete Visible",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    const visibleKeys = new Set(retryCenterEntries.map((entry) => entry.key));
    setTransferHistory((prev) => prev.filter((entry) => !visibleKeys.has(entry.key)));
    setRetryCenterSelection([]);
  }, [retryCenterEntries, setRetryCenterSelection, setTransferHistory, showAppConfirm]);

  const queueFailedUploadRetryCandidates = useCallback(
    (tabId: string, retryCandidates: FailedRetryCandidate[]) => {
      const queuedCount = enqueueUploadTargets(
        tabId,
        retryCandidates.map((transfer) => ({
          name: transfer.name,
          localPath: transfer.localPath,
          remotePath: transfer.remotePath
        })),
        {
          suppressEmptyError: true
        }
      );
      if (queuedCount > 0) {
        markTransferHistoryRetryQueued(
          "upload",
          retryCandidates.map((transfer) => ({
            localPath: transfer.localPath,
            remotePath: transfer.remotePath
          }))
        );
      }
      return queuedCount;
    },
    [enqueueUploadTargets, markTransferHistoryRetryQueued]
  );

  const queueFailedDownloadRetryCandidates = useCallback(
    async (tabId: string, retryCandidates: FailedRetryCandidate[], sessionId?: string) => {
      const retryTargets = retryCandidates.map((transfer) => ({
        name: transfer.name,
        remotePath: transfer.remotePath,
        localPath: transfer.localPath
      }));
      const resolvedTargets = await resolveDownloadTargetConflicts(retryTargets, {
        tabId,
        sessionId
      });
      if (!resolvedTargets || resolvedTargets.length === 0) {
        return 0;
      }
      const queuedCount = enqueueDownloadTargets(tabId, resolvedTargets, {
        suppressEmptyError: true
      });
      if (queuedCount > 0) {
        markTransferHistoryRetryQueued(
          "download",
          resolvedTargets.map((entry) => ({
            localPath: entry.localPath,
            remotePath: entry.remotePath
          }))
        );
      }
      return queuedCount;
    },
    [enqueueDownloadTargets, markTransferHistoryRetryQueued, resolveDownloadTargetConflicts]
  );

  const retryFailedUploads = useCallback(async () => {
    if (!activeTabId || failedUploadRetryCandidates.length === 0) {
      return;
    }
    const confirmed = await confirmRetryBatchIfNeeded(
      failedUploadRetryCandidates.length,
      "failed upload candidates"
    );
    if (!confirmed) {
      return;
    }
    const queuedCount = queueFailedUploadRetryCandidates(activeTabId, [...failedUploadRetryCandidates]);
    if (queuedCount > 0) {
      await showAppAlert(`Requeued ${queuedCount} failed upload task(s).`, {
        title: "Retry Uploads"
      });
    }
  }, [
    activeTabId,
    confirmRetryBatchIfNeeded,
    failedUploadRetryCandidates,
    queueFailedUploadRetryCandidates,
    showAppAlert
  ]);

  const retryFailedDownloads = useCallback(async () => {
    if (!activeTabId || failedDownloadRetryCandidates.length === 0) {
      return;
    }
    const confirmed = await confirmRetryBatchIfNeeded(
      failedDownloadRetryCandidates.length,
      "failed download candidates"
    );
    if (!confirmed) {
      return;
    }
    const queuedCount = await queueFailedDownloadRetryCandidates(
      activeTabId,
      [...failedDownloadRetryCandidates],
      activeSessionId ?? undefined
    );
    if (queuedCount > 0) {
      await showAppAlert(`Requeued ${queuedCount} failed download task(s).`, {
        title: "Retry Downloads"
      });
    }
  }, [
    activeSessionId,
    activeTabId,
    confirmRetryBatchIfNeeded,
    failedDownloadRetryCandidates,
    queueFailedDownloadRetryCandidates,
    showAppAlert
  ]);

  const retryAllFailedTransfers = useCallback(
    async (retryScope: RetryCenterRetryScope = "all") => {
      if (!activeTabId || failedRetryCandidateTotal <= 0) {
        return;
      }
      const uploadCandidates =
        retryScope === "download" ? [] : [...failedUploadRetryCandidates];
      const downloadCandidates =
        retryScope === "upload" ? [] : [...failedDownloadRetryCandidates];
      const targetCount = uploadCandidates.length + downloadCandidates.length;
      if (targetCount <= 0) {
        await showAppAlert("No transfer tasks were requeued.", {
          title: "Retry Transfers"
        });
        return;
      }
      const scopeLabel =
        retryScope === "upload"
          ? "all failed upload candidates"
          : retryScope === "download"
            ? "all failed download candidates"
            : "all failed transfer candidates";
      const confirmed = await confirmRetryBatchIfNeeded(targetCount, scopeLabel);
      if (!confirmed) {
        return;
      }
      const uploadQueued =
        uploadCandidates.length > 0
          ? queueFailedUploadRetryCandidates(activeTabId, uploadCandidates)
          : 0;
      const downloadQueued =
        downloadCandidates.length > 0
          ? await queueFailedDownloadRetryCandidates(
              activeTabId,
              downloadCandidates,
              activeSessionId ?? undefined
            )
          : 0;
      const queuedTotal = uploadQueued + downloadQueued;
      if (queuedTotal <= 0) {
        await showAppAlert("No transfer tasks were requeued.", {
          title: "Retry Transfers"
        });
        return;
      }
      const scopeSuffix =
        retryScope === "upload"
          ? " (upload-only)"
          : retryScope === "download"
            ? " (download-only)"
            : "";
      await showAppAlert(
        `Requeued ${queuedTotal} failed transfer task(s)${scopeSuffix}. Upload ${uploadQueued}, Download ${downloadQueued}.`,
        {
          title: "Retry Transfers"
        }
      );
    },
    [
      activeSessionId,
      activeTabId,
      confirmRetryBatchIfNeeded,
      failedDownloadRetryCandidates,
      failedRetryCandidateTotal,
      failedUploadRetryCandidates,
      queueFailedDownloadRetryCandidates,
      queueFailedUploadRetryCandidates,
      showAppAlert
    ]
  );

  const retryAllFailedTransfersWithScopeChoice = useCallback(async () => {
    if (!activeTabId || failedRetryCandidateTotal <= 0) {
      return;
    }
    const retryScope = await chooseRetryCenterRetryScopeByCounts(
      {
        all: failedRetryCandidateTotal,
        upload: failedUploadRetryCandidates.length,
        download: failedDownloadRetryCandidates.length
      },
      "Choose retry scope for all failed transfer candidates."
    );
    if (!retryScope) {
      return;
    }
    await retryAllFailedTransfers(retryScope);
  }, [
    activeTabId,
    chooseRetryCenterRetryScopeByCounts,
    failedDownloadRetryCandidates.length,
    failedRetryCandidateTotal,
    failedUploadRetryCandidates.length,
    retryAllFailedTransfers
  ]);

  const getFailedEntriesForTab = useCallback(
    (tabId: string) => {
      const tab = terminalTabs.find((entry) => entry.id === tabId);
      if (!tab) {
        return [] as TEntry[];
      }
      return retryCenterEntries.filter(
        (entry) => entry.status === "failed" && entry.sessionId === tab.sessionId
      );
    },
    [retryCenterEntries, terminalTabs]
  );

  const countRetryTargetsForEntries = useCallback(
    (entries: TEntry[]) => {
      const { uploadTargets, downloadTargets } = buildRetryTargetMaps(entries, createTransferRetryKey);
      return {
        downloadTargets,
        total: uploadTargets.length + downloadTargets.length,
        uploadTargets
      };
    },
    [createTransferRetryKey]
  );

  const allTabsFailedRetryCandidateTotal = useMemo(() => {
    const openSessionIds = new Set(terminalTabs.map((tab) => tab.sessionId));
    const failedEntries = retryCenterEntries.filter(
      (entry) => entry.status === "failed" && openSessionIds.has(entry.sessionId)
    );
    return countRetryTargetsForEntries(failedEntries).total;
  }, [countRetryTargetsForEntries, retryCenterEntries, terminalTabs]);

  const retryFailedTransfersForTab = useCallback(
    async (tabId: string) => {
      const tab = terminalTabs.find((entry) => entry.id === tabId);
      if (!tab) {
        return;
      }
      const failedEntries = getFailedEntriesForTab(tabId);
      const { downloadTargets, total, uploadTargets } = countRetryTargetsForEntries(failedEntries);
      if (total <= 0) {
        return;
      }
      const confirmed = await confirmRetryBatchIfNeeded(total, `failed transfer candidates for tab ${tabId}`);
      if (!confirmed) {
        return;
      }
      const uploadQueued =
        uploadTargets.length > 0 ? queueFailedUploadRetryCandidates(tabId, uploadTargets) : 0;
      const downloadQueued =
        downloadTargets.length > 0
          ? await queueFailedDownloadRetryCandidates(tabId, downloadTargets, tab.sessionId)
          : 0;
      const queuedTotal = uploadQueued + downloadQueued;
      if (queuedTotal > 0) {
        await showAppAlert(`Requeued ${queuedTotal} failed transfer task(s) for the selected tab.`, {
          title: "Retry Tab Tasks"
        });
      }
    },
    [
      confirmRetryBatchIfNeeded,
      countRetryTargetsForEntries,
      getFailedEntriesForTab,
      queueFailedDownloadRetryCandidates,
      queueFailedUploadRetryCandidates,
      showAppAlert,
      terminalTabs
    ]
  );

  const retryAllFailedTransfersAcrossTabsWithScopeChoice = useCallback(async () => {
    const openSessionIds = new Set(terminalTabs.map((tab) => tab.sessionId));
    const failedEntries = retryCenterEntries.filter(
      (entry) => entry.status === "failed" && openSessionIds.has(entry.sessionId)
    );
    const { downloadTargets: allDownloadTargets, uploadTargets: allUploadTargets } =
      countRetryTargetsForEntries(failedEntries);
    const allCount = allUploadTargets.length + allDownloadTargets.length;
    if (allCount <= 0) {
      return;
    }
    const retryScope = await chooseRetryCenterRetryScopeByCounts(
      {
        all: allCount,
        upload: allUploadTargets.length,
        download: allDownloadTargets.length
      },
      "Choose retry scope for failed transfer candidates across all open tabs."
    );
    if (!retryScope) {
      return;
    }
    const confirmed = await confirmRetryBatchIfNeeded(allCount, "failed transfer candidates across tabs");
    if (!confirmed) {
      return;
    }
    let queuedTotal = 0;
    for (const tab of terminalTabs) {
      const tabFailed = failedEntries.filter((entry) => entry.sessionId === tab.sessionId);
      if (tabFailed.length === 0) {
        continue;
      }
      const scopedEntries =
        retryScope === "upload"
          ? tabFailed.filter((entry) => entry.direction === "upload")
          : retryScope === "download"
            ? tabFailed.filter((entry) => entry.direction === "download")
            : tabFailed;
      const { downloadTargets, uploadTargets } = countRetryTargetsForEntries(scopedEntries);
      if (uploadTargets.length > 0) {
        queuedTotal += queueFailedUploadRetryCandidates(tab.id, uploadTargets);
      }
      if (downloadTargets.length > 0) {
        queuedTotal += await queueFailedDownloadRetryCandidates(tab.id, downloadTargets, tab.sessionId);
      }
    }
    if (queuedTotal > 0) {
      await showAppAlert(`Requeued ${queuedTotal} failed transfer task(s) across open tabs.`, {
        title: "Retry Transfers"
      });
    }
  }, [
    chooseRetryCenterRetryScopeByCounts,
    confirmRetryBatchIfNeeded,
    countRetryTargetsForEntries,
    queueFailedDownloadRetryCandidates,
    queueFailedUploadRetryCandidates,
    retryCenterEntries,
    showAppAlert,
    terminalTabs
  ]);

  const clearAllRetryCenterEntries = useCallback(async () => {
    const totalCount = totalHistoryCount;
    if (totalCount === 0) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Delete all ${totalCount} transfer history record(s)?`,
      {
        title: "Retry Center",
        confirmLabel: "Delete All",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    setTransferHistory([]);
    setRetryCenterSelection([]);
  }, [setRetryCenterSelection, setTransferHistory, showAppConfirm, totalHistoryCount]);

  return {
    allTabsFailedRetryCandidateTotal,
    clearAllRetryCenterEntries,
    clearRetryCenterGroupEntries,
    clearSelectedRetryCenterEntries,
    clearVisibleRetryCenterEntries,
    clearVisibleRetryCenterEntriesByFailureReason,
    getFailedEntriesForTab,
    retryAllFailedTransfersAcrossTabsWithScopeChoice,
    retryAllFailedTransfersWithScopeChoice,
    retryFailedDownloads,
    retryFailedTransfersForTab,
    retryFailedUploads,
    retryRetryCenterGroupFailedEntries,
    retrySelectedRetryCenterEntriesWithScopeChoice,
    retryVisibleRetryCenterEntriesWithScopeChoice
  };
}
