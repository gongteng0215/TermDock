export type UiThemeId = "default" | "tech";

export interface UiThemeOption {
  id: UiThemeId;
  label: string;
  description: string;
}

const UI_THEME_OPTIONS_EN: readonly UiThemeOption[] = [
  {
    id: "default",
    label: "Default",
    description: "Current editor-workbench shell: soft dark panels and rounded controls."
  },
  {
    id: "tech",
    label: "Tech",
    description:
      "Cockpit shell: floating neon panels with clear gaps that show the desktop behind the window."
  }
] as const;

const UI_THEME_OPTIONS_ZH: readonly UiThemeOption[] = [
  {
    id: "default",
    label: "默认",
    description: "当前编辑器工作台壳层：柔和深色面板与圆角控件。"
  },
  {
    id: "tech",
    label: "科技风",
    description: "Cockpit 浮动霓虹面板；面板外空隙透明，可透出桌面。"
  }
] as const;

export const UI_THEME_OPTIONS = UI_THEME_OPTIONS_EN;

export const DEFAULT_UI_THEME_ID: UiThemeId = "default";

export function isUiThemeId(value: unknown): value is UiThemeId {
  return value === "default" || value === "tech";
}

export function getUiThemeOptions(language: "en" | "zh"): readonly UiThemeOption[] {
  return language === "zh" ? UI_THEME_OPTIONS_ZH : UI_THEME_OPTIONS_EN;
}

export function getUiThemeOption(id: UiThemeId, language: "en" | "zh" = "en"): UiThemeOption {
  const options = getUiThemeOptions(language);
  return options.find((option) => option.id === id) ?? options[0]!;
}

export function applyUiThemeToDocument(themeId: UiThemeId): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.uiTheme = themeId;
  // Tech gaps stay clear so the transparent Electron window can show the desktop.
  if (themeId === "tech") {
    document.documentElement.dataset.cockpitTransparent = "1";
  } else {
    delete document.documentElement.dataset.cockpitTransparent;
  }
}
