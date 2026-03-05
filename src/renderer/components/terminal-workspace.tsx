import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { X } from "lucide-react";

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
  hotkeyPreferences
}: TerminalWorkspaceProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const tabMenuRef = useRef<HTMLDivElement | null>(null);
  const searchDialogInputRef = useRef<HTMLInputElement | null>(null);
  const containerRefs = useRef(new Map<string, HTMLDivElement>());
  const terminalRefs = useRef(new Map<string, TerminalInstance>());
  const searchStateRef = useRef(new Map<string, TerminalSearchState>());
  const reconnectAttemptsRef = useRef(new Map<string, number>());
  const reconnectTimersRef = useRef(new Map<string, number>());
  const tabsByIdRef = useRef(new Map<string, TerminalTab>());
  const tabStatusesRef = useRef<Record<string, TabUiStatus>>({});
  const [tabStatuses, setTabStatuses] = useState<Record<string, TabUiStatus>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [tabContextMenu, setTabContextMenu] = useState<ContextMenuState | null>(null);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [searchDialogTabId, setSearchDialogTabId] = useState<string | null>(null);
  const [searchDialogQuery, setSearchDialogQuery] = useState("");

  const tabsById = useMemo(() => {
    return new Map(tabs.map((tab) => [tab.id, tab]));
  }, [tabs]);

  useEffect(() => {
    tabsByIdRef.current = tabsById;
  }, [tabsById]);
  useEffect(() => {
    tabStatusesRef.current = tabStatuses;
  }, [tabStatuses]);

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
      void terminalApi.write(tabId, text);
      instance.terminal.focus();
    } catch {
      onError("Paste failed. Clipboard permission may be blocked.");
    }
  }, [activeTabId, onError, systemApi, terminalApi]);

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
      if (!copyMatches && !pasteMatches && !searchMatches) {
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
      instance.removeWheelListener();
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
      let wheelLineRemainder = 0;
      const onWheel = (event: WheelEvent) => {
        if (event.ctrlKey || event.altKey || event.metaKey) {
          return;
        }
        if (terminal.buffer.active.type !== "alternate") {
          return;
        }
        if (terminal.modes.mouseTrackingMode !== "none") {
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
      void connectTab(tab);
    }
  }, [activeTabId, clearReconnectState, connectTab, setTabStatus, tabs, terminalApi]);

  useEffect(() => {
    if (!activeTabId) {
      return;
    }

    const timeout = setTimeout(() => {
      fitTerminal(activeTabId);
      focusTerminal(activeTabId);
    }, 0);

    return () => {
      clearTimeout(timeout);
    };
  }, [activeTabId, fitTerminal, focusTerminal]);

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

function shouldSendInterruptOnCopyHotkey(binding: HotkeyBindingPreference): boolean {
  return binding.modifier === "primary" && normalizeHotkeyKey(binding.key) === "c";
}

function usesAltModifier(binding: HotkeyBindingPreference): boolean {
  return binding.modifier === "alt" || binding.modifier === "altShift";
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

