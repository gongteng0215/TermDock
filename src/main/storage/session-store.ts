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
const COMMON_MOJIBAKE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/鏈嶅姟鍣\??/g, "服务器"],
  [/璁剧疆/g, "设置"],
  [/绠＄悊/g, "管理"],
  [/杩炴帴/g, "连接"],
  [/鐢ㄦ埛/g, "用户"],
  [/鍒嗙粍/g, "分组"]
];

function repairMojibakeText(value: string): string {
  let normalized = value;
  for (const [pattern, replacement] of COMMON_MOJIBAKE_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized.replace(/\uFFFD/g, "").trim();
}

function normalizeOptionalSessionText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = repairMojibakeText(value);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeSessionName(value: string, fallback: string): string {
  const normalized = repairMojibakeText(value);
  return normalized.length > 0 ? normalized : fallback;
}

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

  getStoragePath(): string {
    return this.dbPath;
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
    const rawName = input.name.trim();
    const session: SessionRecord = {
      id: randomUUID(),
      name: normalizeSessionName(rawName, rawName),
      host: input.host.trim(),
      port: input.port ?? 22,
      username: input.username.trim(),
      authType: input.authType,
      privateKeyPath: input.privateKeyPath?.trim() || undefined,
      groupId: normalizeOptionalSessionText(input.groupId?.trim()),
      remark: normalizeOptionalSessionText(input.remark?.trim()),
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
      patch.groupId === undefined
        ? existing.groupId
        : normalizeOptionalSessionText(patch.groupId.trim());
    const normalizedRemark =
      patch.remark === undefined
        ? existing.remark
        : normalizeOptionalSessionText(patch.remark.trim());
    const normalizedName =
      patch.name === undefined
        ? existing.name
        : normalizeSessionName(patch.name.trim(), existing.name);

    const updated: SessionRecord = {
      ...existing,
      name: normalizedName,
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
      const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
      let changed = false;
      const normalizedSessions = sessions.map((session) => {
        const normalizedName = normalizeSessionName(session.name ?? "", session.name ?? "");
        const normalizedGroupId = normalizeOptionalSessionText(session.groupId);
        const normalizedRemark = normalizeOptionalSessionText(session.remark);
        if (
          normalizedName !== session.name ||
          normalizedGroupId !== session.groupId ||
          normalizedRemark !== session.remark
        ) {
          changed = true;
          return {
            ...session,
            name: normalizedName,
            groupId: normalizedGroupId,
            remark: normalizedRemark
          };
        }
        return session;
      });
      if (changed) {
        await this.writeDb({ sessions: normalizedSessions });
      }
      return {
        sessions: normalizedSessions
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

  async replaceAll(sessions: SessionRecord[]): Promise<void> {
    await this.writeDb({ sessions: [...sessions] });
  }

  async upsert(session: SessionRecord): Promise<void> {
    const db = await this.readDb();
    const index = db.sessions.findIndex((entry) => entry.id === session.id);
    if (index === -1) {
      db.sessions.push(session);
    } else {
      db.sessions[index] = session;
    }
    await this.writeDb(db);
  }
}
