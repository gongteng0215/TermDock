export type UiDensityId = "compact" | "comfortable";

export interface UiDensityOption {
  id: UiDensityId;
  label: string;
  description: string;
}

const UI_DENSITY_OPTIONS_EN: readonly UiDensityOption[] = [
  {
    id: "compact",
    label: "Compact",
    description: "Maximum density for side panels and lists."
  },
  {
    id: "comfortable",
    label: "Comfortable",
    description: "Roomier spacing and larger transfer panel text."
  }
] as const;

const UI_DENSITY_OPTIONS_ZH: readonly UiDensityOption[] = [
  {
    id: "compact",
    label: "紧凑",
    description: "尽可能压紧侧栏和列表，一屏展示更多内容。"
  },
  {
    id: "comfortable",
    label: "宽松",
    description: "放宽间距，并加大传输面板文字。"
  }
] as const;

export const UI_DENSITY_OPTIONS = UI_DENSITY_OPTIONS_EN;

export const DEFAULT_UI_DENSITY_ID: UiDensityId = "compact";

export function isUiDensityId(value: unknown): value is UiDensityId {
  return value === "compact" || value === "comfortable";
}

export function getUiDensityOptions(language: "en" | "zh"): readonly UiDensityOption[] {
  return language === "zh" ? UI_DENSITY_OPTIONS_ZH : UI_DENSITY_OPTIONS_EN;
}

export function getUiDensityOption(
  id: UiDensityId,
  language: "en" | "zh" = "en"
): UiDensityOption {
  const options = getUiDensityOptions(language);
  return options.find((option) => option.id === id) ?? options[0]!;
}

export function applyUiDensityToDocument(densityId: UiDensityId): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.uiDensity = densityId;
}
