import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

import { migrateSqliteSchema, SQLITE_SCHEMA_VERSION } from "../dist-electron/main/storage/sqlite/schema.js";
import { SqliteTransferStore } from "../dist-electron/main/storage/sqlite/sqlite-transfer-store.js";

const root = await mkdtemp(join(tmpdir(), "termdock-transfer-sqlite-"));
const dbPath = join(root, "termdock.sqlite");

try {
  const db = new Database(dbPath);
  migrateSqliteSchema(db);
  assert.equal(Number(db.pragma("user_version", { simple: true })), SQLITE_SCHEMA_VERSION);

  const store = new SqliteTransferStore(db);
  assert.equal(store.isHistoryEmpty(), true);
  assert.equal(store.isPendingRestoreEmpty(), true);

  store.replaceHistory([
    {
      key: "s1\0upload\0/a\0/b",
      sessionId: "s1",
      direction: "upload",
      status: "failed",
      name: "a.txt",
      localPath: "/a",
      remotePath: "/b",
      updatedAt: 100,
      attemptCount: 2,
      message: "boom"
    },
    {
      key: "s1\0download\0/c\0/d",
      sessionId: "s1",
      direction: "download",
      status: "completed",
      name: "c.txt",
      localPath: "/c",
      remotePath: "/d",
      updatedAt: 200,
      attemptCount: 1
    }
  ]);

  const history = store.listHistory();
  assert.equal(history.length, 2);
  assert.equal(history[0]?.key, "s1\0download\0/c\0/d");
  assert.equal(history[1]?.message, "boom");

  store.replacePendingRestore([
    {
      key: "s1\0upload\0/a\0/b",
      sessionId: "s1",
      direction: "upload",
      localPath: "/a",
      remotePath: "/b",
      name: "a.txt"
    }
  ]);
  const pending = store.listPendingRestore();
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.name, "a.txt");

  store.replaceHistory([]);
  store.replacePendingRestore([]);
  assert.equal(store.isHistoryEmpty(), true);
  assert.equal(store.isPendingRestoreEmpty(), true);

  // Re-open with migrate to ensure IF NOT EXISTS / v2 path is idempotent.
  db.close();
  const reopened = new Database(dbPath);
  migrateSqliteSchema(reopened);
  assert.equal(Number(reopened.pragma("user_version", { simple: true })), SQLITE_SCHEMA_VERSION);
  reopened.close();

  console.log("session-sqlite-transfer-persistence: ok");
} finally {
  await rm(root, { recursive: true, force: true });
}
