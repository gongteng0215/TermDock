/** Shared shapes for Phase 4 session quick profiles + templates (SQLite-safe). */

export interface PersistedSessionQuickProfile {
  id: string;
  name: string;
  startupCommand: string;
  confirmBeforeRun: boolean;
}

export interface PersistedSessionTemplateEnvVar {
  id: string;
  key: string;
  value: string;
}

export interface PersistedSessionTemplateRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  templateName: string;
  sessionName: string;
  host: string;
  port: string;
  username: string;
  authType: "password" | "privateKey";
  privateKeyPath: string;
  groupId: string;
  remark: string;
  favorite: boolean;
  /** True when a secret exists locally; the secret itself is never stored in SQLite. */
  hasSecret: boolean;
  envVars: PersistedSessionTemplateEnvVar[];
}

export const MAX_PERSISTED_SESSION_QUICK_PROFILES = 80;
export const MAX_PERSISTED_SESSION_TEMPLATES = 60;

export function normalizePersistedSessionQuickProfiles(
  payload: unknown
): PersistedSessionQuickProfile[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  const normalized: PersistedSessionQuickProfile[] = [];
  const seen = new Set<string>();
  for (const row of payload) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const candidate = row as Partial<PersistedSessionQuickProfile>;
    const id =
      typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id.trim()
        : `qp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    if (seen.has(id)) {
      continue;
    }
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const startupCommand =
      typeof candidate.startupCommand === "string" ? candidate.startupCommand.trim() : "";
    if (!name || !startupCommand) {
      continue;
    }
    seen.add(id);
    normalized.push({
      id,
      name: name.slice(0, 80),
      startupCommand: startupCommand.slice(0, 4000),
      confirmBeforeRun: candidate.confirmBeforeRun === true
    });
    if (normalized.length >= MAX_PERSISTED_SESSION_QUICK_PROFILES) {
      break;
    }
  }
  return normalized;
}

function normalizePersistedSessionTemplateEnvVars(
  payload: unknown
): PersistedSessionTemplateEnvVar[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  const normalized: PersistedSessionTemplateEnvVar[] = [];
  const seenKeys = new Set<string>();
  for (const row of payload) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const candidate = row as Partial<PersistedSessionTemplateEnvVar>;
    const key = typeof candidate.key === "string" ? candidate.key.trim() : "";
    if (!key || seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    normalized.push({
      id:
        typeof candidate.id === "string" && candidate.id.trim()
          ? candidate.id.trim()
          : `env-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      key: key.slice(0, 80),
      value: typeof candidate.value === "string" ? candidate.value.slice(0, 400) : ""
    });
    if (normalized.length >= 16) {
      break;
    }
  }
  return normalized;
}

export function normalizePersistedSessionTemplates(
  payload: unknown
): PersistedSessionTemplateRecord[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  const normalized: PersistedSessionTemplateRecord[] = [];
  const seenIds = new Set<string>();
  for (const row of payload) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const candidate = row as Partial<PersistedSessionTemplateRecord> & { secret?: string };
    const templateName =
      typeof candidate.templateName === "string" ? candidate.templateName.trim().slice(0, 80) : "";
    if (!templateName) {
      continue;
    }
    const id =
      typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id.trim()
        : `st-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    if (seenIds.has(id)) {
      continue;
    }
    const createdAt =
      typeof candidate.createdAt === "number" && Number.isFinite(candidate.createdAt)
        ? candidate.createdAt
        : Date.now();
    const updatedAt =
      typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt)
        ? candidate.updatedAt
        : createdAt;
    const hasSecret =
      candidate.hasSecret === true ||
      (typeof candidate.secret === "string" && candidate.secret.trim().length > 0);
    seenIds.add(id);
    normalized.push({
      id,
      createdAt,
      updatedAt,
      templateName,
      sessionName:
        typeof candidate.sessionName === "string" ? candidate.sessionName.trim().slice(0, 120) : "",
      host: typeof candidate.host === "string" ? candidate.host.trim().slice(0, 255) : "",
      port: typeof candidate.port === "string" ? candidate.port.trim().slice(0, 16) : "22",
      username:
        typeof candidate.username === "string" ? candidate.username.trim().slice(0, 120) : "",
      authType: candidate.authType === "privateKey" ? "privateKey" : "password",
      privateKeyPath:
        typeof candidate.privateKeyPath === "string"
          ? candidate.privateKeyPath.trim().slice(0, 512)
          : "",
      groupId: typeof candidate.groupId === "string" ? candidate.groupId.trim().slice(0, 120) : "",
      remark: typeof candidate.remark === "string" ? candidate.remark.trim().slice(0, 400) : "",
      favorite: candidate.favorite === true,
      hasSecret,
      envVars: normalizePersistedSessionTemplateEnvVars(candidate.envVars)
    });
    if (normalized.length >= MAX_PERSISTED_SESSION_TEMPLATES) {
      break;
    }
  }
  return normalized.sort((left, right) => right.updatedAt - left.updatedAt);
}

export function stripSessionTemplateSecretsForSqlite(
  templates: Array<Omit<PersistedSessionTemplateRecord, "hasSecret"> & { secret?: string }>
): PersistedSessionTemplateRecord[] {
  return templates.map(({ secret, ...rest }) => ({
    ...rest,
    hasSecret: typeof secret === "string" && secret.trim().length > 0
  }));
}
