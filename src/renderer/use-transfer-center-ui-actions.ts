import { useCallback, type Dispatch, type SetStateAction } from "react";

import type { SettingsSectionId } from "./components/settings-modal-content";

interface RetryCenterEntryLike {
  key: string;
}

interface SftpTransferLike {
  tabId: string;
  direction: "upload" | "download";
  status: string;
}

interface UseTransferCenterUiActionsArgs<TTransfer extends SftpTransferLike> {
  activeTabId: string | null;
  openCommandSnippetManager: () => void;
  openSettingsPanel: (section: SettingsSectionId) => void;
  parseRetryBatchConfirmThreshold: (value: unknown, fallback: number) => number;
  retryCenterEntries: RetryCenterEntryLike[];
  setIsOperationCenterOpen: Dispatch<SetStateAction<boolean>>;
  setIsRetryCenterOpen: Dispatch<SetStateAction<boolean>>;
  setRetryBatchConfirmThreshold: Dispatch<SetStateAction<number>>;
  setRetryCenterAutoUseLastRetryScope: Dispatch<SetStateAction<boolean>>;
  setRetryCenterSelection: Dispatch<SetStateAction<string[]>>;
  setSftpTransfers: Dispatch<SetStateAction<TTransfer[]>>;
}

export function useTransferCenterUiActions<TTransfer extends SftpTransferLike>({
  activeTabId,
  openCommandSnippetManager,
  openSettingsPanel,
  parseRetryBatchConfirmThreshold,
  retryCenterEntries,
  setIsOperationCenterOpen,
  setIsRetryCenterOpen,
  setRetryBatchConfirmThreshold,
  setRetryCenterAutoUseLastRetryScope,
  setRetryCenterSelection,
  setSftpTransfers
}: UseTransferCenterUiActionsArgs<TTransfer>) {
  const clearFinishedTransfers = useCallback(
    (direction: "upload" | "download") => {
      if (!activeTabId) {
        return;
      }
      setSftpTransfers((prev) =>
        prev.filter((transfer) => {
          if (transfer.tabId !== activeTabId || transfer.direction !== direction) {
            return true;
          }
          return transfer.status === "queued" || transfer.status === "running";
        })
      );
    },
    [activeTabId, setSftpTransfers]
  );

  const openRetryCenter = useCallback(() => {
    setIsRetryCenterOpen(true);
  }, [setIsRetryCenterOpen]);

  const closeRetryCenter = useCallback(() => {
    setIsRetryCenterOpen(false);
    setRetryCenterSelection([]);
  }, [setIsRetryCenterOpen, setRetryCenterSelection]);

  const openOperationCenter = useCallback(() => {
    setIsOperationCenterOpen(true);
  }, [setIsOperationCenterOpen]);

  const closeOperationCenter = useCallback(() => {
    setIsOperationCenterOpen(false);
  }, [setIsOperationCenterOpen]);

  const openDiagnosticsFromOperationCenter = useCallback(() => {
    closeOperationCenter();
    openSettingsPanel("diagnostics");
  }, [closeOperationCenter, openSettingsPanel]);

  const openCommandSnippetManagerFromOperationCenter = useCallback(() => {
    closeOperationCenter();
    openCommandSnippetManager();
  }, [closeOperationCenter, openCommandSnippetManager]);

  const openRetryCenterFromOperationCenter = useCallback(() => {
    closeOperationCenter();
    openRetryCenter();
  }, [closeOperationCenter, openRetryCenter]);

  const openPortForwardingFromOperationCenter = useCallback(() => {
    closeOperationCenter();
    openSettingsPanel("portForwarding");
  }, [closeOperationCenter, openSettingsPanel]);

  const toggleRetryCenterEntrySelection = useCallback(
    (key: string) => {
      const normalized = key.trim();
      if (!normalized) {
        return;
      }
      setRetryCenterSelection((prev) => {
        if (prev.includes(normalized)) {
          return prev.filter((entryKey) => entryKey !== normalized);
        }
        return [...prev, normalized];
      });
    },
    [setRetryCenterSelection]
  );

  const selectAllVisibleRetryCenterEntries = useCallback(() => {
    setRetryCenterSelection(retryCenterEntries.map((entry) => entry.key));
  }, [retryCenterEntries, setRetryCenterSelection]);

  const clearRetryCenterSelection = useCallback(() => {
    setRetryCenterSelection([]);
  }, [setRetryCenterSelection]);

  const toggleRetryCenterAutoUseLastRetryScope = useCallback(() => {
    setRetryCenterAutoUseLastRetryScope((prev) => !prev);
  }, [setRetryCenterAutoUseLastRetryScope]);

  const changeRetryBatchConfirmThreshold = useCallback(
    (value: number) => {
      setRetryBatchConfirmThreshold((prev) =>
        parseRetryBatchConfirmThreshold(value, prev)
      );
    },
    [parseRetryBatchConfirmThreshold, setRetryBatchConfirmThreshold]
  );

  return {
    changeRetryBatchConfirmThreshold,
    clearFinishedTransfers,
    clearRetryCenterSelection,
    closeOperationCenter,
    closeRetryCenter,
    openCommandSnippetManagerFromOperationCenter,
    openDiagnosticsFromOperationCenter,
    openOperationCenter,
    openPortForwardingFromOperationCenter,
    openRetryCenter,
    openRetryCenterFromOperationCenter,
    selectAllVisibleRetryCenterEntries,
    toggleRetryCenterAutoUseLastRetryScope,
    toggleRetryCenterEntrySelection
  };
}
