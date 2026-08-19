import { memo, useCallback, useEffect, useRef } from "react";
import type {
  ChangeEventHandler,
  DragEventHandler,
  KeyboardEvent as ReactKeyboardEvent,
  KeyboardEventHandler,
  MouseEvent,
  MouseEventHandler,
  ReactNode
} from "react";

import { UiIcon } from "./ui-icon";
import { VirtualRows } from "./virtual-rows";

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
  isMonitorPinned: boolean;
  monitorCheckBusy: boolean;
  monitorPinBusy: boolean;
  monitorStatusLabel: string | null;
  monitorStatusUpdatedLabel: string | null;
  onCheckMonitor: () => void;
  onOpenFleet: () => void;
  onPinMonitor: () => void;
  checkMonitorDisabled: boolean;
  onRefresh: () => void;
  onToggleDetail: () => void;
  pinMonitorDisabled: boolean;
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
  onClick: MouseEventHandler<HTMLDivElement>;
  onContextMenu: MouseEventHandler<HTMLDivElement>;
  onDoubleClick: MouseEventHandler<HTMLDivElement>;
  onOpenDirectory?: MouseEventHandler<HTMLButtonElement>;
}

interface SftpExplorerSectionProps {
  allVisibleEntriesSelected: boolean;
  bindingTabTitle: string | null;
  deleteProgressLabel: string | null;
  directorySizeLabel: string;
  dropActive: boolean;
  entries: SftpExplorerEntryView[];
  emptyStateLabel: string;
  entrySummaryLabel: string;
  errorMessage: string | null;
  errorRecovery?: ReactNode;
  filterQuery: string;
  loading: boolean;
  onActionsMenu: MouseEventHandler<HTMLButtonElement>;
  onBodyContextMenu: MouseEventHandler<HTMLDivElement>;
  onClearSelection: () => void;
  onFilterQueryChange: ChangeEventHandler<HTMLInputElement>;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  onGoUp: () => void;
  onPathChange: ChangeEventHandler<HTMLInputElement>;
  onPathKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onRefresh: () => void;
  onSelectAllVisible: () => void;
  onSortDirectionToggle: () => void;
  onSortKeyChange: ChangeEventHandler<HTMLSelectElement>;
  onTypeFilterChange: ChangeEventHandler<HTMLSelectElement>;
  pathValue: string;
  pathUpDisabled: boolean;
  refreshDisabled: boolean;
  selectedPaths: string[];
  sortDirection: "asc" | "desc";
  sortKey: "name" | "size" | "modifiedAt";
  typeFilter: "all" | "files" | "directories";
  visibleEntrySummaryLabel: string;
  onViewModeChange: (mode: "compact" | "details") => void;
  viewMode: "compact" | "details";
}

const SessionGroupRow = memo(function SessionGroupRow({
  groupKey,
  label,
  count,
  isSelected,
  onRowClick,
  onRowContextMenu
}: {
  groupKey: string;
  label: string;
  count: number;
  isSelected: boolean;
  onRowClick: (event: MouseEvent<HTMLButtonElement>, key: string) => void;
  onRowContextMenu: (event: MouseEvent<HTMLLIElement>, key: string) => void;
}) {
  return (
    <li
      className={isSelected ? "session-folder-list__item is-selected" : "session-folder-list__item"}
      onContextMenu={(event) => onRowContextMenu(event, groupKey)}
    >
      <button
        className="session-folder-list__main"
        onClick={(event) => onRowClick(event, groupKey)}
        title={label}
        type="button"
      >
        <span className="session-folder-list__name">{label}</span>
        <span className="session-folder-list__count">{count}</span>
      </button>
    </li>
  );
});

const SessionRow = memo(function SessionRow({
  id,
  name,
  host,
  title,
  isSelected,
  onRowClick,
  onRowContextMenu,
  onRowDoubleClick,
  onRowKeyDown
}: {
  id: string;
  name: string;
  host: string;
  title: string;
  isSelected: boolean;
  onRowClick: (event: MouseEvent<HTMLButtonElement>, id: string) => void;
  onRowContextMenu: (event: MouseEvent<HTMLLIElement>, id: string) => void;
  onRowDoubleClick: (event: MouseEvent<HTMLButtonElement>, id: string) => void;
  onRowKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>, id: string) => void;
}) {
  return (
    <li
      className={isSelected ? "session-list__item is-selected" : "session-list__item"}
      onContextMenu={(event) => onRowContextMenu(event, id)}
    >
      <button
        className="session-list__main"
        onClick={(event) => onRowClick(event, id)}
        onDoubleClick={(event) => onRowDoubleClick(event, id)}
        onKeyDown={(event) => onRowKeyDown(event, id)}
        title={title}
        type="button"
      >
        <span className="session-list__name">{name}</span>
        <span className="session-list__host">{host}</span>
      </button>
    </li>
  );
});

const SftpEntryRow = memo(function SftpEntryRow({
  id,
  name,
  path,
  kind,
  permissions,
  linksLabel,
  owner,
  group,
  sizeLabel,
  compactSizeLabel,
  modifiedAtLabel,
  isSelected,
  hasOpenDirectory,
  viewMode,
  onRowClick,
  onRowContextMenu,
  onRowDoubleClick,
  onRowOpenDirectory
}: {
  id: string;
  name: string;
  path: string;
  kind: string;
  permissions: string;
  linksLabel: string;
  owner: string;
  group: string;
  sizeLabel: string;
  compactSizeLabel: string;
  modifiedAtLabel: string;
  isSelected: boolean;
  hasOpenDirectory: boolean;
  viewMode: "compact" | "details";
  onRowClick: (event: MouseEvent<HTMLDivElement>, id: string) => void;
  onRowContextMenu: (event: MouseEvent<HTMLDivElement>, id: string) => void;
  onRowDoubleClick: (event: MouseEvent<HTMLDivElement>, id: string) => void;
  onRowOpenDirectory: (event: MouseEvent<HTMLButtonElement>, id: string) => void;
}) {
  const variantClass = viewMode === "compact" ? "sftp-list__item--compact" : "sftp-list__item--details";
  const nameCell = hasOpenDirectory ? (
    <button
      className="sftp-list__name sftp-list__name--directory"
      onClick={(event) => onRowOpenDirectory(event, id)}
      title={path}
      type="button"
    >
      {name}/
    </button>
  ) : (
    <span className="sftp-list__name sftp-list__name--plain" title={path}>
      {name}
    </span>
  );

  return (
    <div
      aria-label={`${kind}: ${path}`}
      aria-selected={isSelected}
      className={
        isSelected
          ? `sftp-list__item ${variantClass} is-selected`
          : `sftp-list__item ${variantClass}`
      }
      onClick={(event) => onRowClick(event, id)}
      onContextMenu={(event) => onRowContextMenu(event, id)}
      onDoubleClick={(event) => onRowDoubleClick(event, id)}
      role="option"
      title={path}
    >
      {viewMode === "compact" ? (
        <>
          <div className="sftp-list__compact-main">
            <span className={`sftp-list__kind-dot sftp-list__kind-dot--${kind}`} />
            {nameCell}
          </div>
          <span className="sftp-list__meta sftp-list__meta--compact-size">{compactSizeLabel}</span>
        </>
      ) : (
        <>
          {nameCell}
          <span className="sftp-list__mtime">{modifiedAtLabel}</span>
          <span className={`sftp-list__mode sftp-list__mode--${kind}`}>{permissions}</span>
          <span className="sftp-list__links">{linksLabel}</span>
          <span className="sftp-list__owner">{owner}</span>
          <span className="sftp-list__group">{group}</span>
          <span className="sftp-list__meta">{sizeLabel}</span>
        </>
      )}
    </div>
  );
});

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
  const groupMapRef = useRef(new Map<string, SessionsGroupView>());
  groupMapRef.current = new Map(groups.map((group) => [group.key, group]));
  const sessionMapRef = useRef(new Map<string, SessionsItemView>());
  sessionMapRef.current = new Map(sessions.map((session) => [session.id, session]));

  const handleGroupClick = useCallback((event: MouseEvent<HTMLButtonElement>, key: string) => {
    groupMapRef.current.get(key)?.onClick(event);
  }, []);
  const handleGroupContextMenu = useCallback((event: MouseEvent<HTMLLIElement>, key: string) => {
    groupMapRef.current.get(key)?.onContextMenu(event);
  }, []);
  const handleSessionClick = useCallback((event: MouseEvent<HTMLButtonElement>, id: string) => {
    sessionMapRef.current.get(id)?.onClick(event);
  }, []);
  const handleSessionContextMenu = useCallback((event: MouseEvent<HTMLLIElement>, id: string) => {
    sessionMapRef.current.get(id)?.onContextMenu(event);
  }, []);
  const handleSessionDoubleClick = useCallback((event: MouseEvent<HTMLButtonElement>, id: string) => {
    sessionMapRef.current.get(id)?.onDoubleClick(event);
  }, []);
  const handleSessionKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, id: string) => {
      sessionMapRef.current.get(id)?.onKeyDown(event);
    },
    []
  );

  return (
    <section className="panel__section workbench-section workbench-section--sessions" onContextMenu={onRootContextMenu}>
      <div className="panel__heading panel__heading--inspector">
        <div className="panel__heading-main">
          <div className="panel__title-group">
            <h2>
              <UiIcon name="sessions" />
              Sessions
            </h2>
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
                  <SessionGroupRow
                    count={group.count}
                    groupKey={group.key}
                    isSelected={group.isSelected}
                    key={group.key}
                    label={group.label}
                    onRowClick={handleGroupClick}
                    onRowContextMenu={handleGroupContextMenu}
                  />
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
                  <SessionRow
                    host={session.host}
                    id={session.id}
                    isSelected={session.isSelected}
                    key={session.id}
                    name={session.name}
                    onRowClick={handleSessionClick}
                    onRowContextMenu={handleSessionContextMenu}
                    onRowDoubleClick={handleSessionDoubleClick}
                    onRowKeyDown={handleSessionKeyDown}
                    title={session.title}
                  />
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
  allVisibleEntriesSelected,
  bindingTabTitle,
  deleteProgressLabel,
  directorySizeLabel,
  dropActive,
  entries,
  emptyStateLabel,
  entrySummaryLabel,
  errorMessage,
  errorRecovery = null,
  filterQuery,
  loading,
  onActionsMenu,
  onBodyContextMenu,
  onClearSelection,
  onFilterQueryChange,
  onDragLeave,
  onDragOver,
  onDrop,
  onGoUp,
  onPathChange,
  onPathKeyDown,
  onRefresh,
  onSelectAllVisible,
  onSortDirectionToggle,
  onSortKeyChange,
  onTypeFilterChange,
  pathValue,
  pathUpDisabled,
  refreshDisabled,
  selectedPaths,
  sortDirection,
  sortKey,
  typeFilter,
  visibleEntrySummaryLabel,
  onViewModeChange,
  viewMode
}: SftpExplorerSectionProps) {
  const entryMapRef = useRef(new Map<string, SftpExplorerEntryView>());
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  entryMapRef.current = new Map(entries.map((entry) => [entry.id, entry]));
  const useVirtualRows = entries.length >= 160;

  const handleEntryClick = useCallback((event: MouseEvent<HTMLDivElement>, id: string) => {
    entryMapRef.current.get(id)?.onClick(event);
  }, []);
  const handleEntryContextMenu = useCallback((event: MouseEvent<HTMLDivElement>, id: string) => {
    entryMapRef.current.get(id)?.onContextMenu(event);
  }, []);
  const handleEntryDoubleClick = useCallback((event: MouseEvent<HTMLDivElement>, id: string) => {
    entryMapRef.current.get(id)?.onDoubleClick(event);
  }, []);
  const handleEntryOpenDirectory = useCallback(
    (event: MouseEvent<HTMLButtonElement>, id: string) => {
      entryMapRef.current.get(id)?.onOpenDirectory?.(event);
    },
    []
  );
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }, [filterQuery, pathValue, sortDirection, sortKey, typeFilter, viewMode]);

  const renderEntryRow = (entry: SftpExplorerEntryView) => (
    <SftpEntryRow
      compactSizeLabel={entry.compactSizeLabel}
      group={entry.group}
      hasOpenDirectory={Boolean(entry.onOpenDirectory)}
      id={entry.id}
      isSelected={entry.isSelected}
      key={entry.id}
      kind={entry.kind}
      linksLabel={entry.linksLabel}
      modifiedAtLabel={entry.modifiedAtLabel}
      name={entry.name}
      onRowClick={handleEntryClick}
      onRowContextMenu={handleEntryContextMenu}
      onRowDoubleClick={handleEntryDoubleClick}
      onRowOpenDirectory={handleEntryOpenDirectory}
      owner={entry.owner}
      path={entry.path}
      permissions={entry.permissions}
      sizeLabel={entry.sizeLabel}
      viewMode={viewMode}
    />
  );

  return (
    <section className="panel__section panel__section--sftp workbench-section workbench-section--sftp">
      <div className="panel__heading panel__heading--inspector">
        <div className="panel__heading-main">
          <h2>
            <UiIcon name="sftp" />
            SFTP
          </h2>
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
            Bound to tab: <strong title={bindingTabTitle}>{bindingTabTitle}</strong>
          </p>
          <div className="sftp-toolbar">
            <input
              className="sftp-path-input"
              onChange={onPathChange}
              onKeyDown={onPathKeyDown}
              placeholder="/var/log"
              aria-label="Remote directory path"
              title={pathValue}
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
          <div className="sftp-browser-controls">
            <input
              aria-label="Filter SFTP entries"
              className="sftp-browser-controls__search"
              onChange={onFilterQueryChange}
              placeholder="Filter files and folders"
              type="search"
              value={filterQuery}
            />
            <div className="sftp-browser-controls__options">
              <select
                aria-label="Filter SFTP entry type"
                onChange={onTypeFilterChange}
                value={typeFilter}
              >
                <option value="all">All types</option>
                <option value="files">Files</option>
                <option value="directories">Folders</option>
              </select>
              <select
                aria-label="Sort SFTP entries"
                onChange={onSortKeyChange}
                value={sortKey}
              >
                <option value="name">Name</option>
                <option value="size">Size</option>
                <option value="modifiedAt">Modified</option>
              </select>
              <button
                aria-label={sortDirection === "asc" ? "Sort ascending" : "Sort descending"}
                className="secondary-button secondary-button--small sftp-browser-controls__direction"
                onClick={onSortDirectionToggle}
                title={sortDirection === "asc" ? "Ascending" : "Descending"}
                type="button"
              >
                {sortDirection === "asc" ? "↑" : "↓"}
              </button>
            </div>
          </div>
          <div className="sftp-result-actions">
            <span>{visibleEntrySummaryLabel}</span>
            <button
              className="sftp-result-actions__button"
              disabled={entries.length === 0 || allVisibleEntriesSelected}
              onClick={onSelectAllVisible}
              type="button"
            >
              {allVisibleEntriesSelected ? "All Results Selected" : "Select All Results"}
            </button>
            {selectedPaths.length > 0 ? (
              <button
                className="sftp-result-actions__button"
                onClick={onClearSelection}
                type="button"
              >
                Clear
              </button>
            ) : null}
          </div>
          {errorMessage ? <p className="hint sftp-error">{errorMessage}</p> : null}
          {errorRecovery}
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
            <div
              className="sftp-drop-zone__body"
              onContextMenu={onBodyContextMenu}
              ref={scrollContainerRef}
            >
              {useVirtualRows ? (
                <div aria-multiselectable="true" role="listbox">
                  <VirtualRows
                    className={
                      viewMode === "compact"
                        ? "sftp-list sftp-list--compact sftp-list--virtual"
                        : "sftp-list sftp-list--details sftp-list--virtual"
                    }
                    count={entries.length}
                    estimateSize={viewMode === "compact" ? 16 : 18}
                    getKey={(index) => entries[index]?.id ?? `sftp-row-${index}`}
                    overscan={16}
                    renderRow={(index) => renderEntryRow(entries[index])}
                    scrollRef={scrollContainerRef}
                  />
                </div>
              ) : (
                <div
                  aria-multiselectable="true"
                  className={
                    viewMode === "compact"
                      ? "sftp-list sftp-list--compact"
                      : "sftp-list sftp-list--details"
                  }
                  role="listbox"
                >
                  {entries.map(renderEntryRow)}
                </div>
              )}
              {!loading && entries.length === 0 ? (
                <p className="hint sftp-list__empty">{emptyStateLabel}</p>
              ) : null}
            </div>
          </div>
          {selectedPaths.length > 0 ? (
            <div
              aria-live="polite"
              className="sftp-selection-preview"
              title={[
                ...selectedPaths.slice(0, 40),
                ...(selectedPaths.length > 40
                  ? [`+ ${selectedPaths.length - 40} more selected paths`]
                  : [])
              ].join("\n")}
            >
              <div className="sftp-selection-preview__heading">
                <span>
                  {selectedPaths.length === 1
                    ? "1 item selected"
                    : `${selectedPaths.length} items selected`}
                </span>
                <button
                  className="sftp-selection-preview__clear"
                  onClick={onClearSelection}
                  type="button"
                >
                  Clear Selection
                </button>
              </div>
              <code>
                {selectedPaths
                  .slice(0, 4)
                  .join("\n")}
                {selectedPaths.length > 4
                  ? `\n+ ${selectedPaths.length - 4} more`
                  : ""}
              </code>
            </div>
          ) : null}
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
          Open a session from the right Sessions panel first. SFTP reuses that terminal tab's SSH connection.
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
  isMonitorPinned,
  monitorCheckBusy,
  monitorPinBusy,
  monitorStatusLabel,
  monitorStatusUpdatedLabel,
  onCheckMonitor,
  onOpenFleet,
  onPinMonitor,
  checkMonitorDisabled,
  onRefresh,
  onToggleDetail,
  pinMonitorDisabled,
  refreshDisabled,
  toggleDisabled
}: ServerHealthInspectorSectionProps) {
  return (
    <section className="panel__section panel__section--server-health workbench-section workbench-section--server-health">
      <div className="panel__heading panel__heading--inspector">
        <div className="panel__heading-main">
          <h2>
            <UiIcon name="health" />
            Server Health
          </h2>
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
            {isMonitorPinned ? (
              <button
                aria-label="Run a Fleet Health check now"
                className="server-health__fleet-button"
                disabled={checkMonitorDisabled || monitorCheckBusy}
                onClick={onCheckMonitor}
                title="Run one controlled Fleet Health check now."
                type="button"
              >
                {monitorCheckBusy ? "Checking..." : "Check"}
              </button>
            ) : null}
            <button
              aria-label={isMonitorPinned ? "Open Fleet Health" : "Pin this session for Fleet Health monitoring"}
              className={
                isMonitorPinned
                  ? "server-health__fleet-button is-pinned"
                  : "server-health__fleet-button"
              }
              disabled={pinMonitorDisabled || monitorPinBusy}
              onClick={isMonitorPinned ? onOpenFleet : onPinMonitor}
              title={
                isMonitorPinned
                  ? "This session is fixed in Fleet Health. Open Fleet Health."
                  : "Pin this session for controlled Fleet Health checks every 60 seconds."
              }
              type="button"
            >
              {monitorPinBusy ? "Pinning…" : isMonitorPinned ? "Pinned" : "Pin monitor"}
            </button>
            <span
              className={
                hasAlert
                  ? "server-health__state server-health__state--alert"
                  : isConnected
                    ? "server-health__state"
                    : "server-health__state server-health__state--neutral"
              }
              title={
                hasAlert
                  ? "One or more metrics exceeded alert threshold."
                  : isConnected
                    ? "No alert triggered."
                    : "Monitoring starts after the active terminal tab connects."
              }
            >
              {hasAlert ? "ALERT" : healthyLabel}
            </span>
          </div>
        </div>
      </div>
      {activeTabTitle ? (
        <>
          {isMonitorPinned ? (
            <div className="server-health__fleet-summary">
              <span>Fleet monitor</span>
              <strong>{monitorStatusLabel ?? "Awaiting first check"}</strong>
              {monitorStatusUpdatedLabel ? <time>{monitorStatusUpdatedLabel}</time> : null}
            </div>
          ) : null}
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
            <h2>
              <UiIcon name="history" />
              Command History
            </h2>
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
      {isCollapsed ? null : !activeTabTitle ? (
        <p className="hint workbench-section__status">
          Open a session from the Sessions panel to view captured command history.
        </p>
      ) : (
        <>
          <div className="command-history-panel__filters">
            <select onChange={onScopeChange} value={scope}>
              <option value="activeTab">Active Tab</option>
              <option value="allTabs">All Tabs</option>
            </select>
            <input onChange={onQueryChange} placeholder="Search command" value={query} />
          </div>
          <div className="command-history-panel__target-row">
            <span className="command-history-panel__target" title={activeTabTitle}>
              {activeTabTitle}
            </span>
            <span
              className={
                activeTabConnected
                  ? "command-history-panel__state command-history-panel__state--ok"
                  : "command-history-panel__state command-history-panel__state--warn"
              }
            >
              {activeTabConnected ? "Ready" : "Offline"}
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
