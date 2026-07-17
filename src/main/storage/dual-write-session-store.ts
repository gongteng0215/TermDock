import { copyFileSync, existsSync, readFileSync } from "node:fs";

import type {
  SessionCreateInput,
  SessionRecord,
  SessionUpdateInput
} from "../../shared/session.js";
import { SessionStore } from "./session-store.js";
import { SqliteSessionStore } from "./sqlite/sqlite-session-store.js";

interface SessionDbSchema {
  sessions: SessionRecord[];
}

/** app_meta key marking SQLite as the authoritative session store (Phase 3). */
export const SESSIONS_AUTHORITY_META_KEY = "sessions_authority";
export const SESSIONS_AUTHORITY_SQLITE = "sqlite";
export const SESSIONS_CUTOVER_AT_META_KEY = "sessions_cutover_at";

/** One-shot JSON snapshot written on first Phase 3 cutover. */
export const PRE_SQLITE_CUTOVER_BACKUP_SUFFIX = ".pre-sqlite-cutover";

function readJsonSessionsSync(dbPath: string): SessionRecord[] {
  try {
    const content = readFileSync(dbPath, "utf-8");
    const parsed = JSON.parse(content) as SessionDbSchema;
    return Array.isArray(parsed.sessions) ? parsed.sessions : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * Phase 3 session store: SQLite is authoritative for reads/writes.
 * JSON is kept as a best-effort mirror plus a one-shot pre-cutover backup for rollback.
 */
export class DualWriteSessionStore {
  private readonly jsonStore: SessionStore;
  private readonly sqliteStore: SqliteSessionStore;

  constructor(jsonStore: SessionStore, sqliteStore: SqliteSessionStore) {
    this.jsonStore = jsonStore;
    this.sqliteStore = sqliteStore;
    this.prepareCutover();
  }

  getAuthority(): typeof SESSIONS_AUTHORITY_SQLITE {
    return SESSIONS_AUTHORITY_SQLITE;
  }

  async list(): Promise<SessionRecord[]> {
    return this.sqliteStore.list();
  }

  async getById(id: string): Promise<SessionRecord | null> {
    return this.sqliteStore.getById(id);
  }

  async create(input: SessionCreateInput): Promise<SessionRecord> {
    const created = await this.sqliteStore.create(input);
    await this.syncJson(() => this.jsonStore.upsert(created));
    return created;
  }

  async update(id: string, patch: SessionUpdateInput): Promise<SessionRecord> {
    const updated = await this.sqliteStore.update(id, patch);
    await this.syncJson(() => this.jsonStore.upsert(updated));
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.sqliteStore.remove(id);
    await this.syncJson(async () => {
      try {
        await this.jsonStore.remove(id);
      } catch (error) {
        if (error instanceof Error && error.message === "Session not found") {
          return;
        }
        throw error;
      }
    });
  }

  async markConnected(id: string): Promise<SessionRecord> {
    const updated = await this.sqliteStore.markConnected(id);
    await this.syncJson(() => this.jsonStore.upsert(updated));
    return updated;
  }

  private mirrorPromise: Promise<void> = Promise.resolve();

  private prepareCutover(): void {
    this.syncImportIfNeeded();
    this.writePreCutoverBackupIfNeeded();
    this.mirrorSqliteToJsonBestEffort();
    if (this.sqliteStore.getMeta(SESSIONS_AUTHORITY_META_KEY) !== SESSIONS_AUTHORITY_SQLITE) {
      this.sqliteStore.setMeta(SESSIONS_AUTHORITY_META_KEY, SESSIONS_AUTHORITY_SQLITE);
      this.sqliteStore.setMeta(SESSIONS_CUTOVER_AT_META_KEY, new Date().toISOString());
    }
  }

  /** Wait for the latest best-effort JSON mirror write (tests / graceful shutdown). */
  async flushJsonMirror(): Promise<void> {
    await this.mirrorPromise;
  }

  private syncImportIfNeeded(): void {
    if (!this.sqliteStore.isEmpty()) {
      return;
    }

    const sessions = readJsonSessionsSync(this.jsonStore.getStoragePath());
    if (sessions.length > 0) {
      this.sqliteStore.replaceAll(sessions);
    }
  }

  private writePreCutoverBackupIfNeeded(): void {
    const jsonPath = this.jsonStore.getStoragePath();
    const backupPath = `${jsonPath}${PRE_SQLITE_CUTOVER_BACKUP_SUFFIX}`;
    if (!existsSync(jsonPath) || existsSync(backupPath)) {
      return;
    }
    try {
      copyFileSync(jsonPath, backupPath);
    } catch (error) {
      console.warn("[sqlite] failed to write pre-cutover JSON backup:", error);
    }
  }

  private mirrorSqliteToJsonBestEffort(): void {
    this.mirrorPromise = this.sqliteStore
      .list()
      .then((sessions) => this.jsonStore.replaceAll(sessions))
      .catch((error: unknown) => {
        console.warn("[sqlite] failed to mirror SQLite sessions to JSON:", error);
      });
  }

  private async syncJson(operation: () => void | Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      console.warn("[sqlite] JSON mirror sync failed:", error);
    }
  }
}
