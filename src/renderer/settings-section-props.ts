import type { ComponentProps } from "react";

import type {
  DangerousCommandBuiltinRuleId,
  DangerousCommandEnvironmentTemplateId,
  DangerousCommandExecutionSource,
  DangerousCommandPolicyPackId
} from "./dangerous-command-guard";
import type {
  HotkeyModifier,
  HotkeyPreferences,
  TerminalEditorFocusCursorId,
  TerminalEditorFocusFontId,
  TerminalEditorFocusRhythmId,
  TerminalEditorFocusThemeId,
  TerminalEditorFocusTypographyId
} from "./components/terminal-workspace";
import {
  ConnectionSettingsSection,
  DiagnosticsSettingsSection,
  FileOpeningSettingsSection,
  HotkeySettingsSection,
  PortForwardingSettingsSection,
  SafetySettingsSection,
  ServerHealthSettingsSection,
  SftpSettingsSection,
  WorkspaceSettingsSection
} from "./components/settings-sections";

type ConnectionSectionProps = ComponentProps<typeof ConnectionSettingsSection>;
type WorkspaceSectionProps = ComponentProps<typeof WorkspaceSettingsSection>;
type HotkeySectionProps = ComponentProps<typeof HotkeySettingsSection>;
type ServerHealthSectionProps = ComponentProps<typeof ServerHealthSettingsSection>;
type FileOpeningSectionProps = ComponentProps<typeof FileOpeningSettingsSection>;
type SafetySectionProps = ComponentProps<typeof SafetySettingsSection>;
type SftpSectionProps = ComponentProps<typeof SftpSettingsSection>;
type PortForwardingSectionProps = ComponentProps<typeof PortForwardingSettingsSection>;
type DiagnosticsSectionProps = ComponentProps<typeof DiagnosticsSettingsSection>;
type HotkeyActionId = keyof HotkeyPreferences;

export interface BuildConnectionSettingsSectionPropsArgs
  extends Pick<
    ConnectionSectionProps,
    "autoReconnect" | "reconnectDelaySeconds" | "onAutoReconnectChange" | "onReconnectDelayChange"
  > {}

type WorkspaceSectionValueProps = Pick<
  WorkspaceSectionProps,
  | "cursorOptions"
  | "editorFocusAutoLayoutEnabled"
  | "fontOptions"
  | "labels"
  | "languageOptions"
  | "rhythmOptions"
  | "selectedCursorId"
  | "selectedCursorLabel"
  | "selectedFontId"
  | "selectedFontLabel"
  | "selectedLanguage"
  | "selectedLanguageLabel"
  | "selectedRhythmId"
  | "selectedRhythmLabel"
  | "selectedThemeId"
  | "selectedThemeLabel"
  | "selectedTypographyId"
  | "selectedTypographyLabel"
  | "selectedWorkspaceProfileId"
  | "selectedWorkspaceProfileLabel"
  | "syncDangerousCommandSafety"
  | "themeOptions"
  | "typographyOptions"
  | "workspaceProfileCards"
>;

export interface BuildWorkspaceSettingsSectionPropsArgs extends WorkspaceSectionValueProps {
  onCursorSelectAction: (value: TerminalEditorFocusCursorId) => void;
  onEditorFocusAutoLayoutEnabledChange:
    WorkspaceSectionProps["onEditorFocusAutoLayoutEnabledChange"];
  onFontSelectAction: (value: TerminalEditorFocusFontId) => void;
  onLanguageSelect: WorkspaceSectionProps["onLanguageSelect"];
  onRhythmSelectAction: (value: TerminalEditorFocusRhythmId) => void;
  onSyncDangerousCommandSafetyChange:
    WorkspaceSectionProps["onSyncDangerousCommandSafetyChange"];
  onThemeSelectAction: (value: TerminalEditorFocusThemeId) => void;
  onTypographySelectAction: (value: TerminalEditorFocusTypographyId) => void;
  onWorkspaceProfileSelectAction: (value: DangerousCommandEnvironmentTemplateId) => void;
}

type HotkeySectionValueProps = Pick<
  HotkeySectionProps,
  | "hotkeyConflictCursorIndex"
  | "hotkeyConflicts"
  | "hotkeyKeyPlaceholder"
  | "hotkeyModifierOptions"
  | "hotkeyRows"
>;

export interface BuildHotkeySettingsSectionPropsArgs extends HotkeySectionValueProps {
  onBindingEnabledChangeAction: (actionId: HotkeyActionId, value: boolean) => void;
  onBindingKeyChangeAction: (actionId: HotkeyActionId, value: string) => void;
  onBindingModifierChangeAction: (
    actionId: HotkeyActionId,
    modifier: HotkeyModifier
  ) => void;
  onExportHotkeysAction: () => Promise<unknown> | void;
  onFocusConflictAtIndex: HotkeySectionProps["onFocusConflictAtIndex"];
  onFocusNextConflict: HotkeySectionProps["onFocusNextConflict"];
  onFocusPreviousConflict: HotkeySectionProps["onFocusPreviousConflict"];
  onImportHotkeysAction: () => Promise<unknown> | void;
  onRegisterRowRefAction: (
    actionId: HotkeyActionId,
    element: HTMLDivElement | null
  ) => void;
  onResetHotkeys: HotkeySectionProps["onResetHotkeys"];
  onResolveConflicts: HotkeySectionProps["onResolveConflicts"];
}

export interface BuildServerHealthSettingsSectionPropsArgs
  extends Pick<
    ServerHealthSectionProps,
    | "cpuWarnPercent"
    | "diskWarnPercent"
    | "enabled"
    | "memoryWarnPercent"
    | "onEnabledChange"
    | "onThresholdChange"
  > {}

export interface BuildFileOpeningSettingsSectionPropsArgs
  extends Pick<
    FileOpeningSectionProps,
    "isMacPlatform" | "preferredProgramPath" | "onPreferredProgramPathChange"
  > {
  onBrowseProgramAction: () => Promise<unknown> | void;
}

type SafetySectionValueProps = Pick<
  SafetySectionProps,
  | "activeTargetGroupAssignmentName"
  | "builtinRuleViews"
  | "customPatternCount"
  | "customPatternInvalidLineCount"
  | "customPatternsText"
  | "enabled"
  | "enabledBuiltinRuleCount"
  | "enabledSourceCount"
  | "environmentTemplateViews"
  | "executionSourceViews"
  | "groupAssignmentLimitReached"
  | "groupAssignmentViews"
  | "maxGroupOverrideCount"
  | "maxPersistentApprovalCount"
  | "maxPolicyBundleCount"
  | "maxTemporaryApprovalCount"
  | "persistentApprovalViews"
  | "policyBundleLastPulledLabel"
  | "policyBundleLastPushedLabel"
  | "policyBundleSyncBusyAction"
  | "policyBundleSyncFilePath"
  | "policyBundleViews"
  | "policyPackViews"
  | "savedGroupOverrideCount"
  | "selectedEnvironmentTemplateExtraRuleCount"
  | "selectedEnvironmentTemplateLabel"
  | "selectedPolicyPackExtraRuleCount"
  | "selectedPolicyPackLabel"
  | "selectedWorkspaceProfileLabel"
  | "storedPolicyBundleCount"
  | "supplementalRuleViews"
  | "syncDangerousCommandSafety"
  | "targetGroupHint"
  | "targetGroupName"
  | "temporaryApprovalViews"
  | "totalBuiltinRuleCount"
  | "totalExecutionSourceCount"
>;

export interface BuildSafetySettingsSectionPropsArgs extends SafetySectionValueProps {
  onApplyPolicyBundleAction: (bundleId: string) => Promise<unknown> | void;
  onBuiltinRuleEnabledChangeAction: (
    ruleId: DangerousCommandBuiltinRuleId,
    value: boolean
  ) => void;
  onChangePolicyBundleSyncTargetAction: () => Promise<unknown> | void;
  onClearPersistentApprovalsAction: () => Promise<unknown> | void;
  onClearPolicyBundleSyncTargetAction: () => Promise<unknown> | void;
  onClearTemporaryApprovalsAction: (reason?: "settings-changed" | "manual") => void;
  onCustomPatternsTextChange: SafetySectionProps["onCustomPatternsTextChange"];
  onDeleteGroupAssignmentAction: (groupName: string | null | undefined) => void;
  onDeletePersistentApprovalAction: SafetySectionProps["onDeletePersistentApproval"];
  onDeletePolicyBundleAction: (bundleId: string) => Promise<unknown> | void;
  onDeleteTargetGroupOverrideGroupName: string | null;
  onDeleteTemporaryApproval: SafetySectionProps["onDeleteTemporaryApproval"];
  onEnvironmentTemplateSelectAction: (
    templateId: DangerousCommandEnvironmentTemplateId
  ) => void;
  onExecutionSourceEnabledChangeAction: (
    sourceId: DangerousCommandExecutionSource,
    value: boolean
  ) => void;
  onExportPolicyBundleAction: (bundleId: string) => Promise<unknown> | void;
  onExportPolicyBundlesAction: () => Promise<unknown> | void;
  onGuardEnabledChange: SafetySectionProps["onGuardEnabledChange"];
  onImportPolicyBundlesAction: () => Promise<unknown> | void;
  onPolicyPackSelectAction: (packId: DangerousCommandPolicyPackId) => void;
  onPullPolicyBundlesFromSyncAction: () => Promise<unknown> | void;
  onPushPolicyBundlesToSyncAction: () => Promise<unknown> | void;
  onResetSafetyRules: SafetySectionProps["onResetSafetyRules"];
  onSaveCurrentPolicyBundleAction: () => Promise<unknown> | void;
  onSaveTargetGroupOverrideAction: (groupName: string | null | undefined) => void;
}

type SftpSectionValueProps = Pick<
  SftpSectionProps,
  | "activeSessionConflictHint"
  | "canClearAllDefaults"
  | "canClearDownloadDefault"
  | "canClearUploadDefault"
  | "concurrencyHint"
  | "downloadConcurrency"
  | "downloadRateLimitKiBps"
  | "hasActiveSessionConflictControls"
  | "maxConcurrency"
  | "maxPolicyPackCount"
  | "maxRateLimitKiBps"
  | "maxRetryBatchConfirmThreshold"
  | "minRetryBatchConfirmThreshold"
  | "policyPackAutoPullOnLaunch"
  | "policyPackAutoPushOnChange"
  | "policyPackLastSyncLabel"
  | "policyPackSyncBusyAction"
  | "policyPackSyncFilePath"
  | "policyPackViews"
  | "rateLimitHint"
  | "retryBatchConfirmThreshold"
  | "retryThresholdHint"
  | "scheduleDayOptions"
  | "scheduleHint"
  | "schedulePresetViews"
  | "scheduleWindowEnabled"
  | "scheduleWindowEndValue"
  | "scheduleWindowStartValue"
  | "storedPolicyPackCount"
  | "uploadConcurrency"
  | "uploadRateLimitKiBps"
>;

export interface BuildSftpSettingsSectionPropsArgs extends SftpSectionValueProps {
  onApplyPolicyPackAction: (packId: string) => Promise<unknown> | void;
  onApplySchedulePreset: SftpSectionProps["onApplySchedulePreset"];
  onChangePolicyPackSyncTargetAction: () => Promise<unknown> | void;
  onClearAllDefaults: SftpSectionProps["onClearAllDefaults"];
  onClearDownloadDefault: SftpSectionProps["onClearDownloadDefault"];
  onClearPolicyPackSyncTargetAction: () => Promise<unknown> | void;
  onClearUploadDefault: SftpSectionProps["onClearUploadDefault"];
  onDeletePolicyPackAction: (packId: string) => Promise<unknown> | void;
  onDownloadConcurrencyChange: SftpSectionProps["onDownloadConcurrencyChange"];
  onDownloadRateLimitChange: SftpSectionProps["onDownloadRateLimitChange"];
  onExportAllPolicyPacksAction: () => Promise<unknown> | void;
  onExportPolicyPackAction: (packId: string) => Promise<unknown> | void;
  onImportPolicyPacksAction: () => Promise<unknown> | void;
  onPolicyPackAutoPullOnLaunchChange:
    SftpSectionProps["onPolicyPackAutoPullOnLaunchChange"];
  onPolicyPackAutoPushOnChangeChange:
    SftpSectionProps["onPolicyPackAutoPushOnChangeChange"];
  onPullPolicyPacksFromSyncAction: () => Promise<unknown> | void;
  onPushPolicyPacksToSyncAction: () => Promise<unknown> | void;
  onRetryBatchConfirmThresholdChange:
    SftpSectionProps["onRetryBatchConfirmThresholdChange"];
  onSaveCurrentPolicyPackAction: () => Promise<unknown> | void;
  onScheduleWindowEnabledChange: SftpSectionProps["onScheduleWindowEnabledChange"];
  onScheduleWindowEndChange: SftpSectionProps["onScheduleWindowEndChange"];
  onScheduleWindowStartChange: SftpSectionProps["onScheduleWindowStartChange"];
  onToggleScheduleDay: SftpSectionProps["onToggleScheduleDay"];
  onUploadConcurrencyChange: SftpSectionProps["onUploadConcurrencyChange"];
  onUploadRateLimitChange: SftpSectionProps["onUploadRateLimitChange"];
}

type PortForwardingSectionValueProps = Pick<
  PortForwardingSectionProps,
  | "activeEventHistoryCount"
  | "activeTabSummary"
  | "analyticsView"
  | "eventCorrelationQuery"
  | "eventErrorCode"
  | "eventErrorCodeOptions"
  | "eventFilter"
  | "eventSummaryLabel"
  | "eventTimeRange"
  | "eventViews"
  | "formBindHost"
  | "formBindPort"
  | "formTargetHost"
  | "formTargetPort"
  | "formType"
  | "forwardViews"
  | "hasActiveSession"
  | "hasActiveTab"
  | "hasCustomizedEventView"
  | "isActiveTabConnected"
  | "portForwardBusy"
  | "portForwardStatusMessage"
  | "presetViews"
  | "visibleEventHistoryCount"
>;

export interface BuildPortForwardingSettingsSectionPropsArgs
  extends PortForwardingSectionValueProps {
  onClearSessionHistoryAction: () => Promise<unknown> | void;
  onClearVisibleHistoryAction: () => Promise<unknown> | void;
  onCreateForwardAction: () => Promise<unknown> | void;
  onEventCorrelationQueryChange:
    PortForwardingSectionProps["onEventCorrelationQueryChange"];
  onEventErrorCodeChange: PortForwardingSectionProps["onEventErrorCodeChange"];
  onEventFilterChange: PortForwardingSectionProps["onEventFilterChange"];
  onEventTimeRangeChange: PortForwardingSectionProps["onEventTimeRangeChange"];
  onExportAnalyticsCsvAction: () => Promise<unknown> | void;
  onExportAnalyticsJsonAction: () => Promise<unknown> | void;
  onExportSnapshotAction: () => Promise<unknown> | void;
  onExportVisibleCsvAction: () => Promise<unknown> | void;
  onExportVisibleJsonAction: () => Promise<unknown> | void;
  onFormBindHostChange: PortForwardingSectionProps["onFormBindHostChange"];
  onFormBindPortChange: PortForwardingSectionProps["onFormBindPortChange"];
  onFormTargetHostChange: PortForwardingSectionProps["onFormTargetHostChange"];
  onFormTargetPortChange: PortForwardingSectionProps["onFormTargetPortChange"];
  onFormTypeChange: PortForwardingSectionProps["onFormTypeChange"];
  onPresetApply: PortForwardingSectionProps["onPresetApply"];
  onPresetAutoRestoreChange:
    PortForwardingSectionProps["onPresetAutoRestoreChange"];
  onPresetDelete: PortForwardingSectionProps["onPresetDelete"];
  onPresetFillForm: PortForwardingSectionProps["onPresetFillForm"];
  onRefresh: PortForwardingSectionProps["onRefresh"];
  onRefreshDiagnostics: PortForwardingSectionProps["onRefreshDiagnostics"];
  onRemoveForward: PortForwardingSectionProps["onRemoveForward"];
  onResetEventFilters: PortForwardingSectionProps["onResetEventFilters"];
  onSavePresetAction: () => Promise<unknown> | void;
}

export type DiagnosticsSectionValueProps = Pick<
  DiagnosticsSectionProps,
  | "appVersion"
  | "autoUpdateAvailability"
  | "autoUpdateDownloadedVersion"
  | "autoUpdateDownloadProgressPercent"
  | "autoUpdateLatestVersion"
  | "autoUpdateLastCheckedLabel"
  | "autoUpdateReadyToInstall"
  | "autoUpdateStatusLabel"
  | "disconnectCaptureEnabled"
  | "disconnectCaptureHint"
  | "disconnectEmptyStateLabel"
  | "disconnectQuery"
  | "disconnectReportViews"
  | "disconnectScope"
  | "disconnectTimeRange"
  | "disconnectTotalCount"
  | "disconnectTrigger"
  | "disconnectVisibleCount"
  | "hasCustomizedDisconnectView"
  | "isCheckingForUpdates"
  | "isExportingBugReport"
  | "logDirectoryPath"
  | "logFilePath"
>;

export interface BuildDiagnosticsSettingsSectionPropsArgs
  extends DiagnosticsSectionValueProps {
  onClearAllDisconnectsAction: () => Promise<unknown> | void;
  onClearVisibleDisconnectsAction: () => Promise<unknown> | void;
  onCopyDisconnectReportJson:
    DiagnosticsSectionProps["onCopyDisconnectReportJson"];
  onCopyLatestVisibleDisconnectAction: () => Promise<unknown> | void;
  onCopyLogFilePathAction: () => Promise<unknown> | void;
  onDisconnectCaptureEnabledChange:
    DiagnosticsSectionProps["onDisconnectCaptureEnabledChange"];
  onDisconnectQueryChange: DiagnosticsSectionProps["onDisconnectQueryChange"];
  onDisconnectScopeChange: DiagnosticsSectionProps["onDisconnectScopeChange"];
  onDisconnectTimeRangeChange:
    DiagnosticsSectionProps["onDisconnectTimeRangeChange"];
  onDisconnectTriggerChange:
    DiagnosticsSectionProps["onDisconnectTriggerChange"];
  onCheckForUpdatesAction: () => Promise<unknown> | void;
  onExportBugReportAction: () => Promise<unknown> | void;
  onExportDisconnectCsvAction: () => Promise<unknown> | void;
  onExportDisconnectJsonAction: () => Promise<unknown> | void;
  onFocusDisconnectTab: DiagnosticsSectionProps["onFocusDisconnectTab"];
  onOpenLogDirectoryAction: () => Promise<unknown> | void;
  onRefreshLogInfo: DiagnosticsSectionProps["onRefreshLogInfo"];
  onResetDisconnectFilters: DiagnosticsSectionProps["onResetDisconnectFilters"];
}

export function buildConnectionSettingsSectionProps(
  args: BuildConnectionSettingsSectionPropsArgs
): ConnectionSectionProps {
  return {
    autoReconnect: args.autoReconnect,
    onAutoReconnectChange: args.onAutoReconnectChange,
    onReconnectDelayChange: args.onReconnectDelayChange,
    reconnectDelaySeconds: args.reconnectDelaySeconds
  };
}

export function buildWorkspaceSettingsSectionProps(
  args: BuildWorkspaceSettingsSectionPropsArgs
): WorkspaceSectionProps {
  return {
    cursorOptions: args.cursorOptions,
    editorFocusAutoLayoutEnabled: args.editorFocusAutoLayoutEnabled,
    fontOptions: args.fontOptions,
    labels: args.labels,
    languageOptions: args.languageOptions,
    onCursorSelect: (cursorId) => {
      args.onCursorSelectAction(cursorId as TerminalEditorFocusCursorId);
    },
    onEditorFocusAutoLayoutEnabledChange:
      args.onEditorFocusAutoLayoutEnabledChange,
    onFontSelect: (fontId) => {
      args.onFontSelectAction(fontId as TerminalEditorFocusFontId);
    },
    onLanguageSelect: args.onLanguageSelect,
    onRhythmSelect: (rhythmId) => {
      args.onRhythmSelectAction(rhythmId as TerminalEditorFocusRhythmId);
    },
    onSyncDangerousCommandSafetyChange:
      args.onSyncDangerousCommandSafetyChange,
    onThemeSelect: (themeId) => {
      args.onThemeSelectAction(themeId as TerminalEditorFocusThemeId);
    },
    onTypographySelect: (typographyId) => {
      args.onTypographySelectAction(
        typographyId as TerminalEditorFocusTypographyId
      );
    },
    onWorkspaceProfileSelect: (profileId) => {
      args.onWorkspaceProfileSelectAction(
        profileId as DangerousCommandEnvironmentTemplateId
      );
    },
    rhythmOptions: args.rhythmOptions,
    selectedCursorId: args.selectedCursorId,
    selectedCursorLabel: args.selectedCursorLabel,
    selectedFontId: args.selectedFontId,
    selectedFontLabel: args.selectedFontLabel,
    selectedLanguage: args.selectedLanguage,
    selectedLanguageLabel: args.selectedLanguageLabel,
    selectedRhythmId: args.selectedRhythmId,
    selectedRhythmLabel: args.selectedRhythmLabel,
    selectedThemeId: args.selectedThemeId,
    selectedThemeLabel: args.selectedThemeLabel,
    selectedTypographyId: args.selectedTypographyId,
    selectedTypographyLabel: args.selectedTypographyLabel,
    selectedWorkspaceProfileId: args.selectedWorkspaceProfileId,
    selectedWorkspaceProfileLabel: args.selectedWorkspaceProfileLabel,
    syncDangerousCommandSafety: args.syncDangerousCommandSafety,
    themeOptions: args.themeOptions,
    typographyOptions: args.typographyOptions,
    workspaceProfileCards: args.workspaceProfileCards
  };
}

export function buildHotkeySettingsSectionProps(
  args: BuildHotkeySettingsSectionPropsArgs
): HotkeySectionProps {
  return {
    hotkeyConflictCursorIndex: args.hotkeyConflictCursorIndex,
    hotkeyConflicts: args.hotkeyConflicts,
    hotkeyKeyPlaceholder: args.hotkeyKeyPlaceholder,
    hotkeyModifierOptions: args.hotkeyModifierOptions,
    hotkeyRows: args.hotkeyRows,
    onBindingEnabledChange: (actionId, value) => {
      args.onBindingEnabledChangeAction(actionId as HotkeyActionId, value);
    },
    onBindingKeyChange: (actionId, value) => {
      args.onBindingKeyChangeAction(actionId as HotkeyActionId, value);
    },
    onBindingModifierChange: (actionId, modifier) => {
      args.onBindingModifierChangeAction(
        actionId as HotkeyActionId,
        modifier as HotkeyModifier
      );
    },
    onExportHotkeys: () => {
      void args.onExportHotkeysAction();
    },
    onFocusConflictAtIndex: args.onFocusConflictAtIndex,
    onFocusNextConflict: args.onFocusNextConflict,
    onFocusPreviousConflict: args.onFocusPreviousConflict,
    onImportHotkeys: () => {
      void args.onImportHotkeysAction();
    },
    onRegisterRowRef: (actionId, element) => {
      args.onRegisterRowRefAction(actionId as HotkeyActionId, element);
    },
    onResetHotkeys: args.onResetHotkeys,
    onResolveConflicts: args.onResolveConflicts
  };
}

export function buildServerHealthSettingsSectionProps(
  args: BuildServerHealthSettingsSectionPropsArgs
): ServerHealthSectionProps {
  return {
    cpuWarnPercent: args.cpuWarnPercent,
    diskWarnPercent: args.diskWarnPercent,
    enabled: args.enabled,
    memoryWarnPercent: args.memoryWarnPercent,
    onEnabledChange: args.onEnabledChange,
    onThresholdChange: args.onThresholdChange
  };
}

export function buildFileOpeningSettingsSectionProps(
  args: BuildFileOpeningSettingsSectionPropsArgs
): FileOpeningSectionProps {
  return {
    isMacPlatform: args.isMacPlatform,
    onBrowseProgram: () => {
      void args.onBrowseProgramAction();
    },
    onPreferredProgramPathChange: args.onPreferredProgramPathChange,
    preferredProgramPath: args.preferredProgramPath
  };
}

export function buildSafetySettingsSectionProps(
  args: BuildSafetySettingsSectionPropsArgs
): SafetySectionProps {
  return {
    activeTargetGroupAssignmentName: args.activeTargetGroupAssignmentName,
    builtinRuleViews: args.builtinRuleViews,
    customPatternCount: args.customPatternCount,
    customPatternInvalidLineCount: args.customPatternInvalidLineCount,
    customPatternsText: args.customPatternsText,
    enabled: args.enabled,
    enabledBuiltinRuleCount: args.enabledBuiltinRuleCount,
    enabledSourceCount: args.enabledSourceCount,
    environmentTemplateViews: args.environmentTemplateViews,
    executionSourceViews: args.executionSourceViews,
    groupAssignmentLimitReached: args.groupAssignmentLimitReached,
    groupAssignmentViews: args.groupAssignmentViews,
    maxGroupOverrideCount: args.maxGroupOverrideCount,
    maxPersistentApprovalCount: args.maxPersistentApprovalCount,
    maxPolicyBundleCount: args.maxPolicyBundleCount,
    maxTemporaryApprovalCount: args.maxTemporaryApprovalCount,
    onApplyPolicyBundle: (bundleId) => {
      void args.onApplyPolicyBundleAction(bundleId);
    },
    onBuiltinRuleEnabledChange: (ruleId, value) => {
      args.onBuiltinRuleEnabledChangeAction(
        ruleId as DangerousCommandBuiltinRuleId,
        value
      );
    },
    onChangePolicyBundleSyncTarget: () => {
      void args.onChangePolicyBundleSyncTargetAction();
    },
    onClearPersistentApprovals: () => {
      void args.onClearPersistentApprovalsAction();
    },
    onClearPolicyBundleSyncTarget: () => {
      void args.onClearPolicyBundleSyncTargetAction();
    },
    onClearTemporaryApprovals: () => {
      args.onClearTemporaryApprovalsAction("manual");
    },
    onCustomPatternsTextChange: args.onCustomPatternsTextChange,
    onDeleteGroupAssignment: (groupName) => {
      args.onDeleteGroupAssignmentAction(groupName);
    },
    onDeletePersistentApproval: args.onDeletePersistentApprovalAction,
    onDeletePolicyBundle: (bundleId) => {
      void args.onDeletePolicyBundleAction(bundleId);
    },
    onDeleteTargetGroupOverride: () => {
      if (args.onDeleteTargetGroupOverrideGroupName) {
        args.onDeleteGroupAssignmentAction(args.onDeleteTargetGroupOverrideGroupName);
      }
    },
    onDeleteTemporaryApproval: args.onDeleteTemporaryApproval,
    onEnvironmentTemplateSelect: (templateId) => {
      args.onEnvironmentTemplateSelectAction(
        templateId as DangerousCommandEnvironmentTemplateId
      );
    },
    onExecutionSourceEnabledChange: (sourceId, value) => {
      args.onExecutionSourceEnabledChangeAction(
        sourceId as DangerousCommandExecutionSource,
        value
      );
    },
    onExportPolicyBundle: (bundleId) => {
      void args.onExportPolicyBundleAction(bundleId);
    },
    onExportPolicyBundles: () => {
      void args.onExportPolicyBundlesAction();
    },
    onGuardEnabledChange: args.onGuardEnabledChange,
    onImportPolicyBundles: () => {
      void args.onImportPolicyBundlesAction();
    },
    onPolicyPackSelect: (packId) => {
      args.onPolicyPackSelectAction(packId as DangerousCommandPolicyPackId);
    },
    onPullPolicyBundlesFromSync: () => {
      void args.onPullPolicyBundlesFromSyncAction();
    },
    onPushPolicyBundlesToSync: () => {
      void args.onPushPolicyBundlesToSyncAction();
    },
    onResetSafetyRules: args.onResetSafetyRules,
    onSaveCurrentPolicyBundle: () => {
      void args.onSaveCurrentPolicyBundleAction();
    },
    onSaveTargetGroupOverride: () => {
      args.onSaveTargetGroupOverrideAction(args.targetGroupName);
    },
    persistentApprovalViews: args.persistentApprovalViews,
    policyBundleLastPulledLabel: args.policyBundleLastPulledLabel,
    policyBundleLastPushedLabel: args.policyBundleLastPushedLabel,
    policyBundleSyncBusyAction: args.policyBundleSyncBusyAction,
    policyBundleSyncFilePath: args.policyBundleSyncFilePath,
    policyBundleViews: args.policyBundleViews,
    policyPackViews: args.policyPackViews,
    savedGroupOverrideCount: args.savedGroupOverrideCount,
    selectedEnvironmentTemplateExtraRuleCount:
      args.selectedEnvironmentTemplateExtraRuleCount,
    selectedEnvironmentTemplateLabel: args.selectedEnvironmentTemplateLabel,
    selectedPolicyPackExtraRuleCount: args.selectedPolicyPackExtraRuleCount,
    selectedPolicyPackLabel: args.selectedPolicyPackLabel,
    selectedWorkspaceProfileLabel: args.selectedWorkspaceProfileLabel,
    storedPolicyBundleCount: args.storedPolicyBundleCount,
    supplementalRuleViews: args.supplementalRuleViews,
    syncDangerousCommandSafety: args.syncDangerousCommandSafety,
    targetGroupHint: args.targetGroupHint,
    targetGroupName: args.targetGroupName,
    temporaryApprovalViews: args.temporaryApprovalViews,
    totalBuiltinRuleCount: args.totalBuiltinRuleCount,
    totalExecutionSourceCount: args.totalExecutionSourceCount
  };
}

export function buildSftpSettingsSectionProps(
  args: BuildSftpSettingsSectionPropsArgs
): SftpSectionProps {
  return {
    activeSessionConflictHint: args.activeSessionConflictHint,
    canClearAllDefaults: args.canClearAllDefaults,
    canClearDownloadDefault: args.canClearDownloadDefault,
    canClearUploadDefault: args.canClearUploadDefault,
    concurrencyHint: args.concurrencyHint,
    downloadConcurrency: args.downloadConcurrency,
    downloadRateLimitKiBps: args.downloadRateLimitKiBps,
    hasActiveSessionConflictControls: args.hasActiveSessionConflictControls,
    maxConcurrency: args.maxConcurrency,
    maxPolicyPackCount: args.maxPolicyPackCount,
    maxRateLimitKiBps: args.maxRateLimitKiBps,
    maxRetryBatchConfirmThreshold: args.maxRetryBatchConfirmThreshold,
    minRetryBatchConfirmThreshold: args.minRetryBatchConfirmThreshold,
    onApplyPolicyPack: (packId) => {
      void args.onApplyPolicyPackAction(packId);
    },
    onApplySchedulePreset: args.onApplySchedulePreset,
    onChangePolicyPackSyncTarget: () => {
      void args.onChangePolicyPackSyncTargetAction();
    },
    onClearAllDefaults: args.onClearAllDefaults,
    onClearDownloadDefault: args.onClearDownloadDefault,
    onClearPolicyPackSyncTarget: () => {
      void args.onClearPolicyPackSyncTargetAction();
    },
    onClearUploadDefault: args.onClearUploadDefault,
    onDeletePolicyPack: (packId) => {
      void args.onDeletePolicyPackAction(packId);
    },
    onDownloadConcurrencyChange: args.onDownloadConcurrencyChange,
    onDownloadRateLimitChange: args.onDownloadRateLimitChange,
    onExportAllPolicyPacks: () => {
      void args.onExportAllPolicyPacksAction();
    },
    onExportPolicyPack: (packId) => {
      void args.onExportPolicyPackAction(packId);
    },
    onImportPolicyPacks: () => {
      void args.onImportPolicyPacksAction();
    },
    onPolicyPackAutoPullOnLaunchChange:
      args.onPolicyPackAutoPullOnLaunchChange,
    onPolicyPackAutoPushOnChangeChange:
      args.onPolicyPackAutoPushOnChangeChange,
    onPullPolicyPacksFromSync: () => {
      void args.onPullPolicyPacksFromSyncAction();
    },
    onPushPolicyPacksToSync: () => {
      void args.onPushPolicyPacksToSyncAction();
    },
    onRetryBatchConfirmThresholdChange:
      args.onRetryBatchConfirmThresholdChange,
    onSaveCurrentPolicyPack: () => {
      void args.onSaveCurrentPolicyPackAction();
    },
    onScheduleWindowEnabledChange: args.onScheduleWindowEnabledChange,
    onScheduleWindowEndChange: args.onScheduleWindowEndChange,
    onScheduleWindowStartChange: args.onScheduleWindowStartChange,
    onToggleScheduleDay: args.onToggleScheduleDay,
    onUploadConcurrencyChange: args.onUploadConcurrencyChange,
    onUploadRateLimitChange: args.onUploadRateLimitChange,
    policyPackAutoPullOnLaunch: args.policyPackAutoPullOnLaunch,
    policyPackAutoPushOnChange: args.policyPackAutoPushOnChange,
    policyPackLastSyncLabel: args.policyPackLastSyncLabel,
    policyPackSyncBusyAction: args.policyPackSyncBusyAction,
    policyPackSyncFilePath: args.policyPackSyncFilePath,
    policyPackViews: args.policyPackViews,
    rateLimitHint: args.rateLimitHint,
    retryBatchConfirmThreshold: args.retryBatchConfirmThreshold,
    retryThresholdHint: args.retryThresholdHint,
    scheduleDayOptions: args.scheduleDayOptions,
    scheduleHint: args.scheduleHint,
    schedulePresetViews: args.schedulePresetViews,
    scheduleWindowEnabled: args.scheduleWindowEnabled,
    scheduleWindowEndValue: args.scheduleWindowEndValue,
    scheduleWindowStartValue: args.scheduleWindowStartValue,
    storedPolicyPackCount: args.storedPolicyPackCount,
    uploadConcurrency: args.uploadConcurrency,
    uploadRateLimitKiBps: args.uploadRateLimitKiBps
  };
}

export function buildPortForwardingSettingsSectionProps(
  args: BuildPortForwardingSettingsSectionPropsArgs
): PortForwardingSectionProps {
  return {
    activeEventHistoryCount: args.activeEventHistoryCount,
    activeTabSummary: args.activeTabSummary,
    analyticsView: args.analyticsView,
    eventCorrelationQuery: args.eventCorrelationQuery,
    eventErrorCode: args.eventErrorCode,
    eventErrorCodeOptions: args.eventErrorCodeOptions,
    eventFilter: args.eventFilter,
    eventSummaryLabel: args.eventSummaryLabel,
    eventTimeRange: args.eventTimeRange,
    eventViews: args.eventViews,
    formBindHost: args.formBindHost,
    formBindPort: args.formBindPort,
    formTargetHost: args.formTargetHost,
    formTargetPort: args.formTargetPort,
    formType: args.formType,
    forwardViews: args.forwardViews,
    hasActiveSession: args.hasActiveSession,
    hasActiveTab: args.hasActiveTab,
    hasCustomizedEventView: args.hasCustomizedEventView,
    isActiveTabConnected: args.isActiveTabConnected,
    onClearSessionHistory: () => {
      void args.onClearSessionHistoryAction();
    },
    onClearVisibleHistory: () => {
      void args.onClearVisibleHistoryAction();
    },
    onCreateForward: () => {
      void args.onCreateForwardAction();
    },
    onEventCorrelationQueryChange: args.onEventCorrelationQueryChange,
    onEventErrorCodeChange: args.onEventErrorCodeChange,
    onEventFilterChange: args.onEventFilterChange,
    onEventTimeRangeChange: args.onEventTimeRangeChange,
    onExportAnalyticsCsv: () => {
      void args.onExportAnalyticsCsvAction();
    },
    onExportAnalyticsJson: () => {
      void args.onExportAnalyticsJsonAction();
    },
    onExportSnapshot: () => {
      void args.onExportSnapshotAction();
    },
    onExportVisibleCsv: () => {
      void args.onExportVisibleCsvAction();
    },
    onExportVisibleJson: () => {
      void args.onExportVisibleJsonAction();
    },
    onFormBindHostChange: args.onFormBindHostChange,
    onFormBindPortChange: args.onFormBindPortChange,
    onFormTargetHostChange: args.onFormTargetHostChange,
    onFormTargetPortChange: args.onFormTargetPortChange,
    onFormTypeChange: args.onFormTypeChange,
    onPresetApply: args.onPresetApply,
    onPresetAutoRestoreChange: args.onPresetAutoRestoreChange,
    onPresetDelete: args.onPresetDelete,
    onPresetFillForm: args.onPresetFillForm,
    onRefresh: args.onRefresh,
    onRefreshDiagnostics: args.onRefreshDiagnostics,
    onRemoveForward: args.onRemoveForward,
    onResetEventFilters: args.onResetEventFilters,
    onSavePreset: () => {
      void args.onSavePresetAction();
    },
    portForwardBusy: args.portForwardBusy,
    portForwardStatusMessage: args.portForwardStatusMessage,
    presetViews: args.presetViews,
    visibleEventHistoryCount: args.visibleEventHistoryCount
  };
}

export function buildDiagnosticsSettingsSectionProps(
  args: BuildDiagnosticsSettingsSectionPropsArgs
): DiagnosticsSectionProps {
  return {
    appVersion: args.appVersion,
    autoUpdateAvailability: args.autoUpdateAvailability,
    autoUpdateDownloadedVersion: args.autoUpdateDownloadedVersion,
    autoUpdateDownloadProgressPercent: args.autoUpdateDownloadProgressPercent,
    autoUpdateLatestVersion: args.autoUpdateLatestVersion,
    autoUpdateLastCheckedLabel: args.autoUpdateLastCheckedLabel,
    autoUpdateReadyToInstall: args.autoUpdateReadyToInstall,
    autoUpdateStatusLabel: args.autoUpdateStatusLabel,
    disconnectCaptureEnabled: args.disconnectCaptureEnabled,
    disconnectCaptureHint: args.disconnectCaptureHint,
    disconnectEmptyStateLabel: args.disconnectEmptyStateLabel,
    disconnectQuery: args.disconnectQuery,
    disconnectReportViews: args.disconnectReportViews,
    disconnectScope: args.disconnectScope,
    disconnectTimeRange: args.disconnectTimeRange,
    disconnectTotalCount: args.disconnectTotalCount,
    disconnectTrigger: args.disconnectTrigger,
    disconnectVisibleCount: args.disconnectVisibleCount,
    hasCustomizedDisconnectView: args.hasCustomizedDisconnectView,
    isCheckingForUpdates: args.isCheckingForUpdates,
    isExportingBugReport: args.isExportingBugReport,
    logDirectoryPath: args.logDirectoryPath,
    logFilePath: args.logFilePath,
    onClearAllDisconnects: () => {
      void args.onClearAllDisconnectsAction();
    },
    onClearVisibleDisconnects: () => {
      void args.onClearVisibleDisconnectsAction();
    },
    onCopyDisconnectReportJson: args.onCopyDisconnectReportJson,
    onCopyLatestVisibleDisconnect: () => {
      void args.onCopyLatestVisibleDisconnectAction();
    },
    onCopyLogFilePath: () => {
      void args.onCopyLogFilePathAction();
    },
    onDisconnectCaptureEnabledChange: args.onDisconnectCaptureEnabledChange,
    onDisconnectQueryChange: args.onDisconnectQueryChange,
    onDisconnectScopeChange: args.onDisconnectScopeChange,
    onDisconnectTimeRangeChange: args.onDisconnectTimeRangeChange,
    onDisconnectTriggerChange: args.onDisconnectTriggerChange,
    onExportBugReport: () => {
      void args.onExportBugReportAction();
    },
    onCheckForUpdates: () => {
      void args.onCheckForUpdatesAction();
    },
    onExportDisconnectCsv: () => {
      void args.onExportDisconnectCsvAction();
    },
    onExportDisconnectJson: () => {
      void args.onExportDisconnectJsonAction();
    },
    onFocusDisconnectTab: args.onFocusDisconnectTab,
    onOpenLogDirectory: () => {
      void args.onOpenLogDirectoryAction();
    },
    onRefreshLogInfo: args.onRefreshLogInfo,
    onResetDisconnectFilters: args.onResetDisconnectFilters
  };
}
