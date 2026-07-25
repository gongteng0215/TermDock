export type UiAccentId = "ocean" | "cyan" | "lavender" | "mint" | "amber" | "rose";

export interface UiAccentOption {
  id: UiAccentId;
  label: string;
  description: string;
}

const UI_ACCENT_OPTIONS_EN: readonly UiAccentOption[] = [
  {
    id: "ocean",
    label: "Ocean",
    description: "Default cool blue tone across the whole workbench."
  },
  {
    id: "cyan",
    label: "Cyan",
    description: "Cockpit neon cyan — default accent for the Tech shell."
  },
  {
    id: "lavender",
    label: "Lavender",
    description: "Soft purple tone across the whole workbench."
  },
  {
    id: "mint",
    label: "Mint",
    description: "Fresh teal-green tone across the whole workbench."
  },
  {
    id: "amber",
    label: "Amber",
    description: "Warm amber tone across the whole workbench."
  },
  {
    id: "rose",
    label: "Rose",
    description: "Soft rose tone across the whole workbench."
  }
] as const;

const UI_ACCENT_OPTIONS_ZH: readonly UiAccentOption[] = [
  {
    id: "ocean",
    label: "海洋蓝",
    description: "默认偏冷蓝色整体色调。"
  },
  {
    id: "cyan",
    label: "青色",
    description: "控制台霓虹青，科技主题的默认强调色。"
  },
  {
    id: "lavender",
    label: "淡紫色",
    description: "整套工作台换成柔和紫色调。"
  },
  {
    id: "mint",
    label: "薄荷绿",
    description: "整套工作台换成清新青绿调。"
  },
  {
    id: "amber",
    label: "琥珀橙",
    description: "整套工作台换成偏暖琥珀调。"
  },
  {
    id: "rose",
    label: "玫瑰粉",
    description: "整套工作台换成柔和玫红调。"
  }
] as const;

export const UI_ACCENT_OPTIONS = UI_ACCENT_OPTIONS_EN;

export const DEFAULT_UI_ACCENT_ID: UiAccentId = "ocean";

/** Default accent applied when switching into the Tech shell (user can change freely). */
export const TECH_DEFAULT_UI_ACCENT_ID: UiAccentId = "cyan";

export function isUiAccentId(value: unknown): value is UiAccentId {
  return (
    value === "ocean" ||
    value === "cyan" ||
    value === "lavender" ||
    value === "mint" ||
    value === "amber" ||
    value === "rose"
  );
}

export function getUiAccentOptions(language: "en" | "zh"): readonly UiAccentOption[] {
  return language === "zh" ? UI_ACCENT_OPTIONS_ZH : UI_ACCENT_OPTIONS_EN;
}

export function getUiAccentOption(
  id: UiAccentId,
  language: "en" | "zh" = "en"
): UiAccentOption {
  const options = getUiAccentOptions(language);
  return options.find((option) => option.id === id) ?? options[0]!;
}

export function applyUiAccentToDocument(accentId: UiAccentId): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.uiAccent = accentId;
}
