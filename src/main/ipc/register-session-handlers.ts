import { ipcMain } from "electron";

import type {
  SessionCreateInput,
  SessionTestConnectionResult,
  SessionUpdateInput
} from "../../shared/session.js";
import type { CredentialStore } from "../security/credential-store.js";
import { testSshConnection } from "../ssh/test-connection.js";
import { SessionStore } from "../storage/session-store.js";

export function registerSessionHandlers(
  store: SessionStore,
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
}
