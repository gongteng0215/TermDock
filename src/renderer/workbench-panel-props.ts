import type {
  ChangeEvent,
  ComponentProps,
  Dispatch,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  SetStateAction
} from "react";

import type { SessionRecord } from "../shared/session";
import type { SftpDirectoryListResult, SftpEntry } from "../shared/sftp";
import type { TerminalTab } from "./terminal-workspace-types";
import {
  SessionsInspectorSection,
  SftpExplorerSection
} from "./components/workbench-panels";
import type { SftpExplorerViewMode } from "./workbench-ui-preferences";

interface SessionGroupLike {
  key: string;
  label: string;
  groupName: string;
  sessions: SessionRecord[];
}

interface ActiveSessionGroupLike {
  key: string;
  label: string;
  groupName: string;
}

export interface BuildSessionsInspectorSectionPropsArgs {
  activeGroupSessions: SessionRecord[];
  activeSessionGroup: ActiveSessionGroupLike | null;
  activeSessionId: string | null;
  activeTerminalTab: TerminalTab | null;
  filteredSessionCount: number;
  groupedSessions: SessionGroupLike[];
  isActiveTabConnected: boolean;
  isFirstRunOnboardingDismissed: boolean;
  loading: boolean;
  openCreateModal: (groupId?: string) => void;
  openFirstRunSecurityNotes: () => void;
  openSessionBlankContextMenu: ComponentProps<typeof SessionsInspectorSection>["onRootContextMenu"];
  openSessionContextMenu: (
    event: MouseEvent<HTMLElement>,
    target:
      | { type: "group"; groupKey: string; groupName: string; label: string }
      | { type: "session"; sessionId: string }
  ) => void;
  openSettingsPanelConnection: () => void;
  openTerminalTab: (
    session: SessionRecord,
    options?: { startupCommands?: string[]; forceNewTab?: boolean }
  ) => string | null;
  selectedGroupKeySet: Set<string>;
  selectedSession: SessionRecord | null;
  selectedSessionIdSet: Set<string>;
  sessionBadgeText: string;
  sessionFavoritesOnly: boolean;
  sessionFilterQuery: string;
  sessions: SessionRecord[];
  setActiveSessionGroupKey: Dispatch<SetStateAction<string | null>>;
  setSelectedGroupKeys: Dispatch<SetStateAction<string[]>>;
  setSelectedSessionId: Dispatch<SetStateAction<string | null>>;
  setSelectedSessionIds: Dispatch<SetStateAction<string[]>>;
  setSessionFavoritesOnly: Dispatch<SetStateAction<boolean>>;
  setSessionFilterQuery: Dispatch<SetStateAction<string>>;
  totalSessionCount: number;
  importSessionsFromSshConfig: () => Promise<void>;
  dismissFirstRunOnboarding: () => void;
  workspaceProfile:
    | {
        id: string;
        shortLabel: string;
      }
    | null;
}

export function buildSessionsInspectorSectionProps({
  activeGroupSessions,
  activeSessionGroup,
  activeSessionId,
  activeTerminalTab,
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
  dismissFirstRunOnboarding,
  workspaceProfile
}: BuildSessionsInspectorSectionPropsArgs): ComponentProps<typeof SessionsInspectorSection> {
  return {
    activeGroupLabel: activeSessionGroup?.label ?? null,
    activeContext: selectedSession
      ? {
          detail: `${selectedSession.username}@${selectedSession.host}:${selectedSession.port}`,
          stateLabel:
            activeSessionId === selectedSession.id
              ? isActiveTabConnected
                ? "Live Tab"
                : "Tab Open"
              : selectedSession.favorite
                ? "Favorite"
                : "Saved",
          stateTone:
            activeSessionId === selectedSession.id
              ? isActiveTabConnected
                ? "ok"
                : "warn"
              : "neutral",
          title: selectedSession.name
        }
      : activeTerminalTab
        ? {
            detail: activeTerminalTab.sessionId
              ? `Active terminal tab for session ${activeTerminalTab.sessionId}`
              : "Active terminal tab",
            stateLabel: isActiveTabConnected ? "Live Tab" : "Offline",
            stateTone: isActiveTabConnected ? "ok" : "warn",
            title: activeTerminalTab.title
          }
        : null,
    emptyStateLabel: !activeSessionGroup
      ? !loading && filteredSessionCount === 0
        ? totalSessionCount === 0
          ? "No sessions yet."
          : "No sessions match current filters."
        : null
      : !loading && activeGroupSessions.length === 0
        ? "No sessions in this group."
        : null,
    favoritesOnly: sessionFavoritesOnly,
    filterQuery: sessionFilterQuery,
    groups: groupedSessions.map((group) => ({
      count: group.sessions.length,
      isSelected: selectedGroupKeySet.has(group.key),
      key: group.key,
      label: group.label,
      onClick: (event) => {
        const isMultiSelect = event.ctrlKey || event.metaKey;
        if (isMultiSelect) {
          setSelectedGroupKeys((prev) =>
            prev.includes(group.key)
              ? prev.filter((groupKey) => groupKey !== group.key)
              : [...prev, group.key]
          );
          return;
        }
        setSelectedGroupKeys([group.key]);
        setActiveSessionGroupKey(group.key);
      },
      onContextMenu: (event) =>
        openSessionContextMenu(event, {
          type: "group",
          groupKey: group.key,
          groupName: group.groupName,
          label: group.label
        })
    })),
    isGroupView: Boolean(activeSessionGroup),
    loading,
    onBackToGroups: () => setActiveSessionGroupKey(null),
    onCreateFirstSession: () => {
      openCreateModal(activeSessionGroup?.groupName ?? "");
    },
    onDismissWelcome: dismissFirstRunOnboarding,
    onFilterQueryChange: (event) => setSessionFilterQuery(event.target.value),
    onImportSshConfig: () => {
      void importSessionsFromSshConfig();
    },
    onOpenSecurityNotes: openFirstRunSecurityNotes,
    onOpenSettings: openSettingsPanelConnection,
    onRootContextMenu: openSessionBlankContextMenu,
    onToggleFavoritesOnly: () => setSessionFavoritesOnly((prev) => !prev),
    sessionBadgeText,
    sessions: activeGroupSessions.map((session) => ({
      host: session.host,
      id: session.id,
      isSelected: selectedSessionIdSet.has(session.id),
      name: session.name,
      onClick: (event) => {
        const isMultiSelect = event.ctrlKey || event.metaKey;
        if (isMultiSelect) {
          setSelectedSessionIds((prev) => {
            if (prev.includes(session.id)) {
              const next = prev.filter((sessionId) => sessionId !== session.id);
              setSelectedSessionId(next[0] ?? null);
              return next;
            }
            setSelectedSessionId(session.id);
            return [...prev, session.id];
          });
          return;
        }
        setSelectedSessionId(session.id);
        setSelectedSessionIds([session.id]);
      },
      onContextMenu: (event) =>
        openSessionContextMenu(event, {
          type: "session",
          sessionId: session.id
        }),
      onDoubleClick: () =>
        openTerminalTab(session, {
          forceNewTab: true
        }),
      onKeyDown: (event) => {
        if (
          event.key !== "Enter" ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey
        ) {
          return;
        }
        event.preventDefault();
        openTerminalTab(session);
      },
      title: `${session.username}@${session.host}:${session.port}`
    })),
    showWelcome: !isFirstRunOnboardingDismissed && sessions.length === 0 && !loading,
    workspaceProfile
  };
}

interface SftpSummaryLike {
  directoryCount: number;
  entryCount: number;
  fileCount: number;
  totalSize: number;
}

export interface BuildSftpExplorerSectionPropsArgs {
  activeTerminalTab: TerminalTab | null;
  formatExactByteCount: (bytes: number) => string;
  formatSftpLinksForLs: (links: number) => string;
  formatSftpMtimeForLs: (isoString?: string) => string;
  formatSftpSizeForLs: (size: number) => string;
  formatTransferBytes: (bytes: number) => string;
  loadSftpDirectory: (
    path: string,
    options?: { tabId?: string; suppressDisconnectedError?: boolean }
  ) => Promise<void>;
  onSftpDragLeave: ComponentProps<typeof SftpExplorerSection>["onDragLeave"];
  onSftpDragOver: ComponentProps<typeof SftpExplorerSection>["onDragOver"];
  onSftpDrop: ComponentProps<typeof SftpExplorerSection>["onDrop"];
  openSftpContextMenu: (event: MouseEvent<HTMLElement>, entry?: SftpEntry) => void;
  openSftpEntryFile: (entry?: SftpEntry | null) => Promise<void>;
  selectedSftpPath: string | null;
  setSelectedSftpPath: Dispatch<SetStateAction<string | null>>;
  setSftpExplorerViewMode: (mode: SftpExplorerViewMode) => void;
  setSftpPath: Dispatch<SetStateAction<string>>;
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
  sftpErrorRecovery?: ReactNode;
  sftpExplorerViewMode: SftpExplorerViewMode;
  sftpLoading: boolean;
  sftpPath: string;
  sftpSummary: SftpSummaryLike;
  sftpWriteAccessHint?: string | null;
  toggleSftpToolbarMenu: ComponentProps<typeof SftpExplorerSection>["onActionsMenu"];
}

export function buildSftpExplorerSectionProps({
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
  sftpWriteAccessHint = null,
  toggleSftpToolbarMenu
}: BuildSftpExplorerSectionPropsArgs): ComponentProps<typeof SftpExplorerSection> {
  return {
    bindingTabTitle: activeTerminalTab?.title ?? null,
    currentPathLabel: sftpDirectory?.cwd ?? "(not loaded)",
    deleteProgressLabel: sftpDeleteProgress
      ? `Deleting ${sftpDeleteProgress.kind === "directory" ? "directory" : "file"} "${sftpDeleteProgress.name}"...`
      : null,
    directorySizeLabel: `Current directory size: ${formatExactByteCount(sftpSummary.totalSize)} (${formatTransferBytes(sftpSummary.totalSize)})`,
    dropActive: sftpDropActive,
    entries: (sftpDirectory?.entries ?? []).map((entry) => ({
      compactSizeLabel: entry.kind === "directory" ? "Folder" : formatTransferBytes(entry.size),
      group: entry.group,
      id: `${entry.path}-${entry.modifiedAt ?? ""}`,
      isSelected: selectedSftpPath === entry.path,
      kind: entry.kind,
      linksLabel: formatSftpLinksForLs(entry.links ?? 1),
      modifiedAtLabel: formatSftpMtimeForLs(entry.modifiedAt),
      name: entry.name,
      onClick: () => {
        setSelectedSftpPath(entry.path);
      },
      onContextMenu: (event) => openSftpContextMenu(event, entry),
      onDoubleClick: () => {
        if (entry.kind === "directory") {
          return;
        }
        void openSftpEntryFile(entry);
      },
      onOpenDirectory:
        entry.kind === "directory"
          ? () => {
              void loadSftpDirectory(entry.path);
            }
          : undefined,
      owner: entry.owner,
      path: entry.path,
      permissions: entry.permissions,
      sizeLabel: formatSftpSizeForLs(entry.size)
    })),
    entrySummaryLabel: `Entries: ${sftpSummary.entryCount} (Files: ${sftpSummary.fileCount}, Dirs: ${sftpSummary.directoryCount})`,
    errorMessage: sftpError,
    errorRecovery: sftpErrorRecovery,
    writeAccessHint: sftpWriteAccessHint,
    loading: sftpLoading,
    onActionsMenu: toggleSftpToolbarMenu,
    onBodyContextMenu: (event) => openSftpContextMenu(event),
    onDragLeave: onSftpDragLeave,
    onDragOver: onSftpDragOver,
    onDrop: onSftpDrop,
    onGoUp: () => {
      if (!sftpDirectory?.parent) {
        return;
      }
      void loadSftpDirectory(sftpDirectory.parent);
    },
    onPathChange: (event: ChangeEvent<HTMLInputElement>) => setSftpPath(event.target.value),
    onPathKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      void loadSftpDirectory(sftpPath);
    },
    onRefresh: () => {
      void loadSftpDirectory(sftpDirectory?.cwd ?? sftpPath);
    },
    onViewModeChange: setSftpExplorerViewMode,
    pathUpDisabled: sftpLoading || sftpActionLoading || !sftpDirectory?.parent,
    pathValue: sftpPath,
    refreshDisabled: sftpLoading || sftpActionLoading,
    viewMode: sftpExplorerViewMode
  };
}
