import type {
  ChangeEventHandler,
  Dispatch,
  DragEventHandler,
  MouseEvent,
  MouseEventHandler,
  SetStateAction
} from "react";

import type { SessionRecord } from "../shared/session";
import type { SftpDirectoryListResult, SftpEntry } from "../shared/sftp";
import type {
  TerminalCommandHistoryEntry,
  TerminalTab
} from "./terminal-workspace-types";
import { buildCommandHistoryInspectorCompositeArgs } from "./command-history-inspector-composite-args";
import { buildSessionsInspectorCompositeArgs } from "./sessions-inspector-composite-args";
import { buildSftpExplorerCompositeArgs } from "./sftp-explorer-composite-args";
import type { SftpExplorerViewMode } from "./workbench-ui-preferences";

type CommandHistoryInspectorActionArgs =
  Parameters<typeof buildCommandHistoryInspectorCompositeArgs>[0]["actions"];
type CommandHistoryInspectorValueArgs =
  Parameters<typeof buildCommandHistoryInspectorCompositeArgs>[0]["values"];
type SessionsInspectorActionArgs =
  Parameters<typeof buildSessionsInspectorCompositeArgs>[0]["actions"];
type SessionsInspectorValueArgs =
  Parameters<typeof buildSessionsInspectorCompositeArgs>[0]["values"];
type SftpExplorerActionArgs =
  Parameters<typeof buildSftpExplorerCompositeArgs>[0]["actions"];
type SftpExplorerValueArgs =
  Parameters<typeof buildSftpExplorerCompositeArgs>[0]["values"];

interface BuildCommandHistoryInspectorArgsInput {
  activeTabConnected: boolean;
  activeTabTitle: string | null;
  entries: TerminalCommandHistoryEntry[];
  hiddenEntryCount: number;
  isCollapsed: boolean;
  onEntryContextMenu: CommandHistoryInspectorActionArgs["onEntryContextMenu"];
  onEntryDoubleClick: CommandHistoryInspectorActionArgs["onEntryDoubleClick"];
  onOpenContextMenu: CommandHistoryInspectorActionArgs["onOpenContextMenu"];
  onOpenManager: () => void;
  onOpenSnippets: () => unknown;
  onQueryChange: CommandHistoryInspectorActionArgs["onQueryChange"];
  onScopeChange: CommandHistoryInspectorActionArgs["onScopeChange"];
  onToggleCollapsed: () => void;
  query: string;
  scope: CommandHistoryInspectorValueArgs["scope"];
  totalCommandSnippetCount: number;
  visibleEntryCount: number;
  visibleTotalCount: number;
}

interface BuildSessionsInspectorArgsInput {
  activeGroupSessions: SessionsInspectorValueArgs["activeGroupSessions"];
  activeSessionGroup: SessionsInspectorValueArgs["activeSessionGroup"];
  activeSessionId: SessionsInspectorValueArgs["activeSessionId"];
  activeTerminalTab: TerminalTab | null;
  dismissFirstRunOnboarding: () => void;
  filteredSessionCount: number;
  groupedSessions: SessionsInspectorValueArgs["groupedSessions"];
  importSessionsFromSshConfig: () => Promise<void>;
  isActiveTabConnected: boolean;
  isFirstRunOnboardingDismissed: boolean;
  loading: boolean;
  openCreateModal: SessionsInspectorActionArgs["openCreateModal"];
  openFirstRunSecurityNotes: () => void;
  openSessionBlankContextMenu: SessionsInspectorActionArgs["openSessionBlankContextMenu"];
  openSessionContextMenu: SessionsInspectorActionArgs["openSessionContextMenu"];
  openSettingsPanelConnection: () => void;
  openTerminalTab: SessionsInspectorActionArgs["openTerminalTab"];
  selectedGroupKeySet: Set<string>;
  selectedSession: SessionRecord | null;
  selectedSessionIdSet: Set<string>;
  sessionBadgeText: string;
  sessionFavoritesOnly: boolean;
  sessionFilterQuery: string;
  sessions: SessionRecord[];
  setActiveSessionGroupKey: SessionsInspectorActionArgs["setActiveSessionGroupKey"];
  setSelectedGroupKeys: SessionsInspectorActionArgs["setSelectedGroupKeys"];
  setSelectedSessionId: SessionsInspectorActionArgs["setSelectedSessionId"];
  setSelectedSessionIds: SessionsInspectorActionArgs["setSelectedSessionIds"];
  setSessionFavoritesOnly: SessionsInspectorActionArgs["setSessionFavoritesOnly"];
  setSessionFilterQuery: SessionsInspectorActionArgs["setSessionFilterQuery"];
  totalSessionCount: number;
  workspaceProfile:
    | {
        id: string;
        shortLabel: string;
      }
    | null;
}

interface BuildSftpExplorerArgsInput {
  activeTerminalTab: TerminalTab | null;
  formatExactByteCount: (bytes: number) => string;
  formatSftpLinksForLs: (links: number) => string;
  formatSftpMtimeForLs: (isoString?: string) => string;
  formatSftpSizeForLs: (size: number) => string;
  formatTransferBytes: (bytes: number) => string;
  loadSftpDirectory: SftpExplorerActionArgs["loadSftpDirectory"];
  onSftpDragLeave: SftpExplorerActionArgs["onSftpDragLeave"];
  onSftpDragOver: SftpExplorerActionArgs["onSftpDragOver"];
  onSftpDrop: SftpExplorerActionArgs["onSftpDrop"];
  openSftpContextMenu: SftpExplorerActionArgs["openSftpContextMenu"];
  openSftpEntryFile: SftpExplorerActionArgs["openSftpEntryFile"];
  selectedSftpPath: string | null;
  setSelectedSftpPath: SftpExplorerActionArgs["setSelectedSftpPath"];
  setSftpExplorerViewMode: SftpExplorerActionArgs["setSftpExplorerViewMode"];
  setSftpPath: SftpExplorerActionArgs["setSftpPath"];
  sftpActionLoading: boolean;
  sftpDeleteProgress:
    | {
        kind: SftpEntry["kind"];
        name: string;
      }
    | null;
  sftpDirectory: SftpDirectoryListResult | null;
  sftpDropActive: boolean;
  sftpError: string | null;
  sftpErrorRecovery?: import("react").ReactNode;
  sftpExplorerViewMode: SftpExplorerViewMode;
  sftpLoading: boolean;
  sftpPath: string;
  sftpSummary: SftpExplorerValueArgs["sftpSummary"];
  toggleSftpToolbarMenu: SftpExplorerActionArgs["toggleSftpToolbarMenu"];
}

export function buildCommandHistoryInspectorArgs({
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
}: BuildCommandHistoryInspectorArgsInput) {
  return buildCommandHistoryInspectorCompositeArgs({
    actions: {
      onEntryContextMenu,
      onEntryDoubleClick,
      onOpenContextMenu,
      onOpenManager,
      onOpenSnippets,
      onQueryChange,
      onScopeChange,
      onToggleCollapsed
    },
    values: {
      activeTabConnected,
      activeTabTitle,
      entries,
      hiddenEntryCount,
      isCollapsed,
      query,
      scope,
      totalCommandSnippetCount,
      visibleEntryCount,
      visibleTotalCount
    }
  });
}

export function buildSessionsInspectorArgs({
  activeGroupSessions,
  activeSessionGroup,
  activeSessionId,
  activeTerminalTab,
  dismissFirstRunOnboarding,
  filteredSessionCount,
  groupedSessions,
  importSessionsFromSshConfig,
  isActiveTabConnected,
  isFirstRunOnboardingDismissed,
  loading,
  openCreateModal,
  openFirstRunSecurityNotes,
  openSessionBlankContextMenu,
  openSessionContextMenu,
  openSettingsPanelConnection,
  openTerminalTab,
  selectedGroupKeySet,
  selectedSession,
  selectedSessionIdSet,
  sessionBadgeText,
  sessionFavoritesOnly,
  sessionFilterQuery,
  sessions,
  setActiveSessionGroupKey,
  setSelectedGroupKeys,
  setSelectedSessionId,
  setSelectedSessionIds,
  setSessionFavoritesOnly,
  setSessionFilterQuery,
  totalSessionCount,
  workspaceProfile
}: BuildSessionsInspectorArgsInput) {
  return buildSessionsInspectorCompositeArgs({
    actions: {
      dismissFirstRunOnboarding,
      importSessionsFromSshConfig,
      openCreateModal,
      openFirstRunSecurityNotes,
      openSessionBlankContextMenu,
      openSessionContextMenu,
      openSettingsPanelConnection,
      openTerminalTab,
      setActiveSessionGroupKey,
      setSelectedGroupKeys,
      setSelectedSessionId,
      setSelectedSessionIds,
      setSessionFavoritesOnly,
      setSessionFilterQuery
    },
    values: {
      activeGroupSessions,
      activeSessionGroup,
      activeSessionId,
      activeTerminalTab,
      filteredSessionCount,
      groupedSessions,
      isActiveTabConnected,
      isFirstRunOnboardingDismissed,
      loading,
      selectedGroupKeySet,
      selectedSession,
      selectedSessionIdSet,
      sessionBadgeText,
      sessionFavoritesOnly,
      sessionFilterQuery,
      sessions,
      totalSessionCount,
      workspaceProfile
    }
  });
}

export function buildSftpExplorerArgs({
  activeTerminalTab,
  formatExactByteCount,
  formatSftpLinksForLs,
  formatSftpMtimeForLs,
  formatSftpSizeForLs,
  formatTransferBytes,
  loadSftpDirectory,
  onSftpDragLeave,
  onSftpDragOver,
  onSftpDrop,
  openSftpContextMenu,
  openSftpEntryFile,
  selectedSftpPath,
  setSelectedSftpPath,
  setSftpExplorerViewMode,
  setSftpPath,
  sftpActionLoading,
  sftpDeleteProgress,
  sftpDirectory,
  sftpDropActive,
  sftpError,
  sftpErrorRecovery = null,
  sftpExplorerViewMode,
  sftpLoading,
  sftpPath,
  sftpSummary,
  toggleSftpToolbarMenu
}: BuildSftpExplorerArgsInput) {
  return buildSftpExplorerCompositeArgs({
    actions: {
      loadSftpDirectory,
      onSftpDragLeave,
      onSftpDragOver,
      onSftpDrop,
      openSftpContextMenu,
      openSftpEntryFile,
      setSelectedSftpPath,
      setSftpExplorerViewMode,
      setSftpPath,
      toggleSftpToolbarMenu
    },
    values: {
      activeTerminalTab,
      formatExactByteCount,
      formatSftpLinksForLs,
      formatSftpMtimeForLs,
      formatSftpSizeForLs,
      formatTransferBytes,
      selectedSftpPath,
      sftpActionLoading,
      sftpDeleteProgress,
      sftpDirectory,
      sftpDropActive,
      sftpError,
      sftpErrorRecovery,
      sftpExplorerViewMode,
      sftpLoading,
      sftpPath,
      sftpSummary
    }
  });
}
