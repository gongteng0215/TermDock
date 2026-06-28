import type { ComponentProps, Ref } from "react";

import { AppDialogModal, MoveGroupDialogModal } from "./app-dialogs";
import { CommandHistoryManagerModalHost } from "./command-history-manager-modal-host";
import { CommandSnippetManagerModalHost } from "./command-snippet-manager-modal-host";
import { GlobalErrorBar } from "./global-error-bar";
import { OperationCenterModalHost } from "./operation-center-modal-host";
import { RetryCenterModalHost } from "./retry-center-modal-host";
import { ServerHealthDetailModalHost } from "./server-health-detail-modal-host";
import type { ServerHealthDetailModal } from "./server-health-detail-modal";
import { SessionCreateModalHost } from "./session-create-modal-host";
import type { SessionCreateModal } from "./session-create-modal";
import { SessionTemplateManagerModalHost } from "./session-template-manager-modal-host";
import type { SessionTemplateManagerModal } from "./session-template-manager-modal";
import { SettingsModalHost } from "./settings-modal-host";
import type { SettingsModalContent } from "./settings-modal-content";
import type { SettingsModalShell } from "./settings-modal-shell";
import { WorkbenchContextMenu } from "./workbench-context-menus";

export interface WorkbenchOverlayStackProps {
  appDialogModalProps: ComponentProps<typeof AppDialogModal>;
  commandHistoryContextMenuProps: ComponentProps<typeof WorkbenchContextMenu> | null;
  commandHistoryContextMenuRef: Ref<HTMLDivElement>;
  commandHistoryManagerModalProps: ComponentProps<typeof CommandHistoryManagerModalHost>["modalProps"];
  commandSnippetManagerModalProps: ComponentProps<typeof CommandSnippetManagerModalHost>["modalProps"];
  globalErrorBarProps: ComponentProps<typeof GlobalErrorBar>;
  moveGroupDialogModalProps: ComponentProps<typeof MoveGroupDialogModal>;
  operationCenterModalProps: ComponentProps<typeof OperationCenterModalHost>["modalProps"];
  retryCenterModalProps: ComponentProps<typeof RetryCenterModalHost>["modalProps"];
  serverHealthDetailModalProps: ComponentProps<typeof ServerHealthDetailModal>;
  sessionContextMenuProps: ComponentProps<typeof WorkbenchContextMenu> | null;
  sessionContextMenuRef: Ref<HTMLDivElement>;
  sessionCreateModalProps: ComponentProps<typeof SessionCreateModal>;
  sessionTemplateManagerModalProps: ComponentProps<typeof SessionTemplateManagerModal>;
  settingsModalContentProps: ComponentProps<typeof SettingsModalContent>;
  settingsModalShellProps: Omit<ComponentProps<typeof SettingsModalShell>, "children">;
  sftpEntryContextMenuProps: ComponentProps<typeof WorkbenchContextMenu> | null;
  sftpEntryContextMenuRef: Ref<HTMLDivElement>;
  sftpToolbarContextMenuProps: ComponentProps<typeof WorkbenchContextMenu> | null;
  sftpToolbarContextMenuRef: Ref<HTMLDivElement>;
}

export function WorkbenchOverlayStack({
  appDialogModalProps,
  commandHistoryContextMenuProps,
  commandHistoryContextMenuRef,
  commandHistoryManagerModalProps,
  commandSnippetManagerModalProps,
  globalErrorBarProps,
  moveGroupDialogModalProps,
  operationCenterModalProps,
  retryCenterModalProps,
  serverHealthDetailModalProps,
  sessionContextMenuProps,
  sessionContextMenuRef,
  sessionCreateModalProps,
  sessionTemplateManagerModalProps,
  settingsModalContentProps,
  settingsModalShellProps,
  sftpEntryContextMenuProps,
  sftpEntryContextMenuRef,
  sftpToolbarContextMenuProps,
  sftpToolbarContextMenuRef
}: WorkbenchOverlayStackProps) {
  return (
    <>
      <ServerHealthDetailModalHost modalProps={serverHealthDetailModalProps} />
      <OperationCenterModalHost modalProps={operationCenterModalProps} />
      <RetryCenterModalHost modalProps={retryCenterModalProps} />
      <CommandHistoryManagerModalHost modalProps={commandHistoryManagerModalProps} />
      <CommandSnippetManagerModalHost modalProps={commandSnippetManagerModalProps} />

      {commandHistoryContextMenuProps ? (
        <WorkbenchContextMenu
          {...commandHistoryContextMenuProps}
          ref={commandHistoryContextMenuRef}
        />
      ) : null}

      {sftpToolbarContextMenuProps ? (
        <WorkbenchContextMenu {...sftpToolbarContextMenuProps} ref={sftpToolbarContextMenuRef} />
      ) : null}

      {sftpEntryContextMenuProps ? (
        <WorkbenchContextMenu {...sftpEntryContextMenuProps} ref={sftpEntryContextMenuRef} />
      ) : null}

      {sessionContextMenuProps ? (
        <WorkbenchContextMenu {...sessionContextMenuProps} ref={sessionContextMenuRef} />
      ) : null}

      <SettingsModalHost
        shellProps={settingsModalShellProps}
        contentProps={settingsModalContentProps}
      />

      <SessionCreateModalHost modalProps={sessionCreateModalProps} />
      <SessionTemplateManagerModalHost modalProps={sessionTemplateManagerModalProps} />
      <MoveGroupDialogModal {...moveGroupDialogModalProps} />
      <AppDialogModal {...appDialogModalProps} />
      <GlobalErrorBar {...globalErrorBarProps} />
    </>
  );
}
