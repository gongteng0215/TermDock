import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

import type {
  SessionCreateInput,
  SessionRecord,
  SessionUpdateInput
} from "../../shared/session.js";

interface SessionDbSchema {
  sessions: SessionRecord[];
}

const EMPTY_DB: SessionDbSchema = { sessions: [] };

function compareSessionRecency(left: SessionRecord, right: SessionRecord): number {
  const leftRecent = left.lastConnectedAt ?? "";
  const rightRecent = right.lastConnectedAt ?? "";
  if (leftRecent !== rightRecent) {
    return leftRecent < rightRecent ? 1 : -1;
  }
  return left.updatedAt < right.updatedAt ? 1 : left.updatedAt > right.updatedAt ? -1 : 0;
}

export class SessionStore {
  private readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async list(): Promise<SessionRecord[]> {
    const db = await this.readDb();
    return [...db.sessions].sort(compareSessionRecency);
  }

  async getById(id: string): Promise<SessionRecord | null> {
    const db = await this.readDb();
    return db.sessions.find((session) => session.id === id) ?? null;
  }

  async create(input: SessionCreateInput): Promise<SessionRecord> {
    const db = await this.readDb();
    const now = new Date().toISOString();
    const session: SessionRecord = {
      id: randomUUID(),
      name: input.name.trim(),
      host: input.host.trim(),
      port: input.port ?? 22,
      username: input.username.trim(),
      authType: input.authType,
      privateKeyPath: input.privateKeyPath?.trim() || undefined,
      groupId: input.groupId?.trim() || undefined,
      remark: input.remark?.trim() || undefined,
      favorite: input.favorite ?? false,
      hasSecret: false,
      createdAt: now,
      updatedAt: now
    };

    db.sessions.push(session);
    await this.writeDb(db);
    return session;
  }

  async update(id: string, patch: SessionUpdateInput): Promise<SessionRecord> {
    const db = await this.readDb();
    const index = db.sessions.findIndex((session) => session.id === id);
    if (index === -1) {
      throw new Error("Session not found");
    }

    const existing = db.sessions[index];
    const normalizedPrivateKeyPath =
      patch.privateKeyPath === undefined
        ? existing.privateKeyPath
        : patch.privateKeyPath.trim() || undefined;
    const normalizedGroupId =
      patch.groupId === undefined ? existing.groupId : patch.groupId.trim() || undefined;
    const normalizedRemark =
      patch.remark === undefined ? existing.remark : patch.remark.trim() || undefined;

    const updated: SessionRecord = {
      ...existing,
      name: patch.name?.trim() ?? existing.name,
      host: patch.host?.trim() ?? existing.host,
      port: patch.port ?? existing.port,
      username: patch.username?.trim() ?? existing.username,
      authType: patch.authType ?? existing.authType,
      privateKeyPath: normalizedPrivateKeyPath,
      groupId: normalizedGroupId,
      remark: normalizedRemark,
      favorite: patch.favorite ?? existing.favorite,
      hasSecret:
        patch.secret === undefined ? existing.hasSecret : patch.secret.trim().length > 0,
      updatedAt: new Date().toISOString()
    };

    db.sessions[index] = updated;
    await this.writeDb(db);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const db = await this.readDb();
    const nextSessions = db.sessions.filter((session) => session.id !== id);
    if (nextSessions.length === db.sessions.length) {
      throw new Error("Session not found");
    }
    db.sessions = nextSessions;
    await this.writeDb(db);
  }

  async markConnected(id: string): Promise<SessionRecord> {
    const db = await this.readDb();
    const index = db.sessions.findIndex((session) => session.id === id);
    if (index === -1) {
      throw new Error("Session not found");
    }
    const existing = db.sessions[index];
    const updated: SessionRecord = {
      ...existing,
      lastConnectedAt: new Date().toISOString()
    };
    db.sessions[index] = updated;
    await this.writeDb(db);
    return updated;
  }

  private async readDb(): Promise<SessionDbSchema> {
    try {
      const content = await readFile(this.dbPath, "utf-8");
      const parsed = JSON.parse(content) as SessionDbSchema;
      return {
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        await this.writeDb(EMPTY_DB);
        return { sessions: [] };
      }
      throw error;
    }
  }

  private async writeDb(db: SessionDbSchema): Promise<void> {
    await mkdir(dirname(this.dbPath), { recursive: true });
    await writeFile(this.dbPath, JSON.stringify(db, null, 2), "utf-8");
  }
}
