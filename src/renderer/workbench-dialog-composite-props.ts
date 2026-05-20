import {
  buildAppDialogModalProps,
  buildGlobalErrorBarProps,
  buildMoveGroupDialogModalProps,
  buildServerHealthDetailModalProps
} from "./app-shell-props";
import { buildCommandHistoryManagerModalProps } from "./command-history-manager-modal-props";
import { buildCommandSnippetManagerModalProps } from "./command-snippet-manager-modal-props";
import {
  buildSessionCreateModalProps,
  buildSessionTemplateManagerModalProps
} from "./session-modal-props";
import { buildAppInlineHintPanelProps } from "./workbench-overlay-props";
import {
  buildOperationCenterModalProps,
  buildRetryCenterModalProps
} from "./workbench-modal-props";

type AppDialogArgs = Parameters<typeof buildAppDialogModalProps>[0];
type AppInlineHintArgs = Parameters<typeof buildAppInlineHintPanelProps>[0];
type CommandHistoryManagerArgs =
  Parameters<typeof buildCommandHistoryManagerModalProps>[0];
type CommandSnippetManagerArgs =
  Parameters<typeof buildCommandSnippetManagerModalProps>[0];
type GlobalErrorBarArgs = Parameters<typeof buildGlobalErrorBarProps>[0];
type MoveGroupDialogArgs = Parameters<typeof buildMoveGroupDialogModalProps>[0];
type OperationCenterArgs = Parameters<typeof buildOperationCenterModalProps>[0];
type RetryCenterArgs = Parameters<typeof buildRetryCenterModalProps>[0];
type ServerHealthDetailArgs =
  Parameters<typeof buildServerHealthDetailModalProps>[0];
type SessionCreateArgs = Parameters<typeof buildSessionCreateModalProps>[0];
type SessionTemplateManagerArgs =
  Parameters<typeof buildSessionTemplateManagerModalProps>[0];

export interface BuildWorkbenchDialogCompositePropsArgs {
  appDialog: AppDialogArgs;
  appInlineHint: AppInlineHintArgs;
  commandHistoryManager: CommandHistoryManagerArgs;
  commandSnippetManager: CommandSnippetManagerArgs;
  globalErrorBar: GlobalErrorBarArgs;
  moveGroupDialog: MoveGroupDialogArgs;
  operationCenter: OperationCenterArgs;
  retryCenter: RetryCenterArgs;
  serverHealthDetail: ServerHealthDetailArgs;
  sessionCreate: SessionCreateArgs;
  sessionTemplateManager: SessionTemplateManagerArgs;
}

export function buildWorkbenchDialogCompositeProps({
  appDialog,
  appInlineHint,
  commandHistoryManager,
  commandSnippetManager,
  globalErrorBar,
  moveGroupDialog,
  operationCenter,
  retryCenter,
  serverHealthDetail,
  sessionCreate,
  sessionTemplateManager
}: BuildWorkbenchDialogCompositePropsArgs) {
  return {
    appDialogModalProps: buildAppDialogModalProps(appDialog),
    appInlineHintPanelProps: buildAppInlineHintPanelProps(appInlineHint),
    commandHistoryManagerModalProps:
      buildCommandHistoryManagerModalProps(commandHistoryManager),
    commandSnippetManagerModalProps:
      buildCommandSnippetManagerModalProps(commandSnippetManager),
    globalErrorBarProps: buildGlobalErrorBarProps(globalErrorBar),
    moveGroupDialogModalProps: buildMoveGroupDialogModalProps(moveGroupDialog),
    operationCenterModalProps: buildOperationCenterModalProps(operationCenter),
    retryCenterModalProps: buildRetryCenterModalProps(retryCenter),
    serverHealthDetailModalProps:
      buildServerHealthDetailModalProps(serverHealthDetail),
    sessionCreateModalProps: buildSessionCreateModalProps(sessionCreate),
    sessionTemplateManagerModalProps:
      buildSessionTemplateManagerModalProps(sessionTemplateManager)
  };
}
