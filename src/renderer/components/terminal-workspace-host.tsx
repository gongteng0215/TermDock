import { Suspense, lazy } from "react";
import type { ComponentProps } from "react";

import type { TerminalWorkspace } from "./terminal-workspace";

const LazyTerminalWorkspace = lazy(async () => ({
  default: (await import("./terminal-workspace")).TerminalWorkspace
}));

export type TerminalWorkspaceHostProps = ComponentProps<typeof TerminalWorkspace>;

export function TerminalWorkspaceHost(props: TerminalWorkspaceHostProps) {
  return (
    <Suspense
      fallback={
        <div className="terminal-workspace terminal-workspace--loading" aria-busy="true">
          <p className="hint">Loading terminal...</p>
        </div>
      }
    >
      <LazyTerminalWorkspace {...props} />
    </Suspense>
  );
}
