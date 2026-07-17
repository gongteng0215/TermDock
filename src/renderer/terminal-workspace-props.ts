import type { ComponentProps } from "react";

import type { TerminalWorkspaceHost } from "./components/terminal-workspace-host";

export function buildTerminalWorkspaceProps(
  props: ComponentProps<typeof TerminalWorkspaceHost>
): ComponentProps<typeof TerminalWorkspaceHost> {
  return props;
}
