import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import {
  MAX_TERMINAL_COMMAND_HISTORY_COMMAND_LENGTH,
  TERMINAL_COMMAND_HISTORY_REMOVE_EVENT,
  type TerminalCommandHistoryEntry,
  type TerminalCommandHistorySource
} from "./components/terminal-workspace";
import { useDismissableLayer } from "./use-dismissable-layer";

interface ImportedCommandHistoryCandidate {
  command: string;
  source: TerminalCommandHistorySource;
}

interface ShowAppAlertOptions {
  title?: string;
  confirmLabel?: string;
  detailText?: string;
  translateDetailText?: boolean;
}

interface SaveTextFileResult {
  canceled: boolean;
  outputPath?: string | null;
}

interface PickAndReadTextFileResult {
  canceled: boolean;
  filePath?: string | null;
  text?: string | null;
}

interface CommandHistorySystemApiLike {
  pickAndReadTextFile?: (options: {
    title: string;
    buttonLabel: string;
    filters: Array<{
      name: string;
      extensions: string[];
    }>;
  }) => Promise<PickAndReadTextFileResult>;
  saveTextFile?: (options: {
    title: string;
    defaultFileName: string;
    text: string;
    filters: Array<{
      name: string;
      extensions: string[];
    }>;
  }) => Promise<SaveTextFileResult>;
}

interface UseCommandHistoryManagerArgs {
  allVisibleCommandHistorySelected: boolean;
  appVersion: string;
  clearCommandHistoryContextMenu: () => void;
  commandHistorySelection: string[];
  copyTextToClipboard: (text: string) => Promise<boolean>;
  entries: TerminalCommandHistoryEntry[];
  formatTerminalCommandHistorySourceLabel: (source: TerminalCommandHistorySource) => string;
  isCommandHistoryManagerOpen: boolean;
  parseImportedCommandHistoryCommands: (payload: unknown) => ImportedCommandHistoryCandidate[];
  setEntries: Dispatch<SetStateAction<TerminalCommandHistoryEntry[]>>;
  setError: (message: string | null) => void;
  setCommandHistorySelection: Dispatch<SetStateAction<string[]>>;
  setIsCommandHistoryManagerOpen: Dispatch<SetStateAction<boolean>>;
  showAppAlert: (message: string, options?: ShowAppAlertOptions) => Promise<void>;
  systemApi: CommandHistorySystemApiLike | null;
  toIsoTimestamp: (timestamp: number) => string;
  toLogMessage: (error: unknown) => string;
  upsertTerminalCommandHistoryCommand: (
    command: string,
    options?: {
      replaceEntryId?: string;
      preferredTabId?: string;
      source?: TerminalCommandHistorySource;
    }
  ) => boolean;
  visibleEntryIds: string[];
  writeAppLog: (
    level: "info" | "warn" | "error",
    scope: string,
    message: string,
    context?: unknown
  ) => void;
}

export function useCommandHistoryManager({
  allVisibleCommandHistorySelected,
  appVersion,
  clearCommandHistoryContextMenu,
  commandHistorySelection,
  copyTextToClipboard,
  entries,
  formatTerminalCommandHistorySourceLabel,
  isCommandHistoryManagerOpen,
  parseImportedCommandHistoryCommands,
  setEntries,
  setError,
  setCommandHistorySelection,
  setIsCommandHistoryManagerOpen,
  showAppAlert,
  systemApi,
  toIsoTimestamp,
  toLogMessage,
  upsertTerminalCommandHistoryCommand,
  visibleEntryIds,
  writeAppLog
}: UseCommandHistoryManagerArgs) {
  const deleteTerminalCommandHistoryEntries = useCallback(
    (entryIds: string[]) => {
      const normalizedEntryIds = Array.from(
        new Set(entryIds.map((entryId) => entryId.trim()).filter((entryId) => entryId.length > 0))
      );
      if (normalizedEntryIds.length === 0) {
        return;
      }
      const deleteSet = new Set(normalizedEntryIds);
      setEntries((prev) => prev.filter((entry) => !deleteSet.has(entry.id)));
      setCommandHistorySelection((prev) => prev.filter((entryId) => !deleteSet.has(entryId)));
      for (const entryId of normalizedEntryIds) {
        window.dispatchEvent(
          new CustomEvent(TERMINAL_COMMAND_HISTORY_REMOVE_EVENT, {
            detail: {
              entryId
            }
          })
        );
      }
    },
    [setEntries]
  );

  const deleteTerminalCommandHistoryEntry = useCallback(
    (entryId: string) => {
      deleteTerminalCommandHistoryEntries([entryId]);
    },
    [deleteTerminalCommandHistoryEntries]
  );

  const toggleCommandHistorySelection = useCallback((entryId: string) => {
    const normalizedEntryId = entryId.trim();
    if (!normalizedEntryId) {
      return;
    }
    setCommandHistorySelection((prev) => {
      if (prev.includes(normalizedEntryId)) {
        return prev.filter((value) => value !== normalizedEntryId);
      }
      return [...prev, normalizedEntryId];
    });
  }, []);

  const toggleSelectAllVisibleCommandHistory = useCallback(() => {
    if (visibleEntryIds.length === 0) {
      return;
    }
    const visibleSet = new Set(visibleEntryIds);
    setCommandHistorySelection((prev) => {
      if (allVisibleCommandHistorySelected) {
        return prev.filter((entryId) => !visibleSet.has(entryId));
      }
      const next = [...prev];
      for (const entryId of visibleEntryIds) {
        if (!next.includes(entryId)) {
          next.push(entryId);
        }
      }
      return next;
    });
  }, [allVisibleCommandHistorySelected, visibleEntryIds]);

  const clearCommandHistorySelection = useCallback(() => {
    setCommandHistorySelection([]);
  }, []);

  const openCommandHistoryManager = useCallback(() => {
    clearCommandHistoryContextMenu();
    setIsCommandHistoryManagerOpen(true);
  }, [clearCommandHistoryContextMenu]);

  const closeCommandHistoryManager = useCallback(() => {
    setIsCommandHistoryManagerOpen(false);
    setCommandHistorySelection([]);
  }, []);

  const deleteSelectedCommandHistoryEntries = useCallback(() => {
    deleteTerminalCommandHistoryEntries(commandHistorySelection);
  }, [commandHistorySelection, deleteTerminalCommandHistoryEntries]);

  const deleteVisibleCommandHistoryEntries = useCallback(() => {
    deleteTerminalCommandHistoryEntries(visibleEntryIds);
  }, [deleteTerminalCommandHistoryEntries, visibleEntryIds]);

  const deleteAllCommandHistoryEntries = useCallback(() => {
    deleteTerminalCommandHistoryEntries(entries.map((entry) => entry.id));
  }, [deleteTerminalCommandHistoryEntries, entries]);

  const exportTerminalCommandHistory = useCallback(async () => {
    try {
      if (entries.length === 0) {
        await showAppAlert("No command history entries available to export.", {
          title: "Export Command History"
        });
        return;
      }
      const generatedAtIso = new Date().toISOString();
      const payload = {
        exportedAtIso: generatedAtIso,
        appVersion,
        count: entries.length,
        entries: entries.map((entry) => ({
          command: entry.command,
          source: entry.source,
          sourceLabel: formatTerminalCommandHistorySourceLabel(entry.source),
          executedAt: entry.executedAt,
          executedAtIso: toIsoTimestamp(entry.executedAt)
        }))
      };
      const exportText = `${JSON.stringify(payload, null, 2)}\n`;
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Command History",
          defaultFileName: `termdock-command-history-${generatedAtIso.replace(/[:]/g, "-")}.json`,
          text: exportText,
          filters: [
            {
              name: "JSON",
              extensions: ["json"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `Command history exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `Command history exported:\n${result.outputPath}`,
            {
              title: "Export Command History"
            }
          );
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("Command history JSON copied to clipboard.", {
          title: "Export Command History"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the command history JSON manually.", {
        title: "Export Command History",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:command-history",
        "Failed to export command history.",
        caughtError
      );
    }
  }, [
    appVersion,
    copyTextToClipboard,
    entries,
    formatTerminalCommandHistorySourceLabel,
    setError,
    showAppAlert,
    systemApi,
    toIsoTimestamp,
    toLogMessage,
    writeAppLog
  ]);

  const importTerminalCommandHistory = useCallback(async () => {
    try {
      if (!systemApi?.pickAndReadTextFile) {
        throw new Error("System bridge unavailable. Restart `pnpm dev`.");
      }
      const selected = await systemApi.pickAndReadTextFile({
        title: "Import Command History",
        buttonLabel: "Import",
        filters: [
          {
            name: "JSON",
            extensions: ["json"]
          },
          {
            name: "Text",
            extensions: ["txt", "log"]
          },
          {
            name: "All Files",
            extensions: ["*"]
          }
        ]
      });
      if (selected.canceled || !selected.filePath) {
        return;
      }
      const rawText = typeof selected.text === "string" ? selected.text : "";
      if (!rawText.trim()) {
        await showAppAlert("Selected file is empty.", {
          title: "Import Command History"
        });
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch (caughtError) {
        await showAppAlert(`Invalid JSON format.\n${toLogMessage(caughtError)}`, {
          title: "Import Command History"
        });
        return;
      }
      const commands = parseImportedCommandHistoryCommands(parsed);
      if (commands.length === 0) {
        await showAppAlert(
          "No importable commands found.\nSupported formats: [\"cmd\"], { commands: [] }, { entries: [{ command }] }",
          {
            title: "Import Command History"
          }
        );
        return;
      }
      for (let index = commands.length - 1; index >= 0; index -= 1) {
        upsertTerminalCommandHistoryCommand(commands[index].command, {
          source: commands[index].source
        });
      }
      await showAppAlert(`Imported ${commands.length} command(s) from:\n${selected.filePath}`, {
        title: "Import Command History"
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:command-history",
        "Failed to import command history.",
        caughtError
      );
    }
  }, [
    parseImportedCommandHistoryCommands,
    setError,
    showAppAlert,
    systemApi,
    toLogMessage,
    upsertTerminalCommandHistoryCommand,
    writeAppLog
  ]);

  useEffect(() => {
    setCommandHistorySelection((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const validIdSet = new Set(entries.map((entry) => entry.id));
      const next = prev.filter((entryId) => validIdSet.has(entryId));
      return next.length === prev.length ? prev : next;
    });
  }, [entries]);

  const commandHistoryManagerLayerRef = useRef<HTMLElement | null>(null);

  useDismissableLayer({
    open: isCommandHistoryManagerOpen,
    onDismiss: closeCommandHistoryManager,
    rootRef: commandHistoryManagerLayerRef,
    closeOnOutsidePointer: false,
    closeOnEscape: true,
    closeOnWindowLayoutChange: false
  });

  useEffect(() => {
    if (!isCommandHistoryManagerOpen) {
      return;
    }
    clearCommandHistoryContextMenu();
  }, [clearCommandHistoryContextMenu, isCommandHistoryManagerOpen]);

  return {
    clearCommandHistorySelection,
    closeCommandHistoryManager,
    deleteAllCommandHistoryEntries,
    deleteSelectedCommandHistoryEntries,
    deleteTerminalCommandHistoryEntries,
    deleteTerminalCommandHistoryEntry,
    deleteVisibleCommandHistoryEntries,
    exportTerminalCommandHistory,
    importTerminalCommandHistory,
    openCommandHistoryManager,
    toggleCommandHistorySelection,
    toggleSelectAllVisibleCommandHistory
  };
}
