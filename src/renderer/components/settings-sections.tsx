import type {
  AppLanguage,
  AppLanguageOption,
  WorkspaceSettingsLabels
} from "../i18n";

export interface ConnectionSettingsSectionProps {
  autoReconnect: boolean;
  reconnectDelaySeconds: number;
  onAutoReconnectChange: (value: boolean) => void;
  onReconnectDelayChange: (value: string) => void;
}

interface WorkspaceProfileCardView {
  id: string;
  label: string;
  description: string;
  safetyDefaultLabel: string;
}

interface EditorFocusOptionView {
  id: string;
  label: string;
  description: string;
}

export interface WorkspaceSettingsSectionProps {
  labels: WorkspaceSettingsLabels;
  languageOptions: AppLanguageOption[];
  selectedLanguage: AppLanguage;
  selectedLanguageLabel: string;
  onLanguageSelect: (language: AppLanguage) => void;
  accentOptions: Array<{ id: string; label: string; description: string }>;
  selectedAccentId: string;
  selectedAccentLabel: string;
  onAccentSelect: (accentId: string) => void;
  densityOptions: Array<{ id: string; label: string; description: string }>;
  selectedDensityId: string;
  selectedDensityLabel: string;
  onDensitySelect: (densityId: string) => void;
  workspaceProfileCards: WorkspaceProfileCardView[];
  selectedWorkspaceProfileId: string;
  onWorkspaceProfileSelect: (profileId: string) => void;
  syncDangerousCommandSafety: boolean;
  onSyncDangerousCommandSafetyChange: (value: boolean) => void;
  selectedWorkspaceProfileLabel: string;
  editorFocusAutoLayoutEnabled: boolean;
  onEditorFocusAutoLayoutEnabledChange: (value: boolean) => void;
  themeOptions: EditorFocusOptionView[];
  selectedThemeId: string;
  onThemeSelect: (themeId: string) => void;
  typographyOptions: EditorFocusOptionView[];
  selectedTypographyId: string;
  onTypographySelect: (typographyId: string) => void;
  fontOptions: EditorFocusOptionView[];
  selectedFontId: string;
  onFontSelect: (fontId: string) => void;
  rhythmOptions: EditorFocusOptionView[];
  selectedRhythmId: string;
  onRhythmSelect: (rhythmId: string) => void;
  cursorOptions: EditorFocusOptionView[];
  selectedCursorId: string;
  onCursorSelect: (cursorId: string) => void;
  selectedThemeLabel: string;
  selectedTypographyLabel: string;
  selectedFontLabel: string;
  selectedRhythmLabel: string;
  selectedCursorLabel: string;
}

export interface FileOpeningSettingsSectionProps {
  preferredProgramPath: string;
  isMacPlatform: boolean;
  onPreferredProgramPathChange: (value: string) => void;
  onBrowseProgram: () => void;
}

interface SafetyExecutionSourceView {
  id: string;
  label: string;
  description: string;
  checked: boolean;
}

interface SafetyPolicyPackView {
  id: string;
  label: string;
  description: string;
  extraRuleCount: number;
  isActive: boolean;
}

interface SafetyEnvironmentTemplateView {
  id: string;
  label: string;
  description: string;
  recommendedPolicyPackLabel: string;
  extraRuleCount: number;
  isActive: boolean;
}

interface SafetySupplementalRuleView {
  id: string;
  label: string;
  description: string;
  severity: string;
  sourceLabel: string;
}

interface SafetyGroupAssignmentView {
  groupName: string;
  policyPackLabel: string;
  environmentTemplateLabel: string;
  isCurrentTarget: boolean;
}

interface SafetyApprovalView {
  id: string;
  title: string;
  severity: string;
  scopeLabel: string;
  sourceLabel: string;
  policyPackLabel: string;
  environmentTemplateLabel: string;
  createdAtLabel: string;
}

interface SafetyPolicyBundleView {
  id: string;
  name: string;
  description: string;
  policyPackLabel: string;
  environmentTemplateLabel: string;
  enabledSourceCount: number;
  totalSourceCount: number;
  groupOverrideCount: number;
  persistentPolicyCount: number;
  customPatternCount: number;
  updatedAtLabel: string;
}

interface SafetyBuiltinRuleView {
  id: string;
  label: string;
  description: string;
  severity: string;
  checked: boolean;
}

export interface SafetySettingsSectionProps {
  enabled: boolean;
  selectedWorkspaceProfileLabel: string;
  syncDangerousCommandSafety: boolean;
  enabledSourceCount: number;
  totalExecutionSourceCount: number;
  executionSourceViews: SafetyExecutionSourceView[];
  policyPackViews: SafetyPolicyPackView[];
  environmentTemplateViews: SafetyEnvironmentTemplateView[];
  selectedPolicyPackLabel: string;
  selectedPolicyPackExtraRuleCount: number;
  selectedEnvironmentTemplateLabel: string;
  selectedEnvironmentTemplateExtraRuleCount: number;
  supplementalRuleViews: SafetySupplementalRuleView[];
  targetGroupName: string | null;
  targetGroupHint: string;
  activeTargetGroupAssignmentName: string | null;
  savedGroupOverrideCount: number;
  maxGroupOverrideCount: number;
  groupAssignmentLimitReached: boolean;
  groupAssignmentViews: SafetyGroupAssignmentView[];
  temporaryApprovalViews: SafetyApprovalView[];
  maxTemporaryApprovalCount: number;
  persistentApprovalViews: SafetyApprovalView[];
  maxPersistentApprovalCount: number;
  policyBundleViews: SafetyPolicyBundleView[];
  storedPolicyBundleCount: number;
  maxPolicyBundleCount: number;
  policyBundleSyncFilePath: string | null;
  policyBundleLastPulledLabel: string | null;
  policyBundleLastPushedLabel: string | null;
  policyBundleSyncBusyAction: string | null;
  builtinRuleViews: SafetyBuiltinRuleView[];
  enabledBuiltinRuleCount: number;
  totalBuiltinRuleCount: number;
  customPatternsText: string;
  customPatternCount: number;
  customPatternInvalidLineCount: number;
  onGuardEnabledChange: (value: boolean) => void;
  onExecutionSourceEnabledChange: (sourceId: string, value: boolean) => void;
  onPolicyPackSelect: (packId: string) => void;
  onEnvironmentTemplateSelect: (templateId: string) => void;
  onSaveTargetGroupOverride: () => void;
  onDeleteTargetGroupOverride: () => void;
  onDeleteGroupAssignment: (groupName: string) => void;
  onClearTemporaryApprovals: () => void;
  onDeleteTemporaryApproval: (approvalId: string) => void;
  onClearPersistentApprovals: () => void;
  onDeletePersistentApproval: (approvalId: string) => void;
  onSaveCurrentPolicyBundle: () => void;
  onImportPolicyBundles: () => void;
  onExportPolicyBundles: () => void;
  onPullPolicyBundlesFromSync: () => void;
  onPushPolicyBundlesToSync: () => void;
  onChangePolicyBundleSyncTarget: () => void;
  onClearPolicyBundleSyncTarget: () => void;
  onApplyPolicyBundle: (bundleId: string) => void;
  onExportPolicyBundle: (bundleId: string) => void;
  onDeletePolicyBundle: (bundleId: string) => void;
  onBuiltinRuleEnabledChange: (ruleId: string, value: boolean) => void;
  onCustomPatternsTextChange: (value: string) => void;
  onResetSafetyRules: () => void;
}

interface HotkeyModifierOptionView {
  value: string;
  label: string;
}

interface HotkeySettingRowView {
  actionId: string;
  description: string;
  enabled: boolean;
  bindingLabel: string;
  isConflicting: boolean;
  isFocused: boolean;
  conflictBindingLabel: string;
  modifier: string;
  key: string;
}

interface HotkeyConflictView {
  signature: string;
  bindingLabel: string;
  actionSummary: string;
  isActive: boolean;
}

export interface HotkeySettingsSectionProps {
  hotkeyRows: HotkeySettingRowView[];
  hotkeyModifierOptions: HotkeyModifierOptionView[];
  hotkeyConflicts: HotkeyConflictView[];
  hotkeyConflictCursorIndex: number;
  hotkeyKeyPlaceholder: string;
  onBindingEnabledChange: (actionId: string, value: boolean) => void;
  onBindingModifierChange: (actionId: string, modifier: string) => void;
  onBindingKeyChange: (actionId: string, value: string) => void;
  onRegisterRowRef: (actionId: string, element: HTMLDivElement | null) => void;
  onFocusPreviousConflict: () => void;
  onFocusNextConflict: () => void;
  onFocusConflictAtIndex: (index: number) => void;
  onResolveConflicts: () => void;
  onImportHotkeys: () => void;
  onExportHotkeys: () => void;
  onResetHotkeys: () => void;
}

export interface ServerHealthSettingsSectionProps {
  enabled: boolean;
  cpuWarnPercent: number;
  memoryWarnPercent: number;
  diskWarnPercent: number;
  onEnabledChange: (value: boolean) => void;
  onThresholdChange: (
    key: "cpuWarnPercent" | "memoryWarnPercent" | "diskWarnPercent",
    value: string
  ) => void;
}

interface SftpScheduleDayView {
  value: number;
  label: string;
  checked: boolean;
}

interface SftpSchedulePresetView {
  id: string;
  label: string;
  description: string;
  summary: string;
  isActive: boolean;
}

interface SftpTransferPolicyPackView {
  id: string;
  name: string;
  summary: string;
  updatedAtLabel: string;
  description?: string;
}

export interface SftpSettingsSectionProps {
  uploadConcurrency: number;
  downloadConcurrency: number;
  maxConcurrency: number;
  uploadRateLimitKiBps: number;
  downloadRateLimitKiBps: number;
  maxRateLimitKiBps: number;
  scheduleWindowEnabled: boolean;
  scheduleWindowStartValue: string;
  scheduleWindowEndValue: string;
  scheduleDayOptions: SftpScheduleDayView[];
  schedulePresetViews: SftpSchedulePresetView[];
  retryBatchConfirmThreshold: number;
  minRetryBatchConfirmThreshold: number;
  maxRetryBatchConfirmThreshold: number;
  concurrencyHint: string;
  rateLimitHint: string;
  scheduleHint: string;
  retryThresholdHint: string;
  activeSessionConflictHint: string;
  canClearUploadDefault: boolean;
  canClearDownloadDefault: boolean;
  canClearAllDefaults: boolean;
  hasActiveSessionConflictControls: boolean;
  storedPolicyPackCount: number;
  maxPolicyPackCount: number;
  policyPackSyncFilePath: string;
  policyPackLastSyncLabel: string | null;
  policyPackAutoPullOnLaunch: boolean;
  policyPackAutoPushOnChange: boolean;
  policyPackSyncBusyAction: string | null;
  policyPackViews: SftpTransferPolicyPackView[];
  onUploadConcurrencyChange: (value: string) => void;
  onDownloadConcurrencyChange: (value: string) => void;
  onUploadRateLimitChange: (value: string) => void;
  onDownloadRateLimitChange: (value: string) => void;
  onScheduleWindowEnabledChange: (value: boolean) => void;
  onScheduleWindowStartChange: (value: string) => void;
  onScheduleWindowEndChange: (value: string) => void;
  onToggleScheduleDay: (day: number) => void;
  onApplySchedulePreset: (presetId: string) => void;
  onRetryBatchConfirmThresholdChange: (value: string) => void;
  onClearUploadDefault: () => void;
  onClearDownloadDefault: () => void;
  onClearAllDefaults: () => void;
  onPolicyPackAutoPullOnLaunchChange: (value: boolean) => void;
  onPolicyPackAutoPushOnChangeChange: (value: boolean) => void;
  onSaveCurrentPolicyPack: () => void;
  onImportPolicyPacks: () => void;
  onExportAllPolicyPacks: () => void;
  onPullPolicyPacksFromSync: () => void;
  onPushPolicyPacksToSync: () => void;
  onChangePolicyPackSyncTarget: () => void;
  onClearPolicyPackSyncTarget: () => void;
  onApplyPolicyPack: (packId: string) => void;
  onExportPolicyPack: (packId: string) => void;
  onDeletePolicyPack: (packId: string) => void;
}

interface PortForwardPresetView {
  id: string;
  name: string;
  summary: string;
  updatedAtLabel: string;
  autoRestore: boolean;
}

interface PortForwardRecordView {
  id: string;
  title: string;
  statusLabel: string;
  statusTone: "active" | "degraded";
  createdAtLabel: string;
  connectionsLabel: string;
  lastActivityLabel: string | null;
  lastErrorLabel: string | null;
}

interface PortForwardEventView {
  id: string;
  title: string;
  meta: string;
  correlation: string | null;
  message: string;
  isError: boolean;
}

interface PortForwardAnalyticsView {
  errorRatioLabel: string;
  errorsLabel: string;
  typeBreakdownPrimary: string;
  typeBreakdownSecondary: string;
  topErrorCodesLabel: string;
  topCorrelationsLabel: string;
}

export interface PortForwardingSettingsSectionProps {
  activeTabSummary: string;
  portForwardBusy: boolean;
  hasActiveTab: boolean;
  hasActiveSession: boolean;
  isActiveTabConnected: boolean;
  formType: string;
  formBindHost: string;
  formBindPort: string;
  formTargetHost: string;
  formTargetPort: string;
  presetViews: PortForwardPresetView[];
  portForwardStatusMessage: string | null;
  forwardViews: PortForwardRecordView[];
  eventFilter: string;
  eventTimeRange: string;
  eventErrorCode: string;
  eventErrorCodeOptions: string[];
  eventCorrelationQuery: string;
  hasCustomizedEventView: boolean;
  eventSummaryLabel: string;
  analyticsView: PortForwardAnalyticsView;
  eventViews: PortForwardEventView[];
  activeEventHistoryCount: number;
  visibleEventHistoryCount: number;
  onFormTypeChange: (value: string) => void;
  onFormBindHostChange: (value: string) => void;
  onFormBindPortChange: (value: string) => void;
  onFormTargetHostChange: (value: string) => void;
  onFormTargetPortChange: (value: string) => void;
  onRefresh: () => void;
  onSavePreset: () => void;
  onCreateForward: () => void;
  onPresetAutoRestoreChange: (presetId: string, value: boolean) => void;
  onPresetFillForm: (presetId: string) => void;
  onPresetApply: (presetId: string) => void;
  onPresetDelete: (presetId: string) => void;
  onRefreshDiagnostics: () => void;
  onExportSnapshot: () => void;
  onRemoveForward: (forwardId: string) => void;
  onEventFilterChange: (value: string) => void;
  onEventTimeRangeChange: (value: string) => void;
  onEventErrorCodeChange: (value: string) => void;
  onEventCorrelationQueryChange: (value: string) => void;
  onResetEventFilters: () => void;
  onExportVisibleJson: () => void;
  onExportVisibleCsv: () => void;
  onExportAnalyticsJson: () => void;
  onExportAnalyticsCsv: () => void;
  onClearVisibleHistory: () => void;
  onClearSessionHistory: () => void;
}

interface DiagnosticsReportView {
  id: string;
  title: string;
  metaLines: string[];
  recentFailuresLabel: string | null;
  canFocusTab: boolean;
}

export interface DiagnosticsSettingsSectionProps {
  appVersion: string;
  autoUpdateAvailability: "disabled" | "idle" | "checking" | "available" | "not-available" | "downloaded" | "error";
  autoUpdateDownloadedVersion: string | null;
  autoUpdateDownloadProgressPercent: number | null;
  autoUpdateLatestVersion: string | null;
  autoUpdateLastCheckedLabel: string | null;
  autoUpdateReadyToInstall: boolean;
  autoUpdateStatusLabel: string;
  logDirectoryPath: string;
  logFilePath: string;
  isExportingBugReport: boolean;
  isCheckingForUpdates: boolean;
  disconnectVisibleCount: number;
  disconnectTotalCount: number;
  disconnectCaptureEnabled: boolean;
  disconnectScope: string;
  disconnectTrigger: string;
  disconnectTimeRange: string;
  disconnectQuery: string;
  hasCustomizedDisconnectView: boolean;
  disconnectCaptureHint: string;
  disconnectReportViews: DiagnosticsReportView[];
  disconnectEmptyStateLabel: string;
  onRefreshLogInfo: () => void;
  onOpenLogDirectory: () => void;
  onCopyLogFilePath: () => void;
  onExportBugReport: () => void;
  onImportAppBackup: () => void;
  onExportAppBackup: () => void;
  onCheckForUpdates: () => void;
  onDisconnectCaptureEnabledChange: (value: boolean) => void;
  onDisconnectScopeChange: (value: string) => void;
  onDisconnectTriggerChange: (value: string) => void;
  onDisconnectTimeRangeChange: (value: string) => void;
  onDisconnectQueryChange: (value: string) => void;
  onResetDisconnectFilters: () => void;
  onExportDisconnectJson: () => void;
  onExportDisconnectCsv: () => void;
  onCopyLatestVisibleDisconnect: () => void;
  onClearVisibleDisconnects: () => void;
  onClearAllDisconnects: () => void;
  onCopyDisconnectReportJson: (reportId: string) => void;
  onFocusDisconnectTab: (reportId: string) => void;
}

export function ConnectionSettingsSection({
  autoReconnect,
  reconnectDelaySeconds,
  onAutoReconnectChange,
  onReconnectDelayChange
}: ConnectionSettingsSectionProps) {
  return (
    <>
      <label className="settings-checkbox">
        <input
          checked={autoReconnect}
          onChange={(event) => onAutoReconnectChange(event.target.checked)}
          type="checkbox"
        />
        <span>Auto reconnect disconnected tabs</span>
      </label>
      <label>
        Reconnect Delay (seconds)
        <input
          max={60}
          min={1}
          onChange={(event) => onReconnectDelayChange(event.target.value)}
          type="number"
          value={reconnectDelaySeconds}
        />
      </label>
      <p className="hint">Applies when a terminal tab closes unexpectedly. Delay range: 1-60 seconds.</p>
    </>
  );
}

export function WorkspaceSettingsSection({
  labels,
  languageOptions,
  selectedLanguage,
  selectedLanguageLabel,
  onLanguageSelect,
  accentOptions,
  selectedAccentId,
  selectedAccentLabel,
  onAccentSelect,
  densityOptions,
  selectedDensityId,
  selectedDensityLabel,
  onDensitySelect,
  workspaceProfileCards,
  selectedWorkspaceProfileId,
  onWorkspaceProfileSelect,
  syncDangerousCommandSafety,
  onSyncDangerousCommandSafetyChange,
  selectedWorkspaceProfileLabel,
  editorFocusAutoLayoutEnabled,
  onEditorFocusAutoLayoutEnabledChange,
  themeOptions,
  selectedThemeId,
  onThemeSelect,
  typographyOptions,
  selectedTypographyId,
  onTypographySelect,
  fontOptions,
  selectedFontId,
  onFontSelect,
  rhythmOptions,
  selectedRhythmId,
  onRhythmSelect,
  cursorOptions,
  selectedCursorId,
  onCursorSelect,
  selectedThemeLabel,
  selectedTypographyLabel,
  selectedFontLabel,
  selectedRhythmLabel,
  selectedCursorLabel
}: WorkspaceSettingsSectionProps) {
  return (
    <>
      <div className="settings-safety-preset-section">
        <div className="settings-safety-preset-header">
          <h4 className="settings-group__title">{labels.languageTitle}</h4>
          <p className="hint">{labels.languageDescription}</p>
        </div>
        <label>
          {labels.languageLabel}
          <select
            onChange={(event) => onLanguageSelect(event.target.value as AppLanguage)}
            value={selectedLanguage}
          >
            {languageOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">{labels.currentLanguage(selectedLanguageLabel)}</p>
      </div>
      <div className="settings-safety-preset-section">
        <div className="settings-safety-preset-header">
          <h4 className="settings-group__title">{labels.accentTitle}</h4>
          <p className="hint">{labels.accentDescription}</p>
        </div>
        <div className="settings-accent-grid">
          {accentOptions.map((option) => (
            <button
              className={
                option.id === selectedAccentId
                  ? "settings-accent-preset is-active"
                  : "settings-accent-preset"
              }
              key={option.id}
              onClick={() => onAccentSelect(option.id)}
              type="button"
            >
              <span className="settings-accent-preset__swatch" data-accent={option.id} />
              <span className="settings-accent-preset__title">{option.label}</span>
              <span className="hint settings-safety-preset__meta">{option.description}</span>
            </button>
          ))}
        </div>
        <p className="hint">{labels.currentAccent(selectedAccentLabel)}</p>
      </div>
      <div className="settings-safety-preset-section">
        <div className="settings-safety-preset-header">
          <h4 className="settings-group__title">{labels.densityTitle}</h4>
          <p className="hint">{labels.densityDescription}</p>
        </div>
        <div className="settings-safety-preset-grid">
          {densityOptions.map((option) => (
            <button
              className={
                option.id === selectedDensityId
                  ? "settings-safety-preset is-active"
                  : "settings-safety-preset"
              }
              key={option.id}
              onClick={() => onDensitySelect(option.id)}
              type="button"
            >
              <span className="settings-safety-preset__title">{option.label}</span>
              <span className="hint settings-safety-preset__meta">{option.description}</span>
            </button>
          ))}
        </div>
        <p className="hint">{labels.currentDensity(selectedDensityLabel)}</p>
      </div>
      <div className="settings-safety-preset-section">
        <div className="settings-safety-preset-header">
          <h4 className="settings-group__title">{labels.workspaceProfileTitle}</h4>
          <p className="hint">{labels.workspaceProfileDescription}</p>
        </div>
        <div className="settings-safety-preset-grid">
          {workspaceProfileCards.map((profile) => (
            <button
              className={
                profile.id === selectedWorkspaceProfileId
                  ? "settings-safety-preset is-active"
                  : "settings-safety-preset"
              }
              key={profile.id}
              onClick={() => onWorkspaceProfileSelect(profile.id)}
              type="button"
            >
              <span className="settings-safety-preset__title">{profile.label}</span>
              <span className="hint settings-safety-preset__meta">{profile.description}</span>
              <span className="settings-safety-preset__count">{profile.safetyDefaultLabel}</span>
            </button>
          ))}
        </div>
      </div>
      <label className="settings-checkbox">
        <input
          checked={syncDangerousCommandSafety}
          onChange={(event) => onSyncDangerousCommandSafetyChange(event.target.checked)}
          type="checkbox"
        />
        <span>{labels.syncSafetyLabel}</span>
      </label>
      <p className="hint">
        {labels.currentProfile(
          selectedWorkspaceProfileLabel,
          syncDangerousCommandSafety ? labels.syncOn : labels.syncOff
        )}
      </p>
      <p className="hint">{labels.syncDescription}</p>
      <div className="settings-safety-preset-section">
        <div className="settings-safety-preset-header">
          <h4 className="settings-group__title">{labels.terminalEditorFocusTitle}</h4>
          <p className="hint">{labels.terminalEditorFocusDescription}</p>
        </div>
      </div>
      <label className="settings-checkbox">
        <input
          checked={editorFocusAutoLayoutEnabled}
          onChange={(event) => onEditorFocusAutoLayoutEnabledChange(event.target.checked)}
          type="checkbox"
        />
        <span>{labels.autoFocusLabel}</span>
      </label>
      <SectionHeading
        description={labels.editorThemeDescription}
        title={labels.editorThemeTitle}
      />
      <PresetOptionGrid
        activeId={selectedThemeId}
        options={themeOptions}
        optionClassName="settings-safety-preset settings-terminal-theme-preset"
        previewClassName="settings-terminal-theme-preview"
        previewDataAttribute="data-editor-theme"
        previewValueKey="data-editor-theme"
        onSelect={onThemeSelect}
      />
      <SectionHeading
        description={labels.editorTypographyDescription}
        title={labels.editorTypographyTitle}
      />
      <PresetOptionGrid
        activeId={selectedTypographyId}
        options={typographyOptions}
        optionClassName="settings-safety-preset settings-terminal-typography-preset"
        previewClassName="settings-terminal-typography-preview"
        previewDataAttribute="data-editor-typography"
        previewValueKey="data-editor-typography"
        onSelect={onTypographySelect}
      />
      <SectionHeading
        description={labels.editorFontDescription}
        title={labels.editorFontTitle}
      />
      <PresetOptionGrid
        activeId={selectedFontId}
        options={fontOptions}
        optionClassName="settings-safety-preset settings-terminal-font-preset"
        previewClassName="settings-terminal-font-preview"
        previewDataAttribute="data-editor-font"
        previewValueKey="data-editor-font"
        previewTextRows={["sudo vim /etc/nginx/nginx.conf", "server_name example.internal;"]}
        onSelect={onFontSelect}
      />
      <SectionHeading
        description={labels.editorRhythmDescription}
        title={labels.editorRhythmTitle}
      />
      <PresetOptionGrid
        activeId={selectedRhythmId}
        options={rhythmOptions}
        optionClassName="settings-safety-preset settings-terminal-rhythm-preset"
        previewClassName="settings-terminal-rhythm-preview"
        previewDataAttribute="data-editor-rhythm"
        previewValueKey="data-editor-rhythm"
        previewTextRows={["sudo systemctl restart nginx", "server_name example.internal;"]}
        onSelect={onRhythmSelect}
      />
      <SectionHeading
        description={labels.editorCursorDescription}
        title={labels.editorCursorTitle}
      />
      <PresetOptionGrid
        activeId={selectedCursorId}
        options={cursorOptions}
        optionClassName="settings-safety-preset settings-terminal-cursor-preset"
        previewClassName="settings-terminal-cursor-preview"
        previewDataAttribute="data-editor-cursor"
        previewValueKey="data-editor-cursor"
        previewSpanCount={1}
        onSelect={onCursorSelect}
      />
      <p className="hint">
        {labels.currentEditorFocus(
          editorFocusAutoLayoutEnabled ? labels.enabled : labels.disabled,
          selectedThemeLabel,
          selectedTypographyLabel,
          selectedFontLabel,
          selectedRhythmLabel,
          selectedCursorLabel
        )}
      </p>
    </>
  );
}

export function SafetySettingsSection({
  enabled,
  selectedWorkspaceProfileLabel,
  syncDangerousCommandSafety,
  enabledSourceCount,
  totalExecutionSourceCount,
  executionSourceViews,
  policyPackViews,
  environmentTemplateViews,
  selectedPolicyPackLabel,
  selectedPolicyPackExtraRuleCount,
  selectedEnvironmentTemplateLabel,
  selectedEnvironmentTemplateExtraRuleCount,
  supplementalRuleViews,
  targetGroupName,
  targetGroupHint,
  activeTargetGroupAssignmentName,
  savedGroupOverrideCount,
  maxGroupOverrideCount,
  groupAssignmentLimitReached,
  groupAssignmentViews,
  temporaryApprovalViews,
  maxTemporaryApprovalCount,
  persistentApprovalViews,
  maxPersistentApprovalCount,
  policyBundleViews,
  storedPolicyBundleCount,
  maxPolicyBundleCount,
  policyBundleSyncFilePath,
  policyBundleLastPulledLabel,
  policyBundleLastPushedLabel,
  policyBundleSyncBusyAction,
  builtinRuleViews,
  enabledBuiltinRuleCount,
  totalBuiltinRuleCount,
  customPatternsText,
  customPatternCount,
  customPatternInvalidLineCount,
  onGuardEnabledChange,
  onExecutionSourceEnabledChange,
  onPolicyPackSelect,
  onEnvironmentTemplateSelect,
  onSaveTargetGroupOverride,
  onDeleteTargetGroupOverride,
  onDeleteGroupAssignment,
  onClearTemporaryApprovals,
  onDeleteTemporaryApproval,
  onClearPersistentApprovals,
  onDeletePersistentApproval,
  onSaveCurrentPolicyBundle,
  onImportPolicyBundles,
  onExportPolicyBundles,
  onPullPolicyBundlesFromSync,
  onPushPolicyBundlesToSync,
  onChangePolicyBundleSyncTarget,
  onClearPolicyBundleSyncTarget,
  onApplyPolicyBundle,
  onExportPolicyBundle,
  onDeletePolicyBundle,
  onBuiltinRuleEnabledChange,
  onCustomPatternsTextChange,
  onResetSafetyRules
}: SafetySettingsSectionProps) {
  const policySelectionDisabled = !enabled || syncDangerousCommandSafety;
  return (
    <>
      <label className="settings-checkbox">
        <input
          checked={enabled}
          onChange={(event) => onGuardEnabledChange(event.target.checked)}
          type="checkbox"
        />
        <span>Enable dangerous command guardrails before terminal execution</span>
      </label>
      <p className="hint">
        Uses the fixed bottom approval bar. Covers keyboard Enter, multiline paste, command
        history run, snippets, quick profiles, and startup commands.
      </p>
      <p className="hint">
        Workspace profile: {selectedWorkspaceProfileLabel}
        {" | "}Safety sync {syncDangerousCommandSafety ? "on" : "off"}
      </p>

      <div className="settings-safety-preset-section">
        <div className="settings-safety-preset-header">
          <h4 className="settings-group__title">Execution Sources</h4>
          <p className="hint">
            Enable or disable guard inspection per execution path. Paste-style sources still only
            inspect multiline writes, while keyboard inspection still triggers when Enter submits
            the buffered command.
          </p>
        </div>
        <p className="hint">
          Enabled sources {enabledSourceCount}/{totalExecutionSourceCount}
        </p>
        <div className="settings-safety-rules">
          {executionSourceViews.map((source) => (
            <label className="settings-checkbox settings-safety-rule" key={source.id}>
              <input
                checked={source.checked}
                disabled={!enabled}
                onChange={(event) =>
                  onExecutionSourceEnabledChange(source.id, event.target.checked)
                }
                type="checkbox"
              />
              <span className="settings-safety-rule__content">
                <span className="settings-safety-rule__title">{source.label}</span>
                <span className="hint settings-safety-rule__meta">{source.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="settings-safety-preset-section">
        <div className="settings-safety-preset-header">
          <h4 className="settings-group__title">Policy Pack</h4>
          <p className="hint">
            Adds curated workflow-specific guardrails on top of the built-in system rules without
            replacing your custom patterns.
            {syncDangerousCommandSafety
              ? " Workspace-profile sync is on, so this global selection follows the current workspace profile."
              : ""}
          </p>
        </div>
        <div className="settings-safety-preset-grid">
          {policyPackViews.map((pack) => (
            <button
              className={
                pack.isActive
                  ? "settings-safety-preset is-active"
                  : "settings-safety-preset"
              }
              disabled={policySelectionDisabled}
              key={pack.id}
              onClick={() => onPolicyPackSelect(pack.id)}
              type="button"
            >
              <span className="settings-safety-preset__title">{pack.label}</span>
              <span className="hint settings-safety-preset__meta">{pack.description}</span>
              <span className="settings-safety-preset__count">
                {pack.extraRuleCount} extra rule(s)
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-safety-preset-section">
        <div className="settings-safety-preset-header">
          <h4 className="settings-group__title">Environment Template</h4>
          <p className="hint">
            Selecting a template also snaps the policy pack to the recommended baseline for that
            environment. Custom patterns stay untouched.
            {syncDangerousCommandSafety
              ? " Workspace-profile sync is on, so this global selection follows the current workspace profile."
              : ""}
          </p>
        </div>
        <div className="settings-safety-preset-grid">
          {environmentTemplateViews.map((template) => (
            <button
              className={
                template.isActive
                  ? "settings-safety-preset is-active"
                  : "settings-safety-preset"
              }
              disabled={policySelectionDisabled}
              key={template.id}
              onClick={() => onEnvironmentTemplateSelect(template.id)}
              type="button"
            >
              <span className="settings-safety-preset__title">{template.label}</span>
              <span className="hint settings-safety-preset__meta">{template.description}</span>
              <span className="settings-safety-preset__count">
                Recommended pack: {template.recommendedPolicyPackLabel}
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="hint">
        Workspace {selectedWorkspaceProfileLabel}
        {" | "}Active sources {enabledSourceCount}/{totalExecutionSourceCount}
        {" | "}built-in rules {enabledBuiltinRuleCount}/{totalBuiltinRuleCount}
        {" | "}policy pack {selectedPolicyPackLabel} ({selectedPolicyPackExtraRuleCount} extra)
        {" | "}environment {selectedEnvironmentTemplateLabel} (
        {selectedEnvironmentTemplateExtraRuleCount} extra)
      </p>
      {supplementalRuleViews.length > 0 ? (
        <div className="settings-safety-rules settings-safety-rules--supplemental">
          {supplementalRuleViews.map((rule) => (
            <div className="settings-safety-rule settings-safety-rule--readonly" key={rule.id}>
              <span className="settings-safety-rule__content">
                <span className="settings-safety-rule__title">
                  {rule.label}
                  <span
                    className={
                      rule.severity === "critical"
                        ? "settings-safety-rule__badge is-critical"
                        : "settings-safety-rule__badge"
                    }
                  >
                    {rule.severity}
                  </span>
                </span>
                <span className="hint settings-safety-rule__meta">{rule.description}</span>
                <span className="hint settings-safety-rule__meta">
                  Source: {rule.sourceLabel}
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="hint">No extra policy-pack or environment-template rules are active right now.</p>
      )}

      <div className="settings-safety-preset-section">
        <div className="settings-safety-preset-header">
          <h4 className="settings-group__title">Session Group Overrides</h4>
          <p className="hint">
            Save pack/template combinations per session group. When a terminal tab belongs to a
            saved group, that override replaces the global pack/template for inspection on that tab
            only.
          </p>
        </div>
        <p className="hint">
          Target group: {targetGroupName ?? "None"}. {targetGroupHint}
        </p>
        <p className="hint">
          Saved overrides {savedGroupOverrideCount}/{maxGroupOverrideCount}
        </p>
        <div className="modal__actions">
          <button
            className="secondary-button"
            disabled={!enabled || !targetGroupName || groupAssignmentLimitReached}
            onClick={onSaveTargetGroupOverride}
            type="button"
          >
            {activeTargetGroupAssignmentName
              ? "Update Target Group Override"
              : "Save Current Pack For Target Group"}
          </button>
          {activeTargetGroupAssignmentName ? (
            <button
              className="secondary-button"
              disabled={!enabled}
              onClick={onDeleteTargetGroupOverride}
              type="button"
            >
              Remove Target Group Override
            </button>
          ) : null}
        </div>
        {groupAssignmentLimitReached ? (
          <p className="hint">
            Override limit reached. Remove an existing group override before adding a new one.
          </p>
        ) : null}
        {groupAssignmentViews.length > 0 ? (
          <div className="settings-safety-rules settings-safety-rules--supplemental">
            {groupAssignmentViews.map((assignment) => (
              <div
                className="settings-safety-rule settings-safety-rule--readonly"
                key={assignment.groupName}
              >
                <span className="settings-safety-rule__content">
                  <span className="settings-safety-rule__title">{assignment.groupName}</span>
                  <span className="hint settings-safety-rule__meta">
                    Policy pack: {assignment.policyPackLabel}
                    {" | "}environment: {assignment.environmentTemplateLabel}
                  </span>
                  {assignment.isCurrentTarget ? (
                    <span className="hint settings-safety-rule__meta">
                      Current settings target group
                    </span>
                  ) : null}
                </span>
                <div className="settings-safety-rule__actions">
                  <button
                    className="secondary-button secondary-button--small"
                    disabled={!enabled}
                    onClick={() => onDeleteGroupAssignment(assignment.groupName)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="hint">
            No session-group overrides saved yet. Ungrouped sessions keep using the global
            pack/template selection.
          </p>
        )}
      </div>

      <div className="settings-safety-preset-section">
        <div className="settings-safety-preset-header">
          <h4 className="settings-group__title">Temporary Approval Scopes</h4>
          <p className="hint">
            Runtime-only exact-command approvals created from the bottom approval bar. `Allow In
            Tab` is removed when that tab closes. `Allow In Group` stays active until Safety
            settings change, the app restarts, or you clear it here.
          </p>
        </div>
        <p className="hint">
          Active temporary approvals {temporaryApprovalViews.length}/{maxTemporaryApprovalCount}
        </p>
        <div className="modal__actions">
          <button
            className="secondary-button"
            disabled={temporaryApprovalViews.length === 0}
            onClick={onClearTemporaryApprovals}
            type="button"
          >
            Clear All Temporary Approvals
          </button>
        </div>
        {temporaryApprovalViews.length > 0 ? (
          <div className="settings-safety-rules settings-safety-rules--supplemental">
            {temporaryApprovalViews.map((approval) => (
              <div className="settings-safety-rule settings-safety-rule--readonly" key={approval.id}>
                <span className="settings-safety-rule__content">
                  <span className="settings-safety-rule__title">
                    {approval.title}
                    <span
                      className={
                        approval.severity === "critical"
                          ? "settings-safety-rule__badge is-critical"
                          : "settings-safety-rule__badge"
                      }
                    >
                      {approval.severity}
                    </span>
                  </span>
                  <span className="hint settings-safety-rule__meta">
                    Scope: {approval.scopeLabel}
                    {" | "}source: {approval.sourceLabel}
                  </span>
                  <span className="hint settings-safety-rule__meta">
                    Pack: {approval.policyPackLabel}
                    {" | "}environment: {approval.environmentTemplateLabel}
                  </span>
                  <span className="hint settings-safety-rule__meta">
                    Approved {approval.createdAtLabel}
                  </span>
                </span>
                <div className="settings-safety-rule__actions">
                  <button
                    className="secondary-button secondary-button--small"
                    onClick={() => onDeleteTemporaryApproval(approval.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="hint">No temporary approval scopes are active right now.</p>
        )}
      </div>

      <div className="settings-safety-preset-section">
        <div className="settings-safety-preset-header">
          <h4 className="settings-group__title">Persistent Approval Policies</h4>
          <p className="hint">
            Saved exact-command allow rules from the bottom approval bar. These stay active across
            app restart and travel with Safety bundles. Matching still requires the same command
            text, execution source, policy pack, and environment template.
          </p>
        </div>
        <p className="hint">
          Saved persistent policies {persistentApprovalViews.length}/{maxPersistentApprovalCount}
        </p>
        <div className="modal__actions">
          <button
            className="secondary-button"
            disabled={persistentApprovalViews.length === 0}
            onClick={onClearPersistentApprovals}
            type="button"
          >
            Clear All Persistent Policies
          </button>
        </div>
        {persistentApprovalViews.length > 0 ? (
          <div className="settings-safety-rules settings-safety-rules--supplemental">
            {persistentApprovalViews.map((approval) => (
              <div className="settings-safety-rule settings-safety-rule--readonly" key={approval.id}>
                <span className="settings-safety-rule__content">
                  <span className="settings-safety-rule__title">
                    {approval.title}
                    <span
                      className={
                        approval.severity === "critical"
                          ? "settings-safety-rule__badge is-critical"
                          : "settings-safety-rule__badge"
                      }
                    >
                      {approval.severity}
                    </span>
                  </span>
                  <span className="hint settings-safety-rule__meta">
                    Scope: {approval.scopeLabel}
                    {" | "}source: {approval.sourceLabel}
                  </span>
                  <span className="hint settings-safety-rule__meta">
                    Pack: {approval.policyPackLabel}
                    {" | "}environment: {approval.environmentTemplateLabel}
                  </span>
                  <span className="hint settings-safety-rule__meta">
                    Saved {approval.createdAtLabel}
                  </span>
                </span>
                <div className="settings-safety-rule__actions">
                  <button
                    className="secondary-button secondary-button--small"
                    onClick={() => onDeletePersistentApproval(approval.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="hint">No persistent approval policies saved yet.</p>
        )}
      </div>

      <div className="settings-safety-preset-section">
        <div className="settings-safety-preset-header">
          <h4 className="settings-group__title">Shared Policy Bundles</h4>
          <p className="hint">
            Save the current Safety settings as reusable JSON bundles, then import, export, apply,
            or sync them across machines and teammates through a shared JSON file. This baseline is
            manual push/pull only; auto-watch and permission-aware distribution are still out of
            scope.
          </p>
        </div>
        <p className="hint">
          Stored bundles {storedPolicyBundleCount}/{maxPolicyBundleCount}
        </p>
        <p className="hint">
          Sync file:{" "}
          {policyBundleSyncFilePath ? <code>{policyBundleSyncFilePath}</code> : "Not linked yet."}
        </p>
        {policyBundleLastPulledLabel || policyBundleLastPushedLabel ? (
          <p className="hint">
            Last pull: {policyBundleLastPulledLabel ?? "never"}
            {" | "}last push: {policyBundleLastPushedLabel ?? "never"}
          </p>
        ) : null}
        <div className="modal__actions">
          <button
            className="secondary-button"
            disabled={policyBundleSyncBusyAction !== null}
            onClick={onSaveCurrentPolicyBundle}
            type="button"
          >
            Save Current As Bundle
          </button>
          <button
            className="secondary-button"
            disabled={policyBundleSyncBusyAction !== null}
            onClick={onImportPolicyBundles}
            type="button"
          >
            Import Bundles...
          </button>
          <button
            className="secondary-button"
            disabled={storedPolicyBundleCount === 0 || policyBundleSyncBusyAction !== null}
            onClick={onExportPolicyBundles}
            type="button"
          >
            Export All Bundles...
          </button>
          <button
            className="secondary-button"
            disabled={policyBundleSyncBusyAction !== null}
            onClick={onPullPolicyBundlesFromSync}
            type="button"
          >
            {policyBundleSyncBusyAction === "pull"
              ? "Pulling..."
              : policyBundleSyncFilePath
                ? "Pull Sync"
                : "Pull Sync..."}
          </button>
          <button
            className="secondary-button"
            disabled={policyBundleSyncBusyAction !== null}
            onClick={onPushPolicyBundlesToSync}
            type="button"
          >
            {policyBundleSyncBusyAction === "push"
              ? "Pushing..."
              : policyBundleSyncFilePath
                ? "Push Sync"
                : "Push Sync..."}
          </button>
          <button
            className="secondary-button"
            disabled={policyBundleSyncBusyAction !== null}
            onClick={onChangePolicyBundleSyncTarget}
            type="button"
          >
            {policyBundleSyncBusyAction === "change"
              ? "Choosing..."
              : policyBundleSyncFilePath
                ? "Change Sync File..."
                : "Choose Sync File..."}
          </button>
          <button
            className="secondary-button"
            disabled={!policyBundleSyncFilePath || policyBundleSyncBusyAction !== null}
            onClick={onClearPolicyBundleSyncTarget}
            type="button"
          >
            Clear Sync File
          </button>
        </div>
        {policyBundleViews.length > 0 ? (
          <div className="settings-safety-rules settings-safety-rules--supplemental">
            {policyBundleViews.map((bundle) => (
              <div className="settings-safety-rule settings-safety-rule--readonly" key={bundle.id}>
                <span className="settings-safety-rule__content">
                  <span className="settings-safety-rule__title">{bundle.name}</span>
                  <span className="hint settings-safety-rule__meta">
                    {bundle.description || "No description."}
                  </span>
                  <span className="hint settings-safety-rule__meta">
                    Pack: {bundle.policyPackLabel}
                    {" | "}environment: {bundle.environmentTemplateLabel}
                  </span>
                  <span className="hint settings-safety-rule__meta">
                    Sources {bundle.enabledSourceCount}/{bundle.totalSourceCount}
                    {" | "}group overrides {bundle.groupOverrideCount}
                    {" | "}persistent policies {bundle.persistentPolicyCount}
                    {" | "}custom patterns {bundle.customPatternCount}
                  </span>
                  <span className="hint settings-safety-rule__meta">
                    Updated {bundle.updatedAtLabel}
                  </span>
                </span>
                <div className="settings-safety-rule__actions">
                  <button
                    className="secondary-button secondary-button--small"
                    onClick={() => onApplyPolicyBundle(bundle.id)}
                    type="button"
                  >
                    Apply
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    onClick={() => onExportPolicyBundle(bundle.id)}
                    type="button"
                  >
                    Export
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    onClick={() => onDeletePolicyBundle(bundle.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="hint">
            No shared safety bundles saved yet. Save the current Safety configuration to create
            your first reusable bundle.
          </p>
        )}
      </div>

      <div className="settings-safety-rules">
        {builtinRuleViews.map((rule) => (
          <label className="settings-checkbox settings-safety-rule" key={rule.id}>
            <input
              checked={rule.checked}
              disabled={!enabled}
              onChange={(event) => onBuiltinRuleEnabledChange(rule.id, event.target.checked)}
              type="checkbox"
            />
            <span className="settings-safety-rule__content">
              <span className="settings-safety-rule__title">
                {rule.label}
                <span
                  className={
                    rule.severity === "critical"
                      ? "settings-safety-rule__badge is-critical"
                      : "settings-safety-rule__badge"
                  }
                >
                  {rule.severity}
                </span>
              </span>
              <span className="hint settings-safety-rule__meta">{rule.description}</span>
            </span>
          </label>
        ))}
      </div>

      <label>
        Custom Patterns
        <textarea
          className="settings-safety__textarea"
          disabled={!enabled}
          onChange={(event) => onCustomPatternsTextChange(event.target.value)}
          placeholder={"One pattern per line\nPlain text or /regex/flags"}
          rows={5}
          value={customPatternsText}
        />
      </label>
      <p className="hint">
        Active custom patterns {customPatternCount}, invalid lines {customPatternInvalidLineCount}.
        Invalid lines are ignored.
      </p>
      <div className="modal__actions">
        <button className="secondary-button" onClick={onResetSafetyRules} type="button">
          Reset Safety Rules
        </button>
      </div>
    </>
  );
}

export function FileOpeningSettingsSection({
  preferredProgramPath,
  isMacPlatform,
  onPreferredProgramPathChange,
  onBrowseProgram
}: FileOpeningSettingsSectionProps) {
  return (
    <>
      <label>
        Open Program or Command (optional)
        <div className="field-row">
          <input
            onChange={(event) => onPreferredProgramPathChange(event.target.value)}
            placeholder={isMacPlatform ? "/Applications/TextEdit.app" : "code --reuse-window"}
            value={preferredProgramPath}
          />
          <button className="field-row__action" onClick={onBrowseProgram} type="button">
            Browse
          </button>
        </div>
      </label>
      <p className="hint">
        Leave empty to use system default app. Used by SFTP "Open File" and file double-click.
      </p>
      <p className="hint">
        Windows accepts either a program path or a command like <code>code</code>, <code>cursor</code>,
        or <code>"C:\\Program Files\\Microsoft VS Code\\Code.exe" --reuse-window</code>.
      </p>
    </>
  );
}

export function SftpSettingsSection({
  uploadConcurrency,
  downloadConcurrency,
  maxConcurrency,
  uploadRateLimitKiBps,
  downloadRateLimitKiBps,
  maxRateLimitKiBps,
  scheduleWindowEnabled,
  scheduleWindowStartValue,
  scheduleWindowEndValue,
  scheduleDayOptions,
  schedulePresetViews,
  retryBatchConfirmThreshold,
  minRetryBatchConfirmThreshold,
  maxRetryBatchConfirmThreshold,
  concurrencyHint,
  rateLimitHint,
  scheduleHint,
  retryThresholdHint,
  activeSessionConflictHint,
  canClearUploadDefault,
  canClearDownloadDefault,
  canClearAllDefaults,
  hasActiveSessionConflictControls,
  storedPolicyPackCount,
  maxPolicyPackCount,
  policyPackSyncFilePath,
  policyPackLastSyncLabel,
  policyPackAutoPullOnLaunch,
  policyPackAutoPushOnChange,
  policyPackSyncBusyAction,
  policyPackViews,
  onUploadConcurrencyChange,
  onDownloadConcurrencyChange,
  onUploadRateLimitChange,
  onDownloadRateLimitChange,
  onScheduleWindowEnabledChange,
  onScheduleWindowStartChange,
  onScheduleWindowEndChange,
  onToggleScheduleDay,
  onApplySchedulePreset,
  onRetryBatchConfirmThresholdChange,
  onClearUploadDefault,
  onClearDownloadDefault,
  onClearAllDefaults,
  onPolicyPackAutoPullOnLaunchChange,
  onPolicyPackAutoPushOnChangeChange,
  onSaveCurrentPolicyPack,
  onImportPolicyPacks,
  onExportAllPolicyPacks,
  onPullPolicyPacksFromSync,
  onPushPolicyPacksToSync,
  onChangePolicyPackSyncTarget,
  onClearPolicyPackSyncTarget,
  onApplyPolicyPack,
  onExportPolicyPack,
  onDeletePolicyPack
}: SftpSettingsSectionProps) {
  return (
    <>
      <label>
        Upload Threads
        <input
          max={maxConcurrency}
          min={1}
          onChange={(event) => onUploadConcurrencyChange(event.target.value)}
          type="number"
          value={uploadConcurrency}
        />
      </label>
      <label>
        Download Threads
        <input
          max={maxConcurrency}
          min={1}
          onChange={(event) => onDownloadConcurrencyChange(event.target.value)}
          type="number"
          value={downloadConcurrency}
        />
      </label>
      <div className="field-grid settings-sftp-rate-grid">
        <label>
          Upload Limit (KiB/s)
          <input
            max={maxRateLimitKiBps}
            min={0}
            onChange={(event) => onUploadRateLimitChange(event.target.value)}
            type="number"
            value={uploadRateLimitKiBps}
          />
        </label>
        <label>
          Download Limit (KiB/s)
          <input
            max={maxRateLimitKiBps}
            min={0}
            onChange={(event) => onDownloadRateLimitChange(event.target.value)}
            type="number"
            value={downloadRateLimitKiBps}
          />
        </label>
      </div>
      <label className="settings-checkbox settings-checkbox--inline">
        <input
          checked={scheduleWindowEnabled}
          onChange={(event) => onScheduleWindowEnabledChange(event.target.checked)}
          type="checkbox"
        />
        Restrict queued transfers to a schedule window
      </label>
      <div className="field-grid settings-sftp-schedule-grid">
        <label>
          Window Start
          <input
            disabled={!scheduleWindowEnabled}
            onChange={(event) => onScheduleWindowStartChange(event.target.value)}
            step={60}
            type="time"
            value={scheduleWindowStartValue}
          />
        </label>
        <label>
          Window End
          <input
            disabled={!scheduleWindowEnabled}
            onChange={(event) => onScheduleWindowEndChange(event.target.value)}
            step={60}
            type="time"
            value={scheduleWindowEndValue}
          />
        </label>
      </div>
      <div className="settings-sftp-schedule-days">
        {scheduleDayOptions.map((dayOption) => (
          <label className="settings-checkbox settings-checkbox--inline" key={dayOption.value}>
            <input
              checked={dayOption.checked}
              onChange={() => onToggleScheduleDay(dayOption.value)}
              type="checkbox"
            />
            {dayOption.label}
          </label>
        ))}
      </div>
      <div className="settings-safety-preset-section">
        <div className="settings-safety-preset-header">
          <h4 className="settings-group__title">Schedule Presets</h4>
          <p className="hint">
            Apply a ready-made weekday/time template, then fine-tune the exact window if needed.
          </p>
        </div>
        <div className="settings-safety-preset-grid">
          {schedulePresetViews.map((preset) => (
            <button
              className={
                preset.isActive ? "settings-safety-preset is-active" : "settings-safety-preset"
              }
              key={preset.id}
              onClick={() => onApplySchedulePreset(preset.id)}
              type="button"
            >
              <span className="settings-safety-preset__title">{preset.label}</span>
              <span className="hint settings-safety-preset__meta">{preset.description}</span>
              <span className="settings-safety-preset__count">{preset.summary}</span>
            </button>
          ))}
        </div>
      </div>
      <label>
        Retry Confirm Threshold
        <input
          max={maxRetryBatchConfirmThreshold}
          min={minRetryBatchConfirmThreshold}
          onChange={(event) => onRetryBatchConfirmThresholdChange(event.target.value)}
          type="number"
          value={retryBatchConfirmThreshold}
        />
      </label>
      <p className="hint">{concurrencyHint}</p>
      <p className="hint">{rateLimitHint}</p>
      <p className="hint">{scheduleHint}</p>
      <p className="hint">{retryThresholdHint}</p>
      <p className="hint">{activeSessionConflictHint}</p>
      {hasActiveSessionConflictControls ? (
        <div className="field-row">
          <button
            className="field-row__action"
            disabled={!canClearUploadDefault}
            onClick={onClearUploadDefault}
            type="button"
          >
            Clear Upload Default
          </button>
          <button
            className="field-row__action"
            disabled={!canClearDownloadDefault}
            onClick={onClearDownloadDefault}
            type="button"
          >
            Clear Download Default
          </button>
          <button
            className="field-row__action"
            disabled={!canClearAllDefaults}
            onClick={onClearAllDefaults}
            type="button"
          >
            Clear All
          </button>
        </div>
      ) : null}
      <div className="settings-safety-preset-section">
        <div className="settings-safety-preset-header">
          <h4 className="settings-group__title">Transfer Policy Packs</h4>
          <p className="hint">
            Save reusable SFTP transfer defaults for rate limits, concurrency, and schedule
            windows, then import, export, apply, or sync them through a shared JSON file. Optional
            auto-pull and auto-push can keep the linked sync file aligned without a manual button
            press each time.
          </p>
        </div>
        <p className="hint">
          Stored packs {storedPolicyPackCount}/{maxPolicyPackCount}
        </p>
        <p className="hint">
          Sync file: {policyPackSyncFilePath ? <code>{policyPackSyncFilePath}</code> : "Not linked yet."}
        </p>
        {policyPackLastSyncLabel ? <p className="hint">{policyPackLastSyncLabel}</p> : null}
        <label className="settings-checkbox">
          <input
            checked={policyPackAutoPullOnLaunch}
            onChange={(event) => onPolicyPackAutoPullOnLaunchChange(event.target.checked)}
            type="checkbox"
          />
          <span>Auto-pull linked sync file on launch</span>
        </label>
        <label className="settings-checkbox">
          <input
            checked={policyPackAutoPushOnChange}
            onChange={(event) => onPolicyPackAutoPushOnChangeChange(event.target.checked)}
            type="checkbox"
          />
          <span>Auto-push local pack changes to the linked sync file</span>
        </label>
        <p className="hint">
          Auto sync stays off by default. It only runs when a sync file is linked and does not
          re-push immediately after a pull/merge.
        </p>
        <div className="modal__actions">
          <button
            className="secondary-button"
            disabled={policyPackSyncBusyAction !== null}
            onClick={onSaveCurrentPolicyPack}
            type="button"
          >
            Save Current...
          </button>
          <button
            className="secondary-button"
            disabled={policyPackSyncBusyAction !== null}
            onClick={onImportPolicyPacks}
            type="button"
          >
            Import...
          </button>
          <button
            className="secondary-button"
            disabled={policyPackViews.length === 0 || policyPackSyncBusyAction !== null}
            onClick={onExportAllPolicyPacks}
            type="button"
          >
            Export All...
          </button>
          <button
            className="secondary-button"
            disabled={policyPackSyncBusyAction !== null}
            onClick={onPullPolicyPacksFromSync}
            type="button"
          >
            {policyPackSyncBusyAction === "pull"
              ? "Pulling..."
              : policyPackSyncFilePath
                ? "Pull Sync"
                : "Pull Sync..."}
          </button>
          <button
            className="secondary-button"
            disabled={policyPackSyncBusyAction !== null}
            onClick={onPushPolicyPacksToSync}
            type="button"
          >
            {policyPackSyncBusyAction === "push"
              ? "Pushing..."
              : policyPackSyncFilePath
                ? "Push Sync"
                : "Push Sync..."}
          </button>
          <button
            className="secondary-button"
            disabled={policyPackSyncBusyAction !== null}
            onClick={onChangePolicyPackSyncTarget}
            type="button"
          >
            {policyPackSyncBusyAction === "change"
              ? "Choosing..."
              : policyPackSyncFilePath
                ? "Change Sync File..."
                : "Choose Sync File..."}
          </button>
          <button
            className="secondary-button"
            disabled={!policyPackSyncFilePath || policyPackSyncBusyAction !== null}
            onClick={onClearPolicyPackSyncTarget}
            type="button"
          >
            Clear Sync File
          </button>
        </div>
        {policyPackViews.length > 0 ? (
          <div className="settings-safety-preset-grid">
            {policyPackViews.map((pack) => (
              <div className="settings-safety-preset" key={pack.id}>
                <div className="settings-safety-preset__title">{pack.name}</div>
                <div className="settings-safety-preset__meta">{pack.summary}</div>
                <div className="settings-safety-preset__count">Updated {pack.updatedAtLabel}</div>
                {pack.description ? (
                  <div className="settings-safety-preset__meta">{pack.description}</div>
                ) : null}
                <div className="modal__actions">
                  <button
                    className="secondary-button secondary-button--small"
                    onClick={() => onApplyPolicyPack(pack.id)}
                    type="button"
                  >
                    Apply
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    onClick={() => onExportPolicyPack(pack.id)}
                    type="button"
                  >
                    Export
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    onClick={() => onDeletePolicyPack(pack.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="hint">
            No transfer policy packs saved yet. Save the current SFTP settings to reuse them later.
          </p>
        )}
      </div>
    </>
  );
}

export function PortForwardingSettingsSection({
  activeTabSummary,
  portForwardBusy,
  hasActiveTab,
  hasActiveSession,
  isActiveTabConnected,
  formType,
  formBindHost,
  formBindPort,
  formTargetHost,
  formTargetPort,
  presetViews,
  portForwardStatusMessage,
  forwardViews,
  eventFilter,
  eventTimeRange,
  eventErrorCode,
  eventErrorCodeOptions,
  eventCorrelationQuery,
  hasCustomizedEventView,
  eventSummaryLabel,
  analyticsView,
  eventViews,
  activeEventHistoryCount,
  visibleEventHistoryCount,
  onFormTypeChange,
  onFormBindHostChange,
  onFormBindPortChange,
  onFormTargetHostChange,
  onFormTargetPortChange,
  onRefresh,
  onSavePreset,
  onCreateForward,
  onPresetAutoRestoreChange,
  onPresetFillForm,
  onPresetApply,
  onPresetDelete,
  onRefreshDiagnostics,
  onExportSnapshot,
  onRemoveForward,
  onEventFilterChange,
  onEventTimeRangeChange,
  onEventErrorCodeChange,
  onEventCorrelationQueryChange,
  onResetEventFilters,
  onExportVisibleJson,
  onExportVisibleCsv,
  onExportAnalyticsJson,
  onExportAnalyticsCsv,
  onClearVisibleHistory,
  onClearSessionHistory
}: PortForwardingSettingsSectionProps) {
  return (
    <>
      <p className="hint">
        Port forwarding is bound to the active terminal tab and removed when that tab
        disconnects/closes.
      </p>
      <p className="hint">Active tab: {activeTabSummary}</p>
      <div className="settings-port-forward-grid">
        <label>
          Type
          <select
            disabled={portForwardBusy}
            onChange={(event) => onFormTypeChange(event.target.value)}
            value={formType}
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
            onChange={(event) => onFormBindHostChange(event.target.value)}
            placeholder="127.0.0.1"
            value={formBindHost}
          />
        </label>
        <label>
          Listen Port
          <input
            disabled={portForwardBusy}
            max={65535}
            min={1}
            onChange={(event) => onFormBindPortChange(event.target.value)}
            type="number"
            value={formBindPort}
          />
        </label>
        {formType !== "dynamic" ? (
          <>
            <label>
              {formType === "local" ? "Remote Target Host" : "Local Target Host"}
              <input
                disabled={portForwardBusy}
                onChange={(event) => onFormTargetHostChange(event.target.value)}
                placeholder="127.0.0.1"
                value={formTargetHost}
              />
            </label>
            <label>
              {formType === "local" ? "Remote Target Port" : "Local Target Port"}
              <input
                disabled={portForwardBusy}
                max={65535}
                min={1}
                onChange={(event) => onFormTargetPortChange(event.target.value)}
                type="number"
                value={formTargetPort}
              />
            </label>
          </>
        ) : null}
      </div>
      <div className="modal__actions">
        <button
          className="secondary-button"
          disabled={portForwardBusy || !hasActiveTab}
          onClick={onRefresh}
          type="button"
        >
          Refresh
        </button>
        <button
          className="secondary-button"
          disabled={portForwardBusy || !hasActiveSession}
          onClick={onSavePreset}
          type="button"
        >
          Save as Preset
        </button>
        <button
          className="primary-button"
          disabled={portForwardBusy || !hasActiveTab || !isActiveTabConnected}
          onClick={onCreateForward}
          type="button"
        >
          {portForwardBusy ? "Working..." : "Create Forward"}
        </button>
      </div>
      <p className="settings-port-forward-section__title">Saved Presets</p>
      <div className="settings-port-forward-list-shell settings-port-forward-list-shell--presets">
        {hasActiveSession ? (
          presetViews.length > 0 ? (
            <ul className="settings-port-forward-list settings-port-forward-list--presets">
              {presetViews.map((preset) => (
                <li className="settings-port-forward-item" key={preset.id}>
                  <div className="settings-port-forward-item__header">
                    <p className="settings-port-forward-item__title">{preset.name}</p>
                    <p className="settings-port-forward-item__meta">{preset.summary}</p>
                    <p className="settings-port-forward-item__meta">
                      Updated {preset.updatedAtLabel}
                    </p>
                  </div>
                  <label className="settings-checkbox settings-port-forward-item__toggle">
                    <input
                      checked={preset.autoRestore}
                      disabled={portForwardBusy}
                      onChange={(event) =>
                        onPresetAutoRestoreChange(preset.id, event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span>Auto restore on connect</span>
                  </label>
                  <div className="modal__actions settings-port-forward-item__actions">
                    <button
                      className="secondary-button"
                      disabled={portForwardBusy}
                      onClick={() => onPresetFillForm(preset.id)}
                      type="button"
                    >
                      Fill Form
                    </button>
                    <button
                      className="secondary-button"
                      disabled={portForwardBusy || !hasActiveTab || !isActiveTabConnected}
                      onClick={() => onPresetApply(preset.id)}
                      type="button"
                    >
                      Apply
                    </button>
                    <button
                      className="secondary-button"
                      disabled={portForwardBusy}
                      onClick={() => onPresetDelete(preset.id)}
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
          <p className="hint">Open a session tab to manage presets for that session.</p>
        )}
      </div>
      <p className="settings-port-forward-section__title">Active Forwards</p>
      {portForwardStatusMessage ? (
        <p className="hint settings-port-forward-status-message">{portForwardStatusMessage}</p>
      ) : null}
      <div className="modal__actions settings-port-forward-diagnostics-actions">
        <button
          className="secondary-button"
          disabled={portForwardBusy || !hasActiveTab}
          onClick={onRefreshDiagnostics}
          type="button"
        >
          Refresh Diagnostics
        </button>
        <button
          className="secondary-button"
          disabled={!hasActiveTab}
          onClick={onExportSnapshot}
          type="button"
        >
          Export Snapshot
        </button>
      </div>
      <div className="settings-port-forward-list-shell">
        {forwardViews.length > 0 ? (
          <ul className="settings-port-forward-list">
            {forwardViews.map((forward) => (
              <li className="settings-port-forward-item" key={forward.id}>
                <div className="settings-port-forward-item__header">
                  <div className="settings-port-forward-item__title-row">
                    <p className="settings-port-forward-item__title">{forward.title}</p>
                    <span
                      className={
                        forward.statusTone === "degraded"
                          ? "settings-port-forward-status-badge is-degraded"
                          : "settings-port-forward-status-badge is-active"
                      }
                    >
                      {forward.statusLabel}
                    </span>
                  </div>
                </div>
                <p className="settings-port-forward-item__meta">Created {forward.createdAtLabel}</p>
                <p className="settings-port-forward-item__meta">{forward.connectionsLabel}</p>
                {forward.lastActivityLabel ? (
                  <p className="settings-port-forward-item__meta">
                    Last activity {forward.lastActivityLabel}
                  </p>
                ) : null}
                {forward.lastErrorLabel ? (
                  <p className="hint settings-port-forward-item__error">{forward.lastErrorLabel}</p>
                ) : null}
                <button
                  className="secondary-button"
                  disabled={portForwardBusy || !hasActiveTab}
                  onClick={() => onRemoveForward(forward.id)}
                  type="button"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">No active port forwards for the current tab.</p>
        )}
      </div>
      <p className="settings-port-forward-section__title">Recent Events</p>
      <div className="settings-port-forward-events-toolbar">
        <label>
          Filter
          <select onChange={(event) => onEventFilterChange(event.target.value)} value={eventFilter}>
            <option value="all">All</option>
            <option value="errors">Errors Only</option>
            <option value="lifecycle">Create/Remove</option>
            <option value="status">Degraded/Recovered</option>
          </select>
        </label>
        <label>
          Time
          <select
            onChange={(event) => onEventTimeRangeChange(event.target.value)}
            value={eventTimeRange}
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
            onChange={(event) => onEventErrorCodeChange(event.target.value)}
            value={eventErrorCode}
          >
            {eventErrorCodeOptions.map((code) => (
              <option key={code} value={code}>
                {code === "all" ? "All" : code}
              </option>
            ))}
            {eventErrorCode !== "all" && !eventErrorCodeOptions.includes(eventErrorCode) ? (
              <option value={eventErrorCode}>{eventErrorCode}</option>
            ) : null}
          </select>
        </label>
        <label>
          Correlation
          <input
            onChange={(event) => onEventCorrelationQueryChange(event.target.value)}
            placeholder="correlationKey / connectionId"
            value={eventCorrelationQuery}
          />
        </label>
        <button
          className="secondary-button"
          disabled={!hasCustomizedEventView}
          onClick={onResetEventFilters}
          type="button"
        >
          Reset Filters
        </button>
        <button
          className="secondary-button"
          disabled={visibleEventHistoryCount === 0}
          onClick={onExportVisibleJson}
          type="button"
        >
          Export Visible JSON
        </button>
        <button
          className="secondary-button"
          disabled={visibleEventHistoryCount === 0}
          onClick={onExportVisibleCsv}
          type="button"
        >
          Export Visible CSV
        </button>
        <button
          className="secondary-button"
          disabled={!hasActiveSession}
          onClick={onExportAnalyticsJson}
          type="button"
        >
          Export Analytics JSON
        </button>
        <button
          className="secondary-button"
          disabled={!hasActiveSession}
          onClick={onExportAnalyticsCsv}
          type="button"
        >
          Export Analytics CSV
        </button>
        <button
          className="secondary-button"
          disabled={visibleEventHistoryCount === 0}
          onClick={onClearVisibleHistory}
          type="button"
        >
          Clear Visible
        </button>
        <button
          className="secondary-button"
          disabled={activeEventHistoryCount === 0}
          onClick={onClearSessionHistory}
          type="button"
        >
          Clear Session
        </button>
      </div>
      <p className="hint settings-port-forward-events-summary">{eventSummaryLabel}</p>
      <div className="settings-port-forward-events-analytics">
        <article className="settings-port-forward-events-metric">
          <p className="settings-port-forward-events-metric__label">Error Ratio</p>
          <p className="settings-port-forward-events-metric__value">
            {analyticsView.errorRatioLabel}
          </p>
          <p className="settings-port-forward-events-metric__meta">{analyticsView.errorsLabel}</p>
        </article>
        <article className="settings-port-forward-events-metric">
          <p className="settings-port-forward-events-metric__label">Type Breakdown</p>
          <p className="settings-port-forward-events-metric__meta">
            {analyticsView.typeBreakdownPrimary}
          </p>
          <p className="settings-port-forward-events-metric__meta">
            {analyticsView.typeBreakdownSecondary}
          </p>
        </article>
        <article className="settings-port-forward-events-metric">
          <p className="settings-port-forward-events-metric__label">Top Error Codes</p>
          <p className="settings-port-forward-events-metric__meta settings-port-forward-events-metric__meta--wrap">
            {analyticsView.topErrorCodesLabel}
          </p>
        </article>
        <article className="settings-port-forward-events-metric">
          <p className="settings-port-forward-events-metric__label">Top Correlation</p>
          <p className="settings-port-forward-events-metric__meta settings-port-forward-events-metric__meta--wrap">
            {analyticsView.topCorrelationsLabel}
          </p>
        </article>
      </div>
      <div className="settings-port-forward-list-shell settings-port-forward-list-shell--events">
        {eventViews.length > 0 ? (
          <ul className="settings-port-forward-events-list">
            {eventViews.map((event) => (
              <li
                className={
                  event.isError
                    ? "settings-port-forward-event-item is-error"
                    : "settings-port-forward-event-item"
                }
                key={event.id}
              >
                <p className="settings-port-forward-event-item__title">{event.title}</p>
                <p className="settings-port-forward-event-item__meta">{event.meta}</p>
                {event.correlation ? (
                  <p className="settings-port-forward-event-item__correlation">
                    {event.correlation}
                  </p>
                ) : null}
                <p className="settings-port-forward-event-item__message">{event.message}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">
            {hasActiveSession
              ? "No matching port forwarding events for the current filter."
              : "Open a session tab to view port forwarding event history."}
          </p>
        )}
      </div>
    </>
  );
}

export function DiagnosticsSettingsSection({
  appVersion,
  autoUpdateAvailability,
  autoUpdateDownloadedVersion,
  autoUpdateDownloadProgressPercent,
  autoUpdateLatestVersion,
  autoUpdateLastCheckedLabel,
  autoUpdateReadyToInstall,
  autoUpdateStatusLabel,
  logDirectoryPath,
  logFilePath,
  isExportingBugReport,
  isCheckingForUpdates,
  disconnectVisibleCount,
  disconnectTotalCount,
  disconnectCaptureEnabled,
  disconnectScope,
  disconnectTrigger,
  disconnectTimeRange,
  disconnectQuery,
  hasCustomizedDisconnectView,
  disconnectCaptureHint,
  disconnectReportViews,
  disconnectEmptyStateLabel,
  onRefreshLogInfo,
  onOpenLogDirectory,
  onCopyLogFilePath,
  onExportBugReport,
  onImportAppBackup,
  onExportAppBackup,
  onCheckForUpdates,
  onDisconnectCaptureEnabledChange,
  onDisconnectScopeChange,
  onDisconnectTriggerChange,
  onDisconnectTimeRangeChange,
  onDisconnectQueryChange,
  onResetDisconnectFilters,
  onExportDisconnectJson,
  onExportDisconnectCsv,
  onCopyLatestVisibleDisconnect,
  onClearVisibleDisconnects,
  onClearAllDisconnects,
  onCopyDisconnectReportJson,
  onFocusDisconnectTab
}: DiagnosticsSettingsSectionProps) {
  return (
    <>
      <p className="hint">
        TermDock writes runtime diagnostics to local log files. Share these files when reporting
        bugs.
      </p>
      <p className="hint">
        Export Bug Report bundles logs, runtime metadata, and a safe settings snapshot into one zip
        package.
      </p>
      <div className="settings-diagnostics-update-card">
        <p className="settings-port-forward-section__title">App Updates</p>
        <div className="settings-diagnostics-update-card__summary">
          <span>Current version: {appVersion}</span>
          <span
            className={`settings-diagnostics-update-card__badge is-${autoUpdateAvailability}`}
          >
            {autoUpdateReadyToInstall ? "Ready to Install" : autoUpdateAvailability.replaceAll("-", " ")}
          </span>
        </div>
        <p className="hint">{autoUpdateStatusLabel}</p>
        {autoUpdateLatestVersion ? <p className="hint">Latest version: {autoUpdateLatestVersion}</p> : null}
        {autoUpdateDownloadedVersion ? (
          <p className="hint">Downloaded version: {autoUpdateDownloadedVersion}</p>
        ) : null}
        {typeof autoUpdateDownloadProgressPercent === "number" ? (
          <p className="hint">Download progress: {autoUpdateDownloadProgressPercent}%</p>
        ) : null}
        {autoUpdateLastCheckedLabel ? <p className="hint">Last checked: {autoUpdateLastCheckedLabel}</p> : null}
      </div>
      <label>
        Log Directory
        <input readOnly value={logDirectoryPath} />
      </label>
      <label>
        Log File
        <input readOnly value={logFilePath} />
      </label>
      <div className="modal__actions">
        <button className="secondary-button" onClick={onRefreshLogInfo} type="button">
          Refresh
        </button>
        <button className="secondary-button" onClick={onOpenLogDirectory} type="button">
          Open Folder
        </button>
        <button className="secondary-button" onClick={onCopyLogFilePath} type="button">
          Copy Log File Path
        </button>
        <button
          className="secondary-button"
          disabled={isCheckingForUpdates}
          onClick={onCheckForUpdates}
          type="button"
        >
          {isCheckingForUpdates ? "Checking for Updates..." : "Check for Updates"}
        </button>
        <button
          className="primary-button"
          disabled={isExportingBugReport}
          onClick={onExportBugReport}
          type="button"
        >
          {isExportingBugReport ? "Exporting..." : "Export Bug Report"}
        </button>
      </div>

      <p className="settings-port-forward-section__title">App Backup</p>
      <p className="hint">
        Export or restore a <code>.tdbackup</code> bundle with sessions and durable SQLite state.
        Credentials stay in an optional encrypted attachment.
      </p>
      <div className="modal__actions">
        <button className="secondary-button" onClick={onImportAppBackup} type="button">
          Import App Backup...
        </button>
        <button className="secondary-button" onClick={onExportAppBackup} type="button">
          Export App Backup...
        </button>
      </div>

      <p className="settings-port-forward-section__title">
        Disconnect Reports ({disconnectVisibleCount}/{disconnectTotalCount})
      </p>
      <label className="settings-checkbox settings-checkbox--inline">
        <input
          checked={disconnectCaptureEnabled}
          onChange={(event) => onDisconnectCaptureEnabledChange(event.target.checked)}
          type="checkbox"
        />
        <span>Auto capture unexpected disconnect reports</span>
      </label>
      <div className="settings-disconnect-reports-toolbar">
        <label>
          Scope
          <select
            onChange={(event) => onDisconnectScopeChange(event.target.value)}
            value={disconnectScope}
          >
            <option value="allSessions">All Sessions</option>
            <option value="activeSession">Active Session</option>
          </select>
        </label>
        <label>
          Trigger
          <select
            onChange={(event) => onDisconnectTriggerChange(event.target.value)}
            value={disconnectTrigger}
          >
            <option value="all">All</option>
            <option value="status">Status</option>
            <option value="error">Error</option>
          </select>
        </label>
        <label>
          Time
          <select
            onChange={(event) => onDisconnectTimeRangeChange(event.target.value)}
            value={disconnectTimeRange}
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
            onChange={(event) => onDisconnectQueryChange(event.target.value)}
            placeholder="session/target/message"
            value={disconnectQuery}
          />
        </label>
        <button
          className="secondary-button secondary-button--small"
          disabled={!hasCustomizedDisconnectView}
          onClick={onResetDisconnectFilters}
          type="button"
        >
          Reset Filters
        </button>
      </div>
      <p className="hint">{disconnectCaptureHint}</p>
      <div className="modal__actions settings-disconnect-reports__actions">
        <button
          className="secondary-button"
          disabled={disconnectVisibleCount === 0}
          onClick={onExportDisconnectJson}
          type="button"
        >
          Export Visible JSON
        </button>
        <button
          className="secondary-button"
          disabled={disconnectVisibleCount === 0}
          onClick={onExportDisconnectCsv}
          type="button"
        >
          Export Visible CSV
        </button>
        <button
          className="secondary-button"
          disabled={disconnectVisibleCount === 0}
          onClick={onCopyLatestVisibleDisconnect}
          type="button"
        >
          Copy Latest Visible
        </button>
        <button
          className="secondary-button"
          disabled={disconnectVisibleCount === 0}
          onClick={onClearVisibleDisconnects}
          type="button"
        >
          Clear Visible
        </button>
        <button
          className="secondary-button"
          disabled={disconnectTotalCount === 0}
          onClick={onClearAllDisconnects}
          type="button"
        >
          Clear All
        </button>
      </div>
      <div className="settings-disconnect-reports-shell">
        {disconnectReportViews.length > 0 ? (
          <ul className="settings-disconnect-reports-list">
            {disconnectReportViews.map((report) => (
              <li className="settings-disconnect-report-item" key={report.id}>
                <div className="settings-disconnect-report-item__header">
                  <p className="settings-disconnect-report-item__title">{report.title}</p>
                  {report.metaLines.map((line) => (
                    <p className="settings-disconnect-report-item__meta" key={line}>
                      {line}
                    </p>
                  ))}
                  {report.recentFailuresLabel ? (
                    <p className="settings-disconnect-report-item__message">
                      Recent failures: {report.recentFailuresLabel}
                    </p>
                  ) : null}
                </div>
                <div className="modal__actions settings-disconnect-report-item__actions">
                  <button
                    className="secondary-button"
                    onClick={() => onCopyDisconnectReportJson(report.id)}
                    type="button"
                  >
                    Copy JSON
                  </button>
                  {report.canFocusTab ? (
                    <button
                      className="secondary-button"
                      onClick={() => onFocusDisconnectTab(report.id)}
                      type="button"
                    >
                      Focus Tab
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">{disconnectEmptyStateLabel}</p>
        )}
      </div>
    </>
  );
}

export function HotkeySettingsSection({
  hotkeyRows,
  hotkeyModifierOptions,
  hotkeyConflicts,
  hotkeyConflictCursorIndex,
  hotkeyKeyPlaceholder,
  onBindingEnabledChange,
  onBindingModifierChange,
  onBindingKeyChange,
  onRegisterRowRef,
  onFocusPreviousConflict,
  onFocusNextConflict,
  onFocusConflictAtIndex,
  onResolveConflicts,
  onImportHotkeys,
  onExportHotkeys,
  onResetHotkeys
}: HotkeySettingsSectionProps) {
  return (
    <>
      <div className="settings-hotkey-list">
        {hotkeyRows.map((row) => {
          const rowClassName = [
            "settings-hotkey-row",
            row.isConflicting ? "is-conflict" : "",
            row.isFocused ? "is-focused-conflict" : ""
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              className={rowClassName}
              key={row.actionId}
              ref={(element) => {
                onRegisterRowRef(row.actionId, element);
              }}
            >
              <label className="settings-checkbox settings-hotkey-row__toggle">
                <input
                  checked={row.enabled}
                  onChange={(event) => onBindingEnabledChange(row.actionId, event.target.checked)}
                  type="checkbox"
                />
                <span className="settings-hotkey-row__label">
                  <span>{row.description}</span>
                  <span className="settings-hotkey-row__binding-inline hint">
                    {row.enabled ? row.bindingLabel : "Disabled"}
                  </span>
                  {row.isConflicting ? (
                    <span className="settings-hotkey-row__conflict-badge">Conflict</span>
                  ) : null}
                </span>
              </label>
              <div className="settings-hotkey-row__controls">
                <label>
                  Modifier
                  <select
                    disabled={!row.enabled}
                    onChange={(event) => onBindingModifierChange(row.actionId, event.target.value)}
                    value={row.modifier}
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
                    disabled={!row.enabled}
                    maxLength={1}
                    onChange={(event) => onBindingKeyChange(row.actionId, event.target.value)}
                    placeholder={hotkeyKeyPlaceholder}
                    value={row.key.toUpperCase()}
                  />
                </label>
              </div>
              {row.isConflicting ? (
                <p className="settings-hotkey-row__conflict-hint hint">
                  Conflicts on <code>{row.conflictBindingLabel}</code>.
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
              onClick={onFocusPreviousConflict}
              type="button"
            >
              Prev
            </button>
            <span className="hint settings-hotkey-conflicts__cursor">
              {hotkeyConflictCursorIndex + 1} / {hotkeyConflicts.length}
            </span>
            <button
              className="secondary-button secondary-button--small"
              onClick={onFocusNextConflict}
              type="button"
            >
              Next
            </button>
          </div>
          <ul className="settings-hotkey-conflicts__list">
            {hotkeyConflicts.map((conflict, index) => (
              <li
                className={
                  conflict.isActive
                    ? "settings-hotkey-conflicts__item is-active"
                    : "settings-hotkey-conflicts__item"
                }
                key={conflict.signature}
              >
                <span className="settings-hotkey-conflicts__summary">
                  <code>{conflict.bindingLabel}</code>
                  <span>{conflict.actionSummary}</span>
                </span>
                <button
                  className="secondary-button secondary-button--small settings-hotkey-conflicts__locate"
                  onClick={() => onFocusConflictAtIndex(index)}
                  type="button"
                >
                  Locate
                </button>
              </li>
            ))}
          </ul>
          <p className="hint">
            Conflicts may trigger only the first matching action. Auto resolve keeps the first
            action and disables the rest.
          </p>
          <p className="hint">
            Keyboard navigation: <code>Alt + [</code> previous, <code>Alt + ]</code> next.
          </p>
          <div className="modal__actions">
            <button
              className="secondary-button"
              onClick={() => onFocusConflictAtIndex(0)}
              type="button"
            >
              Focus First Conflict
            </button>
            <button className="secondary-button" onClick={onResolveConflicts} type="button">
              Auto Resolve Conflicts
            </button>
          </div>
        </div>
      ) : null}
      <p className="hint">
        Windows defaults use <code>Ctrl + Shift + C</code> / <code>Ctrl + Shift + V</code> for
        terminal copy/paste, and keeps Alt-based keys for tab and search actions. macOS keeps the
        existing Cmd-based behavior.
      </p>
      <div className="modal__actions">
        <button className="secondary-button" onClick={onImportHotkeys} type="button">
          Import Hotkeys...
        </button>
        <button className="secondary-button" onClick={onExportHotkeys} type="button">
          Export Hotkeys...
        </button>
        <button className="secondary-button" onClick={onResetHotkeys} type="button">
          Reset Hotkeys
        </button>
      </div>
    </>
  );
}

export function ServerHealthSettingsSection({
  enabled,
  cpuWarnPercent,
  memoryWarnPercent,
  diskWarnPercent,
  onEnabledChange,
  onThresholdChange
}: ServerHealthSettingsSectionProps) {
  return (
    <>
      <label className="settings-checkbox">
        <input
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
          type="checkbox"
        />
        <span>Enable threshold alerts in monitor panel</span>
      </label>
      <div className="settings-threshold-grid">
        <label>
          CPU Alert (%)
          <input
            disabled={!enabled}
            max={100}
            min={50}
            onChange={(event) => onThresholdChange("cpuWarnPercent", event.target.value)}
            type="number"
            value={cpuWarnPercent}
          />
        </label>
        <label>
          Memory Alert (%)
          <input
            disabled={!enabled}
            max={100}
            min={50}
            onChange={(event) => onThresholdChange("memoryWarnPercent", event.target.value)}
            type="number"
            value={memoryWarnPercent}
          />
        </label>
        <label>
          Disk Alert (%)
          <input
            disabled={!enabled}
            max={100}
            min={50}
            onChange={(event) => onThresholdChange("diskWarnPercent", event.target.value)}
            type="number"
            value={diskWarnPercent}
          />
        </label>
      </div>
      <p className="hint">
        Threshold range is 50-100. Alerts are evaluated on each monitor refresh.
      </p>
    </>
  );
}

function SectionHeading({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="settings-safety-preset-section">
      <div className="settings-safety-preset-header">
        <h4 className="settings-group__title">{title}</h4>
        <p className="hint">{description}</p>
      </div>
    </div>
  );
}

function PresetOptionGrid({
  options,
  activeId,
  onSelect,
  optionClassName,
  previewClassName,
  previewDataAttribute,
  previewValueKey,
  previewTextRows,
  previewSpanCount = 3
}: {
  options: EditorFocusOptionView[];
  activeId: string;
  onSelect: (optionId: string) => void;
  optionClassName: string;
  previewClassName: string;
  previewDataAttribute:
    | "data-editor-theme"
    | "data-editor-typography"
    | "data-editor-font"
    | "data-editor-rhythm"
    | "data-editor-cursor";
  previewValueKey:
    | "data-editor-theme"
    | "data-editor-typography"
    | "data-editor-font"
    | "data-editor-rhythm"
    | "data-editor-cursor";
  previewTextRows?: string[];
  previewSpanCount?: number;
}) {
  return (
    <div className="settings-safety-preset-grid">
      {options.map((option) => {
        const previewProps = { [previewDataAttribute]: option.id } as Record<string, string>;
        return (
          <button
            {...{ [previewValueKey]: option.id }}
            className={
              option.id === activeId ? `${optionClassName} is-active` : optionClassName
            }
            key={option.id}
            onClick={() => onSelect(option.id)}
            type="button"
          >
            <div className="settings-safety-preset__title">{option.label}</div>
            <div className={previewClassName} {...previewProps}>
              {previewTextRows
                ? previewTextRows.map((row) => <span key={row}>{row}</span>)
                : Array.from({ length: previewSpanCount }).map((_, index) => <span key={index} />)}
            </div>
            <div className="settings-safety-preset__meta">{option.description}</div>
          </button>
        );
      })}
    </div>
  );
}
