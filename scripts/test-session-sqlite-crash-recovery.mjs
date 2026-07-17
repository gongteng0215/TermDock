import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

import {
  DualWriteSessionStore,
  PRE_SQLITE_CUTOVER_BACKUP_SUFFIX
} from "../dist-electron/main/storage/dual-write-session-store.js";
import { SessionStore } from "../dist-electron/main/storage/session-store.js";
import {
  configureSqliteConnection,
  migrateSqliteSchema
} from "../dist-electron/main/storage/sqlite/schema.js";
import { SqliteSessionStore } from "../dist-electron/main/storage/sqlite/sqlite-session-store.js";
import { SqliteTransferStore } from "../dist-electron/main/storage/sqlite/sqlite-transfer-store.js";

const root = await mkdtemp(join(tmpdir(), "termdock-session-sqlite-crash-"));
const jsonPath = join(root, "sessions.json");
const sqlitePath = join(root, "termdock.sqlite");
const backupPath = `${jsonPath}${PRE_SQLITE_CUTOVER_BACKUP_SUFFIX}`;

const seedSessions = [
  {
    id: "seed-crash-1",
    name: "Crash Seed",
    host: "198.51.100.77",
    port: 22,
    username: "ops",
    authType: "password",
    favorite: false,
    hasSecret: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  }
];

await writeFile(jsonPath, JSON.stringify({ sessions: seedSessions }, null, 2), "utf-8");

try {
  // 1) Fresh cutover opens with WAL and survives close/reopen.
  {
    const sqliteStore = new SqliteSessionStore(sqlitePath);
    const journalMode = String(sqliteStore.getDatabase().pragma("journal_mode", { simple: true }));
    assert.match(journalMode.toLowerCase(), /^wal$/, `expected WAL, got ${journalMode}`);

    const dual = new DualWriteSessionStore(new SessionStore(jsonPath), sqliteStore);
    const created = await dual.create({
      name: "Durable Host",
      host: "203.0.113.90",
      port: 22,
      username: "deploy",
      authType: "password",
      favorite: false
    });
    const transferStore = new SqliteTransferStore(sqliteStore.getDatabase());
    transferStore.replaceHistory([
      {
        key: "s1\0upload\0/a\0/b",
        sessionId: created.id,
        direction: "upload",
        status: "completed",
        name: "a.txt",
        localPath: "/a",
        remotePath: "/b",
        updatedAt: 1000,
        attemptCount: 1,
        message: null
      }
    ]);
    await dual.flushJsonMirror();

    sqliteStore.close();

    const reopened = new SqliteSessionStore(sqlitePath);
    const listed = await reopened.list();
    assert.ok(listed.some((session) => session.id === created.id));
    assert.ok(listed.some((session) => session.id === "seed-crash-1"));
    const history = new SqliteTransferStore(reopened.getDatabase()).listHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0]?.sessionId, created.id);
    assert.match(
      String(reopened.getDatabase().pragma("journal_mode", { simple: true })).toLowerCase(),
      /^wal$/
    );
    reopened.close();
    console.log("crash-recovery: reopen durability ok");
  }

  // 2) Corrupt SQLite file refuses to open (main process falls back to JSON).
  {
    const corruptPath = join(root, "corrupt.sqlite");
    await writeFile(corruptPath, "this is not a sqlite database\n", "utf-8");
    let opened = null;
    try {
      opened = new SqliteSessionStore(corruptPath);
      assert.fail("corrupt sqlite should not open");
    } catch (error) {
      assert.match(String(error), /SQLite|database|file is not/i);
    } finally {
      opened?.close?.();
    }
    console.log("crash-recovery: corrupt sqlite open fails ok");
  }

  // 3) Corrupt JSON mirror must not break SQLite-authoritative reads.
  {
    const liveSqlite = new SqliteSessionStore(sqlitePath);
    await writeFile(jsonPath, "{ not-valid-json", "utf-8");
    const dual = new DualWriteSessionStore(new SessionStore(jsonPath), liveSqlite);
    const listed = await dual.list();
    assert.ok(listed.length >= 1, "SQLite authority should still list sessions");
    await dual.flushJsonMirror();
    liveSqlite.close();
    console.log("crash-recovery: corrupt json mirror ignored ok");
  }

  // 4) Rollback: restore pre-cutover backup into sessions.json and use JSON-only store.
  {
    assert.equal(existsSync(backupPath), true, "pre-cutover backup should exist");
    await copyFile(backupPath, jsonPath);
    const rolled = new SessionStore(jsonPath);
    const rolledSessions = await rolled.list();
    assert.equal(rolledSessions.length, 1);
    assert.equal(rolledSessions[0]?.id, "seed-crash-1");
    const backup = JSON.parse(await readFile(backupPath, "utf-8"));
    assert.equal(backup.sessions[0]?.id, "seed-crash-1");
    console.log("crash-recovery: pre-cutover rollback ok");
  }

  // 5) configureSqliteConnection is safe to apply to an already-migrated db handle.
  {
    const db = new Database(join(root, "configured.sqlite"));
    configureSqliteConnection(db);
    migrateSqliteSchema(db);
    assert.match(String(db.pragma("journal_mode", { simple: true })).toLowerCase(), /^wal$/);
    db.close();
    console.log("crash-recovery: configureSqliteConnection ok");
  }

  console.log("session-sqlite-crash-recovery: ok");
} finally {
  // Windows may keep a brief lock on a failed native open; warn instead of failing the suite.
  try {
    await rm(root, { recursive: true, force: true });
  } catch (error) {
    console.warn("crash-recovery: temp cleanup skipped:", error);
  }
}
