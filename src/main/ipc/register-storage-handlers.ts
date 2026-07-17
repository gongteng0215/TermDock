import { ipcMain } from "electron";

import type { PersistedAppPreferences } from "../../shared/app-preference-persistence.js";
import type {
  PersistedCommandSnippetGroup,
  PersistedCommandSnippetScopedValueRecord
} from "../../shared/command-snippet-persistence.js";
import type { PersistedDisconnectReportItem } from "../../shared/disconnect-report-persistence.js";
import type { PersistedPortForwardEventHistoryItem } from "../../shared/port-forward-event-persistence.js";
import type {
  PersistedSessionQuickProfile,
  PersistedSessionTemplateRecord
} from "../../shared/session-workbench-persistence.js";
import type {
  PersistedTransferHistoryItem,
  PersistedTransferPendingRestoreItem
} from "../../shared/transfer-persistence.js";
import type { SqliteDisconnectReportStore } from "../storage/sqlite/sqlite-disconnect-report-store.js";
import type { SqlitePortForwardEventStore } from "../storage/sqlite/sqlite-port-forward-event-store.js";
import type { SqlitePreferenceStore } from "../storage/sqlite/sqlite-preference-store.js";
import type { SqliteTransferStore } from "../storage/sqlite/sqlite-transfer-store.js";
import type { SqliteWorkbenchStore } from "../storage/sqlite/sqlite-workbench-store.js";

export interface StorageHandlerStores {
  transferStore: SqliteTransferStore | null;
  disconnectReportStore: SqliteDisconnectReportStore | null;
  portForwardEventStore: SqlitePortForwardEventStore | null;
  workbenchStore: SqliteWorkbenchStore | null;
  preferenceStore: SqlitePreferenceStore | null;
}

export function registerStorageHandlers({
  transferStore,
  disconnectReportStore,
  portForwardEventStore,
  workbenchStore,
  preferenceStore
}: StorageHandlerStores): void {
  ipcMain.handle("storage:getTransferHistory", async () => {
    if (!transferStore) {
      return [] as PersistedTransferHistoryItem[];
    }
    return transferStore.listHistory();
  });

  ipcMain.handle(
    "storage:replaceTransferHistory",
    async (_event, items: PersistedTransferHistoryItem[]) => {
      if (!transferStore) {
        return;
      }
      transferStore.replaceHistory(Array.isArray(items) ? items : []);
    }
  );

  ipcMain.handle("storage:getPendingTransferRestore", async () => {
    if (!transferStore) {
      return [] as PersistedTransferPendingRestoreItem[];
    }
    return transferStore.listPendingRestore();
  });

  ipcMain.handle(
    "storage:replacePendingTransferRestore",
    async (_event, items: PersistedTransferPendingRestoreItem[]) => {
      if (!transferStore) {
        return;
      }
      transferStore.replacePendingRestore(Array.isArray(items) ? items : []);
    }
  );

  ipcMain.handle("storage:getDisconnectReports", async () => {
    if (!disconnectReportStore) {
      return [] as PersistedDisconnectReportItem[];
    }
    return disconnectReportStore.list();
  });

  ipcMain.handle(
    "storage:replaceDisconnectReports",
    async (_event, items: PersistedDisconnectReportItem[]) => {
      if (!disconnectReportStore) {
        return;
      }
      disconnectReportStore.replaceAll(Array.isArray(items) ? items : []);
    }
  );

  ipcMain.handle("storage:getPortForwardEventHistory", async () => {
    if (!portForwardEventStore) {
      return [] as PersistedPortForwardEventHistoryItem[];
    }
    return portForwardEventStore.list();
  });

  ipcMain.handle(
    "storage:replacePortForwardEventHistory",
    async (_event, items: PersistedPortForwardEventHistoryItem[]) => {
      if (!portForwardEventStore) {
        return;
      }
      portForwardEventStore.replaceAll(Array.isArray(items) ? items : []);
    }
  );

  ipcMain.handle("storage:getSessionQuickProfiles", async () => {
    if (!workbenchStore) {
      return [] as PersistedSessionQuickProfile[];
    }
    return workbenchStore.listQuickProfiles();
  });

  ipcMain.handle(
    "storage:replaceSessionQuickProfiles",
    async (_event, items: PersistedSessionQuickProfile[]) => {
      if (!workbenchStore) {
        return;
      }
      workbenchStore.replaceQuickProfiles(Array.isArray(items) ? items : []);
    }
  );

  ipcMain.handle("storage:getSessionTemplates", async () => {
    if (!workbenchStore) {
      return [] as PersistedSessionTemplateRecord[];
    }
    return workbenchStore.listSessionTemplates();
  });

  ipcMain.handle(
    "storage:replaceSessionTemplates",
    async (_event, items: PersistedSessionTemplateRecord[]) => {
      if (!workbenchStore) {
        return;
      }
      workbenchStore.replaceSessionTemplates(Array.isArray(items) ? items : []);
    }
  );

  ipcMain.handle("storage:getCommandSnippetGroups", async () => {
    if (!workbenchStore) {
      return [] as PersistedCommandSnippetGroup[];
    }
    return workbenchStore.listSnippetGroups();
  });

  ipcMain.handle(
    "storage:replaceCommandSnippetGroups",
    async (_event, items: PersistedCommandSnippetGroup[]) => {
      if (!workbenchStore) {
        return;
      }
      workbenchStore.replaceSnippetGroups(Array.isArray(items) ? items : []);
    }
  );

  ipcMain.handle("storage:getCommandSnippetScopedValues", async () => {
    if (!workbenchStore) {
      return {} as Record<string, PersistedCommandSnippetScopedValueRecord>;
    }
    return workbenchStore.listSnippetScopedValues();
  });

  ipcMain.handle(
    "storage:replaceCommandSnippetScopedValues",
    async (
      _event,
      values: Record<string, PersistedCommandSnippetScopedValueRecord>
    ) => {
      if (!workbenchStore) {
        return;
      }
      workbenchStore.replaceSnippetScopedValues(
        values && typeof values === "object" ? values : {}
      );
    }
  );

  ipcMain.handle("storage:getAppPreferences", async () => {
    if (!preferenceStore) {
      return {} as PersistedAppPreferences;
    }
    return preferenceStore.listAll();
  });

  ipcMain.handle(
    "storage:setAppPreference",
    async (_event, key: string, value: unknown) => {
      if (!preferenceStore || typeof key !== "string" || !key.trim()) {
        return;
      }
      preferenceStore.set(key.trim(), value);
    }
  );

  ipcMain.handle(
    "storage:replaceAppPreferences",
    async (_event, entries: PersistedAppPreferences) => {
      if (!preferenceStore) {
        return;
      }
      preferenceStore.upsertMany(entries && typeof entries === "object" ? entries : {});
    }
  );
}
