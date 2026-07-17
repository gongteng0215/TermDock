import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import {
  MAX_TERMINAL_COMMAND_HISTORY,
  MAX_TERMINAL_COMMAND_HISTORY_COMMAND_LENGTH,
  TERMINAL_COMMAND_HISTORY_APPEND_EVENT,
  TERMINAL_COMMAND_HISTORY_REMOVE_EVENT
} from "./terminal-command-history-storage";
import type {
  TerminalCommandHistoryEntry,
  TerminalCommandHistorySource
} from "./terminal-workspace-types";

interface TerminalTabLike {
  id: string;
}

interface GuardedTerminalWriteOptions {
  source: "commandHistoryRun" | "commandHistoryPaste";
  commandText?: string;
}

interface UseTerminalCommandHistoryActionsArgs {
  activeTabIdRef: MutableRefObject<string | null>;
  copyTextToClipboard: (text: string) => Promise<boolean>;
  guardedTerminalWrite: (
    tabId: string,
    text: string,
    options: GuardedTerminalWriteOptions
  ) => Promise<boolean>;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setEntries: Dispatch<SetStateAction<TerminalCommandHistoryEntry[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  terminalApi: Window["termdock"]["terminal"] | null;
  terminalTabsRef: MutableRefObject<TerminalTabLike[]>;
}

export function useTerminalCommandHistoryActions({
  activeTabIdRef,
  copyTextToClipboard,
  guardedTerminalWrite,
  setActiveTabId,
  setEntries,
  setError,
  terminalApi,
  terminalTabsRef
}: UseTerminalCommandHistoryActionsArgs) {
  const copyTerminalCommandHistoryEntry = useCallback(
    async (entry: TerminalCommandHistoryEntry) => {
      try {
        const copied = await copyTextToClipboard(entry.command);
        if (copied) {
          return;
        }
      } catch {
        // Fall through and show error.
      }
      setError("Clipboard unavailable. Copy command manually.");
    },
    [copyTextToClipboard, setError]
  );

  const runTerminalCommandHistoryEntry = useCallback(
    async (entry: TerminalCommandHistoryEntry) => {
      if (!terminalApi) {
        setError("Terminal bridge unavailable. Restart `pnpm dev`.");
        return;
      }
      const existingTabId = terminalTabsRef.current.some((tab) => tab.id === entry.tabId)
        ? entry.tabId
        : activeTabIdRef.current;
      if (!existingTabId) {
        setError("Open a terminal tab before running command history entries.");
        return;
      }
      if (activeTabIdRef.current !== existingTabId) {
        setActiveTabId(existingTabId);
      }
      try {
        const wrote = await guardedTerminalWrite(existingTabId, `${entry.command}\n`, {
          source: "commandHistoryRun",
          commandText: entry.command
        });
        if (!wrote) {
          return;
        }
        window.dispatchEvent(
          new CustomEvent(TERMINAL_COMMAND_HISTORY_APPEND_EVENT, {
            detail: {
              tabId: existingTabId,
              command: entry.command,
              source: "manual"
            }
          })
        );
      } catch (caughtError) {
        setError((caughtError as Error).message);
      }
    },
    [activeTabIdRef, guardedTerminalWrite, setActiveTabId, setError, terminalApi, terminalTabsRef]
  );

  const pasteTerminalCommandHistoryEntry = useCallback(
    async (entry: TerminalCommandHistoryEntry) => {
      if (!terminalApi) {
        setError("Terminal bridge unavailable. Restart `pnpm dev`.");
        return;
      }
      const targetTabId = activeTabIdRef.current;
      if (!targetTabId) {
        setError("Open and focus a terminal tab before pasting command history entries.");
        return;
      }
      try {
        await guardedTerminalWrite(targetTabId, entry.command, {
          source: "commandHistoryPaste",
          commandText: entry.command
        });
      } catch (caughtError) {
        setError((caughtError as Error).message);
      }
    },
    [activeTabIdRef, guardedTerminalWrite, setError, terminalApi]
  );

  const upsertTerminalCommandHistoryCommand = useCallback(
    (
      command: string,
      options?: {
        replaceEntryId?: string;
        preferredTabId?: string;
        source?: TerminalCommandHistorySource;
      }
    ): boolean => {
      const normalizedCommand = command
        .trim()
        .slice(0, MAX_TERMINAL_COMMAND_HISTORY_COMMAND_LENGTH);
      if (!normalizedCommand) {
        return false;
      }
      const replaceEntryId = options?.replaceEntryId?.trim() ?? "";
      const preferredTabId = options?.preferredTabId?.trim();
      const fallbackTabId = activeTabIdRef.current ?? terminalTabsRef.current[0]?.id ?? "__manual__";
      const tabId = preferredTabId || fallbackTabId;
      const source = options?.source ?? "manual";

      if (replaceEntryId) {
        window.dispatchEvent(
          new CustomEvent(TERMINAL_COMMAND_HISTORY_REMOVE_EVENT, {
            detail: {
              entryId: replaceEntryId
            }
          })
        );
      }

      window.dispatchEvent(
        new CustomEvent(TERMINAL_COMMAND_HISTORY_APPEND_EVENT, {
          detail: {
            tabId,
            command: normalizedCommand,
            source
          }
        })
      );

      setEntries((prev) => {
        const filtered = prev.filter((entry) => {
          if (replaceEntryId && entry.id === replaceEntryId) {
            return false;
          }
          return entry.command.trim() !== normalizedCommand;
        });
        const nextEntry: TerminalCommandHistoryEntry = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          tabId,
          command: normalizedCommand,
          executedAt: Date.now(),
          source
        };
        return [nextEntry, ...filtered].slice(0, MAX_TERMINAL_COMMAND_HISTORY);
      });
      return true;
    },
    [activeTabIdRef, setEntries, terminalTabsRef]
  );

  return {
    copyTerminalCommandHistoryEntry,
    pasteTerminalCommandHistoryEntry,
    runTerminalCommandHistoryEntry,
    upsertTerminalCommandHistoryCommand
  };
}
