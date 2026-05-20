import type { ComponentProps } from "react";

import {
  CommandHistoryInspectorSection,
  SessionsInspectorSection,
  SftpExplorerSection,
  ServerHealthInspectorSection
} from "./workbench-panels";
import { ServerHealthInspectorContent } from "./server-health-inspector-content";
import { TerminalWorkspace } from "./terminal-workspace";
import { WorkbenchInspectorPanel } from "./workbench-inspector-panel";
import {
  WorkbenchExplorerSidebar,
  WorkbenchInspectorSidebar
} from "./workbench-sidebars";

export function WorkbenchExplorerPane({
  sftpExplorerSectionProps
}: {
  sftpExplorerSectionProps: ComponentProps<typeof SftpExplorerSection>;
}) {
  return (
    <WorkbenchExplorerSidebar>
      <SftpExplorerSection {...sftpExplorerSectionProps} />
    </WorkbenchExplorerSidebar>
  );
}

export function WorkbenchCenterPane({
  terminalWorkspaceProps
}: {
  terminalWorkspaceProps: ComponentProps<typeof TerminalWorkspace>;
}) {
  return (
    <section className="panel panel--center">
      <TerminalWorkspace {...terminalWorkspaceProps} />
    </section>
  );
}

type WorkbenchInspectorSidebarFrameProps = Omit<
  ComponentProps<typeof WorkbenchInspectorSidebar>,
  "children"
>;

export function WorkbenchInspectorPane({
  commandHistoryInspectorSectionProps,
  inspectorSidebarProps,
  serverHealthInspectorContentProps,
  serverHealthInspectorSectionProps,
  sessionsInspectorSectionProps
}: {
  commandHistoryInspectorSectionProps: ComponentProps<typeof CommandHistoryInspectorSection>;
  inspectorSidebarProps: WorkbenchInspectorSidebarFrameProps;
  serverHealthInspectorContentProps: ComponentProps<typeof ServerHealthInspectorContent>;
  serverHealthInspectorSectionProps: Omit<
    ComponentProps<typeof ServerHealthInspectorSection>,
    "children"
  >;
  sessionsInspectorSectionProps: ComponentProps<typeof SessionsInspectorSection>;
}) {
  return (
    <WorkbenchInspectorSidebar {...inspectorSidebarProps}>
      <WorkbenchInspectorPanel
        active={inspectorSidebarProps.activeTabId === "sessions"}
        tabId="sessions"
      >
        <SessionsInspectorSection {...sessionsInspectorSectionProps} />
      </WorkbenchInspectorPanel>
      <WorkbenchInspectorPanel
        active={inspectorSidebarProps.activeTabId === "health"}
        tabId="health"
      >
        <ServerHealthInspectorSection {...serverHealthInspectorSectionProps}>
          <ServerHealthInspectorContent {...serverHealthInspectorContentProps} />
        </ServerHealthInspectorSection>
      </WorkbenchInspectorPanel>
      <WorkbenchInspectorPanel
        active={inspectorSidebarProps.activeTabId === "history"}
        tabId="history"
      >
        <CommandHistoryInspectorSection {...commandHistoryInspectorSectionProps} />
      </WorkbenchInspectorPanel>
    </WorkbenchInspectorSidebar>
  );
}
