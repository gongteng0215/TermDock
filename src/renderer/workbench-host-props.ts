import type { ComponentProps, Ref } from "react";

import type { WorkbenchAppShellProps } from "./components/workbench-app-shell";
import type { WorkbenchOverlayStackProps } from "./components/workbench-overlay-stack";
import type { WorkbenchRootFrameProps } from "./components/workbench-root-frame";

export function buildWorkbenchAppShellProps(
  props: WorkbenchAppShellProps
): WorkbenchAppShellProps {
  return props;
}

interface BuildWorkbenchOverlayStackPropsArgs
  extends Omit<
    WorkbenchOverlayStackProps,
    | "commandHistoryContextMenuRef"
    | "sessionContextMenuRef"
    | "sftpEntryContextMenuRef"
    | "sftpToolbarContextMenuRef"
  > {
  commandHistoryContextMenuRef: Ref<HTMLDivElement>;
  sessionContextMenuRef: Ref<HTMLDivElement>;
  sftpEntryContextMenuRef: Ref<HTMLDivElement>;
  sftpToolbarContextMenuRef: Ref<HTMLDivElement>;
}

export function buildWorkbenchOverlayStackProps({
  commandHistoryContextMenuRef,
  sessionContextMenuRef,
  sftpEntryContextMenuRef,
  sftpToolbarContextMenuRef,
  ...props
}: BuildWorkbenchOverlayStackPropsArgs): WorkbenchOverlayStackProps {
  return {
    ...props,
    commandHistoryContextMenuRef,
    sessionContextMenuRef,
    sftpEntryContextMenuRef,
    sftpToolbarContextMenuRef
  };
}

export function buildWorkbenchRootFrameProps(
  props: WorkbenchRootFrameProps
): WorkbenchRootFrameProps {
  return props;
}
