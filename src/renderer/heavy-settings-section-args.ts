import type {
  BuildPortForwardingSettingsSectionPropsArgs,
  BuildSafetySettingsSectionPropsArgs,
  BuildSftpSettingsSectionPropsArgs
} from "./settings-section-props";

type PortForwardingValueArgs = Pick<
  BuildPortForwardingSettingsSectionPropsArgs,
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

type PortForwardingActionArgs = Omit<
  BuildPortForwardingSettingsSectionPropsArgs,
  keyof PortForwardingValueArgs
>;

type SafetyValueArgs = Pick<
  BuildSafetySettingsSectionPropsArgs,
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

type SafetyActionArgs = Omit<
  BuildSafetySettingsSectionPropsArgs,
  keyof SafetyValueArgs
>;

type SftpValueArgs = Pick<
  BuildSftpSettingsSectionPropsArgs,
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

type SftpActionArgs = Omit<
  BuildSftpSettingsSectionPropsArgs,
  keyof SftpValueArgs
>;

export function buildPortForwardingSettingsArgs({
  actions,
  values
}: {
  actions: PortForwardingActionArgs;
  values: PortForwardingValueArgs;
}): BuildPortForwardingSettingsSectionPropsArgs {
  return {
    ...values,
    ...actions
  };
}

export function buildSafetySettingsArgs({
  actions,
  values
}: {
  actions: SafetyActionArgs;
  values: SafetyValueArgs;
}): BuildSafetySettingsSectionPropsArgs {
  return {
    ...values,
    ...actions
  };
}

export function buildSftpSettingsArgs({
  actions,
  values
}: {
  actions: SftpActionArgs;
  values: SftpValueArgs;
}): BuildSftpSettingsSectionPropsArgs {
  return {
    ...values,
    ...actions
  };
}
