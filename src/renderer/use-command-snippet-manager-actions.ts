import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import type { CommandSnippetGroup } from "./command-snippets";
import { useDismissableLayer } from "./use-dismissable-layer";

interface UseCommandSnippetManagerActionsArgs {
  appVersion: string;
  commandSnippetGroups: CommandSnippetGroup[];
  clearCommandHistoryContextMenu: () => void;
  copyTextToClipboard: (text: string) => Promise<boolean>;
  finishOperationCenterAppJob: (
    jobId: string,
    status: "succeeded" | "failed" | "canceled",
    options?: { detail?: string; outputPath?: string }
  ) => void;
  isOperationCenterAppJobCanceled: (jobId: string) => boolean;
  isCommandSnippetManagerOpen: boolean;
  normalizeCommandSnippetGroups: (payload: unknown) => CommandSnippetGroup[];
  removeOperationCenterAppJob: (jobId: string) => void;
  setCommandSnippetGroups: Dispatch<SetStateAction<CommandSnippetGroup[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setIsCommandSnippetManagerOpen: Dispatch<SetStateAction<boolean>>;
  showAppAlert: (
    message: string,
    options?: {
      title?: string;
      confirmLabel?: string;
      detailText?: string;
      translateDetailText?: boolean;
    }
  ) => Promise<void>;
  startOperationCenterAppJob: (input: {
    category: "snippets";
    title: string;
    description: string;
  }) => string | null;
  systemApi: Window["termdock"]["system"] | null;
  toLogMessage: (error: unknown) => string;
}

export function useCommandSnippetManagerActions({
  appVersion,
  commandSnippetGroups,
  clearCommandHistoryContextMenu,
  copyTextToClipboard,
  finishOperationCenterAppJob,
  isCommandSnippetManagerOpen,
  isOperationCenterAppJobCanceled,
  normalizeCommandSnippetGroups,
  removeOperationCenterAppJob,
  setCommandSnippetGroups,
  setError,
  setIsCommandSnippetManagerOpen,
  showAppAlert,
  startOperationCenterAppJob,
  systemApi,
  toLogMessage
}: UseCommandSnippetManagerActionsArgs) {
  const openCommandSnippetManager = useCallback(() => {
    clearCommandHistoryContextMenu();
    setIsCommandSnippetManagerOpen(true);
  }, [clearCommandHistoryContextMenu, setIsCommandSnippetManagerOpen]);

  const closeCommandSnippetManager = useCallback(() => {
    setIsCommandSnippetManagerOpen(false);
  }, [setIsCommandSnippetManagerOpen]);

  const commandSnippetManagerLayerRef = useRef<HTMLElement | null>(null);

  useDismissableLayer({
    open: isCommandSnippetManagerOpen,
    onDismiss: closeCommandSnippetManager,
    rootRef: commandSnippetManagerLayerRef,
    closeOnOutsidePointer: false,
    closeOnEscape: true,
    closeOnWindowLayoutChange: false
  });

  useEffect(() => {
    if (!isCommandSnippetManagerOpen) {
      return;
    }
    clearCommandHistoryContextMenu();
  }, [clearCommandHistoryContextMenu, isCommandSnippetManagerOpen]);

  const importCommandSnippetGroups = useCallback(async () => {
    let operationJobId: string | null = null;
    try {
      if (!systemApi?.pickAndReadTextFile) {
        throw new Error("System bridge unavailable. Restart `pnpm dev`.");
      }
      const selected = await systemApi.pickAndReadTextFile({
        title: "Import Snippet Groups",
        buttonLabel: "Import",
        filters: [
          { name: "JSON", extensions: ["json"] },
          { name: "All Files", extensions: ["*"] }
        ]
      });
      if (selected.canceled || !selected.filePath) {
        return;
      }
      const parsed = JSON.parse(selected.text);
      const imported = normalizeCommandSnippetGroups(parsed);
      if (imported.length === 0) {
        await showAppAlert("No valid snippet groups found in selected file.", {
          title: "Import Snippet Groups"
        });
        return;
      }
      operationJobId = startOperationCenterAppJob({
        category: "snippets",
        title: "Snippet Groups Import",
        description: `Importing ${imported.length} snippet group${imported.length === 1 ? "" : "s"}.`
      });
      if (operationJobId && isOperationCenterAppJobCanceled(operationJobId)) {
        finishOperationCenterAppJob(operationJobId, "canceled", {
          detail: "Canceled before applying imported snippet groups."
        });
        return;
      }
      setCommandSnippetGroups(imported);
      const importedSnippetCount = imported.reduce((total, group) => total + group.snippets.length, 0);
      if (operationJobId) {
        if (isOperationCenterAppJobCanceled(operationJobId)) {
          finishOperationCenterAppJob(operationJobId, "canceled", {
            detail: "Cancellation requested. Import may still have applied locally."
          });
          return;
        }
        finishOperationCenterAppJob(operationJobId, "succeeded", {
          detail: `Imported ${imported.length} group${imported.length === 1 ? "" : "s"} and ${importedSnippetCount} snippet${importedSnippetCount === 1 ? "" : "s"}.`
        });
      }
      await showAppAlert(
        `Imported ${imported.length} snippet group(s), ${importedSnippetCount} snippet(s).`,
        {
          title: "Import Snippet Groups"
        }
      );
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "failed", {
          detail: message
        });
      }
      setError(`Failed to import snippet groups. ${message}`);
    }
  }, [
    finishOperationCenterAppJob,
    isOperationCenterAppJobCanceled,
    normalizeCommandSnippetGroups,
    setCommandSnippetGroups,
    setError,
    showAppAlert,
    startOperationCenterAppJob,
    systemApi,
    toLogMessage
  ]);

  const exportCommandSnippetGroups = useCallback(async () => {
    let operationJobId: string | null = null;
    try {
      if (commandSnippetGroups.length === 0) {
        await showAppAlert("No snippet groups available to export.", {
          title: "Export Snippet Groups"
        });
        return;
      }
      const snippetCount = commandSnippetGroups.reduce(
        (total, group) => total + group.snippets.length,
        0
      );
      const payload = {
        exportedAtIso: new Date().toISOString(),
        appVersion,
        groupCount: commandSnippetGroups.length,
        snippetCount,
        groups: commandSnippetGroups
      };
      const content = `${JSON.stringify(payload, null, 2)}\n`;
      operationJobId = startOperationCenterAppJob({
        category: "snippets",
        title: "Snippet Groups Export",
        description: `Exporting ${payload.groupCount} snippet group${payload.groupCount === 1 ? "" : "s"} and ${payload.snippetCount} snippet${payload.snippetCount === 1 ? "" : "s"}.`
      });
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Snippet Groups",
          defaultFileName: `termdock-snippet-groups-${new Date().toISOString().replace(/[:]/g, "-")}.json`,
          text: content,
          filters: [{ name: "JSON", extensions: ["json"] }]
        });
        if (!result.canceled && result.outputPath) {
          if (operationJobId) {
            finishOperationCenterAppJob(operationJobId, "succeeded", {
              detail: `Exported ${payload.groupCount} group${payload.groupCount === 1 ? "" : "s"} and ${payload.snippetCount} snippet${payload.snippetCount === 1 ? "" : "s"}.`,
              outputPath: result.outputPath
            });
          }
          await showAppAlert(`Snippet groups exported:\n${result.outputPath}`, {
            title: "Export Snippet Groups"
          });
        } else if (operationJobId) {
          removeOperationCenterAppJob(operationJobId);
        }
        return;
      }
      const copied = await copyTextToClipboard(content);
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "succeeded", {
          detail: copied
            ? `Exported ${payload.groupCount} group${payload.groupCount === 1 ? "" : "s"} to clipboard JSON.`
            : `Prepared snippet group export JSON for manual copy (${payload.groupCount} groups).`
        });
      }
      await showAppAlert(copied ? "Snippet groups JSON copied to clipboard." : content, {
        title: "Export Snippet Groups",
        detailText: copied ? undefined : content
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "failed", {
          detail: message
        });
      }
      setError(`Failed to export snippet groups. ${message}`);
    }
  }, [
    appVersion,
    commandSnippetGroups,
    copyTextToClipboard,
    finishOperationCenterAppJob,
    removeOperationCenterAppJob,
    setError,
    showAppAlert,
    startOperationCenterAppJob,
    systemApi,
    toLogMessage
  ]);

  const importCommandSnippetGroupsWithUiError = useCallback(() => {
    void importCommandSnippetGroups().catch((caughtError) => {
      setError(`Failed to import snippet groups. ${toLogMessage(caughtError)}`);
    });
  }, [importCommandSnippetGroups, setError, toLogMessage]);

  return {
    closeCommandSnippetManager,
    exportCommandSnippetGroups,
    importCommandSnippetGroups,
    importCommandSnippetGroupsWithUiError,
    openCommandSnippetManager
  };
}
