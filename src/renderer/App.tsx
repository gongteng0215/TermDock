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
  ServerProcessSnapshot,
  TerminalConnectionStatus
} from "../shared/terminal";
import {
  MAX_TERMINAL_COMMAND_HISTORY,
  readTerminalCommandHistory,
  TERMINAL_COMMAND_HISTORY_APPEND_EVENT,
  TERMINAL_COMMAND_HISTORY_REMOVE_EVENT,
  TERMINAL_COMMAND_HISTORY_STORAGE_KEY,
  TerminalWorkspace
} from "./components/terminal-workspace";
import type {
  ConnectionPreferences,
  HotkeyBindingPreference,
  HotkeyModifier,
  HotkeyPreferences,
  TerminalCommandHistoryEntry,
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
const HOTKEY_CONFLICT_NAV_STORAGE_KEY = "termdock.hotkey-conflict-nav.v1";
const FILE_OPEN_PREFERENCES_STORAGE_KEY = "termdock.file-open-preferences.v1";
const SFTP_TRANSFER_PREFERENCES_STORAGE_KEY = "termdock.sftp-transfer-preferences.v1";
const SFTP_TRANSFER_HISTORY_STORAGE_KEY = "termdock.sftp-transfer-history.v1";
const SFTP_TRANSFER_PENDING_RESTORE_STORAGE_KEY = "termdock.sftp-transfer-pending-restore.v1";
const SFTP_CONFLICT_STRATEGY_STORAGE_KEY = "termdock.sftp-conflict-strategy.v1";
const PORT_FORWARD_PRESETS_STORAGE_KEY = "termdock.port-forward-presets.v1";
const PORT_FORWARD_EVENT_HISTORY_STORAGE_KEY = "termdock.port-forward-event-history.v1";
const PORT_FORWARD_EVENT_VIEW_STORAGE_KEY = "termdock.port-forward-event-view.v1";
const DISCONNECT_REPORT_HISTORY_STORAGE_KEY = "termdock.disconnect-report-history.v1";
const DISCONNECT_REPORT_VIEW_STORAGE_KEY = "termdock.disconnect-report-view.v1";
const RETRY_CENTER_VIEW_STORAGE_KEY = "termdock.retry-center-view.v1";
const RETRY_CENTER_FAILURE_REASON_ALL = "__all__";
const DISCONNECT_REPORT_CAPTURE_PREFERENCES_STORAGE_KEY =
  "termdock.disconnect-report-capture-preferences.v1";
const SESSION_GROUPS_STORAGE_KEY = "termdock.session-groups.v1";
const SESSION_SORT_MODE_STORAGE_KEY = "termdock.session-sort-mode.v1";
const SESSION_QUICK_PROFILES_STORAGE_KEY = "termdock.session-quick-profiles.v1";
const COMMAND_SNIPPET_GROUPS_STORAGE_KEY = "termdock.command-snippet-groups.v1";
const SERVER_HEALTH_ALERT_PREFERENCES_STORAGE_KEY = "termdock.server-health-alert-preferences.v1";
const MAX_SFTP_TRANSFER_HISTORY = 800;
const MAX_PORT_FORWARD_EVENT_HISTORY = 1200;
const MAX_PORT_FORWARD_EVENT_HISTORY_PER_SESSION = 320;
const MAX_DISCONNECT_REPORT_HISTORY = 120;
const MAX_PENDING_TRANSFER_RESTORE_ITEMS = 2000;
const MAX_SESSION_QUICK_PROFILES = 80;
const MAX_COMMAND_SNIPPET_GROUPS = 40;
const MAX_COMMAND_SNIPPETS_PER_GROUP = 120;
const DEFAULT_RETRY_BATCH_CONFIRM_THRESHOLD = 100;
const MIN_RETRY_BATCH_CONFIRM_THRESHOLD = 0;
const MAX_RETRY_BATCH_CONFIRM_THRESHOLD = 2000;
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
type TransferHistoryTimeRange = "all" | "5m" | "30m" | "1h" | "24h";
type RetryCenterListMode = "flat" | "groupedByReason";
type RetryCenterGroupExportScope = "all" | "failed" | "retryable";
type RetryCenterRetryScope = "all" | "upload" | "download";
type TerminalCommandHistoryScope = "activeTab" | "allTabs";

type HotkeyActionId = keyof HotkeyPreferences;

type HotkeyModifierOption = {
  value: HotkeyModifier;
  label: string;
};

interface HotkeyConflict {
  signature: string;
  modifier: HotkeyModifier;
  key: string;
  actions: HotkeyActionId[];
}

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

interface SessionTransferConflictStrategy {
  upload?: TransferConflictStrategy;
  download?: TransferConflictStrategy;
}

interface SessionTransferConflictStrategyState {
  bySessionId: Record<string, SessionTransferConflictStrategy>;
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

interface DisconnectReportFailureSample {
  direction: SftpTransferEvent["direction"];
  name: string;
  message: string;
  updatedAt: number;
}

interface DisconnectReportCapturePreferences {
  enabled: boolean;
}

interface DisconnectReportItem {
  id: string;
  createdAt: string;
  tabId: string;
  tabTitle: string;
  sessionId: string;
  sessionName: string;
  target: string;
  trigger: "status" | "error";
  status?: TerminalConnectionStatus;
  message: string;
  activeTabId: string | null;
  wasActiveTab: boolean;
  openTabCount: number;
  connectedTabCount: number;
  autoReconnect: boolean;
  reconnectDelaySeconds: number;
  uploadRunning: number;
  uploadQueued: number;
  downloadRunning: number;
  downloadQueued: number;
  pausedUpload: boolean;
  pausedDownload: boolean;
  portForwardTotal: number;
  portForwardDegraded: number;
  portForwardBusy: boolean;
  serverHealthLoading: boolean;
  serverProcessLoading: boolean;
  serverHealthError?: string;
  serverProcessError?: string;
  recentFailures: DisconnectReportFailureSample[];
}

const DEFAULT_FILE_OPEN_PREFERENCES: FileOpenPreferences = {
  preferredProgramPath: ""
};
const DEFAULT_SFTP_TRANSFER_PREFERENCES: SftpTransferPreferences = {
  uploadConcurrency: 2,
  downloadConcurrency: 2
};
const DEFAULT_SESSION_TRANSFER_CONFLICT_STRATEGY_STATE: SessionTransferConflictStrategyState = {
  bySessionId: {}
};
const DEFAULT_SERVER_HEALTH_ALERT_PREFERENCES: ServerHealthAlertPreferences = {
  enabled: true,
  cpuWarnPercent: 85,
  memoryWarnPercent: 85,
  diskWarnPercent: 90
};
const DEFAULT_DISCONNECT_REPORT_CAPTURE_PREFERENCES: DisconnectReportCapturePreferences = {
  enabled: true
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
type PortForwardEventTimeRange = "all" | "5m" | "30m" | "1h" | "24h";
type DisconnectReportScope = "allSessions" | "activeSession";
type DisconnectReportTriggerFilter = "all" | DisconnectReportItem["trigger"];
type DisconnectReportTimeRange = "all" | "5m" | "30m" | "1h" | "24h";

interface PortForwardEventHistoryItem extends PortForwardEventRecord {
  key: string;
  sessionId: string;
}

interface PortForwardEventViewPreferences {
  filter: PortForwardEventFilter;
  timeRange: PortForwardEventTimeRange;
  errorCode: string;
  correlationQuery: string;
}

interface DisconnectReportViewPreferences {
  scope: DisconnectReportScope;
  trigger: DisconnectReportTriggerFilter;
  timeRange: DisconnectReportTimeRange;
  query: string;
}

interface RetryCenterViewPreferences {
  scope: TransferHistoryScope;
  direction: TransferHistoryDirectionFilter;
  status: TransferHistoryStatusFilter;
  timeRange: TransferHistoryTimeRange;
  listMode: RetryCenterListMode;
  failureReason: string;
  lastRetryScope: RetryCenterRetryScope;
  autoUseLastRetryScope: boolean;
  retryBatchConfirmThreshold: number;
  query: string;
}

const DEFAULT_PORT_FORWARD_EVENT_VIEW_PREFERENCES: PortForwardEventViewPreferences = {
  filter: "all",
  timeRange: "all",
  errorCode: "all",
  correlationQuery: ""
};
const DEFAULT_DISCONNECT_REPORT_VIEW_PREFERENCES: DisconnectReportViewPreferences = {
  scope: "allSessions",
  trigger: "all",
  timeRange: "all",
  query: ""
};
const DEFAULT_RETRY_CENTER_VIEW_PREFERENCES: RetryCenterViewPreferences = {
  scope: "activeSession",
  direction: "all",
  status: "failed",
  timeRange: "all",
  listMode: "flat",
  failureReason: RETRY_CENTER_FAILURE_REASON_ALL,
  lastRetryScope: "all",
  autoUseLastRetryScope: false,
  retryBatchConfirmThreshold: DEFAULT_RETRY_BATCH_CONFIRM_THRESHOLD,
  query: ""
};

interface PendingUploadJob {
  tabId: string;
  transferId: string;
  batchId: string;
  localPath: string;
  remoteDirectory: string;
  remotePath: string;
  name: string;
  missingDirectoryRetryCount?: number;
}

interface PendingDownloadJob {
  tabId: string;
  transferId: string;
  batchId: string;
  localPath: string;
  remotePath: string;
  name: string;
}

interface PendingTransferRestoreItem {
  key: string;
  sessionId: string;
  direction: SftpTransferEvent["direction"];
  localPath: string;
  remotePath: string;
  name: string;
}

interface SessionQuickProfile {
  id: string;
  name: string;
  startupCommand: string;
  confirmBeforeRun: boolean;
}

interface CommandSnippetItem {
  id: string;
  name: string;
  template: string;
  confirmBeforeRun: boolean;
}

interface CommandSnippetGroup {
  id: string;
  name: string;
  snippets: CommandSnippetItem[];
}

interface SessionJsonImportCandidate {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: SessionCreateInput["authType"];
  privateKeyPath: string;
  groupId: string;
  remark: string;
  favorite: boolean;
}

interface SessionJsonImportParseResult {
  candidates: SessionJsonImportCandidate[];
  warnings: string[];
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

interface CommandHistoryContextMenuState {
  x: number;
  y: number;
  entryId: string | null;
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

interface TransferDockNotice {
  tabId: string;
  level: "info" | "warn";
  message: string;
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
  detailText?: string;
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
  detailText?: string;
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
  detailText?: string;
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
  detailText?: string;
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

function parseHotkeyPreferencesSource(rawValue: unknown): HotkeyPreferences {
  const defaults = createDefaultHotkeyPreferences();
  if (!rawValue || typeof rawValue !== "object") {
    return defaults;
  }
  const parsed = rawValue as Partial<HotkeyPreferences>;
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
}

function parseImportedHotkeyPreferences(payload: unknown): HotkeyPreferences {
  const root =
    payload && typeof payload === "object" && "hotkeys" in payload
      ? (payload as { hotkeys?: unknown }).hotkeys
      : payload;
  if (!root || typeof root !== "object") {
    throw new Error("Invalid hotkey file: missing hotkeys object.");
  }
  const record = root as Record<string, unknown>;
  const hasAnyKnownAction = HOTKEY_ACTION_ORDER.some((action) => action in record);
  if (!hasAnyKnownAction) {
    throw new Error("Invalid hotkey file: no recognized hotkey actions.");
  }
  return parseHotkeyPreferencesSource(root);
}

function areHotkeyBindingsEqual(
  left: HotkeyBindingPreference,
  right: HotkeyBindingPreference
): boolean {
  return (
    left.enabled === right.enabled &&
    left.modifier === right.modifier &&
    normalizeHotkeyKey(left.key, "") === normalizeHotkeyKey(right.key, "")
  );
}

function formatHotkeyBindingSummary(
  binding: HotkeyBindingPreference,
  isMacPlatform: boolean
): string {
  if (!binding.enabled) {
    return "Disabled";
  }
  return formatHotkeyBindingLabel(binding, isMacPlatform);
}

function buildHotkeyPreferenceDiffLines(
  current: HotkeyPreferences,
  imported: HotkeyPreferences,
  isMacPlatform: boolean
): string[] {
  const lines: string[] = [];
  for (const action of HOTKEY_ACTION_ORDER) {
    const currentBinding = current[action];
    const importedBinding = imported[action];
    if (areHotkeyBindingsEqual(currentBinding, importedBinding)) {
      continue;
    }
    lines.push(
      `${getHotkeyActionDescription(action)}: ${formatHotkeyBindingSummary(
        currentBinding,
        isMacPlatform
      )} -> ${formatHotkeyBindingSummary(importedBinding, isMacPlatform)}`
    );
  }
  return lines;
}

function formatHotkeyConflictLine(conflict: HotkeyConflict, isMacPlatform: boolean): string {
  const bindingLabel = formatHotkeyBindingLabel(
    {
      enabled: true,
      modifier: conflict.modifier,
      key: conflict.key
    },
    isMacPlatform
  );
  const actions = conflict.actions
    .map((action) => getHotkeyActionDescription(action))
    .join(" / ");
  return `${bindingLabel}: ${actions}`;
}

function buildHotkeyImportPreviewDetail(
  diffLines: string[],
  importedConflicts: HotkeyConflict[],
  disabledByAutoResolve: HotkeyActionId[],
  isMacPlatform: boolean
): string {
  const lines: string[] = [];
  lines.push(`Changes (${diffLines.length}):`);
  lines.push(...diffLines);
  lines.push("");
  if (importedConflicts.length > 0) {
    lines.push(`Imported Conflicts (${importedConflicts.length}):`);
    lines.push(...importedConflicts.map((conflict) => formatHotkeyConflictLine(conflict, isMacPlatform)));
  } else {
    lines.push("Imported Conflicts: none");
  }
  lines.push("");
  if (disabledByAutoResolve.length > 0) {
    lines.push(
      `If you choose "Import + Auto Resolve", these actions will be disabled (${disabledByAutoResolve.length}):`
    );
    lines.push(...disabledByAutoResolve.map((action) => getHotkeyActionDescription(action)));
  } else {
    lines.push('If you choose "Import + Auto Resolve", no actions will be disabled.');
  }
  return lines.join("\n");
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

function getHotkeyBindingSignature(binding: HotkeyBindingPreference): string {
  const normalizedKey = normalizeHotkeyKey(binding.key, "");
  if (!normalizedKey) {
    return "";
  }
  return `${binding.modifier}:${normalizedKey}`;
}

function findHotkeyConflicts(preferences: HotkeyPreferences): HotkeyConflict[] {
  const bySignature = new Map<string, HotkeyConflict>();
  for (const action of HOTKEY_ACTION_ORDER) {
    const binding = preferences[action];
    if (!binding.enabled) {
      continue;
    }
    const key = normalizeHotkeyKey(binding.key, "");
    if (!key) {
      continue;
    }
    const signature = `${binding.modifier}:${key}`;
    const existing = bySignature.get(signature);
    if (existing) {
      existing.actions.push(action);
      continue;
    }
    bySignature.set(signature, {
      signature,
      modifier: binding.modifier,
      key,
      actions: [action]
    });
  }
  return Array.from(bySignature.values())
    .filter((entry) => entry.actions.length > 1)
    .sort((left, right) => {
      if (left.actions.length !== right.actions.length) {
        return right.actions.length - left.actions.length;
      }
      return left.signature.localeCompare(right.signature);
    });
}

function autoResolveHotkeyConflicts(preferences: HotkeyPreferences): {
  preferences: HotkeyPreferences;
  disabledActions: HotkeyActionId[];
} {
  const seenSignatures = new Set<string>();
  const nextPreferences: HotkeyPreferences = {
    openSessionTab: { ...preferences.openSessionTab },
    closeActiveTab: { ...preferences.closeActiveTab },
    terminalCopy: { ...preferences.terminalCopy },
    terminalPaste: { ...preferences.terminalPaste },
    terminalSearch: { ...preferences.terminalSearch }
  };
  const disabledActions: HotkeyActionId[] = [];
  for (const action of HOTKEY_ACTION_ORDER) {
    const binding = nextPreferences[action];
    if (!binding.enabled) {
      continue;
    }
    const signature = getHotkeyBindingSignature(binding);
    if (!signature) {
      continue;
    }
    if (seenSignatures.has(signature)) {
      nextPreferences[action] = {
        ...binding,
        enabled: false
      };
      disabledActions.push(action);
      continue;
    }
    seenSignatures.add(signature);
  }
  return {
    preferences: nextPreferences,
    disabledActions
  };
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

function buildPortForwardEventCorrelationParts(event: PortForwardEventRecord): string[] {
  const parts: string[] = [];
  if (event.correlationKey) {
    parts.push(`corr ${event.correlationKey}`);
  }
  if (event.connectionId) {
    parts.push(`conn ${event.connectionId}`);
  }
  if (event.sourceEndpoint) {
    parts.push(`src ${event.sourceEndpoint}`);
  }
  if (event.targetEndpoint) {
    parts.push(`dst ${event.targetEndpoint}`);
  }
  if (event.errorCode) {
    parts.push(`code ${event.errorCode}`);
  }
  return parts;
}

function formatPortForwardEventCorrelation(event: PortForwardEventRecord): string {
  return buildPortForwardEventCorrelationParts(event).join(" | ");
}

function resolvePortForwardEventTimeRangeCutoff(
  range: PortForwardEventTimeRange,
  nowMs: number
): number | null {
  if (!Number.isFinite(nowMs) || nowMs <= 0 || range === "all") {
    return null;
  }
  if (range === "5m") {
    return nowMs - 5 * 60_000;
  }
  if (range === "30m") {
    return nowMs - 30 * 60_000;
  }
  if (range === "1h") {
    return nowMs - 60 * 60_000;
  }
  return nowMs - 24 * 60 * 60_000;
}

function resolveTransferHistoryTimeRangeCutoff(
  range: TransferHistoryTimeRange,
  nowMs: number
): number | null {
  if (!Number.isFinite(nowMs) || nowMs <= 0 || range === "all") {
    return null;
  }
  if (range === "5m") {
    return nowMs - 5 * 60_000;
  }
  if (range === "30m") {
    return nowMs - 30 * 60_000;
  }
  if (range === "1h") {
    return nowMs - 60 * 60_000;
  }
  return nowMs - 24 * 60 * 60_000;
}

function resolveDisconnectReportTimeRangeCutoff(
  range: DisconnectReportTimeRange,
  nowMs: number
): number | null {
  if (!Number.isFinite(nowMs) || nowMs <= 0 || range === "all") {
    return null;
  }
  if (range === "5m") {
    return nowMs - 5 * 60_000;
  }
  if (range === "30m") {
    return nowMs - 30 * 60_000;
  }
  if (range === "1h") {
    return nowMs - 60 * 60_000;
  }
  return nowMs - 24 * 60 * 60_000;
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

function isRemotePathMissingError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /(no such file|no such file or directory|cannot find the path|path does not exist)/i.test(
    message
  );
}

function isReconnectRecoverableError(message: string): boolean {
  return /(not connected|disconnected|connection lost|connection reset|broken pipe|handshake|timed out|timeout)/i.test(
    message
  );
}

function isBridgeUnavailableError(message: string): boolean {
  return /(bridge unavailable|bridge is not ready|restart `pnpm dev`)/i.test(message);
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

function isTransferHistoryScopeValue(value: unknown): value is TransferHistoryScope {
  return value === "activeSession" || value === "allSessions";
}

function isTransferHistoryDirectionFilterValue(
  value: unknown
): value is TransferHistoryDirectionFilter {
  return value === "all" || value === "upload" || value === "download";
}

function isTransferHistoryStatusFilterValue(value: unknown): value is TransferHistoryStatusFilter {
  return value === "all" || isSftpTransferStatus(value);
}

function isTransferHistoryTimeRangeValue(value: unknown): value is TransferHistoryTimeRange {
  return value === "all" || value === "5m" || value === "30m" || value === "1h" || value === "24h";
}

function isRetryCenterListModeValue(value: unknown): value is RetryCenterListMode {
  return value === "flat" || value === "groupedByReason";
}

function isRetryCenterRetryScopeValue(value: unknown): value is RetryCenterRetryScope {
  return value === "all" || value === "upload" || value === "download";
}

function normalizeRetryCenterFailureReasonFilter(value: unknown): string {
  if (typeof value !== "string") {
    return RETRY_CENTER_FAILURE_REASON_ALL;
  }
  const normalized = value.trim().slice(0, 96);
  if (normalized.toLowerCase() === "all") {
    return RETRY_CENTER_FAILURE_REASON_ALL;
  }
  return normalized.length > 0 ? normalized : RETRY_CENTER_FAILURE_REASON_ALL;
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

function isPortForwardEventFilterValue(value: unknown): value is PortForwardEventFilter {
  return value === "all" || value === "errors" || value === "lifecycle" || value === "status";
}

function isPortForwardEventTimeRangeValue(value: unknown): value is PortForwardEventTimeRange {
  return value === "all" || value === "5m" || value === "30m" || value === "1h" || value === "24h";
}

function isDisconnectReportScopeValue(value: unknown): value is DisconnectReportScope {
  return value === "allSessions" || value === "activeSession";
}

function isDisconnectReportTriggerFilterValue(value: unknown): value is DisconnectReportTriggerFilter {
  return value === "all" || value === "status" || value === "error";
}

function isDisconnectReportTimeRangeValue(value: unknown): value is DisconnectReportTimeRange {
  return value === "all" || value === "5m" || value === "30m" || value === "1h" || value === "24h";
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

function createDisconnectReportId(): string {
  return `dr-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createPortForwardPresetId(): string {
  return `pfp-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createPortForwardEventHistoryKey(sessionId: string, eventId: string): string {
  return `${sessionId}\u0000${eventId}`;
}

function toSafeFileNameSegment(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "snapshot";
  }
  const sanitized = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return sanitized || "snapshot";
}

function toIsoTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "";
  }
  const value = new Date(timestamp);
  if (!Number.isFinite(value.getTime())) {
    return "";
  }
  return value.toISOString();
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const normalized = value == null ? "" : String(value);
  if (!/[",\r\n]/.test(normalized)) {
    return normalized;
  }
  return `"${normalized.replace(/"/g, "\"\"")}"`;
}

function getPathBaseName(pathValue: string): string {
  const normalized = pathValue.replaceAll("\\", "/");
  const marker = normalized.lastIndexOf("/");
  if (marker < 0) {
    return normalized;
  }
  return normalized.slice(marker + 1);
}

function parseImportedCommandHistoryCommands(payload: unknown): string[] {
  let rows: unknown[] = [];
  if (Array.isArray(payload)) {
    rows = payload;
  } else if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.commands)) {
      rows = record.commands;
    } else if (Array.isArray(record.entries)) {
      rows = record.entries;
    }
  }
  if (rows.length === 0) {
    return [];
  }
  const parsed: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    let command = "";
    if (typeof row === "string") {
      command = row.trim();
    } else if (row && typeof row === "object") {
      const candidate = row as Record<string, unknown>;
      command = typeof candidate.command === "string" ? candidate.command.trim() : "";
    }
    if (!command || seen.has(command)) {
      continue;
    }
    seen.add(command);
    parsed.push(command.slice(0, 4000));
    if (parsed.length >= MAX_TERMINAL_COMMAND_HISTORY) {
      break;
    }
  }
  return parsed;
}

function parseSessionJsonImportCandidates(payload: unknown): SessionJsonImportParseResult {
  const warnings: string[] = [];
  const source =
    payload && typeof payload === "object" && "sessions" in payload
      ? (payload as { sessions?: unknown }).sessions
      : payload;
  if (!Array.isArray(source)) {
    return {
      candidates: [],
      warnings: ["Import file does not contain a sessions array."]
    };
  }

  const candidates: SessionJsonImportCandidate[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const row = source[index];
    if (!row || typeof row !== "object") {
      warnings.push(`Row ${index + 1}: not an object, skipped.`);
      continue;
    }
    const candidate = row as Record<string, unknown>;
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const host = typeof candidate.host === "string" ? candidate.host.trim() : "";
    const username =
      typeof candidate.username === "string" ? candidate.username.trim() : "";
    const rawPort = candidate.port;
    const parsedPort =
      typeof rawPort === "number"
        ? Math.trunc(rawPort)
        : typeof rawPort === "string"
          ? Number.parseInt(rawPort, 10)
          : 22;
    const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 22;
    const authType =
      candidate.authType === "privateKey" ? "privateKey" : "password";
    const privateKeyPath =
      typeof candidate.privateKeyPath === "string" ? candidate.privateKeyPath.trim() : "";
    const groupId = typeof candidate.groupId === "string" ? candidate.groupId.trim() : "";
    const remark = typeof candidate.remark === "string" ? candidate.remark.trim() : "";
    const favorite = typeof candidate.favorite === "boolean" ? candidate.favorite : false;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";

    if (!name || !host || !username) {
      warnings.push(`Row ${index + 1}: missing required field (name/host/username), skipped.`);
      continue;
    }
    if (authType === "privateKey" && !privateKeyPath) {
      warnings.push(`Row ${index + 1}: privateKey auth without key path; using password auth.`);
    }
    candidates.push({
      id,
      name,
      host,
      port,
      username,
      authType: authType === "privateKey" && privateKeyPath ? "privateKey" : "password",
      privateKeyPath: authType === "privateKey" ? privateKeyPath : "",
      groupId,
      remark,
      favorite
    });
  }
  return {
    candidates,
    warnings
  };
}

function formatSessionJsonImportPreview(result: SessionJsonImportParseResult): string {
  const lines: string[] = [];
  lines.push(`Importable sessions: ${result.candidates.length}`);
  const previewRows = result.candidates.slice(0, 40);
  for (const candidate of previewRows) {
    const authLabel =
      candidate.authType === "privateKey" && candidate.privateKeyPath
        ? `key=${candidate.privateKeyPath}`
        : "password";
    const groupLabel = candidate.groupId || "Ungrouped";
    lines.push(
      `- ${candidate.name}: ${candidate.username}@${candidate.host}:${candidate.port} [${groupLabel}] (${authLabel})`
    );
  }
  if (result.candidates.length > previewRows.length) {
    lines.push(`... ${result.candidates.length - previewRows.length} more entries`);
  }
  if (result.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of result.warnings.slice(0, 20)) {
      lines.push(`- ${warning}`);
    }
    if (result.warnings.length > 20) {
      lines.push(`... ${result.warnings.length - 20} more warnings`);
    }
  }
  return lines.join("\n");
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

function isTransferConflictStrategy(value: unknown): value is TransferConflictStrategy {
  return value === "overwrite" || value === "skip" || value === "rename";
}

function parseTransferConflictChoice(
  value: string | null
): { strategy: TransferConflictStrategy; remember: boolean } | null {
  if (value === "overwriteRemember") {
    return { strategy: "overwrite", remember: true };
  }
  if (value === "skipRemember") {
    return { strategy: "skip", remember: true };
  }
  if (value === "renameRemember") {
    return { strategy: "rename", remember: true };
  }
  const strategy = toTransferConflictStrategy(value);
  if (!strategy) {
    return null;
  }
  return {
    strategy,
    remember: false
  };
}

function formatTransferConflictStrategyLabel(strategy: TransferConflictStrategy | null | undefined): string {
  if (strategy === "overwrite") {
    return "Overwrite";
  }
  if (strategy === "skip") {
    return "Skip";
  }
  if (strategy === "rename") {
    return "Rename";
  }
  return "Not set";
}

async function runWithConcurrencyLimit<T>(
  items: T[],
  limit: number,
  runner: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  const workerCount = Math.max(1, Math.min(items.length, Math.trunc(limit) || 1));
  let nextIndex = 0;
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      await runner(items[currentIndex]);
    }
  });
  await Promise.all(workers);
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

function classifyTransferFailureReason(message?: string): string {
  const normalized = (message ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "Unknown";
  }
  const lowered = normalized.toLowerCase();
  if (lowered.includes("permission denied") || lowered.includes("access denied")) {
    return "Permission denied";
  }
  if (lowered.includes("no such file") || lowered.includes("not found")) {
    return "Missing file or directory";
  }
  if (lowered.includes("already exists") || lowered.includes("file exists")) {
    return "Target already exists";
  }
  if (lowered.includes("no space left") || lowered.includes("disk full") || lowered.includes("quota")) {
    return "Storage full or quota limit";
  }
  if (lowered.includes("timed out") || lowered.includes("timeout")) {
    return "Timeout";
  }
  if (
    lowered.includes("not connected") ||
    lowered.includes("connection lost") ||
    lowered.includes("disconnected") ||
    lowered.includes("connection reset") ||
    lowered.includes("broken pipe") ||
    lowered.includes("handshake")
  ) {
    return "Connection issue";
  }
  if (lowered.includes("canceled") || lowered.includes("cancelled")) {
    return "Canceled";
  }
  if (lowered.includes("failure") || lowered.includes("failed")) {
    return "Remote operation failure";
  }
  return normalized.slice(0, 96);
}

function getTransferFailureSuggestion(reason: string): string | null {
  if (!reason || reason === "Unknown") {
    return "Open Diagnostics and inspect the latest transfer logs before retrying.";
  }
  if (reason === "Permission denied") {
    return "Verify remote path permissions/owner and confirm current SSH user has write access.";
  }
  if (reason === "Missing file or directory") {
    return "Refresh remote directory and ensure target path exists. Recreate missing folders before retry.";
  }
  if (reason === "Target already exists") {
    return "Use conflict strategy `Rename` or `Overwrite` for this batch, then retry failed items.";
  }
  if (reason === "Storage full or quota limit") {
    return "Check disk/quota on remote host, free space, then retry failed transfers.";
  }
  if (reason === "Timeout") {
    return "Reduce transfer concurrency in Settings > SFTP and retry with smaller batches.";
  }
  if (reason === "Connection issue") {
    return "Reconnect session first, confirm network stability, then retry failed transfers.";
  }
  if (reason === "Canceled") {
    return "Canceled items can be retried directly from Retry Center when needed.";
  }
  if (reason === "Remote operation failure") {
    return "Inspect detailed backend error in Diagnostics and verify remote path/permissions.";
  }
  return "Use Diagnostics details for this error and retry selected items after remediation.";
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

function parseRetryBatchConfirmThreshold(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(
    MAX_RETRY_BATCH_CONFIRM_THRESHOLD,
    Math.max(MIN_RETRY_BATCH_CONFIRM_THRESHOLD, Math.trunc(value))
  );
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
    return parseHotkeyPreferencesSource(parsed);
  } catch {
    return createDefaultHotkeyPreferences();
  }
}

function readHotkeyConflictCursorSignature(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const rawValue = window.localStorage.getItem(HOTKEY_CONFLICT_NAV_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }
    const normalized = rawValue.trim();
    return normalized || null;
  } catch {
    return null;
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

function readSessionTransferConflictStrategyState(): SessionTransferConflictStrategyState {
  if (typeof window === "undefined") {
    return DEFAULT_SESSION_TRANSFER_CONFLICT_STRATEGY_STATE;
  }
  try {
    const rawValue = window.localStorage.getItem(SFTP_CONFLICT_STRATEGY_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_SESSION_TRANSFER_CONFLICT_STRATEGY_STATE;
    }
    const parsed = JSON.parse(rawValue) as Partial<SessionTransferConflictStrategyState>;
    if (!parsed || typeof parsed !== "object") {
      return DEFAULT_SESSION_TRANSFER_CONFLICT_STRATEGY_STATE;
    }
    const rawBySessionId =
      parsed.bySessionId && typeof parsed.bySessionId === "object"
        ? (parsed.bySessionId as Record<string, unknown>)
        : {};
    const bySessionId: Record<string, SessionTransferConflictStrategy> = {};
    for (const [rawSessionId, rawValueBySession] of Object.entries(rawBySessionId)) {
      const sessionId = rawSessionId.trim();
      if (!sessionId || !rawValueBySession || typeof rawValueBySession !== "object") {
        continue;
      }
      const candidate = rawValueBySession as {
        upload?: unknown;
        download?: unknown;
      };
      const upload = isTransferConflictStrategy(candidate.upload)
        ? candidate.upload
        : undefined;
      const download = isTransferConflictStrategy(candidate.download)
        ? candidate.download
        : undefined;
      if (!upload && !download) {
        continue;
      }
      bySessionId[sessionId] = {
        upload,
        download
      };
    }
    return {
      bySessionId
    };
  } catch {
    return DEFAULT_SESSION_TRANSFER_CONFLICT_STRATEGY_STATE;
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

function normalizePendingTransferRestoreItems(payload: unknown): PendingTransferRestoreItem[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: unknown[] }).items
      : [];
  const normalized: PendingTransferRestoreItem[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const candidate = row as Partial<PendingTransferRestoreItem>;
    const sessionId = typeof candidate.sessionId === "string" ? candidate.sessionId.trim() : "";
    const localPath = typeof candidate.localPath === "string" ? candidate.localPath.trim() : "";
    const remotePath = typeof candidate.remotePath === "string" ? candidate.remotePath.trim() : "";
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const direction =
      candidate.direction === "upload" || candidate.direction === "download"
        ? candidate.direction
        : null;
    if (!sessionId || !localPath || !remotePath || !name || !direction) {
      continue;
    }
    const key =
      typeof candidate.key === "string" && candidate.key.trim().length > 0
        ? candidate.key.trim()
        : createTransferHistoryKey(sessionId, direction, localPath, remotePath);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push({
      key,
      sessionId,
      direction,
      localPath,
      remotePath,
      name
    });
    if (normalized.length >= MAX_PENDING_TRANSFER_RESTORE_ITEMS) {
      break;
    }
  }
  return normalized;
}

function arePendingTransferRestoreItemsEqual(
  left: PendingTransferRestoreItem[],
  right: PendingTransferRestoreItem[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    const leftItem = left[index];
    const rightItem = right[index];
    if (
      leftItem.key !== rightItem.key ||
      leftItem.sessionId !== rightItem.sessionId ||
      leftItem.direction !== rightItem.direction ||
      leftItem.localPath !== rightItem.localPath ||
      leftItem.remotePath !== rightItem.remotePath ||
      leftItem.name !== rightItem.name
    ) {
      return false;
    }
  }
  return true;
}

function readPendingTransferRestoreItems(): PendingTransferRestoreItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const rawValue = window.localStorage.getItem(SFTP_TRANSFER_PENDING_RESTORE_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }
    return normalizePendingTransferRestoreItems(JSON.parse(rawValue));
  } catch {
    return [];
  }
}

function readSessionQuickProfiles(): SessionQuickProfile[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const rawValue = window.localStorage.getItem(SESSION_QUICK_PROFILES_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const normalized: SessionQuickProfile[] = [];
    const seen = new Set<string>();
    for (const row of parsed) {
      if (!row || typeof row !== "object") {
        continue;
      }
      const candidate = row as Partial<SessionQuickProfile>;
      const id =
        typeof candidate.id === "string" && candidate.id.trim()
          ? candidate.id.trim()
          : `qp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      if (seen.has(id)) {
        continue;
      }
      const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
      const startupCommand =
        typeof candidate.startupCommand === "string" ? candidate.startupCommand.trim() : "";
      if (!name || !startupCommand) {
        continue;
      }
      seen.add(id);
      normalized.push({
        id,
        name: name.slice(0, 80),
        startupCommand: startupCommand.slice(0, 4000),
        confirmBeforeRun: candidate.confirmBeforeRun === true
      });
      if (normalized.length >= MAX_SESSION_QUICK_PROFILES) {
        break;
      }
    }
    return normalized;
  } catch {
    return [];
  }
}

function normalizeCommandSnippetGroups(payload: unknown): CommandSnippetGroup[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { groups?: unknown }).groups)
      ? (payload as { groups: unknown[] }).groups
      : [];
  const normalized: CommandSnippetGroup[] = [];
  const seenGroupIds = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const candidate = row as Partial<CommandSnippetGroup>;
    const groupId =
      typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id.trim()
        : `sg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    if (seenGroupIds.has(groupId)) {
      continue;
    }
    const groupName = typeof candidate.name === "string" ? candidate.name.trim() : "";
    if (!groupName) {
      continue;
    }
    const snippets = Array.isArray(candidate.snippets) ? candidate.snippets : [];
    const normalizedSnippets: CommandSnippetItem[] = [];
    const seenSnippetIds = new Set<string>();
    for (const snippetRow of snippets) {
      if (!snippetRow || typeof snippetRow !== "object") {
        continue;
      }
      const snippet = snippetRow as Partial<CommandSnippetItem>;
      const snippetId =
        typeof snippet.id === "string" && snippet.id.trim()
          ? snippet.id.trim()
          : `sn-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      if (seenSnippetIds.has(snippetId)) {
        continue;
      }
      const snippetName = typeof snippet.name === "string" ? snippet.name.trim() : "";
      const template = typeof snippet.template === "string" ? snippet.template.trim() : "";
      if (!snippetName || !template) {
        continue;
      }
      seenSnippetIds.add(snippetId);
      normalizedSnippets.push({
        id: snippetId,
        name: snippetName.slice(0, 80),
        template: template.slice(0, 4000),
        confirmBeforeRun: snippet.confirmBeforeRun === true
      });
      if (normalizedSnippets.length >= MAX_COMMAND_SNIPPETS_PER_GROUP) {
        break;
      }
    }
    seenGroupIds.add(groupId);
    normalized.push({
      id: groupId,
      name: groupName.slice(0, 80),
      snippets: normalizedSnippets
    });
    if (normalized.length >= MAX_COMMAND_SNIPPET_GROUPS) {
      break;
    }
  }
  return normalized;
}

function readCommandSnippetGroups(): CommandSnippetGroup[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const rawValue = window.localStorage.getItem(COMMAND_SNIPPET_GROUPS_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }
    return normalizeCommandSnippetGroups(JSON.parse(rawValue));
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
      const correlationKey =
        typeof candidate.correlationKey === "string" && candidate.correlationKey.trim().length > 0
          ? candidate.correlationKey.trim().slice(0, 120)
          : undefined;
      const connectionId =
        typeof candidate.connectionId === "string" && candidate.connectionId.trim().length > 0
          ? candidate.connectionId.trim().slice(0, 120)
          : undefined;
      const sourceEndpoint =
        typeof candidate.sourceEndpoint === "string" && candidate.sourceEndpoint.trim().length > 0
          ? candidate.sourceEndpoint.trim().slice(0, 180)
          : undefined;
      const targetEndpoint =
        typeof candidate.targetEndpoint === "string" && candidate.targetEndpoint.trim().length > 0
          ? candidate.targetEndpoint.trim().slice(0, 180)
          : undefined;
      const errorCode =
        typeof candidate.errorCode === "string" && candidate.errorCode.trim().length > 0
          ? candidate.errorCode.trim().slice(0, 40)
          : undefined;
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
        createdAt,
        correlationKey,
        connectionId,
        sourceEndpoint,
        targetEndpoint,
        errorCode
      });
    }
    normalized.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return normalized.slice(0, MAX_PORT_FORWARD_EVENT_HISTORY);
  } catch {
    return [];
  }
}

function readPortForwardEventViewPreferences(): PortForwardEventViewPreferences {
  const defaults = DEFAULT_PORT_FORWARD_EVENT_VIEW_PREFERENCES;
  if (typeof window === "undefined") {
    return defaults;
  }
  try {
    const rawValue = window.localStorage.getItem(PORT_FORWARD_EVENT_VIEW_STORAGE_KEY);
    if (!rawValue) {
      return defaults;
    }
    const parsed = JSON.parse(rawValue) as Partial<PortForwardEventViewPreferences>;
    const errorCodeValue =
      typeof parsed.errorCode === "string" && parsed.errorCode.trim().length > 0
        ? parsed.errorCode.trim().slice(0, 60)
        : defaults.errorCode;
    return {
      filter: isPortForwardEventFilterValue(parsed.filter) ? parsed.filter : defaults.filter,
      timeRange: isPortForwardEventTimeRangeValue(parsed.timeRange)
        ? parsed.timeRange
        : defaults.timeRange,
      errorCode: errorCodeValue,
      correlationQuery:
        typeof parsed.correlationQuery === "string"
          ? parsed.correlationQuery.slice(0, 160)
          : defaults.correlationQuery
    };
  } catch {
    return defaults;
  }
}

function readDisconnectReportViewPreferences(): DisconnectReportViewPreferences {
  const defaults = DEFAULT_DISCONNECT_REPORT_VIEW_PREFERENCES;
  if (typeof window === "undefined") {
    return defaults;
  }
  try {
    const rawValue = window.localStorage.getItem(DISCONNECT_REPORT_VIEW_STORAGE_KEY);
    if (!rawValue) {
      return defaults;
    }
    const parsed = JSON.parse(rawValue) as Partial<DisconnectReportViewPreferences>;
    return {
      scope: isDisconnectReportScopeValue(parsed.scope) ? parsed.scope : defaults.scope,
      trigger: isDisconnectReportTriggerFilterValue(parsed.trigger)
        ? parsed.trigger
        : defaults.trigger,
      timeRange: isDisconnectReportTimeRangeValue(parsed.timeRange)
        ? parsed.timeRange
        : defaults.timeRange,
      query:
        typeof parsed.query === "string"
          ? parsed.query.slice(0, 160)
          : defaults.query
    };
  } catch {
    return defaults;
  }
}

function readRetryCenterViewPreferences(): RetryCenterViewPreferences {
  const defaults = DEFAULT_RETRY_CENTER_VIEW_PREFERENCES;
  if (typeof window === "undefined") {
    return defaults;
  }
  try {
    const rawValue = window.localStorage.getItem(RETRY_CENTER_VIEW_STORAGE_KEY);
    if (!rawValue) {
      return defaults;
    }
    const parsed = JSON.parse(rawValue) as Partial<RetryCenterViewPreferences>;
    return {
      scope: isTransferHistoryScopeValue(parsed.scope) ? parsed.scope : defaults.scope,
      direction: isTransferHistoryDirectionFilterValue(parsed.direction)
        ? parsed.direction
        : defaults.direction,
      status: isTransferHistoryStatusFilterValue(parsed.status) ? parsed.status : defaults.status,
      timeRange: isTransferHistoryTimeRangeValue(parsed.timeRange)
        ? parsed.timeRange
        : defaults.timeRange,
      listMode: isRetryCenterListModeValue(parsed.listMode) ? parsed.listMode : defaults.listMode,
      failureReason: normalizeRetryCenterFailureReasonFilter(parsed.failureReason),
      lastRetryScope: isRetryCenterRetryScopeValue(parsed.lastRetryScope)
        ? parsed.lastRetryScope
        : defaults.lastRetryScope,
      autoUseLastRetryScope:
        typeof parsed.autoUseLastRetryScope === "boolean"
          ? parsed.autoUseLastRetryScope
          : defaults.autoUseLastRetryScope,
      retryBatchConfirmThreshold: parseRetryBatchConfirmThreshold(
        parsed.retryBatchConfirmThreshold,
        defaults.retryBatchConfirmThreshold
      ),
      query: typeof parsed.query === "string" ? parsed.query.slice(0, 160) : defaults.query
    };
  } catch {
    return defaults;
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

function readDisconnectReportCapturePreferences(): DisconnectReportCapturePreferences {
  if (typeof window === "undefined") {
    return DEFAULT_DISCONNECT_REPORT_CAPTURE_PREFERENCES;
  }
  try {
    const rawValue = window.localStorage.getItem(
      DISCONNECT_REPORT_CAPTURE_PREFERENCES_STORAGE_KEY
    );
    if (!rawValue) {
      return DEFAULT_DISCONNECT_REPORT_CAPTURE_PREFERENCES;
    }
    const parsed = JSON.parse(rawValue) as Partial<DisconnectReportCapturePreferences>;
    return {
      enabled:
        typeof parsed.enabled === "boolean"
          ? parsed.enabled
          : DEFAULT_DISCONNECT_REPORT_CAPTURE_PREFERENCES.enabled
    };
  } catch {
    return DEFAULT_DISCONNECT_REPORT_CAPTURE_PREFERENCES;
  }
}

function readDisconnectReportHistory(): DisconnectReportItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const rawValue = window.localStorage.getItem(DISCONNECT_REPORT_HISTORY_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const normalized: DisconnectReportItem[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") {
        continue;
      }
      const candidate = row as Partial<DisconnectReportItem>;
      const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
      const createdAt = typeof candidate.createdAt === "string" ? candidate.createdAt.trim() : "";
      const tabId = typeof candidate.tabId === "string" ? candidate.tabId.trim() : "";
      const tabTitle = typeof candidate.tabTitle === "string" ? candidate.tabTitle.trim() : "";
      const sessionId = typeof candidate.sessionId === "string" ? candidate.sessionId.trim() : "";
      const sessionName =
        typeof candidate.sessionName === "string" ? candidate.sessionName.trim() : "";
      const target = typeof candidate.target === "string" ? candidate.target.trim() : "";
      const trigger = candidate.trigger === "error" ? "error" : candidate.trigger === "status" ? "status" : null;
      const message = typeof candidate.message === "string" ? candidate.message.trim() : "";
      if (
        !id ||
        !createdAt ||
        !tabId ||
        !tabTitle ||
        !sessionId ||
        !sessionName ||
        !target ||
        !trigger ||
        !message
      ) {
        continue;
      }
      const status =
        candidate.status === "connected" ||
        candidate.status === "connecting" ||
        candidate.status === "closed"
          ? candidate.status
          : undefined;
      const parseCount = (value: unknown): number =>
        typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
      const parseBoolean = (value: unknown): boolean => value === true;
      const parseText = (value: unknown, limit = 400): string | undefined => {
        if (typeof value !== "string") {
          return undefined;
        }
        const trimmed = value.trim();
        if (!trimmed) {
          return undefined;
        }
        return trimmed.slice(0, limit);
      };
      const recentFailures: DisconnectReportFailureSample[] = Array.isArray(candidate.recentFailures)
        ? candidate.recentFailures
            .map((entry) => {
              if (!entry || typeof entry !== "object") {
                return null;
              }
              const failure = entry as Partial<DisconnectReportFailureSample>;
              if (!isSftpTransferDirection(failure.direction)) {
                return null;
              }
              const name = typeof failure.name === "string" ? failure.name.trim() : "";
              const failureMessage =
                typeof failure.message === "string" ? failure.message.trim() : "";
              const updatedAt =
                typeof failure.updatedAt === "number" && Number.isFinite(failure.updatedAt)
                  ? Math.max(0, Math.trunc(failure.updatedAt))
                  : 0;
              if (!name || !failureMessage || !updatedAt) {
                return null;
              }
              return {
                direction: failure.direction,
                name: name.slice(0, 220),
                message: failureMessage.slice(0, 400),
                updatedAt
              } satisfies DisconnectReportFailureSample;
            })
            .filter((entry): entry is DisconnectReportFailureSample => !!entry)
            .slice(0, 8)
        : [];
      normalized.push({
        id,
        createdAt,
        tabId,
        tabTitle,
        sessionId,
        sessionName,
        target,
        trigger,
        status,
        message: message.slice(0, 500),
        activeTabId:
          typeof candidate.activeTabId === "string" && candidate.activeTabId.trim().length > 0
            ? candidate.activeTabId.trim()
            : null,
        wasActiveTab: parseBoolean(candidate.wasActiveTab),
        openTabCount: parseCount(candidate.openTabCount),
        connectedTabCount: parseCount(candidate.connectedTabCount),
        autoReconnect: parseBoolean(candidate.autoReconnect),
        reconnectDelaySeconds: Math.min(60, Math.max(1, parseCount(candidate.reconnectDelaySeconds) || 1)),
        uploadRunning: parseCount(candidate.uploadRunning),
        uploadQueued: parseCount(candidate.uploadQueued),
        downloadRunning: parseCount(candidate.downloadRunning),
        downloadQueued: parseCount(candidate.downloadQueued),
        pausedUpload: parseBoolean(candidate.pausedUpload),
        pausedDownload: parseBoolean(candidate.pausedDownload),
        portForwardTotal: parseCount(candidate.portForwardTotal),
        portForwardDegraded: parseCount(candidate.portForwardDegraded),
        portForwardBusy: parseBoolean(candidate.portForwardBusy),
        serverHealthLoading: parseBoolean(candidate.serverHealthLoading),
        serverProcessLoading: parseBoolean(candidate.serverProcessLoading),
        serverHealthError: parseText(candidate.serverHealthError),
        serverProcessError: parseText(candidate.serverProcessError),
        recentFailures
      });
    }
    normalized.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return normalized.slice(0, MAX_DISCONNECT_REPORT_HISTORY);
  } catch {
    return [];
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
  const hotkeyConflicts = useMemo(
    () => findHotkeyConflicts(hotkeyPreferences),
    [hotkeyPreferences]
  );
  const hotkeyConflictActionSet = useMemo(() => {
    const next = new Set<HotkeyActionId>();
    for (const conflict of hotkeyConflicts) {
      for (const action of conflict.actions) {
        next.add(action);
      }
    }
    return next;
  }, [hotkeyConflicts]);
  const hotkeyConflictBindingByAction = useMemo(() => {
    const next = new Map<HotkeyActionId, string>();
    for (const conflict of hotkeyConflicts) {
      const label = formatHotkeyBindingLabel(
        {
          enabled: true,
          modifier: conflict.modifier,
          key: conflict.key
        },
        isMacPlatform
      );
      for (const action of conflict.actions) {
        next.set(action, label);
      }
    }
    return next;
  }, [hotkeyConflicts, isMacPlatform]);
  const [hotkeyConflictCursorSignature, setHotkeyConflictCursorSignature] = useState<
    string | null
  >(() => readHotkeyConflictCursorSignature());
  const [hotkeyFocusedAction, setHotkeyFocusedAction] = useState<HotkeyActionId | null>(null);
  const [hotkeyConflictCursorIndex, setHotkeyConflictCursorIndex] = useState(0);
  const [fileOpenPreferences, setFileOpenPreferences] = useState<FileOpenPreferences>(
    () => readFileOpenPreferences()
  );
  const [sftpTransferPreferences, setSftpTransferPreferences] = useState<SftpTransferPreferences>(
    () => readSftpTransferPreferences()
  );
  const [sessionTransferConflictStrategyState, setSessionTransferConflictStrategyState] =
    useState<SessionTransferConflictStrategyState>(() =>
      readSessionTransferConflictStrategyState()
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
  const [pendingTransferRestoreItems, setPendingTransferRestoreItems] = useState<
    PendingTransferRestoreItem[]
  >(() => readPendingTransferRestoreItems());
  const [pendingTransferRestoreResolved, setPendingTransferRestoreResolved] = useState(
    () => readPendingTransferRestoreItems().length === 0
  );
  const [sessionQuickProfiles, setSessionQuickProfiles] = useState<SessionQuickProfile[]>(
    () => readSessionQuickProfiles()
  );
  const [commandSnippetGroups, setCommandSnippetGroups] = useState<CommandSnippetGroup[]>(
    () => readCommandSnippetGroups()
  );
  const [disconnectReportCapturePreferences, setDisconnectReportCapturePreferences] =
    useState<DisconnectReportCapturePreferences>(() =>
      readDisconnectReportCapturePreferences()
    );
  const [disconnectReports, setDisconnectReports] = useState<DisconnectReportItem[]>(
    () => readDisconnectReportHistory()
  );
  const initialDisconnectReportViewPreferences = useMemo(
    () => readDisconnectReportViewPreferences(),
    []
  );
  const initialRetryCenterViewPreferences = useMemo(() => readRetryCenterViewPreferences(), []);
  const [disconnectReportScope, setDisconnectReportScope] = useState<DisconnectReportScope>(
    initialDisconnectReportViewPreferences.scope
  );
  const [disconnectReportTriggerFilter, setDisconnectReportTriggerFilter] =
    useState<DisconnectReportTriggerFilter>(initialDisconnectReportViewPreferences.trigger);
  const [disconnectReportTimeRange, setDisconnectReportTimeRange] =
    useState<DisconnectReportTimeRange>(initialDisconnectReportViewPreferences.timeRange);
  const [disconnectReportQuery, setDisconnectReportQuery] = useState(
    initialDisconnectReportViewPreferences.query
  );
  const [isRetryCenterOpen, setIsRetryCenterOpen] = useState(false);
  const [isOperationCenterOpen, setIsOperationCenterOpen] = useState(false);
  const [isOperationCenterBulkCanceling, setIsOperationCenterBulkCanceling] = useState(false);
  const [isOperationCenterReconnecting, setIsOperationCenterReconnecting] = useState(false);
  const [retryCenterScope, setRetryCenterScope] = useState<TransferHistoryScope>(
    initialRetryCenterViewPreferences.scope
  );
  const [retryCenterDirection, setRetryCenterDirection] = useState<TransferHistoryDirectionFilter>(
    initialRetryCenterViewPreferences.direction
  );
  const [retryCenterStatus, setRetryCenterStatus] = useState<TransferHistoryStatusFilter>(
    initialRetryCenterViewPreferences.status
  );
  const [retryCenterTimeRange, setRetryCenterTimeRange] = useState<TransferHistoryTimeRange>(
    initialRetryCenterViewPreferences.timeRange
  );
  const [retryCenterListMode, setRetryCenterListMode] = useState<RetryCenterListMode>(
    initialRetryCenterViewPreferences.listMode
  );
  const [retryCenterFailureReasonFilter, setRetryCenterFailureReasonFilter] = useState<string>(
    initialRetryCenterViewPreferences.failureReason
  );
  const [retryCenterLastRetryScope, setRetryCenterLastRetryScope] =
    useState<RetryCenterRetryScope>(initialRetryCenterViewPreferences.lastRetryScope);
  const [retryCenterAutoUseLastRetryScope, setRetryCenterAutoUseLastRetryScope] = useState(
    initialRetryCenterViewPreferences.autoUseLastRetryScope
  );
  const [retryBatchConfirmThreshold, setRetryBatchConfirmThreshold] = useState(
    initialRetryCenterViewPreferences.retryBatchConfirmThreshold
  );
  const [retryCenterQuery, setRetryCenterQuery] = useState(initialRetryCenterViewPreferences.query);
  const [retryCenterSelection, setRetryCenterSelection] = useState<string[]>([]);
  const [retryCenterCollapsedGroupKeys, setRetryCenterCollapsedGroupKeys] = useState<string[]>([]);
  const [sftpContextMenu, setSftpContextMenu] = useState<SftpContextMenuState | null>(null);
  const [sftpToolbarMenu, setSftpToolbarMenu] = useState<SftpToolbarMenuState | null>(null);
  const [commandHistoryContextMenu, setCommandHistoryContextMenu] =
    useState<CommandHistoryContextMenuState | null>(null);
  const [isCommandHistoryManagerOpen, setIsCommandHistoryManagerOpen] = useState(false);
  const [isCommandSnippetManagerOpen, setIsCommandSnippetManagerOpen] = useState(false);
  const [commandSnippetManagerGroupId, setCommandSnippetManagerGroupId] = useState("");
  const [commandSnippetManagerSnippetId, setCommandSnippetManagerSnippetId] = useState("");
  const [commandHistorySelection, setCommandHistorySelection] = useState<string[]>([]);
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
  const initialPortForwardEventViewPreferences = useMemo(
    () => readPortForwardEventViewPreferences(),
    []
  );
  const [portForwardEventFilter, setPortForwardEventFilter] =
    useState<PortForwardEventFilter>(initialPortForwardEventViewPreferences.filter);
  const [portForwardEventTimeRange, setPortForwardEventTimeRange] =
    useState<PortForwardEventTimeRange>(initialPortForwardEventViewPreferences.timeRange);
  const [portForwardEventErrorCode, setPortForwardEventErrorCode] = useState(
    initialPortForwardEventViewPreferences.errorCode
  );
  const [portForwardEventCorrelationQuery, setPortForwardEventCorrelationQuery] = useState(
    initialPortForwardEventViewPreferences.correlationQuery
  );
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
  const [terminalCommandHistoryEntries, setTerminalCommandHistoryEntries] = useState<
    TerminalCommandHistoryEntry[]
  >(() => readTerminalCommandHistory());
  const [terminalCommandHistoryScope, setTerminalCommandHistoryScope] =
    useState<TerminalCommandHistoryScope>("allTabs");
  const [terminalCommandHistoryQuery, setTerminalCommandHistoryQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sessionsRef = useRef<SessionRecord[]>([]);
  const terminalTabsRef = useRef<TerminalTab[]>([]);
  const activeTabIdRef = useRef<string | null>(null);
  const sftpTransfersRef = useRef<SftpTransferItem[]>([]);
  const transferHistoryRef = useRef<SftpTransferHistoryItem[]>([]);
  const portForwardsRef = useRef<PortForwardRecord[]>([]);
  const connectionPreferencesRef = useRef<ConnectionPreferences>(connectionPreferences);
  const disconnectReportCapturePreferencesRef = useRef<DisconnectReportCapturePreferences>(
    disconnectReportCapturePreferences
  );
  const pausedUploadTabsRef = useRef<Record<string, true>>({});
  const pausedDownloadTabsRef = useRef<Record<string, true>>({});
  const serverHealthLoadingRef = useRef<boolean>(serverHealthLoading);
  const serverProcessLoadingRef = useRef<boolean>(serverProcessLoading);
  const serverHealthErrorRef = useRef<string | null>(serverHealthError);
  const serverProcessErrorRef = useRef<string | null>(serverProcessError);
  const portForwardBusyRef = useRef<boolean>(portForwardBusy);
  const intentionalTabCloseIdsRef = useRef<Set<string>>(new Set());
  const disconnectReportFingerprintByTabRef = useRef<
    Map<string, { fingerprint: string; capturedAt: number }>
  >(new Map());
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
  const ensuringRemoteDirectoriesRef = useRef<Map<string, Map<string, Promise<void>>>>(new Map());
  const openingRemoteFilesRef = useRef<Set<string>>(new Set());
  const sftpContextMenuRef = useRef<HTMLDivElement | null>(null);
  const sftpToolbarMenuRef = useRef<HTMLDivElement | null>(null);
  const commandHistoryContextMenuRef = useRef<HTMLDivElement | null>(null);
  const sessionContextMenuRef = useRef<HTMLDivElement | null>(null);
  const appDialogInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const appDialogResolverRef = useRef<((value: unknown) => void) | null>(null);
  const appDialogCancelValueRef = useRef<unknown>(undefined);
  const appHintTimerRef = useRef<number | null>(null);
  const hotkeyRowRefs = useRef<Map<HotkeyActionId, HTMLDivElement | null>>(new Map());
  const hotkeyConflictHighlightTimerRef = useRef<number | null>(null);
  const previousServerHealthRef = useRef<ServerHealthSnapshot | null>(null);
  const serverHealthRequestInFlightTabsRef = useRef<Set<string>>(new Set());
  const serverProcessRequestInFlightTabsRef = useRef<Set<string>>(new Set());
  const uploadBatchNoticeRef = useRef<Set<string>>(new Set());
  const downloadBatchNoticeRef = useRef<Set<string>>(new Set());
  const canceledUploadBatchIdsRef = useRef<Set<string>>(new Set());
  const canceledDownloadBatchIdsRef = useRef<Set<string>>(new Set());
  const transferDockNoticeTimerRef = useRef<number | null>(null);
  const pendingStartupCommandsByTabRef = useRef<Map<string, string[]>>(new Map());
  const runStartupCommandsOnTabRef = useRef<
    (tabId: string, commands: string[]) => Promise<void>
  >(async () => undefined);
  const pendingTransferRestoreNoticeShownRef = useRef(false);
  const [uploadBatchByTab, setUploadBatchByTab] = useState<
    Record<string, { batchId: string; total: number }>
  >({});
  const [downloadBatchByTab, setDownloadBatchByTab] = useState<
    Record<string, { batchId: string; total: number }>
  >({});
  const [pausedUploadTabs, setPausedUploadTabs] = useState<Record<string, true>>({});
  const [pausedDownloadTabs, setPausedDownloadTabs] = useState<Record<string, true>>({});
  const [transferDockNotice, setTransferDockNotice] = useState<TransferDockNotice | null>(null);
  const [appDialog, setAppDialog] = useState<AppDialogState | null>(null);
  const [appDialogInput, setAppDialogInput] = useState("");
  const [appHintMessage, setAppHintMessage] = useState<{
    level: "info" | "warn";
    message: string;
  } | null>(null);
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
  const isActiveUploadQueuePaused = !!(activeTabId && pausedUploadTabs[activeTabId]);
  const isActiveDownloadQueuePaused = !!(activeTabId && pausedDownloadTabs[activeTabId]);
  const activeTransferDockNotice =
    transferDockNotice && activeTabId && transferDockNotice.tabId === activeTabId
      ? transferDockNotice
      : null;
  const activeSessionId = activeTerminalTab?.sessionId ?? null;
  const pendingTransferRestoreCount = pendingTransferRestoreItems.length;
  const totalCommandSnippetCount = useMemo(
    () => commandSnippetGroups.reduce((total, group) => total + group.snippets.length, 0),
    [commandSnippetGroups]
  );
  const visibleTerminalCommandHistoryEntries = useMemo(() => {
    const normalizedQuery = terminalCommandHistoryQuery.trim().toLowerCase();
    const filtered = terminalCommandHistoryEntries.filter((entry) => {
      if (terminalCommandHistoryScope === "activeTab" && activeTabId) {
        if (entry.tabId !== activeTabId) {
          return false;
        }
      }
      if (!normalizedQuery) {
        return true;
      }
      return (
        entry.command.toLowerCase().includes(normalizedQuery) ||
        entry.tabTitle.toLowerCase().includes(normalizedQuery)
      );
    });
    return filtered.slice(0, 120);
  }, [activeTabId, terminalCommandHistoryEntries, terminalCommandHistoryQuery, terminalCommandHistoryScope]);
  const selectedCommandHistoryIdSet = useMemo(
    () => new Set(commandHistorySelection),
    [commandHistorySelection]
  );
  const visibleCommandHistoryIds = useMemo(
    () => visibleTerminalCommandHistoryEntries.map((entry) => entry.id),
    [visibleTerminalCommandHistoryEntries]
  );
  const allVisibleCommandHistorySelected =
    visibleCommandHistoryIds.length > 0 &&
    visibleCommandHistoryIds.every((entryId) => selectedCommandHistoryIdSet.has(entryId));
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
    []
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
        await terminalApi.write(existingTabId, `${entry.command}\n`);
        window.dispatchEvent(
          new CustomEvent(TERMINAL_COMMAND_HISTORY_APPEND_EVENT, {
            detail: {
              tabId: existingTabId,
              command: entry.command
            }
          })
        );
      } catch (caughtError) {
        setError((caughtError as Error).message);
      }
    },
    [terminalApi]
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
        await terminalApi.write(targetTabId, entry.command);
      } catch (caughtError) {
        setError((caughtError as Error).message);
      }
    },
    [terminalApi]
  );
  const upsertTerminalCommandHistoryCommand = useCallback(
    (
      command: string,
      options?: {
        replaceEntryId?: string;
        preferredTabId?: string;
        preferredTabTitle?: string;
      }
    ): boolean => {
      const normalizedCommand = command.trim();
      if (!normalizedCommand) {
        return false;
      }
      const replaceEntryId = options?.replaceEntryId?.trim() ?? "";
      const preferredTabId = options?.preferredTabId?.trim();
      const fallbackTabId = activeTabIdRef.current ?? terminalTabsRef.current[0]?.id ?? "__manual__";
      const tabId = preferredTabId || fallbackTabId;
      const tabTitleFromOpenTab =
        terminalTabsRef.current.find((tab) => tab.id === tabId)?.title?.trim() ?? "";
      const tabTitle =
        options?.preferredTabTitle?.trim() ||
        tabTitleFromOpenTab ||
        (tabId === "__manual__" ? "Manual" : `Tab ${tabId}`);

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
            command: normalizedCommand
          }
        })
      );
      setTerminalCommandHistoryEntries((prev) => {
        const filtered = prev.filter((entry) => {
          if (replaceEntryId && entry.id === replaceEntryId) {
            return false;
          }
          return entry.command.trim() !== normalizedCommand;
        });
        const nextEntry: TerminalCommandHistoryEntry = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          tabId,
          tabTitle,
          command: normalizedCommand,
          executedAt: Date.now()
        };
        return [nextEntry, ...filtered].slice(0, MAX_TERMINAL_COMMAND_HISTORY);
      });
      return true;
    },
    []
  );
  const deleteTerminalCommandHistoryEntries = useCallback((entryIds: string[]) => {
    const normalizedEntryIds = Array.from(
      new Set(entryIds.map((entryId) => entryId.trim()).filter((entryId) => entryId.length > 0))
    );
    if (normalizedEntryIds.length === 0) {
      return;
    }
    const deleteSet = new Set(normalizedEntryIds);
    setTerminalCommandHistoryEntries((prev) =>
      prev.filter((entry) => !deleteSet.has(entry.id))
    );
    setCommandHistorySelection((prev) => prev.filter((entryId) => !deleteSet.has(entryId)));
    for (const entryId of normalizedEntryIds) {
      window.dispatchEvent(
        new CustomEvent(TERMINAL_COMMAND_HISTORY_REMOVE_EVENT, {
          detail: {
            entryId
          }
        })
      );
    }
  }, []);
  const deleteTerminalCommandHistoryEntry = useCallback(
    (entryId: string) => {
      deleteTerminalCommandHistoryEntries([entryId]);
    },
    [deleteTerminalCommandHistoryEntries]
  );
  const toggleCommandHistorySelection = useCallback((entryId: string) => {
    const normalizedEntryId = entryId.trim();
    if (!normalizedEntryId) {
      return;
    }
    setCommandHistorySelection((prev) => {
      if (prev.includes(normalizedEntryId)) {
        return prev.filter((value) => value !== normalizedEntryId);
      }
      return [...prev, normalizedEntryId];
    });
  }, []);
  const toggleSelectAllVisibleCommandHistory = useCallback(() => {
    if (visibleCommandHistoryIds.length === 0) {
      return;
    }
    const visibleSet = new Set(visibleCommandHistoryIds);
    setCommandHistorySelection((prev) => {
      if (allVisibleCommandHistorySelected) {
        return prev.filter((entryId) => !visibleSet.has(entryId));
      }
      const next = [...prev];
      for (const entryId of visibleCommandHistoryIds) {
        if (!next.includes(entryId)) {
          next.push(entryId);
        }
      }
      return next;
    });
  }, [allVisibleCommandHistorySelected, visibleCommandHistoryIds]);
  const clearCommandHistorySelection = useCallback(() => {
    setCommandHistorySelection([]);
  }, []);
  const openCommandHistoryManager = useCallback(() => {
    setCommandHistoryContextMenu(null);
    setIsCommandHistoryManagerOpen(true);
  }, []);
  const closeCommandHistoryManager = useCallback(() => {
    setIsCommandHistoryManagerOpen(false);
    setCommandHistorySelection([]);
  }, []);
  const openCommandSnippetManager = useCallback(() => {
    setCommandHistoryContextMenu(null);
    setIsCommandSnippetManagerOpen(true);
  }, []);
  const closeCommandSnippetManager = useCallback(() => {
    setIsCommandSnippetManagerOpen(false);
  }, []);
  const deleteSelectedCommandHistoryEntries = useCallback(() => {
    deleteTerminalCommandHistoryEntries(commandHistorySelection);
  }, [commandHistorySelection, deleteTerminalCommandHistoryEntries]);
  const deleteVisibleCommandHistoryEntries = useCallback(() => {
    deleteTerminalCommandHistoryEntries(visibleCommandHistoryIds);
  }, [deleteTerminalCommandHistoryEntries, visibleCommandHistoryIds]);
  const deleteAllCommandHistoryEntries = useCallback(() => {
    deleteTerminalCommandHistoryEntries(terminalCommandHistoryEntries.map((entry) => entry.id));
  }, [deleteTerminalCommandHistoryEntries, terminalCommandHistoryEntries]);
  useEffect(() => {
    setCommandHistorySelection((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const validIdSet = new Set(terminalCommandHistoryEntries.map((entry) => entry.id));
      const next = prev.filter((entryId) => validIdSet.has(entryId));
      return next.length === prev.length ? prev : next;
    });
  }, [terminalCommandHistoryEntries]);
  useEffect(() => {
    if (!isCommandHistoryManagerOpen) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      closeCommandHistoryManager();
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [closeCommandHistoryManager, isCommandHistoryManagerOpen]);
  useEffect(() => {
    if (!isCommandHistoryManagerOpen) {
      return;
    }
    setCommandHistoryContextMenu(null);
  }, [isCommandHistoryManagerOpen]);
  useEffect(() => {
    if (!isCommandSnippetManagerOpen) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      closeCommandSnippetManager();
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [closeCommandSnippetManager, isCommandSnippetManagerOpen]);
  useEffect(() => {
    if (!isCommandSnippetManagerOpen) {
      return;
    }
    setCommandHistoryContextMenu(null);
  }, [isCommandSnippetManagerOpen]);
  const selectedCommandHistoryContextEntry = useMemo(() => {
    if (!commandHistoryContextMenu || !commandHistoryContextMenu.entryId) {
      return null;
    }
    return (
      terminalCommandHistoryEntries.find(
        (entry) => entry.id === commandHistoryContextMenu.entryId
      ) ?? null
    );
  }, [commandHistoryContextMenu, terminalCommandHistoryEntries]);
  const activeSessionTransferConflictStrategy = useMemo(() => {
    if (!activeSessionId) {
      return null;
    }
    const strategy = sessionTransferConflictStrategyState.bySessionId[activeSessionId];
    return {
      upload: strategy?.upload ?? null,
      download: strategy?.download ?? null
    };
  }, [activeSessionId, sessionTransferConflictStrategyState.bySessionId]);
  const visibleDisconnectReports = useMemo(() => {
    let filtered = disconnectReports;
    if (disconnectReportScope === "activeSession") {
      if (!activeSessionId) {
        return [] as DisconnectReportItem[];
      }
      filtered = filtered.filter((entry) => entry.sessionId === activeSessionId);
    }
    if (disconnectReportTriggerFilter !== "all") {
      filtered = filtered.filter((entry) => entry.trigger === disconnectReportTriggerFilter);
    }
    const cutoffMs = resolveDisconnectReportTimeRangeCutoff(disconnectReportTimeRange, Date.now());
    if (cutoffMs !== null) {
      filtered = filtered.filter((entry) => {
        const createdAtMs = new Date(entry.createdAt).getTime();
        return Number.isFinite(createdAtMs) && createdAtMs >= cutoffMs;
      });
    }
    const normalizedQuery = disconnectReportQuery.trim().toLowerCase();
    if (normalizedQuery) {
      filtered = filtered.filter((entry) =>
        [
          entry.sessionName,
          entry.target,
          entry.tabTitle,
          entry.message,
          entry.trigger,
          entry.status ?? ""
        ].some((value) => value.toLowerCase().includes(normalizedQuery))
      );
    }
    return filtered
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [
    activeSessionId,
    disconnectReportQuery,
    disconnectReportScope,
    disconnectReportTimeRange,
    disconnectReportTriggerFilter,
    disconnectReports
  ]);
  const hasCustomizedDisconnectReportView =
    disconnectReportScope !== DEFAULT_DISCONNECT_REPORT_VIEW_PREFERENCES.scope ||
    disconnectReportTriggerFilter !== DEFAULT_DISCONNECT_REPORT_VIEW_PREFERENCES.trigger ||
    disconnectReportTimeRange !== DEFAULT_DISCONNECT_REPORT_VIEW_PREFERENCES.timeRange ||
    disconnectReportQuery.trim().length > 0;
  const resetDisconnectReportViewFilters = useCallback(() => {
    setDisconnectReportScope(DEFAULT_DISCONNECT_REPORT_VIEW_PREFERENCES.scope);
    setDisconnectReportTriggerFilter(DEFAULT_DISCONNECT_REPORT_VIEW_PREFERENCES.trigger);
    setDisconnectReportTimeRange(DEFAULT_DISCONNECT_REPORT_VIEW_PREFERENCES.timeRange);
    setDisconnectReportQuery(DEFAULT_DISCONNECT_REPORT_VIEW_PREFERENCES.query);
  }, []);
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
  const portForwardEventErrorCodeOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const entry of activePortForwardEventHistory) {
      const code = entry.errorCode?.trim();
      if (code) {
        codes.add(code);
      }
    }
    return ["all", ...Array.from(codes).sort((left, right) => left.localeCompare(right))];
  }, [activePortForwardEventHistory]);
  const visiblePortForwardEventHistory = useMemo(() => {
    let filtered = activePortForwardEventHistory;
    if (portForwardEventFilter === "errors") {
      filtered = filtered.filter((entry) => entry.level === "error");
    } else if (portForwardEventFilter === "lifecycle") {
      filtered = filtered.filter(
        (entry) => entry.type === "created" || entry.type === "removed"
      );
    } else if (portForwardEventFilter === "status") {
      filtered = filtered.filter(
        (entry) => entry.type === "statusDegraded" || entry.type === "statusRecovered"
      );
    }
    const cutoffMs = resolvePortForwardEventTimeRangeCutoff(
      portForwardEventTimeRange,
      Date.now()
    );
    if (cutoffMs !== null) {
      filtered = filtered.filter((entry) => {
        const eventTimeMs = new Date(entry.createdAt).getTime();
        return Number.isFinite(eventTimeMs) && eventTimeMs >= cutoffMs;
      });
    }
    const normalizedErrorCode = portForwardEventErrorCode.trim().toLowerCase();
    if (normalizedErrorCode && normalizedErrorCode !== "all") {
      filtered = filtered.filter(
        (entry) => (entry.errorCode ?? "").trim().toLowerCase() === normalizedErrorCode
      );
    }
    const normalizedCorrelationQuery = portForwardEventCorrelationQuery.trim().toLowerCase();
    if (!normalizedCorrelationQuery) {
      return filtered;
    }
    return filtered.filter((entry) => {
      const correlation = (entry.correlationKey ?? "").toLowerCase();
      const connection = (entry.connectionId ?? "").toLowerCase();
      return (
        correlation.includes(normalizedCorrelationQuery) ||
        connection.includes(normalizedCorrelationQuery)
      );
    });
  }, [
    activePortForwardEventHistory,
    portForwardEventErrorCode,
    portForwardEventCorrelationQuery,
    portForwardEventFilter,
    portForwardEventTimeRange
  ]);
  const portForwardVisibleEventAnalytics = useMemo(() => {
    const levelCounts: Record<PortForwardEventRecord["level"], number> = {
      info: 0,
      error: 0
    };
    const typeCounts: Record<PortForwardEventRecord["type"], number> = {
      created: 0,
      removed: 0,
      statusRecovered: 0,
      statusDegraded: 0
    };
    const errorCodeCounts = new Map<string, number>();
    const correlationCounts = new Map<string, number>();
    let earliestTimestampMs: number | null = null;
    let latestTimestampMs: number | null = null;
    for (const event of visiblePortForwardEventHistory) {
      levelCounts[event.level] += 1;
      typeCounts[event.type] += 1;
      const errorCode = event.errorCode?.trim();
      if (errorCode) {
        errorCodeCounts.set(errorCode, (errorCodeCounts.get(errorCode) ?? 0) + 1);
      }
      const correlation = event.correlationKey?.trim();
      if (correlation) {
        correlationCounts.set(correlation, (correlationCounts.get(correlation) ?? 0) + 1);
      }
      const timestampMs = new Date(event.createdAt).getTime();
      if (!Number.isFinite(timestampMs)) {
        continue;
      }
      if (earliestTimestampMs === null || timestampMs < earliestTimestampMs) {
        earliestTimestampMs = timestampMs;
      }
      if (latestTimestampMs === null || timestampMs > latestTimestampMs) {
        latestTimestampMs = timestampMs;
      }
    }
    const topErrorCodes = Array.from(errorCodeCounts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }
        return left.code.localeCompare(right.code);
      })
      .slice(0, 5);
    const topCorrelations = Array.from(correlationCounts.entries())
      .map(([correlationKey, count]) => ({ correlationKey, count }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }
        return left.correlationKey.localeCompare(right.correlationKey);
      })
      .slice(0, 5);
    const totalVisible = visiblePortForwardEventHistory.length;
    const totalErrors = levelCounts.error;
    const errorRatioPercent = totalVisible > 0 ? (totalErrors / totalVisible) * 100 : 0;
    return {
      totalVisible,
      totalErrors,
      errorRatioPercent,
      levelCounts,
      typeCounts,
      topErrorCodes,
      topCorrelations,
      earliestVisibleAt: earliestTimestampMs ? new Date(earliestTimestampMs).toISOString() : "",
      latestVisibleAt: latestTimestampMs ? new Date(latestTimestampMs).toISOString() : ""
    };
  }, [visiblePortForwardEventHistory]);
  const hasCustomizedPortForwardEventView =
    portForwardEventFilter !== DEFAULT_PORT_FORWARD_EVENT_VIEW_PREFERENCES.filter ||
    portForwardEventTimeRange !== DEFAULT_PORT_FORWARD_EVENT_VIEW_PREFERENCES.timeRange ||
    portForwardEventErrorCode !== DEFAULT_PORT_FORWARD_EVENT_VIEW_PREFERENCES.errorCode ||
    portForwardEventCorrelationQuery.trim().length > 0;
  const resetPortForwardEventViewFilters = useCallback(() => {
    setPortForwardEventFilter(DEFAULT_PORT_FORWARD_EVENT_VIEW_PREFERENCES.filter);
    setPortForwardEventTimeRange(DEFAULT_PORT_FORWARD_EVENT_VIEW_PREFERENCES.timeRange);
    setPortForwardEventErrorCode(DEFAULT_PORT_FORWARD_EVENT_VIEW_PREFERENCES.errorCode);
    setPortForwardEventCorrelationQuery(DEFAULT_PORT_FORWARD_EVENT_VIEW_PREFERENCES.correlationQuery);
  }, []);
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
  const captureDisconnectReport = useCallback(
    (payload: {
      tabId: string;
      trigger: "status" | "error";
      status?: TerminalConnectionStatus;
      message?: string;
    }) => {
      const tabId = payload.tabId.trim();
      if (!tabId) {
        return;
      }
      if (!disconnectReportCapturePreferencesRef.current.enabled) {
        return;
      }
      if (payload.trigger === "status" && payload.status === "connecting") {
        return;
      }
      const tab = terminalTabsRef.current.find((item) => item.id === tabId);
      if (!tab) {
        return;
      }
      const now = Date.now();
      const defaultMessage =
        payload.trigger === "error"
          ? "Terminal tab emitted an error."
          : payload.status === "closed"
            ? "Terminal tab closed."
            : "Terminal tab disconnected.";
      const normalizedMessage =
        typeof payload.message === "string" && payload.message.trim().length > 0
          ? payload.message.trim().slice(0, 500)
          : defaultMessage;
      const fingerprint = `${payload.trigger}|${payload.status ?? ""}|${normalizedMessage
        .toLowerCase()
        .slice(0, 220)}`;
      const previousFingerprint = disconnectReportFingerprintByTabRef.current.get(tabId);
      if (
        previousFingerprint &&
        previousFingerprint.fingerprint === fingerprint &&
        now - previousFingerprint.capturedAt < 5000
      ) {
        return;
      }
      disconnectReportFingerprintByTabRef.current.set(tabId, {
        fingerprint,
        capturedAt: now
      });
      const session =
        sessionsRef.current.find((item) => item.id === tab.sessionId) ?? null;
      const sessionName = session?.name.trim() || tab.title;
      const target = session
        ? `${session.username}@${session.host}:${session.port}`
        : `session:${tab.sessionId}`;
      let uploadRunning = 0;
      let uploadQueued = 0;
      let downloadRunning = 0;
      let downloadQueued = 0;
      for (const transfer of sftpTransfersRef.current) {
        if (transfer.tabId !== tabId) {
          continue;
        }
        if (transfer.status !== "queued" && transfer.status !== "running") {
          continue;
        }
        if (transfer.direction === "upload") {
          if (transfer.status === "running") {
            uploadRunning += 1;
          } else {
            uploadQueued += 1;
          }
        } else if (transfer.status === "running") {
          downloadRunning += 1;
        } else {
          downloadQueued += 1;
        }
      }
      const recentFailures = transferHistoryRef.current
        .filter((entry) => entry.sessionId === tab.sessionId && entry.status === "failed")
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 8)
        .map((entry) => ({
          direction: entry.direction,
          name: entry.name,
          message: (entry.message ?? "failed").slice(0, 400),
          updatedAt: entry.updatedAt
        }));
      const tabPortForwards = portForwardsRef.current.filter((entry) => entry.tabId === tabId);
      const portForwardDegraded = tabPortForwards.filter(
        (entry) => entry.status === "degraded"
      ).length;
      const activeTabId = activeTabIdRef.current;
      const reconnectPreferences = connectionPreferencesRef.current;
      const report: DisconnectReportItem = {
        id: createDisconnectReportId(),
        createdAt: new Date(now).toISOString(),
        tabId,
        tabTitle: tab.title,
        sessionId: tab.sessionId,
        sessionName,
        target,
        trigger: payload.trigger,
        status: payload.status,
        message: normalizedMessage,
        activeTabId,
        wasActiveTab: activeTabId === tabId,
        openTabCount: terminalTabsRef.current.length,
        connectedTabCount: connectedTabIdsRef.current.size,
        autoReconnect: reconnectPreferences.autoReconnect,
        reconnectDelaySeconds: reconnectPreferences.reconnectDelaySeconds,
        uploadRunning,
        uploadQueued,
        downloadRunning,
        downloadQueued,
        pausedUpload: !!pausedUploadTabsRef.current[tabId],
        pausedDownload: !!pausedDownloadTabsRef.current[tabId],
        portForwardTotal: tabPortForwards.length,
        portForwardDegraded,
        portForwardBusy: portForwardBusyRef.current,
        serverHealthLoading: serverHealthLoadingRef.current,
        serverProcessLoading: serverProcessLoadingRef.current,
        serverHealthError: serverHealthErrorRef.current ?? undefined,
        serverProcessError: serverProcessErrorRef.current ?? undefined,
        recentFailures
      };
      setDisconnectReports((prev) => [report, ...prev].slice(0, MAX_DISCONNECT_REPORT_HISTORY));
      writeAppLog("warn", "renderer:diagnostics", "Captured disconnect report.", {
        reportId: report.id,
        tabId: report.tabId,
        trigger: report.trigger,
        status: report.status,
        message: report.message,
        uploadRunning: report.uploadRunning,
        uploadQueued: report.uploadQueued,
        downloadRunning: report.downloadRunning,
        downloadQueued: report.downloadQueued,
        portForwardTotal: report.portForwardTotal,
        portForwardDegraded: report.portForwardDegraded
      });
    },
    [writeAppLog]
  );
  const showTransferDockNotice = useCallback(
    (tabId: string, level: TransferDockNotice["level"], message: string, durationMs = 6000) => {
      if (transferDockNoticeTimerRef.current !== null) {
        window.clearTimeout(transferDockNoticeTimerRef.current);
        transferDockNoticeTimerRef.current = null;
      }
      setTransferDockNotice({
        tabId,
        level,
        message
      });
      if (durationMs <= 0) {
        return;
      }
      transferDockNoticeTimerRef.current = window.setTimeout(() => {
        setTransferDockNotice((current) => {
          if (!current) {
            return null;
          }
          if (current.tabId !== tabId || current.message !== message) {
            return current;
          }
          return null;
        });
        transferDockNoticeTimerRef.current = null;
      }, durationMs);
    },
    []
  );
  const getSessionIdForTab = useCallback((tabId: string): string | null => {
    const normalizedTabId = tabId.trim();
    if (!normalizedTabId) {
      return null;
    }
    const tab = terminalTabsRef.current.find((item) => item.id === normalizedTabId);
    return tab?.sessionId ?? null;
  }, []);
  const collectPendingTransferRestoreSnapshot = useCallback((): PendingTransferRestoreItem[] => {
    const tabSessionIdMap = new Map<string, string>();
    for (const tab of terminalTabsRef.current) {
      tabSessionIdMap.set(tab.id, tab.sessionId);
    }
    const deduped = new Map<string, PendingTransferRestoreItem>();
    const appendItem = (
      sessionId: string,
      direction: SftpTransferEvent["direction"],
      localPath: string,
      remotePath: string,
      name: string
    ) => {
      const normalizedSessionId = sessionId.trim();
      const normalizedLocalPath = localPath.trim();
      const normalizedRemotePath = remotePath.trim();
      const normalizedName = name.trim();
      if (
        !normalizedSessionId ||
        !normalizedLocalPath ||
        !normalizedRemotePath ||
        !normalizedName
      ) {
        return;
      }
      const key = createTransferHistoryKey(
        normalizedSessionId,
        direction,
        normalizedLocalPath,
        normalizedRemotePath
      );
      if (deduped.has(key)) {
        return;
      }
      deduped.set(key, {
        key,
        sessionId: normalizedSessionId,
        direction,
        localPath: normalizedLocalPath,
        remotePath: normalizedRemotePath,
        name: normalizedName
      });
    };

    for (const job of uploadQueueRef.current) {
      const sessionId = tabSessionIdMap.get(job.tabId) ?? "";
      if (!sessionId) {
        continue;
      }
      appendItem(sessionId, "upload", job.localPath, job.remotePath, job.name);
    }
    for (const job of downloadQueueRef.current) {
      const sessionId = tabSessionIdMap.get(job.tabId) ?? "";
      if (!sessionId) {
        continue;
      }
      appendItem(sessionId, "download", job.localPath, job.remotePath, job.name);
    }
    for (const transfer of sftpTransfersRef.current) {
      if (transfer.status !== "queued" && transfer.status !== "running") {
        continue;
      }
      const sessionId =
        (typeof transfer.sessionId === "string" && transfer.sessionId.trim()) ||
        tabSessionIdMap.get(transfer.tabId) ||
        "";
      if (!sessionId) {
        continue;
      }
      appendItem(
        sessionId,
        transfer.direction,
        transfer.localPath,
        transfer.remotePath,
        transfer.name
      );
    }
    return Array.from(deduped.values()).slice(0, MAX_PENDING_TRANSFER_RESTORE_ITEMS);
  }, []);
  const rememberSessionTransferConflictStrategy = useCallback(
    (
      sessionId: string,
      direction: "upload" | "download",
      strategy: TransferConflictStrategy
    ): void => {
      const normalizedSessionId = sessionId.trim();
      if (!normalizedSessionId) {
        return;
      }
      setSessionTransferConflictStrategyState((prev) => {
        const current = prev.bySessionId[normalizedSessionId] ?? {};
        if (current[direction] === strategy) {
          return prev;
        }
        return {
          bySessionId: {
            ...prev.bySessionId,
            [normalizedSessionId]: {
              ...current,
              [direction]: strategy
            }
          }
        };
      });
    },
    []
  );
  const clearSessionTransferConflictStrategy = useCallback(
    (sessionId: string, direction?: "upload" | "download"): void => {
      const normalizedSessionId = sessionId.trim();
      if (!normalizedSessionId) {
        return;
      }
      setSessionTransferConflictStrategyState((prev) => {
        const current = prev.bySessionId[normalizedSessionId];
        if (!current) {
          return prev;
        }
        if (!direction) {
          const nextBySessionId = { ...prev.bySessionId };
          delete nextBySessionId[normalizedSessionId];
          return {
            bySessionId: nextBySessionId
          };
        }
        if (!current[direction]) {
          return prev;
        }
        const nextEntry = {
          ...current,
          [direction]: undefined
        };
        if (!nextEntry.upload && !nextEntry.download) {
          const nextBySessionId = { ...prev.bySessionId };
          delete nextBySessionId[normalizedSessionId];
          return {
            bySessionId: nextBySessionId
          };
        }
        return {
          bySessionId: {
            ...prev.bySessionId,
            [normalizedSessionId]: nextEntry
          }
        };
      });
    },
    []
  );
  useEffect(() => {
    return () => {
      if (transferDockNoticeTimerRef.current !== null) {
        window.clearTimeout(transferDockNoticeTimerRef.current);
        transferDockNoticeTimerRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    return () => {
      if (hotkeyConflictHighlightTimerRef.current !== null) {
        window.clearTimeout(hotkeyConflictHighlightTimerRef.current);
        hotkeyConflictHighlightTimerRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    if (hotkeyConflicts.length <= 0) {
      setHotkeyConflictCursorIndex(0);
      setHotkeyConflictCursorSignature(null);
      return;
    }
    if (hotkeyConflictCursorSignature) {
      const signatureIndex = hotkeyConflicts.findIndex(
        (conflict) => conflict.signature === hotkeyConflictCursorSignature
      );
      if (signatureIndex >= 0) {
        setHotkeyConflictCursorIndex(signatureIndex);
        return;
      }
    }
    setHotkeyConflictCursorIndex((prev) => Math.min(Math.max(prev, 0), hotkeyConflicts.length - 1));
  }, [hotkeyConflictCursorSignature, hotkeyConflicts]);
  useEffect(() => {
    if (hotkeyConflicts.length <= 0) {
      setHotkeyConflictCursorSignature(null);
      return;
    }
    const boundedIndex = Math.min(Math.max(hotkeyConflictCursorIndex, 0), hotkeyConflicts.length - 1);
    const nextSignature = hotkeyConflicts[boundedIndex]?.signature ?? null;
    setHotkeyConflictCursorSignature((prev) => (prev === nextSignature ? prev : nextSignature));
  }, [hotkeyConflictCursorIndex, hotkeyConflicts]);
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      if (hotkeyConflictCursorSignature) {
        window.localStorage.setItem(HOTKEY_CONFLICT_NAV_STORAGE_KEY, hotkeyConflictCursorSignature);
      } else {
        window.localStorage.removeItem(HOTKEY_CONFLICT_NAV_STORAGE_KEY);
      }
    } catch {
      // Ignore storage failures; runtime state still works for this launch.
    }
  }, [hotkeyConflictCursorSignature]);
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
  const clearAppHintMessage = useCallback(() => {
    if (appHintTimerRef.current !== null) {
      window.clearTimeout(appHintTimerRef.current);
      appHintTimerRef.current = null;
    }
    setAppHintMessage(null);
  }, []);
  const pushAppHintMessage = useCallback(
    (message: string, options?: { level?: "info" | "warn"; durationMs?: number }) => {
      const normalized = message.replace(/\s+/g, " ").trim();
      if (!normalized) {
        return;
      }
      const bounded =
        normalized.length > 220 ? `${normalized.slice(0, 217)}...` : normalized;
      if (appHintTimerRef.current !== null) {
        window.clearTimeout(appHintTimerRef.current);
        appHintTimerRef.current = null;
      }
      setAppHintMessage({
        level: options?.level ?? "info",
        message: bounded
      });
      const durationMs =
        typeof options?.durationMs === "number" && Number.isFinite(options.durationMs)
          ? Math.max(1200, Math.trunc(options.durationMs))
          : 3600;
      appHintTimerRef.current = window.setTimeout(() => {
        appHintTimerRef.current = null;
        setAppHintMessage(null);
      }, durationMs);
    },
    []
  );
  const showAppAlert = useCallback(
    async (message: string, options?: AppAlertDialogOptions): Promise<void> => {
      const title = (options?.title ?? "").trim();
      const hasDetailText = typeof options?.detailText === "string" && options.detailText.trim().length > 0;
      const summary = hasDetailText ? `${message} (details available)` : message;
      pushAppHintMessage(summary, {
        level: /error|fail|warning|warn/i.test(title) ? "warn" : "info",
        durationMs: hasDetailText ? 5600 : 3600
      });
    },
    [pushAppHintMessage]
  );
  const showAppConfirm = useCallback(
    async (message: string, options?: AppConfirmDialogOptions): Promise<boolean> => {
      const dialog: AppConfirmDialogState = {
        mode: "confirm",
        title: options?.title ?? "Confirm",
        message,
        confirmLabel: options?.confirmLabel ?? "Confirm",
        cancelLabel: options?.cancelLabel ?? "Cancel",
        danger: options?.danger,
        detailText: options?.detailText
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
  const addTerminalCommandHistoryEntry = useCallback(async () => {
    const input = await showAppPrompt("Enter command to add into history.", "", {
      title: "Add Command History Entry",
      confirmLabel: "Add"
    });
    if (input === null) {
      return;
    }
    if (!upsertTerminalCommandHistoryCommand(input)) {
      await showAppAlert("Command cannot be empty.", {
        title: "Add Command History Entry"
      });
    }
  }, [showAppAlert, showAppPrompt, upsertTerminalCommandHistoryCommand]);
  const editTerminalCommandHistoryEntry = useCallback(
    async (entry: TerminalCommandHistoryEntry) => {
      const input = await showAppPrompt("Edit command text.", entry.command, {
        title: "Edit Command History Entry",
        confirmLabel: "Save"
      });
      if (input === null) {
        return;
      }
      const normalizedInput = input.trim();
      if (!normalizedInput) {
        await showAppAlert("Command cannot be empty.", {
          title: "Edit Command History Entry"
        });
        return;
      }
      if (normalizedInput === entry.command.trim()) {
        return;
      }
      upsertTerminalCommandHistoryCommand(normalizedInput, {
        replaceEntryId: entry.id,
        preferredTabId: entry.tabId,
        preferredTabTitle: entry.tabTitle
      });
    },
    [showAppAlert, showAppPrompt, upsertTerminalCommandHistoryCommand]
  );
  const exportTerminalCommandHistory = useCallback(async () => {
    try {
      if (terminalCommandHistoryEntries.length === 0) {
        await showAppAlert("No command history entries available to export.", {
          title: "Export Command History"
        });
        return;
      }
      const generatedAtIso = new Date().toISOString();
      const payload = {
        exportedAtIso: generatedAtIso,
        appVersion: APP_VERSION,
        count: terminalCommandHistoryEntries.length,
        entries: terminalCommandHistoryEntries.map((entry) => ({
          command: entry.command,
          tabTitle: entry.tabTitle,
          tabId: entry.tabId,
          executedAt: entry.executedAt,
          executedAtIso: toIsoTimestamp(entry.executedAt)
        }))
      };
      const exportText = `${JSON.stringify(payload, null, 2)}\n`;
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Command History",
          defaultFileName: `termdock-command-history-${generatedAtIso.replace(/[:]/g, "-")}.json`,
          text: exportText,
          filters: [
            {
              name: "JSON",
              extensions: ["json"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `Command history exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `Command history exported:\n${result.outputPath}`,
            {
              title: "Export Command History"
            }
          );
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("Command history JSON copied to clipboard.", {
          title: "Export Command History"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the command history JSON manually.", {
        title: "Export Command History",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:command-history",
        "Failed to export command history.",
        caughtError
      );
    }
  }, [showAppAlert, systemApi, terminalCommandHistoryEntries, writeAppLog]);
  const importTerminalCommandHistory = useCallback(async () => {
    try {
      if (!systemApi?.pickAndReadTextFile) {
        throw new Error("System bridge unavailable. Restart `pnpm dev`.");
      }
      const selected = await systemApi.pickAndReadTextFile({
        title: "Import Command History",
        buttonLabel: "Import",
        filters: [
          {
            name: "JSON",
            extensions: ["json"]
          },
          {
            name: "Text",
            extensions: ["txt", "log"]
          },
          {
            name: "All Files",
            extensions: ["*"]
          }
        ]
      });
      if (selected.canceled || !selected.filePath) {
        return;
      }
      const rawText = typeof selected.text === "string" ? selected.text : "";
      if (!rawText.trim()) {
        await showAppAlert("Selected file is empty.", {
          title: "Import Command History"
        });
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch (caughtError) {
        await showAppAlert(`Invalid JSON format.\n${toLogMessage(caughtError)}`, {
          title: "Import Command History"
        });
        return;
      }
      const commands = parseImportedCommandHistoryCommands(parsed);
      if (commands.length === 0) {
        await showAppAlert(
          "No importable commands found.\nSupported formats: [\"cmd\"], { commands: [] }, { entries: [{ command }] }",
          {
            title: "Import Command History"
          }
        );
        return;
      }
      for (let index = commands.length - 1; index >= 0; index -= 1) {
        upsertTerminalCommandHistoryCommand(commands[index]);
      }
      await showAppAlert(
        `Imported ${commands.length} command(s) from:\n${selected.filePath}`,
        {
          title: "Import Command History"
        }
      );
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:command-history",
        "Failed to import command history.",
        caughtError
      );
    }
  }, [showAppAlert, systemApi, upsertTerminalCommandHistoryCommand, writeAppLog]);
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
      const generatedAtIso = new Date().toISOString();
      const lines: string[] = [];
      lines.push("# TermDock Port Forward Snapshot");
      lines.push(`Generated: ${generatedAtIso}`);
      lines.push(`AppVersion: ${APP_VERSION}`);
      lines.push(`Tab: ${activeTerminalTab.title}`);
      lines.push(`TabId: ${activeTabId}`);
      lines.push(`SessionId: ${activeSessionId ?? "-"}`);
      lines.push(`Status: ${isActiveTabConnected ? "connected" : "disconnected"}`);
      lines.push(`ForwardCount: ${portForwards.length}`);
      lines.push(`EventHistoryCount: ${activePortForwardEventHistory.length}`);
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
          const correlation = formatPortForwardEventCorrelation(event);
          lines.push(
            `- ${event.createdAt} [${event.level.toUpperCase()}] ${formatPortForwardEventType(event.type)} ${formatPortForwardEventSummary(event)}: ${event.message}${correlation ? ` | ${correlation}` : ""}`
          );
        }
      }
      const snapshotText = lines.join("\n");
      if (systemApi?.saveTextFile) {
        const baseName = toSafeFileNameSegment(activeTerminalTab.title);
        const result = await systemApi.saveTextFile({
          title: "Export Port Forward Snapshot",
          defaultFileName: `termdock-port-forward-snapshot-${baseName}-${generatedAtIso.replace(/[:]/g, "-")}.txt`,
          text: `${snapshotText}\n`,
          filters: [
            {
              name: "Text",
              extensions: ["txt"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `Port forwarding snapshot exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `Port forwarding snapshot exported:\n${result.outputPath}`,
            {
              title: "Port Forwarding Diagnostics"
            }
          );
        }
        return;
      }
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
    systemApi,
    writeAppLog
  ]);
  const exportVisiblePortForwardEventsJson = async (): Promise<void> => {
    try {
      const generatedAtIso = new Date().toISOString();
      const payload = {
        exportedAtIso: generatedAtIso,
        appVersion: APP_VERSION,
        sessionId: activeSessionId ?? "",
        tabId: activeTabId ?? "",
        filters: {
          eventType: portForwardEventFilter,
          timeRange: portForwardEventTimeRange,
          errorCode: portForwardEventErrorCode,
          correlation: portForwardEventCorrelationQuery.trim()
        },
        counts: {
          sessionHistory: activePortForwardEventHistory.length,
          visible: visiblePortForwardEventHistory.length,
          visibleErrors: portForwardVisibleEventAnalytics.totalErrors,
          visibleErrorRatioPercent: Number(
            portForwardVisibleEventAnalytics.errorRatioPercent.toFixed(2)
          )
        },
        analytics: {
          levelCounts: portForwardVisibleEventAnalytics.levelCounts,
          typeCounts: portForwardVisibleEventAnalytics.typeCounts,
          topErrorCodes: portForwardVisibleEventAnalytics.topErrorCodes,
          topCorrelations: portForwardVisibleEventAnalytics.topCorrelations
        },
        events: visiblePortForwardEventHistory.map((event) => ({
          id: event.id,
          createdAt: event.createdAt,
          level: event.level,
          type: event.type,
          summary: formatPortForwardEventSummary(event),
          message: event.message,
          correlationKey: event.correlationKey ?? "",
          connectionId: event.connectionId ?? "",
          sourceEndpoint: event.sourceEndpoint ?? "",
          targetEndpoint: event.targetEndpoint ?? "",
          errorCode: event.errorCode ?? "",
          forwardId: event.forwardId,
          tabId: event.tabId
        }))
      };
      const exportText = `${JSON.stringify(payload, null, 2)}\n`;
      const baseName = toSafeFileNameSegment(
        activeTerminalTab?.title || activeSessionId || "port-forward-events"
      );
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Port Forward Events (JSON)",
          defaultFileName: `termdock-port-forward-events-${baseName}-${generatedAtIso.replace(/[:]/g, "-")}.json`,
          text: exportText,
          filters: [
            {
              name: "JSON",
              extensions: ["json"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `Port forwarding events JSON exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `Port forwarding events JSON exported:\n${result.outputPath}`,
            {
              title: "Port Forwarding Events"
            }
          );
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("Port forwarding events JSON copied to clipboard.", {
          title: "Port Forwarding Events"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the JSON below manually.", {
        title: "Port Forwarding Events",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toPortForwardErrorMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:port-forwarding",
        "Failed to export visible port forwarding events JSON.",
        caughtError
      );
    }
  };
  const exportVisiblePortForwardEventsCsv = async (): Promise<void> => {
    try {
      const generatedAtIso = new Date().toISOString();
      const lines: string[] = [];
      lines.push("# TermDock Port Forward Event Export");
      lines.push("# Format: CSV");
      lines.push(`# Generated: ${generatedAtIso}`);
      lines.push(`# AppVersion: ${APP_VERSION}`);
      lines.push(
        `# Filters: type=${portForwardEventFilter}, timeRange=${portForwardEventTimeRange}, errorCode=${portForwardEventErrorCode}, correlation=${portForwardEventCorrelationQuery.trim() || "-"}`
      );
      lines.push(
        `# Counts: session=${activePortForwardEventHistory.length}, visible=${visiblePortForwardEventHistory.length}`
      );
      lines.push(
        `# VisibleErrorRatio: ${Number(portForwardVisibleEventAnalytics.errorRatioPercent.toFixed(2))}% (${portForwardVisibleEventAnalytics.totalErrors}/${portForwardVisibleEventAnalytics.totalVisible})`
      );
      lines.push("");
      lines.push(
        [
          "createdAt",
          "level",
          "type",
          "summary",
          "message",
          "correlationKey",
          "connectionId",
          "sourceEndpoint",
          "targetEndpoint",
          "errorCode",
          "forwardId",
          "tabId",
          "eventId"
        ].join(",")
      );
      for (const event of visiblePortForwardEventHistory) {
        lines.push(
          [
            event.createdAt,
            event.level,
            event.type,
            formatPortForwardEventSummary(event),
            event.message,
            event.correlationKey ?? "",
            event.connectionId ?? "",
            event.sourceEndpoint ?? "",
            event.targetEndpoint ?? "",
            event.errorCode ?? "",
            event.forwardId,
            event.tabId,
            event.id
          ]
            .map((value) => escapeCsvCell(value))
            .join(",")
        );
      }
      const exportText = `${lines.join("\n")}\n`;
      const baseName = toSafeFileNameSegment(
        activeTerminalTab?.title || activeSessionId || "port-forward-events"
      );
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Port Forward Events (CSV)",
          defaultFileName: `termdock-port-forward-events-${baseName}-${generatedAtIso.replace(/[:]/g, "-")}.csv`,
          text: exportText,
          filters: [
            {
              name: "CSV",
              extensions: ["csv"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `Port forwarding events CSV exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `Port forwarding events CSV exported:\n${result.outputPath}`,
            {
              title: "Port Forwarding Events"
            }
          );
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("Port forwarding events CSV copied to clipboard.", {
          title: "Port Forwarding Events"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the CSV below manually.", {
        title: "Port Forwarding Events",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toPortForwardErrorMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:port-forwarding",
        "Failed to export visible port forwarding events CSV.",
        caughtError
      );
    }
  };
  const exportPortForwardEventAnalyticsJson = async (): Promise<void> => {
    try {
      const generatedAtIso = new Date().toISOString();
      const payload = {
        exportedAtIso: generatedAtIso,
        appVersion: APP_VERSION,
        sessionId: activeSessionId ?? "",
        tabId: activeTabId ?? "",
        filters: {
          eventType: portForwardEventFilter,
          timeRange: portForwardEventTimeRange,
          errorCode: portForwardEventErrorCode,
          correlation: portForwardEventCorrelationQuery.trim()
        },
        counts: {
          sessionHistory: activePortForwardEventHistory.length,
          visible: visiblePortForwardEventHistory.length
        },
        analytics: {
          totalVisible: portForwardVisibleEventAnalytics.totalVisible,
          totalErrors: portForwardVisibleEventAnalytics.totalErrors,
          errorRatioPercent: Number(portForwardVisibleEventAnalytics.errorRatioPercent.toFixed(2)),
          levelCounts: portForwardVisibleEventAnalytics.levelCounts,
          typeCounts: portForwardVisibleEventAnalytics.typeCounts,
          topErrorCodes: portForwardVisibleEventAnalytics.topErrorCodes,
          topCorrelations: portForwardVisibleEventAnalytics.topCorrelations,
          earliestVisibleAt: portForwardVisibleEventAnalytics.earliestVisibleAt,
          latestVisibleAt: portForwardVisibleEventAnalytics.latestVisibleAt
        },
        samples: {
          latestVisibleEvents: visiblePortForwardEventHistory.slice(0, 40).map((event) => ({
            id: event.id,
            createdAt: event.createdAt,
            level: event.level,
            type: event.type,
            summary: formatPortForwardEventSummary(event),
            message: event.message,
            correlationKey: event.correlationKey ?? "",
            connectionId: event.connectionId ?? "",
            sourceEndpoint: event.sourceEndpoint ?? "",
            targetEndpoint: event.targetEndpoint ?? "",
            errorCode: event.errorCode ?? "",
            forwardId: event.forwardId,
            tabId: event.tabId
          }))
        }
      };
      const exportText = `${JSON.stringify(payload, null, 2)}\n`;
      const baseName = toSafeFileNameSegment(
        activeTerminalTab?.title || activeSessionId || "port-forward-event-analytics"
      );
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Port Forward Analytics (JSON)",
          defaultFileName: `termdock-port-forward-event-analytics-${baseName}-${generatedAtIso.replace(/[:]/g, "-")}.json`,
          text: exportText,
          filters: [
            {
              name: "JSON",
              extensions: ["json"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `Port forwarding analytics JSON exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `Port forwarding analytics JSON exported:\n${result.outputPath}`,
            {
              title: "Port Forwarding Events"
            }
          );
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("Port forwarding analytics JSON copied to clipboard.", {
          title: "Port Forwarding Events"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the analytics JSON below manually.", {
        title: "Port Forwarding Events",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toPortForwardErrorMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:port-forwarding",
        "Failed to export port forwarding analytics JSON.",
        caughtError
      );
    }
  };
  const exportPortForwardEventAnalyticsCsv = async (): Promise<void> => {
    try {
      const generatedAtIso = new Date().toISOString();
      const lines: string[] = [];
      lines.push("# TermDock Port Forward Event Analytics Export");
      lines.push("# Format: CSV");
      lines.push(`# Generated: ${generatedAtIso}`);
      lines.push(`# AppVersion: ${APP_VERSION}`);
      lines.push(
        `# Filters: type=${portForwardEventFilter}, timeRange=${portForwardEventTimeRange}, errorCode=${portForwardEventErrorCode}, correlation=${portForwardEventCorrelationQuery.trim() || "-"}`
      );
      lines.push(
        `# Counts: session=${activePortForwardEventHistory.length}, visible=${visiblePortForwardEventHistory.length}`
      );
      lines.push("");
      lines.push("metric,value");
      lines.push(
        `totalVisible,${escapeCsvCell(portForwardVisibleEventAnalytics.totalVisible)}`
      );
      lines.push(`totalErrors,${escapeCsvCell(portForwardVisibleEventAnalytics.totalErrors)}`);
      lines.push(
        `errorRatioPercent,${escapeCsvCell(
          Number(portForwardVisibleEventAnalytics.errorRatioPercent.toFixed(2))
        )}`
      );
      lines.push(
        `earliestVisibleAt,${escapeCsvCell(portForwardVisibleEventAnalytics.earliestVisibleAt || "-")}`
      );
      lines.push(
        `latestVisibleAt,${escapeCsvCell(portForwardVisibleEventAnalytics.latestVisibleAt || "-")}`
      );
      lines.push("");
      lines.push("level,count");
      lines.push(`info,${escapeCsvCell(portForwardVisibleEventAnalytics.levelCounts.info)}`);
      lines.push(`error,${escapeCsvCell(portForwardVisibleEventAnalytics.levelCounts.error)}`);
      lines.push("");
      lines.push("type,count");
      lines.push(`created,${escapeCsvCell(portForwardVisibleEventAnalytics.typeCounts.created)}`);
      lines.push(`removed,${escapeCsvCell(portForwardVisibleEventAnalytics.typeCounts.removed)}`);
      lines.push(
        `statusDegraded,${escapeCsvCell(portForwardVisibleEventAnalytics.typeCounts.statusDegraded)}`
      );
      lines.push(
        `statusRecovered,${escapeCsvCell(portForwardVisibleEventAnalytics.typeCounts.statusRecovered)}`
      );
      lines.push("");
      lines.push("topErrorCode,count");
      if (portForwardVisibleEventAnalytics.topErrorCodes.length === 0) {
        lines.push([ "-", 0 ].map((value) => escapeCsvCell(value)).join(","));
      } else {
        for (const entry of portForwardVisibleEventAnalytics.topErrorCodes) {
          lines.push([entry.code, entry.count].map((value) => escapeCsvCell(value)).join(","));
        }
      }
      lines.push("");
      lines.push("topCorrelationKey,count");
      if (portForwardVisibleEventAnalytics.topCorrelations.length === 0) {
        lines.push([ "-", 0 ].map((value) => escapeCsvCell(value)).join(","));
      } else {
        for (const entry of portForwardVisibleEventAnalytics.topCorrelations) {
          lines.push(
            [entry.correlationKey, entry.count]
              .map((value) => escapeCsvCell(value))
              .join(",")
          );
        }
      }
      const exportText = `${lines.join("\n")}\n`;
      const baseName = toSafeFileNameSegment(
        activeTerminalTab?.title || activeSessionId || "port-forward-event-analytics"
      );
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Port Forward Analytics (CSV)",
          defaultFileName: `termdock-port-forward-event-analytics-${baseName}-${generatedAtIso.replace(/[:]/g, "-")}.csv`,
          text: exportText,
          filters: [
            {
              name: "CSV",
              extensions: ["csv"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `Port forwarding analytics CSV exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `Port forwarding analytics CSV exported:\n${result.outputPath}`,
            {
              title: "Port Forwarding Events"
            }
          );
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("Port forwarding analytics CSV copied to clipboard.", {
          title: "Port Forwarding Events"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the analytics CSV below manually.", {
        title: "Port Forwarding Events",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toPortForwardErrorMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:port-forwarding",
        "Failed to export port forwarding analytics CSV.",
        caughtError
      );
    }
  };
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
        detailText: options?.detailText,
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
  useEffect(() => {
    return () => {
      if (appHintTimerRef.current !== null) {
        window.clearTimeout(appHintTimerRef.current);
        appHintTimerRef.current = null;
      }
    };
  }, []);
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
  const buildBatchFailureDetailText = useCallback(
    (
      tabId: string,
      batchId: string,
      direction: "upload" | "download",
      totalFailed: number
    ): string | undefined => {
      if (totalFailed <= 0) {
        return undefined;
      }
      const failedItems = sftpTransfers
        .filter(
          (transfer) =>
            transfer.tabId === tabId &&
            transfer.direction === direction &&
            transfer.batchId === batchId &&
            transfer.status === "failed"
        )
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 12);
      if (failedItems.length === 0) {
        return undefined;
      }
      const lines = failedItems.map((item, index) => {
        const route =
          direction === "upload"
            ? `${item.localPath} -> ${item.remotePath}`
            : `${item.remotePath} -> ${item.localPath}`;
        const message = item.message?.trim() || "failed";
        return `${index + 1}. ${item.name} | ${route} | ${message}`;
      });
      const remaining = Math.max(0, totalFailed - failedItems.length);
      const remainingHint =
        remaining > 0 ? `\n... ${remaining} more failed item(s) not shown.` : "";
      return `Failed items (${failedItems.length}/${totalFailed} shown):\n${lines.join("\n")}${remainingHint}`;
    },
    [sftpTransfers]
  );
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
  const failedRetryCandidateTotal =
    failedUploadRetryCandidates.length + failedDownloadRetryCandidates.length;
  const canRetryAllFailedTransfers = !!activeTabId && failedRetryCandidateTotal > 0;
  const operationCenterTransferTabSummaries = useMemo(() => {
    const byTabId = new Map<
      string,
      {
        tabId: string;
        title: string;
        connected: boolean;
        uploadRunning: number;
        uploadQueued: number;
        downloadRunning: number;
        downloadQueued: number;
        totalActive: number;
      }
    >();
    for (const tab of terminalTabs) {
      byTabId.set(tab.id, {
        tabId: tab.id,
        title: tab.title,
        connected: connectedTabIdsRef.current.has(tab.id),
        uploadRunning: 0,
        uploadQueued: 0,
        downloadRunning: 0,
        downloadQueued: 0,
        totalActive: 0
      });
    }
    for (const transfer of sftpTransfers) {
      if (transfer.status !== "queued" && transfer.status !== "running") {
        continue;
      }
      const current = byTabId.get(transfer.tabId) ?? {
        tabId: transfer.tabId,
        title: transfer.tabId,
        connected: connectedTabIdsRef.current.has(transfer.tabId),
        uploadRunning: 0,
        uploadQueued: 0,
        downloadRunning: 0,
        downloadQueued: 0,
        totalActive: 0
      };
      if (transfer.direction === "upload") {
        if (transfer.status === "running") {
          current.uploadRunning += 1;
        } else {
          current.uploadQueued += 1;
        }
      } else if (transfer.status === "running") {
        current.downloadRunning += 1;
      } else {
        current.downloadQueued += 1;
      }
      byTabId.set(transfer.tabId, current);
    }
    const summaries = Array.from(byTabId.values())
      .map((entry) => ({
        ...entry,
        totalActive:
          entry.uploadRunning +
          entry.uploadQueued +
          entry.downloadRunning +
          entry.downloadQueued
      }))
      .filter((entry) => entry.totalActive > 0)
      .sort((left, right) => {
        if (right.totalActive !== left.totalActive) {
          return right.totalActive - left.totalActive;
        }
        return left.title.localeCompare(right.title);
      })
      .slice(0, 12);
    return summaries;
  }, [sftpTransfers, terminalTabs]);
  const operationCenterActiveCount =
    operationCenterTransferTabSummaries.length +
    (sftpDeleteProgress ? 1 : 0) +
    (portForwardBusy ? 1 : 0);
  const hasOperationCenterActivity = operationCenterActiveCount > 0;
  const retryCenterSessionMetaById = useMemo(() => {
    const map = new Map<string, { sessionName: string; groupName: string }>();
    for (const session of sessions) {
      map.set(session.id, {
        sessionName: session.name.trim() || session.id,
        groupName: session.groupId?.trim() || "Ungrouped"
      });
    }
    return map;
  }, [sessions]);
  const retryCenterEntriesWithoutFailureReasonFilter = useMemo(() => {
    const normalizedQuery = retryCenterQuery.trim().toLowerCase();
    const cutoffMs = resolveTransferHistoryTimeRangeCutoff(retryCenterTimeRange, Date.now());
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
      if (cutoffMs !== null && entry.updatedAt < cutoffMs) {
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
    retryCenterTimeRange,
    transferHistory
  ]);
  const retryCenterFailureReasonOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of retryCenterEntriesWithoutFailureReasonFilter) {
      if (entry.status !== "failed") {
        continue;
      }
      const reason = classifyTransferFailureReason(entry.message);
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([reason, total]) => ({ reason, total }))
      .sort((left, right) => {
        if (right.total !== left.total) {
          return right.total - left.total;
        }
        return left.reason.localeCompare(right.reason);
      })
      .slice(0, 24);
  }, [retryCenterEntriesWithoutFailureReasonFilter]);
  const retryCenterResolvedFailureReasonFilter = useMemo(() => {
    if (retryCenterFailureReasonFilter === RETRY_CENTER_FAILURE_REASON_ALL) {
      return RETRY_CENTER_FAILURE_REASON_ALL;
    }
    return retryCenterFailureReasonOptions.some(
      (entry) => entry.reason === retryCenterFailureReasonFilter
    )
      ? retryCenterFailureReasonFilter
      : RETRY_CENTER_FAILURE_REASON_ALL;
  }, [retryCenterFailureReasonFilter, retryCenterFailureReasonOptions]);
  const retryCenterEntries = useMemo(() => {
    if (retryCenterResolvedFailureReasonFilter === RETRY_CENTER_FAILURE_REASON_ALL) {
      return retryCenterEntriesWithoutFailureReasonFilter;
    }
    return retryCenterEntriesWithoutFailureReasonFilter.filter(
      (entry) =>
        entry.status === "failed" &&
        classifyTransferFailureReason(entry.message) === retryCenterResolvedFailureReasonFilter
    );
  }, [retryCenterEntriesWithoutFailureReasonFilter, retryCenterResolvedFailureReasonFilter]);
  const retryCenterGroupedEntries = useMemo(() => {
    const grouped = new Map<
      string,
      {
        key: string;
        label: string;
        failureReason: string | null;
        order: number;
        total: number;
        failedCount: number;
        activeSessionFailedCount: number;
        latestUpdatedAt: number;
        entries: SftpTransferHistoryItem[];
      }
    >();
    for (const entry of retryCenterEntries) {
      const groupReason =
        entry.status === "failed"
          ? classifyTransferFailureReason(entry.message)
          : `Status: ${entry.status}`;
      const groupKey = entry.status === "failed" ? `failed:${groupReason}` : `status:${entry.status}`;
      const groupLabel = entry.status === "failed" ? `Failed: ${groupReason}` : groupReason;
      const current = grouped.get(groupKey);
      if (!current) {
        grouped.set(groupKey, {
          key: groupKey,
          label: groupLabel,
          failureReason: entry.status === "failed" ? groupReason : null,
          order: entry.status === "failed" ? 0 : 1,
          total: 1,
          failedCount: entry.status === "failed" ? 1 : 0,
          activeSessionFailedCount:
            entry.status === "failed" && !!activeSessionId && entry.sessionId === activeSessionId
              ? 1
              : 0,
          latestUpdatedAt: entry.updatedAt,
          entries: [entry]
        });
        continue;
      }
      current.total += 1;
      current.latestUpdatedAt = Math.max(current.latestUpdatedAt, entry.updatedAt);
      if (entry.status === "failed") {
        current.failedCount += 1;
        if (activeSessionId && entry.sessionId === activeSessionId) {
          current.activeSessionFailedCount += 1;
        }
      }
      current.entries.push(entry);
    }
    return Array.from(grouped.values()).sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }
      if (right.total !== left.total) {
        return right.total - left.total;
      }
      if (right.latestUpdatedAt !== left.latestUpdatedAt) {
        return right.latestUpdatedAt - left.latestUpdatedAt;
      }
      return left.label.localeCompare(right.label);
    });
  }, [activeSessionId, retryCenterEntries]);
  const retryCenterCollapsedGroupKeySet = useMemo(
    () => new Set(retryCenterCollapsedGroupKeys),
    [retryCenterCollapsedGroupKeys]
  );
  const isRetryCenterGroupedView = retryCenterListMode === "groupedByReason";
  const retryCenterAnalytics = useMemo(() => {
    const statusCounts: Record<SftpTransferEvent["status"], number> = {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      canceled: 0
    };
    const directionCounts: Record<SftpTransferEvent["direction"], number> = {
      upload: 0,
      download: 0
    };
    const sessionCounts = new Map<
      string,
      {
        sessionId: string;
        sessionName: string;
        groupName: string;
        total: number;
        failed: number;
      }
    >();
    const groupCounts = new Map<string, number>();
    const failureReasonCounts = new Map<string, number>();
    for (const entry of retryCenterEntries) {
      directionCounts[entry.direction] += 1;
      statusCounts[entry.status] += 1;
      const sessionMeta = retryCenterSessionMetaById.get(entry.sessionId);
      const sessionName = sessionMeta?.sessionName ?? entry.sessionId;
      const groupName = sessionMeta?.groupName ?? "Unknown";
      const currentSessionCount = sessionCounts.get(entry.sessionId);
      if (!currentSessionCount) {
        sessionCounts.set(entry.sessionId, {
          sessionId: entry.sessionId,
          sessionName,
          groupName,
          total: 1,
          failed: entry.status === "failed" ? 1 : 0
        });
      } else {
        currentSessionCount.total += 1;
        if (entry.status === "failed") {
          currentSessionCount.failed += 1;
        }
      }
      if (entry.status === "failed") {
        const failureReason = classifyTransferFailureReason(entry.message);
        failureReasonCounts.set(failureReason, (failureReasonCounts.get(failureReason) ?? 0) + 1);
      }
      groupCounts.set(groupName, (groupCounts.get(groupName) ?? 0) + 1);
    }
    const totalCount = retryCenterEntries.length;
    const failedCount = statusCounts.failed;
    const failedRatioPercent = totalCount > 0 ? (failedCount / totalCount) * 100 : 0;
    const topSessions = Array.from(sessionCounts.values())
      .sort((left, right) => {
        if (right.total !== left.total) {
          return right.total - left.total;
        }
        if (right.failed !== left.failed) {
          return right.failed - left.failed;
        }
        return left.sessionName.localeCompare(right.sessionName);
      })
      .slice(0, 3);
    const topGroups = Array.from(groupCounts.entries())
      .map(([groupName, total]) => ({ groupName, total }))
      .sort((left, right) => {
        if (right.total !== left.total) {
          return right.total - left.total;
        }
        return left.groupName.localeCompare(right.groupName);
      })
      .slice(0, 3);
    const topFailureReasons = Array.from(failureReasonCounts.entries())
      .map(([reason, total]) => ({
        reason,
        total
      }))
      .sort((left, right) => {
        if (right.total !== left.total) {
          return right.total - left.total;
        }
        return left.reason.localeCompare(right.reason);
      })
      .slice(0, 5);
    return {
      totalCount,
      failedCount,
      failedRatioPercent,
      directionCounts,
      statusCounts,
      topSessions,
      topGroups,
      topFailureReasons
    };
  }, [retryCenterEntries, retryCenterSessionMetaById]);
  const retryCenterVisibleExportEntries = useMemo(
    () =>
      retryCenterEntries.map((entry) => {
        const sessionMeta = retryCenterSessionMetaById.get(entry.sessionId);
        return {
          key: entry.key,
          sessionId: entry.sessionId,
          sessionName: sessionMeta?.sessionName ?? entry.sessionId,
          groupName: sessionMeta?.groupName ?? "Unknown",
          direction: entry.direction,
          status: entry.status,
          name: entry.name,
          localPath: entry.localPath,
          remotePath: entry.remotePath,
          attemptCount: entry.attemptCount,
          updatedAt: entry.updatedAt,
          updatedAtIso: toIsoTimestamp(entry.updatedAt),
          message: entry.message ?? ""
        };
      }),
    [retryCenterEntries, retryCenterSessionMetaById]
  );
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
  const visibleRetryCenterFailedEntries = useMemo(
    () =>
      retryCenterEntries.filter(
        (entry) =>
          entry.status === "failed" && !!activeSessionId && entry.sessionId === activeSessionId
      ),
    [activeSessionId, retryCenterEntries]
  );
  const visibleRetryCenterFailedReasonCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of visibleRetryCenterFailedEntries) {
      const reason = classifyTransferFailureReason(entry.message);
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
    return counts;
  }, [visibleRetryCenterFailedEntries]);
  const retryCenterTopFailureReasonRetryRows = useMemo(
    () =>
      retryCenterAnalytics.topFailureReasons.map((entry) => ({
        reason: entry.reason,
        totalVisible: entry.total,
        activeSessionVisibleFailed: visibleRetryCenterFailedReasonCounts.get(entry.reason) ?? 0,
        isCurrentFilter:
          retryCenterResolvedFailureReasonFilter !== RETRY_CENTER_FAILURE_REASON_ALL &&
          retryCenterResolvedFailureReasonFilter === entry.reason
      })),
    [
      retryCenterAnalytics.topFailureReasons,
      retryCenterResolvedFailureReasonFilter,
      visibleRetryCenterFailedReasonCounts
    ]
  );
  const retryCenterFailureSuggestionRows = useMemo(
    () =>
      retryCenterTopFailureReasonRetryRows
        .map((entry) => ({
          reason: entry.reason,
          suggestion: getTransferFailureSuggestion(entry.reason)
        }))
        .filter(
          (entry): entry is { reason: string; suggestion: string } =>
            typeof entry.suggestion === "string" && entry.suggestion.length > 0
        ),
    [retryCenterTopFailureReasonRetryRows]
  );
  const canRetrySelectedRetryCenterEntries =
    !!activeTabId && selectedRetryCenterFailedEntries.length > 0;
  const canRetryVisibleRetryCenterEntries = !!activeTabId && visibleRetryCenterFailedEntries.length > 0;
  const canClearSelectedRetryCenterEntries = selectedRetryCenterEntries.length > 0;
  const canClearVisibleRetryCenterEntries = retryCenterEntries.length > 0;
  const canClearAllRetryCenterEntries = transferHistory.length > 0;
  const canExportRetryCenterAnalytics = transferHistory.length > 0;
  const retryCenterSelectedFailureReasonLabel =
    retryCenterResolvedFailureReasonFilter === RETRY_CENTER_FAILURE_REASON_ALL
      ? "All"
      : retryCenterResolvedFailureReasonFilter;
  const retryCenterFailureReasonExportValue =
    retryCenterResolvedFailureReasonFilter === RETRY_CENTER_FAILURE_REASON_ALL
      ? "all"
      : retryCenterResolvedFailureReasonFilter;
  const retryCenterLastRetryScopeLabel =
    retryCenterLastRetryScope === "upload"
      ? "Upload Only"
      : retryCenterLastRetryScope === "download"
        ? "Download Only"
        : "All Retryable";
  const hasCustomizedRetryCenterView =
    retryCenterScope !== DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.scope ||
    retryCenterDirection !== DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.direction ||
    retryCenterStatus !== DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.status ||
    retryCenterTimeRange !== DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.timeRange ||
    retryCenterListMode !== DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.listMode ||
    retryCenterResolvedFailureReasonFilter !== DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.failureReason ||
    retryCenterLastRetryScope !== DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.lastRetryScope ||
    retryCenterAutoUseLastRetryScope !==
      DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.autoUseLastRetryScope ||
    retryBatchConfirmThreshold !==
      DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.retryBatchConfirmThreshold ||
    retryCenterQuery.trim().length > 0;
  const resetRetryCenterViewFilters = useCallback(() => {
    setRetryCenterScope(DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.scope);
    setRetryCenterDirection(DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.direction);
    setRetryCenterStatus(DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.status);
    setRetryCenterTimeRange(DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.timeRange);
    setRetryCenterListMode(DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.listMode);
    setRetryCenterFailureReasonFilter(DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.failureReason);
    setRetryCenterLastRetryScope(DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.lastRetryScope);
    setRetryCenterAutoUseLastRetryScope(
      DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.autoUseLastRetryScope
    );
    setRetryBatchConfirmThreshold(
      DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.retryBatchConfirmThreshold
    );
    setRetryCenterQuery(DEFAULT_RETRY_CENTER_VIEW_PREFERENCES.query);
    setRetryCenterCollapsedGroupKeys([]);
  }, []);
  const toggleRetryCenterGroupCollapsed = useCallback((groupKey: string) => {
    const normalized = groupKey.trim();
    if (!normalized) {
      return;
    }
    setRetryCenterCollapsedGroupKeys((prev) => {
      if (prev.includes(normalized)) {
        return prev.filter((key) => key !== normalized);
      }
      return [...prev, normalized];
    });
  }, []);
  const collapseAllRetryCenterGroups = useCallback(() => {
    setRetryCenterCollapsedGroupKeys(retryCenterGroupedEntries.map((entry) => entry.key));
  }, [retryCenterGroupedEntries]);
  const expandAllRetryCenterGroups = useCallback(() => {
    setRetryCenterCollapsedGroupKeys([]);
  }, []);
  const canCollapseAllRetryCenterGroups =
    retryCenterGroupedEntries.length > 0 &&
    retryCenterGroupedEntries.some((entry) => !retryCenterCollapsedGroupKeySet.has(entry.key));
  const canExpandAllRetryCenterGroups =
    retryCenterGroupedEntries.length > 0 &&
    retryCenterGroupedEntries.some((entry) => retryCenterCollapsedGroupKeySet.has(entry.key));
  const selectRetryCenterGroupEntries = useCallback(
    (groupKey: string) => {
      const targetGroup = retryCenterGroupedEntries.find((entry) => entry.key === groupKey);
      if (!targetGroup || targetGroup.entries.length === 0) {
        return;
      }
      const targetKeys = new Set(targetGroup.entries.map((entry) => entry.key));
      setRetryCenterSelection((prev) => {
        const next = [...prev];
        for (const key of targetKeys) {
          if (!next.includes(key)) {
            next.push(key);
          }
        }
        return next;
      });
    },
    [retryCenterGroupedEntries]
  );
  const getRetryCenterGroupEntriesForRetryScope = useCallback(
    (
      group: (typeof retryCenterGroupedEntries)[number],
      retryScope: RetryCenterRetryScope
    ): SftpTransferHistoryItem[] => {
      if (!activeSessionId) {
        return [];
      }
      const retryableEntries = group.entries.filter(
        (entry) => entry.status === "failed" && entry.sessionId === activeSessionId
      );
      if (retryScope === "upload") {
        return retryableEntries.filter((entry) => entry.direction === "upload");
      }
      if (retryScope === "download") {
        return retryableEntries.filter((entry) => entry.direction === "download");
      }
      return retryableEntries;
    },
    [activeSessionId]
  );
  const chooseRetryCenterGroupRetryScope = async (
    group: (typeof retryCenterGroupedEntries)[number]
  ): Promise<RetryCenterRetryScope | null> => {
    const retryableEntries = getRetryCenterGroupEntriesForRetryScope(group, "all");
    if (retryableEntries.length === 0) {
      await showAppAlert("No active-session failed records can be retried for this group.", {
        title: "Retry Center"
      });
      return null;
    }
    return chooseRetryCenterRetryScope(
      retryableEntries,
      `Choose retry scope for "${group.label}".`
    );
  };
  const retryRetryCenterGroupFailedEntries = async (groupKey: string) => {
    if (!activeTabId || !activeSessionId) {
      await showAppAlert("Open a terminal tab for the target session first.", {
        title: "Retry Center"
      });
      return;
    }
    const targetGroup = retryCenterGroupedEntries.find((entry) => entry.key === groupKey);
    if (!targetGroup) {
      return;
    }
    const retryScope = await chooseRetryCenterGroupRetryScope(targetGroup);
    if (!retryScope) {
      return;
    }
    const targetEntries = getRetryCenterGroupEntriesForRetryScope(targetGroup, retryScope);
    if (targetEntries.length === 0) {
      await showAppAlert("No transfer tasks were requeued.", {
        title: "Retry Center"
      });
      return;
    }
    const confirmed = await confirmRetryBatchIfNeeded(
      targetEntries.length,
      `group "${targetGroup.label}"`
    );
    if (!confirmed) {
      return;
    }
    const tabId = activeTabId;
    const targetKeys = new Set(targetEntries.map((entry) => entry.key));
    const uploadTargetMap = new Map<
      string,
      { name: string; localPath: string; remotePath: string }
    >();
    const downloadTargetMap = new Map<
      string,
      { name: string; localPath: string; remotePath: string }
    >();
    for (const entry of targetEntries) {
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
        })),
        {
          tabId,
          sessionId: activeSessionId
        }
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

    setRetryCenterSelection((prev) => prev.filter((key) => !targetKeys.has(key)));
    const scopeLabel =
      retryScope === "upload"
        ? "upload-only"
        : retryScope === "download"
          ? "download-only"
          : "all retryable";
    await showAppAlert(
      `Requeued ${queuedCount} failed transfer task(s) from group "${targetGroup.label}" (${scopeLabel}).`,
      {
        title: "Retry Center"
      }
    );
  };
  const clearRetryCenterGroupEntries = async (groupKey: string) => {
    const targetGroup = retryCenterGroupedEntries.find((entry) => entry.key === groupKey);
    if (!targetGroup || targetGroup.entries.length === 0) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Delete ${targetGroup.total} visible history record(s) in group "${targetGroup.label}"?`,
      {
        title: "Retry Center",
        confirmLabel: "Delete Group",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    const targetKeys = new Set(targetGroup.entries.map((entry) => entry.key));
    setTransferHistory((prev) => prev.filter((entry) => !targetKeys.has(entry.key)));
    setRetryCenterSelection((prev) => prev.filter((key) => !targetKeys.has(key)));
  };
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

  const resetEnsuredRemoteDirectoryCacheForTab = useCallback((tabId: string) => {
    ensuredRemoteDirectoriesRef.current.delete(tabId);
    ensuringRemoteDirectoriesRef.current.delete(tabId);
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
      const inFlightByPath =
        ensuringRemoteDirectoriesRef.current.get(tabId) ?? new Map<string, Promise<void>>();
      ensuringRemoteDirectoriesRef.current.set(tabId, inFlightByPath);

      const isAbsolute = normalized.startsWith("/");
      const segments = normalized.split("/").filter(Boolean);
      let currentPath = isAbsolute ? "/" : ".";
      for (const segment of segments) {
        const nextPath = joinRemotePath(currentPath, segment);
        if (cache.has(nextPath)) {
          currentPath = nextPath;
          continue;
        }
        const inFlight = inFlightByPath.get(nextPath);
        if (inFlight) {
          await inFlight;
          currentPath = nextPath;
          continue;
        }
        const ensureTask = (async () => {
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
        })().finally(() => {
          inFlightByPath.delete(nextPath);
        });
        inFlightByPath.set(nextPath, ensureTask);
        await ensureTask;
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
            if (isTransferCanceledMessage(message)) {
              return;
            }
            if (isRemotePathMissingError(message)) {
              const retryCount = nextJob.missingDirectoryRetryCount ?? 0;
              if (retryCount < 1) {
                resetEnsuredRemoteDirectoryCacheForTab(nextJob.tabId);
                uploadQueueRef.current.unshift({
                  ...nextJob,
                  missingDirectoryRetryCount: retryCount + 1
                });
                writeAppLog(
                  "warn",
                  "renderer:sftp-transfer",
                  "Upload hit missing remote path. Cleared ensured-directory cache and requeued once.",
                  {
                    tabId: nextJob.tabId,
                    transferId: nextJob.transferId,
                    remoteDirectory: nextJob.remoteDirectory,
                    remotePath: nextJob.remotePath
                  }
                );
                return;
              }
            }
            if (isTabNotConnectedError(message)) {
              connectedTabIdsRef.current.delete(nextJob.tabId);
              setPausedUploadTabs((prev) => {
                if (prev[nextJob.tabId]) {
                  return prev;
                }
                return {
                  ...prev,
                  [nextJob.tabId]: true
                };
              });
              uploadQueueRef.current.unshift(nextJob);
              setSftpError("Terminal tab disconnected. Reconnect to resume queued uploads.");
              return;
            }
            setPausedUploadTabs((prev) => {
              if (!prev[nextJob.tabId]) {
                return prev;
              }
              const next = { ...prev };
              delete next[nextJob.tabId];
              return next;
            });
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
    resetEnsuredRemoteDirectoryCacheForTab,
    sftpApi,
    sftpTransferPreferences.uploadConcurrency,
    writeAppLog
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
            if (isTransferCanceledMessage(message)) {
              return;
            }
            if (isTabNotConnectedError(message)) {
              connectedTabIdsRef.current.delete(nextJob.tabId);
              setPausedDownloadTabs((prev) => {
                if (prev[nextJob.tabId]) {
                  return prev;
                }
                return {
                  ...prev,
                  [nextJob.tabId]: true
                };
              });
              downloadQueueRef.current.unshift(nextJob);
              setSftpError("Terminal tab disconnected. Reconnect to resume queued downloads.");
              return;
            }
            setPausedDownloadTabs((prev) => {
              if (!prev[nextJob.tabId]) {
                return prev;
              }
              const next = { ...prev };
              delete next[nextJob.tabId];
              return next;
            });
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

  const closeCommandHistoryContextMenu = useCallback(() => {
    setCommandHistoryContextMenu(null);
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

  const openCommandHistoryContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>, entryId: string) => {
      event.preventDefault();
      event.stopPropagation();
      setCommandHistoryContextMenu({
        x: event.clientX,
        y: event.clientY,
        entryId
      });
    },
    []
  );

  const openCommandHistoryPanelContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".command-history-panel__item")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setCommandHistoryContextMenu({
        x: event.clientX,
        y: event.clientY,
        entryId: null
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
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    terminalTabsRef.current = terminalTabs;
  }, [terminalTabs]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    sftpTransfersRef.current = sftpTransfers;
  }, [sftpTransfers]);

  useEffect(() => {
    transferHistoryRef.current = transferHistory;
  }, [transferHistory]);

  useEffect(() => {
    const snapshot = collectPendingTransferRestoreSnapshot();
    const shouldPreservePendingRestore =
      !pendingTransferRestoreResolved &&
      pendingTransferRestoreItems.length > 0 &&
      snapshot.length === 0;
    if (shouldPreservePendingRestore) {
      return;
    }
    if (!arePendingTransferRestoreItemsEqual(pendingTransferRestoreItems, snapshot)) {
      setPendingTransferRestoreItems(snapshot);
    }
    try {
      if (snapshot.length === 0) {
        window.localStorage.removeItem(SFTP_TRANSFER_PENDING_RESTORE_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          SFTP_TRANSFER_PENDING_RESTORE_STORAGE_KEY,
          JSON.stringify(snapshot)
        );
      }
    } catch {
      // Ignore storage failures; runtime state still applies.
    }
  }, [
    collectPendingTransferRestoreSnapshot,
    pendingTransferRestoreItems,
    pendingTransferRestoreResolved,
    sftpTransfers,
    terminalTabs
  ]);

  useEffect(() => {
    if (pendingTransferRestoreResolved || pendingTransferRestoreItems.length === 0) {
      pendingTransferRestoreNoticeShownRef.current = false;
      return;
    }
    if (pendingTransferRestoreNoticeShownRef.current) {
      return;
    }
    const targetTabId = activeTabIdRef.current ?? terminalTabsRef.current[0]?.id ?? "";
    if (!targetTabId) {
      return;
    }
    pendingTransferRestoreNoticeShownRef.current = true;
    showTransferDockNotice(
      targetTabId,
      "warn",
      `Detected ${pendingTransferRestoreItems.length} pending transfer task(s) from previous run.`
    );
  }, [
    pendingTransferRestoreItems.length,
    pendingTransferRestoreResolved,
    showTransferDockNotice
  ]);

  useEffect(() => {
    portForwardsRef.current = portForwards;
  }, [portForwards]);

  useEffect(() => {
    connectionPreferencesRef.current = connectionPreferences;
  }, [connectionPreferences]);

  useEffect(() => {
    disconnectReportCapturePreferencesRef.current = disconnectReportCapturePreferences;
  }, [disconnectReportCapturePreferences]);

  useEffect(() => {
    pausedUploadTabsRef.current = pausedUploadTabs;
  }, [pausedUploadTabs]);

  useEffect(() => {
    pausedDownloadTabsRef.current = pausedDownloadTabs;
  }, [pausedDownloadTabs]);

  useEffect(() => {
    serverHealthLoadingRef.current = serverHealthLoading;
  }, [serverHealthLoading]);

  useEffect(() => {
    serverProcessLoadingRef.current = serverProcessLoading;
  }, [serverProcessLoading]);

  useEffect(() => {
    serverHealthErrorRef.current = serverHealthError;
  }, [serverHealthError]);

  useEffect(() => {
    serverProcessErrorRef.current = serverProcessError;
  }, [serverProcessError]);

  useEffect(() => {
    portForwardBusyRef.current = portForwardBusy;
  }, [portForwardBusy]);

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
    const validSessionIds = new Set(sessions.map((session) => session.id));
    setSessionTransferConflictStrategyState((prev) => {
      const nextBySessionId: Record<string, SessionTransferConflictStrategy> = {};
      let changed = false;
      for (const [sessionId, strategy] of Object.entries(prev.bySessionId)) {
        if (!validSessionIds.has(sessionId)) {
          changed = true;
          continue;
        }
        nextBySessionId[sessionId] = strategy;
      }
      if (!changed) {
        return prev;
      }
      return {
        bySessionId: nextBySessionId
      };
    });
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
        DISCONNECT_REPORT_CAPTURE_PREFERENCES_STORAGE_KEY,
        JSON.stringify(disconnectReportCapturePreferences)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [disconnectReportCapturePreferences]);

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
        TERMINAL_COMMAND_HISTORY_STORAGE_KEY,
        JSON.stringify(terminalCommandHistoryEntries.slice(0, MAX_TERMINAL_COMMAND_HISTORY))
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [terminalCommandHistoryEntries]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SFTP_CONFLICT_STRATEGY_STORAGE_KEY,
        JSON.stringify(sessionTransferConflictStrategyState)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [sessionTransferConflictStrategyState]);

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
      if (sessionQuickProfiles.length === 0) {
        window.localStorage.removeItem(SESSION_QUICK_PROFILES_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          SESSION_QUICK_PROFILES_STORAGE_KEY,
          JSON.stringify(sessionQuickProfiles.slice(0, MAX_SESSION_QUICK_PROFILES))
        );
      }
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [sessionQuickProfiles]);

  useEffect(() => {
    try {
      if (commandSnippetGroups.length === 0) {
        window.localStorage.removeItem(COMMAND_SNIPPET_GROUPS_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          COMMAND_SNIPPET_GROUPS_STORAGE_KEY,
          JSON.stringify(commandSnippetGroups.slice(0, MAX_COMMAND_SNIPPET_GROUPS))
        );
      }
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [commandSnippetGroups]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DISCONNECT_REPORT_HISTORY_STORAGE_KEY,
        JSON.stringify(disconnectReports)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [disconnectReports]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DISCONNECT_REPORT_VIEW_STORAGE_KEY,
        JSON.stringify({
          scope: disconnectReportScope,
          trigger: disconnectReportTriggerFilter,
          timeRange: disconnectReportTimeRange,
          query: disconnectReportQuery.slice(0, 160)
        } satisfies DisconnectReportViewPreferences)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [
    disconnectReportQuery,
    disconnectReportScope,
    disconnectReportTimeRange,
    disconnectReportTriggerFilter
  ]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        RETRY_CENTER_VIEW_STORAGE_KEY,
        JSON.stringify({
          scope: retryCenterScope,
          direction: retryCenterDirection,
          status: retryCenterStatus,
          timeRange: retryCenterTimeRange,
          listMode: retryCenterListMode,
          failureReason: retryCenterFailureReasonExportValue,
          lastRetryScope: retryCenterLastRetryScope,
          autoUseLastRetryScope: retryCenterAutoUseLastRetryScope,
          retryBatchConfirmThreshold,
          query: retryCenterQuery.slice(0, 160)
        } satisfies RetryCenterViewPreferences)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [
    retryCenterAutoUseLastRetryScope,
    retryBatchConfirmThreshold,
    retryCenterDirection,
    retryCenterLastRetryScope,
    retryCenterListMode,
    retryCenterQuery,
    retryCenterResolvedFailureReasonFilter,
    retryCenterScope,
    retryCenterStatus,
    retryCenterTimeRange
  ]);

  useEffect(() => {
    if (retryCenterFailureReasonFilter === retryCenterResolvedFailureReasonFilter) {
      return;
    }
    setRetryCenterFailureReasonFilter(retryCenterResolvedFailureReasonFilter);
  }, [retryCenterFailureReasonFilter, retryCenterResolvedFailureReasonFilter]);

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
    try {
      window.localStorage.setItem(
        PORT_FORWARD_EVENT_VIEW_STORAGE_KEY,
        JSON.stringify({
          filter: portForwardEventFilter,
          timeRange: portForwardEventTimeRange,
          errorCode: portForwardEventErrorCode.slice(0, 60) || "all",
          correlationQuery: portForwardEventCorrelationQuery.slice(0, 160)
        } satisfies PortForwardEventViewPreferences)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [
    portForwardEventErrorCode,
    portForwardEventCorrelationQuery,
    portForwardEventFilter,
    portForwardEventTimeRange
  ]);

  useEffect(() => {
    const validGroupKeys = new Set(retryCenterGroupedEntries.map((entry) => entry.key));
    setRetryCenterCollapsedGroupKeys((prev) => prev.filter((key) => validGroupKeys.has(key)));
  }, [retryCenterGroupedEntries]);

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
    intentionalTabCloseIdsRef.current.clear();
    pendingStartupCommandsByTabRef.current.clear();
    ensuredRemoteDirectoriesRef.current.clear();
    ensuringRemoteDirectoriesRef.current.clear();
    setPausedUploadTabs({});
    setPausedDownloadTabs({});
  }, [terminalApi]);

  useEffect(() => {
    if (!terminalApi) {
      return;
    }

    const stopListening = terminalApi.onEvent((event) => {
      if (event.type === "status") {
        if (event.status === "connected") {
          intentionalTabCloseIdsRef.current.delete(event.tabId);
          connectedTabIdsRef.current.add(event.tabId);
          setPausedUploadTabs((prev) => {
            if (!prev[event.tabId]) {
              return prev;
            }
            const next = { ...prev };
            delete next[event.tabId];
            return next;
          });
          setPausedDownloadTabs((prev) => {
            if (!prev[event.tabId]) {
              return prev;
            }
            const next = { ...prev };
            delete next[event.tabId];
            return next;
          });
          writeAppLog("info", "renderer:terminal", "Terminal tab connected.", {
            tabId: event.tabId,
            status: event.status
          });
          const pendingStartupCommands = pendingStartupCommandsByTabRef.current.get(event.tabId);
          if (pendingStartupCommands && pendingStartupCommands.length > 0) {
            pendingStartupCommandsByTabRef.current.delete(event.tabId);
            void runStartupCommandsOnTabRef.current(event.tabId, pendingStartupCommands).catch(
              (caughtError) => {
              setError(toLogMessage(caughtError));
              writeAppLog(
                "warn",
                "renderer:session-profile",
                "Failed to execute queued startup commands.",
                {
                  tabId: event.tabId,
                  message: toLogMessage(caughtError)
                }
              );
              }
            );
          }
          drainUploadQueue();
          drainDownloadQueue();
          const tab = terminalTabsRef.current.find((item) => item.id === event.tabId);
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
          if (event.tabId === activeTabIdRef.current) {
            void refreshServerHealth({
              tabId: event.tabId
            });
            if (isServerHealthDetailOpen) {
              void refreshServerProcesses({
                tabId: event.tabId
              });
            }
          }
        } else if (event.status === "connecting") {
          connectedTabIdsRef.current.delete(event.tabId);
          autoRestoredPortForwardTabsRef.current.delete(event.tabId);
          ensuredRemoteDirectoriesRef.current.delete(event.tabId);
          ensuringRemoteDirectoriesRef.current.delete(event.tabId);
          writeAppLog("info", "renderer:terminal", "Terminal tab connecting.", {
            tabId: event.tabId,
            status: event.status
          });
          if (event.tabId === activeTabIdRef.current) {
            resetServerHealth("Terminal tab is reconnecting...");
            resetServerProcesses("Terminal tab is reconnecting...");
          }
        } else {
          const expectedClose = intentionalTabCloseIdsRef.current.has(event.tabId);
          connectedTabIdsRef.current.delete(event.tabId);
          autoRestoredPortForwardTabsRef.current.delete(event.tabId);
          ensuredRemoteDirectoriesRef.current.delete(event.tabId);
          ensuringRemoteDirectoriesRef.current.delete(event.tabId);
          writeAppLog("warn", "renderer:terminal", "Terminal tab disconnected.", {
            tabId: event.tabId,
            status: event.status,
            expectedClose
          });
          if (!expectedClose) {
            captureDisconnectReport({
              tabId: event.tabId,
              trigger: "status",
              status: event.status,
              message: "Terminal tab disconnected."
            });
          }
          intentionalTabCloseIdsRef.current.delete(event.tabId);
          if (event.tabId === activeTabIdRef.current) {
            resetServerHealth("Terminal tab is not connected.");
            resetServerProcesses("Terminal tab is not connected.");
          }
        }
      }
      if (event.type === "error") {
        const expectedClose = intentionalTabCloseIdsRef.current.has(event.tabId);
        connectedTabIdsRef.current.delete(event.tabId);
        autoRestoredPortForwardTabsRef.current.delete(event.tabId);
        ensuredRemoteDirectoriesRef.current.delete(event.tabId);
        ensuringRemoteDirectoriesRef.current.delete(event.tabId);
        writeAppLog("error", "renderer:terminal", "Terminal tab error.", {
          tabId: event.tabId,
          message: event.message,
          expectedClose
        });
        if (!expectedClose) {
          captureDisconnectReport({
            tabId: event.tabId,
            trigger: "error",
            message: event.message
          });
        }
        intentionalTabCloseIdsRef.current.delete(event.tabId);
        if (event.tabId === activeTabIdRef.current) {
          resetServerHealth(event.message);
          resetServerProcesses(event.message);
        }
      }
      if (event.type !== "status" || event.status !== "connected") {
        return;
      }
      if (!activeTabIdRef.current || event.tabId !== activeTabIdRef.current) {
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
    captureDisconnectReport,
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
    writeAppLog
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
      if (event.status === "failed" && !isTransferCanceledMessage(event.message)) {
        writeAppLog("warn", "renderer:sftp-transfer", "SFTP transfer failed.", {
          tabId: event.tabId,
          transferId: event.transferId,
          direction: event.direction,
          name: event.name,
          localPath: event.localPath,
          remotePath: event.remotePath,
          message: event.message
        });
      } else if (event.status === "canceled") {
        writeAppLog("info", "renderer:sftp-transfer", "SFTP transfer canceled.", {
          tabId: event.tabId,
          transferId: event.transferId,
          direction: event.direction,
          name: event.name,
          localPath: event.localPath,
          remotePath: event.remotePath
        });
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
  }, [activeTabId, applySftpTransferEvent, loadSftpDirectory, sftpApi, sftpDirectory?.cwd, writeAppLog]);

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
    const summaryMessage = `Upload batch finished: ${detailParts.join(", ")}.`;
    const failureDetailText = buildBatchFailureDetailText(activeTabId, batchId, "upload", failed);
    writeAppLog(failed > 0 ? "warn" : "info", "renderer:sftp-batch", "Upload batch finished.", {
      tabId: activeTabId,
      batchId,
      completed,
      failed,
      canceled,
      total
    });
    if (failureDetailText) {
      writeAppLog("warn", "renderer:sftp-batch", "Upload batch failure details.", {
        tabId: activeTabId,
        batchId,
        detailText: failureDetailText
      });
    }
    showTransferDockNotice(
      activeTabId,
      failed > 0 ? "warn" : "info",
      failed > 0 ? `${summaryMessage} Open Retry Center for failed items.` : summaryMessage,
      failed > 0 ? 12000 : 5000
    );
    setUploadBatchByTab((prev) => {
      const current = prev[activeTabId];
      if (!current || current.batchId !== batchId) {
        return prev;
      }
      const next = { ...prev };
      delete next[activeTabId];
      return next;
    });
  }, [activeTabId, activeUploadBatchProgress, buildBatchFailureDetailText, showTransferDockNotice, writeAppLog]);

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
    const summaryMessage = `Download batch finished: ${detailParts.join(", ")}.`;
    const failureDetailText = buildBatchFailureDetailText(activeTabId, batchId, "download", failed);
    writeAppLog(
      failed > 0 ? "warn" : "info",
      "renderer:sftp-batch",
      "Download batch finished.",
      {
        tabId: activeTabId,
        batchId,
        completed,
        failed,
        canceled,
        total
      }
    );
    if (failureDetailText) {
      writeAppLog("warn", "renderer:sftp-batch", "Download batch failure details.", {
        tabId: activeTabId,
        batchId,
        detailText: failureDetailText
      });
    }
    showTransferDockNotice(
      activeTabId,
      failed > 0 ? "warn" : "info",
      failed > 0 ? `${summaryMessage} Open Retry Center for failed items.` : summaryMessage,
      failed > 0 ? 12000 : 5000
    );
    setDownloadBatchByTab((prev) => {
      const current = prev[activeTabId];
      if (!current || current.batchId !== batchId) {
        return prev;
      }
      const next = { ...prev };
      delete next[activeTabId];
      return next;
    });
  }, [activeDownloadBatchProgress, activeTabId, buildBatchFailureDetailText, showTransferDockNotice, writeAppLog]);

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

  useEffect(() => {
    if (!commandHistoryContextMenu) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (commandHistoryContextMenuRef.current?.contains(target)) {
        return;
      }
      closeCommandHistoryContextMenu();
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCommandHistoryContextMenu();
      }
    };

    const onWindowLayoutChange = () => {
      closeCommandHistoryContextMenu();
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
  }, [closeCommandHistoryContextMenu, commandHistoryContextMenu]);

  useEffect(() => {
    if (!commandHistoryContextMenu) {
      return;
    }
    if (!commandHistoryContextMenu.entryId) {
      return;
    }
    const hasEntry = terminalCommandHistoryEntries.some(
      (entry) => entry.id === commandHistoryContextMenu.entryId
    );
    if (!hasEntry) {
      closeCommandHistoryContextMenu();
    }
  }, [closeCommandHistoryContextMenu, commandHistoryContextMenu, terminalCommandHistoryEntries]);

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
      ensuringRemoteDirectoriesRef.current.clear();
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

  const exportHotkeyPreferences = useCallback(async () => {
    try {
      const generatedAtIso = new Date().toISOString();
      const payload = {
        exportedAtIso: generatedAtIso,
        appVersion: APP_VERSION,
        hotkeys: hotkeyPreferences
      };
      const exportText = `${JSON.stringify(payload, null, 2)}\n`;
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Hotkeys",
          defaultFileName: `termdock-hotkeys-${generatedAtIso.replace(/[:]/g, "-")}.json`,
          text: exportText,
          filters: [
            {
              name: "JSON",
              extensions: ["json"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `Hotkeys exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `Hotkeys exported:\n${result.outputPath}`,
            {
              title: "Export Hotkeys"
            }
          );
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("Hotkeys JSON copied to clipboard.", {
          title: "Export Hotkeys"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the hotkeys JSON manually.", {
        title: "Export Hotkeys",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:hotkeys", "Failed to export hotkeys.", caughtError);
    }
  }, [hotkeyPreferences, showAppAlert, systemApi, writeAppLog]);

  const importHotkeyPreferences = useCallback(async () => {
    try {
      if (!systemApi?.pickAndReadTextFile) {
        throw new Error("System bridge unavailable. Restart `pnpm dev`.");
      }
      const selected = await systemApi.pickAndReadTextFile({
        title: "Import Hotkeys",
        buttonLabel: "Import",
        filters: [
          {
            name: "JSON",
            extensions: ["json"]
          },
          {
            name: "Text",
            extensions: ["txt", "log"]
          },
          {
            name: "All Files",
            extensions: ["*"]
          }
        ]
      });
      if (selected.canceled || !selected.filePath) {
        return;
      }
      const rawText = typeof selected.text === "string" ? selected.text : "";
      if (!rawText.trim()) {
        await showAppAlert("Selected file is empty.", {
          title: "Import Hotkeys"
        });
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch (caughtError) {
        await showAppAlert(
          `Invalid JSON format.\n${toLogMessage(caughtError)}`,
          {
            title: "Import Hotkeys"
          }
        );
        return;
      }
      const importedPreferences = parseImportedHotkeyPreferences(parsed);
      const diffLines = buildHotkeyPreferenceDiffLines(
        hotkeyPreferences,
        importedPreferences,
        isMacPlatform
      );
      if (diffLines.length === 0) {
        await showAppAlert("No hotkey changes detected in the selected file.", {
          title: "Import Hotkeys"
        });
        return;
      }
      const importedConflicts = findHotkeyConflicts(importedPreferences);
      const autoResolvedImport = autoResolveHotkeyConflicts(importedPreferences);
      const disabledByAutoResolve = autoResolvedImport.disabledActions;
      const previewDetailText = buildHotkeyImportPreviewDetail(
        diffLines,
        importedConflicts,
        disabledByAutoResolve,
        isMacPlatform
      );
      const sourceName = getPathBaseName(selected.filePath);
      const conflictSummary =
        importedConflicts.length > 0
          ? `Detected ${importedConflicts.length} shortcut conflict(s) in imported hotkeys.`
          : "No shortcut conflicts detected in imported hotkeys.";
      const importChoice = await showAppChoice(
        `Import hotkeys from "${sourceName}"?\n${conflictSummary}`,
        [
          {
            value: "import",
            label: "Import"
          },
          {
            value: "importAndResolve",
            label: "Import + Auto Resolve"
          }
        ],
        {
          title: "Import Hotkeys",
          cancelLabel: "Cancel",
          detailText: previewDetailText
        }
      );
      if (!importChoice) {
        return;
      }
      const shouldAutoResolve = importChoice === "importAndResolve";
      const finalPreferences = shouldAutoResolve
        ? autoResolvedImport.preferences
        : importedPreferences;
      setHotkeyPreferences(finalPreferences);
      setError(null);
      if (shouldAutoResolve) {
        if (disabledByAutoResolve.length > 0) {
          await showAppAlert(
            `Hotkeys imported and auto-resolved.\nDisabled ${disabledByAutoResolve.length} duplicate action(s).`,
            {
              title: "Import Hotkeys",
              detailText: disabledByAutoResolve
                .map((action) => getHotkeyActionDescription(action))
                .join("\n")
            }
          );
        } else {
          await showAppAlert("Hotkeys imported. No duplicates needed auto-resolve.", {
            title: "Import Hotkeys"
          });
        }
      } else {
        await showAppAlert(`Hotkeys imported from:\n${selected.filePath}`, {
          title: "Import Hotkeys"
        });
      }
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:hotkeys", "Failed to import hotkeys.", caughtError);
    }
  }, [hotkeyPreferences, isMacPlatform, showAppAlert, showAppChoice, systemApi, writeAppLog]);

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

  const importSessionsFromJson = useCallback(async () => {
    try {
      if (!sessionsApi) {
        throw new Error("Session bridge unavailable. Restart `pnpm dev`.");
      }
      if (!systemApi?.pickAndReadTextFile) {
        throw new Error("System bridge unavailable. Restart `pnpm dev`.");
      }
      const selected = await systemApi.pickAndReadTextFile({
        title: "Import Sessions JSON",
        buttonLabel: "Import",
        filters: [
          {
            name: "JSON",
            extensions: ["json"]
          },
          {
            name: "All Files",
            extensions: ["*"]
          }
        ]
      });
      if (selected.canceled || !selected.filePath) {
        return;
      }
      const rawText = typeof selected.text === "string" ? selected.text : "";
      if (!rawText.trim()) {
        await showAppAlert("Selected file is empty.", {
          title: "Import Sessions JSON"
        });
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch (caughtError) {
        await showAppAlert(`Invalid JSON format.\n${toLogMessage(caughtError)}`, {
          title: "Import Sessions JSON"
        });
        return;
      }
      const parsedImport = parseSessionJsonImportCandidates(parsed);
      if (parsedImport.candidates.length === 0) {
        await showAppAlert(
          parsedImport.warnings.length > 0
            ? `No importable sessions found.\n\n${parsedImport.warnings.join("\n")}`
            : "No importable sessions found.",
          {
            title: "Import Sessions JSON"
          }
        );
        return;
      }
      await showAppAlert("Review parsed sessions before import.", {
        title: "Sessions JSON Preview",
        confirmLabel: "Continue",
        detailText: formatSessionJsonImportPreview(parsedImport)
      });
      const groupMode = await showAppChoice(
        "Choose target group strategy for imported sessions.",
        [
          { value: "keepSource", label: "Keep Group from File" },
          { value: "forceCurrent", label: "Force Active Group" },
          { value: "ungrouped", label: "Move to Ungrouped" }
        ],
        {
          title: "Group Strategy"
        }
      );
      if (!groupMode) {
        return;
      }
      const forcedGroup =
        groupMode === "forceCurrent" ? (activeSessionGroup?.groupName?.trim() ?? "") : "";
      const existingConnectionKeys = new Set(
        sessions.map((session) =>
          buildSessionConnectionKey(session.host, session.port, session.username)
        )
      );
      const duplicateCount = parsedImport.candidates.filter((candidate) =>
        existingConnectionKeys.has(
          buildSessionConnectionKey(candidate.host, candidate.port, candidate.username)
        )
      ).length;
      let duplicateStrategy: "skip" | "overwrite" | "rename" = "skip";
      if (duplicateCount > 0) {
        const choice = await showAppChoice(
          `Found ${duplicateCount} duplicate connection target(s). Choose duplicate strategy.`,
          [
            { value: "skip", label: "Skip Duplicates" },
            { value: "overwrite", label: "Overwrite Existing" },
            { value: "rename", label: "Create Renamed Copies" }
          ],
          {
            title: "Duplicate Strategy"
          }
        );
        if (!choice) {
          return;
        }
        duplicateStrategy = choice as "skip" | "overwrite" | "rename";
      }
      const confirmed = await showAppConfirm(
        `Import ${parsedImport.candidates.length} session(s) from ${getPathBaseName(selected.filePath)}?\nGroup strategy: ${groupMode}\nDuplicate strategy: ${duplicateStrategy}`,
        {
          title: "Import Sessions JSON",
          confirmLabel: "Import",
          cancelLabel: "Cancel"
        }
      );
      if (!confirmed) {
        return;
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

      const importedGroupNames = new Set<string>();
      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      let firstImportedSessionId: string | null = null;
      const sourceRemarkPrefix = `Imported JSON: ${selected.filePath}`;

      for (const candidate of parsedImport.candidates) {
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
        const groupId =
          groupMode === "keepSource"
            ? candidate.groupId.trim()
            : groupMode === "forceCurrent"
              ? forcedGroup
              : "";
        if (groupId) {
          importedGroupNames.add(groupId);
        }
        const remarkParts = [candidate.remark.trim(), sourceRemarkPrefix].filter(Boolean);
        const remark = remarkParts.join(" | ");

        if (existing && duplicateStrategy === "overwrite") {
          try {
            const updated = await sessionsApi.update(existing.id, {
              name: candidate.name,
              host: candidate.host,
              port: candidate.port,
              username: candidate.username,
              authType: candidate.authType,
              privateKeyPath:
                candidate.authType === "privateKey" ? candidate.privateKeyPath : "",
              groupId,
              remark,
              favorite: candidate.favorite
            });
            updatedCount += 1;
            if (!firstImportedSessionId) {
              firstImportedSessionId = updated.id;
            }
            const index = localSessions.findIndex((entry) => entry.id === updated.id);
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
          : allocateImportName(candidate.name);
        try {
          const created = await sessionsApi.create({
            name: nextName,
            host: candidate.host,
            port: candidate.port,
            username: candidate.username,
            authType: candidate.authType,
            privateKeyPath:
              candidate.authType === "privateKey" ? candidate.privateKeyPath : "",
            groupId,
            remark,
            favorite: candidate.favorite,
            secret: ""
          });
          createdCount += 1;
          if (!firstImportedSessionId) {
            firstImportedSessionId = created.id;
          }
          localSessions.unshift(created);
          if (!sessionByConnection.has(connectionKey)) {
            sessionByConnection.set(connectionKey, created);
          }
        } catch {
          failedCount += 1;
        }
      }

      if (importedGroupNames.size > 0) {
        setSessionGroupsState((prev) => ({
          groups: normalizeSessionGroups([...prev.groups, ...Array.from(importedGroupNames)])
        }));
      }
      if (createdCount > 0 || updatedCount > 0) {
        setSessions(localSessions);
        if (firstImportedSessionId) {
          setSelectedSessionId(firstImportedSessionId);
        }
      }
      await showAppAlert(
        `Import completed.\nCreated: ${createdCount}\nUpdated: ${updatedCount}\nSkipped: ${skippedCount}\nFailed: ${failedCount}\nWarnings: ${parsedImport.warnings.length}`,
        {
          title: "Import Sessions JSON"
        }
      );
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:sessions", "Session JSON import failed.", caughtError);
    }
  }, [
    activeSessionGroup?.groupName,
    sessions,
    sessionsApi,
    showAppAlert,
    showAppChoice,
    showAppConfirm,
    systemApi,
    writeAppLog
  ]);

  const exportAllSessionsWithGroups = useCallback(async () => {
    try {
      if (sessions.length === 0) {
        await showAppAlert("No sessions available to export.", {
          title: "Session Export"
        });
        return;
      }
      const generatedAtIso = new Date().toISOString();
      const groups = sessionGroupOptions.map((groupName) => {
        const count = sessions.filter(
          (session) => (session.groupId?.trim() ?? "") === groupName
        ).length;
        return {
          groupId: groupName,
          groupName,
          sessionCount: count
        };
      });
      const ungroupedCount = sessions.filter((session) => !(session.groupId?.trim() ?? "")).length;
      if (ungroupedCount > 0) {
        groups.push({
          groupId: "",
          groupName: "Ungrouped",
          sessionCount: ungroupedCount
        });
      }
      const sessionRows = [...sessions]
        .sort((left, right) => {
          const leftGroup = left.groupId?.trim() ?? "";
          const rightGroup = right.groupId?.trim() ?? "";
          if (leftGroup !== rightGroup) {
            if (!leftGroup) {
              return 1;
            }
            if (!rightGroup) {
              return -1;
            }
            return leftGroup.localeCompare(rightGroup);
          }
          return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
        })
        .map((session) => {
          const groupId = session.groupId?.trim() ?? "";
          return {
            id: session.id,
            name: session.name,
            host: session.host,
            port: session.port,
            username: session.username,
            authType: session.authType,
            privateKeyPath: session.privateKeyPath ?? "",
            groupId,
            groupName: groupId || "Ungrouped",
            remark: session.remark ?? "",
            favorite: session.favorite,
            hasSecret: session.hasSecret,
            lastConnectedAt: session.lastConnectedAt ?? "",
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
          };
        });
      const payload = {
        exportedAtIso: generatedAtIso,
        appVersion: APP_VERSION,
        sessionCount: sessionRows.length,
        groupCount: groups.length,
        groups,
        sessions: sessionRows
      };
      const exportText = `${JSON.stringify(payload, null, 2)}\n`;
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export All Sessions",
          defaultFileName: `termdock-sessions-all-${generatedAtIso.replace(/[:]/g, "-")}.json`,
          text: exportText,
          filters: [
            {
              name: "JSON",
              extensions: ["json"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `Session export completed.\nPath copied to clipboard:\n${result.outputPath}`
              : `Session export completed:\n${result.outputPath}`,
            {
              title: "Session Export"
            }
          );
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("All session data copied to clipboard as JSON.", {
          title: "Session Export"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the session export below manually.", {
        title: "Session Export",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:sessions", "Failed to export all sessions.", caughtError);
    }
  }, [sessionGroupOptions, sessions, showAppAlert, systemApi, writeAppLog]);

  const exportAllSessionGroups = useCallback(async () => {
    try {
      const generatedAtIso = new Date().toISOString();
      const groupNames = [...sessionGroupOptions];
      const groupRows = groupNames.map((groupName) => {
        const groupSessions = sessions
          .filter((session) => (session.groupId?.trim() ?? "") === groupName)
          .sort((left, right) =>
            left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
          );
        return {
          groupId: groupName,
          groupName,
          sessionCount: groupSessions.length,
          sessions: groupSessions.map((session) => ({
            id: session.id,
            name: session.name,
            host: session.host,
            port: session.port,
            username: session.username,
            favorite: session.favorite,
            lastConnectedAt: session.lastConnectedAt ?? ""
          }))
        };
      });
      const ungroupedSessions = sessions
        .filter((session) => !(session.groupId?.trim() ?? ""))
        .sort((left, right) =>
          left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
        );
      if (ungroupedSessions.length > 0) {
        groupRows.push({
          groupId: "",
          groupName: "Ungrouped",
          sessionCount: ungroupedSessions.length,
          sessions: ungroupedSessions.map((session) => ({
            id: session.id,
            name: session.name,
            host: session.host,
            port: session.port,
            username: session.username,
            favorite: session.favorite,
            lastConnectedAt: session.lastConnectedAt ?? ""
          }))
        });
      }
      const payload = {
        exportedAtIso: generatedAtIso,
        appVersion: APP_VERSION,
        groupCount: groupRows.length,
        groups: groupRows
      };
      const exportText = `${JSON.stringify(payload, null, 2)}\n`;
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export All Groups",
          defaultFileName: `termdock-groups-all-${generatedAtIso.replace(/[:]/g, "-")}.json`,
          text: exportText,
          filters: [
            {
              name: "JSON",
              extensions: ["json"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `Group export completed.\nPath copied to clipboard:\n${result.outputPath}`
              : `Group export completed:\n${result.outputPath}`,
            {
              title: "Group Export"
            }
          );
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("All group data copied to clipboard as JSON.", {
          title: "Group Export"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the group export below manually.", {
        title: "Group Export",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:sessions", "Failed to export all groups.", caughtError);
    }
  }, [sessionGroupOptions, sessions, showAppAlert, systemApi, writeAppLog]);

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

  const runStartupCommandsOnTab = useCallback(
    async (tabId: string, commands: string[]): Promise<void> => {
      if (!terminalApi) {
        return;
      }
      const normalizedCommands = commands
        .map((command) => command.trim())
        .filter((command) => command.length > 0)
        .slice(0, 20);
      if (normalizedCommands.length === 0) {
        return;
      }
      for (const command of normalizedCommands) {
        await terminalApi.write(tabId, `${command}\n`);
      }
      writeAppLog("info", "renderer:session-profile", "Executed startup commands on terminal tab.", {
        tabId,
        commandCount: normalizedCommands.length
      });
    },
    [terminalApi, writeAppLog]
  );

  useEffect(() => {
    runStartupCommandsOnTabRef.current = runStartupCommandsOnTab;
  }, [runStartupCommandsOnTab]);

  const queueStartupCommandsForTab = useCallback(
    (tabId: string, commands: string[]): void => {
      const normalizedTabId = tabId.trim();
      const normalizedCommands = commands
        .map((command) => command.trim())
        .filter((command) => command.length > 0)
        .slice(0, 20);
      if (!normalizedTabId || normalizedCommands.length === 0) {
        return;
      }
      if (connectedTabIdsRef.current.has(normalizedTabId)) {
        void runStartupCommandsOnTab(normalizedTabId, normalizedCommands).catch((caughtError) => {
          setError(toLogMessage(caughtError));
        });
        return;
      }
      const queued = pendingStartupCommandsByTabRef.current.get(normalizedTabId) ?? [];
      pendingStartupCommandsByTabRef.current.set(
        normalizedTabId,
        [...queued, ...normalizedCommands].slice(0, 40)
      );
    },
    [runStartupCommandsOnTab]
  );

  const openTerminalTab = useCallback(
    (
      session: SessionRecord,
      options?: {
        startupCommands?: string[];
      }
    ): string | null => {
      if (!terminalApi) {
        setError("Terminal bridge unavailable. Restart `pnpm dev`.");
        return null;
      }
      const startupCommands = options?.startupCommands ?? [];
      const existingOpened = terminalTabsRef.current.find((tab) => tab.sessionId === session.id);
      if (existingOpened) {
        setActiveTabId(existingOpened.id);
        queueStartupCommandsForTab(existingOpened.id, startupCommands);
        return existingOpened.id;
      }

      const id = `${session.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      setTerminalTabs((prev) => {
        const existingTab = prev.find((tab) => tab.sessionId === session.id);
        if (existingTab) {
          return prev;
        }
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
      queueStartupCommandsForTab(id, startupCommands);
      return id;
    },
    [queueStartupCommandsForTab, terminalApi]
  );

  const runSessionQuickProfile = useCallback(
    async (session: SessionRecord, profile: SessionQuickProfile): Promise<void> => {
      const normalizedCommand = profile.startupCommand.trim();
      if (!normalizedCommand) {
        await showAppAlert("Quick profile command is empty.", {
          title: "Quick Profile"
        });
        return;
      }
      if (profile.confirmBeforeRun) {
        const confirmed = await showAppConfirm(
          `Run quick profile "${profile.name}" on "${session.name}"?\n\nCommand:\n${normalizedCommand}`,
          {
            title: "Quick Profile",
            confirmLabel: "Run",
            cancelLabel: "Cancel"
          }
        );
        if (!confirmed) {
          return;
        }
      }
      const tabId = openTerminalTab(session, {
        startupCommands: [normalizedCommand]
      });
      if (!tabId) {
        return;
      }
      setError(null);
    },
    [openTerminalTab, showAppAlert, showAppConfirm]
  );

  const createSessionQuickProfileForSession = useCallback(
    async (session: SessionRecord): Promise<void> => {
      const profileNameInput = await showAppPrompt(
        "Enter quick profile name.",
        `${session.name} quick`,
        {
          title: "New Quick Profile",
          confirmLabel: "Continue"
        }
      );
      if (profileNameInput === null) {
        return;
      }
      const profileName = profileNameInput.trim().slice(0, 80);
      if (!profileName) {
        await showAppAlert("Profile name cannot be empty.", {
          title: "New Quick Profile"
        });
        return;
      }
      const commandInput = await showAppPrompt(
        "Enter startup command (supports multiline).",
        "",
        {
          title: "Quick Profile Command",
          confirmLabel: "Save",
          multiline: true
        }
      );
      if (commandInput === null) {
        return;
      }
      const startupCommand = commandInput.trim().slice(0, 4000);
      if (!startupCommand) {
        await showAppAlert("Startup command cannot be empty.", {
          title: "Quick Profile Command"
        });
        return;
      }
      const confirmChoice = await showAppChoice(
        "Require confirmation before running this profile?",
        [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" }
        ],
        {
          title: "Quick Profile"
        }
      );
      if (!confirmChoice) {
        return;
      }
      const profile: SessionQuickProfile = {
        id: `qp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        name: profileName,
        startupCommand,
        confirmBeforeRun: confirmChoice === "yes"
      };
      setSessionQuickProfiles((prev) => [profile, ...prev].slice(0, MAX_SESSION_QUICK_PROFILES));
      await showAppAlert(
        `Quick profile "${profile.name}" saved. Use "Run Quick Profile..." to execute on a session.`,
        {
          title: "Quick Profile"
        }
      );
    },
    [showAppAlert, showAppChoice, showAppPrompt]
  );

  const runSessionQuickProfileChooser = useCallback(
    async (session: SessionRecord): Promise<void> => {
      if (sessionQuickProfiles.length === 0) {
        await showAppAlert("No quick profiles available. Create one first.", {
          title: "Quick Profile"
        });
        return;
      }
      const profileChoice = await showAppChoice(
        `Choose quick profile for "${session.name}".`,
        sessionQuickProfiles.map((profile) => ({
          value: profile.id,
          label: profile.name
        })),
        {
          title: "Run Quick Profile"
        }
      );
      if (!profileChoice) {
        return;
      }
      const profile = sessionQuickProfiles.find((entry) => entry.id === profileChoice);
      if (!profile) {
        return;
      }
      await runSessionQuickProfile(session, profile);
    },
    [runSessionQuickProfile, sessionQuickProfiles, showAppAlert, showAppChoice]
  );

  const manageSessionQuickProfilesForSession = useCallback(
    async (session: SessionRecord): Promise<void> => {
      if (sessionQuickProfiles.length === 0) {
        await createSessionQuickProfileForSession(session);
        return;
      }
      const profileChoice = await showAppChoice(
        "Select quick profile to manage.",
        sessionQuickProfiles.map((profile) => ({
          value: profile.id,
          label: profile.name
        })),
        {
          title: "Manage Quick Profiles"
        }
      );
      if (!profileChoice) {
        return;
      }
      const profile = sessionQuickProfiles.find((entry) => entry.id === profileChoice);
      if (!profile) {
        return;
      }
      const action = await showAppChoice(
        `Profile "${profile.name}"`,
        [
          { value: "run", label: "Run" },
          { value: "edit", label: "Edit" },
          { value: "delete", label: "Delete", danger: true }
        ],
        {
          title: "Manage Quick Profile"
        }
      );
      if (!action) {
        return;
      }
      if (action === "run") {
        await runSessionQuickProfile(session, profile);
        return;
      }
      if (action === "edit") {
        const nextNameInput = await showAppPrompt("Edit profile name.", profile.name, {
          title: "Edit Quick Profile",
          confirmLabel: "Continue"
        });
        if (nextNameInput === null) {
          return;
        }
        const nextName = nextNameInput.trim().slice(0, 80);
        if (!nextName) {
          await showAppAlert("Profile name cannot be empty.", {
            title: "Edit Quick Profile"
          });
          return;
        }
        const nextCommandInput = await showAppPrompt(
          "Edit startup command (supports multiline).",
          profile.startupCommand,
          {
            title: "Edit Quick Profile",
            confirmLabel: "Save",
            multiline: true
          }
        );
        if (nextCommandInput === null) {
          return;
        }
        const nextCommand = nextCommandInput.trim().slice(0, 4000);
        if (!nextCommand) {
          await showAppAlert("Startup command cannot be empty.", {
            title: "Edit Quick Profile"
          });
          return;
        }
        const confirmChoice = await showAppChoice(
          "Require confirmation before running this profile?",
          [
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" }
          ],
          {
            title: "Edit Quick Profile"
          }
        );
        if (!confirmChoice) {
          return;
        }
        setSessionQuickProfiles((prev) =>
          prev.map((entry) =>
            entry.id === profile.id
              ? {
                  ...entry,
                  name: nextName,
                  startupCommand: nextCommand,
                  confirmBeforeRun: confirmChoice === "yes"
                }
              : entry
          )
        );
        return;
      }
      const confirmed = await showAppConfirm(`Delete quick profile "${profile.name}"?`, {
        title: "Delete Quick Profile",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        danger: true
      });
      if (!confirmed) {
        return;
      }
      setSessionQuickProfiles((prev) => prev.filter((entry) => entry.id !== profile.id));
    },
    [
      createSessionQuickProfileForSession,
      runSessionQuickProfile,
      sessionQuickProfiles,
      showAppAlert,
      showAppChoice,
      showAppConfirm,
      showAppPrompt
    ]
  );

  const renderCommandSnippetTemplate = useCallback(
    async (template: string): Promise<string> => {
      const tabId = activeTabIdRef.current;
      const tab = tabId ? terminalTabsRef.current.find((entry) => entry.id === tabId) ?? null : null;
      const session = tab
        ? sessionsRef.current.find((entry) => entry.id === tab.sessionId) ?? null
        : null;
      const now = new Date();
      const replacements: Record<string, string> = {
        "${date}": now.toLocaleDateString(),
        "${time}": now.toLocaleTimeString(),
        "${datetime}": now.toLocaleString(),
        "${tabTitle}": tab?.title ?? "",
        "${sessionName}": session?.name ?? "",
        "${host}": session?.host ?? "",
        "${username}": session?.username ?? ""
      };
      let rendered = template;
      if (rendered.includes("${clipboard}") && systemApi?.readClipboardText) {
        try {
          replacements["${clipboard}"] = await systemApi.readClipboardText();
        } catch {
          replacements["${clipboard}"] = "";
        }
      } else {
        replacements["${clipboard}"] = "";
      }
      for (const [token, value] of Object.entries(replacements)) {
        rendered = rendered.replaceAll(token, value);
      }
      return rendered.trim();
    },
    [systemApi]
  );

  const runCommandSnippet = useCallback(
    async (snippet: CommandSnippetItem): Promise<void> => {
      if (!terminalApi) {
        setError("Terminal bridge unavailable. Restart `pnpm dev`.");
        return;
      }
      const tabId = activeTabIdRef.current;
      if (!tabId) {
        setError("Open and focus a terminal tab before running snippets.");
        return;
      }
      const rendered = await renderCommandSnippetTemplate(snippet.template);
      if (!rendered) {
        await showAppAlert("Snippet resolved to an empty command.", {
          title: "Run Snippet"
        });
        return;
      }
      if (snippet.confirmBeforeRun) {
        const confirmed = await showAppConfirm(
          `Run snippet "${snippet.name}" on current tab?\n\nCommand:\n${rendered}`,
          {
            title: "Run Snippet",
            confirmLabel: "Run",
            cancelLabel: "Cancel"
          }
        );
        if (!confirmed) {
          return;
        }
      }
      await terminalApi.write(tabId, `${rendered}\n`);
      const tabTitle =
        terminalTabsRef.current.find((entry) => entry.id === tabId)?.title ?? `Tab ${tabId}`;
      upsertTerminalCommandHistoryCommand(rendered, {
        preferredTabId: tabId,
        preferredTabTitle: tabTitle
      });
    },
    [
      renderCommandSnippetTemplate,
      showAppAlert,
      showAppConfirm,
      terminalApi,
      upsertTerminalCommandHistoryCommand
    ]
  );

  const importCommandSnippetGroups = useCallback(async () => {
    if (!systemApi?.pickAndReadTextFile) {
      throw new Error("System bridge unavailable. Restart `pnpm dev`.");
    }
    const selected = await systemApi.pickAndReadTextFile({
      title: "Import Snippet Groups",
      buttonLabel: "Import",
      filters: [
        { name: "JSON", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (selected.canceled || !selected.filePath) {
      return;
    }
    const parsed = JSON.parse(selected.text);
    const imported = normalizeCommandSnippetGroups(parsed);
    if (imported.length === 0) {
      await showAppAlert("No valid snippet groups found in selected file.", {
        title: "Import Snippet Groups"
      });
      return;
    }
    setCommandSnippetGroups(imported);
    await showAppAlert(
      `Imported ${imported.length} snippet group(s), ${imported.reduce(
        (total, group) => total + group.snippets.length,
        0
      )} snippet(s).`,
      {
        title: "Import Snippet Groups"
      }
    );
  }, [showAppAlert, systemApi]);

  const exportCommandSnippetGroups = useCallback(async () => {
    if (commandSnippetGroups.length === 0) {
      await showAppAlert("No snippet groups available to export.", {
        title: "Export Snippet Groups"
      });
      return;
    }
    const payload = {
      exportedAtIso: new Date().toISOString(),
      appVersion: APP_VERSION,
      groupCount: commandSnippetGroups.length,
      snippetCount: commandSnippetGroups.reduce((total, group) => total + group.snippets.length, 0),
      groups: commandSnippetGroups
    };
    const content = `${JSON.stringify(payload, null, 2)}\n`;
    if (systemApi?.saveTextFile) {
      const result = await systemApi.saveTextFile({
        title: "Export Snippet Groups",
        defaultFileName: `termdock-snippet-groups-${new Date().toISOString().replace(/[:]/g, "-")}.json`,
        text: content,
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
      if (!result.canceled && result.outputPath) {
        await showAppAlert(`Snippet groups exported:\n${result.outputPath}`, {
          title: "Export Snippet Groups"
        });
      }
      return;
    }
    const copied = await copyTextToClipboard(content);
    await showAppAlert(copied ? "Snippet groups JSON copied to clipboard." : content, {
      title: "Export Snippet Groups",
      detailText: copied ? undefined : content
    });
  }, [commandSnippetGroups, showAppAlert, systemApi]);

  const selectedCommandSnippetManagerGroup = useMemo(
    () =>
      commandSnippetGroups.find((group) => group.id === commandSnippetManagerGroupId) ??
      commandSnippetGroups[0] ??
      null,
    [commandSnippetGroups, commandSnippetManagerGroupId]
  );
  const selectedCommandSnippetManagerSnippet = useMemo(() => {
    if (!selectedCommandSnippetManagerGroup) {
      return null;
    }
    return (
      selectedCommandSnippetManagerGroup.snippets.find(
        (snippet) => snippet.id === commandSnippetManagerSnippetId
      ) ??
      selectedCommandSnippetManagerGroup.snippets[0] ??
      null
    );
  }, [commandSnippetManagerSnippetId, selectedCommandSnippetManagerGroup]);
  useEffect(() => {
    if (!isCommandSnippetManagerOpen) {
      return;
    }
    if (commandSnippetGroups.length === 0) {
      if (commandSnippetManagerGroupId) {
        setCommandSnippetManagerGroupId("");
      }
      if (commandSnippetManagerSnippetId) {
        setCommandSnippetManagerSnippetId("");
      }
      return;
    }
    const nextGroup =
      commandSnippetGroups.find((group) => group.id === commandSnippetManagerGroupId) ??
      commandSnippetGroups[0];
    if (nextGroup.id !== commandSnippetManagerGroupId) {
      setCommandSnippetManagerGroupId(nextGroup.id);
    }
    if (nextGroup.snippets.length === 0) {
      if (commandSnippetManagerSnippetId) {
        setCommandSnippetManagerSnippetId("");
      }
      return;
    }
    const hasSelectedSnippet = nextGroup.snippets.some(
      (snippet) => snippet.id === commandSnippetManagerSnippetId
    );
    if (!hasSelectedSnippet) {
      setCommandSnippetManagerSnippetId(nextGroup.snippets[0].id);
    }
  }, [
    commandSnippetGroups,
    commandSnippetManagerGroupId,
    commandSnippetManagerSnippetId,
    isCommandSnippetManagerOpen
  ]);
  const updateCommandSnippetManagerGroupName = useCallback((groupId: string, nextName: string) => {
    const normalizedName = nextName.slice(0, 80);
    setCommandSnippetGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? {
              ...group,
              name: normalizedName
            }
          : group
      )
    );
  }, []);
  const addCommandSnippetManagerGroup = useCallback(() => {
    if (commandSnippetGroups.length >= MAX_COMMAND_SNIPPET_GROUPS) {
      setError(`Snippet groups are limited to ${MAX_COMMAND_SNIPPET_GROUPS}.`);
      return;
    }
    const nextGroupId = `sg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const nextGroupName = `Group ${commandSnippetGroups.length + 1}`;
    setCommandSnippetGroups((prev) => [
      ...prev,
      {
        id: nextGroupId,
        name: nextGroupName,
        snippets: []
      }
    ]);
    setCommandSnippetManagerGroupId(nextGroupId);
    setCommandSnippetManagerSnippetId("");
  }, [commandSnippetGroups.length]);
  const deleteCommandSnippetManagerGroup = useCallback(async () => {
    if (!selectedCommandSnippetManagerGroup) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Delete snippet group "${selectedCommandSnippetManagerGroup.name}" and all snippets in it?`,
      {
        title: "Delete Snippet Group",
        confirmLabel: "Delete Group",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    setCommandSnippetGroups((prev) =>
      prev.filter((group) => group.id !== selectedCommandSnippetManagerGroup.id)
    );
  }, [selectedCommandSnippetManagerGroup, showAppConfirm]);
  const addCommandSnippetManagerSnippet = useCallback(() => {
    if (!selectedCommandSnippetManagerGroup) {
      addCommandSnippetManagerGroup();
      return;
    }
    if (selectedCommandSnippetManagerGroup.snippets.length >= MAX_COMMAND_SNIPPETS_PER_GROUP) {
      setError(
        `Snippets per group are limited to ${MAX_COMMAND_SNIPPETS_PER_GROUP}. Delete or export existing snippets first.`
      );
      return;
    }
    const nextSnippetId = `sn-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const nextSnippet: CommandSnippetItem = {
      id: nextSnippetId,
      name: `Snippet ${selectedCommandSnippetManagerGroup.snippets.length + 1}`,
      template: "echo \"snippet\"",
      confirmBeforeRun: false
    };
    setCommandSnippetGroups((prev) =>
      prev.map((group) =>
        group.id === selectedCommandSnippetManagerGroup.id
          ? {
              ...group,
              snippets: [...group.snippets, nextSnippet]
            }
          : group
      )
    );
    setCommandSnippetManagerSnippetId(nextSnippetId);
  }, [addCommandSnippetManagerGroup, selectedCommandSnippetManagerGroup]);
  const updateCommandSnippetManagerSnippetName = useCallback(
    (snippetId: string, nextName: string) => {
      if (!selectedCommandSnippetManagerGroup) {
        return;
      }
      const normalizedName = nextName.slice(0, 80);
      setCommandSnippetGroups((prev) =>
        prev.map((group) =>
          group.id === selectedCommandSnippetManagerGroup.id
            ? {
                ...group,
                snippets: group.snippets.map((snippet) =>
                  snippet.id === snippetId
                    ? {
                        ...snippet,
                        name: normalizedName
                      }
                    : snippet
                )
              }
            : group
        )
      );
    },
    [selectedCommandSnippetManagerGroup]
  );
  const updateCommandSnippetManagerSnippetTemplate = useCallback(
    (snippetId: string, nextTemplate: string) => {
      if (!selectedCommandSnippetManagerGroup) {
        return;
      }
      const normalizedTemplate = nextTemplate.slice(0, 4000);
      setCommandSnippetGroups((prev) =>
        prev.map((group) =>
          group.id === selectedCommandSnippetManagerGroup.id
            ? {
                ...group,
                snippets: group.snippets.map((snippet) =>
                  snippet.id === snippetId
                    ? {
                        ...snippet,
                        template: normalizedTemplate
                      }
                    : snippet
                )
              }
            : group
        )
      );
    },
    [selectedCommandSnippetManagerGroup]
  );
  const updateCommandSnippetManagerSnippetConfirm = useCallback(
    (snippetId: string, nextConfirmBeforeRun: boolean) => {
      if (!selectedCommandSnippetManagerGroup) {
        return;
      }
      setCommandSnippetGroups((prev) =>
        prev.map((group) =>
          group.id === selectedCommandSnippetManagerGroup.id
            ? {
                ...group,
                snippets: group.snippets.map((snippet) =>
                  snippet.id === snippetId
                    ? {
                        ...snippet,
                        confirmBeforeRun: nextConfirmBeforeRun
                      }
                    : snippet
                )
              }
            : group
        )
      );
    },
    [selectedCommandSnippetManagerGroup]
  );
  const runSelectedCommandSnippetManagerSnippet = useCallback(async () => {
    if (!selectedCommandSnippetManagerSnippet) {
      return;
    }
    await runCommandSnippet(selectedCommandSnippetManagerSnippet);
  }, [runCommandSnippet, selectedCommandSnippetManagerSnippet]);
  const deleteCommandSnippetManagerSnippet = useCallback(async () => {
    if (!selectedCommandSnippetManagerGroup || !selectedCommandSnippetManagerSnippet) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Delete snippet "${selectedCommandSnippetManagerSnippet.name}" from "${selectedCommandSnippetManagerGroup.name}"?`,
      {
        title: "Delete Snippet",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    setCommandSnippetGroups((prev) =>
      prev.map((group) =>
        group.id === selectedCommandSnippetManagerGroup.id
          ? {
              ...group,
              snippets: group.snippets.filter(
                (snippet) => snippet.id !== selectedCommandSnippetManagerSnippet.id
              )
            }
          : group
      )
    );
  }, [selectedCommandSnippetManagerGroup, selectedCommandSnippetManagerSnippet, showAppConfirm]);
  const clearAllCommandSnippetGroups = useCallback(async () => {
    const confirmed = await showAppConfirm(
      `Delete all snippet groups and snippets (${commandSnippetGroups.length} group(s), ${totalCommandSnippetCount} snippet(s))?`,
      {
        title: "Clear Snippet Groups",
        confirmLabel: "Delete All",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    setCommandSnippetGroups([]);
    setCommandSnippetManagerGroupId("");
    setCommandSnippetManagerSnippetId("");
  }, [commandSnippetGroups.length, showAppConfirm, totalCommandSnippetCount]);

  const closeTerminalTabs = useCallback((tabIds: string[]) => {
    const uniqueTabIds = Array.from(new Set(tabIds.filter(Boolean)));
    if (uniqueTabIds.length === 0) {
      return;
    }
    const tabIdSet = new Set(uniqueTabIds);

    for (const tabId of uniqueTabIds) {
      intentionalTabCloseIdsRef.current.add(tabId);
      window.setTimeout(() => {
        intentionalTabCloseIdsRef.current.delete(tabId);
      }, 15_000);
      pendingStartupCommandsByTabRef.current.delete(tabId);
      connectedTabIdsRef.current.delete(tabId);
      autoRestoredPortForwardTabsRef.current.delete(tabId);
      ensuredRemoteDirectoriesRef.current.delete(tabId);
      ensuringRemoteDirectoriesRef.current.delete(tabId);
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
    setPausedUploadTabs((prev) => {
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
    setPausedDownloadTabs((prev) => {
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

  const registerHotkeyRowRef = useCallback(
    (action: HotkeyActionId, element: HTMLDivElement | null) => {
      if (element) {
        hotkeyRowRefs.current.set(action, element);
      } else {
        hotkeyRowRefs.current.delete(action);
      }
    },
    []
  );

  const focusHotkeyAction = useCallback((action: HotkeyActionId) => {
    const targetElement = hotkeyRowRefs.current.get(action) ?? null;
    if (!targetElement) {
      return;
    }
    targetElement.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
    if (hotkeyConflictHighlightTimerRef.current !== null) {
      window.clearTimeout(hotkeyConflictHighlightTimerRef.current);
      hotkeyConflictHighlightTimerRef.current = null;
    }
    setHotkeyFocusedAction(action);
    hotkeyConflictHighlightTimerRef.current = window.setTimeout(() => {
      setHotkeyFocusedAction((current) => (current === action ? null : current));
      hotkeyConflictHighlightTimerRef.current = null;
    }, 2200);
  }, []);

  const focusHotkeyConflictAtIndex = useCallback(
    (index: number) => {
      if (hotkeyConflicts.length <= 0) {
        return;
      }
      const normalizedIndex =
        ((Math.trunc(index) % hotkeyConflicts.length) + hotkeyConflicts.length) %
        hotkeyConflicts.length;
      const targetConflict = hotkeyConflicts[normalizedIndex];
      const targetAction = targetConflict.actions[0];
      setHotkeyConflictCursorIndex(normalizedIndex);
      setHotkeyConflictCursorSignature(targetConflict.signature);
      focusHotkeyAction(targetAction);
    },
    [focusHotkeyAction, hotkeyConflicts]
  );

  const focusPreviousHotkeyConflict = useCallback(() => {
    focusHotkeyConflictAtIndex(hotkeyConflictCursorIndex - 1);
  }, [focusHotkeyConflictAtIndex, hotkeyConflictCursorIndex]);

  const focusNextHotkeyConflict = useCallback(() => {
    focusHotkeyConflictAtIndex(hotkeyConflictCursorIndex + 1);
  }, [focusHotkeyConflictAtIndex, hotkeyConflictCursorIndex]);

  const resolveHotkeyConflicts = useCallback(() => {
    setHotkeyPreferences((prev) => {
      const resolved = autoResolveHotkeyConflicts(prev);
      return resolved.disabledActions.length > 0 ? resolved.preferences : prev;
    });
  }, []);

  useEffect(() => {
    if (!isSettingsOpen || activeSettingsSection !== "hotkeys" || hotkeyConflicts.length <= 0) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) {
        return;
      }
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      const code = event.code.trim();
      const key = event.key.trim();
      const isPrevious = code === "BracketLeft" || key === "[";
      const isNext = code === "BracketRight" || key === "]";
      if (!isPrevious && !isNext) {
        return;
      }
      event.preventDefault();
      if (isPrevious) {
        focusPreviousHotkeyConflict();
        return;
      }
      focusNextHotkeyConflict();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    activeSettingsSection,
    focusNextHotkeyConflict,
    focusPreviousHotkeyConflict,
    hotkeyConflicts.length,
    isSettingsOpen
  ]);

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

  const dismissGlobalError = useCallback(() => {
    setError(null);
  }, []);

  const openDiagnosticsFromError = useCallback(() => {
    openSettingsPanel("diagnostics");
  }, [openSettingsPanel]);

  const reconnectActiveTabFromError = useCallback(async () => {
    try {
      if (!terminalApi) {
        throw new Error("Terminal bridge unavailable. Restart `pnpm dev`.");
      }
      if (!activeTabId || !activeSessionId) {
        throw new Error("Open and select a terminal tab, then retry reconnect.");
      }
      await terminalApi.connect(activeTabId, activeSessionId);
      setError(null);
      writeAppLog("info", "renderer:error-bar", "Manual reconnect requested from global error bar.", {
        tabId: activeTabId,
        sessionId: activeSessionId
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:error-bar",
        "Manual reconnect action failed from global error bar.",
        caughtError
      );
    }
  }, [activeSessionId, activeTabId, terminalApi, writeAppLog]);

  const copyGlobalErrorMessage = useCallback(async () => {
    if (!error) {
      return;
    }
    try {
      const copied = await copyTextToClipboard(error);
      if (!copied) {
        throw new Error("Clipboard unavailable.");
      }
      await showAppAlert("Error message copied to clipboard.", {
        title: "Diagnostics"
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:error-bar", "Failed to copy global error message.", caughtError);
    }
  }, [error, showAppAlert, writeAppLog]);

  const globalErrorRecovery = useMemo(() => {
    const message = error?.trim() ?? "";
    if (!message) {
      return {
        canReconnect: false,
        canOpenLogs: false,
        canCopyLatestDisconnectReport: false,
        hint: ""
      };
    }
    const reconnectLike = isReconnectRecoverableError(message);
    const bridgeLike = isBridgeUnavailableError(message);
    return {
      canReconnect:
        reconnectLike &&
        !!terminalApi &&
        !!activeTabId &&
        !!activeSessionId &&
        !isActiveTabConnected,
      canOpenLogs: !!(systemApi?.openLocalPath && systemApi.getLogInfo),
      canCopyLatestDisconnectReport: disconnectReports.length > 0,
      hint: bridgeLike
        ? "Bridge/runtime issue detected. Open Diagnostics and logs."
        : reconnectLike
          ? "Connection issue detected. Reconnect may recover quickly."
          : ""
    };
  }, [
    activeSessionId,
    activeTabId,
    disconnectReports.length,
    error,
    isActiveTabConnected,
    systemApi,
    terminalApi
  ]);

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
      const disconnectReportSnapshot = {
        capturedAtIso: new Date().toISOString(),
        totalReports: disconnectReports.length,
        latestReportId: disconnectReports[0]?.id ?? "",
        latestCreatedAt: disconnectReports[0]?.createdAt ?? "",
        reports: disconnectReports.slice(0, 64)
      };
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
          selectedSessionId,
          disconnectReportCount: disconnectReports.length
        },
        disconnectReports: disconnectReportSnapshot
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
    disconnectReports,
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

  const copyDisconnectReportJson = useCallback(
    async (report: DisconnectReportItem) => {
      try {
        const payload = {
          appVersion: APP_VERSION,
          copiedAtIso: new Date().toISOString(),
          report
        };
        const copied = await copyTextToClipboard(`${JSON.stringify(payload, null, 2)}\n`);
        if (!copied) {
          throw new Error("Clipboard unavailable.");
        }
        await showAppAlert("Disconnect report JSON copied to clipboard.", {
          title: "Diagnostics"
        });
      } catch (caughtError) {
        const message = toLogMessage(caughtError);
        setError(message);
        writeAppLog(
          "error",
          "renderer:diagnostics",
          "Failed to copy disconnect report JSON.",
          caughtError
        );
      }
    },
    [showAppAlert, writeAppLog]
  );

  const exportDisconnectReportsJson = useCallback(async () => {
    if (visibleDisconnectReports.length === 0) {
      await showAppAlert("No matching disconnect reports for the current filter.", {
        title: "Diagnostics"
      });
      return;
    }
    const payload = {
      appVersion: APP_VERSION,
      exportedAtIso: new Date().toISOString(),
      reportCount: visibleDisconnectReports.length,
      totalReportCount: disconnectReports.length,
      reports: visibleDisconnectReports
    };
    const exportText = `${JSON.stringify(payload, null, 2)}\n`;
    try {
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Disconnect Reports (JSON)",
          defaultFileName: `termdock-disconnect-reports-${Date.now()}${hasCustomizedDisconnectReportView ? "-filtered" : ""}.json`,
          text: exportText,
          filters: [
            {
              name: "JSON",
              extensions: ["json"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copied = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copied
              ? `Disconnect reports exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `Disconnect reports exported:\n${result.outputPath}`,
            {
              title: "Diagnostics"
            }
          );
          return;
        }
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("Disconnect reports JSON copied to clipboard.", {
          title: "Diagnostics"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the disconnect reports below manually.", {
        title: "Diagnostics",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:diagnostics", "Failed to export disconnect reports.", caughtError);
    }
  }, [
    disconnectReports.length,
    hasCustomizedDisconnectReportView,
    showAppAlert,
    systemApi,
    visibleDisconnectReports,
    writeAppLog
  ]);

  const exportDisconnectReportsCsv = useCallback(async () => {
    if (visibleDisconnectReports.length === 0) {
      await showAppAlert("No matching disconnect reports for the current filter.", {
        title: "Diagnostics"
      });
      return;
    }
    const lines: string[] = [];
    lines.push("# TermDock Disconnect Reports");
    lines.push(`generatedAtIso,${escapeCsvCell(new Date().toISOString())}`);
    lines.push(`reportCount,${visibleDisconnectReports.length}`);
    lines.push(`totalReportCount,${disconnectReports.length}`);
    lines.push("");
    lines.push(
      [
        "id",
        "createdAt",
        "sessionName",
        "target",
        "tabTitle",
        "trigger",
        "status",
        "message",
        "connectedTabCount",
        "openTabCount",
        "uploadRunning",
        "uploadQueued",
        "downloadRunning",
        "downloadQueued",
        "portForwardTotal",
        "portForwardDegraded",
        "autoReconnect",
        "reconnectDelaySeconds",
        "recentFailures"
      ].join(",")
    );
    for (const report of visibleDisconnectReports) {
      const recentFailures = report.recentFailures
        .slice(0, 5)
        .map(
          (failure) =>
            `${failure.direction}:${failure.name} (${classifyTransferFailureReason(failure.message)})`
        )
        .join(" | ");
      lines.push(
        [
          escapeCsvCell(report.id),
          escapeCsvCell(report.createdAt),
          escapeCsvCell(report.sessionName),
          escapeCsvCell(report.target),
          escapeCsvCell(report.tabTitle),
          escapeCsvCell(report.trigger),
          escapeCsvCell(report.status ?? ""),
          escapeCsvCell(report.message),
          escapeCsvCell(report.connectedTabCount),
          escapeCsvCell(report.openTabCount),
          escapeCsvCell(report.uploadRunning),
          escapeCsvCell(report.uploadQueued),
          escapeCsvCell(report.downloadRunning),
          escapeCsvCell(report.downloadQueued),
          escapeCsvCell(report.portForwardTotal),
          escapeCsvCell(report.portForwardDegraded),
          escapeCsvCell(report.autoReconnect ? "true" : "false"),
          escapeCsvCell(report.reconnectDelaySeconds),
          escapeCsvCell(recentFailures)
        ].join(",")
      );
    }
    const exportText = `${lines.join("\n")}\n`;
    try {
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Disconnect Reports (CSV)",
          defaultFileName: `termdock-disconnect-reports-${Date.now()}${hasCustomizedDisconnectReportView ? "-filtered" : ""}.csv`,
          text: exportText,
          filters: [
            {
              name: "CSV",
              extensions: ["csv"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copied = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copied
              ? `Disconnect reports CSV exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `Disconnect reports CSV exported:\n${result.outputPath}`,
            {
              title: "Diagnostics"
            }
          );
          return;
        }
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("Disconnect reports CSV copied to clipboard.", {
          title: "Diagnostics"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the disconnect reports CSV below manually.", {
        title: "Diagnostics",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:diagnostics", "Failed to export disconnect reports CSV.", caughtError);
    }
  }, [
    disconnectReports.length,
    hasCustomizedDisconnectReportView,
    showAppAlert,
    systemApi,
    visibleDisconnectReports,
    writeAppLog
  ]);

  const copyLatestDisconnectReport = useCallback(async () => {
    const latestReport = disconnectReports[0];
    if (!latestReport) {
      await showAppAlert("No disconnect reports captured yet.", {
        title: "Diagnostics"
      });
      return;
    }
    await copyDisconnectReportJson(latestReport);
  }, [copyDisconnectReportJson, disconnectReports, showAppAlert]);

  const copyLatestVisibleDisconnectReport = useCallback(async () => {
    const latestReport = visibleDisconnectReports[0];
    if (!latestReport) {
      await showAppAlert("No matching disconnect reports for the current filter.", {
        title: "Diagnostics"
      });
      return;
    }
    await copyDisconnectReportJson(latestReport);
  }, [copyDisconnectReportJson, showAppAlert, visibleDisconnectReports]);

  const clearVisibleDisconnectReportsHistory = useCallback(async () => {
    if (visibleDisconnectReports.length === 0) {
      return;
    }
    const visibleIds = new Set(visibleDisconnectReports.map((entry) => entry.id));
    const confirmed = await showAppConfirm(
      `Clear ${visibleDisconnectReports.length} visible disconnect report(s)?`,
      {
        title: "Diagnostics",
        confirmLabel: "Clear Visible",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    setDisconnectReports((prev) => prev.filter((entry) => !visibleIds.has(entry.id)));
    await showAppAlert("Visible disconnect reports cleared.", {
      title: "Diagnostics"
    });
  }, [showAppAlert, showAppConfirm, visibleDisconnectReports]);

  const clearDisconnectReportsHistory = useCallback(async () => {
    if (disconnectReports.length === 0) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Clear ${disconnectReports.length} disconnect report(s)?`,
      {
        title: "Diagnostics",
        confirmLabel: "Clear",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    setDisconnectReports([]);
    disconnectReportFingerprintByTabRef.current.clear();
    await showAppAlert("Disconnect reports cleared.", {
      title: "Diagnostics"
    });
  }, [disconnectReports.length, showAppAlert, showAppConfirm]);

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
      resetEnsuredRemoteDirectoryCacheForTab(activeTabId);
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
      resetEnsuredRemoteDirectoryCacheForTab(activeTabId);
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
      resetEnsuredRemoteDirectoryCacheForTab(activeTabId);
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
    async (
      targets: DownloadTargetEntry[],
      context?: {
        tabId?: string;
        sessionId?: string;
      }
    ): Promise<DownloadTargetEntry[] | null> => {
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

      const preparedInputs: Array<{
        name: string;
        remotePath: string;
        localPath: string;
        directoryPath: string;
        fileName: string;
      }> = [];
      const uniqueDirectories = new Set<string>();
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
        preparedInputs.push({
          name: target.name,
          remotePath,
          localPath: joinLocalPath(directoryPath, fileName),
          directoryPath,
          fileName
        });
        uniqueDirectories.add(directoryPath);
      }

      await runWithConcurrencyLimit(Array.from(uniqueDirectories), 6, async (directoryPath) => {
        await getKnownLocalNames(directoryPath);
      });

      const preparedTargets: PreparedDownloadTarget[] = [];
      let conflictCount = 0;
      for (const target of preparedInputs) {
        const knownNames = knownLocalNamesByDirectory.get(target.directoryPath) ?? new Set<string>();
        const plannedNames =
          plannedLocalNamesByDirectory.get(target.directoryPath) ?? new Set(knownNames);
        plannedLocalNamesByDirectory.set(target.directoryPath, plannedNames);
        if (plannedNames.has(target.fileName)) {
          conflictCount += 1;
        }
        plannedNames.add(target.fileName);
        preparedTargets.push({
          name: target.name,
          remotePath: target.remotePath,
          localPath: target.localPath,
          directoryPath: target.directoryPath,
          fileName: target.fileName,
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

      const explicitSessionId =
        typeof context?.sessionId === "string" ? context.sessionId.trim() : "";
      const contextTabId = typeof context?.tabId === "string" ? context.tabId.trim() : "";
      const sessionIdForStrategy =
        explicitSessionId ||
        (contextTabId ? getSessionIdForTab(contextTabId) ?? "" : activeSessionId ?? "");
      const rememberedStrategy = sessionIdForStrategy
        ? sessionTransferConflictStrategyState.bySessionId[sessionIdForStrategy]?.download
        : undefined;
      let strategy: TransferConflictStrategy;
      if (rememberedStrategy) {
        strategy = rememberedStrategy;
      } else {
        const strategyChoice = await showAppChoice(
          `Found ${conflictCount} local conflicts in this download batch. Choose one strategy for all conflicts.`,
          [
            { value: "overwrite", label: "Overwrite (Once)" },
            { value: "skip", label: "Skip (Once)" },
            { value: "rename", label: "Rename (Once)" },
            { value: "overwriteRemember", label: "Overwrite + Remember for Session" },
            { value: "skipRemember", label: "Skip + Remember for Session" },
            { value: "renameRemember", label: "Rename + Remember for Session" }
          ],
          {
            title: "Download Conflicts",
            cancelLabel: "Cancel Download"
          }
        );
        const parsedChoice = parseTransferConflictChoice(strategyChoice);
        if (!parsedChoice) {
          return null;
        }
        strategy = parsedChoice.strategy;
        if (parsedChoice.remember && sessionIdForStrategy) {
          rememberSessionTransferConflictStrategy(sessionIdForStrategy, "download", strategy);
          if (contextTabId) {
            showTransferDockNotice(
              contextTabId,
              "info",
              `Saved download conflict default for this session: ${formatTransferConflictStrategyLabel(strategy)}.`,
              6000
            );
          }
        }
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
    [
      activeSessionId,
      getSessionIdForTab,
      rememberSessionTransferConflictStrategy,
      sessionTransferConflictStrategyState.bySessionId,
      showAppAlert,
      showAppChoice,
      showTransferDockNotice,
      systemApi
    ]
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
        remoteDirectoryKey: string;
        targetName: string;
        knownNames: Set<string>;
      };

      const preparedInputs: Array<{
        localPath: string;
        relativeDirectory: string;
        remoteName?: string;
        remoteDirectory: string;
        remoteDirectoryKey: string;
        targetName: string;
      }> = [];
      const remoteDirectoryEntries = new Map<string, string>();
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
        preparedInputs.push({
          localPath,
          relativeDirectory: pathEntry.relativeDirectory,
          remoteName: pathEntry.remoteName,
          remoteDirectory,
          remoteDirectoryKey,
          targetName
        });
        if (!remoteDirectoryEntries.has(remoteDirectoryKey)) {
          remoteDirectoryEntries.set(remoteDirectoryKey, remoteDirectory);
        }
      }

      await runWithConcurrencyLimit(Array.from(remoteDirectoryEntries.values()), 6, async (directory) => {
        await getKnownRemoteNames(directory);
      });

      const preparedEntries: PreparedUploadEntry[] = [];
      let conflictCount = 0;
      for (const entry of preparedInputs) {
        const knownNames = knownRemoteNamesByDirectory.get(entry.remoteDirectoryKey) ?? new Set<string>();
        const plannedNames =
          plannedRemoteNamesByDirectory.get(entry.remoteDirectoryKey) ?? new Set(knownNames);
        plannedRemoteNamesByDirectory.set(entry.remoteDirectoryKey, plannedNames);
        if (plannedNames.has(entry.targetName)) {
          conflictCount += 1;
        }
        plannedNames.add(entry.targetName);
        preparedEntries.push({
          localPath: entry.localPath,
          relativeDirectory: entry.relativeDirectory,
          remoteName: entry.remoteName,
          remoteDirectory: entry.remoteDirectory,
          remoteDirectoryKey: entry.remoteDirectoryKey,
          targetName: entry.targetName,
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

      const sessionIdForStrategy = getSessionIdForTab(tabId) ?? activeSessionId ?? "";
      const rememberedStrategy = sessionIdForStrategy
        ? sessionTransferConflictStrategyState.bySessionId[sessionIdForStrategy]?.upload
        : undefined;
      let strategy: TransferConflictStrategy;
      if (rememberedStrategy) {
        strategy = rememberedStrategy;
      } else {
        const strategyChoice = await showAppChoice(
          `Found ${conflictCount} remote conflicts in this upload batch. Choose one strategy for all conflicts.`,
          [
            { value: "overwrite", label: "Overwrite (Once)" },
            { value: "skip", label: "Skip (Once)" },
            { value: "rename", label: "Rename (Once)" },
            { value: "overwriteRemember", label: "Overwrite + Remember for Session" },
            { value: "skipRemember", label: "Skip + Remember for Session" },
            { value: "renameRemember", label: "Rename + Remember for Session" }
          ],
          {
            title: "Upload Conflicts",
            cancelLabel: "Cancel Upload"
          }
        );
        const parsedChoice = parseTransferConflictChoice(strategyChoice);
        if (!parsedChoice) {
          return null;
        }
        strategy = parsedChoice.strategy;
        if (parsedChoice.remember && sessionIdForStrategy) {
          rememberSessionTransferConflictStrategy(sessionIdForStrategy, "upload", strategy);
          showTransferDockNotice(
            tabId,
            "info",
            `Saved upload conflict default for this session: ${formatTransferConflictStrategyLabel(strategy)}.`,
            6000
          );
        }
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
    [
      activeSessionId,
      getSessionIdForTab,
      rememberSessionTransferConflictStrategy,
      sessionTransferConflictStrategyState.bySessionId,
      sftpApi,
      showAppAlert,
      showAppChoice,
      showTransferDockNotice
    ]
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

      const resolvedTargets = await resolveDownloadTargetConflicts(discoveredFileTargets, {
        tabId: activeTabId,
        sessionId: activeSessionId ?? undefined
      });
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
      writeAppLog("info", "renderer:sftp-batch", "Queued download directory batch.", {
        tabId: activeTabId,
        batchId,
        sourcePath: targetEntry.path,
        destinationDirectory,
        queuedFiles: totalQueuedFiles,
        skippedEntries
      });

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
      const resolvedTargets = await resolveDownloadTargetConflicts(
        [
          {
            name: targetEntry.name,
            remotePath: targetEntry.path,
            localPath
          }
        ],
        {
          tabId: activeTabId,
          sessionId: activeSessionId ?? undefined
        }
      );
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
      writeAppLog("info", "renderer:sftp-batch", "Queued upload batch.", {
        tabId: activeTabId,
        batchId,
        remoteDirectory: sftpDirectory.cwd,
        queuedFiles: totalQueuedFiles,
        skippedEntries
      });
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

  const cancelAllUploadsForTab = useCallback(
    async (tabId: string): Promise<void> => {
      const normalizedTabId = tabId.trim();
      if (!normalizedTabId) {
        return;
      }
      const activeBatchId = uploadBatchByTab[normalizedTabId]?.batchId;
      if (activeBatchId) {
        canceledUploadBatchIdsRef.current.add(activeBatchId);
      }
      setUploadBatchByTab((prev) => {
        if (!prev[normalizedTabId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[normalizedTabId];
        return next;
      });
      setPausedUploadTabs((prev) => {
        if (!prev[normalizedTabId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[normalizedTabId];
        return next;
      });
      const queuedJobs = uploadQueueRef.current.filter((job) => job.tabId === normalizedTabId);
      const queuedTransferIds = new Set(queuedJobs.map((job) => job.transferId));
      if (queuedJobs.length > 0) {
        uploadQueueRef.current = uploadQueueRef.current.filter((job) => job.tabId !== normalizedTabId);
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
          transfer.tabId !== normalizedTabId ||
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
        if (runningTabId === normalizedTabId) {
          transferIdsToCancel.add(transferId);
        }
      }
      if (!sftpApi) {
        drainUploadQueue();
        return;
      }
      await Promise.allSettled(
        Array.from(transferIdsToCancel).map((transferId) =>
          sftpApi.cancelUpload(normalizedTabId, transferId)
        )
      );
      drainUploadQueue();
    },
    [applySftpTransferEvent, drainUploadQueue, sftpApi, sftpTransfers, uploadBatchByTab]
  );

  const cancelAllDownloadsForTab = useCallback(
    async (tabId: string): Promise<void> => {
      const normalizedTabId = tabId.trim();
      if (!normalizedTabId) {
        return;
      }
      const activeBatchId = downloadBatchByTab[normalizedTabId]?.batchId;
      if (activeBatchId) {
        canceledDownloadBatchIdsRef.current.add(activeBatchId);
      }
      setDownloadBatchByTab((prev) => {
        if (!prev[normalizedTabId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[normalizedTabId];
        return next;
      });
      setPausedDownloadTabs((prev) => {
        if (!prev[normalizedTabId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[normalizedTabId];
        return next;
      });
      const queuedJobs = downloadQueueRef.current.filter((job) => job.tabId === normalizedTabId);
      const queuedTransferIds = new Set(queuedJobs.map((job) => job.transferId));
      if (queuedJobs.length > 0) {
        downloadQueueRef.current = downloadQueueRef.current.filter(
          (job) => job.tabId !== normalizedTabId
        );
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
          transfer.tabId !== normalizedTabId ||
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
        if (runningTabId === normalizedTabId) {
          transferIdsToCancel.add(transferId);
        }
      }
      if (!sftpApi) {
        drainDownloadQueue();
        return;
      }
      await Promise.allSettled(
        Array.from(transferIdsToCancel).map((transferId) =>
          sftpApi.cancelDownload(normalizedTabId, transferId)
        )
      );
      drainDownloadQueue();
    },
    [applySftpTransferEvent, downloadBatchByTab, drainDownloadQueue, sftpApi, sftpTransfers]
  );

  const cancelTransferTasksForTab = useCallback(
    async (tabId: string): Promise<void> => {
      await cancelAllUploadsForTab(tabId);
      await cancelAllDownloadsForTab(tabId);
    },
    [cancelAllDownloadsForTab, cancelAllUploadsForTab]
  );

  const cancelAllActiveUploads = useCallback(async () => {
    if (!activeTabId) {
      return;
    }
    await cancelAllUploadsForTab(activeTabId);
  }, [activeTabId, cancelAllUploadsForTab]);

  const cancelAllActiveDownloads = useCallback(async () => {
    if (!activeTabId) {
      return;
    }
    await cancelAllDownloadsForTab(activeTabId);
  }, [activeTabId, cancelAllDownloadsForTab]);

  const cancelAllTransfersAcrossTabs = useCallback(async () => {
    if (isOperationCenterBulkCanceling) {
      return;
    }
    if (operationCenterTransferTabSummaries.length === 0) {
      if (activeTabId) {
        showTransferDockNotice(activeTabId, "info", "No active transfer tasks across tabs.");
      }
      return;
    }
    setIsOperationCenterBulkCanceling(true);
    try {
      for (const summary of operationCenterTransferTabSummaries) {
        await cancelTransferTasksForTab(summary.tabId);
      }
      if (activeTabId) {
        showTransferDockNotice(
          activeTabId,
          "warn",
          `Canceled active transfer tasks across ${operationCenterTransferTabSummaries.length} tab(s).`,
          8000
        );
      }
    } finally {
      setIsOperationCenterBulkCanceling(false);
    }
  }, [
    activeTabId,
    cancelTransferTasksForTab,
    isOperationCenterBulkCanceling,
    operationCenterTransferTabSummaries,
    showTransferDockNotice
  ]);

  const clearPendingTransferRestoreQueue = useCallback(
    (markResolved = true) => {
      setPendingTransferRestoreItems([]);
      if (markResolved) {
        setPendingTransferRestoreResolved(true);
      }
      try {
        window.localStorage.removeItem(SFTP_TRANSFER_PENDING_RESTORE_STORAGE_KEY);
      } catch {
        // Ignore storage failures; runtime state still applies.
      }
    },
    []
  );

  const discardPendingTransferRestoreQueue = useCallback(async () => {
    if (pendingTransferRestoreItems.length === 0) {
      clearPendingTransferRestoreQueue(true);
      return;
    }
    const confirmed = await showAppConfirm(
      `Discard ${pendingTransferRestoreItems.length} saved pending transfer task(s) from previous run?`,
      {
        title: "Discard Pending Queue",
        confirmLabel: "Discard",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    clearPendingTransferRestoreQueue(true);
    if (activeTabId) {
      showTransferDockNotice(activeTabId, "warn", "Discarded saved pending transfer queue.");
    }
  }, [
    activeTabId,
    clearPendingTransferRestoreQueue,
    pendingTransferRestoreItems.length,
    showAppConfirm,
    showTransferDockNotice
  ]);

  const restorePendingTransferRestoreQueue = useCallback(async () => {
    if (pendingTransferRestoreItems.length === 0) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Restore ${pendingTransferRestoreItems.length} saved pending transfer task(s)? Missing sessions will be skipped.`,
      {
        title: "Restore Pending Queue",
        confirmLabel: "Restore",
        cancelLabel: "Cancel"
      }
    );
    if (!confirmed) {
      return;
    }

    const uploadTargetsByTab = new Map<
      string,
      Array<{
        name: string;
        localPath: string;
        remotePath: string;
      }>
    >();
    const downloadTargetsByTab = new Map<string, DownloadTargetEntry[]>();
    let skippedMissingSessions = 0;
    let skippedInvalidEntries = 0;
    let openedTabs = 0;

    for (const item of pendingTransferRestoreItems) {
      const session = sessionsRef.current.find((entry) => entry.id === item.sessionId) ?? null;
      if (!session) {
        skippedMissingSessions += 1;
        continue;
      }
      const localPath = item.localPath.trim();
      const remotePath = item.remotePath.trim();
      const name = item.name.trim();
      if (!localPath || !remotePath || !name) {
        skippedInvalidEntries += 1;
        continue;
      }

      let tabId = terminalTabsRef.current.find((tab) => tab.sessionId === session.id)?.id ?? null;
      if (!tabId) {
        const openedTabId = openTerminalTab(session);
        if (!openedTabId) {
          skippedInvalidEntries += 1;
          continue;
        }
        tabId = openedTabId;
        openedTabs += 1;
      }

      if (item.direction === "upload") {
        const targets = uploadTargetsByTab.get(tabId) ?? [];
        if (
          !targets.some(
            (entry) =>
              entry.localPath.trim() === localPath && entry.remotePath.trim() === remotePath
          )
        ) {
          targets.push({
            name,
            localPath,
            remotePath
          });
        }
        uploadTargetsByTab.set(tabId, targets);
      } else {
        const targets = downloadTargetsByTab.get(tabId) ?? [];
        if (
          !targets.some(
            (entry) =>
              entry.localPath.trim() === localPath && entry.remotePath.trim() === remotePath
          )
        ) {
          targets.push({
            name,
            localPath,
            remotePath
          });
        }
        downloadTargetsByTab.set(tabId, targets);
      }
    }

    let queuedUploads = 0;
    let queuedDownloads = 0;
    for (const [tabId, targets] of uploadTargetsByTab.entries()) {
      queuedUploads += enqueueUploadTargets(tabId, targets, { suppressEmptyError: true });
    }
    for (const [tabId, targets] of downloadTargetsByTab.entries()) {
      queuedDownloads += enqueueDownloadTargets(tabId, targets, { suppressEmptyError: true });
    }

    clearPendingTransferRestoreQueue(true);
    await showAppAlert(
      `Restore completed.\nQueued uploads: ${queuedUploads}\nQueued downloads: ${queuedDownloads}\nOpened tabs: ${openedTabs}\nSkipped missing sessions: ${skippedMissingSessions}\nSkipped invalid entries: ${skippedInvalidEntries}`,
      {
        title: "Restore Pending Queue"
      }
    );
  }, [
    clearPendingTransferRestoreQueue,
    enqueueDownloadTargets,
    enqueueUploadTargets,
    openTerminalTab,
    pendingTransferRestoreItems,
    showAppAlert,
    showAppConfirm
  ]);

  const reconnectOperationTabById = useCallback(
    async (tabId: string): Promise<boolean> => {
      const normalizedTabId = tabId.trim();
      if (!normalizedTabId || !terminalApi) {
        return false;
      }
      const tab = terminalTabsRef.current.find((entry) => entry.id === normalizedTabId);
      if (!tab) {
        return false;
      }
      try {
        await terminalApi.connect(normalizedTabId, tab.sessionId);
        return true;
      } catch (caughtError) {
        const message = toLogMessage(caughtError);
        setError(message);
        writeAppLog(
          "warn",
          "renderer:operation-center",
          "Reconnect action failed for operation-center tab.",
          {
            tabId: normalizedTabId,
            sessionId: tab.sessionId,
            message
          }
        );
        return false;
      }
    },
    [terminalApi, writeAppLog]
  );

  const reconnectDisconnectedOperationTabs = useCallback(async () => {
    if (isOperationCenterReconnecting) {
      return;
    }
    const targets = operationCenterTransferTabSummaries.filter((entry) => !entry.connected);
    if (targets.length === 0) {
      if (activeTabId) {
        showTransferDockNotice(activeTabId, "info", "No disconnected transfer tabs to reconnect.");
      }
      return;
    }
    setIsOperationCenterReconnecting(true);
    try {
      let successCount = 0;
      let failedCount = 0;
      for (const target of targets) {
        const ok = await reconnectOperationTabById(target.tabId);
        if (ok) {
          successCount += 1;
        } else {
          failedCount += 1;
        }
      }
      if (activeTabId) {
        showTransferDockNotice(
          activeTabId,
          failedCount > 0 ? "warn" : "info",
          failedCount > 0
            ? `Reconnect completed: ${successCount} succeeded, ${failedCount} failed.`
            : `Reconnect completed: ${successCount} tab(s) requested.`,
          8000
        );
      }
    } finally {
      setIsOperationCenterReconnecting(false);
    }
  }, [
    activeTabId,
    isOperationCenterReconnecting,
    operationCenterTransferTabSummaries,
    reconnectOperationTabById,
    showTransferDockNotice
  ]);

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

  const openOperationCenter = useCallback(() => {
    setIsOperationCenterOpen(true);
  }, []);

  const closeOperationCenter = useCallback(() => {
    setIsOperationCenterOpen(false);
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

  const exportRetryCenterVisibleHistoryJson = async () => {
    try {
      const generatedAtIso = new Date().toISOString();
      const exportPayload = {
        exportedAtIso: generatedAtIso,
        appVersion: APP_VERSION,
        filters: {
          scope: retryCenterScope,
          direction: retryCenterDirection,
          status: retryCenterStatus,
          timeRange: retryCenterTimeRange,
          listMode: retryCenterListMode,
          failureReason: retryCenterFailureReasonExportValue,
          query: retryCenterQuery.trim()
        },
        stats: {
          visibleCount: retryCenterEntries.length,
          totalHistoryCount: transferHistory.length,
          selectedCount: selectedRetryCenterEntries.length,
          failedVisibleCount: retryCenterAnalytics.failedCount,
          failedVisibleRatioPercent: Number(
            retryCenterAnalytics.failedRatioPercent.toFixed(2)
          ),
          directionCounts: retryCenterAnalytics.directionCounts,
          statusCounts: retryCenterAnalytics.statusCounts,
          topSessions: retryCenterAnalytics.topSessions,
          topGroups: retryCenterAnalytics.topGroups,
          topFailureReasons: retryCenterAnalytics.topFailureReasons
        },
        entries: retryCenterVisibleExportEntries
      };
      const exportText = `${JSON.stringify(exportPayload, null, 2)}\n`;
      const dateSegment = generatedAtIso.replace(/[:]/g, "-");
      const scopeSegment = retryCenterScope === "activeSession" ? "active-session" : "all-sessions";
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Retry Center (JSON)",
          defaultFileName: `termdock-retry-center-${scopeSegment}-${dateSegment}.json`,
          text: exportText,
          filters: [
            {
              name: "JSON",
              extensions: ["json"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `Retry Center JSON exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `Retry Center JSON exported:\n${result.outputPath}`,
            {
              title: "Retry Center"
            }
          );
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("Retry Center JSON copied to clipboard.", {
          title: "Retry Center"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the JSON below manually.", {
        title: "Retry Center",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:retry-center",
        "Failed to export retry center JSON.",
        caughtError
      );
    }
  };

  const exportRetryCenterVisibleHistoryCsv = async () => {
    try {
      const generatedAtIso = new Date().toISOString();
      const lines: string[] = [];
      lines.push("# TermDock Retry Center Export");
      lines.push(`# Format: CSV`);
      lines.push(`# Generated: ${generatedAtIso}`);
      lines.push(`# AppVersion: ${APP_VERSION}`);
      lines.push(
        `# Filters: scope=${retryCenterScope}, direction=${retryCenterDirection}, status=${retryCenterStatus}, timeRange=${retryCenterTimeRange}, listMode=${retryCenterListMode}, failureReason=${retryCenterFailureReasonExportValue}, query=${retryCenterQuery.trim() || "-"}`
      );
      lines.push(
        `# Counts: visible=${retryCenterEntries.length}, total=${transferHistory.length}, selected=${selectedRetryCenterEntries.length}`
      );
      lines.push(
        `# TopFailureReasons: ${
          retryCenterAnalytics.topFailureReasons.length > 0
            ? retryCenterAnalytics.topFailureReasons
                .map((entry) => `${entry.reason}(${entry.total})`)
                .join(" | ")
            : "-"
        }`
      );
      lines.push("");
      lines.push(
        [
          "key",
          "sessionId",
          "sessionName",
          "groupName",
          "direction",
          "status",
          "name",
          "localPath",
          "remotePath",
          "attemptCount",
          "updatedAt",
          "updatedAtIso",
          "message"
        ].join(",")
      );
      for (const entry of retryCenterVisibleExportEntries) {
        lines.push(
          [
            entry.key,
            entry.sessionId,
            entry.sessionName,
            entry.groupName,
            entry.direction,
            entry.status,
            entry.name,
            entry.localPath,
            entry.remotePath,
            entry.attemptCount,
            entry.updatedAt,
            entry.updatedAtIso,
            entry.message
          ]
            .map((value) => escapeCsvCell(value))
            .join(",")
        );
      }
      const exportText = `${lines.join("\n")}\n`;
      const dateSegment = generatedAtIso.replace(/[:]/g, "-");
      const scopeSegment = retryCenterScope === "activeSession" ? "active-session" : "all-sessions";
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Retry Center (CSV)",
          defaultFileName: `termdock-retry-center-${scopeSegment}-${dateSegment}.csv`,
          text: exportText,
          filters: [
            {
              name: "CSV",
              extensions: ["csv"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `Retry Center CSV exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `Retry Center CSV exported:\n${result.outputPath}`,
            {
              title: "Retry Center"
            }
          );
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("Retry Center CSV copied to clipboard.", {
          title: "Retry Center"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the CSV below manually.", {
        title: "Retry Center",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:retry-center",
        "Failed to export retry center CSV.",
        caughtError
      );
    }
  };

  const chooseRetryCenterGroupExportScope = async (
    groupKey: string,
    format: "json" | "csv"
  ): Promise<RetryCenterGroupExportScope | null> => {
    const group = retryCenterGroupedEntries.find((entry) => entry.key === groupKey);
    if (!group || group.entries.length === 0) {
      await showAppAlert("No visible records in this group to export.", {
        title: "Retry Center"
      });
      return null;
    }
    const choices: AppChoiceDialogOption[] = [
      {
        value: "all",
        label: `All (${group.total})`
      }
    ];
    if (group.failedCount > 0) {
      choices.push({
        value: "failed",
        label: `Failed (${group.failedCount})`
      });
    }
    if (group.activeSessionFailedCount > 0) {
      choices.push({
        value: "retryable",
        label: `Retryable Active Session (${group.activeSessionFailedCount})`
      });
    }
    if (choices.length === 1) {
      return "all";
    }
    const choice = await showAppChoice(
      `Choose ${format.toUpperCase()} export scope for "${group.label}".`,
      choices,
      {
        title: "Retry Center",
        cancelLabel: "Cancel"
      }
    );
    if (choice !== "all" && choice !== "failed" && choice !== "retryable") {
      return null;
    }
    return choice;
  };

  const getRetryCenterGroupEntriesForExportScope = (
    group: (typeof retryCenterGroupedEntries)[number],
    exportScope: RetryCenterGroupExportScope
  ): SftpTransferHistoryItem[] => {
    if (exportScope === "all") {
      return group.entries;
    }
    if (exportScope === "failed") {
      return group.entries.filter((entry) => entry.status === "failed");
    }
    if (!activeSessionId) {
      return [];
    }
    return group.entries.filter(
      (entry) => entry.status === "failed" && entry.sessionId === activeSessionId
    );
  };

  const exportRetryCenterGroupHistoryJson = async (
    groupKey: string,
    exportScope: RetryCenterGroupExportScope = "all"
  ) => {
    const group = retryCenterGroupedEntries.find((entry) => entry.key === groupKey);
    if (!group || group.entries.length === 0) {
      await showAppAlert("No visible records in this group to export.", {
        title: "Retry Center"
      });
      return;
    }
    const scopedEntries = getRetryCenterGroupEntriesForExportScope(group, exportScope);
    if (scopedEntries.length === 0) {
      await showAppAlert(`No "${exportScope}" records available in this group.`, {
        title: "Retry Center"
      });
      return;
    }
    try {
      const generatedAtIso = new Date().toISOString();
      const exportEntries = scopedEntries.map((entry) => {
        const sessionMeta = retryCenterSessionMetaById.get(entry.sessionId);
        return {
          key: entry.key,
          sessionId: entry.sessionId,
          sessionName: sessionMeta?.sessionName ?? entry.sessionId,
          groupName: sessionMeta?.groupName ?? "Unknown",
          direction: entry.direction,
          status: entry.status,
          name: entry.name,
          localPath: entry.localPath,
          remotePath: entry.remotePath,
          attemptCount: entry.attemptCount,
          updatedAt: entry.updatedAt,
          updatedAtIso: toIsoTimestamp(entry.updatedAt),
          failureReason:
            entry.status === "failed" ? classifyTransferFailureReason(entry.message) : "",
          message: entry.message ?? ""
        };
      });
      const exportPayload = {
        exportedAtIso: generatedAtIso,
        appVersion: APP_VERSION,
        filters: {
          scope: retryCenterScope,
          direction: retryCenterDirection,
          status: retryCenterStatus,
          timeRange: retryCenterTimeRange,
          listMode: retryCenterListMode,
          failureReason: retryCenterFailureReasonExportValue,
          groupExportScope: exportScope,
          query: retryCenterQuery.trim()
        },
        group: {
          key: group.key,
          label: group.label,
          total: group.total,
          failedCount: group.failedCount,
          activeSessionFailedCount: group.activeSessionFailedCount,
          exportedCount: scopedEntries.length
        },
        entries: exportEntries
      };
      const exportText = `${JSON.stringify(exportPayload, null, 2)}\n`;
      const dateSegment = generatedAtIso.replace(/[:]/g, "-");
      const groupSegment =
        group.label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 48) || "group";
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Retry Center Group (JSON)",
          defaultFileName: `termdock-retry-center-group-${groupSegment}-${exportScope}-${dateSegment}.json`,
          text: exportText,
          filters: [
            {
              name: "JSON",
              extensions: ["json"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `Retry Center group JSON exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `Retry Center group JSON exported:\n${result.outputPath}`,
            {
              title: "Retry Center"
            }
          );
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("Retry Center group JSON copied to clipboard.", {
          title: "Retry Center"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the JSON below manually.", {
        title: "Retry Center",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:retry-center",
        "Failed to export retry center group JSON.",
        caughtError
      );
    }
  };

  const exportRetryCenterGroupHistoryCsv = async (
    groupKey: string,
    exportScope: RetryCenterGroupExportScope = "all"
  ) => {
    const group = retryCenterGroupedEntries.find((entry) => entry.key === groupKey);
    if (!group || group.entries.length === 0) {
      await showAppAlert("No visible records in this group to export.", {
        title: "Retry Center"
      });
      return;
    }
    const scopedEntries = getRetryCenterGroupEntriesForExportScope(group, exportScope);
    if (scopedEntries.length === 0) {
      await showAppAlert(`No "${exportScope}" records available in this group.`, {
        title: "Retry Center"
      });
      return;
    }
    try {
      const generatedAtIso = new Date().toISOString();
      const lines: string[] = [];
      lines.push("# TermDock Retry Center Group Export");
      lines.push(`# Format: CSV`);
      lines.push(`# Generated: ${generatedAtIso}`);
      lines.push(`# AppVersion: ${APP_VERSION}`);
      lines.push(
        `# Filters: scope=${retryCenterScope}, direction=${retryCenterDirection}, status=${retryCenterStatus}, timeRange=${retryCenterTimeRange}, listMode=${retryCenterListMode}, failureReason=${retryCenterFailureReasonExportValue}, groupExportScope=${exportScope}, query=${retryCenterQuery.trim() || "-"}`
      );
      lines.push(
        `# Group: key=${group.key}, label=${group.label}, total=${group.total}, failed=${group.failedCount}, activeSessionFailed=${group.activeSessionFailedCount}, exportedCount=${scopedEntries.length}`
      );
      lines.push("");
      lines.push(
        [
          "key",
          "sessionId",
          "sessionName",
          "groupName",
          "direction",
          "status",
          "name",
          "localPath",
          "remotePath",
          "attemptCount",
          "updatedAt",
          "updatedAtIso",
          "failureReason",
          "message"
        ].join(",")
      );
      for (const entry of scopedEntries) {
        const sessionMeta = retryCenterSessionMetaById.get(entry.sessionId);
        lines.push(
          [
            entry.key,
            entry.sessionId,
            sessionMeta?.sessionName ?? entry.sessionId,
            sessionMeta?.groupName ?? "Unknown",
            entry.direction,
            entry.status,
            entry.name,
            entry.localPath,
            entry.remotePath,
            entry.attemptCount,
            entry.updatedAt,
            toIsoTimestamp(entry.updatedAt),
            entry.status === "failed" ? classifyTransferFailureReason(entry.message) : "",
            entry.message ?? ""
          ]
            .map((value) => escapeCsvCell(value))
            .join(",")
        );
      }
      const exportText = `${lines.join("\n")}\n`;
      const dateSegment = generatedAtIso.replace(/[:]/g, "-");
      const groupSegment =
        group.label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 48) || "group";
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Retry Center Group (CSV)",
          defaultFileName: `termdock-retry-center-group-${groupSegment}-${exportScope}-${dateSegment}.csv`,
          text: exportText,
          filters: [
            {
              name: "CSV",
              extensions: ["csv"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `Retry Center group CSV exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `Retry Center group CSV exported:\n${result.outputPath}`,
            {
              title: "Retry Center"
            }
          );
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("Retry Center group CSV copied to clipboard.", {
          title: "Retry Center"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the CSV below manually.", {
        title: "Retry Center",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:retry-center",
        "Failed to export retry center group CSV.",
        caughtError
      );
    }
  };

  const exportRetryCenterGroupHistoryJsonWithScopeChoice = async (groupKey: string) => {
    const exportScope = await chooseRetryCenterGroupExportScope(groupKey, "json");
    if (!exportScope) {
      return;
    }
    await exportRetryCenterGroupHistoryJson(groupKey, exportScope);
  };

  const exportRetryCenterGroupHistoryCsvWithScopeChoice = async (groupKey: string) => {
    const exportScope = await chooseRetryCenterGroupExportScope(groupKey, "csv");
    if (!exportScope) {
      return;
    }
    await exportRetryCenterGroupHistoryCsv(groupKey, exportScope);
  };

  const exportRetryCenterAnalyticsJson = async () => {
    try {
      const generatedAtIso = new Date().toISOString();
      const failedVisibleEntries = retryCenterVisibleExportEntries
        .filter((entry) => entry.status === "failed")
        .slice(0, 40);
      const exportPayload = {
        exportedAtIso: generatedAtIso,
        appVersion: APP_VERSION,
        filters: {
          scope: retryCenterScope,
          direction: retryCenterDirection,
          status: retryCenterStatus,
          timeRange: retryCenterTimeRange,
          listMode: retryCenterListMode,
          failureReason: retryCenterFailureReasonExportValue,
          query: retryCenterQuery.trim()
        },
        stats: {
          visibleCount: retryCenterEntries.length,
          totalHistoryCount: transferHistory.length,
          selectedCount: selectedRetryCenterEntries.length,
          failedVisibleCount: retryCenterAnalytics.failedCount,
          failedVisibleRatioPercent: Number(
            retryCenterAnalytics.failedRatioPercent.toFixed(2)
          ),
          directionCounts: retryCenterAnalytics.directionCounts,
          statusCounts: retryCenterAnalytics.statusCounts,
          topSessions: retryCenterAnalytics.topSessions,
          topGroups: retryCenterAnalytics.topGroups,
          topFailureReasons: retryCenterAnalytics.topFailureReasons
        },
        samples: {
          latestFailedEntries: failedVisibleEntries
        }
      };
      const exportText = `${JSON.stringify(exportPayload, null, 2)}\n`;
      const dateSegment = generatedAtIso.replace(/[:]/g, "-");
      const scopeSegment = retryCenterScope === "activeSession" ? "active-session" : "all-sessions";
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Retry Center Analytics (JSON)",
          defaultFileName: `termdock-retry-center-analytics-${scopeSegment}-${dateSegment}.json`,
          text: exportText,
          filters: [
            {
              name: "JSON",
              extensions: ["json"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `Retry Center analytics JSON exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `Retry Center analytics JSON exported:\n${result.outputPath}`,
            {
              title: "Retry Center"
            }
          );
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("Retry Center analytics JSON copied to clipboard.", {
          title: "Retry Center"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the analytics JSON below manually.", {
        title: "Retry Center",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:retry-center",
        "Failed to export retry center analytics JSON.",
        caughtError
      );
    }
  };

  const exportRetryCenterAnalyticsCsv = async () => {
    try {
      const generatedAtIso = new Date().toISOString();
      const lines: string[] = [];
      lines.push("# TermDock Retry Center Analytics");
      lines.push(`# Generated: ${generatedAtIso}`);
      lines.push(`# AppVersion: ${APP_VERSION}`);
      lines.push(
        `# Filters: scope=${retryCenterScope}, direction=${retryCenterDirection}, status=${retryCenterStatus}, timeRange=${retryCenterTimeRange}, listMode=${retryCenterListMode}, failureReason=${retryCenterFailureReasonExportValue}, query=${retryCenterQuery.trim() || "-"}`
      );
      lines.push("");
      lines.push("metric,value");
      lines.push(`visibleCount,${escapeCsvCell(retryCenterEntries.length)}`);
      lines.push(`totalHistoryCount,${escapeCsvCell(transferHistory.length)}`);
      lines.push(`selectedCount,${escapeCsvCell(selectedRetryCenterEntries.length)}`);
      lines.push(`failedVisibleCount,${escapeCsvCell(retryCenterAnalytics.failedCount)}`);
      lines.push(
        `failedVisibleRatioPercent,${escapeCsvCell(
          Number(retryCenterAnalytics.failedRatioPercent.toFixed(2))
        )}`
      );
      lines.push("");
      lines.push("direction,count");
      lines.push(`upload,${escapeCsvCell(retryCenterAnalytics.directionCounts.upload)}`);
      lines.push(`download,${escapeCsvCell(retryCenterAnalytics.directionCounts.download)}`);
      lines.push("");
      lines.push("status,count");
      lines.push(`queued,${escapeCsvCell(retryCenterAnalytics.statusCounts.queued)}`);
      lines.push(`running,${escapeCsvCell(retryCenterAnalytics.statusCounts.running)}`);
      lines.push(`completed,${escapeCsvCell(retryCenterAnalytics.statusCounts.completed)}`);
      lines.push(`failed,${escapeCsvCell(retryCenterAnalytics.statusCounts.failed)}`);
      lines.push(`canceled,${escapeCsvCell(retryCenterAnalytics.statusCounts.canceled)}`);
      lines.push("");
      lines.push("topSessionId,topSessionName,topGroupName,total,failed");
      if (retryCenterAnalytics.topSessions.length === 0) {
        lines.push([ "-", "-", "-", 0, 0 ].map((value) => escapeCsvCell(value)).join(","));
      } else {
        for (const entry of retryCenterAnalytics.topSessions) {
          lines.push(
            [
              entry.sessionId,
              entry.sessionName,
              entry.groupName,
              entry.total,
              entry.failed
            ]
              .map((value) => escapeCsvCell(value))
              .join(",")
          );
        }
      }
      lines.push("");
      lines.push("topGroupName,total");
      if (retryCenterAnalytics.topGroups.length === 0) {
        lines.push([ "-", 0 ].map((value) => escapeCsvCell(value)).join(","));
      } else {
        for (const entry of retryCenterAnalytics.topGroups) {
          lines.push([entry.groupName, entry.total].map((value) => escapeCsvCell(value)).join(","));
        }
      }
      lines.push("");
      lines.push("topFailureReason,total");
      if (retryCenterAnalytics.topFailureReasons.length === 0) {
        lines.push([ "-", 0 ].map((value) => escapeCsvCell(value)).join(","));
      } else {
        for (const entry of retryCenterAnalytics.topFailureReasons) {
          lines.push([entry.reason, entry.total].map((value) => escapeCsvCell(value)).join(","));
        }
      }
      const exportText = `${lines.join("\n")}\n`;
      const dateSegment = generatedAtIso.replace(/[:]/g, "-");
      const scopeSegment = retryCenterScope === "activeSession" ? "active-session" : "all-sessions";
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Retry Center Analytics (CSV)",
          defaultFileName: `termdock-retry-center-analytics-${scopeSegment}-${dateSegment}.csv`,
          text: exportText,
          filters: [
            {
              name: "CSV",
              extensions: ["csv"]
            }
          ]
        });
        if (!result.canceled && result.outputPath) {
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `Retry Center analytics CSV exported.\nPath copied to clipboard:\n${result.outputPath}`
              : `Retry Center analytics CSV exported:\n${result.outputPath}`,
            {
              title: "Retry Center"
            }
          );
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      if (copied) {
        await showAppAlert("Retry Center analytics CSV copied to clipboard.", {
          title: "Retry Center"
        });
        return;
      }
      await showAppAlert("Clipboard unavailable. Copy the analytics CSV below manually.", {
        title: "Retry Center",
        detailText: exportText
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog(
        "error",
        "renderer:retry-center",
        "Failed to export retry center analytics CSV.",
        caughtError
      );
    }
  };

  const confirmRetryBatchIfNeeded = async (count: number, label: string): Promise<boolean> => {
    if (retryBatchConfirmThreshold <= 0) {
      return true;
    }
    if (count < retryBatchConfirmThreshold) {
      return true;
    }
    return showAppConfirm(
      `Requeue ${count} failed transfer task(s) for ${label}? This exceeds your retry confirmation threshold (${retryBatchConfirmThreshold}).`,
      {
        title: "Retry Confirmation",
        confirmLabel: "Retry",
        cancelLabel: "Cancel"
      }
    );
  };

  const retrySelectedRetryCenterEntries = async (retryScope: RetryCenterRetryScope = "all") => {
    if (!activeTabId || !activeSessionId) {
      await showAppAlert("Open a terminal tab for the target session first.", {
        title: "Retry Center"
      });
      return;
    }
    if (selectedRetryCenterFailedEntries.length === 0) {
      return;
    }
    const targetEntries = getRetryCenterEntriesForRetryScope(
      selectedRetryCenterFailedEntries,
      retryScope
    );
    if (targetEntries.length === 0) {
      await showAppAlert("No transfer tasks were requeued.", {
        title: "Retry Center"
      });
      return;
    }
    const confirmed = await confirmRetryBatchIfNeeded(
      targetEntries.length,
      "selected retry-center records"
    );
    if (!confirmed) {
      return;
    }
    const tabId = activeTabId;
    const selectedKeys = new Set(targetEntries.map((entry) => entry.key));
    const uploadTargetMap = new Map<
      string,
      { name: string; localPath: string; remotePath: string }
    >();
    const downloadTargetMap = new Map<
      string,
      { name: string; localPath: string; remotePath: string }
    >();
    for (const entry of targetEntries) {
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
        })),
        {
          tabId,
          sessionId: activeSessionId
        }
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
    const scopeSuffix =
      retryScope === "upload"
        ? " (upload-only)"
        : retryScope === "download"
          ? " (download-only)"
          : "";
    await showAppAlert(`Requeued ${queuedCount} transfer task(s) from history${scopeSuffix}.`, {
      title: "Retry Center"
    });
  };

  const retrySelectedRetryCenterEntriesWithScopeChoice = async () => {
    if (!activeTabId || !activeSessionId) {
      await showAppAlert("Open a terminal tab for the target session first.", {
        title: "Retry Center"
      });
      return;
    }
    if (selectedRetryCenterFailedEntries.length === 0) {
      return;
    }
    const retryScope = await chooseRetryCenterSelectedRetryScope(selectedRetryCenterFailedEntries);
    if (!retryScope) {
      return;
    }
    await retrySelectedRetryCenterEntries(retryScope);
  };

  const getRetryCenterEntriesForRetryScope = useCallback(
    (entries: SftpTransferHistoryItem[], retryScope: RetryCenterRetryScope) => {
      if (retryScope === "upload") {
        return entries.filter((entry) => entry.direction === "upload");
      }
      if (retryScope === "download") {
        return entries.filter((entry) => entry.direction === "download");
      }
      return entries;
    },
    []
  );

  const chooseRetryCenterRetryScopeByCounts = async (
    counts: {
      all: number;
      upload: number;
      download: number;
    },
    message: string
  ): Promise<RetryCenterRetryScope | null> => {
    if (counts.all <= 0) {
      return null;
    }
    const choices: AppChoiceDialogOption[] = [
      {
        value: "all",
        label: `All Retryable (${counts.all})`
      }
    ];
    if (counts.upload > 0) {
      choices.push({
        value: "upload",
        label: `Upload Only (${counts.upload})`
      });
    }
    if (counts.download > 0) {
      choices.push({
        value: "download",
        label: `Download Only (${counts.download})`
      });
    }
    if (choices.length === 1) {
      setRetryCenterLastRetryScope("all");
      return "all";
    }
    if (retryCenterAutoUseLastRetryScope) {
      const preferredChoice = choices.find((entry) => entry.value === retryCenterLastRetryScope);
      if (preferredChoice) {
        setRetryCenterLastRetryScope(preferredChoice.value as RetryCenterRetryScope);
        return preferredChoice.value as RetryCenterRetryScope;
      }
    }
    let dialogChoices = choices;
    const preferredChoice = choices.find((entry) => entry.value === retryCenterLastRetryScope);
    if (preferredChoice) {
      const remainingChoices = choices.filter((entry) => entry.value !== retryCenterLastRetryScope);
      dialogChoices = [
        {
          ...preferredChoice,
          label: `${preferredChoice.label} (Last Used)`
        },
        ...remainingChoices
      ];
    }
    const choice = await showAppChoice(message, dialogChoices, {
      title: "Retry Center",
      cancelLabel: "Cancel"
    });
    if (choice !== "all" && choice !== "upload" && choice !== "download") {
      return null;
    }
    setRetryCenterLastRetryScope(choice);
    return choice;
  };

  const chooseRetryCenterRetryScope = async (
    baseEntries: SftpTransferHistoryItem[],
    message: string
  ): Promise<RetryCenterRetryScope | null> =>
    chooseRetryCenterRetryScopeByCounts(
      {
        all: baseEntries.length,
        upload: baseEntries.filter((entry) => entry.direction === "upload").length,
        download: baseEntries.filter((entry) => entry.direction === "download").length
      },
      message
    );

  const chooseRetryCenterVisibleRetryScope = async (
    baseEntries: SftpTransferHistoryItem[],
    failureReason?: string
  ): Promise<RetryCenterRetryScope | null> => {
    const message =
      typeof failureReason === "string" && failureReason.trim()
        ? `Choose retry scope for visible "${failureReason}" failures.`
        : "Choose retry scope for visible failed records.";
    return chooseRetryCenterRetryScope(baseEntries, message);
  };

  const chooseRetryCenterSelectedRetryScope = async (
    baseEntries: SftpTransferHistoryItem[]
  ): Promise<RetryCenterRetryScope | null> =>
    chooseRetryCenterRetryScope(baseEntries, "Choose retry scope for selected failed records.");

  const retryVisibleRetryCenterEntries = async (
    failureReason?: string,
    retryScope: RetryCenterRetryScope = "all"
  ) => {
    if (!activeTabId || !activeSessionId) {
      await showAppAlert("Open a terminal tab for the target session first.", {
        title: "Retry Center"
      });
      return;
    }
    const scopedVisibleEntries =
      typeof failureReason === "string" && failureReason.trim()
        ? visibleRetryCenterFailedEntries.filter(
            (entry) => classifyTransferFailureReason(entry.message) === failureReason
          )
        : visibleRetryCenterFailedEntries;
    const targetEntries = getRetryCenterEntriesForRetryScope(scopedVisibleEntries, retryScope);
    if (targetEntries.length === 0) {
      if (failureReason) {
        await showAppAlert(
          `No visible failed records for reason "${failureReason}" under the active session.`,
          {
            title: "Retry Center"
          }
        );
      }
      return;
    }
    const retryLabel =
      typeof failureReason === "string" && failureReason.trim()
        ? `visible failure reason "${failureReason}"`
        : "visible failed records";
    const confirmed = await confirmRetryBatchIfNeeded(targetEntries.length, retryLabel);
    if (!confirmed) {
      return;
    }
    const tabId = activeTabId;
    const visibleKeys = new Set(targetEntries.map((entry) => entry.key));
    const uploadTargetMap = new Map<
      string,
      { name: string; localPath: string; remotePath: string }
    >();
    const downloadTargetMap = new Map<
      string,
      { name: string; localPath: string; remotePath: string }
    >();
    for (const entry of targetEntries) {
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
        })),
        {
          tabId,
          sessionId: activeSessionId
        }
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

    setRetryCenterSelection((prev) => prev.filter((key) => !visibleKeys.has(key)));
    if (failureReason) {
      const scopeSuffix =
        retryScope === "upload"
          ? " (upload-only)"
          : retryScope === "download"
            ? " (download-only)"
            : "";
      await showAppAlert(
        `Requeued ${queuedCount} visible failed transfer task(s) for reason "${failureReason}"${scopeSuffix}.`,
        {
          title: "Retry Center"
        }
      );
      return;
    }
    const scopeSuffix =
      retryScope === "upload"
        ? " (upload-only)"
        : retryScope === "download"
          ? " (download-only)"
          : "";
    await showAppAlert(`Requeued ${queuedCount} visible failed transfer task(s)${scopeSuffix}.`, {
      title: "Retry Center"
    });
  };

  const retryVisibleRetryCenterEntriesWithScopeChoice = async (failureReason?: string) => {
    if (!activeTabId || !activeSessionId) {
      await showAppAlert("Open a terminal tab for the target session first.", {
        title: "Retry Center"
      });
      return;
    }
    const baseEntries =
      typeof failureReason === "string" && failureReason.trim()
        ? visibleRetryCenterFailedEntries.filter(
            (entry) => classifyTransferFailureReason(entry.message) === failureReason
          )
        : visibleRetryCenterFailedEntries;
    if (baseEntries.length === 0) {
      if (failureReason) {
        await showAppAlert(
          `No visible failed records for reason "${failureReason}" under the active session.`,
          {
            title: "Retry Center"
          }
        );
      }
      return;
    }
    const retryScope = await chooseRetryCenterVisibleRetryScope(baseEntries, failureReason);
    if (!retryScope) {
      return;
    }
    await retryVisibleRetryCenterEntries(failureReason, retryScope);
  };

  const clearVisibleRetryCenterEntriesByFailureReason = async (failureReason: string) => {
    const normalizedReason = failureReason.trim();
    if (!normalizedReason) {
      return;
    }
    const targetEntries = retryCenterEntries.filter(
      (entry) =>
        entry.status === "failed" && classifyTransferFailureReason(entry.message) === normalizedReason
    );
    if (targetEntries.length === 0) {
      await showAppAlert(
        `No visible failed history records found for reason "${normalizedReason}".`,
        {
          title: "Retry Center"
        }
      );
      return;
    }
    const confirmed = await showAppConfirm(
      `Delete ${targetEntries.length} visible failed history record(s) with reason "${normalizedReason}"?`,
      {
        title: "Retry Center",
        confirmLabel: "Delete Reason",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    const targetKeys = new Set(targetEntries.map((entry) => entry.key));
    setTransferHistory((prev) => prev.filter((entry) => !targetKeys.has(entry.key)));
    setRetryCenterSelection((prev) => prev.filter((key) => !targetKeys.has(key)));
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

  type FailedRetryCandidate = {
    name: string;
    localPath: string;
    remotePath: string;
  };

  const queueFailedUploadRetryCandidates = (
    tabId: string,
    retryCandidates: FailedRetryCandidate[]
  ) => {
    const queuedCount = enqueueUploadTargets(
      tabId,
      retryCandidates.map((transfer) => ({
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
        retryCandidates.map((transfer) => ({
          localPath: transfer.localPath,
          remotePath: transfer.remotePath
        }))
      );
    }
    return queuedCount;
  };

  const queueFailedDownloadRetryCandidates = async (
    tabId: string,
    retryCandidates: FailedRetryCandidate[],
    sessionId?: string
  ) => {
    const retryTargets = retryCandidates.map((transfer) => ({
      name: transfer.name,
      remotePath: transfer.remotePath,
      localPath: transfer.localPath
    }));
    const resolvedTargets = await resolveDownloadTargetConflicts(retryTargets, {
      tabId,
      sessionId
    });
    if (!resolvedTargets || resolvedTargets.length === 0) {
      return 0;
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
    }
    return queuedCount;
  };

  const retryFailedUploads = async () => {
    if (!activeTabId || failedUploadRetryCandidates.length === 0) {
      return;
    }
    const tabId = activeTabId;
    const sortedFailedTransfers = [...failedUploadRetryCandidates];
    const confirmed = await confirmRetryBatchIfNeeded(
      sortedFailedTransfers.length,
      "failed upload candidates"
    );
    if (!confirmed) {
      return;
    }
    const queuedCount = queueFailedUploadRetryCandidates(tabId, sortedFailedTransfers);
    if (queuedCount > 0) {
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
    const confirmed = await confirmRetryBatchIfNeeded(
      sortedFailedTransfers.length,
      "failed download candidates"
    );
    if (!confirmed) {
      return;
    }
    const queuedCount = await queueFailedDownloadRetryCandidates(
      tabId,
      sortedFailedTransfers,
      activeSessionId ?? undefined
    );
    if (queuedCount > 0) {
      await showAppAlert(`Requeued ${queuedCount} failed download task(s).`, {
        title: "Retry Downloads"
      });
    }
  };

  const retryAllFailedTransfers = async (retryScope: RetryCenterRetryScope = "all") => {
    if (!activeTabId || failedRetryCandidateTotal <= 0) {
      return;
    }
    const tabId = activeTabId;
    const uploadCandidates =
      retryScope === "download" ? [] : [...failedUploadRetryCandidates];
    const downloadCandidates =
      retryScope === "upload" ? [] : [...failedDownloadRetryCandidates];
    const targetCount = uploadCandidates.length + downloadCandidates.length;
    if (targetCount <= 0) {
      await showAppAlert("No transfer tasks were requeued.", {
        title: "Retry Transfers"
      });
      return;
    }
    const scopeLabel =
      retryScope === "upload"
        ? "all failed upload candidates"
        : retryScope === "download"
          ? "all failed download candidates"
          : "all failed transfer candidates";
    const confirmed = await confirmRetryBatchIfNeeded(targetCount, scopeLabel);
    if (!confirmed) {
      return;
    }
    const uploadQueued =
      uploadCandidates.length > 0
        ? queueFailedUploadRetryCandidates(tabId, uploadCandidates)
        : 0;
    const downloadQueued =
      downloadCandidates.length > 0
        ? await queueFailedDownloadRetryCandidates(
            tabId,
            downloadCandidates,
            activeSessionId ?? undefined
          )
        : 0;
    const queuedTotal = uploadQueued + downloadQueued;
    if (queuedTotal <= 0) {
      await showAppAlert("No transfer tasks were requeued.", {
        title: "Retry Transfers"
      });
      return;
    }
    const scopeSuffix =
      retryScope === "upload"
        ? " (upload-only)"
        : retryScope === "download"
          ? " (download-only)"
          : "";
    await showAppAlert(
      `Requeued ${queuedTotal} failed transfer task(s)${scopeSuffix}. Upload ${uploadQueued}, Download ${downloadQueued}.`,
      {
        title: "Retry Transfers"
      }
    );
  };

  const retryAllFailedTransfersWithScopeChoice = async () => {
    if (!activeTabId || failedRetryCandidateTotal <= 0) {
      return;
    }
    const retryScope = await chooseRetryCenterRetryScopeByCounts(
      {
        all: failedRetryCandidateTotal,
        upload: failedUploadRetryCandidates.length,
        download: failedDownloadRetryCandidates.length
      },
      "Choose retry scope for all failed transfer candidates."
    );
    if (!retryScope) {
      return;
    }
    await retryAllFailedTransfers(retryScope);
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
      sessionContextActions.push({
        id: "run-quick-profile",
        label:
          sessionQuickProfiles.length > 0
            ? `Run Quick Profile... (${sessionQuickProfiles.length})`
            : "Run Quick Profile...",
        disabled: sessionQuickProfiles.length === 0,
        run: () => {
          void runSessionQuickProfileChooser(sessionContextTarget);
        }
      });
      sessionContextActions.push({
        id: "create-quick-profile",
        label: "Save Quick Profile...",
        run: () => {
          void createSessionQuickProfileForSession(sessionContextTarget);
        }
      });
      sessionContextActions.push({
        id: "manage-quick-profile",
        label: "Manage Quick Profiles...",
        run: () => {
          void manageSessionQuickProfilesForSession(sessionContextTarget);
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
      id: "import-sessions-json",
      label: "Import Sessions JSON...",
      run: () => {
        void importSessionsFromJson();
      }
    });
    sessionContextActions.push({
      id: "export-all-sessions",
      label: "Export All Sessions...",
      run: () => {
        void exportAllSessionsWithGroups();
      }
    });
    sessionContextActions.push({
      id: "export-all-groups",
      label: "Export All Groups...",
      run: () => {
        void exportAllSessionGroups();
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
      id: "import-sessions-json",
      label: "Import Sessions JSON...",
      run: () => {
        void importSessionsFromJson();
      }
    });
    sessionContextActions.push({
      id: "export-all-sessions",
      label: "Export All Sessions...",
      run: () => {
        void exportAllSessionsWithGroups();
      }
    });
    sessionContextActions.push({
      id: "export-all-groups",
      label: "Export All Groups...",
      run: () => {
        void exportAllSessionGroups();
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
      id: "import-sessions-json",
      label: "Import Sessions JSON...",
      run: () => {
        void importSessionsFromJson();
      }
    });
    sessionContextActions.push({
      id: "export-all-sessions",
      label: "Export All Sessions...",
      run: () => {
        void exportAllSessionsWithGroups();
      }
    });
    sessionContextActions.push({
      id: "export-all-groups",
      label: "Export All Groups...",
      run: () => {
        void exportAllSessionGroups();
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
            onCommandHistoryChange={setTerminalCommandHistoryEntries}
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
          <section className="panel__section panel__section--server-health">
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
          <section className="panel__section panel__section--command-history">
            <div className="panel__heading">
              <h2>Command History</h2>
              <div className="command-history-panel__heading-actions">
                <span className="panel__badge">
                  {visibleTerminalCommandHistoryEntries.length}/{terminalCommandHistoryEntries.length}
                </span>
                <button
                  className="secondary-button secondary-button--small"
                  onClick={() => {
                    void openCommandSnippetManager();
                  }}
                  type="button"
                >
                  Snippets ({totalCommandSnippetCount})
                </button>
                <button
                  className="secondary-button secondary-button--small"
                  onClick={openCommandHistoryManager}
                  type="button"
                >
                  Manage
                </button>
              </div>
            </div>
            <div className="command-history-panel__filters">
              <select
                onChange={(event) =>
                  setTerminalCommandHistoryScope(event.target.value as TerminalCommandHistoryScope)
                }
                value={terminalCommandHistoryScope}
              >
                <option value="activeTab">Active Tab</option>
                <option value="allTabs">All Tabs</option>
              </select>
              <input
                onChange={(event) => setTerminalCommandHistoryQuery(event.target.value)}
                placeholder="Search command/tab"
                value={terminalCommandHistoryQuery}
              />
            </div>
            <div
              className="command-history-panel__list-shell"
              onContextMenu={openCommandHistoryPanelContextMenu}
            >
              {visibleTerminalCommandHistoryEntries.length === 0 ? (
                <p className="hint command-history-panel__empty">No command history entries.</p>
              ) : (
                <ul className="command-history-panel__list">
                  {visibleTerminalCommandHistoryEntries.map((entry) => (
                    <li
                      className="command-history-panel__item"
                      key={entry.id}
                      onDoubleClick={() => {
                        void pasteTerminalCommandHistoryEntry(entry);
                      }}
                      onContextMenu={(event) => openCommandHistoryContextMenu(event, entry.id)}
                      title="Double-click to paste into active terminal. Right-click for actions."
                    >
                      <p className="command-history-panel__command">
                        <code>{entry.command}</code>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </aside>
      </main>

      <section className="transfer-dock">
        <div className="transfer-dock__heading">
          <h3>Transfers</h3>
          <div className="transfer-dock__heading-actions">
            <div className="transfer-dock__heading-meta">
              <span className="hint transfer-dock__binding">
                {activeTerminalTab
                  ? `Bound to ${activeTerminalTab.title}`
                  : "Open a terminal tab to manage transfers"}
              </span>
              <span
                className={
                  activeTransferDockNotice
                    ? `hint transfer-dock__notice transfer-dock__notice--${activeTransferDockNotice.level}`
                    : "hint transfer-dock__notice transfer-dock__notice--placeholder"
                }
              >
                {activeTransferDockNotice?.message ?? "\u00A0"}
              </span>
            </div>
            <button
              className="secondary-button sftp-transfer-panel__clear transfer-dock__action-button"
              disabled={pendingTransferRestoreCount === 0}
              onClick={() => {
                void restorePendingTransferRestoreQueue();
              }}
              type="button"
            >
              Restore Pending <span className="transfer-dock__count">({pendingTransferRestoreCount})</span>
            </button>
            <button
              className="secondary-button sftp-transfer-panel__clear transfer-dock__action-button"
              disabled={pendingTransferRestoreCount === 0}
              onClick={() => {
                void discardPendingTransferRestoreQueue();
              }}
              type="button"
            >
              Discard Pending
            </button>
            <button
              className="secondary-button sftp-transfer-panel__clear transfer-dock__action-button"
              disabled={!canRetryAllFailedTransfers}
              onClick={() => {
                void retryAllFailedTransfersWithScopeChoice();
              }}
              title="Retry all failed upload/download candidates with retry-scope strategy"
              type="button"
            >
              Retry All Failed{" "}
              <span className="transfer-dock__count">({failedRetryCandidateTotal})</span>
            </button>
            <button
              className="secondary-button sftp-transfer-panel__clear transfer-dock__action-button"
              onClick={openRetryCenter}
              type="button"
            >
              Retry Center
            </button>
            <button
              className={
                hasOperationCenterActivity
                  ? "secondary-button sftp-transfer-panel__clear transfer-dock__action-button operation-center__trigger is-active"
                  : "secondary-button sftp-transfer-panel__clear transfer-dock__action-button operation-center__trigger"
              }
              onClick={openOperationCenter}
              type="button"
            >
              Operation Center <span className="transfer-dock__count">({operationCenterActiveCount})</span>
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
            {isActiveUploadQueuePaused ? (
              <p className="hint sftp-transfer-panel__batch-progress">
                Queue paused: terminal disconnected. Reconnect this tab to resume uploads.
              </p>
            ) : null}
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
            {isActiveDownloadQueuePaused ? (
              <p className="hint sftp-transfer-panel__batch-progress">
                Queue paused: terminal disconnected. Reconnect this tab to resume downloads.
              </p>
            ) : null}
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
      <section className="app-inline-hint-panel" aria-live="polite" aria-atomic="true">
        <p
          className={
            appHintMessage
              ? appHintMessage.level === "warn"
                ? "app-inline-hint-panel__text is-warn"
                : "app-inline-hint-panel__text is-info"
              : "app-inline-hint-panel__text is-placeholder"
          }
          title={appHintMessage?.message ?? ""}
        >
          {appHintMessage?.message ?? "\u00A0"}
        </p>
        {appHintMessage ? (
          <button className="icon-button app-inline-hint-panel__close" onClick={clearAppHintMessage} type="button">
            <UiIcon name="close" />
          </button>
        ) : (
          <span className="app-inline-hint-panel__spacer" aria-hidden="true" />
        )}
      </section>

      {isOperationCenterOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal modal--operation-center"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Operation Center"
          >
            <div className="modal__header">
              <h3>Operation Center</h3>
              <button className="icon-button" onClick={closeOperationCenter} type="button">
                <UiIcon name="close" />
              </button>
            </div>
            <p className="hint">
              Consolidated view for long-running operations across open workspace tabs.
            </p>
            <div className="operation-center__grid">
              <article className="operation-center__card">
                <div className="operation-center__card-header">
                  <p className="operation-center__title">Upload Queue</p>
                  <span
                    className={
                      activeUploadQueueStats.running + activeUploadQueueStats.queued > 0
                        ? "operation-center__state is-active"
                        : "operation-center__state is-idle"
                    }
                  >
                    {activeUploadQueueStats.running + activeUploadQueueStats.queued > 0
                      ? "Active"
                      : "Idle"}
                  </span>
                </div>
                <p className="operation-center__meta">
                  running {activeUploadQueueStats.running} | queued {activeUploadQueueStats.queued}
                </p>
                <p className="operation-center__meta">
                  progress {activeUploadProgressStats.completed}/{activeUploadProgressStats.total} |
                  failed {activeUploadProgressStats.failed} | canceled{" "}
                  {activeUploadProgressStats.canceled}
                </p>
                <div className="operation-center__actions">
                  <button
                    className="secondary-button secondary-button--small"
                    disabled={!activeTabId}
                    onClick={() => {
                      void cancelAllActiveUploads();
                    }}
                    type="button"
                  >
                    Cancel All Uploads
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    disabled={!canRetryFailedUploads}
                    onClick={() => {
                      void retryFailedUploads();
                    }}
                    type="button"
                  >
                    Retry Failed
                  </button>
                </div>
              </article>

              <article className="operation-center__card">
                <div className="operation-center__card-header">
                  <p className="operation-center__title">Download Queue</p>
                  <span
                    className={
                      activeDownloadQueueStats.running + activeDownloadQueueStats.queued > 0
                        ? "operation-center__state is-active"
                        : "operation-center__state is-idle"
                    }
                  >
                    {activeDownloadQueueStats.running + activeDownloadQueueStats.queued > 0
                      ? "Active"
                      : "Idle"}
                  </span>
                </div>
                <p className="operation-center__meta">
                  running {activeDownloadQueueStats.running} | queued {activeDownloadQueueStats.queued}
                </p>
                <p className="operation-center__meta">
                  progress {activeDownloadProgressStats.completed}/{activeDownloadProgressStats.total} |
                  failed {activeDownloadProgressStats.failed} | canceled{" "}
                  {activeDownloadProgressStats.canceled}
                </p>
                <div className="operation-center__actions">
                  <button
                    className="secondary-button secondary-button--small"
                    disabled={!activeTabId}
                    onClick={() => {
                      void cancelAllActiveDownloads();
                    }}
                    type="button"
                  >
                    Cancel All Downloads
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    disabled={!canRetryFailedDownloads}
                    onClick={() => {
                      void retryFailedDownloads();
                    }}
                    type="button"
                  >
                    Retry Failed
                  </button>
                </div>
              </article>

              <article className="operation-center__card">
                <div className="operation-center__card-header">
                  <p className="operation-center__title">Remote Delete</p>
                  <span
                    className={
                      sftpDeleteProgress
                        ? "operation-center__state is-active"
                        : "operation-center__state is-idle"
                    }
                  >
                    {sftpDeleteProgress ? "Running" : "Idle"}
                  </span>
                </div>
                {sftpDeleteProgress ? (
                  <p className="operation-center__meta operation-center__meta--wrap">
                    Deleting {sftpDeleteProgress.kind === "directory" ? "directory" : "file"} "
                    {sftpDeleteProgress.name}"...
                  </p>
                ) : (
                  <p className="operation-center__meta">No active delete operation.</p>
                )}
                <p className="operation-center__meta operation-center__meta--muted">
                  Delete cancellation is not available yet in current backend flow.
                </p>
              </article>

              <article className="operation-center__card">
                <div className="operation-center__card-header">
                  <p className="operation-center__title">Port Forwarding Ops</p>
                  <span
                    className={
                      portForwardBusy
                        ? "operation-center__state is-active"
                        : "operation-center__state is-idle"
                    }
                  >
                    {portForwardBusy ? "Working" : "Idle"}
                  </span>
                </div>
                <p className="operation-center__meta">
                  active forwards {portForwards.length} | event history{" "}
                  {activePortForwardEventHistory.length}
                </p>
                <p className="operation-center__meta">
                  status: {portForwardStatusMessage?.trim() || "No recent status message."}
                </p>
                <div className="operation-center__actions">
                  <button
                    className="secondary-button secondary-button--small"
                    onClick={() => {
                      closeOperationCenter();
                      openSettingsPanel("portForwarding");
                    }}
                    type="button"
                  >
                    Open Port Fwd
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    onClick={() => {
                      closeOperationCenter();
                      openSettingsPanel("diagnostics");
                    }}
                    type="button"
                  >
                    Open Diagnostics
                  </button>
                </div>
              </article>

              <article className="operation-center__card operation-center__card--wide">
                <div className="operation-center__card-header">
                  <p className="operation-center__title">All Tabs Transfer Activity</p>
                  <span
                    className={
                      operationCenterTransferTabSummaries.length > 0
                        ? "operation-center__state is-active"
                        : "operation-center__state is-idle"
                    }
                  >
                    {operationCenterTransferTabSummaries.length > 0
                      ? `${operationCenterTransferTabSummaries.length} tab(s)`
                      : "Idle"}
                  </span>
                </div>
                {operationCenterTransferTabSummaries.length > 0 ? (
                  <ul className="operation-center__tab-list">
                    {operationCenterTransferTabSummaries.map((summary) => (
                      <li className="operation-center__tab-item" key={summary.tabId}>
                        <div className="operation-center__tab-main">
                          <p className="operation-center__tab-title">{summary.title}</p>
                          <p className="operation-center__meta">
                            U(r{summary.uploadRunning}/q{summary.uploadQueued}) | D(r
                            {summary.downloadRunning}/q{summary.downloadQueued}) | total{" "}
                            {summary.totalActive}
                          </p>
                        </div>
                        <div className="operation-center__tab-actions">
                          <span
                            className={
                              summary.connected
                                ? "operation-center__state is-active"
                                : "operation-center__state is-idle"
                            }
                          >
                            {summary.connected ? "Connected" : "Disconnected"}
                          </span>
                          <button
                            className="secondary-button secondary-button--small"
                            onClick={() => {
                              setActiveTabId(summary.tabId);
                            }}
                            type="button"
                          >
                            Focus Tab
                          </button>
                          <button
                            className="secondary-button secondary-button--small"
                            disabled={summary.connected || isOperationCenterReconnecting}
                            onClick={() => {
                              void reconnectOperationTabById(summary.tabId);
                            }}
                            type="button"
                          >
                            Reconnect Tab
                          </button>
                          <button
                            className="secondary-button secondary-button--small"
                            disabled={isOperationCenterBulkCanceling}
                            onClick={() => {
                              void cancelTransferTasksForTab(summary.tabId);
                            }}
                            type="button"
                          >
                            Cancel Tab Tasks
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="operation-center__meta">No queued/running transfer activity across tabs.</p>
                )}
                <div className="operation-center__actions">
                  <button
                    className="secondary-button secondary-button--small"
                    disabled={
                      operationCenterTransferTabSummaries.filter((entry) => !entry.connected)
                        .length === 0 || isOperationCenterReconnecting
                    }
                    onClick={() => {
                      void reconnectDisconnectedOperationTabs();
                    }}
                    type="button"
                  >
                    {isOperationCenterReconnecting
                      ? "Reconnecting..."
                      : "Reconnect Disconnected Tabs"}
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    disabled={
                      operationCenterTransferTabSummaries.length === 0 ||
                      isOperationCenterBulkCanceling
                    }
                    onClick={() => {
                      void cancelAllTransfersAcrossTabs();
                    }}
                    type="button"
                  >
                    {isOperationCenterBulkCanceling
                      ? "Canceling..."
                      : "Cancel All Transfers (All Tabs)"}
                  </button>
                </div>
              </article>
            </div>
            {!hasOperationCenterActivity ? (
              <p className="hint operation-center__idle-note">
                No high-latency operation is active right now. Queues and long jobs are idle.
              </p>
            ) : null}
            <div className="modal__actions">
              <button
                className="secondary-button"
                disabled={!canRetryAllFailedTransfers}
                onClick={() => {
                  void retryAllFailedTransfersWithScopeChoice();
                }}
                title="Retry all failed upload/download candidates with retry-scope strategy"
                type="button"
              >
                Retry All Failed ({failedRetryCandidateTotal})
              </button>
              <button className="primary-button" onClick={closeOperationCenter} type="button">
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
              <label>
                Time Range
                <select
                  onChange={(event) =>
                    setRetryCenterTimeRange(event.target.value as TransferHistoryTimeRange)
                  }
                  value={retryCenterTimeRange}
                >
                  <option value="all">All</option>
                  <option value="5m">Last 5m</option>
                  <option value="30m">Last 30m</option>
                  <option value="1h">Last 1h</option>
                  <option value="24h">Last 24h</option>
                </select>
              </label>
              <label>
                View
                <select
                  onChange={(event) => setRetryCenterListMode(event.target.value as RetryCenterListMode)}
                  value={retryCenterListMode}
                >
                  <option value="flat">Flat List</option>
                  <option value="groupedByReason">Grouped by Failure</option>
                </select>
              </label>
              <label>
                Failure Reason
                <select
                  onChange={(event) => setRetryCenterFailureReasonFilter(event.target.value)}
                  value={retryCenterResolvedFailureReasonFilter}
                >
                  <option value={RETRY_CENTER_FAILURE_REASON_ALL}>
                    All ({retryCenterFailureReasonOptions.reduce((total, entry) => total + entry.total, 0)})
                  </option>
                  {retryCenterFailureReasonOptions.map((entry) => (
                    <option key={entry.reason} value={entry.reason}>
                      {`${entry.reason} (${entry.total})`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Default Retry Scope
                <select
                  onChange={(event) =>
                    setRetryCenterLastRetryScope(event.target.value as RetryCenterRetryScope)
                  }
                  value={retryCenterLastRetryScope}
                >
                  <option value="all">All Retryable</option>
                  <option value="upload">Upload Only</option>
                  <option value="download">Download Only</option>
                </select>
              </label>
              <label>
                Retry Confirm Threshold
                <input
                  max={MAX_RETRY_BATCH_CONFIRM_THRESHOLD}
                  min={MIN_RETRY_BATCH_CONFIRM_THRESHOLD}
                  onChange={(event) => {
                    setRetryBatchConfirmThreshold((prev) =>
                      parseRetryBatchConfirmThreshold(Number(event.target.value), prev)
                    );
                  }}
                  type="number"
                  value={retryBatchConfirmThreshold}
                />
              </label>
              <p className="hint">
                Set <code>0</code> to disable large-batch retry confirmations.
              </p>
              <label className="retry-center__search">
                Search
                <input
                  onChange={(event) => setRetryCenterQuery(event.target.value)}
                  placeholder="name/local/remote/message"
                  value={retryCenterQuery}
                />
              </label>
              <button
                className="secondary-button secondary-button--small retry-center__filter-reset"
                disabled={!hasCustomizedRetryCenterView}
                onClick={resetRetryCenterViewFilters}
                type="button"
              >
                Reset Filters
              </button>
              <button
                aria-pressed={retryCenterAutoUseLastRetryScope}
                className="secondary-button secondary-button--small retry-center__filter-reset"
                onClick={() => {
                  setRetryCenterAutoUseLastRetryScope((prev) => !prev);
                }}
                title="Automatically use last retry scope and skip retry-scope chooser"
                type="button"
              >
                {retryCenterAutoUseLastRetryScope ? "Auto Retry Scope: On" : "Auto Retry Scope: Off"}
              </button>
            </div>
            <p className="hint retry-center__summary">
              Visible {retryCenterEntries.length} / Total {transferHistory.length}, Selected{" "}
              {selectedRetryCenterEntries.length}, Selected failed (active session){" "}
              {selectedRetryCenterFailedEntries.length}, Visible failed (active session){" "}
              {visibleRetryCenterFailedEntries.length}, Dock failed candidates U{" "}
              {failedUploadRetryCandidates.length} / D {failedDownloadRetryCandidates.length},
              Failure reason {retryCenterSelectedFailureReasonLabel},
              Default scope {retryCenterLastRetryScopeLabel}
              {retryCenterAutoUseLastRetryScope ? " (auto)" : ""}, Large retry confirm{" "}
              {retryBatchConfirmThreshold <= 0
                ? "off"
                : `>=${retryBatchConfirmThreshold}`}
              {isRetryCenterGroupedView
                ? `, Groups ${retryCenterGroupedEntries.length}, Collapsed ${retryCenterCollapsedGroupKeySet.size}`
                : ""}
            </p>
            <div className="retry-center__analytics">
              <article className="retry-center__metric">
                <p className="retry-center__metric-label">Failure Ratio</p>
                <p className="retry-center__metric-value">
                  {formatPercent(retryCenterAnalytics.failedRatioPercent)}
                </p>
                <p className="retry-center__metric-meta">
                  Failed {retryCenterAnalytics.failedCount}/{retryCenterAnalytics.totalCount}
                </p>
              </article>
              <article className="retry-center__metric">
                <p className="retry-center__metric-label">Direction Breakdown</p>
                <p className="retry-center__metric-value">
                  U {retryCenterAnalytics.directionCounts.upload} | D{" "}
                  {retryCenterAnalytics.directionCounts.download}
                </p>
                <p className="retry-center__metric-meta">
                  completed {retryCenterAnalytics.statusCounts.completed} | failed{" "}
                  {retryCenterAnalytics.statusCounts.failed} | canceled{" "}
                  {retryCenterAnalytics.statusCounts.canceled}
                </p>
              </article>
              <article className="retry-center__metric">
                <p className="retry-center__metric-label">Top Sessions / Groups</p>
                <p className="retry-center__metric-meta">
                  {retryCenterAnalytics.topSessions.length > 0
                    ? retryCenterAnalytics.topSessions
                        .map((entry) => `${entry.sessionName} (${entry.total})`)
                        .join(" | ")
                    : "No visible records"}
                </p>
                <p className="retry-center__metric-meta">
                  {retryCenterAnalytics.topGroups.length > 0
                    ? retryCenterAnalytics.topGroups
                        .map((entry) => `${entry.groupName} (${entry.total})`)
                        .join(" | ")
                    : "No group data"}
                </p>
              </article>
              <article className="retry-center__metric">
                <p className="retry-center__metric-label">Top Failure Reasons</p>
                <p className="retry-center__metric-meta retry-center__metric-meta--wrap">
                  {retryCenterAnalytics.topFailureReasons.length > 0
                    ? retryCenterAnalytics.topFailureReasons
                        .map((entry) => `${entry.reason} (${entry.total})`)
                        .join(" | ")
                    : "No failed records"}
                </p>
                {retryCenterFailureSuggestionRows.length > 0 ? (
                  <ul className="retry-center__reason-suggestions">
                    {retryCenterFailureSuggestionRows.map((entry) => (
                      <li className="retry-center__reason-suggestion" key={entry.reason}>
                        <strong>{entry.reason}:</strong> {entry.suggestion}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {retryCenterTopFailureReasonRetryRows.length > 0 ? (
                  <div className="retry-center__reason-actions">
                    {retryCenterTopFailureReasonRetryRows.map((entry) => (
                      <div className="retry-center__reason-row" key={entry.reason}>
                        <button
                          className={
                            entry.isCurrentFilter
                              ? "secondary-button secondary-button--small is-active"
                              : "secondary-button secondary-button--small"
                          }
                          onClick={() => setRetryCenterFailureReasonFilter(entry.reason)}
                          title={`Filter by failure reason "${entry.reason}"`}
                          type="button"
                        >
                          {`${entry.reason} (${entry.totalVisible})`}
                        </button>
                        <button
                          className="secondary-button secondary-button--small"
                          disabled={!activeTabId || entry.activeSessionVisibleFailed <= 0}
                          onClick={() => {
                            void retryVisibleRetryCenterEntriesWithScopeChoice(entry.reason);
                          }}
                          title={`Retry "${entry.reason}" failed transfers in active session with scope strategy`}
                          type="button"
                        >
                          {`Retry (${entry.activeSessionVisibleFailed})`}
                        </button>
                        <button
                          className="secondary-button secondary-button--small"
                          disabled={entry.totalVisible <= 0}
                          onClick={() => {
                            void clearVisibleRetryCenterEntriesByFailureReason(entry.reason);
                          }}
                          title={`Delete visible failed history records with reason "${entry.reason}"`}
                          type="button"
                        >
                          {`Delete (${entry.totalVisible})`}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <p className="retry-center__metric-meta">
                  Visible failed history only. Quick retry targets active-session entries and
                  follows retry-scope strategy (chooser or auto last scope); delete removes visible
                  failed history by reason.
                </p>
              </article>
            </div>
            {isRetryCenterGroupedView && retryCenterGroupedEntries.length > 0 ? (
              <div className="retry-center__group-actions">
                <button
                  className="secondary-button secondary-button--small"
                  disabled={!canExpandAllRetryCenterGroups}
                  onClick={expandAllRetryCenterGroups}
                  type="button"
                >
                  Expand All Groups
                </button>
                <button
                  className="secondary-button secondary-button--small"
                  disabled={!canCollapseAllRetryCenterGroups}
                  onClick={collapseAllRetryCenterGroups}
                  type="button"
                >
                  Collapse All Groups
                </button>
              </div>
            ) : null}
            <div className="retry-center__list-shell">
              {retryCenterEntries.length > 0 ? (
                isRetryCenterGroupedView ? (
                  <ul className="retry-center__group-list">
                    {retryCenterGroupedEntries.map((group) => {
                      const collapsed = retryCenterCollapsedGroupKeySet.has(group.key);
                      return (
                        <li className="retry-center__group-item" key={group.key}>
                          <div className="retry-center__group-header">
                            <button
                              aria-label={collapsed ? "Expand group" : "Collapse group"}
                              className="secondary-button secondary-button--small"
                              onClick={() => toggleRetryCenterGroupCollapsed(group.key)}
                              type="button"
                            >
                              {collapsed ? "Expand" : "Collapse"}
                            </button>
                            <div className="retry-center__group-info">
                              <p className="retry-center__group-title" title={group.label}>
                                {group.label}
                              </p>
                              <p className="retry-center__group-meta">
                                {group.total} item(s), failed {group.failedCount}, retryable{" "}
                                {group.activeSessionFailedCount}
                              </p>
                            </div>
                            <div className="retry-center__group-header-actions">
                              <button
                                className="secondary-button secondary-button--small"
                                onClick={() => selectRetryCenterGroupEntries(group.key)}
                                type="button"
                              >
                                {`Select (${group.total})`}
                              </button>
                              <button
                                className="secondary-button secondary-button--small"
                                disabled={!activeTabId || group.activeSessionFailedCount <= 0}
                                onClick={() => {
                                  void retryRetryCenterGroupFailedEntries(group.key);
                                }}
                                title="Retry failed active-session records in this group (scope selectable)"
                                type="button"
                              >
                                {`Retry Failed (${group.activeSessionFailedCount})`}
                              </button>
                              <button
                                className="secondary-button secondary-button--small"
                                onClick={() => {
                                  void clearRetryCenterGroupEntries(group.key);
                                }}
                                type="button"
                              >
                                {`Delete (${group.total})`}
                              </button>
                              <button
                                className="secondary-button secondary-button--small"
                                onClick={() => {
                                  void exportRetryCenterGroupHistoryJsonWithScopeChoice(group.key);
                                }}
                                type="button"
                              >
                                Export JSON
                              </button>
                              <button
                                className="secondary-button secondary-button--small"
                                onClick={() => {
                                  void exportRetryCenterGroupHistoryCsvWithScopeChoice(group.key);
                                }}
                                type="button"
                              >
                                Export CSV
                              </button>
                            </div>
                          </div>
                          {collapsed ? null : (
                            <ul className="retry-center__list">
                              {group.entries.map((entry) => {
                                const selected = retryCenterSelectionSet.has(entry.key);
                                return (
                                  <li
                                    className={
                                      selected
                                        ? "retry-center__item is-selected"
                                        : "retry-center__item"
                                    }
                                    key={entry.key}
                                  >
                                    <label className="retry-center__checkbox">
                                      <input
                                        checked={selected}
                                        onChange={() => toggleRetryCenterEntrySelection(entry.key)}
                                        type="checkbox"
                                      />
                                    </label>
                                    <span
                                      className={`retry-center__status retry-center__status--${entry.status}`}
                                    >
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
                                        {formatHistoryTimestamp(entry.updatedAt)} | {entry.direction} |
                                        attempts {entry.attemptCount}
                                        {entry.message ? ` | ${entry.message}` : ""}
                                      </p>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
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
                )
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
                disabled={retryCenterEntries.length === 0}
                onClick={() => {
                  void exportRetryCenterVisibleHistoryJson();
                }}
                type="button"
              >
                Export Visible JSON
              </button>
              <button
                className="secondary-button"
                disabled={retryCenterEntries.length === 0}
                onClick={() => {
                  void exportRetryCenterVisibleHistoryCsv();
                }}
                type="button"
              >
                Export Visible CSV
              </button>
              <button
                className="secondary-button"
                disabled={!canExportRetryCenterAnalytics}
                onClick={() => {
                  void exportRetryCenterAnalyticsJson();
                }}
                type="button"
              >
                Export Analytics JSON
              </button>
              <button
                className="secondary-button"
                disabled={!canExportRetryCenterAnalytics}
                onClick={() => {
                  void exportRetryCenterAnalyticsCsv();
                }}
                type="button"
              >
                Export Analytics CSV
              </button>
              <button
                className="secondary-button"
                disabled={!canRetryFailedUploads}
                onClick={() => {
                  void retryFailedUploads();
                }}
                title="Retry failed upload candidates for the active tab/session"
                type="button"
              >
                Retry Failed Uploads ({failedUploadRetryCandidates.length})
              </button>
              <button
                className="secondary-button"
                disabled={!canRetryFailedDownloads}
                onClick={() => {
                  void retryFailedDownloads();
                }}
                title="Retry failed download candidates for the active tab/session"
                type="button"
              >
                Retry Failed Downloads ({failedDownloadRetryCandidates.length})
              </button>
              <button
                className="secondary-button"
                disabled={!canRetryAllFailedTransfers}
                onClick={() => {
                  void retryAllFailedTransfersWithScopeChoice();
                }}
                title="Retry all failed upload/download candidates with retry-scope strategy"
                type="button"
              >
                Retry All Failed ({failedRetryCandidateTotal})
              </button>
              <button
                className="secondary-button"
                disabled={!canRetryVisibleRetryCenterEntries}
                onClick={() => {
                  void retryVisibleRetryCenterEntriesWithScopeChoice();
                }}
                title="Retry visible failed records with scope selection"
                type="button"
              >
                Retry Visible Failed
              </button>
              <button
                className="secondary-button"
                disabled={!canRetrySelectedRetryCenterEntries}
                onClick={() => {
                  void retrySelectedRetryCenterEntriesWithScopeChoice();
                }}
                title="Retry selected failed records with scope selection"
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

      {isCommandHistoryManagerOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
        >
          <div
            className="modal modal--command-history-manager"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Command History Manager"
          >
            <div className="modal__header">
              <h3>Command History Manager</h3>
              <button className="icon-button" onClick={closeCommandHistoryManager} type="button">
                <UiIcon name="close" />
              </button>
            </div>
            <p className="hint">
              Batch manage command records from current filter result.
            </p>
            <p className="hint command-history-manager__summary">
              Visible {visibleTerminalCommandHistoryEntries.length} | Selected{" "}
              {commandHistorySelection.length} | Total {terminalCommandHistoryEntries.length}
            </p>
            <div className="command-history-manager__toolbar">
              <button
                className="secondary-button secondary-button--small"
                onClick={() => {
                  void addTerminalCommandHistoryEntry();
                }}
                type="button"
              >
                Add
              </button>
              <button
                className="secondary-button secondary-button--small"
                onClick={() => {
                  void importTerminalCommandHistory();
                }}
                type="button"
              >
                Import
              </button>
              <button
                className="secondary-button secondary-button--small"
                disabled={terminalCommandHistoryEntries.length === 0}
                onClick={() => {
                  void exportTerminalCommandHistory();
                }}
                type="button"
              >
                Export
              </button>
              <button
                className="secondary-button secondary-button--small"
                disabled={visibleCommandHistoryIds.length === 0}
                onClick={toggleSelectAllVisibleCommandHistory}
                type="button"
              >
                {allVisibleCommandHistorySelected ? "Unselect Visible" : "Select Visible"}
              </button>
              <button
                className="secondary-button secondary-button--small"
                disabled={commandHistorySelection.length === 0}
                onClick={clearCommandHistorySelection}
                type="button"
              >
                Clear Selection
              </button>
            </div>
            <div className="command-history-manager__list-shell">
              {visibleTerminalCommandHistoryEntries.length === 0 ? (
                <p className="hint command-history-manager__empty">No command history entries.</p>
              ) : (
                <ul className="command-history-manager__list">
                  {visibleTerminalCommandHistoryEntries.map((entry) => (
                    <li className="command-history-manager__item" key={entry.id}>
                      <div
                        className="command-history-manager__row"
                        onDoubleClick={(event) => {
                          const target = event.target as HTMLElement;
                          if (target.closest("button, input")) {
                            return;
                          }
                          void pasteTerminalCommandHistoryEntry(entry);
                        }}
                        title="Double-click command text area to paste into active terminal."
                      >
                        <label className="command-history-manager__checkbox">
                          <input
                            checked={selectedCommandHistoryIdSet.has(entry.id)}
                            onChange={() => toggleCommandHistorySelection(entry.id)}
                            type="checkbox"
                          />
                          <span className="command-history-manager__command">
                            <code>{entry.command}</code>
                          </span>
                        </label>
                        <button
                          className="secondary-button secondary-button--small command-history-manager__edit"
                          onClick={() => {
                            void editTerminalCommandHistoryEntry(entry);
                          }}
                          type="button"
                        >
                          Edit
                        </button>
                      </div>
                      <p className="hint command-history-manager__meta">
                        {entry.tabTitle} | {formatHistoryTimestamp(entry.executedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="modal__actions">
              <button
                className="secondary-button"
                disabled={commandHistorySelection.length === 0}
                onClick={deleteSelectedCommandHistoryEntries}
                type="button"
              >
                Delete Selected ({commandHistorySelection.length})
              </button>
              <button
                className="secondary-button"
                disabled={visibleTerminalCommandHistoryEntries.length === 0}
                onClick={deleteVisibleCommandHistoryEntries}
                type="button"
              >
                Delete Visible ({visibleTerminalCommandHistoryEntries.length})
              </button>
              <button
                className="secondary-button"
                disabled={terminalCommandHistoryEntries.length === 0}
                onClick={deleteAllCommandHistoryEntries}
                type="button"
              >
                Delete All ({terminalCommandHistoryEntries.length})
              </button>
              <button className="primary-button" onClick={closeCommandHistoryManager} type="button">
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isCommandSnippetManagerOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
        >
          <div
            className="modal modal--snippet-manager"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Command Snippet Manager"
          >
            <div className="modal__header">
              <h3>Command Snippet Manager</h3>
              <button className="icon-button" onClick={closeCommandSnippetManager} type="button">
                <UiIcon name="close" />
              </button>
            </div>
            <p className="hint snippet-manager__summary">
              Groups {commandSnippetGroups.length}/{MAX_COMMAND_SNIPPET_GROUPS} | Snippets{" "}
              {totalCommandSnippetCount}
            </p>
            <div className="snippet-manager__toolbar">
              <button
                className="secondary-button secondary-button--small"
                onClick={addCommandSnippetManagerGroup}
                type="button"
              >
                New Group
              </button>
              <button
                className="secondary-button secondary-button--small"
                disabled={!selectedCommandSnippetManagerGroup}
                onClick={() => {
                  void deleteCommandSnippetManagerGroup();
                }}
                type="button"
              >
                Delete Group
              </button>
              <button
                className="secondary-button secondary-button--small"
                onClick={addCommandSnippetManagerSnippet}
                type="button"
              >
                New Snippet
              </button>
              <button
                className="secondary-button secondary-button--small"
                disabled={!selectedCommandSnippetManagerSnippet}
                onClick={() => {
                  void runSelectedCommandSnippetManagerSnippet();
                }}
                type="button"
              >
                Run Selected
              </button>
              <button
                className="secondary-button secondary-button--small"
                disabled={!selectedCommandSnippetManagerSnippet}
                onClick={() => {
                  void deleteCommandSnippetManagerSnippet();
                }}
                type="button"
              >
                Delete Snippet
              </button>
              <button
                className="secondary-button secondary-button--small"
                onClick={() => {
                  void importCommandSnippetGroups().catch((caughtError) => {
                    setError(toLogMessage(caughtError));
                  });
                }}
                type="button"
              >
                Import JSON
              </button>
              <button
                className="secondary-button secondary-button--small"
                disabled={commandSnippetGroups.length === 0}
                onClick={() => {
                  void exportCommandSnippetGroups();
                }}
                type="button"
              >
                Export JSON
              </button>
              <button
                className="secondary-button secondary-button--small"
                disabled={commandSnippetGroups.length === 0}
                onClick={() => {
                  void clearAllCommandSnippetGroups();
                }}
                type="button"
              >
                Clear All
              </button>
            </div>
            <div className="snippet-manager__layout">
              <section className="snippet-manager__column">
                <h4 className="snippet-manager__title">Groups</h4>
                <label className="snippet-manager__field">
                  Group Name
                  <input
                    disabled={!selectedCommandSnippetManagerGroup}
                    onChange={(event) => {
                      if (!selectedCommandSnippetManagerGroup) {
                        return;
                      }
                      updateCommandSnippetManagerGroupName(
                        selectedCommandSnippetManagerGroup.id,
                        event.target.value
                      );
                    }}
                    onBlur={() => {
                      if (!selectedCommandSnippetManagerGroup) {
                        return;
                      }
                      if (selectedCommandSnippetManagerGroup.name.trim()) {
                        return;
                      }
                      updateCommandSnippetManagerGroupName(
                        selectedCommandSnippetManagerGroup.id,
                        "Unnamed Group"
                      );
                    }}
                    type="text"
                    value={selectedCommandSnippetManagerGroup?.name ?? ""}
                  />
                </label>
                <div className="snippet-manager__list-shell">
                  {commandSnippetGroups.length === 0 ? (
                    <p className="hint snippet-manager__empty">No snippet groups.</p>
                  ) : (
                    <ul className="snippet-manager__list">
                      {commandSnippetGroups.map((group) => (
                        <li key={group.id}>
                          <button
                            className={
                              group.id === selectedCommandSnippetManagerGroup?.id
                                ? "snippet-manager__list-button is-active"
                                : "snippet-manager__list-button"
                            }
                            onClick={() => {
                              setCommandSnippetManagerGroupId(group.id);
                              setCommandSnippetManagerSnippetId(group.snippets[0]?.id ?? "");
                            }}
                            type="button"
                          >
                            <span>{group.name.trim() || "Unnamed Group"}</span>
                            <span className="snippet-manager__count">{group.snippets.length}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
              <section className="snippet-manager__column">
                <h4 className="snippet-manager__title">
                  Snippets ({selectedCommandSnippetManagerGroup?.snippets.length ?? 0}/
                  {MAX_COMMAND_SNIPPETS_PER_GROUP})
                </h4>
                <p className="hint snippet-manager__meta">
                  Double-click to run snippet directly.
                </p>
                <div className="snippet-manager__list-shell">
                  {!selectedCommandSnippetManagerGroup ? (
                    <p className="hint snippet-manager__empty">Select a group first.</p>
                  ) : selectedCommandSnippetManagerGroup.snippets.length === 0 ? (
                    <p className="hint snippet-manager__empty">No snippets in selected group.</p>
                  ) : (
                    <ul className="snippet-manager__list">
                      {selectedCommandSnippetManagerGroup.snippets.map((snippet) => (
                        <li key={snippet.id}>
                          <button
                            className={
                              snippet.id === selectedCommandSnippetManagerSnippet?.id
                                ? "snippet-manager__list-button is-active"
                                : "snippet-manager__list-button"
                            }
                            onClick={() => {
                              setCommandSnippetManagerSnippetId(snippet.id);
                            }}
                            onDoubleClick={() => {
                              setCommandSnippetManagerSnippetId(snippet.id);
                              void runCommandSnippet(snippet);
                            }}
                            type="button"
                          >
                            <span>{snippet.name.trim() || "Unnamed Snippet"}</span>
                            <span className="snippet-manager__count">
                              {snippet.confirmBeforeRun ? "C" : ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
              <section className="snippet-manager__editor">
                <h4 className="snippet-manager__title">Editor</h4>
                {selectedCommandSnippetManagerSnippet ? (
                  <>
                    <label className="snippet-manager__field">
                      Snippet Name
                      <input
                        onChange={(event) => {
                          updateCommandSnippetManagerSnippetName(
                            selectedCommandSnippetManagerSnippet.id,
                            event.target.value
                          );
                        }}
                        onBlur={() => {
                          if (selectedCommandSnippetManagerSnippet.name.trim()) {
                            return;
                          }
                          updateCommandSnippetManagerSnippetName(
                            selectedCommandSnippetManagerSnippet.id,
                            "Unnamed Snippet"
                          );
                        }}
                        type="text"
                        value={selectedCommandSnippetManagerSnippet.name}
                      />
                    </label>
                    <label className="snippet-manager__field">
                      Command Template
                      <textarea
                        className="snippet-manager__textarea"
                        onChange={(event) => {
                          updateCommandSnippetManagerSnippetTemplate(
                            selectedCommandSnippetManagerSnippet.id,
                            event.target.value
                          );
                        }}
                        value={selectedCommandSnippetManagerSnippet.template}
                      />
                    </label>
                    <label className="settings-checkbox">
                      <input
                        checked={selectedCommandSnippetManagerSnippet.confirmBeforeRun}
                        onChange={(event) => {
                          updateCommandSnippetManagerSnippetConfirm(
                            selectedCommandSnippetManagerSnippet.id,
                            event.target.checked
                          );
                        }}
                        type="checkbox"
                      />
                      <span>Require confirmation before run</span>
                    </label>
                    <p className="hint snippet-manager__meta">
                      Placeholders: {"${clipboard}"} {"${date}"} {"${time}"} {"${datetime}"}{" "}
                      {"${sessionName}"} {"${host}"} {"${username}"} {"${tabTitle}"}
                    </p>
                  </>
                ) : (
                  <p className="hint snippet-manager__empty">Select or create a snippet to edit.</p>
                )}
              </section>
            </div>
            <div className="modal__actions">
              <button className="primary-button" onClick={closeCommandSnippetManager} type="button">
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {commandHistoryContextMenu ? (
        <div
          className="sftp-context-menu"
          onContextMenu={(event) => event.preventDefault()}
          ref={commandHistoryContextMenuRef}
          style={{
            left: `${Math.max(8, Math.min(commandHistoryContextMenu.x, window.innerWidth - 196))}px`,
            top: `${Math.max(
              8,
              Math.min(
                commandHistoryContextMenu.y,
                window.innerHeight - (selectedCommandHistoryContextEntry ? 152 : 192)
              )
            )}px`
          }}
        >
          {selectedCommandHistoryContextEntry ? (
            <>
              <button
                className="sftp-context-menu__item"
                onClick={() => {
                  closeCommandHistoryContextMenu();
                  void runTerminalCommandHistoryEntry(selectedCommandHistoryContextEntry);
                }}
                type="button"
              >
                Run
              </button>
              <button
                className="sftp-context-menu__item"
                onClick={() => {
                  closeCommandHistoryContextMenu();
                  void copyTerminalCommandHistoryEntry(selectedCommandHistoryContextEntry);
                }}
                type="button"
              >
                Copy
              </button>
              <button
                className="sftp-context-menu__item is-danger"
                onClick={() => {
                  closeCommandHistoryContextMenu();
                  deleteTerminalCommandHistoryEntry(selectedCommandHistoryContextEntry.id);
                }}
                type="button"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                className="sftp-context-menu__item"
                onClick={() => {
                  closeCommandHistoryContextMenu();
                  void addTerminalCommandHistoryEntry();
                }}
                type="button"
              >
                Add
              </button>
              <button
                className="sftp-context-menu__item"
                onClick={() => {
                  closeCommandHistoryContextMenu();
                  void importTerminalCommandHistory();
                }}
                type="button"
              >
                Import
              </button>
              <button
                className="sftp-context-menu__item"
                disabled={terminalCommandHistoryEntries.length === 0}
                onClick={() => {
                  closeCommandHistoryContextMenu();
                  void exportTerminalCommandHistory();
                }}
                type="button"
              >
                Export
              </button>
              <button
                className="sftp-context-menu__item"
                disabled={totalCommandSnippetCount === 0}
                onClick={() => {
                  closeCommandHistoryContextMenu();
                  openCommandSnippetManager();
                }}
                type="button"
              >
                Run Snippet
              </button>
              <button
                className="sftp-context-menu__item"
                onClick={() => {
                  closeCommandHistoryContextMenu();
                  void openCommandSnippetManager();
                }}
                type="button"
              >
                Snippet Manager
              </button>
              <button
                className="sftp-context-menu__item"
                onClick={() => {
                  closeCommandHistoryContextMenu();
                  openCommandHistoryManager();
                }}
                type="button"
              >
                Manage
              </button>
            </>
          )}
          <button
            className="sftp-context-menu__item"
            onClick={closeCommandHistoryContextMenu}
            type="button"
          >
            Close
          </button>
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
                        const isConflicting = hotkeyConflictActionSet.has(action);
                        const isFocused = hotkeyFocusedAction === action;
                        const conflictBindingLabel =
                          hotkeyConflictBindingByAction.get(action) ?? "";
                        const rowClassName = [
                          "settings-hotkey-row",
                          isConflicting ? "is-conflict" : "",
                          isFocused ? "is-focused-conflict" : ""
                        ]
                          .filter(Boolean)
                          .join(" ");
                        return (
                          <div
                            className={rowClassName}
                            key={action}
                            ref={(element) => {
                              registerHotkeyRowRef(action, element);
                            }}
                          >
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
                                {isConflicting ? (
                                  <span className="settings-hotkey-row__conflict-badge">
                                    Conflict
                                  </span>
                                ) : null}
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
                            {isConflicting ? (
                              <p className="settings-hotkey-row__conflict-hint hint">
                                Conflicts on <code>{conflictBindingLabel}</code>.
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    {hotkeyConflicts.length > 0 ? (
                      <div className="settings-hotkey-conflicts" role="alert">
                        <p className="settings-hotkey-conflicts__title">
                          Hotkey conflicts detected ({hotkeyConflicts.length})
                        </p>
                        <div className="settings-hotkey-conflicts__toolbar">
                          <button
                            className="secondary-button secondary-button--small"
                            onClick={focusPreviousHotkeyConflict}
                            type="button"
                          >
                            Prev
                          </button>
                          <span className="hint settings-hotkey-conflicts__cursor">
                            {hotkeyConflictCursorIndex + 1} / {hotkeyConflicts.length}
                          </span>
                          <button
                            className="secondary-button secondary-button--small"
                            onClick={focusNextHotkeyConflict}
                            type="button"
                          >
                            Next
                          </button>
                        </div>
                        <ul className="settings-hotkey-conflicts__list">
                          {hotkeyConflicts.map((conflict, index) => (
                            <li
                              className={
                                index === hotkeyConflictCursorIndex
                                  ? "settings-hotkey-conflicts__item is-active"
                                  : "settings-hotkey-conflicts__item"
                              }
                              key={conflict.signature}
                            >
                              <span className="settings-hotkey-conflicts__summary">
                                <code>
                                  {formatHotkeyBindingLabel(
                                    {
                                      enabled: true,
                                      modifier: conflict.modifier,
                                      key: conflict.key
                                    },
                                    isMacPlatform
                                  )}
                                </code>
                                <span>
                                  {conflict.actions
                                    .map((action) => getHotkeyActionDescription(action))
                                    .join(" / ")}
                                </span>
                              </span>
                              <button
                                className="secondary-button secondary-button--small settings-hotkey-conflicts__locate"
                                onClick={() => focusHotkeyConflictAtIndex(index)}
                                type="button"
                              >
                                Locate
                              </button>
                            </li>
                          ))}
                        </ul>
                        <p className="hint">
                          Conflicts may trigger only the first matching action. Auto resolve
                          keeps the first action and disables the rest.
                        </p>
                        <p className="hint">
                          Keyboard navigation: <code>Alt + [</code> previous, <code>Alt + ]</code>{" "}
                          next.
                        </p>
                        <div className="modal__actions">
                          <button
                            className="secondary-button"
                            onClick={() => focusHotkeyConflictAtIndex(0)}
                            type="button"
                          >
                            Focus First Conflict
                          </button>
                          <button
                            className="secondary-button"
                            onClick={resolveHotkeyConflicts}
                            type="button"
                          >
                            Auto Resolve Conflicts
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <p className="hint">
                      Windows defaults use <code>Ctrl + Shift + C</code> /{" "}
                      <code>Ctrl + Shift + V</code> for terminal copy/paste, and keeps
                      Alt-based keys for tab and search actions. macOS keeps the existing
                      Cmd-based behavior.
                    </p>
                    <div className="modal__actions">
                      <button
                        className="secondary-button"
                        onClick={() => {
                          void importHotkeyPreferences();
                        }}
                        type="button"
                      >
                        Import Hotkeys...
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => {
                          void exportHotkeyPreferences();
                        }}
                        type="button"
                      >
                        Export Hotkeys...
                      </button>
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
                    <label>
                      Retry Confirm Threshold
                      <input
                        max={MAX_RETRY_BATCH_CONFIRM_THRESHOLD}
                        min={MIN_RETRY_BATCH_CONFIRM_THRESHOLD}
                        onChange={(event) =>
                          setRetryBatchConfirmThreshold((prev) =>
                            parseRetryBatchConfirmThreshold(Number(event.target.value), prev)
                          )
                        }
                        type="number"
                        value={retryBatchConfirmThreshold}
                      />
                    </label>
                    <p className="hint">
                      Controls max parallel upload/download tasks. Range: 1-8.
                    </p>
                    <p className="hint">
                      Large retry batches at or above this threshold require confirmation. Set to{" "}
                      <code>0</code> to disable confirmations. Range:{" "}
                      {MIN_RETRY_BATCH_CONFIRM_THRESHOLD}-{MAX_RETRY_BATCH_CONFIRM_THRESHOLD}.
                    </p>
                    <p className="hint">
                      Active-session conflict defaults:
                      {activeSessionId
                        ? ` Upload ${formatTransferConflictStrategyLabel(
                            activeSessionTransferConflictStrategy?.upload
                          )}, Download ${formatTransferConflictStrategyLabel(
                            activeSessionTransferConflictStrategy?.download
                          )}.`
                        : " Open a terminal tab to configure remembered conflict behavior."}
                    </p>
                    {activeSessionId ? (
                      <div className="field-row">
                        <button
                          className="field-row__action"
                          disabled={!activeSessionTransferConflictStrategy?.upload}
                          onClick={() => {
                            clearSessionTransferConflictStrategy(activeSessionId, "upload");
                            showTransferDockNotice(
                              activeTabId ?? "",
                              "info",
                              "Cleared remembered upload conflict default for active session.",
                              5000
                            );
                          }}
                          type="button"
                        >
                          Clear Upload Default
                        </button>
                        <button
                          className="field-row__action"
                          disabled={!activeSessionTransferConflictStrategy?.download}
                          onClick={() => {
                            clearSessionTransferConflictStrategy(activeSessionId, "download");
                            showTransferDockNotice(
                              activeTabId ?? "",
                              "info",
                              "Cleared remembered download conflict default for active session.",
                              5000
                            );
                          }}
                          type="button"
                        >
                          Clear Download Default
                        </button>
                        <button
                          className="field-row__action"
                          disabled={
                            !activeSessionTransferConflictStrategy?.upload &&
                            !activeSessionTransferConflictStrategy?.download
                          }
                          onClick={() => {
                            clearSessionTransferConflictStrategy(activeSessionId);
                            showTransferDockNotice(
                              activeTabId ?? "",
                              "info",
                              "Cleared all remembered conflict defaults for active session.",
                              5000
                            );
                          }}
                          type="button"
                        >
                          Clear All
                        </button>
                      </div>
                    ) : null}
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
                      <label>
                        Time
                        <select
                          onChange={(event) =>
                            setPortForwardEventTimeRange(
                              event.target.value as PortForwardEventTimeRange
                            )
                          }
                          value={portForwardEventTimeRange}
                        >
                          <option value="all">All</option>
                          <option value="5m">Last 5m</option>
                          <option value="30m">Last 30m</option>
                          <option value="1h">Last 1h</option>
                          <option value="24h">Last 24h</option>
                        </select>
                      </label>
                      <label>
                        Error Code
                        <select
                          onChange={(event) => setPortForwardEventErrorCode(event.target.value)}
                          value={portForwardEventErrorCode}
                        >
                          {portForwardEventErrorCodeOptions.map((code) => (
                            <option key={code} value={code}>
                              {code === "all" ? "All" : code}
                            </option>
                          ))}
                          {portForwardEventErrorCode !== "all" &&
                          !portForwardEventErrorCodeOptions.includes(portForwardEventErrorCode) ? (
                            <option value={portForwardEventErrorCode}>
                              {portForwardEventErrorCode}
                            </option>
                          ) : null}
                        </select>
                      </label>
                      <label>
                        Correlation
                        <input
                          onChange={(event) =>
                            setPortForwardEventCorrelationQuery(event.target.value)
                          }
                          placeholder="correlationKey / connectionId"
                          value={portForwardEventCorrelationQuery}
                        />
                      </label>
                      <button
                        className="secondary-button"
                        disabled={!hasCustomizedPortForwardEventView}
                        onClick={resetPortForwardEventViewFilters}
                        type="button"
                      >
                        Reset Filters
                      </button>
                      <button
                        className="secondary-button"
                        disabled={visiblePortForwardEventHistory.length === 0}
                        onClick={() => {
                          void exportVisiblePortForwardEventsJson();
                        }}
                        type="button"
                      >
                        Export Visible JSON
                      </button>
                      <button
                        className="secondary-button"
                        disabled={visiblePortForwardEventHistory.length === 0}
                        onClick={() => {
                          void exportVisiblePortForwardEventsCsv();
                        }}
                        type="button"
                      >
                        Export Visible CSV
                      </button>
                      <button
                        className="secondary-button"
                        disabled={!activeSessionId}
                        onClick={() => {
                          void exportPortForwardEventAnalyticsJson();
                        }}
                        type="button"
                      >
                        Export Analytics JSON
                      </button>
                      <button
                        className="secondary-button"
                        disabled={!activeSessionId}
                        onClick={() => {
                          void exportPortForwardEventAnalyticsCsv();
                        }}
                        type="button"
                      >
                        Export Analytics CSV
                      </button>
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
                      {portForwardEventTimeRange !== "all"
                        ? `, range ${portForwardEventTimeRange}`
                        : ""}
                      {portForwardEventErrorCode !== "all"
                        ? `, code ${portForwardEventErrorCode}`
                        : ""}
                    </p>
                    <div className="settings-port-forward-events-analytics">
                      <article className="settings-port-forward-events-metric">
                        <p className="settings-port-forward-events-metric__label">Error Ratio</p>
                        <p className="settings-port-forward-events-metric__value">
                          {formatPercent(portForwardVisibleEventAnalytics.errorRatioPercent)}
                        </p>
                        <p className="settings-port-forward-events-metric__meta">
                          Errors {portForwardVisibleEventAnalytics.totalErrors}/
                          {portForwardVisibleEventAnalytics.totalVisible}
                        </p>
                      </article>
                      <article className="settings-port-forward-events-metric">
                        <p className="settings-port-forward-events-metric__label">Type Breakdown</p>
                        <p className="settings-port-forward-events-metric__meta">
                          created {portForwardVisibleEventAnalytics.typeCounts.created} | removed{" "}
                          {portForwardVisibleEventAnalytics.typeCounts.removed}
                        </p>
                        <p className="settings-port-forward-events-metric__meta">
                          degraded {portForwardVisibleEventAnalytics.typeCounts.statusDegraded} |
                          recovered {portForwardVisibleEventAnalytics.typeCounts.statusRecovered}
                        </p>
                      </article>
                      <article className="settings-port-forward-events-metric">
                        <p className="settings-port-forward-events-metric__label">Top Error Codes</p>
                        <p className="settings-port-forward-events-metric__meta settings-port-forward-events-metric__meta--wrap">
                          {portForwardVisibleEventAnalytics.topErrorCodes.length > 0
                            ? portForwardVisibleEventAnalytics.topErrorCodes
                                .map((entry) => `${entry.code} (${entry.count})`)
                                .join(" | ")
                            : "No error code data"}
                        </p>
                      </article>
                      <article className="settings-port-forward-events-metric">
                        <p className="settings-port-forward-events-metric__label">Top Correlation</p>
                        <p className="settings-port-forward-events-metric__meta settings-port-forward-events-metric__meta--wrap">
                          {portForwardVisibleEventAnalytics.topCorrelations.length > 0
                            ? portForwardVisibleEventAnalytics.topCorrelations
                                .map((entry) => `${entry.correlationKey} (${entry.count})`)
                                .join(" | ")
                            : "No correlation key data"}
                        </p>
                      </article>
                    </div>
                    <div className="settings-port-forward-list-shell settings-port-forward-list-shell--events">
                      {visiblePortForwardEventHistory.length > 0 ? (
                        <ul className="settings-port-forward-events-list">
                          {visiblePortForwardEventHistory.map((event) => {
                            const correlation = formatPortForwardEventCorrelation(event);
                            return (
                              <li
                                className={
                                  event.level === "error"
                                    ? "settings-port-forward-event-item is-error"
                                    : "settings-port-forward-event-item"
                                }
                                key={event.id}
                              >
                                <p className="settings-port-forward-event-item__title">
                                  {formatPortForwardEventType(event.type)}{" "}
                                  {formatPortForwardEventSummary(event)}
                                </p>
                                <p className="settings-port-forward-event-item__meta">
                                  {formatPortForwardTimestamp(event.createdAt)} |{" "}
                                  {event.level.toUpperCase()}
                                </p>
                                {correlation ? (
                                  <p className="settings-port-forward-event-item__correlation">
                                    {correlation}
                                  </p>
                                ) : null}
                                <p className="settings-port-forward-event-item__message">
                                  {event.message}
                                </p>
                              </li>
                            );
                          })}
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

                    <p className="settings-port-forward-section__title">
                      Disconnect Reports ({visibleDisconnectReports.length}/{disconnectReports.length})
                    </p>
                    <label className="settings-checkbox settings-checkbox--inline">
                      <input
                        checked={disconnectReportCapturePreferences.enabled}
                        onChange={(event) => {
                          setDisconnectReportCapturePreferences({
                            enabled: event.target.checked
                          });
                        }}
                        type="checkbox"
                      />
                      <span>Auto capture unexpected disconnect reports</span>
                    </label>
                    <div className="settings-disconnect-reports-toolbar">
                      <label>
                        Scope
                        <select
                          onChange={(event) => {
                            setDisconnectReportScope(event.target.value as DisconnectReportScope);
                          }}
                          value={disconnectReportScope}
                        >
                          <option value="allSessions">All Sessions</option>
                          <option value="activeSession">Active Session</option>
                        </select>
                      </label>
                      <label>
                        Trigger
                        <select
                          onChange={(event) => {
                            setDisconnectReportTriggerFilter(
                              event.target.value as DisconnectReportTriggerFilter
                            );
                          }}
                          value={disconnectReportTriggerFilter}
                        >
                          <option value="all">All</option>
                          <option value="status">Status</option>
                          <option value="error">Error</option>
                        </select>
                      </label>
                      <label>
                        Time
                        <select
                          onChange={(event) => {
                            setDisconnectReportTimeRange(
                              event.target.value as DisconnectReportTimeRange
                            );
                          }}
                          value={disconnectReportTimeRange}
                        >
                          <option value="all">All</option>
                          <option value="5m">Last 5m</option>
                          <option value="30m">Last 30m</option>
                          <option value="1h">Last 1h</option>
                          <option value="24h">Last 24h</option>
                        </select>
                      </label>
                      <label className="settings-disconnect-reports-toolbar__query">
                        Search
                        <input
                          onChange={(event) => {
                            setDisconnectReportQuery(event.target.value.slice(0, 160));
                          }}
                          placeholder="session/target/message"
                          value={disconnectReportQuery}
                        />
                      </label>
                      <button
                        className="secondary-button secondary-button--small"
                        disabled={!hasCustomizedDisconnectReportView}
                        onClick={resetDisconnectReportViewFilters}
                        type="button"
                      >
                        Reset Filters
                      </button>
                    </div>
                    <p className="hint">
                      {disconnectReportCapturePreferences.enabled
                        ? "Unexpected disconnects are auto-captured with connection and transfer context. Use export when reporting random disconnect issues."
                        : "Auto capture is disabled. Re-enable it to collect future disconnect reports automatically."}
                    </p>
                    <div className="modal__actions settings-disconnect-reports__actions">
                      <button
                        className="secondary-button"
                        disabled={visibleDisconnectReports.length === 0}
                        onClick={() => {
                          void exportDisconnectReportsJson();
                        }}
                        type="button"
                      >
                        Export Visible JSON
                      </button>
                      <button
                        className="secondary-button"
                        disabled={visibleDisconnectReports.length === 0}
                        onClick={() => {
                          void exportDisconnectReportsCsv();
                        }}
                        type="button"
                      >
                        Export Visible CSV
                      </button>
                      <button
                        className="secondary-button"
                        disabled={visibleDisconnectReports.length === 0}
                        onClick={() => {
                          void copyLatestVisibleDisconnectReport();
                        }}
                        type="button"
                      >
                        Copy Latest Visible
                      </button>
                      <button
                        className="secondary-button"
                        disabled={visibleDisconnectReports.length === 0}
                        onClick={() => {
                          void clearVisibleDisconnectReportsHistory();
                        }}
                        type="button"
                      >
                        Clear Visible
                      </button>
                      <button
                        className="secondary-button"
                        disabled={disconnectReports.length === 0}
                        onClick={() => {
                          void clearDisconnectReportsHistory();
                        }}
                        type="button"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="settings-disconnect-reports-shell">
                      {visibleDisconnectReports.length > 0 ? (
                        <ul className="settings-disconnect-reports-list">
                          {visibleDisconnectReports.slice(0, 50).map((report) => {
                            const transferActive =
                              report.uploadRunning +
                              report.uploadQueued +
                              report.downloadRunning +
                              report.downloadQueued;
                            const isTabOpen = terminalTabs.some((tab) => tab.id === report.tabId);
                            return (
                              <li className="settings-disconnect-report-item" key={report.id}>
                                <div className="settings-disconnect-report-item__header">
                                  <p className="settings-disconnect-report-item__title">
                                    {formatPortForwardTimestamp(report.createdAt)} |{" "}
                                    {report.sessionName}
                                  </p>
                                  <p className="settings-disconnect-report-item__meta">
                                    {report.tabTitle} | {report.target}
                                  </p>
                                  <p className="settings-disconnect-report-item__meta">
                                    Trigger:{" "}
                                    {report.trigger === "error"
                                      ? `error (${report.message})`
                                      : `${report.status ?? "closed"} (${report.message})`}
                                  </p>
                                  <p className="settings-disconnect-report-item__meta">
                                    Transfers active: {transferActive} (up {report.uploadRunning}
                                    /{report.uploadQueued}, down {report.downloadRunning}/
                                    {report.downloadQueued}) | Port forwards:{" "}
                                    {report.portForwardTotal} ({report.portForwardDegraded} degraded)
                                  </p>
                                  <p className="settings-disconnect-report-item__meta">
                                    Tabs: {report.connectedTabCount}/{report.openTabCount} connected
                                    | Auto reconnect:{" "}
                                    {report.autoReconnect
                                      ? `on (${report.reconnectDelaySeconds}s)`
                                      : "off"}
                                  </p>
                                  {report.recentFailures.length > 0 ? (
                                    <p className="settings-disconnect-report-item__message">
                                      Recent failures:{" "}
                                      {report.recentFailures
                                        .slice(0, 3)
                                        .map(
                                          (failure) =>
                                            `${failure.direction}:${failure.name} (${classifyTransferFailureReason(failure.message)})`
                                        )
                                        .join(" | ")}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="modal__actions settings-disconnect-report-item__actions">
                                  <button
                                    className="secondary-button"
                                    onClick={() => {
                                      void copyDisconnectReportJson(report);
                                    }}
                                    type="button"
                                  >
                                    Copy JSON
                                  </button>
                                  {isTabOpen ? (
                                    <button
                                      className="secondary-button"
                                      onClick={() => {
                                        setActiveTabId(report.tabId);
                                      }}
                                      type="button"
                                    >
                                      Focus Tab
                                    </button>
                                  ) : null}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="hint">
                          {disconnectReports.length === 0
                            ? "No disconnect reports captured yet."
                            : "No disconnect reports match the current filter."}
                        </p>
                      )}
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
              <button className="icon-button" onClick={closeMoveGroupDialog} type="button">
                <UiIcon name="close" />
              </button>
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

      {appDialog && appDialog.mode !== "alert" ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className={
              appDialog.mode === "choice"
                ? "modal modal--compact app-dialog app-dialog--choice"
                : "modal modal--compact app-dialog"
            }
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={appDialog.title}
          >
            <div className="modal__header">
              <h3>{appDialog.title}</h3>
              <button className="icon-button" onClick={closeAppDialog} type="button">
                <UiIcon name="close" />
              </button>
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
            ) : (appDialog.mode === "confirm" || appDialog.mode === "choice") && appDialog.detailText ? (
              <textarea
                className="app-dialog__textarea app-dialog__textarea--readonly"
                readOnly
                value={appDialog.detailText}
              />
            ) : null}
            {appDialog.mode === "prompt" && appDialog.multiline ? (
              <p className="hint app-dialog__hint">Use Ctrl+Enter to confirm.</p>
            ) : null}
            <div
              className={
                appDialog.mode === "choice"
                  ? "modal__actions app-dialog__choice-actions"
                  : "modal__actions"
              }
            >
              <button
                className={
                  appDialog.mode === "choice"
                    ? "secondary-button app-dialog__choice-cancel"
                    : "secondary-button"
                }
                onClick={closeAppDialog}
                type="button"
              >
                {appDialog.cancelLabel}
              </button>
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

      {error ? (
        <div className="error-bar" role="status">
          <p className="error-bar__message">{error}</p>
          {globalErrorRecovery.hint ? (
            <p className="hint error-bar__hint">{globalErrorRecovery.hint}</p>
          ) : null}
          <div className="error-bar__actions">
            {globalErrorRecovery.canReconnect ? (
              <button
                className="secondary-button secondary-button--small"
                onClick={() => {
                  void reconnectActiveTabFromError();
                }}
                type="button"
              >
                Reconnect
              </button>
            ) : null}
            {globalErrorRecovery.canOpenLogs ? (
              <button
                className="secondary-button secondary-button--small"
                onClick={() => {
                  void openLogDirectory();
                }}
                type="button"
              >
                Open Logs
              </button>
            ) : null}
            <button
              className="secondary-button secondary-button--small"
              onClick={() => {
                openDiagnosticsFromError();
              }}
              type="button"
            >
              Diagnostics
            </button>
            <button
              className="secondary-button secondary-button--small"
              onClick={() => {
                void copyGlobalErrorMessage();
              }}
              type="button"
            >
              Copy Error
            </button>
            {globalErrorRecovery.canCopyLatestDisconnectReport ? (
              <button
                className="secondary-button secondary-button--small"
                onClick={() => {
                  void copyLatestDisconnectReport();
                }}
                type="button"
              >
                Copy Latest Disconnect
              </button>
            ) : null}
            <button
              aria-label="Dismiss error"
              className="icon-button"
              onClick={dismissGlobalError}
              title="Dismiss"
              type="button"
            >
              <UiIcon name="close" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}


