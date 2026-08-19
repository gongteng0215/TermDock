import {
  DEFAULT_UI_ACCENT_ID,
  isUiAccentId,
  type UiAccentId
} from "./ui-accent";
import {
  DEFAULT_UI_DENSITY_ID,
  isUiDensityId,
  type UiDensityId
} from "./ui-density";
import {
  DEFAULT_UI_THEME_ID,
  isUiThemeId,
  type UiThemeId
} from "./ui-theme";

export type SftpExplorerViewMode = "compact" | "details";
export type SftpExplorerEntryTypeFilter = "all" | "files" | "directories";
export type SftpExplorerSortKey = "name" | "size" | "modifiedAt";
export type SftpExplorerSortDirection = "asc" | "desc";
export interface SftpExplorerBrowsePreferences {
  query: string;
  typeFilter: SftpExplorerEntryTypeFilter;
  sortKey: SftpExplorerSortKey;
  sortDirection: SftpExplorerSortDirection;
}
export type SftpExplorerBrowsePreferencesBySession = Record<
  string,
  SftpExplorerBrowsePreferences
>;
export type InspectorSidebarTabId = "sessions" | "health" | "history";

const SFTP_EXPLORER_VIEW_MODE_STORAGE_KEY = "termdock.sftp-explorer-view-mode.v1";
const SFTP_EXPLORER_BROWSE_PREFERENCES_STORAGE_KEY =
  "termdock.sftp-explorer-browse-preferences.v1";
const COMMAND_HISTORY_INSPECTOR_COLLAPSED_STORAGE_KEY =
  "termdock.command-history-inspector-collapsed.v1";
const INSPECTOR_SIDEBAR_TAB_STORAGE_KEY = "termdock.inspector-sidebar-tab.v1";
const FIRST_RUN_ONBOARDING_DISMISSED_STORAGE_KEY = "termdock.first-run-onboarding-dismissed.v1";
const UI_ACCENT_STORAGE_KEY = "termdock.ui-accent.v1";
const UI_DENSITY_STORAGE_KEY = "termdock.ui-density.v1";
const UI_THEME_STORAGE_KEY = "termdock.ui-theme.v1";

export const DEFAULT_SFTP_EXPLORER_BROWSE_PREFERENCES: SftpExplorerBrowsePreferences = {
  query: "",
  typeFilter: "all",
  sortKey: "name",
  sortDirection: "asc"
};

function readStorageItem(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageItem(key: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures; runtime settings still apply for this launch.
  }
}

export function readCommandHistoryInspectorCollapsed(): boolean {
  return readStorageItem(COMMAND_HISTORY_INSPECTOR_COLLAPSED_STORAGE_KEY) === "true";
}

export function writeCommandHistoryInspectorCollapsed(value: boolean): void {
  writeStorageItem(COMMAND_HISTORY_INSPECTOR_COLLAPSED_STORAGE_KEY, value ? "true" : "false");
}

export function readFirstRunOnboardingDismissed(): boolean {
  return readStorageItem(FIRST_RUN_ONBOARDING_DISMISSED_STORAGE_KEY) === "true";
}

export function writeFirstRunOnboardingDismissed(value: boolean): void {
  writeStorageItem(FIRST_RUN_ONBOARDING_DISMISSED_STORAGE_KEY, value ? "true" : "false");
}

export function readInspectorSidebarTabId(): InspectorSidebarTabId {
  const rawValue = readStorageItem(INSPECTOR_SIDEBAR_TAB_STORAGE_KEY);
  return rawValue === "sessions" || rawValue === "health" || rawValue === "history"
    ? rawValue
    : "sessions";
}

export function writeInspectorSidebarTabId(value: InspectorSidebarTabId): void {
  writeStorageItem(INSPECTOR_SIDEBAR_TAB_STORAGE_KEY, value);
}

export function readSftpExplorerViewMode(): SftpExplorerViewMode {
  const rawValue = readStorageItem(SFTP_EXPLORER_VIEW_MODE_STORAGE_KEY);
  return rawValue === "compact" || rawValue === "details" ? rawValue : "details";
}

export function writeSftpExplorerViewMode(value: SftpExplorerViewMode): void {
  writeStorageItem(SFTP_EXPLORER_VIEW_MODE_STORAGE_KEY, value);
}

function normalizeSftpExplorerBrowsePreferences(
  value: unknown
): SftpExplorerBrowsePreferences {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_SFTP_EXPLORER_BROWSE_PREFERENCES };
  }
  const candidate = value as Partial<SftpExplorerBrowsePreferences>;
  return {
    query: typeof candidate.query === "string" ? candidate.query.slice(0, 160) : "",
    typeFilter:
      candidate.typeFilter === "files" || candidate.typeFilter === "directories"
        ? candidate.typeFilter
        : "all",
    sortKey:
      candidate.sortKey === "size" || candidate.sortKey === "modifiedAt"
        ? candidate.sortKey
        : "name",
    sortDirection: candidate.sortDirection === "desc" ? "desc" : "asc"
  };
}

export function readSftpExplorerBrowsePreferencesBySession(): SftpExplorerBrowsePreferencesBySession {
  const rawValue = readStorageItem(SFTP_EXPLORER_BROWSE_PREFERENCES_STORAGE_KEY);
  if (!rawValue) {
    return {};
  }
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const normalizedEntries = Object.entries(parsed as Record<string, unknown>)
      .filter(([sessionId]) => sessionId.trim().length > 0)
      .slice(-160)
      .map(([sessionId, preferences]) => [
        sessionId.slice(0, 256),
        normalizeSftpExplorerBrowsePreferences(preferences)
      ] as const);
    return Object.fromEntries(normalizedEntries);
  } catch {
    return {};
  }
}

export function writeSftpExplorerBrowsePreferencesBySession(
  value: SftpExplorerBrowsePreferencesBySession
): void {
  const normalizedEntries = Object.entries(value)
    .filter(([sessionId]) => sessionId.trim().length > 0)
    .slice(-160)
    .map(([sessionId, preferences]) => [
      sessionId.slice(0, 256),
      normalizeSftpExplorerBrowsePreferences(preferences)
    ] as const);
  writeStorageItem(
    SFTP_EXPLORER_BROWSE_PREFERENCES_STORAGE_KEY,
    JSON.stringify(Object.fromEntries(normalizedEntries))
  );
}

export function readUiAccentId(): UiAccentId {
  const rawValue = readStorageItem(UI_ACCENT_STORAGE_KEY);
  return isUiAccentId(rawValue) ? rawValue : DEFAULT_UI_ACCENT_ID;
}

export function writeUiAccentId(value: UiAccentId): void {
  writeStorageItem(UI_ACCENT_STORAGE_KEY, value);
}

export function readUiDensityId(): UiDensityId {
  const rawValue = readStorageItem(UI_DENSITY_STORAGE_KEY);
  return isUiDensityId(rawValue) ? rawValue : DEFAULT_UI_DENSITY_ID;
}

export function writeUiDensityId(value: UiDensityId): void {
  writeStorageItem(UI_DENSITY_STORAGE_KEY, value);
}

export function readUiThemeId(): UiThemeId {
  const rawValue = readStorageItem(UI_THEME_STORAGE_KEY);
  return isUiThemeId(rawValue) ? rawValue : DEFAULT_UI_THEME_ID;
}

export function writeUiThemeId(value: UiThemeId): void {
  writeStorageItem(UI_THEME_STORAGE_KEY, value);
}
