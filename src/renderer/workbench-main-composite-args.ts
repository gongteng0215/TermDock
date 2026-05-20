import { buildTerminalWorkspaceCompositeArgs } from "./terminal-workspace-composite-args";
import { buildTransferDockCompositeArgs } from "./transfer-dock-composite-args";
import {
  type BuildTransferDockCompositePropsArgs,
  type TransferLike
} from "./transfer-dock-props";
import { buildWorkbenchFrameCompositeArgs } from "./workbench-frame-composite-args";

type WorkbenchFrameArgs = Parameters<typeof buildWorkbenchFrameCompositeArgs>[0];
type TerminalWorkspaceActionArgs =
  Parameters<typeof buildTerminalWorkspaceCompositeArgs>[0]["actions"];
type TerminalWorkspaceValueArgs =
  Parameters<typeof buildTerminalWorkspaceCompositeArgs>[0]["values"];

interface BuildWorkbenchFrameArgsInput extends WorkbenchFrameArgs {}

interface BuildTerminalWorkspaceArgsInput {
  actions: TerminalWorkspaceActionArgs;
  values: TerminalWorkspaceValueArgs;
}

interface BuildTransferDockArgsInput<TTransfer extends TransferLike> {
  actions: Pick<
    BuildTransferDockCompositePropsArgs<TTransfer>,
    | "cancelAllActiveDownloads"
    | "cancelAllActiveUploads"
    | "cancelSftpDownload"
    | "cancelSftpUpload"
    | "clearFinishedTransfers"
    | "discardPendingTransferRestoreQueue"
    | "onOpenOperationCenter"
    | "onOpenRetryCenter"
    | "restorePendingTransferRestoreQueue"
    | "retryAllFailedTransfersWithScopeChoice"
    | "retryFailedDownloads"
    | "retryFailedUploads"
  >;
  values: Omit<
    BuildTransferDockCompositePropsArgs<TTransfer>,
    | "cancelAllActiveDownloads"
    | "cancelAllActiveUploads"
    | "cancelSftpDownload"
    | "cancelSftpUpload"
    | "clearFinishedTransfers"
    | "discardPendingTransferRestoreQueue"
    | "onOpenOperationCenter"
    | "onOpenRetryCenter"
    | "restorePendingTransferRestoreQueue"
    | "retryAllFailedTransfersWithScopeChoice"
    | "retryFailedDownloads"
    | "retryFailedUploads"
  >;
}

export function buildWorkbenchFrameArgs({
  inspectorSidebar,
  rootFrame,
  serverHealthInspectorContent,
  serverHealthInspectorSection,
  topbar
}: BuildWorkbenchFrameArgsInput) {
  return buildWorkbenchFrameCompositeArgs({
    inspectorSidebar,
    rootFrame,
    serverHealthInspectorContent,
    serverHealthInspectorSection,
    topbar
  });
}

export function buildTerminalWorkspaceArgs({
  actions,
  values
}: BuildTerminalWorkspaceArgsInput) {
  return buildTerminalWorkspaceCompositeArgs({
    actions,
    values
  });
}

export function buildTransferDockArgs<TTransfer extends TransferLike>({
  actions,
  values
}: BuildTransferDockArgsInput<TTransfer>) {
  return buildTransferDockCompositeArgs({
    actions,
    values
  });
}
