import type { WorkbenchContextMenuProps } from "./components/workbench-context-menus";
import { buildCommandHistoryContextMenuActions } from "./command-history-context-menu-actions";
import {
  buildSftpContextActions,
  buildSftpToolbarActions,
  type SftpContextAction
} from "./sftp-context-actions";
import {
  buildSessionContextActions,
  type SessionContextAction
} from "./session-context-actions";
import {
  buildActionWorkbenchContextMenuProps,
  buildWorkbenchContextMenuProps
} from "./workbench-overlay-props";

interface WorkbenchContextMenuPosition {
  x: number;
  y: number;
}

type CommandHistoryContextMenuActionArgs =
  Parameters<typeof buildCommandHistoryContextMenuActions>[0];
type SftpToolbarContextMenuActionArgs = Parameters<typeof buildSftpToolbarActions>[0];
type SftpEntryContextMenuActionArgs = Parameters<typeof buildSftpContextActions>[0];
type SessionContextMenuActionArgs = Parameters<typeof buildSessionContextActions>[0];

interface BuildCommandHistoryContextMenuOverlayPropsArgs
  extends CommandHistoryContextMenuActionArgs {
  menu: WorkbenchContextMenuPosition | null;
}

export function buildCommandHistoryContextMenuOverlayProps({
  menu,
  ...actionArgs
}: BuildCommandHistoryContextMenuOverlayPropsArgs): WorkbenchContextMenuProps | null {
  return buildWorkbenchContextMenuProps({
    actions: buildCommandHistoryContextMenuActions(actionArgs),
    height: actionArgs.entry ? 152 : 192,
    menu,
    width: 196
  });
}

interface BuildSftpToolbarContextMenuOverlayPropsArgs
  extends SftpToolbarContextMenuActionArgs {
  menu: WorkbenchContextMenuPosition | null;
  onSelect: (action: SftpContextAction) => void;
}

export function buildSftpToolbarContextMenuOverlayProps({
  menu,
  onSelect,
  ...actionArgs
}: BuildSftpToolbarContextMenuOverlayPropsArgs): WorkbenchContextMenuProps | null {
  return buildActionWorkbenchContextMenuProps({
    actions: buildSftpToolbarActions(actionArgs).map((action) =>
      action.id === "delete-selected" ? { ...action, danger: true } : action
    ),
    menu,
    onSelect,
    width: 236
  });
}

interface BuildSftpEntryContextMenuOverlayPropsArgs
  extends SftpEntryContextMenuActionArgs {
  menu: WorkbenchContextMenuPosition | null;
  onSelect: (action: SftpContextAction) => void;
}

export function buildSftpEntryContextMenuOverlayProps({
  menu,
  onSelect,
  ...actionArgs
}: BuildSftpEntryContextMenuOverlayPropsArgs): WorkbenchContextMenuProps | null {
  return buildActionWorkbenchContextMenuProps({
    actions: buildSftpContextActions(actionArgs),
    menu,
    onSelect,
    width: 196
  });
}

interface BuildSessionContextMenuOverlayPropsArgs
  extends SessionContextMenuActionArgs {
  menu: WorkbenchContextMenuPosition | null;
  onSelect: (action: SessionContextAction) => void;
}

export function buildSessionContextMenuOverlayProps({
  menu,
  onSelect,
  ...actionArgs
}: BuildSessionContextMenuOverlayPropsArgs): WorkbenchContextMenuProps | null {
  return buildActionWorkbenchContextMenuProps({
    actions: buildSessionContextActions(actionArgs),
    menu,
    onSelect,
    width: 236
  });
}

interface BuildWorkbenchContextMenuCompositePropsArgs {
  commandHistory: BuildCommandHistoryContextMenuOverlayPropsArgs;
  session: BuildSessionContextMenuOverlayPropsArgs;
  sftpEntry: BuildSftpEntryContextMenuOverlayPropsArgs;
  sftpToolbar: BuildSftpToolbarContextMenuOverlayPropsArgs;
}

export function buildWorkbenchContextMenuCompositeProps({
  commandHistory,
  session,
  sftpEntry,
  sftpToolbar
}: BuildWorkbenchContextMenuCompositePropsArgs) {
  return {
    commandHistoryContextMenuProps:
      buildCommandHistoryContextMenuOverlayProps(commandHistory),
    sessionContextMenuProps: buildSessionContextMenuOverlayProps(session),
    sftpEntryContextMenuProps: buildSftpEntryContextMenuOverlayProps(sftpEntry),
    sftpToolbarContextMenuProps:
      buildSftpToolbarContextMenuOverlayProps(sftpToolbar)
  };
}
