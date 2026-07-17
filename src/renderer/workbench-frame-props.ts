import type { ComponentProps, MouseEvent } from "react";

import type { TerminalCommandHistoryEntry } from "./terminal-workspace-types";
import {
  CommandHistoryInspectorSection,
  ServerHealthInspectorSection
} from "./components/workbench-panels";
import { ServerHealthInspectorContent } from "./components/server-health-inspector-content";
import { WorkbenchTopbar } from "./components/workbench-shell";
import { WorkbenchInspectorSidebar } from "./components/workbench-sidebars";
import type {
  InspectorSidebarTabId
} from "./workbench-ui-preferences";

type WorkbenchInspectorSidebarFrameProps = Omit<
  ComponentProps<typeof WorkbenchInspectorSidebar>,
  "children"
>;

export function buildWorkbenchTopbarProps({
  autoReconnectEnabled,
  reconnectDelaySeconds,
  isMacPlatform,
  labels,
  workspaceProfileId,
  workspaceProfileShortLabel
}: {
  autoReconnectEnabled: boolean;
  reconnectDelaySeconds: number;
  isMacPlatform: boolean;
  labels: ComponentProps<typeof WorkbenchTopbar>["labels"];
  workspaceProfileId: string;
  workspaceProfileShortLabel: string;
}): ComponentProps<typeof WorkbenchTopbar> {
  return {
    autoReconnectLabel: autoReconnectEnabled
      ? labels.autoReconnect(reconnectDelaySeconds)
      : labels.autoReconnectOff,
    isMacPlatform,
    labels,
    workspaceProfile:
      workspaceProfileId !== "none"
        ? {
            id: workspaceProfileId,
            shortLabel: workspaceProfileShortLabel
          }
        : null
  };
}

export function buildWorkbenchInspectorSidebarProps({
  activeTabId,
  historyBadge,
  onSelectTab,
  sessionBadgeText
}: {
  activeTabId: InspectorSidebarTabId;
  historyBadge: string;
  onSelectTab: (tabId: InspectorSidebarTabId) => void;
  sessionBadgeText: string;
}): WorkbenchInspectorSidebarFrameProps {
  return {
    activeTabId,
    onSelectTab: (tabId) => onSelectTab(tabId as InspectorSidebarTabId),
    tabs: [
      { badge: sessionBadgeText, id: "sessions", label: "Sessions" },
      { id: "health", label: "Health" },
      {
        badge: historyBadge,
        id: "history",
        label: "History"
      }
    ]
  };
}

export function buildServerHealthInspectorSectionProps({
  activeTabTitle,
  hasAlert,
  healthyLabel,
  isConnected,
  isDetailOpen,
  onOpenDetail,
  refreshServerHealth,
  refreshServerProcesses,
  refreshDisabled,
  toggleDisabled
}: {
  activeTabTitle: string | null;
  hasAlert: boolean;
  healthyLabel: string;
  isConnected: boolean;
  isDetailOpen: boolean;
  onOpenDetail: () => void;
  refreshServerHealth: () => Promise<void>;
  refreshServerProcesses: () => Promise<void>;
  refreshDisabled: boolean;
  toggleDisabled: boolean;
}): Omit<ComponentProps<typeof ServerHealthInspectorSection>, "children"> {
  return {
    activeTabTitle,
    hasAlert,
    healthyLabel,
    isConnected,
    isDetailOpen,
    onRefresh: () => {
      void refreshServerHealth();
      if (isDetailOpen) {
        void refreshServerProcesses();
      }
    },
    onToggleDetail: onOpenDetail,
    refreshDisabled,
    toggleDisabled
  };
}

export function buildCommandHistoryInspectorSectionProps({
  activeTabConnected,
  activeTabTitle,
  entries,
  hiddenEntryCount,
  isCollapsed,
  onEntryContextMenu,
  onEntryDoubleClick,
  onOpenContextMenu,
  onOpenManager,
  onOpenSnippets,
  onQueryChange,
  onScopeChange,
  onToggleCollapsed,
  query,
  scope,
  totalCommandSnippetCount,
  visibleEntryCount,
  visibleTotalCount
}: {
  activeTabConnected: boolean;
  activeTabTitle: string | null;
  entries: TerminalCommandHistoryEntry[];
  hiddenEntryCount: number;
  isCollapsed: boolean;
  onEntryContextMenu: (event: MouseEvent<HTMLLIElement>, entryId: string) => void;
  onEntryDoubleClick: (entry: TerminalCommandHistoryEntry) => Promise<void>;
  onOpenContextMenu: ComponentProps<typeof CommandHistoryInspectorSection>["onOpenContextMenu"];
  onOpenManager: () => void;
  onOpenSnippets: () => unknown;
  onQueryChange: ComponentProps<typeof CommandHistoryInspectorSection>["onQueryChange"];
  onScopeChange: ComponentProps<typeof CommandHistoryInspectorSection>["onScopeChange"];
  onToggleCollapsed: () => void;
  query: string;
  scope: "activeTab" | "allTabs";
  totalCommandSnippetCount: number;
  visibleEntryCount: number;
  visibleTotalCount: number;
}): ComponentProps<typeof CommandHistoryInspectorSection> {
  return {
    activeTabConnected,
    activeTabTitle,
    entries: entries.map((entry) => ({
      command: entry.command,
      id: entry.id,
      onContextMenu: (event) => onEntryContextMenu(event, entry.id),
      onDoubleClick: () => {
        void onEntryDoubleClick(entry);
      },
      title: `${entry.command}\n\nDouble-click to paste into active terminal. Right-click for actions.`
    })),
    hiddenEntryCount,
    isCollapsed,
    onOpenContextMenu,
    onOpenManager,
    onOpenSnippets: () => {
      void onOpenSnippets();
    },
    onQueryChange,
    onScopeChange,
    onToggleCollapsed,
    query,
    scope,
    totalCommandSnippetCount,
    visibleCountLabel: `${visibleEntryCount}/${visibleTotalCount}`
  };
}

export function buildServerHealthInspectorContentProps(
  props: ComponentProps<typeof ServerHealthInspectorContent>
): ComponentProps<typeof ServerHealthInspectorContent> {
  return props;
}
