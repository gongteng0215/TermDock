import type { BuildDiagnosticsSettingsSectionPropsArgs } from "./settings-section-props";

type DiagnosticsValueArgs = Pick<
  BuildDiagnosticsSettingsSectionPropsArgs,
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

type DiagnosticsActionArgs = Pick<
  BuildDiagnosticsSettingsSectionPropsArgs,
  | "onClearAllDisconnectsAction"
  | "onClearVisibleDisconnectsAction"
  | "onCopyDisconnectReportJson"
  | "onCopyLatestVisibleDisconnectAction"
  | "onCopyLogFilePathAction"
  | "onDisconnectCaptureEnabledChange"
  | "onDisconnectQueryChange"
  | "onDisconnectScopeChange"
  | "onDisconnectTimeRangeChange"
  | "onDisconnectTriggerChange"
  | "onCheckForUpdatesAction"
  | "onExportAppBackupAction"
  | "onExportBugReportAction"
  | "onExportDisconnectCsvAction"
  | "onExportDisconnectJsonAction"
  | "onFocusDisconnectTab"
  | "onImportAppBackupAction"
  | "onOpenLogDirectoryAction"
  | "onRefreshLogInfo"
  | "onResetDisconnectFilters"
>;

interface BuildDisconnectDiagnosticsSettingsArgsInput {
  actions: DiagnosticsActionArgs;
  values: DiagnosticsValueArgs;
}

export function buildDisconnectDiagnosticsSettingsArgs({
  actions,
  values
}: BuildDisconnectDiagnosticsSettingsArgsInput): BuildDiagnosticsSettingsSectionPropsArgs {
  return {
    ...values,
    ...actions
  };
}
