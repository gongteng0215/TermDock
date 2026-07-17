import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

import { migrateSqliteSchema, SQLITE_SCHEMA_VERSION } from "../dist-electron/main/storage/sqlite/schema.js";
import { SqliteWorkbenchStore } from "../dist-electron/main/storage/sqlite/sqlite-workbench-store.js";

const root = await mkdtemp(join(tmpdir(), "termdock-workbench-data-"));
const dbPath = join(root, "termdock.sqlite");

try {
  const db = new Database(dbPath);
  migrateSqliteSchema(db);
  assert.equal(Number(db.pragma("user_version", { simple: true })), SQLITE_SCHEMA_VERSION);

  const store = new SqliteWorkbenchStore(db);
  assert.equal(store.isEmpty(), true);

  const quickProfile = {
    id: "qp-1",
    name: "Tail logs",
    startupCommand: "tail -f /var/log/syslog",
    confirmBeforeRun: true
  };
  store.replaceQuickProfiles([quickProfile]);
  assert.deepEqual(store.listQuickProfiles(), [quickProfile]);

  const templateWithSecret = {
    id: "st-1",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_100_000,
    templateName: "Prod web",
    sessionName: "prod-web",
    host: "10.0.0.5",
    port: "22",
    username: "deploy",
    authType: "password",
    privateKeyPath: "",
    groupId: "prod",
    remark: "",
    favorite: true,
    secret: "super-secret-password",
    envVars: [{ id: "env-1", key: "NODE_ENV", value: "production" }]
  };
  store.replaceSessionTemplates([templateWithSecret]);
  const listedTemplates = store.listSessionTemplates();
  assert.equal(listedTemplates.length, 1);
  assert.equal(listedTemplates[0]?.hasSecret, true);
  assert.equal("secret" in (listedTemplates[0] ?? {}), false);
  const rawTemplateRow = db
    .prepare("SELECT payload_json FROM session_templates WHERE id = ?")
    .get("st-1");
  assert.equal(rawTemplateRow.payload_json.includes("super-secret-password"), false);

  const snippetGroup = {
    id: "sg-1",
    name: "Deploy",
    promptSets: [],
    snippets: [
      {
        id: "sn-1",
        name: "Restart",
        template: "systemctl restart ${param:service}",
        confirmBeforeRun: true,
        previewBeforeRun: false,
        promptSetId: "",
        parameters: []
      }
    ]
  };
  store.replaceSnippetGroups([snippetGroup]);
  assert.deepEqual(store.listSnippetGroups(), [snippetGroup]);

  const scopedValues = {
    "global:service": { value: "nginx", updatedAt: 1_700_000_200_000 }
  };
  store.replaceSnippetScopedValues(scopedValues);
  assert.deepEqual(store.listSnippetScopedValues(), scopedValues);

  store.replaceQuickProfiles([]);
  store.replaceSessionTemplates([]);
  store.replaceSnippetGroups([]);
  store.replaceSnippetScopedValues({});
  assert.equal(store.isEmpty(), true);

  db.close();
  const reopened = new Database(dbPath);
  migrateSqliteSchema(reopened);
  assert.equal(Number(reopened.pragma("user_version", { simple: true })), SQLITE_SCHEMA_VERSION);
  reopened.close();

  console.log("session-sqlite-workbench-data: ok");
} finally {
  await rm(root, { recursive: true, force: true });
}
