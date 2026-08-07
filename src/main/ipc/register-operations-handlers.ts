import { ipcMain } from "electron";

import type {
  HealthIncidentStatus,
  HealthTrendRange,
  PinnedMonitor,
  Runbook,
  RunbookStartInput,
  SyncProfile,
  TrustedHostKey,
  WorkspacePackageExportInput,
  WorkspacePackageImportInput,
  WorkspacePackagePreviewInput
} from "../../shared/operations.js";
import type { WorkspacePackageService } from "../operations/workspace-package-service.js";
import type { SqliteOperationsStore } from "../storage/sqlite/sqlite-operations-store.js";
import type { TerminalService } from "../terminal/terminal-service.js";

type SessionLookup = {
  getById: (id: string) => Promise<import("../../shared/session.js").SessionRecord | null>;
};

export function registerOperationsHandlers(
  store: SqliteOperationsStore | null,
  terminalService: TerminalService,
  workspacePackageService: WorkspacePackageService,
  sessionStore: SessionLookup
): void {
  ipcMain.handle("operations:listTrustedHostKeys", async () => store?.listTrustedHostKeys() ?? []);
  ipcMain.handle("operations:trustHostKey", async (_event, input: Omit<TrustedHostKey, "endpoint" | "firstTrustedAt" | "lastTrustedAt">) => {
    if (!store) throw new Error("Trusted host storage is unavailable.");
    return store.trustHostKey(input);
  });
  ipcMain.handle("operations:removeTrustedHostKey", async (_event, endpoint: string) => store?.removeTrustedHostKey(endpoint));

  ipcMain.handle("operations:listRunbooks", async () => store?.listRunbooks() ?? []);
  ipcMain.handle("operations:saveRunbook", async (_event, input: Partial<Runbook>) => {
    if (!store) throw new Error("Runbook storage is unavailable.");
    return store.saveRunbook(input);
  });
  ipcMain.handle("operations:removeRunbook", async (_event, id: string) => store?.removeRunbook(id));
  ipcMain.handle("operations:listRunbookRuns", async (_event, limit?: number) => store?.listRunbookRuns(limit) ?? []);
  ipcMain.handle("operations:clearRunbookRuns", async () => store?.clearRunbookRuns());
  ipcMain.handle("operations:startRunbook", async (event, input: RunbookStartInput) => terminalService.startRunbook(input, event.sender));
  ipcMain.handle("operations:cancelRunbook", async (_event, runId: string) => terminalService.cancelRunbook(runId));

  ipcMain.handle("operations:listSyncProfiles", async () => store?.listSyncProfiles() ?? []);
  ipcMain.handle("operations:saveSyncProfile", async (_event, input: Partial<SyncProfile>) => {
    if (!store) throw new Error("Sync profile storage is unavailable.");
    return store.saveSyncProfile(input);
  });
  ipcMain.handle("operations:removeSyncProfile", async (_event, id: string) => store?.removeSyncProfile(id));
  ipcMain.handle("operations:listSyncRuns", async (_event, limit?: number) => store?.listSyncRuns(limit) ?? []);
  ipcMain.handle("operations:clearSyncRuns", async () => store?.clearSyncRuns());
  ipcMain.handle("operations:planSync", async (event, profileId: string) =>
    terminalService.planSync(profileId, event.sender)
  );
  ipcMain.handle("operations:startSync", async (event, profileId: string, planId: string) =>
    terminalService.startSync(profileId, planId, event.sender)
  );
  ipcMain.handle("operations:cancelSync", async (_event, runId: string) => terminalService.cancelSync(runId));

  ipcMain.handle("operations:listPinnedMonitors", async () => store?.listPinnedMonitors() ?? []);
  ipcMain.handle("operations:savePinnedMonitor", async (_event, input: PinnedMonitor) => {
    if (!store) throw new Error("Monitor storage is unavailable.");
    return store.savePinnedMonitor(input);
  });
  ipcMain.handle("operations:removePinnedMonitor", async (_event, sessionId: string) => store?.removePinnedMonitor(sessionId));
  ipcMain.handle("operations:listHealthObservations", async (_event, sessionId: string, limit?: number) => store?.listHealthObservations(sessionId, limit) ?? []);
  ipcMain.handle("operations:listFleetHealthOverview", async () => store?.listFleetHealthOverview() ?? []);
  ipcMain.handle("operations:listHealthTrend", async (_event, sessionId: string, range: HealthTrendRange) => store?.listHealthTrend(sessionId, range) ?? []);
  ipcMain.handle("operations:listHealthIncidents", async (_event, status?: HealthIncidentStatus, limit?: number) => store?.listHealthIncidents(status, limit) ?? []);
  ipcMain.handle("operations:listHealthIncidentEvents", async (_event, incidentId: string) => store?.listHealthIncidentEvents(incidentId) ?? []);
  ipcMain.handle("operations:acknowledgeHealthIncident", async (_event, incidentId: string) => store?.acknowledgeHealthIncident(incidentId));
  ipcMain.handle("operations:exportHealthIncidentEvidence", async (_event, incidentId: string) => {
    if (!store) throw new Error("Fleet Health storage is unavailable.");
    const evidence = store.exportHealthIncidentEvidence(incidentId);
    const session = await sessionStore.getById(evidence.incident.sessionId);
    return {
      ...evidence,
      ...(session ? {
        session: {
          id: session.id, name: session.name, host: session.host, port: session.port, username: session.username,
          groupId: session.groupId, environment: session.environment, tags: session.tags, owner: session.owner
        }
      } : {})
    };
  });
  ipcMain.handle("operations:collectPinnedHealth", async (event, sessionId: string) =>
    terminalService.collectPinnedHealth(sessionId, event.sender)
  );
  ipcMain.handle("operations:exportWorkspace", async (_event, input: WorkspacePackageExportInput) =>
    workspacePackageService.exportWorkspace(input)
  );
  ipcMain.handle("operations:previewWorkspace", async (_event, input: WorkspacePackagePreviewInput) =>
    workspacePackageService.previewWorkspace(input)
  );
  ipcMain.handle("operations:importWorkspace", async (_event, input: WorkspacePackageImportInput) =>
    workspacePackageService.importWorkspace(input)
  );
}
