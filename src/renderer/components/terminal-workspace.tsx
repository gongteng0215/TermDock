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

interface TerminalWorkspaceProps {
  tabs: TerminalTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onError: (message: string) => void;
  terminalApi: Window["termdock"]["terminal"] | null;
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

export function TerminalWorkspace({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onError,
  terminalApi
}: TerminalWorkspaceProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const containerRefs = useRef(new Map<string, HTMLDivElement>());
  const terminalRefs = useRef(new Map<string, TerminalInstance>());
  const [tabStatuses, setTabStatuses] = useState<Record<string, TabUiStatus>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const tabsById = useMemo(() => {
    return new Map(tabs.map((tab) => [tab.id, tab]));
  }, [tabs]);

  const setTabStatus = useCallback((tabId: string, status: TabUiStatus) => {
    setTabStatuses((prev) => ({ ...prev, [tabId]: status }));
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
        }
        return;
      }

      setTabStatus(event.tabId, { status: "error", message: event.message });
      instance.terminal.writeln(`\r\n[error] ${event.message}`);
      onError(event.message);
    });

    return () => {
      stopListening();
    };
  }, [onError, setTabStatus, terminalApi]);

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
    if (!terminalApi) {
      return;
    }

    const openTabIds = new Set(tabs.map((tab) => tab.id));

    for (const [tabId, instance] of terminalRefs.current.entries()) {
      if (openTabIds.has(tabId)) {
        continue;
      }
      instance.dataDisposable.dispose();
      instance.terminal.dispose();
      terminalRefs.current.delete(tabId);
      containerRefs.current.delete(tabId);
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
      void terminalApi
        .connect(tab.id, tab.sessionId)
        .then(() => {
          fitTerminal(tab.id);
        })
        .catch((error: Error) => {
          const message = error.message || "Failed to connect.";
          setTabStatus(tab.id, { status: "error", message });
          terminal.writeln(`\r\n[error] ${message}`);
          onError(message);
        });
    }
  }, [fitTerminal, onError, setTabStatus, tabs, terminalApi]);

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
        instance.dataDisposable.dispose();
        instance.terminal.dispose();
        if (terminalApi) {
          void terminalApi.close(tabId);
        }
      }
      terminalRefs.current.clear();
      containerRefs.current.clear();
    };
  }, [terminalApi]);

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
