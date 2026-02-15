import {
  DragEvent,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

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
const FILE_OPEN_PREFERENCES_STORAGE_KEY = "termdock.file-open-preferences.v1";
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
interface FileOpenPreferences {
  preferredProgramPath: string;
}

const DEFAULT_FILE_OPEN_PREFERENCES: FileOpenPreferences = {
  preferredProgramPath: ""
};

interface SftpTransferItem extends SftpTransferEvent {
  updatedAt: number;
}

interface PendingUploadJob {
  tabId: string;
  transferId: string;
  localPath: string;
  remoteDirectory: string;
  remotePath: string;
  name: string;
}

const UPLOAD_MAX_CONCURRENCY = 2;

interface LocalUploadPathEntry {
  localPath: string;
  relativeDirectory: string;
}

interface SftpContextMenuState {
  x: number;
  y: number;
  entryPath: string | null;
}

interface SftpContextAction {
  id: string;
  label: string;
  disabled?: boolean;
  run: () => void;
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

function isTransferCanceledMessage(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /\bcancel(?:ed|led)?\b/i.test(message);
}

function createTransferId(prefix: "up" | "down"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getPathBaseName(pathValue: string): string {
  const normalized = pathValue.replaceAll("\\", "/");
  const marker = normalized.lastIndexOf("/");
  if (marker < 0) {
    return normalized;
  }
  return normalized.slice(marker + 1);
}

function joinRemotePath(parentPath: string, name: string): string {
  if (!parentPath || parentPath === ".") {
    return name;
  }
  if (parentPath.endsWith("/")) {
    return `${parentPath}${name}`;
  }
  return `${parentPath}/${name}`;
}

function normalizeRemoteDirectoryPath(pathValue: string): string {
  if (!pathValue) {
    return "";
  }
  const normalized = pathValue.replaceAll("\\", "/").trim();
  if (!normalized || normalized === ".") {
    return "";
  }
  const hasLeadingSlash = normalized.startsWith("/");
  const compacted = normalized
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".")
    .join("/");
  if (!compacted) {
    return hasLeadingSlash ? "/" : "";
  }
  return hasLeadingSlash ? `/${compacted}` : compacted;
}

function normalizeRelativeDirectoryPath(pathValue: string): string {
  const normalized = normalizeRemoteDirectoryPath(pathValue);
  if (normalized.startsWith("/")) {
    return normalized.slice(1);
  }
  return normalized;
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
  if (transfer.status === "canceled") {
    if (total <= 0) {
      return "Canceled";
    }
    return `Canceled ${formatTransferBytes(transfer.transferredBytes)}/${formatTransferBytes(total)}`;
  }
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

function readFileOpenPreferences(): FileOpenPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_FILE_OPEN_PREFERENCES;
  }
  try {
    const rawValue = window.localStorage.getItem(FILE_OPEN_PREFERENCES_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_FILE_OPEN_PREFERENCES;
    }
    const parsed = JSON.parse(rawValue) as Partial<FileOpenPreferences>;
    return {
      preferredProgramPath:
        typeof parsed.preferredProgramPath === "string"
          ? parsed.preferredProgramPath
          : DEFAULT_FILE_OPEN_PREFERENCES.preferredProgramPath
    };
  } catch {
    return DEFAULT_FILE_OPEN_PREFERENCES;
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
  const [fileOpenPreferences, setFileOpenPreferences] = useState<FileOpenPreferences>(
    () => readFileOpenPreferences()
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
  const [sftpContextMenu, setSftpContextMenu] = useState<SftpContextMenuState | null>(null);
  const [sftpError, setSftpError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connectedTabIdsRef = useRef<Set<string>>(new Set());
  const uploadQueueRef = useRef<PendingUploadJob[]>([]);
  const runningUploadIdsRef = useRef<Set<string>>(new Set());
  const isDrainingUploadQueueRef = useRef(false);
  const ensuredRemoteDirectoriesRef = useRef<Map<string, Set<string>>>(new Map());
  const sftpContextMenuRef = useRef<HTMLDivElement | null>(null);

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
  const sftpContextEntry = useMemo<SftpEntry | null>(() => {
    if (!sftpDirectory || !sftpContextMenu?.entryPath) {
      return null;
    }
    return sftpDirectory.entries.find((entry) => entry.path === sftpContextMenu.entryPath) ?? null;
  }, [sftpContextMenu?.entryPath, sftpDirectory]);
  const activeSftpTransfers = useMemo(() => {
    if (!activeTabId) {
      return [];
    }
    return sftpTransfers
      .filter((transfer) => transfer.tabId === activeTabId)
      .slice(0, 8);
  }, [activeTabId, sftpTransfers]);
  const activeUploadQueueStats = useMemo(() => {
    if (!activeTabId) {
      return {
        queued: 0,
        running: 0
      };
    }
    const tabTransfers = sftpTransfers.filter(
      (transfer) => transfer.tabId === activeTabId && transfer.direction === "upload"
    );
    return {
      queued: tabTransfers.filter((transfer) => transfer.status === "queued").length,
      running: tabTransfers.filter((transfer) => transfer.status === "running").length
    };
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

  const applySftpTransferEvent = useCallback((event: SftpTransferEvent) => {
    setSftpTransfers((prev) => {
      const nextItem: SftpTransferItem = {
        ...event,
        updatedAt: Date.now()
      };
      const existingIndex = prev.findIndex(
        (transfer) => transfer.transferId === event.transferId
      );
      if (existingIndex < 0) {
        return [nextItem, ...prev].slice(0, 160);
      }
      const next = [...prev];
      next[existingIndex] = {
        ...next[existingIndex],
        ...nextItem
      };
      next.sort((left, right) => right.updatedAt - left.updatedAt);
      return next;
    });
  }, []);

  const ensureRemoteDirectoryForUpload = useCallback(
    async (tabId: string, remoteDirectory: string) => {
      if (!sftpApi) {
        throw new Error("SFTP bridge unavailable. Restart `pnpm dev`.");
      }
      const normalized = normalizeRemoteDirectoryPath(remoteDirectory);
      if (!normalized) {
        return;
      }
      const cache = ensuredRemoteDirectoriesRef.current.get(tabId) ?? new Set<string>();
      ensuredRemoteDirectoriesRef.current.set(tabId, cache);
      if (cache.has(normalized)) {
        return;
      }

      const isAbsolute = normalized.startsWith("/");
      const segments = normalized.split("/").filter(Boolean);
      let currentPath = isAbsolute ? "/" : ".";
      for (const segment of segments) {
        const nextPath = joinRemotePath(currentPath, segment);
        if (cache.has(nextPath)) {
          currentPath = nextPath;
          continue;
        }
        try {
          await sftpApi.createDirectory(tabId, currentPath, segment);
        } catch (caughtError) {
          try {
            await sftpApi.listDirectory(tabId, nextPath);
          } catch {
            throw caughtError;
          }
        }
        cache.add(nextPath);
        currentPath = nextPath;
      }
      cache.add(normalized);
    },
    [sftpApi]
  );

  const drainUploadQueue = useCallback(() => {
    if (!sftpApi || isDrainingUploadQueueRef.current) {
      return;
    }
    isDrainingUploadQueueRef.current = true;
    try {
      while (runningUploadIdsRef.current.size < UPLOAD_MAX_CONCURRENCY) {
        const nextIndex = uploadQueueRef.current.findIndex((job) =>
          connectedTabIdsRef.current.has(job.tabId)
        );
        if (nextIndex < 0) {
          break;
        }
        const [nextJob] = uploadQueueRef.current.splice(nextIndex, 1);
        runningUploadIdsRef.current.add(nextJob.transferId);
        void (async () => {
          await ensureRemoteDirectoryForUpload(nextJob.tabId, nextJob.remoteDirectory);
          await sftpApi.uploadFile(
            nextJob.tabId,
            nextJob.transferId,
            nextJob.localPath,
            nextJob.remoteDirectory
          );
        })()
          .catch((caughtError) => {
            const message = (caughtError as Error)?.message ?? "Upload failed.";
            if (!isTransferCanceledMessage(message)) {
              setSftpError(message);
              applySftpTransferEvent({
                tabId: nextJob.tabId,
                transferId: nextJob.transferId,
                direction: "upload",
                status: "failed",
                name: nextJob.name,
                localPath: nextJob.localPath,
                remotePath: nextJob.remotePath,
                transferredBytes: 0,
                totalBytes: 0,
                message
              });
            }
          })
          .finally(() => {
            runningUploadIdsRef.current.delete(nextJob.transferId);
            drainUploadQueue();
          });
      }
    } finally {
      isDrainingUploadQueueRef.current = false;
    }
  }, [applySftpTransferEvent, ensureRemoteDirectoryForUpload, sftpApi]);

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

  const closeSftpContextMenu = useCallback(() => {
    setSftpContextMenu(null);
  }, []);

  const openSftpContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>, entry?: SftpEntry) => {
      event.preventDefault();
      event.stopPropagation();
      if (entry) {
        setSelectedSftpPath(entry.path);
      }
      setSftpContextMenu({
        x: event.clientX,
        y: event.clientY,
        entryPath: entry?.path ?? null
      });
    },
    []
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
    try {
      window.localStorage.setItem(
        FILE_OPEN_PREFERENCES_STORAGE_KEY,
        JSON.stringify(fileOpenPreferences)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [fileOpenPreferences]);

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
          drainUploadQueue();
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
  }, [activeTabId, drainUploadQueue, loadSftpDirectory, terminalApi, terminalTabs]);

  useEffect(() => {
    if (!sftpApi) {
      return;
    }
    const currentCwd = sftpDirectory?.cwd;

    const stopListening = sftpApi.onTransferEvent((event) => {
      applySftpTransferEvent(event);

      if (
        event.status === "failed" &&
        event.tabId === activeTabId &&
        event.message &&
        !isTransferCanceledMessage(event.message)
      ) {
        setSftpError(event.message);
      }

      if (
        (event.status === "completed" || event.status === "canceled") &&
        event.tabId === activeTabId &&
        currentCwd
      ) {
        void loadSftpDirectory(currentCwd, {
          tabId: event.tabId,
          suppressDisconnectedError: true
        });
      }
    });

    return () => {
      stopListening();
    };
  }, [activeTabId, applySftpTransferEvent, loadSftpDirectory, sftpApi, sftpDirectory?.cwd]);

  useEffect(() => {
    if (!sftpContextMenu) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (sftpContextMenuRef.current?.contains(target)) {
        return;
      }
      closeSftpContextMenu();
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSftpContextMenu();
      }
    };

    const onWindowLayoutChange = () => {
      closeSftpContextMenu();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onEscape);
    window.addEventListener("resize", onWindowLayoutChange);
    window.addEventListener("scroll", onWindowLayoutChange, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("resize", onWindowLayoutChange);
      window.removeEventListener("scroll", onWindowLayoutChange, true);
    };
  }, [closeSftpContextMenu, sftpContextMenu]);

  useEffect(() => {
    if (!sftpContextMenu) {
      return;
    }
    if (!activeTerminalTab) {
      closeSftpContextMenu();
      return;
    }
    if (!sftpContextMenu.entryPath) {
      return;
    }
    const hasEntry = !!sftpDirectory?.entries.some(
      (entry) => entry.path === sftpContextMenu.entryPath
    );
    if (!hasEntry) {
      closeSftpContextMenu();
    }
  }, [activeTerminalTab, closeSftpContextMenu, sftpContextMenu, sftpDirectory]);

  useEffect(() => {
    drainUploadQueue();
  }, [drainUploadQueue]);

  useEffect(() => {
    return () => {
      uploadQueueRef.current = [];
      runningUploadIdsRef.current.clear();
      isDrainingUploadQueueRef.current = false;
      ensuredRemoteDirectoriesRef.current.clear();
    };
  }, []);

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
    ensuredRemoteDirectoriesRef.current.delete(tabId);
    const queuedJobs = uploadQueueRef.current.filter((job) => job.tabId === tabId);
    if (queuedJobs.length > 0) {
      uploadQueueRef.current = uploadQueueRef.current.filter((job) => job.tabId !== tabId);
      for (const job of queuedJobs) {
        applySftpTransferEvent({
          tabId: job.tabId,
          transferId: job.transferId,
          direction: "upload",
          status: "canceled",
          name: job.name,
          localPath: job.localPath,
          remotePath: job.remotePath,
          transferredBytes: 0,
          totalBytes: 0,
          message: "canceled"
        });
      }
      drainUploadQueue();
    }
    if (terminalApi) {
      void terminalApi.close(tabId);
    }

    const nextTabs = terminalTabs.filter((tab) => tab.id !== tabId);
    setTerminalTabs(nextTabs);

    if (activeTabId !== tabId) {
      return;
    }
    setActiveTabId(nextTabs.length > 0 ? nextTabs[nextTabs.length - 1].id : null);
  }, [activeTabId, applySftpTransferEvent, drainUploadQueue, terminalApi, terminalTabs]);

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

  const setPreferredOpenProgramPath = (value: string) => {
    setFileOpenPreferences((prev) => ({
      ...prev,
      preferredProgramPath: value
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

  const pickPreferredOpenProgram = async () => {
    try {
      if (!systemApi) {
        throw new Error("System bridge unavailable. Restart `pnpm dev`.");
      }
      const programPath = await systemApi.pickOpenProgram();
      if (!programPath) {
        return;
      }
      setPreferredOpenProgramPath(programPath);
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

  const renameSelectedSftpEntry = async (entry?: SftpEntry | null) => {
    if (!sftpApi) {
      setSftpError("SFTP bridge unavailable. Restart `pnpm dev`.");
      return;
    }
    if (!activeTabId || !sftpDirectory) {
      setSftpError("Open a terminal tab before managing SFTP files.");
      return;
    }
    const targetEntry = entry ?? selectedSftpEntry;
    if (!targetEntry) {
      setSftpError("Select a file or directory first.");
      return;
    }

    const nameInput = window.prompt("Rename to", targetEntry.name);
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
      await sftpApi.renamePath(activeTabId, targetEntry.path, trimmedName);
      setSelectedSftpPath(null);
      await loadSftpDirectory(sftpDirectory.cwd, { tabId: activeTabId });
    } catch (caughtError) {
      setSftpError((caughtError as Error).message);
    } finally {
      setSftpActionLoading(false);
    }
  };

  const deleteSelectedSftpEntry = async (entry?: SftpEntry | null) => {
    if (!sftpApi) {
      setSftpError("SFTP bridge unavailable. Restart `pnpm dev`.");
      return;
    }
    if (!activeTabId || !sftpDirectory) {
      setSftpError("Open a terminal tab before managing SFTP files.");
      return;
    }
    const targetEntry = entry ?? selectedSftpEntry;
    if (!targetEntry) {
      setSftpError("Select a file or directory first.");
      return;
    }

    const accepted = window.confirm(
      `Delete ${targetEntry.kind === "directory" ? "directory" : "file"} "${targetEntry.name}"?`
    );
    if (!accepted) {
      return;
    }

    setSftpActionLoading(true);
    setSftpError(null);
    try {
      await sftpApi.deletePath(activeTabId, targetEntry.path, targetEntry.kind);
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

  const openSftpEntryFile = async (entry?: SftpEntry | null) => {
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
    const targetEntry = entry ?? selectedSftpEntry;
    if (!targetEntry || targetEntry.kind === "directory") {
      setSftpError("Select a file first.");
      return;
    }

    try {
      setSftpError(null);
      const tempLocalPath = await systemApi.createTempOpenFilePath(targetEntry.name);
      await sftpApi.downloadFile(
        activeTabId,
        createTransferId("down"),
        targetEntry.path,
        tempLocalPath
      );
      const preferredProgramPath = fileOpenPreferences.preferredProgramPath.trim();
      await systemApi.openLocalPath(
        tempLocalPath,
        preferredProgramPath.length > 0 ? preferredProgramPath : null
      );
    } catch (caughtError) {
      setSftpError((caughtError as Error).message);
    }
  };

  const downloadSelectedSftpEntry = async (entry?: SftpEntry | null) => {
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
    const targetEntry = entry ?? selectedSftpEntry;
    if (!targetEntry || targetEntry.kind === "directory") {
      setSftpError("Select a file first.");
      return;
    }

    const localPath = await systemApi.pickDownloadTarget(targetEntry.name);
    if (!localPath) {
      return;
    }

    try {
      setSftpError(null);
      await sftpApi.downloadFile(
        activeTabId,
        createTransferId("down"),
        targetEntry.path,
        localPath
      );
    } catch (caughtError) {
      setSftpError((caughtError as Error).message);
    }
  };

  const uploadLocalPathsToSftp = async (paths: string[]) => {
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
    if (paths.length === 0) {
      return;
    }

    setSftpError(null);
    const expandedPaths = await systemApi.expandUploadPaths(paths);
    if (expandedPaths.length === 0) {
      setSftpError("No valid files to upload.");
      return;
    }

    const queuedJobs: PendingUploadJob[] = [];
    for (const pathEntry of expandedPaths as LocalUploadPathEntry[]) {
      const localPath = pathEntry.localPath.trim();
      const name = getPathBaseName(localPath);
      if (!name) {
        continue;
      }
      const relativeDirectory = normalizeRelativeDirectoryPath(pathEntry.relativeDirectory);
      const transferId = createTransferId("up");
      const remoteDirectory = relativeDirectory
        ? joinRemotePath(sftpDirectory.cwd, relativeDirectory)
        : sftpDirectory.cwd;
      const remotePath = joinRemotePath(remoteDirectory, name);
      const nextJob: PendingUploadJob = {
        tabId: activeTabId,
        transferId,
        localPath,
        remoteDirectory,
        remotePath,
        name
      };
      queuedJobs.push(nextJob);
      applySftpTransferEvent({
        tabId: nextJob.tabId,
        transferId: nextJob.transferId,
        direction: "upload",
        status: "queued",
        name: nextJob.name,
        localPath: nextJob.localPath,
        remotePath: nextJob.remotePath,
        transferredBytes: 0,
        totalBytes: 0,
        message: "queued"
      });
    }
    if (queuedJobs.length === 0) {
      setSftpError("No valid files to upload.");
      return;
    }
    uploadQueueRef.current.push(...queuedJobs);
    drainUploadQueue();
  };

  const cancelSftpUpload = async (transfer: SftpTransferItem) => {
    if (transfer.direction === "upload" && transfer.status === "queued") {
      const queueIndex = uploadQueueRef.current.findIndex(
        (job) => job.tabId === transfer.tabId && job.transferId === transfer.transferId
      );
      if (queueIndex >= 0) {
        const [queuedJob] = uploadQueueRef.current.splice(queueIndex, 1);
        applySftpTransferEvent({
          tabId: queuedJob.tabId,
          transferId: queuedJob.transferId,
          direction: "upload",
          status: "canceled",
          name: queuedJob.name,
          localPath: queuedJob.localPath,
          remotePath: queuedJob.remotePath,
          transferredBytes: 0,
          totalBytes: 0,
          message: "canceled"
        });
        drainUploadQueue();
        return;
      }
    }
    if (!sftpApi) {
      setSftpError("SFTP bridge unavailable. Restart `pnpm dev`.");
      return;
    }
    try {
      await sftpApi.cancelUpload(transfer.tabId, transfer.transferId);
    } catch (caughtError) {
      const message = (caughtError as Error).message;
      if (!isTransferCanceledMessage(message)) {
        setSftpError(message);
      }
    }
  };

  const cancelSftpDownload = async (transfer: SftpTransferItem) => {
    if (!sftpApi) {
      setSftpError("SFTP bridge unavailable. Restart `pnpm dev`.");
      return;
    }
    try {
      await sftpApi.cancelDownload(transfer.tabId, transfer.transferId);
    } catch (caughtError) {
      const message = (caughtError as Error).message;
      if (!isTransferCanceledMessage(message)) {
        setSftpError(message);
      }
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

  const runSftpContextAction = (action: SftpContextAction) => {
    if (action.disabled) {
      return;
    }
    closeSftpContextMenu();
    action.run();
  };

  const sftpContextActions: SftpContextAction[] = [];
  const isSftpActionDisabled = sftpLoading || sftpActionLoading;
  if (sftpContextEntry?.kind === "directory") {
    sftpContextActions.push({
      id: "open-directory",
      label: "Open Directory",
      run: () => {
        void loadSftpDirectory(sftpContextEntry.path);
      }
    });
  }
  if (sftpContextEntry && sftpContextEntry.kind !== "directory") {
    sftpContextActions.push({
      id: "open-file",
      label: "Open File",
      disabled: isSftpActionDisabled,
      run: () => {
        void openSftpEntryFile(sftpContextEntry);
      }
    });
    sftpContextActions.push({
      id: "download-file",
      label: "Download File",
      disabled: isSftpActionDisabled,
      run: () => {
        void downloadSelectedSftpEntry(sftpContextEntry);
      }
    });
  }
  sftpContextActions.push({
    id: "upload-file",
    label: "Upload File",
    disabled: isSftpActionDisabled,
    run: () => {
      void uploadLocalFileToSftp();
    }
  });
  sftpContextActions.push({
    id: "create-directory",
    label: "New Folder",
    disabled: isSftpActionDisabled,
    run: () => {
      void createSftpDirectory();
    }
  });
  sftpContextActions.push({
    id: "refresh-directory",
    label: "Refresh",
    disabled: isSftpActionDisabled,
    run: () => {
      void loadSftpDirectory(sftpDirectory?.cwd ?? sftpPath);
    }
  });
  if (sftpContextEntry) {
    sftpContextActions.push({
      id: "rename-entry",
      label: "Rename",
      disabled: isSftpActionDisabled,
      run: () => {
        void renameSelectedSftpEntry(sftpContextEntry);
      }
    });
    sftpContextActions.push({
      id: "delete-entry",
      label: "Delete",
      disabled: isSftpActionDisabled,
      run: () => {
        void deleteSelectedSftpEntry(sftpContextEntry);
      }
    });
    sftpContextActions.push({
      id: "copy-entry-path",
      label: "Copy Path",
      run: () => {
        void (async () => {
          try {
            const copied = await copyTextToClipboard(sftpContextEntry.path);
            if (copied) {
              return;
            }
          } catch {
            // Fallback to prompt for manual copy.
          }
          window.prompt("Copy remote path", sftpContextEntry.path);
        })();
      }
    });
  } else if (sftpDirectory?.cwd) {
    sftpContextActions.push({
      id: "copy-current-path",
      label: "Copy Current Path",
      run: () => {
        void (async () => {
          try {
            const copied = await copyTextToClipboard(sftpDirectory.cwd);
            if (copied) {
              return;
            }
          } catch {
            // Fallback to prompt for manual copy.
          }
          window.prompt("Copy current path", sftpDirectory.cwd);
        })();
      }
    });
  }

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
                    Drop files or folders into this box to upload to current directory.
                  </p>
                  <div
                    className="sftp-drop-zone__body"
                    onContextMenu={(event) => openSftpContextMenu(event)}
                  >
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
                          onDoubleClick={() => {
                            if (entry.kind === "directory") {
                              return;
                            }
                            void openSftpEntryFile(entry);
                          }}
                          onContextMenu={(event) => openSftpContextMenu(event, entry)}
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
                  <p className="hint sftp-transfer-panel__title">
                    Transfer status (upload running {activeUploadQueueStats.running}, upload queued {activeUploadQueueStats.queued}, max {UPLOAD_MAX_CONCURRENCY})
                  </p>
                  {activeSftpTransfers.length > 0 ? (
                    <ul className="sftp-transfer-list">
                      {activeSftpTransfers.map((transfer) => {
                        const canCancelTransfer =
                          transfer.status === "queued" || transfer.status === "running";
                        return (
                          <li className={`sftp-transfer sftp-transfer--${transfer.status}`} key={transfer.transferId}>
                            <span className="sftp-transfer__icon">
                              {transfer.direction === "upload" ? "↑" : "↓"}
                            </span>
                            <span className="sftp-transfer__name">{transfer.name}</span>
                            <span className="sftp-transfer__progress">{formatTransferProgress(transfer)}</span>
                            {canCancelTransfer ? (
                              <button
                                aria-label={`Cancel ${transfer.direction}`}
                                className="icon-button sftp-transfer__cancel"
                                onClick={() => {
                                  if (transfer.direction === "upload") {
                                    void cancelSftpUpload(transfer);
                                    return;
                                  }
                                  void cancelSftpDownload(transfer);
                                }}
                                title={`Cancel ${transfer.direction}`}
                                type="button"
                              >
                                ✕
                              </button>
                            ) : null}
                          </li>
                        );
                      })}
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

      {sftpContextMenu ? (
        <div
          className="sftp-context-menu"
          onContextMenu={(event) => event.preventDefault()}
          ref={sftpContextMenuRef}
          style={{
            left: `${Math.max(8, Math.min(sftpContextMenu.x, window.innerWidth - 196))}px`,
            top: `${Math.max(8, Math.min(sftpContextMenu.y, window.innerHeight - 232))}px`
          }}
        >
          {sftpContextActions.map((action) => (
            <button
              className="sftp-context-menu__item"
              disabled={action.disabled}
              key={action.id}
              onClick={() => runSftpContextAction(action)}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}

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
              <h4 className="settings-group__title">File Opening</h4>
              <label>
                Open Program (optional)
                <div className="field-row">
                  <input
                    onChange={(event) => setPreferredOpenProgramPath(event.target.value)}
                    placeholder={
                      isMacPlatform
                        ? "/Applications/TextEdit.app"
                        : "C:\\Program Files\\Notepad++\\notepad++.exe"
                    }
                    value={fileOpenPreferences.preferredProgramPath}
                  />
                  <button
                    className="field-row__action"
                    onClick={() => {
                      void pickPreferredOpenProgram();
                    }}
                    type="button"
                  >
                    Browse
                  </button>
                </div>
              </label>
              <p className="hint">
                Leave empty to use system default app. Used by SFTP "Open File" and file double-click.
              </p>
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
