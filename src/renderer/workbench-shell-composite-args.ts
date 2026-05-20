import type { BuildWorkbenchCompositePropsArgs } from "./workbench-composite-props";
import { buildWorkbenchOverlayStackCompositeArgs } from "./workbench-overlay-stack-composite-args";

type WorkbenchAppShellArgs = BuildWorkbenchCompositePropsArgs["appShell"];
type WorkbenchOverlayStackArgs =
  Parameters<typeof buildWorkbenchOverlayStackCompositeArgs>[0];

interface BuildWorkbenchAppShellArgsInput extends WorkbenchAppShellArgs {}

interface BuildWorkbenchOverlayStackArgsInput extends WorkbenchOverlayStackArgs {}

export function buildWorkbenchAppShellArgs({
  appInlineHintPanelProps,
  isEditorFocusMode
}: BuildWorkbenchAppShellArgsInput) {
  return {
    appInlineHintPanelProps,
    isEditorFocusMode
  };
}

export function buildWorkbenchOverlayStackArgs({
  chrome,
  dialogs,
  menus
}: BuildWorkbenchOverlayStackArgsInput) {
  return buildWorkbenchOverlayStackCompositeArgs({
    chrome,
    dialogs,
    menus
  });
}
