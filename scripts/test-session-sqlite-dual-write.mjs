import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DualWriteSessionStore } from "../dist-electron/main/storage/dual-write-session-store.js";
import { SessionStore } from "../dist-electron/main/storage/session-store.js";
import { SqliteSessionStore } from "../dist-electron/main/storage/sqlite/sqlite-session-store.js";

async function assertStoresMatch(jsonStore, sqliteStore, message) {
  const jsonList = await jsonStore.list();
  const sqliteList = await sqliteStore.list();
  assert.deepEqual(sqliteList, jsonList, message);
}

const root = await mkdtemp(join(tmpdir(), "termdock-session-sqlite-dual-write-"));
const jsonPath = join(root, "sessions.json");
const sqlitePath = join(root, "termdock.sqlite");
const jsonStore = new SessionStore(jsonPath);
const sqliteStore = new SqliteSessionStore(sqlitePath);

try {
  const store = new DualWriteSessionStore(jsonStore, sqliteStore);

  await assertStoresMatch(jsonStore, sqliteStore, "initial stores should match");

  const alpha = await store.create({
    name: "Alpha Host",
    host: "203.0.113.10",
    port: 22,
    username: "deploy",
    authType: "password",
    groupId: "Production",
    remark: "alpha fixture",
    favorite: true
  });
  await assertStoresMatch(jsonStore, sqliteStore, "stores should match after create");

  const beta = await store.create({
    name: "Beta Host",
    host: "staging.example.test",
    port: 2222,
    username: "ubuntu",
    authType: "privateKey",
    privateKeyPath: "/tmp/beta-key",
    favorite: false
  });
  await assertStoresMatch(jsonStore, sqliteStore, "stores should match after second create");

  await store.update(alpha.id, {
    name: "Alpha Host Updated",
    remark: "updated remark"
  });
  await assertStoresMatch(jsonStore, sqliteStore, "stores should match after update");

  await store.markConnected(beta.id);
  await assertStoresMatch(jsonStore, sqliteStore, "stores should match after markConnected");

  await store.remove(alpha.id);
  await assertStoresMatch(jsonStore, sqliteStore, "stores should match after remove");

  console.log("session-sqlite-dual-write: ok");
} finally {
  sqliteStore.close();
  await rm(root, { recursive: true, force: true });
}
