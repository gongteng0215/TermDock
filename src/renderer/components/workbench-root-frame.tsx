import type { ComponentProps, Ref } from "react";

import { WorkbenchAppShell } from "./workbench-app-shell";
import { WorkbenchOverlayStack } from "./workbench-overlay-stack";

export interface WorkbenchRootFrameProps {
  appClassName: string;
  appRootRef: Ref<HTMLDivElement>;
  appShellProps: ComponentProps<typeof WorkbenchAppShell>;
  overlayStackProps: ComponentProps<typeof WorkbenchOverlayStack>;
}

export function WorkbenchRootFrame({
  appClassName,
  appRootRef,
  appShellProps,
  overlayStackProps
}: WorkbenchRootFrameProps) {
  return (
    <div className={appClassName} ref={appRootRef}>
      <WorkbenchAppShell {...appShellProps} />
      <WorkbenchOverlayStack {...overlayStackProps} />
    </div>
  );
}
