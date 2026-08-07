import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SqliteOperationsStore } from "../dist-electron/main/storage/sqlite/sqlite-operations-store.js";
import { SqliteSessionStore } from "../dist-electron/main/storage/sqlite/sqlite-session-store.js";

const root = await mkdtemp(join(tmpdir(), "termdock-fleet-incidents-"));
const sessionId = "fleet-session";

const observation = (overrides = {}) => ({
  sessionId,
  collectedAt: new Date().toISOString(),
  cpuUsagePercent: 20,
  memoryUsagePercent: 20,
  diskUsagePercent: 20,
  load1: 0.2,
  failedServices: 0,
  connectionState: "healthy",
  ...overrides
});

try {
  const sessions = new SqliteSessionStore(join(root, "fleet.sqlite"));
  const db = sessions.getDatabase();
  const store = new SqliteOperationsStore(db);

  // Old monitor payloads have only one threshold; the v0.1.49 reader must
  // retain it as Warning and supply a safe Critical default.
  db.prepare("INSERT INTO pinned_monitors (session_id, enabled, interval_seconds, updated_at, settings_json) VALUES (?, 1, 60, ?, ?)")
    .run(sessionId, new Date().toISOString(), JSON.stringify({ cpuWarnPercent: 72, memoryWarnPercent: 74, diskWarnPercent: 76, cooldownSeconds: 60 }));
  const migratedMonitor = store.listPinnedMonitors()[0];
  assert.equal(migratedMonitor.cpuWarnPercent, 72);
  assert.equal(migratedMonitor.cpuCriticalPercent, 95);
  assert.equal(migratedMonitor.failedServiceWarnCount, 1);
  assert.equal(migratedMonitor.failedServiceCriticalCount, 3);

  const created = store.recordHealthObservation(observation({ cpuUsagePercent: 80 }));
  assert.equal(created?.status, "open");
  assert.equal(created?.severity, "warning");
  assert.deepEqual(created?.conditionKeys, ["cpu"]);
  const duplicate = store.recordHealthObservation(observation({ cpuUsagePercent: 81 }));
  assert.equal(duplicate?.id, created?.id);
  assert.equal(store.listHealthIncidents(undefined, 10).length, 1);

  const escalated = store.recordHealthObservation(observation({ cpuUsagePercent: 98 }));
  assert.equal(escalated?.severity, "critical");
  assert.ok(store.listHealthIncidentEvents(created.id).some((event) => event.type === "escalated"));

  const acknowledged = store.acknowledgeHealthIncident(created.id);
  assert.equal(acknowledged?.status, "acknowledged");
  const stillAcknowledged = store.recordHealthObservation(observation({ cpuUsagePercent: 98 }));
  assert.equal(stillAcknowledged?.status, "acknowledged");
  assert.equal(store.claimHealthIncidentNotification(created.id, 60), null);

  store.recordHealthObservation(observation());
  const resolved = store.recordHealthObservation(observation());
  assert.equal(resolved?.status, "resolved");
  assert.ok(resolved?.resolvedAt);

  const reopened = store.recordHealthObservation(observation({ failedServices: 4 }));
  assert.equal(reopened?.severity, "critical");
  assert.ok(store.claimHealthIncidentNotification(reopened.id, 60));
  assert.equal(store.claimHealthIncidentNotification(reopened.id, 60), null);

  const rawTrend = store.listHealthTrend(sessionId, "24h");
  const aggregatedTrend = store.listHealthTrend(sessionId, "7d");
  assert.ok(rawTrend.length >= 6);
  assert.ok(aggregatedTrend.length >= 1);

  const run = {
    id: "run-1", runbookId: "runbook-1", runbookName: "Restart API", command: "systemctl restart api", incidentId: reopened.id,
    status: "succeeded", startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
    targetResults: [{ sessionId, sessionName: "Fleet target", status: "succeeded", outputTail: "secret-output-must-not-export" }]
  };
  store.saveRunbookRun(run);
  store.recordIncidentRunbookEvent(reopened.id, run, "started");
  store.recordIncidentRunbookEvent(reopened.id, run, "finished");
  const evidence = store.exportHealthIncidentEvidence(reopened.id);
  assert.equal(evidence.runbooks.length, 1);
  assert.equal(JSON.stringify(evidence).includes("secret-output-must-not-export"), false);
  assert.ok(evidence.events.some((event) => event.type === "runbookFinished"));

  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
  console.log("fleet-health-incidents: ok");
} finally {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rm(root, { recursive: true, force: true });
      break;
    } catch (error) {
      if (error?.code !== "EBUSY") throw error;
      if (attempt === 7) {
        console.warn(`fleet-health-incidents: temporary SQLite files will be cleaned by the OS (${error.code}).`);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
