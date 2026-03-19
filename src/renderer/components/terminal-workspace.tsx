import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { History, X } from "lucide-react";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "xterm";
import type { IDisposable } from "xterm";

import type { TerminalConnectionStatus } from "../../shared/terminal";
import {
  inspectDangerousCommandText,
  shouldInspectDangerousCommandWrite,
  type DangerousCommandApprovalRequest,
  type DangerousCommandExecutionSource,
  type DangerousCommandGuardPreferences
} from "../dangerous-command-guard";

export interface TerminalTab {
  id: string;
  sessionId: string;
  title: string;
  instance: number;
}

export interface ConnectionPreferences {
  autoReconnect: boolean;
  reconnectDelaySeconds: number;
}

export type HotkeyModifier = "primary" | "primaryShift" | "alt" | "altShift";

export interface HotkeyBindingPreference {
  enabled: boolean;
  modifier: HotkeyModifier;
  key: string;
}

export interface HotkeyPreferences {
  openSessionTab: HotkeyBindingPreference;
  closeActiveTab: HotkeyBindingPreference;
  terminalCopy: HotkeyBindingPreference;
  terminalPaste: HotkeyBindingPreference;
  terminalSearch: HotkeyBindingPreference;
}

interface TerminalWorkspaceProps {
  tabs: TerminalTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCloseTabsLeft: (tabId: string) => void;
  onCloseTabsRight: (tabId: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
  onCloseAllTabs: () => void;
  onError: (message: string) => void;
  systemApi: Window["termdock"]["system"] | null;
  terminalApi: Window["termdock"]["terminal"] | null;
  connectionPreferences: ConnectionPreferences;
  hotkeyPreferences: HotkeyPreferences;
  dangerousCommandGuardPreferences: DangerousCommandGuardPreferences;
  requestDangerousCommandApproval?: (request: DangerousCommandApprovalRequest) => Promise<boolean>;
  onCommandHistoryChange?: (entries: TerminalCommandHistoryEntry[]) => void;
}

interface TerminalInstance {
  terminal: Terminal;
  fitAddon: FitAddon;
  dataDisposable: IDisposable;
  removeWheelListener: () => void;
}

const WHEEL_PIXELS_PER_LINE = 40;
const MAX_WHEEL_NAV_LINES = 12;
const WHEEL_CAPTURE = true;

type TabUiStatus = {
  status: TerminalConnectionStatus | "error";
  message?: string;
};

interface TerminalContextAction {
  id: string;
  label: string;
  run: (tabId: string) => void;
  isDisabled?: (tabId: string) => boolean;
}

interface ContextMenuState {
  tabId: string;
  x: number;
  y: number;
}

interface TabContextAction {
  id: string;
  label: string;
  run: (tabId: string) => void;
  isDisabled?: (tabId: string) => boolean;
}

interface TerminalSearchState {
  query: string;
  row: number;
  column: number;
}

export interface TerminalCommandHistoryEntry {
  id: string;
  tabId: string;
  tabTitle: string;
  command: string;
  executedAt: number;
  source: TerminalCommandHistorySource;
}

type CommandHistoryScope = "activeTab" | "allTabs";
export type TerminalCommandHistorySource = "screen" | "buffer" | "manual" | "imported";

export const MAX_TERMINAL_COMMAND_HISTORY = 500;
export const TERMINAL_COMMAND_HISTORY_STORAGE_KEY = "termdock.terminal-command-history.v1";
export const TERMINAL_COMMAND_HISTORY_APPEND_EVENT = "termdock:terminal-command-history-append";
export const TERMINAL_COMMAND_HISTORY_REMOVE_EVENT = "termdock:terminal-command-history-remove";
const COMMAND_CAPTURE_PROMPT_MARKERS = ["$ ", "# ", "% ", "> "];

function isTerminalCommandHistorySource(value: unknown): value is TerminalCommandHistorySource {
  return value === "screen" || value === "buffer" || value === "manual" || value === "imported";
}

function normalizeTerminalCommandHistorySource(value: unknown): TerminalCommandHistorySource {
  return isTerminalCommandHistorySource(value) ? value : "buffer";
}

function normalizeCapturedTerminalText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+$/g, "").trim();
}

function readLogicalTerminalLine(
  terminal: Terminal,
  rowIndex: number
): {
  startRow: number;
  text: string;
} | null {
  const activeBuffer = terminal.buffer.active;
  let startRow = rowIndex;
  while (startRow > 0) {
    const line = activeBuffer.getLine(startRow);
    if (!line || !line.isWrapped) {
      break;
    }
    startRow -= 1;
  }

  let endRow = rowIndex;
  while (true) {
    const nextLine = activeBuffer.getLine(endRow + 1);
    if (!nextLine || !nextLine.isWrapped) {
      break;
    }
    endRow += 1;
  }

  const parts: string[] = [];
  for (let row = startRow; row <= endRow; row += 1) {
    const line = activeBuffer.getLine(row);
    if (!line) {
      continue;
    }
    parts.push(line.translateToString(true));
  }

  const text = normalizeCapturedTerminalText(parts.join(""));
  if (!text) {
    return null;
  }
  return {
    startRow,
    text
  };
}

function stripPromptFromCapturedLine(line: string, fallbackCommand: string): string {
  const normalizedLine = normalizeCapturedTerminalText(line);
  if (!normalizedLine) {
    return "";
  }

  const normalizedFallback = fallbackCommand.trim();
  if (normalizedFallback.length >= 3) {
    const fallbackIndex = normalizedLine.indexOf(normalizedFallback);
    if (fallbackIndex >= 0) {
      return normalizedLine.slice(fallbackIndex).trim();
    }
  }

  for (const marker of COMMAND_CAPTURE_PROMPT_MARKERS) {
    const markerIndex = normalizedLine.lastIndexOf(marker);
    if (markerIndex < 0) {
      continue;
    }
    const candidate = normalizedLine.slice(markerIndex + marker.length).trim();
    if (candidate) {
      return candidate;
    }
  }

  return "";
}

function readSubmittedCommandFromTerminal(terminal: Terminal, fallbackCommand: string): string {
  const activeBuffer = terminal.buffer.active;
  const cursorRow = activeBuffer.baseY + activeBuffer.cursorY;
  const visitedStartRows = new Set<number>();

  for (let row = cursorRow; row >= Math.max(0, cursorRow - 10); row -= 1) {
    const logicalLine = readLogicalTerminalLine(terminal, row);
    if (!logicalLine || visitedStartRows.has(logicalLine.startRow)) {
      continue;
    }
    visitedStartRows.add(logicalLine.startRow);
    const extracted = stripPromptFromCapturedLine(logicalLine.text, fallbackCommand);
    if (extracted) {
      return extracted;
    }
  }

  return fallbackCommand.trim();
}

function shouldSkipTerminalCommandCapture(terminal: Terminal): boolean {
  return terminal.buffer.active.type === "alternate";
}

function getTerminalCommandHistorySourceLabel(source: TerminalCommandHistorySource): string {
  switch (source) {
    case "screen":
      return "Screen";
    case "buffer":
      return "Buffer";
    case "manual":
      return "Manual";
    case "imported":
      return "Imported";
    default:
      return "Buffer";
  }
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

export function readTerminalCommandHistory(): TerminalCommandHistoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const rawValue = window.localStorage.getItem(TERMINAL_COMMAND_HISTORY_STORAGE_KEY);
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
      const tabTitle =
        typeof candidate.tabTitle === "string" && candidate.tabTitle.trim()
          ? candidate.tabTitle.trim()
          : "Legacy tab";
      const id = rawId || `legacy-${executedAt}-${index}`;
      const source = normalizeTerminalCommandHistorySource(candidate.source);
      entries.push({
        id,
        tabId,
        tabTitle: tabTitle.slice(0, 200),
        command: command.slice(0, 4000),
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

export function TerminalWorkspace({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onCloseTabsLeft,
  onCloseTabsRight,
  onCloseOtherTabs,
  onCloseAllTabs,
  onError,
  systemApi,
  terminalApi,
  connectionPreferences,
  hotkeyPreferences,
  dangerousCommandGuardPreferences,
  requestDangerousCommandApproval,
  onCommandHistoryChange
}: TerminalWorkspaceProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const tabMenuRef = useRef<HTMLDivElement | null>(null);
  const searchDialogInputRef = useRef<HTMLInputElement | null>(null);
  const commandHistoryInputRef = useRef<HTMLInputElement | null>(null);
  const containerRefs = useRef(new Map<string, HTMLDivElement>());
  const terminalRefs = useRef(new Map<string, TerminalInstance>());
  const searchStateRef = useRef(new Map<string, TerminalSearchState>());
  const reconnectAttemptsRef = useRef(new Map<string, number>());
  const reconnectTimersRef = useRef(new Map<string, number>());
  const deferredFitTimersRef = useRef(new Map<string, number[]>());
  const tabsByIdRef = useRef(new Map<string, TerminalTab>());
  const tabStatusesRef = useRef<Record<string, TabUiStatus>>({});
  const [tabStatuses, setTabStatuses] = useState<Record<string, TabUiStatus>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [tabContextMenu, setTabContextMenu] = useState<ContextMenuState | null>(null);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [searchDialogTabId, setSearchDialogTabId] = useState<string | null>(null);
  const [searchDialogQuery, setSearchDialogQuery] = useState("");
  const [isCommandHistoryOpen, setIsCommandHistoryOpen] = useState(false);
  const [commandHistoryScope, setCommandHistoryScope] = useState<CommandHistoryScope>("activeTab");
  const [commandHistoryQuery, setCommandHistoryQuery] = useState("");
  const [commandHistoryEntries, setCommandHistoryEntries] = useState<TerminalCommandHistoryEntry[]>(
    () => readTerminalCommandHistory()
  );
  const commandInputBufferRef = useRef(new Map<string, string>());
  const pendingCommandCaptureTimersRef = useRef(new Map<string, number>());
  const pendingTerminalWriteQueueRef = useRef(new Map<string, Promise<void>>());

  const tabsById = useMemo(() => {
    return new Map(tabs.map((tab) => [tab.id, tab]));
  }, [tabs]);

  const visibleCommandHistoryEntries = useMemo(() => {
    const activeTabFilter = commandHistoryScope === "activeTab" ? activeTabId : null;
    const normalizedQuery = commandHistoryQuery.trim().toLowerCase();
    return commandHistoryEntries.filter((entry) => {
      if (activeTabFilter && entry.tabId !== activeTabFilter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return (
        entry.command.toLowerCase().includes(normalizedQuery) ||
        entry.tabTitle.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [activeTabId, commandHistoryEntries, commandHistoryQuery, commandHistoryScope]);

  useEffect(() => {
    tabsByIdRef.current = tabsById;
  }, [tabsById]);
  useEffect(() => {
    tabStatusesRef.current = tabStatuses;
  }, [tabStatuses]);
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(
        TERMINAL_COMMAND_HISTORY_STORAGE_KEY,
        JSON.stringify(commandHistoryEntries.slice(0, MAX_TERMINAL_COMMAND_HISTORY))
      );
    } catch {
      // Ignore storage failures; runtime history remains available.
    }
  }, [commandHistoryEntries]);

  useEffect(() => {
    onCommandHistoryChange?.(commandHistoryEntries);
  }, [commandHistoryEntries, onCommandHistoryChange]);

  const setTabStatus = useCallback((tabId: string, status: TabUiStatus) => {
    setTabStatuses((prev) => ({ ...prev, [tabId]: status }));
  }, []);

  const clearReconnectState = useCallback((tabId: string) => {
    reconnectAttemptsRef.current.delete(tabId);
    const timer = reconnectTimersRef.current.get(tabId);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      reconnectTimersRef.current.delete(tabId);
    }
  }, []);

  const clearDeferredFitTimers = useCallback((tabId: string) => {
    const timers = deferredFitTimersRef.current.get(tabId);
    if (!timers) {
      return;
    }
    for (const timer of timers) {
      window.clearTimeout(timer);
    }
    deferredFitTimersRef.current.delete(tabId);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);
  const closeTabContextMenu = useCallback(() => {
    setTabContextMenu(null);
  }, []);

  const openContextMenu = useCallback(
    (event: MouseEvent, tabId: string) => {
      event.preventDefault();
      closeTabContextMenu();
      onSelectTab(tabId);
      setContextMenu({
        tabId,
        x: event.clientX,
        y: event.clientY
      });
    },
    [closeTabContextMenu, onSelectTab]
  );

  const openTabContextMenu = useCallback(
    (event: MouseEvent, tabId: string) => {
      event.preventDefault();
      closeContextMenu();
      onSelectTab(tabId);
      setTabContextMenu({
        tabId,
        x: event.clientX,
        y: event.clientY
      });
    },
    [closeContextMenu, onSelectTab]
  );

  const runContextAction = useCallback(
    (action: TerminalContextAction, tabId: string) => {
      if (action.isDisabled?.(tabId)) {
        return;
      }
      action.run(tabId);
      closeContextMenu();
    },
    [closeContextMenu]
  );

  const runTabContextAction = useCallback(
    (action: TabContextAction, tabId: string) => {
      if (action.isDisabled?.(tabId)) {
        return;
      }
      action.run(tabId);
      closeTabContextMenu();
    },
    [closeTabContextMenu]
  );

  const fitTerminal = useCallback((tabId: string) => {
    const instance = terminalRefs.current.get(tabId);
    const container = containerRefs.current.get(tabId);
    if (!instance || !container) {
      return;
    }

    // FitAddon must run when pane is visible; we only call this for active tab.
    instance.fitAddon.fit();
    const rows = Math.max(instance.terminal.rows, 2);
    const cols = Math.max(instance.terminal.cols, 2);
    if (terminalApi) {
      void terminalApi.resize(tabId, cols, rows);
    }
  }, [terminalApi]);

  const scheduleDeferredFit = useCallback(
    (tabId: string) => {
      clearDeferredFitTimers(tabId);
      const timers: number[] = [];
      const schedule = (delayMs: number) => {
        const timer = window.setTimeout(() => {
          fitTerminal(tabId);
        }, delayMs);
        timers.push(timer);
      };
      schedule(0);
      schedule(90);
      schedule(260);
      deferredFitTimersRef.current.set(tabId, timers);

      // Packaged builds may load fonts later than dev; refit after fonts settle
      // to avoid stale row/column sizing in smaller windows.
      const fontSet = document.fonts;
      void fontSet.ready.then(() => {
        fitTerminal(tabId);
      });
    },
    [clearDeferredFitTimers, fitTerminal]
  );

  const focusTerminal = useCallback((tabId: string) => {
    const instance = terminalRefs.current.get(tabId);
    if (!instance) {
      return;
    }
    instance.terminal.focus();
  }, []);

  const setContainerRef = useCallback((tabId: string, node: HTMLDivElement | null) => {
    if (node) {
      containerRefs.current.set(tabId, node);
      return;
    }
    containerRefs.current.delete(tabId);
  }, []);

  const getActiveInstance = useCallback(() => {
    if (!activeTabId) {
      return null;
    }
    return terminalRefs.current.get(activeTabId) ?? null;
  }, [activeTabId]);

  const connectTab = useCallback(
    async (tab: TerminalTab) => {
      if (!terminalApi) {
        return;
      }
      const instance = terminalRefs.current.get(tab.id);
      if (!instance) {
        return;
      }
      setTabStatus(tab.id, { status: "connecting" });
      void terminalApi
        .connect(tab.id, tab.sessionId)
        .then(() => {
          clearReconnectState(tab.id);
          fitTerminal(tab.id);
          scheduleDeferredFit(tab.id);
        })
        .catch((error: Error) => {
          const message = error.message || "Failed to connect.";
          setTabStatus(tab.id, { status: "error", message });
          instance.terminal.writeln(`\r\n[error] ${message}`);
          onError(message);
        });
    },
    [clearReconnectState, fitTerminal, onError, scheduleDeferredFit, setTabStatus, terminalApi]
  );

  const reconnectTabNow = useCallback(
    (tabId: string) => {
      const tab = tabsByIdRef.current.get(tabId);
      const instance = terminalRefs.current.get(tabId);
      if (!tab || !instance) {
        return;
      }
      instance.terminal.writeln("\r\n[reconnect] Manual reconnect...");
      clearReconnectState(tabId);
      void connectTab(tab);
    },
    [clearReconnectState, connectTab]
  );

  const scheduleReconnect = useCallback(
    (tabId: string) => {
      if (!terminalApi || !connectionPreferences.autoReconnect) {
        return;
      }
      if (reconnectTimersRef.current.has(tabId)) {
        return;
      }
      const tab = tabsByIdRef.current.get(tabId);
      if (!tab) {
        return;
      }
      const nextAttempt = (reconnectAttemptsRef.current.get(tabId) ?? 0) + 1;
      reconnectAttemptsRef.current.set(tabId, nextAttempt);
      const baseDelaySeconds = Math.min(
        60,
        Math.max(1, Math.trunc(connectionPreferences.reconnectDelaySeconds))
      );
      const exponent = Math.min(nextAttempt - 1, 5);
      const delaySeconds = Math.min(60, baseDelaySeconds * 2 ** exponent);

      const instance = terminalRefs.current.get(tabId);
      if (instance) {
        instance.terminal.writeln(
          `\r\n[reconnect] Attempt ${nextAttempt} in ${delaySeconds}s...`
        );
      }

      const timeoutId = window.setTimeout(() => {
        reconnectTimersRef.current.delete(tabId);
        const nextTab = tabsByIdRef.current.get(tabId);
        if (!nextTab) {
          clearReconnectState(tabId);
          return;
        }
        void connectTab(nextTab);
      }, delaySeconds * 1_000);
      reconnectTimersRef.current.set(tabId, timeoutId);
    },
    [clearReconnectState, connectTab, connectionPreferences, terminalApi]
  );

  const copySelectionOrSendInterrupt = useCallback(async (
    allowInterruptFallback = true,
    targetTabId?: string
  ) => {
    const tabId = targetTabId ?? activeTabId;
    if (!tabId || !terminalApi) {
      return;
    }
    const instance = terminalRefs.current.get(tabId) ?? null;
    if (!instance) {
      return;
    }

    const selection = instance.terminal.getSelection();
    if (selection) {
      try {
        if (systemApi?.writeClipboardText) {
          await systemApi.writeClipboardText(selection);
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(selection);
        } else {
          throw new Error("Clipboard API unavailable.");
        }
        instance.terminal.clearSelection();
      } catch {
        onError("Copy failed. Clipboard permission may be blocked.");
      }
      return;
    }

    if (!allowInterruptFallback) {
      return;
    }

    void terminalApi.write(tabId, "\u0003");
  }, [activeTabId, onError, systemApi, terminalApi]);

  const requestDangerousCommandApprovalForWrite = useCallback(
    async (
      tabId: string,
      source: DangerousCommandExecutionSource,
      commandText: string
    ): Promise<boolean> => {
      if (!requestDangerousCommandApproval) {
        return true;
      }
      if (!shouldInspectDangerousCommandWrite(source, commandText)) {
        return true;
      }
      const inspection = inspectDangerousCommandText(commandText, dangerousCommandGuardPreferences);
      if (!inspection) {
        return true;
      }
      return requestDangerousCommandApproval({
        tabId,
        source,
        result: inspection
      });
    },
    [dangerousCommandGuardPreferences, requestDangerousCommandApproval]
  );

  const enqueueTerminalWriteTask = useCallback(
    (tabId: string, task: () => Promise<void>) => {
      const previous = pendingTerminalWriteQueueRef.current.get(tabId) ?? Promise.resolve();
      const next = previous
        .catch(() => undefined)
        .then(task)
        .catch((caughtError) => {
          onError(caughtError instanceof Error ? caughtError.message : "Terminal write failed.");
        })
        .finally(() => {
          if (pendingTerminalWriteQueueRef.current.get(tabId) === next) {
            pendingTerminalWriteQueueRef.current.delete(tabId);
          }
        });
      pendingTerminalWriteQueueRef.current.set(tabId, next);
    },
    [onError]
  );

  const pasteClipboardToTerminal = useCallback(async (targetTabId?: string) => {
    const tabId = targetTabId ?? activeTabId;
    if (!tabId || !terminalApi) {
      return;
    }
    const instance = terminalRefs.current.get(tabId) ?? null;
    if (!instance) {
      return;
    }

    try {
      let text = "";
      if (systemApi?.readClipboardText) {
        text = await systemApi.readClipboardText();
      } else if (navigator.clipboard?.readText) {
        text = await navigator.clipboard.readText();
      } else {
        throw new Error("Clipboard API unavailable.");
      }
      if (!text) {
        return;
      }
      enqueueTerminalWriteTask(tabId, async () => {
        const approved = await requestDangerousCommandApprovalForWrite(tabId, "clipboard", text);
        if (!approved) {
          return;
        }
        await terminalApi.write(tabId, text);
      });
      instance.terminal.focus();
    } catch {
      onError("Paste failed. Clipboard permission may be blocked.");
    }
  }, [
    activeTabId,
    enqueueTerminalWriteTask,
    onError,
    requestDangerousCommandApprovalForWrite,
    systemApi,
    terminalApi
  ]);

  const runSearchInTerminal = useCallback(
    (tabId: string, rawQuery: string) => {
      const instance = terminalRefs.current.get(tabId) ?? null;
      if (!instance) {
        return;
      }
      const query = rawQuery.trim();
      if (!query) {
        return;
      }

      const previous = searchStateRef.current.get(tabId);
      const from =
        previous && previous.query === query
          ? { row: previous.row, column: previous.column + 1 }
          : undefined;
      const match = findTerminalMatch(instance.terminal, query, from);
      if (!match) {
        onError(`No terminal match for "${query}".`);
        return;
      }

      instance.terminal.select(match.column, match.row, query.length);
      instance.terminal.scrollToLine(Math.max(0, match.row - Math.floor(instance.terminal.rows / 2)));
      instance.terminal.focus();
      searchStateRef.current.set(tabId, {
        query,
        row: match.row,
        column: match.column
      });
    },
    [onError]
  );

  const closeSearchDialog = useCallback(() => {
    setIsSearchDialogOpen(false);
    setSearchDialogTabId(null);
  }, []);

  const submitSearchDialog = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      if (event) {
        event.preventDefault();
      }
      if (!searchDialogTabId) {
        closeSearchDialog();
        return;
      }
      runSearchInTerminal(searchDialogTabId, searchDialogQuery);
      closeSearchDialog();
    },
    [closeSearchDialog, runSearchInTerminal, searchDialogQuery, searchDialogTabId]
  );

  const searchInTerminal = useCallback(
    (targetTabId?: string) => {
      const tabId = targetTabId ?? activeTabId;
      if (!tabId) {
        return;
      }
      if (!terminalRefs.current.has(tabId)) {
        return;
      }
      const previous = searchStateRef.current.get(tabId);
      setSearchDialogQuery(previous?.query ?? "");
      setSearchDialogTabId(tabId);
      setIsSearchDialogOpen(true);
      closeContextMenu();
    },
    [activeTabId, closeContextMenu]
  );

  const interruptTerminal = useCallback(
    (tabId: string) => {
      if (!terminalApi) {
        return;
      }
      if (!terminalRefs.current.has(tabId)) {
        return;
      }
      void terminalApi.write(tabId, "\u0003");
      terminalRefs.current.get(tabId)?.terminal.focus();
    },
    [terminalApi]
  );

  const selectAllTerminal = useCallback((tabId: string) => {
    const instance = terminalRefs.current.get(tabId);
    if (!instance) {
      return;
    }
    instance.terminal.selectAll();
    instance.terminal.focus();
  }, []);

  const hasTerminalSelection = useCallback((tabId: string) => {
    const instance = terminalRefs.current.get(tabId);
    if (!instance) {
      return false;
    }
    return instance.terminal.getSelection().length > 0;
  }, []);

  const closeCommandHistory = useCallback(() => {
    setIsCommandHistoryOpen(false);
  }, []);

  const openCommandHistory = useCallback(
    (targetTabId?: string) => {
      const tabId = targetTabId ?? activeTabId;
      if (tabId) {
        onSelectTab(tabId);
      }
      setIsCommandHistoryOpen(true);
      closeContextMenu();
    },
    [activeTabId, closeContextMenu, onSelectTab]
  );

  const copyText = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        if (systemApi?.writeClipboardText) {
          await systemApi.writeClipboardText(text);
          return true;
        }
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch {
        // Fall through to false.
      }
      return false;
    },
    [systemApi]
  );

  const copyCommandHistoryEntry = useCallback(
    async (entry: TerminalCommandHistoryEntry) => {
      const copied = await copyText(entry.command);
      if (!copied) {
        onError("Copy failed. Clipboard permission may be blocked.");
      }
    },
    [copyText, onError]
  );

  const runCommandHistoryEntry = useCallback(
    (entry: TerminalCommandHistoryEntry) => {
      if (!terminalApi) {
        onError("Terminal bridge is not ready.");
        return;
      }
      const preferredTabId =
        activeTabId && terminalRefs.current.has(activeTabId) ? activeTabId : null;
      const fallbackTabId = terminalRefs.current.has(entry.tabId) ? entry.tabId : null;
      const targetTabId = preferredTabId ?? fallbackTabId;
      if (!targetTabId) {
        onError("No available terminal tab to run this command.");
        return;
      }
      if (targetTabId !== activeTabId) {
        onSelectTab(targetTabId);
      }
      enqueueTerminalWriteTask(targetTabId, async () => {
        const approved = await requestDangerousCommandApprovalForWrite(
          targetTabId,
          "commandHistoryRun",
          entry.command
        );
        if (!approved) {
          return;
        }
        await terminalApi.write(targetTabId, `${entry.command}\r`);
      });
      terminalRefs.current.get(targetTabId)?.terminal.focus();
    },
    [
      activeTabId,
      enqueueTerminalWriteTask,
      onError,
      onSelectTab,
      requestDangerousCommandApprovalForWrite,
      terminalApi
    ]
  );

  const clearVisibleCommandHistory = useCallback(() => {
    const visibleIds = new Set(visibleCommandHistoryEntries.map((entry) => entry.id));
    if (visibleIds.size === 0) {
      return;
    }
    setCommandHistoryEntries((prev) => prev.filter((entry) => !visibleIds.has(entry.id)));
  }, [visibleCommandHistoryEntries]);

  const removeCommandHistoryEntry = useCallback((entryId: string) => {
    const targetId = entryId.trim();
    if (!targetId) {
      return;
    }
    setCommandHistoryEntries((prev) => prev.filter((entry) => entry.id !== targetId));
  }, []);

  const clearAllCommandHistory = useCallback(() => {
    setCommandHistoryEntries([]);
  }, []);

  const clearPendingCommandCapture = useCallback((tabId: string) => {
    const timer = pendingCommandCaptureTimersRef.current.get(tabId);
    if (timer === undefined) {
      return;
    }
    window.clearTimeout(timer);
    pendingCommandCaptureTimersRef.current.delete(tabId);
  }, []);

  const appendCommandHistory = useCallback((
    tabId: string,
    command: string,
    source: TerminalCommandHistorySource
  ) => {
    const normalizedCommand = command.trim();
    if (!normalizedCommand) {
      return;
    }
    const tab = tabsByIdRef.current.get(tabId);
    const tabTitle = tab?.title?.trim() || `Tab ${tabId}`;
    setCommandHistoryEntries((prev) => {
      const next: TerminalCommandHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        tabId,
        tabTitle,
        command: normalizedCommand,
        executedAt: Date.now(),
        source
      };
      const filtered = prev.filter((entry) => entry.command.trim() !== normalizedCommand);
      return [next, ...filtered].slice(0, MAX_TERMINAL_COMMAND_HISTORY);
    });
  }, []);

  const queueCommandHistoryCapture = useCallback(
    (tabId: string, fallbackCommand: string) => {
      const normalizedFallback = fallbackCommand.trim();
      if (!normalizedFallback) {
        return;
      }
      clearPendingCommandCapture(tabId);
      const timer = window.setTimeout(() => {
        pendingCommandCaptureTimersRef.current.delete(tabId);
        const instance = terminalRefs.current.get(tabId);
        if (!instance) {
          appendCommandHistory(tabId, normalizedFallback, "buffer");
          return;
        }
        if (shouldSkipTerminalCommandCapture(instance.terminal)) {
          return;
        }
        const capturedCommand = readSubmittedCommandFromTerminal(instance.terminal, normalizedFallback);
        const source: TerminalCommandHistorySource =
          capturedCommand.trim() === normalizedFallback ? "buffer" : "screen";
        appendCommandHistory(tabId, capturedCommand, source);
      }, 120);
      pendingCommandCaptureTimersRef.current.set(tabId, timer);
    },
    [appendCommandHistory, clearPendingCommandCapture]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleExternalAppend = (
      event: Event
    ) => {
      const detail = (
        event as CustomEvent<{ tabId?: unknown; command?: unknown; source?: unknown }>
      ).detail;
      const tabId = typeof detail?.tabId === "string" ? detail.tabId.trim() : "";
      const command = typeof detail?.command === "string" ? detail.command : "";
      const source = normalizeTerminalCommandHistorySource(detail?.source);
      if (!tabId || !command) {
        return;
      }
      appendCommandHistory(tabId, command, source);
    };
    const handleExternalRemove = (
      event: Event
    ) => {
      const detail = (event as CustomEvent<{ entryId?: unknown }>).detail;
      const entryId = typeof detail?.entryId === "string" ? detail.entryId.trim() : "";
      if (!entryId) {
        return;
      }
      setCommandHistoryEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    };
    window.addEventListener(
      TERMINAL_COMMAND_HISTORY_APPEND_EVENT,
      handleExternalAppend as EventListener
    );
    window.addEventListener(
      TERMINAL_COMMAND_HISTORY_REMOVE_EVENT,
      handleExternalRemove as EventListener
    );
    return () => {
      window.removeEventListener(
        TERMINAL_COMMAND_HISTORY_APPEND_EVENT,
        handleExternalAppend as EventListener
      );
      window.removeEventListener(
        TERMINAL_COMMAND_HISTORY_REMOVE_EVENT,
        handleExternalRemove as EventListener
      );
    };
  }, [appendCommandHistory]);

  const sendTerminalInput = useCallback(
    async (tabId: string, rawData: string): Promise<void> => {
      if (!rawData || !terminalApi) {
        return;
      }
      let buffer = commandInputBufferRef.current.get(tabId) ?? "";
      let forwarded = "";
      let index = 0;
      while (index < rawData.length) {
        const char = rawData[index];
        if (char === "\u001b") {
          let cursor = index + 1;
          if (cursor < rawData.length && (rawData[cursor] === "[" || rawData[cursor] === "O")) {
            cursor += 1;
            while (cursor < rawData.length) {
              const code = rawData.charCodeAt(cursor);
              if (code >= 0x40 && code <= 0x7e) {
                cursor += 1;
                break;
              }
              cursor += 1;
            }
          } else {
            cursor = Math.min(rawData.length, index + 2);
          }
          forwarded += rawData.slice(index, cursor);
          index = cursor;
          continue;
        }
        if (char === "\r" || char === "\n") {
          const newlineToken =
            char === "\r" && rawData[index + 1] === "\n" ? "\r\n" : char;
          const approved = await requestDangerousCommandApprovalForWrite(tabId, "keyboard", buffer);
          if (approved) {
            forwarded += newlineToken;
            queueCommandHistoryCapture(tabId, buffer);
            buffer = "";
          }
          index += newlineToken === "\r\n" ? 2 : 1;
          continue;
        }
        if (char === "\u007f" || char === "\b") {
          buffer = buffer.slice(0, -1);
          forwarded += char;
          index += 1;
          continue;
        }
        if (char === "\u0003" || char === "\u0015") {
          buffer = "";
          forwarded += char;
          index += 1;
          continue;
        }
        if (char === "\u0017") {
          buffer = buffer.replace(/\s*\S+\s*$/, "");
          forwarded += char;
          index += 1;
          continue;
        }
        if (char === "\t") {
          buffer += " ";
          forwarded += char;
          index += 1;
          continue;
        }
        const code = char.charCodeAt(0);
        if (code >= 0x20 && code !== 0x7f) {
          buffer += char;
        }
        forwarded += char;
        index += 1;
      }
      commandInputBufferRef.current.set(tabId, buffer.slice(0, 4000));
      if (forwarded) {
        await terminalApi.write(tabId, forwarded);
      }
    },
    [queueCommandHistoryCapture, requestDangerousCommandApprovalForWrite, terminalApi]
  );

  // Keep actions declarative so future right-click items can be appended here.
  const contextActions = useMemo<TerminalContextAction[]>(
    () => [
      {
        id: "copy",
        label: "Copy",
        run: (tabId: string) => {
          void copySelectionOrSendInterrupt(false, tabId);
        },
        isDisabled: (tabId: string) => !hasTerminalSelection(tabId)
      },
      {
        id: "cut",
        label: "Cut",
        run: (tabId: string) => {
          void copySelectionOrSendInterrupt(false, tabId);
        },
        isDisabled: (tabId: string) => !hasTerminalSelection(tabId)
      },
      {
        id: "paste",
        label: "Paste",
        run: (tabId: string) => {
          void pasteClipboardToTerminal(tabId);
        },
        isDisabled: (tabId: string) => !terminalRefs.current.has(tabId)
      },
      {
        id: "select-all",
        label: "Select All",
        run: (tabId: string) => {
          selectAllTerminal(tabId);
        },
        isDisabled: (tabId: string) => !terminalRefs.current.has(tabId)
      },
      {
        id: "search",
        label: "Find...",
        run: (tabId: string) => {
          searchInTerminal(tabId);
        },
        isDisabled: (tabId: string) => !terminalRefs.current.has(tabId)
      },
      {
        id: "command-history",
        label: "Command History...",
        run: (tabId: string) => {
          openCommandHistory(tabId);
        }
      },
      {
        id: "interrupt",
        label: "Interrupt (Ctrl+C)",
        run: (tabId: string) => {
          interruptTerminal(tabId);
        },
        isDisabled: (tabId: string) => !terminalRefs.current.has(tabId)
      },
      {
        id: "reconnect",
        label: "Reconnect",
        run: (tabId: string) => {
          reconnectTabNow(tabId);
        },
        isDisabled: (tabId: string) =>
          !tabsByIdRef.current.has(tabId) ||
          !terminalRefs.current.has(tabId) ||
          tabStatusesRef.current[tabId]?.status === "connecting"
      },
      {
        id: "clear",
        label: "Clear",
        run: (tabId: string) => {
          const instance = terminalRefs.current.get(tabId);
          if (!instance) {
            return;
          }
          instance.terminal.clear();
          instance.terminal.focus();
        },
        isDisabled: (tabId: string) => !terminalRefs.current.has(tabId)
      }
    ],
    [
      copySelectionOrSendInterrupt,
      hasTerminalSelection,
      interruptTerminal,
      openCommandHistory,
      pasteClipboardToTerminal,
      reconnectTabNow,
      searchInTerminal,
      selectAllTerminal
    ]
  );

  const tabContextActions = useMemo<TabContextAction[]>(
    () => [
      {
        id: "tab-close",
        label: "Close Tab",
        run: (tabId: string) => {
          onCloseTab(tabId);
        },
        isDisabled: (tabId: string) => !tabsByIdRef.current.has(tabId)
      },
      {
        id: "tab-close-left",
        label: "Close Tabs to Left",
        run: (tabId: string) => {
          onCloseTabsLeft(tabId);
        },
        isDisabled: (tabId: string) => {
          const index = tabs.findIndex((tab) => tab.id === tabId);
          return index <= 0;
        }
      },
      {
        id: "tab-close-right",
        label: "Close Tabs to Right",
        run: (tabId: string) => {
          onCloseTabsRight(tabId);
        },
        isDisabled: (tabId: string) => {
          const index = tabs.findIndex((tab) => tab.id === tabId);
          return index < 0 || index >= tabs.length - 1;
        }
      },
      {
        id: "tab-close-others",
        label: "Close Other Tabs",
        run: (tabId: string) => {
          onCloseOtherTabs(tabId);
        },
        isDisabled: () => tabs.length <= 1
      },
      {
        id: "tab-close-all",
        label: "Close All Tabs",
        run: () => {
          onCloseAllTabs();
        },
        isDisabled: () => tabs.length === 0
      }
    ],
    [
      onCloseAllTabs,
      onCloseOtherTabs,
      onCloseTab,
      onCloseTabsLeft,
      onCloseTabsRight,
      tabs
    ]
  );

  useEffect(() => {
    if (connectionPreferences.autoReconnect) {
      return;
    }
    for (const timer of reconnectTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
    reconnectTimersRef.current.clear();
    reconnectAttemptsRef.current.clear();
  }, [connectionPreferences.autoReconnect]);

  useEffect(() => {
    if (!terminalApi) {
      onError("Terminal bridge is not ready. Restart `pnpm dev`.");
      return;
    }

    const stopListening = terminalApi.onEvent((event) => {
      const instance = terminalRefs.current.get(event.tabId);
      if (!instance) {
        return;
      }

      if (event.type === "output") {
        instance.terminal.write(event.data);
        return;
      }

      if (event.type === "status") {
        setTabStatus(event.tabId, { status: event.status });
        if (event.status === "closed") {
          instance.terminal.writeln("\r\n[session closed]");
          scheduleReconnect(event.tabId);
          return;
        }
        if (event.status === "connected") {
          clearReconnectState(event.tabId);
        }
        return;
      }

      setTabStatus(event.tabId, { status: "error", message: event.message });
      instance.terminal.writeln(`\r\n[error] ${event.message}`);
      onError(event.message);
      scheduleReconnect(event.tabId);
    });

    return () => {
      stopListening();
    };
  }, [clearReconnectState, onError, scheduleReconnect, setTabStatus, terminalApi]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) {
        return;
      }
      closeContextMenu();
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    };

    const onWindowResize = () => {
      closeContextMenu();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onEscape);
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("scroll", onWindowResize, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("scroll", onWindowResize, true);
    };
  }, [closeContextMenu, contextMenu]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    if (!tabsById.has(contextMenu.tabId)) {
      closeContextMenu();
    }
  }, [closeContextMenu, contextMenu, tabsById]);

  useEffect(() => {
    if (!tabContextMenu) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (tabMenuRef.current?.contains(target)) {
        return;
      }
      closeTabContextMenu();
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeTabContextMenu();
      }
    };

    const onWindowResize = () => {
      closeTabContextMenu();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onEscape);
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("scroll", onWindowResize, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("scroll", onWindowResize, true);
    };
  }, [closeTabContextMenu, tabContextMenu]);

  useEffect(() => {
    if (!tabContextMenu) {
      return;
    }
    if (!tabsById.has(tabContextMenu.tabId)) {
      closeTabContextMenu();
    }
  }, [closeTabContextMenu, tabContextMenu, tabsById]);

  useEffect(() => {
    if (!isSearchDialogOpen) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const input = searchDialogInputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      input.select();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isSearchDialogOpen]);

  useEffect(() => {
    if (!isSearchDialogOpen) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      closeSearchDialog();
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [closeSearchDialog, isSearchDialogOpen]);

  useEffect(() => {
    if (!isSearchDialogOpen) {
      return;
    }
    if (!searchDialogTabId || !tabsById.has(searchDialogTabId)) {
      closeSearchDialog();
    }
  }, [closeSearchDialog, isSearchDialogOpen, searchDialogTabId, tabsById]);

  useEffect(() => {
    if (!isCommandHistoryOpen) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const input = commandHistoryInputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      input.select();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isCommandHistoryOpen]);

  useEffect(() => {
    if (!isCommandHistoryOpen) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      closeCommandHistory();
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [closeCommandHistory, isCommandHistoryOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!activeTabId) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      const copyBinding = hotkeyPreferences.terminalCopy;
      const pasteBinding = hotkeyPreferences.terminalPaste;
      const searchBinding = hotkeyPreferences.terminalSearch;
      const copyMatches = matchesHotkeyBinding(event, copyBinding);
      const pasteMatches = matchesHotkeyBinding(event, pasteBinding);
      const searchMatches = matchesHotkeyBinding(event, searchBinding);
      const commandHistoryMatches = matchesCommandHistoryHotkey(event);
      if (!copyMatches && !pasteMatches && !searchMatches && !commandHistoryMatches) {
        return;
      }

      const targetNode = event.target instanceof Node ? event.target : null;
      const isTerminalFocused = targetNode
        ? (stageRef.current?.contains(targetNode) ?? false)
        : false;
      const activeElementNode = document.activeElement instanceof Node ? document.activeElement : null;
      const isTerminalActiveElement = activeElementNode
        ? (stageRef.current?.contains(activeElementNode) ?? false)
        : false;
      const bodyFocused = document.activeElement === document.body;
      const altShortcutTriggered =
        (copyMatches && usesAltModifier(copyBinding)) ||
        (pasteMatches && usesAltModifier(pasteBinding)) ||
        (searchMatches && usesAltModifier(searchBinding));
      const treatAsTerminalFocused =
        isTerminalFocused ||
        isTerminalActiveElement ||
        (bodyFocused && altShortcutTriggered);
      const activeSelection = getActiveInstance()?.terminal.getSelection() ?? "";
      const canCopySelection = copyMatches && activeSelection.length > 0;
      if (!treatAsTerminalFocused && !canCopySelection) {
        return;
      }

      if (copyMatches) {
        event.preventDefault();
        void copySelectionOrSendInterrupt(shouldSendInterruptOnCopyHotkey(copyBinding));
        return;
      }
      if (pasteMatches) {
        event.preventDefault();
        void pasteClipboardToTerminal();
        return;
      }
      if (searchMatches) {
        event.preventDefault();
        searchInTerminal();
        return;
      }
      if (commandHistoryMatches) {
        event.preventDefault();
        openCommandHistory();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [
    activeTabId,
    copySelectionOrSendInterrupt,
    getActiveInstance,
    hotkeyPreferences,
    openCommandHistory,
    pasteClipboardToTerminal,
    searchInTerminal
  ]);

  useEffect(() => {
    if (!terminalApi) {
      return;
    }

    const openTabIds = new Set(tabs.map((tab) => tab.id));

    for (const [tabId, instance] of terminalRefs.current.entries()) {
      if (openTabIds.has(tabId)) {
        continue;
      }
      clearReconnectState(tabId);
      clearDeferredFitTimers(tabId);
      clearPendingCommandCapture(tabId);
      instance.removeWheelListener();
      instance.dataDisposable.dispose();
      instance.terminal.dispose();
      terminalRefs.current.delete(tabId);
      containerRefs.current.delete(tabId);
      searchStateRef.current.delete(tabId);
      commandInputBufferRef.current.delete(tabId);
      void terminalApi.close(tabId);
      setTabStatuses((prev) => {
        if (!(tabId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[tabId];
        return next;
      });
    }

    for (const tab of tabs) {
      if (terminalRefs.current.has(tab.id)) {
        continue;
      }
      const container = containerRefs.current.get(tab.id);
      if (!container) {
        continue;
      }

      const terminal = new Terminal({
        convertEol: true,
        cursorBlink: true,
        scrollback: 5000,
        fontSize: 13,
        lineHeight: 1.25,
        fontFamily:
          'Menlo, Monaco, Consolas, "SF Mono", "Cascadia Mono", "Courier New", monospace',
        theme: {
          background: "#070d14",
          foreground: "#d6e2ef",
          cursor: "#8fc9ff",
          selectionBackground: "#244e7f"
        }
      });
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(container);
      fitAddon.fit();

      const dataDisposable = terminal.onData((data) => {
        enqueueTerminalWriteTask(tab.id, async () => {
          await sendTerminalInput(tab.id, data);
        });
      });
      let wheelLineRemainder = 0;
      const onWheel = (event: WheelEvent) => {
        if (event.ctrlKey || event.altKey || event.metaKey) {
          return;
        }
        if (terminal.buffer.active.type !== "alternate") {
          return;
        }
        if (terminal.modes.mouseTrackingMode !== "none") {
          // Prevent xterm from emitting raw mouse wheel reports that can appear
          // as garbage text in some full-screen editor states.
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        const legacyWheelDelta = (event as WheelEvent & { wheelDelta?: number }).wheelDelta;
        const rawDeltaY = event.deltaY !== 0 ? event.deltaY : -(legacyWheelDelta ?? 0);
        const deltaLinesRaw =
          event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? rawDeltaY
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
              ? rawDeltaY * Math.max(terminal.rows, 1)
              : rawDeltaY / WHEEL_PIXELS_PER_LINE;
        if (!Number.isFinite(deltaLinesRaw) || deltaLinesRaw === 0) {
          return;
        }

        wheelLineRemainder += deltaLinesRaw;
        const wholeLines =
          wheelLineRemainder > 0
            ? Math.floor(wheelLineRemainder)
            : Math.ceil(wheelLineRemainder);
        if (wholeLines === 0) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        wheelLineRemainder -= wholeLines;

        const stepCount = Math.min(MAX_WHEEL_NAV_LINES, Math.abs(wholeLines));
        const upSequence = terminal.modes.applicationCursorKeysMode ? "\u001bOA" : "\u001b[A";
        const downSequence = terminal.modes.applicationCursorKeysMode ? "\u001bOB" : "\u001b[B";
        const sequence = wholeLines > 0 ? downSequence : upSequence;
        void terminalApi.write(tab.id, sequence.repeat(stepCount));
        event.preventDefault();
        event.stopPropagation();
      };
      const wheelTargets = new Set<HTMLElement>();
      const registerWheelTarget = (target: HTMLElement | null | undefined) => {
        if (!target || wheelTargets.has(target)) {
          return;
        }
        target.addEventListener("wheel", onWheel, { capture: WHEEL_CAPTURE, passive: false });
        wheelTargets.add(target);
      };
      registerWheelTarget(container);
      registerWheelTarget(terminal.element);

      terminalRefs.current.set(tab.id, {
        terminal,
        fitAddon,
        dataDisposable,
        removeWheelListener: () => {
          for (const target of wheelTargets) {
            target.removeEventListener("wheel", onWheel, WHEEL_CAPTURE);
          }
          wheelTargets.clear();
        }
      });

      if (tab.id === activeTabId) {
        terminal.focus();
      }

      setTabStatus(tab.id, { status: "connecting" });
      terminal.writeln(`Connecting to ${tab.title}...`);
      scheduleDeferredFit(tab.id);
      void connectTab(tab);
    }
  }, [
    activeTabId,
    clearDeferredFitTimers,
    clearReconnectState,
    connectTab,
    enqueueTerminalWriteTask,
    scheduleDeferredFit,
    sendTerminalInput,
    setTabStatus,
    tabs,
    terminalApi
  ]);

  useEffect(() => {
    if (!activeTabId) {
      return;
    }

    fitTerminal(activeTabId);
    scheduleDeferredFit(activeTabId);
    const timeout = setTimeout(() => {
      focusTerminal(activeTabId);
    }, 0);

    return () => {
      clearTimeout(timeout);
    };
  }, [activeTabId, fitTerminal, focusTerminal, scheduleDeferredFit]);

  useEffect(() => {
    if (!activeTabId || !stageRef.current) {
      return;
    }

    const observer = new ResizeObserver(() => {
      fitTerminal(activeTabId);
    });
    observer.observe(stageRef.current);

    return () => {
      observer.disconnect();
    };
  }, [activeTabId, fitTerminal]);

  useEffect(() => {
    return () => {
      for (const [tabId, instance] of terminalRefs.current.entries()) {
        clearReconnectState(tabId);
        clearDeferredFitTimers(tabId);
        clearPendingCommandCapture(tabId);
        instance.removeWheelListener();
        instance.dataDisposable.dispose();
        instance.terminal.dispose();
        searchStateRef.current.delete(tabId);
        if (terminalApi) {
          void terminalApi.close(tabId);
        }
      }
      terminalRefs.current.clear();
      containerRefs.current.clear();
      searchStateRef.current.clear();
      commandInputBufferRef.current.clear();
      reconnectAttemptsRef.current.clear();
      reconnectTimersRef.current.clear();
      deferredFitTimersRef.current.clear();
      pendingCommandCaptureTimersRef.current.clear();
      pendingTerminalWriteQueueRef.current.clear();
    };
  }, [clearDeferredFitTimers, clearPendingCommandCapture, clearReconnectState, terminalApi]);

  return (
    <>
      <div className="terminal-tabs">
        {tabs.length === 0 ? (
          <div className="hint">No terminal tab. Use "Open" from session list.</div>
        ) : null}
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTabId === tab.id ? "tab is-active" : "tab"}
            data-tab-id={tab.id}
            onClick={() => onSelectTab(tab.id)}
            onContextMenu={(event) => openTabContextMenu(event, tab.id)}
            onMouseDown={(event) => {
              if (event.button !== 1) {
                return;
              }
              event.preventDefault();
              onCloseTab(tab.id);
            }}
            type="button"
          >
            <span>{tab.title}</span>
            <span
              className="tab__close"
              onClick={(event) => {
                event.stopPropagation();
                onCloseTab(tab.id);
              }}
            >
              <X aria-hidden="true" className="ui-icon tab__close-icon" strokeWidth={2} />
            </span>
          </button>
        ))}
        <div className="terminal-tabs__actions">
          <button
            className="icon-button terminal-tabs__action"
            onClick={() => openCommandHistory()}
            title="Command History (Ctrl+Shift+H)"
            type="button"
          >
            <History aria-hidden="true" className="ui-icon" strokeWidth={2} />
          </button>
        </div>
      </div>
      {tabContextMenu ? (
        <div
          className="terminal-context-menu"
          ref={tabMenuRef}
          style={{
            left: `${Math.max(8, Math.min(tabContextMenu.x, window.innerWidth - 236))}px`,
            top: `${Math.max(
              8,
              Math.min(tabContextMenu.y, window.innerHeight - (tabContextActions.length * 26 + 16))
            )}px`
          }}
        >
          {tabContextActions.map((action) => {
            const disabled = action.isDisabled?.(tabContextMenu.tabId) ?? false;
            return (
              <button
                className="terminal-context-menu__item"
                disabled={disabled}
                key={action.id}
                onClick={() => runTabContextAction(action, tabContextMenu.tabId)}
                type="button"
              >
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="terminal-stage" ref={stageRef}>
        {tabs.length === 0 ? (
          <p className="hint terminal-empty">
            Terminal workspace ready. Open a session tab to start.
          </p>
        ) : null}
        {tabs.map((tab) => {
          const state = tabStatuses[tab.id];
          return (
            <div
              key={tab.id}
              className={activeTabId === tab.id ? "terminal-pane is-active" : "terminal-pane"}
              data-tab-id={tab.id}
            >
              <div
                className="terminal-pane__canvas"
                onContextMenu={(event) => openContextMenu(event, tab.id)}
                ref={(node) => setContainerRef(tab.id, node)}
              />
              {state ? (
                <div className={`terminal-pane__status is-${state.status}`}>
                  <span>{getStatusText(state, tabsById.get(tab.id)?.title ?? tab.title)}</span>
                  {(state.status === "closed" || state.status === "error") ? (
                    <button
                      className="terminal-pane__status-action"
                      onClick={() => reconnectTabNow(tab.id)}
                      type="button"
                    >
                      Reconnect
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {contextMenu ? (
          <div
            className="terminal-context-menu"
            ref={menuRef}
            style={{
              left: `${Math.max(8, Math.min(contextMenu.x, window.innerWidth - 236))}px`,
              top: `${Math.max(
                8,
                Math.min(contextMenu.y, window.innerHeight - (contextActions.length * 26 + 16))
              )}px`
            }}
          >
            {contextActions.map((action) => {
              const disabled = action.isDisabled?.(contextMenu.tabId) ?? false;
              return (
                <button
                  className="terminal-context-menu__item"
                  disabled={disabled}
                  key={action.id}
                  onClick={() => runContextAction(action, contextMenu.tabId)}
                  type="button"
                >
                  {action.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {isCommandHistoryOpen ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCommandHistory();
            }
          }}
          role="presentation"
        >
          <div
            className="modal app-dialog terminal-history-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Command History"
          >
            <div className="modal__header">
              <h3>Command History</h3>
            </div>
            <p className="app-dialog__message">
              Recorded commands captured when pressing Enter in terminal tabs.
            </p>
            <div className="terminal-history-dialog__filters">
              <label>
                Scope
                <select
                  onChange={(event) => setCommandHistoryScope(event.target.value as CommandHistoryScope)}
                  value={commandHistoryScope}
                >
                  <option value="activeTab">Active Tab</option>
                  <option value="allTabs">All Tabs</option>
                </select>
              </label>
              <label>
                Search
                <input
                  onChange={(event) => setCommandHistoryQuery(event.target.value)}
                  placeholder="Filter by command or tab"
                  ref={commandHistoryInputRef}
                  value={commandHistoryQuery}
                />
              </label>
            </div>
            <p className="hint">
              Showing {visibleCommandHistoryEntries.length} of {commandHistoryEntries.length} command(s).
            </p>
            <div className="terminal-history-dialog__list-shell">
              {visibleCommandHistoryEntries.length === 0 ? (
                <p className="hint terminal-history-dialog__empty">No command history entries.</p>
              ) : (
                <ul className="terminal-history-dialog__list">
                  {visibleCommandHistoryEntries.map((entry) => (
                    <li
                      className="terminal-history-dialog__item"
                      key={entry.id}
                      title={`${entry.command}\n\nSource: ${getTerminalCommandHistorySourceLabel(entry.source)}`}
                    >
                      <p className="terminal-history-dialog__command">
                        <code>{entry.command}</code>
                      </p>
                      <p className="hint terminal-history-dialog__meta">
                        {entry.tabTitle} | {formatCommandHistoryTimestamp(entry.executedAt)} |{" "}
                        {getTerminalCommandHistorySourceLabel(entry.source)}
                      </p>
                      <div className="terminal-history-dialog__actions">
                        <button
                          className="secondary-button secondary-button--small"
                          onClick={() => runCommandHistoryEntry(entry)}
                          type="button"
                        >
                          Run
                        </button>
                        <button
                          className="secondary-button secondary-button--small"
                          onClick={() => {
                            void copyCommandHistoryEntry(entry);
                          }}
                          type="button"
                        >
                          Copy
                        </button>
                        <button
                          className="secondary-button secondary-button--small"
                          onClick={() => removeCommandHistoryEntry(entry.id)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="modal__actions">
              <button
                className="secondary-button"
                disabled={visibleCommandHistoryEntries.length === 0}
                onClick={clearVisibleCommandHistory}
                type="button"
              >
                Clear Visible
              </button>
              <button
                className="secondary-button"
                disabled={commandHistoryEntries.length === 0}
                onClick={clearAllCommandHistory}
                type="button"
              >
                Clear All
              </button>
              <button className="primary-button" onClick={closeCommandHistory} type="button">
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isSearchDialogOpen ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeSearchDialog();
            }
          }}
          role="presentation"
        >
          <div
            className="modal modal--compact app-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Find in Terminal"
          >
            <div className="modal__header">
              <h3>Find in Terminal</h3>
            </div>
            <p className="app-dialog__message">Enter text to search in the current terminal tab.</p>
            <form className="app-dialog" onSubmit={submitSearchDialog}>
              <input
                className="app-dialog__input"
                onChange={(event) => setSearchDialogQuery(event.target.value)}
                ref={searchDialogInputRef}
                value={searchDialogQuery}
              />
              <div className="modal__actions">
                <button className="secondary-button" onClick={closeSearchDialog} type="button">
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Find
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function getStatusText(state: TabUiStatus, title: string): string {
  if (state.status === "connected") {
    return `${title}: connected`;
  }
  if (state.status === "connecting") {
    return `${title}: connecting...`;
  }
  if (state.status === "closed") {
    return `${title}: closed`;
  }
  return `${title}: ${state.message ?? "error"}`;
}

function formatCommandHistoryTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "-";
  }
  const value = new Date(timestamp);
  if (!Number.isFinite(value.getTime())) {
    return "-";
  }
  return value.toLocaleString();
}

function shouldSendInterruptOnCopyHotkey(binding: HotkeyBindingPreference): boolean {
  return binding.modifier === "primary" && normalizeHotkeyKey(binding.key) === "c";
}

function usesAltModifier(binding: HotkeyBindingPreference): boolean {
  return binding.modifier === "alt" || binding.modifier === "altShift";
}

function matchesCommandHistoryHotkey(event: KeyboardEvent): boolean {
  const normalizedEventKey = normalizeEventHotkeyKey(event);
  if (normalizedEventKey !== "h") {
    return false;
  }
  if (!hasPrimaryShortcutModifier(event) || !event.shiftKey || event.altKey) {
    return false;
  }
  const isMac = /mac/i.test(navigator.platform);
  if (isMac ? event.ctrlKey : event.metaKey) {
    return false;
  }
  return true;
}

function hasPrimaryShortcutModifier(event: KeyboardEvent): boolean {
  const isMac = /mac/i.test(navigator.platform);
  return isMac ? event.metaKey : event.ctrlKey;
}

function matchesHotkeyBinding(event: KeyboardEvent, binding: HotkeyBindingPreference): boolean {
  if (!binding.enabled) {
    return false;
  }

  const normalizedEventKey = normalizeEventHotkeyKey(event);
  if (!normalizedEventKey) {
    return false;
  }
  if (normalizedEventKey !== normalizeHotkeyKey(binding.key)) {
    return false;
  }

  const requiresPrimary = binding.modifier === "primary" || binding.modifier === "primaryShift";
  const requiresAlt = binding.modifier === "alt" || binding.modifier === "altShift";
  const requiresShift = binding.modifier === "primaryShift" || binding.modifier === "altShift";
  const isMac = /mac/i.test(navigator.platform);
  const primaryPressed = hasPrimaryShortcutModifier(event);
  if (primaryPressed !== requiresPrimary) {
    return false;
  }
  if (event.altKey !== requiresAlt) {
    return false;
  }
  if (event.shiftKey !== requiresShift) {
    return false;
  }

  // Disallow extra platform modifier beyond the configured "primary" key.
  if (isMac ? event.ctrlKey : event.metaKey) {
    return false;
  }

  return true;
}

function normalizeHotkeyKey(value: string): string {
  const normalized = value.trim();
  if (normalized.length !== 1) {
    return "";
  }
  return normalized.toLowerCase();
}

function normalizeEventHotkeyKey(event: KeyboardEvent): string {
  const code = event.code.trim();
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3).toLowerCase();
  }
  return normalizeHotkeyKey(event.key);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.classList.contains("xterm-helper-textarea")) {
    return false;
  }
  const tagName = target.tagName;
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    target.isContentEditable
  );
}

function findTerminalMatch(
  terminal: Terminal,
  query: string,
  from?: { row: number; column: number }
): { row: number; column: number } | null {
  const normalizedQuery = query.toLowerCase();
  const buffer = terminal.buffer.active;
  const totalRows = buffer.length;
  if (totalRows <= 0) {
    return null;
  }

  const startRow = clamp(from?.row ?? 0, 0, totalRows - 1);
  const startColumn = Math.max(0, from?.column ?? 0);

  const directMatch = scanBufferForMatch(
    buffer,
    normalizedQuery,
    startRow,
    totalRows - 1,
    startColumn
  );
  if (directMatch) {
    return directMatch;
  }

  if (startRow === 0) {
    return null;
  }
  return scanBufferForMatch(buffer, normalizedQuery, 0, startRow - 1, 0);
}

function scanBufferForMatch(
  buffer: Terminal["buffer"]["active"],
  normalizedQuery: string,
  rowFrom: number,
  rowTo: number,
  startColumnOnFirstRow: number
): { row: number; column: number } | null {
  for (let row = rowFrom; row <= rowTo; row += 1) {
    const line = buffer.getLine(row);
    const text = line?.translateToString(true).toLowerCase() ?? "";
    const startColumn = row === rowFrom ? startColumnOnFirstRow : 0;
    const column = text.indexOf(normalizedQuery, startColumn);
    if (column >= 0) {
      return { row, column };
    }
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

