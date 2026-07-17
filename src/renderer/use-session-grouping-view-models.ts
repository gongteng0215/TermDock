import { useMemo } from "react";

import type { SessionRecord } from "../shared/session";
import type { TerminalTab } from "./terminal-workspace-types";

type SessionSortMode = "default" | "nameAsc" | "nameDesc" | "recent";

interface SessionGroupViewModel {
  key: string;
  label: string;
  groupName: string;
  sessions: SessionRecord[];
}

interface UseSessionGroupingViewModelsArgs {
  activeSessionGroupKey: string | null;
  activeTabId: string | null;
  persistedGroupNames: string[];
  selectedGroupKeys: string[];
  selectedSessionId: string | null;
  selectedSessionIds: string[];
  sessionContextSessionId: string | null;
  sessionFavoritesOnly: boolean;
  sessionFilterQuery: string;
  sessionSortMode: SessionSortMode;
  sessions: SessionRecord[];
  terminalTabs: TerminalTab[];
}

const EMPTY_GROUP_SESSIONS: SessionRecord[] = [];

function normalizeSessionGroupName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSessionGroups(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const rawValue of values) {
    const normalized = normalizeSessionGroupName(rawValue);
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    groups.push(normalized);
  }
  groups.sort((left, right) => left.localeCompare(right));
  return groups;
}

function compareSessionRecency(left: SessionRecord, right: SessionRecord): number {
  const leftRecent = left.lastConnectedAt ?? "";
  const rightRecent = right.lastConnectedAt ?? "";
  if (leftRecent !== rightRecent) {
    return leftRecent < rightRecent ? 1 : -1;
  }
  return left.updatedAt < right.updatedAt ? 1 : left.updatedAt > right.updatedAt ? -1 : 0;
}

function sortSessionsForMode(items: SessionRecord[], mode: SessionSortMode): SessionRecord[] {
  if (mode === "default") {
    return items;
  }
  if (mode === "recent") {
    return [...items].sort(compareSessionRecency);
  }
  const sorted = [...items].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
  );
  return mode === "nameDesc" ? sorted.reverse() : sorted;
}

export function useSessionGroupingViewModels({
  activeSessionGroupKey,
  activeTabId,
  persistedGroupNames,
  selectedGroupKeys,
  selectedSessionId,
  selectedSessionIds,
  sessionContextSessionId,
  sessionFavoritesOnly,
  sessionFilterQuery,
  sessionSortMode,
  sessions,
  terminalTabs
}: UseSessionGroupingViewModelsArgs) {
  return useMemo(() => {
    const selectedSession =
      sessions.find((session) => session.id === selectedSessionId) ?? null;
    const activeTerminalTab =
      terminalTabs.find((tab) => tab.id === activeTabId) ?? null;
    const activeTabSessionGroupName = activeTerminalTab
      ? normalizeSessionGroupName(
          sessions.find((session) => session.id === activeTerminalTab.sessionId)?.groupId
        ) || null
      : null;
    const sessionContextTarget =
      sessions.find((session) => session.id === sessionContextSessionId) ?? null;
    const sessionGroupOptions = normalizeSessionGroups([
      ...persistedGroupNames,
      ...sessions.map((session) => session.groupId ?? "")
    ]);

    const normalizedQuery = sessionFilterQuery.trim().toLowerCase();
    const filteredSessions = sortSessionsForMode(
      sessions.filter((session) => {
        if (sessionFavoritesOnly && !session.favorite) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }
        return [
          session.name,
          session.host,
          session.username,
          String(session.port),
          session.groupId ?? "",
          session.remark ?? ""
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      }),
      sessionSortMode
    );

    const sessionsByGroup = new Map<string, SessionRecord[]>();
    for (const session of filteredSessions) {
      const groupValue = normalizeSessionGroupName(session.groupId);
      const groupKey = groupValue || "__ungrouped__";
      const existingSessions = sessionsByGroup.get(groupKey);
      if (existingSessions) {
        existingSessions.push(session);
      } else {
        sessionsByGroup.set(groupKey, [session]);
      }
    }

    const groupedSessions: SessionGroupViewModel[] = [];
    const seenGroupKeys = new Set<string>();
    const appendGroup = (groupKey: string, label: string, groupName: string) => {
      if (seenGroupKeys.has(groupKey)) {
        return;
      }
      seenGroupKeys.add(groupKey);
      groupedSessions.push({
        key: groupKey,
        label,
        groupName,
        sessions: sessionsByGroup.get(groupKey) ?? []
      });
    };

    for (const groupName of sessionGroupOptions) {
      appendGroup(groupName, groupName, groupName);
    }

    for (const groupKey of sessionsByGroup.keys()) {
      if (groupKey === "__ungrouped__") {
        continue;
      }
      appendGroup(groupKey, groupKey, groupKey);
    }

    const hasUngroupedInAllSessions = sessions.some(
      (session) => normalizeSessionGroupName(session.groupId) === ""
    );
    if (sessionsByGroup.has("__ungrouped__") || hasUngroupedInAllSessions) {
      appendGroup("__ungrouped__", "Ungrouped", "");
    }

    groupedSessions.sort((left, right) => {
      if (left.key === "__ungrouped__" && right.key !== "__ungrouped__") {
        return 1;
      }
      if (left.key !== "__ungrouped__" && right.key === "__ungrouped__") {
        return -1;
      }
      return left.label.localeCompare(right.label, undefined, { sensitivity: "base" });
    });

    const sessionBadgeText =
      filteredSessions.length === sessions.length
        ? `${sessions.length}`
        : `${filteredSessions.length}/${sessions.length}`;
    const activeSessionGroup =
      groupedSessions.find((group) => group.key === activeSessionGroupKey) ?? null;
    const activeGroupSessions = activeSessionGroup?.sessions ?? EMPTY_GROUP_SESSIONS;
    const selectedGroupKeySet = new Set(selectedGroupKeys);
    const selectedSessionIdSet = new Set(selectedSessionIds);
    const selectedGroups = groupedSessions.filter((group) =>
      selectedGroupKeySet.has(group.key)
    );
    const selectedGroupNames = selectedGroups
      .filter((group) => group.groupName.trim().length > 0)
      .map((group) => group.groupName);
    const selectedSessionsInActiveGroup = activeGroupSessions.filter((session) =>
      selectedSessionIdSet.has(session.id)
    );

    return {
      activeGroupSessions,
      activeSessionGroup,
      activeTabSessionGroupName,
      filteredSessions,
      groupedSessions,
      selectedGroupKeySet,
      selectedGroupNames,
      selectedGroups,
      selectedSession,
      selectedSessionIdSet,
      selectedSessionsInActiveGroup,
      sessionBadgeText,
      sessionContextTarget,
      sessionGroupOptions
    };
  }, [
    activeSessionGroupKey,
    activeTabId,
    persistedGroupNames,
    selectedGroupKeys,
    selectedSessionId,
    selectedSessionIds,
    sessionContextSessionId,
    sessionFavoritesOnly,
    sessionFilterQuery,
    sessionSortMode,
    sessions,
    terminalTabs
  ]);
}
