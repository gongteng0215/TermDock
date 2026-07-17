import { app, ipcMain } from "electron";

import type {
  SessionCreateInput,
  SshConfigParseResult,
  SessionTestConnectionResult,
  SessionUpdateInput
} from "../../shared/session.js";
import type {
  SessionMigrationExportInput,
  SessionMigrationExportResult,
  SessionMigrationImportInput,
  SessionMigrationImportResult
} from "../../shared/session-migration.js";
import type { CredentialStore } from "../security/credential-store.js";
import {
  exportEncryptedSessionMigration,
  importEncryptedSessionMigration
} from "../session/session-migration.js";
import { parseSshConfigFile } from "../ssh/parse-ssh-config.js";
import { testSshConnection } from "../ssh/test-connection.js";
import type { DualWriteSessionStore } from "../storage/dual-write-session-store.js";
import type { SessionStore } from "../storage/session-store.js";

export function registerSessionHandlers(
  store: SessionStore | DualWriteSessionStore,
  credentialStore: CredentialStore
): void {
  ipcMain.handle("sessions:list", async () => store.list());
  ipcMain.handle("sessions:create", async (_event, input: SessionCreateInput) => {
    const created = await store.create(input);
    if (input.secret?.trim()) {
      await credentialStore.saveSessionSecret(created.id, input.secret.trim());
      return store.update(created.id, { secret: input.secret });
    }
    return created;
  });
  ipcMain.handle(
    "sessions:update",
    async (_event, id: string, patch: SessionUpdateInput) => {
      if (patch.secret !== undefined) {
        const value = patch.secret.trim();
        if (value.length > 0) {
          await credentialStore.saveSessionSecret(id, value);
        } else {
          await credentialStore.deleteSessionSecret(id);
        }
      }
      return store.update(id, patch);
    }
  );
  ipcMain.handle("sessions:delete", async (_event, id: string) => {
    await store.remove(id);
    await credentialStore.deleteSessionSecret(id);
  });
  ipcMain.handle(
    "sessions:testConnection",
    async (_event, input: SessionCreateInput): Promise<SessionTestConnectionResult> =>
      testSshConnection(input)
  );
  ipcMain.handle(
    "sessions:parseSshConfig",
    async (_event, filePath?: string): Promise<SshConfigParseResult> =>
      parseSshConfigFile(filePath)
  );
  ipcMain.handle(
    "sessions:exportEncryptedMigration",
    async (_event, input: Omit<SessionMigrationExportInput, "sessions">): Promise<SessionMigrationExportResult> =>
      exportEncryptedSessionMigration(credentialStore, {
        ...input,
        sessions: await store.list()
      })
  );
  ipcMain.handle(
    "sessions:importEncryptedMigration",
    async (_event, input: SessionMigrationImportInput): Promise<SessionMigrationImportResult> =>
      importEncryptedSessionMigration({
        ...input,
        userDataDirectory: input.userDataDirectory ?? app.getPath("userData")
      })
  );
}
