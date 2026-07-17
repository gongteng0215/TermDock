import type {
  TerminalCommandHistoryEntry,
  TerminalCommandHistorySource
} from "./terminal-workspace-types";

export const MAX_TERMINAL_COMMAND_HISTORY = 500;
export const MAX_TERMINAL_COMMAND_HISTORY_COMMAND_LENGTH = 16000;
export const TERMINAL_COMMAND_HISTORY_STORAGE_KEY = "termdock.terminal-command-history.v2";
export const LEGACY_TERMINAL_COMMAND_HISTORY_STORAGE_KEYS = [
  "termdock.terminal-command-history.v1"
];
export const TERMINAL_COMMAND_HISTORY_APPEND_EVENT = "termdock:terminal-command-history-append";
export const TERMINAL_COMMAND_HISTORY_REMOVE_EVENT = "termdock:terminal-command-history-remove";

function isTerminalCommandHistorySource(value: unknown): value is TerminalCommandHistorySource {
  return value === "screen" || value === "buffer" || value === "manual" || value === "imported";
}

export function normalizeTerminalCommandHistorySource(
  value: unknown
): TerminalCommandHistorySource {
  return isTerminalCommandHistorySource(value) ? value : "buffer";
}

function dedupeTerminalCommandHistoryEntries(
  entries: TerminalCommandHistoryEntry[]
): TerminalCommandHistoryEntry[] {
  const seenCommands = new Set<string>();
  const uniqueEntries: TerminalCommandHistoryEntry[] = [];
  for (const entry of entries) {
    const normalizedCommand = entry.command.trim();
    if (!normalizedCommand || seenCommands.has(normalizedCommand)) {
      continue;
    }
    seenCommands.add(normalizedCommand);
    uniqueEntries.push({
      ...entry,
      command: normalizedCommand
    });
    if (uniqueEntries.length >= MAX_TERMINAL_COMMAND_HISTORY) {
      break;
    }
  }
  return uniqueEntries;
}

function readTerminalCommandHistoryStorageValue(): string | null {
  const directValue = window.localStorage.getItem(TERMINAL_COMMAND_HISTORY_STORAGE_KEY);
  if (directValue) {
    return directValue;
  }
  for (const legacyKey of LEGACY_TERMINAL_COMMAND_HISTORY_STORAGE_KEYS) {
    const legacyValue = window.localStorage.getItem(legacyKey);
    if (legacyValue) {
      return legacyValue;
    }
  }
  return null;
}

export function readTerminalCommandHistory(): TerminalCommandHistoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const rawValue = readTerminalCommandHistoryStorageValue();
    if (!rawValue) {
      return [];
    }
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const entries: TerminalCommandHistoryEntry[] = [];
    parsed.forEach((row, index) => {
      if (!row || typeof row !== "object") {
        return;
      }
      const candidate = row as Record<string, unknown>;
      const command = typeof candidate.command === "string" ? candidate.command.trim() : "";
      if (!command) {
        return;
      }
      const rawExecutedAt = candidate.executedAt;
      let executedAt = 0;
      if (typeof rawExecutedAt === "number" && Number.isFinite(rawExecutedAt)) {
        executedAt = Math.max(0, Math.trunc(rawExecutedAt));
      } else if (typeof rawExecutedAt === "string" && rawExecutedAt.trim().length > 0) {
        const numericValue = Number(rawExecutedAt);
        if (Number.isFinite(numericValue) && numericValue > 0) {
          executedAt = Math.trunc(numericValue);
        } else {
          const dateValue = Date.parse(rawExecutedAt);
          if (Number.isFinite(dateValue) && dateValue > 0) {
            executedAt = Math.trunc(dateValue);
          }
        }
      }
      if (!executedAt) {
        return;
      }
      const rawId = typeof candidate.id === "string" ? candidate.id.trim() : "";
      const tabId = typeof candidate.tabId === "string" ? candidate.tabId.trim() : "__legacy__";
      const id = rawId || `legacy-${executedAt}-${index}`;
      const source = normalizeTerminalCommandHistorySource(candidate.source);
      entries.push({
        id,
        tabId,
        command: command.slice(0, MAX_TERMINAL_COMMAND_HISTORY_COMMAND_LENGTH),
        executedAt,
        source
      });
    });
    entries.sort((left, right) => right.executedAt - left.executedAt);
    return dedupeTerminalCommandHistoryEntries(entries);
  } catch {
    return [];
  }
}
