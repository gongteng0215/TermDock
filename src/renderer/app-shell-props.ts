import type { Dispatch, SetStateAction } from "react";

import type {
  AppDialogModalProps,
  MoveGroupDialogModalProps,
  MoveGroupDialogView
} from "./components/app-dialogs";
import type { GlobalErrorBarProps } from "./components/global-error-bar";
import type { ServerHealthDetailModalProps } from "./components/server-health-detail-modal";

interface BuildServerHealthDetailModalPropsArgs
  extends Omit<ServerHealthDetailModalProps, "onRefresh"> {
  refreshServerHealth: () => Promise<void>;
  refreshServerProcesses: () => Promise<void>;
}

export function buildServerHealthDetailModalProps({
  refreshServerHealth,
  refreshServerProcesses,
  ...modalProps
}: BuildServerHealthDetailModalPropsArgs): ServerHealthDetailModalProps {
  return {
    ...modalProps,
    onRefresh: () => {
      void refreshServerHealth();
      void refreshServerProcesses();
    }
  };
}

interface BuildMoveGroupDialogModalPropsArgs
  extends Omit<MoveGroupDialogModalProps, "onSubmit" | "onTargetGroupChange"> {
  setMoveGroupDialog: Dispatch<SetStateAction<MoveGroupDialogView | null>>;
  submitMoveGroupDialog: () => Promise<void>;
}

export function buildMoveGroupDialogModalProps({
  setMoveGroupDialog,
  submitMoveGroupDialog,
  ...modalProps
}: BuildMoveGroupDialogModalPropsArgs): MoveGroupDialogModalProps {
  return {
    ...modalProps,
    onSubmit: () => {
      void submitMoveGroupDialog();
    },
    onTargetGroupChange: (targetGroup) => {
      setMoveGroupDialog((prev) =>
        prev
          ? {
              ...prev,
              targetGroup
            }
          : prev
      );
    }
  };
}

export function buildAppDialogModalProps(
  modalProps: AppDialogModalProps
): AppDialogModalProps {
  return modalProps;
}

interface BuildGlobalErrorBarPropsArgs
  extends Omit<
    GlobalErrorBarProps,
    | "onCopyError"
    | "onCopyLatestDisconnect"
    | "onOpenLogDirectory"
    | "onReconnect"
  > {
  copyGlobalErrorMessage: () => Promise<void>;
  copyLatestDisconnectReport: () => Promise<void>;
  onOpenCommandHistoryManager: () => void;
  onOpenSessionTemplateManager: () => void;
  onOpenSnippetManager: () => void;
  openLogDirectory: () => Promise<void>;
  reconnectActiveTabFromError: () => Promise<void>;
}

export function buildGlobalErrorBarProps({
  copyGlobalErrorMessage,
  copyLatestDisconnectReport,
  onOpenCommandHistoryManager,
  onOpenSessionTemplateManager,
  onOpenSnippetManager,
  openLogDirectory,
  reconnectActiveTabFromError,
  ...modalProps
}: BuildGlobalErrorBarPropsArgs): GlobalErrorBarProps {
  return {
    ...modalProps,
    onOpenCommandHistoryManager,
    onOpenSessionTemplateManager,
    onOpenSnippetManager,
    onCopyError: () => {
      void copyGlobalErrorMessage();
    },
    onCopyLatestDisconnect: () => {
      void copyLatestDisconnectReport();
    },
    onOpenLogDirectory: () => {
      void openLogDirectory();
    },
    onReconnect: () => {
      void reconnectActiveTabFromError();
    }
  };
}
