import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  exportEncryptedSessionMigration,
  importEncryptedSessionMigration
} from "../dist-electron/main/session/session-migration.js";

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

const root = await mkdtemp(join(tmpdir(), "termdock-session-migration-"));

try {
  const keySourceDirectory = join(root, "source-keys");
  const userDataDirectory = join(root, "user-data");
  await mkdir(keySourceDirectory, { recursive: true });
  const sourceKeyPath = join(keySourceDirectory, "fixture_id_ed25519");
  const keyContents = [
    "-----BEGIN OPENSSH PRIVATE KEY-----",
    "fixture-private-key-content",
    "-----END OPENSSH PRIVATE KEY-----",
    ""
  ].join("\n");
  await writeFile(sourceKeyPath, keyContents, { mode: 0o600 });

  const sessions = [
    {
      id: "password-session",
      name: "Production Password",
      host: "203.0.113.10",
      port: 22,
      username: "deploy",
      authType: "password",
      groupId: "Production",
      remark: "password fixture",
      favorite: true,
      hasSecret: true,
      createdAt: "2026-05-14T00:00:00.000Z",
      updatedAt: "2026-05-14T00:00:00.000Z"
    },
    {
      id: "key-session",
      name: "Staging Key",
      host: "staging.example.test",
      port: 2222,
      username: "ubuntu",
      authType: "privateKey",
      privateKeyPath: sourceKeyPath,
      groupId: "Staging",
      remark: "key fixture",
      favorite: false,
      hasSecret: true,
      createdAt: "2026-05-14T00:00:00.000Z",
      updatedAt: "2026-05-14T00:00:00.000Z"
    }
  ];
  const credentialStore = new MemoryCredentialStore({
    "password-session": "correct horse battery staple",
    "key-session": "key passphrase"
  });
  const passphrase = "migration passphrase";

  const exported = await exportEncryptedSessionMigration(credentialStore, {
    passphrase,
    appVersion: "0.1.test",
    sessions,
    includePrivateKeyFiles: true
  });

  assert.equal(exported.warnings.length, 0, "fixture export should not warn");
  assert.equal(exported.file.format, "termdock-session-migration");
  assert.equal(exported.file.summary.sessionCount, 2);
  assert.equal(exported.file.summary.passwordSecretCount, 1);
  assert.equal(exported.file.summary.privateKeySecretCount, 1);
  assert.equal(exported.file.summary.embeddedPrivateKeyFileCount, 1);
  const fileText = `${JSON.stringify(exported.file, null, 2)}\n`;
  assert.doesNotMatch(fileText, /correct horse battery staple/u, "password must not be plaintext");
  assert.doesNotMatch(fileText, /fixture-private-key-content/u, "key contents must not be plaintext");

  await assert.rejects(
    () =>
      importEncryptedSessionMigration({
        passphrase: "wrong passphrase",
        fileText,
        userDataDirectory
      }),
    /Could not decrypt migration file/u,
    "wrong passphrase should fail"
  );

  const preview = await importEncryptedSessionMigration({
    passphrase,
    fileText,
    restorePrivateKeyFiles: false
  });
  assert.equal(preview.payload.sessions.length, 2);
  assert.equal(preview.payload.sessions[0].secret, "correct horse battery staple");
  assert.equal(preview.payload.sessions[1].secret, "key passphrase");
  assert.equal(preview.payload.sessions[1].privateKeyPath, sourceKeyPath);
  assert.equal(preview.payload.sessions[1].privateKeyFile, undefined);

  const restored = await importEncryptedSessionMigration({
    passphrase,
    fileText,
    restorePrivateKeyFiles: true,
    userDataDirectory
  });
  const restoredKeySession = restored.payload.sessions.find(
    (session) => session.name === "Staging Key"
  );
  assert.ok(restoredKeySession, "restored key session should exist");
  assert.notEqual(
    restoredKeySession.privateKeyPath,
    sourceKeyPath,
    "restored key should not reuse source-machine path"
  );
  assert.match(
    restoredKeySession.privateKeyPath,
    /imported-private-keys/u,
    "restored key should live under TermDock app data"
  );
  assert.equal(restoredKeySession.privateKeyFile, undefined);
  assert.equal(await readFile(restoredKeySession.privateKeyPath, "utf-8"), keyContents);

  const pathsOnlyExport = await exportEncryptedSessionMigration(credentialStore, {
    passphrase,
    appVersion: "0.1.test",
    sessions,
    includePrivateKeyFiles: false
  });
  assert.equal(pathsOnlyExport.file.summary.embeddedPrivateKeyFileCount, 0);
  const pathsOnlyImport = await importEncryptedSessionMigration({
    passphrase,
    fileText: JSON.stringify(pathsOnlyExport.file),
    restorePrivateKeyFiles: true,
    userDataDirectory
  });
  assert.equal(
    pathsOnlyImport.payload.sessions.find((session) => session.name === "Staging Key")
      ?.privateKeyPath,
    sourceKeyPath,
    "paths-only migration should keep the original key path"
  );

  console.log("session-migration: ok");
} finally {
  await rm(root, { recursive: true, force: true });
}
