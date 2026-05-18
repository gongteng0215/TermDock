import { useCallback, useState, type MutableRefObject } from "react";

interface OperationCenterTransferTabSummaryLike {
  tabId: string;
  connected: boolean;
}

interface TerminalTabLike {
  id: string;
  sessionId: string;
}

interface TerminalApiLike {
  connect: (tabId: string, sessionId: string) => Promise<void>;
}

type TransferDockNoticeTone = "info" | "warn";

interface UseOperationCenterActionsArgs<
  TTransferSummary extends OperationCenterTransferTabSummaryLike,
  TTerminalTab extends TerminalTabLike
> {
  activeTabId: string | null;
  cancelAllDownloadsForTab: (tabId: string) => Promise<void>;
  cancelAllUploadsForTab: (tabId: string) => Promise<void>;
  operationCenterTransferTabSummaries: TTransferSummary[];
  setError: (message: string | null) => void;
  showTransferDockNotice: (
    tabId: string,
    tone: TransferDockNoticeTone,
    message: string,
    timeoutMs?: number
  ) => void;
  terminalApi: TerminalApiLike | null;
  terminalTabsRef: MutableRefObject<TTerminalTab[]>;
  toLogMessage: (error: unknown) => string;
  writeAppLog: (
    level: "info" | "warn" | "error",
    scope: string,
    message: string,
    context?: unknown
  ) => void;
}

export function useOperationCenterActions<
  TTransferSummary extends OperationCenterTransferTabSummaryLike,
  TTerminalTab extends TerminalTabLike
>({
  activeTabId,
  cancelAllDownloadsForTab,
  cancelAllUploadsForTab,
  operationCenterTransferTabSummaries,
  setError,
  showTransferDockNotice,
  terminalApi,
  terminalTabsRef,
  toLogMessage,
  writeAppLog
}: UseOperationCenterActionsArgs<TTransferSummary, TTerminalTab>) {
  const [isOperationCenterBulkCanceling, setIsOperationCenterBulkCanceling] = useState(false);
  const [isOperationCenterReconnecting, setIsOperationCenterReconnecting] = useState(false);

  const cancelTransferTasksForTab = useCallback(
    async (tabId: string): Promise<void> => {
      await cancelAllUploadsForTab(tabId);
      await cancelAllDownloadsForTab(tabId);
    },
    [cancelAllDownloadsForTab, cancelAllUploadsForTab]
  );

  const cancelAllActiveUploads = useCallback(async () => {
    if (!activeTabId) {
      return;
    }
    await cancelAllUploadsForTab(activeTabId);
  }, [activeTabId, cancelAllUploadsForTab]);

  const cancelAllActiveDownloads = useCallback(async () => {
    if (!activeTabId) {
      return;
    }
    await cancelAllDownloadsForTab(activeTabId);
  }, [activeTabId, cancelAllDownloadsForTab]);

  const cancelAllTransfersAcrossTabs = useCallback(async () => {
    if (isOperationCenterBulkCanceling) {
      return;
    }
    if (operationCenterTransferTabSummaries.length === 0) {
      if (activeTabId) {
        showTransferDockNotice(activeTabId, "info", "No active transfer tasks across tabs.");
      }
      return;
    }
    setIsOperationCenterBulkCanceling(true);
    try {
      for (const summary of operationCenterTransferTabSummaries) {
        await cancelTransferTasksForTab(summary.tabId);
      }
      if (activeTabId) {
        showTransferDockNotice(
          activeTabId,
          "warn",
          `Canceled active transfer tasks across ${operationCenterTransferTabSummaries.length} tab(s).`,
          8000
        );
      }
    } finally {
      setIsOperationCenterBulkCanceling(false);
    }
  }, [
    activeTabId,
    cancelTransferTasksForTab,
    isOperationCenterBulkCanceling,
    operationCenterTransferTabSummaries,
    showTransferDockNotice
  ]);

  const reconnectOperationTabById = useCallback(
    async (tabId: string): Promise<boolean> => {
      const normalizedTabId = tabId.trim();
      if (!normalizedTabId || !terminalApi) {
        return false;
      }
      const tab = terminalTabsRef.current.find((entry) => entry.id === normalizedTabId);
      if (!tab) {
        return false;
      }
      try {
        await terminalApi.connect(normalizedTabId, tab.sessionId);
        return true;
      } catch (caughtError) {
        const message = toLogMessage(caughtError);
        setError(message);
        writeAppLog(
          "warn",
          "renderer:operation-center",
          "Reconnect action failed for operation-center tab.",
          {
            tabId: normalizedTabId,
            sessionId: tab.sessionId,
            message
          }
        );
        return false;
      }
    },
    [setError, terminalApi, terminalTabsRef, toLogMessage, writeAppLog]
  );

  const reconnectDisconnectedOperationTabs = useCallback(async () => {
    if (isOperationCenterReconnecting) {
      return;
    }
    const targets = operationCenterTransferTabSummaries.filter((entry) => !entry.connected);
    if (targets.length === 0) {
      if (activeTabId) {
        showTransferDockNotice(activeTabId, "info", "No disconnected transfer tabs to reconnect.");
      }
      return;
    }
    setIsOperationCenterReconnecting(true);
    try {
      let successCount = 0;
      let failedCount = 0;
      for (const target of targets) {
        const ok = await reconnectOperationTabById(target.tabId);
        if (ok) {
          successCount += 1;
        } else {
          failedCount += 1;
        }
      }
      if (activeTabId) {
        showTransferDockNotice(
          activeTabId,
          failedCount > 0 ? "warn" : "info",
          failedCount > 0
            ? `Reconnect completed: ${successCount} succeeded, ${failedCount} failed.`
            : `Reconnect completed: ${successCount} tab(s) requested.`,
          8000
        );
      }
    } finally {
      setIsOperationCenterReconnecting(false);
    }
  }, [
    activeTabId,
    isOperationCenterReconnecting,
    operationCenterTransferTabSummaries,
    reconnectOperationTabById,
    showTransferDockNotice
  ]);

  return {
    cancelAllActiveDownloads,
    cancelAllActiveUploads,
    cancelAllTransfersAcrossTabs,
    cancelTransferTasksForTab,
    isOperationCenterBulkCanceling,
    isOperationCenterReconnecting,
    reconnectDisconnectedOperationTabs,
    reconnectOperationTabById
  };
}
