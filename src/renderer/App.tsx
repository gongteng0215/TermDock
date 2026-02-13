import { DragEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  SessionCreateInput,
  SessionRecord,
  SessionUpdateInput
} from "../shared/session";
import type {
  SftpDirectoryListResult,
  SftpEntry,
  SftpTransferEvent
} from "../shared/sftp";
import { TerminalWorkspace } from "./components/terminal-workspace";
import type {
  ConnectionPreferences,
  HotkeyPreferences,
  TerminalTab
} from "./components/terminal-workspace";

const EMPTY_FORM: SessionCreateInput = {
  name: "",
  host: "",
  port: 22,
  username: "",
  authType: "password",
  privateKeyPath: "",
  remark: "",
  favorite: false,
  secret: ""
};

const CONNECTION_PREFERENCES_STORAGE_KEY = "termdock.connection-preferences.v1";
const HOTKEY_PREFERENCES_STORAGE_KEY = "termdock.hotkey-preferences.v1";
const DEFAULT_CONNECTION_PREFERENCES: ConnectionPreferences = {
  autoReconnect: true,
  reconnectDelaySeconds: 3
};
const DEFAULT_HOTKEY_PREFERENCES: HotkeyPreferences = {
  openSessionTab: true,
  closeActiveTab: true,
  terminalCopy: true,
  terminalPaste: true,
  terminalSearch: true
};

interface SftpTransferItem extends SftpTransferEvent {
  updatedAt: number;
}

function getSafeTabInstance(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function formatTabTitle(sessionName: string, instance: number): string {
  return instance <= 1 ? sessionName : `${sessionName} (${instance})`;
}

function compareSessionRecency(left: SessionRecord, right: SessionRecord): number {
  const leftRecent = left.lastConnectedAt ?? "";
  const rightRecent = right.lastConnectedAt ?? "";
  if (leftRecent !== rightRecent) {
    return leftRecent < rightRecent ? 1 : -1;
  }
  return left.updatedAt < right.updatedAt ? 1 : left.updatedAt > right.updatedAt ? -1 : 0;
}

function formatSessionLastConnected(isoString?: string): string {
  if (!isoString) {
    return "-";
  }
  const value = new Date(isoString);
  if (!Number.isFinite(value.getTime())) {
    return "-";
  }
  return value.toLocaleString();
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

function hasPrimaryShortcutModifier(event: KeyboardEvent): boolean {
  const isMac = /mac/i.test(navigator.platform);
  return isMac ? event.metaKey : event.ctrlKey;
}

function formatSftpSizeForLs(size: number): string {
  if (!Number.isFinite(size) || size < 0) {
    return "0";
  }
  return `${Math.max(0, Math.trunc(size))}`;
}

function formatSftpLinksForLs(links: number): string {
  if (!Number.isFinite(links) || links <= 0) {
    return "1";
  }
  return `${Math.trunc(links)}`;
}

function formatSftpMtimeForLs(isoString?: string): string {
  if (!isoString) {
    return "-";
  }
  const date = new Date(isoString);
  if (!Number.isFinite(date.getTime())) {
    return "-";
  }
  const now = new Date();
  const month = date.toLocaleString(undefined, { month: "short" });
  const day = String(date.getDate()).padStart(2, " ");
  if (date.getFullYear() === now.getFullYear()) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${month} ${day} ${hours}:${minutes}`;
  }
  return `${month} ${day} ${date.getFullYear()}`;
}

function isTabNotConnectedError(message: string): boolean {
  return /not connected/i.test(message);
}

function createTransferId(prefix: "up" | "down"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function formatTransferBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1000 && index < units.length - 1) {
    value /= 1000;
    index += 1;
  }
  const precision = index === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[index]}`;
}

function formatExactByteCount(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  return `${Math.trunc(bytes).toLocaleString()} B`;
}

function formatTransferProgress(transfer: SftpTransferItem): string {
  const total = transfer.totalBytes > 0 ? transfer.totalBytes : transfer.transferredBytes;
  const ratio = total > 0 ? Math.min(1, transfer.transferredBytes / total) : 0;
  const percent =
    transfer.status === "completed" ? 100 : Math.max(0, Math.round(ratio * 100));
  if (total <= 0) {
    return `${percent}%`;
  }
  return `${percent}% ${formatTransferBytes(transfer.transferredBytes)}/${formatTransferBytes(total)}`;
}

async function getLocalPathsFromDroppedFiles(
  files: FileList,
  resolvePath?: (file: File) => Promise<string | null>
): Promise<string[]> {
  const paths = await Promise.all(
    Array.from(files).map(async (file) => {
      const maybePath = (file as File & { path?: string }).path;
      if (maybePath && typeof maybePath === "string") {
        return maybePath;
      }
      if (!resolvePath) {
        return null;
      }
      try {
        return await resolvePath(file);
      } catch {
        return null;
      }
    })
  );
  return paths.filter((pathValue): pathValue is string => typeof pathValue === "string" && pathValue.length > 0);
}

function parseReconnectDelaySeconds(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_CONNECTION_PREFERENCES.reconnectDelaySeconds;
  }
  return Math.min(60, Math.max(1, Math.trunc(value)));
}

function readConnectionPreferences(): ConnectionPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_CONNECTION_PREFERENCES;
  }
  try {
    const rawValue = window.localStorage.getItem(CONNECTION_PREFERENCES_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_CONNECTION_PREFERENCES;
    }
    const parsed = JSON.parse(rawValue) as Partial<ConnectionPreferences>;
    return {
      autoReconnect:
        typeof parsed.autoReconnect === "boolean"
          ? parsed.autoReconnect
          : DEFAULT_CONNECTION_PREFERENCES.autoReconnect,
      reconnectDelaySeconds: parseReconnectDelaySeconds(parsed.reconnectDelaySeconds)
    };
  } catch {
    return DEFAULT_CONNECTION_PREFERENCES;
  }
}

function readHotkeyPreferences(): HotkeyPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_HOTKEY_PREFERENCES;
  }
  try {
    const rawValue = window.localStorage.getItem(HOTKEY_PREFERENCES_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_HOTKEY_PREFERENCES;
    }
    const parsed = JSON.parse(rawValue) as Partial<HotkeyPreferences>;
    return {
      openSessionTab:
        typeof parsed.openSessionTab === "boolean"
          ? parsed.openSessionTab
          : DEFAULT_HOTKEY_PREFERENCES.openSessionTab,
      closeActiveTab:
        typeof parsed.closeActiveTab === "boolean"
          ? parsed.closeActiveTab
          : DEFAULT_HOTKEY_PREFERENCES.closeActiveTab,
      terminalCopy:
        typeof parsed.terminalCopy === "boolean"
          ? parsed.terminalCopy
          : DEFAULT_HOTKEY_PREFERENCES.terminalCopy,
      terminalPaste:
        typeof parsed.terminalPaste === "boolean"
          ? parsed.terminalPaste
          : DEFAULT_HOTKEY_PREFERENCES.terminalPaste,
      terminalSearch:
        typeof parsed.terminalSearch === "boolean"
          ? parsed.terminalSearch
          : DEFAULT_HOTKEY_PREFERENCES.terminalSearch
    };
  } catch {
    return DEFAULT_HOTKEY_PREFERENCES;
  }
}

function toFormFromSession(session: SessionRecord): SessionCreateInput {
  return {
    name: session.name,
    host: session.host,
    port: session.port,
    username: session.username,
    authType: session.authType,
    privateKeyPath: session.privateKeyPath ?? "",
    remark: session.remark ?? "",
    favorite: session.favorite,
    secret: ""
  };
}

function normalizeHostForRule(host: string): string {
  const trimmed = host.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isIpv4Host(host: string): boolean {
  const match = host.match(/^(\d{1,3}\.){3}\d{1,3}$/);
  if (!match) {
    return false;
  }
  return host.split(".").every((segment) => Number(segment) >= 0 && Number(segment) <= 255);
}

function isIpv6Host(host: string): boolean {
  if (!host.includes(":")) {
    return false;
  }
  return /^[0-9a-fA-F:]+$/.test(host);
}

function buildClashDirectRules(session: SessionRecord): string {
  const host = normalizeHostForRule(session.host);
  const lines = [
    `# TermDock Session: ${session.name}`,
    `# Target: ${session.username}@${host}:${session.port}`
  ];
  if (isIpv4Host(host)) {
    lines.push(`- IP-CIDR,${host}/32,DIRECT,no-resolve`);
  } else if (isIpv6Host(host)) {
    lines.push(`- IP-CIDR6,${host}/128,DIRECT,no-resolve`);
  } else {
    lines.push(`- DOMAIN,${host},DIRECT`);
  }
  return lines.join("\n");
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const element = document.createElement("textarea");
  element.value = text;
  element.setAttribute("readonly", "true");
  element.style.position = "fixed";
  element.style.opacity = "0";
  document.body.appendChild(element);
  element.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(element);
  return copied;
}

export function App() {
  const [bridge, setBridge] = useState<Window["termdock"] | null>(
    () => window.termdock ?? null
  );
  const sessionsApi = bridge?.sessions ?? null;
  const appApi = bridge?.app ?? null;
  const systemApi = bridge?.system ?? null;
  const terminalApi = bridge?.terminal ?? null;
  const sftpApi = bridge?.sftp ?? null;
  const isMacPlatform = /mac/i.test(navigator.platform);
  const hotkeyModifierLabel = isMacPlatform ? "Cmd" : "Ctrl";

  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [form, setForm] = useState<SessionCreateInput>(EMPTY_FORM);
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionFilterQuery, setSessionFilterQuery] = useState("");
  const [sessionFavoritesOnly, setSessionFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [connectionPreferences, setConnectionPreferences] = useState<ConnectionPreferences>(
    () => readConnectionPreferences()
  );
  const [hotkeyPreferences, setHotkeyPreferences] = useState<HotkeyPreferences>(
    () => readHotkeyPreferences()
  );
  const [testConnectionResult, setTestConnectionResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [sftpDirectory, setSftpDirectory] = useState<SftpDirectoryListResult | null>(null);
  const [sftpPath, setSftpPath] = useState(".");
  const [sftpLoading, setSftpLoading] = useState(false);
  const [sftpActionLoading, setSftpActionLoading] = useState(false);
  const [sftpDropActive, setSftpDropActive] = useState(false);
  const [selectedSftpPath, setSelectedSftpPath] = useState<string | null>(null);
  const [sftpTransfers, setSftpTransfers] = useState<SftpTransferItem[]>([]);
  const [sftpError, setSftpError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connectedTabIdsRef = useRef<Set<string>>(new Set());

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );
  const filteredSessions = useMemo(() => {
    const normalizedQuery = sessionFilterQuery.trim().toLowerCase();
    const filtered = sessions.filter((session) => {
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
        session.remark ?? ""
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
    filtered.sort(compareSessionRecency);
    return filtered;
  }, [sessionFavoritesOnly, sessionFilterQuery, sessions]);
  const sessionBadgeText = useMemo(() => {
    if (filteredSessions.length === sessions.length) {
      return `${sessions.length}`;
    }
    return `${filteredSessions.length}/${sessions.length}`;
  }, [filteredSessions.length, sessions.length]);
  const editingSession = useMemo(
    () => sessions.find((session) => session.id === editingSessionId) ?? null,
    [editingSessionId, sessions]
  );
  const activeTerminalTab = useMemo(
    () => terminalTabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, terminalTabs]
  );
  const selectedSftpEntry = useMemo<SftpEntry | null>(() => {
    if (!sftpDirectory || !selectedSftpPath) {
      return null;
    }
    return sftpDirectory.entries.find((entry) => entry.path === selectedSftpPath) ?? null;
  }, [selectedSftpPath, sftpDirectory]);
  const activeSftpTransfers = useMemo(() => {
    if (!activeTabId) {
      return [];
    }
    return sftpTransfers
      .filter((transfer) => transfer.tabId === activeTabId)
      .slice(0, 8);
  }, [activeTabId, sftpTransfers]);
  const canDownloadSelectedSftpEntry =
    !!selectedSftpEntry && selectedSftpEntry.kind !== "directory";
  const sftpSummary = useMemo(() => {
    const entries = sftpDirectory?.entries ?? [];
    let fileCount = 0;
    let directoryCount = 0;
    let totalSize = 0;
    for (const entry of entries) {
      if (entry.kind === "directory") {
        directoryCount += 1;
      } else if (entry.kind === "file") {
        fileCount += 1;
      }
      if (Number.isFinite(entry.size) && entry.size > 0) {
        totalSize += entry.size;
      }
    }
    return {
      entryCount: entries.length,
      fileCount,
      directoryCount,
      totalSize
    };
  }, [sftpDirectory]);

  const loadSftpDirectory = useCallback(
    async (
      path?: string,
      options?: {
        tabId?: string;
        suppressDisconnectedError?: boolean;
      }
    ) => {
      if (!sftpApi) {
        setSftpError("SFTP bridge unavailable. Restart `pnpm dev`.");
        return;
      }
      const targetTabId = options?.tabId ?? activeTabId;
      if (!targetTabId) {
        setSftpError("Open a terminal tab before browsing SFTP.");
        return;
      }
      if (!connectedTabIdsRef.current.has(targetTabId)) {
        if (!options?.suppressDisconnectedError) {
          setSftpError("Terminal tab is not connected.");
        }
        return;
      }

      setSftpLoading(true);
      setSftpError(null);
      try {
        const result = await sftpApi.listDirectory(targetTabId, path ?? ".");
        setSftpDirectory(result);
        setSftpPath(result.cwd);
        setSelectedSftpPath((previousPath) => {
          if (!previousPath) {
            return null;
          }
          return result.entries.some((entry) => entry.path === previousPath)
            ? previousPath
            : null;
        });
      } catch (caughtError) {
        const message = (caughtError as Error).message;
        if (options?.suppressDisconnectedError && isTabNotConnectedError(message)) {
          return;
        }
        setSftpError(message);
      } finally {
        setSftpLoading(false);
      }
    },
    [activeTabId, sftpApi]
  );

  useEffect(() => {
    if (bridge) {
      return;
    }

    let attempts = 0;
    const interval = setInterval(() => {
      if (window.termdock) {
        setBridge(window.termdock);
        setError(null);
        clearInterval(interval);
        return;
      }

      attempts += 1;
      if (attempts === 30) {
        setError("Desktop bridge is not ready. Please restart `pnpm dev`.");
        setLoading(false);
      }
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, [bridge]);

  useEffect(() => {
    if (!sessionsApi) {
      return;
    }

    const load = async () => {
      try {
        const nextSessions = await sessionsApi.list();
        setSessions(nextSessions);
        if (nextSessions.length > 0) {
          setSelectedSessionId(nextSessions[0].id);
        }
      } catch (caughtError) {
        setError((caughtError as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [sessionsApi]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        CONNECTION_PREFERENCES_STORAGE_KEY,
        JSON.stringify(connectionPreferences)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [connectionPreferences]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        HOTKEY_PREFERENCES_STORAGE_KEY,
        JSON.stringify(hotkeyPreferences)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [hotkeyPreferences]);

  useEffect(() => {
    if (!appApi) {
      return;
    }
    const stopListening = appApi.onOpenSettings(() => {
      setIsSettingsOpen(true);
    });
    return () => {
      stopListening();
    };
  }, [appApi]);

  useEffect(() => {
    if (terminalTabs.length === 0) {
      return;
    }

    setTerminalTabs((prev) => {
      let changed = false;
      const maxInstanceBySession = new Map<string, number>();
      const next = prev.map((tab) => {
        const rawInstance = getSafeTabInstance(tab.instance);
        const fallbackInstance = (maxInstanceBySession.get(tab.sessionId) ?? 0) + 1;
        const safeInstance = rawInstance > 0 ? rawInstance : fallbackInstance;
        maxInstanceBySession.set(
          tab.sessionId,
          Math.max(maxInstanceBySession.get(tab.sessionId) ?? 0, safeInstance)
        );

        const sessionName =
          sessions.find((session) => session.id === tab.sessionId)?.name ??
          tab.title.replace(/\s*\(NaN\)\s*$/i, "");
        const safeTitle = formatTabTitle(sessionName, safeInstance);

        if (tab.instance !== safeInstance || tab.title !== safeTitle) {
          changed = true;
          return {
            ...tab,
            instance: safeInstance,
            title: safeTitle
          };
        }
        return tab;
      });
      return changed ? next : prev;
    });
  }, [sessions, terminalTabs.length]);

  useEffect(() => {
    setSftpDirectory(null);
    setSftpError(null);
    setSftpPath(".");
    setSelectedSftpPath(null);
    if (!activeTabId || !sftpApi) {
      return;
    }
    void loadSftpDirectory(".", {
      tabId: activeTabId,
      suppressDisconnectedError: true
    });
  }, [activeTabId, loadSftpDirectory, sftpApi]);

  useEffect(() => {
    connectedTabIdsRef.current.clear();
  }, [terminalApi]);

  useEffect(() => {
    if (!terminalApi) {
      return;
    }

    const stopListening = terminalApi.onEvent((event) => {
      if (event.type === "status") {
        if (event.status === "connected") {
          connectedTabIdsRef.current.add(event.tabId);
          const tab = terminalTabs.find((item) => item.id === event.tabId);
          if (tab) {
            const connectedAt = new Date().toISOString();
            setSessions((prev) =>
              prev.map((session) =>
                session.id === tab.sessionId
                  ? {
                      ...session,
                      lastConnectedAt: connectedAt
                    }
                  : session
              )
            );
          }
        } else {
          connectedTabIdsRef.current.delete(event.tabId);
        }
      }
      if (event.type === "error") {
        connectedTabIdsRef.current.delete(event.tabId);
      }
      if (event.type !== "status" || event.status !== "connected") {
        return;
      }
      if (!activeTabId || event.tabId !== activeTabId) {
        return;
      }
      void loadSftpDirectory(".", {
        tabId: event.tabId,
        suppressDisconnectedError: true
      });
    });

    return () => {
      stopListening();
    };
  }, [activeTabId, loadSftpDirectory, terminalApi, terminalTabs]);

  useEffect(() => {
    if (!sftpApi) {
      return;
    }
    const currentCwd = sftpDirectory?.cwd;

    const stopListening = sftpApi.onTransferEvent((event) => {
      setSftpTransfers((prev) => {
        const nextItem: SftpTransferItem = {
          ...event,
          updatedAt: Date.now()
        };
        const existingIndex = prev.findIndex(
          (transfer) => transfer.transferId === event.transferId
        );
        if (existingIndex < 0) {
          return [nextItem, ...prev].slice(0, 80);
        }
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          ...nextItem
        };
        next.sort((left, right) => right.updatedAt - left.updatedAt);
        return next;
      });

      if (event.status === "failed" && event.tabId === activeTabId && event.message) {
        setSftpError(event.message);
      }

      if (event.status === "completed" && event.tabId === activeTabId && currentCwd) {
        void loadSftpDirectory(currentCwd, {
          tabId: event.tabId,
          suppressDisconnectedError: true
        });
      }
    });

    return () => {
      stopListening();
    };
  }, [activeTabId, loadSftpDirectory, sftpApi, sftpDirectory?.cwd]);

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setEditingSessionId(null);
    setTestConnectionResult(null);
    setIsCreateModalOpen(true);
    setError(null);
  };

  const openEditModal = useCallback((session: SessionRecord) => {
    setForm(toFormFromSession(session));
    setEditingSessionId(session.id);
    setTestConnectionResult(null);
    setIsCreateModalOpen(true);
    setError(null);
  }, []);

  const closeCreateModal = () => {
    if (saving || testingConnection) {
      return;
    }
    setEditingSessionId(null);
    setIsCreateModalOpen(false);
  };

  const normalizeFormForSubmit = (): SessionCreateInput => ({
    ...form,
    secret: form.secret?.trim(),
    privateKeyPath:
      form.authType === "privateKey" ? form.privateKeyPath?.trim() : undefined
  });

  const handleCreateSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isEditing = !!editingSessionId;
    const editingPasswordExists =
      isEditing && editingSession?.authType === "password" && editingSession.hasSecret;
    const normalizedSecret = form.secret?.trim();
    if (!form.name.trim() || !form.host.trim() || !form.username.trim()) {
      setError("Name, host and username are required.");
      return;
    }
    if (form.authType === "password" && !normalizedSecret && !editingPasswordExists) {
      setError("Password is required when auth type is password.");
      return;
    }
    if (form.authType === "privateKey" && !form.privateKeyPath?.trim()) {
      setError("Private key path is required when auth type is private key.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (!sessionsApi) {
        throw new Error("Session bridge unavailable. Restart `pnpm dev`.");
      }

      const normalizedForm = normalizeFormForSubmit();
      if (isEditing && editingSessionId) {
        const patch: SessionUpdateInput = {
          name: normalizedForm.name,
          host: normalizedForm.host,
          port: normalizedForm.port,
          username: normalizedForm.username,
          authType: normalizedForm.authType,
          privateKeyPath:
            normalizedForm.authType === "privateKey"
              ? normalizedForm.privateKeyPath
              : "",
          remark: normalizedForm.remark,
          favorite: normalizedForm.favorite
        };
        if (normalizedForm.secret) {
          patch.secret = normalizedForm.secret;
        }
        const updated = await sessionsApi.update(editingSessionId, patch);
        setSessions((prev) =>
          prev.map((session) => (session.id === updated.id ? updated : session))
        );
        setSelectedSessionId(updated.id);
      } else {
        const created = await sessionsApi.create(normalizedForm);
        const nextSessions = [created, ...sessions];
        setSessions(nextSessions);
        setSelectedSessionId(created.id);
      }

      setForm(EMPTY_FORM);
      setEditingSessionId(null);
      setIsCreateModalOpen(false);
      setTestConnectionResult(null);
    } catch (caughtError) {
      setError((caughtError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!sessionsApi) {
      setError("Session bridge unavailable. Restart `pnpm dev`.");
      return;
    }
    if (!form.host?.trim() || !form.username?.trim()) {
      setError("Host and username are required for connection test.");
      return;
    }
    if (form.authType === "password" && !form.secret?.trim()) {
      setError("Password is required for connection test.");
      return;
    }
    if (form.authType === "privateKey" && !form.privateKeyPath?.trim()) {
      setError("Private key path is required for connection test.");
      return;
    }

    setTestingConnection(true);
    setError(null);
    setTestConnectionResult(null);
    try {
      const result = await sessionsApi.testConnection(normalizeFormForSubmit());
      setTestConnectionResult(result);
    } catch (caughtError) {
      setTestConnectionResult({
        ok: false,
        message: (caughtError as Error).message
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const openTerminalTab = useCallback((session: SessionRecord) => {
    if (!terminalApi) {
      setError("Terminal bridge unavailable. Restart `pnpm dev`.");
      return;
    }

    const id = `${session.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    setTerminalTabs((prev) => {
      const existingTabs = prev.filter((tab) => tab.sessionId === session.id);
      const nextInstance = existingTabs.reduce((max, tab) => {
        return Math.max(max, getSafeTabInstance(tab.instance));
      }, 0) + 1;
      const title = formatTabTitle(session.name, nextInstance);
      const nextTab: TerminalTab = {
        id,
        sessionId: session.id,
        title,
        instance: nextInstance
      };
      return [...prev, nextTab];
    });
    setActiveTabId(id);
  }, [terminalApi]);

  const closeTerminalTab = useCallback((tabId: string) => {
    connectedTabIdsRef.current.delete(tabId);
    if (terminalApi) {
      void terminalApi.close(tabId);
    }

    const nextTabs = terminalTabs.filter((tab) => tab.id !== tabId);
    setTerminalTabs(nextTabs);

    if (activeTabId !== tabId) {
      return;
    }
    setActiveTabId(nextTabs.length > 0 ? nextTabs[nextTabs.length - 1].id : null);
  }, [activeTabId, terminalApi, terminalTabs]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!hasPrimaryShortcutModifier(event) || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (isEditableTarget(event.target)) {
        return;
      }

      if (key === "t") {
        if (!hotkeyPreferences.openSessionTab) {
          event.preventDefault();
          return;
        }
        if (!selectedSession) {
          return;
        }
        event.preventDefault();
        openTerminalTab(selectedSession);
        return;
      }

      if (key === "w") {
        if (!hotkeyPreferences.closeActiveTab) {
          event.preventDefault();
          return;
        }
        if (!activeTabId) {
          return;
        }
        event.preventDefault();
        closeTerminalTab(activeTabId);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeTabId, closeTerminalTab, hotkeyPreferences, openTerminalTab, selectedSession]);

  const removeSession = async (sessionId: string) => {
    const hit = sessions.find((session) => session.id === sessionId);
    if (!hit) {
      return;
    }
    const accepted = window.confirm(`Delete session "${hit.name}"?`);
    if (!accepted) {
      return;
    }

    try {
      if (!sessionsApi) {
        throw new Error("Session bridge unavailable. Restart `pnpm dev`.");
      }

      await sessionsApi.remove(sessionId);
      const nextSessions = sessions.filter((session) => session.id !== sessionId);
      setSessions(nextSessions);
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(nextSessions[0]?.id ?? null);
      }
      const removedTabs = terminalTabs.filter((tab) => tab.sessionId === sessionId);
      for (const tab of removedTabs) {
        connectedTabIdsRef.current.delete(tab.id);
        if (terminalApi) {
          void terminalApi.close(tab.id);
        }
      }
      const nextTabs = terminalTabs.filter((tab) => tab.sessionId !== sessionId);
      setTerminalTabs(nextTabs);
      if (nextTabs.every((tab) => tab.id !== activeTabId)) {
        setActiveTabId(nextTabs[0]?.id ?? null);
      }
    } catch (caughtError) {
      setError((caughtError as Error).message);
    }
  };

  const patchSession = async (sessionId: string, patch: SessionUpdateInput) => {
    try {
      if (!sessionsApi) {
        throw new Error("Session bridge unavailable. Restart `pnpm dev`.");
      }

      const updated = await sessionsApi.update(sessionId, patch);
      setSessions((prev) =>
        prev.map((session) => (session.id === updated.id ? updated : session))
      );
    } catch (caughtError) {
      setError((caughtError as Error).message);
    }
  };

  const setAutoReconnect = (value: boolean) => {
    setConnectionPreferences((prev) => ({
      ...prev,
      autoReconnect: value
    }));
  };

  const setReconnectDelaySeconds = (rawValue: string) => {
    const parsed = Number(rawValue);
    setConnectionPreferences((prev) => ({
      ...prev,
      reconnectDelaySeconds: parseReconnectDelaySeconds(parsed)
    }));
  };

  const setHotkeyPreference = (key: keyof HotkeyPreferences, value: boolean) => {
    setHotkeyPreferences((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const copyClashDirectRules = async (session: SessionRecord) => {
    const text = buildClashDirectRules(session);
    try {
      const copied = await copyTextToClipboard(text);
      if (copied) {
        window.alert("Clash 直连规则已复制到剪贴板。");
        return;
      }
    } catch {
      // Fall through to manual copy prompt.
    }
    window.prompt("复制下面的 Clash 直连规则", text);
  };

  const pickPrivateKeyFile = async () => {
    try {
      if (!systemApi) {
        throw new Error("System bridge unavailable. Restart `pnpm dev`.");
      }

      const filePath = await systemApi.pickPrivateKey();
      if (!filePath) {
        return;
      }

      setForm((prev) => ({
        ...prev,
        privateKeyPath: filePath
      }));
    } catch (caughtError) {
      setError((caughtError as Error).message);
    }
  };

  const createSftpDirectory = async () => {
    if (!sftpApi) {
      setSftpError("SFTP bridge unavailable. Restart `pnpm dev`.");
      return;
    }
    if (!activeTabId || !sftpDirectory) {
      setSftpError("Open a terminal tab before managing SFTP files.");
      return;
    }

    const nameInput = window.prompt("New directory name");
    if (nameInput === null) {
      return;
    }
    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setSftpError("Directory name is required.");
      return;
    }

    setSftpActionLoading(true);
    setSftpError(null);
    try {
      await sftpApi.createDirectory(activeTabId, sftpDirectory.cwd, trimmedName);
      await loadSftpDirectory(sftpDirectory.cwd, { tabId: activeTabId });
    } catch (caughtError) {
      setSftpError((caughtError as Error).message);
    } finally {
      setSftpActionLoading(false);
    }
  };

  const renameSelectedSftpEntry = async () => {
    if (!sftpApi) {
      setSftpError("SFTP bridge unavailable. Restart `pnpm dev`.");
      return;
    }
    if (!activeTabId || !sftpDirectory) {
      setSftpError("Open a terminal tab before managing SFTP files.");
      return;
    }
    if (!selectedSftpEntry) {
      setSftpError("Select a file or directory first.");
      return;
    }

    const nameInput = window.prompt("Rename to", selectedSftpEntry.name);
    if (nameInput === null) {
      return;
    }
    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setSftpError("New name is required.");
      return;
    }

    setSftpActionLoading(true);
    setSftpError(null);
    try {
      await sftpApi.renamePath(activeTabId, selectedSftpEntry.path, trimmedName);
      setSelectedSftpPath(null);
      await loadSftpDirectory(sftpDirectory.cwd, { tabId: activeTabId });
    } catch (caughtError) {
      setSftpError((caughtError as Error).message);
    } finally {
      setSftpActionLoading(false);
    }
  };

  const deleteSelectedSftpEntry = async () => {
    if (!sftpApi) {
      setSftpError("SFTP bridge unavailable. Restart `pnpm dev`.");
      return;
    }
    if (!activeTabId || !sftpDirectory) {
      setSftpError("Open a terminal tab before managing SFTP files.");
      return;
    }
    if (!selectedSftpEntry) {
      setSftpError("Select a file or directory first.");
      return;
    }

    const accepted = window.confirm(
      `Delete ${selectedSftpEntry.kind === "directory" ? "directory" : "file"} "${selectedSftpEntry.name}"?`
    );
    if (!accepted) {
      return;
    }

    setSftpActionLoading(true);
    setSftpError(null);
    try {
      await sftpApi.deletePath(activeTabId, selectedSftpEntry.path, selectedSftpEntry.kind);
      setSelectedSftpPath(null);
      await loadSftpDirectory(sftpDirectory.cwd, { tabId: activeTabId });
    } catch (caughtError) {
      setSftpError((caughtError as Error).message);
    } finally {
      setSftpActionLoading(false);
    }
  };

  const uploadLocalFileToSftp = async () => {
    if (!systemApi) {
      setSftpError("System bridge unavailable. Restart `pnpm dev`.");
      return;
    }
    if (!sftpApi) {
      setSftpError("SFTP bridge unavailable. Restart `pnpm dev`.");
      return;
    }
    if (!activeTabId || !sftpDirectory) {
      setSftpError("Open a terminal tab before managing SFTP files.");
      return;
    }

    const localPath = await systemApi.pickUploadFile();
    if (!localPath) {
      return;
    }

    await uploadLocalPathsToSftp([localPath]);
  };

  const downloadSelectedSftpEntry = async () => {
    if (!systemApi) {
      setSftpError("System bridge unavailable. Restart `pnpm dev`.");
      return;
    }
    if (!sftpApi) {
      setSftpError("SFTP bridge unavailable. Restart `pnpm dev`.");
      return;
    }
    if (!activeTabId) {
      setSftpError("Open a terminal tab before managing SFTP files.");
      return;
    }
    if (!selectedSftpEntry || selectedSftpEntry.kind === "directory") {
      setSftpError("Select a file first.");
      return;
    }

    const localPath = await systemApi.pickDownloadTarget(selectedSftpEntry.name);
    if (!localPath) {
      return;
    }

    try {
      setSftpError(null);
      await sftpApi.downloadFile(
        activeTabId,
        createTransferId("down"),
        selectedSftpEntry.path,
        localPath
      );
    } catch (caughtError) {
      setSftpError((caughtError as Error).message);
    }
  };

  const uploadLocalPathsToSftp = async (paths: string[]) => {
    if (!sftpApi) {
      setSftpError("SFTP bridge unavailable. Restart `pnpm dev`.");
      return;
    }
    if (!activeTabId || !sftpDirectory) {
      setSftpError("Open a terminal tab before managing SFTP files.");
      return;
    }
    if (paths.length === 0) {
      return;
    }

    setSftpError(null);
    const results = await Promise.allSettled(
      paths.map((localPath) =>
        sftpApi.uploadFile(
          activeTabId,
          createTransferId("up"),
          localPath,
          sftpDirectory.cwd
        )
      )
    );
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    if (failed) {
      setSftpError((failed.reason as Error)?.message ?? "Some uploads failed.");
    }
  };

  const onSftpDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!sftpDropActive) {
      setSftpDropActive(true);
    }
  };

  const onSftpDragLeave = (event: DragEvent<HTMLElement>) => {
    if (
      event.currentTarget instanceof HTMLElement &&
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    setSftpDropActive(false);
  };

  const onSftpDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setSftpDropActive(false);
    const droppedFiles = event.dataTransfer.files;
    void (async () => {
      const localPaths = await getLocalPathsFromDroppedFiles(
        droppedFiles,
        systemApi?.getPathForDroppedFile
      );
      if (localPaths.length === 0) {
        setSftpError("Cannot resolve local paths from dropped files. Try the Upload button.");
        return;
      }
      await uploadLocalPathsToSftp(localPaths);
    })();
  };

  return (
    <div className={isMacPlatform ? "app app--mac" : "app"}>
      <header className="topbar">
        <div className="topbar__brand">
          <strong>TermDock</strong>
          <span>SSH + SFTP Workbench</span>
        </div>
        <div className="topbar__meta">
          <span className="topbar__meta-dot" />
          <span>
            {connectionPreferences.autoReconnect
              ? `Auto Reconnect ${connectionPreferences.reconnectDelaySeconds}s`
              : "Auto Reconnect Off"}
          </span>
          {!isMacPlatform ? (
            <button
              className="icon-button topbar__settings-button"
              onClick={() => setIsSettingsOpen(true)}
              type="button"
            >
              Settings
            </button>
          ) : null}
        </div>
      </header>

      <main className="layout">
        <aside className="panel panel--left">
          <section className="panel__section panel__section--sftp">
            <div className="panel__heading">
              <h2>SFTP</h2>
            </div>
            {activeTerminalTab ? (
              <>
                <p className="hint sftp-binding">
                  Bound to tab: <strong>{activeTerminalTab.title}</strong>
                </p>
                <div className="sftp-toolbar">
                  <input
                    className="sftp-path-input"
                    onChange={(event) => setSftpPath(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") {
                        return;
                      }
                      event.preventDefault();
                      void loadSftpDirectory(sftpPath);
                    }}
                    placeholder="/var/log"
                    value={sftpPath}
                  />
                  <button
                    aria-label="Go to path"
                    className="icon-button sftp-toolbar__button"
                    disabled={sftpLoading || sftpActionLoading}
                    onClick={() => {
                      void loadSftpDirectory(sftpPath);
                    }}
                    title="Go to path"
                    type="button"
                  >
                    ➜
                  </button>
                  <button
                    aria-label="Go to parent directory"
                    className="icon-button sftp-toolbar__button"
                    disabled={sftpLoading || sftpActionLoading || !sftpDirectory?.parent}
                    onClick={() => {
                      if (!sftpDirectory?.parent) {
                        return;
                      }
                      void loadSftpDirectory(sftpDirectory.parent);
                    }}
                    title="Go up"
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label="Refresh current directory"
                    className="icon-button sftp-toolbar__button"
                    disabled={sftpLoading || sftpActionLoading}
                    onClick={() => {
                      void loadSftpDirectory(sftpDirectory?.cwd ?? sftpPath);
                    }}
                    title="Refresh"
                    type="button"
                  >
                    ⟳
                  </button>
                  <button
                    aria-label="Create directory"
                    className="icon-button sftp-toolbar__button"
                    disabled={sftpLoading || sftpActionLoading}
                    onClick={() => {
                      void createSftpDirectory();
                    }}
                    title="New folder"
                    type="button"
                  >
                    📁
                  </button>
                  <button
                    aria-label="Upload file"
                    className="icon-button sftp-toolbar__button"
                    disabled={sftpLoading || sftpActionLoading}
                    onClick={() => {
                      void uploadLocalFileToSftp();
                    }}
                    title="Upload file"
                    type="button"
                  >
                    ⇧
                  </button>
                  <button
                    aria-label="Download selected file"
                    className="icon-button sftp-toolbar__button"
                    disabled={sftpLoading || sftpActionLoading || !canDownloadSelectedSftpEntry}
                    onClick={() => {
                      void downloadSelectedSftpEntry();
                    }}
                    title="Download selected"
                    type="button"
                  >
                    ⇩
                  </button>
                  <button
                    aria-label="Rename selected entry"
                    className="icon-button sftp-toolbar__button"
                    disabled={sftpLoading || sftpActionLoading || !selectedSftpEntry}
                    onClick={() => {
                      void renameSelectedSftpEntry();
                    }}
                    title="Rename selected"
                    type="button"
                  >
                    ✎
                  </button>
                  <button
                    aria-label="Delete selected entry"
                    className="icon-button icon-button--danger sftp-toolbar__button"
                    disabled={sftpLoading || sftpActionLoading || !selectedSftpEntry}
                    onClick={() => {
                      void deleteSelectedSftpEntry();
                    }}
                    title="Delete selected"
                    type="button"
                  >
                    🗑
                  </button>
                </div>
                <p className="hint sftp-current-path">
                  Current: {sftpDirectory?.cwd ?? "(not loaded)"}
                </p>
                {sftpError ? <p className="hint sftp-error">{sftpError}</p> : null}
                <div
                  className={sftpDropActive ? "sftp-drop-zone is-active" : "sftp-drop-zone"}
                  onDragLeave={onSftpDragLeave}
                  onDragOver={onSftpDragOver}
                  onDrop={onSftpDrop}
                >
                  <p className="hint sftp-drop-hint">
                    Drop files into this box to upload to current directory.
                  </p>
                  <div className="sftp-drop-zone__body">
                    <ul className="sftp-list">
                      {(sftpDirectory?.entries ?? []).map((entry) => (
                        <li
                          className={
                            selectedSftpPath === entry.path
                              ? "sftp-list__item is-selected"
                              : "sftp-list__item"
                          }
                          key={`${entry.path}-${entry.modifiedAt ?? ""}`}
                          onClick={() => {
                            setSelectedSftpPath(entry.path);
                          }}
                        >
                          {entry.kind === "directory" ? (
                            <button
                              className="sftp-list__name sftp-list__name--directory"
                              onClick={() => {
                                void loadSftpDirectory(entry.path);
                              }}
                              title={entry.path}
                              type="button"
                            >
                              {entry.name}/
                            </button>
                          ) : (
                            <span className="sftp-list__name sftp-list__name--plain" title={entry.path}>
                              {entry.name}
                            </span>
                          )}
                          <span className="sftp-list__mtime">
                            {formatSftpMtimeForLs(entry.modifiedAt)}
                          </span>
                          <span className={`sftp-list__mode sftp-list__mode--${entry.kind}`}>
                            {entry.permissions}
                          </span>
                          <span className="sftp-list__links">{formatSftpLinksForLs(entry.links)}</span>
                          <span className="sftp-list__owner">{entry.owner}</span>
                          <span className="sftp-list__group">{entry.group}</span>
                          <span className="sftp-list__meta">
                            {formatSftpSizeForLs(entry.size)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {sftpLoading ? (
                  <p className="hint sftp-loading-indicator" role="status" aria-live="polite">
                    Loading remote directory...
                  </p>
                ) : null}
                <div className="sftp-summary">
                  <p className="hint sftp-summary__item">
                    Entries: {sftpSummary.entryCount} (Files: {sftpSummary.fileCount}, Dirs: {sftpSummary.directoryCount})
                  </p>
                  <p className="hint sftp-summary__item">
                    Current directory size: {formatExactByteCount(sftpSummary.totalSize)} ({formatTransferBytes(sftpSummary.totalSize)})
                  </p>
                </div>
                <div className="sftp-transfer-panel">
                  <p className="hint sftp-transfer-panel__title">Upload status</p>
                  {activeSftpTransfers.length > 0 ? (
                    <ul className="sftp-transfer-list">
                      {activeSftpTransfers.map((transfer) => (
                        <li className={`sftp-transfer sftp-transfer--${transfer.status}`} key={transfer.transferId}>
                          <span className="sftp-transfer__icon">
                            {transfer.direction === "upload" ? "↑" : "↓"}
                          </span>
                          <span className="sftp-transfer__name">{transfer.name}</span>
                          <span className="sftp-transfer__progress">{formatTransferProgress(transfer)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="hint">No active transfers.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="hint">
                Open a terminal tab first. SFTP panel reuses the active tab SSH connection.
              </p>
            )}
          </section>
        </aside>

        <section className="panel panel--center">
          <TerminalWorkspace
            activeTabId={activeTabId}
            connectionPreferences={connectionPreferences}
            hotkeyPreferences={hotkeyPreferences}
            onCloseTab={closeTerminalTab}
            onError={setError}
            onSelectTab={setActiveTabId}
            terminalApi={terminalApi}
            tabs={terminalTabs}
          />
        </section>

        <aside className="panel panel--right">
          <section className="panel__section">
            <div className="panel__heading">
              <div className="panel__title-group">
                <h2>Sessions</h2>
                <span className="panel__badge">{sessionBadgeText}</span>
              </div>
              <button
                aria-label="Create session"
                className="primary-button primary-button--small primary-button--icon"
                onClick={openCreateModal}
                title="Create session"
                type="button"
              >
                +
              </button>
            </div>
            {loading ? <p className="hint">Loading sessions...</p> : null}
            <div className="session-filter-bar">
              <input
                className="session-filter-input"
                onChange={(event) => setSessionFilterQuery(event.target.value)}
                placeholder="Filter name/host/user"
                value={sessionFilterQuery}
              />
              <button
                aria-label={sessionFavoritesOnly ? "Show all sessions" : "Show favorite sessions only"}
                className={
                  sessionFavoritesOnly
                    ? "icon-button session-filter-toggle is-active"
                    : "icon-button session-filter-toggle"
                }
                onClick={() => setSessionFavoritesOnly((prev) => !prev)}
                title={sessionFavoritesOnly ? "Show all" : "Favorites only"}
                type="button"
              >
                {sessionFavoritesOnly ? "★" : "☆"}
              </button>
            </div>
            {!loading && filteredSessions.length === 0 ? (
              <p className="hint">
                {sessions.length === 0
                  ? "No sessions yet."
                  : "No sessions match current filters."}
              </p>
            ) : null}
            <ul className="session-list">
              {filteredSessions.map((session) => (
                <li
                  key={session.id}
                  className={
                    selectedSessionId === session.id
                      ? "session-list__item is-selected"
                      : "session-list__item"
                  }
                >
                  <button
                    className="session-list__main"
                    onClick={() => setSelectedSessionId(session.id)}
                    onDoubleClick={() => openTerminalTab(session)}
                    type="button"
                  >
                    <span className="session-list__name">{session.name}</span>
                    <span className="session-list__host">
                      {session.username}@{session.host}:{session.port}
                    </span>
                  </button>
                  <div className="session-list__actions">
                    <button
                      aria-label={session.favorite ? "Unfavorite session" : "Favorite session"}
                      className="icon-button session-list__action"
                      onClick={() =>
                        void patchSession(session.id, { favorite: !session.favorite })
                      }
                      title={session.favorite ? "Unfavorite" : "Favorite"}
                      type="button"
                    >
                      {session.favorite ? "★" : "☆"}
                    </button>
                    <button
                      aria-label="Open terminal tab"
                      className="icon-button session-list__action"
                      onClick={() => openTerminalTab(session)}
                      title="Open terminal tab"
                      type="button"
                    >
                      ▶
                    </button>
                    <button
                      aria-label="Edit session"
                      className="icon-button session-list__action"
                      onClick={() => openEditModal(session)}
                      title="Edit session"
                      type="button"
                    >
                      ✎
                    </button>
                    <button
                      aria-label="Delete session"
                      className="icon-button icon-button--danger session-list__action"
                      onClick={() => void removeSession(session.id)}
                      title="Delete session"
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel__section">
            <div className="panel__heading">
              <h2>Selected Session</h2>
              {selectedSession ? (
                <div className="session-detail-actions">
                  <button
                    className="icon-button"
                    onClick={() => void copyClashDirectRules(selectedSession)}
                    title="Copy Clash direct rules"
                    type="button"
                  >
                    Clash
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => openEditModal(selectedSession)}
                    title="Edit selected session"
                    type="button"
                  >
                    Edit
                  </button>
                </div>
              ) : null}
            </div>
            {selectedSession ? (
              <dl className="session-meta">
                <div>
                  <dt>Name</dt>
                  <dd>{selectedSession.name}</dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd>
                    {selectedSession.username}@{selectedSession.host}:
                    {selectedSession.port}
                  </dd>
                </div>
                <div>
                  <dt>Auth</dt>
                  <dd>{selectedSession.authType}</dd>
                </div>
                <div>
                  <dt>Secret</dt>
                  <dd>{selectedSession.hasSecret ? "Stored in secure vault" : "-"}</dd>
                </div>
                <div>
                  <dt>Last Connected</dt>
                  <dd>{formatSessionLastConnected(selectedSession.lastConnectedAt)}</dd>
                </div>
                <div>
                  <dt>Remark</dt>
                  <dd>{selectedSession.remark || "-"}</dd>
                </div>
              </dl>
            ) : (
              <p className="hint">Pick a session from the right panel.</p>
            )}
          </section>
        </aside>
      </main>

      {isSettingsOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
        >
          <div
            className="modal modal--compact"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
          >
            <div className="modal__header">
              <h3>Settings</h3>
              <button
                className="icon-button"
                onClick={() => setIsSettingsOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <form className="session-form">
              <h4 className="settings-group__title">Connection</h4>
              <label className="settings-checkbox">
                <input
                  checked={connectionPreferences.autoReconnect}
                  onChange={(event) => setAutoReconnect(event.target.checked)}
                  type="checkbox"
                />
                <span>Auto reconnect disconnected tabs</span>
              </label>
              <label>
                Reconnect Delay (seconds)
                <input
                  max={60}
                  min={1}
                  onChange={(event) => setReconnectDelaySeconds(event.target.value)}
                  type="number"
                  value={connectionPreferences.reconnectDelaySeconds}
                />
              </label>
              <p className="hint">
                Applies when a terminal tab closes unexpectedly. Delay range: 1-60 seconds.
              </p>
              <h4 className="settings-group__title">Hotkeys</h4>
              <label className="settings-checkbox">
                <input
                  checked={hotkeyPreferences.openSessionTab}
                  onChange={(event) => setHotkeyPreference("openSessionTab", event.target.checked)}
                  type="checkbox"
                />
                <span>{hotkeyModifierLabel} + T: Open selected session in new tab</span>
              </label>
              <label className="settings-checkbox">
                <input
                  checked={hotkeyPreferences.closeActiveTab}
                  onChange={(event) => setHotkeyPreference("closeActiveTab", event.target.checked)}
                  type="checkbox"
                />
                <span>{hotkeyModifierLabel} + W: Close active terminal tab</span>
              </label>
              <label className="settings-checkbox">
                <input
                  checked={hotkeyPreferences.terminalCopy}
                  onChange={(event) => setHotkeyPreference("terminalCopy", event.target.checked)}
                  type="checkbox"
                />
                <span>{hotkeyModifierLabel} + C: Copy selection / send interrupt</span>
              </label>
              <label className="settings-checkbox">
                <input
                  checked={hotkeyPreferences.terminalPaste}
                  onChange={(event) => setHotkeyPreference("terminalPaste", event.target.checked)}
                  type="checkbox"
                />
                <span>{hotkeyModifierLabel} + V: Paste to terminal</span>
              </label>
              <label className="settings-checkbox">
                <input
                  checked={hotkeyPreferences.terminalSearch}
                  onChange={(event) => setHotkeyPreference("terminalSearch", event.target.checked)}
                  type="checkbox"
                />
                <span>{hotkeyModifierLabel} + F: Search in terminal</span>
              </label>
              <div className="modal__actions">
                <button
                  className="primary-button"
                  onClick={() => setIsSettingsOpen(false)}
                  type="button"
                >
                  Done
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isCreateModalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
        >
          <div
            className="modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={editingSessionId ? "Edit Session" : "Create Session"}
          >
            <div className="modal__header">
              <h3>{editingSessionId ? "Edit Session" : "Create Session"}</h3>
              <button className="icon-button" onClick={closeCreateModal} type="button">
                Close
              </button>
            </div>
            <form className="session-form" onSubmit={handleCreateSession}>
              <label>
                Name
                <input
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="prod-web-01"
                  value={form.name}
                />
              </label>
              <label>
                Host
                <input
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, host: event.target.value }))
                  }
                  placeholder="10.0.10.31"
                  value={form.host}
                />
              </label>
              <div className="field-grid">
                <label>
                  Port
                  <input
                    max={65535}
                    min={1}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        port: Number(event.target.value) || 22
                      }))
                    }
                    type="number"
                    value={form.port ?? 22}
                  />
                </label>
                <label>
                  Username
                  <input
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, username: event.target.value }))
                    }
                    placeholder="ec2-user"
                    value={form.username}
                  />
                </label>
              </div>
              <label>
                Auth Type
                <select
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      authType: event.target.value as SessionCreateInput["authType"]
                    }))
                  }
                  value={form.authType}
                >
                  <option value="password">Password</option>
                  <option value="privateKey">Private Key</option>
                </select>
              </label>
              {form.authType === "privateKey" ? (
                <label>
                  Private Key Path
                  <div className="field-row">
                    <input
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          privateKeyPath: event.target.value
                        }))
                      }
                      placeholder="~/.ssh/id_ed25519"
                      value={form.privateKeyPath ?? ""}
                    />
                    <button
                      className="field-row__action"
                      onClick={() => void pickPrivateKeyFile()}
                      type="button"
                    >
                      Choose File
                    </button>
                  </div>
                </label>
              ) : null}
              <label>
                {form.authType === "password" ? "Password" : "Key Passphrase (Optional)"}
                <input
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, secret: event.target.value }))
                  }
                  placeholder={
                    form.authType === "password"
                      ? editingSessionId
                        ? "Leave blank to keep current password"
                        : "Password stored in OS secure vault"
                      : "Optional passphrase"
                  }
                  type="password"
                  value={form.secret ?? ""}
                />
              </label>
              <label>
                Remark
                <input
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, remark: event.target.value }))
                  }
                  placeholder="web production host"
                  value={form.remark ?? ""}
                />
              </label>

              {testConnectionResult ? (
                <p
                  className={
                    testConnectionResult.ok
                      ? "hint test-result test-result--ok"
                      : "hint test-result test-result--error"
                  }
                >
                  {testConnectionResult.message}
                </p>
              ) : null}

              <div className="modal__actions">
                <button
                  className="icon-button"
                  disabled={saving || testingConnection}
                  onClick={closeCreateModal}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="field-row__action"
                  disabled={saving || testingConnection}
                  onClick={() => void handleTestConnection()}
                  type="button"
                >
                  {testingConnection ? "Testing..." : "Test Connection"}
                </button>
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? "Saving..." : editingSessionId ? "Save Changes" : "Create Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {error ? <div className="error-bar">{error}</div> : null}
    </div>
  );
}
