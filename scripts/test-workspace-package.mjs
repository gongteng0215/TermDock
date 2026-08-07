import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { WorkspacePackageService } from "../dist-electron/main/operations/workspace-package-service.js";
import { SqliteOperationsStore } from "../dist-electron/main/storage/sqlite/sqlite-operations-store.js";
import { SqliteSessionStore } from "../dist-electron/main/storage/sqlite/sqlite-session-store.js";

class MemoryCredentialStore {
  constructor(values = {}) {
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

const root = await mkdtemp(join(tmpdir(), "termdock-workspace-"));

try {
  const sourceSessions = new SqliteSessionStore(join(root, "source.sqlite"));
  const sourceOps = new SqliteOperationsStore(sourceSessions.getDatabase());
  const sourceCredentials = new MemoryCredentialStore();
  const jump = await sourceSessions.create({
    name: "Bastion",
    host: "10.0.0.2",
    port: 22,
    username: "ops",
    authType: "password"
  });
  const target = await sourceSessions.create({
    name: "Private API",
    host: "10.0.1.20",
    port: 22,
    username: "deploy",
    authType: "password",
    jumpSessionId: jump.id,
    environment: "prod",
    tags: ["api", "customer-a"],
    owner: "platform"
  });
  await sourceCredentials.saveSessionSecret(jump.id, "jump-secret");
  await sourceCredentials.saveSessionSecret(target.id, "target-secret");
  await sourceSessions.update(jump.id, { secret: "jump-secret" });
  await sourceSessions.update(target.id, { secret: "target-secret" });
  const sourceRunbook = sourceOps.saveRunbook({ name: "Restart API", description: "safe", command: "systemctl restart {{service}}", variables: [{ name: "service", label: "Service", required: true }] });
  sourceOps.saveSyncProfile({ name: "API deploy", sessionId: target.id, direction: "upload", localRoot: "C:/repo", remoteRoot: "/srv/api", excludePatterns: ["node_modules/**"] });
  sourceOps.savePinnedMonitor({ sessionId: target.id, enabled: true, intervalSeconds: 60, cpuWarnPercent: 75, memoryWarnPercent: 80, diskWarnPercent: 90, alertOnFailedServices: true, cooldownSeconds: 120, recommendedRunbookIds: [sourceRunbook.id], updatedAt: new Date().toISOString() });
  sourceOps.trustHostKey({ host: "10.0.1.20", port: 22, fingerprint: "SHA256:test", publicKeyBase64: "test-key" });
  sourceOps.appendHealthObservation({ sessionId: target.id, collectedAt: new Date().toISOString(), cpuUsagePercent: 10, memoryUsagePercent: 20, diskUsagePercent: 30, load1: 0.2, failedServices: 0, connectionState: "healthy" });

  const sourceService = new WorkspacePackageService(sourceSessions, sourceCredentials, sourceOps);
  const exported = await sourceService.exportWorkspace({ appVersion: "test", passphrase: "workspace-passphrase", includeCredentials: true, includePrivateKeyFiles: false });
  const serialized = JSON.stringify(exported.file);
  assert.equal(serialized.includes("target-secret"), false);
  assert.equal(serialized.includes("Private API"), false);
  assert.equal(sourceService.previewWorkspace({ fileText: serialized, passphrase: "workspace-passphrase" }).preview.sessionCount, 2);

  const restoredSessions = new SqliteSessionStore(join(root, "restored.sqlite"));
  const restoredOps = new SqliteOperationsStore(restoredSessions.getDatabase());
  restoredOps.saveRunbook({ ...sourceRunbook, name: "Existing Restart API" });
  const restoredCredentials = new MemoryCredentialStore();
  const restoredService = new WorkspacePackageService(restoredSessions, restoredCredentials, restoredOps);
  const imported = await restoredService.importWorkspace({ fileText: serialized, passphrase: "workspace-passphrase", sessionStrategy: "rename", restoreCredentials: true, includePrivateKeyFiles: false });
  assert.equal(imported.sessionsCreated, 2);
  const restored = await restoredSessions.list();
  const restoredTarget = restored.find((session) => session.name === "Private API");
  assert.ok(restoredTarget?.jumpSessionId);
  assert.equal(restoredOps.listRunbooks().length, 2);
  assert.equal(restoredOps.listSyncProfiles().length, 1);
  assert.equal(restoredOps.listPinnedMonitors()[0]?.cpuWarnPercent, 75);
  assert.notEqual(restoredOps.listPinnedMonitors()[0]?.recommendedRunbookIds?.[0], sourceRunbook.id);
  assert.equal(restoredOps.listTrustedHostKeys().length, 0);
  assert.equal(await restoredCredentials.getSessionSecret(restoredTarget.id), "target-secret");
  assert.equal(restoredOps.listHealthObservations(target.id).length, 0);
  const aggregateCount = restoredSessions.getDatabase().prepare("SELECT COUNT(*) AS count FROM health_observation_aggregates").get().count;
  assert.equal(aggregateCount, 0);

  sourceSessions.getDatabase().close();
  restoredSessions.getDatabase().close();
  console.log("workspace-package: ok");
} finally {
  await rm(root, { recursive: true, force: true });
}
