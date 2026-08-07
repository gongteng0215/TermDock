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
    await assertValidJumpSession(store, undefined, input.jumpSessionId);
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
      if (patch.jumpSessionId !== undefined) {
        await assertValidJumpSession(store, id, patch.jumpSessionId);
      }
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
    const dependents = (await store.list()).filter((session) => session.jumpSessionId === id);
    if (dependents.length > 0) {
      throw new Error(
        `This session is used as an SSH jump host by: ${dependents.map((session) => session.name).join(", ")}. Remove those references first.`
      );
    }
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

async function assertValidJumpSession(
  store: SessionStore | DualWriteSessionStore,
  sessionId: string | undefined,
  rawJumpSessionId: string | undefined
): Promise<void> {
  const jumpSessionId = rawJumpSessionId?.trim();
  if (!jumpSessionId) return;
  if (sessionId && jumpSessionId === sessionId) {
    throw new Error("A session cannot use itself as an SSH jump host.");
  }
  const jumpSession = await store.getById(jumpSessionId);
  if (!jumpSession) {
    throw new Error("The selected SSH jump session does not exist.");
  }
  if (jumpSession.jumpSessionId) {
    throw new Error("Only one SSH jump host is supported. Choose a direct session as the jump host.");
  }
}
