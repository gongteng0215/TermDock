import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

import { migrateSqliteSchema, SQLITE_SCHEMA_VERSION } from "../dist-electron/main/storage/sqlite/schema.js";
import { SqlitePortForwardEventStore } from "../dist-electron/main/storage/sqlite/sqlite-port-forward-event-store.js";

const root = await mkdtemp(join(tmpdir(), "termdock-port-forward-events-"));
const dbPath = join(root, "termdock.sqlite");

try {
  const db = new Database(dbPath);
  migrateSqliteSchema(db);
  assert.equal(Number(db.pragma("user_version", { simple: true })), SQLITE_SCHEMA_VERSION);

  const store = new SqlitePortForwardEventStore(db);
  assert.equal(store.isEmpty(), true);

  const event = {
    key: "sess-1\0evt-1",
    sessionId: "sess-1",
    id: "evt-1",
    tabId: "tab-1",
    forwardId: "fwd-1",
    forwardType: "local",
    bindHost: "127.0.0.1",
    bindPort: 8080,
    level: "info",
    type: "created",
    message: "Forward created",
    createdAt: "2026-07-15T09:00:00.000Z",
    correlationKey: "corr-1",
    errorCode: undefined
  };

  store.replaceAll([event]);
  const listed = store.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.key, "sess-1\0evt-1");
  assert.equal(listed[0]?.forwardType, "local");
  assert.equal(listed[0]?.correlationKey, "corr-1");

  store.replaceAll([]);
  assert.equal(store.isEmpty(), true);

  db.close();
  const reopened = new Database(dbPath);
  migrateSqliteSchema(reopened);
  assert.equal(Number(reopened.pragma("user_version", { simple: true })), SQLITE_SCHEMA_VERSION);
  reopened.close();

  console.log("session-sqlite-port-forward-events: ok");
} finally {
  await rm(root, { recursive: true, force: true });
}
