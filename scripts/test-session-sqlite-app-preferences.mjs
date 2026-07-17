import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

import { DURABLE_APP_PREFERENCE_KEYS } from "../dist-electron/shared/app-preference-persistence.js";
import { migrateSqliteSchema, SQLITE_SCHEMA_VERSION } from "../dist-electron/main/storage/sqlite/schema.js";
import { SqlitePreferenceStore } from "../dist-electron/main/storage/sqlite/sqlite-preference-store.js";

const root = await mkdtemp(join(tmpdir(), "termdock-app-preferences-"));
const dbPath = join(root, "termdock.sqlite");

try {
  const db = new Database(dbPath);
  migrateSqliteSchema(db);
  assert.equal(Number(db.pragma("user_version", { simple: true })), SQLITE_SCHEMA_VERSION);

  const store = new SqlitePreferenceStore(db);
  assert.equal(store.isEmpty(), true);

  const connectionKey = "termdock.connection-preferences.v1";
  const sortKey = "termdock.session-sort-mode.v1";
  assert.ok(DURABLE_APP_PREFERENCE_KEYS.includes(connectionKey));
  assert.ok(DURABLE_APP_PREFERENCE_KEYS.includes(sortKey));

  store.set(connectionKey, { autoReconnect: true, reconnectDelaySeconds: 5 });
  store.set(sortKey, "nameAsc");
  store.set("termdock.ui-accent.v1", { id: "ocean" });

  const listed = store.listAll();
  assert.deepEqual(listed[connectionKey], { autoReconnect: true, reconnectDelaySeconds: 5 });
  assert.equal(listed[sortKey], "nameAsc");
  assert.equal(Object.prototype.hasOwnProperty.call(listed, "termdock.ui-accent.v1"), false);

  store.upsertMany({
    [connectionKey]: { autoReconnect: false, reconnectDelaySeconds: 3 },
    [sortKey]: "nameDesc",
    "termdock.ui-accent.v1": { id: "mint" }
  });
  const afterUpsert = store.listAll();
  assert.deepEqual(afterUpsert[connectionKey], { autoReconnect: false, reconnectDelaySeconds: 3 });
  assert.equal(afterUpsert[sortKey], "nameDesc");
  assert.equal(Object.keys(afterUpsert).length, 2);

  store.replaceAll({
    [sortKey]: "default"
  });
  assert.deepEqual(store.listAll(), { [sortKey]: "default" });
  assert.equal(store.isEmpty(), false);

  store.replaceAll({});
  assert.equal(store.isEmpty(), true);

  db.close();
  const reopened = new Database(dbPath);
  migrateSqliteSchema(reopened);
  assert.equal(Number(reopened.pragma("user_version", { simple: true })), SQLITE_SCHEMA_VERSION);
  reopened.close();

  console.log("session-sqlite-app-preferences: ok");
} finally {
  await rm(root, { recursive: true, force: true });
}
