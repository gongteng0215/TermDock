import type { TerminalCommandHistoryEntry } from "./terminal-workspace-types";
import type { WorkbenchContextMenuAction } from "./components/workbench-context-menus";

interface BuildCommandHistoryContextMenuActionsArgs {
  closeMenu: () => void;
  entry: TerminalCommandHistoryEntry | null;
  entryCount: number;
  onAdd: () => void;
  onCopy: (entry: TerminalCommandHistoryEntry) => void;
  onDelete: (entryId: string) => void;
  onExport: () => void;
  onImport: () => void;
  onManage: () => void;
  onOpenSnippetManager: () => void;
  onRun: (entry: TerminalCommandHistoryEntry) => void;
  totalSnippetCount: number;
}

export function buildCommandHistoryContextMenuActions({
  closeMenu,
  entry,
  entryCount,
  onAdd,
  onCopy,
  onDelete,
  onExport,
  onImport,
  onManage,
  onOpenSnippetManager,
  onRun,
  totalSnippetCount
}: BuildCommandHistoryContextMenuActionsArgs): WorkbenchContextMenuAction[] {
  if (entry) {
    return [
      {
        id: "run",
        label: "Run",
        onSelect: () => {
          closeMenu();
          onRun(entry);
        }
      },
      {
        id: "copy",
        label: "Copy",
        onSelect: () => {
          closeMenu();
          onCopy(entry);
        }
      },
      {
        id: "delete",
        label: "Delete",
        danger: true,
        onSelect: () => {
          closeMenu();
          onDelete(entry.id);
        }
      },
      {
        id: "close",
        label: "Close",
        onSelect: closeMenu
      }
    ];
  }

  return [
    {
      id: "add",
      label: "Add",
      onSelect: () => {
        closeMenu();
        onAdd();
      }
    },
    {
      id: "import",
      label: "Import",
      onSelect: () => {
        closeMenu();
        onImport();
      }
    },
    {
      id: "export",
      label: "Export",
      disabled: entryCount === 0,
      onSelect: () => {
        closeMenu();
        onExport();
      }
    },
    {
      id: "run-snippet",
      label: "Run Snippet",
      disabled: totalSnippetCount === 0,
      onSelect: () => {
        closeMenu();
        onOpenSnippetManager();
      }
    },
    {
      id: "snippet-manager",
      label: "Snippet Manager",
      onSelect: () => {
        closeMenu();
        onOpenSnippetManager();
      }
    },
    {
      id: "manage",
      label: "Manage",
      onSelect: () => {
        closeMenu();
        onManage();
      }
    },
    {
      id: "close",
      label: "Close",
      onSelect: closeMenu
    }
  ];
}
