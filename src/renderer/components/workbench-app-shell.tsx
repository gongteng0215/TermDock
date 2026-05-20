import type { ComponentProps } from "react";

import {
  AppInlineHintPanel,
  TransferDock,
  WorkbenchLayout,
  WorkbenchTopbar
} from "./workbench-shell";
import {
  WorkbenchCenterPane,
  WorkbenchExplorerPane,
  WorkbenchInspectorPane
} from "./workbench-pane-hosts";

type WorkbenchExplorerPaneProps = ComponentProps<typeof WorkbenchExplorerPane>;
type WorkbenchCenterPaneProps = ComponentProps<typeof WorkbenchCenterPane>;
type WorkbenchInspectorPaneProps = ComponentProps<typeof WorkbenchInspectorPane>;

export interface WorkbenchAppShellProps {
  appInlineHintPanelProps: ComponentProps<typeof AppInlineHintPanel>;
  commandHistoryInspectorSectionProps: WorkbenchInspectorPaneProps["commandHistoryInspectorSectionProps"];
  inspectorSidebarProps: WorkbenchInspectorPaneProps["inspectorSidebarProps"];
  isEditorFocusMode: boolean;
  serverHealthInspectorContentProps: WorkbenchInspectorPaneProps["serverHealthInspectorContentProps"];
  serverHealthInspectorSectionProps: WorkbenchInspectorPaneProps["serverHealthInspectorSectionProps"];
  sessionsInspectorSectionProps: WorkbenchInspectorPaneProps["sessionsInspectorSectionProps"];
  sftpExplorerSectionProps: WorkbenchExplorerPaneProps["sftpExplorerSectionProps"];
  terminalWorkspaceProps: WorkbenchCenterPaneProps["terminalWorkspaceProps"];
  topbarProps: ComponentProps<typeof WorkbenchTopbar>;
  transferDockProps: ComponentProps<typeof TransferDock>;
}

export function WorkbenchAppShell({
  appInlineHintPanelProps,
  commandHistoryInspectorSectionProps,
  inspectorSidebarProps,
  isEditorFocusMode,
  serverHealthInspectorContentProps,
  serverHealthInspectorSectionProps,
  sessionsInspectorSectionProps,
  sftpExplorerSectionProps,
  terminalWorkspaceProps,
  topbarProps,
  transferDockProps
}: WorkbenchAppShellProps) {
  return (
    <>
      <WorkbenchTopbar {...topbarProps} />
      <WorkbenchLayout
        isEditorFocusMode={isEditorFocusMode}
        leftSidebar={<WorkbenchExplorerPane sftpExplorerSectionProps={sftpExplorerSectionProps} />}
        centerPane={<WorkbenchCenterPane terminalWorkspaceProps={terminalWorkspaceProps} />}
        rightSidebar={
          <WorkbenchInspectorPane
            commandHistoryInspectorSectionProps={commandHistoryInspectorSectionProps}
            inspectorSidebarProps={inspectorSidebarProps}
            serverHealthInspectorContentProps={serverHealthInspectorContentProps}
            serverHealthInspectorSectionProps={serverHealthInspectorSectionProps}
            sessionsInspectorSectionProps={sessionsInspectorSectionProps}
          />
        }
      />
      <TransferDock {...transferDockProps} />
      <AppInlineHintPanel {...appInlineHintPanelProps} />
    </>
  );
}
