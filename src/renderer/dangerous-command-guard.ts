export type DangerousCommandSeverity = "warn" | "critical";

export type DangerousCommandBuiltinRuleId =
  | "recursiveDelete"
  | "diskOverwrite"
  | "formatDisk"
  | "systemShutdown"
  | "privilegedSystemWrite";

export type DangerousCommandExecutionSource =
  | "keyboard"
  | "clipboard"
  | "commandHistoryRun"
  | "commandHistoryPaste"
  | "snippet"
  | "startupCommand"
  | "quickProfile";

export interface DangerousCommandGuardPreferences {
  enabled: boolean;
  builtinRuleStates: Record<DangerousCommandBuiltinRuleId, boolean>;
  customPatternsText: string;
}

export interface DangerousCommandMatch {
  id: string;
  label: string;
  description: string;
  severity: DangerousCommandSeverity;
  origin: "builtin" | "custom";
}

export interface DangerousCommandInspectionResult {
  commandText: string;
  preview: string;
  severity: DangerousCommandSeverity;
  matches: DangerousCommandMatch[];
}

export interface DangerousCommandApprovalRequest {
  tabId: string;
  source: DangerousCommandExecutionSource;
  result: DangerousCommandInspectionResult;
}

export interface DangerousCommandBuiltinRuleDefinition {
  id: DangerousCommandBuiltinRuleId;
  label: string;
  description: string;
  severity: DangerousCommandSeverity;
  patterns: RegExp[];
}

const BUILTIN_DANGEROUS_COMMAND_RULES: DangerousCommandBuiltinRuleDefinition[] = [
  {
    id: "recursiveDelete",
    label: "Recursive delete",
    description: "Matches recursive force-delete commands on Unix, PowerShell, and cmd.",
    severity: "critical",
    patterns: [
      /\brm\s+-[A-Za-z-]*r[A-Za-z-]*f[A-Za-z-]*\b/i,
      /\brm\s+-[A-Za-z-]*f[A-Za-z-]*r[A-Za-z-]*\b/i,
      /\bremove-item\b[^\n\r;|&]*\b-recurse\b[^\n\r;|&]*\b-force\b/i,
      /\bremove-item\b[^\n\r;|&]*\b-force\b[^\n\r;|&]*\b-recurse\b/i,
      /\b(?:rmdir|rd|del)\b[^\n\r;|&]*\s\/s\b[^\n\r;|&]*\s\/q\b/i,
      /\b(?:rmdir|rd|del)\b[^\n\r;|&]*\s\/q\b[^\n\r;|&]*\s\/s\b/i
    ]
  },
  {
    id: "diskOverwrite",
    label: "Raw disk overwrite",
    description: "Matches direct writes to raw devices using dd or similar disk-image commands.",
    severity: "critical",
    patterns: [
      /\bdd\b[^\n\r]*\bof\s*=\s*\/dev\/[A-Za-z0-9._/-]+/i,
      /\bdiskpart\b/i
    ]
  },
  {
    id: "formatDisk",
    label: "Disk format / partition",
    description: "Matches disk formatting and partitioning tools.",
    severity: "critical",
    patterns: [
      /\bmkfs(?:\.[A-Za-z0-9_+-]+)?\b/i,
      /\b(?:fdisk|parted|sfdisk|gdisk)\b/i,
      /\bformat\s+[A-Za-z]:/i
    ]
  },
  {
    id: "systemShutdown",
    label: "Shutdown / reboot",
    description: "Matches reboot, shutdown, halt, or poweroff actions.",
    severity: "warn",
    patterns: [
      /\b(?:shutdown|reboot|halt|poweroff)\b/i,
      /\binit\s+[06]\b/i,
      /\bsystemctl\s+(?:reboot|poweroff)\b/i
    ]
  },
  {
    id: "privilegedSystemWrite",
    label: "Privileged system path write",
    description: "Matches force writes into core system locations under /etc, /usr, /boot, or Windows system folders.",
    severity: "warn",
    patterns: [
      />\s*\/(?:etc|usr|boot|bin|sbin)\//i,
      /\btee\b[^\n\r]*\s\/(?:etc|usr|boot|bin|sbin)\//i,
      />\s*[A-Za-z]:\\Windows\\/i,
      /\b(?:copy|move)\b[^\n\r]*\s[A-Za-z]:\\Windows\\/i
    ]
  }
];

const DEFAULT_BUILTIN_RULE_STATES: Record<DangerousCommandBuiltinRuleId, boolean> = {
  recursiveDelete: true,
  diskOverwrite: true,
  formatDisk: true,
  systemShutdown: true,
  privilegedSystemWrite: true
};

export const MAX_DANGEROUS_COMMAND_CUSTOM_PATTERN_LENGTH = 1600;

export function createDefaultDangerousCommandGuardPreferences(): DangerousCommandGuardPreferences {
  return {
    enabled: true,
    builtinRuleStates: { ...DEFAULT_BUILTIN_RULE_STATES },
    customPatternsText: ""
  };
}

export function normalizeDangerousCommandGuardPreferences(
  value: unknown
): DangerousCommandGuardPreferences {
  const defaults = createDefaultDangerousCommandGuardPreferences();
  if (!value || typeof value !== "object") {
    return defaults;
  }
  const candidate = value as Partial<DangerousCommandGuardPreferences>;
  const candidateStates =
    candidate.builtinRuleStates && typeof candidate.builtinRuleStates === "object"
      ? candidate.builtinRuleStates
      : {};
  const builtinRuleStates = { ...DEFAULT_BUILTIN_RULE_STATES };
  for (const rule of BUILTIN_DANGEROUS_COMMAND_RULES) {
    const nextValue = candidateStates[rule.id as keyof typeof candidateStates];
    if (typeof nextValue === "boolean") {
      builtinRuleStates[rule.id] = nextValue;
    }
  }
  return {
    enabled: candidate.enabled !== false,
    builtinRuleStates,
    customPatternsText:
      typeof candidate.customPatternsText === "string"
        ? candidate.customPatternsText.slice(0, MAX_DANGEROUS_COMMAND_CUSTOM_PATTERN_LENGTH)
        : defaults.customPatternsText
  };
}

export function listDangerousCommandBuiltinRules(): DangerousCommandBuiltinRuleDefinition[] {
  return BUILTIN_DANGEROUS_COMMAND_RULES.map((rule) => ({
    ...rule,
    patterns: [...rule.patterns]
  }));
}

function normalizeCommandText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\r\n/g, "\n").trim();
}

function formatPreview(value: string): string {
  const compact = normalizeCommandText(value).replace(/\s+/g, " ").trim();
  if (!compact) {
    return "";
  }
  return compact.length > 140 ? `${compact.slice(0, 137)}...` : compact;
}

function parseCustomPatternLine(line: string): RegExp | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("/") && trimmed.lastIndexOf("/") > 0) {
    const lastSlash = trimmed.lastIndexOf("/");
    const source = trimmed.slice(1, lastSlash);
    const flags = trimmed.slice(lastSlash + 1) || "i";
    try {
      return new RegExp(source, flags);
    } catch {
      return null;
    }
  }
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
}

export function summarizeDangerousCommandCustomPatterns(
  customPatternsText: string
): {
  activePatterns: number;
  invalidLines: number;
} {
  const lines = customPatternsText
    .slice(0, MAX_DANGEROUS_COMMAND_CUSTOM_PATTERN_LENGTH)
    .split(/\r?\n/);
  let activePatterns = 0;
  let invalidLines = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const parsed = parseCustomPatternLine(trimmed);
    if (!parsed) {
      invalidLines += 1;
      continue;
    }
    activePatterns += 1;
  }
  return {
    activePatterns,
    invalidLines
  };
}

export function inspectDangerousCommandText(
  commandText: string,
  preferences: DangerousCommandGuardPreferences
): DangerousCommandInspectionResult | null {
  const normalizedCommand = normalizeCommandText(commandText);
  if (!preferences.enabled || !normalizedCommand) {
    return null;
  }

  const matches: DangerousCommandMatch[] = [];
  for (const rule of BUILTIN_DANGEROUS_COMMAND_RULES) {
    if (!preferences.builtinRuleStates[rule.id]) {
      continue;
    }
    if (!rule.patterns.some((pattern) => pattern.test(normalizedCommand))) {
      continue;
    }
    matches.push({
      id: rule.id,
      label: rule.label,
      description: rule.description,
      severity: rule.severity,
      origin: "builtin"
    });
  }

  const customLines = preferences.customPatternsText
    .slice(0, MAX_DANGEROUS_COMMAND_CUSTOM_PATTERN_LENGTH)
    .split(/\r?\n/);
  let customIndex = 0;
  for (const line of customLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const pattern = parseCustomPatternLine(trimmed);
    if (!pattern || !pattern.test(normalizedCommand)) {
      continue;
    }
    customIndex += 1;
    matches.push({
      id: `custom-${customIndex}`,
      label: "Custom pattern",
      description: trimmed,
      severity: "warn",
      origin: "custom"
    });
  }

  if (matches.length === 0) {
    return null;
  }

  const severity = matches.some((match) => match.severity === "critical") ? "critical" : "warn";
  return {
    commandText: normalizedCommand,
    preview: formatPreview(normalizedCommand),
    severity,
    matches
  };
}

export function formatDangerousCommandSourceLabel(
  source: DangerousCommandExecutionSource
): string {
  switch (source) {
    case "keyboard":
      return "Keyboard";
    case "clipboard":
      return "Clipboard";
    case "commandHistoryRun":
      return "History Run";
    case "commandHistoryPaste":
      return "History Paste";
    case "snippet":
      return "Snippet";
    case "startupCommand":
      return "Startup Command";
    case "quickProfile":
      return "Quick Profile";
    default:
      return "Terminal";
  }
}

export function shouldInspectDangerousCommandWrite(
  source: DangerousCommandExecutionSource,
  data: string
): boolean {
  if (!data.trim()) {
    return false;
  }
  if (source === "keyboard") {
    return true;
  }
  if (source === "clipboard" || source === "commandHistoryPaste") {
    return /[\r\n]/.test(data);
  }
  return true;
}
