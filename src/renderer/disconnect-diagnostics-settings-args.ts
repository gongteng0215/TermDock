import type { BuildDiagnosticsSettingsSectionPropsArgs } from "./settings-section-props";

type DiagnosticsValueArgs = Pick<
  BuildDiagnosticsSettingsSectionPropsArgs,
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
  | "onExportBugReportAction"
  | "onExportDisconnectCsvAction"
  | "onExportDisconnectJsonAction"
  | "onFocusDisconnectTab"
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
