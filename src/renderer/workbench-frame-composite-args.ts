import type { BuildWorkbenchCompositePropsArgs } from "./workbench-composite-props";

interface BuildWorkbenchFrameCompositeArgsInput
  extends Pick<
    BuildWorkbenchCompositePropsArgs,
    | "inspectorSidebar"
    | "rootFrame"
    | "serverHealthInspectorContent"
    | "serverHealthInspectorSection"
    | "topbar"
  > {}

export function buildWorkbenchFrameCompositeArgs({
  inspectorSidebar,
  rootFrame,
  serverHealthInspectorContent,
  serverHealthInspectorSection,
  topbar
}: BuildWorkbenchFrameCompositeArgsInput) {
  return {
    inspectorSidebar,
    rootFrame,
    serverHealthInspectorContent,
    serverHealthInspectorSection,
    topbar
  };
}
