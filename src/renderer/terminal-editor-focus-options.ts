import type {
  TerminalEditorFocusCursorOption,
  TerminalEditorFocusFontOption,
  TerminalEditorFocusRhythmOption,
  TerminalEditorFocusThemeOption,
  TerminalEditorFocusTypographyOption
} from "./terminal-workspace-types";

export const TERMINAL_EDITOR_FOCUS_THEME_OPTIONS: TerminalEditorFocusThemeOption[] = [
  {
    id: "midnight",
    label: "Midnight",
    description: "Deep blue canvas with cool contrast for long dark-session editing."
  },
  {
    id: "graphite",
    label: "Graphite",
    description: "Neutral slate palette with softer contrast and mint cursor accents."
  },
  {
    id: "paper",
    label: "Paper",
    description: "Warm light canvas for terminal editing that feels closer to a text buffer."
  }
];

export const TERMINAL_EDITOR_FOCUS_TYPOGRAPHY_OPTIONS: TerminalEditorFocusTypographyOption[] = [
  {
    id: "compact",
    label: "Compact",
    description: "Tighter rows and smaller type for maximum visible context."
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Default terminal editor density with moderate breathing room."
  },
  {
    id: "reading",
    label: "Reading",
    description: "Larger type and taller rows for longer focused editing sessions."
  }
];

export const TERMINAL_EDITOR_FOCUS_FONT_OPTIONS: TerminalEditorFocusFontOption[] = [
  {
    id: "system",
    label: "System Mono",
    description: "Lean on the platform default mono stack for the most native terminal feel.",
    fontFamily:
      '"Cascadia Mono", "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace'
  },
  {
    id: "coding",
    label: "Coding Mono",
    description: "Bias toward developer fonts such as Cascadia Code, JetBrains Mono, and Fira Code.",
    fontFamily:
      '"Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, "Liberation Mono", monospace'
  },
  {
    id: "drafting",
    label: "Drafting Mono",
    description: "Use calmer editorial mono stacks for long config and prose editing sessions.",
    fontFamily:
      '"IBM Plex Mono", "Cascadia Mono", "SF Mono", Menlo, Monaco, Consolas, monospace'
  }
];

export const TERMINAL_EDITOR_FOCUS_RHYTHM_OPTIONS: TerminalEditorFocusRhythmOption[] = [
  {
    id: "crisp",
    label: "Crisp",
    description: "Tighter tracking with lighter stroke weight for dense config and code edits.",
    letterSpacing: -0.2,
    fontWeight: 400,
    fontWeightBold: 600
  },
  {
    id: "steady",
    label: "Steady",
    description: "Balanced text weight and spacing for everyday terminal editing.",
    letterSpacing: 0,
    fontWeight: 500,
    fontWeightBold: 700
  },
  {
    id: "open",
    label: "Open",
    description: "Adds more air between glyphs and a heavier stroke for long prose-like edits.",
    letterSpacing: 0.8,
    fontWeight: 600,
    fontWeightBold: 700
  }
];

export const TERMINAL_EDITOR_FOCUS_CURSOR_OPTIONS: TerminalEditorFocusCursorOption[] = [
  {
    id: "beam",
    label: "Beam",
    description: "Thin insertion beam for dense line-by-line editing.",
    cursorStyle: "bar",
    cursorWidth: 2
  },
  {
    id: "underline",
    label: "Underline",
    description: "Underline cursor that stays out of the way in text-heavy buffers.",
    cursorStyle: "underline",
    cursorWidth: 1
  },
  {
    id: "block",
    label: "Block",
    description: "Full block cursor for strong position tracking in modal editors.",
    cursorStyle: "block",
    cursorWidth: 1
  }
];
