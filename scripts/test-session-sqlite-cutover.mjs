import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DualWriteSessionStore,
  PRE_SQLITE_CUTOVER_BACKUP_SUFFIX,
  SESSIONS_AUTHORITY_META_KEY,
  SESSIONS_AUTHORITY_SQLITE,
  SESSIONS_CUTOVER_AT_META_KEY
} from "../dist-electron/main/storage/dual-write-session-store.js";
import { SessionStore } from "../dist-electron/main/storage/session-store.js";
import { SqliteSessionStore } from "../dist-electron/main/storage/sqlite/sqlite-session-store.js";

async function assertStoresMatch(jsonStore, sqliteStore, message) {
  const jsonList = await jsonStore.list();
  const sqliteList = await sqliteStore.list();
  assert.deepEqual(sqliteList, jsonList, message);
}

const root = await mkdtemp(join(tmpdir(), "termdock-session-sqlite-cutover-"));
const jsonPath = join(root, "sessions.json");
const sqlitePath = join(root, "termdock.sqlite");
const backupPath = `${jsonPath}${PRE_SQLITE_CUTOVER_BACKUP_SUFFIX}`;

const seedSessions = [
  {
    id: "seed-1",
    name: "Seed Host",
    host: "198.51.100.10",
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

const jsonStore = new SessionStore(jsonPath);
const sqliteStore = new SqliteSessionStore(sqlitePath);

try {
  const store = new DualWriteSessionStore(jsonStore, sqliteStore);

  assert.equal(store.getAuthority(), SESSIONS_AUTHORITY_SQLITE);
  assert.equal(sqliteStore.getMeta(SESSIONS_AUTHORITY_META_KEY), SESSIONS_AUTHORITY_SQLITE);
  assert.ok(sqliteStore.getMeta(SESSIONS_CUTOVER_AT_META_KEY));
  assert.equal(existsSync(backupPath), true, "pre-cutover JSON backup should exist");

  const backup = JSON.parse(await readFile(backupPath, "utf-8"));
  assert.equal(backup.sessions[0]?.id, "seed-1");

  const listed = await store.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.id, "seed-1");

  await assertStoresMatch(jsonStore, sqliteStore, "stores should match after cutover import");

  const created = await store.create({
    name: "Cutover Host",
    host: "203.0.113.55",
    port: 22,
    username: "deploy",
    authType: "password",
    favorite: true
  });
  const fromStore = await store.getById(created.id);
  assert.equal(fromStore?.name, "Cutover Host");
  await assertStoresMatch(jsonStore, sqliteStore, "stores should match after sqlite-authoritative create");

  await store.update(created.id, { remark: "after cutover" });
  await assertStoresMatch(jsonStore, sqliteStore, "stores should match after update");

  await store.markConnected(created.id);
  await assertStoresMatch(jsonStore, sqliteStore, "stores should match after markConnected");

  await store.remove(created.id);
  await assertStoresMatch(jsonStore, sqliteStore, "stores should match after remove");

  // Rollback simulation: restore pre-cutover JSON and open SQLite empty→re-import path is separate;
  // here verify backup can replace live JSON and then drive a fresh json-only SessionStore.
  await copyFile(backupPath, jsonPath);
  const rolledBack = new SessionStore(jsonPath);
  const rolledSessions = await rolledBack.list();
  assert.equal(rolledSessions.length, 1);
  assert.equal(rolledSessions[0]?.id, "seed-1");

  console.log("session-sqlite-cutover: ok");
} finally {
  sqliteStore.close();
  await rm(root, { recursive: true, force: true });
}
