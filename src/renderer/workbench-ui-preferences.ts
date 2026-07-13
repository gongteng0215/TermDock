import {
  DEFAULT_UI_ACCENT_ID,
  isUiAccentId,
  type UiAccentId
} from "./ui-accent";

export type SftpExplorerViewMode = "compact" | "details";
export type InspectorSidebarTabId = "sessions" | "health" | "history";

const SFTP_EXPLORER_VIEW_MODE_STORAGE_KEY = "termdock.sftp-explorer-view-mode.v1";
const COMMAND_HISTORY_INSPECTOR_COLLAPSED_STORAGE_KEY =
  "termdock.command-history-inspector-collapsed.v1";
const INSPECTOR_SIDEBAR_TAB_STORAGE_KEY = "termdock.inspector-sidebar-tab.v1";
const FIRST_RUN_ONBOARDING_DISMISSED_STORAGE_KEY = "termdock.first-run-onboarding-dismissed.v1";
const UI_ACCENT_STORAGE_KEY = "termdock.ui-accent.v1";

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

export function readUiAccentId(): UiAccentId {
  const rawValue = readStorageItem(UI_ACCENT_STORAGE_KEY);
  return isUiAccentId(rawValue) ? rawValue : DEFAULT_UI_ACCENT_ID;
}

export function writeUiAccentId(value: UiAccentId): void {
  writeStorageItem(UI_ACCENT_STORAGE_KEY, value);
}
