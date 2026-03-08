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

import {
  ArrowUp,
  ChevronLeft,
  Download,
  Menu,
  Minus,
  Plus,
  RefreshCw,
  Settings,
  Upload,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import packageJson from "../../package.json";

import type {
  SessionCreateInput,
  SessionRecord,
  SshConfigParseResult,
  SessionUpdateInput
} from "../shared/session";
import type {
  SftpDirectoryListResult,
  SftpEntry,
  SftpTransferEvent
} from "../shared/sftp";
import type {
  CreatePortForwardInput,
  PortForwardEventRecord,
  PortForwardRecord,
  ServerHealthSnapshot,
  ServerProcessSnapshot
} from "../shared/terminal";
import { TerminalWorkspace } from "./components/terminal-workspace";
import type {
  ConnectionPreferences,
  HotkeyBindingPreference,
  HotkeyModifier,
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
  groupId: "",
  remark: "",
  favorite: false,
  secret: ""
};

const CONNECTION_PREFERENCES_STORAGE_KEY = "termdock.connection-preferences.v1";
const HOTKEY_PREFERENCES_STORAGE_KEY = "termdock.hotkey-preferences.v1";
const FILE_OPEN_PREFERENCES_STORAGE_KEY = "termdock.file-open-preferences.v1";
const SFTP_TRANSFER_PREFERENCES_STORAGE_KEY = "termdock.sftp-transfer-preferences.v1";
const SFTP_TRANSFER_HISTORY_STORAGE_KEY = "termdock.sftp-transfer-history.v1";
const PORT_FORWARD_PRESETS_STORAGE_KEY = "termdock.port-forward-presets.v1";
const PORT_FORWARD_EVENT_HISTORY_STORAGE_KEY = "termdock.port-forward-event-history.v1";
const SESSION_GROUPS_STORAGE_KEY = "termdock.session-groups.v1";
const SESSION_SORT_MODE_STORAGE_KEY = "termdock.session-sort-mode.v1";
const SERVER_HEALTH_ALERT_PREFERENCES_STORAGE_KEY = "termdock.server-health-alert-preferences.v1";
const MAX_SFTP_TRANSFER_HISTORY = 800;
const MAX_PORT_FORWARD_EVENT_HISTORY = 1200;
const MAX_PORT_FORWARD_EVENT_HISTORY_PER_SESSION = 320;
const DEFAULT_CONNECTION_PREFERENCES: ConnectionPreferences = {
  autoReconnect: true,
  reconnectDelaySeconds: 3
};
const APP_VERSION = typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
type SettingsSectionId =
  | "connection"
  | "hotkeys"
  | "serverHealth"
  | "fileOpening"
  | "sftp"
  | "portForwarding"
  | "diagnostics";
type SessionSortMode = "default" | "nameAsc" | "nameDesc" | "recent";
type TransferHistoryScope = "activeSession" | "allSessions";
type TransferHistoryDirectionFilter = "all" | SftpTransferEvent["direction"];
type TransferHistoryStatusFilter = "all" | SftpTransferEvent["status"];

type HotkeyActionId = keyof HotkeyPreferences;

type HotkeyModifierOption = {
  value: HotkeyModifier;
  label: string;
};

const HOTKEY_ACTION_ORDER: HotkeyActionId[] = [
  "openSessionTab",
  "closeActiveTab",
  "terminalCopy",
  "terminalPaste",
  "terminalSearch"
];

const HOTKEY_KEY_PLACEHOLDER = "A-Z";
interface FileOpenPreferences {
  preferredProgramPath: string;
}

interface SftpTransferPreferences {
  uploadConcurrency: number;
  downloadConcurrency: number;
}

interface SessionGroupsState {
  groups: string[];
}

interface ServerHealthAlertPreferences {
  enabled: boolean;
  cpuWarnPercent: number;
  memoryWarnPercent: number;
  diskWarnPercent: number;
}

const DEFAULT_FILE_OPEN_PREFERENCES: FileOpenPreferences = {
  preferredProgramPath: ""
};
const DEFAULT_SFTP_TRANSFER_PREFERENCES: SftpTransferPreferences = {
  uploadConcurrency: 2,
  downloadConcurrency: 2
};
const DEFAULT_SERVER_HEALTH_ALERT_PREFERENCES: ServerHealthAlertPreferences = {
  enabled: true,
  cpuWarnPercent: 85,
  memoryWarnPercent: 85,
  diskWarnPercent: 90
};
const DEFAULT_PORT_FORWARD_FORM: PortForwardFormState = {
  type: "local",
  bindHost: "127.0.0.1",
  bindPort: "8080",
  targetHost: "127.0.0.1",
  targetPort: "80"
};

function isMacPlatformRuntime(): boolean {
  return typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
}

function createDefaultHotkeyPreferences(): HotkeyPreferences {
  const isMac = isMacPlatformRuntime();
  if (!isMac) {
    // Windows: keep open/close/search on Alt and use Ctrl+Shift+C / Ctrl+Shift+V for terminal clipboard.
    return {
      openSessionTab: { enabled: true, modifier: "alt", key: "t" },
      closeActiveTab: { enabled: true, modifier: "altShift", key: "w" },
      terminalCopy: { enabled: true, modifier: "primaryShift", key: "c" },
      terminalPaste: { enabled: true, modifier: "primaryShift", key: "v" },
      terminalSearch: { enabled: true, modifier: "altShift", key: "f" }
    };
  }
  return {
    openSessionTab: { enabled: true, modifier: "primary", key: "t" },
    closeActiveTab: { enabled: true, modifier: "primary", key: "w" },
    terminalCopy: {
      enabled: true,
      modifier: "primary",
      key: "c"
    },
    terminalPaste: { enabled: true, modifier: "primary", key: "v" },
    terminalSearch: { enabled: true, modifier: "primary", key: "f" }
  };
}

const SERVER_HEALTH_POLL_INTERVAL_MS = 5000;
const SERVER_PROCESS_POLL_INTERVAL_MS = 10000;
const SERVER_HEALTH_HISTORY_LIMIT = 24;

interface SftpTransferItem extends SftpTransferEvent {
  updatedAt: number;
  batchId?: string;
  sessionId?: string;
}

interface SftpTransferHistoryItem {
  key: string;
  sessionId: string;
  direction: SftpTransferEvent["direction"];
  status: SftpTransferEvent["status"];
  name: string;
  localPath: string;
  remotePath: string;
  updatedAt: number;
  attemptCount: number;
  message?: string;
}

interface ServerHealthDerivedMetrics {
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  diskUsagePercent: number;
  rxBytesPerSecond: number;
  txBytesPerSecond: number;
}

interface ServerHealthHistoryPoint {
  at: number;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  diskUsagePercent: number;
  rxBytesPerSecond: number;
  txBytesPerSecond: number;
}

interface PortForwardFormState {
  type: CreatePortForwardInput["type"];
  bindHost: string;
  bindPort: string;
  targetHost: string;
  targetPort: string;
}

interface PortForwardPreset {
  id: string;
  sessionId: string;
  name: string;
  type: CreatePortForwardInput["type"];
  bindHost: string;
  bindPort: number;
  targetHost?: string;
  targetPort?: number;
  autoRestore: boolean;
  createdAt: number;
  updatedAt: number;
}

type PortForwardEventFilter = "all" | "errors" | "lifecycle" | "status";

interface PortForwardEventHistoryItem extends PortForwardEventRecord {
  key: string;
  sessionId: string;
}

interface PendingUploadJob {
  tabId: string;
  transferId: string;
  batchId: string;
  localPath: string;
  remoteDirectory: string;
  remotePath: string;
  name: string;
}

interface PendingDownloadJob {
  tabId: string;
  transferId: string;
  batchId: string;
  localPath: string;
  remotePath: string;
  name: string;
}

type TransferConflictStrategy = "overwrite" | "skip" | "rename";

interface UploadPathEntry {
  localPath: string;
  relativeDirectory: string;
  remoteName?: string;
}

interface DownloadTargetEntry {
  name: string;
  remotePath: string;
  localPath: string;
}

interface SftpContextMenuState {
  x: number;
  y: number;
  entryPath: string | null;
}

interface SftpToolbarMenuState {
  x: number;
  y: number;
}

interface SftpContextAction {
  id: string;
  label: string;
  disabled?: boolean;
  run: () => void;
}

interface SessionContextMenuState {
  x: number;
  y: number;
  target:
    | {
        type: "session";
        sessionId: string;
      }
    | {
        type: "group";
        groupKey: string;
        groupName: string;
        label: string;
      }
    | {
        type: "group-root";
      }
    | {
        type: "group-view";
        groupKey: string;
        groupName: string;
        label: string;
      };
}

interface SessionContextAction {
  id: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  run: () => void;
}

type AppDialogMode = "alert" | "confirm" | "prompt" | "choice";

interface AppDialogBaseState {
  mode: AppDialogMode;
  title: string;
  message: string;
  confirmLabel: string;
}

interface AppAlertDialogState extends AppDialogBaseState {
  mode: "alert";
  detailText?: string;
}

interface AppConfirmDialogState extends AppDialogBaseState {
  mode: "confirm";
  cancelLabel: string;
  danger?: boolean;
}

interface AppPromptDialogState extends AppDialogBaseState {
  mode: "prompt";
  cancelLabel: string;
  value: string;
  multiline?: boolean;
}

interface AppChoiceDialogOption {
  value: string;
  label: string;
  danger?: boolean;
}

interface AppChoiceDialogState extends AppDialogBaseState {
  mode: "choice";
  cancelLabel: string;
  options: AppChoiceDialogOption[];
}

type AppDialogState =
  | AppAlertDialogState
  | AppConfirmDialogState
  | AppPromptDialogState
  | AppChoiceDialogState;

interface AppAlertDialogOptions {
  title?: string;
  confirmLabel?: string;
  detailText?: string;
}

interface AppConfirmDialogOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface AppPromptDialogOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  multiline?: boolean;
}

interface AppChoiceDialogOptions {
  title?: string;
  cancelLabel?: string;
}

type UiIconName =
  | "settings"
  | "refresh"
  | "chevronLeft"
  | "arrowUp"
  | "upload"
  | "download"
  | "menu"
  | "close"
  | "plus"
  | "minus";

const UI_ICONS: Record<UiIconName, LucideIcon> = {
  settings: Settings,
  refresh: RefreshCw,
  chevronLeft: ChevronLeft,
  arrowUp: ArrowUp,
  upload: Upload,
  download: Download,
  menu: Menu,
  close: X,
  plus: Plus,
  minus: Minus
};

function UiIcon({ name }: { name: UiIconName }) {
  const Icon = UI_ICONS[name];
  return <Icon aria-hidden="true" className="ui-icon" strokeWidth={1.9} />;
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

function isHotkeyModifier(value: unknown): value is HotkeyModifier {
  return (
    value === "primary" ||
    value === "primaryShift" ||
    value === "alt" ||
    value === "altShift"
  );
}

function normalizeHotkeyKey(rawValue: unknown, fallback: string): string {
  if (typeof rawValue !== "string") {
    return fallback;
  }
  const normalized = rawValue.trim().slice(0, 1).toLowerCase();
  return normalized || fallback;
}

function normalizeEventHotkeyKey(event: KeyboardEvent): string {
  const code = event.code.trim();
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3).toLowerCase();
  }
  const normalized = event.key.trim();
  if (normalized.length !== 1) {
    return "";
  }
  return normalized.toLowerCase();
}

function buildSessionConnectionKey(host: string, port: number, username: string): string {
  return `${host.trim().toLowerCase()}:${port}:${username.trim().toLowerCase()}`;
}

function parseHotkeyBindingPreference(
  rawValue: unknown,
  fallback: HotkeyBindingPreference
): HotkeyBindingPreference {
  if (typeof rawValue === "boolean") {
    return {
      ...fallback,
      enabled: rawValue
    };
  }
  if (!rawValue || typeof rawValue !== "object") {
    return fallback;
  }

  const candidate = rawValue as Partial<HotkeyBindingPreference>;
  return {
    enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : fallback.enabled,
    modifier: isHotkeyModifier(candidate.modifier) ? candidate.modifier : fallback.modifier,
    key: normalizeHotkeyKey(candidate.key, fallback.key)
  };
}

function isLegacyWindowsPrimaryHotkeyDefaults(preferences: HotkeyPreferences): boolean {
  if (isMacPlatformRuntime()) {
    return false;
  }
  return (
    preferences.openSessionTab.enabled &&
    preferences.openSessionTab.modifier === "primary" &&
    preferences.openSessionTab.key === "t" &&
    preferences.closeActiveTab.enabled &&
    preferences.closeActiveTab.modifier === "primary" &&
    preferences.closeActiveTab.key === "w" &&
    preferences.terminalCopy.enabled &&
    preferences.terminalCopy.modifier === "primary" &&
    preferences.terminalCopy.key === "c" &&
    preferences.terminalPaste.enabled &&
    preferences.terminalPaste.modifier === "primary" &&
    preferences.terminalPaste.key === "v" &&
    preferences.terminalSearch.enabled &&
    preferences.terminalSearch.modifier === "primary" &&
    preferences.terminalSearch.key === "f"
  );
}

function isLegacyWindowsAltClipboardHotkeyDefaults(preferences: HotkeyPreferences): boolean {
  if (isMacPlatformRuntime()) {
    return false;
  }
  const sharedOpenCloseSearch =
    preferences.openSessionTab.enabled &&
    preferences.openSessionTab.modifier === "alt" &&
    preferences.openSessionTab.key === "t" &&
    preferences.closeActiveTab.enabled &&
    preferences.closeActiveTab.modifier === "altShift" &&
    preferences.closeActiveTab.key === "w" &&
    preferences.terminalSearch.enabled &&
    preferences.terminalSearch.modifier === "altShift" &&
    preferences.terminalSearch.key === "f";
  if (!sharedOpenCloseSearch) {
    return false;
  }
  const isOldAltShiftPaste =
    preferences.terminalCopy.enabled &&
    preferences.terminalCopy.modifier === "alt" &&
    preferences.terminalCopy.key === "c" &&
    preferences.terminalPaste.enabled &&
    preferences.terminalPaste.modifier === "altShift" &&
    preferences.terminalPaste.key === "v";
  const isOldAltClipboard =
    preferences.terminalCopy.enabled &&
    preferences.terminalCopy.modifier === "alt" &&
    preferences.terminalCopy.key === "c" &&
    preferences.terminalPaste.enabled &&
    preferences.terminalPaste.modifier === "alt" &&
    preferences.terminalPaste.key === "v";
  const isOldCtrlShiftClipboard =
    preferences.terminalCopy.enabled &&
    preferences.terminalCopy.modifier === "primaryShift" &&
    preferences.terminalCopy.key === "c" &&
    preferences.terminalPaste.enabled &&
    preferences.terminalPaste.modifier === "primaryShift" &&
    preferences.terminalPaste.key === "v";
  return isOldAltShiftPaste || isOldAltClipboard || isOldCtrlShiftClipboard;
}

function matchesHotkeyBinding(event: KeyboardEvent, binding: HotkeyBindingPreference): boolean {
  if (!binding.enabled) {
    return false;
  }

  const key = normalizeEventHotkeyKey(event);
  if (!key || key !== binding.key) {
    return false;
  }

  const requiresPrimary = binding.modifier === "primary" || binding.modifier === "primaryShift";
  const requiresAlt = binding.modifier === "alt" || binding.modifier === "altShift";
  const requiresShift = binding.modifier === "primaryShift" || binding.modifier === "altShift";
  const isMac = isMacPlatformRuntime();
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
  if (isMac ? event.ctrlKey : event.metaKey) {
    return false;
  }
  return true;
}

function getHotkeyModifierLabel(modifier: HotkeyModifier, isMacPlatform: boolean): string {
  const primary = isMacPlatform ? "Cmd" : "Ctrl";
  const alt = isMacPlatform ? "Option" : "Alt";
  switch (modifier) {
    case "primary":
      return primary;
    case "primaryShift":
      return `${primary}+Shift`;
    case "alt":
      return alt;
    case "altShift":
      return `${alt}+Shift`;
    default:
      return primary;
  }
}

function formatHotkeyBindingLabel(
  binding: HotkeyBindingPreference,
  isMacPlatform: boolean
): string {
  const key = binding.key.toUpperCase();
  return `${getHotkeyModifierLabel(binding.modifier, isMacPlatform)} + ${key}`;
}

function getHotkeyModifierOptions(isMacPlatform: boolean): HotkeyModifierOption[] {
  return [
    {
      value: "primary",
      label: isMacPlatform ? "Cmd" : "Ctrl"
    },
    {
      value: "primaryShift",
      label: isMacPlatform ? "Cmd + Shift" : "Ctrl + Shift"
    },
    {
      value: "alt",
      label: isMacPlatform ? "Option" : "Alt"
    },
    {
      value: "altShift",
      label: isMacPlatform ? "Option + Shift" : "Alt + Shift"
    }
  ];
}

function getHotkeyActionDescription(action: HotkeyActionId): string {
  switch (action) {
    case "openSessionTab":
      return "Open selected session in new tab";
    case "closeActiveTab":
      return "Close active terminal tab";
    case "terminalCopy":
      return "Terminal copy (Windows defaults to Ctrl+Shift+C)";
    case "terminalPaste":
      return "Terminal paste (Windows defaults to Ctrl+Shift+V)";
    case "terminalSearch":
      return "Search in terminal";
    default:
      return action;
  }
}

function getSettingsSectionTitle(section: SettingsSectionId): string {
  switch (section) {
    case "connection":
      return "Connection";
    case "hotkeys":
      return "Hotkeys";
    case "serverHealth":
      return "Server Health Alerts";
    case "fileOpening":
      return "File Opening";
    case "sftp":
      return "SFTP Transfers";
    case "portForwarding":
      return "Port Forwarding";
    case "diagnostics":
      return "Diagnostics";
    default:
      return "Settings";
  }
}

function formatPortForwardRecord(record: PortForwardRecord): string {
  if (record.type === "local") {
    return `[L] ${record.bindHost}:${record.bindPort} -> ${record.targetHost}:${record.targetPort}`;
  }
  if (record.type === "remote") {
    return `[R] ${record.bindHost}:${record.bindPort} -> ${record.targetHost}:${record.targetPort}`;
  }
  return `[D] SOCKS5 ${record.bindHost}:${record.bindPort}`;
}

function formatPortForwardPreset(preset: PortForwardPreset): string {
  if (preset.type === "local") {
    return `[L] ${preset.bindHost}:${preset.bindPort} -> ${preset.targetHost}:${preset.targetPort}`;
  }
  if (preset.type === "remote") {
    return `[R] ${preset.bindHost}:${preset.bindPort} -> ${preset.targetHost}:${preset.targetPort}`;
  }
  return `[D] SOCKS5 ${preset.bindHost}:${preset.bindPort}`;
}

function getPortForwardStatusLabel(record: PortForwardRecord): string {
  return record.status === "degraded" ? "Degraded" : "Active";
}

function formatPortForwardTimestamp(isoString?: string): string {
  if (!isoString) {
    return "-";
  }
  const parsed = new Date(isoString);
  if (!Number.isFinite(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleString();
}

function formatPortForwardEventType(type: PortForwardEventRecord["type"]): string {
  if (type === "created") {
    return "Created";
  }
  if (type === "removed") {
    return "Removed";
  }
  if (type === "statusRecovered") {
    return "Recovered";
  }
  return "Degraded";
}

function formatPortForwardEventSummary(event: PortForwardEventRecord): string {
  const prefix = event.forwardType === "dynamic" ? "[D]" : event.forwardType === "remote" ? "[R]" : "[L]";
  return `${prefix} ${event.bindHost}:${event.bindPort}`;
}

function toPortForwardErrorMessage(error: unknown): string {
  const raw = toLogMessage(error);
  if (/EADDRINUSE|address already in use/i.test(raw)) {
    return "Listen host/port is already in use. Pick another bind address or stop the conflicting process.";
  }
  if (/EACCES|EPERM|permission denied/i.test(raw)) {
    return "Permission denied when opening the forward. Try a higher port or adjust system permissions.";
  }
  if (/ENOTFOUND|getaddrinfo/i.test(raw)) {
    return "Target host could not be resolved. Check DNS or host spelling.";
  }
  if (/ECONNREFUSED|connection refused/i.test(raw)) {
    return "Target refused the forwarded connection. Verify target host/port is listening.";
  }
  if (/ETIMEDOUT|timed out/i.test(raw)) {
    return "Forwarded connection timed out. Check network reachability and firewall rules.";
  }
  if (/administratively prohibited|open failed/i.test(raw)) {
    return "SSH server rejected the forwarded channel. Verify server forwarding policy.";
  }
  return raw;
}

function buildDefaultPortForwardPresetName(input: PortForwardFormState): string {
  if (input.type === "dynamic") {
    return `SOCKS ${input.bindHost.trim() || "127.0.0.1"}:${input.bindPort.trim() || "1080"}`;
  }
  const prefix = input.type === "local" ? "L" : "R";
  return `${prefix} ${input.bindHost.trim() || "127.0.0.1"}:${input.bindPort.trim() || "0"} -> ${input.targetHost.trim() || "127.0.0.1"}:${input.targetPort.trim() || "0"}`;
}

function buildPortForwardInputFromForm(form: PortForwardFormState): CreatePortForwardInput {
  const bindHost = form.bindHost.trim() || "127.0.0.1";
  const bindPort = Number.parseInt(form.bindPort, 10);
  if (!Number.isFinite(bindPort) || bindPort < 1 || bindPort > 65535) {
    throw new Error("Listen port must be between 1 and 65535.");
  }
  if (form.type === "dynamic") {
    return {
      type: "dynamic",
      bindHost,
      bindPort
    };
  }
  const targetHost = form.targetHost.trim();
  if (!targetHost) {
    throw new Error(
      form.type === "local" ? "Remote target host is required." : "Local target host is required."
    );
  }
  const targetPort = Number.parseInt(form.targetPort, 10);
  if (!Number.isFinite(targetPort) || targetPort < 1 || targetPort > 65535) {
    throw new Error(
      form.type === "local"
        ? "Remote target port must be between 1 and 65535."
        : "Local target port must be between 1 and 65535."
    );
  }
  return {
    type: form.type,
    bindHost,
    bindPort,
    targetHost,
    targetPort
  };
}

function buildPortForwardInputFromPreset(preset: PortForwardPreset): CreatePortForwardInput {
  if (preset.type === "dynamic") {
    return {
      type: "dynamic",
      bindHost: preset.bindHost,
      bindPort: preset.bindPort
    };
  }
  return {
    type: preset.type,
    bindHost: preset.bindHost,
    bindPort: preset.bindPort,
    targetHost: preset.targetHost,
    targetPort: preset.targetPort
  };
}

function toPortForwardFormFromPreset(preset: PortForwardPreset): PortForwardFormState {
  return {
    type: preset.type,
    bindHost: preset.bindHost,
    bindPort: `${preset.bindPort}`,
    targetHost: preset.targetHost ?? "",
    targetPort: preset.targetPort ? `${preset.targetPort}` : ""
  };
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

function isSftpTransferDirection(value: unknown): value is SftpTransferEvent["direction"] {
  return value === "upload" || value === "download";
}

function isSftpTransferStatus(value: unknown): value is SftpTransferEvent["status"] {
  return (
    value === "queued" ||
    value === "running" ||
    value === "completed" ||
    value === "failed" ||
    value === "canceled"
  );
}

function isPortForwardTypeValue(value: unknown): value is CreatePortForwardInput["type"] {
  return value === "local" || value === "remote" || value === "dynamic";
}

function isPortForwardEventTypeValue(value: unknown): value is PortForwardEventRecord["type"] {
  return (
    value === "created" ||
    value === "removed" ||
    value === "statusRecovered" ||
    value === "statusDegraded"
  );
}

function isPortForwardEventLevelValue(value: unknown): value is PortForwardEventRecord["level"] {
  return value === "info" || value === "error";
}

function isTerminalTransferStatus(status: SftpTransferEvent["status"]): boolean {
  return status === "completed" || status === "failed" || status === "canceled";
}

function createTransferHistoryKey(
  sessionId: string,
  direction: SftpTransferEvent["direction"],
  localPath: string,
  remotePath: string
): string {
  return `${sessionId}\u0000${direction}\u0000${localPath}\u0000${remotePath}`;
}

function createTransferRetryKey(
  direction: SftpTransferEvent["direction"],
  localPath: string,
  remotePath: string
): string {
  return `${direction}\u0000${localPath}\u0000${remotePath}`;
}

function createTransferId(prefix: "up" | "down"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createPortForwardPresetId(): string {
  return `pfp-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createPortForwardEventHistoryKey(sessionId: string, eventId: string): string {
  return `${sessionId}\u0000${eventId}`;
}

function getPathBaseName(pathValue: string): string {
  const normalized = pathValue.replaceAll("\\", "/");
  const marker = normalized.lastIndexOf("/");
  if (marker < 0) {
    return normalized;
  }
  return normalized.slice(marker + 1);
}

function getPathDirectoryName(pathValue: string): string {
  const normalized = pathValue.replaceAll("\\", "/");
  const marker = normalized.lastIndexOf("/");
  if (marker < 0) {
    return "";
  }
  if (marker === 0) {
    return "/";
  }
  return normalized.slice(0, marker);
}

function splitFileName(name: string): {
  stem: string;
  extension: string;
} {
  const marker = name.lastIndexOf(".");
  if (marker <= 0) {
    return {
      stem: name,
      extension: ""
    };
  }
  return {
    stem: name.slice(0, marker),
    extension: name.slice(marker)
  };
}

function pickAvailableFileName(targetName: string, usedNames: Set<string>): string {
  if (!usedNames.has(targetName)) {
    return targetName;
  }
  const { stem, extension } = splitFileName(targetName);
  let suffix = 1;
  while (true) {
    const nextName = `${stem} (${suffix})${extension}`;
    if (!usedNames.has(nextName)) {
      return nextName;
    }
    suffix += 1;
  }
}

function toTransferConflictStrategy(value: string | null): TransferConflictStrategy | null {
  if (value === "overwrite" || value === "skip" || value === "rename") {
    return value;
  }
  return null;
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

function sanitizeLocalPathSegment(segment: string): string {
  const normalized = typeof segment === "string" ? segment.trim() : "";
  const sanitized = normalized
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();
  return sanitized || "unnamed";
}

function joinLocalPath(basePath: string, relativePath: string): string {
  const normalizedBase = basePath.replace(/[\\/]+$/g, "");
  const normalizedRelative = relativePath
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment.length > 0)
    .join("/");
  if (!normalizedRelative) {
    return normalizedBase;
  }
  return `${normalizedBase}/${normalizedRelative}`;
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

function formatHistoryTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "-";
  }
  const value = new Date(timestamp);
  if (!Number.isFinite(value.getTime())) {
    return "-";
  }
  return value.toLocaleString();
}

function formatSshConfigPreview(result: SshConfigParseResult): string {
  const lines: string[] = [];
  lines.push(`File: ${result.filePath}`);
  lines.push(`Parsed hosts: ${result.candidates.length}`);
  lines.push("");
  const previewRows = result.candidates.slice(0, 30);
  for (const candidate of previewRows) {
    const authLabel =
      candidate.authType === "privateKey" && candidate.privateKeyPath
        ? `key=${candidate.privateKeyPath}`
        : "password";
    lines.push(
      `- ${candidate.name}: ${candidate.username}@${candidate.host}:${candidate.port} (${authLabel})`
    );
  }
  if (result.candidates.length > previewRows.length) {
    lines.push(`... ${result.candidates.length - previewRows.length} more host entries`);
  }
  if (result.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of result.warnings.slice(0, 10)) {
      lines.push(`- ${warning}`);
    }
    if (result.warnings.length > 10) {
      lines.push(`... ${result.warnings.length - 10} more warnings`);
    }
  }
  return lines.join("\n");
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0%";
  }
  return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
}

function formatProcessPercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0.0%";
  }
  return `${Math.max(0, value).toFixed(1)}%`;
}

function formatServerUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "-";
  }
  const totalSeconds = Math.max(0, Math.trunc(seconds));
  const days = Math.trunc(totalSeconds / 86400);
  const hours = Math.trunc((totalSeconds % 86400) / 3600);
  const minutes = Math.trunc((totalSeconds % 3600) / 60);
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function deriveServerHealthMetrics(
  current: ServerHealthSnapshot,
  previous: ServerHealthSnapshot | null
): ServerHealthDerivedMetrics {
  const memoryUsagePercent =
    current.memoryTotalBytes > 0
      ? (current.memoryUsedBytes / current.memoryTotalBytes) * 100
      : 0;
  const diskUsagePercent =
    current.diskTotalBytes > 0 ? (current.diskUsedBytes / current.diskTotalBytes) * 100 : 0;

  let cpuUsagePercent = 0;
  let rxBytesPerSecond = 0;
  let txBytesPerSecond = 0;
  if (previous && previous.tabId === current.tabId) {
    const totalTicksDelta = current.cpuTotalTicks - previous.cpuTotalTicks;
    const idleTicksDelta = current.cpuIdleTicks - previous.cpuIdleTicks;
    if (totalTicksDelta > 0) {
      cpuUsagePercent = ((totalTicksDelta - idleTicksDelta) / totalTicksDelta) * 100;
    }

    const currentMillis = new Date(current.collectedAt).getTime();
    const previousMillis = new Date(previous.collectedAt).getTime();
    const elapsedSeconds = (currentMillis - previousMillis) / 1000;
    if (elapsedSeconds > 0) {
      const rxDelta = current.networkRxBytes - previous.networkRxBytes;
      const txDelta = current.networkTxBytes - previous.networkTxBytes;
      rxBytesPerSecond = rxDelta > 0 ? rxDelta / elapsedSeconds : 0;
      txBytesPerSecond = txDelta > 0 ? txDelta / elapsedSeconds : 0;
    }
  }

  return {
    cpuUsagePercent: Number.isFinite(cpuUsagePercent)
      ? Math.max(0, Math.min(100, cpuUsagePercent))
      : 0,
    memoryUsagePercent: Number.isFinite(memoryUsagePercent)
      ? Math.max(0, Math.min(100, memoryUsagePercent))
      : 0,
    diskUsagePercent: Number.isFinite(diskUsagePercent)
      ? Math.max(0, Math.min(100, diskUsagePercent))
      : 0,
    rxBytesPerSecond: Number.isFinite(rxBytesPerSecond) ? Math.max(0, rxBytesPerSecond) : 0,
    txBytesPerSecond: Number.isFinite(txBytesPerSecond) ? Math.max(0, txBytesPerSecond) : 0
  };
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

function parseTransferConcurrency(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(8, Math.max(1, Math.trunc(value)));
}

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

function parseAlertThresholdPercent(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(100, Math.max(50, Math.trunc(value)));
}

function isSessionSortMode(value: unknown): value is SessionSortMode {
  return (
    value === "default" ||
    value === "nameAsc" ||
    value === "nameDesc" ||
    value === "recent"
  );
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

function readSessionSortMode(): SessionSortMode {
  if (typeof window === "undefined") {
    return "default";
  }
  try {
    const rawValue = window.localStorage.getItem(SESSION_SORT_MODE_STORAGE_KEY);
    return isSessionSortMode(rawValue) ? rawValue : "default";
  } catch {
    return "default";
  }
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
    return createDefaultHotkeyPreferences();
  }
  try {
    const rawValue = window.localStorage.getItem(HOTKEY_PREFERENCES_STORAGE_KEY);
    if (!rawValue) {
      return createDefaultHotkeyPreferences();
    }
    const parsed = JSON.parse(rawValue) as Partial<HotkeyPreferences>;
    const defaults = createDefaultHotkeyPreferences();
    const nextPreferences: HotkeyPreferences = {
      openSessionTab: parseHotkeyBindingPreference(parsed.openSessionTab, defaults.openSessionTab),
      closeActiveTab: parseHotkeyBindingPreference(parsed.closeActiveTab, defaults.closeActiveTab),
      terminalCopy: parseHotkeyBindingPreference(parsed.terminalCopy, defaults.terminalCopy),
      terminalPaste: parseHotkeyBindingPreference(parsed.terminalPaste, defaults.terminalPaste),
      terminalSearch: parseHotkeyBindingPreference(parsed.terminalSearch, defaults.terminalSearch)
    };
    if (
      isLegacyWindowsPrimaryHotkeyDefaults(nextPreferences) ||
      isLegacyWindowsAltClipboardHotkeyDefaults(nextPreferences)
    ) {
      return createDefaultHotkeyPreferences();
    }
    return nextPreferences;
  } catch {
    return createDefaultHotkeyPreferences();
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

function readSftpTransferPreferences(): SftpTransferPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_SFTP_TRANSFER_PREFERENCES;
  }
  try {
    const rawValue = window.localStorage.getItem(SFTP_TRANSFER_PREFERENCES_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_SFTP_TRANSFER_PREFERENCES;
    }
    const parsed = JSON.parse(rawValue) as Partial<SftpTransferPreferences>;
    return {
      uploadConcurrency: parseTransferConcurrency(
        parsed.uploadConcurrency,
        DEFAULT_SFTP_TRANSFER_PREFERENCES.uploadConcurrency
      ),
      downloadConcurrency: parseTransferConcurrency(
        parsed.downloadConcurrency,
        DEFAULT_SFTP_TRANSFER_PREFERENCES.downloadConcurrency
      )
    };
  } catch {
    return DEFAULT_SFTP_TRANSFER_PREFERENCES;
  }
}

function readSftpTransferHistory(): SftpTransferHistoryItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const rawValue = window.localStorage.getItem(SFTP_TRANSFER_HISTORY_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const normalized: SftpTransferHistoryItem[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") {
        continue;
      }
      const candidate = row as Partial<SftpTransferHistoryItem>;
      const sessionId =
        typeof candidate.sessionId === "string" ? candidate.sessionId.trim() : "";
      const localPath =
        typeof candidate.localPath === "string" ? candidate.localPath.trim() : "";
      const remotePath =
        typeof candidate.remotePath === "string" ? candidate.remotePath.trim() : "";
      const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
      const updatedAt =
        typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt)
          ? Math.max(0, Math.trunc(candidate.updatedAt))
          : 0;
      const attemptCount =
        typeof candidate.attemptCount === "number" && Number.isFinite(candidate.attemptCount)
          ? Math.max(1, Math.trunc(candidate.attemptCount))
          : 1;
      if (
        !sessionId ||
        !localPath ||
        !remotePath ||
        !name ||
        !updatedAt ||
        !isSftpTransferDirection(candidate.direction) ||
        !isSftpTransferStatus(candidate.status)
      ) {
        continue;
      }
      const key =
        typeof candidate.key === "string" && candidate.key.trim()
          ? candidate.key.trim()
          : createTransferHistoryKey(sessionId, candidate.direction, localPath, remotePath);
      const message =
        typeof candidate.message === "string" && candidate.message.trim().length > 0
          ? candidate.message.trim().slice(0, 500)
          : undefined;
      normalized.push({
        key,
        sessionId,
        direction: candidate.direction,
        status: candidate.status,
        name,
        localPath,
        remotePath,
        updatedAt,
        attemptCount,
        message
      });
    }
    normalized.sort((left, right) => right.updatedAt - left.updatedAt);
    return normalized.slice(0, MAX_SFTP_TRANSFER_HISTORY);
  } catch {
    return [];
  }
}

function readPortForwardPresets(): PortForwardPreset[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const rawValue = window.localStorage.getItem(PORT_FORWARD_PRESETS_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const normalized: PortForwardPreset[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") {
        continue;
      }
      const candidate = row as Partial<PortForwardPreset>;
      const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
      const sessionId =
        typeof candidate.sessionId === "string" ? candidate.sessionId.trim() : "";
      const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
      const bindHost =
        typeof candidate.bindHost === "string" ? candidate.bindHost.trim() : "";
      const bindPort =
        typeof candidate.bindPort === "number" && Number.isFinite(candidate.bindPort)
          ? Math.max(1, Math.min(65535, Math.trunc(candidate.bindPort)))
          : 0;
      const createdAt =
        typeof candidate.createdAt === "number" && Number.isFinite(candidate.createdAt)
          ? Math.max(0, Math.trunc(candidate.createdAt))
          : 0;
      const updatedAt =
        typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt)
          ? Math.max(0, Math.trunc(candidate.updatedAt))
          : createdAt;
      if (
        !id ||
        !sessionId ||
        !name ||
        !bindHost ||
        !bindPort ||
        !createdAt ||
        !updatedAt ||
        !isPortForwardTypeValue(candidate.type)
      ) {
        continue;
      }
      const targetHost =
        typeof candidate.targetHost === "string" && candidate.targetHost.trim()
          ? candidate.targetHost.trim()
          : undefined;
      const targetPort =
        typeof candidate.targetPort === "number" && Number.isFinite(candidate.targetPort)
          ? Math.max(1, Math.min(65535, Math.trunc(candidate.targetPort)))
          : undefined;
      if (candidate.type !== "dynamic" && (!targetHost || !targetPort)) {
        continue;
      }
      normalized.push({
        id,
        sessionId,
        name,
        type: candidate.type,
        bindHost,
        bindPort,
        targetHost,
        targetPort,
        autoRestore: candidate.autoRestore === true,
        createdAt,
        updatedAt
      });
    }
    normalized.sort((left, right) => right.updatedAt - left.updatedAt);
    return normalized;
  } catch {
    return [];
  }
}

function readPortForwardEventHistory(): PortForwardEventHistoryItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const rawValue = window.localStorage.getItem(PORT_FORWARD_EVENT_HISTORY_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const normalized: PortForwardEventHistoryItem[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") {
        continue;
      }
      const candidate = row as Partial<PortForwardEventHistoryItem>;
      const key = typeof candidate.key === "string" ? candidate.key.trim() : "";
      const sessionId =
        typeof candidate.sessionId === "string" ? candidate.sessionId.trim() : "";
      const eventId = typeof candidate.id === "string" ? candidate.id.trim() : "";
      const tabId = typeof candidate.tabId === "string" ? candidate.tabId.trim() : "";
      const forwardId = typeof candidate.forwardId === "string" ? candidate.forwardId.trim() : "";
      const bindHost =
        typeof candidate.bindHost === "string" ? candidate.bindHost.trim() : "";
      const bindPort =
        typeof candidate.bindPort === "number" && Number.isFinite(candidate.bindPort)
          ? Math.max(1, Math.min(65535, Math.trunc(candidate.bindPort)))
          : 0;
      const message = typeof candidate.message === "string" ? candidate.message.trim() : "";
      const createdAt =
        typeof candidate.createdAt === "string" && candidate.createdAt.trim()
          ? candidate.createdAt.trim()
          : "";
      if (
        !key ||
        !sessionId ||
        !eventId ||
        !tabId ||
        !forwardId ||
        !bindHost ||
        !bindPort ||
        !message ||
        !createdAt ||
        !isPortForwardTypeValue(candidate.forwardType) ||
        !isPortForwardEventTypeValue(candidate.type) ||
        !isPortForwardEventLevelValue(candidate.level)
      ) {
        continue;
      }
      normalized.push({
        key,
        sessionId,
        id: eventId,
        tabId,
        forwardId,
        forwardType: candidate.forwardType,
        bindHost,
        bindPort,
        level: candidate.level,
        type: candidate.type,
        message: message.slice(0, 600),
        createdAt
      });
    }
    normalized.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return normalized.slice(0, MAX_PORT_FORWARD_EVENT_HISTORY);
  } catch {
    return [];
  }
}

function readSessionGroupsState(): SessionGroupsState {
  if (typeof window === "undefined") {
    return { groups: [] };
  }
  try {
    const rawValue = window.localStorage.getItem(SESSION_GROUPS_STORAGE_KEY);
    if (!rawValue) {
      return { groups: [] };
    }
    const parsed = JSON.parse(rawValue) as Partial<SessionGroupsState>;
    return {
      groups: normalizeSessionGroups(parsed.groups)
    };
  } catch {
    return { groups: [] };
  }
}

function readServerHealthAlertPreferences(): ServerHealthAlertPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_SERVER_HEALTH_ALERT_PREFERENCES;
  }
  try {
    const rawValue = window.localStorage.getItem(
      SERVER_HEALTH_ALERT_PREFERENCES_STORAGE_KEY
    );
    if (!rawValue) {
      return DEFAULT_SERVER_HEALTH_ALERT_PREFERENCES;
    }
    const parsed = JSON.parse(rawValue) as Partial<ServerHealthAlertPreferences>;
    return {
      enabled:
        typeof parsed.enabled === "boolean"
          ? parsed.enabled
          : DEFAULT_SERVER_HEALTH_ALERT_PREFERENCES.enabled,
      cpuWarnPercent: parseAlertThresholdPercent(
        parsed.cpuWarnPercent,
        DEFAULT_SERVER_HEALTH_ALERT_PREFERENCES.cpuWarnPercent
      ),
      memoryWarnPercent: parseAlertThresholdPercent(
        parsed.memoryWarnPercent,
        DEFAULT_SERVER_HEALTH_ALERT_PREFERENCES.memoryWarnPercent
      ),
      diskWarnPercent: parseAlertThresholdPercent(
        parsed.diskWarnPercent,
        DEFAULT_SERVER_HEALTH_ALERT_PREFERENCES.diskWarnPercent
      )
    };
  } catch {
    return DEFAULT_SERVER_HEALTH_ALERT_PREFERENCES;
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
    groupId: session.groupId ?? "",
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

function quoteShellArg(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "\"\"";
  }
  if (!/[\s"\\]/.test(trimmed)) {
    return trimmed;
  }
  return `"${trimmed.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

function buildSshConnectionCommand(session: SessionRecord): string {
  const username = session.username.trim();
  const host = session.host.trim();
  const parts: string[] = ["ssh"];
  if (session.authType === "privateKey" && session.privateKeyPath?.trim()) {
    parts.push("-i", quoteShellArg(session.privateKeyPath));
  }
  parts.push("-p", `${session.port}`, `${username}@${host}`);
  return parts.join(" ");
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  const systemApi = window.termdock?.system;
  if (systemApi?.writeClipboardText) {
    await systemApi.writeClipboardText(text);
    return true;
  }
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

function toLogMessage(value: unknown): string {
  if (value instanceof Error) {
    return value.message || value.name || "Error";
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || "Unknown error";
  }
  try {
    const encoded = JSON.stringify(value);
    if (encoded) {
      return encoded;
    }
  } catch {
    // Ignore stringify errors and fallback to String().
  }
  return String(value);
}

function toLogDetails(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }
  return value;
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
  const hotkeyModifierOptions = useMemo(
    () => getHotkeyModifierOptions(isMacPlatform),
    [isMacPlatform]
  );
  const settingsSections = useMemo(
    () =>
      [
        { id: "connection", label: "Connection" },
        { id: "hotkeys", label: "Hotkeys" },
        { id: "serverHealth", label: "Monitor" },
        { id: "fileOpening", label: "File Open" },
        { id: "sftp", label: "SFTP" },
        { id: "portForwarding", label: "Port Fwd" },
        { id: "diagnostics", label: "Diagnostics" }
      ] as Array<{ id: SettingsSectionId; label: string }>,
    []
  );

  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [form, setForm] = useState<SessionCreateInput>(EMPTY_FORM);
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeSessionGroupKey, setActiveSessionGroupKey] = useState<string | null>(null);
  const [sessionSortMode, setSessionSortMode] = useState<SessionSortMode>(() => readSessionSortMode());
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<string[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [sessionFilterQuery, setSessionFilterQuery] = useState("");
  const [sessionFavoritesOnly, setSessionFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSectionId>("connection");
  const [connectionPreferences, setConnectionPreferences] = useState<ConnectionPreferences>(
    () => readConnectionPreferences()
  );
  const [hotkeyPreferences, setHotkeyPreferences] = useState<HotkeyPreferences>(
    () => readHotkeyPreferences()
  );
  const [fileOpenPreferences, setFileOpenPreferences] = useState<FileOpenPreferences>(
    () => readFileOpenPreferences()
  );
  const [sftpTransferPreferences, setSftpTransferPreferences] = useState<SftpTransferPreferences>(
    () => readSftpTransferPreferences()
  );
  const [sessionGroupsState, setSessionGroupsState] = useState<SessionGroupsState>(
    () => readSessionGroupsState()
  );
  const [serverHealthAlertPreferences, setServerHealthAlertPreferences] = useState<ServerHealthAlertPreferences>(
    () => readServerHealthAlertPreferences()
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
  const [transferHistory, setTransferHistory] = useState<SftpTransferHistoryItem[]>(
    () => readSftpTransferHistory()
  );
  const [isRetryCenterOpen, setIsRetryCenterOpen] = useState(false);
  const [retryCenterScope, setRetryCenterScope] = useState<TransferHistoryScope>("activeSession");
  const [retryCenterDirection, setRetryCenterDirection] =
    useState<TransferHistoryDirectionFilter>("all");
  const [retryCenterStatus, setRetryCenterStatus] =
    useState<TransferHistoryStatusFilter>("failed");
  const [retryCenterQuery, setRetryCenterQuery] = useState("");
  const [retryCenterSelection, setRetryCenterSelection] = useState<string[]>([]);
  const [sftpContextMenu, setSftpContextMenu] = useState<SftpContextMenuState | null>(null);
  const [sftpToolbarMenu, setSftpToolbarMenu] = useState<SftpToolbarMenuState | null>(null);
  const [sessionContextMenu, setSessionContextMenu] = useState<SessionContextMenuState | null>(null);
  const [sftpError, setSftpError] = useState<string | null>(null);
  const [logInfo, setLogInfo] = useState<{
    logDirectoryPath: string;
    logFilePath: string;
  } | null>(null);
  const [isExportingBugReport, setIsExportingBugReport] = useState(false);
  const [portForwards, setPortForwards] = useState<PortForwardRecord[]>([]);
  const [portForwardForm, setPortForwardForm] = useState<PortForwardFormState>(
    DEFAULT_PORT_FORWARD_FORM
  );
  const [portForwardPresets, setPortForwardPresets] = useState<PortForwardPreset[]>(
    () => readPortForwardPresets()
  );
  const [portForwardBusy, setPortForwardBusy] = useState(false);
  const [portForwardStatusMessage, setPortForwardStatusMessage] = useState<string | null>(null);
  const [portForwardEventHistory, setPortForwardEventHistory] = useState<
    PortForwardEventHistoryItem[]
  >(() => readPortForwardEventHistory());
  const [portForwardEventFilter, setPortForwardEventFilter] =
    useState<PortForwardEventFilter>("all");
  const [sftpDeleteProgress, setSftpDeleteProgress] = useState<{
    name: string;
    kind: SftpEntry["kind"];
  } | null>(null);
  const [serverHealth, setServerHealth] = useState<ServerHealthSnapshot | null>(null);
  const [serverHealthMetrics, setServerHealthMetrics] = useState<ServerHealthDerivedMetrics | null>(null);
  const [serverHealthHistory, setServerHealthHistory] = useState<ServerHealthHistoryPoint[]>([]);
  const [serverProcessSnapshot, setServerProcessSnapshot] = useState<ServerProcessSnapshot | null>(null);
  const [serverHealthLoading, setServerHealthLoading] = useState(false);
  const [serverProcessLoading, setServerProcessLoading] = useState(false);
  const [serverHealthError, setServerHealthError] = useState<string | null>(null);
  const [serverProcessError, setServerProcessError] = useState<string | null>(null);
  const [isServerHealthDetailOpen, setIsServerHealthDetailOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const terminalTabsRef = useRef<TerminalTab[]>([]);
  const portForwardPresetsRef = useRef<PortForwardPreset[]>([]);
  const autoRestoredPortForwardTabsRef = useRef<Set<string>>(new Set());
  const connectedTabIdsRef = useRef<Set<string>>(new Set());
  const uploadQueueRef = useRef<PendingUploadJob[]>([]);
  const runningUploadIdsRef = useRef<Map<string, string>>(new Map());
  const isDrainingUploadQueueRef = useRef(false);
  const downloadQueueRef = useRef<PendingDownloadJob[]>([]);
  const runningDownloadIdsRef = useRef<Map<string, string>>(new Map());
  const isDrainingDownloadQueueRef = useRef(false);
  const ensuredRemoteDirectoriesRef = useRef<Map<string, Set<string>>>(new Map());
  const openingRemoteFilesRef = useRef<Set<string>>(new Set());
  const sftpContextMenuRef = useRef<HTMLDivElement | null>(null);
  const sftpToolbarMenuRef = useRef<HTMLDivElement | null>(null);
  const sessionContextMenuRef = useRef<HTMLDivElement | null>(null);
  const appDialogInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const appDialogResolverRef = useRef<((value: unknown) => void) | null>(null);
  const appDialogCancelValueRef = useRef<unknown>(undefined);
  const previousServerHealthRef = useRef<ServerHealthSnapshot | null>(null);
  const serverHealthRequestInFlightTabsRef = useRef<Set<string>>(new Set());
  const serverProcessRequestInFlightTabsRef = useRef<Set<string>>(new Set());
  const uploadBatchNoticeRef = useRef<Set<string>>(new Set());
  const downloadBatchNoticeRef = useRef<Set<string>>(new Set());
  const canceledUploadBatchIdsRef = useRef<Set<string>>(new Set());
  const canceledDownloadBatchIdsRef = useRef<Set<string>>(new Set());
  const [uploadBatchByTab, setUploadBatchByTab] = useState<
    Record<string, { batchId: string; total: number }>
  >({});
  const [downloadBatchByTab, setDownloadBatchByTab] = useState<
    Record<string, { batchId: string; total: number }>
  >({});
  const [appDialog, setAppDialog] = useState<AppDialogState | null>(null);
  const [appDialogInput, setAppDialogInput] = useState("");
  const [moveGroupDialog, setMoveGroupDialog] = useState<{
    sessionIds: string[];
    targetGroup: string;
  } | null>(null);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );
  const activeTerminalTab = useMemo(
    () => terminalTabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, terminalTabs]
  );
  const isActiveTabConnected = !!(activeTabId && connectedTabIdsRef.current.has(activeTabId));
  const activeSessionId = activeTerminalTab?.sessionId ?? null;
  const activePortForwardPresets = useMemo(() => {
    if (!activeSessionId) {
      return [];
    }
    return portForwardPresets
      .filter((preset) => preset.sessionId === activeSessionId)
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }, [activeSessionId, portForwardPresets]);
  const activePortForwardEventHistory = useMemo(() => {
    if (!activeSessionId) {
      return [];
    }
    return portForwardEventHistory
      .filter((entry) => entry.sessionId === activeSessionId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [activeSessionId, portForwardEventHistory]);
  const visiblePortForwardEventHistory = useMemo(() => {
    if (portForwardEventFilter === "all") {
      return activePortForwardEventHistory;
    }
    if (portForwardEventFilter === "errors") {
      return activePortForwardEventHistory.filter((entry) => entry.level === "error");
    }
    if (portForwardEventFilter === "lifecycle") {
      return activePortForwardEventHistory.filter(
        (entry) => entry.type === "created" || entry.type === "removed"
      );
    }
    return activePortForwardEventHistory.filter(
      (entry) => entry.type === "statusDegraded" || entry.type === "statusRecovered"
    );
  }, [activePortForwardEventHistory, portForwardEventFilter]);
  const sessionContextTarget = useMemo(() => {
    const target = sessionContextMenu?.target;
    if (!target || target.type !== "session") {
      return null;
    }
    return sessions.find((session) => session.id === target.sessionId) ?? null;
  }, [sessionContextMenu, sessions]);
  const sessionGroupOptions = useMemo(() => {
    const allGroups = [
      ...sessionGroupsState.groups,
      ...sessions.map((session) => session.groupId ?? "")
    ];
    return normalizeSessionGroups(allGroups);
  }, [sessionGroupsState.groups, sessions]);
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
        session.groupId ?? "",
        session.remark ?? ""
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
    return sortSessionsForMode(filtered, sessionSortMode);
  }, [sessionFavoritesOnly, sessionFilterQuery, sessionSortMode, sessions]);
  const groupedSessions = useMemo(() => {
    const sessionsByGroup = new Map<string, SessionRecord[]>();
    for (const session of filteredSessions) {
      const groupValue = session.groupId?.trim() ?? "";
      const groupKey = groupValue || "__ungrouped__";
      const existingSessions = sessionsByGroup.get(groupKey);
      if (existingSessions) {
        existingSessions.push(session);
      } else {
        sessionsByGroup.set(groupKey, [session]);
      }
    }

    const groups: Array<{
      key: string;
      label: string;
      groupName: string;
      sessions: SessionRecord[];
    }> = [];
    const seenGroupKeys = new Set<string>();
    const appendGroup = (groupKey: string, label: string, groupName: string) => {
      if (seenGroupKeys.has(groupKey)) {
        return;
      }
      seenGroupKeys.add(groupKey);
      groups.push({
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
      (session) => (session.groupId?.trim() ?? "") === ""
    );
    if (sessionsByGroup.has("__ungrouped__") || hasUngroupedInAllSessions) {
      appendGroup("__ungrouped__", "Ungrouped", "");
    }

    groups.sort((left, right) => {
      if (left.key === "__ungrouped__" && right.key !== "__ungrouped__") {
        return 1;
      }
      if (left.key !== "__ungrouped__" && right.key === "__ungrouped__") {
        return -1;
      }
      return left.label.localeCompare(right.label, undefined, { sensitivity: "base" });
    });
    return groups;
  }, [filteredSessions, sessionGroupOptions, sessions]);
  const sessionBadgeText = useMemo(() => {
    if (filteredSessions.length === sessions.length) {
      return `${sessions.length}`;
    }
    return `${filteredSessions.length}/${sessions.length}`;
  }, [filteredSessions.length, sessions.length]);
  const activeSessionGroup = useMemo(() => {
    if (!activeSessionGroupKey) {
      return null;
    }
    return groupedSessions.find((group) => group.key === activeSessionGroupKey) ?? null;
  }, [activeSessionGroupKey, groupedSessions]);
  const activeGroupSessions = useMemo(
    () => activeSessionGroup?.sessions ?? [],
    [activeSessionGroup]
  );
  const selectedGroupKeySet = useMemo(() => new Set(selectedGroupKeys), [selectedGroupKeys]);
  const selectedSessionIdSet = useMemo(() => new Set(selectedSessionIds), [selectedSessionIds]);
  const selectedGroups = useMemo(
    () => groupedSessions.filter((group) => selectedGroupKeySet.has(group.key)),
    [groupedSessions, selectedGroupKeySet]
  );
  const selectedGroupNames = useMemo(
    () =>
      selectedGroups
        .filter((group) => group.groupName.trim().length > 0)
        .map((group) => group.groupName),
    [selectedGroups]
  );
  const selectedSessionsInActiveGroup = useMemo(
    () => activeGroupSessions.filter((session) => selectedSessionIdSet.has(session.id)),
    [activeGroupSessions, selectedSessionIdSet]
  );
  const writeAppLog = useCallback(
    (
      level: "debug" | "info" | "warn" | "error",
      source: string,
      message: string,
      details?: unknown
    ) => {
      if (!systemApi?.writeLog) {
        return;
      }
      void systemApi.writeLog(level, source, message, details).catch(() => {
        // Best-effort logging path; ignore write failures.
      });
    },
    [systemApi]
  );
  const resolveAppDialog = useCallback((result: unknown) => {
    const resolver = appDialogResolverRef.current;
    appDialogResolverRef.current = null;
    appDialogCancelValueRef.current = undefined;
    setAppDialog(null);
    setAppDialogInput("");
    if (resolver) {
      resolver(result);
    }
  }, []);
  const openAppDialog = useCallback(
    (dialog: AppDialogState, cancelResult: unknown): Promise<unknown> => {
      if (appDialogResolverRef.current) {
        appDialogResolverRef.current(appDialogCancelValueRef.current);
      }
      appDialogCancelValueRef.current = cancelResult;
      setAppDialog(dialog);
      setAppDialogInput(dialog.mode === "prompt" ? dialog.value : "");
      return new Promise((resolve) => {
        appDialogResolverRef.current = resolve;
      });
    },
    []
  );
  const showAppAlert = useCallback(
    async (message: string, options?: AppAlertDialogOptions): Promise<void> => {
      const dialog: AppAlertDialogState = {
        mode: "alert",
        title: options?.title ?? "Notice",
        message,
        confirmLabel: options?.confirmLabel ?? "OK",
        detailText: options?.detailText
      };
      await openAppDialog(dialog, undefined);
    },
    [openAppDialog]
  );
  const showAppConfirm = useCallback(
    async (message: string, options?: AppConfirmDialogOptions): Promise<boolean> => {
      const dialog: AppConfirmDialogState = {
        mode: "confirm",
        title: options?.title ?? "Confirm",
        message,
        confirmLabel: options?.confirmLabel ?? "Confirm",
        cancelLabel: options?.cancelLabel ?? "Cancel",
        danger: options?.danger
      };
      const result = await openAppDialog(dialog, false);
      return result === true;
    },
    [openAppDialog]
  );
  const showAppPrompt = useCallback(
    async (
      message: string,
      defaultValue = "",
      options?: AppPromptDialogOptions
    ): Promise<string | null> => {
      const dialog: AppPromptDialogState = {
        mode: "prompt",
        title: options?.title ?? "Input Required",
        message,
        confirmLabel: options?.confirmLabel ?? "OK",
        cancelLabel: options?.cancelLabel ?? "Cancel",
        value: defaultValue,
        multiline: options?.multiline
      };
      const result = await openAppDialog(dialog, null);
      return typeof result === "string" ? result : null;
    },
    [openAppDialog]
  );
  const refreshLogInfo = useCallback(async (): Promise<void> => {
    if (!systemApi?.getLogInfo) {
      setError("Log bridge unavailable. Restart `pnpm dev`.");
      return;
    }
    const info = await systemApi.getLogInfo();
    setLogInfo(info);
  }, [systemApi]);
  const refreshPortForwards = useCallback(
    async (targetTabId?: string | null): Promise<void> => {
      if (!terminalApi?.listPortForwards) {
        setPortForwards([]);
        setPortForwardStatusMessage(null);
        return;
      }
      const tabId = targetTabId ?? activeTabId;
      if (!tabId) {
        setPortForwards([]);
        setPortForwardStatusMessage(null);
        return;
      }
      try {
        const listed = await terminalApi.listPortForwards(tabId);
        setPortForwards(listed);
        const degradedCount = listed.filter((entry) => entry.status === "degraded").length;
        if (degradedCount > 0) {
          setPortForwardStatusMessage(
            `${degradedCount} active forward(s) currently degraded. Check their last error below.`
          );
        } else if (listed.length > 0) {
          setPortForwardStatusMessage("All active forwards are healthy.");
        } else {
          setPortForwardStatusMessage("No active forwards on the current tab.");
        }
      } catch (caughtError) {
        const message = toPortForwardErrorMessage(caughtError);
        setError(message);
        setPortForwardStatusMessage(message);
        writeAppLog(
          "error",
          "renderer:port-forwarding",
          "Failed to refresh port forwarding list.",
          caughtError
        );
      }
    },
    [activeTabId, terminalApi, writeAppLog]
  );
  const refreshPortForwardEvents = useCallback(
    async (targetTabId?: string | null): Promise<void> => {
      if (!terminalApi?.listPortForwardEvents) {
        return;
      }
      const tabId = targetTabId ?? activeTabId;
      if (!tabId) {
        return;
      }
      try {
        const listed = await terminalApi.listPortForwardEvents(tabId, 40);
        const sessionIdForEvents =
          tabId === activeTabId
            ? activeSessionId
            : terminalTabsRef.current.find((tab) => tab.id === tabId)?.sessionId ?? null;
        if (sessionIdForEvents && listed.length > 0) {
          setPortForwardEventHistory((prev) => {
            const mergedByKey = new Map<string, PortForwardEventHistoryItem>();
            for (const entry of prev) {
              mergedByKey.set(entry.key, entry);
            }
            for (const event of listed) {
              const key = createPortForwardEventHistoryKey(sessionIdForEvents, event.id);
              mergedByKey.set(key, {
                ...event,
                key,
                sessionId: sessionIdForEvents
              });
            }
            const merged = Array.from(mergedByKey.values()).sort((left, right) =>
              right.createdAt.localeCompare(left.createdAt)
            );
            const sessionCounts = new Map<string, number>();
            const capped: PortForwardEventHistoryItem[] = [];
            for (const item of merged) {
              const count = sessionCounts.get(item.sessionId) ?? 0;
              if (count >= MAX_PORT_FORWARD_EVENT_HISTORY_PER_SESSION) {
                continue;
              }
              sessionCounts.set(item.sessionId, count + 1);
              capped.push(item);
              if (capped.length >= MAX_PORT_FORWARD_EVENT_HISTORY) {
                break;
              }
            }
            return capped;
          });
        }
      } catch (caughtError) {
        const message = toPortForwardErrorMessage(caughtError);
        setError(message);
        writeAppLog(
          "error",
          "renderer:port-forwarding",
          "Failed to refresh port forwarding events.",
          caughtError
        );
      }
    },
    [activeSessionId, activeTabId, terminalApi, writeAppLog]
  );
  const exportPortForwardSnapshot = useCallback(async (): Promise<void> => {
    try {
      if (!activeTabId || !activeTerminalTab) {
        throw new Error("Open a connected session tab first.");
      }
      const lines: string[] = [];
      lines.push("# TermDock Port Forward Snapshot");
      lines.push(`Generated: ${new Date().toISOString()}`);
      lines.push(`Tab: ${activeTerminalTab.title}`);
      lines.push(`TabId: ${activeTabId}`);
      lines.push(`SessionId: ${activeSessionId ?? "-"}`);
      lines.push(`Status: ${isActiveTabConnected ? "connected" : "disconnected"}`);
      lines.push("");
      lines.push("## Active Forwards");
      if (portForwards.length === 0) {
        lines.push("- none");
      } else {
        for (const forward of portForwards) {
          lines.push(
            `- ${formatPortForwardRecord(forward)} | ${getPortForwardStatusLabel(forward)} | connections ${forward.totalConnections} failed ${forward.failedConnections}`
          );
          if (forward.lastActivityAt) {
            lines.push(`  lastActivity: ${forward.lastActivityAt}`);
          }
          if (forward.lastError) {
            lines.push(`  lastError: ${forward.lastErrorAt ?? "-"} ${forward.lastError}`);
          }
        }
      }
      lines.push("");
      lines.push("## Recent Events");
      if (activePortForwardEventHistory.length === 0) {
        lines.push("- none");
      } else {
        for (const event of activePortForwardEventHistory.slice(0, 30)) {
          lines.push(
            `- ${event.createdAt} [${event.level.toUpperCase()}] ${formatPortForwardEventType(event.type)} ${formatPortForwardEventSummary(event)}: ${event.message}`
          );
        }
      }
      const snapshotText = lines.join("\n");
      const copied = await copyTextToClipboard(snapshotText);
      if (copied) {
        await showAppAlert("Port forwarding snapshot copied to clipboard.", {
          title: "Port Forwarding Diagnostics"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the snapshot below manually.", {
        title: "Port Forwarding Diagnostics",
        detailText: snapshotText
      });
    } catch (caughtError) {
      const message = toPortForwardErrorMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:port-forwarding",
        "Failed to export port forwarding snapshot.",
        caughtError
      );
    }
  }, [
    activeTabId,
    activeSessionId,
    activePortForwardEventHistory,
    activeTerminalTab,
    isActiveTabConnected,
    portForwards,
    showAppAlert,
    writeAppLog
  ]);
  const clearVisiblePortForwardHistory = useCallback(async (): Promise<void> => {
    if (!activeSessionId || visiblePortForwardEventHistory.length === 0) {
      return;
    }
    const accepted = await showAppConfirm(
      `Delete ${visiblePortForwardEventHistory.length} visible port forwarding history item(s)?`,
      {
        title: "Port Forwarding History",
        confirmLabel: "Delete",
        danger: true
      }
    );
    if (!accepted) {
      return;
    }
    const keys = new Set(visiblePortForwardEventHistory.map((entry) => entry.key));
    setPortForwardEventHistory((prev) => prev.filter((entry) => !keys.has(entry.key)));
  }, [activeSessionId, showAppConfirm, visiblePortForwardEventHistory]);
  const clearSessionPortForwardHistory = useCallback(async (): Promise<void> => {
    if (!activeSessionId || activePortForwardEventHistory.length === 0) {
      return;
    }
    const accepted = await showAppConfirm(
      `Delete all ${activePortForwardEventHistory.length} port forwarding history item(s) for this session?`,
      {
        title: "Port Forwarding History",
        confirmLabel: "Delete All",
        danger: true
      }
    );
    if (!accepted) {
      return;
    }
    setPortForwardEventHistory((prev) =>
      prev.filter((entry) => entry.sessionId !== activeSessionId)
    );
  }, [activePortForwardEventHistory.length, activeSessionId, showAppConfirm]);
  const createPortForwardOnTab = useCallback(
    async (
      tabId: string,
      input: CreatePortForwardInput,
      options?: {
        updateVisibleList?: boolean;
      }
    ): Promise<PortForwardRecord> => {
      if (!terminalApi?.createPortForward) {
        throw new Error("Terminal bridge unavailable. Restart `pnpm dev`.");
      }
      const created = await terminalApi.createPortForward(tabId, input);
      if ((options?.updateVisibleList ?? true) && tabId === activeTabId) {
        setPortForwards((prev) => [created, ...prev.filter((entry) => entry.id !== created.id)]);
      }
      return created;
    },
    [activeTabId, terminalApi]
  );
  const createPortForward = useCallback(async (): Promise<void> => {
    if (!activeTabId) {
      await showAppAlert("Open a session tab first, then create port forwarding.", {
        title: "Port Forwarding"
      });
      return;
    }
    const activeConnected = !!(
      activeTabId &&
      connectedTabIdsRef.current.has(activeTabId)
    );
    if (!activeConnected) {
      await showAppAlert("Active tab is not connected. Reconnect and try again.", {
        title: "Port Forwarding"
      });
      return;
    }

    try {
      const input = buildPortForwardInputFromForm(portForwardForm);
      setPortForwardBusy(true);
      const created = await createPortForwardOnTab(activeTabId, input);
      if (input.type === "dynamic") {
        setPortForwardForm((prev) => ({
          ...prev,
          bindPort: `${created.bindPort}`
        }));
      }
      setPortForwardStatusMessage(`Created ${formatPortForwardRecord(created)}.`);
      await showAppAlert(
        `Port forwarding created.\n${formatPortForwardRecord(created)}`,
        {
          title: "Port Forwarding"
        }
      );
    } catch (caughtError) {
      const message = toPortForwardErrorMessage(caughtError);
      setError(message);
      setPortForwardStatusMessage(message);
      writeAppLog(
        "error",
        "renderer:port-forwarding",
        "Failed to create port forwarding.",
        caughtError
      );
    } finally {
      setPortForwardBusy(false);
    }
  }, [
    activeTabId,
    createPortForwardOnTab,
    portForwardForm,
    showAppAlert,
    writeAppLog
  ]);
  const savePortForwardPreset = useCallback(async (): Promise<void> => {
    if (!activeSessionId || !activeTerminalTab) {
      await showAppAlert("Open the target session tab first, then save a port forwarding preset.", {
        title: "Port Forwarding Preset"
      });
      return;
    }
    try {
      const input = buildPortForwardInputFromForm(portForwardForm);
      const defaultName = buildDefaultPortForwardPresetName(portForwardForm);
      const presetName = await showAppPrompt("Preset name", defaultName, {
        title: "Save Port Forward Preset",
        confirmLabel: "Save"
      });
      if (presetName === null) {
        return;
      }
      const trimmedName = presetName.trim();
      if (!trimmedName) {
        throw new Error("Preset name is required.");
      }
      const now = Date.now();
      setPortForwardPresets((prev) => {
        const existing = prev.find(
          (preset) =>
            preset.sessionId === activeSessionId &&
            preset.name.toLowerCase() === trimmedName.toLowerCase()
        );
        const nextPreset: PortForwardPreset = {
          id: existing?.id ?? createPortForwardPresetId(),
          sessionId: activeSessionId,
          name: trimmedName,
          type: input.type,
          bindHost: input.bindHost,
          bindPort: input.bindPort,
          targetHost: input.type === "dynamic" ? undefined : input.targetHost,
          targetPort: input.type === "dynamic" ? undefined : input.targetPort,
          autoRestore: existing?.autoRestore ?? false,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now
        };
        const next = prev.filter((preset) => preset.id !== nextPreset.id);
        next.unshift(nextPreset);
        next.sort((left, right) => right.updatedAt - left.updatedAt);
        return next;
      });
      setError(null);
      await showAppAlert(
        `Preset saved for ${activeTerminalTab.title}.\n${trimmedName}`,
        {
          title: "Port Forwarding Preset"
        }
      );
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:port-forwarding",
        "Failed to save port forwarding preset.",
        caughtError
      );
    }
  }, [
    activeSessionId,
    activeTerminalTab,
    portForwardForm,
    showAppAlert,
    showAppPrompt,
    writeAppLog
  ]);
  const applyPortForwardPreset = useCallback(
    async (preset: PortForwardPreset): Promise<void> => {
      if (!activeTabId) {
        await showAppAlert("Open the target session tab first, then apply a preset.", {
          title: "Port Forwarding Preset"
        });
        return;
      }
      if (!connectedTabIdsRef.current.has(activeTabId)) {
        await showAppAlert("Active tab is not connected. Reconnect and try again.", {
          title: "Port Forwarding Preset"
        });
        return;
      }
      const activeSession = terminalTabsRef.current.find((tab) => tab.id === activeTabId)?.sessionId ?? "";
      if (activeSession !== preset.sessionId) {
        await showAppAlert("Preset session does not match the active terminal tab.", {
          title: "Port Forwarding Preset"
        });
        return;
      }
      try {
        setPortForwardBusy(true);
        setPortForwardForm(toPortForwardFormFromPreset(preset));
        const created = await createPortForwardOnTab(
          activeTabId,
          buildPortForwardInputFromPreset(preset)
        );
        setPortForwardStatusMessage(`Applied preset "${preset.name}" successfully.`);
        await showAppAlert(`Port forwarding created.\n${formatPortForwardRecord(created)}`, {
          title: "Port Forwarding Preset"
        });
      } catch (caughtError) {
        const message = toPortForwardErrorMessage(caughtError);
        setError(message);
        setPortForwardStatusMessage(`Failed to apply preset "${preset.name}": ${message}`);
        writeAppLog(
          "error",
          "renderer:port-forwarding",
          "Failed to apply port forwarding preset.",
          caughtError
        );
      } finally {
        setPortForwardBusy(false);
      }
    },
    [activeTabId, createPortForwardOnTab, showAppAlert, writeAppLog]
  );
  const setPortForwardPresetAutoRestore = useCallback((presetId: string, value: boolean) => {
    setPortForwardPresets((prev) =>
      prev.map((preset) =>
        preset.id === presetId
          ? {
              ...preset,
              autoRestore: value,
              updatedAt: Date.now()
            }
          : preset
      )
    );
  }, []);
  const deletePortForwardPreset = useCallback(
    async (preset: PortForwardPreset): Promise<void> => {
      const accepted = await showAppConfirm(
        `Delete preset "${preset.name}"?\n${formatPortForwardPreset(preset)}`,
        {
          title: "Port Forwarding Preset",
          confirmLabel: "Delete",
          danger: true
        }
      );
      if (!accepted) {
        return;
      }
      setPortForwardPresets((prev) => prev.filter((entry) => entry.id !== preset.id));
    },
    [showAppConfirm]
  );
  const restorePortForwardPresetsForTab = useCallback(
    async (tabId: string, sessionId: string): Promise<void> => {
      if (autoRestoredPortForwardTabsRef.current.has(tabId)) {
        return;
      }
      autoRestoredPortForwardTabsRef.current.add(tabId);
      const presets = portForwardPresetsRef.current
        .filter((preset) => preset.sessionId === sessionId && preset.autoRestore)
        .sort((left, right) => left.createdAt - right.createdAt);
      if (presets.length === 0) {
        return;
      }
      let failedCount = 0;
      for (const preset of presets) {
        try {
          await createPortForwardOnTab(tabId, buildPortForwardInputFromPreset(preset), {
            updateVisibleList: tabId === activeTabId
          });
        } catch (caughtError) {
          failedCount += 1;
          writeAppLog(
            "error",
            "renderer:port-forwarding",
            `Failed to auto-restore port forwarding preset "${preset.name}".`,
            caughtError
          );
        }
      }
      if (failedCount > 0 && tabId === activeTabId) {
        const message = `${failedCount} port forwarding preset(s) failed to auto-restore.`;
        setError(message);
        setPortForwardStatusMessage(message);
      }
    },
    [activeTabId, createPortForwardOnTab, writeAppLog]
  );
  const removePortForward = useCallback(
    async (forward: PortForwardRecord): Promise<void> => {
      if (!terminalApi?.removePortForward) {
        setError("Terminal bridge unavailable. Restart `pnpm dev`.");
        return;
      }
      const tabId = activeTabId;
      if (!tabId) {
        return;
      }
      const shouldDelete = await showAppConfirm(
        `Remove this forward?\n${formatPortForwardRecord(forward)}`,
        {
          title: "Port Forwarding",
          confirmLabel: "Remove",
          danger: true
        }
      );
      if (!shouldDelete) {
        return;
      }
      try {
        setPortForwardBusy(true);
        await terminalApi.removePortForward(tabId, forward.id);
        setPortForwards((prev) => prev.filter((entry) => entry.id !== forward.id));
        setPortForwardStatusMessage(`Removed ${formatPortForwardRecord(forward)}.`);
      } catch (caughtError) {
        const message = toPortForwardErrorMessage(caughtError);
        setError(message);
        setPortForwardStatusMessage(message);
        writeAppLog(
          "error",
          "renderer:port-forwarding",
          "Failed to remove port forwarding.",
          caughtError
        );
      } finally {
        setPortForwardBusy(false);
      }
    },
    [activeTabId, showAppConfirm, terminalApi, writeAppLog]
  );
  const showAppChoice = useCallback(
    async (
      message: string,
      choices: AppChoiceDialogOption[],
      options?: AppChoiceDialogOptions
    ): Promise<string | null> => {
      if (!Array.isArray(choices) || choices.length === 0) {
        return null;
      }
      const dialog: AppChoiceDialogState = {
        mode: "choice",
        title: options?.title ?? "Choose Action",
        message,
        confirmLabel: "",
        cancelLabel: options?.cancelLabel ?? "Cancel",
        options: choices
      };
      const result = await openAppDialog(dialog, null);
      return typeof result === "string" ? result : null;
    },
    [openAppDialog]
  );
  const closeAppDialog = useCallback(() => {
    resolveAppDialog(appDialogCancelValueRef.current);
  }, [resolveAppDialog]);
  const submitAppDialog = useCallback(() => {
    if (!appDialog) {
      return;
    }
    if (appDialog.mode === "choice") {
      return;
    }
    if (appDialog.mode === "confirm") {
      resolveAppDialog(true);
      return;
    }
    if (appDialog.mode === "prompt") {
      resolveAppDialog(appDialogInput);
      return;
    }
    resolveAppDialog(undefined);
  }, [appDialog, appDialogInput, resolveAppDialog]);
  const editingSession = useMemo(
    () => sessions.find((session) => session.id === editingSessionId) ?? null,
    [editingSessionId, sessions]
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
  const activeUploadTransfers = useMemo(() => {
    if (!activeTabId) {
      return [];
    }
    return sftpTransfers
      .filter((transfer) => transfer.tabId === activeTabId && transfer.direction === "upload")
      .slice(0, 10);
  }, [activeTabId, sftpTransfers]);
  const failedUploadTransfers = useMemo(() => {
    if (!activeTabId) {
      return [];
    }
    return sftpTransfers.filter(
      (transfer) =>
        transfer.tabId === activeTabId &&
        transfer.direction === "upload" &&
        transfer.status === "failed"
    );
  }, [activeTabId, sftpTransfers]);
  const activeDownloadTransfers = useMemo(() => {
    if (!activeTabId) {
      return [];
    }
    return sftpTransfers
      .filter((transfer) => transfer.tabId === activeTabId && transfer.direction === "download")
      .slice(0, 10);
  }, [activeTabId, sftpTransfers]);
  const failedDownloadTransfers = useMemo(() => {
    if (!activeTabId) {
      return [];
    }
    return sftpTransfers.filter(
      (transfer) =>
        transfer.tabId === activeTabId &&
        transfer.direction === "download" &&
        transfer.status === "failed"
    );
  }, [activeTabId, sftpTransfers]);
  const failedUploadHistory = useMemo(() => {
    if (!activeSessionId) {
      return [];
    }
    return transferHistory.filter(
      (entry) =>
        entry.sessionId === activeSessionId &&
        entry.direction === "upload" &&
        entry.status === "failed"
    );
  }, [activeSessionId, transferHistory]);
  const failedDownloadHistory = useMemo(() => {
    if (!activeSessionId) {
      return [];
    }
    return transferHistory.filter(
      (entry) =>
        entry.sessionId === activeSessionId &&
        entry.direction === "download" &&
        entry.status === "failed"
    );
  }, [activeSessionId, transferHistory]);
  const failedUploadRetryCandidates = useMemo(() => {
    const dedup = new Set<string>();
    const targets: Array<{
      name: string;
      localPath: string;
      remotePath: string;
    }> = [];
    const runtime = [...failedUploadTransfers].sort((left, right) => left.updatedAt - right.updatedAt);
    for (const transfer of runtime) {
      const key = createTransferRetryKey(
        "upload",
        transfer.localPath.trim(),
        transfer.remotePath.trim()
      );
      if (dedup.has(key)) {
        continue;
      }
      dedup.add(key);
      targets.push({
        name: transfer.name,
        localPath: transfer.localPath,
        remotePath: transfer.remotePath
      });
    }
    const history = [...failedUploadHistory].sort((left, right) => left.updatedAt - right.updatedAt);
    for (const transfer of history) {
      const key = createTransferRetryKey(
        "upload",
        transfer.localPath.trim(),
        transfer.remotePath.trim()
      );
      if (dedup.has(key)) {
        continue;
      }
      dedup.add(key);
      targets.push({
        name: transfer.name,
        localPath: transfer.localPath,
        remotePath: transfer.remotePath
      });
    }
    return targets;
  }, [failedUploadHistory, failedUploadTransfers]);
  const failedDownloadRetryCandidates = useMemo(() => {
    const dedup = new Set<string>();
    const targets: Array<{
      name: string;
      localPath: string;
      remotePath: string;
    }> = [];
    const runtime = [...failedDownloadTransfers].sort(
      (left, right) => left.updatedAt - right.updatedAt
    );
    for (const transfer of runtime) {
      const key = createTransferRetryKey(
        "download",
        transfer.localPath.trim(),
        transfer.remotePath.trim()
      );
      if (dedup.has(key)) {
        continue;
      }
      dedup.add(key);
      targets.push({
        name: transfer.name,
        localPath: transfer.localPath,
        remotePath: transfer.remotePath
      });
    }
    const history = [...failedDownloadHistory].sort((left, right) => left.updatedAt - right.updatedAt);
    for (const transfer of history) {
      const key = createTransferRetryKey(
        "download",
        transfer.localPath.trim(),
        transfer.remotePath.trim()
      );
      if (dedup.has(key)) {
        continue;
      }
      dedup.add(key);
      targets.push({
        name: transfer.name,
        localPath: transfer.localPath,
        remotePath: transfer.remotePath
      });
    }
    return targets;
  }, [failedDownloadHistory, failedDownloadTransfers]);
  const activeUploadQueueStats = useMemo(() => {
    if (!activeTabId) {
      return {
        total: 0,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        canceled: 0
      };
    }
    const tabTransfers = sftpTransfers.filter(
      (transfer) => transfer.tabId === activeTabId && transfer.direction === "upload"
    );
    return {
      total: tabTransfers.length,
      queued: tabTransfers.filter((transfer) => transfer.status === "queued").length,
      running: tabTransfers.filter((transfer) => transfer.status === "running").length,
      completed: tabTransfers.filter((transfer) => transfer.status === "completed").length,
      failed: tabTransfers.filter((transfer) => transfer.status === "failed").length,
      canceled: tabTransfers.filter((transfer) => transfer.status === "canceled").length
    };
  }, [activeTabId, sftpTransfers]);
  const activeUploadBatchProgress = useMemo(() => {
    if (!activeTabId) {
      return null;
    }
    const batch = uploadBatchByTab[activeTabId];
    if (!batch) {
      return null;
    }
    const batchTransfers = sftpTransfers.filter(
      (transfer) =>
        transfer.tabId === activeTabId &&
        transfer.direction === "upload" &&
        transfer.batchId === batch.batchId
    );
    const completed = batchTransfers.filter((transfer) => transfer.status === "completed").length;
    const failed = batchTransfers.filter((transfer) => transfer.status === "failed").length;
    const canceled = batchTransfers.filter((transfer) => transfer.status === "canceled").length;
    const queued = batchTransfers.filter((transfer) => transfer.status === "queued").length;
    const running = batchTransfers.filter((transfer) => transfer.status === "running").length;
    const processed = completed + failed + canceled;
    return {
      ...batch,
      completed,
      failed,
      canceled,
      queued,
      running,
      processed,
      done: batch.total > 0 && processed >= batch.total
    };
  }, [activeTabId, sftpTransfers, uploadBatchByTab]);
  const activeUploadProgressStats = useMemo(() => {
    if (activeUploadBatchProgress) {
      return {
        completed: activeUploadBatchProgress.completed,
        total: activeUploadBatchProgress.total,
        failed: activeUploadBatchProgress.failed,
        canceled: activeUploadBatchProgress.canceled,
        running: activeUploadBatchProgress.running,
        queued: activeUploadBatchProgress.queued
      };
    }
    return {
      completed: activeUploadQueueStats.completed,
      total: activeUploadQueueStats.total,
      failed: activeUploadQueueStats.failed,
      canceled: activeUploadQueueStats.canceled,
      running: activeUploadQueueStats.running,
      queued: activeUploadQueueStats.queued
    };
  }, [activeUploadBatchProgress, activeUploadQueueStats]);
  const activeDownloadQueueStats = useMemo(() => {
    if (!activeTabId) {
      return {
        total: 0,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        canceled: 0
      };
    }
    const tabTransfers = sftpTransfers.filter(
      (transfer) => transfer.tabId === activeTabId && transfer.direction === "download"
    );
    return {
      total: tabTransfers.length,
      queued: tabTransfers.filter((transfer) => transfer.status === "queued").length,
      running: tabTransfers.filter((transfer) => transfer.status === "running").length,
      completed: tabTransfers.filter((transfer) => transfer.status === "completed").length,
      failed: tabTransfers.filter((transfer) => transfer.status === "failed").length,
      canceled: tabTransfers.filter((transfer) => transfer.status === "canceled").length
    };
  }, [activeTabId, sftpTransfers]);
  const activeDownloadBatchProgress = useMemo(() => {
    if (!activeTabId) {
      return null;
    }
    const batch = downloadBatchByTab[activeTabId];
    if (!batch) {
      return null;
    }
    const batchTransfers = sftpTransfers.filter(
      (transfer) =>
        transfer.tabId === activeTabId &&
        transfer.direction === "download" &&
        transfer.batchId === batch.batchId
    );
    const completed = batchTransfers.filter((transfer) => transfer.status === "completed").length;
    const failed = batchTransfers.filter((transfer) => transfer.status === "failed").length;
    const canceled = batchTransfers.filter((transfer) => transfer.status === "canceled").length;
    const queued = batchTransfers.filter((transfer) => transfer.status === "queued").length;
    const running = batchTransfers.filter((transfer) => transfer.status === "running").length;
    const processed = completed + failed + canceled;
    return {
      ...batch,
      completed,
      failed,
      canceled,
      queued,
      running,
      processed,
      done: batch.total > 0 && processed >= batch.total
    };
  }, [activeTabId, downloadBatchByTab, sftpTransfers]);
  const activeDownloadProgressStats = useMemo(() => {
    if (activeDownloadBatchProgress) {
      return {
        completed: activeDownloadBatchProgress.completed,
        total: activeDownloadBatchProgress.total,
        failed: activeDownloadBatchProgress.failed,
        canceled: activeDownloadBatchProgress.canceled,
        running: activeDownloadBatchProgress.running,
        queued: activeDownloadBatchProgress.queued
      };
    }
    return {
      completed: activeDownloadQueueStats.completed,
      total: activeDownloadQueueStats.total,
      failed: activeDownloadQueueStats.failed,
      canceled: activeDownloadQueueStats.canceled,
      running: activeDownloadQueueStats.running,
      queued: activeDownloadQueueStats.queued
    };
  }, [activeDownloadBatchProgress, activeDownloadQueueStats]);
  const canClearFinishedUploads =
    !!activeTabId &&
    (activeUploadQueueStats.completed +
      activeUploadQueueStats.failed +
      activeUploadQueueStats.canceled >
      0);
  const canClearFinishedDownloads =
    !!activeTabId &&
    (activeDownloadQueueStats.completed +
      activeDownloadQueueStats.failed +
      activeDownloadQueueStats.canceled >
      0);
  const canRetryFailedUploads = !!activeTabId && failedUploadRetryCandidates.length > 0;
  const canRetryFailedDownloads = !!activeTabId && failedDownloadRetryCandidates.length > 0;
  const retryCenterEntries = useMemo(() => {
    const normalizedQuery = retryCenterQuery.trim().toLowerCase();
    const filtered = transferHistory.filter((entry) => {
      if (retryCenterScope === "activeSession") {
        if (!activeSessionId || entry.sessionId !== activeSessionId) {
          return false;
        }
      }
      if (retryCenterDirection !== "all" && entry.direction !== retryCenterDirection) {
        return false;
      }
      if (retryCenterStatus !== "all" && entry.status !== retryCenterStatus) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return (
        entry.name.toLowerCase().includes(normalizedQuery) ||
        entry.localPath.toLowerCase().includes(normalizedQuery) ||
        entry.remotePath.toLowerCase().includes(normalizedQuery) ||
        (entry.message ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
    return filtered.sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 400);
  }, [
    activeSessionId,
    retryCenterDirection,
    retryCenterQuery,
    retryCenterScope,
    retryCenterStatus,
    transferHistory
  ]);
  const retryCenterSelectionSet = useMemo(
    () => new Set(retryCenterSelection),
    [retryCenterSelection]
  );
  const selectedRetryCenterEntries = useMemo(
    () => retryCenterEntries.filter((entry) => retryCenterSelectionSet.has(entry.key)),
    [retryCenterEntries, retryCenterSelectionSet]
  );
  const selectedRetryCenterFailedEntries = useMemo(
    () =>
      selectedRetryCenterEntries.filter(
        (entry) =>
          entry.status === "failed" &&
          !!activeSessionId &&
          entry.sessionId === activeSessionId
      ),
    [activeSessionId, selectedRetryCenterEntries]
  );
  const canRetrySelectedRetryCenterEntries =
    !!activeTabId && selectedRetryCenterFailedEntries.length > 0;
  const canClearSelectedRetryCenterEntries = selectedRetryCenterEntries.length > 0;
  const canClearVisibleRetryCenterEntries = retryCenterEntries.length > 0;
  const canClearAllRetryCenterEntries = transferHistory.length > 0;
  const canDownloadSelectedSftpEntry =
    !!selectedSftpEntry &&
    (selectedSftpEntry.kind === "file" || selectedSftpEntry.kind === "directory");
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
  const serverHealthUpdatedLabel = useMemo(() => {
    if (!serverHealth) {
      return "-";
    }
    const timestamp = new Date(serverHealth.collectedAt);
    if (!Number.isFinite(timestamp.getTime())) {
      return "-";
    }
    return timestamp.toLocaleTimeString();
  }, [serverHealth]);
  const recentServerHealthPoints = useMemo(
    () => serverHealthHistory.slice(-10),
    [serverHealthHistory]
  );
  const serverHealthAlertStatus = useMemo(() => {
    const safeMetrics = serverHealthMetrics;
    if (!safeMetrics || !serverHealthAlertPreferences.enabled) {
      return {
        cpuHigh: false,
        memoryHigh: false,
        diskHigh: false,
        hasAny: false
      };
    }
    const cpuHigh = safeMetrics.cpuUsagePercent >= serverHealthAlertPreferences.cpuWarnPercent;
    const memoryHigh =
      safeMetrics.memoryUsagePercent >= serverHealthAlertPreferences.memoryWarnPercent;
    const diskHigh = safeMetrics.diskUsagePercent >= serverHealthAlertPreferences.diskWarnPercent;
    return {
      cpuHigh,
      memoryHigh,
      diskHigh,
      hasAny: cpuHigh || memoryHigh || diskHigh
    };
  }, [serverHealthAlertPreferences, serverHealthMetrics]);

  const applySftpTransferEvent = useCallback((event: SftpTransferEvent & { batchId?: string }) => {
    const now = Date.now();
    let historyCandidate: SftpTransferHistoryItem | null = null;
    setSftpTransfers((prev) => {
      const tabSessionId =
        terminalTabsRef.current.find((tab) => tab.id === event.tabId)?.sessionId ?? "";
      const nextItem: SftpTransferItem = {
        ...event,
        updatedAt: now
      };
      if (tabSessionId) {
        nextItem.sessionId = tabSessionId;
      }
      if (event.batchId !== undefined) {
        nextItem.batchId = event.batchId;
      }
      const existingIndex = prev.findIndex(
        (transfer) => transfer.transferId === event.transferId
      );
      if (existingIndex < 0) {
        if (isTerminalTransferStatus(nextItem.status) && nextItem.sessionId) {
          historyCandidate = {
            key: createTransferHistoryKey(
              nextItem.sessionId,
              nextItem.direction,
              nextItem.localPath.trim(),
              nextItem.remotePath.trim()
            ),
            sessionId: nextItem.sessionId,
            direction: nextItem.direction,
            status: nextItem.status,
            name: nextItem.name,
            localPath: nextItem.localPath,
            remotePath: nextItem.remotePath,
            updatedAt: now,
            attemptCount: 1,
            message: nextItem.message?.trim() ? nextItem.message.trim() : undefined
          };
        }
        return [nextItem, ...prev].slice(0, 160);
      }
      const next = [...prev];
      const mergedItem: SftpTransferItem = {
        ...next[existingIndex],
        ...nextItem
      };
      if (event.batchId === undefined && next[existingIndex].batchId !== undefined) {
        mergedItem.batchId = next[existingIndex].batchId;
      }
      if (!mergedItem.sessionId && next[existingIndex].sessionId) {
        mergedItem.sessionId = next[existingIndex].sessionId;
      }
      if (isTerminalTransferStatus(mergedItem.status) && mergedItem.sessionId) {
        historyCandidate = {
          key: createTransferHistoryKey(
            mergedItem.sessionId,
            mergedItem.direction,
            mergedItem.localPath.trim(),
            mergedItem.remotePath.trim()
          ),
          sessionId: mergedItem.sessionId,
          direction: mergedItem.direction,
          status: mergedItem.status,
          name: mergedItem.name,
          localPath: mergedItem.localPath,
          remotePath: mergedItem.remotePath,
          updatedAt: now,
          attemptCount: 1,
          message: mergedItem.message?.trim() ? mergedItem.message.trim() : undefined
        };
      }
      next[existingIndex] = mergedItem;
      next.sort((left, right) => right.updatedAt - left.updatedAt);
      return next;
    });
    if (historyCandidate) {
      setTransferHistory((prev) => {
        const existingIndex = prev.findIndex((item) => item.key === historyCandidate!.key);
        if (existingIndex < 0) {
          return [historyCandidate!, ...prev]
            .sort((left, right) => right.updatedAt - left.updatedAt)
            .slice(0, MAX_SFTP_TRANSFER_HISTORY);
        }
        const next = [...prev];
        const current = next[existingIndex];
        next[existingIndex] = {
          ...current,
          ...historyCandidate,
          attemptCount: current.attemptCount + 1
        };
        next.sort((left, right) => right.updatedAt - left.updatedAt);
        return next.slice(0, MAX_SFTP_TRANSFER_HISTORY);
      });
    }
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
      while (runningUploadIdsRef.current.size < sftpTransferPreferences.uploadConcurrency) {
        const nextIndex = uploadQueueRef.current.findIndex((job) =>
          connectedTabIdsRef.current.has(job.tabId)
        );
        if (nextIndex < 0) {
          break;
        }
        const [nextJob] = uploadQueueRef.current.splice(nextIndex, 1);
        runningUploadIdsRef.current.set(nextJob.transferId, nextJob.tabId);
        void (async () => {
          await ensureRemoteDirectoryForUpload(nextJob.tabId, nextJob.remoteDirectory);
          await sftpApi.uploadFileToPath(
            nextJob.tabId,
            nextJob.transferId,
            nextJob.localPath,
            nextJob.remotePath
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
                batchId: nextJob.batchId,
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
  }, [
    applySftpTransferEvent,
    ensureRemoteDirectoryForUpload,
    sftpApi,
    sftpTransferPreferences.uploadConcurrency
  ]);

  const drainDownloadQueue = useCallback(() => {
    if (!sftpApi || isDrainingDownloadQueueRef.current) {
      return;
    }
    isDrainingDownloadQueueRef.current = true;
    try {
      while (runningDownloadIdsRef.current.size < sftpTransferPreferences.downloadConcurrency) {
        const nextIndex = downloadQueueRef.current.findIndex((job) =>
          connectedTabIdsRef.current.has(job.tabId)
        );
        if (nextIndex < 0) {
          break;
        }
        const [nextJob] = downloadQueueRef.current.splice(nextIndex, 1);
        runningDownloadIdsRef.current.set(nextJob.transferId, nextJob.tabId);
        void sftpApi
          .downloadFile(
            nextJob.tabId,
            nextJob.transferId,
            nextJob.remotePath,
            nextJob.localPath
          )
          .catch((caughtError) => {
            const message = (caughtError as Error)?.message ?? "Download failed.";
            if (!isTransferCanceledMessage(message)) {
              setSftpError(message);
              applySftpTransferEvent({
                tabId: nextJob.tabId,
                transferId: nextJob.transferId,
                direction: "download",
                status: "failed",
                batchId: nextJob.batchId,
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
            runningDownloadIdsRef.current.delete(nextJob.transferId);
            drainDownloadQueue();
          });
      }
    } finally {
      isDrainingDownloadQueueRef.current = false;
    }
  }, [applySftpTransferEvent, sftpApi, sftpTransferPreferences.downloadConcurrency]);

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

  const resetServerHealth = useCallback((message?: string | null) => {
    previousServerHealthRef.current = null;
    setServerHealth(null);
    setServerHealthMetrics(null);
    setServerHealthHistory([]);
    setServerHealthLoading(false);
    setServerHealthError(message ?? null);
  }, []);

  const refreshServerHealth = useCallback(
    async (options?: { tabId?: string; silent?: boolean }) => {
      if (!terminalApi) {
        resetServerHealth("Terminal bridge unavailable. Restart `pnpm dev`.");
        return;
      }
      const targetTabId = options?.tabId ?? activeTabId;
      if (!targetTabId) {
        resetServerHealth(null);
        return;
      }
      if (!connectedTabIdsRef.current.has(targetTabId)) {
        resetServerHealth("Terminal tab is not connected.");
        return;
      }
      const isSilent = options?.silent === true;
      if (serverHealthRequestInFlightTabsRef.current.has(targetTabId)) {
        return;
      }
      if (isSilent) {
        const hasActiveUpload = Array.from(runningUploadIdsRef.current.values()).some(
          (tabId) => tabId === targetTabId
        );
        const hasActiveDownload = Array.from(runningDownloadIdsRef.current.values()).some(
          (tabId) => tabId === targetTabId
        );
        if (hasActiveUpload || hasActiveDownload) {
          return;
        }
      }

      serverHealthRequestInFlightTabsRef.current.add(targetTabId);
      if (!isSilent) {
        setServerHealthLoading(true);
      }
      try {
        const snapshot = await terminalApi.getServerHealth(targetTabId);
        const previousSnapshot =
          previousServerHealthRef.current?.tabId === targetTabId
            ? previousServerHealthRef.current
            : null;
        const nextMetrics = deriveServerHealthMetrics(snapshot, previousSnapshot);
        setServerHealth(snapshot);
        setServerHealthMetrics(nextMetrics);
        setServerHealthHistory((previousHistory) => {
          const baseHistory = previousSnapshot ? previousHistory : [];
          const nextPoint: ServerHealthHistoryPoint = {
            at: Date.now(),
            ...nextMetrics
          };
          return [...baseHistory, nextPoint].slice(-SERVER_HEALTH_HISTORY_LIMIT);
        });
        setServerHealthError(null);
        previousServerHealthRef.current = snapshot;
      } catch (caughtError) {
        const message = (caughtError as Error).message;
        setServerHealthError(message);
      } finally {
        serverHealthRequestInFlightTabsRef.current.delete(targetTabId);
        if (!isSilent) {
          setServerHealthLoading(false);
        }
      }
    },
    [activeTabId, resetServerHealth, terminalApi]
  );

  const resetServerProcesses = useCallback((message?: string | null) => {
    setServerProcessSnapshot(null);
    setServerProcessLoading(false);
    setServerProcessError(message ?? null);
  }, []);

  const refreshServerProcesses = useCallback(
    async (options?: { tabId?: string; silent?: boolean }) => {
      if (!terminalApi) {
        resetServerProcesses("Terminal bridge unavailable. Restart `pnpm dev`.");
        return;
      }
      const targetTabId = options?.tabId ?? activeTabId;
      if (!targetTabId) {
        resetServerProcesses(null);
        return;
      }
      if (!connectedTabIdsRef.current.has(targetTabId)) {
        resetServerProcesses("Terminal tab is not connected.");
        return;
      }
      const isSilent = options?.silent === true;
      if (serverProcessRequestInFlightTabsRef.current.has(targetTabId)) {
        return;
      }
      if (isSilent) {
        const hasActiveUpload = Array.from(runningUploadIdsRef.current.values()).some(
          (tabId) => tabId === targetTabId
        );
        const hasActiveDownload = Array.from(runningDownloadIdsRef.current.values()).some(
          (tabId) => tabId === targetTabId
        );
        if (hasActiveUpload || hasActiveDownload) {
          return;
        }
      }
      serverProcessRequestInFlightTabsRef.current.add(targetTabId);
      if (!isSilent) {
        setServerProcessLoading(true);
      }
      try {
        const snapshot = await terminalApi.getServerProcesses(targetTabId);
        setServerProcessSnapshot(snapshot);
        setServerProcessError(null);
      } catch (caughtError) {
        const message = (caughtError as Error).message;
        setServerProcessError(message);
      } finally {
        serverProcessRequestInFlightTabsRef.current.delete(targetTabId);
        if (!isSilent) {
          setServerProcessLoading(false);
        }
      }
    },
    [activeTabId, resetServerProcesses, terminalApi]
  );

  const closeSftpContextMenu = useCallback(() => {
    setSftpContextMenu(null);
  }, []);

  const closeSftpToolbarMenu = useCallback(() => {
    setSftpToolbarMenu(null);
  }, []);

  const openSftpContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>, entry?: SftpEntry) => {
      event.preventDefault();
      event.stopPropagation();
      closeSftpToolbarMenu();
      if (entry) {
        setSelectedSftpPath(entry.path);
      }
      setSftpContextMenu({
        x: event.clientX,
        y: event.clientY,
        entryPath: entry?.path ?? null
      });
    },
    [closeSftpToolbarMenu]
  );

  const toggleSftpToolbarMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const triggerRect = event.currentTarget.getBoundingClientRect();
      closeSftpContextMenu();
      setSftpToolbarMenu((prev) => {
        if (prev) {
          return null;
        }
        return {
          x: Math.round(triggerRect.left),
          y: Math.round(triggerRect.bottom + 4)
        };
      });
    },
    [closeSftpContextMenu]
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
    terminalTabsRef.current = terminalTabs;
  }, [terminalTabs]);

  useEffect(() => {
    portForwardPresetsRef.current = portForwardPresets;
  }, [portForwardPresets]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SESSION_SORT_MODE_STORAGE_KEY, sessionSortMode);
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [sessionSortMode]);

  useEffect(() => {
    const validGroupKeys = new Set(groupedSessions.map((group) => group.key));
    setSelectedGroupKeys((prev) => prev.filter((groupKey) => validGroupKeys.has(groupKey)));
  }, [groupedSessions]);

  useEffect(() => {
    const validSessionIds = new Set(sessions.map((session) => session.id));
    setSelectedSessionIds((prev) => prev.filter((sessionId) => validSessionIds.has(sessionId)));
  }, [sessions]);

  useEffect(() => {
    const validSessionIds = new Set(sessions.map((session) => session.id));
    setPortForwardPresets((prev) =>
      prev.filter((preset) => validSessionIds.has(preset.sessionId))
    );
  }, [sessions]);

  useEffect(() => {
    const validSessionIds = new Set(sessions.map((session) => session.id));
    setPortForwardEventHistory((prev) =>
      prev.filter((entry) => validSessionIds.has(entry.sessionId))
    );
  }, [sessions]);

  useEffect(() => {
    if (!activeSessionGroup) {
      setSelectedSessionIds([]);
      return;
    }
    const validSessionIds = new Set(activeGroupSessions.map((session) => session.id));
    setSelectedSessionIds((prev) => prev.filter((sessionId) => validSessionIds.has(sessionId)));
    if (selectedSessionId && !validSessionIds.has(selectedSessionId)) {
      setSelectedSessionId(activeGroupSessions[0]?.id ?? null);
    }
  }, [activeGroupSessions, activeSessionGroup, selectedSessionId]);

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
    try {
      window.localStorage.setItem(
        SFTP_TRANSFER_PREFERENCES_STORAGE_KEY,
        JSON.stringify(sftpTransferPreferences)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [sftpTransferPreferences]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SFTP_TRANSFER_HISTORY_STORAGE_KEY,
        JSON.stringify(transferHistory)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [transferHistory]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PORT_FORWARD_PRESETS_STORAGE_KEY,
        JSON.stringify(portForwardPresets)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [portForwardPresets]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PORT_FORWARD_EVENT_HISTORY_STORAGE_KEY,
        JSON.stringify(portForwardEventHistory)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [portForwardEventHistory]);

  useEffect(() => {
    const validKeys = new Set(retryCenterEntries.map((entry) => entry.key));
    setRetryCenterSelection((prev) => prev.filter((key) => validKeys.has(key)));
  }, [retryCenterEntries]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SESSION_GROUPS_STORAGE_KEY,
        JSON.stringify({
          groups: normalizeSessionGroups(sessionGroupsState.groups)
        } satisfies SessionGroupsState)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [sessionGroupsState.groups]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SERVER_HEALTH_ALERT_PREFERENCES_STORAGE_KEY,
        JSON.stringify(serverHealthAlertPreferences)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [serverHealthAlertPreferences]);

  useEffect(() => {
    if (!appApi) {
      return;
    }
    const stopListening = appApi.onOpenSettings(() => {
      setActiveSettingsSection("connection");
      setIsSettingsOpen(true);
    });
    return () => {
      stopListening();
    };
  }, [appApi]);

  useEffect(() => {
    writeAppLog("info", "renderer:lifecycle", "Renderer initialized.");
  }, [writeAppLog]);

  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      const message = event.message?.trim() || "Unhandled window error.";
      writeAppLog("error", "renderer:window-error", message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: toLogDetails(event.error)
      });
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      writeAppLog(
        "error",
        "renderer:unhandledrejection",
        toLogMessage(event.reason),
        toLogDetails(event.reason)
      );
    };
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [writeAppLog]);

  useEffect(() => {
    if (!isSettingsOpen || activeSettingsSection !== "diagnostics") {
      return;
    }
    void refreshLogInfo().catch((caughtError) => {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:diagnostics", "Failed to load log info.", caughtError);
    });
  }, [activeSettingsSection, isSettingsOpen, refreshLogInfo, writeAppLog]);

  useEffect(() => {
    if (!isSettingsOpen || activeSettingsSection !== "portForwarding") {
      return;
    }
    void Promise.all([
      refreshPortForwards(activeTabId),
      refreshPortForwardEvents(activeTabId)
    ]).catch((caughtError) => {
      const message = toPortForwardErrorMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:port-forwarding",
        "Failed to load port forwarding diagnostics.",
        caughtError
      );
    });
  }, [
    activeSettingsSection,
    activeTabId,
    isSettingsOpen,
    refreshPortForwardEvents,
    refreshPortForwards,
    writeAppLog
  ]);

  useEffect(() => {
    if (!isSettingsOpen || activeSettingsSection !== "portForwarding" || !activeTabId) {
      return;
    }
    const timer = window.setInterval(() => {
      void Promise.all([
        refreshPortForwards(activeTabId),
        refreshPortForwardEvents(activeTabId)
      ]).catch((caughtError) => {
        const message = toPortForwardErrorMessage(caughtError);
        setError(message);
        setPortForwardStatusMessage(message);
        writeAppLog(
          "error",
          "renderer:port-forwarding",
          "Failed to auto-refresh port forwarding list.",
          caughtError
        );
      });
    }, 3_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [
    activeSettingsSection,
    activeTabId,
    isSettingsOpen,
    refreshPortForwardEvents,
    refreshPortForwards,
    writeAppLog
  ]);

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
    resetServerHealth(null);
    if (!activeTabId) {
      return;
    }
    if (!connectedTabIdsRef.current.has(activeTabId)) {
      return;
    }
    void refreshServerHealth({
      tabId: activeTabId
    });
  }, [activeTabId, refreshServerHealth, resetServerHealth]);

  useEffect(() => {
    resetServerProcesses(null);
    if (!isServerHealthDetailOpen) {
      return;
    }
    if (!activeTabId) {
      return;
    }
    if (!connectedTabIdsRef.current.has(activeTabId)) {
      return;
    }
    void refreshServerProcesses({
      tabId: activeTabId
    });
  }, [
    activeTabId,
    isServerHealthDetailOpen,
    refreshServerProcesses,
    resetServerProcesses
  ]);

  useEffect(() => {
    if (!activeTabId || !terminalApi) {
      return;
    }
    const timer = window.setInterval(() => {
      if (!connectedTabIdsRef.current.has(activeTabId)) {
        return;
      }
      void refreshServerHealth({
        tabId: activeTabId,
        silent: true
      });
    }, SERVER_HEALTH_POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [activeTabId, refreshServerHealth, terminalApi]);

  useEffect(() => {
    if (!isServerHealthDetailOpen || !activeTabId || !terminalApi) {
      return;
    }
    const timer = window.setInterval(() => {
      if (!connectedTabIdsRef.current.has(activeTabId)) {
        return;
      }
      void refreshServerProcesses({
        tabId: activeTabId,
        silent: true
      });
    }, SERVER_PROCESS_POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [activeTabId, isServerHealthDetailOpen, refreshServerProcesses, terminalApi]);

  useEffect(() => {
    connectedTabIdsRef.current.clear();
    autoRestoredPortForwardTabsRef.current.clear();
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
          drainDownloadQueue();
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
          if (tab) {
            void restorePortForwardPresetsForTab(event.tabId, tab.sessionId);
          }
          if (event.tabId === activeTabId) {
            void refreshServerHealth({
              tabId: event.tabId
            });
            if (isServerHealthDetailOpen) {
              void refreshServerProcesses({
                tabId: event.tabId
              });
            }
          }
        } else {
          connectedTabIdsRef.current.delete(event.tabId);
          autoRestoredPortForwardTabsRef.current.delete(event.tabId);
          if (event.tabId === activeTabId) {
            resetServerHealth("Terminal tab is not connected.");
            resetServerProcesses("Terminal tab is not connected.");
          }
        }
      }
      if (event.type === "error") {
        connectedTabIdsRef.current.delete(event.tabId);
        autoRestoredPortForwardTabsRef.current.delete(event.tabId);
        if (event.tabId === activeTabId) {
          resetServerHealth(event.message);
          resetServerProcesses(event.message);
        }
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
  }, [
    activeTabId,
    drainDownloadQueue,
    drainUploadQueue,
    isServerHealthDetailOpen,
    loadSftpDirectory,
    refreshServerHealth,
    refreshServerProcesses,
    resetServerHealth,
    resetServerProcesses,
    restorePortForwardPresetsForTab,
    terminalApi,
    terminalTabs
  ]);

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
    if (!activeTabId || !activeUploadBatchProgress || !activeUploadBatchProgress.done) {
      return;
    }
    const batchId = activeUploadBatchProgress.batchId;
    if (uploadBatchNoticeRef.current.has(batchId)) {
      return;
    }
    uploadBatchNoticeRef.current.add(batchId);
    const { completed, failed, canceled, total } = activeUploadBatchProgress;
    const detailParts = [`${completed}/${total} completed`];
    if (failed > 0) {
      detailParts.push(`${failed} failed`);
    }
    if (canceled > 0) {
      detailParts.push(`${canceled} canceled`);
    }
    void showAppAlert(`Upload batch finished: ${detailParts.join(", ")}.`, {
      title: "Upload Summary"
    });
    setUploadBatchByTab((prev) => {
      const current = prev[activeTabId];
      if (!current || current.batchId !== batchId) {
        return prev;
      }
      const next = { ...prev };
      delete next[activeTabId];
      return next;
    });
  }, [activeTabId, activeUploadBatchProgress, showAppAlert]);

  useEffect(() => {
    if (!activeTabId || !activeDownloadBatchProgress || !activeDownloadBatchProgress.done) {
      return;
    }
    const batchId = activeDownloadBatchProgress.batchId;
    if (downloadBatchNoticeRef.current.has(batchId)) {
      return;
    }
    downloadBatchNoticeRef.current.add(batchId);
    const { completed, failed, canceled, total } = activeDownloadBatchProgress;
    const detailParts = [`${completed}/${total} completed`];
    if (failed > 0) {
      detailParts.push(`${failed} failed`);
    }
    if (canceled > 0) {
      detailParts.push(`${canceled} canceled`);
    }
    void showAppAlert(`Download batch finished: ${detailParts.join(", ")}.`, {
      title: "Download Summary"
    });
    setDownloadBatchByTab((prev) => {
      const current = prev[activeTabId];
      if (!current || current.batchId !== batchId) {
        return prev;
      }
      const next = { ...prev };
      delete next[activeTabId];
      return next;
    });
  }, [activeDownloadBatchProgress, activeTabId, showAppAlert]);

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
    if (!sftpToolbarMenu) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (sftpToolbarMenuRef.current?.contains(target)) {
        return;
      }
      closeSftpToolbarMenu();
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSftpToolbarMenu();
      }
    };

    const onWindowLayoutChange = () => {
      closeSftpToolbarMenu();
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
  }, [closeSftpToolbarMenu, sftpToolbarMenu]);

  const closeSessionContextMenu = useCallback(() => {
    setSessionContextMenu(null);
  }, []);

  const openSessionContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>, target: SessionContextMenuState["target"]) => {
      event.preventDefault();
      event.stopPropagation();
      if (target.type === "session") {
        setSelectedSessionId(target.sessionId);
        setSelectedSessionIds((prev) =>
          prev.includes(target.sessionId) ? prev : [target.sessionId]
        );
      }
      if (target.type === "group") {
        setSelectedGroupKeys((prev) =>
          prev.includes(target.groupKey) ? prev : [target.groupKey]
        );
      }
      setSessionContextMenu({
        x: event.clientX,
        y: event.clientY,
        target
      });
    },
    []
  );

  const openSessionBlankContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "button, input, textarea, select, a, label, .session-list__item, .session-folder-list__item"
        )
      ) {
        return;
      }
      if (activeSessionGroup) {
        openSessionContextMenu(event, {
          type: "group-view",
          groupKey: activeSessionGroup.key,
          groupName: activeSessionGroup.groupName,
          label: activeSessionGroup.label
        });
        return;
      }
      openSessionContextMenu(event, { type: "group-root" });
    },
    [activeSessionGroup, openSessionContextMenu]
  );

  useEffect(() => {
    if (!sessionContextMenu) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (sessionContextMenuRef.current?.contains(target)) {
        return;
      }
      closeSessionContextMenu();
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSessionContextMenu();
      }
    };

    const onWindowLayoutChange = () => {
      closeSessionContextMenu();
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
  }, [closeSessionContextMenu, sessionContextMenu]);

  useEffect(() => {
    if (!sessionContextMenu) {
      return;
    }
    const contextTarget = sessionContextMenu.target;
    if (contextTarget.type === "session") {
      const exists = sessions.some((session) => session.id === contextTarget.sessionId);
      if (!exists) {
        closeSessionContextMenu();
      }
      return;
    }
    if (contextTarget.type === "group" || contextTarget.type === "group-view") {
      if (contextTarget.groupKey === "__ungrouped__") {
        return;
      }
      const exists =
        sessionGroupOptions.some(
          (groupName) => groupName.toLowerCase() === contextTarget.groupName.toLowerCase()
        ) ||
        sessions.some(
          (session) =>
            (session.groupId?.trim() ?? "").toLowerCase() === contextTarget.groupName.toLowerCase()
        );
      if (!exists) {
        closeSessionContextMenu();
      }
    }
  }, [closeSessionContextMenu, sessionContextMenu, sessionGroupOptions, sessions]);

  useEffect(() => {
    if (!appDialog) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAppDialog();
      }
      if (event.key === "Enter") {
        if (appDialog.mode === "choice") {
          return;
        }
        if (appDialog.mode === "prompt" && appDialog.multiline && !event.ctrlKey && !event.metaKey) {
          return;
        }
        event.preventDefault();
        submitAppDialog();
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [appDialog, closeAppDialog, submitAppDialog]);

  useEffect(() => {
    if (!appDialog || appDialog.mode !== "prompt") {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const input = appDialogInputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      input.select();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [appDialog]);

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
    if (!activeSessionGroupKey) {
      return;
    }
    const exists = groupedSessions.some((group) => group.key === activeSessionGroupKey);
    if (!exists) {
      setActiveSessionGroupKey(null);
    }
  }, [activeSessionGroupKey, groupedSessions]);

  useEffect(() => {
    drainUploadQueue();
    drainDownloadQueue();
  }, [drainDownloadQueue, drainUploadQueue]);

  useEffect(() => {
    return () => {
      if (appDialogResolverRef.current) {
        appDialogResolverRef.current(appDialogCancelValueRef.current);
        appDialogResolverRef.current = null;
      }
      uploadQueueRef.current = [];
      runningUploadIdsRef.current.clear();
      autoRestoredPortForwardTabsRef.current.clear();
      isDrainingUploadQueueRef.current = false;
      downloadQueueRef.current = [];
      runningDownloadIdsRef.current.clear();
      isDrainingDownloadQueueRef.current = false;
      ensuredRemoteDirectoriesRef.current.clear();
      uploadBatchNoticeRef.current.clear();
      downloadBatchNoticeRef.current.clear();
      canceledUploadBatchIdsRef.current.clear();
      canceledDownloadBatchIdsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (systemApi) {
        void systemApi.disposeRemoteOpenFiles();
      }
    };
  }, [systemApi]);

  const openCreateModal = (groupId = "") => {
    setForm({
      ...EMPTY_FORM,
      groupId
    });
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

  const buildDuplicateSessionName = useCallback(
    (sourceName: string): string => {
      const baseName = sourceName.trim() || "Session";
      const candidateBase = `${baseName} copy`;
      const usedNames = new Set(
        sessions.map((session) => session.name.trim().toLowerCase())
      );
      if (!usedNames.has(candidateBase.toLowerCase())) {
        return candidateBase;
      }
      let suffix = 2;
      while (usedNames.has(`${candidateBase} ${suffix}`.toLowerCase())) {
        suffix += 1;
      }
      return `${candidateBase} ${suffix}`;
    },
    [sessions]
  );

  const openDuplicateSessionModal = useCallback(
    (session: SessionRecord) => {
      setForm({
        ...toFormFromSession(session),
        name: buildDuplicateSessionName(session.name),
        secret: ""
      });
      setEditingSessionId(null);
      setTestConnectionResult(null);
      setIsCreateModalOpen(true);
      setError(null);
      if (session.authType === "password") {
        void showAppAlert("Duplicated session requires password input before saving.", {
          title: "Duplicate Session"
        });
      }
    },
    [buildDuplicateSessionName, showAppAlert]
  );

  const importSessionsFromSshConfig = useCallback(async () => {
    try {
      if (!sessionsApi) {
        throw new Error("Session bridge unavailable. Restart `pnpm dev`.");
      }
      if (!systemApi?.pickSshConfigFile) {
        throw new Error("System bridge unavailable. Restart `pnpm dev`.");
      }
      const selectedPath = await systemApi.pickSshConfigFile();
      if (!selectedPath) {
        return;
      }
      const parsed = await sessionsApi.parseSshConfig(selectedPath);
      if (parsed.candidates.length === 0) {
        await showAppAlert(
          parsed.warnings.length > 0
            ? `No importable Host entries were found.\n\n${parsed.warnings.join("\n")}`
            : "No importable Host entries were found.",
          {
            title: "SSH Config Import"
          }
        );
        return;
      }

      await showAppAlert("Review parsed hosts below before importing.", {
        title: "SSH Config Preview",
        confirmLabel: "Continue",
        detailText: formatSshConfigPreview(parsed)
      });

      const targetGroupInput = await showAppPrompt(
        "Set target group for imported sessions. Leave empty for Ungrouped.",
        activeSessionGroup?.groupName ?? "",
        {
          title: "Import Target Group",
          confirmLabel: "Continue"
        }
      );
      if (targetGroupInput === null) {
        return;
      }
      const targetGroup = targetGroupInput.trim();
      const targetRemarkPrefix = `Imported from ${parsed.filePath}`;

      let duplicateStrategy: "skip" | "overwrite" | "rename" = "skip";
      const existingConnectionKeys = new Set(
        sessions.map((session) =>
          buildSessionConnectionKey(session.host, session.port, session.username)
        )
      );
      const duplicateCount = parsed.candidates.filter((candidate) =>
        existingConnectionKeys.has(
          buildSessionConnectionKey(candidate.host, candidate.port, candidate.username)
        )
      ).length;
      if (duplicateCount > 0) {
        const selectedStrategy = await showAppChoice(
          `Found ${duplicateCount} duplicate connection target(s). Choose how to handle duplicates.`,
          [
            {
              value: "skip",
              label: "Skip Duplicates"
            },
            {
              value: "overwrite",
              label: "Overwrite Existing"
            },
            {
              value: "rename",
              label: "Create Renamed Copies"
            }
          ],
          {
            title: "Duplicate Strategy",
            cancelLabel: "Cancel"
          }
        );
        if (!selectedStrategy) {
          return;
        }
        duplicateStrategy = selectedStrategy as "skip" | "overwrite" | "rename";
      }

      const localSessions = [...sessions];
      const sessionByConnection = new Map<string, SessionRecord>();
      for (const session of localSessions) {
        const key = buildSessionConnectionKey(session.host, session.port, session.username);
        if (!sessionByConnection.has(key)) {
          sessionByConnection.set(key, session);
        }
      }
      const usedNames = new Set(localSessions.map((session) => session.name.trim().toLowerCase()));
      const allocateImportName = (baseName: string): string => {
        const base = baseName.trim() || "Imported Session";
        if (!usedNames.has(base.toLowerCase())) {
          usedNames.add(base.toLowerCase());
          return base;
        }
        let suffix = 1;
        while (usedNames.has(`${base} (${suffix})`.toLowerCase())) {
          suffix += 1;
        }
        const next = `${base} (${suffix})`;
        usedNames.add(next.toLowerCase());
        return next;
      };

      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      let firstImportedSessionId: string | null = null;

      for (const candidate of parsed.candidates) {
        const connectionKey = buildSessionConnectionKey(
          candidate.host,
          candidate.port,
          candidate.username
        );
        const existing = sessionByConnection.get(connectionKey) ?? null;
        if (existing && duplicateStrategy === "skip") {
          skippedCount += 1;
          continue;
        }

        const remarkLine = `${targetRemarkPrefix}:${candidate.sourceLine}`;
        if (existing && duplicateStrategy === "overwrite") {
          try {
            const updated = await sessionsApi.update(existing.id, {
              name: candidate.name,
              host: candidate.host,
              port: candidate.port,
              username: candidate.username,
              authType: candidate.authType,
              privateKeyPath:
                candidate.authType === "privateKey" ? candidate.privateKeyPath ?? "" : "",
              groupId: targetGroup,
              remark: remarkLine
            });
            updatedCount += 1;
            if (!firstImportedSessionId) {
              firstImportedSessionId = updated.id;
            }
            const index = localSessions.findIndex((session) => session.id === updated.id);
            if (index >= 0) {
              localSessions[index] = updated;
            }
            sessionByConnection.set(connectionKey, updated);
            usedNames.add(updated.name.trim().toLowerCase());
          } catch {
            failedCount += 1;
          }
          continue;
        }

        const shouldRename = existing && duplicateStrategy === "rename";
        const nextName = shouldRename
          ? allocateImportName(`${candidate.name} imported`)
          : candidate.name;
        try {
          const created = await sessionsApi.create({
            name: nextName,
            host: candidate.host,
            port: candidate.port,
            username: candidate.username,
            authType: candidate.authType,
            privateKeyPath:
              candidate.authType === "privateKey" ? candidate.privateKeyPath ?? "" : "",
            groupId: targetGroup,
            remark: remarkLine,
            favorite: false,
            secret: ""
          });
          createdCount += 1;
          if (!firstImportedSessionId) {
            firstImportedSessionId = created.id;
          }
          localSessions.unshift(created);
          const current = sessionByConnection.get(connectionKey);
          if (!current) {
            sessionByConnection.set(connectionKey, created);
          }
          usedNames.add(created.name.trim().toLowerCase());
        } catch {
          failedCount += 1;
        }
      }

      if (targetGroup) {
        setSessionGroupsState((prev) => ({
          groups: normalizeSessionGroups([...prev.groups, targetGroup])
        }));
      }
      if (createdCount > 0 || updatedCount > 0) {
        setSessions(localSessions);
        if (firstImportedSessionId) {
          setSelectedSessionId(firstImportedSessionId);
        }
      }
      await showAppAlert(
        `Import completed.\nCreated: ${createdCount}\nUpdated: ${updatedCount}\nSkipped: ${skippedCount}\nFailed: ${failedCount}\nWarnings: ${parsed.warnings.length}`,
        {
          title: "SSH Config Import"
        }
      );
    } catch (caughtError) {
      setError(toLogMessage(caughtError));
      writeAppLog("error", "renderer:sessions", "SSH config import failed.", caughtError);
    }
  }, [
    activeSessionGroup?.groupName,
    sessions,
    sessionsApi,
    showAppAlert,
    showAppChoice,
    showAppPrompt,
    systemApi,
    writeAppLog
  ]);

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
    groupId: form.groupId?.trim(),
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
          groupId: normalizedForm.groupId,
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
        if (updated.groupId?.trim()) {
          setSessionGroupsState((prev) => ({
            groups: normalizeSessionGroups([...prev.groups, updated.groupId ?? ""])
          }));
        }
        setSelectedSessionId(updated.id);
      } else {
        const created = await sessionsApi.create(normalizedForm);
        const nextSessions = [created, ...sessions];
        setSessions(nextSessions);
        if (created.groupId?.trim()) {
          setSessionGroupsState((prev) => ({
            groups: normalizeSessionGroups([...prev.groups, created.groupId ?? ""])
          }));
        }
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

  const closeTerminalTabs = useCallback((tabIds: string[]) => {
    const uniqueTabIds = Array.from(new Set(tabIds.filter(Boolean)));
    if (uniqueTabIds.length === 0) {
      return;
    }
    const tabIdSet = new Set(uniqueTabIds);

    for (const tabId of uniqueTabIds) {
      connectedTabIdsRef.current.delete(tabId);
      autoRestoredPortForwardTabsRef.current.delete(tabId);
      ensuredRemoteDirectoriesRef.current.delete(tabId);
      if (terminalApi) {
        void terminalApi.close(tabId);
      }
      if (systemApi) {
        void systemApi.disposeRemoteOpenFiles(tabId);
      }
    }

    setUploadBatchByTab((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const tabId of uniqueTabIds) {
        if (tabId in next) {
          delete next[tabId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setDownloadBatchByTab((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const tabId of uniqueTabIds) {
        if (tabId in next) {
          delete next[tabId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    const queuedUploadJobs = uploadQueueRef.current.filter((job) => tabIdSet.has(job.tabId));
    if (queuedUploadJobs.length > 0) {
      uploadQueueRef.current = uploadQueueRef.current.filter((job) => !tabIdSet.has(job.tabId));
      for (const job of queuedUploadJobs) {
        applySftpTransferEvent({
          tabId: job.tabId,
          transferId: job.transferId,
          direction: "upload",
          status: "canceled",
          batchId: job.batchId,
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

    const queuedDownloadJobs = downloadQueueRef.current.filter((job) => tabIdSet.has(job.tabId));
    if (queuedDownloadJobs.length > 0) {
      downloadQueueRef.current = downloadQueueRef.current.filter((job) => !tabIdSet.has(job.tabId));
      for (const job of queuedDownloadJobs) {
        applySftpTransferEvent({
          tabId: job.tabId,
          transferId: job.transferId,
          direction: "download",
          status: "canceled",
          batchId: job.batchId,
          name: job.name,
          localPath: job.localPath,
          remotePath: job.remotePath,
          transferredBytes: 0,
          totalBytes: 0,
          message: "canceled"
        });
      }
      drainDownloadQueue();
    }

    const nextTabs = terminalTabsRef.current.filter((tab) => !tabIdSet.has(tab.id));
    terminalTabsRef.current = nextTabs;
    setTerminalTabs(nextTabs);
    setActiveTabId((currentTabId) => {
      if (!currentTabId || !tabIdSet.has(currentTabId)) {
        return currentTabId;
      }
      return nextTabs.length > 0 ? nextTabs[nextTabs.length - 1].id : null;
    });
  }, [applySftpTransferEvent, drainDownloadQueue, drainUploadQueue, systemApi, terminalApi]);

  const closeTerminalTab = useCallback((tabId: string) => {
    closeTerminalTabs([tabId]);
  }, [closeTerminalTabs]);

  const closeTabsLeft = useCallback(
    (tabId: string) => {
      const tabs = terminalTabsRef.current;
      const index = tabs.findIndex((tab) => tab.id === tabId);
      if (index <= 0) {
        return;
      }
      closeTerminalTabs(tabs.slice(0, index).map((tab) => tab.id));
    },
    [closeTerminalTabs]
  );

  const closeTabsRight = useCallback(
    (tabId: string) => {
      const tabs = terminalTabsRef.current;
      const index = tabs.findIndex((tab) => tab.id === tabId);
      if (index < 0 || index >= tabs.length - 1) {
        return;
      }
      closeTerminalTabs(tabs.slice(index + 1).map((tab) => tab.id));
    },
    [closeTerminalTabs]
  );

  const closeOtherTabs = useCallback(
    (tabId: string) => {
      const tabs = terminalTabsRef.current;
      closeTerminalTabs(tabs.filter((tab) => tab.id !== tabId).map((tab) => tab.id));
    },
    [closeTerminalTabs]
  );

  const closeAllTabs = useCallback(() => {
    closeTerminalTabs(terminalTabsRef.current.map((tab) => tab.id));
  }, [closeTerminalTabs]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }
      const settingsMatches =
        hasPrimaryShortcutModifier(event) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.trim() === ",";
      if (settingsMatches) {
        event.preventDefault();
        setActiveSettingsSection("connection");
        setIsSettingsOpen(true);
        return;
      }
      const openMatches = matchesHotkeyBinding(event, hotkeyPreferences.openSessionTab);
      const closeMatches = matchesHotkeyBinding(event, hotkeyPreferences.closeActiveTab);
      if (!openMatches && !closeMatches) {
        return;
      }

      if (openMatches) {
        if (!selectedSession) {
          return;
        }
        event.preventDefault();
        openTerminalTab(selectedSession);
        return;
      }

      if (closeMatches) {
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
  }, [
    activeTabId,
    closeTerminalTab,
    hotkeyPreferences,
    openTerminalTab,
    selectedSession
  ]);

  const removeSessionsByIds = async (sessionIds: string[]) => {
    const uniqueSessionIds = Array.from(new Set(sessionIds));
    const targets = sessions.filter((session) => uniqueSessionIds.includes(session.id));
    if (targets.length === 0) {
      return;
    }
    const accepted = await showAppConfirm(
      targets.length === 1
        ? `Delete session "${targets[0].name}"?`
        : `Delete ${targets.length} selected sessions?`,
      {
        title: "Delete Session",
        confirmLabel: "Delete",
        danger: true
      }
    );
    if (!accepted) {
      return;
    }

    try {
      if (!sessionsApi) {
        throw new Error("Session bridge unavailable. Restart `pnpm dev`.");
      }

      const removedSessionIds = new Set<string>();
      for (const session of targets) {
        await sessionsApi.remove(session.id);
        removedSessionIds.add(session.id);
      }
      const nextSessions = sessions.filter((session) => !removedSessionIds.has(session.id));
      setSessions(nextSessions);
      setSelectedSessionIds((prev) => prev.filter((sessionId) => !removedSessionIds.has(sessionId)));
      if (selectedSessionId && removedSessionIds.has(selectedSessionId)) {
        setSelectedSessionId(nextSessions[0]?.id ?? null);
      }
      const removedTabIds = terminalTabsRef.current
        .filter((tab) => removedSessionIds.has(tab.sessionId))
        .map((tab) => tab.id);
      closeTerminalTabs(removedTabIds);
    } catch (caughtError) {
      setError((caughtError as Error).message);
    }
  };

  const removeSession = async (sessionId: string) => {
    await removeSessionsByIds([sessionId]);
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

  const setHotkeyBindingEnabled = (action: HotkeyActionId, value: boolean) => {
    setHotkeyPreferences((prev) => ({
      ...prev,
      [action]: {
        ...prev[action],
        enabled: value
      }
    }));
  };

  const setHotkeyBindingModifier = (action: HotkeyActionId, modifier: HotkeyModifier) => {
    setHotkeyPreferences((prev) => ({
      ...prev,
      [action]: {
        ...prev[action],
        modifier
      }
    }));
  };

  const setHotkeyBindingKey = (action: HotkeyActionId, rawValue: string) => {
    setHotkeyPreferences((prev) => ({
      ...prev,
      [action]: {
        ...prev[action],
        key: normalizeHotkeyKey(rawValue, prev[action].key)
      }
    }));
  };

  const setPreferredOpenProgramPath = (value: string) => {
    setFileOpenPreferences((prev) => ({
      ...prev,
      preferredProgramPath: value
    }));
  };

  const setUploadConcurrency = (rawValue: string) => {
    const parsed = Number(rawValue);
    setSftpTransferPreferences((prev) => ({
      ...prev,
      uploadConcurrency: parseTransferConcurrency(
        parsed,
        DEFAULT_SFTP_TRANSFER_PREFERENCES.uploadConcurrency
      )
    }));
  };

  const setDownloadConcurrency = (rawValue: string) => {
    const parsed = Number(rawValue);
    setSftpTransferPreferences((prev) => ({
      ...prev,
      downloadConcurrency: parseTransferConcurrency(
        parsed,
        DEFAULT_SFTP_TRANSFER_PREFERENCES.downloadConcurrency
      )
    }));
  };

  const addSessionGroup = (rawName: string) => {
    const normalized = normalizeSessionGroupName(rawName);
    if (!normalized) {
      setError("Group name is required.");
      return;
    }
    setSessionGroupsState((prev) => ({
      groups: normalizeSessionGroups([...prev.groups, normalized])
    }));
    setError(null);
  };

  const renameSessionGroup = async (groupName: string) => {
    const nextNameInput = await showAppPrompt("Enter a new name for this group.", groupName, {
      title: "Rename Group",
      confirmLabel: "Rename"
    });
    if (nextNameInput === null) {
      return;
    }
    const nextName = normalizeSessionGroupName(nextNameInput);
    if (!nextName) {
      setError("Group name is required.");
      return;
    }
    if (nextName.toLowerCase() === groupName.toLowerCase()) {
      return;
    }
    const relatedSessions = sessions.filter(
      (session) => (session.groupId?.trim() ?? "").toLowerCase() === groupName.toLowerCase()
    );
    try {
      if (!sessionsApi) {
        throw new Error("Session bridge unavailable. Restart `pnpm dev`.");
      }
      for (const session of relatedSessions) {
        const updated = await sessionsApi.update(session.id, { groupId: nextName });
        setSessions((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
      }
      setSessionGroupsState((prev) => {
        const withoutCurrent = prev.groups.filter(
          (item) => item.toLowerCase() !== groupName.toLowerCase()
        );
        return {
          groups: normalizeSessionGroups([...withoutCurrent, nextName])
        };
      });
      setForm((prev) => ({
        ...prev,
        groupId:
          (prev.groupId?.trim() ?? "").toLowerCase() === groupName.toLowerCase()
            ? nextName
            : prev.groupId
      }));
      setError(null);
    } catch (caughtError) {
      setError((caughtError as Error).message);
    }
  };

  const deleteSessionGroup = async (groupName: string) => {
    const relatedSessions = sessions.filter(
      (session) => (session.groupId?.trim() ?? "").toLowerCase() === groupName.toLowerCase()
    );
    const accepted = await showAppConfirm(
      relatedSessions.length > 0
        ? `Delete group "${groupName}" and move ${relatedSessions.length} sessions to Ungrouped?`
        : `Delete group "${groupName}"?`,
      {
        title: "Delete Group",
        confirmLabel: "Delete",
        danger: true
      }
    );
    if (!accepted) {
      return;
    }
    try {
      if (!sessionsApi) {
        throw new Error("Session bridge unavailable. Restart `pnpm dev`.");
      }
      for (const session of relatedSessions) {
        const updated = await sessionsApi.update(session.id, { groupId: "" });
        setSessions((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
      }
      setSessionGroupsState((prev) => ({
        groups: prev.groups.filter((item) => item.toLowerCase() !== groupName.toLowerCase())
      }));
      setForm((prev) => ({
        ...prev,
        groupId:
          (prev.groupId?.trim() ?? "").toLowerCase() === groupName.toLowerCase() ? "" : prev.groupId
      }));
      setError(null);
    } catch (caughtError) {
      setError((caughtError as Error).message);
    }
  };

  const deleteSessionGroupsBatch = async (groupNames: string[]) => {
    const normalizedGroupNames = normalizeSessionGroups(groupNames).filter(
      (groupName) => groupName.trim().length > 0
    );
    if (normalizedGroupNames.length === 0) {
      return;
    }
    const targetGroupNameSet = new Set(
      normalizedGroupNames.map((groupName) => groupName.toLowerCase())
    );
    const relatedSessions = sessions.filter((session) =>
      targetGroupNameSet.has((session.groupId?.trim() ?? "").toLowerCase())
    );
    const accepted = await showAppConfirm(
      relatedSessions.length > 0
        ? `Delete ${normalizedGroupNames.length} selected groups and move ${relatedSessions.length} sessions to Ungrouped?`
        : `Delete ${normalizedGroupNames.length} selected groups?`,
      {
        title: "Delete Group",
        confirmLabel: "Delete",
        danger: true
      }
    );
    if (!accepted) {
      return;
    }
    try {
      if (!sessionsApi) {
        throw new Error("Session bridge unavailable. Restart `pnpm dev`.");
      }
      const updatedById = new Map<string, SessionRecord>();
      for (const session of relatedSessions) {
        const updated = await sessionsApi.update(session.id, { groupId: "" });
        updatedById.set(updated.id, updated);
      }
      if (updatedById.size > 0) {
        setSessions((prev) => prev.map((item) => updatedById.get(item.id) ?? item));
      }
      setSessionGroupsState((prev) => ({
        groups: prev.groups.filter((item) => !targetGroupNameSet.has(item.toLowerCase()))
      }));
      setSelectedGroupKeys((prev) =>
        prev.filter((groupKey) => !targetGroupNameSet.has(groupKey.toLowerCase()))
      );
      setForm((prev) => ({
        ...prev,
        groupId:
          targetGroupNameSet.has((prev.groupId?.trim() ?? "").toLowerCase()) ? "" : prev.groupId
      }));
      setError(null);
    } catch (caughtError) {
      setError((caughtError as Error).message);
    }
  };

  const assignSessionsToGroup = async (sessionIds: string[], groupName: string) => {
    const normalizedGroupName = normalizeSessionGroupName(groupName);
    const uniqueSessionIds = Array.from(new Set(sessionIds));
    if (uniqueSessionIds.length === 0) {
      return;
    }
    try {
      if (!sessionsApi) {
        throw new Error("Session bridge unavailable. Restart `pnpm dev`.");
      }
      const updatedById = new Map<string, SessionRecord>();
      for (const sessionId of uniqueSessionIds) {
        const session = sessions.find((item) => item.id === sessionId);
        if (!session) {
          continue;
        }
        if ((session.groupId?.trim() ?? "") === normalizedGroupName) {
          continue;
        }
        const updated = await sessionsApi.update(session.id, {
          groupId: normalizedGroupName
        });
        updatedById.set(updated.id, updated);
      }
      if (updatedById.size > 0) {
        setSessions((prev) => prev.map((item) => updatedById.get(item.id) ?? item));
      }
      if (normalizedGroupName) {
        setSessionGroupsState((prev) => ({
          groups: normalizeSessionGroups([...prev.groups, normalizedGroupName])
        }));
      }
      setError(null);
    } catch (caughtError) {
      setError((caughtError as Error).message);
    }
  };

  const openMoveSessionsToGroupDialog = (sessionIds: string[]) => {
    const uniqueSessionIds = Array.from(new Set(sessionIds)).filter((sessionId) =>
      sessions.some((session) => session.id === sessionId)
    );
    if (uniqueSessionIds.length === 0) {
      return;
    }
    const targetSessions = sessions.filter((session) => uniqueSessionIds.includes(session.id));
    const firstGroup = targetSessions[0]?.groupId?.trim() ?? "";
    const allSameGroup = targetSessions.every(
      (session) => (session.groupId?.trim() ?? "") === firstGroup
    );
    const defaultGroup = allSameGroup ? firstGroup : "";
    setMoveGroupDialog({
      sessionIds: uniqueSessionIds,
      targetGroup: defaultGroup
    });
  };

  const closeMoveGroupDialog = () => {
    setMoveGroupDialog(null);
  };

  const submitMoveGroupDialog = async () => {
    if (!moveGroupDialog) {
      return;
    }
    const { sessionIds, targetGroup } = moveGroupDialog;
    setMoveGroupDialog(null);
    await assignSessionsToGroup(sessionIds, targetGroup);
  };

  const setServerHealthAlertEnabled = (value: boolean) => {
    setServerHealthAlertPreferences((prev) => ({
      ...prev,
      enabled: value
    }));
  };

  const setServerHealthAlertThreshold = (
    key: "cpuWarnPercent" | "memoryWarnPercent" | "diskWarnPercent",
    rawValue: string
  ) => {
    const parsed = Number(rawValue);
    setServerHealthAlertPreferences((prev) => ({
      ...prev,
      [key]: parseAlertThresholdPercent(parsed, prev[key])
    }));
  };

  const openSettingsPanel = useCallback((section: SettingsSectionId = "connection") => {
    setActiveSettingsSection(section);
    setIsSettingsOpen(true);
  }, []);

  const closeSettingsPanel = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const openLogDirectory = useCallback(async () => {
    try {
      if (!systemApi?.openLocalPath || !systemApi.getLogInfo) {
        throw new Error("Log bridge unavailable. Restart `pnpm dev`.");
      }
      const info = logInfo ?? (await systemApi.getLogInfo());
      setLogInfo(info);
      await systemApi.openLocalPath(info.logDirectoryPath);
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:diagnostics", "Failed to open log directory.", caughtError);
    }
  }, [logInfo, systemApi, writeAppLog]);

  const copyLogFilePath = useCallback(async () => {
    try {
      if (!systemApi?.getLogInfo) {
        throw new Error("Log bridge unavailable. Restart `pnpm dev`.");
      }
      const info = logInfo ?? (await systemApi.getLogInfo());
      setLogInfo(info);
      const copied = await copyTextToClipboard(info.logFilePath);
      if (!copied) {
        throw new Error("Clipboard unavailable.");
      }
      await showAppAlert("Log file path copied to clipboard.", {
        title: "Diagnostics"
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:diagnostics", "Failed to copy log file path.", caughtError);
    }
  }, [logInfo, showAppAlert, systemApi, writeAppLog]);

  const exportBugReportBundle = useCallback(async () => {
    try {
      if (!systemApi?.exportBugReport) {
        throw new Error("Bug report bridge unavailable. Restart `pnpm dev`.");
      }
      setIsExportingBugReport(true);
      const result = await systemApi.exportBugReport({
        settingsSnapshot: {
          appVersion: APP_VERSION,
          connectionPreferences,
          hotkeyPreferences,
          fileOpenPreferences,
          sftpTransferPreferences,
          serverHealthAlertPreferences,
          sessionSortMode
        },
        runtimeSnapshot: {
          capturedAtIso: new Date().toISOString(),
          sessionCount: sessions.length,
          sessionGroupCount: sessionGroupOptions.length,
          openTabCount: terminalTabs.length,
          activeTabId,
          selectedSessionId
        }
      });
      if (result.canceled || !result.outputPath) {
        return;
      }
      const copied = await copyTextToClipboard(result.outputPath);
      await showAppAlert(
        copied
          ? `Bug report exported.\nPath copied to clipboard:\n${result.outputPath}`
          : `Bug report exported:\n${result.outputPath}`,
        {
          title: "Diagnostics"
        }
      );
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:diagnostics", "Failed to export bug report.", caughtError);
    } finally {
      setIsExportingBugReport(false);
    }
  }, [
    activeTabId,
    connectionPreferences,
    fileOpenPreferences,
    hotkeyPreferences,
    selectedSessionId,
    serverHealthAlertPreferences,
    sessionGroupOptions.length,
    sessionSortMode,
    sessions.length,
    sftpTransferPreferences,
    showAppAlert,
    systemApi,
    terminalTabs.length,
    writeAppLog
  ]);

  const copyClashDirectRules = async (session: SessionRecord) => {
    const text = buildClashDirectRules(session);
    try {
      const copied = await copyTextToClipboard(text);
      if (copied) {
        await showAppAlert("Clash direct rules copied to clipboard.", {
          title: "Clash Rules"
        });
        return;
      }
    } catch {
      // Fall through to manual copy dialog.
    }
    await showAppAlert("Clipboard unavailable. Copy the text below manually.", {
      title: "Manual Copy",
      confirmLabel: "Close",
      detailText: text
    });
  };

  const copySessionConnectionCommand = useCallback(
    async (session: SessionRecord) => {
      const command = buildSshConnectionCommand(session);
      try {
        const copied = await copyTextToClipboard(command);
        if (copied) {
          await showAppAlert("SSH command copied to clipboard.", {
            title: "Connection Command"
          });
          return;
        }
      } catch {
        // Fall through to manual copy dialog.
      }
      await showAppAlert("Clipboard unavailable. Copy the command below manually.", {
        title: "Manual Copy",
        confirmLabel: "Close",
        detailText: command
      });
    },
    [showAppAlert]
  );

  const viewSessionDetails = useCallback(
    async (session: SessionRecord) => {
      const lines = [
        `Name: ${session.name}`,
        `Group: ${session.groupId?.trim() || "Ungrouped"}`,
        `Target: ${session.username}@${session.host}:${session.port}`,
        `Auth: ${session.authType}`,
        `Secret: ${session.hasSecret ? "Stored in secure vault" : "-"}`,
        `Last Connected: ${formatSessionLastConnected(session.lastConnectedAt)}`,
        `Remark: ${session.remark || "-"}`
      ];
      await showAppAlert("Session details", {
        title: session.name,
        confirmLabel: "Close",
        detailText: lines.join("\n")
      });
    },
    [showAppAlert]
  );

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

    const nameInput = await showAppPrompt("Enter a name for the new directory.", "", {
      title: "New Folder",
      confirmLabel: "Create"
    });
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

    const nameInput = await showAppPrompt("Enter the new name.", targetEntry.name, {
      title: `Rename ${targetEntry.kind === "directory" ? "Folder" : "File"}`,
      confirmLabel: "Rename"
    });
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

    const accepted = await showAppConfirm(
      `Delete ${targetEntry.kind === "directory" ? "directory" : "file"} "${targetEntry.name}"?`,
      {
        title: "Delete Entry",
        confirmLabel: "Delete",
        danger: true
      }
    );
    if (!accepted) {
      return;
    }

    setSftpActionLoading(true);
    setSftpError(null);
    setSftpDeleteProgress({
      name: targetEntry.name,
      kind: targetEntry.kind
    });
    try {
      await sftpApi.deletePath(activeTabId, targetEntry.path, targetEntry.kind);
      setSelectedSftpPath(null);
      await loadSftpDirectory(sftpDirectory.cwd, { tabId: activeTabId });
    } catch (caughtError) {
      setSftpError((caughtError as Error).message);
    } finally {
      setSftpDeleteProgress(null);
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
    const remoteOpenKey = `${activeTabId}:${targetEntry.path}`;
    if (openingRemoteFilesRef.current.has(remoteOpenKey)) {
      return;
    }
    openingRemoteFilesRef.current.add(remoteOpenKey);

    try {
      setSftpError(null);
      const prepared = await systemApi.prepareRemoteOpenFile(
        activeTabId,
        targetEntry.path,
        targetEntry.name
      );
      if (!prepared.alreadyOpen) {
        await sftpApi.downloadFile(
          activeTabId,
          createTransferId("down"),
          targetEntry.path,
          prepared.localPath
        );
        await systemApi.enableRemoteFileAutoSync(
          activeTabId,
          targetEntry.path,
          prepared.localPath
        );
      }
      const preferredProgramPath = fileOpenPreferences.preferredProgramPath.trim();
      await systemApi.openLocalPath(
        prepared.localPath,
        preferredProgramPath.length > 0 ? preferredProgramPath : null
      );
    } catch (caughtError) {
      setSftpError((caughtError as Error).message);
    } finally {
      openingRemoteFilesRef.current.delete(remoteOpenKey);
    }
  };

  const resolveDownloadTargetConflicts = useCallback(
    async (targets: DownloadTargetEntry[]): Promise<DownloadTargetEntry[] | null> => {
      if (!systemApi || targets.length === 0) {
        return targets;
      }

      const knownLocalNamesByDirectory = new Map<string, Set<string>>();
      const plannedLocalNamesByDirectory = new Map<string, Set<string>>();
      const getKnownLocalNames = async (directoryPath: string): Promise<Set<string>> => {
        const normalizedDirectory = directoryPath.trim() || ".";
        const cached = knownLocalNamesByDirectory.get(normalizedDirectory);
        if (cached) {
          return cached;
        }
        const listing = await systemApi.scanLocalPathEntries(normalizedDirectory);
        if (listing.kind === "missing") {
          const empty = new Set<string>();
          knownLocalNamesByDirectory.set(normalizedDirectory, empty);
          return empty;
        }
        if (listing.kind !== "directory") {
          throw new Error(`Download destination is not a directory: ${normalizedDirectory}`);
        }
        const names = new Set<string>();
        for (const filePath of listing.files) {
          const name = getPathBaseName(filePath).trim();
          if (name) {
            names.add(name);
          }
        }
        for (const childDirectoryPath of listing.directories) {
          const name = getPathBaseName(childDirectoryPath).trim();
          if (name) {
            names.add(name);
          }
        }
        knownLocalNamesByDirectory.set(normalizedDirectory, names);
        return names;
      };

      type PreparedDownloadTarget = DownloadTargetEntry & {
        directoryPath: string;
        fileName: string;
        knownNames: Set<string>;
      };

      const preparedTargets: PreparedDownloadTarget[] = [];
      let conflictCount = 0;
      for (const target of targets) {
        const localPath = target.localPath.trim();
        const remotePath = target.remotePath.trim();
        if (!localPath || !remotePath) {
          continue;
        }
        const directoryPath = getPathDirectoryName(localPath) || ".";
        const fileName = getPathBaseName(localPath).trim();
        if (!fileName) {
          continue;
        }
        const knownNames = await getKnownLocalNames(directoryPath);
        const plannedNames =
          plannedLocalNamesByDirectory.get(directoryPath) ?? new Set(knownNames);
        plannedLocalNamesByDirectory.set(directoryPath, plannedNames);
        if (plannedNames.has(fileName)) {
          conflictCount += 1;
        }
        plannedNames.add(fileName);
        preparedTargets.push({
          ...target,
          localPath: joinLocalPath(directoryPath, fileName),
          remotePath,
          directoryPath,
          fileName,
          knownNames
        });
      }

      if (conflictCount <= 0) {
        return preparedTargets.map((target) => ({
          name: target.name,
          remotePath: target.remotePath,
          localPath: target.localPath
        }));
      }

      const strategyChoice = await showAppChoice(
        `Found ${conflictCount} local conflicts in this download batch. Choose one strategy for all conflicts.`,
        [
          { value: "overwrite", label: "Overwrite" },
          { value: "skip", label: "Skip" },
          { value: "rename", label: "Rename" }
        ],
        {
          title: "Download Conflicts",
          cancelLabel: "Cancel Download"
        }
      );
      const strategy = toTransferConflictStrategy(strategyChoice);
      if (!strategy) {
        return null;
      }

      const resolvedTargets: DownloadTargetEntry[] = [];
      let skippedCount = 0;
      for (const target of preparedTargets) {
        const hasConflict = target.knownNames.has(target.fileName);
        if (!hasConflict) {
          target.knownNames.add(target.fileName);
          resolvedTargets.push({
            name: target.name,
            remotePath: target.remotePath,
            localPath: target.localPath
          });
          continue;
        }

        if (strategy === "skip") {
          skippedCount += 1;
          continue;
        }

        if (strategy === "overwrite") {
          target.knownNames.add(target.fileName);
          resolvedTargets.push({
            name: target.name,
            remotePath: target.remotePath,
            localPath: target.localPath
          });
          continue;
        }

        const renamedFileName = pickAvailableFileName(target.fileName, target.knownNames);
        target.knownNames.add(renamedFileName);
        resolvedTargets.push({
          name: target.name,
          remotePath: target.remotePath,
          localPath: joinLocalPath(target.directoryPath, renamedFileName)
        });
      }

      if (strategy === "skip" && skippedCount > 0) {
        await showAppAlert(`Skipped ${skippedCount} conflicting download item(s).`, {
          title: "Download Conflicts"
        });
      }
      return resolvedTargets;
    },
    [showAppAlert, showAppChoice, systemApi]
  );

  const resolveUploadPathEntryConflicts = useCallback(
    async (
      tabId: string,
      remoteBaseDirectory: string,
      entries: UploadPathEntry[]
    ): Promise<UploadPathEntry[] | null> => {
      if (!sftpApi || entries.length === 0) {
        return entries;
      }

      const knownRemoteNamesByDirectory = new Map<string, Set<string>>();
      const plannedRemoteNamesByDirectory = new Map<string, Set<string>>();
      const getKnownRemoteNames = async (remoteDirectory: string): Promise<Set<string>> => {
        const normalizedDirectory = normalizeRemoteDirectoryPath(remoteDirectory) || ".";
        const cached = knownRemoteNamesByDirectory.get(normalizedDirectory);
        if (cached) {
          return cached;
        }
        try {
          const listing = await sftpApi.listDirectory(tabId, normalizedDirectory);
          const names = new Set(
            listing.entries
              .map((entry) => entry.name.trim())
              .filter((name) => name.length > 0)
          );
          knownRemoteNamesByDirectory.set(normalizedDirectory, names);
          return names;
        } catch (caughtError) {
          const message = (caughtError as Error).message ?? "";
          if (isTabNotConnectedError(message)) {
            throw caughtError;
          }
          const empty = new Set<string>();
          knownRemoteNamesByDirectory.set(normalizedDirectory, empty);
          return empty;
        }
      };

      type PreparedUploadEntry = UploadPathEntry & {
        localPath: string;
        remoteDirectory: string;
        targetName: string;
        knownNames: Set<string>;
      };

      const preparedEntries: PreparedUploadEntry[] = [];
      let conflictCount = 0;
      for (const pathEntry of entries) {
        const localPath = pathEntry.localPath.trim();
        if (!localPath) {
          continue;
        }
        const defaultName = getPathBaseName(localPath).trim();
        const targetName = (pathEntry.remoteName?.trim() || defaultName).trim();
        if (!targetName) {
          continue;
        }
        const relativeDirectory = normalizeRelativeDirectoryPath(pathEntry.relativeDirectory);
        const remoteDirectory = relativeDirectory
          ? joinRemotePath(remoteBaseDirectory, relativeDirectory)
          : remoteBaseDirectory;
        const remoteDirectoryKey = normalizeRemoteDirectoryPath(remoteDirectory) || ".";
        const knownNames = await getKnownRemoteNames(remoteDirectory);
        const plannedNames =
          plannedRemoteNamesByDirectory.get(remoteDirectoryKey) ?? new Set(knownNames);
        plannedRemoteNamesByDirectory.set(remoteDirectoryKey, plannedNames);
        if (plannedNames.has(targetName)) {
          conflictCount += 1;
        }
        plannedNames.add(targetName);
        preparedEntries.push({
          ...pathEntry,
          localPath,
          remoteDirectory,
          targetName,
          knownNames
        });
      }

      if (conflictCount <= 0) {
        return preparedEntries.map((entry) => ({
          localPath: entry.localPath,
          relativeDirectory: entry.relativeDirectory,
          remoteName: entry.targetName
        }));
      }

      const strategyChoice = await showAppChoice(
        `Found ${conflictCount} remote conflicts in this upload batch. Choose one strategy for all conflicts.`,
        [
          { value: "overwrite", label: "Overwrite" },
          { value: "skip", label: "Skip" },
          { value: "rename", label: "Rename" }
        ],
        {
          title: "Upload Conflicts",
          cancelLabel: "Cancel Upload"
        }
      );
      const strategy = toTransferConflictStrategy(strategyChoice);
      if (!strategy) {
        return null;
      }

      const resolvedEntries: UploadPathEntry[] = [];
      let skippedCount = 0;
      for (const entry of preparedEntries) {
        const hasConflict = entry.knownNames.has(entry.targetName);
        if (!hasConflict) {
          entry.knownNames.add(entry.targetName);
          resolvedEntries.push({
            localPath: entry.localPath,
            relativeDirectory: entry.relativeDirectory,
            remoteName: entry.targetName
          });
          continue;
        }

        if (strategy === "skip") {
          skippedCount += 1;
          continue;
        }

        if (strategy === "overwrite") {
          entry.knownNames.add(entry.targetName);
          resolvedEntries.push({
            localPath: entry.localPath,
            relativeDirectory: entry.relativeDirectory,
            remoteName: entry.targetName
          });
          continue;
        }

        const renamedTargetName = pickAvailableFileName(entry.targetName, entry.knownNames);
        entry.knownNames.add(renamedTargetName);
        resolvedEntries.push({
          localPath: entry.localPath,
          relativeDirectory: entry.relativeDirectory,
          remoteName: renamedTargetName
        });
      }

      if (strategy === "skip" && skippedCount > 0) {
        await showAppAlert(`Skipped ${skippedCount} conflicting upload item(s).`, {
          title: "Upload Conflicts"
        });
      }
      return resolvedEntries;
    },
    [sftpApi, showAppAlert, showAppChoice]
  );

  const enqueueDownloadTargets = useCallback(
    (
      tabId: string,
      targets: DownloadTargetEntry[],
      options?: {
        batchId?: string;
        incrementExistingBatchTotal?: boolean;
        suppressEmptyError?: boolean;
      }
    ): number => {
      const batchId = options?.batchId?.trim()
        ? options.batchId.trim()
        : `batch-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      if (canceledDownloadBatchIdsRef.current.has(batchId)) {
        return 0;
      }
      const queuedJobs: PendingDownloadJob[] = [];
      for (const target of targets) {
        const remotePath = target.remotePath.trim();
        const localPath = target.localPath.trim();
        const fallbackName = getPathBaseName(remotePath);
        const name = target.name.trim() || fallbackName;
        if (!remotePath || !localPath || !name) {
          continue;
        }
        const transferId = createTransferId("down");
        const nextJob: PendingDownloadJob = {
          tabId,
          transferId,
          batchId,
          localPath,
          remotePath,
          name
        };
        queuedJobs.push(nextJob);
        applySftpTransferEvent({
          tabId: nextJob.tabId,
          transferId: nextJob.transferId,
          direction: "download",
          status: "queued",
          name: nextJob.name,
          localPath: nextJob.localPath,
          remotePath: nextJob.remotePath,
          transferredBytes: 0,
          totalBytes: 0,
          message: "queued",
          batchId
        });
      }
      if (queuedJobs.length === 0) {
        if (!options?.suppressEmptyError) {
          setSftpError("No valid files to download.");
        }
        return 0;
      }
      setDownloadBatchByTab((prev) => {
        const current = prev[tabId];
        const total =
          options?.incrementExistingBatchTotal && current && current.batchId === batchId
            ? current.total + queuedJobs.length
            : queuedJobs.length;
        return {
          ...prev,
          [tabId]: {
            batchId,
            total
          }
        };
      });
      downloadQueueRef.current.push(...queuedJobs);
      drainDownloadQueue();
      return queuedJobs.length;
    },
    [applySftpTransferEvent, drainDownloadQueue]
  );

  const downloadSftpDirectory = async (entry?: SftpEntry | null) => {
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
    if (!targetEntry || targetEntry.kind !== "directory") {
      setSftpError("Select a directory first.");
      return;
    }

    const destinationDirectory = await systemApi.pickDownloadDirectory(targetEntry.name);
    if (!destinationDirectory) {
      return;
    }

    let activeBatchId: string | null = null;
    try {
      setSftpActionLoading(true);
      setSftpError(null);

      const rootLocalName = sanitizeLocalPathSegment(targetEntry.name);
      const directoryQueue: Array<{
        remotePath: string;
        localRelativePath: string;
      }> = [
        {
          remotePath: targetEntry.path,
          localRelativePath: rootLocalName
        }
      ];
      const batchId = `batch-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      activeBatchId = batchId;
      canceledDownloadBatchIdsRef.current.delete(batchId);
      setDownloadBatchByTab((prev) => ({
        ...prev,
        [activeTabId]: {
          batchId,
          total: 0
        }
      }));
      const discoveredFileTargets: DownloadTargetEntry[] = [];
      let skippedEntries = 0;

      while (directoryQueue.length > 0) {
        if (canceledDownloadBatchIdsRef.current.has(batchId)) {
          break;
        }
        const currentDirectory = directoryQueue.shift();
        if (!currentDirectory) {
          continue;
        }
        const listing = await sftpApi.listDirectory(activeTabId, currentDirectory.remotePath);
        if (canceledDownloadBatchIdsRef.current.has(batchId)) {
          break;
        }
        for (const childEntry of listing.entries) {
          if (canceledDownloadBatchIdsRef.current.has(batchId)) {
            break;
          }
          const localName = sanitizeLocalPathSegment(childEntry.name);
          const nextLocalRelativePath = joinRemotePath(
            currentDirectory.localRelativePath,
            localName
          );
          if (childEntry.kind === "directory") {
            directoryQueue.push({
              remotePath: childEntry.path,
              localRelativePath: nextLocalRelativePath
            });
            continue;
          }
          if (childEntry.kind === "file") {
            discoveredFileTargets.push({
              name: childEntry.name,
              remotePath: childEntry.path,
              localPath: joinLocalPath(destinationDirectory, nextLocalRelativePath)
            });
            continue;
          }
          skippedEntries += 1;
        }
      }

      if (canceledDownloadBatchIdsRef.current.has(batchId)) {
        return;
      }
      if (discoveredFileTargets.length === 0) {
        setDownloadBatchByTab((prev) => {
          const current = prev[activeTabId];
          if (!current || current.batchId !== batchId) {
            return prev;
          }
          const next = { ...prev };
          delete next[activeTabId];
          return next;
        });
        await showAppAlert(`No files found in "${targetEntry.name}".`, {
          title: "Download Folder"
        });
        return;
      }

      const resolvedTargets = await resolveDownloadTargetConflicts(discoveredFileTargets);
      if (!resolvedTargets) {
        setDownloadBatchByTab((prev) => {
          const current = prev[activeTabId];
          if (!current || current.batchId !== batchId) {
            return prev;
          }
          const next = { ...prev };
          delete next[activeTabId];
          return next;
        });
        return;
      }
      const totalQueuedFiles = enqueueDownloadTargets(activeTabId, resolvedTargets, {
        batchId,
        incrementExistingBatchTotal: true,
        suppressEmptyError: true
      });
      if (totalQueuedFiles === 0) {
        setDownloadBatchByTab((prev) => {
          const current = prev[activeTabId];
          if (!current || current.batchId !== batchId) {
            return prev;
          }
          const next = { ...prev };
          delete next[activeTabId];
          return next;
        });
        return;
      }

      if (skippedEntries > 0) {
        await showAppAlert(
          `Queued ${totalQueuedFiles} files from "${targetEntry.name}". Skipped ${skippedEntries} unsupported entries.`,
          { title: "Download Folder" }
        );
      }
    } catch (caughtError) {
      setSftpError((caughtError as Error).message);
    } finally {
      if (activeBatchId) {
        canceledDownloadBatchIdsRef.current.delete(activeBatchId);
      }
      setSftpActionLoading(false);
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
    if (!targetEntry) {
      setSftpError("Select a file or directory first.");
      return;
    }
    if (targetEntry.kind === "directory") {
      await downloadSftpDirectory(targetEntry);
      return;
    }
    if (targetEntry.kind !== "file") {
      setSftpError("Only files and directories can be downloaded.");
      return;
    }

    const localPath = await systemApi.pickDownloadTarget(targetEntry.name);
    if (!localPath) {
      return;
    }

    try {
      setSftpError(null);
      const resolvedTargets = await resolveDownloadTargetConflicts([
        {
          name: targetEntry.name,
          remotePath: targetEntry.path,
          localPath
        }
      ]);
      if (!resolvedTargets || resolvedTargets.length === 0) {
        return;
      }
      enqueueDownloadTargets(activeTabId, resolvedTargets);
    } catch (caughtError) {
      setSftpError((caughtError as Error).message);
    }
  };

  const enqueueUploadTargets = useCallback(
    (
      tabId: string,
      targets: Array<{
        name?: string;
        localPath: string;
        remotePath: string;
      }>,
      options?: {
        batchId?: string;
        incrementExistingBatchTotal?: boolean;
        suppressEmptyError?: boolean;
      }
    ): number => {
      const batchId = options?.batchId?.trim()
        ? options.batchId.trim()
        : `batch-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      if (canceledUploadBatchIdsRef.current.has(batchId)) {
        return 0;
      }
      const queuedJobs: PendingUploadJob[] = [];
      for (const target of targets) {
        const localPath = target.localPath.trim();
        const remotePath = target.remotePath.trim();
        const fallbackName = getPathBaseName(remotePath) || getPathBaseName(localPath);
        const name = (target.name?.trim() || fallbackName).trim();
        if (!localPath || !remotePath || !name) {
          continue;
        }
        const transferId = createTransferId("up");
        const remoteDirectory = getPathDirectoryName(remotePath) || ".";
        const nextJob: PendingUploadJob = {
          tabId,
          transferId,
          batchId,
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
          message: "queued",
          batchId
        });
      }
      if (queuedJobs.length === 0) {
        if (!options?.suppressEmptyError) {
          setSftpError("No valid files to upload.");
        }
        return 0;
      }
      setUploadBatchByTab((prev) => {
        const current = prev[tabId];
        const total =
          options?.incrementExistingBatchTotal && current && current.batchId === batchId
            ? current.total + queuedJobs.length
            : queuedJobs.length;
        return {
          ...prev,
          [tabId]: {
            batchId,
            total
          }
        };
      });
      uploadQueueRef.current.push(...queuedJobs);
      drainUploadQueue();
      return queuedJobs.length;
    },
    [applySftpTransferEvent, drainUploadQueue]
  );

  const enqueueUploadPathEntries = useCallback(
    (
      tabId: string,
      remoteBaseDirectory: string,
      entries: UploadPathEntry[],
      options?: {
        batchId?: string;
        incrementExistingBatchTotal?: boolean;
        suppressEmptyError?: boolean;
      }
    ): number => {
      const batchId = options?.batchId?.trim()
        ? options.batchId.trim()
        : `batch-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      if (canceledUploadBatchIdsRef.current.has(batchId)) {
        return 0;
      }
      const queuedJobs: PendingUploadJob[] = [];
      for (const pathEntry of entries) {
        const localPath = pathEntry.localPath.trim();
        const name = (pathEntry.remoteName?.trim() || getPathBaseName(localPath)).trim();
        if (!name) {
          continue;
        }
        const relativeDirectory = normalizeRelativeDirectoryPath(pathEntry.relativeDirectory);
        const transferId = createTransferId("up");
        const remoteDirectory = relativeDirectory
          ? joinRemotePath(remoteBaseDirectory, relativeDirectory)
          : remoteBaseDirectory;
        const remotePath = joinRemotePath(remoteDirectory, name);
        const nextJob: PendingUploadJob = {
          tabId,
          transferId,
          batchId,
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
          message: "queued",
          batchId
        });
      }
      if (queuedJobs.length === 0) {
        if (!options?.suppressEmptyError) {
          setSftpError("No valid files to upload.");
        }
        return 0;
      }
      setUploadBatchByTab((prev) => {
        const current = prev[tabId];
        const total =
          options?.incrementExistingBatchTotal && current && current.batchId === batchId
            ? current.total + queuedJobs.length
            : queuedJobs.length;
        return {
          ...prev,
          [tabId]: {
            batchId,
            total
          }
        };
      });
      uploadQueueRef.current.push(...queuedJobs);
      drainUploadQueue();
      return queuedJobs.length;
    },
    [applySftpTransferEvent, drainUploadQueue]
  );

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
    const batchId = `batch-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    canceledUploadBatchIdsRef.current.delete(batchId);
    try {
      setUploadBatchByTab((prev) => ({
        ...prev,
        [activeTabId]: {
          batchId,
          total: 0
        }
      }));
      const discoveredEntries: UploadPathEntry[] = [];
      let skippedEntries = 0;
      const directoryQueue: Array<{
        localDirectoryPath: string;
        relativeDirectory: string;
      }> = [];

      for (const rawPath of paths) {
        if (canceledUploadBatchIdsRef.current.has(batchId)) {
          break;
        }
        const listing = await systemApi.scanLocalPathEntries(rawPath);
        if (canceledUploadBatchIdsRef.current.has(batchId)) {
          break;
        }
        if (listing.kind === "file") {
          discoveredEntries.push({
            localPath: listing.path,
            relativeDirectory: ""
          });
          continue;
        }
        if (listing.kind === "directory") {
          const topName = getPathBaseName(listing.path);
          if (!topName) {
            skippedEntries += 1;
            continue;
          }
          if (listing.files.length > 0) {
            discoveredEntries.push(
              ...listing.files.map((localPath) => ({
                localPath,
                relativeDirectory: topName
              }))
            );
          }
          for (const childDirectoryPath of listing.directories) {
            if (canceledUploadBatchIdsRef.current.has(batchId)) {
              break;
            }
            const childName = getPathBaseName(childDirectoryPath);
            if (!childName) {
              skippedEntries += 1;
              continue;
            }
            directoryQueue.push({
              localDirectoryPath: childDirectoryPath,
              relativeDirectory: joinRemotePath(topName, childName)
            });
          }
          continue;
        }
        skippedEntries += 1;
      }

      while (directoryQueue.length > 0) {
        if (canceledUploadBatchIdsRef.current.has(batchId)) {
          break;
        }
        const currentDirectory = directoryQueue.shift();
        if (!currentDirectory) {
          continue;
        }
        const listing = await systemApi.scanLocalPathEntries(currentDirectory.localDirectoryPath);
        if (canceledUploadBatchIdsRef.current.has(batchId)) {
          break;
        }
        if (listing.kind !== "directory") {
          skippedEntries += 1;
          continue;
        }
        if (listing.files.length > 0) {
          discoveredEntries.push(
            ...listing.files.map((localPath) => ({
              localPath,
              relativeDirectory: currentDirectory.relativeDirectory
            }))
          );
        }
        for (const childDirectoryPath of listing.directories) {
          if (canceledUploadBatchIdsRef.current.has(batchId)) {
            break;
          }
          const childName = getPathBaseName(childDirectoryPath);
          if (!childName) {
            skippedEntries += 1;
            continue;
          }
          directoryQueue.push({
            localDirectoryPath: childDirectoryPath,
            relativeDirectory: joinRemotePath(currentDirectory.relativeDirectory, childName)
          });
        }
      }

      if (canceledUploadBatchIdsRef.current.has(batchId)) {
        return;
      }
      if (discoveredEntries.length === 0) {
        setUploadBatchByTab((prev) => {
          const current = prev[activeTabId];
          if (!current || current.batchId !== batchId) {
            return prev;
          }
          const next = { ...prev };
          delete next[activeTabId];
          return next;
        });
        setSftpError("No valid files to upload.");
        return;
      }
      const resolvedEntries = await resolveUploadPathEntryConflicts(
        activeTabId,
        sftpDirectory.cwd,
        discoveredEntries
      );
      if (!resolvedEntries) {
        setUploadBatchByTab((prev) => {
          const current = prev[activeTabId];
          if (!current || current.batchId !== batchId) {
            return prev;
          }
          const next = { ...prev };
          delete next[activeTabId];
          return next;
        });
        return;
      }
      const totalQueuedFiles = enqueueUploadPathEntries(
        activeTabId,
        sftpDirectory.cwd,
        resolvedEntries,
        {
          batchId,
          incrementExistingBatchTotal: true,
          suppressEmptyError: true
        }
      );
      if (totalQueuedFiles === 0) {
        setUploadBatchByTab((prev) => {
          const current = prev[activeTabId];
          if (!current || current.batchId !== batchId) {
            return prev;
          }
          const next = { ...prev };
          delete next[activeTabId];
          return next;
        });
        setSftpError("No valid files to upload.");
        return;
      }
      if (skippedEntries > 0) {
        await showAppAlert(
          `Queued ${totalQueuedFiles} upload files. Skipped ${skippedEntries} unsupported entries.`,
          { title: "Upload Summary" }
        );
      }
    } finally {
      canceledUploadBatchIdsRef.current.delete(batchId);
    }
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
          batchId: queuedJob.batchId,
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
    if (transfer.direction === "download" && transfer.status === "queued") {
      const queueIndex = downloadQueueRef.current.findIndex(
        (job) => job.tabId === transfer.tabId && job.transferId === transfer.transferId
      );
      if (queueIndex >= 0) {
        const [queuedJob] = downloadQueueRef.current.splice(queueIndex, 1);
        applySftpTransferEvent({
          tabId: queuedJob.tabId,
          transferId: queuedJob.transferId,
          direction: "download",
          status: "canceled",
          batchId: queuedJob.batchId,
          name: queuedJob.name,
          localPath: queuedJob.localPath,
          remotePath: queuedJob.remotePath,
          transferredBytes: 0,
          totalBytes: 0,
          message: "canceled"
        });
        drainDownloadQueue();
        return;
      }
    }
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

  const cancelAllActiveUploads = async () => {
    if (!activeTabId) {
      return;
    }
    const tabId = activeTabId;
    const activeBatchId = uploadBatchByTab[tabId]?.batchId;
    if (activeBatchId) {
      canceledUploadBatchIdsRef.current.add(activeBatchId);
    }
    setUploadBatchByTab((prev) => {
      if (!prev[tabId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    const queuedJobs = uploadQueueRef.current.filter((job) => job.tabId === tabId);
    const queuedTransferIds = new Set(queuedJobs.map((job) => job.transferId));
    if (queuedJobs.length > 0) {
      uploadQueueRef.current = uploadQueueRef.current.filter((job) => job.tabId !== tabId);
      for (const job of queuedJobs) {
        applySftpTransferEvent({
          tabId: job.tabId,
          transferId: job.transferId,
          direction: "upload",
          status: "canceled",
          batchId: job.batchId,
          name: job.name,
          localPath: job.localPath,
          remotePath: job.remotePath,
          transferredBytes: 0,
          totalBytes: 0,
          message: "canceled"
        });
      }
    }
    const transferIdsToCancel = new Set<string>();
    for (const transfer of sftpTransfers) {
      if (
        transfer.tabId !== tabId ||
        transfer.direction !== "upload" ||
        (transfer.status !== "queued" && transfer.status !== "running")
      ) {
        continue;
      }
      if (!queuedTransferIds.has(transfer.transferId)) {
        transferIdsToCancel.add(transfer.transferId);
      }
    }
    for (const [transferId, runningTabId] of runningUploadIdsRef.current.entries()) {
      if (runningTabId === tabId) {
        transferIdsToCancel.add(transferId);
      }
    }
    if (!sftpApi) {
      drainUploadQueue();
      return;
    }
    await Promise.allSettled(
      Array.from(transferIdsToCancel).map((transferId) => sftpApi.cancelUpload(tabId, transferId))
    );
    drainUploadQueue();
  };

  const cancelAllActiveDownloads = async () => {
    if (!activeTabId) {
      return;
    }
    const tabId = activeTabId;
    const activeBatchId = downloadBatchByTab[tabId]?.batchId;
    if (activeBatchId) {
      canceledDownloadBatchIdsRef.current.add(activeBatchId);
    }
    setDownloadBatchByTab((prev) => {
      if (!prev[tabId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    const queuedJobs = downloadQueueRef.current.filter((job) => job.tabId === tabId);
    const queuedTransferIds = new Set(queuedJobs.map((job) => job.transferId));
    if (queuedJobs.length > 0) {
      downloadQueueRef.current = downloadQueueRef.current.filter((job) => job.tabId !== tabId);
      for (const job of queuedJobs) {
        applySftpTransferEvent({
          tabId: job.tabId,
          transferId: job.transferId,
          direction: "download",
          status: "canceled",
          batchId: job.batchId,
          name: job.name,
          localPath: job.localPath,
          remotePath: job.remotePath,
          transferredBytes: 0,
          totalBytes: 0,
          message: "canceled"
        });
      }
    }
    const transferIdsToCancel = new Set<string>();
    for (const transfer of sftpTransfers) {
      if (
        transfer.tabId !== tabId ||
        transfer.direction !== "download" ||
        (transfer.status !== "queued" && transfer.status !== "running")
      ) {
        continue;
      }
      if (!queuedTransferIds.has(transfer.transferId)) {
        transferIdsToCancel.add(transfer.transferId);
      }
    }
    for (const [transferId, runningTabId] of runningDownloadIdsRef.current.entries()) {
      if (runningTabId === tabId) {
        transferIdsToCancel.add(transferId);
      }
    }
    if (!sftpApi) {
      drainDownloadQueue();
      return;
    }
    await Promise.allSettled(
      Array.from(transferIdsToCancel).map((transferId) => sftpApi.cancelDownload(tabId, transferId))
    );
    drainDownloadQueue();
  };

  const clearFinishedTransfers = (direction: "upload" | "download") => {
    if (!activeTabId) {
      return;
    }
    setSftpTransfers((prev) =>
      prev.filter((transfer) => {
        if (transfer.tabId !== activeTabId || transfer.direction !== direction) {
          return true;
        }
        return transfer.status === "queued" || transfer.status === "running";
      })
    );
  };

  const markTransferHistoryRetryQueued = useCallback(
    (
      direction: SftpTransferEvent["direction"],
      entries: Array<{
        localPath: string;
        remotePath: string;
      }>
    ) => {
      if (!activeSessionId || entries.length === 0) {
        return;
      }
      const retryKeys = new Set(
        entries.map((entry) =>
          createTransferHistoryKey(
            activeSessionId,
            direction,
            entry.localPath.trim(),
            entry.remotePath.trim()
          )
        )
      );
      const now = Date.now();
      setTransferHistory((prev) => {
        let changed = false;
        const next = prev.map((item) => {
          if (
            item.sessionId !== activeSessionId ||
            item.direction !== direction ||
            item.status !== "failed" ||
            !retryKeys.has(item.key)
          ) {
            return item;
          }
          changed = true;
          const updated: SftpTransferHistoryItem = {
            ...item,
            status: "queued",
            updatedAt: now,
            message: "Retry queued."
          };
          return updated;
        });
        if (!changed) {
          return prev;
        }
        next.sort((left, right) => right.updatedAt - left.updatedAt);
        return next.slice(0, MAX_SFTP_TRANSFER_HISTORY);
      });
    },
    [activeSessionId]
  );

  const openRetryCenter = useCallback(() => {
    setIsRetryCenterOpen(true);
  }, []);

  const closeRetryCenter = useCallback(() => {
    setIsRetryCenterOpen(false);
    setRetryCenterSelection([]);
  }, []);

  const toggleRetryCenterEntrySelection = useCallback((key: string) => {
    const normalized = key.trim();
    if (!normalized) {
      return;
    }
    setRetryCenterSelection((prev) => {
      if (prev.includes(normalized)) {
        return prev.filter((entryKey) => entryKey !== normalized);
      }
      return [...prev, normalized];
    });
  }, []);

  const selectAllVisibleRetryCenterEntries = useCallback(() => {
    setRetryCenterSelection(retryCenterEntries.map((entry) => entry.key));
  }, [retryCenterEntries]);

  const clearRetryCenterSelection = useCallback(() => {
    setRetryCenterSelection([]);
  }, []);

  const retrySelectedRetryCenterEntries = async () => {
    if (!activeTabId || !activeSessionId) {
      await showAppAlert("Open a terminal tab for the target session first.", {
        title: "Retry Center"
      });
      return;
    }
    if (selectedRetryCenterFailedEntries.length === 0) {
      return;
    }
    const tabId = activeTabId;
    const selectedKeys = new Set(selectedRetryCenterFailedEntries.map((entry) => entry.key));
    const uploadTargetMap = new Map<
      string,
      { name: string; localPath: string; remotePath: string }
    >();
    const downloadTargetMap = new Map<
      string,
      { name: string; localPath: string; remotePath: string }
    >();
    for (const entry of selectedRetryCenterFailedEntries) {
      const key = createTransferRetryKey(entry.direction, entry.localPath, entry.remotePath);
      const target = {
        name: entry.name,
        localPath: entry.localPath,
        remotePath: entry.remotePath
      };
      if (entry.direction === "upload") {
        uploadTargetMap.set(key, target);
        continue;
      }
      downloadTargetMap.set(key, target);
    }

    let queuedCount = 0;
    const uploadTargets = Array.from(uploadTargetMap.values());
    if (uploadTargets.length > 0) {
      const uploadQueued = enqueueUploadTargets(tabId, uploadTargets, {
        suppressEmptyError: true
      });
      queuedCount += uploadQueued;
      if (uploadQueued > 0) {
        markTransferHistoryRetryQueued(
          "upload",
          uploadTargets.map((entry) => ({
            localPath: entry.localPath,
            remotePath: entry.remotePath
          }))
        );
      }
    }

    const downloadTargets = Array.from(downloadTargetMap.values());
    if (downloadTargets.length > 0) {
      const resolvedTargets = await resolveDownloadTargetConflicts(
        downloadTargets.map((entry) => ({
          name: entry.name,
          localPath: entry.localPath,
          remotePath: entry.remotePath
        }))
      );
      if (resolvedTargets && resolvedTargets.length > 0) {
        const downloadQueued = enqueueDownloadTargets(tabId, resolvedTargets, {
          suppressEmptyError: true
        });
        queuedCount += downloadQueued;
        if (downloadQueued > 0) {
          markTransferHistoryRetryQueued(
            "download",
            resolvedTargets.map((entry) => ({
              localPath: entry.localPath,
              remotePath: entry.remotePath
            }))
          );
        }
      }
    }

    if (queuedCount <= 0) {
      await showAppAlert("No transfer tasks were requeued.", {
        title: "Retry Center"
      });
      return;
    }

    setRetryCenterSelection((prev) => prev.filter((key) => !selectedKeys.has(key)));
    await showAppAlert(`Requeued ${queuedCount} transfer task(s) from history.`, {
      title: "Retry Center"
    });
  };

  const clearSelectedRetryCenterEntries = async () => {
    if (selectedRetryCenterEntries.length === 0) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Delete ${selectedRetryCenterEntries.length} selected history record(s)?`,
      {
        title: "Retry Center",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    const selectedKeys = new Set(selectedRetryCenterEntries.map((entry) => entry.key));
    setTransferHistory((prev) => prev.filter((entry) => !selectedKeys.has(entry.key)));
    setRetryCenterSelection([]);
  };

  const clearVisibleRetryCenterEntries = async () => {
    if (retryCenterEntries.length === 0) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Delete ${retryCenterEntries.length} visible history record(s)?`,
      {
        title: "Retry Center",
        confirmLabel: "Delete Visible",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    const visibleKeys = new Set(retryCenterEntries.map((entry) => entry.key));
    setTransferHistory((prev) => prev.filter((entry) => !visibleKeys.has(entry.key)));
    setRetryCenterSelection([]);
  };

  const clearAllRetryCenterEntries = async () => {
    if (transferHistory.length === 0) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Delete all ${transferHistory.length} transfer history record(s)?`,
      {
        title: "Retry Center",
        confirmLabel: "Delete All",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    setTransferHistory([]);
    setRetryCenterSelection([]);
  };

  const retryFailedUploads = async () => {
    if (!activeTabId || failedUploadRetryCandidates.length === 0) {
      return;
    }
    const tabId = activeTabId;
    const sortedFailedTransfers = [...failedUploadRetryCandidates];
    const queuedCount = enqueueUploadTargets(
      tabId,
      sortedFailedTransfers.map((transfer) => ({
        name: transfer.name,
        localPath: transfer.localPath,
        remotePath: transfer.remotePath
      })),
      {
        suppressEmptyError: true
      }
    );
    if (queuedCount > 0) {
      markTransferHistoryRetryQueued(
        "upload",
        sortedFailedTransfers.map((transfer) => ({
          localPath: transfer.localPath,
          remotePath: transfer.remotePath
        }))
      );
      await showAppAlert(`Requeued ${queuedCount} failed upload task(s).`, {
        title: "Retry Uploads"
      });
    }
  };

  const retryFailedDownloads = async () => {
    if (!activeTabId || failedDownloadRetryCandidates.length === 0) {
      return;
    }
    const tabId = activeTabId;
    const sortedFailedTransfers = [...failedDownloadRetryCandidates];
    const retryTargets = sortedFailedTransfers.map((transfer) => ({
      name: transfer.name,
      remotePath: transfer.remotePath,
      localPath: transfer.localPath
    }));
    const resolvedTargets = await resolveDownloadTargetConflicts(retryTargets);
    if (!resolvedTargets || resolvedTargets.length === 0) {
      return;
    }
    const queuedCount = enqueueDownloadTargets(tabId, resolvedTargets, {
      suppressEmptyError: true
    });
    if (queuedCount > 0) {
      markTransferHistoryRetryQueued(
        "download",
        resolvedTargets.map((entry) => ({
          localPath: entry.localPath,
          remotePath: entry.remotePath
        }))
      );
      await showAppAlert(`Requeued ${queuedCount} failed download task(s).`, {
        title: "Retry Downloads"
      });
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

  const runSessionContextAction = (action: SessionContextAction) => {
    if (action.disabled) {
      return;
    }
    closeSessionContextMenu();
    action.run();
  };

  const runSftpToolbarAction = (action: SftpContextAction) => {
    if (action.disabled) {
      return;
    }
    closeSftpToolbarMenu();
    action.run();
  };

  const promptCreateSessionGroup = async () => {
    const groupNameInput = await showAppPrompt("Enter a name for the new group.", "", {
      title: "New Group",
      confirmLabel: "Create"
    });
    if (groupNameInput === null) {
      return;
    }
    addSessionGroup(groupNameInput);
  };

  const appendSessionSortActions = (actions: SessionContextAction[]) => {
    actions.push({
      id: "sort-default",
      label: sessionSortMode === "default" ? "Sort: Default (Current)" : "Sort: Default",
      run: () => {
        setSessionSortMode("default");
      }
    });
    actions.push({
      id: "sort-recent",
      label: sessionSortMode === "recent" ? "Sort: Recent (Current)" : "Sort: Recent",
      run: () => {
        setSessionSortMode("recent");
      }
    });
    actions.push({
      id: "sort-name-asc",
      label: sessionSortMode === "nameAsc" ? "Sort: Name A-Z (Current)" : "Sort: Name A-Z",
      run: () => {
        setSessionSortMode("nameAsc");
      }
    });
    actions.push({
      id: "sort-name-desc",
      label: sessionSortMode === "nameDesc" ? "Sort: Name Z-A (Current)" : "Sort: Name Z-A",
      run: () => {
        setSessionSortMode("nameDesc");
      }
    });
  };

  const sessionContextActions: SessionContextAction[] = [];
  const contextTarget = sessionContextMenu?.target ?? null;
  if (contextTarget?.type === "session" && sessionContextTarget) {
    const selectedSet = new Set(selectedSessionsInActiveGroup.map((session) => session.id));
    const sessionsForActions =
      selectedSet.has(sessionContextTarget.id) && selectedSessionsInActiveGroup.length > 0
        ? selectedSessionsInActiveGroup
        : [sessionContextTarget];
    const selectedIds = sessionsForActions.map((session) => session.id);
    const selectedCount = sessionsForActions.length;

    sessionContextActions.push({
      id: "open-session",
      label: selectedCount > 1 ? `Open ${selectedCount} Selected Tabs` : "Open Terminal Tab",
      run: () => {
        for (const session of sessionsForActions) {
          openTerminalTab(session);
        }
      }
    });
    if (selectedCount === 1) {
      sessionContextActions.push({
        id: "view-session",
        label: "View Details",
        run: () => {
          void viewSessionDetails(sessionContextTarget);
        }
      });
      sessionContextActions.push({
        id: "toggle-favorite",
        label: sessionContextTarget.favorite ? "Unfavorite" : "Favorite",
        run: () => {
          void patchSession(sessionContextTarget.id, {
            favorite: !sessionContextTarget.favorite
          });
        }
      });
      sessionContextActions.push({
        id: "copy-clash-rules",
        label: "Copy Clash Direct Rules",
        run: () => {
          void copyClashDirectRules(sessionContextTarget);
        }
      });
      sessionContextActions.push({
        id: "copy-ssh-command",
        label: "Copy SSH Command",
        run: () => {
          void copySessionConnectionCommand(sessionContextTarget);
        }
      });
      sessionContextActions.push({
        id: "edit-session",
        label: "Edit Session",
        run: () => {
          openEditModal(sessionContextTarget);
        }
      });
      sessionContextActions.push({
        id: "duplicate-session",
        label: "Duplicate Session",
        run: () => {
          openDuplicateSessionModal(sessionContextTarget);
        }
      });
    }
    sessionContextActions.push({
      id: "move-session-group",
      label: selectedCount > 1 ? "Move Selected to Group..." : "Move to Group...",
      run: () => {
        openMoveSessionsToGroupDialog(selectedIds);
      }
    });
    sessionContextActions.push({
      id: "move-session-ungrouped",
      label: selectedCount > 1 ? "Move Selected to Ungrouped" : "Move to Ungrouped",
      run: () => {
        void assignSessionsToGroup(selectedIds, "");
      }
    });
    sessionContextActions.push({
      id: "delete-session",
      label: selectedCount > 1 ? `Delete ${selectedCount} Selected` : "Delete Session",
      danger: true,
      run: () => {
        void removeSessionsByIds(selectedIds);
      }
    });
    appendSessionSortActions(sessionContextActions);
  } else if (contextTarget?.type === "group") {
    const contextGroup =
      groupedSessions.find((group) => group.key === contextTarget.groupKey) ?? null;
    const groupsForActions =
      selectedGroupKeySet.has(contextTarget.groupKey) && selectedGroups.length > 0
        ? selectedGroups
        : contextGroup
          ? [contextGroup]
          : [];
    const groupNamesForActions = groupsForActions
      .filter((group) => group.groupName.trim().length > 0)
      .map((group) => group.groupName);

    sessionContextActions.push({
      id: "open-group",
      label: "Open Group",
      run: () => {
        setSelectedGroupKeys([contextTarget.groupKey]);
        setActiveSessionGroupKey(contextTarget.groupKey);
      }
    });
    sessionContextActions.push({
      id: "new-session",
      label: "New Session",
      run: () => {
        openCreateModal(contextTarget.groupName);
      }
    });
    sessionContextActions.push({
      id: "import-ssh-config",
      label: "Import SSH Config...",
      run: () => {
        void importSessionsFromSshConfig();
      }
    });
    sessionContextActions.push({
      id: "new-group",
      label: "New Group",
      run: () => {
        void promptCreateSessionGroup();
      }
    });
    sessionContextActions.push({
      id: "select-all-groups",
      label: "Select All Groups",
      disabled: groupedSessions.length === 0,
      run: () => {
        setSelectedGroupKeys(groupedSessions.map((group) => group.key));
      }
    });
    sessionContextActions.push({
      id: "clear-group-selection",
      label: "Clear Group Selection",
      disabled: selectedGroupKeys.length === 0,
      run: () => {
        setSelectedGroupKeys([]);
      }
    });
    sessionContextActions.push({
      id: "rename-group",
      label:
        groupNamesForActions.length > 1
          ? "Rename Group (Select One)"
          : "Rename Group",
      disabled: groupNamesForActions.length !== 1,
      run: () => {
        void renameSessionGroup(groupNamesForActions[0]);
      }
    });
    sessionContextActions.push({
      id: "delete-group",
      label:
        groupNamesForActions.length > 1
          ? `Delete ${groupNamesForActions.length} Selected Groups`
          : "Delete Group",
      disabled: groupNamesForActions.length === 0,
      danger: true,
      run: () => {
        void deleteSessionGroupsBatch(groupNamesForActions);
      }
    });
    appendSessionSortActions(sessionContextActions);
  } else if (contextTarget?.type === "group-root") {
    sessionContextActions.push({
      id: "new-group",
      label: "New Group",
      run: () => {
        void promptCreateSessionGroup();
      }
    });
    sessionContextActions.push({
      id: "new-session",
      label: "New Session",
      run: () => {
        openCreateModal("");
      }
    });
    sessionContextActions.push({
      id: "import-ssh-config",
      label: "Import SSH Config...",
      run: () => {
        void importSessionsFromSshConfig();
      }
    });
    sessionContextActions.push({
      id: "select-all-groups",
      label: "Select All Groups",
      disabled: groupedSessions.length === 0,
      run: () => {
        setSelectedGroupKeys(groupedSessions.map((group) => group.key));
      }
    });
    sessionContextActions.push({
      id: "clear-group-selection",
      label: "Clear Group Selection",
      disabled: selectedGroupKeys.length === 0,
      run: () => {
        setSelectedGroupKeys([]);
      }
    });
    sessionContextActions.push({
      id: "rename-selected-group",
      label: "Rename Selected Group",
      disabled: selectedGroupNames.length !== 1,
      run: () => {
        void renameSessionGroup(selectedGroupNames[0]);
      }
    });
    sessionContextActions.push({
      id: "delete-selected-groups",
      label:
        selectedGroupNames.length > 1
          ? `Delete ${selectedGroupNames.length} Selected Groups`
          : "Delete Selected Group",
      disabled: selectedGroupNames.length === 0,
      danger: true,
      run: () => {
        void deleteSessionGroupsBatch(selectedGroupNames);
      }
    });
    appendSessionSortActions(sessionContextActions);
  } else if (contextTarget?.type === "group-view") {
    const selectedCount = selectedSessionsInActiveGroup.length;
    const selectedIds = selectedSessionsInActiveGroup.map((session) => session.id);
    sessionContextActions.push({
      id: "back-groups",
      label: "Back to Groups",
      run: () => {
        setActiveSessionGroupKey(null);
      }
    });
    sessionContextActions.push({
      id: "new-session",
      label: "New Session",
      run: () => {
        openCreateModal(contextTarget.groupName);
      }
    });
    sessionContextActions.push({
      id: "import-ssh-config",
      label: "Import SSH Config...",
      run: () => {
        void importSessionsFromSshConfig();
      }
    });
    sessionContextActions.push({
      id: "new-group",
      label: "New Group",
      run: () => {
        void promptCreateSessionGroup();
      }
    });
    if (contextTarget.groupName) {
      sessionContextActions.push({
        id: "rename-group",
        label: "Rename Group",
        run: () => {
          void renameSessionGroup(contextTarget.groupName);
        }
      });
      sessionContextActions.push({
        id: "delete-group",
        label: "Delete Group",
        danger: true,
        run: () => {
          void deleteSessionGroup(contextTarget.groupName);
        }
      });
    }
    sessionContextActions.push({
      id: "select-all-sessions",
      label: "Select All Sessions",
      disabled: activeGroupSessions.length === 0,
      run: () => {
        const allIds = activeGroupSessions.map((session) => session.id);
        setSelectedSessionIds(allIds);
        setSelectedSessionId(allIds[0] ?? null);
      }
    });
    sessionContextActions.push({
      id: "clear-session-selection",
      label: "Clear Session Selection",
      disabled: selectedCount === 0,
      run: () => {
        setSelectedSessionIds([]);
      }
    });
    sessionContextActions.push({
      id: "open-selected-sessions",
      label: selectedCount > 1 ? `Open ${selectedCount} Selected Tabs` : "Open Selected Session",
      disabled: selectedCount === 0,
      run: () => {
        for (const session of selectedSessionsInActiveGroup) {
          openTerminalTab(session);
        }
      }
    });
    sessionContextActions.push({
      id: "move-selected-sessions",
      label: "Move Selected to Group...",
      disabled: selectedCount === 0,
      run: () => {
        openMoveSessionsToGroupDialog(selectedIds);
      }
    });
    sessionContextActions.push({
      id: "move-selected-sessions-ungrouped",
      label: "Move Selected to Ungrouped",
      disabled: selectedCount === 0,
      run: () => {
        void assignSessionsToGroup(selectedIds, "");
      }
    });
    sessionContextActions.push({
      id: "delete-selected-sessions",
      label: selectedCount > 1 ? `Delete ${selectedCount} Selected Sessions` : "Delete Selected Session",
      disabled: selectedCount === 0,
      danger: true,
      run: () => {
        void removeSessionsByIds(selectedIds);
      }
    });
    appendSessionSortActions(sessionContextActions);
  }

  const isSftpActionDisabled = sftpLoading || sftpActionLoading;
  const sftpToolbarActions: SftpContextAction[] = [
    {
      id: "go-to-path",
      label: "Go to Path",
      disabled: isSftpActionDisabled,
      run: () => {
        void loadSftpDirectory(sftpPath);
      }
    },
    {
      id: "go-parent",
      label: "Go Up",
      disabled: isSftpActionDisabled || !sftpDirectory?.parent,
      run: () => {
        if (!sftpDirectory?.parent) {
          return;
        }
        void loadSftpDirectory(sftpDirectory.parent);
      }
    },
    {
      id: "refresh-directory",
      label: "Refresh",
      disabled: isSftpActionDisabled,
      run: () => {
        void loadSftpDirectory(sftpDirectory?.cwd ?? sftpPath);
      }
    },
    {
      id: "new-folder",
      label: "New Folder",
      disabled: isSftpActionDisabled,
      run: () => {
        void createSftpDirectory();
      }
    },
    {
      id: "upload-file",
      label: "Upload File",
      disabled: isSftpActionDisabled,
      run: () => {
        void uploadLocalFileToSftp();
      }
    },
    {
      id: "download-selected",
      label: "Download Selected",
      disabled: isSftpActionDisabled || !canDownloadSelectedSftpEntry,
      run: () => {
        void downloadSelectedSftpEntry();
      }
    },
    {
      id: "rename-selected",
      label: "Rename Selected",
      disabled: isSftpActionDisabled || !selectedSftpEntry,
      run: () => {
        void renameSelectedSftpEntry();
      }
    },
    {
      id: "delete-selected",
      label: "Delete Selected",
      disabled: isSftpActionDisabled || !selectedSftpEntry,
      run: () => {
        void deleteSelectedSftpEntry();
      }
    }
  ];

  const sftpContextActions: SftpContextAction[] = [];
  if (sftpContextEntry?.kind === "directory") {
    sftpContextActions.push({
      id: "open-directory",
      label: "Open Directory",
      run: () => {
        void loadSftpDirectory(sftpContextEntry.path);
      }
    });
    sftpContextActions.push({
      id: "download-directory",
      label: "Download Folder",
      disabled: isSftpActionDisabled,
      run: () => {
        void downloadSftpDirectory(sftpContextEntry);
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
            // Fallback to dialog for manual copy.
          }
          await showAppAlert("Clipboard unavailable. Copy the path below manually.", {
            title: "Manual Copy",
            confirmLabel: "Close",
            detailText: sftpContextEntry.path
          });
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
            // Fallback to dialog for manual copy.
          }
          await showAppAlert("Clipboard unavailable. Copy the path below manually.", {
            title: "Manual Copy",
            confirmLabel: "Close",
            detailText: sftpDirectory.cwd
          });
        })();
      }
    });
  }

  return (
    <div className={isMacPlatform ? "app app--mac" : "app app--windows"}>
      {isMacPlatform ? (
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
          </div>
        </header>
      ) : null}

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
                    aria-label="Go to parent directory"
                    className="icon-button sftp-toolbar__button"
                    disabled={sftpLoading || sftpActionLoading || !sftpDirectory?.parent}
                    onClick={() => {
                      if (!sftpDirectory?.parent) {
                        return;
                      }
                      void loadSftpDirectory(sftpDirectory.parent);
                    }}
                    title="Go Up"
                    type="button"
                  >
                    <UiIcon name="arrowUp" />
                  </button>
                  <button
                    aria-label="Refresh directory"
                    className="icon-button sftp-toolbar__button"
                    disabled={sftpLoading || sftpActionLoading}
                    onClick={() => {
                      void loadSftpDirectory(sftpDirectory?.cwd ?? sftpPath);
                    }}
                    title="Refresh"
                    type="button"
                  >
                    <UiIcon name="refresh" />
                  </button>
                  <button
                    aria-label="SFTP actions"
                    className="icon-button sftp-toolbar__button sftp-toolbar__button--menu"
                    onClick={toggleSftpToolbarMenu}
                    title="SFTP actions"
                    type="button"
                  >
                    <UiIcon name="menu" />
                  </button>
                </div>
                <p className="hint sftp-current-path">
                  Current: {sftpDirectory?.cwd ?? "(not loaded)"}
                </p>
                {sftpError ? <p className="hint sftp-error">{sftpError}</p> : null}
                {sftpDeleteProgress ? (
                  <div className="sftp-delete-progress" role="status" aria-live="polite">
                    <p className="hint sftp-delete-progress__label">
                      Deleting{" "}
                      {sftpDeleteProgress.kind === "directory" ? "directory" : "file"}{" "}
                      "{sftpDeleteProgress.name}"...
                    </p>
                    <div className="sftp-delete-progress__track">
                      <span className="sftp-delete-progress__bar" />
                    </div>
                  </div>
                ) : null}
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
            onCloseAllTabs={closeAllTabs}
            onCloseTab={closeTerminalTab}
            onCloseTabsLeft={closeTabsLeft}
            onCloseTabsRight={closeTabsRight}
            onCloseOtherTabs={closeOtherTabs}
            onError={setError}
            onSelectTab={setActiveTabId}
            systemApi={systemApi}
            terminalApi={terminalApi}
            tabs={terminalTabs}
          />
        </section>

        <aside className="panel panel--right">
          <section className="panel__section" onContextMenu={openSessionBlankContextMenu}>
            <div className="panel__heading">
              <div className="panel__title-group">
                <h2>Sessions</h2>
                <span className="panel__badge">{sessionBadgeText}</span>
              </div>
              <div className="session-panel__heading-actions">
                <span className="hint session-explorer__location">
                  {activeSessionGroup ? `Group: ${activeSessionGroup.label}` : "Groups"}
                </span>
                <button
                  aria-label="Open settings"
                  className="icon-button session-panel__settings-button"
                  onClick={() => openSettingsPanel("connection")}
                  title="Settings"
                  type="button"
                >
                  <UiIcon name="settings" />
                </button>
              </div>
            </div>
            {loading ? <p className="hint">Loading sessions...</p> : null}
            <div className="session-explorer">
              <div className="session-filter-bar">
                <input
                  className="session-filter-input"
                  onChange={(event) => setSessionFilterQuery(event.target.value)}
                  placeholder="Filter name/host/user/group"
                  value={sessionFilterQuery}
                />
                <button
                  aria-label={sessionFavoritesOnly ? "Show all sessions" : "Show favorite sessions only"}
                  className={sessionFavoritesOnly ? "session-filter-toggle is-active" : "session-filter-toggle"}
                  onClick={() => setSessionFavoritesOnly((prev) => !prev)}
                  title={sessionFavoritesOnly ? "Show all" : "Favorites only"}
                  type="button"
                >
                  {sessionFavoritesOnly ? "Favorites" : "All"}
                </button>
              </div>
              {!activeSessionGroup ? (
                <>
                  {!loading && filteredSessions.length === 0 ? (
                    <p className="hint">
                      {sessions.length === 0
                        ? "No sessions yet."
                        : "No sessions match current filters."}
                    </p>
                  ) : null}
                  <ul className="session-folder-list">
                    {groupedSessions.map((group) => (
                      <li
                        className={
                          selectedGroupKeySet.has(group.key)
                            ? "session-folder-list__item is-selected"
                            : "session-folder-list__item"
                        }
                        key={group.key}
                        onContextMenu={(event) =>
                          openSessionContextMenu(event, {
                            type: "group",
                            groupKey: group.key,
                            groupName: group.groupName,
                            label: group.label
                          })
                        }
                      >
                        <button
                          className="session-folder-list__main"
                          onClick={(event) => {
                            const isMultiSelect = event.ctrlKey || event.metaKey;
                            if (isMultiSelect) {
                              setSelectedGroupKeys((prev) =>
                                prev.includes(group.key)
                                  ? prev.filter((groupKey) => groupKey !== group.key)
                                  : [...prev, group.key]
                              );
                              return;
                            }
                            setSelectedGroupKeys([group.key]);
                            setActiveSessionGroupKey(group.key);
                          }}
                          title={`${group.label} (${group.sessions.length})`}
                          type="button"
                        >
                          <span className="session-folder-list__name">{group.label}</span>
                          <span className="session-folder-list__count">{group.sessions.length}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <button
                    aria-label="Back to groups"
                    className="icon-button session-explorer__back"
                    onClick={() => setActiveSessionGroupKey(null)}
                    title="Back to groups"
                    type="button"
                  >
                    <UiIcon name="chevronLeft" />
                  </button>
                  {!loading && activeGroupSessions.length === 0 ? (
                    <p className="hint">No sessions in this group.</p>
                  ) : null}
                  <ul className="session-list">
                    {activeGroupSessions.map((session) => (
                      <li
                        key={session.id}
                        className={
                          selectedSessionIdSet.has(session.id)
                            ? "session-list__item is-selected"
                            : "session-list__item"
                        }
                        onContextMenu={(event) =>
                          openSessionContextMenu(event, {
                            type: "session",
                            sessionId: session.id
                          })
                        }
                      >
                        <button
                          className="session-list__main"
                          onClick={(event) => {
                            const isMultiSelect = event.ctrlKey || event.metaKey;
                            if (isMultiSelect) {
                              setSelectedSessionIds((prev) => {
                                if (prev.includes(session.id)) {
                                  const next = prev.filter((sessionId) => sessionId !== session.id);
                                  setSelectedSessionId(next[0] ?? null);
                                  return next;
                                }
                                setSelectedSessionId(session.id);
                                return [...prev, session.id];
                              });
                              return;
                            }
                            setSelectedSessionId(session.id);
                            setSelectedSessionIds([session.id]);
                          }}
                          onKeyDown={(event) => {
                            if (
                              event.key !== "Enter" ||
                              event.altKey ||
                              event.ctrlKey ||
                              event.metaKey ||
                              event.shiftKey
                            ) {
                              return;
                            }
                            event.preventDefault();
                            openTerminalTab(session);
                          }}
                          onDoubleClick={() => openTerminalTab(session)}
                          title={`${session.username}@${session.host}:${session.port}`}
                          type="button"
                        >
                          <span className="session-list__name">{session.name}</span>
                          <span className="session-list__host">{session.host}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </section>
          <section className="panel__section">
            <div className="panel__heading">
              <h2>Server Health</h2>
              <div className="server-health__actions">
                <button
                  aria-label="Toggle server health details"
                  className={
                    isServerHealthDetailOpen
                      ? "icon-button server-health__detail-toggle is-active"
                      : "icon-button server-health__detail-toggle"
                  }
                  disabled={!activeTerminalTab}
                  onClick={() => setIsServerHealthDetailOpen((prev) => !prev)}
                  title={isServerHealthDetailOpen ? "Hide details" : "Show details"}
                  type="button"
                >
                  <UiIcon name={isServerHealthDetailOpen ? "minus" : "plus"} />
                </button>
                <button
                  aria-label="Refresh server metrics"
                  className="icon-button"
                  disabled={
                    !activeTerminalTab ||
                    !isActiveTabConnected ||
                    serverHealthLoading ||
                    (isServerHealthDetailOpen && serverProcessLoading)
                  }
                  onClick={() => {
                    void refreshServerHealth();
                    if (isServerHealthDetailOpen) {
                      void refreshServerProcesses();
                    }
                  }}
                  title="Refresh"
                  type="button"
                >
                  <UiIcon name="refresh" />
                </button>
                <span
                  className={
                    serverHealthAlertStatus.hasAny
                      ? "server-health__state server-health__state--alert"
                      : "server-health__state"
                  }
                  title={
                    serverHealthAlertStatus.hasAny
                      ? "One or more metrics exceeded alert threshold."
                      : "No alert triggered."
                  }
                >
                  {serverHealthAlertStatus.hasAny ? "ALERT" : "OK"}
                </span>
              </div>
            </div>
            {activeTerminalTab ? (
              <>
                <p className="hint server-health__binding">
                  Monitoring tab: <strong>{activeTerminalTab.title}</strong>
                </p>
                {!isActiveTabConnected ? (
                  <p className="hint">Connect the active terminal tab to collect metrics.</p>
                ) : null}
                {serverHealthError ? <p className="hint sftp-error">{serverHealthError}</p> : null}
                {serverHealthAlertStatus.hasAny ? (
                  <p className="hint server-health__alert-text">
                    Threshold reached:
                    {serverHealthAlertStatus.cpuHigh ? " CPU" : ""}
                    {serverHealthAlertStatus.memoryHigh ? " Memory" : ""}
                    {serverHealthAlertStatus.diskHigh ? " Disk" : ""}
                  </p>
                ) : null}
                {serverHealthLoading ? (
                  <p className="hint" role="status" aria-live="polite">
                    Collecting server metrics...
                  </p>
                ) : null}
                {serverHealth ? (
                  <>
                    <div className="server-health-grid">
                      <div
                        className={
                          serverHealthAlertStatus.cpuHigh
                            ? "server-health-card is-alert"
                            : "server-health-card"
                        }
                      >
                        <span className="server-health-card__label">CPU</span>
                        <strong className="server-health-card__value">
                          {formatPercent(serverHealthMetrics?.cpuUsagePercent ?? 0)}
                        </strong>
                      </div>
                      <div
                        className={
                          serverHealthAlertStatus.memoryHigh
                            ? "server-health-card is-alert"
                            : "server-health-card"
                        }
                      >
                        <span className="server-health-card__label">Memory</span>
                        <strong className="server-health-card__value">
                          {formatPercent(serverHealthMetrics?.memoryUsagePercent ?? 0)}
                        </strong>
                        <span className="server-health-card__meta">
                          {formatTransferBytes(serverHealth.memoryUsedBytes)}/
                          {formatTransferBytes(serverHealth.memoryTotalBytes)}
                        </span>
                      </div>
                      <div
                        className={
                          serverHealthAlertStatus.diskHigh
                            ? "server-health-card is-alert"
                            : "server-health-card"
                        }
                      >
                        <span className="server-health-card__label">Disk</span>
                        <strong className="server-health-card__value">
                          {formatPercent(serverHealthMetrics?.diskUsagePercent ?? 0)}
                        </strong>
                        <span className="server-health-card__meta">
                          {serverHealth.diskPath} | {formatTransferBytes(serverHealth.diskUsedBytes)}/
                          {formatTransferBytes(serverHealth.diskTotalBytes)}
                        </span>
                      </div>
                      <div className="server-health-card">
                        <span className="server-health-card__label">Network</span>
                        <strong className="server-health-card__value">
                          RX {formatTransferBytes(serverHealthMetrics?.rxBytesPerSecond ?? 0)}/s
                        </strong>
                        <span className="server-health-card__meta">
                          TX {formatTransferBytes(serverHealthMetrics?.txBytesPerSecond ?? 0)}/s
                        </span>
                      </div>
                      <div className="server-health-card">
                        <span className="server-health-card__label">Load</span>
                        <strong className="server-health-card__value">
                          {serverHealth.load1.toFixed(2)} / {serverHealth.load5.toFixed(2)} /{" "}
                          {serverHealth.load15.toFixed(2)}
                        </strong>
                      </div>
                      <div className="server-health-card">
                        <span className="server-health-card__label">Uptime</span>
                        <strong className="server-health-card__value">
                          {formatServerUptime(serverHealth.uptimeSeconds)}
                        </strong>
                        <span className="server-health-card__meta">{serverHealth.hostname}</span>
                      </div>
                    </div>
                    {isServerHealthDetailOpen ? (
                      <div className="server-health-details">
                        {recentServerHealthPoints.length > 0 ? (
                          <div className="server-health-trend">
                            <p className="hint server-health-trend__title">
                              Recent trend (last {recentServerHealthPoints.length} samples)
                            </p>
                            <div className="server-health-trend__bars" aria-hidden="true">
                              {recentServerHealthPoints.map((point, index) => (
                                <div className="server-health-trend__sample" key={`${point.at}-${index}`}>
                                  <span
                                    className="server-health-trend__bar server-health-trend__bar--cpu"
                                    style={{ height: `${Math.max(4, point.cpuUsagePercent)}%` }}
                                    title={`CPU ${formatPercent(point.cpuUsagePercent)}`}
                                  />
                                  <span
                                    className="server-health-trend__bar server-health-trend__bar--memory"
                                    style={{ height: `${Math.max(4, point.memoryUsagePercent)}%` }}
                                    title={`Memory ${formatPercent(point.memoryUsagePercent)}`}
                                  />
                                  <span
                                    className="server-health-trend__bar server-health-trend__bar--disk"
                                    style={{ height: `${Math.max(4, point.diskUsagePercent)}%` }}
                                    title={`Disk ${formatPercent(point.diskUsagePercent)}`}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {serverProcessError ? (
                          <p className="hint sftp-error">{serverProcessError}</p>
                        ) : null}
                        {serverProcessLoading ? (
                          <p className="hint" role="status" aria-live="polite">
                            Collecting process details...
                          </p>
                        ) : null}
                        <div className="server-health-processes">
                          <p className="hint server-health-processes__title">Top processes (CPU)</p>
                          {serverProcessSnapshot?.processes?.length ? (
                            <ul className="server-health-processes__list">
                              {serverProcessSnapshot.processes.map((entry) => (
                                <li
                                  className="server-health-processes__item"
                                  key={`${entry.pid}-${entry.command}`}
                                >
                                  <span className="server-health-processes__pid">{entry.pid}</span>
                                  <span className="server-health-processes__command" title={entry.command}>
                                    {entry.command}
                                  </span>
                                  <span className="server-health-processes__cpu">
                                    {formatProcessPercent(entry.cpuPercent)}
                                  </span>
                                  <span className="server-health-processes__mem">
                                    {formatProcessPercent(entry.memoryPercent)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="hint">No process data yet.</p>
                          )}
                        </div>
                        <div className="server-health-services">
                          <p className="hint server-health-processes__title">Failed services</p>
                          {serverProcessSnapshot?.failedServices?.length ? (
                            <ul className="server-health-services__list">
                              {serverProcessSnapshot.failedServices.map((name) => (
                                <li className="server-health-services__item" key={name}>
                                  {name}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="hint">No failed services detected.</p>
                          )}
                        </div>
                        <p className="hint server-health__footnote">
                          Updated: {serverHealthUpdatedLabel} | RX {formatTransferBytes(serverHealth.networkRxBytes)} / TX{" "}
                          {formatTransferBytes(serverHealth.networkTxBytes)}
                        </p>
                      </div>
                    ) : (
                      <p className="hint server-health__footnote">
                        Updated: {serverHealthUpdatedLabel}
                      </p>
                    )}
                  </>
                ) : null}
              </>
            ) : (
              <p className="hint">Open and connect a terminal tab to monitor server status.</p>
            )}
          </section>
        </aside>
      </main>

      <section className="transfer-dock">
        <div className="transfer-dock__heading">
          <h3>Transfers</h3>
          <div className="transfer-dock__heading-actions">
            <span className="hint">
              {activeTerminalTab
                ? `Bound to ${activeTerminalTab.title}`
                : "Open a terminal tab to manage transfers"}
            </span>
            <button
              className="secondary-button sftp-transfer-panel__clear"
              onClick={openRetryCenter}
              type="button"
            >
              Retry Center
            </button>
          </div>
        </div>
        <div className="transfer-dock__grid">
          <section className="transfer-dock__panel">
            <div className="sftp-transfer-panel__header">
              <p className="hint sftp-transfer-panel__title">
                Uploads (running {activeUploadQueueStats.running}, queued{" "}
                {activeUploadQueueStats.queued}, threads{" "}
                {sftpTransferPreferences.uploadConcurrency})
              </p>
              <div className="sftp-transfer-panel__actions">
                <button
                  className="secondary-button sftp-transfer-panel__clear"
                  disabled={!canRetryFailedUploads}
                  onClick={() => {
                    void retryFailedUploads();
                  }}
                  type="button"
                >
                  Retry Failed ({failedUploadRetryCandidates.length})
                </button>
                <button
                  className="secondary-button sftp-transfer-panel__clear"
                  disabled={!canClearFinishedUploads}
                  onClick={() => {
                    clearFinishedTransfers("upload");
                  }}
                  type="button"
                >
                  Clear Finished
                </button>
                <button
                  aria-label="Cancel all upload tasks"
                  className="icon-button icon-button--danger sftp-transfer-panel__bulk-cancel"
                  disabled={!activeTabId}
                  onClick={() => {
                    void cancelAllActiveUploads();
                  }}
                  title="Cancel all upload tasks in this tab"
                  type="button"
                >
                  <UiIcon name="close" />
                </button>
              </div>
            </div>
            <p className="hint sftp-transfer-panel__batch-progress">
              Progress: {activeUploadProgressStats.completed}/{activeUploadProgressStats.total} completed
              (failed {activeUploadProgressStats.failed}, canceled {activeUploadProgressStats.canceled},
              running {activeUploadProgressStats.running}, queued {activeUploadProgressStats.queued})
            </p>
            {failedUploadHistory.length > 0 ? (
              <p className="hint sftp-transfer-panel__batch-progress">
                Stored failed retries for this session: {failedUploadHistory.length}
              </p>
            ) : null}
            {activeUploadTransfers.length > 0 ? (
              <ul className="sftp-transfer-list transfer-dock__list">
                {activeUploadTransfers.map((transfer) => {
                  const canCancelTransfer =
                    transfer.status === "queued" || transfer.status === "running";
                  return (
                    <li className={`sftp-transfer sftp-transfer--${transfer.status}`} key={transfer.transferId}>
                      <span className="sftp-transfer__icon">
                        <UiIcon name="upload" />
                      </span>
                      <span className="sftp-transfer__name">{transfer.name}</span>
                      <span className="sftp-transfer__progress">{formatTransferProgress(transfer)}</span>
                      {canCancelTransfer ? (
                        <button
                          aria-label="Cancel upload"
                          className="icon-button sftp-transfer__cancel"
                          onClick={() => {
                            void cancelSftpUpload(transfer);
                          }}
                          title="Cancel upload"
                          type="button"
                        >
                          <UiIcon name="close" />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="hint transfer-dock__empty">No upload transfers.</p>
            )}
          </section>
          <section className="transfer-dock__panel">
            <div className="sftp-transfer-panel__header">
              <p className="hint sftp-transfer-panel__title">
                Downloads (running {activeDownloadQueueStats.running}, queued{" "}
                {activeDownloadQueueStats.queued}, threads{" "}
                {sftpTransferPreferences.downloadConcurrency})
              </p>
              <div className="sftp-transfer-panel__actions">
                <button
                  className="secondary-button sftp-transfer-panel__clear"
                  disabled={!canRetryFailedDownloads}
                  onClick={() => {
                    void retryFailedDownloads();
                  }}
                  type="button"
                >
                  Retry Failed ({failedDownloadRetryCandidates.length})
                </button>
                <button
                  className="secondary-button sftp-transfer-panel__clear"
                  disabled={!canClearFinishedDownloads}
                  onClick={() => {
                    clearFinishedTransfers("download");
                  }}
                  type="button"
                >
                  Clear Finished
                </button>
                <button
                  aria-label="Cancel all download tasks"
                  className="icon-button icon-button--danger sftp-transfer-panel__bulk-cancel"
                  disabled={!activeTabId}
                  onClick={() => {
                    void cancelAllActiveDownloads();
                  }}
                  title="Cancel all download tasks in this tab"
                  type="button"
                >
                  <UiIcon name="close" />
                </button>
              </div>
            </div>
            <p className="hint sftp-transfer-panel__batch-progress">
              Progress: {activeDownloadProgressStats.completed}/{activeDownloadProgressStats.total} completed
              (failed {activeDownloadProgressStats.failed}, canceled {activeDownloadProgressStats.canceled},
              running {activeDownloadProgressStats.running}, queued {activeDownloadProgressStats.queued})
            </p>
            {failedDownloadHistory.length > 0 ? (
              <p className="hint sftp-transfer-panel__batch-progress">
                Stored failed retries for this session: {failedDownloadHistory.length}
              </p>
            ) : null}
            {activeDownloadTransfers.length > 0 ? (
              <ul className="sftp-transfer-list transfer-dock__list">
                {activeDownloadTransfers.map((transfer) => {
                  const canCancelTransfer =
                    transfer.status === "queued" || transfer.status === "running";
                  return (
                    <li className={`sftp-transfer sftp-transfer--${transfer.status}`} key={transfer.transferId}>
                      <span className="sftp-transfer__icon">
                        <UiIcon name="download" />
                      </span>
                      <span className="sftp-transfer__name">{transfer.name}</span>
                      <span className="sftp-transfer__progress">{formatTransferProgress(transfer)}</span>
                      {canCancelTransfer ? (
                        <button
                          aria-label="Cancel download"
                          className="icon-button sftp-transfer__cancel"
                          onClick={() => {
                            void cancelSftpDownload(transfer);
                          }}
                          title="Cancel download"
                          type="button"
                        >
                          <UiIcon name="close" />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="hint transfer-dock__empty">No download transfers.</p>
            )}
          </section>
        </div>
      </section>

      {isRetryCenterOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal modal--retry-center"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Transfer Retry Center"
          >
            <div className="modal__header">
              <h3>Transfer Retry Center</h3>
              <button className="icon-button" onClick={closeRetryCenter} type="button">
                <UiIcon name="close" />
              </button>
            </div>
            <p className="hint">
              Persistent transfer history across restarts. Retry works for failed entries bound to
              the active session tab.
            </p>
            <div className="retry-center__filters">
              <label>
                Scope
                <select
                  onChange={(event) =>
                    setRetryCenterScope(event.target.value as TransferHistoryScope)
                  }
                  value={retryCenterScope}
                >
                  <option value="activeSession">Active Session</option>
                  <option value="allSessions">All Sessions</option>
                </select>
              </label>
              <label>
                Direction
                <select
                  onChange={(event) =>
                    setRetryCenterDirection(event.target.value as TransferHistoryDirectionFilter)
                  }
                  value={retryCenterDirection}
                >
                  <option value="all">All</option>
                  <option value="upload">Upload</option>
                  <option value="download">Download</option>
                </select>
              </label>
              <label>
                Status
                <select
                  onChange={(event) =>
                    setRetryCenterStatus(event.target.value as TransferHistoryStatusFilter)
                  }
                  value={retryCenterStatus}
                >
                  <option value="all">All</option>
                  <option value="failed">Failed</option>
                  <option value="completed">Completed</option>
                  <option value="canceled">Canceled</option>
                  <option value="queued">Queued</option>
                  <option value="running">Running</option>
                </select>
              </label>
              <label className="retry-center__search">
                Search
                <input
                  onChange={(event) => setRetryCenterQuery(event.target.value)}
                  placeholder="name/local/remote/message"
                  value={retryCenterQuery}
                />
              </label>
            </div>
            <p className="hint retry-center__summary">
              Visible {retryCenterEntries.length} / Total {transferHistory.length}, Selected{" "}
              {selectedRetryCenterEntries.length}, Selected failed (active session){" "}
              {selectedRetryCenterFailedEntries.length}
            </p>
            <div className="retry-center__list-shell">
              {retryCenterEntries.length > 0 ? (
                <ul className="retry-center__list">
                  {retryCenterEntries.map((entry) => {
                    const selected = retryCenterSelectionSet.has(entry.key);
                    return (
                      <li
                        className={selected ? "retry-center__item is-selected" : "retry-center__item"}
                        key={entry.key}
                      >
                        <label className="retry-center__checkbox">
                          <input
                            checked={selected}
                            onChange={() => toggleRetryCenterEntrySelection(entry.key)}
                            type="checkbox"
                          />
                        </label>
                        <span className={`retry-center__status retry-center__status--${entry.status}`}>
                          {entry.status}
                        </span>
                        <div className="retry-center__body">
                          <p className="retry-center__name">{entry.name}</p>
                          <p
                            className="retry-center__path"
                            title={`${entry.localPath} -> ${entry.remotePath}`}
                          >
                            {`${entry.localPath} -> ${entry.remotePath}`}
                          </p>
                          <p className="retry-center__meta">
                            {formatHistoryTimestamp(entry.updatedAt)} | {entry.direction} | attempts{" "}
                            {entry.attemptCount}
                            {entry.message ? ` | ${entry.message}` : ""}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="hint">No transfer history records match the current filters.</p>
              )}
            </div>
            <div className="modal__actions retry-center__actions">
              <button
                className="secondary-button"
                disabled={retryCenterEntries.length === 0}
                onClick={selectAllVisibleRetryCenterEntries}
                type="button"
              >
                Select Visible
              </button>
              <button
                className="secondary-button"
                disabled={retryCenterSelection.length === 0}
                onClick={clearRetryCenterSelection}
                type="button"
              >
                Clear Selection
              </button>
              <button
                className="secondary-button"
                disabled={!canRetrySelectedRetryCenterEntries}
                onClick={() => {
                  void retrySelectedRetryCenterEntries();
                }}
                type="button"
              >
                Retry Selected Failed
              </button>
              <button
                className="secondary-button"
                disabled={!canClearSelectedRetryCenterEntries}
                onClick={() => {
                  void clearSelectedRetryCenterEntries();
                }}
                type="button"
              >
                Delete Selected
              </button>
              <button
                className="secondary-button"
                disabled={!canClearVisibleRetryCenterEntries}
                onClick={() => {
                  void clearVisibleRetryCenterEntries();
                }}
                type="button"
              >
                Delete Visible
              </button>
              <button
                className="secondary-button"
                disabled={!canClearAllRetryCenterEntries}
                onClick={() => {
                  void clearAllRetryCenterEntries();
                }}
                type="button"
              >
                Delete All
              </button>
              <button className="primary-button" onClick={closeRetryCenter} type="button">
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sftpToolbarMenu ? (
        <div
          className="sftp-context-menu"
          onContextMenu={(event) => event.preventDefault()}
          ref={sftpToolbarMenuRef}
          style={{
            left: `${Math.max(8, Math.min(sftpToolbarMenu.x, window.innerWidth - 236))}px`,
            top: `${Math.max(
              8,
              Math.min(sftpToolbarMenu.y, window.innerHeight - (sftpToolbarActions.length * 26 + 16))
            )}px`
          }}
        >
          {sftpToolbarActions.map((action) => (
            <button
              className={
                action.id === "delete-selected"
                  ? "sftp-context-menu__item is-danger"
                  : "sftp-context-menu__item"
              }
              disabled={action.disabled}
              key={action.id}
              onClick={() => runSftpToolbarAction(action)}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}

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

      {sessionContextMenu && sessionContextActions.length > 0 ? (
        <div
          className="sftp-context-menu"
          onContextMenu={(event) => event.preventDefault()}
          ref={sessionContextMenuRef}
          style={{
            left: `${Math.max(8, Math.min(sessionContextMenu.x, window.innerWidth - 236))}px`,
            top: `${Math.max(
              8,
              Math.min(sessionContextMenu.y, window.innerHeight - (sessionContextActions.length * 26 + 16))
            )}px`
          }}
        >
          {sessionContextActions.map((action) => (
            <button
              className={action.danger ? "sftp-context-menu__item is-danger" : "sftp-context-menu__item"}
              disabled={action.disabled}
              key={action.id}
              onClick={() => runSessionContextAction(action)}
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
            className="modal modal--settings"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
          >
            <div className="modal__header">
              <h3>Settings</h3>
              <button
                className="icon-button"
                onClick={closeSettingsPanel}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="settings-layout">
              <div className="settings-nav" aria-label="Settings sections" role="tablist">
                {settingsSections.map((section) => (
                  <button
                    key={section.id}
                    className={
                      activeSettingsSection === section.id
                        ? "settings-nav__button is-active"
                        : "settings-nav__button"
                    }
                    onClick={() => setActiveSettingsSection(section.id)}
                    role="tab"
                    type="button"
                  >
                    {section.label}
                  </button>
                ))}
              </div>
              <div className="session-form settings-panel">
                <div className="settings-panel__header">
                  <h4 className="settings-group__title">
                    {getSettingsSectionTitle(activeSettingsSection)}
                  </h4>
                  <p className="hint settings-panel__version">Version {APP_VERSION}</p>
                </div>

                {activeSettingsSection === "connection" ? (
                  <>
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
                  </>
                ) : null}

                {activeSettingsSection === "hotkeys" ? (
                  <>
                    <div className="settings-hotkey-list">
                      {HOTKEY_ACTION_ORDER.map((action) => {
                        const binding = hotkeyPreferences[action];
                        return (
                          <div className="settings-hotkey-row" key={action}>
                            <label className="settings-checkbox settings-hotkey-row__toggle">
                              <input
                                checked={binding.enabled}
                                onChange={(event) =>
                                  setHotkeyBindingEnabled(action, event.target.checked)
                                }
                                type="checkbox"
                              />
                              <span className="settings-hotkey-row__label">
                                <span>{getHotkeyActionDescription(action)}</span>
                                <span className="settings-hotkey-row__binding-inline hint">
                                  {binding.enabled
                                    ? formatHotkeyBindingLabel(binding, isMacPlatform)
                                    : "Disabled"}
                                </span>
                              </span>
                            </label>
                            <div className="settings-hotkey-row__controls">
                              <label>
                                Modifier
                                <select
                                  disabled={!binding.enabled}
                                  onChange={(event) =>
                                    setHotkeyBindingModifier(
                                      action,
                                      event.target.value as HotkeyModifier
                                    )
                                  }
                                  value={binding.modifier}
                                >
                                  {hotkeyModifierOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Key
                                <input
                                  className="settings-hotkey-row__key"
                                  disabled={!binding.enabled}
                                  maxLength={1}
                                  onChange={(event) =>
                                    setHotkeyBindingKey(action, event.target.value)
                                  }
                                  placeholder={HOTKEY_KEY_PLACEHOLDER}
                                  value={binding.key.toUpperCase()}
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="hint">
                      Windows defaults use <code>Ctrl + Shift + C</code> /{" "}
                      <code>Ctrl + Shift + V</code> for terminal copy/paste, and keeps
                      Alt-based keys for tab and search actions. macOS keeps the existing
                      Cmd-based behavior.
                    </p>
                    <div className="modal__actions">
                      <button
                        className="secondary-button"
                        onClick={() => setHotkeyPreferences(createDefaultHotkeyPreferences())}
                        type="button"
                      >
                        Reset Hotkeys
                      </button>
                    </div>
                  </>
                ) : null}

                {activeSettingsSection === "serverHealth" ? (
                  <>
                    <label className="settings-checkbox">
                      <input
                        checked={serverHealthAlertPreferences.enabled}
                        onChange={(event) => setServerHealthAlertEnabled(event.target.checked)}
                        type="checkbox"
                      />
                      <span>Enable threshold alerts in monitor panel</span>
                    </label>
                    <div className="settings-threshold-grid">
                      <label>
                        CPU Alert (%)
                        <input
                          disabled={!serverHealthAlertPreferences.enabled}
                          max={100}
                          min={50}
                          onChange={(event) =>
                            setServerHealthAlertThreshold("cpuWarnPercent", event.target.value)
                          }
                          type="number"
                          value={serverHealthAlertPreferences.cpuWarnPercent}
                        />
                      </label>
                      <label>
                        Memory Alert (%)
                        <input
                          disabled={!serverHealthAlertPreferences.enabled}
                          max={100}
                          min={50}
                          onChange={(event) =>
                            setServerHealthAlertThreshold("memoryWarnPercent", event.target.value)
                          }
                          type="number"
                          value={serverHealthAlertPreferences.memoryWarnPercent}
                        />
                      </label>
                      <label>
                        Disk Alert (%)
                        <input
                          disabled={!serverHealthAlertPreferences.enabled}
                          max={100}
                          min={50}
                          onChange={(event) =>
                            setServerHealthAlertThreshold("diskWarnPercent", event.target.value)
                          }
                          type="number"
                          value={serverHealthAlertPreferences.diskWarnPercent}
                        />
                      </label>
                    </div>
                    <p className="hint">
                      Threshold range is 50-100. Alerts are evaluated on each monitor refresh.
                    </p>
                  </>
                ) : null}

                {activeSettingsSection === "fileOpening" ? (
                  <>
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
                      Leave empty to use system default app. Used by SFTP "Open File" and file
                      double-click.
                    </p>
                  </>
                ) : null}

                {activeSettingsSection === "sftp" ? (
                  <>
                    <label>
                      Upload Threads
                      <input
                        max={8}
                        min={1}
                        onChange={(event) => setUploadConcurrency(event.target.value)}
                        type="number"
                        value={sftpTransferPreferences.uploadConcurrency}
                      />
                    </label>
                    <label>
                      Download Threads
                      <input
                        max={8}
                        min={1}
                        onChange={(event) => setDownloadConcurrency(event.target.value)}
                        type="number"
                        value={sftpTransferPreferences.downloadConcurrency}
                      />
                    </label>
                    <p className="hint">
                      Controls max parallel upload/download tasks. Range: 1-8.
                    </p>
                  </>
                ) : null}

                {activeSettingsSection === "portForwarding" ? (
                  <>
                    <p className="hint">
                      Port forwarding is bound to the active terminal tab and removed when that tab
                      disconnects/closes.
                    </p>
                    <p className="hint">
                      Active tab:{" "}
                      {activeTerminalTab
                        ? `${activeTerminalTab.title} (${isActiveTabConnected ? "connected" : "disconnected"})`
                        : "None"}
                    </p>
                    <div className="settings-port-forward-grid">
                      <label>
                        Type
                        <select
                          disabled={portForwardBusy}
                          onChange={(event) =>
                            setPortForwardForm((prev) => ({
                              ...prev,
                              type: event.target.value as CreatePortForwardInput["type"]
                            }))
                          }
                          value={portForwardForm.type}
                        >
                          <option value="local">Local (L)</option>
                          <option value="remote">Remote (R)</option>
                          <option value="dynamic">Dynamic SOCKS5 (D)</option>
                        </select>
                      </label>
                      <label>
                        Listen Host
                        <input
                          disabled={portForwardBusy}
                          onChange={(event) =>
                            setPortForwardForm((prev) => ({
                              ...prev,
                              bindHost: event.target.value
                            }))
                          }
                          placeholder="127.0.0.1"
                          value={portForwardForm.bindHost}
                        />
                      </label>
                      <label>
                        Listen Port
                        <input
                          disabled={portForwardBusy}
                          max={65535}
                          min={1}
                          onChange={(event) =>
                            setPortForwardForm((prev) => ({
                              ...prev,
                              bindPort: event.target.value
                            }))
                          }
                          type="number"
                          value={portForwardForm.bindPort}
                        />
                      </label>
                      {portForwardForm.type !== "dynamic" ? (
                        <>
                          <label>
                            {portForwardForm.type === "local"
                              ? "Remote Target Host"
                              : "Local Target Host"}
                            <input
                              disabled={portForwardBusy}
                              onChange={(event) =>
                                setPortForwardForm((prev) => ({
                                  ...prev,
                                  targetHost: event.target.value
                                }))
                              }
                              placeholder="127.0.0.1"
                              value={portForwardForm.targetHost}
                            />
                          </label>
                          <label>
                            {portForwardForm.type === "local"
                              ? "Remote Target Port"
                              : "Local Target Port"}
                            <input
                              disabled={portForwardBusy}
                              max={65535}
                              min={1}
                              onChange={(event) =>
                                setPortForwardForm((prev) => ({
                                  ...prev,
                                  targetPort: event.target.value
                                }))
                              }
                              type="number"
                              value={portForwardForm.targetPort}
                            />
                          </label>
                        </>
                      ) : null}
                    </div>
                    <div className="modal__actions">
                      <button
                        className="secondary-button"
                        disabled={portForwardBusy || !activeTabId}
                        onClick={() => {
                          void refreshPortForwards(activeTabId);
                        }}
                        type="button"
                      >
                        Refresh
                      </button>
                      <button
                        className="secondary-button"
                        disabled={portForwardBusy || !activeSessionId}
                        onClick={() => {
                          void savePortForwardPreset();
                        }}
                        type="button"
                      >
                        Save as Preset
                      </button>
                      <button
                        className="primary-button"
                        disabled={portForwardBusy || !activeTabId || !isActiveTabConnected}
                        onClick={() => {
                          void createPortForward();
                        }}
                        type="button"
                      >
                        {portForwardBusy ? "Working..." : "Create Forward"}
                      </button>
                    </div>
                    <p className="settings-port-forward-section__title">Saved Presets</p>
                    <div className="settings-port-forward-list-shell settings-port-forward-list-shell--presets">
                      {activeSessionId ? (
                        activePortForwardPresets.length > 0 ? (
                          <ul className="settings-port-forward-list settings-port-forward-list--presets">
                            {activePortForwardPresets.map((preset) => (
                              <li className="settings-port-forward-item" key={preset.id}>
                                <div className="settings-port-forward-item__header">
                                  <p className="settings-port-forward-item__title">
                                    {preset.name}
                                  </p>
                                  <p className="settings-port-forward-item__meta">
                                    {formatPortForwardPreset(preset)}
                                  </p>
                                  <p className="settings-port-forward-item__meta">
                                    Updated {new Date(preset.updatedAt).toLocaleString()}
                                  </p>
                                </div>
                                <label className="settings-checkbox settings-port-forward-item__toggle">
                                  <input
                                    checked={preset.autoRestore}
                                    disabled={portForwardBusy}
                                    onChange={(event) =>
                                      setPortForwardPresetAutoRestore(
                                        preset.id,
                                        event.target.checked
                                      )
                                    }
                                    type="checkbox"
                                  />
                                  <span>Auto restore on connect</span>
                                </label>
                                <div className="modal__actions settings-port-forward-item__actions">
                                  <button
                                    className="secondary-button"
                                    disabled={portForwardBusy}
                                    onClick={() => {
                                      setPortForwardForm(toPortForwardFormFromPreset(preset));
                                    }}
                                    type="button"
                                  >
                                    Fill Form
                                  </button>
                                  <button
                                    className="secondary-button"
                                    disabled={
                                      portForwardBusy || !activeTabId || !isActiveTabConnected
                                    }
                                    onClick={() => {
                                      void applyPortForwardPreset(preset);
                                    }}
                                    type="button"
                                  >
                                    Apply
                                  </button>
                                  <button
                                    className="secondary-button"
                                    disabled={portForwardBusy}
                                    onClick={() => {
                                      void deletePortForwardPreset(preset);
                                    }}
                                    type="button"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="hint">
                            No saved presets for this session yet. Fill the form above and save one.
                          </p>
                        )
                      ) : (
                        <p className="hint">
                          Open a session tab to manage presets for that session.
                        </p>
                      )}
                    </div>
                    <p className="settings-port-forward-section__title">Active Forwards</p>
                    {portForwardStatusMessage ? (
                      <p className="hint settings-port-forward-status-message">
                        {portForwardStatusMessage}
                      </p>
                    ) : null}
                    <div className="modal__actions settings-port-forward-diagnostics-actions">
                      <button
                        className="secondary-button"
                        disabled={portForwardBusy || !activeTabId}
                        onClick={() => {
                          void Promise.all([
                            refreshPortForwards(activeTabId),
                            refreshPortForwardEvents(activeTabId)
                          ]);
                        }}
                        type="button"
                      >
                        Refresh Diagnostics
                      </button>
                      <button
                        className="secondary-button"
                        disabled={!activeTabId}
                        onClick={() => {
                          void exportPortForwardSnapshot();
                        }}
                        type="button"
                      >
                        Export Snapshot
                      </button>
                    </div>
                    <div className="settings-port-forward-list-shell">
                      {portForwards.length > 0 ? (
                        <ul className="settings-port-forward-list">
                          {portForwards.map((forward) => (
                            <li className="settings-port-forward-item" key={forward.id}>
                              <div className="settings-port-forward-item__header">
                                <div className="settings-port-forward-item__title-row">
                                  <p className="settings-port-forward-item__title">
                                    {formatPortForwardRecord(forward)}
                                  </p>
                                  <span
                                    className={
                                      forward.status === "degraded"
                                        ? "settings-port-forward-status-badge is-degraded"
                                        : "settings-port-forward-status-badge is-active"
                                    }
                                  >
                                    {getPortForwardStatusLabel(forward)}
                                  </span>
                                </div>
                              </div>
                              <p className="settings-port-forward-item__meta">
                                Created {new Date(forward.createdAt).toLocaleString()}
                              </p>
                              <p className="settings-port-forward-item__meta">
                                Connections {forward.totalConnections} (failed {forward.failedConnections})
                              </p>
                              {forward.lastActivityAt ? (
                                <p className="settings-port-forward-item__meta">
                                  Last activity {formatPortForwardTimestamp(forward.lastActivityAt)}
                                </p>
                              ) : null}
                              {forward.lastError ? (
                                <p className="hint settings-port-forward-item__error">
                                  Last error ({formatPortForwardTimestamp(forward.lastErrorAt)}):{" "}
                                  {forward.lastError}
                                </p>
                              ) : null}
                              <button
                                className="secondary-button"
                                disabled={portForwardBusy || !activeTabId}
                                onClick={() => {
                                  void removePortForward(forward);
                                }}
                                type="button"
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="hint">
                          No active port forwards for the current tab.
                        </p>
                      )}
                    </div>
                    <p className="settings-port-forward-section__title">Recent Events</p>
                    <div className="settings-port-forward-events-toolbar">
                      <label>
                        Filter
                        <select
                          onChange={(event) =>
                            setPortForwardEventFilter(event.target.value as PortForwardEventFilter)
                          }
                          value={portForwardEventFilter}
                        >
                          <option value="all">All</option>
                          <option value="errors">Errors Only</option>
                          <option value="lifecycle">Create/Remove</option>
                          <option value="status">Degraded/Recovered</option>
                        </select>
                      </label>
                      <button
                        className="secondary-button"
                        disabled={visiblePortForwardEventHistory.length === 0}
                        onClick={() => {
                          void clearVisiblePortForwardHistory();
                        }}
                        type="button"
                      >
                        Clear Visible
                      </button>
                      <button
                        className="secondary-button"
                        disabled={activePortForwardEventHistory.length === 0}
                        onClick={() => {
                          void clearSessionPortForwardHistory();
                        }}
                        type="button"
                      >
                        Clear Session
                      </button>
                    </div>
                    <p className="hint settings-port-forward-events-summary">
                      Session history {activePortForwardEventHistory.length}, visible{" "}
                      {visiblePortForwardEventHistory.length}
                    </p>
                    <div className="settings-port-forward-list-shell settings-port-forward-list-shell--events">
                      {visiblePortForwardEventHistory.length > 0 ? (
                        <ul className="settings-port-forward-events-list">
                          {visiblePortForwardEventHistory.map((event) => (
                            <li
                              className={
                                event.level === "error"
                                  ? "settings-port-forward-event-item is-error"
                                  : "settings-port-forward-event-item"
                              }
                              key={event.id}
                            >
                              <p className="settings-port-forward-event-item__title">
                                {formatPortForwardEventType(event.type)} {formatPortForwardEventSummary(event)}
                              </p>
                              <p className="settings-port-forward-event-item__meta">
                                {formatPortForwardTimestamp(event.createdAt)} | {event.level.toUpperCase()}
                              </p>
                              <p className="settings-port-forward-event-item__message">
                                {event.message}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="hint">
                          {activeSessionId
                            ? "No matching port forwarding events for the current filter."
                            : "Open a session tab to view port forwarding event history."}
                        </p>
                      )}
                    </div>
                  </>
                ) : null}

                {activeSettingsSection === "diagnostics" ? (
                  <>
                    <p className="hint">
                      TermDock writes runtime diagnostics to local log files. Share these files
                      when reporting bugs.
                    </p>
                    <p className="hint">
                      Export Bug Report bundles logs, runtime metadata, and a safe settings
                      snapshot into one zip package.
                    </p>
                    <label>
                      Log Directory
                      <input readOnly value={logInfo?.logDirectoryPath ?? "Not loaded yet"} />
                    </label>
                    <label>
                      Log File
                      <input readOnly value={logInfo?.logFilePath ?? "Not loaded yet"} />
                    </label>
                    <div className="modal__actions">
                      <button
                        className="secondary-button"
                        onClick={() => {
                          void refreshLogInfo().catch((caughtError) => {
                            const message = toLogMessage(caughtError);
                            setError(message);
                            writeAppLog(
                              "error",
                              "renderer:diagnostics",
                              "Failed to refresh log info.",
                              caughtError
                            );
                          });
                        }}
                        type="button"
                      >
                        Refresh
                      </button>
                      <button className="secondary-button" onClick={() => {
                        void openLogDirectory();
                      }} type="button">
                        Open Folder
                      </button>
                      <button className="secondary-button" onClick={() => {
                        void copyLogFilePath();
                      }} type="button">
                        Copy Log File Path
                      </button>
                      <button
                        className="primary-button"
                        disabled={isExportingBugReport}
                        onClick={() => {
                          void exportBugReportBundle();
                        }}
                        type="button"
                      >
                        {isExportingBugReport ? "Exporting..." : "Export Bug Report"}
                      </button>
                    </div>
                  </>
                ) : null}

                <div className="modal__actions settings-panel__footer">
                  <button
                    className="primary-button"
                    onClick={closeSettingsPanel}
                    type="button"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
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
                Group
                <select
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, groupId: event.target.value }))
                  }
                  value={form.groupId ?? ""}
                >
                  <option value="">Ungrouped</option>
                  {sessionGroupOptions.map((groupName) => (
                    <option key={groupName} value={groupName}>
                      {groupName}
                    </option>
                  ))}
                </select>
              </label>
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

      {moveGroupDialog ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeMoveGroupDialog();
            }
          }}
          role="presentation"
        >
          <div
            className="modal modal--compact app-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Move Sessions to Group"
          >
            <div className="modal__header">
              <h3>
                {moveGroupDialog.sessionIds.length > 1
                  ? `Move ${moveGroupDialog.sessionIds.length} Sessions`
                  : "Move Session"}
              </h3>
            </div>
            <p className="app-dialog__message">Select target group from the list.</p>
            <form
              className="session-form app-dialog"
              onSubmit={(event) => {
                event.preventDefault();
                void submitMoveGroupDialog();
              }}
            >
              <label>
                Target Group
                <select
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setMoveGroupDialog((prev) =>
                      prev
                        ? {
                            ...prev,
                            targetGroup: nextValue
                          }
                        : prev
                    );
                  }}
                  value={moveGroupDialog.targetGroup}
                >
                  <option value="">Ungrouped</option>
                  {sessionGroupOptions.map((groupName) => (
                    <option key={groupName} value={groupName}>
                      {groupName}
                    </option>
                  ))}
                </select>
              </label>
              <div className="modal__actions">
                <button className="secondary-button" onClick={closeMoveGroupDialog} type="button">
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Move
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {appDialog ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAppDialog();
            }
          }}
          role="presentation"
        >
          <div
            className="modal modal--compact app-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={appDialog.title}
          >
            <div className="modal__header">
              <h3>{appDialog.title}</h3>
            </div>
            <p className="app-dialog__message">{appDialog.message}</p>
            {appDialog.mode === "prompt" ? (
              appDialog.multiline ? (
                <textarea
                  className="app-dialog__textarea"
                  onChange={(event) => setAppDialogInput(event.target.value)}
                  ref={(element) => {
                    appDialogInputRef.current = element;
                  }}
                  rows={6}
                  value={appDialogInput}
                />
              ) : (
                <input
                  className="app-dialog__input"
                  onChange={(event) => setAppDialogInput(event.target.value)}
                  ref={(element) => {
                    appDialogInputRef.current = element;
                  }}
                  value={appDialogInput}
                />
              )
            ) : appDialog.mode === "alert" && appDialog.detailText ? (
              <textarea
                className="app-dialog__textarea app-dialog__textarea--readonly"
                readOnly
                value={appDialog.detailText}
              />
            ) : null}
            {appDialog.mode === "prompt" && appDialog.multiline ? (
              <p className="hint app-dialog__hint">Use Ctrl+Enter to confirm.</p>
            ) : null}
            <div className="modal__actions">
              {appDialog.mode !== "alert" ? (
                <button className="secondary-button" onClick={closeAppDialog} type="button">
                  {appDialog.cancelLabel}
                </button>
              ) : null}
              {appDialog.mode === "choice"
                ? appDialog.options.map((option) => (
                    <button
                      className={
                        option.danger
                          ? "primary-button app-dialog__confirm--danger"
                          : "primary-button"
                      }
                      key={option.value}
                      onClick={() => resolveAppDialog(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))
                : (
                    <button
                      className={
                        appDialog.mode === "confirm" && appDialog.danger
                          ? "primary-button app-dialog__confirm--danger"
                          : "primary-button"
                      }
                      onClick={submitAppDialog}
                      type="button"
                    >
                      {appDialog.confirmLabel}
                    </button>
                  )}
            </div>
          </div>
        </div>
      ) : null}

      {error ? <div className="error-bar">{error}</div> : null}
    </div>
  );
}


