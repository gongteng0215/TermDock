import type {
  WorkbenchContextMenuAction,
  WorkbenchContextMenuProps
} from "./components/workbench-context-menus";
import type {
  AppInlineHintPanelProps,
  TransferDockProps
} from "./components/workbench-shell";
import type {
  DangerousCommandApprovalScopeId,
  DangerousCommandApprovalState
} from "./use-dangerous-command-approval-flow";

interface BuildAppInlineHintPanelPropsArgs
  extends Omit<
    AppInlineHintPanelProps,
    | "approval"
    | "onAllowInGroup"
    | "onAllowInTab"
    | "onCancelApproval"
    | "onRunOnce"
    | "onSavePolicy"
  > {
  approveDangerousCommandWithScope: (scope: DangerousCommandApprovalScopeId) => void;
  dangerousCommandApproval: DangerousCommandApprovalState | null;
  resolveDangerousCommandApproval: (approved: boolean) => void;
  saveDangerousCommandPersistentApproval: () => Promise<void>;
}

export function buildAppInlineHintPanelProps({
  approveDangerousCommandWithScope,
  dangerousCommandApproval,
  resolveDangerousCommandApproval,
  saveDangerousCommandPersistentApproval,
  ...panelProps
}: BuildAppInlineHintPanelPropsArgs): AppInlineHintPanelProps {
  return {
    ...panelProps,
    approval: dangerousCommandApproval
      ? {
          allowInGroup: Boolean(dangerousCommandApproval.request.result.sessionGroupName),
          commandText: dangerousCommandApproval.request.result.commandText,
          contextSummary: dangerousCommandApproval.contextSummary,
          preview: dangerousCommandApproval.request.result.preview,
          ruleSummary: dangerousCommandApproval.ruleSummary,
          severity: dangerousCommandApproval.request.result.severity,
          sourceLabel: dangerousCommandApproval.sourceLabel
        }
      : null,
    onAllowInGroup: () => approveDangerousCommandWithScope("sessionGroup"),
    onAllowInTab: () => approveDangerousCommandWithScope("tab"),
    onCancelApproval: () => resolveDangerousCommandApproval(false),
    onRunOnce: () => resolveDangerousCommandApproval(true),
    onSavePolicy: () => {
      void saveDangerousCommandPersistentApproval();
    }
  };
}

interface WorkbenchContextMenuPosition {
  x: number;
  y: number;
}

interface BuildWorkbenchContextMenuPropsArgs
  extends Omit<WorkbenchContextMenuProps, "x" | "y"> {
  menu: WorkbenchContextMenuPosition | null;
}

export function buildWorkbenchContextMenuProps({
  menu,
  ...menuProps
}: BuildWorkbenchContextMenuPropsArgs): WorkbenchContextMenuProps | null {
  if (!menu) {
    return null;
  }
  return {
    ...menuProps,
    x: menu.x,
    y: menu.y
  };
}

interface BuildActionWorkbenchContextMenuPropsArgs<
  TAction extends {
    id: string;
    label: string;
    disabled?: boolean;
    danger?: boolean;
  }
> {
  actions: TAction[];
  menu: WorkbenchContextMenuPosition | null;
  onSelect: (action: TAction) => void;
  width: number;
}

export function buildActionWorkbenchContextMenuProps<
  TAction extends {
    id: string;
    label: string;
    disabled?: boolean;
    danger?: boolean;
  }
>({
  actions,
  menu,
  onSelect,
  width
}: BuildActionWorkbenchContextMenuPropsArgs<TAction>): WorkbenchContextMenuProps | null {
  if (!menu || actions.length === 0) {
    return null;
  }
  return {
    actions: actions.map((action) => ({
      danger: action.danger,
      disabled: action.disabled,
      id: action.id,
      label: action.label,
      onSelect: () => onSelect(action)
    })),
    height: actions.length * 26 + 16,
    width,
    x: menu.x,
    y: menu.y
  };
}

export function buildSessionWorkbenchContextMenuProps({
  actions,
  menu,
  width
}: {
  actions: WorkbenchContextMenuAction[];
  menu: WorkbenchContextMenuPosition | null;
  width: number;
}): WorkbenchContextMenuProps | null {
  if (!menu || actions.length === 0) {
    return null;
  }
  return {
    actions,
    height: actions.length * 26 + 16,
    width,
    x: menu.x,
    y: menu.y
  };
}

interface BuildTransferDockPanelPropsArgs<TTransfer>
  extends Omit<
    TransferDockProps["uploadPanel"],
    "onCancelAll" | "onClearFinished" | "onRetryFailed" | "transfers"
  > {
  cancelAllAction: () => Promise<void>;
  canCancelTransfer: (transfer: TTransfer) => boolean;
  clearFinishedAction: () => void;
  getTransferDirection: (transfer: TTransfer) => "upload" | "download";
  getTransferId: (transfer: TTransfer) => string;
  getTransferName: (transfer: TTransfer) => string;
  getTransferProgressLabel: (transfer: TTransfer) => string;
  getTransferStatus: (transfer: TTransfer) => string;
  getTransferTimeLabel: (transfer: TTransfer) => string | null;
  onCancelTransferAction: (transfer: TTransfer) => Promise<void>;
  retryFailedAction: () => Promise<void>;
  transfers: TTransfer[];
}

export function buildTransferDockPanelProps<TTransfer>({
  cancelAllAction,
  canCancelTransfer,
  clearFinishedAction,
  getTransferDirection,
  getTransferId,
  getTransferName,
  getTransferProgressLabel,
  getTransferStatus,
  getTransferTimeLabel,
  onCancelTransferAction,
  retryFailedAction,
  transfers,
  ...panelProps
}: BuildTransferDockPanelPropsArgs<TTransfer>): TransferDockProps["uploadPanel"] {
  return {
    ...panelProps,
    onCancelAll: () => {
      void cancelAllAction();
    },
    onClearFinished: clearFinishedAction,
    onRetryFailed: () => {
      void retryFailedAction();
    },
    transfers: transfers.map((transfer) => ({
      canCancel: canCancelTransfer(transfer),
      direction: getTransferDirection(transfer),
      name: getTransferName(transfer),
      onCancel: () => {
        void onCancelTransferAction(transfer);
      },
      progressLabel: getTransferProgressLabel(transfer),
      status: getTransferStatus(transfer),
      timeLabel: getTransferTimeLabel(transfer),
      transferId: getTransferId(transfer)
    }))
  };
}

interface BuildTransferDockPropsArgs
  extends Omit<TransferDockProps, "onDiscardPending" | "onRestorePending" | "onRetryAllFailed"> {
  discardPendingTransferRestoreQueue: () => Promise<void>;
  restorePendingTransferRestoreQueue: () => Promise<void>;
  retryAllFailedTransfersWithScopeChoice: () => Promise<void>;
}

export function buildTransferDockProps({
  discardPendingTransferRestoreQueue,
  restorePendingTransferRestoreQueue,
  retryAllFailedTransfersWithScopeChoice,
  ...dockProps
}: BuildTransferDockPropsArgs): TransferDockProps {
  return {
    ...dockProps,
    onDiscardPending: () => {
      void discardPendingTransferRestoreQueue();
    },
    onRestorePending: () => {
      void restorePendingTransferRestoreQueue();
    },
    onRetryAllFailed: () => {
      void retryAllFailedTransfersWithScopeChoice();
    }
  };
}
