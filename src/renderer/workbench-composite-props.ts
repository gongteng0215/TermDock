import { buildTerminalWorkspaceProps } from "./terminal-workspace-props";
import type {
  BuildTransferDockCompositePropsArgs,
  TransferLike
} from "./transfer-dock-props";
import { buildTransferDockCompositeProps } from "./transfer-dock-props";
import {
  buildCommandHistoryInspectorSectionProps,
  buildServerHealthInspectorContentProps,
  buildServerHealthInspectorSectionProps,
  buildWorkbenchInspectorSidebarProps,
  buildWorkbenchTopbarProps
} from "./workbench-frame-props";
import {
  buildWorkbenchAppShellProps,
  buildWorkbenchOverlayStackProps,
  buildWorkbenchRootFrameProps
} from "./workbench-host-props";
import {
  buildSessionsInspectorSectionProps,
  buildSftpExplorerSectionProps
} from "./workbench-panel-props";

type WorkbenchTopbarArgs = Parameters<typeof buildWorkbenchTopbarProps>[0];
type WorkbenchInspectorSidebarArgs =
  Parameters<typeof buildWorkbenchInspectorSidebarProps>[0];
type SftpExplorerSectionArgs = Parameters<typeof buildSftpExplorerSectionProps>[0];
type SessionsInspectorSectionArgs =
  Parameters<typeof buildSessionsInspectorSectionProps>[0];
type ServerHealthInspectorSectionArgs =
  Parameters<typeof buildServerHealthInspectorSectionProps>[0];
type ServerHealthInspectorContentArgs =
  Parameters<typeof buildServerHealthInspectorContentProps>[0];
type CommandHistoryInspectorSectionArgs =
  Parameters<typeof buildCommandHistoryInspectorSectionProps>[0];
type TerminalWorkspaceArgs = Parameters<typeof buildTerminalWorkspaceProps>[0];
type WorkbenchAppShellBaseArgs = Omit<
  Parameters<typeof buildWorkbenchAppShellProps>[0],
  | "commandHistoryInspectorSectionProps"
  | "inspectorSidebarProps"
  | "serverHealthInspectorContentProps"
  | "serverHealthInspectorSectionProps"
  | "sessionsInspectorSectionProps"
  | "sftpExplorerSectionProps"
  | "terminalWorkspaceProps"
  | "topbarProps"
  | "transferDockProps"
>;
type WorkbenchOverlayStackArgs =
  Parameters<typeof buildWorkbenchOverlayStackProps>[0];
type WorkbenchRootFrameBaseArgs = Omit<
  Parameters<typeof buildWorkbenchRootFrameProps>[0],
  "appShellProps" | "overlayStackProps"
>;

export interface BuildWorkbenchCompositePropsArgs<
  TTransfer extends TransferLike = TransferLike
> {
  appShell: WorkbenchAppShellBaseArgs;
  commandHistoryInspector: CommandHistoryInspectorSectionArgs;
  inspectorSidebar: WorkbenchInspectorSidebarArgs;
  overlayStack: WorkbenchOverlayStackArgs;
  rootFrame: WorkbenchRootFrameBaseArgs;
  serverHealthInspectorContent: ServerHealthInspectorContentArgs;
  serverHealthInspectorSection: ServerHealthInspectorSectionArgs;
  sessionsInspector: SessionsInspectorSectionArgs;
  sftpExplorer: SftpExplorerSectionArgs;
  terminalWorkspace: TerminalWorkspaceArgs;
  topbar: WorkbenchTopbarArgs;
  transferDock: BuildTransferDockCompositePropsArgs<TTransfer>;
}

export function buildWorkbenchCompositeProps<TTransfer extends TransferLike>({
  appShell,
  commandHistoryInspector,
  inspectorSidebar,
  overlayStack,
  rootFrame,
  serverHealthInspectorContent,
  serverHealthInspectorSection,
  sessionsInspector,
  sftpExplorer,
  terminalWorkspace,
  topbar,
  transferDock
}: BuildWorkbenchCompositePropsArgs<TTransfer>) {
  const transferDockProps = buildTransferDockCompositeProps(transferDock);
  const topbarProps = buildWorkbenchTopbarProps(topbar);
  const inspectorSidebarProps =
    buildWorkbenchInspectorSidebarProps(inspectorSidebar);
  const sftpExplorerSectionProps = buildSftpExplorerSectionProps(sftpExplorer);
  const sessionsInspectorSectionProps =
    buildSessionsInspectorSectionProps(sessionsInspector);
  const serverHealthInspectorSectionProps =
    buildServerHealthInspectorSectionProps(serverHealthInspectorSection);
  const serverHealthInspectorContentProps =
    buildServerHealthInspectorContentProps(serverHealthInspectorContent);
  const commandHistoryInspectorSectionProps =
    buildCommandHistoryInspectorSectionProps(commandHistoryInspector);
  const terminalWorkspaceProps =
    buildTerminalWorkspaceProps(terminalWorkspace);
  const workbenchAppShellProps = buildWorkbenchAppShellProps({
    ...appShell,
    commandHistoryInspectorSectionProps,
    inspectorSidebarProps,
    serverHealthInspectorContentProps,
    serverHealthInspectorSectionProps,
    sessionsInspectorSectionProps,
    sftpExplorerSectionProps,
    terminalWorkspaceProps,
    topbarProps,
    transferDockProps
  });
  const workbenchOverlayStackProps = buildWorkbenchOverlayStackProps(overlayStack);

  return buildWorkbenchRootFrameProps({
    ...rootFrame,
    appShellProps: workbenchAppShellProps,
    overlayStackProps: workbenchOverlayStackProps
  });
}
