import type { ComponentProps } from "react";

import { TerminalWorkspace } from "./components/terminal-workspace";

type TerminalWorkspaceProps = ComponentProps<typeof TerminalWorkspace>;

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

type TerminalWorkspaceValueArgs = Pick<
  TerminalWorkspaceProps,
  | "activeTabId"
  | "connectionPreferences"
  | "dangerousCommandGuardPreferences"
  | "editorFocusCursorId"
  | "editorFocusFontId"
  | "editorFocusModeEnabled"
  | "editorFocusRhythmId"
  | "editorFocusThemeId"
  | "editorFocusTypographyId"
  | "hotkeyPreferences"
  | "language"
  | "systemApi"
  | "tabs"
  | "terminalApi"
>;

interface BuildTerminalWorkspaceCompositeArgsInput {
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
