import type { ComponentProps } from "react";

import { TerminalWorkspace } from "./components/terminal-workspace";

export function buildTerminalWorkspaceProps(
  props: ComponentProps<typeof TerminalWorkspace>
): ComponentProps<typeof TerminalWorkspace> {
  return props;
}
