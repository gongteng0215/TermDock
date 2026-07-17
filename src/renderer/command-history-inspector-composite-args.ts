import type { ComponentProps, MouseEvent } from "react";

import type { TerminalCommandHistoryEntry } from "./terminal-workspace-types";
import { CommandHistoryInspectorSection } from "./components/workbench-panels";

type CommandHistoryInspectorSectionProps = ComponentProps<
  typeof CommandHistoryInspectorSection
>;

type CommandHistoryInspectorActionArgs = {
  onEntryContextMenu: (event: MouseEvent<HTMLLIElement>, entryId: string) => void;
  onEntryDoubleClick: (entry: TerminalCommandHistoryEntry) => Promise<void>;
  onOpenContextMenu: CommandHistoryInspectorSectionProps["onOpenContextMenu"];
  onOpenManager: () => void;
  onOpenSnippets: () => unknown;
  onQueryChange: CommandHistoryInspectorSectionProps["onQueryChange"];
  onScopeChange: CommandHistoryInspectorSectionProps["onScopeChange"];
  onToggleCollapsed: () => void;
};

type CommandHistoryInspectorValueArgs = {
  activeTabConnected: boolean;
  activeTabTitle: string | null;
  entries: TerminalCommandHistoryEntry[];
  hiddenEntryCount: number;
  isCollapsed: boolean;
  query: string;
  scope: "activeTab" | "allTabs";
  totalCommandSnippetCount: number;
  visibleEntryCount: number;
  visibleTotalCount: number;
};

interface BuildCommandHistoryInspectorCompositeArgsInput {
  actions: CommandHistoryInspectorActionArgs;
  values: CommandHistoryInspectorValueArgs;
}

export function buildCommandHistoryInspectorCompositeArgs({
  actions,
  values
}: BuildCommandHistoryInspectorCompositeArgsInput) {
  return {
    ...values,
    ...actions
  };
}
