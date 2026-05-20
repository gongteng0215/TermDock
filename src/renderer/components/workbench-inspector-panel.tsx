import type { ReactNode } from "react";

interface WorkbenchInspectorPanelProps {
  active: boolean;
  tabId: string;
  children: ReactNode;
}

export function WorkbenchInspectorPanel({
  active,
  tabId,
  children
}: WorkbenchInspectorPanelProps) {
  return (
    <div
      className={active ? "workbench-inspector-panel is-active" : "workbench-inspector-panel"}
      data-inspector-tab={tabId}
    >
      {children}
    </div>
  );
}
