import type { ComponentProps } from "react";

import { isCockpitUiThemeId, type UiThemeId } from "../ui-theme";
import {
  CockpitWorkbenchShell,
  type CockpitChromeProps
} from "./cockpit-workbench-shell";
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
  shellThemeId: UiThemeId;
  cockpitChrome: CockpitChromeProps | null;
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
  shellThemeId = "default",
  cockpitChrome = null,
  terminalWorkspaceProps,
  topbarProps,
  transferDockProps
}: WorkbenchAppShellProps) {
  if (isCockpitUiThemeId(shellThemeId) && cockpitChrome) {
    return (
      <CockpitWorkbenchShell
        appInlineHintPanelProps={appInlineHintPanelProps}
        chrome={cockpitChrome}
        commandHistoryInspectorSectionProps={commandHistoryInspectorSectionProps}
        serverHealthInspectorContentProps={serverHealthInspectorContentProps}
        serverHealthInspectorSectionProps={serverHealthInspectorSectionProps}
        sessionsInspectorSectionProps={sessionsInspectorSectionProps}
        sftpExplorerSectionProps={sftpExplorerSectionProps}
        terminalWorkspaceProps={terminalWorkspaceProps}
        transferDockProps={transferDockProps}
      />
    );
  }

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
      <AppInlineHintPanel {...appInlineHintPanelProps} hideWhenEmpty />
    </>
  );
}
