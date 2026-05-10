export type AppLanguage = "en" | "zh-CN";
export type WorkspaceProfileI18nKey = "none" | "dev" | "staging" | "prod";
export type SettingsSectionI18nKey =
  | "connection"
  | "workspace"
  | "safety"
  | "hotkeys"
  | "serverHealth"
  | "fileOpening"
  | "sftp"
  | "portForwarding"
  | "diagnostics";
export type TransferDirectionLabel = "upload" | "download";

export interface AppLanguageOption {
  id: AppLanguage;
  label: string;
  shortLabel: string;
}

export interface WorkspaceSettingsLabels {
  languageTitle: string;
  languageDescription: string;
  languageLabel: string;
  currentLanguage: (languageLabel: string) => string;
  workspaceProfileTitle: string;
  workspaceProfileDescription: string;
  syncSafetyLabel: string;
  currentProfile: (profileLabel: string, syncLabel: string) => string;
  syncOn: string;
  syncOff: string;
  syncDescription: string;
  terminalEditorFocusTitle: string;
  terminalEditorFocusDescription: string;
  autoFocusLabel: string;
  editorThemeTitle: string;
  editorThemeDescription: string;
  editorTypographyTitle: string;
  editorTypographyDescription: string;
  editorFontTitle: string;
  editorFontDescription: string;
  editorRhythmTitle: string;
  editorRhythmDescription: string;
  editorCursorTitle: string;
  editorCursorDescription: string;
  currentEditorFocus: (
    enabledLabel: string,
    themeLabel: string,
    typographyLabel: string,
    fontLabel: string,
    rhythmLabel: string,
    cursorLabel: string
  ) => string;
  enabled: string;
  disabled: string;
  profileOptions: Record<WorkspaceProfileI18nKey, {
    label: string;
    shortLabel: string;
    description: string;
  }>;
  safetyDefault: (templateLabel: string, policyPackLabel: string) => string;
}

export interface SettingsModalLabels {
  title: string;
  sectionsAriaLabel: string;
  done: string;
  version: (version: string) => string;
  sections: Record<SettingsSectionI18nKey, {
    nav: string;
    title: string;
  }>;
  workspace: WorkspaceSettingsLabels;
}

export interface TransferDockLabels {
  title: string;
  boundTo: (tabTitle: string) => string;
  emptyBinding: string;
  restorePending: string;
  discardPending: string;
  retryAllFailed: string;
  retryAllFailedTitle: string;
  retryCenter: string;
  operationCenter: string;
  retryFailed: string;
  clearFinished: string;
  cancelTransfer: (direction: TransferDirectionLabel) => string;
  cancelAllUploadsLabel: string;
  cancelAllUploadsTitle: string;
  cancelAllDownloadsLabel: string;
  cancelAllDownloadsTitle: string;
  uploadsTitle: (running: number, queued: number, threads: number) => string;
  downloadsTitle: (running: number, queued: number, threads: number) => string;
  uploadEmpty: string;
  downloadEmpty: string;
  storedFailedRetries: (count: number) => string;
  progressSummary: (
    completed: number,
    total: number,
    failed: number,
    canceled: number,
    running: number,
    queued: number
  ) => string;
  schedulePaused: (summary: string, nextOpeningLabel: string | null) => string;
  uploadDisconnectedPaused: string;
  downloadDisconnectedPaused: string;
}

export interface OperationCenterLabels {
  title: string;
  description: string;
  groupedControls: string;
  ready: string;
  idle: string;
  active: string;
  running: string;
  working: string;
  transfers: string;
  activeTab: string;
  tools: string;
  transfersMeta: (activeTabCount: number, retryCandidateCount: number) => string;
  activeTabMeta: (uploadFailedCount: number, downloadFailedCount: number) => string;
  toolsMeta: (portForwardCount: number, appJobCount: number) => string;
  retryAllFailed: string;
  retryAllFailedWithCount: (count: number) => string;
  retryAllFailedTitle: string;
  canceling: string;
  cancelAllActive: string;
  reconnecting: string;
  reconnectDisconnected: string;
  reconnectDisconnectedTabs: string;
  cancelAllTransfersAllTabs: string;
  cancelUploads: string;
  cancelDownloads: string;
  retryUploads: string;
  retryDownloads: string;
  portFwd: string;
  diagnostics: string;
  clearJobs: string;
  uploadQueue: string;
  downloadQueue: string;
  queueMeta: (activeTabCount: number, running: number, queued: number) => string;
  progressMeta: (completed: number, total: number, failed: number, canceled: number) => string;
  cancelActiveTab: string;
  retryActiveTab: string;
  remoteDelete: string;
  noActiveDelete: string;
  deleteCancellationUnavailable: string;
  portForwardingOps: string;
  portForwardMeta: (activeTabCount: number, total: number, degraded: number) => string;
  activeTabStatus: (status: string) => string;
  noRecentStatus: string;
  openPortFwd: string;
  openDiagnostics: string;
  activityTimeline: string;
  itemCount: (count: number) => string;
  noActivityTimeline: string;
  trackedAppJobs: string;
  appJobState: (runningCount: number, recentCount: number) => string;
  appJobMeta: (categoryLabel: string, startedAtLabel: string, durationLabel: string) => string;
  outputPath: (path: string) => string;
  copyPath: string;
  clearFinished: string;
  openSnippets: string;
  allTabsTransferActivity: string;
  tabCount: (count: number) => string;
  transferTabMeta: (
    uploadRunning: number,
    uploadQueued: number,
    downloadRunning: number,
    downloadQueued: number,
    totalActive: number
  ) => string;
  connected: string;
  disconnected: string;
  focusTab: string;
  reconnectTab: string;
  cancelTabTasks: string;
  noTransferActivity: string;
  noHighLatencyActivity: string;
  noTrackedAppJobs: string;
  done: string;
}

export interface RetryCenterSummaryLabelsInput {
  entryCount: number;
  totalHistoryCount: number;
  selectedCount: number;
  selectedFailedCount: number;
  visibleFailedCount: number;
  failedUploadCandidateCount: number;
  failedDownloadCandidateCount: number;
  selectedFailureReasonLabel: string;
  lastRetryScopeLabel: string;
  autoUseLastRetryScope: boolean;
  retryBatchConfirmThreshold: number;
  isGroupedView: boolean;
  groupCount: number;
  collapsedGroupCount: number;
}

export interface RetryCenterLabels {
  title: string;
  description: string;
  scope: string;
  activeSession: string;
  allSessions: string;
  direction: string;
  all: string;
  upload: string;
  download: string;
  status: string;
  failed: string;
  completed: string;
  canceled: string;
  queued: string;
  running: string;
  timeRange: string;
  last5m: string;
  last30m: string;
  last1h: string;
  last24h: string;
  view: string;
  flatList: string;
  groupedByFailure: string;
  failureReason: string;
  allFailureReasons: (count: number) => string;
  defaultRetryScope: string;
  allRetryable: string;
  uploadOnly: string;
  downloadOnly: string;
  retryConfirmThreshold: string;
  largeBatchHint: string;
  search: string;
  searchPlaceholder: string;
  resetFilters: string;
  autoRetryScopeOn: string;
  autoRetryScopeOff: string;
  autoRetryScopeTitle: string;
  summary: (input: RetryCenterSummaryLabelsInput) => string;
  failureRatio: string;
  failedRatio: (failedCount: number, totalCount: number) => string;
  directionBreakdown: string;
  statusBreakdown: (completed: number, failed: number, canceled: number) => string;
  topSessionsGroups: string;
  noVisibleRecords: string;
  noGroupData: string;
  topFailureReasons: string;
  noFailedRecords: string;
  filterByFailureReasonTitle: (reason: string) => string;
  retryFailureReasonTitle: (reason: string) => string;
  deleteFailureReasonTitle: (reason: string) => string;
  retryWithCount: (count: number) => string;
  deleteWithCount: (count: number) => string;
  failureReasonHelp: string;
  expandAllGroups: string;
  collapseAllGroups: string;
  expandGroup: string;
  collapseGroup: string;
  expand: string;
  collapse: string;
  groupMeta: (total: number, failedCount: number, retryableCount: number) => string;
  selectWithCount: (count: number) => string;
  retryFailedWithCount: (count: number) => string;
  retryGroupFailedTitle: string;
  deleteCount: (count: number) => string;
  exportJson: string;
  exportCsv: string;
  noHistoryMatches: string;
  selectVisible: string;
  clearSelection: string;
  exportVisibleJson: string;
  exportVisibleCsv: string;
  exportAnalyticsJson: string;
  exportAnalyticsCsv: string;
  retryFailedUploads: (count: number) => string;
  retryFailedDownloads: (count: number) => string;
  retryAllFailed: (count: number) => string;
  retryVisibleFailed: string;
  retrySelectedFailed: string;
  deleteSelected: string;
  deleteVisible: string;
  deleteAll: string;
  retryFailedUploadsTitle: string;
  retryFailedDownloadsTitle: string;
  retryAllFailedTitle: string;
  retryVisibleFailedTitle: string;
  retrySelectedFailedTitle: string;
  done: string;
  entryAttempts: (count: number) => string;
  entryMeta: (timestampLabel: string, directionLabel: string, attemptCount: number, message?: string) => string;
  directionLabel: (direction: TransferDirectionLabel) => string;
  statusLabel: (status: string) => string;
}

export interface WorkbenchTopbarLabels {
  subtitle: string;
  autoReconnect: (delaySeconds: number) => string;
  autoReconnectOff: string;
}

export interface AppI18n {
  topbar: WorkbenchTopbarLabels;
  settings: SettingsModalLabels;
  transfer: TransferDockLabels;
  operationCenter: OperationCenterLabels;
  retryCenter: RetryCenterLabels;
}

export const APP_LANGUAGE_OPTIONS: AppLanguageOption[] = [
  { id: "en", label: "English", shortLabel: "EN" },
  { id: "zh-CN", label: "简体中文", shortLabel: "中" }
];

const APP_LANGUAGE_STORAGE_KEY = "termdock.app-language.v1";

function isAppLanguage(value: string | null): value is AppLanguage {
  return value === "en" || value === "zh-CN";
}

function readStorageItem(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageItem(key: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures; the in-memory language still applies for this launch.
  }
}

export function readAppLanguagePreference(): AppLanguage {
  const rawValue = readStorageItem(APP_LANGUAGE_STORAGE_KEY);
  return isAppLanguage(rawValue) ? rawValue : "en";
}

export function writeAppLanguagePreference(value: AppLanguage): void {
  writeStorageItem(APP_LANGUAGE_STORAGE_KEY, value);
}

const ENGLISH_I18N: AppI18n = {
  topbar: {
    subtitle: "SSH + SFTP Workbench",
    autoReconnect: (delaySeconds) => `Auto Reconnect ${delaySeconds}s`,
    autoReconnectOff: "Auto Reconnect Off"
  },
  settings: {
    title: "Settings",
    sectionsAriaLabel: "Settings sections",
    done: "Done",
    version: (version) => `Version ${version}`,
    sections: {
      connection: { nav: "Connection", title: "Connection" },
      workspace: { nav: "Workspace", title: "Workspace Profile" },
      safety: { nav: "Safety", title: "Safety Guardrails" },
      hotkeys: { nav: "Hotkeys", title: "Hotkeys" },
      serverHealth: { nav: "Monitor", title: "Server Health Alerts" },
      fileOpening: { nav: "File Open", title: "File Opening" },
      sftp: { nav: "SFTP", title: "SFTP Transfers" },
      portForwarding: { nav: "Port Fwd", title: "Port Forwarding" },
      diagnostics: { nav: "Diagnostics", title: "Diagnostics" }
    },
    workspace: {
      languageTitle: "Interface Language",
      languageDescription: "Choose the display language for the TermDock interface.",
      languageLabel: "Language",
      currentLanguage: (languageLabel) => `Current language: ${languageLabel}`,
      workspaceProfileTitle: "Workspace Profile",
      workspaceProfileDescription:
        "Set an environment-wide risk cue for this app instance. This profile is shown in the UI and can also drive the global Safety pack/template defaults.",
      syncSafetyLabel: "Sync global Safety pack/template to workspace profile",
      currentProfile: (profileLabel, syncLabel) =>
        `Current profile: ${profileLabel} | Safety sync ${syncLabel} | group overrides still win for matching session groups`,
      syncOn: "on",
      syncOff: "off",
      syncDescription:
        "When sync is enabled, the global Safety environment template and recommended policy pack follow the selected workspace profile. Custom patterns, persistent approvals, and session-group overrides stay untouched.",
      terminalEditorFocusTitle: "Terminal Editor Focus",
      terminalEditorFocusDescription:
        "Automatically tighten the main layout when the active terminal tab enters an alternate-screen editor such as `nano` or `vim`.",
      autoFocusLabel: "Auto-focus alternate-screen terminal editors",
      editorThemeTitle: "Editor Theme",
      editorThemeDescription:
        "Change the focused terminal canvas colors while leaving regular shell tabs unchanged.",
      editorTypographyTitle: "Editor Typography",
      editorTypographyDescription:
        "Adjust editor-mode font size and row height without changing normal shell density.",
      editorFontTitle: "Editor Font",
      editorFontDescription:
        "Swap the editor-mode mono stack without changing the normal terminal font.",
      editorRhythmTitle: "Editor Text Rhythm",
      editorRhythmDescription:
        "Adjust editor-mode stroke weight and glyph spacing without changing the regular shell.",
      editorCursorTitle: "Editor Cursor",
      editorCursorDescription:
        "Pick a distinct cursor shape for editor mode without changing the regular shell cursor.",
      currentEditorFocus: (
        enabledLabel,
        themeLabel,
        typographyLabel,
        fontLabel,
        rhythmLabel,
        cursorLabel
      ) =>
        `Current editor focus mode: ${enabledLabel} | Theme ${themeLabel} | Typography ${typographyLabel} | Font ${fontLabel} | Rhythm ${rhythmLabel} | Cursor ${cursorLabel} | Only affects the active tab and never rewrites terminal editor content`,
      enabled: "on",
      disabled: "off",
      profileOptions: {
        none: {
          label: "No Profile",
          shortLabel: "No Profile",
          description: "Do not apply a shared workspace environment profile."
        },
        dev: {
          label: "Development",
          shortLabel: "Dev",
          description: "Use lower-friction defaults for local or sandbox workflows."
        },
        staging: {
          label: "Staging",
          shortLabel: "Staging",
          description: "Use shared-validation defaults and medium risk cues."
        },
        prod: {
          label: "Production",
          shortLabel: "Prod",
          description: "Use highest-risk cues and stricter safety defaults."
        }
      },
      safetyDefault: (templateLabel, policyPackLabel) =>
        `Safety default: ${templateLabel} / ${policyPackLabel}`
    }
  },
  transfer: {
    title: "Transfers",
    boundTo: (tabTitle) => `Bound to ${tabTitle}`,
    emptyBinding: "Open a terminal tab to manage transfers",
    restorePending: "Restore Pending",
    discardPending: "Discard Pending",
    retryAllFailed: "Retry All Failed",
    retryAllFailedTitle: "Retry all failed upload/download candidates with retry-scope strategy",
    retryCenter: "Retry Center",
    operationCenter: "Operation Center",
    retryFailed: "Retry Failed",
    clearFinished: "Clear Finished",
    cancelTransfer: (direction) => `Cancel ${direction}`,
    cancelAllUploadsLabel: "Cancel all upload tasks",
    cancelAllUploadsTitle: "Cancel all upload tasks in this tab",
    cancelAllDownloadsLabel: "Cancel all download tasks",
    cancelAllDownloadsTitle: "Cancel all download tasks in this tab",
    uploadsTitle: (running, queued, threads) =>
      `Uploads (running ${running}, queued ${queued}, threads ${threads})`,
    downloadsTitle: (running, queued, threads) =>
      `Downloads (running ${running}, queued ${queued}, threads ${threads})`,
    uploadEmpty: "No upload transfers.",
    downloadEmpty: "No download transfers.",
    storedFailedRetries: (count) => `Stored failed retries for this session: ${count}`,
    progressSummary: (completed, total, failed, canceled, running, queued) =>
      `Progress: ${completed}/${total} completed (failed ${failed}, canceled ${canceled}, running ${running}, queued ${queued})`,
    schedulePaused: (summary, nextOpeningLabel) =>
      `Queue paused: outside the configured transfer window (${summary}). Transfers will resume automatically${
        nextOpeningLabel ? ` at ${nextOpeningLabel}.` : " when the window opens."
      }`,
    uploadDisconnectedPaused:
      "Queue paused: terminal disconnected. Reconnect this tab to resume uploads.",
    downloadDisconnectedPaused:
      "Queue paused: terminal disconnected. Reconnect this tab to resume downloads."
  },
  operationCenter: {
    title: "Operation Center",
    description: "Consolidated view for long-running operations across open workspace tabs.",
    groupedControls: "Grouped Controls",
    ready: "Ready",
    idle: "Idle",
    active: "Active",
    running: "Running",
    working: "Working",
    transfers: "Transfers",
    activeTab: "Active Tab",
    tools: "Tools",
    transfersMeta: (activeTabCount, retryCandidateCount) =>
      `active tabs ${activeTabCount} | retry candidates ${retryCandidateCount}`,
    activeTabMeta: (uploadFailedCount, downloadFailedCount) =>
      `uploads failed ${uploadFailedCount} | downloads failed ${downloadFailedCount}`,
    toolsMeta: (portForwardCount, appJobCount) =>
      `port forwards ${portForwardCount} | app jobs ${appJobCount}`,
    retryAllFailed: "Retry All Failed",
    retryAllFailedWithCount: (count) => `Retry All Failed (${count})`,
    retryAllFailedTitle:
      "Retry all failed upload/download candidates with retry-scope strategy",
    canceling: "Canceling...",
    cancelAllActive: "Cancel All Active",
    reconnecting: "Reconnecting...",
    reconnectDisconnected: "Reconnect Disconnected",
    reconnectDisconnectedTabs: "Reconnect Disconnected Tabs",
    cancelAllTransfersAllTabs: "Cancel All Transfers (All Tabs)",
    cancelUploads: "Cancel Uploads",
    cancelDownloads: "Cancel Downloads",
    retryUploads: "Retry Uploads",
    retryDownloads: "Retry Downloads",
    portFwd: "Port Fwd",
    diagnostics: "Diagnostics",
    clearJobs: "Clear Jobs",
    uploadQueue: "Upload Queue",
    downloadQueue: "Download Queue",
    queueMeta: (activeTabCount, running, queued) =>
      `tabs ${activeTabCount} | running ${running} | queued ${queued}`,
    progressMeta: (completed, total, failed, canceled) =>
      `progress ${completed}/${total} | failed ${failed} | canceled ${canceled}`,
    cancelActiveTab: "Cancel Active Tab",
    retryActiveTab: "Retry Active Tab",
    remoteDelete: "Remote Delete",
    noActiveDelete: "No active delete operation.",
    deleteCancellationUnavailable:
      "Delete cancellation is not available yet in current backend flow.",
    portForwardingOps: "Port Forwarding Ops",
    portForwardMeta: (activeTabCount, total, degraded) =>
      `tabs ${activeTabCount} | active forwards ${total} | degraded ${degraded}`,
    activeTabStatus: (status) => `active tab status: ${status}`,
    noRecentStatus: "No recent status message.",
    openPortFwd: "Open Port Fwd",
    openDiagnostics: "Open Diagnostics",
    activityTimeline: "Activity Timeline",
    itemCount: (count) => `${count} item(s)`,
    noActivityTimeline:
      "No transfer, port-forward, delete, or tracked app-job activity yet.",
    trackedAppJobs: "Tracked App Jobs",
    appJobState: (runningCount, recentCount) =>
      runningCount > 0 ? `${runningCount} running` : recentCount > 0 ? `${recentCount} recent` : "Idle",
    appJobMeta: (categoryLabel, startedAtLabel, durationLabel) =>
      `${categoryLabel} | started ${startedAtLabel} | duration ${durationLabel}`,
    outputPath: (path) => `output: ${path}`,
    copyPath: "Copy Path",
    clearFinished: "Clear Finished",
    openSnippets: "Open Snippets",
    allTabsTransferActivity: "All Tabs Transfer Activity",
    tabCount: (count) => `${count} tab(s)`,
    transferTabMeta: (uploadRunning, uploadQueued, downloadRunning, downloadQueued, totalActive) =>
      `U(r${uploadRunning}/q${uploadQueued}) | D(r${downloadRunning}/q${downloadQueued}) | total ${totalActive}`,
    connected: "Connected",
    disconnected: "Disconnected",
    focusTab: "Focus Tab",
    reconnectTab: "Reconnect Tab",
    cancelTabTasks: "Cancel Tab Tasks",
    noTransferActivity: "No queued/running transfer activity across tabs.",
    noHighLatencyActivity:
      "No high-latency operation is active right now. Queues and long jobs are idle.",
    noTrackedAppJobs: "No tracked session/snippet/diagnostics jobs yet.",
    done: "Done"
  },
  retryCenter: {
    title: "Transfer Retry Center",
    description:
      "Persistent transfer history across restarts. Retry works for failed entries bound to the active session tab.",
    scope: "Scope",
    activeSession: "Active Session",
    allSessions: "All Sessions",
    direction: "Direction",
    all: "All",
    upload: "Upload",
    download: "Download",
    status: "Status",
    failed: "Failed",
    completed: "Completed",
    canceled: "Canceled",
    queued: "Queued",
    running: "Running",
    timeRange: "Time Range",
    last5m: "Last 5m",
    last30m: "Last 30m",
    last1h: "Last 1h",
    last24h: "Last 24h",
    view: "View",
    flatList: "Flat List",
    groupedByFailure: "Grouped by Failure",
    failureReason: "Failure Reason",
    allFailureReasons: (count) => `All (${count})`,
    defaultRetryScope: "Default Retry Scope",
    allRetryable: "All Retryable",
    uploadOnly: "Upload Only",
    downloadOnly: "Download Only",
    retryConfirmThreshold: "Retry Confirm Threshold",
    largeBatchHint: "Set 0 to disable large-batch retry confirmations.",
    search: "Search",
    searchPlaceholder: "name/local/remote/message",
    resetFilters: "Reset Filters",
    autoRetryScopeOn: "Auto Retry Scope: On",
    autoRetryScopeOff: "Auto Retry Scope: Off",
    autoRetryScopeTitle: "Automatically use last retry scope and skip retry-scope chooser",
    summary: ({
      entryCount,
      totalHistoryCount,
      selectedCount,
      selectedFailedCount,
      visibleFailedCount,
      failedUploadCandidateCount,
      failedDownloadCandidateCount,
      selectedFailureReasonLabel,
      lastRetryScopeLabel,
      autoUseLastRetryScope,
      retryBatchConfirmThreshold,
      isGroupedView,
      groupCount,
      collapsedGroupCount
    }) =>
      `Visible ${entryCount} / Total ${totalHistoryCount}, Selected ${selectedCount}, Selected failed (active session) ${selectedFailedCount}, Visible failed (active session) ${visibleFailedCount}, Dock failed candidates U ${failedUploadCandidateCount} / D ${failedDownloadCandidateCount}, Failure reason ${selectedFailureReasonLabel}, Default scope ${lastRetryScopeLabel}${
        autoUseLastRetryScope ? " (auto)" : ""
      }, Large retry confirm ${
        retryBatchConfirmThreshold <= 0 ? "off" : `>=${retryBatchConfirmThreshold}`
      }${isGroupedView ? `, Groups ${groupCount}, Collapsed ${collapsedGroupCount}` : ""}`,
    failureRatio: "Failure Ratio",
    failedRatio: (failedCount, totalCount) => `Failed ${failedCount}/${totalCount}`,
    directionBreakdown: "Direction Breakdown",
    statusBreakdown: (completed, failed, canceled) =>
      `completed ${completed} | failed ${failed} | canceled ${canceled}`,
    topSessionsGroups: "Top Sessions / Groups",
    noVisibleRecords: "No visible records",
    noGroupData: "No group data",
    topFailureReasons: "Top Failure Reasons",
    noFailedRecords: "No failed records",
    filterByFailureReasonTitle: (reason) => `Filter by failure reason "${reason}"`,
    retryFailureReasonTitle: (reason) =>
      `Retry "${reason}" failed transfers in active session with scope strategy`,
    deleteFailureReasonTitle: (reason) =>
      `Delete visible failed history records with reason "${reason}"`,
    retryWithCount: (count) => `Retry (${count})`,
    deleteWithCount: (count) => `Delete (${count})`,
    failureReasonHelp:
      "Visible failed history only. Quick retry targets active-session entries and follows retry-scope strategy (chooser or auto last scope); delete removes visible failed history by reason.",
    expandAllGroups: "Expand All Groups",
    collapseAllGroups: "Collapse All Groups",
    expandGroup: "Expand group",
    collapseGroup: "Collapse group",
    expand: "Expand",
    collapse: "Collapse",
    groupMeta: (total, failedCount, retryableCount) =>
      `${total} item(s), failed ${failedCount}, retryable ${retryableCount}`,
    selectWithCount: (count) => `Select (${count})`,
    retryFailedWithCount: (count) => `Retry Failed (${count})`,
    retryGroupFailedTitle: "Retry failed active-session records in this group (scope selectable)",
    deleteCount: (count) => `Delete (${count})`,
    exportJson: "Export JSON",
    exportCsv: "Export CSV",
    noHistoryMatches: "No transfer history records match the current filters.",
    selectVisible: "Select Visible",
    clearSelection: "Clear Selection",
    exportVisibleJson: "Export Visible JSON",
    exportVisibleCsv: "Export Visible CSV",
    exportAnalyticsJson: "Export Analytics JSON",
    exportAnalyticsCsv: "Export Analytics CSV",
    retryFailedUploads: (count) => `Retry Failed Uploads (${count})`,
    retryFailedDownloads: (count) => `Retry Failed Downloads (${count})`,
    retryAllFailed: (count) => `Retry All Failed (${count})`,
    retryVisibleFailed: "Retry Visible Failed",
    retrySelectedFailed: "Retry Selected Failed",
    deleteSelected: "Delete Selected",
    deleteVisible: "Delete Visible",
    deleteAll: "Delete All",
    retryFailedUploadsTitle: "Retry failed upload candidates for the active tab/session",
    retryFailedDownloadsTitle: "Retry failed download candidates for the active tab/session",
    retryAllFailedTitle:
      "Retry all failed upload/download candidates with retry-scope strategy",
    retryVisibleFailedTitle: "Retry visible failed records with scope selection",
    retrySelectedFailedTitle: "Retry selected failed records with scope selection",
    done: "Done",
    entryAttempts: (count) => `attempts ${count}`,
    entryMeta: (timestampLabel, directionLabel, attemptCount, message) =>
      `${timestampLabel} | ${directionLabel} | attempts ${attemptCount}${message ? ` | ${message}` : ""}`,
    directionLabel: (direction) => (direction === "upload" ? "upload" : "download"),
    statusLabel: (status) => status
  }
};

const SIMPLIFIED_CHINESE_I18N: AppI18n = {
  topbar: {
    subtitle: "SSH + SFTP 工作台",
    autoReconnect: (delaySeconds) => `自动重连 ${delaySeconds} 秒`,
    autoReconnectOff: "自动重连已关闭"
  },
  settings: {
    title: "设置",
    sectionsAriaLabel: "设置分区",
    done: "完成",
    version: (version) => `版本 ${version}`,
    sections: {
      connection: { nav: "连接", title: "连接" },
      workspace: { nav: "工作区", title: "工作区配置" },
      safety: { nav: "安全", title: "安全护栏" },
      hotkeys: { nav: "快捷键", title: "快捷键" },
      serverHealth: { nav: "监控", title: "服务器健康告警" },
      fileOpening: { nav: "文件打开", title: "文件打开" },
      sftp: { nav: "SFTP", title: "SFTP 传输" },
      portForwarding: { nav: "端口转发", title: "端口转发" },
      diagnostics: { nav: "诊断", title: "诊断" }
    },
    workspace: {
      languageTitle: "界面语言",
      languageDescription: "选择 TermDock 界面的显示语言。当前先覆盖常用工作台和设置入口。",
      languageLabel: "语言",
      currentLanguage: (languageLabel) => `当前语言：${languageLabel}`,
      workspaceProfileTitle: "工作区配置",
      workspaceProfileDescription:
        "为当前应用实例设置全局风险提示。该配置会显示在界面中，也可以驱动全局安全策略包和模板默认值。",
      syncSafetyLabel: "将全局安全策略包/模板同步到工作区配置",
      currentProfile: (profileLabel, syncLabel) =>
        `当前配置：${profileLabel} | 安全同步 ${syncLabel} | 匹配会话组时仍以组级覆盖为准`,
      syncOn: "开启",
      syncOff: "关闭",
      syncDescription:
        "开启同步后，全局安全环境模板和推荐策略包会跟随所选工作区配置。自定义模式、持久批准和会话组覆盖不会被改写。",
      terminalEditorFocusTitle: "终端编辑器专注",
      terminalEditorFocusDescription:
        "当活动终端标签页进入 `nano` 或 `vim` 这类备用屏编辑器时，自动收紧主布局。",
      autoFocusLabel: "自动专注备用屏终端编辑器",
      editorThemeTitle: "编辑器主题",
      editorThemeDescription: "调整专注终端画布配色，不影响普通 shell 标签页。",
      editorTypographyTitle: "编辑器排版",
      editorTypographyDescription: "调整编辑器模式的字号和行高，不改变普通 shell 密度。",
      editorFontTitle: "编辑器字体",
      editorFontDescription: "切换编辑器模式等宽字体栈，不改变普通终端字体。",
      editorRhythmTitle: "编辑器文字节奏",
      editorRhythmDescription: "调整编辑器模式的笔画重量和字形间距，不改变普通 shell。",
      editorCursorTitle: "编辑器光标",
      editorCursorDescription: "为编辑器模式选择独立光标形状，不改变普通 shell 光标。",
      currentEditorFocus: (
        enabledLabel,
        themeLabel,
        typographyLabel,
        fontLabel,
        rhythmLabel,
        cursorLabel
      ) =>
        `当前编辑器专注：${enabledLabel} | 主题 ${themeLabel} | 排版 ${typographyLabel} | 字体 ${fontLabel} | 节奏 ${rhythmLabel} | 光标 ${cursorLabel} | 只影响活动标签页，不改写终端编辑器内容`,
      enabled: "开启",
      disabled: "关闭",
      profileOptions: {
        none: {
          label: "无配置",
          shortLabel: "无",
          description: "不应用共享工作区环境配置。"
        },
        dev: {
          label: "开发",
          shortLabel: "开发",
          description: "为本地或沙盒流程使用更低摩擦的默认值。"
        },
        staging: {
          label: "预发",
          shortLabel: "预发",
          description: "使用共享验证默认值和中等风险提示。"
        },
        prod: {
          label: "生产",
          shortLabel: "生产",
          description: "使用最高风险提示和更严格的安全默认值。"
        }
      },
      safetyDefault: (templateLabel, policyPackLabel) =>
        `安全默认：${templateLabel} / ${policyPackLabel}`
    }
  },
  transfer: {
    title: "传输",
    boundTo: (tabTitle) => `已绑定到 ${tabTitle}`,
    emptyBinding: "打开终端标签页后管理传输",
    restorePending: "恢复待处理",
    discardPending: "丢弃待处理",
    retryAllFailed: "重试所有失败项",
    retryAllFailedTitle: "按重试范围策略重试所有失败的上传/下载候选项",
    retryCenter: "重试中心",
    operationCenter: "操作中心",
    retryFailed: "重试失败项",
    clearFinished: "清除已完成",
    cancelTransfer: (direction) => `取消${direction === "upload" ? "上传" : "下载"}`,
    cancelAllUploadsLabel: "取消所有上传任务",
    cancelAllUploadsTitle: "取消此标签页中的所有上传任务",
    cancelAllDownloadsLabel: "取消所有下载任务",
    cancelAllDownloadsTitle: "取消此标签页中的所有下载任务",
    uploadsTitle: (running, queued, threads) =>
      `上传（运行 ${running}，排队 ${queued}，线程 ${threads}）`,
    downloadsTitle: (running, queued, threads) =>
      `下载（运行 ${running}，排队 ${queued}，线程 ${threads}）`,
    uploadEmpty: "没有上传传输。",
    downloadEmpty: "没有下载传输。",
    storedFailedRetries: (count) => `此会话已保存失败重试：${count}`,
    progressSummary: (completed, total, failed, canceled, running, queued) =>
      `进度：${completed}/${total} 已完成（失败 ${failed}，已取消 ${canceled}，运行 ${running}，排队 ${queued}）`,
    schedulePaused: (summary, nextOpeningLabel) =>
      `队列已暂停：当前不在配置的传输窗口内（${summary}）。传输会自动恢复${
        nextOpeningLabel ? `，时间：${nextOpeningLabel}。` : "，当传输窗口打开时。"
      }`,
    uploadDisconnectedPaused: "队列已暂停：终端已断开。重新连接此标签页后继续上传。",
    downloadDisconnectedPaused: "队列已暂停：终端已断开。重新连接此标签页后继续下载。"
  },
  operationCenter: {
    title: "操作中心",
    description: "集中查看所有打开工作区标签页中的长耗时操作。",
    groupedControls: "分组控制",
    ready: "就绪",
    idle: "空闲",
    active: "活动",
    running: "运行中",
    working: "处理中",
    transfers: "传输",
    activeTab: "当前标签页",
    tools: "工具",
    transfersMeta: (activeTabCount, retryCandidateCount) =>
      `活动标签页 ${activeTabCount} | 重试候选 ${retryCandidateCount}`,
    activeTabMeta: (uploadFailedCount, downloadFailedCount) =>
      `上传失败 ${uploadFailedCount} | 下载失败 ${downloadFailedCount}`,
    toolsMeta: (portForwardCount, appJobCount) =>
      `端口转发 ${portForwardCount} | 应用任务 ${appJobCount}`,
    retryAllFailed: "重试所有失败项",
    retryAllFailedWithCount: (count) => `重试所有失败项（${count}）`,
    retryAllFailedTitle: "按重试范围策略重试所有失败的上传/下载候选项",
    canceling: "正在取消...",
    cancelAllActive: "取消所有活动项",
    reconnecting: "正在重连...",
    reconnectDisconnected: "重连已断开项",
    reconnectDisconnectedTabs: "重连已断开的标签页",
    cancelAllTransfersAllTabs: "取消所有传输（全部标签页）",
    cancelUploads: "取消上传",
    cancelDownloads: "取消下载",
    retryUploads: "重试上传",
    retryDownloads: "重试下载",
    portFwd: "端口转发",
    diagnostics: "诊断",
    clearJobs: "清除任务",
    uploadQueue: "上传队列",
    downloadQueue: "下载队列",
    queueMeta: (activeTabCount, running, queued) =>
      `标签页 ${activeTabCount} | 运行 ${running} | 排队 ${queued}`,
    progressMeta: (completed, total, failed, canceled) =>
      `进度 ${completed}/${total} | 失败 ${failed} | 已取消 ${canceled}`,
    cancelActiveTab: "取消当前标签页",
    retryActiveTab: "重试当前标签页",
    remoteDelete: "远程删除",
    noActiveDelete: "没有正在进行的删除操作。",
    deleteCancellationUnavailable: "当前后端流程暂不支持取消删除。",
    portForwardingOps: "端口转发操作",
    portForwardMeta: (activeTabCount, total, degraded) =>
      `标签页 ${activeTabCount} | 活动转发 ${total} | 异常 ${degraded}`,
    activeTabStatus: (status) => `当前标签页状态：${status}`,
    noRecentStatus: "没有最近的状态消息。",
    openPortFwd: "打开端口转发",
    openDiagnostics: "打开诊断",
    activityTimeline: "活动时间线",
    itemCount: (count) => `${count} 项`,
    noActivityTimeline: "还没有传输、端口转发、删除或已跟踪应用任务活动。",
    trackedAppJobs: "已跟踪应用任务",
    appJobState: (runningCount, recentCount) =>
      runningCount > 0 ? `${runningCount} 个运行中` : recentCount > 0 ? `${recentCount} 个最近任务` : "空闲",
    appJobMeta: (categoryLabel, startedAtLabel, durationLabel) =>
      `${categoryLabel} | 开始 ${startedAtLabel} | 耗时 ${durationLabel}`,
    outputPath: (path) => `输出：${path}`,
    copyPath: "复制路径",
    clearFinished: "清除已完成",
    openSnippets: "打开片段",
    allTabsTransferActivity: "全部标签页传输活动",
    tabCount: (count) => `${count} 个标签页`,
    transferTabMeta: (uploadRunning, uploadQueued, downloadRunning, downloadQueued, totalActive) =>
      `上传(运行 ${uploadRunning}/排队 ${uploadQueued}) | 下载(运行 ${downloadRunning}/排队 ${downloadQueued}) | 总计 ${totalActive}`,
    connected: "已连接",
    disconnected: "已断开",
    focusTab: "聚焦标签页",
    reconnectTab: "重连标签页",
    cancelTabTasks: "取消标签页任务",
    noTransferActivity: "没有跨标签页排队或运行中的传输活动。",
    noHighLatencyActivity: "当前没有活动的长耗时操作。队列和长任务处于空闲状态。",
    noTrackedAppJobs: "还没有已跟踪的会话/片段/诊断任务。",
    done: "完成"
  },
  retryCenter: {
    title: "传输重试中心",
    description: "跨重启保留传输历史。重试会作用于绑定到当前会话标签页的失败记录。",
    scope: "范围",
    activeSession: "当前会话",
    allSessions: "全部会话",
    direction: "方向",
    all: "全部",
    upload: "上传",
    download: "下载",
    status: "状态",
    failed: "失败",
    completed: "已完成",
    canceled: "已取消",
    queued: "排队中",
    running: "运行中",
    timeRange: "时间范围",
    last5m: "最近 5 分钟",
    last30m: "最近 30 分钟",
    last1h: "最近 1 小时",
    last24h: "最近 24 小时",
    view: "视图",
    flatList: "平铺列表",
    groupedByFailure: "按失败原因分组",
    failureReason: "失败原因",
    allFailureReasons: (count) => `全部（${count}）`,
    defaultRetryScope: "默认重试范围",
    allRetryable: "全部可重试",
    uploadOnly: "仅上传",
    downloadOnly: "仅下载",
    retryConfirmThreshold: "重试确认阈值",
    largeBatchHint: "设为 0 可关闭大批量重试确认。",
    search: "搜索",
    searchPlaceholder: "名称/本地/远端/消息",
    resetFilters: "重置筛选",
    autoRetryScopeOn: "自动重试范围：开",
    autoRetryScopeOff: "自动重试范围：关",
    autoRetryScopeTitle: "自动使用上次重试范围，并跳过重试范围选择器",
    summary: ({
      entryCount,
      totalHistoryCount,
      selectedCount,
      selectedFailedCount,
      visibleFailedCount,
      failedUploadCandidateCount,
      failedDownloadCandidateCount,
      selectedFailureReasonLabel,
      lastRetryScopeLabel,
      autoUseLastRetryScope,
      retryBatchConfirmThreshold,
      isGroupedView,
      groupCount,
      collapsedGroupCount
    }) =>
      `可见 ${entryCount} / 总计 ${totalHistoryCount}，已选 ${selectedCount}，已选失败（当前会话）${selectedFailedCount}，可见失败（当前会话）${visibleFailedCount}，面板失败候选 上传 ${failedUploadCandidateCount} / 下载 ${failedDownloadCandidateCount}，失败原因 ${selectedFailureReasonLabel}，默认范围 ${lastRetryScopeLabel}${
        autoUseLastRetryScope ? "（自动）" : ""
      }，大批量重试确认 ${
        retryBatchConfirmThreshold <= 0 ? "关闭" : `>=${retryBatchConfirmThreshold}`
      }${isGroupedView ? `，分组 ${groupCount}，已折叠 ${collapsedGroupCount}` : ""}`,
    failureRatio: "失败比例",
    failedRatio: (failedCount, totalCount) => `失败 ${failedCount}/${totalCount}`,
    directionBreakdown: "方向分布",
    statusBreakdown: (completed, failed, canceled) =>
      `已完成 ${completed} | 失败 ${failed} | 已取消 ${canceled}`,
    topSessionsGroups: "主要会话/分组",
    noVisibleRecords: "没有可见记录",
    noGroupData: "没有分组数据",
    topFailureReasons: "主要失败原因",
    noFailedRecords: "没有失败记录",
    filterByFailureReasonTitle: (reason) => `按失败原因“${reason}”筛选`,
    retryFailureReasonTitle: (reason) => `按范围策略重试当前会话中“${reason}”的失败传输`,
    deleteFailureReasonTitle: (reason) => `删除失败原因“${reason}”对应的可见失败历史`,
    retryWithCount: (count) => `重试（${count}）`,
    deleteWithCount: (count) => `删除（${count}）`,
    failureReasonHelp:
      "仅统计可见失败历史。快速重试面向当前会话记录，并遵循重试范围策略（选择器或自动使用上次范围）；删除会按原因移除可见失败历史。",
    expandAllGroups: "展开所有分组",
    collapseAllGroups: "折叠所有分组",
    expandGroup: "展开分组",
    collapseGroup: "折叠分组",
    expand: "展开",
    collapse: "折叠",
    groupMeta: (total, failedCount, retryableCount) =>
      `${total} 项，失败 ${failedCount}，可重试 ${retryableCount}`,
    selectWithCount: (count) => `选择（${count}）`,
    retryFailedWithCount: (count) => `重试失败项（${count}）`,
    retryGroupFailedTitle: "重试此分组中的当前会话失败记录（可选择范围）",
    deleteCount: (count) => `删除（${count}）`,
    exportJson: "导出 JSON",
    exportCsv: "导出 CSV",
    noHistoryMatches: "没有符合当前筛选条件的传输历史记录。",
    selectVisible: "选择可见项",
    clearSelection: "清除选择",
    exportVisibleJson: "导出可见 JSON",
    exportVisibleCsv: "导出可见 CSV",
    exportAnalyticsJson: "导出分析 JSON",
    exportAnalyticsCsv: "导出分析 CSV",
    retryFailedUploads: (count) => `重试失败上传（${count}）`,
    retryFailedDownloads: (count) => `重试失败下载（${count}）`,
    retryAllFailed: (count) => `重试所有失败项（${count}）`,
    retryVisibleFailed: "重试可见失败项",
    retrySelectedFailed: "重试已选失败项",
    deleteSelected: "删除已选",
    deleteVisible: "删除可见",
    deleteAll: "全部删除",
    retryFailedUploadsTitle: "重试当前标签页/会话的失败上传候选项",
    retryFailedDownloadsTitle: "重试当前标签页/会话的失败下载候选项",
    retryAllFailedTitle: "按重试范围策略重试所有失败的上传/下载候选项",
    retryVisibleFailedTitle: "选择范围后重试可见失败记录",
    retrySelectedFailedTitle: "选择范围后重试已选失败记录",
    done: "完成",
    entryAttempts: (count) => `尝试 ${count} 次`,
    entryMeta: (timestampLabel, directionLabel, attemptCount, message) =>
      `${timestampLabel} | ${directionLabel} | 尝试 ${attemptCount} 次${message ? ` | ${message}` : ""}`,
    directionLabel: (direction) => (direction === "upload" ? "上传" : "下载"),
    statusLabel: (status) => {
      switch (status) {
        case "queued":
          return "排队中";
        case "running":
          return "运行中";
        case "completed":
          return "已完成";
        case "failed":
          return "失败";
        case "canceled":
          return "已取消";
        default:
          return status;
      }
    }
  }
};

const APP_I18N: Record<AppLanguage, AppI18n> = {
  en: ENGLISH_I18N,
  "zh-CN": SIMPLIFIED_CHINESE_I18N
};

export function getI18n(language: AppLanguage): AppI18n {
  return APP_I18N[language];
}
