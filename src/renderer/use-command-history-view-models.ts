import { useMemo } from "react";

import type { TerminalCommandHistoryEntry } from "./components/terminal-workspace";

type TerminalCommandHistoryScope = "activeTab" | "allTabs";

interface CommandHistoryEntryView {
  id: string;
  command: string;
  selected: boolean;
  metaLabel: string;
  title: string;
}

interface UseCommandHistoryViewModelsArgs {
  activeTabId: string | null;
  buildEntryMetaLabel: (entry: TerminalCommandHistoryEntry) => string;
  buildEntryTitle: (entry: TerminalCommandHistoryEntry) => string;
  commandHistoryContextEntryId: string | null;
  entries: TerminalCommandHistoryEntry[];
  previewLimit: number;
  query: string;
  scope: TerminalCommandHistoryScope;
  selection: string[];
}

export function useCommandHistoryViewModels({
  activeTabId,
  buildEntryMetaLabel,
  buildEntryTitle,
  commandHistoryContextEntryId,
  entries,
  previewLimit,
  query,
  scope,
  selection
}: UseCommandHistoryViewModelsArgs) {
  const visibleTerminalCommandHistoryEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (scope === "activeTab" && activeTabId && entry.tabId !== activeTabId) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return entry.command.toLowerCase().includes(normalizedQuery);
    });
  }, [activeTabId, entries, query, scope]);

  const inspectorTerminalCommandHistoryEntries = useMemo(
    () => visibleTerminalCommandHistoryEntries.slice(0, previewLimit),
    [previewLimit, visibleTerminalCommandHistoryEntries]
  );

  const hiddenInspectorCommandHistoryCount = Math.max(
    0,
    visibleTerminalCommandHistoryEntries.length - inspectorTerminalCommandHistoryEntries.length
  );

  const selectedCommandHistoryIdSet = useMemo(() => new Set(selection), [selection]);

  const visibleCommandHistoryIds = useMemo(
    () => visibleTerminalCommandHistoryEntries.map((entry) => entry.id),
    [visibleTerminalCommandHistoryEntries]
  );

  const visibleCommandHistoryEntryById = useMemo(() => {
    const next = new Map<string, TerminalCommandHistoryEntry>();
    for (const entry of visibleTerminalCommandHistoryEntries) {
      next.set(entry.id, entry);
    }
    return next;
  }, [visibleTerminalCommandHistoryEntries]);

  const allVisibleCommandHistorySelected =
    visibleCommandHistoryIds.length > 0 &&
    visibleCommandHistoryIds.every((entryId) => selectedCommandHistoryIdSet.has(entryId));

  const visibleTerminalCommandHistoryEntryViews: CommandHistoryEntryView[] = useMemo(
    () =>
      visibleTerminalCommandHistoryEntries.map((entry) => ({
        id: entry.id,
        command: entry.command,
        selected: selectedCommandHistoryIdSet.has(entry.id),
        metaLabel: buildEntryMetaLabel(entry),
        title: buildEntryTitle(entry)
      })),
    [
      buildEntryMetaLabel,
      buildEntryTitle,
      selectedCommandHistoryIdSet,
      visibleTerminalCommandHistoryEntries
    ]
  );

  const selectedCommandHistoryContextEntry = useMemo(() => {
    if (!commandHistoryContextEntryId) {
      return null;
    }
    return entries.find((entry) => entry.id === commandHistoryContextEntryId) ?? null;
  }, [commandHistoryContextEntryId, entries]);

  return {
    allVisibleCommandHistorySelected,
    hiddenInspectorCommandHistoryCount,
    inspectorTerminalCommandHistoryEntries,
    selectedCommandHistoryContextEntry,
    selectedCommandHistoryIdSet,
    visibleCommandHistoryEntryById,
    visibleCommandHistoryIds,
    visibleTerminalCommandHistoryEntries,
    visibleTerminalCommandHistoryEntryViews
  };
}
