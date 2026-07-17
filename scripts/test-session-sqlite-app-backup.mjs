import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

import { APP_BACKUP_FORMAT, APP_BACKUP_VERSION } from "../dist-electron/shared/app-backup.js";
import {
  exportAppBackup,
  importAppBackup,
  parseAppBackupFile,
  previewAppBackup
} from "../dist-electron/main/storage/app-backup.js";
import { migrateSqliteSchema, SQLITE_SCHEMA_VERSION } from "../dist-electron/main/storage/sqlite/schema.js";
import { SqliteDisconnectReportStore } from "../dist-electron/main/storage/sqlite/sqlite-disconnect-report-store.js";
import { SqlitePortForwardEventStore } from "../dist-electron/main/storage/sqlite/sqlite-port-forward-event-store.js";
import { SqlitePreferenceStore } from "../dist-electron/main/storage/sqlite/sqlite-preference-store.js";
import { SqliteSessionStore } from "../dist-electron/main/storage/sqlite/sqlite-session-store.js";
import { SqliteTransferStore } from "../dist-electron/main/storage/sqlite/sqlite-transfer-store.js";
import { SqliteWorkbenchStore } from "../dist-electron/main/storage/sqlite/sqlite-workbench-store.js";

class MemoryCredentialStore {
  constructor(values) {
    this.values = new Map(Object.entries(values));
  }

  async saveSessionSecret(sessionId, secret) {
    this.values.set(sessionId, secret);
  }

  async getSessionSecret(sessionId) {
    return this.values.get(sessionId) ?? null;
  }

  async deleteSessionSecret(sessionId) {
    this.values.delete(sessionId);
  }
}

const root = await mkdtemp(join(tmpdir(), "termdock-app-backup-"));
const dbPath = join(root, "termdock.sqlite");

try {
  const sessionStore = new SqliteSessionStore(dbPath);
  const db = sessionStore.getDatabase();
  assert.equal(Number(db.pragma("user_version", { simple: true })), SQLITE_SCHEMA_VERSION);

  const stores = {
    sessionStore,
    credentialStore: new MemoryCredentialStore({
      "session-a": "alpha-password"
    }),
    transferStore: new SqliteTransferStore(db),
    disconnectReportStore: new SqliteDisconnectReportStore(db),
    portForwardEventStore: new SqlitePortForwardEventStore(db),
    workbenchStore: new SqliteWorkbenchStore(db),
    preferenceStore: new SqlitePreferenceStore(db)
  };

  const created = await sessionStore.create({
    name: "Alpha",
    host: "10.0.0.8",
    port: 22,
    username: "root",
    authType: "password",
    favorite: true
  });
  await sessionStore.update(created.id, { secret: "alpha-password" });
  stores.credentialStore.values.set(created.id, "alpha-password");

  stores.transferStore.replaceHistory([
    {
      key: "t1",
      sessionId: created.id,
      direction: "upload",
      status: "failed",
      name: "a.txt",
      localPath: "C:/a.txt",
      remotePath: "/tmp/a.txt",
      updatedAt: Date.now(),
      attemptCount: 1,
      message: "fail"
    }
  ]);
  stores.preferenceStore.set("termdock.connection-preferences.v1", {
    autoReconnect: true,
    reconnectDelaySeconds: 4
  });
  stores.workbenchStore.replaceQuickProfiles([
    {
      id: "qp-1",
      name: "uptime",
      startupCommand: "uptime",
      confirmBeforeRun: false
    }
  ]);
  stores.workbenchStore.replaceSessionTemplates([
    {
      id: "st-1",
      createdAt: 1,
      updatedAt: 2,
      templateName: "Web",
      sessionName: "web",
      host: "10.0.0.9",
      port: "22",
      username: "deploy",
      authType: "password",
      privateKeyPath: "",
      groupId: "",
      remark: "",
      favorite: false,
      secret: "must-not-land",
      envVars: []
    }
  ]);

  const plainExport = await exportAppBackup(stores, {
    appVersion: "0.1.40-test",
    includeCredentials: false
  });
  assert.equal(plainExport.file.format, APP_BACKUP_FORMAT);
  assert.equal(plainExport.file.version, APP_BACKUP_VERSION);
  assert.equal(plainExport.file.schemaVersion, SQLITE_SCHEMA_VERSION);
  assert.equal(plainExport.file.credentialsAttachment, undefined);
  assert.equal(JSON.stringify(plainExport.file.state).includes("alpha-password"), false);
  assert.equal(JSON.stringify(plainExport.file.state).includes("must-not-land"), false);
  assert.equal(plainExport.file.state.sessionTemplates[0]?.hasSecret, true);

  const preview = previewAppBackup({
    fileText: JSON.stringify(plainExport.file)
  });
  assert.equal(preview.preview.sessionCount, 1);
  assert.equal(preview.preview.transferHistoryCount, 1);
  assert.equal(preview.preview.hasCredentialsAttachment, false);

  const credentialExport = await exportAppBackup(stores, {
    appVersion: "0.1.40-test",
    includeCredentials: true,
    passphrase: "backup-passphrase",
    includePrivateKeyFiles: false
  });
  assert.ok(credentialExport.file.credentialsAttachment);
  assert.equal(
    JSON.stringify(credentialExport.file.state).includes("alpha-password"),
    false
  );

  const restoreDbPath = join(root, "restore.sqlite");
  const restoreSessionStore = new SqliteSessionStore(restoreDbPath);
  const restoreDb = restoreSessionStore.getDatabase();
  migrateSqliteSchema(restoreDb);
  const restoreStores = {
    sessionStore: restoreSessionStore,
    credentialStore: new MemoryCredentialStore({}),
    transferStore: new SqliteTransferStore(restoreDb),
    disconnectReportStore: new SqliteDisconnectReportStore(restoreDb),
    portForwardEventStore: new SqlitePortForwardEventStore(restoreDb),
    workbenchStore: new SqliteWorkbenchStore(restoreDb),
    preferenceStore: new SqlitePreferenceStore(restoreDb)
  };

  const imported = await importAppBackup(restoreStores, {
    fileText: JSON.stringify(credentialExport.file),
    sessionDuplicateStrategy: "skip",
    restoreCredentials: true,
    passphrase: "backup-passphrase",
    includePrivateKeyFiles: false
  });
  assert.equal(imported.applied.sessionsCreated, 1);
  assert.equal(imported.applied.secretsRestored, 1);
  assert.ok(imported.applied.durableTablesReplaced.includes("transfer_history"));
  assert.equal(restoreStores.transferStore.listHistory().length, 1);
  assert.deepEqual(
    restoreStores.preferenceStore.listAll()["termdock.connection-preferences.v1"],
    {
      autoReconnect: true,
      reconnectDelaySeconds: 4
    }
  );
  const restoredSessions = await restoreSessionStore.list();
  assert.equal(restoredSessions.length, 1);
  const restoredSecret = await restoreStores.credentialStore.getSessionSecret(
    restoredSessions[0].id
  );
  assert.equal(restoredSecret, "alpha-password");

  const parsed = parseAppBackupFile(JSON.stringify(plainExport.file));
  assert.equal(parsed.format, APP_BACKUP_FORMAT);

  db.close();
  restoreDb.close();

  console.log("session-sqlite-app-backup: ok");
} finally {
  await rm(root, { recursive: true, force: true });
}
