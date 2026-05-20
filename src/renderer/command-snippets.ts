export const COMMAND_SNIPPET_GROUPS_STORAGE_KEY = "termdock.command-snippet-groups.v1";
export const COMMAND_SNIPPET_SCOPED_VALUES_STORAGE_KEY = "termdock.command-snippet-scoped-values.v1";
export const MAX_COMMAND_SNIPPET_GROUPS = 40;
export const MAX_COMMAND_SNIPPETS_PER_GROUP = 120;
export const MAX_COMMAND_SNIPPET_PROMPT_SETS = 24;
export const MAX_COMMAND_SNIPPET_PARAMETERS = 12;
export const MAX_COMMAND_SNIPPET_PROMPT_SET_NAME_LENGTH = 80;
export const MAX_COMMAND_SNIPPET_PARAMETER_KEY_LENGTH = 32;
export const MAX_COMMAND_SNIPPET_PARAMETER_LABEL_LENGTH = 80;
export const MAX_COMMAND_SNIPPET_PARAMETER_DEFAULT_LENGTH = 240;
export const MAX_COMMAND_SNIPPET_PARAMETER_PATTERN_LENGTH = 240;
export const MAX_COMMAND_SNIPPET_SCOPED_VALUES = 400;
export const COMMAND_SNIPPET_PARAMETER_TOKEN_PATTERN = /\$\{param:([a-zA-Z0-9_-]+)\}/g;

const COMMAND_SNIPPET_PARAMETER_KEY_SANITIZE_PATTERN = /[^a-zA-Z0-9_-]+/g;

export type CommandSnippetVariableScopeId = "snippet" | "group" | "session" | "global";

export const COMMAND_SNIPPET_VARIABLE_SCOPES: Array<{
  id: CommandSnippetVariableScopeId;
  label: string;
  description: string;
}> = [
  {
    id: "snippet",
    label: "Per Snippet",
    description: "Remember the last value only for this snippet."
  },
  {
    id: "group",
    label: "Per Group",
    description: "Reuse the last value across snippets in the same group."
  },
  {
    id: "session",
    label: "Per Session",
    description: "Reuse the last value for the active SSH session."
  },
  {
    id: "global",
    label: "Global",
    description: "Reuse the last value everywhere in this app."
  }
];

export interface CommandSnippetItem {
  id: string;
  name: string;
  template: string;
  confirmBeforeRun: boolean;
  previewBeforeRun: boolean;
  promptSetId: string;
  parameters: CommandSnippetParameter[];
}

export interface CommandSnippetParameter {
  id: string;
  key: string;
  label: string;
  defaultValue: string;
  required: boolean;
  pattern: string;
  scope: CommandSnippetVariableScopeId;
}

export interface CommandSnippetPromptSet {
  id: string;
  name: string;
  parameters: CommandSnippetParameter[];
}

export interface CommandSnippetGroup {
  id: string;
  name: string;
  promptSets: CommandSnippetPromptSet[];
  snippets: CommandSnippetItem[];
}

export interface CommandSnippetScopedValueRecord {
  value: string;
  updatedAt: number;
}

export function normalizeCommandSnippetParameterKey(value: string): string {
  return value
    .trim()
    .replace(COMMAND_SNIPPET_PARAMETER_KEY_SANITIZE_PATTERN, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_COMMAND_SNIPPET_PARAMETER_KEY_LENGTH);
}

export function buildCommandSnippetParameterToken(key: string): string {
  return `\${param:${key}}`;
}

export function normalizeCommandSnippetVariableScope(
  value: unknown
): CommandSnippetVariableScopeId {
  return value === "group" || value === "session" || value === "global" ? value : "snippet";
}

export function formatCommandSnippetVariableScopeLabel(scope: CommandSnippetVariableScopeId): string {
  return COMMAND_SNIPPET_VARIABLE_SCOPES.find((entry) => entry.id === scope)?.label ?? "Per Snippet";
}

export function buildCommandSnippetScopedValueCacheKey(options: {
  scope: CommandSnippetVariableScopeId;
  key: string;
  snippetId: string;
  groupId: string;
  sessionId: string;
}): string {
  const normalizedKey = normalizeCommandSnippetParameterKey(options.key);
  if (!normalizedKey) {
    return "";
  }
  if (options.scope === "global") {
    return `global:${normalizedKey}`;
  }
  if (options.scope === "session") {
    return options.sessionId.trim() ? `session:${options.sessionId.trim()}:${normalizedKey}` : "";
  }
  if (options.scope === "group") {
    return options.groupId.trim() ? `group:${options.groupId.trim()}:${normalizedKey}` : "";
  }
  return options.snippetId.trim() ? `snippet:${options.snippetId.trim()}:${normalizedKey}` : "";
}

export function createCommandSnippetParameter(
  ordinal: number,
  existingKeys: ReadonlySet<string> = new Set<string>(),
  scope: CommandSnippetVariableScopeId = "snippet"
): CommandSnippetParameter {
  let nextOrdinal = Math.max(1, Math.trunc(ordinal));
  let nextKey = normalizeCommandSnippetParameterKey(`value_${nextOrdinal}`);
  while (!nextKey || existingKeys.has(nextKey)) {
    nextOrdinal += 1;
    nextKey = normalizeCommandSnippetParameterKey(`value_${nextOrdinal}`);
  }
  return {
    id: `sp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    key: nextKey,
    label: `Value ${nextOrdinal}`,
    defaultValue: "",
    required: true,
    pattern: "",
    scope
  };
}

export function mergeCommandSnippetParameters(
  snippet: CommandSnippetItem | null,
  promptSet: CommandSnippetPromptSet | null
): CommandSnippetParameter[] {
  if (!snippet && !promptSet) {
    return [];
  }
  const snippetParameters = snippet?.parameters ?? [];
  const snippetKeys = new Set(snippetParameters.map((parameter) => parameter.key));
  return [
    ...(promptSet?.parameters.filter((parameter) => !snippetKeys.has(parameter.key)) ?? []),
    ...snippetParameters
  ];
}

export function listCommandSnippetTemplateParameterKeys(template: string): string[] {
  if (!template) {
    return [];
  }
  const keys: string[] = [];
  const seenKeys = new Set<string>();
  for (const match of template.matchAll(COMMAND_SNIPPET_PARAMETER_TOKEN_PATTERN)) {
    const key = typeof match[1] === "string" ? match[1].trim() : "";
    if (!key || seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    keys.push(key);
  }
  return keys;
}

export function getCommandSnippetParameterPatternError(pattern: string): string | null {
  const trimmedPattern = pattern.trim();
  if (!trimmedPattern) {
    return null;
  }
  try {
    new RegExp(trimmedPattern);
    return null;
  } catch (caughtError) {
    return caughtError instanceof Error && caughtError.message
      ? caughtError.message
      : "Invalid regular expression.";
  }
}

export function normalizeCommandSnippetParameters(payload: unknown): CommandSnippetParameter[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  const normalized: CommandSnippetParameter[] = [];
  const seenParameterIds = new Set<string>();
  const seenParameterKeys = new Set<string>();
  for (const row of payload) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const candidate = row as Partial<CommandSnippetParameter>;
    const parameterId =
      typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id.trim()
        : `sp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    if (seenParameterIds.has(parameterId)) {
      continue;
    }
    const parameterKey = normalizeCommandSnippetParameterKey(
      typeof candidate.key === "string" ? candidate.key : ""
    );
    if (!parameterKey || seenParameterKeys.has(parameterKey)) {
      continue;
    }
    seenParameterIds.add(parameterId);
    seenParameterKeys.add(parameterKey);
    const parameterLabel =
      typeof candidate.label === "string" && candidate.label.trim()
        ? candidate.label.trim().slice(0, MAX_COMMAND_SNIPPET_PARAMETER_LABEL_LENGTH)
        : parameterKey;
    normalized.push({
      id: parameterId,
      key: parameterKey,
      label: parameterLabel,
      defaultValue:
        typeof candidate.defaultValue === "string"
          ? candidate.defaultValue.slice(0, MAX_COMMAND_SNIPPET_PARAMETER_DEFAULT_LENGTH)
          : "",
      required: candidate.required !== false,
      pattern:
        typeof candidate.pattern === "string"
          ? candidate.pattern.trim().slice(0, MAX_COMMAND_SNIPPET_PARAMETER_PATTERN_LENGTH)
          : "",
      scope: normalizeCommandSnippetVariableScope(candidate.scope)
    });
    if (normalized.length >= MAX_COMMAND_SNIPPET_PARAMETERS) {
      break;
    }
  }
  return normalized;
}

export function normalizeCommandSnippetPromptSets(payload: unknown): CommandSnippetPromptSet[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  const normalized: CommandSnippetPromptSet[] = [];
  const seenPromptSetIds = new Set<string>();
  for (const row of payload) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const candidate = row as Partial<CommandSnippetPromptSet>;
    const promptSetId =
      typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id.trim()
        : `sps-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    if (seenPromptSetIds.has(promptSetId)) {
      continue;
    }
    const promptSetName = typeof candidate.name === "string" ? candidate.name.trim() : "";
    if (!promptSetName) {
      continue;
    }
    seenPromptSetIds.add(promptSetId);
    normalized.push({
      id: promptSetId,
      name: promptSetName.slice(0, MAX_COMMAND_SNIPPET_PROMPT_SET_NAME_LENGTH),
      parameters: normalizeCommandSnippetParameters(
        (candidate as Partial<CommandSnippetPromptSet> & { parameters?: unknown }).parameters
      )
    });
    if (normalized.length >= MAX_COMMAND_SNIPPET_PROMPT_SETS) {
      break;
    }
  }
  return normalized;
}

export function normalizeCommandSnippetGroups(payload: unknown): CommandSnippetGroup[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { groups?: unknown }).groups)
      ? (payload as { groups: unknown[] }).groups
      : [];
  const normalized: CommandSnippetGroup[] = [];
  const seenGroupIds = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const candidate = row as Partial<CommandSnippetGroup>;
    const groupId =
      typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id.trim()
        : `sg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    if (seenGroupIds.has(groupId)) {
      continue;
    }
    const groupName = typeof candidate.name === "string" ? candidate.name.trim() : "";
    if (!groupName) {
      continue;
    }
    const promptSets = normalizeCommandSnippetPromptSets(
      (candidate as Partial<CommandSnippetGroup> & { promptSets?: unknown }).promptSets
    );
    const validPromptSetIds = new Set(promptSets.map((promptSet) => promptSet.id));
    const snippets = Array.isArray(candidate.snippets) ? candidate.snippets : [];
    const normalizedSnippets: CommandSnippetItem[] = [];
    const seenSnippetIds = new Set<string>();
    for (const snippetRow of snippets) {
      if (!snippetRow || typeof snippetRow !== "object") {
        continue;
      }
      const snippet = snippetRow as Partial<CommandSnippetItem>;
      const snippetId =
        typeof snippet.id === "string" && snippet.id.trim()
          ? snippet.id.trim()
          : `sn-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      if (seenSnippetIds.has(snippetId)) {
        continue;
      }
      const snippetName = typeof snippet.name === "string" ? snippet.name.trim() : "";
      const template = typeof snippet.template === "string" ? snippet.template.trim() : "";
      if (!snippetName || !template) {
        continue;
      }
      seenSnippetIds.add(snippetId);
      normalizedSnippets.push({
        id: snippetId,
        name: snippetName.slice(0, 80),
        template: template.slice(0, 4000),
        confirmBeforeRun: snippet.confirmBeforeRun === true,
        previewBeforeRun: snippet.previewBeforeRun === true,
        promptSetId:
          typeof snippet.promptSetId === "string" && validPromptSetIds.has(snippet.promptSetId.trim())
            ? snippet.promptSetId.trim()
            : "",
        parameters: normalizeCommandSnippetParameters(
          (snippet as Partial<CommandSnippetItem> & { parameters?: unknown }).parameters
        )
      });
      if (normalizedSnippets.length >= MAX_COMMAND_SNIPPETS_PER_GROUP) {
        break;
      }
    }
    seenGroupIds.add(groupId);
    normalized.push({
      id: groupId,
      name: groupName.slice(0, 80),
      promptSets,
      snippets: normalizedSnippets
    });
    if (normalized.length >= MAX_COMMAND_SNIPPET_GROUPS) {
      break;
    }
  }
  return normalized;
}

export function readCommandSnippetGroups(): CommandSnippetGroup[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const rawValue = window.localStorage.getItem(COMMAND_SNIPPET_GROUPS_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }
    return normalizeCommandSnippetGroups(JSON.parse(rawValue));
  } catch {
    return [];
  }
}

export function normalizeCommandSnippetScopedValues(
  payload: unknown
): Record<string, CommandSnippetScopedValueRecord> {
  if (!payload || typeof payload !== "object") {
    return {};
  }
  const normalizedEntries: Array<[string, CommandSnippetScopedValueRecord]> = [];
  for (const [rawKey, rawValue] of Object.entries(payload)) {
    if (typeof rawKey !== "string" || !rawKey.trim() || !rawValue || typeof rawValue !== "object") {
      continue;
    }
    const candidate = rawValue as Partial<CommandSnippetScopedValueRecord>;
    const value = typeof candidate.value === "string" ? candidate.value.slice(0, 4000) : "";
    const updatedAt =
      typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt)
        ? candidate.updatedAt
        : Date.now();
    normalizedEntries.push([
      rawKey.trim(),
      {
        value,
        updatedAt
      }
    ]);
  }
  normalizedEntries.sort((left, right) => right[1].updatedAt - left[1].updatedAt);
  return Object.fromEntries(normalizedEntries.slice(0, MAX_COMMAND_SNIPPET_SCOPED_VALUES));
}

export function readCommandSnippetScopedValues(): Record<string, CommandSnippetScopedValueRecord> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const rawValue = window.localStorage.getItem(COMMAND_SNIPPET_SCOPED_VALUES_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }
    return normalizeCommandSnippetScopedValues(JSON.parse(rawValue));
  } catch {
    return {};
  }
}
