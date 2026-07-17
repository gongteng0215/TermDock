export interface TerminalTab {
  id: string;
  sessionId: string;
  title: string;
  instance: number;
}

export interface ConnectionPreferences {
  autoReconnect: boolean;
  reconnectDelaySeconds: number;
}

export type TerminalEditorFocusThemeId = "midnight" | "graphite" | "paper";

export type TerminalEditorFocusTypographyId = "compact" | "balanced" | "reading";

export type TerminalEditorFocusFontId = "system" | "coding" | "drafting";

export type TerminalEditorFocusRhythmId = "crisp" | "steady" | "open";

export type TerminalEditorFocusCursorId = "beam" | "underline" | "block";

export interface TerminalEditorFocusThemeOption {
  id: TerminalEditorFocusThemeId;
  label: string;
  description: string;
}

export interface TerminalEditorFocusTypographyOption {
  id: TerminalEditorFocusTypographyId;
  label: string;
  description: string;
}

export interface TerminalEditorFocusFontOption {
  id: TerminalEditorFocusFontId;
  label: string;
  description: string;
  fontFamily: string;
}

export interface TerminalEditorFocusRhythmOption {
  id: TerminalEditorFocusRhythmId;
  label: string;
  description: string;
  letterSpacing: number;
  fontWeight: number;
  fontWeightBold: number;
}

export interface TerminalEditorFocusCursorOption {
  id: TerminalEditorFocusCursorId;
  label: string;
  description: string;
  cursorStyle: "bar" | "underline" | "block";
  cursorWidth: number;
}

export type HotkeyModifier = "primary" | "primaryShift" | "alt" | "altShift";

export interface HotkeyBindingPreference {
  enabled: boolean;
  modifier: HotkeyModifier;
  key: string;
}

export interface HotkeyPreferences {
  openSessionTab: HotkeyBindingPreference;
  closeActiveTab: HotkeyBindingPreference;
  terminalCopy: HotkeyBindingPreference;
  terminalPaste: HotkeyBindingPreference;
  terminalSearch: HotkeyBindingPreference;
}

export interface TerminalCommandHistoryEntry {
  id: string;
  tabId: string;
  command: string;
  executedAt: number;
  source: TerminalCommandHistorySource;
}

export type TerminalCommandHistorySource = "screen" | "buffer" | "manual" | "imported";
