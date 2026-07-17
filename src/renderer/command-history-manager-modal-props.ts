import type { TerminalCommandHistoryEntry } from "./terminal-workspace-types";
import type { CommandHistoryManagerModalProps } from "./components/workbench-modals";

interface BuildCommandHistoryManagerModalPropsArgs
  extends Omit<
    CommandHistoryManagerModalProps,
    "onAdd" | "onEditEntry" | "onExport" | "onImport" | "onPasteEntry"
  > {
  addTerminalCommandHistoryEntry: () => Promise<void>;
  editTerminalCommandHistoryEntry: (entry: TerminalCommandHistoryEntry) => Promise<void>;
  exportTerminalCommandHistory: () => Promise<void>;
  importTerminalCommandHistory: () => Promise<void>;
  pasteTerminalCommandHistoryEntry: (entry: TerminalCommandHistoryEntry) => Promise<void>;
  visibleCommandHistoryEntryById: Map<string, TerminalCommandHistoryEntry>;
}

export function buildCommandHistoryManagerModalProps({
  addTerminalCommandHistoryEntry,
  editTerminalCommandHistoryEntry,
  exportTerminalCommandHistory,
  importTerminalCommandHistory,
  pasteTerminalCommandHistoryEntry,
  visibleCommandHistoryEntryById,
  ...modalProps
}: BuildCommandHistoryManagerModalPropsArgs): CommandHistoryManagerModalProps {
  return {
    ...modalProps,
    onAdd: () => {
      void addTerminalCommandHistoryEntry();
    },
    onEditEntry: (entryId) => {
      const entry = visibleCommandHistoryEntryById.get(entryId);
      if (!entry) {
        return;
      }
      void editTerminalCommandHistoryEntry(entry);
    },
    onExport: () => {
      void exportTerminalCommandHistory();
    },
    onImport: () => {
      void importTerminalCommandHistory();
    },
    onPasteEntry: (entryId) => {
      const entry = visibleCommandHistoryEntryById.get(entryId);
      if (!entry) {
        return;
      }
      void pasteTerminalCommandHistoryEntry(entry);
    }
  };
}
