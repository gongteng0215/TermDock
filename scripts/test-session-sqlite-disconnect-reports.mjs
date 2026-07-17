import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

import { migrateSqliteSchema, SQLITE_SCHEMA_VERSION } from "../dist-electron/main/storage/sqlite/schema.js";
import { SqliteDisconnectReportStore } from "../dist-electron/main/storage/sqlite/sqlite-disconnect-report-store.js";

const root = await mkdtemp(join(tmpdir(), "termdock-disconnect-sqlite-"));
const dbPath = join(root, "termdock.sqlite");

try {
  const db = new Database(dbPath);
  migrateSqliteSchema(db);
  assert.equal(Number(db.pragma("user_version", { simple: true })), SQLITE_SCHEMA_VERSION);

  const store = new SqliteDisconnectReportStore(db);
  assert.equal(store.isEmpty(), true);

  const report = {
    id: "dr-1",
    createdAt: "2026-07-15T08:00:00.000Z",
    tabId: "tab-1",
    tabTitle: "prod",
    sessionId: "sess-1",
    sessionName: "Prod",
    target: "host.example:22",
    trigger: "error",
    status: "closed",
    message: "Connection lost",
    activeTabId: "tab-1",
    wasActiveTab: true,
    openTabCount: 2,
    connectedTabCount: 1,
    autoReconnect: true,
    reconnectDelaySeconds: 3,
    uploadRunning: 0,
    uploadQueued: 1,
    downloadRunning: 0,
    downloadQueued: 0,
    pausedUpload: false,
    pausedDownload: false,
    portForwardTotal: 1,
    portForwardDegraded: 0,
    portForwardBusy: false,
    serverHealthLoading: false,
    serverProcessLoading: false,
    serverHealthError: "sample",
    recentFailures: [
      {
        direction: "upload",
        name: "a.txt",
        message: "failed",
        updatedAt: 100
      }
    ]
  };

  store.replaceAll([report]);
  const listed = store.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.id, "dr-1");
  assert.equal(listed[0]?.recentFailures[0]?.name, "a.txt");
  assert.equal(listed[0]?.serverHealthError, "sample");

  store.replaceAll([]);
  assert.equal(store.isEmpty(), true);

  db.close();
  const reopened = new Database(dbPath);
  migrateSqliteSchema(reopened);
  assert.equal(Number(reopened.pragma("user_version", { simple: true })), SQLITE_SCHEMA_VERSION);
  reopened.close();

  console.log("session-sqlite-disconnect-reports: ok");
} finally {
  await rm(root, { recursive: true, force: true });
}
