export type DangerousCommandSeverity = "warn" | "critical";

export type DangerousCommandBuiltinRuleId =
  | "recursiveDelete"
  | "diskOverwrite"
  | "formatDisk"
  | "systemShutdown"
  | "privilegedSystemWrite";

export type DangerousCommandPolicyPackId = "balanced" | "operations" | "strict";

export type DangerousCommandEnvironmentTemplateId = "none" | "dev" | "staging" | "prod";

export type DangerousCommandExecutionSource =
  | "keyboard"
  | "clipboard"
  | "commandHistoryRun"
  | "commandHistoryPaste"
  | "snippet"
  | "startupCommand"
  | "quickProfile";

export type DangerousCommandPersistentApprovalScopeId = "global" | "sessionGroup";

export interface DangerousCommandGuardPreferences {
  enabled: boolean;
  sourceStates: Record<DangerousCommandExecutionSource, boolean>;
  builtinRuleStates: Record<DangerousCommandBuiltinRuleId, boolean>;
  policyPackId: DangerousCommandPolicyPackId;
  environmentTemplateId: DangerousCommandEnvironmentTemplateId;
  groupAssignments: DangerousCommandSessionGroupAssignment[];
  persistentApprovals: DangerousCommandPersistentApproval[];
  customPatternsText: string;
}

export interface DangerousCommandSessionGroupAssignment {
  groupName: string;
  policyPackId: DangerousCommandPolicyPackId;
  environmentTemplateId: DangerousCommandEnvironmentTemplateId;
}

export interface DangerousCommandPersistentApproval {
  id: string;
  scope: DangerousCommandPersistentApprovalScopeId;
  sessionGroupName: string | null;
  source: DangerousCommandExecutionSource;
  commandText: string;
  preview: string;
  severity: DangerousCommandSeverity;
  appliedPolicyPackId: DangerousCommandPolicyPackId;
  appliedEnvironmentTemplateId: DangerousCommandEnvironmentTemplateId;
  createdAtIso: string;
}

export interface DangerousCommandMatch {
  id: string;
  label: string;
  description: string;
  severity: DangerousCommandSeverity;
  origin: "builtin" | "policyPack" | "environmentTemplate" | "custom";
}

export interface DangerousCommandInspectionResult {
  commandText: string;
  preview: string;
  severity: DangerousCommandSeverity;
  matches: DangerousCommandMatch[];
  sessionGroupName: string | null;
  appliedPolicyPackId: DangerousCommandPolicyPackId;
  appliedPolicyPackLabel: string;
  appliedEnvironmentTemplateId: DangerousCommandEnvironmentTemplateId;
  appliedEnvironmentTemplateLabel: string;
}

export interface DangerousCommandInspectionContext {
  sessionGroupName?: string | null;
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

export interface DangerousCommandSupplementalRuleDefinition {
  id: string;
  label: string;
  description: string;
  severity: DangerousCommandSeverity;
  patterns: RegExp[];
}

export interface DangerousCommandPolicyPackDefinition {
  id: DangerousCommandPolicyPackId;
  label: string;
  description: string;
  extraRules: DangerousCommandSupplementalRuleDefinition[];
}

export interface DangerousCommandEnvironmentTemplateDefinition {
  id: DangerousCommandEnvironmentTemplateId;
  label: string;
  description: string;
  recommendedPolicyPackId: DangerousCommandPolicyPackId;
  extraRules: DangerousCommandSupplementalRuleDefinition[];
}

export interface DangerousCommandExecutionSourceDefinition {
  id: DangerousCommandExecutionSource;
  label: string;
  description: string;
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

const DEFAULT_SOURCE_STATES: Record<DangerousCommandExecutionSource, boolean> = {
  keyboard: true,
  clipboard: true,
  commandHistoryRun: true,
  commandHistoryPaste: true,
  snippet: true,
  startupCommand: true,
  quickProfile: true
};

const DANGEROUS_COMMAND_EXECUTION_SOURCES: DangerousCommandExecutionSourceDefinition[] = [
  {
    id: "keyboard",
    label: "Keyboard",
    description: "Guard typed commands when Enter submits buffered terminal input."
  },
  {
    id: "clipboard",
    label: "Clipboard Paste",
    description: "Guard pasted multiline text coming directly from the clipboard."
  },
  {
    id: "commandHistoryRun",
    label: "History Run",
    description: "Guard commands launched directly from Command History."
  },
  {
    id: "commandHistoryPaste",
    label: "History Paste",
    description: "Guard command-history text pasted into the terminal without immediate execution."
  },
  {
    id: "snippet",
    label: "Snippet",
    description: "Guard Command Snippet / playbook executions."
  },
  {
    id: "startupCommand",
    label: "Startup Command",
    description: "Guard startup commands that run when a session tab opens."
  },
  {
    id: "quickProfile",
    label: "Quick Profile",
    description: "Guard saved Quick Profile commands launched from the session menu."
  }
];

const DANGEROUS_COMMAND_POLICY_PACKS: DangerousCommandPolicyPackDefinition[] = [
  {
    id: "balanced",
    label: "Balanced",
    description: "Keep the core OS-impacting guardrails while leaving workflow-specific rules opt-in.",
    extraRules: []
  },
  {
    id: "operations",
    label: "Operations",
    description: "Adds service, container, and orchestration actions that often have fleet-wide impact.",
    extraRules: [
      {
        id: "serviceControl",
        label: "Service stop / restart",
        description: "Matches service stop, restart, disable, or reload operations.",
        severity: "warn",
        patterns: [
          /\bsystemctl\s+(?:stop|restart|reload|disable|mask)\b/i,
          /\bservice\s+\S+\s+(?:stop|restart|reload)\b/i,
          /\bsc(?:\.exe)?\s+(?:stop|config)\b/i
        ]
      },
      {
        id: "clusterOrContainerDestruction",
        label: "Container / cluster destructive action",
        description: "Matches kubectl delete, helm uninstall, docker compose down, and prune flows.",
        severity: "critical",
        patterns: [
          /\bkubectl\s+delete\b/i,
          /\bhelm\s+(?:uninstall|delete)\b/i,
          /\bdocker\s+compose\s+down\b/i,
          /\bdocker\s+(?:rm|rmi|system\s+prune|volume\s+prune|container\s+prune|image\s+prune)\b/i
        ]
      }
    ]
  },
  {
    id: "strict",
    label: "Strict",
    description: "Extends operations coverage with infrastructure destroy and data-destructive commands.",
    extraRules: [
      {
        id: "serviceControl",
        label: "Service stop / restart",
        description: "Matches service stop, restart, disable, or reload operations.",
        severity: "warn",
        patterns: [
          /\bsystemctl\s+(?:stop|restart|reload|disable|mask)\b/i,
          /\bservice\s+\S+\s+(?:stop|restart|reload)\b/i,
          /\bsc(?:\.exe)?\s+(?:stop|config)\b/i
        ]
      },
      {
        id: "clusterOrContainerDestruction",
        label: "Container / cluster destructive action",
        description: "Matches kubectl delete, helm uninstall, docker compose down, and prune flows.",
        severity: "critical",
        patterns: [
          /\bkubectl\s+delete\b/i,
          /\bhelm\s+(?:uninstall|delete)\b/i,
          /\bdocker\s+compose\s+down\b/i,
          /\bdocker\s+(?:rm|rmi|system\s+prune|volume\s+prune|container\s+prune|image\s+prune)\b/i
        ]
      },
      {
        id: "infrastructureDestroy",
        label: "Infrastructure destroy",
        description: "Matches Terraform, Terragrunt, or Pulumi destroy workflows.",
        severity: "critical",
        patterns: [/\bterraform\s+destroy\b/i, /\bterragrunt\s+destroy\b/i, /\bpulumi\s+destroy\b/i]
      },
      {
        id: "databaseDestruction",
        label: "Database drop / truncate",
        description: "Matches destructive SQL and cache flush operations.",
        severity: "critical",
        patterns: [
          /\bdrop\s+(?:database|schema|table)\b/i,
          /\btruncate\s+table\b/i,
          /\bredis-cli\b[^\n\r;|&]*\bflush(?:all|db)\b/i
        ]
      }
    ]
  }
];

const DANGEROUS_COMMAND_ENVIRONMENT_TEMPLATES: DangerousCommandEnvironmentTemplateDefinition[] = [
  {
    id: "none",
    label: "No Template",
    description: "Do not layer environment-specific rules on top of the selected policy pack.",
    recommendedPolicyPackId: "balanced",
    extraRules: []
  },
  {
    id: "dev",
    label: "Development",
    description: "Keeps core guardrails with no extra environment-specific patterns.",
    recommendedPolicyPackId: "balanced",
    extraRules: []
  },
  {
    id: "staging",
    label: "Staging",
    description: "Adds rollout and restart commands that can still disrupt shared validation environments.",
    recommendedPolicyPackId: "operations",
    extraRules: [
      {
        id: "stagingRolloutRestart",
        label: "Rollout / process restart",
        description: "Matches rollout restarts and process-manager restarts in shared staging environments.",
        severity: "warn",
        patterns: [
          /\bkubectl\s+rollout\s+restart\b/i,
          /\bpm2\s+(?:restart|reload)\b/i,
          /\bsupervisorctl\s+restart\b/i,
          /\bdocker\s+compose\s+restart\b/i
        ]
      }
    ]
  },
  {
    id: "prod",
    label: "Production",
    description: "Adds restart and data-reset helpers that deserve an explicit second look on prod hosts.",
    recommendedPolicyPackId: "strict",
    extraRules: [
      {
        id: "productionRestart",
        label: "Production rollout / restart",
        description: "Matches common production restart and rollout commands.",
        severity: "warn",
        patterns: [
          /\bkubectl\s+rollout\s+restart\b/i,
          /\bpm2\s+(?:restart|reload)\b/i,
          /\bservice\s+\S+\s+(?:restart|reload)\b/i
        ]
      },
      {
        id: "frameworkReset",
        label: "Framework reset helper",
        description: "Matches framework-specific reset helpers such as Prisma, Rails, or Sequelize resets.",
        severity: "critical",
        patterns: [
          /\bprisma\s+migrate\s+reset\b/i,
          /\brails\s+db:(?:drop|reset)\b/i,
          /\bsequelize\s+db:drop\b/i
        ]
      }
    ]
  }
];

export const MAX_DANGEROUS_COMMAND_CUSTOM_PATTERN_LENGTH = 1600;
export const MAX_DANGEROUS_COMMAND_GROUP_ASSIGNMENTS = 40;
export const MAX_DANGEROUS_COMMAND_PERSISTENT_APPROVALS = 120;

export function createDefaultDangerousCommandGuardPreferences(): DangerousCommandGuardPreferences {
  return {
    enabled: true,
    sourceStates: { ...DEFAULT_SOURCE_STATES },
    builtinRuleStates: { ...DEFAULT_BUILTIN_RULE_STATES },
    policyPackId: "balanced",
    environmentTemplateId: "none",
    groupAssignments: [],
    persistentApprovals: [],
    customPatternsText: ""
  };
}

function normalizeDangerousCommandGroupName(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

function normalizeDangerousCommandGroupAssignments(
  value: unknown
): DangerousCommandSessionGroupAssignment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized: DangerousCommandSessionGroupAssignment[] = [];
  const seenNames = new Set<string>();
  for (const row of value) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const candidate = row as Partial<DangerousCommandSessionGroupAssignment>;
    const groupName = normalizeDangerousCommandGroupName(candidate.groupName);
    if (!groupName || seenNames.has(groupName.toLowerCase())) {
      continue;
    }
    const candidatePolicyPackId = candidate.policyPackId;
    const policyPackId: DangerousCommandPolicyPackId =
      candidatePolicyPackId &&
      DANGEROUS_COMMAND_POLICY_PACKS.some((pack) => pack.id === candidatePolicyPackId)
        ? candidatePolicyPackId
        : "balanced";
    const candidateEnvironmentTemplateId = candidate.environmentTemplateId;
    const environmentTemplateId: DangerousCommandEnvironmentTemplateId =
      candidateEnvironmentTemplateId &&
      DANGEROUS_COMMAND_ENVIRONMENT_TEMPLATES.some(
        (template) => template.id === candidateEnvironmentTemplateId
      )
        ? candidateEnvironmentTemplateId
        : "none";
    normalized.push({
      groupName,
      policyPackId,
      environmentTemplateId
    });
    seenNames.add(groupName.toLowerCase());
    if (normalized.length >= MAX_DANGEROUS_COMMAND_GROUP_ASSIGNMENTS) {
      break;
    }
  }
  normalized.sort((left, right) => left.groupName.localeCompare(right.groupName));
  return normalized;
}

function normalizeDangerousCommandPersistentApprovals(
  value: unknown
): DangerousCommandPersistentApproval[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized: DangerousCommandPersistentApproval[] = [];
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  for (const row of value) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const candidate = row as Partial<DangerousCommandPersistentApproval>;
    const candidateScope = candidate.scope;
    const scope: DangerousCommandPersistentApprovalScopeId =
      candidateScope === "sessionGroup" ? "sessionGroup" : "global";
    const sessionGroupName =
      scope === "sessionGroup"
        ? normalizeDangerousCommandGroupName(candidate.sessionGroupName)
        : "";
    if (scope === "sessionGroup" && !sessionGroupName) {
      continue;
    }
    const candidateSource = candidate.source;
    const source =
      candidateSource &&
      DANGEROUS_COMMAND_EXECUTION_SOURCES.some((entry) => entry.id === candidateSource)
        ? candidateSource
        : null;
    if (!source) {
      continue;
    }
    const commandText = normalizeCommandText(
      typeof candidate.commandText === "string" ? candidate.commandText : ""
    );
    if (!commandText) {
      continue;
    }
    const candidatePolicyPackId = candidate.appliedPolicyPackId;
    const appliedPolicyPackId: DangerousCommandPolicyPackId =
      candidatePolicyPackId &&
      DANGEROUS_COMMAND_POLICY_PACKS.some((pack) => pack.id === candidatePolicyPackId)
        ? candidatePolicyPackId
        : "balanced";
    const candidateEnvironmentTemplateId = candidate.appliedEnvironmentTemplateId;
    const appliedEnvironmentTemplateId: DangerousCommandEnvironmentTemplateId =
      candidateEnvironmentTemplateId &&
      DANGEROUS_COMMAND_ENVIRONMENT_TEMPLATES.some(
        (template) => template.id === candidateEnvironmentTemplateId
      )
        ? candidateEnvironmentTemplateId
        : "none";
    const severity: DangerousCommandSeverity =
      candidate.severity === "critical" ? "critical" : "warn";
    const preview =
      typeof candidate.preview === "string" && candidate.preview.trim().length > 0
        ? candidate.preview.trim().slice(0, 180)
        : formatPreview(commandText);
    const signature = [
      scope,
      sessionGroupName.toLowerCase(),
      source,
      commandText,
      appliedPolicyPackId,
      appliedEnvironmentTemplateId
    ].join("|");
    if (seenSignatures.has(signature)) {
      continue;
    }
    const id =
      typeof candidate.id === "string" && candidate.id.trim().length > 0
        ? candidate.id.trim().slice(0, 120)
        : `dcpa-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    if (seenIds.has(id.toLowerCase())) {
      continue;
    }
    normalized.push({
      id,
      scope,
      sessionGroupName: scope === "sessionGroup" ? sessionGroupName : null,
      source,
      commandText,
      preview,
      severity,
      appliedPolicyPackId,
      appliedEnvironmentTemplateId,
      createdAtIso:
        typeof candidate.createdAtIso === "string" && candidate.createdAtIso.trim().length > 0
          ? candidate.createdAtIso.trim().slice(0, 64)
          : new Date().toISOString()
    });
    seenIds.add(id.toLowerCase());
    seenSignatures.add(signature);
    if (normalized.length >= MAX_DANGEROUS_COMMAND_PERSISTENT_APPROVALS) {
      break;
    }
  }
  normalized.sort((left, right) => right.createdAtIso.localeCompare(left.createdAtIso));
  return normalized;
}

export function normalizeDangerousCommandGuardPreferences(
  value: unknown
): DangerousCommandGuardPreferences {
  const defaults = createDefaultDangerousCommandGuardPreferences();
  if (!value || typeof value !== "object") {
    return defaults;
  }
  const candidate = value as Partial<DangerousCommandGuardPreferences>;
  const candidateSourceStates =
    candidate.sourceStates && typeof candidate.sourceStates === "object" ? candidate.sourceStates : {};
  const sourceStates = { ...DEFAULT_SOURCE_STATES };
  for (const source of DANGEROUS_COMMAND_EXECUTION_SOURCES) {
    const nextValue = candidateSourceStates[source.id as keyof typeof candidateSourceStates];
    if (typeof nextValue === "boolean") {
      sourceStates[source.id] = nextValue;
    }
  }
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
  const candidatePolicyPackId = candidate.policyPackId;
  const policyPackId: DangerousCommandPolicyPackId =
    candidatePolicyPackId &&
    DANGEROUS_COMMAND_POLICY_PACKS.some((pack) => pack.id === candidatePolicyPackId)
      ? candidatePolicyPackId
      : defaults.policyPackId;
  const candidateEnvironmentTemplateId = candidate.environmentTemplateId;
  const environmentTemplateId: DangerousCommandEnvironmentTemplateId =
    candidateEnvironmentTemplateId &&
    DANGEROUS_COMMAND_ENVIRONMENT_TEMPLATES.some(
      (template) => template.id === candidateEnvironmentTemplateId
    )
      ? candidateEnvironmentTemplateId
      : defaults.environmentTemplateId;
  return {
    enabled: candidate.enabled !== false,
    sourceStates,
    builtinRuleStates,
    policyPackId,
    environmentTemplateId,
    groupAssignments: normalizeDangerousCommandGroupAssignments(candidate.groupAssignments),
    persistentApprovals: normalizeDangerousCommandPersistentApprovals(
      candidate.persistentApprovals
    ),
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

export function listDangerousCommandPolicyPacks(): DangerousCommandPolicyPackDefinition[] {
  return DANGEROUS_COMMAND_POLICY_PACKS.map((pack) => ({
    ...pack,
    extraRules: pack.extraRules.map((rule) => ({
      ...rule,
      patterns: [...rule.patterns]
    }))
  }));
}

export function listDangerousCommandEnvironmentTemplates(): DangerousCommandEnvironmentTemplateDefinition[] {
  return DANGEROUS_COMMAND_ENVIRONMENT_TEMPLATES.map((template) => ({
    ...template,
    extraRules: template.extraRules.map((rule) => ({
      ...rule,
      patterns: [...rule.patterns]
    }))
  }));
}

export function listDangerousCommandExecutionSources(): DangerousCommandExecutionSourceDefinition[] {
  return DANGEROUS_COMMAND_EXECUTION_SOURCES.map((source) => ({
    ...source
  }));
}

export function findDangerousCommandGroupAssignment(
  preferences: DangerousCommandGuardPreferences,
  groupName: string | null | undefined
): DangerousCommandSessionGroupAssignment | null {
  const normalizedGroupName = normalizeDangerousCommandGroupName(groupName);
  if (!normalizedGroupName) {
    return null;
  }
  return (
    preferences.groupAssignments.find(
      (assignment) => assignment.groupName.toLowerCase() === normalizedGroupName.toLowerCase()
    ) ?? null
  );
}

function normalizeCommandText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\r\n/g, "\n").trim();
}

function resolveDangerousCommandPolicyPack(
  packId: DangerousCommandPolicyPackId
): DangerousCommandPolicyPackDefinition {
  return (
    DANGEROUS_COMMAND_POLICY_PACKS.find((pack) => pack.id === packId) ??
    DANGEROUS_COMMAND_POLICY_PACKS[0]
  );
}

function resolveDangerousCommandEnvironmentTemplate(
  templateId: DangerousCommandEnvironmentTemplateId
): DangerousCommandEnvironmentTemplateDefinition {
  return (
    DANGEROUS_COMMAND_ENVIRONMENT_TEMPLATES.find((template) => template.id === templateId) ??
    DANGEROUS_COMMAND_ENVIRONMENT_TEMPLATES[0]
  );
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
  preferences: DangerousCommandGuardPreferences,
  context?: DangerousCommandInspectionContext
): DangerousCommandInspectionResult | null {
  const normalizedCommand = normalizeCommandText(commandText);
  if (!preferences.enabled || !normalizedCommand) {
    return null;
  }

  const sessionGroupName = normalizeDangerousCommandGroupName(context?.sessionGroupName);
  const groupAssignment = findDangerousCommandGroupAssignment(preferences, sessionGroupName);
  const activePolicyPack = resolveDangerousCommandPolicyPack(
    groupAssignment?.policyPackId ?? preferences.policyPackId
  );
  const activeEnvironmentTemplate = resolveDangerousCommandEnvironmentTemplate(
    groupAssignment?.environmentTemplateId ?? preferences.environmentTemplateId
  );
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

  for (const rule of activePolicyPack.extraRules) {
    if (!rule.patterns.some((pattern) => pattern.test(normalizedCommand))) {
      continue;
    }
    matches.push({
      id: `policy-${activePolicyPack.id}-${rule.id}`,
      label: `${rule.label} (${activePolicyPack.label})`,
      description: rule.description,
      severity: rule.severity,
      origin: "policyPack"
    });
  }

  for (const rule of activeEnvironmentTemplate.extraRules) {
    if (!rule.patterns.some((pattern) => pattern.test(normalizedCommand))) {
      continue;
    }
    matches.push({
      id: `environment-${activeEnvironmentTemplate.id}-${rule.id}`,
      label: `${rule.label} (${activeEnvironmentTemplate.label})`,
      description: rule.description,
      severity: rule.severity,
      origin: "environmentTemplate"
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
    matches,
    sessionGroupName: sessionGroupName || null,
    appliedPolicyPackId: activePolicyPack.id,
    appliedPolicyPackLabel: activePolicyPack.label,
    appliedEnvironmentTemplateId: activeEnvironmentTemplate.id,
    appliedEnvironmentTemplateLabel: activeEnvironmentTemplate.label
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
  data: string,
  preferences?: DangerousCommandGuardPreferences
): boolean {
  if (!data.trim()) {
    return false;
  }
  if (preferences) {
    if (!preferences.enabled) {
      return false;
    }
    if (preferences.sourceStates[source] === false) {
      return false;
    }
  }
  if (source === "keyboard") {
    return true;
  }
  if (source === "clipboard" || source === "commandHistoryPaste") {
    return /[\r\n]/.test(data);
  }
  return true;
}
