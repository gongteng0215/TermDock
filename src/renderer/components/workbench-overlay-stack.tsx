import type { ComponentProps, Ref } from "react";

import { AppDialogModal, MoveGroupDialogModal } from "./app-dialogs";
import { CommandHistoryManagerModalHost } from "./command-history-manager-modal-host";
import { CommandSnippetManagerModalHost } from "./command-snippet-manager-modal-host";
import { GlobalErrorBar } from "./global-error-bar";
import { OperationCenterModalHost } from "./operation-center-modal-host";
import { RetryCenterModalHost } from "./retry-center-modal-host";
import { ServerHealthDetailModal } from "./server-health-detail-modal";
import { SessionCreateModal } from "./session-create-modal";
import { SessionTemplateManagerModal } from "./session-template-manager-modal";
import { SettingsModalContent } from "./settings-modal-content";
import { SettingsModalShell } from "./settings-modal-shell";
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
      <ServerHealthDetailModal {...serverHealthDetailModalProps} />
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

      <SettingsModalShell {...settingsModalShellProps}>
        <SettingsModalContent {...settingsModalContentProps} />
      </SettingsModalShell>

      <SessionCreateModal {...sessionCreateModalProps} />
      <SessionTemplateManagerModal {...sessionTemplateManagerModalProps} />
      <MoveGroupDialogModal {...moveGroupDialogModalProps} />
      <AppDialogModal {...appDialogModalProps} />
      <GlobalErrorBar {...globalErrorBarProps} />
    </>
  );
}
