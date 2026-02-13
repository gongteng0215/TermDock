import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "xterm";
import type { IDisposable } from "xterm";

import type { TerminalConnectionStatus } from "../../shared/terminal";

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

export interface HotkeyPreferences {
  openSessionTab: boolean;
  closeActiveTab: boolean;
  terminalCopy: boolean;
  terminalPaste: boolean;
  terminalSearch: boolean;
}

interface TerminalWorkspaceProps {
  tabs: TerminalTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onError: (message: string) => void;
  terminalApi: Window["termdock"]["terminal"] | null;
  connectionPreferences: ConnectionPreferences;
  hotkeyPreferences: HotkeyPreferences;
}

interface TerminalInstance {
  terminal: Terminal;
  fitAddon: FitAddon;
  dataDisposable: IDisposable;
}

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

interface TerminalSearchState {
  query: string;
  row: number;
  column: number;
}

export function TerminalWorkspace({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onError,
  terminalApi,
  connectionPreferences,
  hotkeyPreferences
}: TerminalWorkspaceProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const containerRefs = useRef(new Map<string, HTMLDivElement>());
  const terminalRefs = useRef(new Map<string, TerminalInstance>());
  const searchStateRef = useRef(new Map<string, TerminalSearchState>());
  const reconnectAttemptsRef = useRef(new Map<string, number>());
  const reconnectTimersRef = useRef(new Map<string, number>());
  const tabsByIdRef = useRef(new Map<string, TerminalTab>());
  const [tabStatuses, setTabStatuses] = useState<Record<string, TabUiStatus>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const tabsById = useMemo(() => {
    return new Map(tabs.map((tab) => [tab.id, tab]));
  }, [tabs]);

  useEffect(() => {
    tabsByIdRef.current = tabsById;
  }, [tabsById]);

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

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Keep actions declarative so future right-click items can be appended here.
  const contextActions = useMemo<TerminalContextAction[]>(
    () => [
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
    []
  );

  const openContextMenu = useCallback(
    (event: MouseEvent, tabId: string) => {
      event.preventDefault();
      onSelectTab(tabId);
      setContextMenu({
        tabId,
        x: event.clientX,
        y: event.clientY
      });
    },
    [onSelectTab]
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
        })
        .catch((error: Error) => {
          const message = error.message || "Failed to connect.";
          setTabStatus(tab.id, { status: "error", message });
          instance.terminal.writeln(`\r\n[error] ${message}`);
          onError(message);
        });
    },
    [clearReconnectState, fitTerminal, onError, setTabStatus, terminalApi]
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

  const copySelectionOrSendInterrupt = useCallback(async () => {
    if (!activeTabId || !terminalApi) {
      return;
    }
    const instance = getActiveInstance();
    if (!instance) {
      return;
    }

    const selection = instance.terminal.getSelection();
    if (selection) {
      try {
        if (navigator.clipboard?.writeText) {
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

    void terminalApi.write(activeTabId, "\u0003");
  }, [activeTabId, getActiveInstance, onError, terminalApi]);

  const pasteClipboardToTerminal = useCallback(async () => {
    if (!activeTabId || !terminalApi) {
      return;
    }
    const instance = getActiveInstance();
    if (!instance) {
      return;
    }

    try {
      if (!navigator.clipboard?.readText) {
        throw new Error("Clipboard API unavailable.");
      }
      const text = await navigator.clipboard.readText();
      if (!text) {
        return;
      }
      void terminalApi.write(activeTabId, text);
      instance.terminal.focus();
    } catch {
      onError("Paste failed. Clipboard permission may be blocked.");
    }
  }, [activeTabId, getActiveInstance, onError, terminalApi]);

  const searchInTerminal = useCallback(() => {
    if (!activeTabId) {
      return;
    }
    const instance = getActiveInstance();
    if (!instance) {
      return;
    }

    const previous = searchStateRef.current.get(activeTabId);
    const rawQuery = window.prompt("Find in terminal", previous?.query ?? "");
    if (!rawQuery) {
      return;
    }
    const query = rawQuery.trim();
    if (!query) {
      return;
    }

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
    searchStateRef.current.set(activeTabId, {
      query,
      row: match.row,
      column: match.column
    });
  }, [activeTabId, getActiveInstance, onError]);

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
    const onKeyDown = (event: KeyboardEvent) => {
      if (!activeTabId) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      if (!hasPrimaryShortcutModifier(event) || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
      const targetNode = event.target instanceof Node ? event.target : null;
      const isTerminalFocused = targetNode
        ? (stageRef.current?.contains(targetNode) ?? false)
        : false;
      const activeSelection = getActiveInstance()?.terminal.getSelection() ?? "";
      const canCopySelection = key === "c" && activeSelection.length > 0;
      if (!isTerminalFocused && !canCopySelection) {
        return;
      }

      if (key === "c") {
        if (!hotkeyPreferences.terminalCopy) {
          return;
        }
        event.preventDefault();
        void copySelectionOrSendInterrupt();
        return;
      }
      if (key === "v") {
        if (!hotkeyPreferences.terminalPaste) {
          return;
        }
        event.preventDefault();
        void pasteClipboardToTerminal();
        return;
      }
      if (key === "f") {
        if (!hotkeyPreferences.terminalSearch) {
          return;
        }
        event.preventDefault();
        searchInTerminal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    activeTabId,
    copySelectionOrSendInterrupt,
    getActiveInstance,
    hotkeyPreferences,
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
      instance.dataDisposable.dispose();
      instance.terminal.dispose();
      terminalRefs.current.delete(tabId);
      containerRefs.current.delete(tabId);
      searchStateRef.current.delete(tabId);
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
        void terminalApi.write(tab.id, data);
      });

      terminalRefs.current.set(tab.id, {
        terminal,
        fitAddon,
        dataDisposable
      });

      setTabStatus(tab.id, { status: "connecting" });
      terminal.writeln(`Connecting to ${tab.title}...`);
      void connectTab(tab);
    }
  }, [clearReconnectState, connectTab, setTabStatus, tabs, terminalApi]);

  useEffect(() => {
    if (!activeTabId) {
      return;
    }

    const timeout = setTimeout(() => {
      fitTerminal(activeTabId);
    }, 0);

    return () => {
      clearTimeout(timeout);
    };
  }, [activeTabId, fitTerminal]);

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
      reconnectAttemptsRef.current.clear();
      reconnectTimersRef.current.clear();
    };
  }, [clearReconnectState, terminalApi]);

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
            onClick={() => onSelectTab(tab.id)}
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
              ×
            </span>
          </button>
        ))}
      </div>
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
            >
              <div
                className="terminal-pane__canvas"
                onContextMenu={(event) => openContextMenu(event, tab.id)}
                ref={(node) => setContainerRef(tab.id, node)}
              />
              {state ? (
                <div className={`terminal-pane__status is-${state.status}`}>
                  {getStatusText(state, tabsById.get(tab.id)?.title ?? tab.title)}
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
              left: `${Math.max(8, Math.min(contextMenu.x, window.innerWidth - 180))}px`,
              top: `${Math.max(8, Math.min(contextMenu.y, window.innerHeight - 120))}px`
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

function hasPrimaryShortcutModifier(event: KeyboardEvent): boolean {
  const isMac = /mac/i.test(navigator.platform);
  return isMac ? event.metaKey : event.ctrlKey;
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
