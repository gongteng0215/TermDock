import type { ComponentProps, Ref } from "react";

import { AppWindowChrome } from "./app-window-chrome";
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
      <AppWindowChrome />
      <div className="app__shell">
        <WorkbenchAppShell {...appShellProps} />
      </div>
      <div className="app__overlays" aria-live="polite">
        <WorkbenchOverlayStack {...overlayStackProps} />
      </div>
    </div>
  );
}
