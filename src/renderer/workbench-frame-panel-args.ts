import { buildWorkbenchFrameCompositeArgs } from "./workbench-frame-composite-args";
import { buildWorkbenchInspectorSidebarProps } from "./workbench-frame-props";
import { buildWorkbenchTopbarProps } from "./workbench-frame-props";
import { buildServerHealthInspectorContentProps } from "./workbench-frame-props";
import { buildServerHealthInspectorSectionProps } from "./workbench-frame-props";

type WorkbenchFrameCompositeArgs =
  Parameters<typeof buildWorkbenchFrameCompositeArgs>[0];
type WorkbenchInspectorSidebarArgs =
  Parameters<typeof buildWorkbenchInspectorSidebarProps>[0];
type WorkbenchTopbarArgs = Parameters<typeof buildWorkbenchTopbarProps>[0];
type ServerHealthInspectorContentArgs =
  Parameters<typeof buildServerHealthInspectorContentProps>[0];
type ServerHealthInspectorSectionArgs =
  Parameters<typeof buildServerHealthInspectorSectionProps>[0];

export function buildWorkbenchInspectorSidebarArgs(
  args: WorkbenchInspectorSidebarArgs
): WorkbenchInspectorSidebarArgs {
  return args;
}

export function buildWorkbenchTopbarArgs(
  args: WorkbenchTopbarArgs
): WorkbenchTopbarArgs {
  return args;
}

export function buildServerHealthInspectorContentArgs(
  args: ServerHealthInspectorContentArgs
): ServerHealthInspectorContentArgs {
  return args;
}

export function buildServerHealthInspectorSectionArgs(
  args: ServerHealthInspectorSectionArgs
): ServerHealthInspectorSectionArgs {
  return args;
}

export function buildWorkbenchRootFrameArgs(
  args: WorkbenchFrameCompositeArgs
): WorkbenchFrameCompositeArgs {
  return args;
}
