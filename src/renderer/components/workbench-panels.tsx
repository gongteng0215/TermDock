import type {
  ChangeEventHandler,
  DragEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactNode
} from "react";

import { UiIcon } from "./ui-icon";

interface SessionsGroupView {
  key: string;
  label: string;
  count: number;
  isSelected: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  onContextMenu: MouseEventHandler<HTMLLIElement>;
}

interface SessionsItemView {
  id: string;
  name: string;
  host: string;
  title: string;
  isSelected: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  onContextMenu: MouseEventHandler<HTMLLIElement>;
  onDoubleClick: MouseEventHandler<HTMLButtonElement>;
  onKeyDown: KeyboardEventHandler<HTMLButtonElement>;
}

interface SessionsInspectorSectionProps {
  activeGroupLabel: string | null;
  activeContext:
    | {
        detail: string;
        stateLabel: string;
        stateTone: "neutral" | "ok" | "warn";
        title: string;
      }
    | null;
  emptyStateLabel: string | null;
  favoritesOnly: boolean;
  filterQuery: string;
  groups: SessionsGroupView[];
  isGroupView: boolean;
  loading: boolean;
  onBackToGroups: () => void;
  onCreateFirstSession: () => void;
  onDismissWelcome: () => void;
  onFilterQueryChange: ChangeEventHandler<HTMLInputElement>;
  onImportSshConfig: () => void;
  onOpenSecurityNotes: () => void;
  onOpenSettings: () => void;
  onRootContextMenu: MouseEventHandler<HTMLElement>;
  onToggleFavoritesOnly: () => void;
  sessions: SessionsItemView[];
  sessionBadgeText: string;
  showWelcome: boolean;
  workspaceProfile:
    | {
        id: string;
        shortLabel: string;
      }
    | null;
}

interface ServerHealthInspectorSectionProps {
  activeTabTitle: string | null;
  children: ReactNode;
  hasAlert: boolean;
  healthyLabel: string;
  isConnected: boolean;
  isDetailOpen: boolean;
  onRefresh: () => void;
  onToggleDetail: () => void;
  refreshDisabled: boolean;
  toggleDisabled: boolean;
}

interface CommandHistoryEntryView {
  id: string;
  command: string;
  title: string;
  onContextMenu: MouseEventHandler<HTMLLIElement>;
  onDoubleClick: MouseEventHandler<HTMLLIElement>;
}

interface CommandHistoryInspectorSectionProps {
  activeTabTitle: string | null;
  activeTabConnected: boolean;
  entries: CommandHistoryEntryView[];
  hiddenEntryCount: number;
  isCollapsed: boolean;
  onOpenContextMenu: MouseEventHandler<HTMLDivElement>;
  onOpenManager: () => void;
  onOpenSnippets: () => void;
  onQueryChange: ChangeEventHandler<HTMLInputElement>;
  onScopeChange: ChangeEventHandler<HTMLSelectElement>;
  onToggleCollapsed: () => void;
  query: string;
  scope: "activeTab" | "allTabs";
  totalCommandSnippetCount: number;
  visibleCountLabel: string;
}

interface SftpExplorerEntryView {
  compactSizeLabel: string;
  id: string;
  kind: string;
  name: string;
  path: string;
  modifiedAtLabel: string;
  permissions: string;
  linksLabel: string;
  owner: string;
  group: string;
  sizeLabel: string;
  isSelected: boolean;
  onClick: MouseEventHandler<HTMLLIElement>;
  onContextMenu: MouseEventHandler<HTMLLIElement>;
  onDoubleClick: MouseEventHandler<HTMLLIElement>;
  onOpenDirectory?: MouseEventHandler<HTMLButtonElement>;
}

interface SftpExplorerSectionProps {
  bindingTabTitle: string | null;
  currentPathLabel: string;
  deleteProgressLabel: string | null;
  directorySizeLabel: string;
  dropActive: boolean;
  entries: SftpExplorerEntryView[];
  entrySummaryLabel: string;
  errorMessage: string | null;
  loading: boolean;
  onActionsMenu: MouseEventHandler<HTMLButtonElement>;
  onBodyContextMenu: MouseEventHandler<HTMLDivElement>;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  onGoUp: () => void;
  onPathChange: ChangeEventHandler<HTMLInputElement>;
  onPathKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onRefresh: () => void;
  pathValue: string;
  pathUpDisabled: boolean;
  refreshDisabled: boolean;
  onViewModeChange: (mode: "compact" | "details") => void;
  viewMode: "compact" | "details";
}

export function SessionsInspectorSection({
  activeGroupLabel,
  activeContext,
  emptyStateLabel,
  favoritesOnly,
  filterQuery,
  groups,
  isGroupView,
  loading,
  onBackToGroups,
  onCreateFirstSession,
  onDismissWelcome,
  onFilterQueryChange,
  onImportSshConfig,
  onOpenSecurityNotes,
  onOpenSettings,
  onRootContextMenu,
  onToggleFavoritesOnly,
  sessions,
  sessionBadgeText,
  showWelcome,
  workspaceProfile
}: SessionsInspectorSectionProps) {
  return (
    <section className="panel__section workbench-section workbench-section--sessions" onContextMenu={onRootContextMenu}>
      <div className="panel__heading panel__heading--inspector">
        <div className="panel__heading-main">
          <div className="panel__title-group">
            <h2>Sessions</h2>
            <span className="panel__badge">{sessionBadgeText}</span>
            {workspaceProfile ? (
              <span className={`panel__badge workspace-profile-badge workspace-profile-badge--${workspaceProfile.id}`}>
                {workspaceProfile.shortLabel}
              </span>
            ) : null}
          </div>
          <div className="session-panel__heading-actions">
            <button
              aria-label="Open settings"
              className="icon-button session-panel__settings-button"
              onClick={onOpenSettings}
              title="Settings"
              type="button"
            >
              <UiIcon name="settings" />
            </button>
          </div>
        </div>
        <div className="panel__subheading">
          <span className="hint session-explorer__location">
            {activeGroupLabel ? `Group: ${activeGroupLabel}` : "Groups"}
          </span>
        </div>
      </div>
      {loading && groups.length === 0 && sessions.length === 0 ? (
        <p className="hint workbench-section__status">Loading sessions...</p>
      ) : null}
      <div className="session-explorer">
        {showWelcome ? (
          <div className="first-run-card">
            <div className="first-run-card__header">
              <div>
                <strong>Start with your first server</strong>
                <p className="hint">
                  Import your SSH config for the fastest setup, or create one session by hand.
                </p>
              </div>
              <button
                aria-label="Dismiss first-run tips"
                className="icon-button first-run-card__dismiss"
                onClick={onDismissWelcome}
                title="Dismiss"
                type="button"
              >
                <UiIcon name="close" />
              </button>
            </div>
            <div className="first-run-card__actions">
              <button className="primary-button primary-button--small" onClick={onImportSshConfig} type="button">
                Import SSH Config
              </button>
              <button className="secondary-button secondary-button--small" onClick={onCreateFirstSession} type="button">
                New Session
              </button>
              <button className="secondary-button secondary-button--small" onClick={onOpenSecurityNotes} type="button">
                Security Notes
              </button>
            </div>
            <div className="first-run-card__steps" aria-label="Suggested setup path">
              <span>1. Import hosts</span>
              <span>2. Test connection</span>
              <span>3. Open terminal + SFTP</span>
            </div>
          </div>
        ) : null}
        {activeContext ? (
          <div className="session-explorer__active-row">
            <div className="session-explorer__active-main">
              <span className="session-explorer__active-title" title={activeContext.title}>{activeContext.title}</span>
              <span className="session-explorer__active-detail" title={activeContext.detail}>{activeContext.detail}</span>
            </div>
            <span className={`inspector-context-card__state inspector-context-card__state--${activeContext.stateTone}`}>
              {activeContext.stateLabel}
            </span>
          </div>
        ) : null}
        <div className="session-filter-bar">
          <input
            className="session-filter-input"
            onChange={onFilterQueryChange}
            placeholder="Filter name/host/user/group"
            value={filterQuery}
          />
          <button
            aria-label={favoritesOnly ? "Show all sessions" : "Show favorite sessions only"}
            className={favoritesOnly ? "session-filter-toggle is-active" : "session-filter-toggle"}
            onClick={onToggleFavoritesOnly}
            title={favoritesOnly ? "Show all" : "Favorites only"}
            type="button"
          >
            {favoritesOnly ? "Favorites" : "All"}
          </button>
        </div>
        {!isGroupView ? (
          <>
            {emptyStateLabel ? <p className="hint workbench-section__status">{emptyStateLabel}</p> : null}
            <div className="workbench-list-shell session-explorer__list-shell">
              <ul className="session-folder-list">
                {groups.map((group) => (
                  <li
                    className={
                      group.isSelected
                        ? "session-folder-list__item is-selected"
                        : "session-folder-list__item"
                    }
                    key={group.key}
                    onContextMenu={group.onContextMenu}
                  >
                    <button className="session-folder-list__main" onClick={group.onClick} title={group.label} type="button">
                      <span className="session-folder-list__name">{group.label}</span>
                      <span className="session-folder-list__count">{group.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <>
            <button
              aria-label="Back to groups"
              className="icon-button session-explorer__back"
              onClick={onBackToGroups}
              title="Back to groups"
              type="button"
            >
              <UiIcon name="chevronLeft" />
            </button>
            {emptyStateLabel ? <p className="hint workbench-section__status">{emptyStateLabel}</p> : null}
            <div className="workbench-list-shell session-explorer__list-shell">
              <ul className="session-list">
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className={session.isSelected ? "session-list__item is-selected" : "session-list__item"}
                    onContextMenu={session.onContextMenu}
                  >
                    <button
                      className="session-list__main"
                      onClick={session.onClick}
                      onDoubleClick={session.onDoubleClick}
                      onKeyDown={session.onKeyDown}
                      title={session.title}
                      type="button"
                    >
                      <span className="session-list__name">{session.name}</span>
                      <span className="session-list__host">{session.host}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function SftpExplorerSection({
  bindingTabTitle,
  currentPathLabel,
  deleteProgressLabel,
  directorySizeLabel,
  dropActive,
  entries,
  entrySummaryLabel,
  errorMessage,
  loading,
  onActionsMenu,
  onBodyContextMenu,
  onDragLeave,
  onDragOver,
  onDrop,
  onGoUp,
  onPathChange,
  onPathKeyDown,
  onRefresh,
  pathValue,
  pathUpDisabled,
  refreshDisabled,
  onViewModeChange,
  viewMode
}: SftpExplorerSectionProps) {
  const renderNameCell = (entry: SftpExplorerEntryView) =>
    entry.onOpenDirectory ? (
      <button
        className="sftp-list__name sftp-list__name--directory"
        onClick={entry.onOpenDirectory}
        title={entry.path}
        type="button"
      >
        {entry.name}/
      </button>
    ) : (
      <span className="sftp-list__name sftp-list__name--plain" title={entry.path}>
        {entry.name}
      </span>
    );

  return (
    <section className="panel__section panel__section--sftp workbench-section workbench-section--sftp">
      <div className="panel__heading panel__heading--inspector">
        <div className="panel__heading-main">
          <h2>SFTP</h2>
          <div className="panel__heading-actions sftp-view-mode-toggle" role="group" aria-label="SFTP view mode">
            <button
              className={
                viewMode === "compact"
                  ? "secondary-button secondary-button--small is-active"
                  : "secondary-button secondary-button--small"
              }
              onClick={() => onViewModeChange("compact")}
              type="button"
            >
              Compact
            </button>
            <button
              className={
                viewMode === "details"
                  ? "secondary-button secondary-button--small is-active"
                  : "secondary-button secondary-button--small"
              }
              onClick={() => onViewModeChange("details")}
              type="button"
            >
              Details
            </button>
          </div>
        </div>
      </div>
      {bindingTabTitle ? (
        <>
          <p className="hint sftp-binding">
            Bound to tab: <strong>{bindingTabTitle}</strong>
          </p>
          <div className="sftp-toolbar">
            <input
              className="sftp-path-input"
              onChange={onPathChange}
              onKeyDown={onPathKeyDown}
              placeholder="/var/log"
              value={pathValue}
            />
            <button
              aria-label="Go to parent directory"
              className="icon-button sftp-toolbar__button"
              disabled={pathUpDisabled}
              onClick={onGoUp}
              title="Go Up"
              type="button"
            >
              <UiIcon name="arrowUp" />
            </button>
            <button
              aria-label="Refresh directory"
              className="icon-button sftp-toolbar__button"
              disabled={refreshDisabled}
              onClick={onRefresh}
              title="Refresh"
              type="button"
            >
              <UiIcon name="refresh" />
            </button>
            <button
              aria-label="SFTP actions"
              className="icon-button sftp-toolbar__button sftp-toolbar__button--menu"
              onClick={onActionsMenu}
              title="SFTP actions"
              type="button"
            >
              <UiIcon name="menu" />
            </button>
          </div>
          <p className="hint sftp-current-path">Current: {currentPathLabel}</p>
          {errorMessage ? <p className="hint sftp-error">{errorMessage}</p> : null}
          {deleteProgressLabel ? (
            <div className="sftp-delete-progress" role="status" aria-live="polite">
              <p className="hint sftp-delete-progress__label">{deleteProgressLabel}</p>
              <div className="sftp-delete-progress__track">
                <span className="sftp-delete-progress__bar" />
              </div>
            </div>
          ) : null}
          <div
            className={dropActive ? "sftp-drop-zone is-active" : "sftp-drop-zone"}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            <p className="hint sftp-drop-hint">
              Drop files or folders into this box to upload to current directory.
            </p>
            <div className="sftp-drop-zone__body" onContextMenu={onBodyContextMenu}>
              <ul className={viewMode === "compact" ? "sftp-list sftp-list--compact" : "sftp-list sftp-list--details"}>
                {entries.map((entry) => (
                  <li
                    className={
                      entry.isSelected
                        ? `sftp-list__item ${viewMode === "compact" ? "sftp-list__item--compact" : "sftp-list__item--details"} is-selected`
                        : `sftp-list__item ${viewMode === "compact" ? "sftp-list__item--compact" : "sftp-list__item--details"}`
                    }
                    key={entry.id}
                    onClick={entry.onClick}
                    onContextMenu={entry.onContextMenu}
                    onDoubleClick={entry.onDoubleClick}
                  >
                    {viewMode === "compact" ? (
                      <>
                        <div className="sftp-list__compact-main">
                          <span className={`sftp-list__kind-dot sftp-list__kind-dot--${entry.kind}`} />
                          {renderNameCell(entry)}
                        </div>
                        <span className="sftp-list__meta sftp-list__meta--compact-size">
                          {entry.compactSizeLabel}
                        </span>
                      </>
                    ) : (
                      <>
                        {renderNameCell(entry)}
                        <span className="sftp-list__mtime">{entry.modifiedAtLabel}</span>
                        <span className={`sftp-list__mode sftp-list__mode--${entry.kind}`}>{entry.permissions}</span>
                        <span className="sftp-list__links">{entry.linksLabel}</span>
                        <span className="sftp-list__owner">{entry.owner}</span>
                        <span className="sftp-list__group">{entry.group}</span>
                        <span className="sftp-list__meta">{entry.sizeLabel}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {loading && entries.length === 0 ? (
            <p className="hint sftp-loading-indicator" role="status" aria-live="polite">
              Loading remote directory...
            </p>
          ) : null}
          <div className="sftp-summary">
            <p className="hint sftp-summary__item">{entrySummaryLabel}</p>
            <p className="hint sftp-summary__item">{directorySizeLabel}</p>
          </div>
        </>
      ) : (
        <p className="hint workbench-section__status">
          Open a terminal tab first. SFTP panel reuses the active tab SSH connection.
        </p>
      )}
    </section>
  );
}

export function ServerHealthInspectorSection({
  activeTabTitle,
  children,
  hasAlert,
  healthyLabel,
  isConnected,
  isDetailOpen,
  onRefresh,
  onToggleDetail,
  refreshDisabled,
  toggleDisabled
}: ServerHealthInspectorSectionProps) {
  return (
    <section className="panel__section panel__section--server-health workbench-section workbench-section--server-health">
      <div className="panel__heading panel__heading--inspector">
        <div className="panel__heading-main">
          <h2>Server Health</h2>
          <div className="server-health__actions">
            <button
              aria-label="Open server health details"
              className={
                isDetailOpen
                  ? "icon-button server-health__detail-toggle is-active"
                  : "icon-button server-health__detail-toggle"
              }
              disabled={toggleDisabled}
              onClick={onToggleDetail}
              title="Show details"
              type="button"
            >
              <UiIcon name="details" />
            </button>
            <button
              aria-label="Refresh server metrics"
              className="icon-button"
              disabled={refreshDisabled}
              onClick={onRefresh}
              title="Refresh"
              type="button"
            >
              <UiIcon name="refresh" />
            </button>
            <span
              className={hasAlert ? "server-health__state server-health__state--alert" : "server-health__state"}
              title={hasAlert ? "One or more metrics exceeded alert threshold." : "No alert triggered."}
            >
              {hasAlert ? "ALERT" : healthyLabel}
            </span>
          </div>
        </div>
      </div>
      {activeTabTitle ? (
        <>
          <div className="server-health__target-row">
            <span className="server-health__target" title={activeTabTitle}>{activeTabTitle}</span>
            <span
              className={
                isConnected
                  ? "server-health__connection server-health__connection--ok"
                  : "server-health__connection server-health__connection--warn"
              }
            >
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          {children}
        </>
      ) : (
        <p className="hint workbench-section__status">Open and connect a terminal tab to monitor server status.</p>
      )}
    </section>
  );
}

export function CommandHistoryInspectorSection({
  activeTabTitle,
  activeTabConnected,
  entries,
  hiddenEntryCount,
  isCollapsed,
  onOpenContextMenu,
  onOpenManager,
  onOpenSnippets,
  onQueryChange,
  onScopeChange,
  onToggleCollapsed,
  query,
  scope,
  totalCommandSnippetCount,
  visibleCountLabel
}: CommandHistoryInspectorSectionProps) {
  return (
    <section
      className={
        isCollapsed
          ? "panel__section panel__section--command-history workbench-section workbench-section--command-history is-collapsed"
          : "panel__section panel__section--command-history workbench-section workbench-section--command-history"
      }
    >
      <div className="panel__heading panel__heading--inspector">
        <div className="panel__heading-main">
          <div className="panel__title-group">
            <h2>Command History</h2>
            <span className="panel__badge">{visibleCountLabel}</span>
          </div>
          <div className="command-history-panel__heading-actions">
            <button
              className="secondary-button secondary-button--small command-history-panel__snippet-button"
              onClick={onOpenSnippets}
              type="button"
            >
              Snippets ({totalCommandSnippetCount})
            </button>
            <button className="secondary-button secondary-button--small" onClick={onOpenManager} type="button">
              Manage
            </button>
            <button
              aria-label={isCollapsed ? "Expand command history panel" : "Collapse command history panel"}
              className="icon-button command-history-panel__collapse"
              onClick={onToggleCollapsed}
              title={isCollapsed ? "Expand" : "Collapse"}
              type="button"
            >
              <UiIcon name={isCollapsed ? "plus" : "minus"} />
            </button>
          </div>
        </div>
      </div>
      {isCollapsed ? null : (
        <>
          <div className="command-history-panel__filters">
            <select onChange={onScopeChange} value={scope}>
              <option value="activeTab">Active Tab</option>
              <option value="allTabs">All Tabs</option>
            </select>
            <input onChange={onQueryChange} placeholder="Search command" value={query} />
          </div>
          <div className="command-history-panel__target-row">
            <span className="command-history-panel__target" title={activeTabTitle ?? undefined}>
              {activeTabTitle ?? "No active tab"}
            </span>
            <span
              className={
                activeTabTitle
                  ? activeTabConnected
                    ? "command-history-panel__state command-history-panel__state--ok"
                    : "command-history-panel__state command-history-panel__state--warn"
                  : "command-history-panel__state command-history-panel__state--neutral"
              }
            >
              {activeTabTitle ? (activeTabConnected ? "Ready" : "Offline") : "No Tab"}
            </span>
          </div>
          <div className="command-history-panel__list-shell workbench-list-shell" onContextMenu={onOpenContextMenu}>
            {entries.length === 0 ? (
              <p className="hint command-history-panel__empty workbench-section__status">No command history entries.</p>
            ) : (
              <ul className="command-history-panel__list">
                {entries.map((entry) => (
                  <li
                    className="command-history-panel__item"
                    key={entry.id}
                    onDoubleClick={entry.onDoubleClick}
                    onContextMenu={entry.onContextMenu}
                    title={entry.title}
                  >
                    <p className="command-history-panel__command">
                      <code>{entry.command}</code>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {hiddenEntryCount > 0 ? (
            <button
              className="command-history-panel__more"
              onClick={onOpenManager}
              type="button"
            >
              View {hiddenEntryCount} more
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
