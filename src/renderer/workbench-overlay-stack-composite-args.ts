import type { WorkbenchOverlayStackProps } from "./components/workbench-overlay-stack";

type WorkbenchOverlayMenuArgs = Pick<
  WorkbenchOverlayStackProps,
  | "commandHistoryContextMenuProps"
  | "commandHistoryContextMenuRef"
  | "sessionContextMenuProps"
  | "sessionContextMenuRef"
  | "sftpEntryContextMenuProps"
  | "sftpEntryContextMenuRef"
  | "sftpToolbarContextMenuProps"
  | "sftpToolbarContextMenuRef"
>;

type WorkbenchOverlayDialogArgs = Pick<
  WorkbenchOverlayStackProps,
  | "appDialogModalProps"
  | "commandHistoryManagerModalProps"
  | "commandSnippetManagerModalProps"
  | "moveGroupDialogModalProps"
  | "operationCenterModalProps"
  | "retryCenterModalProps"
  | "serverHealthDetailModalProps"
  | "sessionCreateModalProps"
  | "sessionTemplateManagerModalProps"
>;

type WorkbenchOverlayChromeArgs = Pick<
  WorkbenchOverlayStackProps,
  | "globalErrorBarProps"
  | "settingsModalContentProps"
  | "settingsModalShellProps"
>;

interface BuildWorkbenchOverlayStackCompositeArgsInput {
  chrome: WorkbenchOverlayChromeArgs;
  dialogs: WorkbenchOverlayDialogArgs;
  menus: WorkbenchOverlayMenuArgs;
}

export function buildWorkbenchOverlayStackCompositeArgs({
  chrome,
  dialogs,
  menus
}: BuildWorkbenchOverlayStackCompositeArgsInput): WorkbenchOverlayStackProps {
  return {
    ...chrome,
    ...dialogs,
    ...menus
  };
}
