import type { ComponentProps } from "react";

import type { TerminalWorkspaceHost } from "./components/terminal-workspace-host";

type TerminalWorkspaceProps = ComponentProps<typeof TerminalWorkspaceHost>;

type TerminalWorkspaceActionArgs = Pick<
  TerminalWorkspaceProps,
  | "getDangerousCommandSessionGroupName"
  | "onActiveEditorModeChange"
  | "onCloseAllTabs"
  | "onCloseOtherTabs"
  | "onCloseTab"
  | "onCloseTabsLeft"
  | "onCloseTabsRight"
  | "onCommandHistoryChange"
  | "onError"
  | "onSelectTab"
  | "requestDangerousCommandApproval"
>;

type TerminalWorkspaceValueArgs = Omit<TerminalWorkspaceProps, keyof TerminalWorkspaceActionArgs>;

export interface BuildTerminalWorkspaceCompositeArgsInput {
  actions: TerminalWorkspaceActionArgs;
  values: TerminalWorkspaceValueArgs;
}

export function buildTerminalWorkspaceCompositeArgs({
  actions,
  values
}: BuildTerminalWorkspaceCompositeArgsInput): TerminalWorkspaceProps {
  return {
    ...values,
    ...actions
  };
}
