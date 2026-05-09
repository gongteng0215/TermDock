import type { ReactNode } from "react";

interface WorkbenchSidebarProps {
  children: ReactNode;
}

interface WorkbenchInspectorSidebarTab {
  badge?: string;
  id: string;
  label: string;
}

interface WorkbenchInspectorSidebarProps extends WorkbenchSidebarProps {
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  tabs: WorkbenchInspectorSidebarTab[];
}

export function WorkbenchExplorerSidebar({ children }: WorkbenchSidebarProps) {
  return (
    <aside className="panel panel--left">
      <div className="workbench-sidebar workbench-sidebar--explorer">{children}</div>
    </aside>
  );
}

export function WorkbenchInspectorSidebar({
  activeTabId,
  children,
  onSelectTab,
  tabs
}: WorkbenchInspectorSidebarProps) {
  return (
    <aside className="panel panel--right">
      <div className="workbench-sidebar workbench-sidebar--inspector" data-active-inspector-tab={activeTabId}>
        <div className="workbench-inspector-tabs" role="tablist" aria-label="Inspector panels">
          {tabs.map((tab) => (
            <button
              aria-selected={tab.id === activeTabId}
              className={tab.id === activeTabId ? "workbench-inspector-tab is-active" : "workbench-inspector-tab"}
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              role="tab"
              type="button"
            >
              <span>{tab.label}</span>
              {tab.badge ? <span className="workbench-inspector-tab__badge">{tab.badge}</span> : null}
            </button>
          ))}
        </div>
        <div className="workbench-inspector-panels">{children}</div>
      </div>
    </aside>
  );
}
