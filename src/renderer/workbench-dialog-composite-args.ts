import type { BuildWorkbenchDialogCompositePropsArgs } from "./workbench-dialog-composite-props";

type AppDialogArgs = BuildWorkbenchDialogCompositePropsArgs["appDialog"];
type AppInlineHintArgs = BuildWorkbenchDialogCompositePropsArgs["appInlineHint"];
type CommandHistoryManagerArgs =
  BuildWorkbenchDialogCompositePropsArgs["commandHistoryManager"];
type CommandSnippetManagerArgs =
  BuildWorkbenchDialogCompositePropsArgs["commandSnippetManager"];
type GlobalErrorBarArgs = BuildWorkbenchDialogCompositePropsArgs["globalErrorBar"];
type MoveGroupDialogArgs = BuildWorkbenchDialogCompositePropsArgs["moveGroupDialog"];
type OperationCenterArgs =
  BuildWorkbenchDialogCompositePropsArgs["operationCenter"];
type RetryCenterArgs = BuildWorkbenchDialogCompositePropsArgs["retryCenter"];
type ServerHealthDetailArgs =
  BuildWorkbenchDialogCompositePropsArgs["serverHealthDetail"];
type SessionCreateArgs = BuildWorkbenchDialogCompositePropsArgs["sessionCreate"];
type SessionTemplateManagerArgs =
  BuildWorkbenchDialogCompositePropsArgs["sessionTemplateManager"];

type AppDialogActionArgs = Pick<
  AppDialogArgs,
  "onClose" | "onInputChange" | "onResolveOption" | "onSubmit"
>;

type AppInlineHintActionArgs = Pick<
  AppInlineHintArgs,
  | "approveDangerousCommandWithScope"
  | "onDismissHint"
  | "resolveDangerousCommandApproval"
  | "saveDangerousCommandPersistentApproval"
>;

type CommandHistoryManagerActionArgs = Pick<
  CommandHistoryManagerArgs,
  | "addTerminalCommandHistoryEntry"
  | "editTerminalCommandHistoryEntry"
  | "exportTerminalCommandHistory"
  | "importTerminalCommandHistory"
  | "onClearSelection"
  | "onClose"
  | "onDeleteAll"
  | "onDeleteSelected"
  | "onDeleteVisible"
  | "onToggleEntrySelection"
  | "onToggleSelectVisible"
  | "pasteTerminalCommandHistoryEntry"
>;

type CommandSnippetManagerActionArgs = Pick<
  CommandSnippetManagerArgs,
  | "clearAllCommandSnippetGroups"
  | "clearCommandSnippetScopedValues"
  | "deleteCommandSnippetManagerGroup"
  | "deleteCommandSnippetManagerSnippet"
  | "deleteSelectedCommandSnippetManagerPromptSet"
  | "exportCommandSnippetGroups"
  | "onAddGroup"
  | "onAddPromptSet"
  | "onAddPromptSetParameter"
  | "onAddSnippet"
  | "onAddSnippetParameter"
  | "onClose"
  | "onDeletePromptSetParameter"
  | "onDeleteSnippetParameter"
  | "onGroupNameChange"
  | "onImportJson"
  | "onInsertPromptSetParameterToken"
  | "onInsertSnippetParameterToken"
  | "onPromptSetNameChange"
  | "onPromptSetParameterDefaultChange"
  | "onPromptSetParameterKeyChange"
  | "onPromptSetParameterLabelChange"
  | "onPromptSetParameterPatternChange"
  | "onPromptSetParameterRequiredChange"
  | "onPromptSetParameterScopeChange"
  | "onRunSnippet"
  | "onSelectGroup"
  | "onSelectedGroupNameBlur"
  | "onSelectedPromptSetNameBlur"
  | "onSelectedSnippetNameBlur"
  | "onSelectSnippet"
  | "onSnippetConfirmChange"
  | "onSnippetNameChange"
  | "onSnippetParameterDefaultChange"
  | "onSnippetParameterKeyChange"
  | "onSnippetParameterLabelChange"
  | "onSnippetParameterPatternChange"
  | "onSnippetParameterRequiredChange"
  | "onSnippetParameterScopeChange"
  | "onSnippetPreviewChange"
  | "onSnippetPromptSetChange"
  | "onSnippetTemplateChange"
>;

type GlobalErrorBarActionArgs = Pick<
  GlobalErrorBarArgs,
  | "copyGlobalErrorMessage"
  | "copyLatestDisconnectReport"
  | "onDismiss"
  | "onExportBugReport"
  | "onOpenConnectionSettings"
  | "onOpenDiagnostics"
  | "onOpenFileOpeningSettings"
  | "onOpenHotkeysSettings"
  | "onOpenOperationCenter"
  | "onOpenPortForwardingSettings"
  | "onOpenRetryCenter"
  | "onOpenSafetySettings"
  | "onOpenServerHealthSettings"
  | "onOpenSftpSettings"
  | "onOpenWorkspaceSettings"
  | "openLogDirectory"
  | "reconnectActiveTabFromError"
>;

type MoveGroupDialogActionArgs = Pick<
  MoveGroupDialogArgs,
  "onClose" | "setMoveGroupDialog" | "submitMoveGroupDialog"
>;

type OperationCenterActionArgs = Pick<
  OperationCenterArgs,
  | "cancelAllActiveDownloads"
  | "cancelAllActiveUploads"
  | "cancelAllTransfersAcrossTabs"
  | "cancelTransferTasksForTab"
  | "clearFinishedOperationCenterAppJobs"
  | "copyOperationCenterAppJobOutputPath"
  | "onClose"
  | "onFocusTab"
  | "onOpenDiagnostics"
  | "onOpenDiagnosticsJobs"
  | "onOpenPortForward"
  | "onOpenSnippets"
  | "reconnectDisconnectedOperationTabs"
  | "reconnectOperationTabById"
  | "retryAllFailedTransfersWithScopeChoice"
  | "retryFailedDownloads"
  | "retryFailedUploads"
>;

type RetryCenterActionArgs = Pick<
  RetryCenterArgs,
  | "changeRetryBatchConfirmThreshold"
  | "clearAllRetryCenterEntries"
  | "clearRetryCenterGroupEntries"
  | "clearSelectedRetryCenterEntries"
  | "clearVisibleRetryCenterEntries"
  | "clearVisibleRetryCenterEntriesByFailureReason"
  | "exportRetryCenterAnalyticsCsv"
  | "exportRetryCenterAnalyticsJson"
  | "exportRetryCenterGroupHistoryCsvWithScopeChoice"
  | "exportRetryCenterGroupHistoryJsonWithScopeChoice"
  | "exportRetryCenterVisibleHistoryCsv"
  | "exportRetryCenterVisibleHistoryJson"
  | "onClearSelection"
  | "onClose"
  | "onCollapseAllGroups"
  | "onDirectionChange"
  | "onExpandAllGroups"
  | "onFailureReasonFilterChange"
  | "onLastRetryScopeChange"
  | "onListModeChange"
  | "onQueryChange"
  | "onResetFilters"
  | "onScopeChange"
  | "onSelectAllVisible"
  | "onSelectGroupEntries"
  | "onStatusChange"
  | "onTimeRangeChange"
  | "onToggleEntrySelection"
  | "onToggleGroupCollapsed"
  | "retryAllFailedTransfersWithScopeChoice"
  | "retryFailedDownloads"
  | "retryFailedUploads"
  | "retryRetryCenterGroupFailedEntries"
  | "retrySelectedRetryCenterEntriesWithScopeChoice"
  | "retryVisibleRetryCenterEntriesWithScopeChoice"
  | "toggleRetryCenterAutoUseLastRetryScope"
>;

type ServerHealthDetailActionArgs = Pick<
  ServerHealthDetailArgs,
  "onClose" | "onSelectTab" | "refreshServerHealth" | "refreshServerProcesses"
>;

type SessionCreateActionArgs = Pick<
  SessionCreateArgs,
  | "chooseSessionTemplateAndApply"
  | "handleTestConnection"
  | "onClose"
  | "onFormChange"
  | "onSubmit"
  | "openSessionTemplateManager"
  | "pickPrivateKeyFile"
>;

type SessionTemplateManagerActionArgs = Pick<
  SessionTemplateManagerArgs,
  | "applySessionTemplateToForm"
  | "deleteEditingSessionTemplate"
  | "onAddEnvVar"
  | "onClose"
  | "onDraftFieldChange"
  | "onRemoveEnvVar"
  | "onResetDraft"
  | "onSelectTemplate"
  | "onUpdateEnvVar"
  | "saveSessionTemplateDraft"
  | "startSessionTemplateDraftFromForm"
>;

interface BuildAppDialogArgsInput {
  actions: AppDialogActionArgs;
  values: Omit<AppDialogArgs, keyof AppDialogActionArgs>;
}

interface BuildAppInlineHintArgsInput {
  actions: AppInlineHintActionArgs;
  values: Omit<AppInlineHintArgs, keyof AppInlineHintActionArgs>;
}

interface BuildCommandHistoryManagerDialogArgsInput {
  actions: CommandHistoryManagerActionArgs;
  values: Omit<CommandHistoryManagerArgs, keyof CommandHistoryManagerActionArgs>;
}

interface BuildCommandSnippetManagerDialogArgsInput {
  actions: CommandSnippetManagerActionArgs;
  values: Omit<CommandSnippetManagerArgs, keyof CommandSnippetManagerActionArgs>;
}

interface BuildGlobalErrorBarDialogArgsInput {
  actions: GlobalErrorBarActionArgs;
  values: Omit<GlobalErrorBarArgs, keyof GlobalErrorBarActionArgs>;
}

interface BuildMoveGroupDialogArgsInput {
  actions: MoveGroupDialogActionArgs;
  values: Omit<MoveGroupDialogArgs, keyof MoveGroupDialogActionArgs>;
}

interface BuildOperationCenterDialogArgsInput {
  actions: OperationCenterActionArgs;
  values: Omit<OperationCenterArgs, keyof OperationCenterActionArgs>;
}

interface BuildRetryCenterDialogArgsInput {
  actions: RetryCenterActionArgs;
  values: Omit<RetryCenterArgs, keyof RetryCenterActionArgs>;
}

interface BuildServerHealthDetailDialogArgsInput {
  actions: ServerHealthDetailActionArgs;
  values: Omit<ServerHealthDetailArgs, keyof ServerHealthDetailActionArgs>;
}

interface BuildSessionCreateDialogArgsInput {
  actions: SessionCreateActionArgs;
  values: Omit<SessionCreateArgs, keyof SessionCreateActionArgs>;
}

interface BuildSessionTemplateManagerDialogArgsInput {
  actions: SessionTemplateManagerActionArgs;
  values: Omit<
    SessionTemplateManagerArgs,
    keyof SessionTemplateManagerActionArgs
  >;
}

export function buildAppDialogArgs({
  actions,
  values
}: BuildAppDialogArgsInput): AppDialogArgs {
  return {
    ...values,
    ...actions
  };
}

export function buildAppInlineHintArgs({
  actions,
  values
}: BuildAppInlineHintArgsInput): AppInlineHintArgs {
  return {
    ...values,
    ...actions
  };
}

export function buildCommandHistoryManagerDialogArgs({
  actions,
  values
}: BuildCommandHistoryManagerDialogArgsInput): CommandHistoryManagerArgs {
  return {
    ...values,
    ...actions
  };
}

export function buildCommandSnippetManagerDialogArgs({
  actions,
  values
}: BuildCommandSnippetManagerDialogArgsInput): CommandSnippetManagerArgs {
  return {
    ...values,
    ...actions
  };
}

export function buildGlobalErrorBarDialogArgs({
  actions,
  values
}: BuildGlobalErrorBarDialogArgsInput): GlobalErrorBarArgs {
  return {
    ...values,
    ...actions
  };
}

export function buildMoveGroupDialogArgs({
  actions,
  values
}: BuildMoveGroupDialogArgsInput): MoveGroupDialogArgs {
  return {
    ...values,
    ...actions
  };
}

export function buildOperationCenterDialogArgs({
  actions,
  values
}: BuildOperationCenterDialogArgsInput): OperationCenterArgs {
  return {
    ...values,
    ...actions
  };
}

export function buildServerHealthDetailDialogArgs({
  actions,
  values
}: BuildServerHealthDetailDialogArgsInput): ServerHealthDetailArgs {
  return {
    ...values,
    ...actions
  };
}

export function buildSessionCreateDialogArgs({
  actions,
  values
}: BuildSessionCreateDialogArgsInput): SessionCreateArgs {
  return {
    ...values,
    ...actions
  };
}

export function buildSessionTemplateManagerDialogArgs({
  actions,
  values
}: BuildSessionTemplateManagerDialogArgsInput): SessionTemplateManagerArgs {
  return {
    ...values,
    ...actions
  };
}

export function buildRetryCenterDialogArgs({
  actions,
  values
}: BuildRetryCenterDialogArgsInput): RetryCenterArgs {
  return {
    ...values,
    ...actions
  };
}
