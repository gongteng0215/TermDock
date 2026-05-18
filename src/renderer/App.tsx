import {
  DragEvent,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import packageJson from "../../package.json";

import type {
  SessionCreateInput,
  SessionRecord,
  SshConfigParseResult,
  SessionUpdateInput
} from "../shared/session";
import type {
  SessionMigrationImportCandidate,
  SessionMigrationPlainPayload
} from "../shared/session-migration";
import type {
  SftpDirectoryListResult,
  SftpEntry,
  SftpTransferEvent
} from "../shared/sftp";
import type {
  CreatePortForwardInput,
  PortForwardEventRecord,
  PortForwardRecord,
  TerminalConnectionStatus
} from "../shared/terminal";
import { formatSshConnectionError } from "../shared/ssh-error-diagnostics";
import type { RemoteOpenFileAutoSyncEvent } from "../shared/system";
import {
  LEGACY_TERMINAL_COMMAND_HISTORY_STORAGE_KEYS,
  MAX_TERMINAL_COMMAND_HISTORY,
  MAX_TERMINAL_COMMAND_HISTORY_COMMAND_LENGTH,
  readTerminalCommandHistory,
  TERMINAL_EDITOR_FOCUS_CURSOR_OPTIONS,
  TERMINAL_EDITOR_FOCUS_FONT_OPTIONS,
  TERMINAL_EDITOR_FOCUS_RHYTHM_OPTIONS,
  TERMINAL_EDITOR_FOCUS_THEME_OPTIONS,
  TERMINAL_EDITOR_FOCUS_TYPOGRAPHY_OPTIONS,
  TERMINAL_COMMAND_HISTORY_APPEND_EVENT,
  TERMINAL_COMMAND_HISTORY_REMOVE_EVENT,
  TERMINAL_COMMAND_HISTORY_STORAGE_KEY,
  TerminalWorkspace
} from "./components/terminal-workspace";
import { UiIcon } from "./components/ui-icon";
import type {
  ConnectionPreferences,
  HotkeyBindingPreference,
  HotkeyModifier,
  HotkeyPreferences,
  TerminalCommandHistoryEntry,
  TerminalCommandHistorySource,
  TerminalEditorFocusCursorId,
  TerminalEditorFocusFontId,
  TerminalEditorFocusRhythmId,
  TerminalEditorFocusThemeId,
  TerminalEditorFocusTypographyId,
  TerminalTab
} from "./components/terminal-workspace";
import {
  AppInlineHintPanel,
  TransferDock,
  WorkbenchLayout,
  WorkbenchTopbar
} from "./components/workbench-shell";
import {
  CommandHistoryInspectorSection,
  SftpExplorerSection,
  ServerHealthInspectorSection,
  SessionsInspectorSection
} from "./components/workbench-panels";
import { SettingsModalShell } from "./components/settings-modal-shell";
import { SettingsModalContent } from "./components/settings-modal-content";
import {
  WorkbenchContextMenu,
  type WorkbenchContextMenuAction
} from "./components/workbench-context-menus";
import {
  buildConnectionSettingsSectionProps,
  buildDiagnosticsSettingsSectionProps,
  buildFileOpeningSettingsSectionProps,
  buildHotkeySettingsSectionProps,
  buildPortForwardingSettingsSectionProps,
  buildSafetySettingsSectionProps,
  buildServerHealthSettingsSectionProps,
  buildSftpSettingsSectionProps,
  buildWorkspaceSettingsSectionProps
} from "./settings-section-props";
import {
  WorkbenchExplorerSidebar,
  WorkbenchInspectorSidebar
} from "./components/workbench-sidebars";
import {
  readCommandHistoryInspectorCollapsed,
  readFirstRunOnboardingDismissed,
  readInspectorSidebarTabId,
  readSftpExplorerViewMode,
  type InspectorSidebarTabId,
  type SftpExplorerViewMode,
  writeCommandHistoryInspectorCollapsed,
  writeFirstRunOnboardingDismissed,
  writeInspectorSidebarTabId,
  writeSftpExplorerViewMode
} from "./workbench-ui-preferences";
import {
  APP_LANGUAGE_OPTIONS,
  getI18n,
  localizeDomNode,
  localizeDomTree,
  readAppLanguagePreference,
  translateAppText,
  writeAppLanguagePreference,
  type AppLanguage,
  type SettingsSectionI18nKey,
  type WorkspaceProfileI18nKey
} from "./i18n";
import {
  createDefaultDangerousCommandGuardPreferences,
  listDangerousCommandBuiltinRules,
  listDangerousCommandEnvironmentTemplates,
  listDangerousCommandExecutionSources,
  listDangerousCommandPolicyPacks,
  MAX_DANGEROUS_COMMAND_GROUP_ASSIGNMENTS,
  MAX_DANGEROUS_COMMAND_PERSISTENT_APPROVALS,
  normalizeDangerousCommandGuardPreferences,
  type DangerousCommandApprovalRequest,
  type DangerousCommandBuiltinRuleId,
  type DangerousCommandEnvironmentTemplateId,
  type DangerousCommandExecutionSource,
  type DangerousCommandGuardPreferences,
  type DangerousCommandPersistentApproval,
  type DangerousCommandPersistentApprovalScopeId,
  type DangerousCommandPolicyPackId
} from "./dangerous-command-guard";
import { useCommandHistoryViewModels } from "./use-command-history-view-models";
import { useDisconnectDiagnosticsActions } from "./use-disconnect-diagnostics-actions";
import { useDisconnectDiagnosticsViewModels } from "./use-disconnect-diagnostics-view-models";
import {
  formatDangerousCommandTemporaryApprovalScopeLabel,
  useDangerousCommandApprovalFlow
} from "./use-dangerous-command-approval-flow";
import { useDangerousCommandSettingsViewModels } from "./use-dangerous-command-settings-view-models";
import { usePortForwardingViewModels } from "./use-port-forwarding-view-models";
import { useRetryCenterViewModels } from "./use-retry-center-view-models";
import { useServerHealthMonitor } from "./use-server-health-monitor";
import { useSessionGroupingViewModels } from "./use-session-grouping-view-models";
import { useSftpActivityViewModels } from "./use-sftp-activity-view-models";
import { useSftpSettingsViewModels } from "./use-sftp-settings-view-models";
import {
  usePendingTransferRestoreRuntime,
  useSftpTransferBatchNotifications,
  useSftpTransferQueueRuntime
} from "./use-sftp-transfer-runtime";

const LazyCommandSnippetManagerModal = lazy(async () => ({
  default: (await import("./components/command-snippet-manager-modal")).CommandSnippetManagerModal
}));
const LazyCommandHistoryManagerModal = lazy(async () => ({
  default: (await import("./components/workbench-modals")).CommandHistoryManagerModal
}));
const LazyOperationCenterModal = lazy(async () => ({
  default: (await import("./components/workbench-modals")).OperationCenterModal
}));
const LazyRetryCenterModal = lazy(async () => ({
  default: (await import("./components/workbench-modals")).RetryCenterModal
}));

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
const TERMINAL_EDITOR_FOCUS_PREFERENCES_STORAGE_KEY = "termdock.terminal-editor-focus.v1";
const HOTKEY_PREFERENCES_STORAGE_KEY = "termdock.hotkey-preferences.v1";
const HOTKEY_CONFLICT_NAV_STORAGE_KEY = "termdock.hotkey-conflict-nav.v1";
const FILE_OPEN_PREFERENCES_STORAGE_KEY = "termdock.file-open-preferences.v1";
const LEGACY_SFTP_TRANSFER_PREFERENCES_STORAGE_KEY = "termdock.sftp-transfer-preferences.v1";
const PREVIOUS_SFTP_TRANSFER_PREFERENCES_STORAGE_KEY = "termdock.sftp-transfer-preferences.v2";
const SFTP_TRANSFER_PREFERENCES_STORAGE_KEY = "termdock.sftp-transfer-preferences.v3";
const SFTP_TRANSFER_POLICY_PACKS_STORAGE_KEY = "termdock.sftp-transfer-policy-packs.v1";
const SFTP_TRANSFER_POLICY_PACK_SYNC_STORAGE_KEY = "termdock.sftp-transfer-policy-pack-sync.v1";
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
const WORKSPACE_PROFILE_STORAGE_KEY = "termdock.workspace-profile.v1";
const SESSION_QUICK_PROFILES_STORAGE_KEY = "termdock.session-quick-profiles.v1";
const SESSION_TEMPLATES_STORAGE_KEY = "termdock.session-templates.v1";
const COMMAND_SNIPPET_GROUPS_STORAGE_KEY = "termdock.command-snippet-groups.v1";
const COMMAND_SNIPPET_SCOPED_VALUES_STORAGE_KEY = "termdock.command-snippet-scoped-values.v1";
const SERVER_HEALTH_ALERT_PREFERENCES_STORAGE_KEY = "termdock.server-health-alert-preferences.v1";
const DANGEROUS_COMMAND_GUARD_PREFERENCES_STORAGE_KEY =
  "termdock.dangerous-command-guard-preferences.v1";
const DANGEROUS_COMMAND_POLICY_BUNDLES_STORAGE_KEY =
  "termdock.dangerous-command-policy-bundles.v1";
const DANGEROUS_COMMAND_POLICY_BUNDLE_SYNC_STORAGE_KEY =
  "termdock.dangerous-command-policy-bundle-sync.v1";
const MAX_SFTP_TRANSFER_HISTORY = 800;
const MAX_PORT_FORWARD_EVENT_HISTORY = 1200;
const MAX_PORT_FORWARD_EVENT_HISTORY_PER_SESSION = 320;
const MAX_DISCONNECT_REPORT_HISTORY = 120;
const MAX_PENDING_TRANSFER_RESTORE_ITEMS = 2000;
const MAX_SESSION_QUICK_PROFILES = 80;
const MAX_SESSION_TEMPLATES = 60;
const MAX_SESSION_TEMPLATE_ENV_VARS = 16;
const MAX_COMMAND_SNIPPET_GROUPS = 40;
const MAX_COMMAND_SNIPPETS_PER_GROUP = 120;
const MAX_COMMAND_SNIPPET_PROMPT_SETS = 24;
const MAX_DANGEROUS_COMMAND_POLICY_BUNDLES = 40;
const MAX_SFTP_TRANSFER_POLICY_PACKS = 24;
const MAX_DANGEROUS_COMMAND_TEMP_APPROVALS = 80;
const MAX_COMMAND_SNIPPET_PARAMETERS = 12;
const MAX_COMMAND_SNIPPET_PROMPT_SET_NAME_LENGTH = 80;
const MAX_COMMAND_SNIPPET_PARAMETER_KEY_LENGTH = 32;
const MAX_COMMAND_SNIPPET_PARAMETER_LABEL_LENGTH = 80;
const MAX_COMMAND_SNIPPET_PARAMETER_DEFAULT_LENGTH = 240;
const COMMAND_HISTORY_INSPECTOR_PREVIEW_LIMIT = 5;
const MAX_COMMAND_SNIPPET_PARAMETER_PATTERN_LENGTH = 240;
const MAX_COMMAND_SNIPPET_SCOPED_VALUES = 400;
const MAX_OPERATION_CENTER_APP_JOBS = 24;
const DEFAULT_RETRY_BATCH_CONFIRM_THRESHOLD = 100;
const MIN_RETRY_BATCH_CONFIRM_THRESHOLD = 0;
const MAX_RETRY_BATCH_CONFIRM_THRESHOLD = 2000;
const MAX_SFTP_TRANSFER_CONCURRENCY = 12;
const MAX_SFTP_TRANSFER_RATE_LIMIT_KIBPS = 1024 * 1024;
const SFTP_UPLOAD_CHANNEL_OPEN_RETRY_LIMIT = 4;
const SFTP_UPLOAD_CHANNEL_OPEN_BACKOFF_BASE_MS = 250;
const SFTP_UPLOAD_CHANNEL_OPEN_BACKOFF_MAX_MS = 2_500;
const SFTP_UPLOAD_DIRECTORY_PREWARM_CONCURRENCY = 12;
const SFTP_UPLOAD_CONFLICT_SCAN_CONCURRENCY = 10;
const SFTP_TRANSFER_WINDOW_EVALUATION_INTERVAL_MS = 30_000;
const SFTP_TRANSFER_SCHEDULE_DAY_OPTIONS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" }
] as const;
const SFTP_TRANSFER_SCHEDULE_PRESETS: SftpTransferSchedulePresetRecord[] = [
  {
    id: "always-on",
    label: "Always On",
    description: "Do not restrict queued transfers by weekday or time window.",
    scheduleWindowEnabled: false,
    scheduleWindowStartMinutes: 0,
    scheduleWindowEndMinutes: 0,
    scheduleWindowDays: SFTP_TRANSFER_SCHEDULE_DAY_OPTIONS.map((option) => option.value)
  },
  {
    id: "business-hours",
    label: "Business Hours",
    description: "Allow queued work during weekday office hours.",
    scheduleWindowEnabled: true,
    scheduleWindowStartMinutes: 9 * 60,
    scheduleWindowEndMinutes: 18 * 60,
    scheduleWindowDays: [1, 2, 3, 4, 5]
  },
  {
    id: "weeknights",
    label: "Weeknights",
    description: "Hold queued work for weekday evening and overnight maintenance windows.",
    scheduleWindowEnabled: true,
    scheduleWindowStartMinutes: 18 * 60,
    scheduleWindowEndMinutes: 9 * 60,
    scheduleWindowDays: [1, 2, 3, 4, 5]
  },
  {
    id: "weekends",
    label: "Weekends",
    description: "Run queued work only on Saturday and Sunday.",
    scheduleWindowEnabled: true,
    scheduleWindowStartMinutes: 0,
    scheduleWindowEndMinutes: 0,
    scheduleWindowDays: [0, 6]
  }
];
const COMMAND_SNIPPET_PARAMETER_TOKEN_PATTERN = /\$\{param:([a-zA-Z0-9_-]+)\}/g;
const COMMAND_SNIPPET_PARAMETER_KEY_SANITIZE_PATTERN = /[^a-zA-Z0-9_-]+/g;
const DEFAULT_CONNECTION_PREFERENCES: ConnectionPreferences = {
  autoReconnect: true,
  reconnectDelaySeconds: 3
};
const DEFAULT_TERMINAL_EDITOR_FOCUS_PREFERENCES: TerminalEditorFocusPreferences = {
  autoLayoutEnabled: true,
  themeId: TERMINAL_EDITOR_FOCUS_THEME_OPTIONS[0]?.id ?? "midnight",
  typographyId: TERMINAL_EDITOR_FOCUS_TYPOGRAPHY_OPTIONS[1]?.id ?? "balanced",
  fontId: TERMINAL_EDITOR_FOCUS_FONT_OPTIONS[0]?.id ?? "system",
  rhythmId: TERMINAL_EDITOR_FOCUS_RHYTHM_OPTIONS[1]?.id ?? "steady",
  cursorId: TERMINAL_EDITOR_FOCUS_CURSOR_OPTIONS[2]?.id ?? "block"
};
const APP_VERSION = typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
const DEFAULT_WORKSPACE_PROFILE_PREFERENCES: WorkspaceProfilePreferences = {
  profileId: "none",
  syncDangerousCommandSafety: false
};
const WORKSPACE_PROFILE_OPTIONS: Array<{
  id: WorkspaceProfileId;
}> = [
  {
    id: "none"
  },
  {
    id: "dev"
  },
  {
    id: "staging"
  },
  {
    id: "prod"
  }
];

function getWorkspaceProfileOption(profileId: WorkspaceProfileId) {
  return (
    WORKSPACE_PROFILE_OPTIONS.find((profile) => profile.id === profileId) ??
    WORKSPACE_PROFILE_OPTIONS[0]
  );
}

type SettingsSectionId =
  | "connection"
  | "workspace"
  | "safety"
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
type WorkspaceProfileId = DangerousCommandEnvironmentTemplateId;
type CommandSnippetVariableScopeId = "snippet" | "group" | "session" | "global";
type OperationCenterAppJobCategory = "sessions" | "snippets" | "diagnostics";
type OperationCenterAppJobStatus = "running" | "succeeded" | "failed";

const COMMAND_SNIPPET_VARIABLE_SCOPES: Array<{
  id: CommandSnippetVariableScopeId;
  label: string;
  description: string;
}> = [
  {
    id: "snippet",
    label: "Per Snippet",
    description: "Remember the last value only for this snippet."
  },
  {
    id: "group",
    label: "Per Group",
    description: "Reuse the last value across snippets in the same group."
  },
  {
    id: "session",
    label: "Per Session",
    description: "Reuse the last value for the active SSH session."
  },
  {
    id: "global",
    label: "Global",
    description: "Reuse the last value everywhere in this app."
  }
];

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
  uploadRateLimitKiBps: number;
  downloadRateLimitKiBps: number;
  scheduleWindowEnabled: boolean;
  scheduleWindowStartMinutes: number;
  scheduleWindowEndMinutes: number;
  scheduleWindowDays: number[];
}

interface SftpTransferPolicyPackRecord {
  id: string;
  name: string;
  description: string;
  updatedAtIso: string;
  preferences: SftpTransferPreferences;
}

interface SftpTransferPolicyPackSyncState {
  filePath: string;
  lastPulledAtIso: string | null;
  lastPushedAtIso: string | null;
  autoPullOnLaunch: boolean;
  autoPushOnChange: boolean;
}

interface SftpTransferSchedulePresetRecord {
  id: string;
  label: string;
  description: string;
  scheduleWindowEnabled: boolean;
  scheduleWindowStartMinutes: number;
  scheduleWindowEndMinutes: number;
  scheduleWindowDays: number[];
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

interface WorkspaceProfilePreferences {
  profileId: WorkspaceProfileId;
  syncDangerousCommandSafety: boolean;
}

interface TerminalEditorFocusPreferences {
  autoLayoutEnabled: boolean;
  themeId: TerminalEditorFocusThemeId;
  typographyId: TerminalEditorFocusTypographyId;
  fontId: TerminalEditorFocusFontId;
  rhythmId: TerminalEditorFocusRhythmId;
  cursorId: TerminalEditorFocusCursorId;
}

interface OperationCenterAppJob {
  id: string;
  category: OperationCenterAppJobCategory;
  title: string;
  description: string;
  status: OperationCenterAppJobStatus;
  startedAt: number;
  finishedAt?: number;
  detail?: string;
  outputPath?: string;
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
  uploadConcurrency: 4,
  downloadConcurrency: 2,
  uploadRateLimitKiBps: 0,
  downloadRateLimitKiBps: 0,
  scheduleWindowEnabled: false,
  scheduleWindowStartMinutes: 0,
  scheduleWindowEndMinutes: 0,
  scheduleWindowDays: SFTP_TRANSFER_SCHEDULE_DAY_OPTIONS.map((option) => option.value)
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
const DEFAULT_DANGEROUS_COMMAND_GUARD_PREFERENCES =
  createDefaultDangerousCommandGuardPreferences();
const DANGEROUS_COMMAND_BUILTIN_RULES = listDangerousCommandBuiltinRules();
const DANGEROUS_COMMAND_POLICY_PACKS = listDangerousCommandPolicyPacks();
const DANGEROUS_COMMAND_ENVIRONMENT_TEMPLATES = listDangerousCommandEnvironmentTemplates();
const DANGEROUS_COMMAND_EXECUTION_SOURCES = listDangerousCommandExecutionSources();
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

type ServerHealthDetailTab = "overview" | "disk" | "network" | "processes" | "services";

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
  channelOpenRetryCount?: number;
  notBeforeAt?: number;
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

interface SessionTemplateEnvVar {
  id: string;
  key: string;
  value: string;
}

interface SessionTemplateDraft {
  templateName: string;
  sessionName: string;
  host: string;
  port: string;
  username: string;
  authType: SessionCreateInput["authType"];
  privateKeyPath: string;
  groupId: string;
  remark: string;
  favorite: boolean;
  secret: string;
  envVars: SessionTemplateEnvVar[];
}

interface SessionTemplateRecord extends SessionTemplateDraft {
  id: string;
  createdAt: number;
  updatedAt: number;
}

interface CommandSnippetItem {
  id: string;
  name: string;
  template: string;
  confirmBeforeRun: boolean;
  previewBeforeRun: boolean;
  promptSetId: string;
  parameters: CommandSnippetParameter[];
}

interface CommandSnippetParameter {
  id: string;
  key: string;
  label: string;
  defaultValue: string;
  required: boolean;
  pattern: string;
  scope: CommandSnippetVariableScopeId;
}

interface CommandSnippetPromptSet {
  id: string;
  name: string;
  parameters: CommandSnippetParameter[];
}

interface CommandSnippetGroup {
  id: string;
  name: string;
  promptSets: CommandSnippetPromptSet[];
  snippets: CommandSnippetItem[];
}

interface CommandSnippetScopedValueRecord {
  value: string;
  updatedAt: number;
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

interface SessionMigrationImportParseResult {
  candidates: SessionMigrationImportCandidate[];
  warnings: string[];
  source: SessionMigrationPlainPayload;
}

interface SshConfigImportPreviewStats {
  duplicateCount: number;
  importableCount: number;
  newCount: number;
  privateKeyCount: number;
  warningCount: number;
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

interface DangerousCommandPolicyBundleRecord {
  id: string;
  name: string;
  description: string;
  updatedAtIso: string;
  preferences: DangerousCommandGuardPreferences;
}

interface DangerousCommandPolicyBundleSyncState {
  filePath: string;
  lastPulledAtIso: string | null;
  lastPushedAtIso: string | null;
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
  inputType?: "text" | "password";
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
  translateDetailText?: boolean;
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
  inputType?: "text" | "password";
}

interface AppChoiceDialogOptions {
  title?: string;
  cancelLabel?: string;
  detailText?: string;
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

function getSettingsSectionI18nKey(section: SettingsSectionId): SettingsSectionI18nKey {
  return section;
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

function isSftpChannelOpenFailureError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /(channel open failure|administratively prohibited|open failed|unable to start subsystem:?\s*sftp|subsystem request failed)/i.test(
    message
  );
}

function getSftpChannelOpenRetryDelayMs(retryCount: number): number {
  const normalizedRetryCount = Math.max(0, Math.trunc(retryCount));
  return Math.min(
    SFTP_UPLOAD_CHANNEL_OPEN_BACKOFF_MAX_MS,
    SFTP_UPLOAD_CHANNEL_OPEN_BACKOFF_BASE_MS * 2 ** normalizedRetryCount
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

function isClipboardUnavailableError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /clipboard unavailable/i.test(message);
}

function isPreferredOpenerConfigurationError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /(configured windows opener was not found|quote paths with spaces|preferred (?:program|opener)|file opening)/i.test(
    message
  );
}

function isHotkeyRecoverableError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /(invalid hotkey file|hotkey|shortcut conflict|shortcut binding)/i.test(message);
}

function isPortForwardRecoverableError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /(port forwarding|forwarded connection|listen port|target host|target port|forwarding policy|already exists on .*:\d+)/i.test(
    message
  );
}

function isSafetyRecoverableError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /(dangerous command|safety (?:bundle|guardrail|settings)|safety bundles?|policy bundles?|guard preferences)/i.test(
    message
  );
}

function isWorkspaceRecoverableError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /(workspace profile|workspace safety sync|workspace settings|profile sync)/i.test(message);
}

function isServerHealthRecoverableError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /(server monitor|server health|health snapshot|process details|failed services|monitor command)/i.test(
    message
  );
}

function isDiagnosticsRecoverableError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return /(diagnostics|log bridge|log info|log directory|bug report|disconnect report|snapshot export)/i.test(
    message
  );
}

function resolveTransferRecoveryReasonForError(message?: string): string | null {
  const normalized = message?.trim() ?? "";
  if (!normalized) {
    return null;
  }
  if (isRemotePathMissingError(normalized) || isSftpChannelOpenFailureError(normalized)) {
    return classifyTransferFailureReason(normalized);
  }
  if (
    /(upload|download|transfer|sftp|remote file|remote path|remote directory|retry failed|queue paused)/i.test(
      normalized
    )
  ) {
    return classifyTransferFailureReason(normalized);
  }
  const classified = classifyTransferFailureReason(normalized);
  if (
    classified === "Target already exists" ||
    classified === "Storage full or quota limit"
  ) {
    return classified;
  }
  return null;
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

function isTerminalCommandHistorySourceValue(
  value: unknown
): value is TerminalCommandHistorySource {
  return value === "screen" || value === "buffer" || value === "manual" || value === "imported";
}

function formatTerminalCommandHistorySourceLabel(source: TerminalCommandHistorySource): string {
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

interface ImportedCommandHistoryCandidate {
  command: string;
  source: TerminalCommandHistorySource;
}

function parseImportedCommandHistoryCommands(payload: unknown): ImportedCommandHistoryCandidate[] {
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
  const parsed: ImportedCommandHistoryCandidate[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    let command = "";
    let source: TerminalCommandHistorySource = "imported";
    if (typeof row === "string") {
      command = row.trim();
    } else if (row && typeof row === "object") {
      const candidate = row as Record<string, unknown>;
      command = typeof candidate.command === "string" ? candidate.command.trim() : "";
      if (isTerminalCommandHistorySourceValue(candidate.source)) {
        source = candidate.source;
      }
    }
    if (!command || seen.has(command)) {
      continue;
    }
    seen.add(command);
    parsed.push({
      command: command.slice(0, MAX_TERMINAL_COMMAND_HISTORY_COMMAND_LENGTH),
      source
    });
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

function formatSessionJsonImportPreview(
  result: SessionJsonImportParseResult,
  language: AppLanguage = "en"
): string {
  const lines: string[] = [];
  const tr = (value: string) => translateAppText(language, value);
  lines.push(
    language === "zh-CN"
      ? `可导入会话：${result.candidates.length}`
      : `Importable sessions: ${result.candidates.length}`
  );
  const previewRows = result.candidates.slice(0, 40);
  for (const candidate of previewRows) {
    const authLabel =
      candidate.authType === "privateKey" && candidate.privateKeyPath
        ? `key=${candidate.privateKeyPath}`
        : "password";
    const groupLabel = candidate.groupId || "Ungrouped";
    lines.push(
      `- ${candidate.name}: ${candidate.username}@${candidate.host}:${candidate.port} [${tr(groupLabel)}] (${tr(authLabel)})`
    );
  }
  if (result.candidates.length > previewRows.length) {
    lines.push(
      language === "zh-CN"
        ? `... 还有 ${result.candidates.length - previewRows.length} 条记录`
        : `... ${result.candidates.length - previewRows.length} more entries`
    );
  }
  if (result.warnings.length > 0) {
    lines.push("");
    lines.push(language === "zh-CN" ? "警告：" : "Warnings:");
    for (const warning of result.warnings.slice(0, 20)) {
      lines.push(`- ${tr(warning)}`);
    }
    if (result.warnings.length > 20) {
      lines.push(
        language === "zh-CN"
          ? `... 还有 ${result.warnings.length - 20} 条警告`
          : `... ${result.warnings.length - 20} more warnings`
      );
    }
  }
  return lines.join("\n");
}

function buildSessionMigrationImportResult(
  payload: SessionMigrationPlainPayload,
  warnings: string[]
): SessionMigrationImportParseResult {
  const candidates = payload.sessions
    .map((session): SessionMigrationImportCandidate => {
      const authType: SessionCreateInput["authType"] =
        session.authType === "privateKey" && session.privateKeyPath.trim()
          ? "privateKey"
          : "password";
      return {
        name: session.name.trim(),
        host: session.host.trim(),
        port: session.port,
        username: session.username.trim(),
        authType,
        privateKeyPath: authType === "privateKey" ? session.privateKeyPath.trim() : "",
        groupId: session.groupId.trim(),
        remark: session.remark.trim(),
        favorite: session.favorite,
        secret: session.secret
      };
    })
    .filter((session) => session.name && session.host && session.username);
  return {
    candidates,
    warnings,
    source: payload
  };
}

function formatSessionMigrationImportPreview(result: SessionMigrationImportParseResult): string {
  const lines: string[] = [];
  const passwordCount = result.candidates.filter(
    (candidate) => candidate.authType === "password" && candidate.secret
  ).length;
  const privateKeyCount = result.candidates.filter(
    (candidate) => candidate.authType === "privateKey" && candidate.privateKeyPath
  ).length;
  const privateKeySecretCount = result.candidates.filter(
    (candidate) => candidate.authType === "privateKey" && candidate.secret
  ).length;
  lines.push(`Importable sessions: ${result.candidates.length}`);
  lines.push(`Encrypted passwords restored: ${passwordCount}`);
  lines.push(`Private-key sessions: ${privateKeyCount}`);
  lines.push(`Private-key passphrases restored: ${privateKeySecretCount}`);
  lines.push(`Source app version: ${result.source.appVersion || "-"}`);
  lines.push(`Exported at: ${result.source.exportedAtIso || "-"}`);
  lines.push("");
  for (const candidate of result.candidates.slice(0, 40)) {
    const authLabel =
      candidate.authType === "privateKey" && candidate.privateKeyPath
        ? `key=${candidate.privateKeyPath}${candidate.secret ? ", passphrase restored" : ""}`
        : candidate.secret
          ? "password restored"
          : "password missing";
    const groupLabel = candidate.groupId || "Ungrouped";
    lines.push(
      `- ${candidate.name}: ${candidate.username}@${candidate.host}:${candidate.port} [${groupLabel}] (${authLabel})`
    );
  }
  if (result.candidates.length > 40) {
    lines.push(`... ${result.candidates.length - 40} more entries`);
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

function isRemotePathWithinBranch(candidatePath: string, branchPath: string): boolean {
  if (!branchPath) {
    return false;
  }
  if (branchPath === "/") {
    return candidatePath === "/" || candidatePath.startsWith("/");
  }
  return candidatePath === branchPath || candidatePath.startsWith(`${branchPath}/`);
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

function formatSshConfigPreview(
  result: SshConfigParseResult,
  language: AppLanguage = "en"
): string {
  const lines: string[] = [];
  const tr = (value: string) => translateAppText(language, value);
  lines.push(language === "zh-CN" ? `文件：${result.filePath}` : `File: ${result.filePath}`);
  lines.push(language === "zh-CN" ? `解析到的主机：${result.candidates.length}` : `Parsed hosts: ${result.candidates.length}`);
  lines.push("");
  const previewRows = result.candidates.slice(0, 30);
  for (const candidate of previewRows) {
    const authLabel =
      candidate.authType === "privateKey" && candidate.privateKeyPath
        ? `key=${candidate.privateKeyPath}`
        : "password";
    lines.push(
      `- ${candidate.name}: ${candidate.username}@${candidate.host}:${candidate.port} (${tr(authLabel)})`
    );
  }
  if (result.candidates.length > previewRows.length) {
    lines.push(
      language === "zh-CN"
        ? `... 还有 ${result.candidates.length - previewRows.length} 个 Host 条目`
        : `... ${result.candidates.length - previewRows.length} more host entries`
    );
  }
  if (result.warnings.length > 0) {
    lines.push("");
    lines.push(language === "zh-CN" ? "警告：" : "Warnings:");
    for (const warning of result.warnings.slice(0, 10)) {
      lines.push(`- ${warning}`);
    }
    if (result.warnings.length > 10) {
      lines.push(
        language === "zh-CN"
          ? `... 还有 ${result.warnings.length - 10} 条警告`
          : `... ${result.warnings.length - 10} more warnings`
      );
    }
  }
  return lines.join("\n");
}

function buildSshConfigImportPreviewStats(
  result: SshConfigParseResult,
  existingConnectionKeys: Set<string>
): SshConfigImportPreviewStats {
  let duplicateCount = 0;
  let privateKeyCount = 0;
  for (const candidate of result.candidates) {
    if (
      existingConnectionKeys.has(
        buildSessionConnectionKey(candidate.host, candidate.port, candidate.username)
      )
    ) {
      duplicateCount += 1;
    }
    if (candidate.authType === "privateKey") {
      privateKeyCount += 1;
    }
  }
  return {
    duplicateCount,
    importableCount: result.candidates.length,
    newCount: Math.max(0, result.candidates.length - duplicateCount),
    privateKeyCount,
    warningCount: result.warnings.length
  };
}

function formatSshConfigImportPlan(
  result: SshConfigParseResult,
  stats: SshConfigImportPreviewStats,
  targetGroup: string,
  duplicateStrategy: "skip" | "overwrite" | "rename",
  language: AppLanguage = "en"
): string {
  const tr = (value: string) => translateAppText(language, value);
  const duplicateStrategyLabel =
    language === "zh-CN"
      ? ({
          skip: "跳过重复项",
          overwrite: "覆盖现有会话",
          rename: "创建重命名副本"
        })[duplicateStrategy]
      : duplicateStrategy;
  const lines = formatSshConfigPreview(result, language).split("\n");
  lines.splice(
    2,
    0,
    language === "zh-CN" ? `新建会话：${stats.newCount}` : `New sessions: ${stats.newCount}`,
    language === "zh-CN" ? `重复目标：${stats.duplicateCount}` : `Duplicate targets: ${stats.duplicateCount}`,
    language === "zh-CN" ? `私钥会话：${stats.privateKeyCount}` : `Private-key sessions: ${stats.privateKeyCount}`,
    language === "zh-CN"
      ? `目标分组：${tr(targetGroup || "Ungrouped")}`
      : `Target group: ${targetGroup || "Ungrouped"}`,
    language === "zh-CN"
      ? `重复项策略：${duplicateStrategyLabel}`
      : `Duplicate strategy: ${duplicateStrategy}`
  );
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
  if (
    lowered.includes("channel open failure") ||
    lowered.includes("administratively prohibited") ||
    lowered.includes("unable to start subsystem: sftp") ||
    lowered.includes("subsystem request failed")
  ) {
    return "SSH channel limit reached";
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
  if (reason === "SSH channel limit reached") {
    return "SSH server rejected opening more transfer channels. Reduce upload concurrency or retry smaller batches.";
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

function formatOptionalPercent(value?: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return formatPercent(value ?? 0);
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
  return Math.min(MAX_SFTP_TRANSFER_CONCURRENCY, Math.max(1, Math.trunc(value)));
}

function parseSftpTransferRateLimitKiBps(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(MAX_SFTP_TRANSFER_RATE_LIMIT_KIBPS, Math.max(0, Math.trunc(value)));
}

function parseSftpScheduleMinutes(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(24 * 60 - 1, Math.max(0, Math.trunc(value)));
}

function normalizeSftpScheduleDays(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const seen = new Set<number>();
  const normalized: number[] = [];
  for (const rawValue of value) {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      continue;
    }
    const day = Math.trunc(rawValue);
    if (day < 0 || day > 6 || seen.has(day)) {
      continue;
    }
    seen.add(day);
    normalized.push(day);
  }
  if (normalized.length === 0) {
    return [...fallback];
  }
  normalized.sort((left, right) => left - right);
  return normalized;
}

function formatSftpScheduleTimeInputValue(minutes: number): string {
  const normalizedMinutes = parseSftpScheduleMinutes(
    minutes,
    DEFAULT_SFTP_TRANSFER_PREFERENCES.scheduleWindowStartMinutes
  );
  const hours = Math.floor(normalizedMinutes / 60)
    .toString()
    .padStart(2, "0");
  const mins = (normalizedMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function parseSftpScheduleTimeInputValue(rawValue: string, fallback: number): number {
  const normalized = rawValue.trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return fallback;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return fallback;
  }
  return hours * 60 + minutes;
}

function resolveSftpTransferRateLimitBytesPerSecond(rateLimitKiBps: number): number | undefined {
  if (rateLimitKiBps <= 0) {
    return undefined;
  }
  return rateLimitKiBps * 1024;
}

function isWithinSftpTransferScheduleWindow(
  preferences: SftpTransferPreferences,
  date = new Date()
): boolean {
  if (!preferences.scheduleWindowEnabled) {
    return true;
  }
  const days = normalizeSftpScheduleDays(
    preferences.scheduleWindowDays,
    DEFAULT_SFTP_TRANSFER_PREFERENCES.scheduleWindowDays
  );
  const startMinutes = parseSftpScheduleMinutes(
    preferences.scheduleWindowStartMinutes,
    DEFAULT_SFTP_TRANSFER_PREFERENCES.scheduleWindowStartMinutes
  );
  const endMinutes = parseSftpScheduleMinutes(
    preferences.scheduleWindowEndMinutes,
    DEFAULT_SFTP_TRANSFER_PREFERENCES.scheduleWindowEndMinutes
  );
  const currentDay = date.getDay();
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  if (startMinutes === endMinutes) {
    return days.includes(currentDay);
  }
  if (startMinutes < endMinutes) {
    return days.includes(currentDay) && currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  if (currentMinutes >= startMinutes) {
    return days.includes(currentDay);
  }
  const previousDay = (currentDay + 6) % 7;
  return days.includes(previousDay) && currentMinutes < endMinutes;
}

function formatSftpTransferScheduleWindowSummary(preferences: SftpTransferPreferences): string {
  const days = normalizeSftpScheduleDays(
    preferences.scheduleWindowDays,
    DEFAULT_SFTP_TRANSFER_PREFERENCES.scheduleWindowDays
  );
  const dayLabels = SFTP_TRANSFER_SCHEDULE_DAY_OPTIONS.filter((option) =>
    days.includes(option.value)
  ).map((option) => option.label);
  return `${dayLabels.join(", ")} ${formatSftpScheduleTimeInputValue(
    preferences.scheduleWindowStartMinutes
  )}-${formatSftpScheduleTimeInputValue(preferences.scheduleWindowEndMinutes)}`;
}

function createSftpTransferSchedulePreferencesFromPreset(
  preset: SftpTransferSchedulePresetRecord
): SftpTransferPreferences {
  return normalizeSftpTransferPreferences({
    ...DEFAULT_SFTP_TRANSFER_PREFERENCES,
    scheduleWindowEnabled: preset.scheduleWindowEnabled,
    scheduleWindowStartMinutes: preset.scheduleWindowStartMinutes,
    scheduleWindowEndMinutes: preset.scheduleWindowEndMinutes,
    scheduleWindowDays: preset.scheduleWindowDays
  });
}

function doesSftpTransferSchedulePresetMatchPreferences(
  preset: SftpTransferSchedulePresetRecord,
  preferences: SftpTransferPreferences
): boolean {
  const presetPreferences = createSftpTransferSchedulePreferencesFromPreset(preset);
  const normalizedPreferences = normalizeSftpTransferPreferences(preferences);
  return (
    presetPreferences.scheduleWindowEnabled === normalizedPreferences.scheduleWindowEnabled &&
    presetPreferences.scheduleWindowStartMinutes === normalizedPreferences.scheduleWindowStartMinutes &&
    presetPreferences.scheduleWindowEndMinutes === normalizedPreferences.scheduleWindowEndMinutes &&
    presetPreferences.scheduleWindowDays.length === normalizedPreferences.scheduleWindowDays.length &&
    presetPreferences.scheduleWindowDays.every(
      (day, index) => day === normalizedPreferences.scheduleWindowDays[index]
    )
  );
}

function createSftpScheduleCandidateDate(baseDate: Date, dayOffset: number, minutes: number): Date {
  const candidate = new Date(baseDate);
  candidate.setHours(0, 0, 0, 0);
  candidate.setDate(candidate.getDate() + dayOffset);
  candidate.setMinutes(minutes);
  return candidate;
}

function findNextSftpTransferWindowTransition(
  preferences: SftpTransferPreferences,
  fromDate = new Date()
): { at: Date; opensWindow: boolean } | null {
  if (!preferences.scheduleWindowEnabled) {
    return null;
  }
  const candidateMinutes = Array.from(
    new Set<number>([
      0,
      parseSftpScheduleMinutes(
        preferences.scheduleWindowStartMinutes,
        DEFAULT_SFTP_TRANSFER_PREFERENCES.scheduleWindowStartMinutes
      ),
      parseSftpScheduleMinutes(
        preferences.scheduleWindowEndMinutes,
        DEFAULT_SFTP_TRANSFER_PREFERENCES.scheduleWindowEndMinutes
      )
    ])
  ).sort((left, right) => left - right);
  const fromTime = fromDate.getTime();
  let best: { at: Date; opensWindow: boolean } | null = null;
  for (let dayOffset = 0; dayOffset <= 14; dayOffset += 1) {
    for (const minutes of candidateMinutes) {
      const candidate = createSftpScheduleCandidateDate(fromDate, dayOffset, minutes);
      if (candidate.getTime() <= fromTime + 500) {
        continue;
      }
      const before = new Date(candidate.getTime() - 60_000);
      const after = new Date(candidate.getTime() + 60_000);
      const wasOpen = isWithinSftpTransferScheduleWindow(preferences, before);
      const isOpen = isWithinSftpTransferScheduleWindow(preferences, after);
      if (wasOpen === isOpen) {
        continue;
      }
      if (!best || candidate.getTime() < best.at.getTime()) {
        best = {
          at: candidate,
          opensWindow: isOpen
        };
      }
    }
  }
  return best;
}

function getNextSftpTransferWindowOpening(
  preferences: SftpTransferPreferences,
  fromDate = new Date()
): Date | null {
  if (!preferences.scheduleWindowEnabled || isWithinSftpTransferScheduleWindow(preferences, fromDate)) {
    return null;
  }
  const nextTransition = findNextSftpTransferWindowTransition(preferences, fromDate);
  return nextTransition?.opensWindow ? nextTransition.at : null;
}

function normalizeSftpTransferPreferences(value: unknown): SftpTransferPreferences {
  const parsed =
    value && typeof value === "object"
      ? (value as Partial<SftpTransferPreferences>)
      : ({} as Partial<SftpTransferPreferences>);
  return {
    uploadConcurrency: parseTransferConcurrency(
      parsed.uploadConcurrency,
      DEFAULT_SFTP_TRANSFER_PREFERENCES.uploadConcurrency
    ),
    downloadConcurrency: parseTransferConcurrency(
      parsed.downloadConcurrency,
      DEFAULT_SFTP_TRANSFER_PREFERENCES.downloadConcurrency
    ),
    uploadRateLimitKiBps: parseSftpTransferRateLimitKiBps(
      parsed.uploadRateLimitKiBps,
      DEFAULT_SFTP_TRANSFER_PREFERENCES.uploadRateLimitKiBps
    ),
    downloadRateLimitKiBps: parseSftpTransferRateLimitKiBps(
      parsed.downloadRateLimitKiBps,
      DEFAULT_SFTP_TRANSFER_PREFERENCES.downloadRateLimitKiBps
    ),
    scheduleWindowEnabled:
      typeof parsed.scheduleWindowEnabled === "boolean"
        ? parsed.scheduleWindowEnabled
        : DEFAULT_SFTP_TRANSFER_PREFERENCES.scheduleWindowEnabled,
    scheduleWindowStartMinutes: parseSftpScheduleMinutes(
      parsed.scheduleWindowStartMinutes,
      DEFAULT_SFTP_TRANSFER_PREFERENCES.scheduleWindowStartMinutes
    ),
    scheduleWindowEndMinutes: parseSftpScheduleMinutes(
      parsed.scheduleWindowEndMinutes,
      DEFAULT_SFTP_TRANSFER_PREFERENCES.scheduleWindowEndMinutes
    ),
    scheduleWindowDays: normalizeSftpScheduleDays(
      parsed.scheduleWindowDays,
      DEFAULT_SFTP_TRANSFER_PREFERENCES.scheduleWindowDays
    )
  };
}

function cloneSftpTransferPreferences(
  preferences: SftpTransferPreferences
): SftpTransferPreferences {
  return normalizeSftpTransferPreferences({
    uploadConcurrency: preferences.uploadConcurrency,
    downloadConcurrency: preferences.downloadConcurrency,
    uploadRateLimitKiBps: preferences.uploadRateLimitKiBps,
    downloadRateLimitKiBps: preferences.downloadRateLimitKiBps,
    scheduleWindowEnabled: preferences.scheduleWindowEnabled,
    scheduleWindowStartMinutes: preferences.scheduleWindowStartMinutes,
    scheduleWindowEndMinutes: preferences.scheduleWindowEndMinutes,
    scheduleWindowDays: [...preferences.scheduleWindowDays]
  });
}

function normalizeSftpTransferPolicyPackName(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function normalizeSftpTransferPolicyPackDescription(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 320) : "";
}

function normalizeSftpTransferPolicyPackRecord(value: unknown): SftpTransferPolicyPackRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<SftpTransferPolicyPackRecord> & {
    transferPreferences?: unknown;
    sftpTransferPreferences?: unknown;
  };
  const name = normalizeSftpTransferPolicyPackName(candidate.name);
  if (!name) {
    return null;
  }
  const rawPreferences =
    candidate.preferences ?? candidate.transferPreferences ?? candidate.sftpTransferPreferences;
  if (!rawPreferences || typeof rawPreferences !== "object") {
    return null;
  }
  const packId =
    typeof candidate.id === "string" && candidate.id.trim()
      ? candidate.id.trim().slice(0, 120)
      : `stpp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  return {
    id: packId,
    name,
    description: normalizeSftpTransferPolicyPackDescription(candidate.description),
    updatedAtIso:
      typeof candidate.updatedAtIso === "string" && candidate.updatedAtIso.trim()
        ? candidate.updatedAtIso.trim().slice(0, 64)
        : new Date().toISOString(),
    preferences: normalizeSftpTransferPreferences(rawPreferences)
  };
}

function normalizeSftpTransferPolicyPacks(payload: unknown): SftpTransferPolicyPackRecord[] {
  const rows = Array.isArray(payload) ? payload : [];
  const normalized: SftpTransferPolicyPackRecord[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  for (const row of rows) {
    const pack = normalizeSftpTransferPolicyPackRecord(row);
    if (!pack) {
      continue;
    }
    const idKey = pack.id.toLowerCase();
    const nameKey = pack.name.toLowerCase();
    if (seenIds.has(idKey) || seenNames.has(nameKey)) {
      continue;
    }
    seenIds.add(idKey);
    seenNames.add(nameKey);
    normalized.push(pack);
    if (normalized.length >= MAX_SFTP_TRANSFER_POLICY_PACKS) {
      break;
    }
  }
  normalized.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
  return normalized;
}

function parseSftpTransferPolicyPacksText(rawText: string): SftpTransferPolicyPackRecord[] {
  const parsed = JSON.parse(rawText) as { pack?: unknown; packs?: unknown } | unknown;
  if (Array.isArray(parsed)) {
    return normalizeSftpTransferPolicyPacks(parsed);
  }
  if (parsed && typeof parsed === "object" && "packs" in parsed) {
    return normalizeSftpTransferPolicyPacks(parsed.packs);
  }
  if (parsed && typeof parsed === "object" && "pack" in parsed) {
    return normalizeSftpTransferPolicyPacks([parsed.pack]);
  }
  return normalizeSftpTransferPolicyPacks([parsed]);
}

function mergeSftpTransferPolicyPacks(
  existing: SftpTransferPolicyPackRecord[],
  incoming: SftpTransferPolicyPackRecord[]
): SftpTransferPolicyPackRecord[] {
  const merged = [...existing];
  for (const pack of incoming) {
    const existingIndex = merged.findIndex(
      (entry) => entry.id === pack.id || entry.name.toLowerCase() === pack.name.toLowerCase()
    );
    if (existingIndex >= 0) {
      merged[existingIndex] = pack;
    } else {
      merged.push(pack);
    }
  }
  return normalizeSftpTransferPolicyPacks(merged);
}

function createSftpTransferPolicyPacksPayload(
  packs: SftpTransferPolicyPackRecord[],
  kind = "sftpTransferPolicyPacks"
): {
  exportedAtIso: string;
  appVersion: string;
  kind: string;
  packCount: number;
  packs: SftpTransferPolicyPackRecord[];
} {
  return {
    exportedAtIso: new Date().toISOString(),
    appVersion: APP_VERSION,
    kind,
    packCount: packs.length,
    packs
  };
}

function createSftpTransferPolicyPacksSignature(packs: SftpTransferPolicyPackRecord[]): string {
  return JSON.stringify(
    packs.map((pack) => ({
      id: pack.id,
      name: pack.name,
      description: pack.description,
      updatedAtIso: pack.updatedAtIso,
      preferences: cloneSftpTransferPreferences(pack.preferences)
    }))
  );
}

function readSftpTransferPolicyPacks(): SftpTransferPolicyPackRecord[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const rawValue = window.localStorage.getItem(SFTP_TRANSFER_POLICY_PACKS_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }
    const parsed = JSON.parse(rawValue) as { packs?: unknown } | unknown;
    if (Array.isArray(parsed)) {
      return normalizeSftpTransferPolicyPacks(parsed);
    }
    if (parsed && typeof parsed === "object" && "packs" in parsed) {
      return normalizeSftpTransferPolicyPacks(parsed.packs);
    }
    return [];
  } catch {
    return [];
  }
}

function normalizeSftpTransferPolicyPackSyncState(payload: unknown): SftpTransferPolicyPackSyncState {
  if (!payload || typeof payload !== "object") {
    return {
      filePath: "",
      lastPulledAtIso: null,
      lastPushedAtIso: null,
      autoPullOnLaunch: false,
      autoPushOnChange: false
    };
  }
  const candidate = payload as Partial<SftpTransferPolicyPackSyncState>;
  const normalizeTimestamp = (value: unknown): string | null =>
    typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 64) : null;
  return {
    filePath:
      typeof candidate.filePath === "string" ? candidate.filePath.trim().slice(0, 4096) : "",
    lastPulledAtIso: normalizeTimestamp(candidate.lastPulledAtIso),
    lastPushedAtIso: normalizeTimestamp(candidate.lastPushedAtIso),
    autoPullOnLaunch:
      typeof candidate.autoPullOnLaunch === "boolean" ? candidate.autoPullOnLaunch : false,
    autoPushOnChange:
      typeof candidate.autoPushOnChange === "boolean" ? candidate.autoPushOnChange : false
  };
}

function readSftpTransferPolicyPackSyncState(): SftpTransferPolicyPackSyncState {
  if (typeof window === "undefined") {
    return normalizeSftpTransferPolicyPackSyncState(null);
  }
  try {
    const rawValue = window.localStorage.getItem(SFTP_TRANSFER_POLICY_PACK_SYNC_STORAGE_KEY);
    if (!rawValue) {
      return normalizeSftpTransferPolicyPackSyncState(null);
    }
    return normalizeSftpTransferPolicyPackSyncState(JSON.parse(rawValue));
  } catch {
    return normalizeSftpTransferPolicyPackSyncState(null);
  }
}

function formatSftpTransferPolicyPackSummary(preferences: SftpTransferPreferences): string {
  const uploadLimit =
    preferences.uploadRateLimitKiBps > 0
      ? `${preferences.uploadRateLimitKiBps} KiB/s`
      : "unlimited";
  const downloadLimit =
    preferences.downloadRateLimitKiBps > 0
      ? `${preferences.downloadRateLimitKiBps} KiB/s`
      : "unlimited";
  return `Upload ${preferences.uploadConcurrency} | Download ${preferences.downloadConcurrency} | UL ${uploadLimit} | DL ${downloadLimit} | Window ${
    preferences.scheduleWindowEnabled
      ? formatSftpTransferScheduleWindowSummary(preferences)
      : "off"
  }`;
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

function readTerminalEditorFocusPreferences(): TerminalEditorFocusPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_TERMINAL_EDITOR_FOCUS_PREFERENCES;
  }
  try {
    const rawValue = window.localStorage.getItem(TERMINAL_EDITOR_FOCUS_PREFERENCES_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_TERMINAL_EDITOR_FOCUS_PREFERENCES;
    }
    const parsed = JSON.parse(rawValue) as Partial<TerminalEditorFocusPreferences>;
    const parsedThemeId = parsed.themeId;
    const parsedTypographyId = parsed.typographyId;
    const parsedFontId = parsed.fontId;
    const parsedRhythmId = parsed.rhythmId;
    const parsedCursorId = parsed.cursorId;
    return {
      autoLayoutEnabled:
        typeof parsed.autoLayoutEnabled === "boolean"
          ? parsed.autoLayoutEnabled
          : DEFAULT_TERMINAL_EDITOR_FOCUS_PREFERENCES.autoLayoutEnabled,
      themeId:
        typeof parsedThemeId === "string" &&
        TERMINAL_EDITOR_FOCUS_THEME_OPTIONS.some((option) => option.id === parsedThemeId)
          ? parsedThemeId
          : DEFAULT_TERMINAL_EDITOR_FOCUS_PREFERENCES.themeId,
      typographyId:
        typeof parsedTypographyId === "string" &&
        TERMINAL_EDITOR_FOCUS_TYPOGRAPHY_OPTIONS.some(
          (option) => option.id === parsedTypographyId
        )
          ? parsedTypographyId
          : DEFAULT_TERMINAL_EDITOR_FOCUS_PREFERENCES.typographyId,
      fontId:
        typeof parsedFontId === "string" &&
        TERMINAL_EDITOR_FOCUS_FONT_OPTIONS.some((option) => option.id === parsedFontId)
          ? parsedFontId
          : DEFAULT_TERMINAL_EDITOR_FOCUS_PREFERENCES.fontId,
      rhythmId:
        typeof parsedRhythmId === "string" &&
        TERMINAL_EDITOR_FOCUS_RHYTHM_OPTIONS.some((option) => option.id === parsedRhythmId)
          ? parsedRhythmId
          : DEFAULT_TERMINAL_EDITOR_FOCUS_PREFERENCES.rhythmId,
      cursorId:
        typeof parsedCursorId === "string" &&
        TERMINAL_EDITOR_FOCUS_CURSOR_OPTIONS.some((option) => option.id === parsedCursorId)
          ? parsedCursorId
          : DEFAULT_TERMINAL_EDITOR_FOCUS_PREFERENCES.cursorId
    };
  } catch {
    return DEFAULT_TERMINAL_EDITOR_FOCUS_PREFERENCES;
  }
}

function readWorkspaceProfilePreferences(): WorkspaceProfilePreferences {
  if (typeof window === "undefined") {
    return DEFAULT_WORKSPACE_PROFILE_PREFERENCES;
  }
  try {
    const rawValue = window.localStorage.getItem(WORKSPACE_PROFILE_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_WORKSPACE_PROFILE_PREFERENCES;
    }
    const parsed = JSON.parse(rawValue) as Partial<WorkspaceProfilePreferences>;
    const profileId =
      typeof parsed.profileId === "string" &&
      WORKSPACE_PROFILE_OPTIONS.some((option) => option.id === parsed.profileId)
        ? parsed.profileId
        : DEFAULT_WORKSPACE_PROFILE_PREFERENCES.profileId;
    return {
      profileId,
      syncDangerousCommandSafety:
        typeof parsed.syncDangerousCommandSafety === "boolean"
          ? parsed.syncDangerousCommandSafety
          : DEFAULT_WORKSPACE_PROFILE_PREFERENCES.syncDangerousCommandSafety
    };
  } catch {
    return DEFAULT_WORKSPACE_PROFILE_PREFERENCES;
  }
}

function readDangerousCommandGuardPreferences(): DangerousCommandGuardPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_DANGEROUS_COMMAND_GUARD_PREFERENCES;
  }
  try {
    const rawValue = window.localStorage.getItem(DANGEROUS_COMMAND_GUARD_PREFERENCES_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_DANGEROUS_COMMAND_GUARD_PREFERENCES;
    }
    return normalizeDangerousCommandGuardPreferences(JSON.parse(rawValue));
  } catch {
    return DEFAULT_DANGEROUS_COMMAND_GUARD_PREFERENCES;
  }
}

function cloneDangerousCommandGuardPreferences(
  preferences: DangerousCommandGuardPreferences
): DangerousCommandGuardPreferences {
  return normalizeDangerousCommandGuardPreferences({
    enabled: preferences.enabled,
    sourceStates: { ...preferences.sourceStates },
    builtinRuleStates: { ...preferences.builtinRuleStates },
    policyPackId: preferences.policyPackId,
    environmentTemplateId: preferences.environmentTemplateId,
    groupAssignments: preferences.groupAssignments.map((assignment) => ({
      ...assignment
    })),
    persistentApprovals: preferences.persistentApprovals.map((approval) => ({
      ...approval
    })),
    customPatternsText: preferences.customPatternsText
  });
}

function normalizeDangerousCommandPolicyBundleName(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function normalizeDangerousCommandPolicyBundleDescription(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 320) : "";
}

function normalizeDangerousCommandPolicyBundleRecord(
  value: unknown
): DangerousCommandPolicyBundleRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<DangerousCommandPolicyBundleRecord> & {
    guardPreferences?: unknown;
    dangerousCommandGuardPreferences?: unknown;
    safetyPreferences?: unknown;
  };
  const name = normalizeDangerousCommandPolicyBundleName(candidate.name);
  if (!name) {
    return null;
  }
  const rawPreferences =
    candidate.preferences ??
    candidate.guardPreferences ??
    candidate.dangerousCommandGuardPreferences ??
    candidate.safetyPreferences;
  if (!rawPreferences || typeof rawPreferences !== "object") {
    return null;
  }
  const bundleId =
    typeof candidate.id === "string" && candidate.id.trim()
      ? candidate.id.trim().slice(0, 120)
      : `dcpb-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  return {
    id: bundleId,
    name,
    description: normalizeDangerousCommandPolicyBundleDescription(candidate.description),
    updatedAtIso:
      typeof candidate.updatedAtIso === "string" && candidate.updatedAtIso.trim()
        ? candidate.updatedAtIso.trim().slice(0, 64)
        : new Date().toISOString(),
    preferences: normalizeDangerousCommandGuardPreferences(rawPreferences)
  };
}

function normalizeDangerousCommandPolicyBundles(payload: unknown): DangerousCommandPolicyBundleRecord[] {
  const rows = Array.isArray(payload) ? payload : [];
  const normalized: DangerousCommandPolicyBundleRecord[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  for (const row of rows) {
    const bundle = normalizeDangerousCommandPolicyBundleRecord(row);
    if (!bundle) {
      continue;
    }
    const idKey = bundle.id.toLowerCase();
    const nameKey = bundle.name.toLowerCase();
    if (seenIds.has(idKey) || seenNames.has(nameKey)) {
      continue;
    }
    seenIds.add(idKey);
    seenNames.add(nameKey);
    normalized.push(bundle);
    if (normalized.length >= MAX_DANGEROUS_COMMAND_POLICY_BUNDLES) {
      break;
    }
  }
  normalized.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
  return normalized;
}

function parseDangerousCommandPolicyBundlesText(rawText: string): DangerousCommandPolicyBundleRecord[] {
  const parsed = JSON.parse(rawText) as { bundle?: unknown; bundles?: unknown } | unknown;
  if (Array.isArray(parsed)) {
    return normalizeDangerousCommandPolicyBundles(parsed);
  }
  if (parsed && typeof parsed === "object" && "bundles" in parsed) {
    return normalizeDangerousCommandPolicyBundles(parsed.bundles);
  }
  if (parsed && typeof parsed === "object" && "bundle" in parsed) {
    return normalizeDangerousCommandPolicyBundles([parsed.bundle]);
  }
  return normalizeDangerousCommandPolicyBundles([parsed]);
}

function mergeDangerousCommandPolicyBundles(
  existing: DangerousCommandPolicyBundleRecord[],
  incoming: DangerousCommandPolicyBundleRecord[]
): DangerousCommandPolicyBundleRecord[] {
  const merged = [...existing];
  for (const bundle of incoming) {
    const existingIndex = merged.findIndex(
      (entry) => entry.id === bundle.id || entry.name.toLowerCase() === bundle.name.toLowerCase()
    );
    if (existingIndex >= 0) {
      merged[existingIndex] = bundle;
    } else {
      merged.push(bundle);
    }
  }
  return normalizeDangerousCommandPolicyBundles(merged);
}

function createDangerousCommandPolicyBundlesPayload(
  bundles: DangerousCommandPolicyBundleRecord[],
  kind = "dangerousCommandPolicyBundles"
): {
  exportedAtIso: string;
  appVersion: string;
  kind: string;
  bundleCount: number;
  bundles: DangerousCommandPolicyBundleRecord[];
} {
  return {
    exportedAtIso: new Date().toISOString(),
    appVersion: APP_VERSION,
    kind,
    bundleCount: bundles.length,
    bundles
  };
}

function readDangerousCommandPolicyBundles(): DangerousCommandPolicyBundleRecord[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const rawValue = window.localStorage.getItem(DANGEROUS_COMMAND_POLICY_BUNDLES_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }
    const parsed = JSON.parse(rawValue) as { bundles?: unknown } | unknown;
    if (Array.isArray(parsed)) {
      return normalizeDangerousCommandPolicyBundles(parsed);
    }
    if (parsed && typeof parsed === "object" && "bundles" in parsed) {
      return normalizeDangerousCommandPolicyBundles(parsed.bundles);
    }
    return [];
  } catch {
    return [];
  }
}

function normalizeDangerousCommandPolicyBundleSyncState(
  payload: unknown
): DangerousCommandPolicyBundleSyncState {
  if (!payload || typeof payload !== "object") {
    return {
      filePath: "",
      lastPulledAtIso: null,
      lastPushedAtIso: null
    };
  }
  const candidate = payload as Partial<DangerousCommandPolicyBundleSyncState>;
  const normalizeTimestamp = (value: unknown): string | null =>
    typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 64) : null;
  return {
    filePath:
      typeof candidate.filePath === "string" ? candidate.filePath.trim().slice(0, 4096) : "",
    lastPulledAtIso: normalizeTimestamp(candidate.lastPulledAtIso),
    lastPushedAtIso: normalizeTimestamp(candidate.lastPushedAtIso)
  };
}

function readDangerousCommandPolicyBundleSyncState(): DangerousCommandPolicyBundleSyncState {
  if (typeof window === "undefined") {
    return normalizeDangerousCommandPolicyBundleSyncState(null);
  }
  try {
    const rawValue = window.localStorage.getItem(DANGEROUS_COMMAND_POLICY_BUNDLE_SYNC_STORAGE_KEY);
    if (!rawValue) {
      return normalizeDangerousCommandPolicyBundleSyncState(null);
    }
    return normalizeDangerousCommandPolicyBundleSyncState(JSON.parse(rawValue));
  } catch {
    return normalizeDangerousCommandPolicyBundleSyncState(null);
  }
}

function createDangerousCommandPersistentApprovalFromRequest(
  request: DangerousCommandApprovalRequest,
  scope: DangerousCommandPersistentApprovalScopeId
): DangerousCommandPersistentApproval | null {
  if (scope === "sessionGroup" && !request.result.sessionGroupName) {
    return null;
  }
  return {
    id: `danger-policy-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    scope,
    sessionGroupName: scope === "sessionGroup" ? request.result.sessionGroupName : null,
    source: request.source,
    commandText: request.result.commandText,
    preview: request.result.preview,
    severity: request.result.severity,
    appliedPolicyPackId: request.result.appliedPolicyPackId,
    appliedEnvironmentTemplateId: request.result.appliedEnvironmentTemplateId,
    createdAtIso: new Date().toISOString()
  };
}

function matchesDangerousCommandPersistentApproval(
  approval: DangerousCommandPersistentApproval,
  request: DangerousCommandApprovalRequest
): boolean {
  if (approval.source !== request.source) {
    return false;
  }
  if (approval.commandText !== request.result.commandText) {
    return false;
  }
  if (approval.appliedPolicyPackId !== request.result.appliedPolicyPackId) {
    return false;
  }
  if (approval.appliedEnvironmentTemplateId !== request.result.appliedEnvironmentTemplateId) {
    return false;
  }
  if (approval.scope === "global") {
    return true;
  }
  return (
    approval.scope === "sessionGroup" &&
    approval.sessionGroupName !== null &&
    approval.sessionGroupName === request.result.sessionGroupName
  );
}

function formatDangerousCommandPersistentApprovalScopeLabel(
  approval: DangerousCommandPersistentApproval
): string {
  if (approval.scope === "sessionGroup") {
    return approval.sessionGroupName ? `Group ${approval.sessionGroupName}` : "Group";
  }
  return "All Matching Contexts";
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
    const rawValue =
      window.localStorage.getItem(SFTP_TRANSFER_PREFERENCES_STORAGE_KEY) ??
      window.localStorage.getItem(PREVIOUS_SFTP_TRANSFER_PREFERENCES_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_SFTP_TRANSFER_PREFERENCES_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_SFTP_TRANSFER_PREFERENCES;
    }
    const normalized = normalizeSftpTransferPreferences(JSON.parse(rawValue));
    const migratedLegacyDefaults =
      normalized.uploadConcurrency === 2 &&
      normalized.downloadConcurrency === 2 &&
      window.localStorage.getItem(SFTP_TRANSFER_PREFERENCES_STORAGE_KEY) === null &&
      window.localStorage.getItem(PREVIOUS_SFTP_TRANSFER_PREFERENCES_STORAGE_KEY) === null;
    return migratedLegacyDefaults
      ? {
          uploadConcurrency: DEFAULT_SFTP_TRANSFER_PREFERENCES.uploadConcurrency,
          downloadConcurrency: normalized.downloadConcurrency,
          uploadRateLimitKiBps: normalized.uploadRateLimitKiBps,
          downloadRateLimitKiBps: normalized.downloadRateLimitKiBps,
          scheduleWindowEnabled: normalized.scheduleWindowEnabled,
          scheduleWindowStartMinutes: normalized.scheduleWindowStartMinutes,
          scheduleWindowEndMinutes: normalized.scheduleWindowEndMinutes,
          scheduleWindowDays: normalized.scheduleWindowDays
        }
      : normalized;
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

function createClientSideId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) {
    return `${prefix}-${uuid}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function formatOperationCenterAppJobCategoryLabel(category: OperationCenterAppJobCategory): string {
  switch (category) {
    case "sessions":
      return "Sessions";
    case "snippets":
      return "Snippets";
    case "diagnostics":
      return "Diagnostics";
    default:
      return "App";
  }
}

function formatOperationCenterAppJobStatusLabel(status: OperationCenterAppJobStatus): string {
  switch (status) {
    case "running":
      return "Running";
    case "succeeded":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Unknown";
  }
}

function getOperationCenterAppJobStateClass(status: OperationCenterAppJobStatus): string {
  switch (status) {
    case "running":
      return "operation-center__state is-active";
    case "succeeded":
      return "operation-center__state is-success";
    case "failed":
      return "operation-center__state is-failed";
    default:
      return "operation-center__state is-idle";
  }
}

function formatOperationCenterAppJobDuration(startedAt: number, finishedAt?: number): string {
  const end = typeof finishedAt === "number" && Number.isFinite(finishedAt) ? finishedAt : Date.now();
  const durationMs = Math.max(0, end - startedAt);
  if (durationMs < 1000) {
    return "<1s";
  }
  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const totalMinutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  if (totalMinutes < 60) {
    return remainingSeconds > 0 ? `${totalMinutes}m ${remainingSeconds}s` : `${totalMinutes}m`;
  }
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  return remainingMinutes > 0 ? `${totalHours}h ${remainingMinutes}m` : `${totalHours}h`;
}

function getOperationCenterTransferStateClass(status: SftpTransferEvent["status"]): string {
  switch (status) {
    case "running":
    case "queued":
      return "operation-center__state is-active";
    case "completed":
      return "operation-center__state is-success";
    case "failed":
      return "operation-center__state is-failed";
    case "canceled":
    default:
      return "operation-center__state is-idle";
  }
}

function formatOperationCenterTransferStatus(status: SftpTransferEvent["status"]): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    default:
      return "Unknown";
  }
}

function createEmptySessionTemplateDraft(): SessionTemplateDraft {
  return {
    templateName: "",
    sessionName: "",
    host: "",
    port: "22",
    username: "",
    authType: "password",
    privateKeyPath: "",
    groupId: "",
    remark: "",
    favorite: false,
    secret: "",
    envVars: []
  };
}

function createSessionTemplateDraftFromForm(form: SessionCreateInput): SessionTemplateDraft {
  const normalizedName = form.name.trim();
  return {
    templateName: normalizedName ? `${normalizedName} Template` : "",
    sessionName: form.name,
    host: form.host,
    port: `${form.port ?? 22}`,
    username: form.username,
    authType: form.authType,
    privateKeyPath: form.privateKeyPath ?? "",
    groupId: form.groupId ?? "",
    remark: form.remark ?? "",
    favorite: form.favorite ?? false,
    secret: form.secret ?? "",
    envVars: []
  };
}

function normalizeSessionTemplateEnvVars(payload: unknown): SessionTemplateEnvVar[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  const normalized: SessionTemplateEnvVar[] = [];
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  for (const row of payload) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const candidate = row as Partial<SessionTemplateEnvVar>;
    const key = typeof candidate.key === "string" ? candidate.key.trim() : "";
    if (!key || seenKeys.has(key.toLowerCase())) {
      continue;
    }
    const id =
      typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id.trim()
        : createClientSideId("stv");
    if (seenIds.has(id)) {
      continue;
    }
    seenIds.add(id);
    seenKeys.add(key.toLowerCase());
    normalized.push({
      id,
      key: key.slice(0, 40),
      value: typeof candidate.value === "string" ? candidate.value.slice(0, 400) : ""
    });
    if (normalized.length >= MAX_SESSION_TEMPLATE_ENV_VARS) {
      break;
    }
  }
  return normalized;
}

function normalizeSessionTemplateDraft(payload: unknown): SessionTemplateDraft {
  const candidate = payload && typeof payload === "object" ? (payload as Partial<SessionTemplateDraft>) : {};
  return {
    templateName:
      typeof candidate.templateName === "string" ? candidate.templateName.trim().slice(0, 80) : "",
    sessionName:
      typeof candidate.sessionName === "string" ? candidate.sessionName.trim().slice(0, 120) : "",
    host: typeof candidate.host === "string" ? candidate.host.trim().slice(0, 255) : "",
    port: typeof candidate.port === "string" ? candidate.port.trim().slice(0, 16) : "22",
    username:
      typeof candidate.username === "string" ? candidate.username.trim().slice(0, 120) : "",
    authType: candidate.authType === "privateKey" ? "privateKey" : "password",
    privateKeyPath:
      typeof candidate.privateKeyPath === "string" ? candidate.privateKeyPath.trim().slice(0, 512) : "",
    groupId: typeof candidate.groupId === "string" ? candidate.groupId.trim().slice(0, 120) : "",
    remark: typeof candidate.remark === "string" ? candidate.remark.trim().slice(0, 400) : "",
    favorite: candidate.favorite === true,
    secret: typeof candidate.secret === "string" ? candidate.secret.slice(0, 400) : "",
    envVars: normalizeSessionTemplateEnvVars(candidate.envVars)
  };
}

function normalizeSessionTemplates(payload: unknown): SessionTemplateRecord[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  const normalized: SessionTemplateRecord[] = [];
  const seenIds = new Set<string>();
  for (const row of payload) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const candidate = row as Partial<SessionTemplateRecord>;
    const draft = normalizeSessionTemplateDraft(candidate);
    if (!draft.templateName) {
      continue;
    }
    const id =
      typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id.trim()
        : createClientSideId("st");
    if (seenIds.has(id)) {
      continue;
    }
    const createdAt =
      typeof candidate.createdAt === "number" && Number.isFinite(candidate.createdAt)
        ? candidate.createdAt
        : Date.now();
    const updatedAt =
      typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt)
        ? candidate.updatedAt
        : createdAt;
    seenIds.add(id);
    normalized.push({
      id,
      createdAt,
      updatedAt,
      ...draft
    });
    if (normalized.length >= MAX_SESSION_TEMPLATES) {
      break;
    }
  }
  return normalized.sort((left, right) => right.updatedAt - left.updatedAt);
}

function readSessionTemplates(): SessionTemplateRecord[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const rawValue = window.localStorage.getItem(SESSION_TEMPLATES_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }
    return normalizeSessionTemplates(JSON.parse(rawValue));
  } catch {
    return [];
  }
}

function normalizeCommandSnippetParameterKey(value: string): string {
  return value
    .trim()
    .replace(COMMAND_SNIPPET_PARAMETER_KEY_SANITIZE_PATTERN, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_COMMAND_SNIPPET_PARAMETER_KEY_LENGTH);
}

function buildCommandSnippetParameterToken(key: string): string {
  return `\${param:${key}}`;
}

function normalizeCommandSnippetVariableScope(value: unknown): CommandSnippetVariableScopeId {
  return value === "group" || value === "session" || value === "global" ? value : "snippet";
}

function formatCommandSnippetVariableScopeLabel(scope: CommandSnippetVariableScopeId): string {
  return COMMAND_SNIPPET_VARIABLE_SCOPES.find((entry) => entry.id === scope)?.label ?? "Per Snippet";
}

function buildCommandSnippetScopedValueCacheKey(options: {
  scope: CommandSnippetVariableScopeId;
  key: string;
  snippetId: string;
  groupId: string;
  sessionId: string;
}): string {
  const normalizedKey = normalizeCommandSnippetParameterKey(options.key);
  if (!normalizedKey) {
    return "";
  }
  if (options.scope === "global") {
    return `global:${normalizedKey}`;
  }
  if (options.scope === "session") {
    return options.sessionId.trim() ? `session:${options.sessionId.trim()}:${normalizedKey}` : "";
  }
  if (options.scope === "group") {
    return options.groupId.trim() ? `group:${options.groupId.trim()}:${normalizedKey}` : "";
  }
  return options.snippetId.trim() ? `snippet:${options.snippetId.trim()}:${normalizedKey}` : "";
}

function createCommandSnippetParameter(
  ordinal: number,
  existingKeys: ReadonlySet<string> = new Set<string>(),
  scope: CommandSnippetVariableScopeId = "snippet"
): CommandSnippetParameter {
  let nextOrdinal = Math.max(1, Math.trunc(ordinal));
  let nextKey = normalizeCommandSnippetParameterKey(`value_${nextOrdinal}`);
  while (!nextKey || existingKeys.has(nextKey)) {
    nextOrdinal += 1;
    nextKey = normalizeCommandSnippetParameterKey(`value_${nextOrdinal}`);
  }
  return {
    id: `sp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    key: nextKey,
    label: `Value ${nextOrdinal}`,
    defaultValue: "",
    required: true,
    pattern: "",
    scope
  };
}

function mergeCommandSnippetParameters(
  snippet: CommandSnippetItem | null,
  promptSet: CommandSnippetPromptSet | null
): CommandSnippetParameter[] {
  if (!snippet && !promptSet) {
    return [];
  }
  const snippetParameters = snippet?.parameters ?? [];
  const snippetKeys = new Set(snippetParameters.map((parameter) => parameter.key));
  return [
    ...(promptSet?.parameters.filter((parameter) => !snippetKeys.has(parameter.key)) ?? []),
    ...snippetParameters
  ];
}

function listCommandSnippetTemplateParameterKeys(template: string): string[] {
  if (!template) {
    return [];
  }
  const keys: string[] = [];
  const seenKeys = new Set<string>();
  for (const match of template.matchAll(COMMAND_SNIPPET_PARAMETER_TOKEN_PATTERN)) {
    const key = typeof match[1] === "string" ? match[1].trim() : "";
    if (!key || seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    keys.push(key);
  }
  return keys;
}

function getCommandSnippetParameterPatternError(pattern: string): string | null {
  const trimmedPattern = pattern.trim();
  if (!trimmedPattern) {
    return null;
  }
  try {
    new RegExp(trimmedPattern);
    return null;
  } catch (caughtError) {
    return caughtError instanceof Error && caughtError.message
      ? caughtError.message
      : "Invalid regular expression.";
  }
}

function normalizeCommandSnippetParameters(payload: unknown): CommandSnippetParameter[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  const normalized: CommandSnippetParameter[] = [];
  const seenParameterIds = new Set<string>();
  const seenParameterKeys = new Set<string>();
  for (const row of payload) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const candidate = row as Partial<CommandSnippetParameter>;
    const parameterId =
      typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id.trim()
        : `sp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    if (seenParameterIds.has(parameterId)) {
      continue;
    }
    const parameterKey = normalizeCommandSnippetParameterKey(
      typeof candidate.key === "string" ? candidate.key : ""
    );
    if (!parameterKey || seenParameterKeys.has(parameterKey)) {
      continue;
    }
    seenParameterIds.add(parameterId);
    seenParameterKeys.add(parameterKey);
    const parameterLabel =
      typeof candidate.label === "string" && candidate.label.trim()
        ? candidate.label.trim().slice(0, MAX_COMMAND_SNIPPET_PARAMETER_LABEL_LENGTH)
        : parameterKey;
    normalized.push({
      id: parameterId,
      key: parameterKey,
      label: parameterLabel,
      defaultValue:
        typeof candidate.defaultValue === "string"
          ? candidate.defaultValue.slice(0, MAX_COMMAND_SNIPPET_PARAMETER_DEFAULT_LENGTH)
          : "",
      required: candidate.required !== false,
      pattern:
        typeof candidate.pattern === "string"
          ? candidate.pattern.trim().slice(0, MAX_COMMAND_SNIPPET_PARAMETER_PATTERN_LENGTH)
          : "",
      scope: normalizeCommandSnippetVariableScope(candidate.scope)
    });
    if (normalized.length >= MAX_COMMAND_SNIPPET_PARAMETERS) {
      break;
    }
  }
  return normalized;
}

function normalizeCommandSnippetPromptSets(payload: unknown): CommandSnippetPromptSet[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  const normalized: CommandSnippetPromptSet[] = [];
  const seenPromptSetIds = new Set<string>();
  for (const row of payload) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const candidate = row as Partial<CommandSnippetPromptSet>;
    const promptSetId =
      typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id.trim()
        : `sps-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    if (seenPromptSetIds.has(promptSetId)) {
      continue;
    }
    const promptSetName = typeof candidate.name === "string" ? candidate.name.trim() : "";
    if (!promptSetName) {
      continue;
    }
    seenPromptSetIds.add(promptSetId);
    normalized.push({
      id: promptSetId,
      name: promptSetName.slice(0, MAX_COMMAND_SNIPPET_PROMPT_SET_NAME_LENGTH),
      parameters: normalizeCommandSnippetParameters(
        (candidate as Partial<CommandSnippetPromptSet> & { parameters?: unknown }).parameters
      )
    });
    if (normalized.length >= MAX_COMMAND_SNIPPET_PROMPT_SETS) {
      break;
    }
  }
  return normalized;
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
    const promptSets = normalizeCommandSnippetPromptSets(
      (candidate as Partial<CommandSnippetGroup> & { promptSets?: unknown }).promptSets
    );
    const validPromptSetIds = new Set(promptSets.map((promptSet) => promptSet.id));
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
        confirmBeforeRun: snippet.confirmBeforeRun === true,
        previewBeforeRun: snippet.previewBeforeRun === true,
        promptSetId:
          typeof snippet.promptSetId === "string" && validPromptSetIds.has(snippet.promptSetId.trim())
            ? snippet.promptSetId.trim()
            : "",
        parameters: normalizeCommandSnippetParameters(
          (snippet as Partial<CommandSnippetItem> & { parameters?: unknown }).parameters
        )
      });
      if (normalizedSnippets.length >= MAX_COMMAND_SNIPPETS_PER_GROUP) {
        break;
      }
    }
    seenGroupIds.add(groupId);
    normalized.push({
      id: groupId,
      name: groupName.slice(0, 80),
      promptSets,
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

function normalizeCommandSnippetScopedValues(
  payload: unknown
): Record<string, CommandSnippetScopedValueRecord> {
  if (!payload || typeof payload !== "object") {
    return {};
  }
  const normalizedEntries: Array<[string, CommandSnippetScopedValueRecord]> = [];
  for (const [rawKey, rawValue] of Object.entries(payload)) {
    if (typeof rawKey !== "string" || !rawKey.trim() || !rawValue || typeof rawValue !== "object") {
      continue;
    }
    const candidate = rawValue as Partial<CommandSnippetScopedValueRecord>;
    const value = typeof candidate.value === "string" ? candidate.value.slice(0, 4000) : "";
    const updatedAt =
      typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt)
        ? candidate.updatedAt
        : Date.now();
    normalizedEntries.push([
      rawKey.trim(),
      {
        value,
        updatedAt
      }
    ]);
  }
  normalizedEntries.sort((left, right) => right[1].updatedAt - left[1].updatedAt);
  return Object.fromEntries(normalizedEntries.slice(0, MAX_COMMAND_SNIPPET_SCOPED_VALUES));
}

function readCommandSnippetScopedValues(): Record<string, CommandSnippetScopedValueRecord> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const rawValue = window.localStorage.getItem(COMMAND_SNIPPET_SCOPED_VALUES_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }
    return normalizeCommandSnippetScopedValues(JSON.parse(rawValue));
  } catch {
    return {};
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

function toSessionTemplateDraftFromRecord(template: SessionTemplateRecord): SessionTemplateDraft {
  return {
    templateName: template.templateName,
    sessionName: template.sessionName,
    host: template.host,
    port: template.port,
    username: template.username,
    authType: template.authType,
    privateKeyPath: template.privateKeyPath,
    groupId: template.groupId,
    remark: template.remark,
    favorite: template.favorite,
    secret: template.secret,
    envVars: template.envVars.map((envVar) => ({
      id: envVar.id,
      key: envVar.key,
      value: envVar.value
    }))
  };
}

function buildSessionTemplateVariableMap(envVars: SessionTemplateEnvVar[]): Map<string, string> {
  const next = new Map<string, string>();
  for (const envVar of envVars) {
    const key = envVar.key.trim();
    if (!key) {
      continue;
    }
    next.set(key, envVar.value);
  }
  return next;
}

function renderSessionTemplateText(
  value: string,
  variables: Map<string, string>,
  missingKeys: Set<string>
): string {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, key: string) => {
    if (!variables.has(key)) {
      missingKeys.add(key);
      return "";
    }
    return variables.get(key) ?? "";
  });
}

function resolveSessionTemplateToForm(
  template: SessionTemplateDraft | SessionTemplateRecord
): SessionCreateInput {
  const variables = buildSessionTemplateVariableMap(template.envVars);
  const missingKeys = new Set<string>();
  const resolvedName = renderSessionTemplateText(template.sessionName, variables, missingKeys).trim();
  const resolvedHost = renderSessionTemplateText(template.host, variables, missingKeys).trim();
  const resolvedPortInput = renderSessionTemplateText(template.port, variables, missingKeys).trim();
  const resolvedUsername = renderSessionTemplateText(template.username, variables, missingKeys).trim();
  const resolvedPrivateKeyPath = renderSessionTemplateText(
    template.privateKeyPath,
    variables,
    missingKeys
  ).trim();
  const resolvedGroupId = renderSessionTemplateText(template.groupId, variables, missingKeys).trim();
  const resolvedRemark = renderSessionTemplateText(template.remark, variables, missingKeys).trim();
  const resolvedSecret = renderSessionTemplateText(template.secret, variables, missingKeys);
  if (missingKeys.size > 0) {
    throw new Error(
      `Missing template env vars: ${Array.from(missingKeys.values())
        .sort((left, right) => left.localeCompare(right))
        .join(", ")}.`
    );
  }
  const resolvedPort = Number.parseInt(resolvedPortInput || "22", 10);
  if (!Number.isFinite(resolvedPort) || resolvedPort < 1 || resolvedPort > 65535) {
    throw new Error("Template port must resolve to a number between 1 and 65535.");
  }
  return {
    name: resolvedName,
    host: resolvedHost,
    port: resolvedPort,
    username: resolvedUsername,
    authType: template.authType,
    privateKeyPath: resolvedPrivateKeyPath,
    groupId: resolvedGroupId,
    remark: resolvedRemark,
    favorite: template.favorite,
    secret: resolvedSecret
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
  const [appLanguage, setAppLanguage] = useState<AppLanguage>(() => readAppLanguagePreference());
  const appLanguageRef = useRef<AppLanguage>(appLanguage);
  appLanguageRef.current = appLanguage;
  const i18n = useMemo(() => getI18n(appLanguage), [appLanguage]);
  const appRootRef = useRef<HTMLDivElement | null>(null);
  const localizationFrameRef = useRef<number | null>(null);
  const smokeImportSshConfigHandlerRef = useRef<(() => void) | null>(null);
  const smokeImportSessionsJsonHandlerRef = useRef<(() => void) | null>(null);
  const smokeImportEncryptedMigrationHandlerRef = useRef<(() => void) | null>(null);
  const tr = useCallback((value: string) => translateAppText(appLanguage, value), [appLanguage]);
  const selectedLanguageOption = useMemo(
    () => APP_LANGUAGE_OPTIONS.find((option) => option.id === appLanguage) ?? APP_LANGUAGE_OPTIONS[0],
    [appLanguage]
  );
  const trMultiline = useCallback(
    (value: string) =>
      value
        .split("\n")
        .map((line) => tr(line))
        .join("\n"),
    [tr]
  );
  const hotkeyModifierOptions = useMemo(
    () => getHotkeyModifierOptions(isMacPlatform),
    [isMacPlatform]
  );
  const settingsSections = useMemo(
    () =>
      [
        { id: "connection", label: i18n.settings.sections.connection.nav },
        { id: "workspace", label: i18n.settings.sections.workspace.nav },
        { id: "safety", label: i18n.settings.sections.safety.nav },
        { id: "hotkeys", label: i18n.settings.sections.hotkeys.nav },
        { id: "serverHealth", label: i18n.settings.sections.serverHealth.nav },
        { id: "fileOpening", label: i18n.settings.sections.fileOpening.nav },
        { id: "sftp", label: i18n.settings.sections.sftp.nav },
        { id: "portForwarding", label: i18n.settings.sections.portForwarding.nav },
        { id: "diagnostics", label: i18n.settings.sections.diagnostics.nav }
      ] as Array<{ id: SettingsSectionId; label: string }>,
    [i18n]
  );

  useEffect(() => {
    writeAppLanguagePreference(appLanguage);
  }, [appLanguage]);
  useEffect(() => {
    const root = appRootRef.current;
    if (!root || typeof window === "undefined") {
      return;
    }

    let disposed = false;
    const pendingLocalizationNodes = new Set<Node>();
    const shouldIgnoreMutation = (target: Node): boolean => {
      const element = target instanceof Element ? target : target.parentElement;
      return Boolean(
        element?.closest(
          ".xterm, .terminal-pane__canvas, code, pre, script, style, textarea, .app-dialog__textarea--readonly"
        )
      );
    };
    const scheduleLocalization = (target?: Node | null) => {
      if (target) {
        pendingLocalizationNodes.add(target);
      }
      if (localizationFrameRef.current !== null) {
        return;
      }
      localizationFrameRef.current = window.requestAnimationFrame(() => {
        localizationFrameRef.current = null;
        if (disposed) {
          pendingLocalizationNodes.clear();
          return;
        }
        if (pendingLocalizationNodes.size > 0) {
          const nodes = Array.from(pendingLocalizationNodes);
          pendingLocalizationNodes.clear();
          for (const node of nodes) {
            localizeDomNode(node, appLanguage);
          }
        } else {
          localizeDomTree(root, appLanguage);
        }
      });
    };

    scheduleLocalization();
    if (appLanguage !== "zh-CN" || typeof MutationObserver === "undefined") {
      return () => {
        disposed = true;
        pendingLocalizationNodes.clear();
        if (localizationFrameRef.current !== null) {
          window.cancelAnimationFrame(localizationFrameRef.current);
          localizationFrameRef.current = null;
        }
      };
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const node of Array.from(mutation.addedNodes)) {
            if (!shouldIgnoreMutation(node)) {
              scheduleLocalization(node);
            }
          }
          continue;
        }
        if (!shouldIgnoreMutation(mutation.target)) {
          scheduleLocalization(mutation.target);
        }
      }
    });
    observer.observe(root, {
      attributeFilter: ["aria-label", "placeholder", "title"],
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true
    });

    return () => {
      disposed = true;
      observer.disconnect();
      pendingLocalizationNodes.clear();
      if (localizationFrameRef.current !== null) {
        window.cancelAnimationFrame(localizationFrameRef.current);
        localizationFrameRef.current = null;
      }
    };
  }, [appLanguage]);

  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [form, setForm] = useState<SessionCreateInput>(EMPTY_FORM);
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [pendingOpenImportedSessionId, setPendingOpenImportedSessionId] = useState<string | null>(
    null
  );
  const [isTerminalEditorFocusMode, setIsTerminalEditorFocusMode] = useState(false);
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
  const [terminalEditorFocusPreferences, setTerminalEditorFocusPreferences] =
    useState<TerminalEditorFocusPreferences>(() => readTerminalEditorFocusPreferences());
  const [workspaceProfilePreferences, setWorkspaceProfilePreferences] =
    useState<WorkspaceProfilePreferences>(() => readWorkspaceProfilePreferences());
  const [dangerousCommandGuardPreferences, setDangerousCommandGuardPreferences] =
    useState<DangerousCommandGuardPreferences>(() => readDangerousCommandGuardPreferences());
  const [dangerousCommandPolicyBundles, setDangerousCommandPolicyBundles] =
    useState<DangerousCommandPolicyBundleRecord[]>(() => readDangerousCommandPolicyBundles());
  const [dangerousCommandPolicyBundleSyncState, setDangerousCommandPolicyBundleSyncState] =
    useState<DangerousCommandPolicyBundleSyncState>(() => readDangerousCommandPolicyBundleSyncState());
  const [dangerousCommandPolicyBundleSyncBusyAction, setDangerousCommandPolicyBundleSyncBusyAction] =
    useState<"pull" | "push" | "change" | null>(null);
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
  const [sftpTransferPolicyPacks, setSftpTransferPolicyPacks] =
    useState<SftpTransferPolicyPackRecord[]>(() => readSftpTransferPolicyPacks());
  const [sftpTransferPolicyPackSyncState, setSftpTransferPolicyPackSyncState] =
    useState<SftpTransferPolicyPackSyncState>(() => readSftpTransferPolicyPackSyncState());
  const [sftpTransferPolicyPackSyncBusyAction, setSftpTransferPolicyPackSyncBusyAction] =
    useState<"pull" | "push" | "change" | null>(null);
  const sftpTransferPolicyPackAutoPullKeyRef = useRef<string | null>(null);
  const sftpTransferPolicyPackAutoPushDebounceTimerRef = useRef<number | null>(null);
  const sftpTransferPolicyPackHydratedRef = useRef(false);
  const suppressNextSftpTransferPolicyPackAutoPushRef = useRef(false);
  const lastSftpTransferPolicyPackAutoPushSignatureRef = useRef<string | null>(null);
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
  const [isCommandHistoryInspectorCollapsed, setIsCommandHistoryInspectorCollapsed] = useState(
    () => readCommandHistoryInspectorCollapsed()
  );
  const [isFirstRunOnboardingDismissed, setIsFirstRunOnboardingDismissed] = useState(
    () => readFirstRunOnboardingDismissed()
  );
  const [activeInspectorSidebarTab, setActiveInspectorSidebarTab] = useState<InspectorSidebarTabId>(
    () => readInspectorSidebarTabId()
  );
  const [testConnectionResult, setTestConnectionResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [sftpDirectory, setSftpDirectory] = useState<SftpDirectoryListResult | null>(null);
  const [sftpExplorerViewMode, setSftpExplorerViewMode] = useState<SftpExplorerViewMode>(
    () => readSftpExplorerViewMode()
  );
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
  const [sessionTemplates, setSessionTemplates] = useState<SessionTemplateRecord[]>(
    () => readSessionTemplates()
  );
  const [isSessionTemplateManagerOpen, setIsSessionTemplateManagerOpen] = useState(false);
  const [editingSessionTemplateId, setEditingSessionTemplateId] = useState<string | null>(null);
  const [sessionTemplateDraft, setSessionTemplateDraft] = useState<SessionTemplateDraft>(
    () => createEmptySessionTemplateDraft()
  );
  const [sessionTemplateError, setSessionTemplateError] = useState<string | null>(null);
  const [commandSnippetGroups, setCommandSnippetGroups] = useState<CommandSnippetGroup[]>(
    () => readCommandSnippetGroups()
  );
  const [commandSnippetScopedValues, setCommandSnippetScopedValues] = useState<
    Record<string, CommandSnippetScopedValueRecord>
  >(() => readCommandSnippetScopedValues());
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
  const [operationCenterAppJobs, setOperationCenterAppJobs] = useState<OperationCenterAppJob[]>([]);
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
  const [globalSftpError, setGlobalSftpError] = useState<string | null>(null);
  const [sftpErrorsByTab, setSftpErrorsByTab] = useState<Record<string, string>>({});
  const [remoteOpenFileIssuesByTab, setRemoteOpenFileIssuesByTab] = useState<
    Record<string, RemoteOpenFileAutoSyncEvent>
  >({});
  const [logInfo, setLogInfo] = useState<{
    logDirectoryPath: string;
    logFilePath: string;
  } | null>(null);
  const [isExportingBugReport, setIsExportingBugReport] = useState(false);
  const [portForwardRecordsByTab, setPortForwardRecordsByTab] = useState<
    Record<string, PortForwardRecord[]>
  >({});
  const [portForwardForm, setPortForwardForm] = useState<PortForwardFormState>(
    DEFAULT_PORT_FORWARD_FORM
  );
  const [portForwardPresets, setPortForwardPresets] = useState<PortForwardPreset[]>(
    () => readPortForwardPresets()
  );
  const [portForwardBusy, setPortForwardBusy] = useState(false);
  const [portForwardStatusMessagesByTab, setPortForwardStatusMessagesByTab] = useState<
    Record<string, string | null>
  >({});
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
  const [isServerHealthDetailOpen, setIsServerHealthDetailOpen] = useState(false);
  const [serverHealthDetailTab, setServerHealthDetailTab] =
    useState<ServerHealthDetailTab>("overview");
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
  const workspaceProfilePreferencesRef = useRef<WorkspaceProfilePreferences>(
    workspaceProfilePreferences
  );
  const dangerousCommandGuardPreferencesRef = useRef<DangerousCommandGuardPreferences>(
    dangerousCommandGuardPreferences
  );
  const disconnectReportCapturePreferencesRef = useRef<DisconnectReportCapturePreferences>(
    disconnectReportCapturePreferences
  );
  const pausedUploadTabsRef = useRef<Record<string, true>>({});
  const pausedDownloadTabsRef = useRef<Record<string, true>>({});
  const schedulePausedUploadTabsRef = useRef<Record<string, true>>({});
  const schedulePausedDownloadTabsRef = useRef<Record<string, true>>({});
  const portForwardBusyRef = useRef<boolean>(portForwardBusy);
  const activeSessionIdRef = useRef<string | null>(null);
  const intentionalTabCloseIdsRef = useRef<Set<string>>(new Set());
  const disconnectReportFingerprintByTabRef = useRef<
    Map<string, { fingerprint: string; capturedAt: number }>
  >(new Map());
  const portForwardPresetsRef = useRef<PortForwardPreset[]>([]);
  const autoRestoredPortForwardTabsRef = useRef<Set<string>>(new Set());
  const connectedTabIdsRef = useRef<Set<string>>(new Set());
  const uploadQueueRef = useRef<PendingUploadJob[]>([]);
  const runningUploadIdsRef = useRef<Map<string, string>>(new Map());
  const runningUploadCountsByTabRef = useRef<Map<string, number>>(new Map());
  const isDrainingUploadQueueRef = useRef(false);
  const downloadQueueRef = useRef<PendingDownloadJob[]>([]);
  const runningDownloadIdsRef = useRef<Map<string, string>>(new Map());
  const isDrainingDownloadQueueRef = useRef(false);
  const ensuredRemoteDirectoriesRef = useRef<Map<string, Set<string>>>(new Map());
  const ensuringRemoteDirectoriesRef = useRef<Map<string, Map<string, Promise<void>>>>(new Map());
  const readyUploadDirectoriesRef = useRef<Map<string, Set<string>>>(new Map());
  const warmingUploadDirectoriesRef = useRef<Map<string, Set<string>>>(new Map());
  const adaptiveUploadConcurrencyByTabRef = useRef<Map<string, number>>(new Map());
  const adaptiveUploadConcurrencyRecoveryByTabRef = useRef<Map<string, number>>(new Map());
  const uploadQueueRetryTimerRef = useRef<number | null>(null);
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
  const portForwardListRequestIdsRef = useRef<Map<string, number>>(new Map());
  const portForwardEventRequestIdsRef = useRef<Map<string, number>>(new Map());
  const canceledUploadBatchIdsRef = useRef<Set<string>>(new Set());
  const canceledDownloadBatchIdsRef = useRef<Set<string>>(new Set());
  const transferDockNoticeTimerRef = useRef<number | null>(null);
  const pendingStartupCommandsByTabRef = useRef<Map<string, string[]>>(new Map());
  const runStartupCommandsOnTabRef = useRef<
    (tabId: string, commands: string[]) => Promise<void>
  >(async () => undefined);
  const {
    refreshServerHealth,
    refreshServerProcesses,
    removeServerMonitorTabState,
    resetServerHealth,
    resetServerProcesses,
    serverHealth,
    serverHealthByTabRef,
    serverHealthError,
    serverHealthLoading,
    serverHealthMetrics,
    serverProcessByTabRef,
    serverProcessError,
    serverProcessLoading,
    serverProcessSnapshot
  } = useServerHealthMonitor({
    activeTabId,
    activeTabIdRef,
    connectedTabIdsRef,
    disconnectReportFingerprintByTabRef,
    isServerHealthDetailOpen,
    runningDownloadIdsRef,
    runningUploadIdsRef,
    terminalApi
  });
  const activeRemoteOpenFileIssue = activeTabId ? remoteOpenFileIssuesByTab[activeTabId] ?? null : null;
  const sftpError = activeTabId
    ? activeRemoteOpenFileIssue?.message ?? sftpErrorsByTab[activeTabId] ?? null
    : globalSftpError;

  const setSftpError = useCallback((message: string | null, tabId?: string | null) => {
    const normalizedTabId = typeof tabId === "string" ? tabId.trim() : "";
    const targetTabId = normalizedTabId || activeTabIdRef.current || "";
    if (!targetTabId) {
      setGlobalSftpError(message);
      return;
    }
    setSftpErrorsByTab((prev) => {
      if (!message) {
        if (!(targetTabId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[targetTabId];
        return next;
      }
      if (prev[targetTabId] === message) {
        return prev;
      }
      return {
        ...prev,
        [targetTabId]: message
      };
    });
  }, []);

  const clearRemoteOpenFileIssue = useCallback((tabId?: string | null) => {
    const normalizedTabId = typeof tabId === "string" ? tabId.trim() : "";
    const targetTabId = normalizedTabId || activeTabIdRef.current || "";
    if (!targetTabId) {
      return;
    }
    setRemoteOpenFileIssuesByTab((prev) => {
      if (!(targetTabId in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[targetTabId];
      return next;
    });
  }, []);

  const [uploadBatchByTab, setUploadBatchByTab] = useState<
    Record<string, { batchId: string; total: number }>
  >({});
  const [downloadBatchByTab, setDownloadBatchByTab] = useState<
    Record<string, { batchId: string; total: number }>
  >({});
  const [pausedUploadTabs, setPausedUploadTabs] = useState<Record<string, true>>({});
  const [pausedDownloadTabs, setPausedDownloadTabs] = useState<Record<string, true>>({});
  const [schedulePausedUploadTabs, setSchedulePausedUploadTabs] = useState<Record<string, true>>({});
  const [schedulePausedDownloadTabs, setSchedulePausedDownloadTabs] = useState<Record<string, true>>({});
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
  const buildDangerousCommandApprovalContext = useCallback(
    (request: DangerousCommandApprovalRequest) => {
      const uniqueRuleLabels = Array.from(new Set(request.result.matches.map((match) => match.label)));
      const activeWorkspaceProfile = getWorkspaceProfileOption(
        workspaceProfilePreferencesRef.current.profileId
      );
      return {
        contextSummary: [
          workspaceProfilePreferencesRef.current.profileId !== "none"
            ? `workspace ${
                getI18n(readAppLanguagePreference()).settings.workspace.profileOptions[
                  activeWorkspaceProfile.id as WorkspaceProfileI18nKey
                ].shortLabel
              }`
            : null,
          request.result.sessionGroupName ? `group ${request.result.sessionGroupName}` : null,
          `pack ${request.result.appliedPolicyPackLabel}`,
          `env ${request.result.appliedEnvironmentTemplateLabel}`
        ]
          .filter(Boolean)
          .join(" | "),
        ruleSummary: uniqueRuleLabels.join(" | ")
      };
    },
    []
  );
  const findMatchingDangerousCommandPersistentApproval = useCallback(
    (request: DangerousCommandApprovalRequest): boolean =>
      dangerousCommandGuardPreferencesRef.current.persistentApprovals.some((approval) =>
        matchesDangerousCommandPersistentApproval(approval, request)
      ),
    []
  );
  const {
    approveDangerousCommandWithScope,
    clearDangerousCommandTemporaryApprovals,
    dangerousCommandApproval,
    dangerousCommandTemporaryApprovals,
    dismissDangerousCommandApprovalsForClosedTabs,
    guardedTerminalWrite,
    removeDangerousCommandTemporaryApproval,
    requestDangerousCommandApproval,
    resolveDangerousCommandApproval
  } = useDangerousCommandApprovalFlow({
    buildApprovalContext: buildDangerousCommandApprovalContext,
    dangerousCommandGuardPreferences,
    findMatchingPersistentApproval: findMatchingDangerousCommandPersistentApproval,
    maxTemporaryApprovals: MAX_DANGEROUS_COMMAND_TEMP_APPROVALS,
    pushAppHintMessage,
    sessionsRef,
    setError,
    systemApi,
    terminalApi,
    terminalTabsRef
  });

  const activeTerminalTab = useMemo(
    () => terminalTabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, terminalTabs]
  );
  const isActiveTabConnected = !!(activeTabId && connectedTabIdsRef.current.has(activeTabId));
  const activeUploadPauseReason =
    activeTabId && pausedUploadTabs[activeTabId]
      ? "disconnected"
      : activeTabId && schedulePausedUploadTabs[activeTabId]
        ? "schedule-window"
        : null;
  const activeDownloadPauseReason =
    activeTabId && pausedDownloadTabs[activeTabId]
      ? "disconnected"
      : activeTabId && schedulePausedDownloadTabs[activeTabId]
        ? "schedule-window"
        : null;
  const isActiveUploadQueuePaused = activeUploadPauseReason !== null;
  const isActiveDownloadQueuePaused = activeDownloadPauseReason !== null;
  const isSftpTransferWindowOpen = isWithinSftpTransferScheduleWindow(sftpTransferPreferences);
  const sftpTransferScheduleSummary = formatSftpTransferScheduleWindowSummary(sftpTransferPreferences);
  const activeSftpTransferSchedulePresetId = useMemo(
    () =>
      SFTP_TRANSFER_SCHEDULE_PRESETS.find((preset) =>
        doesSftpTransferSchedulePresetMatchPreferences(preset, sftpTransferPreferences)
      )?.id ?? null,
    [sftpTransferPreferences]
  );
  const nextSftpTransferWindowOpeningAt = useMemo(
    () => getNextSftpTransferWindowOpening(sftpTransferPreferences),
    [sftpTransferPreferences]
  );
  const nextSftpTransferWindowOpeningLabel = useMemo(() => {
    if (!nextSftpTransferWindowOpeningAt) {
      return null;
    }
    return nextSftpTransferWindowOpeningAt.toLocaleString();
  }, [nextSftpTransferWindowOpeningAt]);
  const activeTransferDockNotice =
    transferDockNotice && activeTabId && transferDockNotice.tabId === activeTabId
      ? transferDockNotice
      : null;
  const activeSessionId = activeTerminalTab?.sessionId ?? null;
  const portForwards = activeTabId ? portForwardRecordsByTab[activeTabId] ?? [] : [];
  const portForwardStatusMessage = activeTabId
    ? portForwardStatusMessagesByTab[activeTabId] ?? null
    : null;
  const allPortForwards = useMemo(
    () => Object.values(portForwardRecordsByTab).flat(),
    [portForwardRecordsByTab]
  );
  const pendingTransferRestoreCount = pendingTransferRestoreItems.length;
  const totalCommandSnippetCount = useMemo(
    () => commandSnippetGroups.reduce((total, group) => total + group.snippets.length, 0),
    [commandSnippetGroups]
  );
  const totalCommandSnippetPromptSetCount = useMemo(
    () => commandSnippetGroups.reduce((total, group) => total + group.promptSets.length, 0),
    [commandSnippetGroups]
  );
  const commandSnippetScopedValueCount = useMemo(
    () => Object.keys(commandSnippetScopedValues).length,
    [commandSnippetScopedValues]
  );
  const workspaceProfileLabels = i18n.settings.workspace.profileOptions;
  const selectedWorkspaceProfile = useMemo(
    () => {
      const profile = getWorkspaceProfileOption(workspaceProfilePreferences.profileId);
      const labels = workspaceProfileLabels[profile.id as WorkspaceProfileI18nKey];
      return {
        ...profile,
        label: labels.label,
        shortLabel: labels.shortLabel,
        description: labels.description
      };
    },
    [workspaceProfileLabels, workspaceProfilePreferences.profileId]
  );
  const workspaceProfileCardViews = useMemo(
    () =>
      WORKSPACE_PROFILE_OPTIONS.map((profile) => {
        const labels = workspaceProfileLabels[profile.id as WorkspaceProfileI18nKey];
        const template =
          DANGEROUS_COMMAND_ENVIRONMENT_TEMPLATES.find((entry) => entry.id === profile.id) ??
          DANGEROUS_COMMAND_ENVIRONMENT_TEMPLATES[0];
        const recommendedPackLabel =
          DANGEROUS_COMMAND_POLICY_PACKS.find(
            (pack) => pack.id === template.recommendedPolicyPackId
          )?.label ?? template.recommendedPolicyPackId;
        return {
          id: profile.id,
          label: labels.label,
          description: labels.description,
          safetyDefaultLabel: i18n.settings.workspace.safetyDefault(template.label, recommendedPackLabel)
        };
      }),
    [i18n, workspaceProfileLabels]
  );
  const hotkeySettingRowViews = useMemo(
    () =>
      HOTKEY_ACTION_ORDER.map((action) => {
        const binding = hotkeyPreferences[action];
        return {
          actionId: action,
          description: getHotkeyActionDescription(action),
          enabled: binding.enabled,
          bindingLabel: formatHotkeyBindingLabel(binding, isMacPlatform),
          isConflicting: hotkeyConflictActionSet.has(action),
          isFocused: hotkeyFocusedAction === action,
          conflictBindingLabel: hotkeyConflictBindingByAction.get(action) ?? "",
          modifier: binding.modifier,
          key: binding.key
        };
      }),
    [
      hotkeyConflictActionSet,
      hotkeyConflictBindingByAction,
      hotkeyFocusedAction,
      hotkeyPreferences,
      isMacPlatform
    ]
  );
  const hotkeyConflictViews = useMemo(
    () =>
      hotkeyConflicts.map((conflict, index) => ({
        signature: conflict.signature,
        bindingLabel: formatHotkeyBindingLabel(
          {
            enabled: true,
            modifier: conflict.modifier,
            key: conflict.key
          },
          isMacPlatform
        ),
        actionSummary: conflict.actions
          .map((action) => getHotkeyActionDescription(action))
          .join(" / "),
        isActive: index === hotkeyConflictCursorIndex
      })),
    [hotkeyConflicts, hotkeyConflictCursorIndex, isMacPlatform]
  );
  const selectedTerminalEditorFocusTheme = useMemo(
    () =>
      TERMINAL_EDITOR_FOCUS_THEME_OPTIONS.find(
        (option) => option.id === terminalEditorFocusPreferences.themeId
      ) ?? TERMINAL_EDITOR_FOCUS_THEME_OPTIONS[0],
    [terminalEditorFocusPreferences.themeId]
  );
  const selectedTerminalEditorFocusTypography = useMemo(
    () =>
      TERMINAL_EDITOR_FOCUS_TYPOGRAPHY_OPTIONS.find(
        (option) => option.id === terminalEditorFocusPreferences.typographyId
      ) ?? TERMINAL_EDITOR_FOCUS_TYPOGRAPHY_OPTIONS[1] ?? TERMINAL_EDITOR_FOCUS_TYPOGRAPHY_OPTIONS[0],
    [terminalEditorFocusPreferences.typographyId]
  );
  const selectedTerminalEditorFocusFont = useMemo(
    () =>
      TERMINAL_EDITOR_FOCUS_FONT_OPTIONS.find(
        (option) => option.id === terminalEditorFocusPreferences.fontId
      ) ?? TERMINAL_EDITOR_FOCUS_FONT_OPTIONS[0],
    [terminalEditorFocusPreferences.fontId]
  );
  const selectedTerminalEditorFocusRhythm = useMemo(
    () =>
      TERMINAL_EDITOR_FOCUS_RHYTHM_OPTIONS.find(
        (option) => option.id === terminalEditorFocusPreferences.rhythmId
      ) ?? TERMINAL_EDITOR_FOCUS_RHYTHM_OPTIONS[1] ?? TERMINAL_EDITOR_FOCUS_RHYTHM_OPTIONS[0],
    [terminalEditorFocusPreferences.rhythmId]
  );
  const selectedTerminalEditorFocusCursor = useMemo(
    () =>
      TERMINAL_EDITOR_FOCUS_CURSOR_OPTIONS.find(
        (option) => option.id === terminalEditorFocusPreferences.cursorId
      ) ?? TERMINAL_EDITOR_FOCUS_CURSOR_OPTIONS[2] ?? TERMINAL_EDITOR_FOCUS_CURSOR_OPTIONS[0],
    [terminalEditorFocusPreferences.cursorId]
  );
  const {
    activeGroupSessions,
    activeSessionGroup,
    activeTabSessionGroupName,
    filteredSessions,
    groupedSessions,
    selectedGroupKeySet,
    selectedGroupNames,
    selectedGroups,
    selectedSession,
    selectedSessionIdSet,
    selectedSessionsInActiveGroup,
    sessionBadgeText,
    sessionContextTarget,
    sessionGroupOptions
  } = useSessionGroupingViewModels({
    activeSessionGroupKey,
    activeTabId,
    persistedGroupNames: sessionGroupsState.groups,
    selectedGroupKeys,
    selectedSessionId,
    selectedSessionIds,
    sessionContextSessionId:
      sessionContextMenu?.target.type === "session"
        ? sessionContextMenu.target.sessionId
        : null,
    sessionFavoritesOnly,
    sessionFilterQuery,
    sessionSortMode,
    sessions,
    terminalTabs
  });
  const {
    allVisibleCommandHistorySelected,
    hiddenInspectorCommandHistoryCount,
    inspectorTerminalCommandHistoryEntries,
    selectedCommandHistoryContextEntry,
    visibleCommandHistoryEntryById,
    visibleCommandHistoryIds,
    visibleTerminalCommandHistoryEntries,
    visibleTerminalCommandHistoryEntryViews
  } = useCommandHistoryViewModels({
    activeTabId,
    buildEntryMetaLabel: (entry) =>
      `${formatHistoryTimestamp(entry.executedAt)} | ${formatTerminalCommandHistorySourceLabel(entry.source)}`,
    buildEntryTitle: (entry) =>
      i18n.commandHistoryManager.entryTitle(
        entry.command,
        formatTerminalCommandHistorySourceLabel(entry.source)
      ),
    commandHistoryContextEntryId: commandHistoryContextMenu?.entryId ?? null,
    entries: terminalCommandHistoryEntries,
    previewLimit: COMMAND_HISTORY_INSPECTOR_PREVIEW_LIMIT,
    query: terminalCommandHistoryQuery,
    scope: terminalCommandHistoryScope,
    selection: commandHistorySelection
  });
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
    [guardedTerminalWrite, terminalApi]
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
    [guardedTerminalWrite, terminalApi]
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
          command: normalizedCommand,
          executedAt: Date.now(),
          source
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
  const startOperationCenterAppJob = useCallback(
    (input: Pick<OperationCenterAppJob, "category" | "title" | "description">) => {
      const entry: OperationCenterAppJob = {
        id: createClientSideId("ocj"),
        category: input.category,
        title: input.title,
        description: input.description,
        status: "running",
        startedAt: Date.now()
      };
      setOperationCenterAppJobs((prev) => [entry, ...prev].slice(0, MAX_OPERATION_CENTER_APP_JOBS));
      return entry.id;
    },
    []
  );
  const finishOperationCenterAppJob = useCallback(
    (
      jobId: string,
      status: Extract<OperationCenterAppJobStatus, "succeeded" | "failed">,
      options?: {
        detail?: string;
        outputPath?: string;
      }
    ) => {
      const normalizedJobId = jobId.trim();
      if (!normalizedJobId) {
        return;
      }
      setOperationCenterAppJobs((prev) =>
        prev.map((entry) =>
          entry.id !== normalizedJobId
            ? entry
            : {
                ...entry,
                status,
                finishedAt: Date.now(),
                detail: options?.detail?.trim() || entry.detail,
                outputPath: options?.outputPath?.trim() || entry.outputPath
              }
        )
      );
    },
    []
  );
  const removeOperationCenterAppJob = useCallback((jobId: string) => {
    const normalizedJobId = jobId.trim();
    if (!normalizedJobId) {
      return;
    }
    setOperationCenterAppJobs((prev) => prev.filter((entry) => entry.id !== normalizedJobId));
  }, []);
  const clearFinishedOperationCenterAppJobs = useCallback(() => {
    setOperationCenterAppJobs((prev) => prev.filter((entry) => entry.status === "running"));
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
  const {
    sftpActiveSessionConflictHint,
    sftpConcurrencyHint,
    sftpRateLimitHint,
    sftpRetryThresholdHint,
    sftpScheduleDayViews,
    sftpScheduleHint,
    sftpSchedulePresetViews,
    sftpTransferPolicyPackLastSyncLabel,
    sftpTransferPolicyPackViews
  } = useSftpSettingsViewModels({
    activeSessionId,
    activeSessionTransferConflictStrategy,
    activeSftpTransferSchedulePresetId,
    formatPortForwardTimestamp,
    formatSftpTransferPolicyPackSummary,
    formatTransferConflictStrategyLabel,
    getSchedulePresetSummary: (preset) => {
      const presetPreferences = createSftpTransferSchedulePreferencesFromPreset(preset);
      return preset.scheduleWindowEnabled
        ? formatSftpTransferScheduleWindowSummary(presetPreferences)
        : "No schedule restriction";
    },
    isSftpTransferWindowOpen,
    maxSftpTransferConcurrency: MAX_SFTP_TRANSFER_CONCURRENCY,
    maxRetryBatchConfirmThreshold: MAX_RETRY_BATCH_CONFIRM_THRESHOLD,
    minRetryBatchConfirmThreshold: MIN_RETRY_BATCH_CONFIRM_THRESHOLD,
    nextSftpTransferWindowOpeningLabel,
    scheduleDayOptions: SFTP_TRANSFER_SCHEDULE_DAY_OPTIONS,
    schedulePresets: SFTP_TRANSFER_SCHEDULE_PRESETS,
    sftpTransferPolicyPacks,
    sftpTransferPolicyPackSyncState,
    sftpTransferPreferences,
    sftpTransferScheduleSummary
  });
  const {
    diagnosticsDisconnectCaptureHint,
    diagnosticsDisconnectEmptyStateLabel,
    diagnosticsDisconnectReportViews,
    diagnosticsLogDirectoryPath,
    diagnosticsLogFilePath,
    hasCustomizedDisconnectReportView,
    visibleDisconnectReports
  } = useDisconnectDiagnosticsViewModels({
    activeSessionId,
    classifyTransferFailureReason,
    disconnectCaptureEnabled: disconnectReportCapturePreferences.enabled,
    disconnectReportDefaults: DEFAULT_DISCONNECT_REPORT_VIEW_PREFERENCES,
    disconnectReportQuery,
    disconnectReportScope,
    disconnectReportTimeRange,
    disconnectReportTriggerFilter,
    disconnectReports,
    formatPortForwardTimestamp,
    logInfo,
    resolveDisconnectReportTimeRangeCutoff,
    terminalTabs
  });
  const resetDisconnectReportViewFilters = useCallback(() => {
    setDisconnectReportScope(DEFAULT_DISCONNECT_REPORT_VIEW_PREFERENCES.scope);
    setDisconnectReportTriggerFilter(DEFAULT_DISCONNECT_REPORT_VIEW_PREFERENCES.trigger);
    setDisconnectReportTimeRange(DEFAULT_DISCONNECT_REPORT_VIEW_PREFERENCES.timeRange);
    setDisconnectReportQuery(DEFAULT_DISCONNECT_REPORT_VIEW_PREFERENCES.query);
  }, []);
  const {
    activePortForwardEventHistory,
    activePortForwardPresets,
    hasCustomizedPortForwardEventView,
    portForwardActiveTabSummary,
    portForwardAnalyticsView,
    portForwardEventErrorCodeOptions,
    portForwardEventSummaryLabel,
    portForwardEventViews,
    portForwardPresetViews,
    portForwardRecordViews,
    portForwardVisibleEventAnalytics,
    resetPortForwardEventViewFilters,
    visiblePortForwardEventHistory
  } = usePortForwardingViewModels({
    activeSessionId,
    activeTabTitle: activeTerminalTab?.title ?? null,
    defaultEventViewPreferences: DEFAULT_PORT_FORWARD_EVENT_VIEW_PREFERENCES,
    formatPercent,
    formatPortForwardEventCorrelation,
    formatPortForwardEventSummary,
    formatPortForwardEventType,
    formatPortForwardPreset,
    formatPortForwardRecord,
    formatPortForwardTimestamp,
    getPortForwardStatusLabel,
    isActiveTabConnected,
    portForwardEventCorrelationQuery,
    portForwardEventErrorCode,
    portForwardEventFilter,
    portForwardEventHistory,
    portForwardEventTimeRange,
    portForwardPresets,
    portForwards,
    resolvePortForwardEventTimeRangeCutoff,
    setPortForwardEventCorrelationQuery,
    setPortForwardEventErrorCode,
    setPortForwardEventFilter,
    setPortForwardEventTimeRange
  });
  const {
    activeDangerousCommandGroupAssignment,
    dangerousCommandBuiltinRuleViews,
    dangerousCommandCustomPatternSummary,
    dangerousCommandEnvironmentTemplateViews,
    dangerousCommandExecutionSourceViews,
    dangerousCommandGroupAssignmentLimitReached,
    dangerousCommandGroupAssignmentViews,
    dangerousCommandPersistentApprovalViews,
    dangerousCommandPolicyBundleLastPulledLabel,
    dangerousCommandPolicyBundleLastPushedLabel,
    dangerousCommandPolicyBundleViews,
    dangerousCommandPolicyPackViews,
    dangerousCommandSettingsTargetGroupName,
    dangerousCommandSupplementalRuleViews,
    dangerousCommandTargetGroupHint,
    dangerousCommandTemporaryApprovalViews,
    enabledDangerousCommandBuiltinRuleCount,
    enabledDangerousCommandSourceCount,
    selectedDangerousCommandEnvironmentTemplate,
    selectedDangerousCommandPolicyPack
  } = useDangerousCommandSettingsViewModels({
    activeSessionGroupName: activeSessionGroup?.groupName ?? null,
    activeTabSessionGroupName,
    builtinRules: DANGEROUS_COMMAND_BUILTIN_RULES,
    environmentTemplates: DANGEROUS_COMMAND_ENVIRONMENT_TEMPLATES,
    executionSources: DANGEROUS_COMMAND_EXECUTION_SOURCES,
    formatPersistentApprovalScopeLabel:
      formatDangerousCommandPersistentApprovalScopeLabel,
    formatTemporaryApprovalScopeLabel:
      formatDangerousCommandTemporaryApprovalScopeLabel,
    maxGroupAssignmentCount: MAX_DANGEROUS_COMMAND_GROUP_ASSIGNMENTS,
    policyBundles: dangerousCommandPolicyBundles,
    policyBundleSyncState: dangerousCommandPolicyBundleSyncState,
    policyPacks: DANGEROUS_COMMAND_POLICY_PACKS,
    preferences: dangerousCommandGuardPreferences,
    temporaryApprovals: dangerousCommandTemporaryApprovals
  });
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
      const serverHealthStateForTab = serverHealthByTabRef.current[tabId];
      const serverProcessStateForTab = serverProcessByTabRef.current[tabId];
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
        pausedUpload:
          !!pausedUploadTabsRef.current[tabId] || !!schedulePausedUploadTabsRef.current[tabId],
        pausedDownload:
          !!pausedDownloadTabsRef.current[tabId] || !!schedulePausedDownloadTabsRef.current[tabId],
        portForwardTotal: tabPortForwards.length,
        portForwardDegraded,
        portForwardBusy: portForwardBusyRef.current,
        serverHealthLoading: serverHealthStateForTab?.loading ?? false,
        serverProcessLoading: serverProcessStateForTab?.loading ?? false,
        serverHealthError: serverHealthStateForTab?.error ?? undefined,
        serverProcessError: serverProcessStateForTab?.error ?? undefined,
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
  const getSessionGroupNameForTab = useCallback((tabId: string): string | null => {
    const normalizedTabId = tabId.trim();
    if (!normalizedTabId) {
      return null;
    }
    const tab = terminalTabsRef.current.find((item) => item.id === normalizedTabId) ?? null;
    if (!tab) {
      return null;
    }
    const session = sessionsRef.current.find((item) => item.id === tab.sessionId) ?? null;
    const groupName = session?.groupId?.trim() ?? "";
    return groupName || null;
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
  const setRetryBatchConfirmThresholdFromInput = useCallback((rawValue: string) => {
    setRetryBatchConfirmThreshold((prev) =>
      parseRetryBatchConfirmThreshold(Number(rawValue), prev)
    );
  }, []);
  const clearActiveSessionUploadConflictDefault = useCallback(() => {
    if (!activeSessionId) {
      return;
    }
    clearSessionTransferConflictStrategy(activeSessionId, "upload");
    showTransferDockNotice(
      activeTabId ?? "",
      "info",
      "Cleared remembered upload conflict default for active session.",
      5000
    );
  }, [activeSessionId, activeTabId, clearSessionTransferConflictStrategy, showTransferDockNotice]);
  const clearActiveSessionDownloadConflictDefault = useCallback(() => {
    if (!activeSessionId) {
      return;
    }
    clearSessionTransferConflictStrategy(activeSessionId, "download");
    showTransferDockNotice(
      activeTabId ?? "",
      "info",
      "Cleared remembered download conflict default for active session.",
      5000
    );
  }, [activeSessionId, activeTabId, clearSessionTransferConflictStrategy, showTransferDockNotice]);
  const clearActiveSessionConflictDefaults = useCallback(() => {
    if (!activeSessionId) {
      return;
    }
    clearSessionTransferConflictStrategy(activeSessionId);
    showTransferDockNotice(
      activeTabId ?? "",
      "info",
      "Cleared all remembered conflict defaults for active session.",
      5000
    );
  }, [activeSessionId, activeTabId, clearSessionTransferConflictStrategy, showTransferDockNotice]);
  const setPortForwardFormType = useCallback((value: string) => {
    setPortForwardForm((prev) => ({
      ...prev,
      type: value as CreatePortForwardInput["type"]
    }));
  }, []);
  const setPortForwardFormBindHost = useCallback((value: string) => {
    setPortForwardForm((prev) => ({
      ...prev,
      bindHost: value
    }));
  }, []);
  const setPortForwardFormBindPort = useCallback((value: string) => {
    setPortForwardForm((prev) => ({
      ...prev,
      bindPort: value
    }));
  }, []);
  const setPortForwardFormTargetHost = useCallback((value: string) => {
    setPortForwardForm((prev) => ({
      ...prev,
      targetHost: value
    }));
  }, []);
  const setPortForwardFormTargetPort = useCallback((value: string) => {
    setPortForwardForm((prev) => ({
      ...prev,
      targetPort: value
    }));
  }, []);
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
  const removeDangerousCommandPersistentApproval = useCallback((approvalId: string) => {
    setDangerousCommandGuardPreferences((prev) => ({
      ...prev,
      persistentApprovals: prev.persistentApprovals.filter((approval) => approval.id !== approvalId)
    }));
  }, []);
  const showAppAlert = useCallback(
    async (message: string, options?: AppAlertDialogOptions): Promise<void> => {
      const title = tr((options?.title ?? "").trim());
      const translatedMessage = tr(message);
      const hasDetailText = typeof options?.detailText === "string" && options.detailText.trim().length > 0;
      if (hasDetailText) {
        const dialog: AppAlertDialogState = {
          mode: "alert",
          title: title || tr("Notice"),
          message: translatedMessage,
          confirmLabel: tr(options?.confirmLabel ?? "OK"),
          detailText:
            options?.translateDetailText && options.detailText
              ? trMultiline(options.detailText)
              : options?.detailText
        };
        await openAppDialog(dialog, undefined);
        return;
      }
      const summary = hasDetailText ? `${translatedMessage} (${tr("details available")})` : translatedMessage;
      pushAppHintMessage(summary, {
        level: /error|fail|warning|warn/i.test(title) ? "warn" : "info",
        durationMs: hasDetailText ? 5600 : 3600
      });
    },
    [openAppDialog, pushAppHintMessage, tr, trMultiline]
  );
  const showAppConfirm = useCallback(
    async (message: string, options?: AppConfirmDialogOptions): Promise<boolean> => {
      const dialog: AppConfirmDialogState = {
        mode: "confirm",
        title: tr(options?.title ?? "Confirm"),
        message: tr(message),
        confirmLabel: tr(options?.confirmLabel ?? "Confirm"),
        cancelLabel: tr(options?.cancelLabel ?? "Cancel"),
        danger: options?.danger,
        detailText: options?.detailText ? trMultiline(options.detailText) : undefined
      };
      const result = await openAppDialog(dialog, false);
      return result === true;
    },
    [openAppDialog, tr, trMultiline]
  );
  const showAppPrompt = useCallback(
    async (
      message: string,
      defaultValue = "",
      options?: AppPromptDialogOptions
    ): Promise<string | null> => {
      const dialog: AppPromptDialogState = {
        mode: "prompt",
        title: tr(options?.title ?? "Input Required"),
        message: tr(message),
        confirmLabel: tr(options?.confirmLabel ?? "OK"),
        cancelLabel: tr(options?.cancelLabel ?? "Cancel"),
        value: defaultValue,
        multiline: options?.multiline,
        inputType: options?.inputType
      };
      const result = await openAppDialog(dialog, null);
      return typeof result === "string" ? result : null;
    },
    [openAppDialog, tr]
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
        source: "manual"
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
          source: entry.source,
          sourceLabel: formatTerminalCommandHistorySourceLabel(entry.source),
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
        upsertTerminalCommandHistoryCommand(commands[index].command, {
          source: commands[index].source
        });
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
  const refreshDiagnosticsLogInfo = useCallback(() => {
    void refreshLogInfo().catch((caughtError) => {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:diagnostics", "Failed to refresh log info.", caughtError);
    });
  }, [refreshLogInfo, writeAppLog]);
  const setPortForwardsForTab = useCallback((tabId: string, records: PortForwardRecord[]) => {
    const normalizedTabId = tabId.trim();
    if (!normalizedTabId) {
      return;
    }
    setPortForwardRecordsByTab((prev) => {
      const nextRecords = [...records].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
      );
      return {
        ...prev,
        [normalizedTabId]: nextRecords
      };
    });
  }, []);
  const clearPortForwardTabState = useCallback((tabId: string) => {
    const normalizedTabId = tabId.trim();
    if (!normalizedTabId) {
      return;
    }
    portForwardListRequestIdsRef.current.delete(normalizedTabId);
    portForwardEventRequestIdsRef.current.delete(normalizedTabId);
    setPortForwardRecordsByTab((prev) => {
      if (!(normalizedTabId in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[normalizedTabId];
      return next;
    });
    setPortForwardStatusMessagesByTab((prev) => {
      if (!(normalizedTabId in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[normalizedTabId];
      return next;
    });
  }, []);
  const setPortForwardStatusMessageForTab = useCallback((tabId: string, message: string | null) => {
    const normalizedTabId = tabId.trim();
    if (!normalizedTabId) {
      return;
    }
    setPortForwardStatusMessagesByTab((prev) => {
      if (!message) {
        if (!(normalizedTabId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[normalizedTabId];
        return next;
      }
      if (prev[normalizedTabId] === message) {
        return prev;
      }
      return {
        ...prev,
        [normalizedTabId]: message
      };
    });
  }, []);
  const refreshPortForwards = useCallback(
    async (targetTabId?: string | null): Promise<void> => {
      if (!terminalApi?.listPortForwards) {
        if (activeTabIdRef.current) {
          clearPortForwardTabState(activeTabIdRef.current);
        }
        return;
      }
      const tabId = targetTabId ?? activeTabId;
      if (!tabId) {
        return;
      }
      const requestId = (portForwardListRequestIdsRef.current.get(tabId) ?? 0) + 1;
      portForwardListRequestIdsRef.current.set(tabId, requestId);
      try {
        const listed = await terminalApi.listPortForwards(tabId);
        if (portForwardListRequestIdsRef.current.get(tabId) !== requestId) {
          return;
        }
        setPortForwardsForTab(tabId, listed);
        const degradedCount = listed.filter((entry) => entry.status === "degraded").length;
        if (degradedCount > 0) {
          setPortForwardStatusMessageForTab(
            tabId,
            `${degradedCount} active forward(s) currently degraded. Check their last error below.`
          );
        } else if (listed.length > 0) {
          setPortForwardStatusMessageForTab(tabId, "All active forwards are healthy.");
        } else {
          setPortForwardStatusMessageForTab(tabId, "No active forwards on the current tab.");
        }
      } catch (caughtError) {
        if (portForwardListRequestIdsRef.current.get(tabId) !== requestId) {
          return;
        }
        const message = toPortForwardErrorMessage(caughtError);
        setError(message);
        setPortForwardStatusMessageForTab(tabId, message);
        writeAppLog(
          "error",
          "renderer:port-forwarding",
          "Failed to refresh port forwarding list.",
          caughtError
        );
      }
    },
    [activeTabId, clearPortForwardTabState, setPortForwardStatusMessageForTab, setPortForwardsForTab, terminalApi, writeAppLog]
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
      const requestId = (portForwardEventRequestIdsRef.current.get(tabId) ?? 0) + 1;
      portForwardEventRequestIdsRef.current.set(tabId, requestId);
      try {
        const listed = await terminalApi.listPortForwardEvents(tabId, 40);
        if (portForwardEventRequestIdsRef.current.get(tabId) !== requestId) {
          return;
        }
        const sessionIdForEvents =
          terminalTabsRef.current.find((tab) => tab.id === tabId)?.sessionId ??
          (tabId === activeTabIdRef.current ? activeSessionIdRef.current : null);
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
    [activeTabId, terminalApi, writeAppLog]
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
      if (options?.updateVisibleList ?? true) {
        setPortForwardRecordsByTab((prev) => {
          const current = prev[tabId] ?? [];
          return {
            ...prev,
            [tabId]: [created, ...current.filter((entry) => entry.id !== created.id)]
          };
        });
      }
      return created;
    },
    [terminalApi]
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
      setPortForwardStatusMessageForTab(activeTabId, `Created ${formatPortForwardRecord(created)}.`);
      await showAppAlert(
        `Port forwarding created.\n${formatPortForwardRecord(created)}`,
        {
          title: "Port Forwarding"
        }
      );
    } catch (caughtError) {
      const message = toPortForwardErrorMessage(caughtError);
      setError(message);
      setPortForwardStatusMessageForTab(activeTabId, message);
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
    setPortForwardStatusMessageForTab,
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
        setPortForwardStatusMessageForTab(
          activeTabId,
          `Applied preset "${preset.name}" successfully.`
        );
        await showAppAlert(`Port forwarding created.\n${formatPortForwardRecord(created)}`, {
          title: "Port Forwarding Preset"
        });
      } catch (caughtError) {
        const message = toPortForwardErrorMessage(caughtError);
        setError(message);
        setPortForwardStatusMessageForTab(
          activeTabId,
          `Failed to apply preset "${preset.name}": ${message}`
        );
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
    [activeTabId, createPortForwardOnTab, setPortForwardStatusMessageForTab, showAppAlert, writeAppLog]
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
  const refreshActivePortForwards = useCallback(() => {
    if (!activeTabId) {
      return;
    }
    void refreshPortForwards(activeTabId);
  }, [activeTabId, refreshPortForwards]);
  const refreshActivePortForwardDiagnostics = useCallback(() => {
    if (!activeTabId) {
      return;
    }
    void Promise.all([refreshPortForwards(activeTabId), refreshPortForwardEvents(activeTabId)]);
  }, [activeTabId, refreshPortForwardEvents, refreshPortForwards]);
  const fillPortForwardFormFromActivePreset = useCallback(
    (presetId: string) => {
      const preset = activePortForwardPresets.find((entry) => entry.id === presetId) ?? null;
      if (!preset) {
        return;
      }
      setPortForwardForm(toPortForwardFormFromPreset(preset));
    },
    [activePortForwardPresets]
  );
  const applyActivePortForwardPreset = useCallback(
    (presetId: string) => {
      const preset = activePortForwardPresets.find((entry) => entry.id === presetId) ?? null;
      if (!preset) {
        return;
      }
      void applyPortForwardPreset(preset);
    },
    [activePortForwardPresets, applyPortForwardPreset]
  );
  const deleteActivePortForwardPreset = useCallback(
    (presetId: string) => {
      const preset = activePortForwardPresets.find((entry) => entry.id === presetId) ?? null;
      if (!preset) {
        return;
      }
      void deletePortForwardPreset(preset);
    },
    [activePortForwardPresets, deletePortForwardPreset]
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
          await createPortForwardOnTab(tabId, buildPortForwardInputFromPreset(preset));
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
      if (failedCount > 0) {
        const message = `${failedCount} port forwarding preset(s) failed to auto-restore.`;
        setError(message);
        setPortForwardStatusMessageForTab(tabId, message);
      }
    },
    [createPortForwardOnTab, setPortForwardStatusMessageForTab, writeAppLog]
  );
  const removePortForward = useCallback(
    async (forward: PortForwardRecord): Promise<void> => {
      if (!terminalApi?.removePortForward) {
        setError("Terminal bridge unavailable. Restart `pnpm dev`.");
        return;
      }
      const tabId = forward.tabId;
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
        setPortForwardRecordsByTab((prev) => {
          const current = prev[tabId] ?? [];
          return {
            ...prev,
            [tabId]: current.filter((entry) => entry.id !== forward.id)
          };
        });
        setPortForwardStatusMessageForTab(tabId, `Removed ${formatPortForwardRecord(forward)}.`);
      } catch (caughtError) {
        const message = toPortForwardErrorMessage(caughtError);
        setError(message);
        setPortForwardStatusMessageForTab(tabId, message);
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
    [setPortForwardStatusMessageForTab, showAppConfirm, terminalApi, writeAppLog]
  );
  const removeVisiblePortForward = useCallback(
    (forwardId: string) => {
      const forward = portForwards.find((entry) => entry.id === forwardId) ?? null;
      if (!forward) {
        return;
      }
      void removePortForward(forward);
    },
    [portForwards, removePortForward]
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
        title: tr(options?.title ?? "Choose Action"),
        message: tr(message),
        confirmLabel: "",
        cancelLabel: tr(options?.cancelLabel ?? "Cancel"),
        detailText: options?.detailText ? trMultiline(options.detailText) : undefined,
        options: choices.map((choice) => ({
          ...choice,
          label: tr(choice.label)
        }))
      };
      const result = await openAppDialog(dialog, null);
      return typeof result === "string" ? result : null;
    },
    [openAppDialog, tr, trMultiline]
  );
  const clearDangerousCommandPersistentApprovals = useCallback(async () => {
    const currentApprovals = dangerousCommandGuardPreferencesRef.current.persistentApprovals;
    if (currentApprovals.length === 0) {
      return;
    }
    const confirmed = await showAppConfirm(
      "Clear all persistent dangerous-command approval policies?\nThis removes the saved exact-command allow rules from Safety settings.",
      {
        title: "Clear Persistent Approval Policies",
        confirmLabel: "Clear",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    setDangerousCommandGuardPreferences((prev) => ({
      ...prev,
      persistentApprovals: []
    }));
    pushAppHintMessage("Cleared persistent dangerous-command approval policies.", {
      level: "info",
      durationMs: 4200
    });
  }, [pushAppHintMessage, showAppConfirm]);
  const saveDangerousCommandPersistentApproval = useCallback(async () => {
    const currentApproval = dangerousCommandApproval;
    if (!currentApproval) {
      resolveDangerousCommandApproval(true);
      return;
    }
    let scope: DangerousCommandPersistentApprovalScopeId = "global";
    if (currentApproval.request.result.sessionGroupName) {
      const choice = await showAppChoice(
        "Save a persistent exact-command approval policy for future matching commands.",
        [
          {
            value: "sessionGroup",
            label: "This Group"
          },
          {
            value: "global",
            label: "All Matching Contexts"
          }
        ],
        {
          title: "Save Approval Policy",
          cancelLabel: "Cancel",
          detailText:
            "The rule stays exact-match only: command text, execution source, policy pack, and environment template must still match."
        }
      );
      if (!choice) {
        return;
      }
      scope = choice as DangerousCommandPersistentApprovalScopeId;
    }
    const nextApproval = createDangerousCommandPersistentApprovalFromRequest(
      currentApproval.request,
      scope
    );
    if (!nextApproval) {
      return;
    }
    const currentPolicies = dangerousCommandGuardPreferencesRef.current.persistentApprovals;
    const existingPolicy =
      currentPolicies.find((approval) =>
        approval.scope === nextApproval.scope &&
        matchesDangerousCommandPersistentApproval(approval, currentApproval.request)
      ) ?? null;
    if (!existingPolicy && currentPolicies.length >= MAX_DANGEROUS_COMMAND_PERSISTENT_APPROVALS) {
      await showAppAlert(
        `Persistent approval limit reached (${MAX_DANGEROUS_COMMAND_PERSISTENT_APPROVALS}). Delete an existing policy first.`,
        {
          title: "Save Approval Policy"
        }
      );
      return;
    }
    setDangerousCommandGuardPreferences((prev) => ({
      ...prev,
      persistentApprovals: [
        nextApproval,
        ...prev.persistentApprovals.filter(
          (approval) =>
            approval.id !== existingPolicy?.id &&
            !(
              approval.scope === nextApproval.scope &&
              matchesDangerousCommandPersistentApproval(approval, currentApproval.request)
            )
        )
      ].slice(0, MAX_DANGEROUS_COMMAND_PERSISTENT_APPROVALS)
    }));
    pushAppHintMessage(
      `${
        existingPolicy ? "Updated" : "Saved"
      } persistent approval policy for ${formatDangerousCommandPersistentApprovalScopeLabel(nextApproval)}.`,
      {
        level: currentApproval.request.result.severity === "critical" ? "warn" : "info",
        durationMs: 5200
      }
    );
    resolveDangerousCommandApproval(true);
  }, [
    dangerousCommandApproval,
    pushAppHintMessage,
    resolveDangerousCommandApproval,
    showAppAlert,
    showAppChoice
  ]);
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
  const editingSessionTemplate = useMemo(
    () => sessionTemplates.find((template) => template.id === editingSessionTemplateId) ?? null,
    [editingSessionTemplateId, sessionTemplates]
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
  const {
    activeDownloadBatchProgress,
    activeDownloadProgressStats,
    activeDownloadQueueStats,
    activeDownloadTransfers,
    activeUploadBatchProgress,
    activeUploadProgressStats,
    activeUploadQueueStats,
    activeUploadTransfers,
    canClearFinishedDownloads,
    canClearFinishedUploads,
    canRetryAllFailedTransfers,
    canRetryFailedDownloads,
    canRetryFailedUploads,
    failedDownloadHistoryCount,
    failedDownloadRetryCandidates,
    failedRetryCandidateTotal,
    failedUploadHistoryCount,
    failedUploadRetryCandidates,
    hasOperationCenterActivity,
    hasOperationCenterDiagnosticsJobs,
    hasOperationCenterSnippetJobs,
    operationCenterActiveCount,
    operationCenterDeleteProgressLabel,
    operationCenterDownloadSummary,
    operationCenterFinishedAppJobCount,
    operationCenterPortForwardSummary,
    operationCenterRecentAppJobViews,
    operationCenterRunningAppJobCount,
    operationCenterTimelineItems,
    operationCenterTransferTabSummaries,
    operationCenterUploadSummary
  } = useSftpActivityViewModels({
    activePortForwardStatusMessage:
      activeTabId && portForwardStatusMessagesByTab[activeTabId]
        ? portForwardStatusMessagesByTab[activeTabId]
        : null,
    activeSessionId,
    activeTabId,
    allPortForwards,
    connectedTabIds: connectedTabIdsRef.current,
    createTransferRetryKey,
    downloadBatchByTab,
    formatHistoryTimestamp,
    formatOperationCenterAppJobCategoryLabel,
    formatOperationCenterAppJobDuration,
    formatOperationCenterAppJobStatusLabel,
    formatOperationCenterTransferStatus,
    formatPortForwardEventSummary,
    formatPortForwardEventType,
    formatPortForwardRecord,
    formatPortForwardTimestamp,
    getOperationCenterAppJobStateClass,
    getOperationCenterTransferStateClass,
    getPortForwardStatusLabel,
    operationCenterAppJobs,
    portForwardBusy,
    portForwardEventHistory,
    sftpDeleteProgress,
    sftpTransfers,
    terminalTabs,
    transferHistory,
    uploadBatchByTab
  });
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
  useSftpTransferBatchNotifications({
    activeDownloadBatchProgress,
    activeTabId,
    activeUploadBatchProgress,
    buildBatchFailureDetailText,
    setDownloadBatchByTab,
    setUploadBatchByTab,
    showTransferDockNotice,
    writeAppLog
  });
  const {
    canClearAllRetryCenterEntries,
    canClearSelectedRetryCenterEntries,
    canClearVisibleRetryCenterEntries,
    canCollapseAllRetryCenterGroups,
    canExpandAllRetryCenterGroups,
    canExportRetryCenterAnalytics,
    canRetrySelectedRetryCenterEntries,
    canRetryVisibleRetryCenterEntries,
    hasCustomizedRetryCenterView,
    isRetryCenterGroupedView,
    retryCenterAnalytics,
    retryCenterCollapsedGroupKeySet,
    retryCenterEntries,
    retryCenterFailureReasonExportValue,
    retryCenterFailureReasonOptions,
    retryCenterFailureSuggestionRows,
    retryCenterGroupedEntries,
    retryCenterLastRetryScopeLabel,
    retryCenterResolvedFailureReasonFilter,
    retryCenterSelectedFailureReasonLabel,
    retryCenterSelectionSet,
    retryCenterTopFailureReasonRetryRows,
    retryCenterVisibleExportEntryByKey,
    retryCenterVisibleExportEntries,
    selectedRetryCenterEntries,
    selectedRetryCenterFailedEntries,
    visibleRetryCenterFailedEntries
  } = useRetryCenterViewModels({
    activeSessionId,
    activeTabId,
    autoUseLastRetryScope: retryCenterAutoUseLastRetryScope,
    classifyTransferFailureReason,
    collapsedGroupKeys: retryCenterCollapsedGroupKeys,
    defaultViewPreferences: DEFAULT_RETRY_CENTER_VIEW_PREFERENCES,
    direction: retryCenterDirection,
    failureReasonAllValue: RETRY_CENTER_FAILURE_REASON_ALL,
    failureReasonFilter: retryCenterFailureReasonFilter,
    getTransferFailureSuggestion,
    labels: i18n.retryCenter,
    lastRetryScope: retryCenterLastRetryScope,
    listMode: retryCenterListMode,
    query: retryCenterQuery,
    retryBatchConfirmThreshold,
    scope: retryCenterScope,
    selection: retryCenterSelection,
    sessions,
    status: retryCenterStatus,
    timeRange: retryCenterTimeRange,
    toIsoTimestamp,
    transferHistory
  });
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
  const serverHealthMemoryAvailableBytes = serverHealth
    ? serverHealth.memoryAvailableBytes ??
      Math.max(0, serverHealth.memoryTotalBytes - serverHealth.memoryUsedBytes)
    : 0;
  const serverHealthKernelLabel = serverHealth
    ? [serverHealth.kernelName, serverHealth.kernelRelease].filter(Boolean).join(" ") || "-"
    : "-";
  const serverHealthCpuCoreLabel =
    serverHealth && serverHealth.cpuCoreCount && serverHealth.cpuCoreCount > 0
      ? serverHealth.cpuCoreCount.toLocaleString()
      : "-";
  const serverHealthCollectedAtLabel = serverHealth
    ? (() => {
        const timestamp = new Date(serverHealth.collectedAt);
        return Number.isFinite(timestamp.getTime()) ? timestamp.toLocaleString() : "-";
      })()
    : "-";
  const serverHealthSwapUsagePercent =
    serverHealth && serverHealth.swapTotalBytes && serverHealth.swapTotalBytes > 0
      ? ((serverHealth.swapUsedBytes ?? 0) / serverHealth.swapTotalBytes) * 100
      : 0;
  const serverHealthLoadPerCore =
    serverHealth && serverHealth.cpuCoreCount && serverHealth.cpuCoreCount > 0
      ? serverHealth.load1 / serverHealth.cpuCoreCount
      : null;
  const serverHealthFilesystems = serverHealth?.filesystems?.length
    ? serverHealth.filesystems
    : serverHealth
      ? [
          {
            filesystem: "",
            path: serverHealth.diskPath,
            totalBytes: serverHealth.diskTotalBytes,
            usedBytes: serverHealth.diskUsedBytes,
            availableBytes: serverHealth.diskAvailableBytes,
            usePercent: serverHealthMetrics?.diskUsagePercent ?? 0
          }
        ]
      : [];
  const serverHealthNetworkInterfaces = serverHealth?.networkInterfaces ?? [];
  const serverHealthMemoryProcesses = serverProcessSnapshot?.memoryProcesses ?? [];
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
    readyUploadDirectoriesRef.current.delete(tabId);
    warmingUploadDirectoriesRef.current.delete(tabId);
  }, []);

  const invalidateUploadDirectoryBranchForTab = useCallback((tabId: string, remoteDirectory: string) => {
    const normalized = normalizeRemoteDirectoryPath(remoteDirectory);
    if (!normalized) {
      return;
    }

    const cache = ensuredRemoteDirectoriesRef.current.get(tabId);
    if (cache) {
      for (const cachedPath of Array.from(cache)) {
        if (isRemotePathWithinBranch(cachedPath, normalized)) {
          cache.delete(cachedPath);
        }
      }
      if (cache.size === 0) {
        ensuredRemoteDirectoriesRef.current.delete(tabId);
      }
    }

    const inFlightByPath = ensuringRemoteDirectoriesRef.current.get(tabId);
    if (inFlightByPath) {
      for (const cachedPath of Array.from(inFlightByPath.keys())) {
        if (isRemotePathWithinBranch(cachedPath, normalized)) {
          inFlightByPath.delete(cachedPath);
        }
      }
      if (inFlightByPath.size === 0) {
        ensuringRemoteDirectoriesRef.current.delete(tabId);
      }
    }

    const readyDirectories = readyUploadDirectoriesRef.current.get(tabId);
    if (readyDirectories) {
      for (const cachedPath of Array.from(readyDirectories)) {
        if (isRemotePathWithinBranch(cachedPath, normalized)) {
          readyDirectories.delete(cachedPath);
        }
      }
      if (readyDirectories.size === 0) {
        readyUploadDirectoriesRef.current.delete(tabId);
      }
    }

    const warmingDirectories = warmingUploadDirectoriesRef.current.get(tabId);
    if (warmingDirectories) {
      for (const cachedPath of Array.from(warmingDirectories)) {
        if (isRemotePathWithinBranch(cachedPath, normalized)) {
          warmingDirectories.delete(cachedPath);
        }
      }
      if (warmingDirectories.size === 0) {
        warmingUploadDirectoriesRef.current.delete(tabId);
      }
    }
  }, []);

  const getEffectiveUploadConcurrencyForTab = useCallback(
    (tabId: string) => {
      const configured = Math.max(1, sftpTransferPreferences.uploadConcurrency);
      const adaptive = adaptiveUploadConcurrencyByTabRef.current.get(tabId);
      if (!adaptive || adaptive >= configured) {
        return configured;
      }
      return Math.max(1, adaptive);
    },
    [sftpTransferPreferences.uploadConcurrency]
  );

  const noteUploadChannelBackpressureForTab = useCallback(
    (tabId: string, message: string) => {
      const configured = Math.max(1, sftpTransferPreferences.uploadConcurrency);
      const current = adaptiveUploadConcurrencyByTabRef.current.get(tabId) ?? configured;
      const next =
        current <= 1 ? 1 : current <= 2 ? 1 : Math.max(1, Math.ceil(current / 2));
      adaptiveUploadConcurrencyRecoveryByTabRef.current.set(tabId, 0);
      if (next === current) {
        return;
      }
      adaptiveUploadConcurrencyByTabRef.current.set(tabId, next);
      writeAppLog(
        "warn",
        "renderer:sftp-transfer",
        "Upload concurrency reduced after SSH channel-open backpressure.",
        {
          tabId,
          configuredConcurrency: configured,
          previousConcurrency: current,
          nextConcurrency: next,
          message
        }
      );
    },
    [sftpTransferPreferences.uploadConcurrency]
  );

  const noteUploadSuccessForTab = useCallback(
    (tabId: string) => {
      const configured = Math.max(1, sftpTransferPreferences.uploadConcurrency);
      const current = adaptiveUploadConcurrencyByTabRef.current.get(tabId);
      if (!current || current >= configured) {
        adaptiveUploadConcurrencyByTabRef.current.delete(tabId);
        adaptiveUploadConcurrencyRecoveryByTabRef.current.delete(tabId);
        return;
      }
      const recoveredCount =
        (adaptiveUploadConcurrencyRecoveryByTabRef.current.get(tabId) ?? 0) + 1;
      if (recoveredCount < current) {
        adaptiveUploadConcurrencyRecoveryByTabRef.current.set(tabId, recoveredCount);
        return;
      }
      const next = Math.min(configured, current + 1);
      if (next >= configured) {
        adaptiveUploadConcurrencyByTabRef.current.delete(tabId);
        adaptiveUploadConcurrencyRecoveryByTabRef.current.delete(tabId);
      } else {
        adaptiveUploadConcurrencyByTabRef.current.set(tabId, next);
        adaptiveUploadConcurrencyRecoveryByTabRef.current.set(tabId, 0);
      }
      writeAppLog(
        "info",
        "renderer:sftp-transfer",
        "Upload concurrency recovered after successful transfers.",
        {
          tabId,
          configuredConcurrency: configured,
          previousConcurrency: current,
          nextConcurrency: next
        }
      );
    },
    [sftpTransferPreferences.uploadConcurrency]
  );

  const claimUploadDirectoryBarrier = useCallback((tabId: string, remoteDirectory: string) => {
    const normalized = normalizeRemoteDirectoryPath(remoteDirectory);
    if (!normalized) {
      return null;
    }
    const readyDirectories = readyUploadDirectoriesRef.current.get(tabId);
    if (readyDirectories?.has(normalized)) {
      return null;
    }
    const warmingDirectories = warmingUploadDirectoriesRef.current.get(tabId) ?? new Set<string>();
    warmingUploadDirectoriesRef.current.set(tabId, warmingDirectories);
    if (warmingDirectories.has(normalized)) {
      return null;
    }
    warmingDirectories.add(normalized);
    return normalized;
  }, []);

  const markUploadDirectoryReady = useCallback((tabId: string, remoteDirectory: string | null) => {
    if (!remoteDirectory) {
      return;
    }
    const readyDirectories = readyUploadDirectoriesRef.current.get(tabId) ?? new Set<string>();
    readyUploadDirectoriesRef.current.set(tabId, readyDirectories);
    readyDirectories.add(remoteDirectory);
    const warmingDirectories = warmingUploadDirectoriesRef.current.get(tabId);
    if (warmingDirectories) {
      warmingDirectories.delete(remoteDirectory);
      if (warmingDirectories.size === 0) {
        warmingUploadDirectoriesRef.current.delete(tabId);
      }
    }
  }, []);

  const releaseUploadDirectoryBarrier = useCallback((tabId: string, remoteDirectory: string | null) => {
    if (!remoteDirectory) {
      return;
    }
    const warmingDirectories = warmingUploadDirectoriesRef.current.get(tabId);
    if (!warmingDirectories) {
      return;
    }
    warmingDirectories.delete(remoteDirectory);
    if (warmingDirectories.size === 0) {
      warmingUploadDirectoriesRef.current.delete(tabId);
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

  const prewarmRemoteDirectoriesForUpload = useCallback(
    async (tabId: string, remoteDirectories: string[]) => {
      const uniqueDirectories = Array.from(
        new Set(
          remoteDirectories
            .map((directory) => normalizeRemoteDirectoryPath(directory))
            .filter((directory): directory is string => Boolean(directory))
        )
      );
      if (uniqueDirectories.length === 0) {
        return;
      }
      await runWithConcurrencyLimit(
        uniqueDirectories,
        SFTP_UPLOAD_DIRECTORY_PREWARM_CONCURRENCY,
        async (remoteDirectory) => {
          await ensureRemoteDirectoryForUpload(tabId, remoteDirectory);
        }
      );
    },
    [ensureRemoteDirectoryForUpload]
  );

  const { drainDownloadQueue, drainUploadQueue, syncScheduledTransferPauseState } =
    useSftpTransferQueueRuntime({
      applySftpTransferEvent,
      claimUploadDirectoryBarrier,
      connectedTabIdsRef,
      downloadQueueRef,
      ensureRemoteDirectoryForUpload,
      findNextSftpTransferWindowTransition,
      getEffectiveUploadConcurrencyForTab,
      getSftpChannelOpenRetryDelayMs,
      invalidateUploadDirectoryBranchForTab,
      isDrainingDownloadQueueRef,
      isDrainingUploadQueueRef,
      isRemotePathMissingError,
      isSftpChannelOpenFailureError,
      isTabNotConnectedError,
      isTransferCanceledMessage,
      isWithinSftpTransferScheduleWindow,
      markUploadDirectoryReady,
      noteUploadChannelBackpressureForTab,
      noteUploadSuccessForTab,
      normalizeRemoteDirectoryPath,
      readyUploadDirectoriesRef,
      releaseUploadDirectoryBarrier,
      resolveSftpTransferRateLimitBytesPerSecond,
      runningDownloadIdsRef,
      runningUploadCountsByTabRef,
      runningUploadIdsRef,
      setPausedDownloadTabs,
      setPausedUploadTabs,
      setSchedulePausedDownloadTabs,
      setSchedulePausedUploadTabs,
      setSftpError,
      sftpApi,
      sftpTransferPreferences,
      transferWindowEvaluationIntervalMs: SFTP_TRANSFER_WINDOW_EVALUATION_INTERVAL_MS,
      uploadChannelOpenRetryLimit: SFTP_UPLOAD_CHANNEL_OPEN_RETRY_LIMIT,
      uploadQueueRef,
      uploadQueueRetryTimerRef,
      warmingUploadDirectoriesRef,
      writeAppLog
    });

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
        setSftpError("Open a terminal tab before browsing SFTP.", targetTabId);
        return;
      }
      if (!connectedTabIdsRef.current.has(targetTabId)) {
        if (!options?.suppressDisconnectedError) {
          setSftpError("Terminal tab is not connected.", targetTabId);
        }
        return;
      }

      setSftpLoading(true);
      setSftpError(null, targetTabId);
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
        setSftpError(message, targetTabId);
      } finally {
        setSftpLoading(false);
      }
    },
    [activeTabId, sftpApi]
  );

  const clearDisconnectReportFingerprintsForTabIds = useCallback((tabIds: string[]) => {
    const uniqueTabIds = Array.from(new Set(tabIds.map((tabId) => tabId.trim()).filter(Boolean)));
    for (const tabId of uniqueTabIds) {
      disconnectReportFingerprintByTabRef.current.delete(tabId);
    }
  }, []);

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
    workspaceProfilePreferencesRef.current = workspaceProfilePreferences;
  }, [workspaceProfilePreferences]);

  useEffect(() => {
    dangerousCommandGuardPreferencesRef.current = dangerousCommandGuardPreferences;
  }, [dangerousCommandGuardPreferences]);

  useEffect(() => {
    sftpTransfersRef.current = sftpTransfers;
  }, [sftpTransfers]);

  useEffect(() => {
    transferHistoryRef.current = transferHistory;
  }, [transferHistory]);

  useEffect(() => {
    portForwardsRef.current = allPortForwards;
  }, [allPortForwards]);

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
    schedulePausedUploadTabsRef.current = schedulePausedUploadTabs;
  }, [schedulePausedUploadTabs]);

  useEffect(() => {
    schedulePausedDownloadTabsRef.current = schedulePausedDownloadTabs;
  }, [schedulePausedDownloadTabs]);

  useEffect(() => {
    portForwardBusyRef.current = portForwardBusy;
  }, [portForwardBusy]);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

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
    writeSftpExplorerViewMode(sftpExplorerViewMode);
  }, [sftpExplorerViewMode]);

  useEffect(() => {
    writeCommandHistoryInspectorCollapsed(isCommandHistoryInspectorCollapsed);
  }, [isCommandHistoryInspectorCollapsed]);

  useEffect(() => {
    writeFirstRunOnboardingDismissed(isFirstRunOnboardingDismissed);
  }, [isFirstRunOnboardingDismissed]);

  useEffect(() => {
    writeInspectorSidebarTabId(activeInspectorSidebarTab);
  }, [activeInspectorSidebarTab]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        TERMINAL_EDITOR_FOCUS_PREFERENCES_STORAGE_KEY,
        JSON.stringify(terminalEditorFocusPreferences)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [terminalEditorFocusPreferences]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        WORKSPACE_PROFILE_STORAGE_KEY,
        JSON.stringify(workspaceProfilePreferences)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [workspaceProfilePreferences]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DANGEROUS_COMMAND_GUARD_PREFERENCES_STORAGE_KEY,
        JSON.stringify(dangerousCommandGuardPreferences)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [dangerousCommandGuardPreferences]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DANGEROUS_COMMAND_POLICY_BUNDLES_STORAGE_KEY,
        JSON.stringify(dangerousCommandPolicyBundles)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [dangerousCommandPolicyBundles]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DANGEROUS_COMMAND_POLICY_BUNDLE_SYNC_STORAGE_KEY,
        JSON.stringify(dangerousCommandPolicyBundleSyncState)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [dangerousCommandPolicyBundleSyncState]);

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
      window.localStorage.removeItem(LEGACY_SFTP_TRANSFER_PREFERENCES_STORAGE_KEY);
      window.localStorage.removeItem(PREVIOUS_SFTP_TRANSFER_PREFERENCES_STORAGE_KEY);
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [sftpTransferPreferences]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SFTP_TRANSFER_POLICY_PACKS_STORAGE_KEY,
        JSON.stringify(sftpTransferPolicyPacks)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [sftpTransferPolicyPacks]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SFTP_TRANSFER_POLICY_PACK_SYNC_STORAGE_KEY,
        JSON.stringify(sftpTransferPolicyPackSyncState)
      );
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [sftpTransferPolicyPackSyncState]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        TERMINAL_COMMAND_HISTORY_STORAGE_KEY,
        JSON.stringify(terminalCommandHistoryEntries.slice(0, MAX_TERMINAL_COMMAND_HISTORY))
      );
      for (const legacyKey of LEGACY_TERMINAL_COMMAND_HISTORY_STORAGE_KEYS) {
        window.localStorage.removeItem(legacyKey);
      }
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
      if (sessionTemplates.length === 0) {
        window.localStorage.removeItem(SESSION_TEMPLATES_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          SESSION_TEMPLATES_STORAGE_KEY,
          JSON.stringify(sessionTemplates.slice(0, MAX_SESSION_TEMPLATES))
        );
      }
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [sessionTemplates]);

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
      const normalizedScopedValues = normalizeCommandSnippetScopedValues(commandSnippetScopedValues);
      if (Object.keys(normalizedScopedValues).length === 0) {
        window.localStorage.removeItem(COMMAND_SNIPPET_SCOPED_VALUES_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          COMMAND_SNIPPET_SCOPED_VALUES_STORAGE_KEY,
          JSON.stringify(normalizedScopedValues)
        );
      }
    } catch {
      // Ignore storage failures; runtime settings still apply for this launch.
    }
  }, [commandSnippetScopedValues]);

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
    if (!systemApi?.onRemoteOpenFileEvent) {
      return;
    }
    const stopListening = systemApi.onRemoteOpenFileEvent((event: RemoteOpenFileAutoSyncEvent) => {
      setRemoteOpenFileIssuesByTab((prev) => ({
        ...prev,
        [event.tabId]: event
      }));
      const tabTitle =
        terminalTabsRef.current.find((tab) => tab.id === event.tabId)?.title?.trim() ?? "";
      const hintMessage =
        event.tabId === activeTabIdRef.current || !tabTitle
          ? event.message
          : `${tabTitle}: ${event.message}`;
      pushAppHintMessage(hintMessage, {
        level: "warn",
        durationMs: 5200
      });
      writeAppLog(
        "warn",
        "renderer:remote-open-file",
        "Remote open file auto-sync needs user attention.",
        event
      );
    });
    return () => {
      stopListening();
    };
  }, [pushAppHintMessage, systemApi, writeAppLog]);

  useEffect(() => {
    writeAppLog("info", "renderer:lifecycle", "Renderer initialized.");
  }, [writeAppLog]);

  useEffect(() => {
    const smokeWindow = window as typeof window & {
      __termdockSmokeSetGlobalError?: (message: string | null) => void;
    };
    smokeWindow.__termdockSmokeSetGlobalError = (message) => {
      const normalizedMessage = typeof message === "string" ? message.trim() : "";
      setError(normalizedMessage.length > 0 ? normalizedMessage : null);
    };
    return () => {
      delete smokeWindow.__termdockSmokeSetGlobalError;
    };
  }, []);

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
        setPortForwardStatusMessageForTab(activeTabId, message);
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
    setPortForwardStatusMessageForTab,
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
    if (uploadQueueRetryTimerRef.current !== null) {
      window.clearTimeout(uploadQueueRetryTimerRef.current);
      uploadQueueRetryTimerRef.current = null;
    }
    connectedTabIdsRef.current.clear();
    autoRestoredPortForwardTabsRef.current.clear();
    intentionalTabCloseIdsRef.current.clear();
    pendingStartupCommandsByTabRef.current.clear();
    ensuredRemoteDirectoriesRef.current.clear();
    ensuringRemoteDirectoriesRef.current.clear();
    readyUploadDirectoriesRef.current.clear();
    warmingUploadDirectoriesRef.current.clear();
    runningUploadCountsByTabRef.current.clear();
    adaptiveUploadConcurrencyByTabRef.current.clear();
    adaptiveUploadConcurrencyRecoveryByTabRef.current.clear();
    disconnectReportFingerprintByTabRef.current.clear();
    setPortForwardRecordsByTab({});
    setPortForwardStatusMessagesByTab({});
    setPausedUploadTabs({});
    setPausedDownloadTabs({});
    setSchedulePausedUploadTabs({});
    setSchedulePausedDownloadTabs({});
  }, [terminalApi]);

  useEffect(
    () => () => {
      if (uploadQueueRetryTimerRef.current !== null) {
        window.clearTimeout(uploadQueueRetryTimerRef.current);
        uploadQueueRetryTimerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (!terminalApi) {
      return;
    }

    const stopListening = terminalApi.onEvent((event) => {
      if (event.type === "status") {
        if (event.status === "connected") {
          intentionalTabCloseIdsRef.current.delete(event.tabId);
          connectedTabIdsRef.current.add(event.tabId);
          clearDisconnectReportFingerprintsForTabIds([event.tabId]);
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
          readyUploadDirectoriesRef.current.delete(event.tabId);
          warmingUploadDirectoriesRef.current.delete(event.tabId);
          runningUploadCountsByTabRef.current.delete(event.tabId);
          adaptiveUploadConcurrencyByTabRef.current.delete(event.tabId);
          adaptiveUploadConcurrencyRecoveryByTabRef.current.delete(event.tabId);
          clearPortForwardTabState(event.tabId);
          resetServerHealth({
            tabId: event.tabId,
            message: "Terminal tab is reconnecting..."
          });
          resetServerProcesses({
            tabId: event.tabId,
            message: "Terminal tab is reconnecting..."
          });
          writeAppLog("info", "renderer:terminal", "Terminal tab connecting.", {
            tabId: event.tabId,
            status: event.status
          });
        } else {
          const expectedClose = intentionalTabCloseIdsRef.current.has(event.tabId);
          connectedTabIdsRef.current.delete(event.tabId);
          autoRestoredPortForwardTabsRef.current.delete(event.tabId);
          ensuredRemoteDirectoriesRef.current.delete(event.tabId);
          ensuringRemoteDirectoriesRef.current.delete(event.tabId);
          readyUploadDirectoriesRef.current.delete(event.tabId);
          warmingUploadDirectoriesRef.current.delete(event.tabId);
          runningUploadCountsByTabRef.current.delete(event.tabId);
          adaptiveUploadConcurrencyByTabRef.current.delete(event.tabId);
          adaptiveUploadConcurrencyRecoveryByTabRef.current.delete(event.tabId);
          clearPortForwardTabState(event.tabId);
          if (expectedClose) {
            removeServerMonitorTabState(event.tabId);
          } else {
            resetServerHealth({
              tabId: event.tabId,
              message: "Terminal tab is not connected."
            });
            resetServerProcesses({
              tabId: event.tabId,
              message: "Terminal tab is not connected."
            });
          }
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
        }
      }
      if (event.type === "error") {
        const expectedClose = intentionalTabCloseIdsRef.current.has(event.tabId);
        connectedTabIdsRef.current.delete(event.tabId);
        autoRestoredPortForwardTabsRef.current.delete(event.tabId);
        ensuredRemoteDirectoriesRef.current.delete(event.tabId);
        ensuringRemoteDirectoriesRef.current.delete(event.tabId);
        readyUploadDirectoriesRef.current.delete(event.tabId);
        warmingUploadDirectoriesRef.current.delete(event.tabId);
        runningUploadCountsByTabRef.current.delete(event.tabId);
        adaptiveUploadConcurrencyByTabRef.current.delete(event.tabId);
        adaptiveUploadConcurrencyRecoveryByTabRef.current.delete(event.tabId);
        clearPortForwardTabState(event.tabId);
        if (expectedClose) {
          removeServerMonitorTabState(event.tabId);
        } else {
          resetServerHealth({
            tabId: event.tabId,
            message: event.message
          });
          resetServerProcesses({
            tabId: event.tabId,
            message: event.message
          });
        }
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
    clearDisconnectReportFingerprintsForTabIds,
    clearPortForwardTabState,
    drainDownloadQueue,
    drainUploadQueue,
    isServerHealthDetailOpen,
    loadSftpDirectory,
    removeServerMonitorTabState,
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
        event.message &&
        !isTransferCanceledMessage(event.message)
      ) {
        setSftpError(event.message, event.tabId);
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

  const resetSessionTemplateDraft = useCallback(() => {
    setEditingSessionTemplateId(null);
    setSessionTemplateDraft(createEmptySessionTemplateDraft());
    setSessionTemplateError(null);
  }, []);

  const startSessionTemplateDraftFromForm = useCallback((sourceForm: SessionCreateInput) => {
    setEditingSessionTemplateId(null);
    setSessionTemplateDraft(createSessionTemplateDraftFromForm(sourceForm));
    setSessionTemplateError(null);
  }, []);

  const loadSessionTemplateForEditing = useCallback((template: SessionTemplateRecord) => {
    setEditingSessionTemplateId(template.id);
    setSessionTemplateDraft(toSessionTemplateDraftFromRecord(template));
    setSessionTemplateError(null);
  }, []);

  const openSessionTemplateManager = useCallback(
    (options?: {
      templateId?: string | null;
      sourceForm?: SessionCreateInput;
    }) => {
      const nextTemplateId = options?.templateId?.trim() || null;
      if (nextTemplateId) {
        const existing = sessionTemplates.find((template) => template.id === nextTemplateId);
        if (existing) {
          loadSessionTemplateForEditing(existing);
        } else if (options?.sourceForm) {
          startSessionTemplateDraftFromForm(options.sourceForm);
        } else {
          resetSessionTemplateDraft();
        }
      } else if (options?.sourceForm) {
        startSessionTemplateDraftFromForm(options.sourceForm);
      } else if (sessionTemplates.length > 0) {
        loadSessionTemplateForEditing(sessionTemplates[0]);
      } else {
        resetSessionTemplateDraft();
      }
      setIsSessionTemplateManagerOpen(true);
    },
    [
      loadSessionTemplateForEditing,
      resetSessionTemplateDraft,
      sessionTemplates,
      startSessionTemplateDraftFromForm
    ]
  );

  const closeSessionTemplateManager = useCallback(() => {
    setIsSessionTemplateManagerOpen(false);
    setSessionTemplateError(null);
  }, []);

  const addSessionTemplateEnvVar = useCallback(() => {
    setSessionTemplateDraft((prev) => {
      if (prev.envVars.length >= MAX_SESSION_TEMPLATE_ENV_VARS) {
        return prev;
      }
      return {
        ...prev,
        envVars: [
          ...prev.envVars,
          {
            id: createClientSideId("stv"),
            key: "",
            value: ""
          }
        ]
      };
    });
    setSessionTemplateError(null);
  }, []);

  const updateSessionTemplateEnvVar = useCallback(
    (envVarId: string, patch: Partial<Pick<SessionTemplateEnvVar, "key" | "value">>) => {
      setSessionTemplateDraft((prev) => ({
        ...prev,
        envVars: prev.envVars.map((envVar) =>
          envVar.id === envVarId
            ? {
                ...envVar,
                key: patch.key ?? envVar.key,
                value: patch.value ?? envVar.value
              }
            : envVar
        )
      }));
      setSessionTemplateError(null);
    },
    []
  );

  const removeSessionTemplateEnvVar = useCallback((envVarId: string) => {
    setSessionTemplateDraft((prev) => ({
      ...prev,
      envVars: prev.envVars.filter((envVar) => envVar.id !== envVarId)
    }));
    setSessionTemplateError(null);
  }, []);

  const validateSessionTemplateDraft = useCallback(
    (draft: SessionTemplateDraft): SessionTemplateDraft => {
      const normalized = normalizeSessionTemplateDraft(draft);
      if (!normalized.templateName) {
        throw new Error("Template name is required.");
      }
      const envKeyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
      const seenKeys = new Set<string>();
      for (const envVar of normalized.envVars) {
        if (!envVar.key) {
          throw new Error("Template env var name is required.");
        }
        if (!envKeyPattern.test(envVar.key)) {
          throw new Error(
            `Invalid env var "${envVar.key}". Use letters, numbers, and underscores, and do not start with a number.`
          );
        }
        const normalizedKey = envVar.key.toLowerCase();
        if (seenKeys.has(normalizedKey)) {
          throw new Error(`Duplicate env var "${envVar.key}" in this template.`);
        }
        seenKeys.add(normalizedKey);
      }
      const conflictingTemplate = sessionTemplates.find(
        (template) =>
          template.id !== editingSessionTemplateId &&
          template.templateName.trim().toLowerCase() === normalized.templateName.toLowerCase()
      );
      if (conflictingTemplate) {
        throw new Error(`Template "${normalized.templateName}" already exists.`);
      }
      return normalized;
    },
    [editingSessionTemplateId, sessionTemplates]
  );

  const saveSessionTemplateDraft = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      try {
        const normalizedDraft = validateSessionTemplateDraft(sessionTemplateDraft);
        const now = Date.now();
        const nextRecord: SessionTemplateRecord = {
          id: editingSessionTemplateId ?? createClientSideId("st"),
          createdAt: editingSessionTemplate?.createdAt ?? now,
          updatedAt: now,
          ...normalizedDraft
        };
        setSessionTemplates((prev) => {
          const next =
            editingSessionTemplateId === null
              ? [nextRecord, ...prev]
              : prev.map((template) =>
                  template.id === editingSessionTemplateId ? nextRecord : template
                );
          return normalizeSessionTemplates(next);
        });
        setEditingSessionTemplateId(nextRecord.id);
        setSessionTemplateDraft(toSessionTemplateDraftFromRecord(nextRecord));
        setSessionTemplateError(null);
      } catch (caughtError) {
        setSessionTemplateError((caughtError as Error).message);
      }
    },
    [
      editingSessionTemplate,
      editingSessionTemplateId,
      sessionTemplateDraft,
      validateSessionTemplateDraft
    ]
  );

  const deleteEditingSessionTemplate = useCallback(async () => {
    if (!editingSessionTemplate) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Delete session template "${editingSessionTemplate.templateName}"?`,
      {
        title: "Delete Session Template",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    setSessionTemplates((prev) => prev.filter((template) => template.id !== editingSessionTemplate.id));
    const remaining = sessionTemplates.filter((template) => template.id !== editingSessionTemplate.id);
    if (remaining.length > 0) {
      loadSessionTemplateForEditing(remaining[0]);
    } else {
      resetSessionTemplateDraft();
    }
  }, [
    editingSessionTemplate,
    loadSessionTemplateForEditing,
    resetSessionTemplateDraft,
    sessionTemplates,
    showAppConfirm
  ]);

  const applySessionTemplateToForm = useCallback(
    async (
      template: SessionTemplateRecord,
      options?: {
        openCreateModal?: boolean;
        groupId?: string;
        forceNewSession?: boolean;
      }
    ) => {
      try {
        const resolved = resolveSessionTemplateToForm(template);
        const nextGroupId = options?.groupId?.trim();
        setForm({
          ...resolved,
          groupId: nextGroupId && nextGroupId.length > 0 ? nextGroupId : resolved.groupId ?? ""
        });
        if (options?.forceNewSession) {
          setEditingSessionId(null);
        }
        setTestConnectionResult(null);
        setError(null);
        if (options?.openCreateModal) {
          setIsCreateModalOpen(true);
        }
        setIsSessionTemplateManagerOpen(false);
      } catch (caughtError) {
        await showAppAlert((caughtError as Error).message, {
          title: "Session Template"
        });
      }
    },
    [showAppAlert]
  );

  const chooseSessionTemplateAndApply = useCallback(
    async (options?: { openCreateModal?: boolean; groupId?: string; forceNewSession?: boolean }) => {
      if (sessionTemplates.length === 0) {
        await showAppAlert("No session templates available. Create one first.", {
          title: "Session Templates"
        });
        return;
      }
      const selectedTemplateId = await showAppChoice(
        "Choose session template.",
        sessionTemplates.map((template) => ({
          value: template.id,
          label: `${template.templateName}  (${template.host || "host pending"})`
        })),
        {
          title: "Session Templates",
          cancelLabel: "Cancel"
        }
      );
      if (!selectedTemplateId) {
        return;
      }
      const selectedTemplate =
        sessionTemplates.find((template) => template.id === selectedTemplateId) ?? null;
      if (!selectedTemplate) {
        return;
      }
      await applySessionTemplateToForm(selectedTemplate, options);
    },
    [applySessionTemplateToForm, sessionTemplates, showAppAlert, showAppChoice]
  );

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

  const importParsedSshConfigSessions = useCallback(async (parsed: SshConfigParseResult) => {
    let operationJobId: string | null = null;
    try {
      if (!sessionsApi) {
        throw new Error("Session bridge unavailable. Restart `pnpm dev`.");
      }
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

      const existingConnectionKeys = new Set(
        sessions.map((session) =>
          buildSessionConnectionKey(session.host, session.port, session.username)
        )
      );
      const previewStats = buildSshConfigImportPreviewStats(parsed, existingConnectionKeys);
      const targetGroupInput = await showAppPrompt(
        "Set target group for imported sessions. Leave empty for Ungrouped.",
        activeSessionGroup?.groupName ?? "",
        {
          title: "SSH Config Import",
          confirmLabel: previewStats.duplicateCount > 0 ? "Choose Duplicates" : "Review Import",
          multiline: false
        }
      );
      if (targetGroupInput === null) {
        return;
      }
      const targetGroup = targetGroupInput.trim();
      const targetRemarkPrefix = `Imported from ${parsed.filePath}`;

      let duplicateStrategy: "skip" | "overwrite" | "rename" = "skip";
      const dialogLanguage = appLanguageRef.current;
      if (previewStats.duplicateCount > 0) {
        const selectedStrategy = await showAppChoice(
          `Found ${previewStats.duplicateCount} duplicate connection target(s). Choose how to handle duplicates.`,
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
            cancelLabel: "Cancel",
            detailText: formatSshConfigImportPlan(
              parsed,
              previewStats,
              targetGroup,
              "skip",
              dialogLanguage
            )
          }
        );
        if (!selectedStrategy) {
          return;
        }
        duplicateStrategy = selectedStrategy as "skip" | "overwrite" | "rename";
      }

      const confirmed = await showAppConfirm(
        `Import ${parsed.candidates.length} host entr${
          parsed.candidates.length === 1 ? "y" : "ies"
        } from ${getPathBaseName(parsed.filePath)}?`,
        {
          title: "SSH Config Preview",
          confirmLabel: "Import",
          cancelLabel: "Cancel",
          detailText: formatSshConfigImportPlan(
            parsed,
            previewStats,
            targetGroup,
            duplicateStrategy,
            dialogLanguage
          )
        }
      );
      if (!confirmed) {
        return;
      }

      operationJobId = startOperationCenterAppJob({
        category: "sessions",
        title: "SSH Config Import",
        description: `Importing ${parsed.candidates.length} host entr${
          parsed.candidates.length === 1 ? "y" : "ies"
        } from SSH config.`
      });

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
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "succeeded", {
          detail: `Created ${createdCount}, updated ${updatedCount}, skipped ${skippedCount}, failed ${failedCount}, warnings ${parsed.warnings.length}.`
        });
      }
      await showAppAlert(
        `Import completed.\nCreated: ${createdCount}\nUpdated: ${updatedCount}\nSkipped: ${skippedCount}\nFailed: ${failedCount}\nWarnings: ${parsed.warnings.length}`,
        {
          title: "SSH Config Import"
        }
      );
      if (firstImportedSessionId && (createdCount > 0 || updatedCount > 0)) {
        const nextAction = await showAppChoice(
          "Open the first imported session now?",
          [
            {
              value: "open",
              label: "Open First Imported"
            },
            {
              value: "done",
              label: "Done"
            }
          ],
          {
            title: "SSH Config Import",
            cancelLabel: "Done"
          }
        );
        if (nextAction === "open") {
          setPendingOpenImportedSessionId(firstImportedSessionId);
        }
      }
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "failed", {
          detail: message
        });
      }
      setError(message);
      writeAppLog("error", "renderer:sessions", "SSH config import failed.", caughtError);
    }
  }, [
    activeSessionGroup?.groupName,
    finishOperationCenterAppJob,
    sessions,
    sessionsApi,
    showAppAlert,
    showAppChoice,
    showAppConfirm,
    showAppPrompt,
    startOperationCenterAppJob,
    writeAppLog
  ]);

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
      await importParsedSshConfigSessions(parsed);
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(message);
      writeAppLog("error", "renderer:sessions", "SSH config import failed.", caughtError);
    }
  }, [importParsedSshConfigSessions, sessionsApi, systemApi, writeAppLog]);

  smokeImportSshConfigHandlerRef.current = () => {
    const smokeWindow = window as typeof window & {
      __termdockSmokeSshConfigResult?: SshConfigParseResult;
    };
    const parsed = smokeWindow.__termdockSmokeSshConfigResult;
    if (parsed) {
      void importParsedSshConfigSessions(parsed);
      return;
    }
    void importSessionsFromSshConfig();
  };

  smokeImportSessionsJsonHandlerRef.current = () => {
    void importSessionsFromJson();
  };

  smokeImportEncryptedMigrationHandlerRef.current = () => {
    void importEncryptedSessionMigration();
  };

  const consumeSmokePickedTextFile = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const smokeWindow = window as typeof window & {
      __termdockSmokePickedTextFile?: {
        filePath?: string | null;
        text?: string | null;
      } | null;
    };
    const selected = smokeWindow.__termdockSmokePickedTextFile;
    if (!selected || typeof selected.filePath !== "string" || !selected.filePath.trim()) {
      return null;
    }
    smokeWindow.__termdockSmokePickedTextFile = null;
    return {
      canceled: false,
      filePath: selected.filePath,
      text: typeof selected.text === "string" ? selected.text : ""
    };
  }, []);

  const isSmokeMigrationSentinel = useCallback((value: string) => value === "__TERMDOCK_SMOKE_MIGRATION__", []);

  const buildSmokeSessionMigrationImportResult = useCallback(
    (): { payload: SessionMigrationPlainPayload; warnings: string[] } => ({
      payload: {
        exportedAtIso: new Date().toISOString(),
        appVersion: "smoke",
        sessionCount: 2,
        includesPasswords: true,
        includesPrivateKeyFiles: false,
        sessions: [
          {
            name: "smoke-group-session",
            host: "127.0.0.1",
            port: 59999,
            username: "smoke",
            authType: "password",
            privateKeyPath: "",
            groupId: "smoke-group",
            remark: "smoke migration preview",
            favorite: false,
            secret: "smoke-restored-password"
          },
          {
            name: "smoke-ungrouped-session",
            host: "127.0.0.1",
            port: 59999,
            username: "smoke",
            authType: "password",
            privateKeyPath: "",
            groupId: "",
            remark: "smoke migration preview",
            favorite: false,
            secret: "smoke-restored-password"
          }
        ]
      },
      warnings: []
    }),
    []
  );

  const importSessionsFromJson = useCallback(async () => {
    let operationJobId: string | null = null;
    try {
      if (!sessionsApi) {
        throw new Error("Session bridge unavailable. Restart `pnpm dev`.");
      }
      const smokeSelected = consumeSmokePickedTextFile();
      if (!systemApi?.pickAndReadTextFile && !smokeSelected) {
        throw new Error("System bridge unavailable. Restart `pnpm dev`.");
      }
      const selected =
        smokeSelected ??
        (await systemApi!.pickAndReadTextFile({
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
        }));
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
        detailText: formatSessionJsonImportPreview(parsedImport, appLanguageRef.current),
        translateDetailText: true
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

      operationJobId = startOperationCenterAppJob({
        category: "sessions",
        title: "Sessions JSON Import",
        description: `Importing ${parsedImport.candidates.length} session${
          parsedImport.candidates.length === 1 ? "" : "s"
        } from JSON.`
      });

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
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "succeeded", {
          detail: `Created ${createdCount}, updated ${updatedCount}, skipped ${skippedCount}, failed ${failedCount}, warnings ${parsedImport.warnings.length}.`
        });
      }
      await showAppAlert(
        `Import completed.\nCreated: ${createdCount}\nUpdated: ${updatedCount}\nSkipped: ${skippedCount}\nFailed: ${failedCount}\nWarnings: ${parsedImport.warnings.length}`,
        {
          title: "Import Sessions JSON"
        }
      );
      if (firstImportedSessionId && (createdCount > 0 || updatedCount > 0)) {
        const nextAction = await showAppChoice(
          "Open the first imported session now?",
          [
            {
              value: "open",
              label: "Open First Imported"
            },
            {
              value: "done",
              label: "Done"
            }
          ],
          {
            title: "Import Sessions JSON",
            cancelLabel: "Done"
          }
        );
        if (nextAction === "open") {
          setPendingOpenImportedSessionId(firstImportedSessionId);
        }
      }
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "failed", {
          detail: message
        });
      }
      setError(message);
      writeAppLog("error", "renderer:sessions", "Session JSON import failed.", caughtError);
    }
  }, [
    activeSessionGroup?.groupName,
    consumeSmokePickedTextFile,
    finishOperationCenterAppJob,
    sessions,
    sessionsApi,
    showAppAlert,
    showAppChoice,
    showAppConfirm,
    startOperationCenterAppJob,
    systemApi,
    writeAppLog
  ]);

  const exportEncryptedSessionMigration = useCallback(async () => {
    let operationJobId: string | null = null;
    try {
      if (!sessionsApi) {
        throw new Error("Session bridge unavailable. Restart `pnpm dev`.");
      }
      if (!systemApi?.saveTextFile) {
        throw new Error("System bridge unavailable. Restart `pnpm dev`.");
      }
      if (sessions.length === 0) {
        await showAppAlert("No sessions available to export.", {
          title: "Encrypted Migration Export"
        });
        return;
      }
      const passphrase = await showAppPrompt(
        "Enter a migration passphrase. You will need it to import this file.",
        "",
        {
          title: "Encrypted Migration Export",
          confirmLabel: "Continue",
          inputType: "password"
        }
      );
      if (passphrase === null) {
        return;
      }
      if (passphrase.length < 8) {
        await showAppAlert("Migration passphrase must be at least 8 characters.", {
          title: "Encrypted Migration Export"
        });
        return;
      }
      const confirmPassphrase = await showAppPrompt("Confirm migration passphrase.", "", {
        title: "Encrypted Migration Export",
        confirmLabel: "Export",
        inputType: "password"
      });
      if (confirmPassphrase === null) {
        return;
      }
      if (confirmPassphrase !== passphrase) {
        await showAppAlert("Passphrases do not match.", {
          title: "Encrypted Migration Export"
        });
        return;
      }
      const includeKeyFiles = await showAppConfirm(
        "Include private key file contents in the encrypted migration file?",
        {
          title: "Encrypted Migration Export",
          confirmLabel: "Include Keys",
          cancelLabel: "Paths Only",
          detailText:
            "Including private key files makes migration work on another computer, but anyone with this file and passphrase can use those keys. Passwords and private-key passphrases are always encrypted in this migration file."
        }
      );
      operationJobId = startOperationCenterAppJob({
        category: "sessions",
        title: "Encrypted Migration Export",
        description: `Encrypting ${sessions.length} session${sessions.length === 1 ? "" : "s"} for migration.`
      });
      const result = await sessionsApi.exportEncryptedMigration({
        passphrase,
        appVersion: APP_VERSION,
        includePrivateKeyFiles: includeKeyFiles
      });
      const exportText = `${JSON.stringify(result.file, null, 2)}\n`;
      const generatedAtIso = result.file.exportedAtIso;
      const saved = await systemApi.saveTextFile({
        title: "Export Encrypted Migration",
        defaultFileName: `termdock-session-migration-${generatedAtIso.replace(/[:]/g, "-")}.tdmigration`,
        text: exportText,
        filters: [
          {
            name: "TermDock Migration",
            extensions: ["tdmigration", "json"]
          }
        ]
      });
      if (saved.canceled || !saved.outputPath) {
        if (operationJobId) {
          removeOperationCenterAppJob(operationJobId);
        }
        return;
      }
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "succeeded", {
          detail: `Encrypted ${result.file.summary.sessionCount} session${result.file.summary.sessionCount === 1 ? "" : "s"} with ${result.file.summary.passwordSecretCount} password secret(s), ${result.file.summary.privateKeySecretCount} private-key passphrase(s), and ${result.file.summary.embeddedPrivateKeyFileCount} embedded private key file(s).`,
          outputPath: saved.outputPath
        });
      }
      const copiedPath = await copyTextToClipboard(saved.outputPath);
      const warningText =
        result.warnings.length > 0 ? `\n\nWarnings:\n${result.warnings.join("\n")}` : "";
      await showAppAlert(
        copiedPath
          ? `Encrypted migration exported.\nPath copied to clipboard:\n${saved.outputPath}${warningText}`
          : `Encrypted migration exported:\n${saved.outputPath}${warningText}`,
        {
          title: "Encrypted Migration Export"
        }
      );
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "failed", {
          detail: message
        });
      }
      setError(message);
      writeAppLog("error", "renderer:sessions", "Failed to export encrypted migration.", caughtError);
    }
  }, [
    finishOperationCenterAppJob,
    removeOperationCenterAppJob,
    sessions.length,
    sessionsApi,
    showAppAlert,
    showAppConfirm,
    showAppPrompt,
    startOperationCenterAppJob,
    systemApi,
    writeAppLog
  ]);

  const importEncryptedSessionMigration = useCallback(async () => {
    let operationJobId: string | null = null;
    try {
      if (!sessionsApi) {
        throw new Error("Session bridge unavailable. Restart `pnpm dev`.");
      }
      const smokeSelected = consumeSmokePickedTextFile();
      if (!systemApi?.pickAndReadTextFile && !smokeSelected) {
        throw new Error("System bridge unavailable. Restart `pnpm dev`.");
      }
      const selected =
        smokeSelected ??
        (await systemApi!.pickAndReadTextFile({
          title: "Import Encrypted Migration",
          buttonLabel: "Import",
          filters: [
            {
              name: "TermDock Migration",
              extensions: ["tdmigration", "json"]
            },
            {
              name: "All Files",
              extensions: ["*"]
            }
          ]
        }));
      if (selected.canceled || !selected.filePath) {
        return;
      }
      const passphrase = await showAppPrompt("Enter the migration passphrase.", "", {
        title: "Import Encrypted Migration",
        confirmLabel: "Decrypt",
        inputType: "password"
      });
      if (passphrase === null) {
        return;
      }
      operationJobId = startOperationCenterAppJob({
        category: "sessions",
        title: "Encrypted Migration Import",
        description: `Decrypting ${getPathBaseName(selected.filePath)}.`
      });
      const decrypted = isSmokeMigrationSentinel(selected.text)
        ? buildSmokeSessionMigrationImportResult()
        : await sessionsApi.importEncryptedMigration({
            passphrase,
            fileText: selected.text,
            restorePrivateKeyFiles: false
          });
      const parsedImport = buildSessionMigrationImportResult(
        decrypted.payload,
        decrypted.warnings
      );
      if (parsedImport.candidates.length === 0) {
        await showAppAlert("No importable sessions found in this migration file.", {
          title: "Import Encrypted Migration"
        });
        if (operationJobId) {
          removeOperationCenterAppJob(operationJobId);
        }
        return;
      }
      await showAppAlert("Review decrypted sessions before import.", {
        title: "Encrypted Migration Preview",
        confirmLabel: "Continue",
        detailText: formatSessionMigrationImportPreview(parsedImport),
        translateDetailText: true
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
        if (operationJobId) {
          removeOperationCenterAppJob(operationJobId);
        }
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
          if (operationJobId) {
            removeOperationCenterAppJob(operationJobId);
          }
          return;
        }
        duplicateStrategy = choice as "skip" | "overwrite" | "rename";
      }
      const confirmed = await showAppConfirm(
        `Import ${parsedImport.candidates.length} session(s) from encrypted migration?\nGroup strategy: ${groupMode}\nDuplicate strategy: ${duplicateStrategy}`,
        {
          title: "Import Encrypted Migration",
          confirmLabel: "Import",
          cancelLabel: "Cancel"
        }
      );
      if (!confirmed) {
        if (operationJobId) {
          removeOperationCenterAppJob(operationJobId);
        }
        return;
      }
      const restoredImport = isSmokeMigrationSentinel(selected.text)
        ? buildSmokeSessionMigrationImportResult()
        : await sessionsApi.importEncryptedMigration({
            passphrase,
            fileText: selected.text,
            restorePrivateKeyFiles: true
          });
      const finalImport = buildSessionMigrationImportResult(restoredImport.payload, [
        ...parsedImport.warnings,
        ...restoredImport.warnings
      ]);

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
      let restoredSecretCount = 0;
      let firstImportedSessionId: string | null = null;
      const sourceRemarkPrefix = `Imported encrypted migration: ${selected.filePath}`;

      for (const candidate of finalImport.candidates) {
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
              favorite: candidate.favorite,
              secret: candidate.secret
            });
            updatedCount += 1;
            if (candidate.secret) {
              restoredSecretCount += 1;
            }
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
            secret: candidate.secret
          });
          createdCount += 1;
          if (candidate.secret) {
            restoredSecretCount += 1;
          }
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
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "succeeded", {
          detail: `Created ${createdCount}, updated ${updatedCount}, skipped ${skippedCount}, failed ${failedCount}, restored secrets ${restoredSecretCount}, warnings ${finalImport.warnings.length}.`
        });
      }
      await showAppAlert(
        `Import completed.\nCreated: ${createdCount}\nUpdated: ${updatedCount}\nSkipped: ${skippedCount}\nFailed: ${failedCount}\nRestored secrets: ${restoredSecretCount}\nWarnings: ${finalImport.warnings.length}`,
        {
          title: "Import Encrypted Migration"
        }
      );
      if (firstImportedSessionId && (createdCount > 0 || updatedCount > 0)) {
        const nextAction = await showAppChoice(
          "Open the first imported session now?",
          [
            {
              value: "open",
              label: "Open First Imported"
            },
            {
              value: "done",
              label: "Done"
            }
          ],
          {
            title: "Import Encrypted Migration",
            cancelLabel: "Done"
          }
        );
        if (nextAction === "open") {
          setPendingOpenImportedSessionId(firstImportedSessionId);
        }
      }
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "failed", {
          detail: message
        });
      }
      setError(message);
      writeAppLog("error", "renderer:sessions", "Failed to import encrypted migration.", caughtError);
    }
  }, [
    activeSessionGroup?.groupName,
    consumeSmokePickedTextFile,
    finishOperationCenterAppJob,
    buildSmokeSessionMigrationImportResult,
    removeOperationCenterAppJob,
    sessions,
    sessionsApi,
    isSmokeMigrationSentinel,
    showAppAlert,
    showAppChoice,
    showAppConfirm,
    showAppPrompt,
    startOperationCenterAppJob,
    systemApi,
    writeAppLog
  ]);

  useEffect(() => {
    const smokeWindow = window as typeof window & {
      __termdockSmokeImportSshConfig?: () => void;
      __termdockSmokeSshConfigResult?: SshConfigParseResult;
      __termdockSmokeImportSessionsJson?: () => void;
      __termdockSmokeImportEncryptedMigration?: () => void;
    };
    smokeWindow.__termdockSmokeImportSshConfig = () => {
      smokeImportSshConfigHandlerRef.current?.();
    };
    smokeWindow.__termdockSmokeImportSessionsJson = () => {
      smokeImportSessionsJsonHandlerRef.current?.();
    };
    smokeWindow.__termdockSmokeImportEncryptedMigration = () => {
      smokeImportEncryptedMigrationHandlerRef.current?.();
    };
    return () => {
      delete smokeWindow.__termdockSmokeImportSshConfig;
      delete smokeWindow.__termdockSmokeImportSessionsJson;
      delete smokeWindow.__termdockSmokeImportEncryptedMigration;
    };
  }, []);

  const exportAllSessionsWithGroups = useCallback(async () => {
    let operationJobId: string | null = null;
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
      operationJobId = startOperationCenterAppJob({
        category: "sessions",
        title: "Sessions Export",
        description: `Exporting ${sessionRows.length} session${sessionRows.length === 1 ? "" : "s"} across ${groups.length} group entr${groups.length === 1 ? "y" : "ies"}.`
      });
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
          if (operationJobId) {
            finishOperationCenterAppJob(operationJobId, "succeeded", {
              detail: `Exported ${sessionRows.length} session${sessionRows.length === 1 ? "" : "s"} across ${groups.length} group entr${groups.length === 1 ? "y" : "ies"}.`,
              outputPath: result.outputPath
            });
          }
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `Session export completed.\nPath copied to clipboard:\n${result.outputPath}`
              : `Session export completed:\n${result.outputPath}`,
            {
              title: "Session Export"
            }
          );
        } else if (operationJobId) {
          removeOperationCenterAppJob(operationJobId);
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "succeeded", {
          detail: copied
            ? `Exported ${sessionRows.length} session${sessionRows.length === 1 ? "" : "s"} to clipboard JSON.`
            : `Prepared session export JSON for manual copy (${sessionRows.length} session${sessionRows.length === 1 ? "" : "s"}).`
        });
      }
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
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "failed", {
          detail: message
        });
      }
      setError(message);
      writeAppLog("error", "renderer:sessions", "Failed to export all sessions.", caughtError);
    }
  }, [
    finishOperationCenterAppJob,
    removeOperationCenterAppJob,
    sessionGroupOptions,
    sessions,
    showAppAlert,
    startOperationCenterAppJob,
    systemApi,
    writeAppLog
  ]);

  const exportAllSessionGroups = useCallback(async () => {
    let operationJobId: string | null = null;
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
      operationJobId = startOperationCenterAppJob({
        category: "sessions",
        title: "Session Groups Export",
        description: `Exporting ${groupRows.length} group entr${groupRows.length === 1 ? "y" : "ies"}.`
      });
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
          if (operationJobId) {
            finishOperationCenterAppJob(operationJobId, "succeeded", {
              detail: `Exported ${groupRows.length} group entr${groupRows.length === 1 ? "y" : "ies"}.`,
              outputPath: result.outputPath
            });
          }
          const copiedPath = await copyTextToClipboard(result.outputPath);
          await showAppAlert(
            copiedPath
              ? `Group export completed.\nPath copied to clipboard:\n${result.outputPath}`
              : `Group export completed:\n${result.outputPath}`,
            {
              title: "Group Export"
            }
          );
        } else if (operationJobId) {
          removeOperationCenterAppJob(operationJobId);
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "succeeded", {
          detail: copied
            ? `Exported ${groupRows.length} group entr${groupRows.length === 1 ? "y" : "ies"} to clipboard JSON.`
            : `Prepared group export JSON for manual copy (${groupRows.length} group entr${groupRows.length === 1 ? "y" : "ies"}).`
        });
      }
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
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "failed", {
          detail: message
        });
      }
      setError(message);
      writeAppLog("error", "renderer:sessions", "Failed to export all groups.", caughtError);
    }
  }, [
    finishOperationCenterAppJob,
    removeOperationCenterAppJob,
    sessionGroupOptions,
    sessions,
    showAppAlert,
    startOperationCenterAppJob,
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
        message: formatSshConnectionError(caughtError)
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
      let executedCount = 0;
      for (const command of normalizedCommands) {
        const wrote = await guardedTerminalWrite(tabId, `${command}\n`, {
          source: "startupCommand",
          commandText: command
        });
        if (!wrote) {
          break;
        }
        executedCount += 1;
      }
      writeAppLog("info", "renderer:session-profile", "Executed startup commands on terminal tab.", {
        tabId,
        commandCount: executedCount,
        queuedCommandCount: normalizedCommands.length
      });
    },
    [guardedTerminalWrite, terminalApi, writeAppLog]
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
        forceNewTab?: boolean;
      }
    ): string | null => {
      if (!terminalApi) {
        setError("Terminal bridge unavailable. Restart `pnpm dev`.");
        return null;
      }
      const startupCommands = options?.startupCommands ?? [];
      const forceNewTab = options?.forceNewTab === true;
      const existingOpened = terminalTabsRef.current.find((tab) => tab.sessionId === session.id);
      if (!forceNewTab && existingOpened) {
        setActiveTabId(existingOpened.id);
        queueStartupCommandsForTab(existingOpened.id, startupCommands);
        return existingOpened.id;
      }

      const id = `${session.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      setTerminalTabs((prev) => {
        const existingTab = prev.find((tab) => tab.sessionId === session.id);
        if (!forceNewTab && existingTab) {
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

  useEffect(() => {
    if (!pendingOpenImportedSessionId) {
      return;
    }
    const session = sessions.find((entry) => entry.id === pendingOpenImportedSessionId);
    if (!session) {
      return;
    }
    setPendingOpenImportedSessionId(null);
    setSelectedSessionId(session.id);
    setSelectedSessionIds([session.id]);
    setActiveSessionGroupKey(session.groupId?.trim() || null);
    const tabId = openTerminalTab(session);
    if (tabId) {
      pushAppHintMessage(`Opening imported session: ${session.name}`, {
        level: "info",
        durationMs: 3600
      });
    }
  }, [openTerminalTab, pendingOpenImportedSessionId, pushAppHintMessage, sessions]);

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
    async (
      template: string,
      parameterValues?: Record<string, string>
    ): Promise<{
      rendered: string;
      unresolvedParameterKeys: string[];
    }> => {
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
      const unresolvedParameterKeys = new Set<string>();
      rendered = rendered.replaceAll(COMMAND_SNIPPET_PARAMETER_TOKEN_PATTERN, (_match, key) => {
        const parameterKey = typeof key === "string" ? key.trim() : "";
        if (
          parameterValues &&
          parameterKey &&
          Object.prototype.hasOwnProperty.call(parameterValues, parameterKey)
        ) {
          return parameterValues[parameterKey] ?? "";
        }
        if (parameterKey) {
          unresolvedParameterKeys.add(parameterKey);
        }
        return _match;
      });
      return {
        rendered: rendered.trim(),
        unresolvedParameterKeys: Array.from(unresolvedParameterKeys)
      };
    },
    [systemApi]
  );
  const applyCommandSnippetScopedValueUpdates = useCallback(
    (updates: Array<{ cacheKey: string; value: string }>) => {
      if (updates.length === 0) {
        return;
      }
      setCommandSnippetScopedValues((prev) => {
        const next: Record<string, CommandSnippetScopedValueRecord> = { ...prev };
        let offset = 0;
        for (const update of updates) {
          if (!update.cacheKey) {
            continue;
          }
          next[update.cacheKey] = {
            value: update.value,
            updatedAt: Date.now() + offset
          };
          offset += 1;
        }
        return normalizeCommandSnippetScopedValues(next);
      });
    },
    []
  );

  const collectCommandSnippetParameterValues = useCallback(
    async (
      snippet: CommandSnippetItem,
      parameters: CommandSnippetParameter[],
      groupId: string
    ): Promise<
      | {
          values: Record<string, string>;
          scopedValueUpdates: Array<{ cacheKey: string; value: string }>;
        }
      | null
    > => {
      if (parameters.length === 0) {
        return {
          values: {},
          scopedValueUpdates: []
        };
      }
      const activeTabId = activeTabIdRef.current;
      const activeTab = activeTabId
        ? terminalTabsRef.current.find((entry) => entry.id === activeTabId) ?? null
        : null;
      const sessionId = activeTab?.sessionId ?? "";
      const values: Record<string, string> = {};
      const scopedValueUpdates: Array<{ cacheKey: string; value: string }> = [];
      for (let index = 0; index < parameters.length; index += 1) {
        const parameter = parameters[index];
        const patternError = getCommandSnippetParameterPatternError(parameter.pattern);
        if (patternError) {
          await showAppAlert(
            `Snippet parameter "${parameter.label || parameter.key}" has an invalid regex pattern.\n${patternError}`,
            {
              title: "Run Snippet"
            }
          );
          return null;
        }
        const compiledPattern = parameter.pattern.trim() ? new RegExp(parameter.pattern.trim()) : null;
        const scopedValueCacheKey = buildCommandSnippetScopedValueCacheKey({
          scope: parameter.scope,
          key: parameter.key,
          snippetId: snippet.id,
          groupId,
          sessionId
        });
        const cachedValue = scopedValueCacheKey
          ? commandSnippetScopedValues[scopedValueCacheKey]?.value ?? null
          : null;
        while (true) {
          const input = await showAppPrompt(
            [
              `Provide a value for "${parameter.label || parameter.key}".`,
              parameter.required ? "This parameter is required." : "Leave blank to skip this parameter.",
              `Scope: ${formatCommandSnippetVariableScopeLabel(parameter.scope)}`,
              compiledPattern ? `Pattern: ${parameter.pattern.trim()}` : null
            ]
              .filter(Boolean)
              .join("\n"),
            cachedValue ?? parameter.defaultValue,
            {
              title: `Run Snippet: ${snippet.name}`,
              confirmLabel: index === parameters.length - 1 ? "Preview" : "Next"
            }
          );
          if (input === null) {
            return null;
          }
          if (parameter.required && !input.trim()) {
            await showAppAlert(`"${parameter.label || parameter.key}" cannot be empty.`, {
              title: "Run Snippet"
            });
            continue;
          }
          if (compiledPattern && input.trim() && !compiledPattern.test(input)) {
            await showAppAlert(
              `Value for "${parameter.label || parameter.key}" does not match:\n${parameter.pattern.trim()}`,
              {
                title: "Run Snippet"
              }
            );
            continue;
          }
          values[parameter.key] = input;
          if (scopedValueCacheKey) {
            scopedValueUpdates.push({
              cacheKey: scopedValueCacheKey,
              value: input
            });
          }
          break;
        }
      }
      return {
        values,
        scopedValueUpdates
      };
    },
    [commandSnippetScopedValues, showAppAlert, showAppPrompt]
  );

  const runCommandSnippet = useCallback(
    async (snippet: CommandSnippetItem, groupId = ""): Promise<void> => {
      if (!terminalApi) {
        setError("Terminal bridge unavailable. Restart `pnpm dev`.");
        return;
      }
      const tabId = activeTabIdRef.current;
      if (!tabId) {
        setError("Open and focus a terminal tab before running snippets.");
        return;
      }
      const promptSet =
        commandSnippetGroups.find((group) => group.id === groupId)?.promptSets.find(
          (entry) => entry.id === snippet.promptSetId
        ) ?? null;
      const effectiveParameters = mergeCommandSnippetParameters(snippet, promptSet);
      const parameterResult = await collectCommandSnippetParameterValues(
        snippet,
        effectiveParameters,
        groupId
      );
      if (parameterResult === null) {
        return;
      }
      const { rendered, unresolvedParameterKeys } = await renderCommandSnippetTemplate(
        snippet.template,
        parameterResult.values
      );
      if (unresolvedParameterKeys.length > 0) {
        await showAppAlert(
          `Snippet template references undefined parameter token(s): ${unresolvedParameterKeys.join(", ")}`,
          {
            title: "Run Snippet"
          }
        );
        return;
      }
      if (!rendered) {
        await showAppAlert("Snippet resolved to an empty command.", {
          title: "Run Snippet"
        });
        return;
      }
      if (snippet.confirmBeforeRun || snippet.previewBeforeRun || effectiveParameters.length > 0) {
        const confirmed = await showAppConfirm(
          snippet.confirmBeforeRun
            ? `Run snippet "${snippet.name}" on current tab?`
            : `Preview generated command for snippet "${snippet.name}".`,
          {
            title: snippet.confirmBeforeRun ? "Run Snippet" : "Snippet Preview",
            confirmLabel: "Run",
            cancelLabel: "Cancel",
            detailText: rendered
          }
        );
        if (!confirmed) {
          return;
        }
      }
      const wrote = await guardedTerminalWrite(tabId, `${rendered}\n`, {
        source: "snippet",
        commandText: rendered
      });
      if (!wrote) {
        return;
      }
      applyCommandSnippetScopedValueUpdates(parameterResult.scopedValueUpdates);
      upsertTerminalCommandHistoryCommand(rendered, {
        preferredTabId: tabId,
        source: "manual"
      });
    },
    [
      applyCommandSnippetScopedValueUpdates,
      commandSnippetGroups,
      collectCommandSnippetParameterValues,
      renderCommandSnippetTemplate,
      guardedTerminalWrite,
      showAppAlert,
      showAppConfirm,
      terminalApi,
      upsertTerminalCommandHistoryCommand
    ]
  );

  const importCommandSnippetGroups = useCallback(async () => {
    let operationJobId: string | null = null;
    try {
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
      operationJobId = startOperationCenterAppJob({
        category: "snippets",
        title: "Snippet Groups Import",
        description: `Importing ${imported.length} snippet group${imported.length === 1 ? "" : "s"}.`
      });
      setCommandSnippetGroups(imported);
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "succeeded", {
          detail: `Imported ${imported.length} group${imported.length === 1 ? "" : "s"} and ${imported.reduce((total, group) => total + group.snippets.length, 0)} snippet${imported.reduce((total, group) => total + group.snippets.length, 0) === 1 ? "" : "s"}.`
        });
      }
      await showAppAlert(
        `Imported ${imported.length} snippet group(s), ${imported.reduce(
          (total, group) => total + group.snippets.length,
          0
        )} snippet(s).`,
        {
          title: "Import Snippet Groups"
        }
      );
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "failed", {
          detail: message
        });
      }
      setError(message);
    }
  }, [finishOperationCenterAppJob, showAppAlert, startOperationCenterAppJob, systemApi]);

  const exportCommandSnippetGroups = useCallback(async () => {
    let operationJobId: string | null = null;
    try {
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
        snippetCount: commandSnippetGroups.reduce(
          (total, group) => total + group.snippets.length,
          0
        ),
        groups: commandSnippetGroups
      };
      const content = `${JSON.stringify(payload, null, 2)}\n`;
      operationJobId = startOperationCenterAppJob({
        category: "snippets",
        title: "Snippet Groups Export",
        description: `Exporting ${payload.groupCount} snippet group${payload.groupCount === 1 ? "" : "s"} and ${payload.snippetCount} snippet${payload.snippetCount === 1 ? "" : "s"}.`
      });
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Snippet Groups",
          defaultFileName: `termdock-snippet-groups-${new Date().toISOString().replace(/[:]/g, "-")}.json`,
          text: content,
          filters: [{ name: "JSON", extensions: ["json"] }]
        });
        if (!result.canceled && result.outputPath) {
          if (operationJobId) {
            finishOperationCenterAppJob(operationJobId, "succeeded", {
              detail: `Exported ${payload.groupCount} group${payload.groupCount === 1 ? "" : "s"} and ${payload.snippetCount} snippet${payload.snippetCount === 1 ? "" : "s"}.`,
              outputPath: result.outputPath
            });
          }
          await showAppAlert(`Snippet groups exported:\n${result.outputPath}`, {
            title: "Export Snippet Groups"
          });
        } else if (operationJobId) {
          removeOperationCenterAppJob(operationJobId);
        }
        return;
      }
      const copied = await copyTextToClipboard(content);
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "succeeded", {
          detail: copied
            ? `Exported ${payload.groupCount} group${payload.groupCount === 1 ? "" : "s"} to clipboard JSON.`
            : `Prepared snippet group export JSON for manual copy (${payload.groupCount} groups).`
        });
      }
      await showAppAlert(copied ? "Snippet groups JSON copied to clipboard." : content, {
        title: "Export Snippet Groups",
        detailText: copied ? undefined : content
      });
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "failed", {
          detail: message
        });
      }
      setError(message);
    }
  }, [
    commandSnippetGroups,
    finishOperationCenterAppJob,
    removeOperationCenterAppJob,
    showAppAlert,
    startOperationCenterAppJob,
    systemApi
  ]);

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
  const selectedCommandSnippetManagerPromptSet = useMemo(() => {
    if (!selectedCommandSnippetManagerGroup || !selectedCommandSnippetManagerSnippet?.promptSetId) {
      return null;
    }
    return (
      selectedCommandSnippetManagerGroup.promptSets.find(
        (promptSet) => promptSet.id === selectedCommandSnippetManagerSnippet.promptSetId
      ) ?? null
    );
  }, [selectedCommandSnippetManagerGroup, selectedCommandSnippetManagerSnippet]);
  const selectedCommandSnippetEffectiveParameters = useMemo(
    () =>
      mergeCommandSnippetParameters(
        selectedCommandSnippetManagerSnippet,
        selectedCommandSnippetManagerPromptSet
      ),
    [selectedCommandSnippetManagerPromptSet, selectedCommandSnippetManagerSnippet]
  );
  const selectedCommandSnippetTemplateParameterKeys = useMemo(
    () =>
      selectedCommandSnippetManagerSnippet
        ? listCommandSnippetTemplateParameterKeys(selectedCommandSnippetManagerSnippet.template)
        : [],
    [selectedCommandSnippetManagerSnippet]
  );
  const selectedCommandSnippetMissingParameterKeys = useMemo(() => {
    if (!selectedCommandSnippetManagerSnippet) {
      return [];
    }
    const definedKeys = new Set(
      selectedCommandSnippetEffectiveParameters.map((entry) => entry.key)
    );
    return selectedCommandSnippetTemplateParameterKeys.filter((key) => !definedKeys.has(key));
  }, [selectedCommandSnippetEffectiveParameters, selectedCommandSnippetManagerSnippet, selectedCommandSnippetTemplateParameterKeys]);
  const selectedCommandSnippetUnusedParameterKeys = useMemo(() => {
    if (!selectedCommandSnippetManagerSnippet) {
      return [];
    }
    const usedKeys = new Set(selectedCommandSnippetTemplateParameterKeys);
    return selectedCommandSnippetEffectiveParameters
      .map((entry) => entry.key)
      .filter((key) => !usedKeys.has(key));
  }, [selectedCommandSnippetEffectiveParameters, selectedCommandSnippetManagerSnippet, selectedCommandSnippetTemplateParameterKeys]);
  const selectedCommandSnippetShadowedPromptSetKeys = useMemo(() => {
    if (!selectedCommandSnippetManagerPromptSet || !selectedCommandSnippetManagerSnippet) {
      return [];
    }
    const snippetKeys = new Set(selectedCommandSnippetManagerSnippet.parameters.map((entry) => entry.key));
    return selectedCommandSnippetManagerPromptSet.parameters
      .map((entry) => entry.key)
      .filter((key) => snippetKeys.has(key));
  }, [selectedCommandSnippetManagerPromptSet, selectedCommandSnippetManagerSnippet]);
  const selectedCommandSnippetHasInvalidPattern = useMemo(
    () =>
      !!selectedCommandSnippetEffectiveParameters.some((parameter) =>
        Boolean(getCommandSnippetParameterPatternError(parameter.pattern))
      ),
    [selectedCommandSnippetEffectiveParameters]
  );
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
  const updateSelectedCommandSnippet = useCallback(
    (snippetId: string, updater: (snippet: CommandSnippetItem) => CommandSnippetItem) => {
      if (!selectedCommandSnippetManagerGroup) {
        return;
      }
      setCommandSnippetGroups((prev) =>
        prev.map((group) =>
          group.id === selectedCommandSnippetManagerGroup.id
            ? {
                ...group,
                snippets: group.snippets.map((snippet) =>
                  snippet.id === snippetId ? updater(snippet) : snippet
                )
              }
            : group
        )
      );
    },
    [selectedCommandSnippetManagerGroup]
  );
  const updateSelectedCommandSnippetPromptSet = useCallback(
    (promptSetId: string, updater: (promptSet: CommandSnippetPromptSet) => CommandSnippetPromptSet) => {
      if (!selectedCommandSnippetManagerGroup) {
        return;
      }
      setCommandSnippetGroups((prev) =>
        prev.map((group) =>
          group.id === selectedCommandSnippetManagerGroup.id
            ? {
                ...group,
                promptSets: group.promptSets.map((promptSet) =>
                  promptSet.id === promptSetId ? updater(promptSet) : promptSet
                )
              }
            : group
        )
      );
    },
    [selectedCommandSnippetManagerGroup]
  );
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
        promptSets: [],
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
      confirmBeforeRun: false,
      previewBeforeRun: false,
      promptSetId: "",
      parameters: []
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
      const normalizedName = nextName.slice(0, 80);
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        name: normalizedName
      }));
    },
    [updateSelectedCommandSnippet]
  );
  const updateCommandSnippetManagerSnippetTemplate = useCallback(
    (snippetId: string, nextTemplate: string) => {
      const normalizedTemplate = nextTemplate.slice(0, 4000);
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        template: normalizedTemplate
      }));
    },
    [updateSelectedCommandSnippet]
  );
  const updateCommandSnippetManagerSnippetConfirm = useCallback(
    (snippetId: string, nextConfirmBeforeRun: boolean) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        confirmBeforeRun: nextConfirmBeforeRun
      }));
    },
    [updateSelectedCommandSnippet]
  );
  const updateCommandSnippetManagerSnippetPreview = useCallback(
    (snippetId: string, nextPreviewBeforeRun: boolean) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        previewBeforeRun: nextPreviewBeforeRun
      }));
    },
    [updateSelectedCommandSnippet]
  );
  const updateCommandSnippetManagerSnippetPromptSet = useCallback(
    (snippetId: string, nextPromptSetId: string) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        promptSetId: nextPromptSetId
      }));
    },
    [updateSelectedCommandSnippet]
  );
  const addCommandSnippetManagerPromptSet = useCallback(() => {
    if (!selectedCommandSnippetManagerGroup || !selectedCommandSnippetManagerSnippet) {
      return;
    }
    if (selectedCommandSnippetManagerGroup.promptSets.length >= MAX_COMMAND_SNIPPET_PROMPT_SETS) {
      setError(`Prompt sets per group are limited to ${MAX_COMMAND_SNIPPET_PROMPT_SETS}.`);
      return;
    }
    const nextPromptSetId = `sps-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const nextPromptSet: CommandSnippetPromptSet = {
      id: nextPromptSetId,
      name: `Prompt Set ${selectedCommandSnippetManagerGroup.promptSets.length + 1}`,
      parameters: []
    };
    setCommandSnippetGroups((prev) =>
      prev.map((group) =>
        group.id === selectedCommandSnippetManagerGroup.id
          ? {
              ...group,
              promptSets: [...group.promptSets, nextPromptSet],
              snippets: group.snippets.map((snippet) =>
                snippet.id === selectedCommandSnippetManagerSnippet.id
                  ? {
                      ...snippet,
                      promptSetId: nextPromptSetId
                    }
                  : snippet
              )
            }
          : group
      )
    );
  }, [selectedCommandSnippetManagerGroup, selectedCommandSnippetManagerSnippet]);
  const updateCommandSnippetManagerPromptSetName = useCallback(
    (promptSetId: string, nextName: string) => {
      updateSelectedCommandSnippetPromptSet(promptSetId, (promptSet) => ({
        ...promptSet,
        name: nextName.slice(0, MAX_COMMAND_SNIPPET_PROMPT_SET_NAME_LENGTH)
      }));
    },
    [updateSelectedCommandSnippetPromptSet]
  );
  const deleteSelectedCommandSnippetManagerPromptSet = useCallback(async () => {
    if (!selectedCommandSnippetManagerGroup || !selectedCommandSnippetManagerPromptSet) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Delete prompt set "${selectedCommandSnippetManagerPromptSet.name}" from "${selectedCommandSnippetManagerGroup.name}"? Linked snippets will fall back to snippet-only variables.`,
      {
        title: "Delete Prompt Set",
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
              promptSets: group.promptSets.filter(
                (promptSet) => promptSet.id !== selectedCommandSnippetManagerPromptSet.id
              ),
              snippets: group.snippets.map((snippet) =>
                snippet.promptSetId === selectedCommandSnippetManagerPromptSet.id
                  ? {
                      ...snippet,
                      promptSetId: ""
                    }
                  : snippet
              )
            }
          : group
      )
    );
  }, [selectedCommandSnippetManagerGroup, selectedCommandSnippetManagerPromptSet, showAppConfirm]);
  const addCommandSnippetManagerSnippetParameter = useCallback(() => {
    if (!selectedCommandSnippetManagerSnippet) {
      return;
    }
    if (selectedCommandSnippetManagerSnippet.parameters.length >= MAX_COMMAND_SNIPPET_PARAMETERS) {
      setError(`Snippet parameters are limited to ${MAX_COMMAND_SNIPPET_PARAMETERS}.`);
      return;
    }
    const existingKeys = new Set(selectedCommandSnippetManagerSnippet.parameters.map((entry) => entry.key));
    const nextParameter = createCommandSnippetParameter(
      selectedCommandSnippetManagerSnippet.parameters.length + 1,
      existingKeys,
      "snippet"
    );
    updateSelectedCommandSnippet(selectedCommandSnippetManagerSnippet.id, (snippet) => ({
      ...snippet,
      parameters: [...snippet.parameters, nextParameter]
    }));
  }, [selectedCommandSnippetManagerSnippet, updateSelectedCommandSnippet]);
  const updateCommandSnippetManagerSnippetParameterKey = useCallback(
    (snippetId: string, parameterId: string, nextKeyInput: string) => {
      if (!selectedCommandSnippetManagerSnippet) {
        return;
      }
      const normalizedKey = normalizeCommandSnippetParameterKey(nextKeyInput);
      if (!normalizedKey) {
        setError("Snippet parameter keys must contain letters, numbers, '-' or '_'.");
        return;
      }
      if (
        selectedCommandSnippetManagerSnippet.parameters.some(
          (parameter) => parameter.id !== parameterId && parameter.key === normalizedKey
        )
      ) {
        setError(`Snippet parameter key "${normalizedKey}" already exists.`);
        return;
      }
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        parameters: snippet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                key: normalizedKey,
                label: parameter.label || normalizedKey
              }
            : parameter
        )
      }));
    },
    [selectedCommandSnippetManagerSnippet, updateSelectedCommandSnippet]
  );
  const updateCommandSnippetManagerSnippetParameterLabel = useCallback(
    (snippetId: string, parameterId: string, nextLabel: string) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        parameters: snippet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                label: nextLabel.slice(0, MAX_COMMAND_SNIPPET_PARAMETER_LABEL_LENGTH)
              }
            : parameter
        )
      }));
    },
    [updateSelectedCommandSnippet]
  );
  const updateCommandSnippetManagerSnippetParameterDefault = useCallback(
    (snippetId: string, parameterId: string, nextDefaultValue: string) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        parameters: snippet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                defaultValue: nextDefaultValue.slice(0, MAX_COMMAND_SNIPPET_PARAMETER_DEFAULT_LENGTH)
              }
            : parameter
        )
      }));
    },
    [updateSelectedCommandSnippet]
  );
  const updateCommandSnippetManagerSnippetParameterPattern = useCallback(
    (snippetId: string, parameterId: string, nextPattern: string) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        parameters: snippet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                pattern: nextPattern.slice(0, MAX_COMMAND_SNIPPET_PARAMETER_PATTERN_LENGTH)
              }
            : parameter
        )
      }));
    },
    [updateSelectedCommandSnippet]
  );
  const updateCommandSnippetManagerSnippetParameterScope = useCallback(
    (snippetId: string, parameterId: string, nextScope: CommandSnippetVariableScopeId) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        parameters: snippet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                scope: nextScope
              }
            : parameter
        )
      }));
    },
    [updateSelectedCommandSnippet]
  );
  const updateCommandSnippetManagerSnippetParameterRequired = useCallback(
    (snippetId: string, parameterId: string, nextRequired: boolean) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        parameters: snippet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                required: nextRequired
              }
            : parameter
        )
      }));
    },
    [updateSelectedCommandSnippet]
  );
  const deleteCommandSnippetManagerSnippetParameter = useCallback(
    (snippetId: string, parameterId: string) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => ({
        ...snippet,
        parameters: snippet.parameters.filter((parameter) => parameter.id !== parameterId)
      }));
    },
    [updateSelectedCommandSnippet]
  );
  const insertCommandSnippetManagerSnippetParameterToken = useCallback(
    (snippetId: string, parameterKey: string) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => {
        const token = buildCommandSnippetParameterToken(parameterKey);
        const nextTemplate = snippet.template.includes(token)
          ? snippet.template
          : snippet.template.trim()
            ? `${snippet.template}\n${token}`
            : token;
        return {
          ...snippet,
          template: nextTemplate.slice(0, 4000)
        };
      });
    },
    [updateSelectedCommandSnippet]
  );
  const addCommandSnippetManagerPromptSetParameter = useCallback(() => {
    if (!selectedCommandSnippetManagerPromptSet) {
      return;
    }
    if (selectedCommandSnippetManagerPromptSet.parameters.length >= MAX_COMMAND_SNIPPET_PARAMETERS) {
      setError(`Prompt-set parameters are limited to ${MAX_COMMAND_SNIPPET_PARAMETERS}.`);
      return;
    }
    const existingKeys = new Set(selectedCommandSnippetManagerPromptSet.parameters.map((entry) => entry.key));
    const nextParameter = createCommandSnippetParameter(
      selectedCommandSnippetManagerPromptSet.parameters.length + 1,
      existingKeys,
      "group"
    );
    updateSelectedCommandSnippetPromptSet(selectedCommandSnippetManagerPromptSet.id, (promptSet) => ({
      ...promptSet,
      parameters: [...promptSet.parameters, nextParameter]
    }));
  }, [selectedCommandSnippetManagerPromptSet, updateSelectedCommandSnippetPromptSet]);
  const updateCommandSnippetManagerPromptSetParameterKey = useCallback(
    (promptSetId: string, parameterId: string, nextKeyInput: string) => {
      if (!selectedCommandSnippetManagerPromptSet) {
        return;
      }
      const normalizedKey = normalizeCommandSnippetParameterKey(nextKeyInput);
      if (!normalizedKey) {
        setError("Prompt-set parameter keys must contain letters, numbers, '-' or '_'.");
        return;
      }
      if (
        selectedCommandSnippetManagerPromptSet.parameters.some(
          (parameter) => parameter.id !== parameterId && parameter.key === normalizedKey
        )
      ) {
        setError(`Prompt-set parameter key "${normalizedKey}" already exists.`);
        return;
      }
      updateSelectedCommandSnippetPromptSet(promptSetId, (promptSet) => ({
        ...promptSet,
        parameters: promptSet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                key: normalizedKey,
                label: parameter.label || normalizedKey
              }
            : parameter
        )
      }));
    },
    [selectedCommandSnippetManagerPromptSet, updateSelectedCommandSnippetPromptSet]
  );
  const updateCommandSnippetManagerPromptSetParameterLabel = useCallback(
    (promptSetId: string, parameterId: string, nextLabel: string) => {
      updateSelectedCommandSnippetPromptSet(promptSetId, (promptSet) => ({
        ...promptSet,
        parameters: promptSet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                label: nextLabel.slice(0, MAX_COMMAND_SNIPPET_PARAMETER_LABEL_LENGTH)
              }
            : parameter
        )
      }));
    },
    [updateSelectedCommandSnippetPromptSet]
  );
  const updateCommandSnippetManagerPromptSetParameterDefault = useCallback(
    (promptSetId: string, parameterId: string, nextDefaultValue: string) => {
      updateSelectedCommandSnippetPromptSet(promptSetId, (promptSet) => ({
        ...promptSet,
        parameters: promptSet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                defaultValue: nextDefaultValue.slice(0, MAX_COMMAND_SNIPPET_PARAMETER_DEFAULT_LENGTH)
              }
            : parameter
        )
      }));
    },
    [updateSelectedCommandSnippetPromptSet]
  );
  const updateCommandSnippetManagerPromptSetParameterPattern = useCallback(
    (promptSetId: string, parameterId: string, nextPattern: string) => {
      updateSelectedCommandSnippetPromptSet(promptSetId, (promptSet) => ({
        ...promptSet,
        parameters: promptSet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                pattern: nextPattern.slice(0, MAX_COMMAND_SNIPPET_PARAMETER_PATTERN_LENGTH)
              }
            : parameter
        )
      }));
    },
    [updateSelectedCommandSnippetPromptSet]
  );
  const updateCommandSnippetManagerPromptSetParameterScope = useCallback(
    (promptSetId: string, parameterId: string, nextScope: CommandSnippetVariableScopeId) => {
      updateSelectedCommandSnippetPromptSet(promptSetId, (promptSet) => ({
        ...promptSet,
        parameters: promptSet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                scope: nextScope
              }
            : parameter
        )
      }));
    },
    [updateSelectedCommandSnippetPromptSet]
  );
  const updateCommandSnippetManagerPromptSetParameterRequired = useCallback(
    (promptSetId: string, parameterId: string, nextRequired: boolean) => {
      updateSelectedCommandSnippetPromptSet(promptSetId, (promptSet) => ({
        ...promptSet,
        parameters: promptSet.parameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                required: nextRequired
              }
            : parameter
        )
      }));
    },
    [updateSelectedCommandSnippetPromptSet]
  );
  const deleteCommandSnippetManagerPromptSetParameter = useCallback(
    (promptSetId: string, parameterId: string) => {
      updateSelectedCommandSnippetPromptSet(promptSetId, (promptSet) => ({
        ...promptSet,
        parameters: promptSet.parameters.filter((parameter) => parameter.id !== parameterId)
      }));
    },
    [updateSelectedCommandSnippetPromptSet]
  );
  const insertCommandSnippetManagerPromptSetParameterToken = useCallback(
    (snippetId: string, parameterKey: string) => {
      updateSelectedCommandSnippet(snippetId, (snippet) => {
        const token = buildCommandSnippetParameterToken(parameterKey);
        const nextTemplate = snippet.template.includes(token)
          ? snippet.template
          : snippet.template.trim()
            ? `${snippet.template}\n${token}`
            : token;
        return {
          ...snippet,
          template: nextTemplate.slice(0, 4000)
        };
      });
    },
    [updateSelectedCommandSnippet]
  );
  const runSelectedCommandSnippetManagerSnippet = useCallback(async () => {
    if (!selectedCommandSnippetManagerSnippet) {
      return;
    }
    await runCommandSnippet(
      selectedCommandSnippetManagerSnippet,
      selectedCommandSnippetManagerGroup?.id ?? ""
    );
  }, [runCommandSnippet, selectedCommandSnippetManagerGroup?.id, selectedCommandSnippetManagerSnippet]);
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
    setCommandSnippetScopedValues({});
  }, [commandSnippetGroups.length, showAppConfirm, totalCommandSnippetCount]);
  const clearCommandSnippetScopedValues = useCallback(async () => {
    const scopedValueCount = Object.keys(commandSnippetScopedValues).length;
    if (scopedValueCount === 0) {
      return;
    }
    const confirmed = await showAppConfirm(
      `Clear ${scopedValueCount} remembered scoped snippet value(s)?`,
      {
        title: "Clear Scoped Values",
        confirmLabel: "Clear",
        cancelLabel: "Cancel",
        danger: true
      }
    );
    if (!confirmed) {
      return;
    }
    setCommandSnippetScopedValues({});
  }, [commandSnippetScopedValues, showAppConfirm]);
  const importCommandSnippetGroupsWithUiError = useCallback(() => {
    void importCommandSnippetGroups().catch((caughtError) => {
      setError(toLogMessage(caughtError));
    });
  }, [importCommandSnippetGroups]);
  const selectCommandSnippetManagerGroup = useCallback(
    (groupId: string) => {
      const nextGroup = commandSnippetGroups.find((group) => group.id === groupId);
      setCommandSnippetManagerGroupId(groupId);
      setCommandSnippetManagerSnippetId(nextGroup?.snippets[0]?.id ?? "");
    },
    [commandSnippetGroups]
  );
  const selectCommandSnippetManagerSnippet = useCallback((snippetId: string) => {
    setCommandSnippetManagerSnippetId(snippetId);
  }, []);
  const runCommandSnippetManagerSnippetById = useCallback(
    (snippetId: string) => {
      if (!selectedCommandSnippetManagerGroup) {
        return;
      }
      const snippet =
        selectedCommandSnippetManagerGroup.snippets.find((entry) => entry.id === snippetId) ?? null;
      if (!snippet) {
        return;
      }
      setCommandSnippetManagerSnippetId(snippetId);
      void runCommandSnippet(snippet, selectedCommandSnippetManagerGroup.id);
    },
    [runCommandSnippet, selectedCommandSnippetManagerGroup]
  );
  const normalizeSelectedCommandSnippetManagerGroupName = useCallback(() => {
    if (!selectedCommandSnippetManagerGroup) {
      return;
    }
    if (selectedCommandSnippetManagerGroup.name.trim()) {
      return;
    }
    updateCommandSnippetManagerGroupName(selectedCommandSnippetManagerGroup.id, "Unnamed Group");
  }, [selectedCommandSnippetManagerGroup, updateCommandSnippetManagerGroupName]);
  const normalizeSelectedCommandSnippetManagerSnippetName = useCallback(() => {
    if (!selectedCommandSnippetManagerSnippet) {
      return;
    }
    if (selectedCommandSnippetManagerSnippet.name.trim()) {
      return;
    }
    updateCommandSnippetManagerSnippetName(selectedCommandSnippetManagerSnippet.id, "Unnamed Snippet");
  }, [selectedCommandSnippetManagerSnippet, updateCommandSnippetManagerSnippetName]);
  const normalizeSelectedCommandSnippetManagerPromptSetName = useCallback(() => {
    if (!selectedCommandSnippetManagerPromptSet) {
      return;
    }
    if (selectedCommandSnippetManagerPromptSet.name.trim()) {
      return;
    }
    updateCommandSnippetManagerPromptSetName(
      selectedCommandSnippetManagerPromptSet.id,
      "Unnamed Prompt Set"
    );
  }, [selectedCommandSnippetManagerPromptSet, updateCommandSnippetManagerPromptSetName]);

  const closeTerminalTabs = useCallback((tabIds: string[]) => {
    const uniqueTabIds = Array.from(new Set(tabIds.filter(Boolean)));
    if (uniqueTabIds.length === 0) {
      return;
    }
    const tabIdSet = new Set(uniqueTabIds);
    dismissDangerousCommandApprovalsForClosedTabs(uniqueTabIds);

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
      readyUploadDirectoriesRef.current.delete(tabId);
      warmingUploadDirectoriesRef.current.delete(tabId);
      runningUploadCountsByTabRef.current.delete(tabId);
      adaptiveUploadConcurrencyByTabRef.current.delete(tabId);
      adaptiveUploadConcurrencyRecoveryByTabRef.current.delete(tabId);
      if (terminalApi) {
        void terminalApi.close(tabId);
      }
      if (systemApi) {
        void systemApi.disposeRemoteOpenFiles(tabId);
      }
      clearPortForwardTabState(tabId);
      removeServerMonitorTabState(tabId);
    }
    setSftpErrorsByTab((prev) => {
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
    setRemoteOpenFileIssuesByTab((prev) => {
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
  }, [
    applySftpTransferEvent,
    dismissDangerousCommandApprovalsForClosedTabs,
    drainDownloadQueue,
    drainUploadQueue,
    clearPortForwardTabState,
    removeServerMonitorTabState,
    systemApi,
    terminalApi
  ]);

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

  const setTerminalEditorAutoLayoutEnabled = (value: boolean) => {
    setTerminalEditorFocusPreferences((prev) => ({
      ...prev,
      autoLayoutEnabled: value
    }));
    pushAppHintMessage(
      value
        ? "Terminal editor focus mode now auto-tightens layout for alternate-screen editors."
        : "Terminal editor focus mode no longer auto-tightens layout for alternate-screen editors.",
      {
        level: "info",
        durationMs: 3600
      }
    );
  };

  const setTerminalEditorFocusThemeId = (value: TerminalEditorFocusThemeId) => {
    if (terminalEditorFocusPreferences.themeId === value) {
      return;
    }
    const nextTheme =
      TERMINAL_EDITOR_FOCUS_THEME_OPTIONS.find((option) => option.id === value) ??
      TERMINAL_EDITOR_FOCUS_THEME_OPTIONS[0];
    setTerminalEditorFocusPreferences((prev) => ({
      ...prev,
      themeId: nextTheme.id
    }));
    pushAppHintMessage(`Terminal editor focus theme set to ${nextTheme.label}.`, {
      level: "info",
      durationMs: 3200
    });
  };

  const setTerminalEditorFocusTypographyId = (value: TerminalEditorFocusTypographyId) => {
    if (terminalEditorFocusPreferences.typographyId === value) {
      return;
    }
    const nextTypography =
      TERMINAL_EDITOR_FOCUS_TYPOGRAPHY_OPTIONS.find((option) => option.id === value) ??
      TERMINAL_EDITOR_FOCUS_TYPOGRAPHY_OPTIONS[1] ??
      TERMINAL_EDITOR_FOCUS_TYPOGRAPHY_OPTIONS[0];
    setTerminalEditorFocusPreferences((prev) => ({
      ...prev,
      typographyId: nextTypography.id
    }));
    pushAppHintMessage(`Terminal editor focus typography set to ${nextTypography.label}.`, {
      level: "info",
      durationMs: 3200
    });
  };

  const setTerminalEditorFocusFontId = (value: TerminalEditorFocusFontId) => {
    if (terminalEditorFocusPreferences.fontId === value) {
      return;
    }
    const nextFont =
      TERMINAL_EDITOR_FOCUS_FONT_OPTIONS.find((option) => option.id === value) ??
      TERMINAL_EDITOR_FOCUS_FONT_OPTIONS[0];
    setTerminalEditorFocusPreferences((prev) => ({
      ...prev,
      fontId: nextFont.id
    }));
    pushAppHintMessage(`Terminal editor focus font set to ${nextFont.label}.`, {
      level: "info",
      durationMs: 3200
    });
  };

  const setTerminalEditorFocusRhythmId = (value: TerminalEditorFocusRhythmId) => {
    if (terminalEditorFocusPreferences.rhythmId === value) {
      return;
    }
    const nextRhythm =
      TERMINAL_EDITOR_FOCUS_RHYTHM_OPTIONS.find((option) => option.id === value) ??
      TERMINAL_EDITOR_FOCUS_RHYTHM_OPTIONS[1] ??
      TERMINAL_EDITOR_FOCUS_RHYTHM_OPTIONS[0];
    setTerminalEditorFocusPreferences((prev) => ({
      ...prev,
      rhythmId: nextRhythm.id
    }));
    pushAppHintMessage(`Terminal editor focus rhythm set to ${nextRhythm.label}.`, {
      level: "info",
      durationMs: 3200
    });
  };

  const setTerminalEditorFocusCursorId = (value: TerminalEditorFocusCursorId) => {
    if (terminalEditorFocusPreferences.cursorId === value) {
      return;
    }
    const nextCursor =
      TERMINAL_EDITOR_FOCUS_CURSOR_OPTIONS.find((option) => option.id === value) ??
      TERMINAL_EDITOR_FOCUS_CURSOR_OPTIONS[2] ??
      TERMINAL_EDITOR_FOCUS_CURSOR_OPTIONS[0];
    setTerminalEditorFocusPreferences((prev) => ({
      ...prev,
      cursorId: nextCursor.id
    }));
    pushAppHintMessage(`Terminal editor focus cursor set to ${nextCursor.label}.`, {
      level: "info",
      durationMs: 3200
    });
  };

  const applyWorkspaceProfileToDangerousCommandGuard = useCallback(
    (profileId: WorkspaceProfileId) => {
      const profileTemplate =
        DANGEROUS_COMMAND_ENVIRONMENT_TEMPLATES.find((template) => template.id === profileId) ??
        DANGEROUS_COMMAND_ENVIRONMENT_TEMPLATES[0];
      setDangerousCommandGuardPreferences((prev) => {
        if (
          prev.environmentTemplateId === profileTemplate.id &&
          prev.policyPackId === profileTemplate.recommendedPolicyPackId
        ) {
          return prev;
        }
        return {
          ...prev,
          environmentTemplateId: profileTemplate.id,
          policyPackId: profileTemplate.recommendedPolicyPackId
        };
      });
    },
    []
  );

  const setWorkspaceProfileId = useCallback(
    (profileId: WorkspaceProfileId) => {
      setWorkspaceProfilePreferences((prev) => ({
        ...prev,
        profileId
      }));
      if (workspaceProfilePreferencesRef.current.syncDangerousCommandSafety) {
        applyWorkspaceProfileToDangerousCommandGuard(profileId);
      }
      pushAppHintMessage(`Workspace profile switched to ${workspaceProfileLabels[profileId].label}.`, {
        level: profileId === "prod" ? "warn" : "info",
        durationMs: 4200
      });
    },
    [applyWorkspaceProfileToDangerousCommandGuard, pushAppHintMessage, workspaceProfileLabels]
  );

  const setWorkspaceProfileDangerousCommandSync = useCallback(
    (value: boolean) => {
      setWorkspaceProfilePreferences((prev) => ({
        ...prev,
        syncDangerousCommandSafety: value
      }));
      if (value) {
        applyWorkspaceProfileToDangerousCommandGuard(workspaceProfilePreferencesRef.current.profileId);
        pushAppHintMessage("Workspace profile now controls the global Safety pack/template defaults.", {
          level: workspaceProfilePreferencesRef.current.profileId === "prod" ? "warn" : "info",
          durationMs: 4600
        });
        return;
      }
      pushAppHintMessage("Workspace profile no longer auto-syncs global Safety pack/template defaults.", {
        level: "info",
        durationMs: 4200
      });
    },
    [applyWorkspaceProfileToDangerousCommandGuard, pushAppHintMessage]
  );
  useEffect(() => {
    if (!workspaceProfilePreferences.syncDangerousCommandSafety) {
      return;
    }
    applyWorkspaceProfileToDangerousCommandGuard(workspaceProfilePreferences.profileId);
  }, [
    applyWorkspaceProfileToDangerousCommandGuard,
    dangerousCommandGuardPreferences.environmentTemplateId,
    dangerousCommandGuardPreferences.policyPackId,
    workspaceProfilePreferences.profileId,
    workspaceProfilePreferences.syncDangerousCommandSafety
  ]);

  const setDangerousCommandGuardEnabled = (value: boolean) => {
    setDangerousCommandGuardPreferences((prev) => ({
      ...prev,
      enabled: value
    }));
  };

  const setDangerousCommandSourceEnabled = (
    source: DangerousCommandExecutionSource,
    value: boolean
  ) => {
    setDangerousCommandGuardPreferences((prev) => ({
      ...prev,
      sourceStates: {
        ...prev.sourceStates,
        [source]: value
      }
    }));
  };

  const setDangerousCommandPolicyPackId = (value: DangerousCommandPolicyPackId) => {
    setDangerousCommandGuardPreferences((prev) => ({
      ...prev,
      policyPackId: value
    }));
  };

  const applyDangerousCommandEnvironmentTemplate = (
    value: DangerousCommandEnvironmentTemplateId
  ) => {
    const template = DANGEROUS_COMMAND_ENVIRONMENT_TEMPLATES.find((entry) => entry.id === value);
    setDangerousCommandGuardPreferences((prev) => ({
      ...prev,
      environmentTemplateId: value,
      policyPackId:
        value === "none" || !template ? prev.policyPackId : template.recommendedPolicyPackId
    }));
  };

  const setDangerousCommandBuiltinRuleEnabled = (
    ruleId: DangerousCommandBuiltinRuleId,
    value: boolean
  ) => {
    setDangerousCommandGuardPreferences((prev) => ({
      ...prev,
      builtinRuleStates: {
        ...prev.builtinRuleStates,
        [ruleId]: value
      }
    }));
  };

  const setDangerousCommandCustomPatternsText = (value: string) => {
    setDangerousCommandGuardPreferences((prev) => ({
      ...prev,
      customPatternsText: value.slice(0, 1600)
    }));
  };

  const saveDangerousCommandGroupAssignment = (groupName: string | null | undefined) => {
    const normalizedGroupName = normalizeSessionGroupName(groupName ?? "");
    if (!normalizedGroupName) {
      return;
    }
    setDangerousCommandGuardPreferences((prev) => {
      const existingAssignments = prev.groupAssignments.filter(
        (assignment) => assignment.groupName.toLowerCase() !== normalizedGroupName.toLowerCase()
      );
      if (
        existingAssignments.length >= MAX_DANGEROUS_COMMAND_GROUP_ASSIGNMENTS &&
        existingAssignments.length === prev.groupAssignments.length
      ) {
        return prev;
      }
      const nextAssignments = [
        ...existingAssignments,
        {
          groupName: normalizedGroupName,
          policyPackId: prev.policyPackId,
          environmentTemplateId: prev.environmentTemplateId
        }
      ].sort((left, right) => left.groupName.localeCompare(right.groupName));
      return {
        ...prev,
        groupAssignments: nextAssignments
      };
    });
  };

  const deleteDangerousCommandGroupAssignment = (groupName: string | null | undefined) => {
    const normalizedGroupName = normalizeSessionGroupName(groupName ?? "");
    if (!normalizedGroupName) {
      return;
    }
    setDangerousCommandGuardPreferences((prev) => ({
      ...prev,
      groupAssignments: prev.groupAssignments.filter(
        (assignment) => assignment.groupName.toLowerCase() !== normalizedGroupName.toLowerCase()
      )
    }));
  };

  const saveCurrentDangerousCommandPolicyBundle = useCallback(async () => {
    const suggestedName = `${selectedDangerousCommandEnvironmentTemplate.label} ${selectedDangerousCommandPolicyPack.label}`
      .replace(/\s+/g, " ")
      .trim();
    const bundleNameInput = await showAppPrompt(
      "Enter a name for this shared safety bundle.",
      suggestedName,
      {
        title: "Save Safety Bundle",
        confirmLabel: "Next"
      }
    );
    if (bundleNameInput === null) {
      return;
    }
    const bundleName = normalizeDangerousCommandPolicyBundleName(bundleNameInput);
    if (!bundleName) {
      await showAppAlert("Bundle name cannot be empty.", {
        title: "Save Safety Bundle"
      });
      return;
    }
    const existingBundle =
      dangerousCommandPolicyBundles.find(
        (bundle) => bundle.name.toLowerCase() === bundleName.toLowerCase()
      ) ?? null;
    if (!existingBundle && dangerousCommandPolicyBundles.length >= MAX_DANGEROUS_COMMAND_POLICY_BUNDLES) {
      await showAppAlert(
        `Bundle limit reached (${MAX_DANGEROUS_COMMAND_POLICY_BUNDLES}). Delete or export an existing bundle first.`,
        {
          title: "Save Safety Bundle"
        }
      );
      return;
    }
    const descriptionInput = await showAppPrompt(
      "Optional description for teammates.",
      existingBundle?.description ?? "",
      {
        title: "Save Safety Bundle",
        confirmLabel: existingBundle ? "Update" : "Save",
        multiline: true
      }
    );
    if (descriptionInput === null) {
      return;
    }
    const nextBundle: DangerousCommandPolicyBundleRecord = {
      id: existingBundle?.id ?? `dcpb-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: bundleName,
      description: normalizeDangerousCommandPolicyBundleDescription(descriptionInput),
      updatedAtIso: new Date().toISOString(),
      preferences: cloneDangerousCommandGuardPreferences(dangerousCommandGuardPreferences)
    };
    setDangerousCommandPolicyBundles((prev) =>
      normalizeDangerousCommandPolicyBundles([
        ...prev.filter(
          (bundle) =>
            bundle.id !== nextBundle.id &&
            bundle.name.toLowerCase() !== nextBundle.name.toLowerCase()
        ),
        nextBundle
      ])
    );
    await showAppAlert(
      existingBundle
        ? `Updated shared safety bundle "${bundleName}".`
        : `Saved shared safety bundle "${bundleName}".`,
      {
        title: "Save Safety Bundle"
      }
    );
  }, [
    dangerousCommandGuardPreferences,
    dangerousCommandPolicyBundles,
    selectedDangerousCommandEnvironmentTemplate.label,
    selectedDangerousCommandPolicyPack.label,
    showAppAlert,
    showAppPrompt
  ]);

  const applyDangerousCommandPolicyBundle = useCallback(
    async (bundleId: string) => {
      const bundle = dangerousCommandPolicyBundles.find((entry) => entry.id === bundleId) ?? null;
      if (!bundle) {
        return;
      }
      const confirmed = await showAppConfirm(
        `Apply shared safety bundle "${bundle.name}"?\nThis replaces the current Safety settings.`,
        {
          title: "Apply Safety Bundle",
          confirmLabel: "Apply",
          cancelLabel: "Cancel",
          detailText: bundle.description || undefined
        }
      );
      if (!confirmed) {
        return;
      }
      setDangerousCommandGuardPreferences(cloneDangerousCommandGuardPreferences(bundle.preferences));
      pushAppHintMessage(`Applied safety bundle: ${bundle.name}`, {
        level: "info",
        durationMs: 4200
      });
    },
    [dangerousCommandPolicyBundles, pushAppHintMessage, showAppConfirm]
  );

  const deleteDangerousCommandPolicyBundle = useCallback(
    async (bundleId: string) => {
      const bundle = dangerousCommandPolicyBundles.find((entry) => entry.id === bundleId) ?? null;
      if (!bundle) {
        return;
      }
      const confirmed = await showAppConfirm(
        `Delete shared safety bundle "${bundle.name}"?`,
        {
          title: "Delete Safety Bundle",
          confirmLabel: "Delete",
          cancelLabel: "Cancel",
          danger: true,
          detailText: bundle.description || undefined
        }
      );
      if (!confirmed) {
        return;
      }
      setDangerousCommandPolicyBundles((prev) => prev.filter((entry) => entry.id !== bundleId));
    },
    [dangerousCommandPolicyBundles, showAppConfirm]
  );

  const exportDangerousCommandPolicyBundle = useCallback(
    async (bundleId: string) => {
      const bundle = dangerousCommandPolicyBundles.find((entry) => entry.id === bundleId) ?? null;
      if (!bundle) {
        return;
      }
      const generatedAtIso = new Date().toISOString();
      const fileSegment =
        bundle.name
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, "-")
          .replace(/^-+|-+$/g, "") || "bundle";
      const payload = {
        exportedAtIso: generatedAtIso,
        appVersion: APP_VERSION,
        kind: "dangerousCommandPolicyBundle",
        bundle
      };
      const exportText = `${JSON.stringify(payload, null, 2)}\n`;
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Safety Bundle",
          defaultFileName: `termdock-safety-bundle-${fileSegment}-${generatedAtIso.replace(/[:]/g, "-")}.json`,
          text: exportText,
          filters: [{ name: "JSON", extensions: ["json"] }]
        });
        if (!result.canceled && result.outputPath) {
          await showAppAlert(`Safety bundle exported:\n${result.outputPath}`, {
            title: "Export Safety Bundle"
          });
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      await showAppAlert(copied ? "Safety bundle JSON copied to clipboard." : exportText, {
        title: "Export Safety Bundle",
        detailText: copied ? undefined : exportText
      });
    },
    [dangerousCommandPolicyBundles, showAppAlert, systemApi]
  );

  const exportDangerousCommandPolicyBundles = useCallback(async () => {
    if (dangerousCommandPolicyBundles.length === 0) {
      await showAppAlert("No shared safety bundles available to export.", {
        title: "Export Safety Bundles"
      });
      return;
    }
    const payload = createDangerousCommandPolicyBundlesPayload(dangerousCommandPolicyBundles);
    const exportText = `${JSON.stringify(payload, null, 2)}\n`;
    if (systemApi?.saveTextFile) {
      const result = await systemApi.saveTextFile({
        title: "Export Safety Bundles",
        defaultFileName: `termdock-safety-bundles-${payload.exportedAtIso.replace(/[:]/g, "-")}.json`,
        text: exportText,
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
      if (!result.canceled && result.outputPath) {
        await showAppAlert(`Safety bundles exported:\n${result.outputPath}`, {
          title: "Export Safety Bundles"
        });
      }
      return;
    }
    const copied = await copyTextToClipboard(exportText);
    await showAppAlert(copied ? "Safety bundles JSON copied to clipboard." : exportText, {
      title: "Export Safety Bundles",
      detailText: copied ? undefined : exportText
    });
  }, [dangerousCommandPolicyBundles, showAppAlert, systemApi]);

  const importDangerousCommandPolicyBundles = useCallback(async () => {
    try {
      if (!systemApi?.pickAndReadTextFile) {
        throw new Error("System bridge unavailable. Restart `pnpm dev`.");
      }
      const selected = await systemApi.pickAndReadTextFile({
        title: "Import Safety Bundles",
        buttonLabel: "Import",
        filters: [
          { name: "JSON", extensions: ["json"] },
          { name: "All Files", extensions: ["*"] }
        ]
      });
      if (selected.canceled || !selected.filePath) {
        return;
      }
      const rawText = typeof selected.text === "string" ? selected.text : "";
      if (!rawText.trim()) {
        await showAppAlert("Selected file is empty.", {
          title: "Import Safety Bundles"
        });
        return;
      }
      const importedBundles = parseDangerousCommandPolicyBundlesText(rawText);
      if (importedBundles.length === 0) {
        await showAppAlert("No valid safety bundles found in selected file.", {
          title: "Import Safety Bundles"
        });
        return;
      }
      setDangerousCommandPolicyBundles((prev) =>
        mergeDangerousCommandPolicyBundles(prev, importedBundles)
      );
      await showAppAlert(
        `Imported ${importedBundles.length} safety bundle(s) from ${getPathBaseName(selected.filePath)}.`,
        {
          title: "Import Safety Bundles"
        }
      );
    } catch (caughtError) {
      const message = toLogMessage(caughtError);
      setError(`Failed to import safety bundles. ${message}`);
      writeAppLog("error", "renderer:safety", "Failed to import safety bundles.", caughtError);
    }
  }, [showAppAlert, systemApi, writeAppLog]);

  const pullDangerousCommandPolicyBundlesFromSync = useCallback(
    async (forceSelectFile = false) => {
      try {
        setDangerousCommandPolicyBundleSyncBusyAction("pull");
        let filePath = dangerousCommandPolicyBundleSyncState.filePath;
        let rawText = "";
        if (forceSelectFile || !filePath) {
          if (!systemApi?.pickAndReadTextFile) {
            throw new Error("System bridge unavailable. Restart `pnpm dev`.");
          }
          const selected = await systemApi.pickAndReadTextFile({
            title: "Pull Safety Bundles From Sync File",
            buttonLabel: "Use File",
            filters: [
              { name: "JSON", extensions: ["json"] },
              { name: "All Files", extensions: ["*"] }
            ]
          });
          if (selected.canceled || !selected.filePath) {
            return false;
          }
          filePath = selected.filePath;
          rawText = typeof selected.text === "string" ? selected.text : "";
        } else {
          if (!systemApi?.readTextFileAtPath) {
            throw new Error("System bridge unavailable. Restart `pnpm dev`.");
          }
          rawText = await systemApi.readTextFileAtPath(filePath);
        }
        if (!rawText.trim()) {
          await showAppAlert("Selected sync file is empty.", {
            title: "Pull Safety Bundles"
          });
          return false;
        }
        const importedBundles = parseDangerousCommandPolicyBundlesText(rawText);
        if (importedBundles.length === 0) {
          await showAppAlert("No valid safety bundles found in sync file.", {
            title: "Pull Safety Bundles"
          });
          return false;
        }
        const pulledAtIso = new Date().toISOString();
        setDangerousCommandPolicyBundles((prev) =>
          mergeDangerousCommandPolicyBundles(prev, importedBundles)
        );
        setDangerousCommandPolicyBundleSyncState((prev) => ({
          ...prev,
          filePath,
          lastPulledAtIso: pulledAtIso
        }));
        pushAppHintMessage(`Pulled ${importedBundles.length} safety bundle(s) from sync file.`, {
          level: "info",
          durationMs: 4200
        });
        await showAppAlert(
          `Pulled ${importedBundles.length} safety bundle(s) from:\n${filePath}`,
          {
            title: "Pull Safety Bundles"
          }
        );
        return true;
      } catch (caughtError) {
        const message = toLogMessage(caughtError);
        setError(`Failed to pull safety bundles from sync file. ${message}`);
        writeAppLog(
          "error",
          "renderer:safety",
          "Failed to pull safety bundles from sync file.",
          caughtError
        );
        return false;
      } finally {
        setDangerousCommandPolicyBundleSyncBusyAction(null);
      }
    },
    [
      dangerousCommandPolicyBundleSyncState.filePath,
      pushAppHintMessage,
      showAppAlert,
      systemApi,
      writeAppLog
    ]
  );

  const pushDangerousCommandPolicyBundlesToSync = useCallback(
    async (forceSelectFile = false) => {
      try {
        setDangerousCommandPolicyBundleSyncBusyAction("push");
        const payload = createDangerousCommandPolicyBundlesPayload(
          dangerousCommandPolicyBundles,
          "dangerousCommandPolicyBundlesSync"
        );
        const exportText = `${JSON.stringify(payload, null, 2)}\n`;
        let filePath = dangerousCommandPolicyBundleSyncState.filePath;
        if (forceSelectFile || !filePath) {
          if (!systemApi?.saveTextFile) {
            throw new Error("System bridge unavailable. Restart `pnpm dev`.");
          }
          const result = await systemApi.saveTextFile({
            title: "Push Safety Bundles To Sync File",
            defaultFileName: `termdock-safety-bundles-sync-${payload.exportedAtIso.replace(/[:]/g, "-")}.json`,
            text: exportText,
            filters: [{ name: "JSON", extensions: ["json"] }]
          });
          if (result.canceled || !result.outputPath) {
            return false;
          }
          filePath = result.outputPath;
        } else {
          if (!systemApi?.writeTextFileAtPath) {
            throw new Error("System bridge unavailable. Restart `pnpm dev`.");
          }
          await systemApi.writeTextFileAtPath(filePath, exportText);
        }
        setDangerousCommandPolicyBundleSyncState((prev) => ({
          ...prev,
          filePath,
          lastPushedAtIso: payload.exportedAtIso
        }));
        pushAppHintMessage(
          `Pushed ${dangerousCommandPolicyBundles.length} safety bundle(s) to sync file.`,
          {
            level: "info",
            durationMs: 4200
          }
        );
        await showAppAlert(
          `Pushed ${dangerousCommandPolicyBundles.length} safety bundle(s) to:\n${filePath}`,
          {
            title: "Push Safety Bundles"
          }
        );
        return true;
      } catch (caughtError) {
        const message = toLogMessage(caughtError);
        setError(`Failed to push safety bundles to sync file. ${message}`);
        writeAppLog(
          "error",
          "renderer:safety",
          "Failed to push safety bundles to sync file.",
          caughtError
        );
        return false;
      } finally {
        setDangerousCommandPolicyBundleSyncBusyAction(null);
      }
    },
    [
      dangerousCommandPolicyBundleSyncState.filePath,
      dangerousCommandPolicyBundles,
      pushAppHintMessage,
      showAppAlert,
      systemApi,
      writeAppLog
    ]
  );

  const changeDangerousCommandPolicyBundleSyncTarget = useCallback(async () => {
    setDangerousCommandPolicyBundleSyncBusyAction("change");
    try {
      const choice = await showAppChoice(
        "Choose a shared sync file for safety bundles.",
        [
          {
            value: "existing",
            label: "Use Existing File"
          },
          {
            value: "new",
            label: "Create New File"
          }
        ],
        {
          title: "Change Safety Bundle Sync File",
          cancelLabel: "Cancel",
          detailText:
            "Using an existing file pulls and merges bundles into the local catalog. Creating a new file writes the current local bundle catalog to a shared JSON file."
        }
      );
      if (choice === "existing") {
        await pullDangerousCommandPolicyBundlesFromSync(true);
      } else if (choice === "new") {
        await pushDangerousCommandPolicyBundlesToSync(true);
      }
    } finally {
      setDangerousCommandPolicyBundleSyncBusyAction((current) =>
        current === "change" ? null : current
      );
    }
  }, [
    pullDangerousCommandPolicyBundlesFromSync,
    pushDangerousCommandPolicyBundlesToSync,
    showAppChoice
  ]);

  const clearDangerousCommandPolicyBundleSyncTarget = useCallback(async () => {
    if (!dangerousCommandPolicyBundleSyncState.filePath) {
      return;
    }
    const confirmed = await showAppConfirm(
      "Clear the current safety bundle sync file?\nThis only removes the local link. The shared JSON file will stay on disk.",
      {
        title: "Clear Safety Bundle Sync File",
        confirmLabel: "Clear",
        cancelLabel: "Cancel"
      }
    );
    if (!confirmed) {
      return;
    }
    setDangerousCommandPolicyBundleSyncState({
      filePath: "",
      lastPulledAtIso: null,
      lastPushedAtIso: null
    });
    pushAppHintMessage("Cleared safety bundle sync file.", {
      level: "info",
      durationMs: 4200
    });
  }, [
    dangerousCommandPolicyBundleSyncState.filePath,
    pushAppHintMessage,
    showAppConfirm
  ]);

  const resetDangerousCommandGuardPreferences = () => {
    setDangerousCommandGuardPreferences(createDefaultDangerousCommandGuardPreferences());
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

  const setUploadRateLimitKiBps = (rawValue: string) => {
    const parsed = Number(rawValue);
    setSftpTransferPreferences((prev) => ({
      ...prev,
      uploadRateLimitKiBps: parseSftpTransferRateLimitKiBps(
        parsed,
        DEFAULT_SFTP_TRANSFER_PREFERENCES.uploadRateLimitKiBps
      )
    }));
  };

  const setDownloadRateLimitKiBps = (rawValue: string) => {
    const parsed = Number(rawValue);
    setSftpTransferPreferences((prev) => ({
      ...prev,
      downloadRateLimitKiBps: parseSftpTransferRateLimitKiBps(
        parsed,
        DEFAULT_SFTP_TRANSFER_PREFERENCES.downloadRateLimitKiBps
      )
    }));
  };

  const setSftpTransferScheduleWindowEnabled = (enabled: boolean) => {
    setSftpTransferPreferences((prev) => ({
      ...prev,
      scheduleWindowEnabled: enabled
    }));
  };

  const setSftpTransferScheduleWindowStart = (rawValue: string) => {
    setSftpTransferPreferences((prev) => ({
      ...prev,
      scheduleWindowStartMinutes: parseSftpScheduleTimeInputValue(
        rawValue,
        prev.scheduleWindowStartMinutes
      )
    }));
  };

  const setSftpTransferScheduleWindowEnd = (rawValue: string) => {
    setSftpTransferPreferences((prev) => ({
      ...prev,
      scheduleWindowEndMinutes: parseSftpScheduleTimeInputValue(rawValue, prev.scheduleWindowEndMinutes)
    }));
  };

  const toggleSftpTransferScheduleWindowDay = (day: number) => {
    setSftpTransferPreferences((prev) => {
      const currentDays = normalizeSftpScheduleDays(
        prev.scheduleWindowDays,
        DEFAULT_SFTP_TRANSFER_PREFERENCES.scheduleWindowDays
      );
      const nextDays = currentDays.includes(day)
        ? currentDays.filter((entry) => entry !== day)
        : [...currentDays, day];
      if (nextDays.length === 0) {
        return prev;
      }
      return {
        ...prev,
        scheduleWindowDays: normalizeSftpScheduleDays(
          nextDays,
          DEFAULT_SFTP_TRANSFER_PREFERENCES.scheduleWindowDays
        )
      };
    });
  };

  const applySftpTransferSchedulePreset = (presetId: string) => {
    const preset = SFTP_TRANSFER_SCHEDULE_PRESETS.find((entry) => entry.id === presetId) ?? null;
    if (!preset) {
      return;
    }
    setSftpTransferPreferences((prev) => ({
      ...prev,
      ...createSftpTransferSchedulePreferencesFromPreset(preset)
    }));
  };

  const saveCurrentSftpTransferPolicyPack = useCallback(async () => {
    const suggestedName = `Transfer ${sftpTransferPreferences.uploadConcurrency}u-${sftpTransferPreferences.downloadConcurrency}d${
      sftpTransferPreferences.scheduleWindowEnabled ? " windowed" : ""
    }`;
    const packNameInput = await showAppPrompt(
      "Enter a name for this transfer policy pack.",
      suggestedName,
      {
        title: "Save Transfer Policy Pack",
        confirmLabel: "Next"
      }
    );
    if (packNameInput === null) {
      return;
    }
    const packName = normalizeSftpTransferPolicyPackName(packNameInput);
    if (!packName) {
      await showAppAlert("Policy pack name cannot be empty.", {
        title: "Save Transfer Policy Pack"
      });
      return;
    }
    const existingPack =
      sftpTransferPolicyPacks.find((pack) => pack.name.toLowerCase() === packName.toLowerCase()) ??
      null;
    if (!existingPack && sftpTransferPolicyPacks.length >= MAX_SFTP_TRANSFER_POLICY_PACKS) {
      await showAppAlert(
        `Policy pack limit reached (${MAX_SFTP_TRANSFER_POLICY_PACKS}). Delete or export an existing pack first.`,
        {
          title: "Save Transfer Policy Pack"
        }
      );
      return;
    }
    const descriptionInput = await showAppPrompt(
      "Optional description for this transfer policy pack.",
      existingPack?.description ?? "",
      {
        title: "Save Transfer Policy Pack",
        confirmLabel: existingPack ? "Update" : "Save",
        multiline: true
      }
    );
    if (descriptionInput === null) {
      return;
    }
    const nextPack: SftpTransferPolicyPackRecord = {
      id: existingPack?.id ?? `stpp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: packName,
      description: normalizeSftpTransferPolicyPackDescription(descriptionInput),
      updatedAtIso: new Date().toISOString(),
      preferences: cloneSftpTransferPreferences(sftpTransferPreferences)
    };
    setSftpTransferPolicyPacks((prev) =>
      normalizeSftpTransferPolicyPacks([
        ...prev.filter(
          (pack) => pack.id !== nextPack.id && pack.name.toLowerCase() !== nextPack.name.toLowerCase()
        ),
        nextPack
      ])
    );
    await showAppAlert(
      existingPack
        ? `Updated transfer policy pack "${packName}".`
        : `Saved transfer policy pack "${packName}".`,
      {
        title: "Save Transfer Policy Pack",
        detailText: formatSftpTransferPolicyPackSummary(nextPack.preferences)
      }
    );
  }, [sftpTransferPolicyPacks, sftpTransferPreferences, showAppAlert, showAppPrompt]);

  const applySftpTransferPolicyPack = useCallback(
    async (packId: string) => {
      const pack = sftpTransferPolicyPacks.find((entry) => entry.id === packId) ?? null;
      if (!pack) {
        return;
      }
      const confirmed = await showAppConfirm(
        `Apply transfer policy pack "${pack.name}"?\nThis replaces the current SFTP transfer settings.`,
        {
          title: "Apply Transfer Policy Pack",
          confirmLabel: "Apply",
          cancelLabel: "Cancel",
          detailText:
            `${formatSftpTransferPolicyPackSummary(pack.preferences)}${
              pack.description ? `\n\n${pack.description}` : ""
            }`
        }
      );
      if (!confirmed) {
        return;
      }
      setSftpTransferPreferences(cloneSftpTransferPreferences(pack.preferences));
      pushAppHintMessage(`Applied transfer policy pack: ${pack.name}`, {
        level: "info",
        durationMs: 4200
      });
    },
    [pushAppHintMessage, sftpTransferPolicyPacks, showAppConfirm]
  );

  const deleteSftpTransferPolicyPack = useCallback(
    async (packId: string) => {
      const pack = sftpTransferPolicyPacks.find((entry) => entry.id === packId) ?? null;
      if (!pack) {
        return;
      }
      const confirmed = await showAppConfirm(`Delete transfer policy pack "${pack.name}"?`, {
        title: "Delete Transfer Policy Pack",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        danger: true,
        detailText:
          `${formatSftpTransferPolicyPackSummary(pack.preferences)}${
            pack.description ? `\n\n${pack.description}` : ""
          }`
      });
      if (!confirmed) {
        return;
      }
      setSftpTransferPolicyPacks((prev) => prev.filter((entry) => entry.id !== packId));
    },
    [sftpTransferPolicyPacks, showAppConfirm]
  );

  const exportSftpTransferPolicyPack = useCallback(
    async (packId: string) => {
      const pack = sftpTransferPolicyPacks.find((entry) => entry.id === packId) ?? null;
      if (!pack) {
        return;
      }
      const generatedAtIso = new Date().toISOString();
      const fileSegment =
        pack.name
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, "-")
          .replace(/^-+|-+$/g, "") || "pack";
      const payload = {
        exportedAtIso: generatedAtIso,
        appVersion: APP_VERSION,
        kind: "sftpTransferPolicyPack",
        pack
      };
      const exportText = `${JSON.stringify(payload, null, 2)}\n`;
      if (systemApi?.saveTextFile) {
        const result = await systemApi.saveTextFile({
          title: "Export Transfer Policy Pack",
          defaultFileName: `termdock-transfer-policy-pack-${fileSegment}-${generatedAtIso.replace(/[:]/g, "-")}.json`,
          text: exportText,
          filters: [{ name: "JSON", extensions: ["json"] }]
        });
        if (!result.canceled && result.outputPath) {
          await showAppAlert(`Transfer policy pack exported:\n${result.outputPath}`, {
            title: "Export Transfer Policy Pack"
          });
        }
        return;
      }
      const copied = await copyTextToClipboard(exportText);
      await showAppAlert(copied ? "Transfer policy pack JSON copied to clipboard." : exportText, {
        title: "Export Transfer Policy Pack",
        detailText: copied ? undefined : exportText
      });
    },
    [sftpTransferPolicyPacks, showAppAlert, systemApi]
  );

  const exportSftpTransferPolicyPacks = useCallback(async () => {
    if (sftpTransferPolicyPacks.length === 0) {
      await showAppAlert("No transfer policy packs available to export.", {
        title: "Export Transfer Policy Packs"
      });
      return;
    }
    const payload = createSftpTransferPolicyPacksPayload(sftpTransferPolicyPacks);
    const exportText = `${JSON.stringify(payload, null, 2)}\n`;
    if (systemApi?.saveTextFile) {
      const result = await systemApi.saveTextFile({
        title: "Export Transfer Policy Packs",
        defaultFileName: `termdock-transfer-policy-packs-${payload.exportedAtIso.replace(/[:]/g, "-")}.json`,
        text: exportText,
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
      if (!result.canceled && result.outputPath) {
        await showAppAlert(`Transfer policy packs exported:\n${result.outputPath}`, {
          title: "Export Transfer Policy Packs"
        });
      }
      return;
    }
    const copied = await copyTextToClipboard(exportText);
    await showAppAlert(copied ? "Transfer policy pack JSON copied to clipboard." : exportText, {
      title: "Export Transfer Policy Packs",
      detailText: copied ? undefined : exportText
    });
  }, [sftpTransferPolicyPacks, showAppAlert, systemApi]);

  const importSftpTransferPolicyPacks = useCallback(async () => {
    if (!systemApi?.pickAndReadTextFile) {
      await showAppAlert("File import is unavailable in this environment.", {
        title: "Import Transfer Policy Packs"
      });
      return;
    }
    const result = await systemApi.pickAndReadTextFile({
      title: "Import Transfer Policy Packs",
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (result.canceled || !result.text) {
      return;
    }
    const rawText = result.text.trim();
    if (!rawText) {
      await showAppAlert("Selected file is empty.", {
        title: "Import Transfer Policy Packs"
      });
      return;
    }
    try {
      const importedPacks = parseSftpTransferPolicyPacksText(rawText);
      if (importedPacks.length === 0) {
        await showAppAlert("No valid transfer policy packs found in the selected file.", {
          title: "Import Transfer Policy Packs"
        });
        return;
      }
      setSftpTransferPolicyPacks((prev) => mergeSftpTransferPolicyPacks(prev, importedPacks));
      await showAppAlert(
        `Imported ${importedPacks.length} transfer policy pack${importedPacks.length === 1 ? "" : "s"}.`,
        {
          title: "Import Transfer Policy Packs"
        }
      );
    } catch (caughtError) {
      await showAppAlert(`Invalid JSON format.\n${toLogMessage(caughtError)}`, {
        title: "Import Transfer Policy Packs"
      });
    }
  }, [showAppAlert, systemApi]);

  const pullSftpTransferPolicyPacksFromSync = useCallback(
    async (
      forceSelectFile = false,
      options?: {
        automatic?: boolean;
      }
    ) => {
      const automatic = options?.automatic === true;
      try {
        setSftpTransferPolicyPackSyncBusyAction("pull");
        let filePath = sftpTransferPolicyPackSyncState.filePath;
        let rawText = "";
        if (forceSelectFile || !filePath) {
          if (!systemApi?.pickAndReadTextFile) {
            throw new Error("System bridge unavailable. Restart `pnpm dev`.");
          }
          const selected = await systemApi.pickAndReadTextFile({
            title: "Pull Transfer Policy Packs From Sync File",
            buttonLabel: "Use File",
            filters: [
              { name: "JSON", extensions: ["json"] },
              { name: "All Files", extensions: ["*"] }
            ]
          });
          if (selected.canceled || !selected.filePath) {
            return false;
          }
          filePath = selected.filePath;
          rawText = typeof selected.text === "string" ? selected.text : "";
        } else {
          if (!systemApi?.readTextFileAtPath) {
            throw new Error("System bridge unavailable. Restart `pnpm dev`.");
          }
          rawText = await systemApi.readTextFileAtPath(filePath);
        }
        if (!rawText.trim()) {
          await showAppAlert("Selected sync file is empty.", {
            title: "Pull Transfer Policy Packs"
          });
          return false;
        }
        const importedPacks = parseSftpTransferPolicyPacksText(rawText);
        if (importedPacks.length === 0) {
          await showAppAlert("No valid transfer policy packs found in sync file.", {
            title: "Pull Transfer Policy Packs"
          });
          return false;
        }
        const pulledAtIso = new Date().toISOString();
        suppressNextSftpTransferPolicyPackAutoPushRef.current = true;
        setSftpTransferPolicyPacks((prev) => mergeSftpTransferPolicyPacks(prev, importedPacks));
        setSftpTransferPolicyPackSyncState((prev) => ({
          ...prev,
          filePath,
          lastPulledAtIso: pulledAtIso
        }));
        pushAppHintMessage(
          `${
            automatic ? "Auto-pulled" : "Pulled"
          } ${importedPacks.length} transfer policy pack${importedPacks.length === 1 ? "" : "s"} from sync file.`,
          {
            level: "info",
            durationMs: automatic ? 3200 : 4200
          }
        );
        if (!automatic) {
          await showAppAlert(
            `Pulled ${importedPacks.length} transfer policy pack${importedPacks.length === 1 ? "" : "s"} from:\n${filePath}`,
            {
              title: "Pull Transfer Policy Packs"
            }
          );
        }
        return true;
      } catch (caughtError) {
        const message = toLogMessage(caughtError);
        setError(message);
        if (automatic) {
          pushAppHintMessage("Automatic transfer policy pack pull failed. Check logs.", {
            level: "warn",
            durationMs: 5200
          });
        }
        writeAppLog(
          "error",
          "renderer:sftp-policy-packs",
          "Failed to pull transfer policy packs from sync file.",
          caughtError
        );
        return false;
      } finally {
        setSftpTransferPolicyPackSyncBusyAction(null);
      }
    },
    [
      pushAppHintMessage,
      sftpTransferPolicyPackSyncState.filePath,
      showAppAlert,
      systemApi,
      writeAppLog
    ]
  );

  const pushSftpTransferPolicyPacksToSync = useCallback(
    async (
      forceSelectFile = false,
      options?: {
        automatic?: boolean;
      }
    ) => {
      const automatic = options?.automatic === true;
      try {
        setSftpTransferPolicyPackSyncBusyAction("push");
        const payload = createSftpTransferPolicyPacksPayload(
          sftpTransferPolicyPacks,
          "sftpTransferPolicyPacksSync"
        );
        const exportText = `${JSON.stringify(payload, null, 2)}\n`;
        let filePath = sftpTransferPolicyPackSyncState.filePath;
        if (forceSelectFile || !filePath) {
          if (!systemApi?.saveTextFile) {
            throw new Error("System bridge unavailable. Restart `pnpm dev`.");
          }
          const result = await systemApi.saveTextFile({
            title: "Push Transfer Policy Packs To Sync File",
            defaultFileName: `termdock-transfer-policy-packs-sync-${payload.exportedAtIso.replace(/[:]/g, "-")}.json`,
            text: exportText,
            filters: [{ name: "JSON", extensions: ["json"] }]
          });
          if (result.canceled || !result.outputPath) {
            return false;
          }
          filePath = result.outputPath;
        } else {
          if (!systemApi?.writeTextFileAtPath) {
            throw new Error("System bridge unavailable. Restart `pnpm dev`.");
          }
          await systemApi.writeTextFileAtPath(filePath, exportText);
        }
        setSftpTransferPolicyPackSyncState((prev) => ({
          ...prev,
          filePath,
          lastPushedAtIso: payload.exportedAtIso
        }));
        sftpTransferPolicyPackAutoPullKeyRef.current = filePath;
        lastSftpTransferPolicyPackAutoPushSignatureRef.current =
          createSftpTransferPolicyPacksSignature(sftpTransferPolicyPacks);
        pushAppHintMessage(
          `${
            automatic ? "Auto-pushed" : "Pushed"
          } ${sftpTransferPolicyPacks.length} transfer policy pack${sftpTransferPolicyPacks.length === 1 ? "" : "s"} to sync file.`,
          {
            level: "info",
            durationMs: automatic ? 3200 : 4200
          }
        );
        if (!automatic) {
          await showAppAlert(
            `Pushed ${sftpTransferPolicyPacks.length} transfer policy pack${sftpTransferPolicyPacks.length === 1 ? "" : "s"} to:\n${filePath}`,
            {
              title: "Push Transfer Policy Packs"
            }
          );
        }
        return true;
      } catch (caughtError) {
        const message = toLogMessage(caughtError);
        setError(message);
        if (automatic) {
          pushAppHintMessage("Automatic transfer policy pack push failed. Check logs.", {
            level: "warn",
            durationMs: 5200
          });
        }
        writeAppLog(
          "error",
          "renderer:sftp-policy-packs",
          "Failed to push transfer policy packs to sync file.",
          caughtError
        );
        return false;
      } finally {
        setSftpTransferPolicyPackSyncBusyAction(null);
      }
    },
    [
      pushAppHintMessage,
      sftpTransferPolicyPackSyncState.filePath,
      sftpTransferPolicyPacks,
      showAppAlert,
      systemApi,
      writeAppLog
    ]
  );

  const changeSftpTransferPolicyPackSyncTarget = useCallback(async () => {
    setSftpTransferPolicyPackSyncBusyAction("change");
    try {
      const choice = await showAppChoice(
        "Choose a shared sync file for transfer policy packs.",
        [
          {
            value: "existing",
            label: "Use Existing File"
          },
          {
            value: "new",
            label: "Create New File"
          }
        ],
        {
          title: "Change Transfer Policy Sync File",
          cancelLabel: "Cancel",
          detailText:
            "Using an existing file pulls and merges packs into the local catalog. Creating a new file writes the current local pack catalog to a shared JSON file."
        }
      );
      if (choice === "existing") {
        await pullSftpTransferPolicyPacksFromSync(true);
      } else if (choice === "new") {
        await pushSftpTransferPolicyPacksToSync(true);
      }
    } finally {
      setSftpTransferPolicyPackSyncBusyAction((current) =>
        current === "change" ? null : current
      );
    }
  }, [pullSftpTransferPolicyPacksFromSync, pushSftpTransferPolicyPacksToSync, showAppChoice]);

  const clearSftpTransferPolicyPackSyncTarget = useCallback(async () => {
    if (!sftpTransferPolicyPackSyncState.filePath) {
      return;
    }
    const confirmed = await showAppConfirm(
      "Clear the current transfer policy sync file?\nThis only removes the local link. The shared JSON file will stay on disk.",
      {
        title: "Clear Transfer Policy Sync File",
        confirmLabel: "Clear",
        cancelLabel: "Cancel"
      }
    );
    if (!confirmed) {
      return;
    }
    setSftpTransferPolicyPackSyncState({
      filePath: "",
      lastPulledAtIso: null,
      lastPushedAtIso: null,
      autoPullOnLaunch: sftpTransferPolicyPackSyncState.autoPullOnLaunch,
      autoPushOnChange: sftpTransferPolicyPackSyncState.autoPushOnChange
    });
    sftpTransferPolicyPackAutoPullKeyRef.current = null;
    pushAppHintMessage("Cleared transfer policy sync file.", {
      level: "info",
      durationMs: 4200
    });
  }, [
    pushAppHintMessage,
    sftpTransferPolicyPackSyncState.autoPullOnLaunch,
    sftpTransferPolicyPackSyncState.autoPushOnChange,
    sftpTransferPolicyPackSyncState.filePath,
    showAppConfirm
  ]);

  const setSftpTransferPolicyPackAutoPullOnLaunch = (enabled: boolean) => {
    setSftpTransferPolicyPackSyncState((prev) => ({
      ...prev,
      autoPullOnLaunch: enabled
    }));
  };

  const setSftpTransferPolicyPackAutoPushOnChange = (enabled: boolean) => {
    setSftpTransferPolicyPackSyncState((prev) => ({
      ...prev,
      autoPushOnChange: enabled
    }));
  };

  useEffect(() => {
    return () => {
      if (sftpTransferPolicyPackAutoPushDebounceTimerRef.current !== null) {
        window.clearTimeout(sftpTransferPolicyPackAutoPushDebounceTimerRef.current);
        sftpTransferPolicyPackAutoPushDebounceTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!systemApi || !sftpTransferPolicyPackSyncState.autoPullOnLaunch) {
      sftpTransferPolicyPackAutoPullKeyRef.current = null;
      return;
    }
    const filePath = sftpTransferPolicyPackSyncState.filePath.trim();
    if (!filePath) {
      sftpTransferPolicyPackAutoPullKeyRef.current = null;
      return;
    }
    if (sftpTransferPolicyPackAutoPullKeyRef.current === filePath) {
      return;
    }
    sftpTransferPolicyPackAutoPullKeyRef.current = filePath;
    void pullSftpTransferPolicyPacksFromSync(false, { automatic: true });
  }, [
    pullSftpTransferPolicyPacksFromSync,
    sftpTransferPolicyPackSyncState.autoPullOnLaunch,
    sftpTransferPolicyPackSyncState.filePath,
    systemApi
  ]);

  useEffect(() => {
    const packsSignature = createSftpTransferPolicyPacksSignature(sftpTransferPolicyPacks);
    if (!sftpTransferPolicyPackHydratedRef.current) {
      sftpTransferPolicyPackHydratedRef.current = true;
      lastSftpTransferPolicyPackAutoPushSignatureRef.current = packsSignature;
      return;
    }
    if (sftpTransferPolicyPackAutoPushDebounceTimerRef.current !== null) {
      window.clearTimeout(sftpTransferPolicyPackAutoPushDebounceTimerRef.current);
      sftpTransferPolicyPackAutoPushDebounceTimerRef.current = null;
    }
    if (
      !systemApi ||
      !sftpTransferPolicyPackSyncState.autoPushOnChange ||
      !sftpTransferPolicyPackSyncState.filePath.trim() ||
      sftpTransferPolicyPackSyncBusyAction !== null
    ) {
      return;
    }
    if (suppressNextSftpTransferPolicyPackAutoPushRef.current) {
      suppressNextSftpTransferPolicyPackAutoPushRef.current = false;
      lastSftpTransferPolicyPackAutoPushSignatureRef.current = packsSignature;
      return;
    }
    if (lastSftpTransferPolicyPackAutoPushSignatureRef.current === packsSignature) {
      return;
    }
    sftpTransferPolicyPackAutoPushDebounceTimerRef.current = window.setTimeout(() => {
      sftpTransferPolicyPackAutoPushDebounceTimerRef.current = null;
      void pushSftpTransferPolicyPacksToSync(false, { automatic: true });
    }, 800);
    return () => {
      if (sftpTransferPolicyPackAutoPushDebounceTimerRef.current !== null) {
        window.clearTimeout(sftpTransferPolicyPackAutoPushDebounceTimerRef.current);
        sftpTransferPolicyPackAutoPushDebounceTimerRef.current = null;
      }
    };
  }, [
    pushSftpTransferPolicyPacksToSync,
    sftpTransferPolicyPackSyncBusyAction,
    sftpTransferPolicyPackSyncState.autoPushOnChange,
    sftpTransferPolicyPackSyncState.filePath,
    sftpTransferPolicyPacks,
    systemApi
  ]);

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

  const dismissFirstRunOnboarding = useCallback(() => {
    setIsFirstRunOnboardingDismissed(true);
  }, []);

  const openFirstRunSecurityNotes = useCallback(() => {
    void showAppAlert(
      [
        tr("TermDock is a local-first desktop app. It does not require a cloud account to manage servers."),
        "",
        tr("Session data and diagnostics are stored locally. Session and group exports exclude decrypted credentials."),
        "",
        tr("Before sharing logs or bug reports, review the generated files and remove private hosts, usernames, tokens, paths, and credentials.")
      ].join("\n"),
      {
        title: "Security Notes",
        detailText: "Full notes are available in SECURITY.md and SECURITY.zh-CN.md in the repository."
      }
    );
  }, [showAppAlert, tr]);

  const closeSettingsPanel = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const dismissGlobalError = useCallback(() => {
    setError(null);
  }, []);

  const openConnectionSettingsFromError = useCallback(() => {
    openSettingsPanel("connection");
  }, [openSettingsPanel]);

  const openFileOpeningSettingsFromError = useCallback(() => {
    openSettingsPanel("fileOpening");
  }, [openSettingsPanel]);

  const openHotkeysSettingsFromError = useCallback(() => {
    openSettingsPanel("hotkeys");
  }, [openSettingsPanel]);

  const openSftpSettingsFromError = useCallback(() => {
    openSettingsPanel("sftp");
  }, [openSettingsPanel]);

  const openPortForwardingSettingsFromError = useCallback(() => {
    openSettingsPanel("portForwarding");
  }, [openSettingsPanel]);

  const openSafetySettingsFromError = useCallback(() => {
    openSettingsPanel("safety");
  }, [openSettingsPanel]);

  const openWorkspaceSettingsFromError = useCallback(() => {
    openSettingsPanel("workspace");
  }, [openSettingsPanel]);

  const openServerHealthSettingsFromError = useCallback(() => {
    openSettingsPanel("serverHealth");
  }, [openSettingsPanel]);

  const openDiagnosticsFromError = useCallback(() => {
    openSettingsPanel("diagnostics");
  }, [openSettingsPanel]);

  const openRetryCenterFromError = useCallback(() => {
    setIsRetryCenterOpen(true);
  }, []);

  const openOperationCenterFromError = useCallback(() => {
    setIsOperationCenterOpen(true);
  }, []);

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
        canOpenRetryCenter: false,
        canOpenOperationCenter: false,
        canExportBugReport: false,
        settingsAction: null as SettingsSectionId | null,
        hint: ""
      };
    }
    const reconnectLike = isReconnectRecoverableError(message);
    const bridgeLike = isBridgeUnavailableError(message);
    const clipboardLike = isClipboardUnavailableError(message);
    const openerLike = isPreferredOpenerConfigurationError(message);
    const hotkeyLike = isHotkeyRecoverableError(message);
    const portForwardLike = isPortForwardRecoverableError(message);
    const safetyLike = isSafetyRecoverableError(message);
    const workspaceLike = isWorkspaceRecoverableError(message);
    const serverHealthLike = isServerHealthRecoverableError(message);
    const diagnosticsLike = isDiagnosticsRecoverableError(message);
    const transferReason = resolveTransferRecoveryReasonForError(message);
    const canReconnect =
      reconnectLike &&
      !!terminalApi &&
      !!activeTabId &&
      !!activeSessionId &&
      !isActiveTabConnected;
    const canOpenRetryCenter =
      !!transferReason && transferHistory.some((entry) => entry.status === "failed");
    const canOpenOperationCenter = !!(
      (transferReason || reconnectLike || portForwardLike) &&
      hasOperationCenterActivity
    );
    const canExportBugReport = !!(
      bridgeLike ||
      transferReason ||
      portForwardLike ||
      diagnosticsLike ||
      serverHealthLike
    );
    let settingsAction: SettingsSectionId | null = null;
    if (openerLike) {
      settingsAction = "fileOpening";
    } else if (hotkeyLike) {
      settingsAction = "hotkeys";
    } else if (safetyLike) {
      settingsAction = "safety";
    } else if (workspaceLike) {
      settingsAction = "workspace";
    } else if (portForwardLike) {
      settingsAction = "portForwarding";
    } else if (serverHealthLike) {
      settingsAction = "serverHealth";
    } else if (transferReason) {
      settingsAction = "sftp";
    } else if (reconnectLike && !canReconnect) {
      settingsAction = "connection";
    } else if (diagnosticsLike) {
      settingsAction = "diagnostics";
    }
    let hint = "";
    if (openerLike) {
      hint =
        "Preferred file opener looks invalid. Open File Opening settings and fix the configured command or path.";
    } else if (hotkeyLike) {
      hint =
        "Hotkey import or shortcut configuration issue detected. Open Hotkeys to review conflicts or re-import a valid file.";
    } else if (safetyLike) {
      hint =
        "Safety guardrail or shared-bundle issue detected. Open Safety to review policy packs, templates, sync file, or approvals.";
    } else if (workspaceLike) {
      hint =
        "Workspace profile issue detected. Open Workspace to review the active profile and Safety sync defaults.";
    } else if (portForwardLike) {
      hint = canOpenOperationCenter
        ? "Port-forwarding issue detected. Review bind/target settings, then check Operation Center for affected work."
        : "Port-forwarding issue detected. Review bind/target settings and active forwards in Port Fwd settings.";
    } else if (serverHealthLike) {
      hint =
        "Server health collection issue detected. Open Monitor settings to review alert thresholds, then use Diagnostics if the remote command keeps failing.";
    } else if (transferReason) {
      hint = getTransferFailureSuggestion(transferReason) ?? "";
      if (canOpenRetryCenter) {
        hint = hint
          ? `${hint} Retry Center can requeue failed items after the root cause is fixed.`
          : "Retry Center can requeue failed items after the root cause is fixed.";
      }
    } else if (diagnosticsLike) {
      hint = canExportBugReport
        ? "Diagnostics issue detected. Open Diagnostics, export a bug report, or copy the error for handoff."
        : "Diagnostics issue detected. Open Diagnostics or copy the error for handoff.";
    } else if (bridgeLike) {
      hint = "Bridge/runtime issue detected. Open logs or export a bug report.";
    } else if (reconnectLike) {
      hint = canOpenOperationCenter
        ? "Connection issue detected. Reconnect may recover quickly. Operation Center can show interrupted work."
        : "Connection issue detected. Reconnect may recover quickly.";
    } else if (clipboardLike) {
      hint =
        "Clipboard is unavailable in the current environment. Use the manual-copy fallback from the active workflow.";
    }
    return {
      canReconnect,
      canOpenLogs: !!(systemApi?.openLocalPath && systemApi.getLogInfo),
      canCopyLatestDisconnectReport: disconnectReports.length > 0,
      canOpenRetryCenter,
      canOpenOperationCenter,
      canExportBugReport,
      settingsAction,
      hint
    };
  }, [
    activeSessionId,
    activeTabId,
    hasOperationCenterActivity,
    disconnectReports.length,
    error,
    isActiveTabConnected,
    transferHistory,
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
    let operationJobId: string | null = null;
    try {
      if (!systemApi?.exportBugReport) {
        throw new Error("Bug report bridge unavailable. Restart `pnpm dev`.");
      }
      setIsExportingBugReport(true);
      operationJobId = startOperationCenterAppJob({
        category: "diagnostics",
        title: "Bug Report Export",
        description: "Bundling logs, runtime metadata, and disconnect-report context."
      });
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
        if (operationJobId) {
          removeOperationCenterAppJob(operationJobId);
        }
        return;
      }
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "succeeded", {
          detail: `Exported bug report bundle with ${disconnectReports.length} disconnect report${disconnectReports.length === 1 ? "" : "s"}.`,
          outputPath: result.outputPath
        });
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
      if (operationJobId) {
        finishOperationCenterAppJob(operationJobId, "failed", {
          detail: message
        });
      }
      setError(message);
      writeAppLog("error", "renderer:diagnostics", "Failed to export bug report.", caughtError);
    } finally {
      setIsExportingBugReport(false);
    }
  }, [
    activeTabId,
    connectionPreferences,
    disconnectReports,
    finishOperationCenterAppJob,
    fileOpenPreferences,
    hotkeyPreferences,
    removeOperationCenterAppJob,
    selectedSessionId,
    serverHealthAlertPreferences,
    sessionGroupOptions.length,
    sessionSortMode,
    sessions.length,
    sftpTransferPreferences,
    showAppAlert,
    startOperationCenterAppJob,
    systemApi,
    terminalTabs.length,
    writeAppLog
  ]);

  const exportBugReportFromError = useCallback(() => {
    void exportBugReportBundle();
  }, [exportBugReportBundle]);
  const setDisconnectReportCaptureEnabled = useCallback((enabled: boolean) => {
    setDisconnectReportCapturePreferences({
      enabled
    });
  }, []);
  const setDisconnectReportQueryValue = useCallback((value: string) => {
    setDisconnectReportQuery(value.slice(0, 160));
  }, []);
  const {
    clearDisconnectReportsHistory,
    clearVisibleDisconnectReportsHistory,
    copyDisconnectReportJson,
    copyLatestDisconnectReport,
    copyLatestVisibleDisconnectReport,
    copyVisibleDisconnectReportJsonById,
    exportDisconnectReportsCsv,
    exportDisconnectReportsJson,
    focusVisibleDisconnectReportTab
  } = useDisconnectDiagnosticsActions({
    appVersion: APP_VERSION,
    classifyTransferFailureReason,
    clearDisconnectReportFingerprintsForTabIds,
    copyTextToClipboard,
    disconnectReports,
    escapeCsvCell,
    hasCustomizedDisconnectReportView,
    setActiveTabId,
    setDisconnectReports,
    setError,
    showAppAlert,
    showAppConfirm,
    systemApi,
    toLogMessage,
    visibleDisconnectReports,
    writeAppLog
  });

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
      const authLabel = session.authType === "privateKey" ? tr("Private Key") : tr("Password");
      const credentialLabel = session.hasSecret ? tr("Stored in secure vault") : "-";
      const lines = [
        `${tr("Name")}: ${session.name}`,
        `${tr("Group")}: ${session.groupId?.trim() || tr("Ungrouped")}`,
        `${tr("Target")}: ${session.username}@${session.host}:${session.port}`,
        `${tr("Auth")}: ${authLabel}`,
        `${tr("Credential")}: ${credentialLabel}`,
        session.authType === "privateKey"
          ? `${tr("Private Key Path")}: ${session.privateKeyPath?.trim() || "-"}`
          : null,
        `${tr("Favorite")}: ${session.favorite ? tr("Yes") : tr("No")}`,
        `${tr("Last Connected")}: ${formatSessionLastConnected(session.lastConnectedAt)}`,
        `${tr("Created At")}: ${formatSessionLastConnected(session.createdAt)}`,
        `${tr("Updated At")}: ${formatSessionLastConnected(session.updatedAt)}`,
        `${tr("Remark")}: ${session.remark || "-"}`
      ].filter((line): line is string => Boolean(line));
      await showAppAlert("Session details", {
        title: "Session Details",
        confirmLabel: "Close",
        detailText: lines.join("\n")
      });
    },
    [showAppAlert, tr]
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
      let prepared = await systemApi.prepareRemoteOpenFile(
        activeTabId,
        targetEntry.path,
        targetEntry.name
      );
      if (prepared.reuseState === "reuse-local-draft") {
        const hasSyncInFlight = prepared.localDraftState === "syncing";
        const choice = await showAppChoice(
          hasSyncInFlight
            ? "A local draft for this remote file is still syncing. Reopen the existing draft instead of creating another temp copy."
            : "A local draft for this remote file already exists. Decide whether to reopen the draft or discard it and reload the current remote file.",
          hasSyncInFlight
            ? [
                {
                  value: "reuse",
                  label: "Use Local Draft"
                }
              ]
            : [
                {
                  value: "reuse",
                  label: "Use Local Draft"
                },
                {
                  value: "reload",
                  label: "Discard Draft + Reload",
                  danger: true
                }
              ],
          {
            title: "Remote File Already Open",
            cancelLabel: "Cancel",
            detailText: [
              `Remote: ${targetEntry.path}`,
              `Local draft: ${prepared.localPath}`,
              `Draft state: ${hasSyncInFlight ? "Syncing pending changes" : "Modified locally"}`
            ].join("\n")
          }
        );
        if (!choice) {
          return;
        }
        if (choice === "reload") {
          prepared = await systemApi.prepareRemoteOpenFile(activeTabId, targetEntry.path, targetEntry.name, {
            discardLocalChanges: true
          });
        }
      }
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
        clearRemoteOpenFileIssue(activeTabId);
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

      await runWithConcurrencyLimit(
        Array.from(remoteDirectoryEntries.values()),
        SFTP_UPLOAD_CONFLICT_SCAN_CONCURRENCY,
        async (directory) => {
          await getKnownRemoteNames(directory);
        }
      );

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
      void prewarmRemoteDirectoriesForUpload(
        tabId,
        queuedJobs.map((job) => job.remoteDirectory)
      ).catch(() => {
        // Upload workers will surface the real error if directory prep fails.
      });
      drainUploadQueue();
      return queuedJobs.length;
    },
    [applySftpTransferEvent, drainUploadQueue, prewarmRemoteDirectoriesForUpload]
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
      void prewarmRemoteDirectoriesForUpload(
        tabId,
        queuedJobs.map((job) => job.remoteDirectory)
      ).catch(() => {
        // Upload workers will surface the real error if directory prep fails.
      });
      drainUploadQueue();
      return queuedJobs.length;
    },
    [applySftpTransferEvent, drainUploadQueue, prewarmRemoteDirectoriesForUpload]
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
        syncScheduledTransferPauseState();
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
        syncScheduledTransferPauseState();
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
      setSchedulePausedUploadTabs((prev) => {
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
        syncScheduledTransferPauseState();
        drainUploadQueue();
        return;
      }
      await Promise.allSettled(
        Array.from(transferIdsToCancel).map((transferId) =>
          sftpApi.cancelUpload(normalizedTabId, transferId)
        )
      );
      syncScheduledTransferPauseState();
      drainUploadQueue();
    },
    [
      applySftpTransferEvent,
      drainUploadQueue,
      sftpApi,
      sftpTransfers,
      syncScheduledTransferPauseState,
      uploadBatchByTab
    ]
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
      setSchedulePausedDownloadTabs((prev) => {
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
        syncScheduledTransferPauseState();
        drainDownloadQueue();
        return;
      }
      await Promise.allSettled(
        Array.from(transferIdsToCancel).map((transferId) =>
          sftpApi.cancelDownload(normalizedTabId, transferId)
        )
      );
      syncScheduledTransferPauseState();
      drainDownloadQueue();
    },
    [
      applySftpTransferEvent,
      downloadBatchByTab,
      drainDownloadQueue,
      sftpApi,
      sftpTransfers,
      syncScheduledTransferPauseState
    ]
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

  const {
    clearPendingTransferRestoreQueue,
    discardPendingTransferRestoreQueue,
    restorePendingTransferRestoreQueue
  } = usePendingTransferRestoreRuntime({
    activeTabId,
    arePendingTransferRestoreItemsEqual,
    collectPendingTransferRestoreSnapshot,
    enqueueDownloadTargets,
    enqueueUploadTargets,
    openTerminalTab,
    pendingTransferRestoreItems,
    pendingTransferRestoreResolved,
    sessionsRef,
    setPendingTransferRestoreItems,
    setPendingTransferRestoreResolved,
    sftpTransfersDependency: sftpTransfers,
    showAppAlert,
    showAppConfirm,
    showTransferDockNotice,
    storageKey: SFTP_TRANSFER_PENDING_RESTORE_STORAGE_KEY,
    terminalTabsDependency: terminalTabs,
    terminalTabsRef
  });

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
  const openDiagnosticsFromOperationCenter = useCallback(() => {
    closeOperationCenter();
    openSettingsPanel("diagnostics");
  }, [closeOperationCenter, openSettingsPanel]);
  const openCommandSnippetManagerFromOperationCenter = useCallback(() => {
    closeOperationCenter();
    openCommandSnippetManager();
  }, [closeOperationCenter, openCommandSnippetManager]);
  const copyOperationCenterAppJobOutputPath = useCallback(
    async (jobId: string) => {
      const job = operationCenterAppJobs.find((entry) => entry.id === jobId) ?? null;
      const outputPath = job?.outputPath?.trim() ?? "";
      if (!outputPath) {
        return;
      }
      try {
        const copied = await copyTextToClipboard(outputPath);
        await showAppAlert(
          copied
            ? `Output path copied to clipboard.\n${outputPath}`
            : `Clipboard unavailable.\n${outputPath}`,
          {
            title: "Operation Center"
          }
        );
      } catch (caughtError) {
        const message = toLogMessage(caughtError);
        setError(message);
        writeAppLog(
          "error",
          "renderer:operation-center",
          "Failed to copy tracked app-job output path.",
          caughtError
        );
      }
    },
    [operationCenterAppJobs, showAppAlert, writeAppLog]
  );

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
        const exportEntry = retryCenterVisibleExportEntryByKey.get(entry.key);
        return {
          key: entry.key,
          sessionId: entry.sessionId,
          sessionName: exportEntry?.sessionName ?? entry.sessionId,
          groupName: exportEntry?.groupName ?? "Unknown",
          direction: entry.direction,
          status: entry.status,
          name: entry.name,
          localPath: entry.localPath,
          remotePath: entry.remotePath,
          attemptCount: entry.attemptCount,
          updatedAt: entry.updatedAt,
          updatedAtIso: exportEntry?.updatedAtIso ?? toIsoTimestamp(entry.updatedAt),
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
        const exportEntry = retryCenterVisibleExportEntryByKey.get(entry.key);
        lines.push(
          [
            entry.key,
            entry.sessionId,
            exportEntry?.sessionName ?? entry.sessionId,
            exportEntry?.groupName ?? "Unknown",
            entry.direction,
            entry.status,
            entry.name,
            entry.localPath,
            entry.remotePath,
            entry.attemptCount,
            entry.updatedAt,
            exportEntry?.updatedAtIso ?? toIsoTimestamp(entry.updatedAt),
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
      label: tr(sessionSortMode === "default" ? "Sort: Default (Current)" : "Sort: Default"),
      run: () => {
        setSessionSortMode("default");
      }
    });
    actions.push({
      id: "sort-recent",
      label: tr(sessionSortMode === "recent" ? "Sort: Recent (Current)" : "Sort: Recent"),
      run: () => {
        setSessionSortMode("recent");
      }
    });
    actions.push({
      id: "sort-name-asc",
      label: tr(sessionSortMode === "nameAsc" ? "Sort: Name A-Z (Current)" : "Sort: Name A-Z"),
      run: () => {
        setSessionSortMode("nameAsc");
      }
    });
    actions.push({
      id: "sort-name-desc",
      label: tr(sessionSortMode === "nameDesc" ? "Sort: Name Z-A (Current)" : "Sort: Name Z-A"),
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
      label: tr(selectedCount > 1 ? `Open ${selectedCount} Selected Tabs` : "Open Terminal Tab"),
      run: () => {
        for (const session of sessionsForActions) {
          openTerminalTab(session);
        }
      }
    });
    if (selectedCount === 1) {
      sessionContextActions.push({
        id: "view-session",
        label: tr("View Details"),
        run: () => {
          void viewSessionDetails(sessionContextTarget);
        }
      });
      sessionContextActions.push({
        id: "toggle-favorite",
        label: tr(sessionContextTarget.favorite ? "Unfavorite" : "Favorite"),
        run: () => {
          void patchSession(sessionContextTarget.id, {
            favorite: !sessionContextTarget.favorite
          });
        }
      });
      sessionContextActions.push({
        id: "copy-clash-rules",
        label: tr("Copy Clash Direct Rules"),
        run: () => {
          void copyClashDirectRules(sessionContextTarget);
        }
      });
      sessionContextActions.push({
        id: "copy-ssh-command",
        label: tr("Copy SSH Command"),
        run: () => {
          void copySessionConnectionCommand(sessionContextTarget);
        }
      });
      sessionContextActions.push({
        id: "edit-session",
        label: tr("Edit Session"),
        run: () => {
          openEditModal(sessionContextTarget);
        }
      });
      sessionContextActions.push({
        id: "duplicate-session",
        label: tr("Duplicate Session"),
        run: () => {
          openDuplicateSessionModal(sessionContextTarget);
        }
      });
      sessionContextActions.push({
        id: "save-session-template",
        label: tr("Save as Session Template..."),
        run: () => {
          openSessionTemplateManager({
            sourceForm: toFormFromSession(sessionContextTarget)
          });
        }
      });
      sessionContextActions.push({
        id: "run-quick-profile",
        label:
          sessionQuickProfiles.length > 0
            ? tr(`Run Quick Profile... (${sessionQuickProfiles.length})`)
            : tr("Run Quick Profile..."),
        disabled: sessionQuickProfiles.length === 0,
        run: () => {
          void runSessionQuickProfileChooser(sessionContextTarget);
        }
      });
      sessionContextActions.push({
        id: "create-quick-profile",
        label: tr("Save Quick Profile..."),
        run: () => {
          void createSessionQuickProfileForSession(sessionContextTarget);
        }
      });
      sessionContextActions.push({
        id: "manage-quick-profile",
        label: tr("Manage Quick Profiles..."),
        run: () => {
          void manageSessionQuickProfilesForSession(sessionContextTarget);
        }
      });
    }
    sessionContextActions.push({
      id: "move-session-group",
      label: tr(selectedCount > 1 ? "Move Selected to Group..." : "Move to Group..."),
      run: () => {
        openMoveSessionsToGroupDialog(selectedIds);
      }
    });
    sessionContextActions.push({
      id: "move-session-ungrouped",
      label: tr(selectedCount > 1 ? "Move Selected to Ungrouped" : "Move to Ungrouped"),
      run: () => {
        void assignSessionsToGroup(selectedIds, "");
      }
    });
    sessionContextActions.push({
      id: "delete-session",
      label: tr(selectedCount > 1 ? `Delete ${selectedCount} Selected` : "Delete Session"),
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
      label: tr("Open Group"),
      run: () => {
        setSelectedGroupKeys([contextTarget.groupKey]);
        setActiveSessionGroupKey(contextTarget.groupKey);
      }
    });
    sessionContextActions.push({
      id: "new-session",
      label: tr("New Session"),
      run: () => {
        openCreateModal(contextTarget.groupName);
      }
    });
    sessionContextActions.push({
      id: "new-session-from-template",
      label:
        sessionTemplates.length > 0
          ? tr(`New Session From Template... (${sessionTemplates.length})`)
          : tr("New Session From Template..."),
      disabled: sessionTemplates.length === 0,
      run: () => {
        void chooseSessionTemplateAndApply({
          openCreateModal: true,
          groupId: contextTarget.groupName,
          forceNewSession: true
        });
      }
    });
    sessionContextActions.push({
      id: "manage-session-templates",
      label: tr("Manage Session Templates..."),
      run: () => {
        openSessionTemplateManager();
      }
    });
    sessionContextActions.push({
      id: "import-ssh-config",
      label: tr("Import SSH Config..."),
      run: () => {
        void importSessionsFromSshConfig();
      }
    });
    sessionContextActions.push({
      id: "import-sessions-json",
      label: tr("Import Sessions JSON..."),
      run: () => {
        void importSessionsFromJson();
      }
    });
    sessionContextActions.push({
      id: "import-encrypted-migration",
      label: tr("Import Encrypted Migration..."),
      run: () => {
        void importEncryptedSessionMigration();
      }
    });
    sessionContextActions.push({
      id: "export-all-sessions",
      label: tr("Export All Sessions..."),
      run: () => {
        void exportAllSessionsWithGroups();
      }
    });
    sessionContextActions.push({
      id: "export-encrypted-migration",
      label: tr("Export Encrypted Migration..."),
      run: () => {
        void exportEncryptedSessionMigration();
      }
    });
    sessionContextActions.push({
      id: "export-all-groups",
      label: tr("Export All Groups..."),
      run: () => {
        void exportAllSessionGroups();
      }
    });
    sessionContextActions.push({
      id: "new-group",
      label: tr("New Group"),
      run: () => {
        void promptCreateSessionGroup();
      }
    });
    sessionContextActions.push({
      id: "select-all-groups",
      label: tr("Select All Groups"),
      disabled: groupedSessions.length === 0,
      run: () => {
        setSelectedGroupKeys(groupedSessions.map((group) => group.key));
      }
    });
    sessionContextActions.push({
      id: "clear-group-selection",
      label: tr("Clear Group Selection"),
      disabled: selectedGroupKeys.length === 0,
      run: () => {
        setSelectedGroupKeys([]);
      }
    });
    sessionContextActions.push({
      id: "rename-group",
      label:
        groupNamesForActions.length > 1
          ? tr("Rename Group (Select One)")
          : tr("Rename Group"),
      disabled: groupNamesForActions.length !== 1,
      run: () => {
        void renameSessionGroup(groupNamesForActions[0]);
      }
    });
    sessionContextActions.push({
      id: "delete-group",
      label:
        groupNamesForActions.length > 1
          ? tr(`Delete ${groupNamesForActions.length} Selected Groups`)
          : tr("Delete Group"),
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
      label: tr("New Group"),
      run: () => {
        void promptCreateSessionGroup();
      }
    });
    sessionContextActions.push({
      id: "new-session",
      label: tr("New Session"),
      run: () => {
        openCreateModal("");
      }
    });
    sessionContextActions.push({
      id: "new-session-from-template",
      label:
        sessionTemplates.length > 0
          ? tr(`New Session From Template... (${sessionTemplates.length})`)
          : tr("New Session From Template..."),
      disabled: sessionTemplates.length === 0,
      run: () => {
        void chooseSessionTemplateAndApply({
          openCreateModal: true,
          forceNewSession: true
        });
      }
    });
    sessionContextActions.push({
      id: "manage-session-templates",
      label: tr("Manage Session Templates..."),
      run: () => {
        openSessionTemplateManager();
      }
    });
    sessionContextActions.push({
      id: "import-ssh-config",
      label: tr("Import SSH Config..."),
      run: () => {
        void importSessionsFromSshConfig();
      }
    });
    sessionContextActions.push({
      id: "import-sessions-json",
      label: tr("Import Sessions JSON..."),
      run: () => {
        void importSessionsFromJson();
      }
    });
    sessionContextActions.push({
      id: "import-encrypted-migration",
      label: tr("Import Encrypted Migration..."),
      run: () => {
        void importEncryptedSessionMigration();
      }
    });
    sessionContextActions.push({
      id: "export-all-sessions",
      label: tr("Export All Sessions..."),
      run: () => {
        void exportAllSessionsWithGroups();
      }
    });
    sessionContextActions.push({
      id: "export-encrypted-migration",
      label: tr("Export Encrypted Migration..."),
      run: () => {
        void exportEncryptedSessionMigration();
      }
    });
    sessionContextActions.push({
      id: "export-all-groups",
      label: tr("Export All Groups..."),
      run: () => {
        void exportAllSessionGroups();
      }
    });
    sessionContextActions.push({
      id: "select-all-groups",
      label: tr("Select All Groups"),
      disabled: groupedSessions.length === 0,
      run: () => {
        setSelectedGroupKeys(groupedSessions.map((group) => group.key));
      }
    });
    sessionContextActions.push({
      id: "clear-group-selection",
      label: tr("Clear Group Selection"),
      disabled: selectedGroupKeys.length === 0,
      run: () => {
        setSelectedGroupKeys([]);
      }
    });
    sessionContextActions.push({
      id: "rename-selected-group",
      label: tr("Rename Selected Group"),
      disabled: selectedGroupNames.length !== 1,
      run: () => {
        void renameSessionGroup(selectedGroupNames[0]);
      }
    });
    sessionContextActions.push({
      id: "delete-selected-groups",
      label:
        selectedGroupNames.length > 1
          ? tr(`Delete ${selectedGroupNames.length} Selected Groups`)
          : tr("Delete Selected Group"),
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
      label: tr("Back to Groups"),
      run: () => {
        setActiveSessionGroupKey(null);
      }
    });
    sessionContextActions.push({
      id: "new-session",
      label: tr("New Session"),
      run: () => {
        openCreateModal(contextTarget.groupName);
      }
    });
    sessionContextActions.push({
      id: "new-session-from-template",
      label:
        sessionTemplates.length > 0
          ? tr(`New Session From Template... (${sessionTemplates.length})`)
          : tr("New Session From Template..."),
      disabled: sessionTemplates.length === 0,
      run: () => {
        void chooseSessionTemplateAndApply({
          openCreateModal: true,
          groupId: contextTarget.groupName,
          forceNewSession: true
        });
      }
    });
    sessionContextActions.push({
      id: "manage-session-templates",
      label: tr("Manage Session Templates..."),
      run: () => {
        openSessionTemplateManager();
      }
    });
    sessionContextActions.push({
      id: "import-ssh-config",
      label: tr("Import SSH Config..."),
      run: () => {
        void importSessionsFromSshConfig();
      }
    });
    sessionContextActions.push({
      id: "import-sessions-json",
      label: tr("Import Sessions JSON..."),
      run: () => {
        void importSessionsFromJson();
      }
    });
    sessionContextActions.push({
      id: "import-encrypted-migration",
      label: tr("Import Encrypted Migration..."),
      run: () => {
        void importEncryptedSessionMigration();
      }
    });
    sessionContextActions.push({
      id: "export-all-sessions",
      label: tr("Export All Sessions..."),
      run: () => {
        void exportAllSessionsWithGroups();
      }
    });
    sessionContextActions.push({
      id: "export-encrypted-migration",
      label: tr("Export Encrypted Migration..."),
      run: () => {
        void exportEncryptedSessionMigration();
      }
    });
    sessionContextActions.push({
      id: "export-all-groups",
      label: tr("Export All Groups..."),
      run: () => {
        void exportAllSessionGroups();
      }
    });
    sessionContextActions.push({
      id: "new-group",
      label: tr("New Group"),
      run: () => {
        void promptCreateSessionGroup();
      }
    });
    if (contextTarget.groupName) {
      sessionContextActions.push({
        id: "rename-group",
        label: tr("Rename Group"),
        run: () => {
          void renameSessionGroup(contextTarget.groupName);
        }
      });
      sessionContextActions.push({
        id: "delete-group",
        label: tr("Delete Group"),
        danger: true,
        run: () => {
          void deleteSessionGroup(contextTarget.groupName);
        }
      });
    }
    sessionContextActions.push({
      id: "select-all-sessions",
      label: tr("Select All Sessions"),
      disabled: activeGroupSessions.length === 0,
      run: () => {
        const allIds = activeGroupSessions.map((session) => session.id);
        setSelectedSessionIds(allIds);
        setSelectedSessionId(allIds[0] ?? null);
      }
    });
    sessionContextActions.push({
      id: "clear-session-selection",
      label: tr("Clear Session Selection"),
      disabled: selectedCount === 0,
      run: () => {
        setSelectedSessionIds([]);
      }
    });
    sessionContextActions.push({
      id: "open-selected-sessions",
      label: tr(selectedCount > 1 ? `Open ${selectedCount} Selected Tabs` : "Open Selected Session"),
      disabled: selectedCount === 0,
      run: () => {
        for (const session of selectedSessionsInActiveGroup) {
          openTerminalTab(session);
        }
      }
    });
    sessionContextActions.push({
      id: "move-selected-sessions",
      label: tr("Move Selected to Group..."),
      disabled: selectedCount === 0,
      run: () => {
        openMoveSessionsToGroupDialog(selectedIds);
      }
    });
    sessionContextActions.push({
      id: "move-selected-sessions-ungrouped",
      label: tr("Move Selected to Ungrouped"),
      disabled: selectedCount === 0,
      run: () => {
        void assignSessionsToGroup(selectedIds, "");
      }
    });
    sessionContextActions.push({
      id: "delete-selected-sessions",
      label: tr(selectedCount > 1 ? `Delete ${selectedCount} Selected Sessions` : "Delete Selected Session"),
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
      label: tr("Go to Path"),
      disabled: isSftpActionDisabled,
      run: () => {
        void loadSftpDirectory(sftpPath);
      }
    },
    {
      id: "go-parent",
      label: tr("Go Up"),
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
      label: tr("Refresh"),
      disabled: isSftpActionDisabled,
      run: () => {
        void loadSftpDirectory(sftpDirectory?.cwd ?? sftpPath);
      }
    },
    {
      id: "new-folder",
      label: tr("New Folder"),
      disabled: isSftpActionDisabled,
      run: () => {
        void createSftpDirectory();
      }
    },
    {
      id: "upload-file",
      label: tr("Upload File"),
      disabled: isSftpActionDisabled,
      run: () => {
        void uploadLocalFileToSftp();
      }
    },
    {
      id: "download-selected",
      label: tr("Download Selected"),
      disabled: isSftpActionDisabled || !canDownloadSelectedSftpEntry,
      run: () => {
        void downloadSelectedSftpEntry();
      }
    },
    {
      id: "rename-selected",
      label: tr("Rename Selected"),
      disabled: isSftpActionDisabled || !selectedSftpEntry,
      run: () => {
        void renameSelectedSftpEntry();
      }
    },
    {
      id: "delete-selected",
      label: tr("Delete Selected"),
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
      label: tr("Open Directory"),
      run: () => {
        void loadSftpDirectory(sftpContextEntry.path);
      }
    });
    sftpContextActions.push({
      id: "download-directory",
      label: tr("Download Folder"),
      disabled: isSftpActionDisabled,
      run: () => {
        void downloadSftpDirectory(sftpContextEntry);
      }
    });
  }
  if (sftpContextEntry && sftpContextEntry.kind !== "directory") {
    sftpContextActions.push({
      id: "open-file",
      label: tr("Open File"),
      disabled: isSftpActionDisabled,
      run: () => {
        void openSftpEntryFile(sftpContextEntry);
      }
    });
    sftpContextActions.push({
      id: "download-file",
      label: tr("Download File"),
      disabled: isSftpActionDisabled,
      run: () => {
        void downloadSelectedSftpEntry(sftpContextEntry);
      }
    });
  }
  sftpContextActions.push({
    id: "upload-file",
    label: tr("Upload File"),
    disabled: isSftpActionDisabled,
    run: () => {
      void uploadLocalFileToSftp();
    }
  });
  sftpContextActions.push({
    id: "create-directory",
    label: tr("New Folder"),
    disabled: isSftpActionDisabled,
    run: () => {
      void createSftpDirectory();
    }
  });
  sftpContextActions.push({
    id: "refresh-directory",
    label: tr("Refresh"),
    disabled: isSftpActionDisabled,
    run: () => {
      void loadSftpDirectory(sftpDirectory?.cwd ?? sftpPath);
    }
  });
  if (sftpContextEntry) {
    sftpContextActions.push({
      id: "rename-entry",
      label: tr("Rename"),
      disabled: isSftpActionDisabled,
      run: () => {
        void renameSelectedSftpEntry(sftpContextEntry);
      }
    });
    sftpContextActions.push({
      id: "delete-entry",
      label: tr("Delete"),
      disabled: isSftpActionDisabled,
      run: () => {
        void deleteSelectedSftpEntry(sftpContextEntry);
      }
    });
    sftpContextActions.push({
      id: "copy-entry-path",
      label: tr("Copy Path"),
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
      label: tr("Copy Current Path"),
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
  const commandHistoryContextMenuActions: WorkbenchContextMenuAction[] =
    selectedCommandHistoryContextEntry
      ? [
          {
            id: "run",
            label: "Run",
            onSelect: () => {
              closeCommandHistoryContextMenu();
              void runTerminalCommandHistoryEntry(selectedCommandHistoryContextEntry);
            }
          },
          {
            id: "copy",
            label: "Copy",
            onSelect: () => {
              closeCommandHistoryContextMenu();
              void copyTerminalCommandHistoryEntry(selectedCommandHistoryContextEntry);
            }
          },
          {
            id: "delete",
            label: "Delete",
            danger: true,
            onSelect: () => {
              closeCommandHistoryContextMenu();
              deleteTerminalCommandHistoryEntry(selectedCommandHistoryContextEntry.id);
            }
          },
          {
            id: "close",
            label: "Close",
            onSelect: closeCommandHistoryContextMenu
          }
        ]
      : [
          {
            id: "add",
            label: "Add",
            onSelect: () => {
              closeCommandHistoryContextMenu();
              void addTerminalCommandHistoryEntry();
            }
          },
          {
            id: "import",
            label: "Import",
            onSelect: () => {
              closeCommandHistoryContextMenu();
              void importTerminalCommandHistory();
            }
          },
          {
            id: "export",
            label: "Export",
            disabled: terminalCommandHistoryEntries.length === 0,
            onSelect: () => {
              closeCommandHistoryContextMenu();
              void exportTerminalCommandHistory();
            }
          },
          {
            id: "run-snippet",
            label: "Run Snippet",
            disabled: totalCommandSnippetCount === 0,
            onSelect: () => {
              closeCommandHistoryContextMenu();
              openCommandSnippetManager();
            }
          },
          {
            id: "snippet-manager",
            label: "Snippet Manager",
            onSelect: () => {
              closeCommandHistoryContextMenu();
              void openCommandSnippetManager();
            }
          },
          {
            id: "manage",
            label: "Manage",
            onSelect: () => {
              closeCommandHistoryContextMenu();
              openCommandHistoryManager();
            }
          },
          {
            id: "close",
            label: "Close",
            onSelect: closeCommandHistoryContextMenu
          }
        ];
  const sftpToolbarMenuActions: WorkbenchContextMenuAction[] = sftpToolbarActions.map(
    (action) => ({
      id: action.id,
      label: action.label,
      disabled: action.disabled,
      danger: action.id === "delete-selected",
      onSelect: () => runSftpToolbarAction(action)
    })
  );
  const sftpEntryContextMenuActions: WorkbenchContextMenuAction[] = sftpContextActions.map(
    (action) => ({
      id: action.id,
      label: action.label,
      disabled: action.disabled,
      onSelect: () => runSftpContextAction(action)
    })
  );
  const sessionContextMenuItems: WorkbenchContextMenuAction[] = sessionContextActions.map(
    (action) => ({
      id: action.id,
      label: action.label,
      disabled: action.disabled,
      danger: action.danger,
      onSelect: () => runSessionContextAction(action)
    })
  );
  const connectionSettingsSectionProps = buildConnectionSettingsSectionProps({
    autoReconnect: connectionPreferences.autoReconnect,
    onAutoReconnectChange: setAutoReconnect,
    onReconnectDelayChange: setReconnectDelaySeconds,
    reconnectDelaySeconds: connectionPreferences.reconnectDelaySeconds
  });
  const workspaceSettingsSectionProps = buildWorkspaceSettingsSectionProps({
    cursorOptions: TERMINAL_EDITOR_FOCUS_CURSOR_OPTIONS,
    editorFocusAutoLayoutEnabled: terminalEditorFocusPreferences.autoLayoutEnabled,
    fontOptions: TERMINAL_EDITOR_FOCUS_FONT_OPTIONS,
    labels: i18n.settings.workspace,
    languageOptions: APP_LANGUAGE_OPTIONS,
    onLanguageSelect: setAppLanguage,
    onCursorSelectAction: setTerminalEditorFocusCursorId,
    onEditorFocusAutoLayoutEnabledChange: setTerminalEditorAutoLayoutEnabled,
    onFontSelectAction: setTerminalEditorFocusFontId,
    onRhythmSelectAction: setTerminalEditorFocusRhythmId,
    onSyncDangerousCommandSafetyChange: setWorkspaceProfileDangerousCommandSync,
    onThemeSelectAction: setTerminalEditorFocusThemeId,
    onTypographySelectAction: setTerminalEditorFocusTypographyId,
    onWorkspaceProfileSelectAction: setWorkspaceProfileId,
    rhythmOptions: TERMINAL_EDITOR_FOCUS_RHYTHM_OPTIONS,
    selectedCursorId: terminalEditorFocusPreferences.cursorId,
    selectedCursorLabel: selectedTerminalEditorFocusCursor.label,
    selectedFontId: terminalEditorFocusPreferences.fontId,
    selectedFontLabel: selectedTerminalEditorFocusFont.label,
    selectedLanguage: appLanguage,
    selectedLanguageLabel: selectedLanguageOption.label,
    selectedRhythmId: terminalEditorFocusPreferences.rhythmId,
    selectedRhythmLabel: selectedTerminalEditorFocusRhythm.label,
    selectedThemeId: terminalEditorFocusPreferences.themeId,
    selectedThemeLabel: selectedTerminalEditorFocusTheme.label,
    selectedTypographyId: terminalEditorFocusPreferences.typographyId,
    selectedTypographyLabel: selectedTerminalEditorFocusTypography.label,
    selectedWorkspaceProfileId: workspaceProfilePreferences.profileId,
    selectedWorkspaceProfileLabel: selectedWorkspaceProfile.label,
    syncDangerousCommandSafety: workspaceProfilePreferences.syncDangerousCommandSafety,
    themeOptions: TERMINAL_EDITOR_FOCUS_THEME_OPTIONS,
    typographyOptions: TERMINAL_EDITOR_FOCUS_TYPOGRAPHY_OPTIONS,
    workspaceProfileCards: workspaceProfileCardViews
  });
  const safetySettingsSectionProps = buildSafetySettingsSectionProps({
    activeTargetGroupAssignmentName:
      activeDangerousCommandGroupAssignment?.groupName ?? null,
    builtinRuleViews: dangerousCommandBuiltinRuleViews,
    customPatternCount: dangerousCommandCustomPatternSummary.activePatterns,
    customPatternInvalidLineCount: dangerousCommandCustomPatternSummary.invalidLines,
    customPatternsText: dangerousCommandGuardPreferences.customPatternsText,
    enabled: dangerousCommandGuardPreferences.enabled,
    enabledBuiltinRuleCount: enabledDangerousCommandBuiltinRuleCount,
    enabledSourceCount: enabledDangerousCommandSourceCount,
    environmentTemplateViews: dangerousCommandEnvironmentTemplateViews,
    executionSourceViews: dangerousCommandExecutionSourceViews,
    groupAssignmentLimitReached: dangerousCommandGroupAssignmentLimitReached,
    groupAssignmentViews: dangerousCommandGroupAssignmentViews,
    maxGroupOverrideCount: MAX_DANGEROUS_COMMAND_GROUP_ASSIGNMENTS,
    maxPersistentApprovalCount: MAX_DANGEROUS_COMMAND_PERSISTENT_APPROVALS,
    maxPolicyBundleCount: MAX_DANGEROUS_COMMAND_POLICY_BUNDLES,
    maxTemporaryApprovalCount: MAX_DANGEROUS_COMMAND_TEMP_APPROVALS,
    onApplyPolicyBundleAction: applyDangerousCommandPolicyBundle,
    onBuiltinRuleEnabledChangeAction: setDangerousCommandBuiltinRuleEnabled,
    onChangePolicyBundleSyncTargetAction:
      changeDangerousCommandPolicyBundleSyncTarget,
    onClearPersistentApprovalsAction: clearDangerousCommandPersistentApprovals,
    onClearPolicyBundleSyncTargetAction:
      clearDangerousCommandPolicyBundleSyncTarget,
    onClearTemporaryApprovalsAction: clearDangerousCommandTemporaryApprovals,
    onCustomPatternsTextChange: setDangerousCommandCustomPatternsText,
    onDeleteGroupAssignmentAction: deleteDangerousCommandGroupAssignment,
    onDeletePersistentApprovalAction: removeDangerousCommandPersistentApproval,
    onDeletePolicyBundleAction: deleteDangerousCommandPolicyBundle,
    onDeleteTargetGroupOverrideGroupName:
      activeDangerousCommandGroupAssignment?.groupName ?? null,
    onDeleteTemporaryApproval: removeDangerousCommandTemporaryApproval,
    onEnvironmentTemplateSelectAction:
      applyDangerousCommandEnvironmentTemplate,
    onExecutionSourceEnabledChangeAction: setDangerousCommandSourceEnabled,
    onExportPolicyBundleAction: exportDangerousCommandPolicyBundle,
    onExportPolicyBundlesAction: exportDangerousCommandPolicyBundles,
    onGuardEnabledChange: setDangerousCommandGuardEnabled,
    onImportPolicyBundlesAction: importDangerousCommandPolicyBundles,
    onPolicyPackSelectAction: setDangerousCommandPolicyPackId,
    onPullPolicyBundlesFromSyncAction:
      pullDangerousCommandPolicyBundlesFromSync,
    onPushPolicyBundlesToSyncAction:
      pushDangerousCommandPolicyBundlesToSync,
    onResetSafetyRules: resetDangerousCommandGuardPreferences,
    onSaveCurrentPolicyBundleAction: saveCurrentDangerousCommandPolicyBundle,
    onSaveTargetGroupOverrideAction: saveDangerousCommandGroupAssignment,
    persistentApprovalViews: dangerousCommandPersistentApprovalViews,
    policyBundleLastPulledLabel: dangerousCommandPolicyBundleLastPulledLabel,
    policyBundleLastPushedLabel: dangerousCommandPolicyBundleLastPushedLabel,
    policyBundleSyncBusyAction: dangerousCommandPolicyBundleSyncBusyAction,
    policyBundleSyncFilePath: dangerousCommandPolicyBundleSyncState.filePath,
    policyBundleViews: dangerousCommandPolicyBundleViews,
    policyPackViews: dangerousCommandPolicyPackViews,
    savedGroupOverrideCount: dangerousCommandGuardPreferences.groupAssignments.length,
    selectedEnvironmentTemplateExtraRuleCount:
      selectedDangerousCommandEnvironmentTemplate.extraRules.length,
    selectedEnvironmentTemplateLabel:
      selectedDangerousCommandEnvironmentTemplate.label,
    selectedPolicyPackExtraRuleCount:
      selectedDangerousCommandPolicyPack.extraRules.length,
    selectedPolicyPackLabel: selectedDangerousCommandPolicyPack.label,
    selectedWorkspaceProfileLabel: selectedWorkspaceProfile.label,
    storedPolicyBundleCount: dangerousCommandPolicyBundles.length,
    supplementalRuleViews: dangerousCommandSupplementalRuleViews,
    syncDangerousCommandSafety:
      workspaceProfilePreferences.syncDangerousCommandSafety,
    targetGroupHint: dangerousCommandTargetGroupHint,
    targetGroupName: dangerousCommandSettingsTargetGroupName,
    temporaryApprovalViews: dangerousCommandTemporaryApprovalViews,
    totalBuiltinRuleCount: DANGEROUS_COMMAND_BUILTIN_RULES.length,
    totalExecutionSourceCount: DANGEROUS_COMMAND_EXECUTION_SOURCES.length
  });
  const hotkeySettingsSectionProps = buildHotkeySettingsSectionProps({
    hotkeyConflictCursorIndex,
    hotkeyConflicts: hotkeyConflictViews,
    hotkeyKeyPlaceholder: HOTKEY_KEY_PLACEHOLDER,
    hotkeyModifierOptions,
    hotkeyRows: hotkeySettingRowViews,
    onBindingEnabledChangeAction: setHotkeyBindingEnabled,
    onBindingKeyChangeAction: setHotkeyBindingKey,
    onBindingModifierChangeAction: setHotkeyBindingModifier,
    onExportHotkeysAction: exportHotkeyPreferences,
    onFocusConflictAtIndex: focusHotkeyConflictAtIndex,
    onFocusNextConflict: focusNextHotkeyConflict,
    onFocusPreviousConflict: focusPreviousHotkeyConflict,
    onImportHotkeysAction: importHotkeyPreferences,
    onRegisterRowRefAction: registerHotkeyRowRef,
    onResetHotkeys: () => setHotkeyPreferences(createDefaultHotkeyPreferences()),
    onResolveConflicts: resolveHotkeyConflicts
  });
  const serverHealthSettingsSectionProps = buildServerHealthSettingsSectionProps({
    cpuWarnPercent: serverHealthAlertPreferences.cpuWarnPercent,
    diskWarnPercent: serverHealthAlertPreferences.diskWarnPercent,
    enabled: serverHealthAlertPreferences.enabled,
    memoryWarnPercent: serverHealthAlertPreferences.memoryWarnPercent,
    onEnabledChange: setServerHealthAlertEnabled,
    onThresholdChange: setServerHealthAlertThreshold
  });
  const fileOpeningSettingsSectionProps = buildFileOpeningSettingsSectionProps({
    isMacPlatform,
    onBrowseProgramAction: pickPreferredOpenProgram,
    onPreferredProgramPathChange: setPreferredOpenProgramPath,
    preferredProgramPath: fileOpenPreferences.preferredProgramPath
  });
  const sftpSettingsSectionProps = buildSftpSettingsSectionProps({
    activeSessionConflictHint: sftpActiveSessionConflictHint,
    canClearAllDefaults:
      !!activeSessionTransferConflictStrategy?.upload ||
      !!activeSessionTransferConflictStrategy?.download,
    canClearDownloadDefault: !!activeSessionTransferConflictStrategy?.download,
    canClearUploadDefault: !!activeSessionTransferConflictStrategy?.upload,
    concurrencyHint: sftpConcurrencyHint,
    downloadConcurrency: sftpTransferPreferences.downloadConcurrency,
    downloadRateLimitKiBps: sftpTransferPreferences.downloadRateLimitKiBps,
    hasActiveSessionConflictControls: !!activeSessionId,
    maxConcurrency: MAX_SFTP_TRANSFER_CONCURRENCY,
    maxPolicyPackCount: MAX_SFTP_TRANSFER_POLICY_PACKS,
    maxRateLimitKiBps: MAX_SFTP_TRANSFER_RATE_LIMIT_KIBPS,
    maxRetryBatchConfirmThreshold: MAX_RETRY_BATCH_CONFIRM_THRESHOLD,
    minRetryBatchConfirmThreshold: MIN_RETRY_BATCH_CONFIRM_THRESHOLD,
    onApplyPolicyPackAction: applySftpTransferPolicyPack,
    onApplySchedulePreset: applySftpTransferSchedulePreset,
    onChangePolicyPackSyncTargetAction:
      changeSftpTransferPolicyPackSyncTarget,
    onClearAllDefaults: clearActiveSessionConflictDefaults,
    onClearDownloadDefault: clearActiveSessionDownloadConflictDefault,
    onClearPolicyPackSyncTargetAction:
      clearSftpTransferPolicyPackSyncTarget,
    onClearUploadDefault: clearActiveSessionUploadConflictDefault,
    onDeletePolicyPackAction: deleteSftpTransferPolicyPack,
    onDownloadConcurrencyChange: setDownloadConcurrency,
    onDownloadRateLimitChange: setDownloadRateLimitKiBps,
    onExportAllPolicyPacksAction: exportSftpTransferPolicyPacks,
    onExportPolicyPackAction: exportSftpTransferPolicyPack,
    onImportPolicyPacksAction: importSftpTransferPolicyPacks,
    onPolicyPackAutoPullOnLaunchChange: setSftpTransferPolicyPackAutoPullOnLaunch,
    onPolicyPackAutoPushOnChangeChange: setSftpTransferPolicyPackAutoPushOnChange,
    onPullPolicyPacksFromSyncAction: pullSftpTransferPolicyPacksFromSync,
    onPushPolicyPacksToSyncAction: pushSftpTransferPolicyPacksToSync,
    onRetryBatchConfirmThresholdChange: setRetryBatchConfirmThresholdFromInput,
    onSaveCurrentPolicyPackAction: saveCurrentSftpTransferPolicyPack,
    onScheduleWindowEnabledChange: setSftpTransferScheduleWindowEnabled,
    onScheduleWindowEndChange: setSftpTransferScheduleWindowEnd,
    onScheduleWindowStartChange: setSftpTransferScheduleWindowStart,
    onToggleScheduleDay: toggleSftpTransferScheduleWindowDay,
    onUploadConcurrencyChange: setUploadConcurrency,
    onUploadRateLimitChange: setUploadRateLimitKiBps,
    policyPackAutoPullOnLaunch: sftpTransferPolicyPackSyncState.autoPullOnLaunch,
    policyPackAutoPushOnChange: sftpTransferPolicyPackSyncState.autoPushOnChange,
    policyPackLastSyncLabel: sftpTransferPolicyPackLastSyncLabel,
    policyPackSyncBusyAction: sftpTransferPolicyPackSyncBusyAction,
    policyPackSyncFilePath: sftpTransferPolicyPackSyncState.filePath,
    policyPackViews: sftpTransferPolicyPackViews,
    rateLimitHint: sftpRateLimitHint,
    retryBatchConfirmThreshold,
    retryThresholdHint: sftpRetryThresholdHint,
    scheduleDayOptions: sftpScheduleDayViews,
    scheduleHint: sftpScheduleHint,
    schedulePresetViews: sftpSchedulePresetViews,
    scheduleWindowEnabled: sftpTransferPreferences.scheduleWindowEnabled,
    scheduleWindowEndValue: formatSftpScheduleTimeInputValue(
      sftpTransferPreferences.scheduleWindowEndMinutes
    ),
    scheduleWindowStartValue: formatSftpScheduleTimeInputValue(
      sftpTransferPreferences.scheduleWindowStartMinutes
    ),
    storedPolicyPackCount: sftpTransferPolicyPacks.length,
    uploadConcurrency: sftpTransferPreferences.uploadConcurrency,
    uploadRateLimitKiBps: sftpTransferPreferences.uploadRateLimitKiBps
  });
  const portForwardingSettingsSectionProps =
    buildPortForwardingSettingsSectionProps({
    activeEventHistoryCount: activePortForwardEventHistory.length,
    activeTabSummary: portForwardActiveTabSummary,
    analyticsView: portForwardAnalyticsView,
    eventCorrelationQuery: portForwardEventCorrelationQuery,
    eventErrorCode: portForwardEventErrorCode,
    eventErrorCodeOptions: portForwardEventErrorCodeOptions,
    eventFilter: portForwardEventFilter,
    eventSummaryLabel: portForwardEventSummaryLabel,
    eventTimeRange: portForwardEventTimeRange,
    eventViews: portForwardEventViews,
    formBindHost: portForwardForm.bindHost,
    formBindPort: portForwardForm.bindPort,
    formTargetHost: portForwardForm.targetHost,
    formTargetPort: portForwardForm.targetPort,
    formType: portForwardForm.type,
    forwardViews: portForwardRecordViews,
    hasActiveSession: !!activeSessionId,
    hasActiveTab: !!activeTabId,
    hasCustomizedEventView: hasCustomizedPortForwardEventView,
    isActiveTabConnected,
    onClearSessionHistoryAction: clearSessionPortForwardHistory,
    onClearVisibleHistoryAction: clearVisiblePortForwardHistory,
    onCreateForwardAction: createPortForward,
    onEventCorrelationQueryChange: setPortForwardEventCorrelationQuery,
    onEventErrorCodeChange: setPortForwardEventErrorCode,
    onEventFilterChange: (value: string) =>
      setPortForwardEventFilter(value as PortForwardEventFilter),
    onEventTimeRangeChange: (value: string) =>
      setPortForwardEventTimeRange(value as PortForwardEventTimeRange),
    onExportAnalyticsCsvAction: exportPortForwardEventAnalyticsCsv,
    onExportAnalyticsJsonAction: exportPortForwardEventAnalyticsJson,
    onExportSnapshotAction: exportPortForwardSnapshot,
    onExportVisibleCsvAction: exportVisiblePortForwardEventsCsv,
    onExportVisibleJsonAction: exportVisiblePortForwardEventsJson,
    onFormBindHostChange: setPortForwardFormBindHost,
    onFormBindPortChange: setPortForwardFormBindPort,
    onFormTargetHostChange: setPortForwardFormTargetHost,
    onFormTargetPortChange: setPortForwardFormTargetPort,
    onFormTypeChange: setPortForwardFormType,
    onPresetApply: applyActivePortForwardPreset,
    onPresetAutoRestoreChange: setPortForwardPresetAutoRestore,
    onPresetDelete: deleteActivePortForwardPreset,
    onPresetFillForm: fillPortForwardFormFromActivePreset,
    onRefresh: refreshActivePortForwards,
    onRefreshDiagnostics: refreshActivePortForwardDiagnostics,
    onRemoveForward: removeVisiblePortForward,
    onResetEventFilters: resetPortForwardEventViewFilters,
    onSavePresetAction: savePortForwardPreset,
    portForwardBusy,
    portForwardStatusMessage,
    presetViews: portForwardPresetViews,
    visibleEventHistoryCount: visiblePortForwardEventHistory.length
  });
  const diagnosticsSettingsSectionProps = buildDiagnosticsSettingsSectionProps({
    disconnectCaptureEnabled: disconnectReportCapturePreferences.enabled,
    disconnectCaptureHint: diagnosticsDisconnectCaptureHint,
    disconnectEmptyStateLabel: diagnosticsDisconnectEmptyStateLabel,
    disconnectQuery: disconnectReportQuery,
    disconnectReportViews: diagnosticsDisconnectReportViews,
    disconnectScope: disconnectReportScope,
    disconnectTimeRange: disconnectReportTimeRange,
    disconnectTotalCount: disconnectReports.length,
    disconnectTrigger: disconnectReportTriggerFilter,
    disconnectVisibleCount: visibleDisconnectReports.length,
    hasCustomizedDisconnectView: hasCustomizedDisconnectReportView,
    isExportingBugReport,
    logDirectoryPath: diagnosticsLogDirectoryPath,
    logFilePath: diagnosticsLogFilePath,
    onClearAllDisconnectsAction: clearDisconnectReportsHistory,
    onClearVisibleDisconnectsAction: clearVisibleDisconnectReportsHistory,
    onCopyDisconnectReportJson: copyVisibleDisconnectReportJsonById,
    onCopyLatestVisibleDisconnectAction: copyLatestVisibleDisconnectReport,
    onCopyLogFilePathAction: copyLogFilePath,
    onDisconnectCaptureEnabledChange: setDisconnectReportCaptureEnabled,
    onDisconnectQueryChange: setDisconnectReportQueryValue,
    onDisconnectScopeChange: (value: string) => {
      setDisconnectReportScope(value as DisconnectReportScope);
    },
    onDisconnectTimeRangeChange: (value: string) => {
      setDisconnectReportTimeRange(value as DisconnectReportTimeRange);
    },
    onDisconnectTriggerChange: (value: string) => {
      setDisconnectReportTriggerFilter(value as DisconnectReportTriggerFilter);
    },
    onExportBugReportAction: exportBugReportBundle,
    onExportDisconnectCsvAction: exportDisconnectReportsCsv,
    onExportDisconnectJsonAction: exportDisconnectReportsJson,
    onFocusDisconnectTab: focusVisibleDisconnectReportTab,
    onOpenLogDirectoryAction: openLogDirectory,
    onRefreshLogInfo: refreshDiagnosticsLogInfo,
    onResetDisconnectFilters: resetDisconnectReportViewFilters
  });

  return (
    <div className={isMacPlatform ? "app app--mac" : "app app--windows"} ref={appRootRef}>
      <WorkbenchTopbar
        autoReconnectLabel={
          connectionPreferences.autoReconnect
            ? i18n.topbar.autoReconnect(connectionPreferences.reconnectDelaySeconds)
            : i18n.topbar.autoReconnectOff
        }
        isMacPlatform={isMacPlatform}
        labels={i18n.topbar}
        workspaceProfile={
          workspaceProfilePreferences.profileId !== "none"
            ? {
                id: workspaceProfilePreferences.profileId,
                shortLabel: selectedWorkspaceProfile.shortLabel
              }
            : null
        }
      />

      <WorkbenchLayout
        isEditorFocusMode={isTerminalEditorFocusMode}
        leftSidebar={(
          <WorkbenchExplorerSidebar>
            <SftpExplorerSection
              bindingTabTitle={activeTerminalTab?.title ?? null}
              currentPathLabel={sftpDirectory?.cwd ?? "(not loaded)"}
              deleteProgressLabel={
                sftpDeleteProgress
                  ? `Deleting ${
                      sftpDeleteProgress.kind === "directory" ? "directory" : "file"
                    } "${sftpDeleteProgress.name}"...`
                  : null
              }
              directorySizeLabel={`Current directory size: ${formatExactByteCount(sftpSummary.totalSize)} (${formatTransferBytes(sftpSummary.totalSize)})`}
              dropActive={sftpDropActive}
              entries={(sftpDirectory?.entries ?? []).map((entry) => ({
                compactSizeLabel: entry.kind === "directory" ? "Folder" : formatTransferBytes(entry.size),
                group: entry.group,
                id: `${entry.path}-${entry.modifiedAt ?? ""}`,
                isSelected: selectedSftpPath === entry.path,
                kind: entry.kind,
                linksLabel: formatSftpLinksForLs(entry.links),
                modifiedAtLabel: formatSftpMtimeForLs(entry.modifiedAt),
                name: entry.name,
                onClick: () => {
                  setSelectedSftpPath(entry.path);
                },
                onContextMenu: (event) => openSftpContextMenu(event, entry),
                onDoubleClick: () => {
                  if (entry.kind === "directory") {
                    return;
                  }
                  void openSftpEntryFile(entry);
                },
                onOpenDirectory:
                  entry.kind === "directory"
                    ? () => {
                        void loadSftpDirectory(entry.path);
                      }
                    : undefined,
                owner: entry.owner,
                path: entry.path,
                permissions: entry.permissions,
                sizeLabel: formatSftpSizeForLs(entry.size)
              }))}
              entrySummaryLabel={`Entries: ${sftpSummary.entryCount} (Files: ${sftpSummary.fileCount}, Dirs: ${sftpSummary.directoryCount})`}
              errorMessage={sftpError}
              loading={sftpLoading}
              onActionsMenu={toggleSftpToolbarMenu}
              onBodyContextMenu={(event) => openSftpContextMenu(event)}
              onDragLeave={onSftpDragLeave}
              onDragOver={onSftpDragOver}
              onDrop={onSftpDrop}
              onGoUp={() => {
                if (!sftpDirectory?.parent) {
                  return;
                }
                void loadSftpDirectory(sftpDirectory.parent);
              }}
              onPathChange={(event) => setSftpPath(event.target.value)}
              onPathKeyDown={(event) => {
                if (event.key !== "Enter") {
                  return;
                }
                event.preventDefault();
                void loadSftpDirectory(sftpPath);
              }}
              onRefresh={() => {
                void loadSftpDirectory(sftpDirectory?.cwd ?? sftpPath);
              }}
              onViewModeChange={setSftpExplorerViewMode}
              pathUpDisabled={sftpLoading || sftpActionLoading || !sftpDirectory?.parent}
              pathValue={sftpPath}
              refreshDisabled={sftpLoading || sftpActionLoading}
              viewMode={sftpExplorerViewMode}
            />
          </WorkbenchExplorerSidebar>
        )}
        centerPane={(

        <section className="panel panel--center">
          <TerminalWorkspace
            activeTabId={activeTabId}
            connectionPreferences={connectionPreferences}
            dangerousCommandGuardPreferences={dangerousCommandGuardPreferences}
            editorFocusModeEnabled={terminalEditorFocusPreferences.autoLayoutEnabled}
            editorFocusCursorId={terminalEditorFocusPreferences.cursorId}
            editorFocusFontId={terminalEditorFocusPreferences.fontId}
            editorFocusRhythmId={terminalEditorFocusPreferences.rhythmId}
            editorFocusThemeId={terminalEditorFocusPreferences.themeId}
            editorFocusTypographyId={terminalEditorFocusPreferences.typographyId}
            getDangerousCommandSessionGroupName={getSessionGroupNameForTab}
            hotkeyPreferences={hotkeyPreferences}
            language={appLanguage}
            onActiveEditorModeChange={setIsTerminalEditorFocusMode}
            onCloseAllTabs={closeAllTabs}
            onCloseTab={closeTerminalTab}
            onCloseTabsLeft={closeTabsLeft}
            onCloseTabsRight={closeTabsRight}
            onCloseOtherTabs={closeOtherTabs}
            onCommandHistoryChange={setTerminalCommandHistoryEntries}
            onError={setError}
            onSelectTab={setActiveTabId}
            requestDangerousCommandApproval={requestDangerousCommandApproval}
            systemApi={systemApi}
            terminalApi={terminalApi}
            tabs={terminalTabs}
          />
        </section>
        )}
        rightSidebar={(
          <WorkbenchInspectorSidebar
            activeTabId={activeInspectorSidebarTab}
            onSelectTab={(tabId) => setActiveInspectorSidebarTab(tabId as InspectorSidebarTabId)}
            tabs={[
              { badge: sessionBadgeText, id: "sessions", label: "Sessions" },
              { id: "health", label: "Health" },
              {
                badge: `${inspectorTerminalCommandHistoryEntries.length}/${visibleTerminalCommandHistoryEntries.length}`,
                id: "history",
                label: "History"
              }
            ]}
          >
            <div
              className={
                activeInspectorSidebarTab === "sessions"
                  ? "workbench-inspector-panel is-active"
                  : "workbench-inspector-panel"
              }
              data-inspector-tab="sessions"
            >
              <SessionsInspectorSection
              activeGroupLabel={activeSessionGroup?.label ?? null}
              activeContext={
                selectedSession
                  ? {
                      detail: `${selectedSession.username}@${selectedSession.host}:${selectedSession.port}`,
                      stateLabel:
                        activeSessionId === selectedSession.id
                          ? isActiveTabConnected
                            ? "Live Tab"
                            : "Tab Open"
                          : selectedSession.favorite
                            ? "Favorite"
                            : "Saved",
                      stateTone:
                        activeSessionId === selectedSession.id
                          ? isActiveTabConnected
                            ? "ok"
                            : "warn"
                          : "neutral",
                      title: selectedSession.name
                    }
                  : activeTerminalTab
                    ? {
                        detail: activeTerminalTab.sessionId
                          ? `Active terminal tab for session ${activeTerminalTab.sessionId}`
                          : "Active terminal tab",
                        stateLabel: isActiveTabConnected ? "Live Tab" : "Offline",
                        stateTone: isActiveTabConnected ? "ok" : "warn",
                        title: activeTerminalTab.title
                      }
                    : null
              }
              emptyStateLabel={
                !activeSessionGroup
                  ? !loading && filteredSessions.length === 0
                    ? sessions.length === 0
                      ? "No sessions yet."
                      : "No sessions match current filters."
                    : null
                  : !loading && activeGroupSessions.length === 0
                    ? "No sessions in this group."
                    : null
              }
              favoritesOnly={sessionFavoritesOnly}
              filterQuery={sessionFilterQuery}
              groups={groupedSessions.map((group) => ({
                count: group.sessions.length,
                isSelected: selectedGroupKeySet.has(group.key),
                key: group.key,
                label: group.label,
                onClick: (event) => {
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
                },
                onContextMenu: (event) =>
                  openSessionContextMenu(event, {
                    type: "group",
                    groupKey: group.key,
                    groupName: group.groupName,
                    label: group.label
                  })
              }))}
              isGroupView={Boolean(activeSessionGroup)}
              loading={loading}
              onBackToGroups={() => setActiveSessionGroupKey(null)}
              onCreateFirstSession={() => {
                openCreateModal(activeSessionGroup?.groupName ?? "");
              }}
              onDismissWelcome={dismissFirstRunOnboarding}
              onFilterQueryChange={(event) => setSessionFilterQuery(event.target.value)}
              onImportSshConfig={() => {
                void importSessionsFromSshConfig();
              }}
              onOpenSecurityNotes={openFirstRunSecurityNotes}
              onOpenSettings={() => openSettingsPanel("connection")}
              onRootContextMenu={openSessionBlankContextMenu}
              onToggleFavoritesOnly={() => setSessionFavoritesOnly((prev) => !prev)}
              sessionBadgeText={sessionBadgeText}
              showWelcome={!isFirstRunOnboardingDismissed && sessions.length === 0 && !loading}
              sessions={activeGroupSessions.map((session) => ({
                host: session.host,
                id: session.id,
                isSelected: selectedSessionIdSet.has(session.id),
                name: session.name,
                onClick: (event) => {
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
                },
                onContextMenu: (event) =>
                  openSessionContextMenu(event, {
                    type: "session",
                    sessionId: session.id
                  }),
                onDoubleClick: () =>
                  openTerminalTab(session, {
                    forceNewTab: true
                  }),
                onKeyDown: (event) => {
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
                },
                title: `${session.username}@${session.host}:${session.port}`
              }))}
              workspaceProfile={
                workspaceProfilePreferences.profileId !== "none"
                  ? {
                      id: workspaceProfilePreferences.profileId,
                      shortLabel: selectedWorkspaceProfile.shortLabel
                    }
                  : null
              }
              />
            </div>
            <div
              className={
                activeInspectorSidebarTab === "health"
                  ? "workbench-inspector-panel is-active"
                  : "workbench-inspector-panel"
              }
              data-inspector-tab="health"
            >
              <ServerHealthInspectorSection
              activeTabTitle={activeTerminalTab?.title ?? null}
              hasAlert={serverHealthAlertStatus.hasAny}
              healthyLabel={tr("Healthy")}
              isConnected={isActiveTabConnected}
              isDetailOpen={isServerHealthDetailOpen}
              onRefresh={() => {
                void refreshServerHealth();
                if (isServerHealthDetailOpen) {
                  void refreshServerProcesses();
                }
              }}
              onToggleDetail={() => setIsServerHealthDetailOpen(true)}
              refreshDisabled={
                !activeTerminalTab ||
                !isActiveTabConnected ||
                serverHealthLoading ||
                (isServerHealthDetailOpen && serverProcessLoading)
              }
              toggleDisabled={!activeTerminalTab}
            >
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
                          ? "server-health-card server-health-card--cpu is-alert"
                          : "server-health-card server-health-card--cpu"
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
                          ? "server-health-card server-health-card--memory is-alert"
                          : "server-health-card server-health-card--memory"
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
                          ? "server-health-card server-health-card--disk is-alert"
                          : "server-health-card server-health-card--disk"
                      }
                    >
                      <span className="server-health-card__label">Disk</span>
                      <strong className="server-health-card__value">
                        {formatPercent(serverHealthMetrics?.diskUsagePercent ?? 0)}
                      </strong>
                    </div>
                  </div>
                  <p className="hint server-health__footnote">Updated: {serverHealthUpdatedLabel}</p>
                </>
              ) : null}
              </ServerHealthInspectorSection>
            </div>
            <div
              className={
                activeInspectorSidebarTab === "history"
                  ? "workbench-inspector-panel is-active"
                  : "workbench-inspector-panel"
              }
              data-inspector-tab="history"
            >
              <CommandHistoryInspectorSection
              activeTabConnected={isActiveTabConnected}
              activeTabTitle={activeTerminalTab?.title ?? null}
              entries={inspectorTerminalCommandHistoryEntries.map((entry) => ({
                command: entry.command,
                id: entry.id,
                onContextMenu: (event) => openCommandHistoryContextMenu(event, entry.id),
                onDoubleClick: () => {
                  void pasteTerminalCommandHistoryEntry(entry);
                },
                title: `${entry.command}\n\nDouble-click to paste into active terminal. Right-click for actions.`
              }))}
              hiddenEntryCount={hiddenInspectorCommandHistoryCount}
              isCollapsed={isCommandHistoryInspectorCollapsed}
              onOpenContextMenu={openCommandHistoryPanelContextMenu}
              onOpenManager={openCommandHistoryManager}
              onOpenSnippets={() => {
                void openCommandSnippetManager();
              }}
              onQueryChange={(event) => setTerminalCommandHistoryQuery(event.target.value)}
              onScopeChange={(event) =>
                setTerminalCommandHistoryScope(event.target.value as TerminalCommandHistoryScope)
              }
              onToggleCollapsed={() => setIsCommandHistoryInspectorCollapsed((prev) => !prev)}
              query={terminalCommandHistoryQuery}
              scope={terminalCommandHistoryScope}
              totalCommandSnippetCount={totalCommandSnippetCount}
              visibleCountLabel={`${inspectorTerminalCommandHistoryEntries.length}/${visibleTerminalCommandHistoryEntries.length}`}
              />
            </div>
          </WorkbenchInspectorSidebar>
        )}
      />

      <TransferDock
        bindingLabel={
          activeTerminalTab
            ? i18n.transfer.boundTo(activeTerminalTab.title)
            : i18n.transfer.emptyBinding
        }
        canRetryAllFailed={canRetryAllFailedTransfers}
        downloadPanel={{
          cancelAllDisabled: !activeTabId,
          cancelAllLabel: i18n.transfer.cancelAllDownloadsLabel,
          cancelAllTitle: i18n.transfer.cancelAllDownloadsTitle,
          clearFinishedDisabled: !canClearFinishedDownloads,
          emptyLabel: i18n.transfer.downloadEmpty,
          historyMessage:
            failedDownloadHistoryCount > 0
              ? i18n.transfer.storedFailedRetries(failedDownloadHistoryCount)
              : null,
          onCancelAll: () => {
            void cancelAllActiveDownloads();
          },
          onClearFinished: () => {
            clearFinishedTransfers("download");
          },
          onRetryFailed: () => {
            void retryFailedDownloads();
          },
          pauseMessage: isActiveDownloadQueuePaused
            ? activeDownloadPauseReason === "schedule-window"
              ? i18n.transfer.schedulePaused(
                  sftpTransferScheduleSummary,
                  nextSftpTransferWindowOpeningLabel
                )
              : i18n.transfer.downloadDisconnectedPaused
            : null,
          progressSummary: i18n.transfer.progressSummary(
            activeDownloadProgressStats.completed,
            activeDownloadProgressStats.total,
            activeDownloadProgressStats.failed,
            activeDownloadProgressStats.canceled,
            activeDownloadProgressStats.running,
            activeDownloadProgressStats.queued
          ),
          retryFailedCount: failedDownloadRetryCandidates.length,
          retryFailedDisabled: !canRetryFailedDownloads,
          title: i18n.transfer.downloadsTitle(
            activeDownloadQueueStats.running,
            activeDownloadQueueStats.queued,
            sftpTransferPreferences.downloadConcurrency
          ),
          transfers: activeDownloadTransfers.map((transfer) => ({
            canCancel: transfer.status === "queued" || transfer.status === "running",
            direction: "download" as const,
            name: transfer.name,
            onCancel: () => {
              void cancelSftpDownload(transfer);
            },
            progressLabel: formatTransferProgress(transfer),
            status: transfer.status,
            transferId: transfer.transferId
          }))
        }}
        failedRetryCandidateTotal={failedRetryCandidateTotal}
        hasOperationCenterActivity={hasOperationCenterActivity}
        labels={i18n.transfer}
        notice={activeTransferDockNotice}
        onDiscardPending={() => {
          void discardPendingTransferRestoreQueue();
        }}
        onOpenOperationCenter={openOperationCenter}
        onOpenRetryCenter={openRetryCenter}
        onRestorePending={() => {
          void restorePendingTransferRestoreQueue();
        }}
        onRetryAllFailed={() => {
          void retryAllFailedTransfersWithScopeChoice();
        }}
        operationCenterActiveCount={operationCenterActiveCount}
        pendingRestoreCount={pendingTransferRestoreCount}
        uploadPanel={{
          cancelAllDisabled: !activeTabId,
          cancelAllLabel: i18n.transfer.cancelAllUploadsLabel,
          cancelAllTitle: i18n.transfer.cancelAllUploadsTitle,
          clearFinishedDisabled: !canClearFinishedUploads,
          emptyLabel: i18n.transfer.uploadEmpty,
          historyMessage:
            failedUploadHistoryCount > 0
              ? i18n.transfer.storedFailedRetries(failedUploadHistoryCount)
              : null,
          onCancelAll: () => {
            void cancelAllActiveUploads();
          },
          onClearFinished: () => {
            clearFinishedTransfers("upload");
          },
          onRetryFailed: () => {
            void retryFailedUploads();
          },
          pauseMessage: isActiveUploadQueuePaused
            ? activeUploadPauseReason === "schedule-window"
              ? i18n.transfer.schedulePaused(
                  sftpTransferScheduleSummary,
                  nextSftpTransferWindowOpeningLabel
                )
              : i18n.transfer.uploadDisconnectedPaused
            : null,
          progressSummary: i18n.transfer.progressSummary(
            activeUploadProgressStats.completed,
            activeUploadProgressStats.total,
            activeUploadProgressStats.failed,
            activeUploadProgressStats.canceled,
            activeUploadProgressStats.running,
            activeUploadProgressStats.queued
          ),
          retryFailedCount: failedUploadRetryCandidates.length,
          retryFailedDisabled: !canRetryFailedUploads,
          title: i18n.transfer.uploadsTitle(
            activeUploadQueueStats.running,
            activeUploadQueueStats.queued,
            sftpTransferPreferences.uploadConcurrency
          ),
          transfers: activeUploadTransfers.map((transfer) => ({
            canCancel: transfer.status === "queued" || transfer.status === "running",
            direction: "upload" as const,
            name: transfer.name,
            onCancel: () => {
              void cancelSftpUpload(transfer);
            },
            progressLabel: formatTransferProgress(transfer),
            status: transfer.status,
            transferId: transfer.transferId
          }))
        }}
      />
      <AppInlineHintPanel
        approval={
          dangerousCommandApproval
            ? {
                allowInGroup: Boolean(dangerousCommandApproval.request.result.sessionGroupName),
                commandText: dangerousCommandApproval.request.result.commandText,
                contextSummary: dangerousCommandApproval.contextSummary,
                preview: dangerousCommandApproval.request.result.preview,
                ruleSummary: dangerousCommandApproval.ruleSummary,
                severity: dangerousCommandApproval.request.result.severity,
                sourceLabel: dangerousCommandApproval.sourceLabel
              }
            : null
        }
        hintMessage={appHintMessage}
        language={appLanguage}
        onAllowInGroup={() => approveDangerousCommandWithScope("sessionGroup")}
        onAllowInTab={() => approveDangerousCommandWithScope("tab")}
        onCancelApproval={() => resolveDangerousCommandApproval(false)}
        onDismissHint={clearAppHintMessage}
        onRunOnce={() => resolveDangerousCommandApproval(true)}
        onSavePolicy={() => {
          void saveDangerousCommandPersistentApproval();
        }}
      />

      {isServerHealthDetailOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div
            aria-label="Server Health Details"
            aria-modal="true"
            className="modal modal--server-health-details"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal__header">
              <div>
                <h3>Server Health Details</h3>
                <p className="hint server-health-modal__subtitle">
                  {activeTerminalTab?.title ?? "No active tab"}
                </p>
              </div>
              <button
                aria-label="Close server health details"
                className="icon-button"
                onClick={() => setIsServerHealthDetailOpen(false)}
                type="button"
              >
                <UiIcon name="close" />
              </button>
            </div>
            {!isActiveTabConnected ? (
              <p className="hint">Connect the active terminal tab to collect metrics.</p>
            ) : null}
            {serverHealthError ? <p className="hint sftp-error">{serverHealthError}</p> : null}
            {serverHealth ? (
              <div className="server-health-details">
                <div className="server-health-grid server-health-grid--details">
                  <div
                    className={
                      serverHealthAlertStatus.cpuHigh
                        ? "server-health-card server-health-card--cpu is-alert"
                        : "server-health-card server-health-card--cpu"
                    }
                  >
                    <span className="server-health-card__label">CPU</span>
                    <strong className="server-health-card__value">
                      {formatPercent(serverHealthMetrics?.cpuUsagePercent ?? 0)}
                    </strong>
                    <span className="server-health-card__meta">
                      <span>Cores</span> {serverHealthCpuCoreLabel}
                    </span>
                  </div>
                  <div
                    className={
                      serverHealthAlertStatus.memoryHigh
                        ? "server-health-card server-health-card--memory is-alert"
                        : "server-health-card server-health-card--memory"
                    }
                  >
                    <span className="server-health-card__label">Memory</span>
                    <strong className="server-health-card__value">
                      {formatPercent(serverHealthMetrics?.memoryUsagePercent ?? 0)}
                    </strong>
                    <span className="server-health-card__meta">
                      <span>Used</span> {formatTransferBytes(serverHealth.memoryUsedBytes)} ·{" "}
                      <span>Available</span> {formatTransferBytes(serverHealthMemoryAvailableBytes)}
                    </span>
                  </div>
                  <div
                    className={
                      serverHealthAlertStatus.diskHigh
                        ? "server-health-card server-health-card--disk is-alert"
                        : "server-health-card server-health-card--disk"
                    }
                  >
                    <span className="server-health-card__label">Disk</span>
                    <strong className="server-health-card__value">
                      {formatPercent(serverHealthMetrics?.diskUsagePercent ?? 0)}
                    </strong>
                    <span className="server-health-card__meta">
                      {serverHealth.diskPath} · <span>Free</span>{" "}
                      {formatTransferBytes(serverHealth.diskAvailableBytes)} · <span>Total</span>{" "}
                      {formatTransferBytes(serverHealth.diskTotalBytes)}
                    </span>
                  </div>
                  <div className="server-health-card server-health-card--network">
                    <span className="server-health-card__label">Network</span>
                    <strong className="server-health-card__value">
                      RX {formatTransferBytes(serverHealthMetrics?.rxBytesPerSecond ?? 0)}/s
                    </strong>
                    <span className="server-health-card__meta">
                      TX {formatTransferBytes(serverHealthMetrics?.txBytesPerSecond ?? 0)}/s ·{" "}
                      <span>Total</span> RX {formatTransferBytes(serverHealth.networkRxBytes)} / TX{" "}
                      {formatTransferBytes(serverHealth.networkTxBytes)}
                    </span>
                  </div>
                  <div className="server-health-card server-health-card--load">
                    <span className="server-health-card__label">Load</span>
                    <strong className="server-health-card__value">
                      {serverHealth.load1.toFixed(2)} / {serverHealth.load5.toFixed(2)} /{" "}
                      {serverHealth.load15.toFixed(2)}
                    </strong>
                    <span className="server-health-card__meta">1m / 5m / 15m</span>
                  </div>
                  <div className="server-health-card server-health-card--uptime">
                    <span className="server-health-card__label">Uptime</span>
                    <strong className="server-health-card__value">
                      {formatServerUptime(serverHealth.uptimeSeconds)}
                    </strong>
                    <span className="server-health-card__meta">{serverHealth.hostname}</span>
                  </div>
                </div>
                <div className="server-health-detail-tabs" role="tablist" aria-label="Server health sections">
                  {[
                    ["overview", "Overview"],
                    ["disk", "Disk"],
                    ["network", "Network"],
                    ["processes", "Processes"],
                    ["services", "Services"]
                  ].map(([tabId, label]) => (
                    <button
                      aria-selected={serverHealthDetailTab === tabId}
                      className={
                        serverHealthDetailTab === tabId
                          ? "server-health-detail-tab is-active"
                          : "server-health-detail-tab"
                      }
                      key={tabId}
                      onClick={() => setServerHealthDetailTab(tabId as ServerHealthDetailTab)}
                      role="tab"
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="server-health-detail-panel">
                  {serverHealthDetailTab === "overview" ? (
                    <>
                      <div className="server-health-info-grid" aria-label="System information">
                        <div className="server-health-info-item">
                          <span className="server-health-info-item__label">Hostname</span>
                          <strong className="server-health-info-item__value">{serverHealth.hostname}</strong>
                        </div>
                        <div className="server-health-info-item">
                          <span className="server-health-info-item__label">OS</span>
                          <strong className="server-health-info-item__value">
                            {serverHealth.osName || "-"}
                          </strong>
                        </div>
                        <div className="server-health-info-item">
                          <span className="server-health-info-item__label">Kernel</span>
                          <strong className="server-health-info-item__value">{serverHealthKernelLabel}</strong>
                        </div>
                        <div className="server-health-info-item">
                          <span className="server-health-info-item__label">Architecture</span>
                          <strong className="server-health-info-item__value">
                            {serverHealth.architecture || "-"}
                          </strong>
                        </div>
                        <div className="server-health-info-item">
                          <span className="server-health-info-item__label">CPU cores</span>
                          <strong className="server-health-info-item__value">{serverHealthCpuCoreLabel}</strong>
                        </div>
                        <div className="server-health-info-item">
                          <span className="server-health-info-item__label">Load / core</span>
                          <strong className="server-health-info-item__value">
                            {serverHealthLoadPerCore === null ? "-" : serverHealthLoadPerCore.toFixed(2)}
                          </strong>
                        </div>
                        <div className="server-health-info-item">
                          <span className="server-health-info-item__label">Free memory</span>
                          <strong className="server-health-info-item__value">
                            {formatTransferBytes(serverHealth.memoryFreeBytes ?? 0)}
                          </strong>
                        </div>
                        <div className="server-health-info-item">
                          <span className="server-health-info-item__label">Cache / buffers</span>
                          <strong className="server-health-info-item__value">
                            {formatTransferBytes(serverHealth.memoryCachedBytes ?? 0)} /{" "}
                            {formatTransferBytes(serverHealth.memoryBufferBytes ?? 0)}
                          </strong>
                        </div>
                        <div className="server-health-info-item">
                          <span className="server-health-info-item__label">Swap</span>
                          <strong className="server-health-info-item__value">
                            {formatPercent(serverHealthSwapUsagePercent)} ·{" "}
                            {formatTransferBytes(serverHealth.swapUsedBytes ?? 0)}/
                            {formatTransferBytes(serverHealth.swapTotalBytes ?? 0)}
                          </strong>
                        </div>
                        <div className="server-health-info-item">
                          <span className="server-health-info-item__label">Collected</span>
                          <strong className="server-health-info-item__value">
                            {serverHealthCollectedAtLabel}
                          </strong>
                        </div>
                      </div>
                    </>
                  ) : null}
                  {serverHealthDetailTab === "disk" ? (
                    <div className="server-health-table server-health-table--disk">
                      <div className="server-health-table__row server-health-table__row--header">
                        <span>Mount</span>
                        <span>Type</span>
                        <span>Used</span>
                        <span>Free</span>
                        <span>Use</span>
                        <span>Inodes</span>
                      </div>
                      {serverHealthFilesystems.map((entry) => (
                        <div className="server-health-table__row" key={`${entry.filesystem}-${entry.path}`}>
                          <span className="server-health-table__main" title={`${entry.filesystem} ${entry.path}`}>
                            {entry.path}
                          </span>
                          <span>{entry.type || "-"}</span>
                          <span>
                            {formatTransferBytes(entry.usedBytes)}/{formatTransferBytes(entry.totalBytes)}
                          </span>
                          <span>{formatTransferBytes(entry.availableBytes)}</span>
                          <span>{formatOptionalPercent(entry.usePercent)}</span>
                          <span>{formatOptionalPercent(entry.inodeUsedPercent)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {serverHealthDetailTab === "network" ? (
                    <div className="server-health-table server-health-table--network">
                      <div className="server-health-table__row server-health-table__row--header">
                        <span>Interface</span>
                        <span>RX</span>
                        <span>TX</span>
                        <span>RX errors</span>
                        <span>TX errors</span>
                        <span>Dropped</span>
                      </div>
                      {serverHealthNetworkInterfaces.length ? (
                        serverHealthNetworkInterfaces.map((entry) => (
                          <div className="server-health-table__row" key={entry.name}>
                            <span className="server-health-table__main">{entry.name}</span>
                            <span>{formatTransferBytes(entry.rxBytes)}</span>
                            <span>{formatTransferBytes(entry.txBytes)}</span>
                            <span>{entry.rxErrors ?? 0}</span>
                            <span>{entry.txErrors ?? 0}</span>
                            <span>
                              {(entry.rxDropped ?? 0).toLocaleString()}/
                              {(entry.txDropped ?? 0).toLocaleString()}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="hint">No network interface data yet.</p>
                      )}
                    </div>
                  ) : null}
                  {serverHealthDetailTab === "processes" ? (
                    <>
                      {serverProcessError ? <p className="hint sftp-error">{serverProcessError}</p> : null}
                      {serverProcessLoading ? (
                        <p className="hint" role="status" aria-live="polite">
                          Collecting process details...
                        </p>
                      ) : null}
                      <div className="server-health-details__columns">
                        <div className="server-health-processes">
                          <p className="hint server-health-processes__title">Top processes (CPU)</p>
                          {serverProcessSnapshot?.processes?.length ? (
                            <ul className="server-health-processes__list">
                              <li className="server-health-processes__item server-health-processes__item--header">
                                <span className="server-health-processes__pid">PID</span>
                                <span className="server-health-processes__user">User</span>
                                <span className="server-health-processes__command">Command</span>
                                <span className="server-health-processes__cpu">CPU</span>
                                <span className="server-health-processes__mem">MEM</span>
                              </li>
                              {serverProcessSnapshot.processes.map((entry) => (
                                <li className="server-health-processes__item" key={`cpu-${entry.pid}-${entry.command}`}>
                                  <span className="server-health-processes__pid">{entry.pid}</span>
                                  <span className="server-health-processes__user" title={entry.user}>
                                    {entry.user}
                                  </span>
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
                        <div className="server-health-processes">
                          <p className="hint server-health-processes__title">Top processes (Memory)</p>
                          {serverHealthMemoryProcesses.length ? (
                            <ul className="server-health-processes__list">
                              <li className="server-health-processes__item server-health-processes__item--header">
                                <span className="server-health-processes__pid">PID</span>
                                <span className="server-health-processes__user">User</span>
                                <span className="server-health-processes__command">Command</span>
                                <span className="server-health-processes__cpu">CPU</span>
                                <span className="server-health-processes__mem">MEM</span>
                              </li>
                              {serverHealthMemoryProcesses.map((entry) => (
                                <li className="server-health-processes__item" key={`mem-${entry.pid}-${entry.command}`}>
                                  <span className="server-health-processes__pid">{entry.pid}</span>
                                  <span className="server-health-processes__user" title={entry.user}>
                                    {entry.user}
                                  </span>
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
                      </div>
                    </>
                  ) : null}
                  {serverHealthDetailTab === "services" ? (
                    <div className="server-health-services server-health-services--details">
                      <p className="hint server-health-processes__title">Failed services</p>
                      {serverProcessError ? <p className="hint sftp-error">{serverProcessError}</p> : null}
                      {serverProcessSnapshot?.failedServices?.length ? (
                        <ul className="server-health-services__list server-health-services__list--details">
                          {serverProcessSnapshot.failedServices.map((entry) => (
                            <li className="server-health-services__item server-health-services__item--details" key={entry.name}>
                              <strong>{entry.name}</strong>
                              <span>
                                {[entry.loadState, entry.activeState, entry.subState].filter(Boolean).join(" / ") ||
                                  "-"}
                              </span>
                              {entry.description ? <small>{entry.description}</small> : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="hint">No failed services detected.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="hint">No server metrics collected yet.</p>
            )}
            <div className="modal__actions">
              <button
                className="secondary-button"
                disabled={!activeTerminalTab || !isActiveTabConnected || serverHealthLoading || serverProcessLoading}
                onClick={() => {
                  void refreshServerHealth();
                  void refreshServerProcesses();
                }}
                type="button"
              >
                Refresh
              </button>
              <button
                className="primary-button"
                onClick={() => setIsServerHealthDetailOpen(false)}
                type="button"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isOperationCenterOpen ? (
        <Suspense fallback={null}>
          <LazyOperationCenterModal
        canRetryAllFailedTransfers={canRetryAllFailedTransfers}
        canRetryFailedDownloads={canRetryFailedDownloads}
        canRetryFailedUploads={canRetryFailedUploads}
        deleteProgressLabel={operationCenterDeleteProgressLabel}
        downloadSummary={operationCenterDownloadSummary}
        failedRetryCandidateTotal={failedRetryCandidateTotal}
        finishedAppJobCount={operationCenterFinishedAppJobCount}
        hasActiveTab={Boolean(activeTabId)}
        hasActivity={hasOperationCenterActivity}
        hasDiagnosticsJobs={hasOperationCenterDiagnosticsJobs}
        hasSnippetJobs={hasOperationCenterSnippetJobs}
        isBulkCancelingTabs={isOperationCenterBulkCanceling}
        isReconnectingTabs={isOperationCenterReconnecting}
        labels={i18n.operationCenter}
        onCancelActiveDownloads={() => {
          void cancelAllActiveDownloads();
        }}
        onCancelActiveUploads={() => {
          void cancelAllActiveUploads();
        }}
        onCancelAllTransfersAcrossTabs={() => {
          void cancelAllTransfersAcrossTabs();
        }}
        onCancelTabTasks={(tabId) => {
          void cancelTransferTasksForTab(tabId);
        }}
        onClearFinishedAppJobs={clearFinishedOperationCenterAppJobs}
        onClose={closeOperationCenter}
        onCopyAppJobOutputPath={(jobId) => {
          void copyOperationCenterAppJobOutputPath(jobId);
        }}
        onFocusTab={setActiveTabId}
        onOpenDiagnostics={() => {
          closeOperationCenter();
          openSettingsPanel("diagnostics");
        }}
        onOpenDiagnosticsJobs={openDiagnosticsFromOperationCenter}
        onOpenPortForward={() => {
          closeOperationCenter();
          openSettingsPanel("portForwarding");
        }}
        onOpenSnippets={openCommandSnippetManagerFromOperationCenter}
        onReconnectDisconnectedTabs={() => {
          void reconnectDisconnectedOperationTabs();
        }}
        onReconnectTab={(tabId) => {
          void reconnectOperationTabById(tabId);
        }}
        onRetryActiveDownloads={() => {
          void retryFailedDownloads();
        }}
        onRetryActiveUploads={() => {
          void retryFailedUploads();
        }}
        onRetryAllFailedTransfers={() => {
          void retryAllFailedTransfersWithScopeChoice();
        }}
        open={isOperationCenterOpen}
        portForwardBusy={portForwardBusy}
        portForwardSummary={operationCenterPortForwardSummary}
        recentAppJobs={operationCenterRecentAppJobViews}
        runningAppJobCount={operationCenterRunningAppJobCount}
        timelineItems={operationCenterTimelineItems}
        transferTabSummaries={operationCenterTransferTabSummaries}
        uploadSummary={operationCenterUploadSummary}
          />
        </Suspense>
      ) : null}

      {isRetryCenterOpen ? (
        <Suspense fallback={null}>
          <LazyRetryCenterModal
        analytics={retryCenterAnalytics}
        autoUseLastRetryScope={retryCenterAutoUseLastRetryScope}
        canClearAllEntries={canClearAllRetryCenterEntries}
        canClearSelectedEntries={canClearSelectedRetryCenterEntries}
        canClearVisibleEntries={canClearVisibleRetryCenterEntries}
        canCollapseAllGroups={canCollapseAllRetryCenterGroups}
        canExpandAllGroups={canExpandAllRetryCenterGroups}
        canExportAnalytics={canExportRetryCenterAnalytics}
        canRetryAllFailedTransfers={canRetryAllFailedTransfers}
        canRetryFailedDownloads={canRetryFailedDownloads}
        canRetryFailedUploads={canRetryFailedUploads}
        canRetrySelectedEntries={canRetrySelectedRetryCenterEntries}
        canRetryVisibleEntries={canRetryVisibleRetryCenterEntries}
        collapsedGroupKeySet={retryCenterCollapsedGroupKeySet}
        direction={retryCenterDirection}
        entries={retryCenterEntries}
        entryCount={retryCenterEntries.length}
        failedDownloadCandidateCount={failedDownloadRetryCandidates.length}
        failedRetryCandidateTotal={failedRetryCandidateTotal}
        failedUploadCandidateCount={failedUploadRetryCandidates.length}
        failureReasonAllValue={RETRY_CENTER_FAILURE_REASON_ALL}
        failureReasonFilter={retryCenterResolvedFailureReasonFilter}
        failureReasonOptions={retryCenterFailureReasonOptions}
        failureSuggestionRows={retryCenterFailureSuggestionRows}
        formatHistoryTimestamp={formatHistoryTimestamp}
        formatPercent={formatPercent}
        groupedEntries={retryCenterGroupedEntries}
        hasActiveTab={Boolean(activeTabId)}
        hasCustomizedView={hasCustomizedRetryCenterView}
        isGroupedView={isRetryCenterGroupedView}
        lastRetryScope={retryCenterLastRetryScope}
        lastRetryScopeLabel={retryCenterLastRetryScopeLabel}
        labels={i18n.retryCenter}
        listMode={retryCenterListMode}
        maxRetryBatchConfirmThreshold={MAX_RETRY_BATCH_CONFIRM_THRESHOLD}
        minRetryBatchConfirmThreshold={MIN_RETRY_BATCH_CONFIRM_THRESHOLD}
        onClearAllEntries={() => {
          void clearAllRetryCenterEntries();
        }}
        onClearGroupEntries={(groupKey) => {
          void clearRetryCenterGroupEntries(groupKey);
        }}
        onClearSelectedEntries={() => {
          void clearSelectedRetryCenterEntries();
        }}
        onClearSelection={clearRetryCenterSelection}
        onClearVisibleEntries={() => {
          void clearVisibleRetryCenterEntries();
        }}
        onClearVisibleFailureReason={(reason) => {
          void clearVisibleRetryCenterEntriesByFailureReason(reason);
        }}
        onClose={closeRetryCenter}
        onCollapseAllGroups={collapseAllRetryCenterGroups}
        onDirectionChange={setRetryCenterDirection}
        onExpandAllGroups={expandAllRetryCenterGroups}
        onExportAnalyticsCsv={() => {
          void exportRetryCenterAnalyticsCsv();
        }}
        onExportAnalyticsJson={() => {
          void exportRetryCenterAnalyticsJson();
        }}
        onExportGroupHistoryCsv={(groupKey) => {
          void exportRetryCenterGroupHistoryCsvWithScopeChoice(groupKey);
        }}
        onExportGroupHistoryJson={(groupKey) => {
          void exportRetryCenterGroupHistoryJsonWithScopeChoice(groupKey);
        }}
        onExportVisibleHistoryCsv={() => {
          void exportRetryCenterVisibleHistoryCsv();
        }}
        onExportVisibleHistoryJson={() => {
          void exportRetryCenterVisibleHistoryJson();
        }}
        onFailureReasonFilterChange={setRetryCenterFailureReasonFilter}
        onLastRetryScopeChange={setRetryCenterLastRetryScope}
        onListModeChange={setRetryCenterListMode}
        onQueryChange={setRetryCenterQuery}
        onResetFilters={resetRetryCenterViewFilters}
        onRetryAllFailedTransfers={() => {
          void retryAllFailedTransfersWithScopeChoice();
        }}
        onRetryFailedDownloads={() => {
          void retryFailedDownloads();
        }}
        onRetryFailedUploads={() => {
          void retryFailedUploads();
        }}
        onRetryGroupFailedEntries={(groupKey) => {
          void retryRetryCenterGroupFailedEntries(groupKey);
        }}
        onRetrySelectedEntries={() => {
          void retrySelectedRetryCenterEntriesWithScopeChoice();
        }}
        onRetryVisibleEntries={() => {
          void retryVisibleRetryCenterEntriesWithScopeChoice();
        }}
        onRetryVisibleFailureReason={(reason) => {
          void retryVisibleRetryCenterEntriesWithScopeChoice(reason);
        }}
        onScopeChange={setRetryCenterScope}
        onSelectAllVisible={selectAllVisibleRetryCenterEntries}
        onSelectGroupEntries={selectRetryCenterGroupEntries}
        onStatusChange={setRetryCenterStatus}
        onTimeRangeChange={setRetryCenterTimeRange}
        onToggleAutoUseLastRetryScope={() => {
          setRetryCenterAutoUseLastRetryScope((prev) => !prev);
        }}
        onToggleEntrySelection={toggleRetryCenterEntrySelection}
        onToggleGroupCollapsed={toggleRetryCenterGroupCollapsed}
        open={isRetryCenterOpen}
        query={retryCenterQuery}
        retryBatchConfirmThreshold={retryBatchConfirmThreshold}
        scope={retryCenterScope}
        selectedCount={retryCenterSelection.length}
        selectedFailedCount={selectedRetryCenterFailedEntries.length}
        selectedFailureReasonLabel={retryCenterSelectedFailureReasonLabel}
        selectionSet={retryCenterSelectionSet}
        status={retryCenterStatus}
        timeRange={retryCenterTimeRange}
        topFailureReasonRetryRows={retryCenterTopFailureReasonRetryRows}
        totalHistoryCount={transferHistory.length}
        visibleFailedCount={visibleRetryCenterFailedEntries.length}
        onRetryBatchConfirmThresholdChange={(value) => {
          setRetryBatchConfirmThreshold((prev) =>
            parseRetryBatchConfirmThreshold(value, prev)
          );
        }}
          />
        </Suspense>
      ) : null}

      {isCommandHistoryManagerOpen ? (
        <Suspense fallback={null}>
          <LazyCommandHistoryManagerModal
        allVisibleSelected={allVisibleCommandHistorySelected}
        canClearSelection={commandHistorySelection.length > 0}
        canExport={terminalCommandHistoryEntries.length > 0}
        canToggleSelectVisible={visibleCommandHistoryIds.length > 0}
        entries={visibleTerminalCommandHistoryEntryViews}
        labels={i18n.commandHistoryManager}
        onAdd={() => {
          void addTerminalCommandHistoryEntry();
        }}
        onClearSelection={clearCommandHistorySelection}
        onClose={closeCommandHistoryManager}
        onDeleteAll={deleteAllCommandHistoryEntries}
        onDeleteSelected={deleteSelectedCommandHistoryEntries}
        onDeleteVisible={deleteVisibleCommandHistoryEntries}
        onEditEntry={(entryId) => {
          const entry = visibleCommandHistoryEntryById.get(entryId);
          if (!entry) {
            return;
          }
          void editTerminalCommandHistoryEntry(entry);
        }}
        onExport={() => {
          void exportTerminalCommandHistory();
        }}
        onImport={() => {
          void importTerminalCommandHistory();
        }}
        onPasteEntry={(entryId) => {
          const entry = visibleCommandHistoryEntryById.get(entryId);
          if (!entry) {
            return;
          }
          void pasteTerminalCommandHistoryEntry(entry);
        }}
        onToggleEntrySelection={toggleCommandHistorySelection}
        onToggleSelectVisible={toggleSelectAllVisibleCommandHistory}
        open={isCommandHistoryManagerOpen}
        selectedCount={commandHistorySelection.length}
        totalCount={terminalCommandHistoryEntries.length}
        visibleCount={visibleTerminalCommandHistoryEntries.length}
          />
        </Suspense>
      ) : null}

      {isCommandSnippetManagerOpen ? (
        <Suspense fallback={null}>
          <LazyCommandSnippetManagerModal
        buildParameterToken={buildCommandSnippetParameterToken}
        formatScopeLabel={formatCommandSnippetVariableScopeLabel}
        getPatternError={getCommandSnippetParameterPatternError}
        groupCount={commandSnippetGroups.length}
        groups={commandSnippetGroups}
        maxGroupCount={MAX_COMMAND_SNIPPET_GROUPS}
        maxParameters={MAX_COMMAND_SNIPPET_PARAMETERS}
        maxPromptSets={MAX_COMMAND_SNIPPET_PROMPT_SETS}
        maxSnippetsPerGroup={MAX_COMMAND_SNIPPETS_PER_GROUP}
        missingParameterKeys={selectedCommandSnippetMissingParameterKeys}
        onAddGroup={addCommandSnippetManagerGroup}
        onAddPromptSet={addCommandSnippetManagerPromptSet}
        onAddPromptSetParameter={addCommandSnippetManagerPromptSetParameter}
        onAddSnippet={addCommandSnippetManagerSnippet}
        onAddSnippetParameter={addCommandSnippetManagerSnippetParameter}
        onClearAll={() => {
          void clearAllCommandSnippetGroups();
        }}
        onClearScopedValues={() => {
          void clearCommandSnippetScopedValues();
        }}
        onClose={closeCommandSnippetManager}
        onDeleteGroup={() => {
          void deleteCommandSnippetManagerGroup();
        }}
        onDeletePromptSetParameter={deleteCommandSnippetManagerPromptSetParameter}
        onDeleteSelectedPromptSet={() => {
          void deleteSelectedCommandSnippetManagerPromptSet();
        }}
        onDeleteSnippet={() => {
          void deleteCommandSnippetManagerSnippet();
        }}
        onDeleteSnippetParameter={deleteCommandSnippetManagerSnippetParameter}
        onExportJson={() => {
          void exportCommandSnippetGroups();
        }}
        onGroupNameChange={updateCommandSnippetManagerGroupName}
        onImportJson={importCommandSnippetGroupsWithUiError}
        onInsertPromptSetParameterToken={insertCommandSnippetManagerPromptSetParameterToken}
        onInsertSnippetParameterToken={insertCommandSnippetManagerSnippetParameterToken}
        onPromptSetNameChange={updateCommandSnippetManagerPromptSetName}
        onPromptSetParameterDefaultChange={updateCommandSnippetManagerPromptSetParameterDefault}
        onPromptSetParameterKeyChange={updateCommandSnippetManagerPromptSetParameterKey}
        onPromptSetParameterLabelChange={updateCommandSnippetManagerPromptSetParameterLabel}
        onPromptSetParameterPatternChange={updateCommandSnippetManagerPromptSetParameterPattern}
        onPromptSetParameterRequiredChange={updateCommandSnippetManagerPromptSetParameterRequired}
        onPromptSetParameterScopeChange={updateCommandSnippetManagerPromptSetParameterScope}
        onRunSelectedSnippet={() => {
          void runSelectedCommandSnippetManagerSnippet();
        }}
        onRunSnippet={runCommandSnippetManagerSnippetById}
        onSelectGroup={selectCommandSnippetManagerGroup}
        onSelectedGroupNameBlur={normalizeSelectedCommandSnippetManagerGroupName}
        onSelectedPromptSetNameBlur={normalizeSelectedCommandSnippetManagerPromptSetName}
        onSelectedSnippetNameBlur={normalizeSelectedCommandSnippetManagerSnippetName}
        onSelectSnippet={selectCommandSnippetManagerSnippet}
        onSnippetConfirmChange={updateCommandSnippetManagerSnippetConfirm}
        onSnippetNameChange={updateCommandSnippetManagerSnippetName}
        onSnippetParameterDefaultChange={updateCommandSnippetManagerSnippetParameterDefault}
        onSnippetParameterKeyChange={updateCommandSnippetManagerSnippetParameterKey}
        onSnippetParameterLabelChange={updateCommandSnippetManagerSnippetParameterLabel}
        onSnippetParameterPatternChange={updateCommandSnippetManagerSnippetParameterPattern}
        onSnippetParameterRequiredChange={updateCommandSnippetManagerSnippetParameterRequired}
        onSnippetParameterScopeChange={updateCommandSnippetManagerSnippetParameterScope}
        onSnippetPreviewChange={updateCommandSnippetManagerSnippetPreview}
        onSnippetPromptSetChange={updateCommandSnippetManagerSnippetPromptSet}
        onSnippetTemplateChange={updateCommandSnippetManagerSnippetTemplate}
        open={isCommandSnippetManagerOpen}
        scopedValueCount={commandSnippetScopedValueCount}
        scopeOptions={COMMAND_SNIPPET_VARIABLE_SCOPES}
        selectedGroup={selectedCommandSnippetManagerGroup}
        selectedPromptSet={selectedCommandSnippetManagerPromptSet}
        selectedSnippet={selectedCommandSnippetManagerSnippet}
        selectedSnippetHasInvalidPattern={selectedCommandSnippetHasInvalidPattern}
        shadowedPromptSetKeys={selectedCommandSnippetShadowedPromptSetKeys}
        totalPromptSetCount={totalCommandSnippetPromptSetCount}
        totalSnippetCount={totalCommandSnippetCount}
        unusedParameterKeys={selectedCommandSnippetUnusedParameterKeys}
          />
        </Suspense>
      ) : null}

      {commandHistoryContextMenu ? (
        <WorkbenchContextMenu
          actions={commandHistoryContextMenuActions}
          height={selectedCommandHistoryContextEntry ? 152 : 192}
          ref={commandHistoryContextMenuRef}
          width={196}
          x={commandHistoryContextMenu.x}
          y={commandHistoryContextMenu.y}
        />
      ) : null}

      {sftpToolbarMenu ? (
        <WorkbenchContextMenu
          actions={sftpToolbarMenuActions}
          height={sftpToolbarActions.length * 26 + 16}
          ref={sftpToolbarMenuRef}
          width={236}
          x={sftpToolbarMenu.x}
          y={sftpToolbarMenu.y}
        />
      ) : null}

      {sftpContextMenu ? (
        <WorkbenchContextMenu
          actions={sftpEntryContextMenuActions}
          height={232}
          ref={sftpContextMenuRef}
          width={196}
          x={sftpContextMenu.x}
          y={sftpContextMenu.y}
        />
      ) : null}

      {sessionContextMenu && sessionContextMenuItems.length > 0 ? (
        <WorkbenchContextMenu
          actions={sessionContextMenuItems}
          height={sessionContextActions.length * 26 + 16}
          ref={sessionContextMenuRef}
          width={236}
          x={sessionContextMenu.x}
          y={sessionContextMenu.y}
        />
      ) : null}

      <SettingsModalShell
        activeSectionId={activeSettingsSection}
        doneLabel={i18n.settings.done}
        onClose={closeSettingsPanel}
        onSelectSection={(sectionId) => setActiveSettingsSection(sectionId as SettingsSectionId)}
        open={isSettingsOpen}
        sectionTitle={i18n.settings.sections[getSettingsSectionI18nKey(activeSettingsSection)].title}
        sectionsAriaLabel={i18n.settings.sectionsAriaLabel}
        sections={settingsSections}
        titleLabel={i18n.settings.title}
        versionLabel={i18n.settings.version(APP_VERSION)}
      >
        <SettingsModalContent
          activeSectionId={activeSettingsSection}
          connectionSectionProps={connectionSettingsSectionProps}
          diagnosticsSectionProps={diagnosticsSettingsSectionProps}
          fileOpeningSectionProps={fileOpeningSettingsSectionProps}
          hotkeySectionProps={hotkeySettingsSectionProps}
          portForwardingSectionProps={portForwardingSettingsSectionProps}
          safetySectionProps={safetySettingsSectionProps}
          serverHealthSectionProps={serverHealthSettingsSectionProps}
          sftpSectionProps={sftpSettingsSectionProps}
          workspaceSectionProps={workspaceSettingsSectionProps}
        />
      </SettingsModalShell>

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
              <div className="session-template-tools">
                <div className="session-template-tools__summary">
                  <strong>Template Tools</strong>
                  <span className="hint">
                    Saved templates {sessionTemplates.length}/{MAX_SESSION_TEMPLATES}
                  </span>
                </div>
                <div className="session-template-tools__actions">
                  <button
                    className="field-row__action"
                    disabled={sessionTemplates.length === 0}
                    onClick={() => void chooseSessionTemplateAndApply()}
                    type="button"
                  >
                    Apply Template...
                  </button>
                  <button
                    className="field-row__action"
                    onClick={() =>
                      openSessionTemplateManager({
                        sourceForm: form
                      })
                    }
                    type="button"
                  >
                    Save as Template...
                  </button>
                  <button
                    className="field-row__action"
                    onClick={() => openSessionTemplateManager()}
                    type="button"
                  >
                    Manage Templates...
                  </button>
                </div>
              </div>
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

      {isSessionTemplateManagerOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
        >
          <div
            className="modal modal--wide"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Session Templates"
          >
            <div className="modal__header">
              <h3>Session Templates</h3>
              <button
                className="icon-button"
                onClick={closeSessionTemplateManager}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="session-template-manager">
              <aside className="session-template-manager__sidebar">
                <div className="session-template-manager__sidebar-actions">
                  <button
                    className="field-row__action"
                    onClick={resetSessionTemplateDraft}
                    type="button"
                  >
                    New Blank
                  </button>
                  <button
                    className="field-row__action"
                    onClick={() => startSessionTemplateDraftFromForm(form)}
                    type="button"
                  >
                    Use Current Form
                  </button>
                </div>
                <p className="hint">
                  Use {"${ENV_NAME}"} placeholders in host, name, user, group, remark, secret, and
                  key path fields.
                </p>
                {sessionTemplates.length === 0 ? (
                  <p className="hint">No saved templates yet.</p>
                ) : (
                  <ul className="session-template-list">
                    {sessionTemplates.map((template) => (
                      <li key={template.id}>
                        <button
                          className={
                            editingSessionTemplateId === template.id
                              ? "session-template-list__item is-selected"
                              : "session-template-list__item"
                          }
                          onClick={() => loadSessionTemplateForEditing(template)}
                          type="button"
                        >
                          <span className="session-template-list__name">
                            {template.templateName}
                          </span>
                          <span className="session-template-list__meta">
                            {(template.host || "host pending") +
                              (template.username ? ` · ${template.username}` : "")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
              <form
                className="session-form session-template-manager__editor"
                onSubmit={(event) => saveSessionTemplateDraft(event)}
              >
                <label>
                  Template Name
                  <input
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setSessionTemplateDraft((prev) => ({
                        ...prev,
                        templateName: nextValue
                      }));
                      setSessionTemplateError(null);
                    }}
                    placeholder="Prod Web Template"
                    value={sessionTemplateDraft.templateName}
                  />
                </label>
                <div className="field-grid">
                  <label>
                    Session Name
                    <input
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setSessionTemplateDraft((prev) => ({
                          ...prev,
                          sessionName: nextValue
                        }));
                        setSessionTemplateError(null);
                      }}
                      placeholder="web-${ENV}-${INDEX}"
                      value={sessionTemplateDraft.sessionName}
                    />
                  </label>
                  <label>
                    Port
                    <input
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setSessionTemplateDraft((prev) => ({
                          ...prev,
                          port: nextValue
                        }));
                        setSessionTemplateError(null);
                      }}
                      placeholder="22"
                      value={sessionTemplateDraft.port}
                    />
                  </label>
                </div>
                <div className="field-grid">
                  <label>
                    Host
                    <input
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setSessionTemplateDraft((prev) => ({
                          ...prev,
                          host: nextValue
                        }));
                        setSessionTemplateError(null);
                      }}
                      placeholder="${HOST}"
                      value={sessionTemplateDraft.host}
                    />
                  </label>
                  <label>
                    Username
                    <input
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setSessionTemplateDraft((prev) => ({
                          ...prev,
                          username: nextValue
                        }));
                        setSessionTemplateError(null);
                      }}
                      placeholder="deploy"
                      value={sessionTemplateDraft.username}
                    />
                  </label>
                </div>
                <div className="field-grid">
                  <label>
                    Group
                    <input
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setSessionTemplateDraft((prev) => ({
                          ...prev,
                          groupId: nextValue
                        }));
                        setSessionTemplateError(null);
                      }}
                      placeholder="${ENV}"
                      value={sessionTemplateDraft.groupId}
                    />
                  </label>
                  <label>
                    Auth Type
                    <select
                      onChange={(event) => {
                        const nextValue = event.target.value as SessionCreateInput["authType"];
                        setSessionTemplateDraft((prev) => ({
                          ...prev,
                          authType: nextValue
                        }));
                        setSessionTemplateError(null);
                      }}
                      value={sessionTemplateDraft.authType}
                    >
                      <option value="password">Password</option>
                      <option value="privateKey">Private Key</option>
                    </select>
                  </label>
                </div>
                {sessionTemplateDraft.authType === "privateKey" ? (
                  <label>
                    Private Key Path
                    <input
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setSessionTemplateDraft((prev) => ({
                          ...prev,
                          privateKeyPath: nextValue
                        }));
                        setSessionTemplateError(null);
                      }}
                      placeholder="~/.ssh/${KEY_NAME}"
                      value={sessionTemplateDraft.privateKeyPath}
                    />
                  </label>
                ) : null}
                <label>
                  {sessionTemplateDraft.authType === "password"
                    ? "Password / Secret"
                    : "Key Passphrase"}
                  <input
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setSessionTemplateDraft((prev) => ({
                        ...prev,
                        secret: nextValue
                      }));
                      setSessionTemplateError(null);
                    }}
                    placeholder={
                      sessionTemplateDraft.authType === "password"
                        ? "${SSH_PASSWORD}"
                        : "${KEY_PASSPHRASE}"
                    }
                    type="password"
                    value={sessionTemplateDraft.secret}
                  />
                </label>
                <label className="settings-checkbox">
                  <input
                    checked={sessionTemplateDraft.favorite}
                    onChange={(event) => {
                      const nextValue = event.target.checked;
                      setSessionTemplateDraft((prev) => ({
                        ...prev,
                        favorite: nextValue
                      }));
                    }}
                    type="checkbox"
                  />
                  Mark created sessions as favorite
                </label>
                <label>
                  Remark
                  <input
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setSessionTemplateDraft((prev) => ({
                        ...prev,
                        remark: nextValue
                      }));
                      setSessionTemplateError(null);
                    }}
                    placeholder="Managed by ${OWNER}"
                    value={sessionTemplateDraft.remark}
                  />
                </label>
                <section className="session-template-env-vars">
                  <div className="session-template-env-vars__header">
                    <div>
                      <h4>Template Env Vars</h4>
                      <p className="hint">
                        {sessionTemplateDraft.envVars.length}/{MAX_SESSION_TEMPLATE_ENV_VARS} saved
                        values
                      </p>
                    </div>
                    <button
                      className="field-row__action"
                      disabled={
                        sessionTemplateDraft.envVars.length >= MAX_SESSION_TEMPLATE_ENV_VARS
                      }
                      onClick={addSessionTemplateEnvVar}
                      type="button"
                    >
                      Add Variable
                    </button>
                  </div>
                  {sessionTemplateDraft.envVars.length === 0 ? (
                    <p className="hint">No template env vars yet.</p>
                  ) : (
                    <div className="session-template-env-vars__list">
                      {sessionTemplateDraft.envVars.map((envVar) => (
                        <div className="session-template-env-vars__row" key={envVar.id}>
                          <input
                            onChange={(event) =>
                              updateSessionTemplateEnvVar(envVar.id, {
                                key: event.target.value
                              })
                            }
                            placeholder="ENV_NAME"
                            value={envVar.key}
                          />
                          <input
                            onChange={(event) =>
                              updateSessionTemplateEnvVar(envVar.id, {
                                value: event.target.value
                              })
                            }
                            placeholder="value"
                            value={envVar.value}
                          />
                          <button
                            className="icon-button"
                            onClick={() => removeSessionTemplateEnvVar(envVar.id)}
                            type="button"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                {sessionTemplateError ? (
                  <p className="hint test-result test-result--error">{sessionTemplateError}</p>
                ) : null}
                <div className="modal__actions">
                  <button
                    className="icon-button"
                    onClick={closeSessionTemplateManager}
                    type="button"
                  >
                    Close
                  </button>
                  <button
                    className="field-row__action"
                    disabled={!editingSessionTemplate}
                    onClick={() =>
                      editingSessionTemplate
                        ? void applySessionTemplateToForm(editingSessionTemplate, {
                            openCreateModal: true,
                            forceNewSession: !isCreateModalOpen
                          })
                        : undefined
                    }
                    type="button"
                  >
                    Use Template
                  </button>
                  <button
                    className="field-row__action"
                    disabled={!editingSessionTemplate}
                    onClick={() => void deleteEditingSessionTemplate()}
                    type="button"
                  >
                    Delete Template
                  </button>
                  <button className="primary-button" type="submit">
                    {editingSessionTemplate ? "Save Changes" : "Save Template"}
                  </button>
                </div>
              </form>
            </div>
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

      {appDialog ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className={
              appDialog.mode === "choice"
                ? "modal modal--compact app-dialog app-dialog--choice"
                : (appDialog.mode === "alert" || appDialog.mode === "confirm") && appDialog.detailText
                  ? "modal modal--compact app-dialog app-dialog--details"
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
                  type={appDialog.inputType ?? "text"}
                  value={appDialogInput}
                />
              )
            ) : (appDialog.mode === "alert" || appDialog.mode === "confirm" || appDialog.mode === "choice") &&
              appDialog.detailText ? (
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
              {appDialog.mode !== "alert" ? (
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
            {globalErrorRecovery.settingsAction === "connection" ? (
              <button
                className="secondary-button secondary-button--small"
                onClick={openConnectionSettingsFromError}
                type="button"
              >
                Connection Settings
              </button>
            ) : null}
            {globalErrorRecovery.settingsAction === "fileOpening" ? (
              <button
                className="secondary-button secondary-button--small"
                onClick={openFileOpeningSettingsFromError}
                type="button"
              >
                File Opening
              </button>
            ) : null}
            {globalErrorRecovery.settingsAction === "hotkeys" ? (
              <button
                className="secondary-button secondary-button--small"
                onClick={openHotkeysSettingsFromError}
                type="button"
              >
                Hotkeys
              </button>
            ) : null}
            {globalErrorRecovery.settingsAction === "workspace" ? (
              <button
                className="secondary-button secondary-button--small"
                onClick={openWorkspaceSettingsFromError}
                type="button"
              >
                Workspace
              </button>
            ) : null}
            {globalErrorRecovery.settingsAction === "safety" ? (
              <button
                className="secondary-button secondary-button--small"
                onClick={openSafetySettingsFromError}
                type="button"
              >
                Safety
              </button>
            ) : null}
            {globalErrorRecovery.settingsAction === "serverHealth" ? (
              <button
                className="secondary-button secondary-button--small"
                onClick={openServerHealthSettingsFromError}
                type="button"
              >
                Monitor
              </button>
            ) : null}
            {globalErrorRecovery.settingsAction === "sftp" ? (
              <button
                className="secondary-button secondary-button--small"
                onClick={openSftpSettingsFromError}
                type="button"
              >
                SFTP Settings
              </button>
            ) : null}
            {globalErrorRecovery.settingsAction === "portForwarding" ? (
              <button
                className="secondary-button secondary-button--small"
                onClick={openPortForwardingSettingsFromError}
                type="button"
              >
                Port Fwd
              </button>
            ) : null}
            {globalErrorRecovery.canOpenRetryCenter ? (
              <button
                className="secondary-button secondary-button--small"
                onClick={openRetryCenterFromError}
                type="button"
              >
                Retry Center
              </button>
            ) : null}
            {globalErrorRecovery.canOpenOperationCenter ? (
              <button
                className="secondary-button secondary-button--small"
                onClick={openOperationCenterFromError}
                type="button"
              >
                Operation Center
              </button>
            ) : null}
            {globalErrorRecovery.canExportBugReport ? (
              <button
                className="secondary-button secondary-button--small"
                onClick={exportBugReportFromError}
                type="button"
              >
                Export Bug Report
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
