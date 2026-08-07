import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

import type {
  SessionAuthType,
  SessionCreateInput,
  SessionCustomField,
  SessionEnvironment,
  SessionRecord,
  SessionUpdateInput
} from "../../../shared/session.js";
import { configureSqliteConnection, migrateSqliteSchema } from "./schema.js";

interface SessionRow {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: SessionAuthType;
  private_key_path: string | null;
  jump_session_id: string | null;
  group_id: string | null;
  remark: string | null;
  environment: SessionEnvironment | null;
  tags_json: string | null;
  owner: string | null;
  custom_fields_json: string | null;
  favorite: number;
  has_secret: number;
  last_connected_at: string | null;
  created_at: string;
  updated_at: string;
}

function compareSessionRecency(left: SessionRecord, right: SessionRecord): number {
  const leftRecent = left.lastConnectedAt ?? "";
  const rightRecent = right.lastConnectedAt ?? "";
  if (leftRecent !== rightRecent) {
    return leftRecent < rightRecent ? 1 : -1;
  }
  return left.updatedAt < right.updatedAt ? 1 : left.updatedAt > right.updatedAt ? -1 : 0;
}

function rowToSession(row: SessionRow): SessionRecord {
  const session: SessionRecord = {
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    username: row.username,
    authType: row.auth_type,
    favorite: row.favorite === 1,
    hasSecret: row.has_secret === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  if (row.private_key_path) {
    session.privateKeyPath = row.private_key_path;
  }
  if (row.jump_session_id) {
    session.jumpSessionId = row.jump_session_id;
  }
  if (row.group_id) {
    session.groupId = row.group_id;
  }
  if (row.remark) {
    session.remark = row.remark;
  }
  if (row.environment) {
    session.environment = row.environment;
  }
  const tags = parseStringArray(row.tags_json);
  if (tags.length > 0) {
    session.tags = tags;
  }
  if (row.owner) {
    session.owner = row.owner;
  }
  const customFields = parseCustomFields(row.custom_fields_json);
  if (customFields.length > 0) {
    session.customFields = customFields;
  }
  if (row.last_connected_at) {
    session.lastConnectedAt = row.last_connected_at;
  }

  return session;
}

function sessionToRow(session: SessionRecord): SessionRow {
  return {
    id: session.id,
    name: session.name,
    host: session.host,
    port: session.port,
    username: session.username,
    auth_type: session.authType,
    private_key_path: session.privateKeyPath ?? null,
    jump_session_id: session.jumpSessionId ?? null,
    group_id: session.groupId ?? null,
    remark: session.remark ?? null,
    environment: session.environment ?? null,
    tags_json: session.tags?.length ? JSON.stringify(normalizeTags(session.tags)) : null,
    owner: session.owner?.trim() || null,
    custom_fields_json: session.customFields?.length
      ? JSON.stringify(normalizeCustomFields(session.customFields))
      : null,
    favorite: session.favorite ? 1 : 0,
    has_secret: session.hasSecret ? 1 : 0,
    last_connected_at: session.lastConnectedAt ?? null,
    created_at: session.createdAt,
    updated_at: session.updatedAt
  };
}

const INSERT_SESSION_SQL = `
INSERT INTO sessions (
  id,
  name,
  host,
  port,
  username,
  auth_type,
  private_key_path,
  jump_session_id,
  group_id,
  remark,
  environment,
  tags_json,
  owner,
  custom_fields_json,
  favorite,
  has_secret,
  last_connected_at,
  created_at,
  updated_at
) VALUES (
  @id,
  @name,
  @host,
  @port,
  @username,
  @auth_type,
  @private_key_path,
  @jump_session_id,
  @group_id,
  @remark,
  @environment,
  @tags_json,
  @owner,
  @custom_fields_json,
  @favorite,
  @has_secret,
  @last_connected_at,
  @created_at,
  @updated_at
)
`.trim();

const UPSERT_SESSION_SQL = `
INSERT INTO sessions (
  id,
  name,
  host,
  port,
  username,
  auth_type,
  private_key_path,
  jump_session_id,
  group_id,
  remark,
  environment,
  tags_json,
  owner,
  custom_fields_json,
  favorite,
  has_secret,
  last_connected_at,
  created_at,
  updated_at
) VALUES (
  @id,
  @name,
  @host,
  @port,
  @username,
  @auth_type,
  @private_key_path,
  @jump_session_id,
  @group_id,
  @remark,
  @environment,
  @tags_json,
  @owner,
  @custom_fields_json,
  @favorite,
  @has_secret,
  @last_connected_at,
  @created_at,
  @updated_at
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  host = excluded.host,
  port = excluded.port,
  username = excluded.username,
  auth_type = excluded.auth_type,
  private_key_path = excluded.private_key_path,
  jump_session_id = excluded.jump_session_id,
  group_id = excluded.group_id,
  remark = excluded.remark,
  environment = excluded.environment,
  tags_json = excluded.tags_json,
  owner = excluded.owner,
  custom_fields_json = excluded.custom_fields_json,
  favorite = excluded.favorite,
  has_secret = excluded.has_secret,
  last_connected_at = excluded.last_connected_at,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at
`.trim();

export class SqliteSessionStore {
  private readonly db: Database.Database;
  private readonly insertSession: Database.Statement<SessionRow>;
  private readonly upsertSession: Database.Statement<SessionRow>;
  private readonly selectSessionById: Database.Statement<{ id: string }>;
  private readonly deleteSessionById: Database.Statement<{ id: string }>;

  constructor(dbPath: string, existingDb?: Database.Database) {
    if (existingDb) {
      this.db = existingDb;
    } else {
      mkdirSync(dirname(dbPath), { recursive: true });
      this.db = new Database(dbPath);
      configureSqliteConnection(this.db);
      migrateSqliteSchema(this.db);
    }

    this.insertSession = this.db.prepare(INSERT_SESSION_SQL);
    this.upsertSession = this.db.prepare(UPSERT_SESSION_SQL);
    this.selectSessionById = this.db.prepare("SELECT * FROM sessions WHERE id = @id");
    this.deleteSessionById = this.db.prepare("DELETE FROM sessions WHERE id = @id");
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  async list(): Promise<SessionRecord[]> {
    const rows = this.db.prepare("SELECT * FROM sessions").all() as SessionRow[];
    return rows.map(rowToSession).sort(compareSessionRecency);
  }

  async getById(id: string): Promise<SessionRecord | null> {
    const row = this.selectSessionById.get({ id }) as SessionRow | undefined;
    return row ? rowToSession(row) : null;
  }

  async create(input: SessionCreateInput): Promise<SessionRecord> {
    const now = new Date().toISOString();
    const session: SessionRecord = {
      id: randomUUID(),
      name: input.name.trim(),
      host: input.host.trim(),
      port: input.port ?? 22,
      username: input.username.trim(),
      authType: input.authType,
      privateKeyPath: input.privateKeyPath?.trim() || undefined,
      jumpSessionId: input.jumpSessionId?.trim() || undefined,
      groupId: input.groupId?.trim() || undefined,
      remark: input.remark?.trim() || undefined,
      environment: normalizeEnvironment(input.environment),
      tags: normalizeTags(input.tags ?? []),
      owner: input.owner?.trim() || undefined,
      customFields: normalizeCustomFields(input.customFields ?? []),
      favorite: input.favorite ?? false,
      hasSecret: false,
      createdAt: now,
      updatedAt: now
    };
    this.insertSession.run(sessionToRow(session));
    return session;
  }

  async update(id: string, patch: SessionUpdateInput): Promise<SessionRecord> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error("Session not found");
    }

    const updated: SessionRecord = {
      ...existing,
      name: patch.name?.trim() ?? existing.name,
      host: patch.host?.trim() ?? existing.host,
      port: patch.port ?? existing.port,
      username: patch.username?.trim() ?? existing.username,
      authType: patch.authType ?? existing.authType,
      privateKeyPath:
        patch.privateKeyPath === undefined
          ? existing.privateKeyPath
          : patch.privateKeyPath.trim() || undefined,
      jumpSessionId:
        patch.jumpSessionId === undefined
          ? existing.jumpSessionId
          : patch.jumpSessionId.trim() || undefined,
      groupId:
        patch.groupId === undefined ? existing.groupId : patch.groupId.trim() || undefined,
      remark: patch.remark === undefined ? existing.remark : patch.remark.trim() || undefined,
      environment:
        patch.environment === undefined ? existing.environment : normalizeEnvironment(patch.environment),
      tags: patch.tags === undefined ? existing.tags : normalizeTags(patch.tags),
      owner: patch.owner === undefined ? existing.owner : patch.owner.trim() || undefined,
      customFields:
        patch.customFields === undefined
          ? existing.customFields
          : normalizeCustomFields(patch.customFields),
      favorite: patch.favorite ?? existing.favorite,
      hasSecret:
        patch.secret === undefined ? existing.hasSecret : patch.secret.trim().length > 0,
      updatedAt: new Date().toISOString()
    };

    this.upsertSession.run(sessionToRow(updated));
    return updated;
  }

  async remove(id: string): Promise<void> {
    const result = this.deleteSessionById.run({ id });
    if (result.changes === 0) {
      throw new Error("Session not found");
    }
  }

  async markConnected(id: string): Promise<SessionRecord> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error("Session not found");
    }

    const updated: SessionRecord = {
      ...existing,
      lastConnectedAt: new Date().toISOString()
    };
    this.upsertSession.run(sessionToRow(updated));
    return updated;
  }

  isEmpty(): boolean {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM sessions").get() as {
      count: number;
    };
    return row.count === 0;
  }

  getMeta(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM app_meta WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  setMeta(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO app_meta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(key, value);
  }

  replaceAll(sessions: SessionRecord[]): void {
    const replace = this.db.transaction((nextSessions: SessionRecord[]) => {
      this.db.prepare("DELETE FROM sessions").run();
      for (const session of nextSessions) {
        this.insertSession.run(sessionToRow(session));
      }
    });
    replace(sessions);
  }

  upsert(session: SessionRecord): void {
    this.upsertSession.run(sessionToRow(session));
  }

  deleteById(id: string): void {
    this.deleteSessionById.run({ id });
  }

  close(): void {
    this.db.close();
  }
}

function normalizeEnvironment(value: unknown): SessionEnvironment | undefined {
  return value === "dev" || value === "staging" || value === "prod" || value === "custom"
    ? value
    : undefined;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean))
  ).slice(0, 32);
}

function normalizeCustomFields(value: unknown): SessionCustomField[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is SessionCustomField => Boolean(item && typeof item === "object"))
    .map((item) => ({
      key: typeof item.key === "string" ? item.key.trim().slice(0, 80) : "",
      value: typeof item.value === "string" ? item.value.trim().slice(0, 400) : ""
    }))
    .filter((item) => item.key.length > 0)
    .slice(0, 24);
}

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  try { return normalizeTags(JSON.parse(value)); } catch { return []; }
}

function parseCustomFields(value: string | null): SessionCustomField[] {
  if (!value) return [];
  try { return normalizeCustomFields(JSON.parse(value)); } catch { return []; }
}
