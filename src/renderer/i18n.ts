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
  shellThemeTitle: string;
  shellThemeDescription: string;
  currentShellTheme: (themeLabel: string) => string;
  accentTitle: string;
  accentDescription: string;
  currentAccent: (accentLabel: string) => string;
  densityTitle: string;
  densityDescription: string;
  currentDensity: (densityLabel: string) => string;
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
  retryAllFailedAcrossTabsWithCount: (count: number) => string;
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
  cancelActiveDelete: string;
  portForwardingOps: string;
  portForwardMeta: (activeTabCount: number, total: number, degraded: number) => string;
  activeTabStatus: (status: string) => string;
  noRecentStatus: string;
  openPortFwd: string;
  openDiagnostics: string;
  openRetryCenter: string;
  stopActiveTabPortForwards: string;
  activityTimeline: string;
  itemCount: (count: number) => string;
  noActivityTimeline: string;
  trackedAppJobs: string;
  appJobState: (runningCount: number, recentCount: number) => string;
  appJobMeta: (categoryLabel: string, startedAtLabel: string, durationLabel: string) => string;
  outputPath: (path: string) => string;
  copyPath: string;
  cancelAppJob: string;
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
  retryTabTasks: string;
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

export interface CommandHistoryManagerLabels {
  title: string;
  description: string;
  summary: (visibleCount: number, selectedCount: number, totalCount: number) => string;
  add: string;
  import: string;
  export: string;
  selectVisible: string;
  unselectVisible: string;
  clearSelection: string;
  empty: string;
  edit: string;
  deleteSelected: (count: number) => string;
  deleteVisible: (count: number) => string;
  deleteAll: (count: number) => string;
  done: string;
  entryTitle: (command: string, sourceLabel: string) => string;
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
  commandHistoryManager: CommandHistoryManagerLabels;
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

type TextReplacement = {
  pattern: RegExp;
  replace: (...matches: string[]) => string;
};

const SIMPLIFIED_CHINESE_TEXT: Record<string, string> = {
  "Confirm": "确认",
  "Cancel": "取消",
  "OK": "确定",
  "Done": "完成",
  "Continue": "继续",
  "Close": "关闭",
  "Save": "保存",
  "Add": "添加",
  "Create": "创建",
  "Delete": "删除",
  "Remove": "移除",
  "Move": "移动",
  "Retry": "重试",
  "Find": "查找",
  "Run": "运行",
  "Copy": "复制",
  "Paste": "粘贴",
  "Cut": "剪切",
  "Clear": "清除",
  "Reconnect": "重连",
  "Refresh": "刷新",
  "Settings": "设置",
  "Manage": "管理",
  "Import": "导入",
  "Export": "导出",
  "Decrypt": "解密",
  "Choose Action": "选择操作",
  "Input Required": "需要输入",
  "Notice": "提示",
  "Manual Copy": "手动复制",
  "Open settings": "打开设置",
  "Dismiss": "关闭",
  "Dismiss error": "关闭错误",
  "Sessions": "会话",
  "Health": "健康",
  "History": "历史",
  "Selected Session": "选中会话",
  "Auth": "认证",
  "Group": "分组",
  "Groups": "分组",
  "Last Seen": "上次连接",
  "Loading sessions...": "正在加载会话...",
  "Start with your first server": "从第一台服务器开始",
  "Import existing SSH hosts or create a session manually.": "导入已有 SSH 主机，或手动创建会话。",
  "Import your SSH config for the fastest setup, or create one session by hand.":
    "最快的方式是导入 SSH config，也可以手动创建一个会话。",
  "Dismiss first-run tips": "关闭首次启动提示",
  "Import SSH Config": "导入 SSH 配置",
  "Security Notes": "安全说明",
  "Suggested setup path": "建议配置路径",
  "1. Import hosts": "1. 导入主机",
  "2. Test connection": "2. 测试连接",
  "3. Open terminal + SFTP": "3. 打开终端 + SFTP",
  "Filter name/host/user/group": "筛选名称/主机/用户/分组",
  "Show all sessions": "显示全部会话",
  "Show favorite sessions only": "仅显示收藏会话",
  "Show all": "显示全部",
  "Favorites only": "仅收藏",
  "Favorites": "收藏",
  "All": "全部",
  "Back to groups": "返回分组",
  "No sessions yet.": "还没有会话。",
  "No sessions match current filters.": "没有会话符合当前筛选。",
  "No sessions in this group.": "此分组中没有会话。",
  "Live Tab": "活动标签页",
  "Tab Open": "标签页已打开",
  "Favorite": "收藏",
  "Saved": "已保存",
  "Offline": "离线",
  "Private Key": "私钥",
  "Password": "密码",
  "password": "密码",
  "Password · Secret Stored": "密码 · 已保存密钥",
  "Ungrouped": "未分组",
  "SFTP view mode": "SFTP 视图模式",
  "Compact": "紧凑",
  "Details": "详情",
  "View": "查看",
  "Go to parent directory": "前往上级目录",
  "Go Up": "向上",
  "Refresh directory": "刷新目录",
  "SFTP actions": "SFTP 操作",
  "Remote directory path": "远程目录路径",
  "Selected path": "所选路径",
  "Selected paths": "所选路径",
  "Clear Selection": "清除选择",
  "Copy Selected Paths": "复制所选路径",
  "1 item selected": "已选择 1 项",
  "Current folder": "当前目录",
  "Filter SFTP entries": "筛选 SFTP 条目",
  "Filter files and folders": "筛选文件和文件夹",
  "Filter SFTP entry type": "筛选 SFTP 条目类型",
  "All types": "全部类型",
  "Files": "文件",
  "Folders": "文件夹",
  "Sort SFTP entries": "排序 SFTP 条目",
  "Size": "大小",
  "Modified": "修改时间",
  "Sort ascending": "升序排列",
  "Sort descending": "降序排列",
  "Ascending": "升序",
  "Descending": "降序",
  "Select All Results": "选择全部结果",
  "All Results Selected": "已选择全部结果",
  "This directory is empty.": "此目录为空。",
  "No entries match the current filters.": "没有条目符合当前筛选条件。",
  "Loading remote directory...": "正在加载远程目录...",
  "Folder": "文件夹",
  "Open a terminal tab first. SFTP panel reuses the active tab SSH connection.": "请先打开终端标签页。SFTP 面板会复用活动标签页的 SSH 连接。",
  "Server Health": "服务器健康",
  "Toggle server health details": "展开/收起服务器健康详情",
  "Open server health details": "打开服务器健康详情",
  "Server Health Details": "服务器健康详情",
  "Close server health details": "关闭服务器健康详情",
  "Hide details": "隐藏详情",
  "Show details": "显示详情",
  "Refresh server metrics": "刷新服务器指标",
  "One or more metrics exceeded alert threshold.": "一个或多个指标超过告警阈值。",
  "No alert triggered.": "未触发告警。",
  "ALERT": "告警",
  "Healthy": "正常",
  "Monitoring Target": "监控目标",
  "Server metrics and process samples follow the active tab.": "服务器指标和进程采样跟随活动标签页。",
  "Connected": "已连接",
  "Disconnected": "已断开",
  "Open and connect a terminal tab to monitor server status.": "打开并连接终端标签页后即可监控服务器状态。",
  "Connect the active terminal tab to collect metrics.": "连接活动终端标签页以采集指标。",
  "Threshold reached:": "已达到阈值：",
  "Collecting server metrics...": "正在采集服务器指标...",
  "CPU": "CPU",
  "Memory": "内存",
  "Disk": "磁盘",
  "Network": "网络",
  "Load": "负载",
  "Uptime": "运行时间",
  "Overview": "总览",
  "Processes": "进程",
  "Services": "服务",
  "Server health sections": "服务器健康分区",
  "Cores": "核心",
  "Used": "已用",
  "Available": "可用",
  "Free": "空闲",
  "Total": "总计",
  "Mount": "挂载点",
  "Use": "使用率",
  "Inodes": "Inode",
  "Interface": "网卡",
  "RX errors": "RX 错误",
  "TX errors": "TX 错误",
  "Dropped": "丢包",
  "Hostname": "主机名",
  "OS": "操作系统",
  "Kernel": "内核",
  "Architecture": "架构",
  "CPU cores": "CPU 核心",
  "Load / core": "负载/核心",
  "Free memory": "空闲内存",
  "Cache / buffers": "缓存/缓冲",
  "Swap": "Swap",
  "Collected": "采集时间",
  "System information": "系统信息",
  "Collecting process details...": "正在采集进程详情...",
  "Top processes (CPU)": "CPU 占用最高进程",
  "Top processes (Memory)": "内存占用最高进程",
  "PID": "PID",
  "User": "用户",
  "Command": "命令",
  "MEM": "内存",
  "1m / 5m / 15m": "1 分 / 5 分 / 15 分",
  "No process data yet.": "暂无进程数据。",
  "No network interface data yet.": "暂无网卡数据。",
  "Failed services": "失败服务",
  "No failed services detected.": "未检测到失败服务。",
  "No server metrics collected yet.": "尚未采集服务器指标。",
  "Command History": "命令历史",
  "Command History (Ctrl+Shift+H)": "命令历史 (Ctrl+Shift+H)",
  "Expand command history panel": "展开命令历史面板",
  "Collapse command history panel": "折叠命令历史面板",
  "Expand": "展开",
  "Collapse": "折叠",
  "Snippets": "片段",
  "Active Tab": "活动标签页",
  "All Tabs": "全部标签页",
  "Search command": "搜索命令",
  "Paste Target": "粘贴目标",
  "No active terminal tab": "没有活动终端标签页",
  "Searching commands from the active tab only.": "仅搜索活动标签页中的命令。",
  "Searching commands across all tabs.": "搜索全部标签页中的命令。",
  "Ready": "就绪",
  "No Tab": "无标签页",
  "No active tab": "没有活动标签页",
  "No command history entries.": "没有命令历史记录。",
  "Run Snippet": "运行片段",
  "Snippet Manager": "片段管理器",
  "No terminal tab. Use \"Open\" from session list.": "没有终端标签页。请从会话列表使用“打开”。",
  "Terminal workspace ready. Open a session tab to start.": "终端工作区已就绪。打开会话标签页即可开始。",
  "Command History...": "命令历史...",
  "Recorded commands captured when pressing Enter in terminal tabs.": "在终端标签页中按下 Enter 时捕获的命令记录。",
  "Scope": "范围",
  "Search": "搜索",
  "Filter by command": "按命令筛选",
  "Clear Visible": "清除可见项",
  "Clear All": "全部清除",
  "Find in Terminal": "在终端中查找",
  "Enter text to search in the current terminal tab.": "输入要在当前终端标签页中搜索的文本。",
  "Close Tab": "关闭标签页",
  "Close Tabs to Left": "关闭左侧标签页",
  "Close Tabs to Right": "关闭右侧标签页",
  "Close Other Tabs": "关闭其他标签页",
  "Close All Tabs": "关闭所有标签页",
  "Select All": "全选",
  "Find...": "查找...",
  "Interrupt (Ctrl+C)": "中断 (Ctrl+C)",
  "Command Snippet Manager": "命令片段管理器",
  "New Group": "新建分组",
  "Delete Group": "删除分组",
  "New Snippet": "新建片段",
  "Run Selected": "运行已选",
  "Delete Snippet": "删除片段",
  "Import JSON": "导入 JSON",
  "Export JSON": "导出 JSON",
  "Clear Scoped Values": "清除作用域值",
  "Group Name": "分组名称",
  "No snippet groups.": "没有片段分组。",
  "Unnamed Group": "未命名分组",
  "Double-click to run snippet directly.": "双击可直接运行片段。",
  "Select a group first.": "请先选择分组。",
  "No snippets in selected group.": "所选分组中没有片段。",
  "Unnamed Snippet": "未命名片段",
  "Editor": "编辑器",
  "Snippet Name": "片段名称",
  "Command Template": "命令模板",
  "Require confirmation before run": "运行前需要确认",
  "Always preview resolved command before run": "运行前始终预览解析后的命令",
  "Prompt Set": "提示集",
  "New Prompt Set": "新建提示集",
  "Delete Prompt Set": "删除提示集",
  "Reusable Prompt Set": "可复用提示集",
  "None": "无",
  "Unnamed Prompt Set": "未命名提示集",
  "Prompt sets are shared within the selected group. Snippet variables can still override prompt-set keys for one-off cases.": "提示集会在所选分组内共享。片段变量仍可在一次性场景中覆盖提示集键。",
  "Prompt Set Name": "提示集名称",
  "Prompt Set Variables": "提示集变量",
  "Use prompt sets for values reused by multiple snippets in this group. Group scope is the default, but you can widen it to session/global.": "提示集适合存放此分组内多个片段复用的值。默认使用分组作用域，也可以扩展到会话/全局。",
  "Snippet Variables": "片段变量",
  "Add Parameter": "添加参数",
  "Add parameters and reference them in the template with tokens like": "添加参数，并在模板中用类似这样的令牌引用：",
  "Snippet-scoped variables are best for one-off overrides on top of any selected prompt set.": "片段作用域变量适合在所选提示集之上做一次性覆盖。",
  "Placeholders:": "占位符：",
  "Select or create a snippet to edit.": "选择或创建片段后编辑。",
  "Key": "键",
  "Label": "标签",
  "Default Value": "默认值",
  "Regex Pattern": "正则模式",
  "Variable Scope": "变量作用域",
  "Required": "必填",
  "Delete Variable": "删除变量",
  "Delete Parameter": "删除参数",
  "Open Group": "打开分组",
  "New Session": "新建会话",
  "New Session From Template...": "从模板新建会话...",
  "Manage Session Templates...": "管理会话模板...",
  "Import SSH Config...": "导入 SSH 配置...",
  "Import Sessions JSON...": "导入会话 JSON...",
  "Import Sessions JSON": "导入会话 JSON",
  "Sessions JSON Preview": "会话 JSON 预览",
  "Sessions JSON Import": "会话 JSON 导入",
  "Import Encrypted Migration...": "导入加密迁移包...",
  "Import App Backup...": "导入应用备份...",
  "Export All Sessions...": "导出所有会话...",
  "Export Encrypted Migration...": "导出加密迁移包...",
  "Export App Backup...": "导出应用备份...",
  "SSH Config Import": "SSH 配置导入",
  "SSH Config Preview": "SSH 配置预览",
  "Encrypted Migration Export": "加密迁移导出",
  "Encrypted Migration Import": "加密迁移导入",
  "Encrypted Migration Preview": "加密迁移预览",
  "Export App Backup": "导出应用备份",
  "Import App Backup": "导入应用备份",
  "App Backup Export": "应用备份导出",
  "App Backup Import": "应用备份导入",
  "App Backup": "应用备份",
  "Loading terminal...": "正在加载终端...",
  "Export or restore a `.tdbackup` bundle with sessions and durable SQLite state. Credentials stay in an optional encrypted attachment.":
    "导出或恢复包含会话与耐久 SQLite 状态的 `.tdbackup` 包。凭据可选放在加密附件中。",
  "Include Credentials": "包含凭据",
  "Non-secret Only": "仅非机密",
  "Restore Credentials": "恢复凭据",
  "Skip Credentials": "跳过凭据",
  "Restore Keys": "恢复私钥",
  "Include passphrase-protected session credentials in this app backup?":
    "要把口令保护的会话凭据一起放进这个应用备份吗？",
  "Non-secret backup covers sessions metadata and durable SQLite state. Credentials use the same encrypted attachment format as session migration.":
    "非机密备份包含会话元数据和耐久 SQLite 状态。凭据使用与会话迁移相同的加密附件格式。",
  "Enter a backup passphrase. You will need it to restore credentials.":
    "输入备份口令。恢复凭据时还需要再次输入。",
  "Backup passphrase must be at least 8 characters.": "备份口令至少需要 8 个字符。",
  "Confirm backup passphrase.": "确认备份口令。",
  "Include private key file contents in the credential attachment?":
    "要把私钥文件内容一起放进凭据附件吗？",
  "Exporting durable SQLite state with encrypted credentials.": "正在导出带加密凭据的耐久 SQLite 状态。",
  "Exporting durable SQLite state (non-secret).": "正在导出耐久 SQLite 状态（非机密）。",
  "TermDock App Backup": "TermDock 应用备份",
  "Restore this app backup?": "要恢复这个应用备份吗？",
  "Choose session duplicate strategy (matched by host:port:username).":
    "选择会话重复项策略（按 host:port:username 匹配）。",
  "Restore passphrase-protected credentials from this backup?":
    "要从这个备份恢复口令保护的凭据吗？",
  "Enter the backup passphrase.": "输入备份口令。",
  "Restore embedded private key files from the credential attachment?":
    "要从凭据附件恢复嵌入的私钥文件吗？",
  "Apply backup?": "应用备份？",
  "Durable SQLite tables will be replaced.": "耐久 SQLite 表将被替换。",
  "Restoring durable SQLite state and sessions.": "正在恢复耐久 SQLite 状态与会话。",
  "App backup exported.": "应用备份已导出。",
  "App backup restored.": "应用备份已恢复。",
  "with credentials attachment": "含凭据附件",
  "Credentials: restore": "凭据：恢复",
  "Credentials: skip": "凭据：跳过",
  "Enter the migration passphrase.": "输入迁移口令。",
  "Enter a migration passphrase. You will need it to import this file.": "输入迁移口令。导入这个文件时还需要再次输入。",
  "Migration passphrase must be at least 8 characters.": "迁移口令至少需要 8 个字符。",
  "Confirm migration passphrase.": "确认迁移口令。",
  "Import Encrypted Migration": "导入加密迁移包",
  "Passphrases do not match.": "两次输入的口令不一致。",
  "Include private key file contents in the encrypted migration file?": "要把私钥文件内容一起放进加密迁移文件吗？",
  "Include Keys": "包含私钥",
  "Paths Only": "仅保留路径",
  "Including private key files makes migration work on another computer, but anyone with this file and passphrase can use those keys. Passwords and private-key passphrases are always encrypted in this migration file.": "包含私钥文件后，迁移到另一台电脑时可以直接使用；但任何同时拿到这个文件和口令的人，也可能使用这些私钥。密码和私钥口令始终会在迁移文件中加密保存。",
  "No importable sessions found in this migration file.": "这个迁移文件里没有可导入的会话。",
  "Review decrypted sessions before import.": "导入前请先检查已解密的会话。",
  "Group Strategy": "分组策略",
  "Choose target group strategy for imported sessions.": "为导入会话选择目标分组策略。",
  "Set target group for imported sessions. Leave empty for Ungrouped.": "为导入会话设置目标分组。留空则导入到未分组。",
  "Choose Duplicates": "处理重复项",
  "Review Import": "查看导入计划",
  "Review parsed sessions before import.": "导入前请先检查已解析的会话。",
  "No importable sessions found.": "没有找到可导入的会话。",
  "No importable Host entries were found.": "没有找到可导入的 Host 条目。",
  "Keep Group from File": "保留文件中的分组",
  "Force Active Group": "强制使用当前分组",
  "Duplicate Strategy": "重复项策略",
  "Skip Duplicates": "跳过重复项",
  "Overwrite Existing": "覆盖现有会话",
  "Create Renamed Copies": "创建重命名副本",
  "skip": "跳过重复项",
  "overwrite": "覆盖现有会话",
  "rename": "创建重命名副本",
  "keepSource": "保留文件中的分组",
  "forceCurrent": "强制使用当前分组",
  "ungrouped": "移动到未分组",
  "Import completed.": "导入完成。",
  "Open First Imported": "打开首个已导入会话",
  "Open the first imported session now?": "现在打开首个已导入会话吗？",
  "Imported Session": "已导入会话",
  "Imported JSON:": "已导入 JSON：",
  "Warnings:": "警告：",
  "Export All Groups...": "导出所有分组...",
  "Select All Groups": "选择所有分组",
  "Clear Group Selection": "清除分组选择",
  "Rename Group": "重命名分组",
  "Rename Group (Select One)": "重命名分组（选择一个）",
  "Delete Selected Group": "删除已选分组",
  "Rename Selected Group": "重命名已选分组",
  "Back to Groups": "返回分组",
  "Select All Sessions": "选择所有会话",
  "Clear Session Selection": "清除会话选择",
  "Open Terminal Tab": "打开终端标签页",
  "Open Selected Session": "打开已选会话",
  "View Details": "查看详情",
  "Session Details": "会话详情",
  "Session details": "会话详情",
  "Name": "名称",
  "Target": "目标",
  "Credential": "凭据",
  "Stored in secure vault": "已保存在系统安全凭据库",
  "Last Connected": "上次连接",
  "Created At": "创建时间",
  "Updated At": "更新时间",
  "Unfavorite": "取消收藏",
  "Copy Clash Direct Rules": "复制 Clash 直连规则",
  "Copy SSH Command": "复制 SSH 命令",
  "Edit Session": "编辑会话",
  "Duplicate Session": "复制会话",
  "Save as Session Template...": "保存为会话模板...",
  "Run Quick Profile...": "运行快捷配置...",
  "Save Quick Profile...": "保存快捷配置...",
  "Manage Quick Profiles...": "管理快捷配置...",
  "Move Selected to Group...": "将已选移动到分组...",
  "Move to Group...": "移动到分组...",
  "Move Selected to Ungrouped": "将已选移动到未分组",
  "Move to Ungrouped": "移动到未分组",
  "Delete Session": "删除会话",
  "Delete Selected Session": "删除已选会话",
  "Go to Path": "前往路径",
  "New Folder": "新建文件夹",
  "Upload File": "上传文件",
  "Download Selected": "下载已选",
  "Rename Selected": "重命名已选",
  "Delete Selected": "删除已选",
  "Open Directory": "打开目录",
  "Download Folder": "下载文件夹",
  "Open File": "打开文件",
  "Download File": "下载文件",
  "Open Read-Only (Recommended)": "只读打开（推荐）",
  "Still Try Auto-Sync": "仍尝试自动同步",
  "Privileged or Read-Only Path": "系统/只读路径",
  "Stage Upload (Recommended)": "改传到 staging（推荐）",
  "Still Upload to Original Path": "仍上传到原目录",
  "Upload Permission Issue": "上传权限不足",
  "Stage to Server": "暂存到服务器",
  "Try sudo -n Save": "尝试 sudo -n 写回",
  "Copy sudo Command": "复制 sudo 命令",
  "Paste into Terminal": "粘贴到终端",
  "Reveal Local Draft": "打开本地草稿",
  "Current SSH user cannot write this remote path. Fix ownership/permissions on the server, or upload to a writable directory and move the file with sudo.":
    "当前 SSH 用户无法写入此远程路径。请在服务器上修正属主/权限，或先传到可写目录再用 sudo 移动。",
  "This directory may require sudo to upload. Stage to ~/termdock-staging, then run sudo install in the terminal.":
    "当前目录可能需要 sudo 才能上传。可改传到 ~/termdock-staging，再在终端用 sudo install 写入。",
  "Current SSH user cannot write this path. Stage to ~/termdock-staging, then run sudo install in the terminal (or open the file read-only).":
    "当前 SSH 用户无法写入此路径。可先暂存到 ~/termdock-staging，再在终端用 sudo install 写入（或下次只读打开）。",
  "Rename": "重命名",
  "Copy Path": "复制路径",
  "Copy Current Path": "复制当前路径",
  "Add Command History Entry": "添加命令历史记录",
  "Edit Command History Entry": "编辑命令历史记录",
  "Export Command History": "导出命令历史",
  "Import Command History": "导入命令历史",
  "Enter command to add into history.": "输入要添加到历史的命令。",
  "Edit command text.": "编辑命令文本。",
  "Command cannot be empty.": "命令不能为空。",
  "No command history entries available to export.": "没有可导出的命令历史记录。",
  "Command history JSON copied to clipboard.": "命令历史 JSON 已复制到剪贴板。",
  "Clipboard unavailable. Copy the command history JSON manually.": "剪贴板不可用。请手动复制命令历史 JSON。",
  "Selected file is empty.": "所选文件为空。",
  "No importable commands found.\nSupported formats: [\"cmd\"], { commands: [] }, { entries: [{ command }] }": "没有找到可导入的命令。\n支持格式：[\"cmd\"]、{ commands: [] }、{ entries: [{ command }] }",
  "File import is unavailable in this environment.": "当前环境不可用文件导入。",
  "Clipboard unavailable. Copy the path below manually.": "剪贴板不可用。请手动复制下面的路径。",
  "Use Ctrl+Enter to confirm.": "使用 Ctrl+Enter 确认。",
  "Open Logs": "打开日志",
  "Connection Settings": "连接设置",
  "File Opening": "文件打开",
  "Hotkeys": "快捷键",
  "Workspace": "工作区",
  "Safety": "安全",
  "Monitor": "监控",
  "SFTP Settings": "SFTP 设置",
  "Port Fwd": "端口转发",
  "Retry Center": "重试中心",
  "Operation Center": "操作中心",
  "Export Bug Report": "导出错误报告",
  "Diagnostics": "诊断",
  "Copy Error": "复制错误",
  "Copy Latest Disconnect": "复制最近断开报告",
  "Connection": "连接",
  "Auto reconnect disconnected tabs": "自动重连已断开的标签页",
  "Applies when a terminal tab closes unexpectedly. Delay range: 1-60 seconds.": "当终端标签页意外关闭时生效。延迟范围：1-60 秒。",
  "Schedule Presets": "计划预设",
  "Apply a ready-made weekday/time template, then fine-tune the exact window if needed.": "应用现成的星期/时间模板，然后按需微调具体窗口。",
  "Retry Confirm Threshold": "重试确认阈值",
  "Clear Upload Default": "清除上传默认值",
  "Clear Download Default": "清除下载默认值",
  "Transfer Policy Packs": "传输策略包",
  "Stored packs": "已保存策略包",
  "Not linked yet.": "尚未链接。",
  "Auto-pull linked sync file on launch": "启动时自动拉取已链接同步文件",
  "Auto-push local pack changes to the linked sync file": "本地策略包变更后自动推送到已链接同步文件",
  "Auto sync stays off by default. It only runs when a sync file is linked and does not re-push immediately after a pull/merge.": "自动同步默认关闭。仅在已链接同步文件时运行，且不会在拉取/合并后立即再次推送。",
  "No transfer policy packs saved yet. Save the current SFTP settings to reuse them later.": "尚未保存传输策略包。保存当前 SFTP 设置后即可复用。",
  "Execution Sources": "执行来源",
  "Policy Pack": "策略包",
  "Environment Template": "环境模板",
  "Session Group Overrides": "会话分组覆盖",
  "Temporary Approval Scopes": "临时批准范围",
  "Persistent Approval Policies": "持久批准策略",
  "Shared Policy Bundles": "共享策略包",
  "Enable or disable guard inspection per execution path. Paste-style sources still only inspect multiline writes, while keyboard inspection still triggers when Enter submits the buffered command.": "按执行路径启用或停用安全检查。粘贴类来源仍只检查多行写入，键盘来源会在按回车提交缓冲命令时检查。",
  "Uses the fixed bottom approval bar. Covers keyboard Enter, multiline paste, command history run, snippets, quick profiles, and startup commands.": "使用底部固定批准栏。覆盖键盘回车、多行粘贴、命令历史运行、片段、快捷配置和启动命令。",
  "Workspace profile:": "工作区配置：",
  "Safety sync": "安全同步",
  "on": "开",
  "off": "关",
  "Enabled sources": "已启用来源",
  "Keyboard": "键盘",
  "Guard typed commands when Enter submits buffered terminal input.": "按回车提交终端缓冲输入时检查键入命令。",
  "Clipboard Paste": "剪贴板粘贴",
  "Guard pasted multiline text coming directly from the clipboard.": "检查直接来自剪贴板的多行粘贴文本。",
  "History Run": "历史运行",
  "Guard commands launched directly from Command History.": "检查从命令历史直接运行的命令。",
  "History Paste": "历史粘贴",
  "Guard command-history text pasted into the terminal without immediate execution.": "检查粘贴到终端但不会立即执行的命令历史文本。",
  "Snippet": "片段",
  "Guard Command Snippet / playbook executions.": "检查命令片段或 playbook 执行。",
  "Startup Command": "启动命令",
  "Guard startup commands that run when a session tab opens.": "检查会话标签页打开时运行的启动命令。",
  "Guard saved Quick Profile commands launched from the session menu.": "检查从会话菜单启动的已保存快捷配置命令。",
  "Adds curated workflow-specific guardrails on top of the built-in system rules without replacing your custom patterns.": "在内置系统规则之上叠加精选的工作流护栏，不会替换你的自定义模式。",
  "Workspace-profile sync is on, so this global selection follows the current workspace profile.": "工作区配置同步已开启，因此这个全局选择会跟随当前工作区配置。",
  "Keep the core OS-impacting guardrails while leaving workflow-specific rules opt-in.": "保留会影响操作系统的核心护栏，工作流专用规则保持可选。",
  "Operations": "运维",
  "Adds service, container, and orchestration actions that often have fleet-wide impact.": "增加服务、容器和编排类动作检查，这些动作通常会影响整组机器或服务。",
  "Strict": "严格",
  "Extends operations coverage with infrastructure destroy and data-destructive commands.": "在运维规则基础上增加基础设施销毁和数据破坏类命令检查。",
  "No Template": "不使用模板",
  "Do not layer environment-specific rules on top of the selected policy pack.": "不在所选策略包之上叠加环境专用规则。",
  "Development": "开发",
  "Keeps core guardrails with no extra environment-specific patterns.": "仅保留核心护栏，不增加环境专用模式。",
  "Staging": "预发",
  "Adds rollout and restart commands that can still disrupt shared validation environments.": "增加发布和重启命令检查，这些命令仍可能影响共享验证环境。",
  "Production": "生产",
  "Adds restart and data-reset helpers that deserve an explicit second look on prod hosts.": "增加重启和数据重置类辅助命令检查，生产主机上这些命令需要额外确认。",
  "Selecting a template also snaps the policy pack to the recommended baseline for that environment. Custom patterns stay untouched.": "选择模板时会同时切换到该环境推荐的策略包基线。自定义模式不会被修改。",
  "Recommended pack:": "推荐策略包：",
  "extra rule(s)": "条额外规则",
  "Active sources": "活动来源",
  "built-in rules": "内置规则",
  "policy pack": "策略包",
  "environment": "环境",
  "extra": "额外",
  "No extra policy-pack or environment-template rules are active right now.": "当前没有活动的策略包或环境模板额外规则。",
  "Recursive delete": "递归删除",
  "Matches recursive force-delete commands on Unix, PowerShell, and cmd.": "匹配 Unix、PowerShell 和 cmd 中的递归强制删除命令。",
  "Raw disk overwrite": "原始磁盘覆盖",
  "Matches direct writes to raw devices using dd or similar disk-image commands.": "匹配使用 dd 或类似磁盘镜像命令直接写入原始设备的操作。",
  "Disk format / partition": "磁盘格式化 / 分区",
  "Matches disk formatting and partitioning tools.": "匹配磁盘格式化和分区工具。",
  "Shutdown / reboot": "关机 / 重启",
  "Matches reboot, shutdown, halt, or poweroff actions.": "匹配 reboot、shutdown、halt 或 poweroff 等操作。",
  "Privileged system path write": "特权系统路径写入",
  "Matches force writes into core system locations under /etc, /usr, /boot, or Windows system folders.": "匹配向 /etc、/usr、/boot 或 Windows 系统文件夹等核心系统位置的强制写入。",
  "Service stop / restart": "服务停止 / 重启",
  "Matches service stop, restart, disable, or reload operations.": "匹配服务停止、重启、禁用或重载操作。",
  "Container / cluster destructive action": "容器 / 集群破坏性操作",
  "Matches kubectl delete, helm uninstall, docker compose down, and prune flows.": "匹配 kubectl delete、helm uninstall、docker compose down 和 prune 等流程。",
  "Infrastructure destroy": "基础设施销毁",
  "Matches Terraform, Terragrunt, or Pulumi destroy workflows.": "匹配 Terraform、Terragrunt 或 Pulumi 的 destroy 流程。",
  "Database drop / truncate": "数据库删除 / 截断",
  "Matches destructive SQL and cache flush operations.": "匹配破坏性 SQL 和缓存清空操作。",
  "Rollout / process restart": "发布 / 进程重启",
  "Matches rollout restarts and process-manager restarts in shared staging environments.": "匹配共享预发环境中的发布重启和进程管理器重启。",
  "Production rollout / restart": "生产发布 / 重启",
  "Matches common production restart and rollout commands.": "匹配常见生产重启和发布命令。",
  "Framework reset helper": "框架重置辅助命令",
  "Matches framework-specific reset helpers such as Prisma, Rails, or Sequelize resets.": "匹配 Prisma、Rails 或 Sequelize 等框架专用重置辅助命令。",
  "Custom pattern": "自定义模式",
  "warn": "警告",
  "critical": "严重",
  "Save pack/template combinations per session group. When a terminal tab belongs to a saved group, that override replaces the global pack/template for inspection on that tab only.": "按会话分组保存策略包和模板组合。当终端标签页属于已保存分组时，该覆盖只会替换该标签页检查时使用的全局策略包/模板。",
  "Target group:": "目标分组：",
  "Using the active tab session group.": "正在使用活动标签页的会话分组。",
  "Using the group currently selected in Sessions.": "正在使用会话列表中当前选中的分组。",
  "Focus a grouped tab or select a group in Sessions to save an override.": "聚焦一个有分组的标签页，或在会话列表中选择分组后保存覆盖。",
  "Saved overrides": "已保存覆盖",
  "Update Target Group Override": "更新目标分组覆盖",
  "Save Current Pack For Target Group": "为目标分组保存当前策略包",
  "Remove Target Group Override": "移除目标分组覆盖",
  "Override limit reached. Remove an existing group override before adding a new one.": "覆盖数量已达上限。添加新覆盖前请先移除已有分组覆盖。",
  "Policy pack:": "策略包：",
  "Current settings target group": "当前设置目标分组",
  "No session-group overrides saved yet. Ungrouped sessions keep using the global pack/template selection.": "还没有保存会话分组覆盖。未分组会话会继续使用全局策略包/模板选择。",
  "Runtime-only exact-command approvals created from the bottom approval bar. `Allow In Tab` is removed when that tab closes. `Allow In Group` stays active until Safety settings change, the app restarts, or you clear it here.": "从底部批准栏创建的仅本次运行精确命令批准。“允许此标签页”会在标签页关闭时移除。“允许此分组”会保持活动，直到安全设置改变、应用重启，或你在这里清除。",
  "Active temporary approvals": "活动临时批准",
  "Clear All Temporary Approvals": "清除全部临时批准",
  "No temporary approval scopes are active right now.": "当前没有活动的临时批准范围。",
  "Scope:": "作用域：",
  "source:": "来源：",
  "Pack:": "策略包：",
  "Approved": "批准时间",
  "Saved exact-command allow rules from the bottom approval bar. These stay active across app restart and travel with Safety bundles. Matching still requires the same command text, execution source, policy pack, and environment template.": "从底部批准栏保存的精确命令允许规则。它们会在应用重启后继续生效，并随安全包一起迁移。匹配时仍要求命令文本、执行来源、策略包和环境模板完全一致。",
  "Saved persistent policies": "已保存持久策略",
  "Clear All Persistent Policies": "清除全部持久策略",
  "No persistent approval policies saved yet.": "还没有保存持久批准策略。",
  "Save the current Safety settings as reusable JSON bundles, then import, export, apply, or sync them across machines and teammates through a shared JSON file. This baseline is manual push/pull only; auto-watch and permission-aware distribution are still out of scope.": "将当前安全设置保存为可复用的 JSON 包，然后可通过共享 JSON 文件在机器和团队成员之间导入、导出、应用或同步。当前基线只支持手动推送/拉取，自动监听和权限感知分发暂不包含在内。",
  "Stored bundles": "已保存包",
  "Sync file:": "同步文件：",
  "Last pull:": "上次拉取：",
  "last push:": "上次推送：",
  "never": "从未",
  "Save Current As Bundle": "保存当前为包",
  "Import Bundles...": "导入包...",
  "Export All Bundles...": "导出全部包...",
  "Clear Sync File": "清除同步文件",
  "No shared safety bundles saved yet. Save the current Safety configuration to create your first reusable bundle.": "还没有保存共享安全包。保存当前安全配置即可创建第一个可复用包。",
  "Sources": "来源",
  "group overrides": "分组覆盖",
  "persistent policies": "持久策略",
  "custom patterns": "自定义模式",
  "Updated": "更新于",
  "Custom Patterns": "自定义模式",
  "Active custom patterns": "活动自定义模式",
  "invalid lines": "无效行",
  "Invalid lines are ignored.": "无效行会被忽略。",
  "Reset Safety Rules": "重置安全规则",
  "Template Tools": "模板工具",
  "Create Session": "创建会话",
  "TermDock is a local-first desktop app. It does not require a cloud account to manage servers.": "TermDock 是本地优先桌面应用，不需要云账号来管理服务器。",
  "Session data and diagnostics are stored locally. Session and group exports exclude decrypted credentials.": "会话数据和诊断信息保存在本地。会话和分组导出不会包含解密后的凭据。",
  "Before sharing logs or bug reports, review the generated files and remove private hosts, usernames, tokens, paths, and credentials.": "分享日志或 bug report 前，请先检查生成文件，并移除私有主机、用户名、token、路径和凭据。",
  "Full notes are available in SECURITY.md and SECURITY.zh-CN.md in the repository.": "完整说明见仓库中的 SECURITY.md 和 SECURITY.zh-CN.md。",
  "Test Connection": "测试连接",
  "Testing...": "正在测试...",
  "Saving...": "正在保存...",
  "Save Changes": "保存更改",
  "Session Templates": "会话模板",
  "No saved templates yet.": "尚未保存模板。",
  "Template Env Vars": "模板环境变量",
  "No template env vars yet.": "尚无模板环境变量。",
  "Use Template": "使用模板",
  "Delete Template": "删除模板",
  "Save Template": "保存模板",
  "Move Sessions to Group": "移动会话到分组",
  "Move Session": "移动会话",
  "Select target group from the list.": "从列表中选择目标分组。",
  "Target Group": "目标分组",
  "Critical": "严重",
  "Risk": "风险",
  " command from ": "命令来源：",
  "Screen": "屏幕",
  "Buffer": "缓冲区",
  "Manual": "手动",
  "Imported": "已导入",
  "Source": "来源",
  "Inspector panels": "检查器面板",
  "Midnight": "午夜",
  "Deep blue canvas with cool contrast for long dark-session editing.": "深蓝画布，冷色对比，适合长时间暗色终端编辑。",
  "Graphite": "石墨",
  "Neutral slate palette with softer contrast and mint cursor accents.": "中性石板配色，柔和对比，并使用薄荷色光标强调。",
  "Paper": "纸张",
  "Warm light canvas for terminal editing that feels closer to a text buffer.": "温暖浅色画布，让终端编辑更接近文本缓冲区。",
  "Balanced": "均衡",
  "Tighter rows and smaller type for maximum visible context.": "更紧凑的行距和更小字号，最大化可见上下文。",
  "Default terminal editor density with moderate breathing room.": "默认终端编辑密度，保留适度呼吸感。",
  "Reading": "阅读",
  "Larger type and taller rows for longer focused editing sessions.": "更大字号和更高行距，适合长时间专注编辑。",
  "System Mono": "系统等宽",
  "Lean on the platform default mono stack for the most native terminal feel.": "使用平台默认等宽字体栈，获得最原生的终端观感。",
  "Coding Mono": "代码等宽",
  "Bias toward developer fonts such as Cascadia Code, JetBrains Mono, and Fira Code.": "优先使用 Cascadia Code、JetBrains Mono、Fira Code 等开发字体。",
  "Drafting Mono": "写作等宽",
  "Use calmer editorial mono stacks for long config and prose editing sessions.": "使用更沉静的编辑型等宽字体，适合长配置和文本编辑。",
  "Crisp": "清晰",
  "Tighter tracking with lighter stroke weight for dense config and code edits.": "更紧字距和更轻笔画，适合密集配置与代码编辑。",
  "Steady": "稳定",
  "Balanced text weight and spacing for everyday terminal editing.": "均衡字重与间距，适合日常终端编辑。",
  "Adds more air between glyphs and a heavier stroke for long prose-like edits.": "增加字形间距并加重笔画，适合长文本式编辑。",
  "Beam": "竖线",
  "Thin insertion beam for dense line-by-line editing.": "细插入光标，适合逐行密集编辑。",
  "Underline": "下划线",
  "Underline cursor that stays out of the way in text-heavy buffers.": "下划线光标，在文本密集缓冲区中更不遮挡。",
  "Block": "方块",
  "Full block cursor for strong position tracking in modal editors.": "完整方块光标，适合模态编辑器中的强位置提示。",
  "Sort: Default": "排序：默认",
  "Sort: Default (Current)": "排序：默认（当前）",
  "Sort: Recent": "排序：最近",
  "Sort: Recent (Current)": "排序：最近（当前）",
  "Sort: Name A-Z": "排序：名称 A-Z",
  "Sort: Name A-Z (Current)": "排序：名称 A-Z（当前）",
  "Sort: Name Z-A": "排序：名称 Z-A",
  "Sort: Name Z-A (Current)": "排序：名称 Z-A（当前）",
  "Allow In Tab": "允许此标签页",
  "Allow In Group": "允许此分组",
  "Save Policy...": "保存策略...",
  "Run Once": "运行一次",
  "Terminal bridge is not ready. Restart `pnpm dev`.": "终端桥接尚未就绪。请重启 `pnpm dev`。",
  "Terminal bridge unavailable. Restart `pnpm dev`.": "终端桥接不可用。请重启 `pnpm dev`。",
  "Terminal tab is not connected.": "终端标签页未连接。",
  "Terminal tab is reconnecting...": "终端标签页正在重连...",
  "Terminal tab disconnected.": "终端标签页已断开。",
  "Terminal write failed.": "终端写入失败。",
  "Clipboard API unavailable.": "剪贴板 API 不可用。",
  "Copy failed. Clipboard permission may be blocked.": "复制失败。剪贴板权限可能被阻止。",
  "Paste failed. Clipboard permission may be blocked.": "粘贴失败。剪贴板权限可能被阻止。",
  "No available terminal tab to run this command.": "没有可用于运行此命令的终端标签页。",
  "No terminal match for": "终端中未找到匹配项",
  "Clipboard unavailable. Copy command manually.": "剪贴板不可用。请手动复制命令。",
  "Open a terminal tab before running command history entries.": "请先打开终端标签页，再运行命令历史记录。",
  "Open and focus a terminal tab before pasting command history entries.": "请先打开并聚焦终端标签页，再粘贴命令历史记录。",
  "System bridge unavailable. Restart `pnpm dev`.": "系统桥接不可用。请重启 `pnpm dev`。",
  "Session bridge unavailable. Restart `pnpm dev`.": "会话桥接不可用。请重启 `pnpm dev`。",
  "Session form validation failed. Open Connection settings or fix the required host, username, and credential fields before retrying.":
    "会话表单校验失败。请打开连接设置，或修正必填的主机、用户名和凭据字段后再重试。",
  "Session template validation failed. Open Session Templates to fix the template name, env vars, or duplicate fields.":
    "会话模板校验失败。请打开会话模板，修正模板名称、环境变量或重复字段。",
  "Snippet validation or import/export issue detected. Open Snippet Manager to review group limits, parameter keys, or the source file.":
    "检测到快捷片段校验或导入/导出问题。请打开快捷片段管理器，检查分组上限、参数键名或源文件。",
  "This action needs a focused terminal tab. Open a session from the Sessions panel, then retry the snippet or command-history action.":
    "此操作需要先聚焦一个终端标签页。请从会话面板打开会话，然后重试片段或命令历史操作。",
  "A session group name is required. Enter a group name in the Sessions panel before saving or moving sessions.":
    "会话分组名称不能为空。请在会话面板中输入分组名称后再保存或移动会话。",
  "Session import or export failed. Review the source file and duplicate strategy, then check Operation Center for tracked import/export jobs.":
    "会话导入或导出失败。请检查源文件和重复项策略，并在操作中心查看已跟踪的导入/导出任务。",
  "Session import or export failed. Review the source file, duplicate strategy, and target group before retrying.":
    "会话导入或导出失败。请检查源文件、重复项策略和目标分组后再重试。",
  "Command history import or export failed. Open Command History Manager to review the JSON format and retry the file action.":
    "命令历史导入或导出失败。请打开命令历史管理器，检查 JSON 格式后重试文件操作。",
  "Log bridge unavailable. Restart `pnpm dev`.": "日志桥接不可用。请重启 `pnpm dev`。",
  "SFTP bridge unavailable. Restart `pnpm dev`.": "SFTP 桥接不可用。请重启 `pnpm dev`。",
  "Desktop bridge is not ready. Please restart `pnpm dev`.": "桌面桥接尚未就绪。请重启 `pnpm dev`。",
  "Bug report bridge unavailable. Restart `pnpm dev`.": "错误报告桥接不可用。请重启 `pnpm dev`。",
  "Invalid hotkey file: missing hotkeys object.": "无效快捷键文件：缺少 hotkeys 对象。",
  "Invalid hotkey file: no recognized hotkey actions.": "无效快捷键文件：没有识别到快捷键动作。",
  "Listen port must be between 1 and 65535.": "监听端口必须在 1 到 65535 之间。",
  "Template port must resolve to a number between 1 and 65535.": "模板端口必须解析为 1 到 65535 之间的数字。",
  "Clipboard unavailable.": "剪贴板不可用。",
  "Error message copied to clipboard.": "错误信息已复制到剪贴板。",
  "Log file path copied to clipboard.": "日志文件路径已复制到剪贴板。",
  "Disconnect report JSON copied to clipboard.": "断开报告 JSON 已复制到剪贴板。",
  "Disconnect reports JSON copied to clipboard.": "断开报告 JSON 已复制到剪贴板。",
  "Disconnect reports CSV copied to clipboard.": "断开报告 CSV 已复制到剪贴板。",
  "Clipboard unavailable. Copy the disconnect reports below manually.": "剪贴板不可用。请手动复制下面的断开报告。",
  "Clipboard unavailable. Copy the disconnect reports CSV below manually.": "剪贴板不可用。请手动复制下面的断开报告 CSV。",
  "No matching disconnect reports for the current filter.": "当前筛选条件下没有匹配的断开报告。",
  "No disconnect reports captured yet.": "尚未捕获断开报告。",
  "Visible disconnect reports cleared.": "已清除可见断开报告。",
  "Disconnect reports cleared.": "已清除断开报告。",
  "Clash direct rules copied to clipboard.": "Clash 直连规则已复制到剪贴板。",
  "Clipboard unavailable. Copy the text below manually.": "剪贴板不可用。请手动复制下面的文本。",
  "Open and select a terminal tab, then retry reconnect.": "请先打开并选择终端标签页，然后重试重连。",
  "Open connected session tab first.": "请先打开已连接的会话标签页。",
  "Active": "活动",
  "Degraded": "降级",
  "Created": "已创建",
  "Removed": "已移除",
  "Recovered": "已恢复",
  "INFO": "信息",
  "ERROR": "错误",
  "Local (L)": "本地 (L)",
  "Remote (R)": "远程 (R)",
  "Dynamic SOCKS5 (D)": "动态 SOCKS5 (D)",
  "Port Forwarding": "端口转发",
  "Port Forwarding Preset": "端口转发预设",
  "Port Forwarding Diagnostics": "端口转发诊断",
  "Port Forwarding Events": "端口转发事件",
  "Port Forwarding History": "端口转发历史",
  "Export Port Forward Snapshot": "导出端口转发快照",
  "Export Port Forward Events (JSON)": "导出端口转发事件 (JSON)",
  "Export Port Forward Events (CSV)": "导出端口转发事件 (CSV)",
  "Export Port Forward Analytics (JSON)": "导出端口转发分析 (JSON)",
  "Export Port Forward Analytics (CSV)": "导出端口转发分析 (CSV)",
  "Save Port Forward Preset": "保存端口转发预设",
  "Port forwarding snapshot copied to clipboard.": "端口转发快照已复制到剪贴板。",
  "Clipboard unavailable. Copy the snapshot below manually.": "剪贴板不可用。请手动复制下面的快照。",
  "Port forwarding events JSON copied to clipboard.": "端口转发事件 JSON 已复制到剪贴板。",
  "Clipboard unavailable. Copy the JSON below manually.": "剪贴板不可用。请手动复制下面的 JSON。",
  "Port forwarding events CSV copied to clipboard.": "端口转发事件 CSV 已复制到剪贴板。",
  "Clipboard unavailable. Copy the CSV below manually.": "剪贴板不可用。请手动复制下面的 CSV。",
  "Port forwarding analytics JSON copied to clipboard.": "端口转发分析 JSON 已复制到剪贴板。",
  "Clipboard unavailable. Copy the analytics JSON below manually.": "剪贴板不可用。请手动复制下面的分析 JSON。",
  "Port forwarding analytics CSV copied to clipboard.": "端口转发分析 CSV 已复制到剪贴板。",
  "Clipboard unavailable. Copy the analytics CSV below manually.": "剪贴板不可用。请手动复制下面的分析 CSV。",
  "Open a session tab first, then create port forwarding.": "请先打开会话标签页，再创建端口转发。",
  "Active tab is not connected. Reconnect and try again.": "活动标签页未连接。请重连后重试。",
  "Open the target session tab first, then save a port forwarding preset.": "请先打开目标会话标签页，再保存端口转发预设。",
  "Open the target session tab first, then apply a preset.": "请先打开目标会话标签页，再应用预设。",
  "Preset session does not match the active terminal tab.": "预设会话与活动终端标签页不匹配。",
  "Preset name": "预设名称",
  "Preset name is required.": "预设名称不能为空。",
  "Port forwarding is bound to the active terminal tab and removed when that tab disconnects/closes.": "端口转发绑定到活动终端标签页，并会在该标签页断开或关闭时移除。",
  "Type": "类型",
  "Listen Host": "监听主机",
  "Listen Port": "监听端口",
  "Remote Target Host": "远程目标主机",
  "Local Target Host": "本地目标主机",
  "Remote Target Port": "远程目标端口",
  "Local Target Port": "本地目标端口",
  "Working...": "处理中...",
  "Create Forward": "创建转发",
  "Save as Preset": "保存为预设",
  "Fill Form": "填入表单",
  "Apply": "应用",
  "Refresh Diagnostics": "刷新诊断",
  "Export Snapshot": "导出快照",
  "Saved Presets": "已保存预设",
  "Auto restore on connect": "连接时自动恢复",
  "Open a session tab to manage presets for that session.": "打开会话标签页后即可管理该会话的预设。",
  "No saved presets for this session yet. Fill the form above and save one.": "此会话还没有保存的预设。填写上方表单并保存一个即可。",
  "Active Forwards": "活动转发",
  "No active port forwards for the current tab.": "当前标签页没有活动端口转发。",
  "Recent Events": "最近事件",
  "Filter": "筛选",
  "Time": "时间",
  "Trigger": "触发方式",
  "Error Code": "错误码",
  "Correlation": "关联",
  "Errors Only": "仅错误",
  "Create/Remove": "创建/移除",
  "Degraded/Recovered": "降级/恢复",
  "Last 5m": "最近 5 分钟",
  "Last 30m": "最近 30 分钟",
  "Last 1h": "最近 1 小时",
  "Last 24h": "最近 24 小时",
  "Reset Filters": "重置筛选",
  "Export Visible JSON": "导出可见 JSON",
  "Export Visible CSV": "导出可见 CSV",
  "Export Analytics JSON": "导出分析 JSON",
  "Export Analytics CSV": "导出分析 CSV",
  "Clear Session": "清除此会话",
  "No matching port forwarding events for the current filter.": "当前筛选条件下没有匹配的端口转发事件。",
  "Open a session tab to view port forwarding event history.": "打开会话标签页后即可查看端口转发事件历史。",
  "No error code data": "没有错误码数据",
  "No correlation key data": "没有关联键数据",
  "Error Ratio": "错误比例",
  "Type Breakdown": "类型分布",
  "Top Error Codes": "主要错误码",
  "Top Correlation": "主要关联项",
  "Open Program or Command (optional)": "打开程序或命令（可选）",
  "Browse": "浏览",
  "Leave empty to use system default app. Used by SFTP \"Open File\" and file double-click.": "留空则使用系统默认应用。用于 SFTP“打开文件”和文件双击。",
  "Windows accepts either a program path or a command like": "Windows 可使用程序路径或命令，例如",
  "Log Directory": "日志目录",
  "Log File": "日志文件",
  "Open Folder": "打开文件夹",
  "Copy Log File Path": "复制日志文件路径",
  "Exporting...": "正在导出...",
  "Disconnect Reports": "断开报告",
  "TermDock writes runtime diagnostics to local log files. Share these files when reporting bugs.": "TermDock 会将运行诊断写入本地日志文件。报告问题时可分享这些文件。",
  "Export Bug Report bundles logs, runtime metadata, and a safe settings snapshot into one zip package.": "导出错误报告会把日志、运行元数据和安全的设置快照打包为一个 zip 文件。",
  "Auto capture unexpected disconnect reports": "自动捕获意外断开报告",
  "All Sessions": "全部会话",
  "Active Session": "活动会话",
  "Copy Latest Visible": "复制最新可见项",
  "Copy JSON": "复制 JSON",
  "Focus Tab": "聚焦标签页",
  "Recent failures:": "最近失败：",
  "Status": "状态",
  "Error": "错误",
  "Conflict": "冲突",
  "Disabled": "已禁用",
  "Modifier": "修饰键",
  "Prev": "上一个",
  "Next": "下一个",
  "Locate": "定位",
  "Focus First Conflict": "定位第一个冲突",
  "Auto Resolve Conflicts": "自动解决冲突",
  "Open selected session in new tab": "在新标签页打开所选会话",
  "Close active terminal tab": "关闭活动终端标签页",
  "Terminal copy (Windows defaults to Ctrl+Shift+C)": "终端复制（Windows 默认 Ctrl+Shift+C）",
  "Terminal paste (Windows defaults to Ctrl+Shift+V)": "终端粘贴（Windows 默认 Ctrl+Shift+V）",
  "Search in terminal": "在终端中搜索",
  "Import Hotkeys": "导入快捷键",
  "Export Hotkeys": "导出快捷键",
  "Import + Auto Resolve": "导入并自动解决",
  "No shortcut conflicts detected in imported hotkeys.": "导入的快捷键中未检测到快捷键冲突。",
  "No hotkey changes detected in the selected file.": "所选文件中未检测到快捷键变更。",
  "Hotkeys JSON copied to clipboard.": "快捷键 JSON 已复制到剪贴板。",
  "Clipboard unavailable. Copy the hotkeys JSON manually.": "剪贴板不可用。请手动复制快捷键 JSON。",
  "Hotkeys imported. No duplicates needed auto-resolve.": "快捷键已导入，没有需要自动解决的重复项。",
  "Conflicts on": "冲突快捷键：",
  "Conflicts may trigger only the first matching action. Auto resolve keeps the first action and disables the rest.": "冲突可能只触发第一个匹配动作。自动解决会保留第一个动作，并禁用其余动作。",
  "Keyboard navigation:": "键盘导航：",
  "previous,": "上一个，",
  "next.": "下一个。",
  "Windows defaults use": "Windows 默认使用",
  "for terminal copy/paste, and keeps Alt-based keys for tab and search actions. macOS keeps the existing Cmd-based behavior.": "进行终端复制/粘贴，并保留基于 Alt 的标签页和搜索快捷键。macOS 保持现有的 Cmd 行为。",
  "Import Hotkeys...": "导入快捷键...",
  "Export Hotkeys...": "导出快捷键...",
  "Reset Hotkeys": "重置快捷键",
  "Enable threshold alerts in monitor panel": "在监控面板中启用阈值告警",
  "CPU Alert (%)": "CPU 告警 (%)",
  "Memory Alert (%)": "内存告警 (%)",
  "Disk Alert (%)": "磁盘告警 (%)",
  "Yes": "是",
  "No": "否",
  "Quick Profile": "快捷配置",
  "New Quick Profile": "新建快捷配置",
  "Quick Profile Command": "快捷配置命令",
  "Run Quick Profile": "运行快捷配置",
  "Manage Quick Profiles": "管理快捷配置",
  "Manage Quick Profile": "管理快捷配置",
  "Edit Quick Profile": "编辑快捷配置",
  "Delete Quick Profile": "删除快捷配置",
  "Enter quick profile name.": "输入快捷配置名称。",
  "Profile name cannot be empty.": "配置名称不能为空。",
  "Enter startup command (supports multiline).": "输入启动命令（支持多行）。",
  "Edit startup command (supports multiline).": "编辑启动命令（支持多行）。",
  "Startup command cannot be empty.": "启动命令不能为空。",
  "Require confirmation before running this profile?": "运行此配置前需要确认吗？",
  "Quick profile command is empty.": "快捷配置命令为空。",
  "No quick profiles available. Create one first.": "还没有快捷配置。请先创建一个。",
  "Select quick profile to manage.": "选择要管理的快捷配置。",
  "Edit profile name.": "编辑配置名称。",
  "Snippet Preview": "片段预览",
  "Import Snippet Groups": "导入片段分组",
  "Export Snippet Groups": "导出片段分组",
  "Snippet Groups Import": "片段分组导入",
  "Snippet Groups Export": "片段分组导出",
  "No valid snippet groups found in selected file.": "所选文件中没有有效的片段分组。",
  "No snippet groups available to export.": "没有可导出的片段分组。",
  "Snippet groups JSON copied to clipboard.": "片段分组 JSON 已复制到剪贴板。",
  "Snippet resolved to an empty command.": "片段解析为空命令。",
  "Clear Snippet Groups": "清空片段分组",
  "Delete Snippet Group": "删除片段分组",
  "Enable dangerous command guardrails before terminal execution": "终端执行前启用危险命令护栏",
  "Pulling...": "正在拉取...",
  "Pull Sync": "拉取同步",
  "Pull Sync...": "拉取同步...",
  "Pushing...": "正在推送...",
  "Push Sync": "推送同步",
  "Push Sync...": "推送同步...",
  "Choosing...": "正在选择...",
  "Change Sync File...": "更改同步文件...",
  "Choose Sync File...": "选择同步文件...",
  "No description.": "无描述。",
  "One pattern per line\nPlain text or /regex/flags": "每行一个模式\n纯文本或 /regex/flags",
  "Host": "主机",
  "Port": "端口",
  "Username": "用户名",
  "Auth Type": "认证类型",
  "Private Key Path": "私钥路径",
  "Key Passphrase": "密钥口令",
  "Key Passphrase (Optional)": "密钥口令（可选）",
  "Password / Secret": "密码 / 密钥",
  "Password stored in OS secure vault": "密码保存在系统安全凭据库中",
  "Leave blank to keep current password": "留空以保留当前密码",
  "Optional passphrase": "可选口令",
  "Mark created sessions as favorite": "将创建的会话标记为收藏",
  "Remark": "备注",
  "Add Variable": "添加变量",
  "value": "值",
  "details available": "有详细信息"
};

const SIMPLIFIED_CHINESE_REPLACEMENTS: TextReplacement[] = [
  {
    pattern: /^Showing (\d+) of (\d+)$/u,
    replace: (_match, visible, total) => `显示 ${visible} / ${total}`
  },
  {
    pattern: /^(\d+) items selected$/u,
    replace: (_match, count) => `已选择 ${count} 项`
  },
  {
    pattern: /^\+ (\d+) more$/u,
    replace: (_match, count) => `+ 另外 ${count} 项`
  },
  {
    pattern: /^Group: (.+)$/u,
    replace: (_match, name) => `分组：${name}`
  },
  {
    pattern: /^Bound to tab: (.+)$/u,
    replace: (_match, name) => `绑定到标签页：${name}`
  },
  {
    pattern: /^Entries: (\d+) \(Files: (\d+), Dirs: (\d+)\)$/u,
    replace: (_match, total, files, dirs) => `条目：${total}（文件：${files}，目录：${dirs}）`
  },
  {
    pattern: /^Current directory size: (.+)$/u,
    replace: (_match, size) => `当前目录大小：${size}`
  },
  {
    pattern: /^Deleting (directory|file) "(.+)"\.\.\.$/u,
    replace: (_match, kind, name) => `正在删除${kind === "directory" ? "目录" : "文件"}“${name}”...`
  },
  {
    pattern: /^Groups (\d+)\/(\d+) \| Snippets (\d+) \| Prompt Sets (\d+) \| Remembered Scoped Values (\d+)$/u,
    replace: (_match, groups, maxGroups, snippets, promptSets, scoped) =>
      `分组 ${groups}/${maxGroups} | 片段 ${snippets} | 提示集 ${promptSets} | 已记住作用域值 ${scoped}`
  },
  {
    pattern: /^Snippets \((\d+)\/(\d+)\)$/u,
    replace: (_match, count, max) => `片段（${count}/${max}）`
  },
  {
    pattern: /^Prompt Set \((\d+)\/(\d+)\)$/u,
    replace: (_match, count, max) => `提示集（${count}/${max}）`
  },
  {
    pattern: /^Prompt Set Variables \((\d+)\/(\d+)\)$/u,
    replace: (_match, count, max) => `提示集变量（${count}/${max}）`
  },
  {
    pattern: /^Snippet Variables \((\d+)\/(\d+)\)$/u,
    replace: (_match, count, max) => `片段变量（${count}/${max}）`
  },
  {
    pattern: /^Insert (.+)$/u,
    replace: (_match, token) => `插入 ${token}`
  },
  {
    pattern: /^Token: (.+) \| Scope: (.+) \| Invalid regex: (.+)$/u,
    replace: (_match, token, scope, error) =>
      `令牌：${token} | 作用域：${translateAppText("zh-CN", scope)} | 无效正则：${error}`
  },
  {
    pattern: /^Token: (.+) \| Scope: (.+)$/u,
    replace: (_match, token, scope) => `令牌：${token} | 作用域：${translateAppText("zh-CN", scope)}`
  },
  {
    pattern: /^Missing parameter definitions: (.+)$/u,
    replace: (_match, keys) => `缺少参数定义：${keys}`
  },
  {
    pattern: /^Snippet variables override prompt-set keys: (.+)$/u,
    replace: (_match, keys) => `片段变量会覆盖提示集键：${keys}`
  },
  {
    pattern: /^Unused effective variables for this snippet: (.+)$/u,
    replace: (_match, keys) => `此片段未使用的生效变量：${keys}`
  },
  {
    pattern: /^Showing (\d+) of (\d+) command\(s\)\.$/u,
    replace: (_match, visible, total) => `显示 ${visible} / ${total} 条命令。`
  },
  {
    pattern: /^Source: (.+)$/u,
    replace: (_match, source) => `来源：${translateAppText("zh-CN", source)}`
  },
  {
    pattern: /^Active tab: (.+) \((connected|disconnected)\)$/u,
    replace: (_match, title, status) =>
      `活动标签页：${title}（${status === "connected" ? "已连接" : "已断开"}）`
  },
  {
    pattern: /^(.+): connected$/u,
    replace: (_match, title) => `${title}：已连接`
  },
  {
    pattern: /^(.+): connecting\.\.\.$/u,
    replace: (_match, title) => `${title}：正在连接...`
  },
  {
    pattern: /^(.+): closed$/u,
    replace: (_match, title) => `${title}：已关闭`
  },
  {
    pattern: /^Connecting to (.+)\.\.\.$/u,
    replace: (_match, title) => `正在连接到 ${title}...`
  },
  {
    pattern: /^Open (\d+) Selected Tabs$/u,
    replace: (_match, count) => `打开 ${count} 个已选标签页`
  },
  {
    pattern: /^Delete (\d+) Selected$/u,
    replace: (_match, count) => `删除 ${count} 个已选项`
  },
  {
    pattern: /^Delete (\d+) Selected Groups$/u,
    replace: (_match, count) => `删除 ${count} 个已选分组`
  },
  {
    pattern: /^Delete (\d+) Selected Sessions$/u,
    replace: (_match, count) => `删除 ${count} 个已选会话`
  },
  {
    pattern: /^Delete (\d+) visible port forwarding history item\(s\)\?$/u,
    replace: (_match, count) => `删除 ${count} 条可见端口转发历史记录？`
  },
  {
    pattern: /^Delete all (\d+) port forwarding history item\(s\) for this session\?$/u,
    replace: (_match, count) => `删除此会话的全部 ${count} 条端口转发历史记录？`
  },
  {
    pattern: /^Move (\d+) Sessions$/u,
    replace: (_match, count) => `移动 ${count} 个会话`
  },
  {
    pattern: /^Run Quick Profile\.\.\. \((\d+)\)$/u,
    replace: (_match, count) => `运行快捷配置...（${count}）`
  },
  {
    pattern: /^New Session From Template\.\.\. \((\d+)\)$/u,
    replace: (_match, count) => `从模板新建会话...（${count}）`
  },
  {
    pattern: /^Connections (\d+) \(failed (\d+)\)$/u,
    replace: (_match, total, failed) => `连接 ${total}（失败 ${failed}）`
  },
  {
    pattern: /^Last activity (.+)$/u,
    replace: (_match, label) => `上次活动 ${label}`
  },
  {
    pattern: /^Last error \((.+)\): (.+)$/u,
    replace: (_match, label, error) => `上次错误（${label}）：${error}`
  },
  {
    pattern: /^Errors (\d+)\/(\d+)$/u,
    replace: (_match, errors, total) => `错误 ${errors}/${total}`
  },
  {
    pattern: /^created (\d+) \| removed (\d+)$/u,
    replace: (_match, created, removed) => `已创建 ${created} | 已移除 ${removed}`
  },
  {
    pattern: /^degraded (\d+) \| recovered (\d+)$/u,
    replace: (_match, degraded, recovered) => `降级 ${degraded} | 已恢复 ${recovered}`
  },
  {
    pattern: /^Session history (\d+), visible (\d+)(?:, range (.+))?(?:, code (.+))?$/u,
    replace: (_match, total, visible, range = "", code = "") =>
      `会话历史 ${total}，可见 ${visible}${range ? `，范围 ${range}` : ""}${code ? `，错误码 ${code}` : ""}`
  },
  {
    pattern: /^Snippets \((\d+)\)$/u,
    replace: (_match, count) => `片段（${count}）`
  },
  {
    pattern: /^View (\d+) more$/u,
    replace: (_match, count) => `查看其余 ${count} 条`
  },
  {
    pattern: /^(\d+)\/(\d+)$/u,
    replace: (_match, visible, total) => `${visible}/${total}`
  },
  {
    pattern: /^(.+)\n\nDouble-click to paste into active terminal\. Right-click for actions\.$/u,
    replace: (_match, command) => `${command}\n\n双击可粘贴到活动终端。右键查看更多操作。`
  },
  {
    pattern: /^(.+)\n\nSource: (.+)$/u,
    replace: (_match, command, source) => `${command}\n\n来源：${translateAppText("zh-CN", source)}`
  },
  {
    pattern: /^Updated: (.+) · refreshing\.\.\.$/u,
    replace: (_match, label) => `更新：${label} · 正在刷新...`
  },
  {
    pattern: /^Updated: (.+)$/u,
    replace: (_match, label) => `更新：${label}`
  },
  {
    pattern: /^Recent trend \(last (\d+) samples\)$/u,
    replace: (_match, count) => `最近趋势（最近 ${count} 个样本）`
  },
  {
    pattern: /^Hotkey conflicts detected \((\d+)\)$/u,
    replace: (_match, count) => `检测到快捷键冲突（${count}）`
  },
  {
    pattern: /^Conflicts on (.+)\.$/u,
    replace: (_match, binding) => `冲突快捷键：${binding}。`
  },
  {
    pattern: /^Detected (\d+) shortcut conflict\(s\) in imported hotkeys\.$/u,
    replace: (_match, count) => `导入的快捷键中检测到 ${count} 个快捷键冲突。`
  },
  {
    pattern: /^Hotkeys exported:\n(.+)$/u,
    replace: (_match, path) => `快捷键已导出：\n${path}`
  },
  {
    pattern: /^Hotkeys exported\.\nPath copied to clipboard:\n(.+)$/u,
    replace: (_match, path) => `快捷键已导出。\n路径已复制到剪贴板：\n${path}`
  },
  {
    pattern: /^Import hotkeys from "(.+)"\?\n(.+)$/u,
    replace: (_match, source, summary) =>
      `从“${source}”导入快捷键？\n${translateAppText("zh-CN", summary)}`
  },
  {
    pattern: /^Hotkeys imported and auto-resolved\.\nDisabled (\d+) duplicate action\(s\)\.$/u,
    replace: (_match, count) => `快捷键已导入并自动解决。\n已禁用 ${count} 个重复动作。`
  },
  {
    pattern: /^Hotkeys imported from:\n(.+)$/u,
    replace: (_match, path) => `快捷键已从以下位置导入：\n${path}`
  },
  {
    pattern: /^(.+) saved values$/u,
    replace: (_match, count) => `${count} 个已保存值`
  },
  {
    pattern: /^Created (.+)\.$/u,
    replace: (_match, target) => `已创建 ${target}。`
  },
  {
    pattern: /^Removed (.+)\.$/u,
    replace: (_match, target) => `已移除 ${target}。`
  },
  {
    pattern: /^Port forwarding created\.\n(.+)$/u,
    replace: (_match, record) => `端口转发已创建。\n${record}`
  },
  {
    pattern: /^Port forwarding snapshot exported:\n(.+)$/u,
    replace: (_match, path) => `端口转发快照已导出：\n${path}`
  },
  {
    pattern: /^Port forwarding snapshot exported\.\nPath copied to clipboard:\n(.+)$/u,
    replace: (_match, path) => `端口转发快照已导出。\n路径已复制到剪贴板：\n${path}`
  },
  {
    pattern: /^Port forwarding events (JSON|CSV) exported:\n(.+)$/u,
    replace: (_match, format, path) => `端口转发事件 ${format} 已导出：\n${path}`
  },
  {
    pattern: /^Port forwarding events (JSON|CSV) exported\.\nPath copied to clipboard:\n(.+)$/u,
    replace: (_match, format, path) => `端口转发事件 ${format} 已导出。\n路径已复制到剪贴板：\n${path}`
  },
  {
    pattern: /^Port forwarding analytics (JSON|CSV) exported:\n(.+)$/u,
    replace: (_match, format, path) => `端口转发分析 ${format} 已导出：\n${path}`
  },
  {
    pattern: /^Port forwarding analytics (JSON|CSV) exported\.\nPath copied to clipboard:\n(.+)$/u,
    replace: (_match, format, path) => `端口转发分析 ${format} 已导出。\n路径已复制到剪贴板：\n${path}`
  },
  {
    pattern: /^Preset saved for (.+)\.\n(.+)$/u,
    replace: (_match, tab, preset) => `已为 ${tab} 保存预设。\n${preset}`
  },
  {
    pattern: /^Delete preset "(.+)"\?\n(.+)$/u,
    replace: (_match, name, summary) => `删除预设“${name}”？\n${summary}`
  },
  {
    pattern: /^Remove this forward\?\n(.+)$/u,
    replace: (_match, summary) => `移除此转发？\n${summary}`
  },
  {
    pattern: /^Recent failures: (.+)$/u,
    replace: (_match, failures) => `最近失败：${failures}`
  },
  {
    pattern: /^Trigger: error \((.+)\)$/u,
    replace: (_match, message) => `触发方式：错误（${message}）`
  },
  {
    pattern: /^Trigger: (.+) \((.+)\)$/u,
    replace: (_match, status, message) => `触发方式：${translateAppText("zh-CN", status)}（${message}）`
  },
  {
    pattern: /^Transfers active: (\d+) \(up (\d+)\/(\d+), down (\d+)\/(\d+)\) \| Port forwards: (\d+) \((\d+) degraded\)$/u,
    replace: (_match, active, upRun, upQueue, downRun, downQueue, forwards, degraded) =>
      `活动传输：${active}（上传 ${upRun}/${upQueue}，下载 ${downRun}/${downQueue}） | 端口转发：${forwards}（${degraded} 个降级）`
  },
  {
    pattern: /^Tabs: (\d+)\/(\d+) connected \| Auto reconnect: on \((.+)\)$/u,
    replace: (_match, connected, total, delay) =>
      `标签页：${connected}/${total} 已连接 | 自动重连：开启（${delay}）`
  },
  {
    pattern: /^Tabs: (\d+)\/(\d+) connected \| Auto reconnect: off$/u,
    replace: (_match, connected, total) => `标签页：${connected}/${total} 已连接 | 自动重连：关闭`
  },
  {
    pattern: /^Run quick profile "(.+)" on "(.+)"\?\n\nCommand:\n(.+)$/u,
    replace: (_match, profile, session, command) =>
      `在“${session}”上运行快捷配置“${profile}”？\n\n命令：\n${command}`
  },
  {
    pattern: /^Quick profile "(.+)" saved\. Use "Run Quick Profile\.\.\." to execute on a session\.$/u,
    replace: (_match, name) => `快捷配置“${name}”已保存。可使用“运行快捷配置...”在会话上执行。`
  },
  {
    pattern: /^Choose quick profile for "(.+)"\.$/u,
    replace: (_match, session) => `为“${session}”选择快捷配置。`
  },
  {
    pattern: /^Profile "(.+)"$/u,
    replace: (_match, name) => `配置“${name}”`
  },
  {
    pattern: /^Delete quick profile "(.+)"\?$/u,
    replace: (_match, name) => `删除快捷配置“${name}”？`
  },
  {
    pattern: /^Snippet template references undefined parameter token\(s\): (.+)$/u,
    replace: (_match, keys) => `片段模板引用了未定义的参数令牌：${keys}`
  },
  {
    pattern: /^Run snippet "(.+)" on current tab\?$/u,
    replace: (_match, name) => `在当前标签页运行片段“${name}”？`
  },
  {
    pattern: /^Preview generated command for snippet "(.+)"\.$/u,
    replace: (_match, name) => `预览片段“${name}”生成的命令。`
  },
  {
    pattern: /^Imported (\d+) snippet group\(s\), (\d+) snippet\(s\)\.$/u,
    replace: (_match, groups, snippets) => `已导入 ${groups} 个片段分组、${snippets} 个片段。`
  },
  {
    pattern: /^Snippet groups exported:\n(.+)$/u,
    replace: (_match, path) => `片段分组已导出：\n${path}`
  },
  {
    pattern: /^Delete snippet group "(.+)" and all snippets in it\?$/u,
    replace: (_match, name) => `删除片段分组“${name}”及其中所有片段？`
  },
  {
    pattern: /^Delete snippet "(.+)" from "(.+)"\?$/u,
    replace: (_match, snippet, group) => `从“${group}”删除片段“${snippet}”？`
  },
  {
    pattern: /^Delete all snippet groups and snippets \((\d+) group\(s\), (\d+) snippet\(s\)\)\?$/u,
    replace: (_match, groups, snippets) => `删除全部片段分组和片段（${groups} 个分组，${snippets} 个片段）？`
  },
  {
    pattern: /^Clear (\d+) remembered scoped snippet value\(s\)\?$/u,
    replace: (_match, count) => `清除 ${count} 个已记住的片段作用域值？`
  },
  {
    pattern: /^Snippet groups are limited to (\d+)\.$/u,
    replace: (_match, count) => `片段分组最多 ${count} 个。`
  },
  {
    pattern: /^Snippets per group are limited to (\d+)\. Delete or export existing snippets first\.$/u,
    replace: (_match, count) => `每个分组最多 ${count} 个片段。请先删除或导出现有片段。`
  },
  {
    pattern: /^Prompt sets per group are limited to (\d+)\.$/u,
    replace: (_match, count) => `每个分组最多 ${count} 个提示集。`
  },
  {
    pattern: /^Snippet parameters are limited to (\d+)\.$/u,
    replace: (_match, count) => `片段参数最多 ${count} 个。`
  },
  {
    pattern: /^Prompt-set parameters are limited to (\d+)\.$/u,
    replace: (_match, count) => `提示集参数最多 ${count} 个。`
  },
  {
    pattern: /^Snippet parameter key "(.+)" already exists\.$/u,
    replace: (_match, key) => `片段参数键“${key}”已存在。`
  },
  {
    pattern: /^Prompt-set parameter key "(.+)" already exists\.$/u,
    replace: (_match, key) => `提示集参数键“${key}”已存在。`
  },
  {
    pattern: /^Stored packs (.+)$/u,
    replace: (_match, count) => `已保存策略包 ${count}`
  },
  {
    pattern: /^Sync file: (.+)$/u,
    replace: (_match, path) => `同步文件：${path}`
  },
  {
    pattern: /^Target group: (.+)\.$/u,
    replace: (_match, group) => `目标分组：${translateAppText("zh-CN", group)}。`
  },
  {
    pattern: /^Workspace profile: (.+) \| Safety sync (on|off)$/u,
    replace: (_match, profile, sync) =>
      `工作区配置：${translateAppText("zh-CN", profile)} | 安全同步 ${translateAppText("zh-CN", sync)}`
  },
  {
    pattern: /^Enabled sources (\d+)\/(\d+)$/u,
    replace: (_match, active, total) => `已启用来源 ${active}/${total}`
  },
  {
    pattern: /^(\d+) extra rule\(s\)$/u,
    replace: (_match, count) => `${count} 条额外规则`
  },
  {
    pattern: /^Recommended pack: (.+)$/u,
    replace: (_match, pack) => `推荐策略包：${translateAppText("zh-CN", pack)}`
  },
  {
    pattern: /^Workspace (.+) \| Active sources (\d+)\/(\d+) \| built-in rules (\d+)\/(\d+) \| policy pack (.+) \((\d+) extra\) \| environment (.+) \((\d+) extra\)$/u,
    replace: (_match, profile, activeSources, sourceTotal, activeRules, ruleTotal, pack, packExtra, environment, environmentExtra) =>
      `工作区 ${translateAppText("zh-CN", profile)} | 活动来源 ${activeSources}/${sourceTotal} | 内置规则 ${activeRules}/${ruleTotal} | 策略包 ${translateAppText("zh-CN", pack)}（${packExtra} 条额外规则） | 环境 ${translateAppText("zh-CN", environment)}（${environmentExtra} 条额外规则）`
  },
  {
    pattern: /^Source: (.+)$/u,
    replace: (_match, source) => `来源：${translateAppText("zh-CN", source)}`
  },
  {
    pattern: /^Saved overrides (\d+)\/(\d+)$/u,
    replace: (_match, count, total) => `已保存覆盖 ${count}/${total}`
  },
  {
    pattern: /^Policy pack: (.+) \| environment: (.+)$/u,
    replace: (_match, pack, environment) =>
      `策略包：${translateAppText("zh-CN", pack)} | 环境：${translateAppText("zh-CN", environment)}`
  },
  {
    pattern: /^Active temporary approvals (\d+)\/(\d+)$/u,
    replace: (_match, count, total) => `活动临时批准 ${count}/${total}`
  },
  {
    pattern: /^Saved persistent policies (\d+)\/(\d+)$/u,
    replace: (_match, count, total) => `已保存持久策略 ${count}/${total}`
  },
  {
    pattern: /^Stored bundles (\d+)\/(\d+)$/u,
    replace: (_match, count, total) => `已保存包 ${count}/${total}`
  },
  {
    pattern: /^Sync file: (.+)$/u,
    replace: (_match, path) => `同步文件：${translateAppText("zh-CN", path)}`
  },
  {
    pattern: /^Last pull: (.+) \| last push: (.+)$/u,
    replace: (_match, lastPull, lastPush) =>
      `上次拉取：${translateAppText("zh-CN", lastPull)} | 上次推送：${translateAppText("zh-CN", lastPush)}`
  },
  {
    pattern: /^Pack: (.+) \| environment: (.+)$/u,
    replace: (_match, pack, environment) =>
      `策略包：${translateAppText("zh-CN", pack)} | 环境：${translateAppText("zh-CN", environment)}`
  },
  {
    pattern: /^Scope: (.+) \| source: (.+)$/u,
    replace: (_match, scope, source) =>
      `作用域：${translateAppText("zh-CN", scope)} | 来源：${translateAppText("zh-CN", source)}`
  },
  {
    pattern: /^Approved (.+)$/u,
    replace: (_match, date) => `批准时间 ${date}`
  },
  {
    pattern: /^Saved (.+)$/u,
    replace: (_match, date) => `保存时间 ${date}`
  },
  {
    pattern: /^Sources (\d+)\/(\d+) \| group overrides (\d+) \| persistent policies (\d+) \| custom patterns (\d+)$/u,
    replace: (_match, sources, sourceTotal, overrides, policies, patterns) =>
      `来源 ${sources}/${sourceTotal} | 分组覆盖 ${overrides} | 持久策略 ${policies} | 自定义模式 ${patterns}`
  },
  {
    pattern: /^Updated (.+)$/u,
    replace: (_match, date) => `更新于 ${date}`
  },
  {
    pattern: /^Active custom patterns (\d+), invalid lines (\d+)\. Invalid lines are ignored\.$/u,
    replace: (_match, active, invalid) =>
      `活动自定义模式 ${active}，无效行 ${invalid}。无效行会被忽略。`
  },
  {
    pattern: /^Command history exported:\n(.+)$/u,
    replace: (_match, path) => `命令历史已导出：\n${path}`
  },
  {
    pattern: /^Command history exported\.\nPath copied to clipboard:\n(.+)$/u,
    replace: (_match, path) => `命令历史已导出。\n路径已复制到剪贴板：\n${path}`
  },
  {
    pattern: /^Imported (\d+) command\(s\) from:\n(.+)$/u,
    replace: (_match, count, path) => `已从以下位置导入 ${count} 条命令：\n${path}`
  },
  {
    pattern: /^Invalid JSON format\.\n([\s\S]+)$/u,
    replace: (_match, detail) => `JSON 格式无效。\n${detail}`
  },
  {
    pattern: /^No importable sessions found\.\n\n([\s\S]+)$/u,
    replace: (_match, warnings) => `没有找到可导入的会话。\n\n${warnings}`
  },
  {
    pattern: /^No importable Host entries were found\.\n\n([\s\S]+)$/u,
    replace: (_match, warnings) => `没有找到可导入的 Host 条目。\n\n${warnings}`
  },
  {
    pattern: /^File: (.+)$/u,
    replace: (_match, path) => `文件：${path}`
  },
  {
    pattern: /^Parsed hosts: (\d+)$/u,
    replace: (_match, count) => `解析到的主机：${count}`
  },
  {
    pattern: /^New sessions: (\d+)$/u,
    replace: (_match, count) => `新建会话：${count}`
  },
  {
    pattern: /^Duplicate targets: (\d+)$/u,
    replace: (_match, count) => `重复目标：${count}`
  },
  {
    pattern: /^Target group: (.+)$/u,
    replace: (_match, group) => `目标分组：${translateAppText("zh-CN", group)}`
  },
  {
    pattern: /^Duplicate strategy: (.+)$/u,
    replace: (_match, strategy) => `重复项策略：${translateAppText("zh-CN", strategy)}`
  },
  {
    pattern: /^\.\.\. (\d+) more host entries$/u,
    replace: (_match, count) => `... 还有 ${count} 个 Host 条目`
  },
  {
    pattern: /^Import (\d+) host entr(?:y|ies) from (.+)\?$/u,
    replace: (_match, count, fileName) => `要从 ${fileName} 导入 ${count} 个 Host 条目吗？`
  },
  {
    pattern: /^Importing (\d+) host entr(?:y|ies) from SSH config\.$/u,
    replace: (_match, count) => `正在从 SSH 配置导入 ${count} 个 Host 条目。`
  },
  {
    pattern: /^Import (\d+) session\(s\) from (.+)\?\nGroup strategy: (.+)\nDuplicate strategy: (.+)$/u,
    replace: (_match, count, fileName, groupStrategy, duplicateStrategy) =>
      `要从 ${fileName} 导入 ${count} 个会话吗？\n分组策略：${translateAppText("zh-CN", groupStrategy)}\n重复项策略：${translateAppText("zh-CN", duplicateStrategy)}`
  },
  {
    pattern: /^Importing (\d+) session(?:s)? from JSON\.$/u,
    replace: (_match, count) => `正在从 JSON 导入 ${count} 个会话。`
  },
  {
    pattern: /^Importable sessions: (\d+)$/u,
    replace: (_match, count) => `可导入会话：${count}`
  },
  {
    pattern: /^\.\.\. (\d+) more entries$/u,
    replace: (_match, count) => `... 还有 ${count} 条记录`
  },
  {
    pattern: /^Created (\d+), updated (\d+), skipped (\d+), failed (\d+), warnings (\d+)\.$/u,
    replace: (_match, created, updated, skipped, failed, warnings) =>
      `已创建 ${created}，已更新 ${updated}，已跳过 ${skipped}，失败 ${failed}，警告 ${warnings}。`
  },
  {
    pattern: /^Import completed\.\nCreated: (\d+)\nUpdated: (\d+)\nSkipped: (\d+)\nFailed: (\d+)\nWarnings: (\d+)$/u,
    replace: (_match, created, updated, skipped, failed, warnings) =>
      `导入完成。\n已创建：${created}\n已更新：${updated}\n已跳过：${skipped}\n失败：${failed}\n警告：${warnings}`
  },
  {
    pattern: /^Imported JSON: (.+)$/u,
    replace: (_match, path) => `已导入 JSON：${path}`
  },
  {
    pattern: /^Row (\d+): missing required field \(name\/host\/username\), skipped\.$/u,
    replace: (_match, row) => `第 ${row} 行缺少必填字段（name/host/username），已跳过。`
  },
  {
    pattern: /^Row (\d+): privateKey auth without key path; using password auth\.$/u,
    replace: (_match, row) => `第 ${row} 行是 privateKey 认证但没有私钥路径；已改用密码认证。`
  },
  {
    pattern: /^Encrypting (\d+) session(?:s)? for migration\.$/u,
    replace: (_match, count) => `正在为迁移加密 ${count} 个会话。`
  },
  {
    pattern: /^Encrypted (\d+) session(?:s)? with (\d+) password secret\(s\), (\d+) private-key passphrase\(s\), and (\d+) embedded private key file\(s\)\.$/u,
    replace: (_match, sessions, passwords, passphrases, keyFiles) =>
      `已加密 ${sessions} 个会话，包含 ${passwords} 个密码密钥、${passphrases} 个私钥口令，以及 ${keyFiles} 个嵌入式私钥文件。`
  },
  {
    pattern: /^Encrypted migration exported:\n(.+)$/u,
    replace: (_match, path) => `加密迁移包已导出：\n${path}`
  },
  {
    pattern: /^Encrypted migration exported\.\nPath copied to clipboard:\n(.+?)(?:\n\nWarnings:\n([\s\S]+))?$/u,
    replace: (_match, path, warnings = "") =>
      `加密迁移包已导出。\n路径已复制到剪贴板：\n${path}${warnings ? `\n\n警告：\n${warnings}` : ""}`
  },
  {
    pattern: /^App backup exported\.\nPath:\n(.+?)(?:\n\nWarnings:\n([\s\S]+))?$/u,
    replace: (_match, path, warnings = "") =>
      `应用备份已导出。\n路径：\n${path}${warnings ? `\n\n警告：\n${warnings}` : ""}`
  },
  {
    pattern: /^App backup restored\.\nCreated (\d+), updated (\d+), skipped (\d+), secrets (\d+)\.(?:\n\nWarnings:\n([\s\S]+))?$/u,
    replace: (_match, created, updated, skipped, secrets, warnings = "") =>
      `应用备份已恢复。\n已创建 ${created}，已更新 ${updated}，已跳过 ${skipped}，凭据 ${secrets}。${
        warnings ? `\n\n警告：\n${warnings}` : ""
      }`
  },
  {
    pattern: /^Apply backup\?\nSessions: (.+)\nCredentials: (restore|skip)\nDurable SQLite tables will be replaced\.$/u,
    replace: (_match, sessions, credentials) =>
      `应用备份？\n会话：${translateAppText("zh-CN", sessions)}\n凭据：${
        credentials === "restore" ? "恢复" : "跳过"
      }\n耐久 SQLite 表将被替换。`
  },
  {
    pattern: /^Decrypting (.+)\.$/u,
    replace: (_match, fileName) => `正在解密 ${fileName}。`
  },
  {
    pattern: /^Importable sessions: (\d+)$/u,
    replace: (_match, count) => `可导入会话：${count}`
  },
  {
    pattern: /^Encrypted passwords restored: (\d+)$/u,
    replace: (_match, count) => `已恢复加密密码：${count}`
  },
  {
    pattern: /^Private-key sessions: (\d+)$/u,
    replace: (_match, count) => `私钥会话：${count}`
  },
  {
    pattern: /^Private-key passphrases restored: (\d+)$/u,
    replace: (_match, count) => `已恢复私钥口令：${count}`
  },
  {
    pattern: /^Source app version: (.+)$/u,
    replace: (_match, version) => `来源应用版本：${version}`
  },
  {
    pattern: /^Exported at: (.+)$/u,
    replace: (_match, exportedAt) => `导出时间：${exportedAt}`
  },
  {
    pattern: /^Found (\d+) duplicate connection target\(s\)\. Choose duplicate strategy\.$/u,
    replace: (_match, count) => `发现 ${count} 个重复连接目标。请选择重复项策略。`
  },
  {
    pattern: /^Found (\d+) duplicate connection target\(s\)\. Choose how to handle duplicates\.$/u,
    replace: (_match, count) => `发现 ${count} 个重复连接目标。请选择重复项处理方式。`
  },
  {
    pattern: /^Import (\d+) session\(s\) from encrypted migration\?\nGroup strategy: (.+)\nDuplicate strategy: (.+)$/u,
    replace: (_match, count, groupStrategy, duplicateStrategy) =>
      `要从加密迁移包导入 ${count} 个会话吗？\n分组策略：${translateAppText("zh-CN", groupStrategy)}\n重复项策略：${translateAppText("zh-CN", duplicateStrategy)}`
  },
  {
    pattern: /^Created (\d+), updated (\d+), skipped (\d+), failed (\d+), restored secrets (\d+), warnings (\d+)\.$/u,
    replace: (_match, created, updated, skipped, failed, restoredSecrets, warnings) =>
      `已创建 ${created}，已更新 ${updated}，已跳过 ${skipped}，失败 ${failed}，已恢复密钥 ${restoredSecrets}，警告 ${warnings}。`
  },
  {
    pattern: /^Import completed\.\nCreated: (\d+)\nUpdated: (\d+)\nSkipped: (\d+)\nFailed: (\d+)\nRestored secrets: (\d+)\nWarnings: (\d+)$/u,
    replace: (_match, created, updated, skipped, failed, restoredSecrets, warnings) =>
      `导入完成。\n已创建：${created}\n已更新：${updated}\n已跳过：${skipped}\n失败：${failed}\n已恢复密钥：${restoredSecrets}\n警告：${warnings}`
  },
  {
    pattern: /^Imported encrypted migration: (.+)$/u,
    replace: (_match, path) => `已导入加密迁移包：${path}`
  },
  {
    pattern: /^key=(.+)$/u,
    replace: (_match, keyPath) => `私钥=${keyPath}`
  },
  {
    pattern: /^(.+): (.+)@(.+):(\d+) \[(.+)\] \((.+)\)$/u,
    replace: (_match, name, username, host, port, group, authLabel) =>
      `- ${name}: ${username}@${host}:${port} [${translateAppText("zh-CN", group)}] (${translateAppText("zh-CN", authLabel)})`
  },
  {
    pattern: /^- (.+): (.+)@(.+):(\d+) \((.+)\)$/u,
    replace: (_match, name, username, host, port, authLabel) =>
      `- ${name}: ${username}@${host}:${port} (${translateAppText("zh-CN", authLabel)})`
  },
  {
    pattern: /^key=(.+), passphrase restored$/u,
    replace: (_match, keyPath) => `私钥=${keyPath}，已恢复口令`
  },
  {
    pattern: /^password restored$/u,
    replace: () => "已恢复密码"
  },
  {
    pattern: /^password missing$/u,
    replace: () => "密码缺失"
  }
];

const LOCALIZED_TEXT_NODE_ORIGINALS = new WeakMap<Text, string>();
const LOCALIZED_ATTRIBUTE_ORIGINALS = new WeakMap<Element, Map<string, string>>();
const LOCALIZED_ATTRIBUTES = ["title", "aria-label", "placeholder"] as const;

function translateSimplifiedChineseText(value: string): string {
  const direct = SIMPLIFIED_CHINESE_TEXT[value];
  if (direct) {
    return direct;
  }
  const trimmed = value.trim();
  if (trimmed && trimmed !== value) {
    const trimmedTranslation = translateSimplifiedChineseText(trimmed);
    if (trimmedTranslation !== trimmed) {
      const leading = value.match(/^\s*/u)?.[0] ?? "";
      const trailing = value.match(/\s*$/u)?.[0] ?? "";
      return `${leading}${trimmedTranslation}${trailing}`;
    }
  }
  const compact = trimmed.replace(/\s+/gu, " ");
  if (compact && compact !== trimmed) {
    const compactTranslation = translateSimplifiedChineseText(compact);
    if (compactTranslation !== compact) {
      const leading = value.match(/^\s*/u)?.[0] ?? "";
      const trailing = value.match(/\s*$/u)?.[0] ?? "";
      return `${leading}${compactTranslation}${trailing}`;
    }
  }
  for (const replacement of SIMPLIFIED_CHINESE_REPLACEMENTS) {
    const match = value.match(replacement.pattern);
    if (match) {
      return replacement.replace(...match);
    }
  }
  return value;
}

export function translateAppText(language: AppLanguage, value: string): string {
  if (language !== "zh-CN") {
    return value;
  }
  return translateSimplifiedChineseText(value);
}

function shouldSkipLocalizationNode(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  if (!element) {
    return true;
  }
  return Boolean(
    element.closest(
      ".xterm, .terminal-pane__canvas, code, pre, script, style, textarea, .app-dialog__textarea--readonly"
    )
  );
}

function localizeTextNode(node: Text, language: AppLanguage): void {
  if (shouldSkipLocalizationNode(node)) {
    return;
  }
  const current = node.nodeValue ?? "";
  if (!current.trim()) {
    return;
  }
  const previousOriginal = LOCALIZED_TEXT_NODE_ORIGINALS.get(node);
  const previousLocalized = previousOriginal ? translateAppText("zh-CN", previousOriginal) : null;
  const original =
    previousOriginal && (current === previousOriginal || current === previousLocalized)
      ? previousOriginal
      : current;
  LOCALIZED_TEXT_NODE_ORIGINALS.set(node, original);
  const next = translateAppText(language, original);
  if (current !== next) {
    node.nodeValue = next;
  }
}

function localizeElementAttributes(element: Element, language: AppLanguage): void {
  if (shouldSkipLocalizationNode(element)) {
    return;
  }
  let originals = LOCALIZED_ATTRIBUTE_ORIGINALS.get(element);
  for (const attribute of LOCALIZED_ATTRIBUTES) {
    const current = element.getAttribute(attribute);
    if (!current || !current.trim()) {
      continue;
    }
    if (!originals) {
      originals = new Map<string, string>();
      LOCALIZED_ATTRIBUTE_ORIGINALS.set(element, originals);
    }
    const previousOriginal = originals.get(attribute);
    const previousLocalized = previousOriginal ? translateAppText("zh-CN", previousOriginal) : null;
    const original =
      previousOriginal && (current === previousOriginal || current === previousLocalized)
        ? previousOriginal
        : current;
    originals.set(attribute, original);
    const next = translateAppText(language, original);
    if (current !== next) {
      element.setAttribute(attribute, next);
    }
  }
}

export function localizeDomNode(root: Node | null, language: AppLanguage): void {
  if (!root) {
    return;
  }
  if (root.nodeType === Node.TEXT_NODE) {
    localizeTextNode(root as Text, language);
    return;
  }
  if (!(root instanceof Element)) {
    return;
  }
  localizeElementAttributes(root, language);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      localizeTextNode(node as Text, language);
    } else if (node instanceof Element) {
      localizeElementAttributes(node, language);
    }
    node = walker.nextNode();
  }
}

export function localizeDomTree(root: HTMLElement | null, language: AppLanguage): void {
  localizeDomNode(root, language);
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
      shellThemeTitle: "Shell Theme",
      shellThemeDescription:
        "Choose the workbench shell language. Accent color stays independent and retints either theme.",
      currentShellTheme: (themeLabel) => `Current shell theme: ${themeLabel}`,
      accentTitle: "Accent Color",
      accentDescription:
        "Shift the whole workbench tone—surfaces, borders, selections, and primary actions.",
      currentAccent: (accentLabel) => `Current accent: ${accentLabel}`,
      densityTitle: "Layout Density",
      densityDescription:
        "Compact packs side panels and lists tighter; Comfortable keeps roomier spacing.",
      currentDensity: (densityLabel) => `Current density: ${densityLabel}`,
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
    retryAllFailedAcrossTabsWithCount: (count) => `Retry All Failed (All Tabs ${count})`,
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
    cancelActiveDelete: "Cancel Delete",
    portForwardingOps: "Port Forwarding Ops",
    portForwardMeta: (activeTabCount, total, degraded) =>
      `tabs ${activeTabCount} | active forwards ${total} | degraded ${degraded}`,
    activeTabStatus: (status) => `active tab status: ${status}`,
    noRecentStatus: "No recent status message.",
    openPortFwd: "Open Port Fwd",
    openDiagnostics: "Open Diagnostics",
    openRetryCenter: "Open Retry Center",
    stopActiveTabPortForwards: "Stop Active Tab Forwards",
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
    cancelAppJob: "Cancel",
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
    retryTabTasks: "Retry Tab Tasks",
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
  },
  commandHistoryManager: {
    title: "Command History Manager",
    description: "Batch manage command records from current filter result.",
    summary: (visibleCount, selectedCount, totalCount) =>
      `Visible ${visibleCount} | Selected ${selectedCount} | Total ${totalCount}`,
    add: "Add",
    import: "Import",
    export: "Export",
    selectVisible: "Select Visible",
    unselectVisible: "Unselect Visible",
    clearSelection: "Clear Selection",
    empty: "No command history entries.",
    edit: "Edit",
    deleteSelected: (count) => `Delete Selected (${count})`,
    deleteVisible: (count) => `Delete Visible (${count})`,
    deleteAll: (count) => `Delete All (${count})`,
    done: "Done",
    entryTitle: (command, sourceLabel) =>
      `${command}\n\nSource: ${sourceLabel}\n\nDouble-click command text area to paste into active terminal.`
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
      shellThemeTitle: "壳层主题",
      shellThemeDescription: "选择工作台壳层风格。强调色保持独立，可在任意主题下换色。",
      currentShellTheme: (themeLabel) => `当前壳层主题：${themeLabel}`,
      accentTitle: "强调色",
      accentDescription: "切换整套工作台色调：面板、边框、选中态和主操作都会一起变。",
      currentAccent: (accentLabel) => `当前强调色：${accentLabel}`,
      densityTitle: "界面密度",
      densityDescription: "紧凑会尽可能压紧侧栏和列表；宽松则保留更大间距。",
      currentDensity: (densityLabel) => `当前密度：${densityLabel}`,
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
    retryAllFailedAcrossTabsWithCount: (count) => `重试所有失败项（全部标签页 ${count}）`,
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
    cancelActiveDelete: "取消删除",
    portForwardingOps: "端口转发操作",
    portForwardMeta: (activeTabCount, total, degraded) =>
      `标签页 ${activeTabCount} | 活动转发 ${total} | 异常 ${degraded}`,
    activeTabStatus: (status) => `当前标签页状态：${status}`,
    noRecentStatus: "没有最近的状态消息。",
    openPortFwd: "打开端口转发",
    openDiagnostics: "打开诊断",
    openRetryCenter: "打开重试中心",
    stopActiveTabPortForwards: "停止当前标签页转发",
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
    cancelAppJob: "取消",
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
    retryTabTasks: "重试标签页任务",
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
  },
  commandHistoryManager: {
    title: "命令历史管理",
    description: "批量管理当前筛选结果中的命令记录。",
    summary: (visibleCount, selectedCount, totalCount) =>
      `可见 ${visibleCount} | 已选 ${selectedCount} | 总计 ${totalCount}`,
    add: "添加",
    import: "导入",
    export: "导出",
    selectVisible: "选择可见项",
    unselectVisible: "取消选择可见项",
    clearSelection: "清除选择",
    empty: "没有命令历史记录。",
    edit: "编辑",
    deleteSelected: (count) => `删除已选（${count}）`,
    deleteVisible: (count) => `删除可见（${count}）`,
    deleteAll: (count) => `全部删除（${count}）`,
    done: "完成",
    entryTitle: (command, sourceLabel) =>
      `${command}\n\n来源：${sourceLabel}\n\n双击命令文本区域可粘贴到活动终端。`
  }
};

const APP_I18N: Record<AppLanguage, AppI18n> = {
  en: ENGLISH_I18N,
  "zh-CN": SIMPLIFIED_CHINESE_I18N
};

export function getI18n(language: AppLanguage): AppI18n {
  return APP_I18N[language];
}
