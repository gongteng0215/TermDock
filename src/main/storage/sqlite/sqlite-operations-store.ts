import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import type {
  FleetHealthOverviewItem,
  HealthIncident,
  HealthIncidentEvent,
  HealthIncidentEvidence,
  HealthIncidentStatus,
  HealthObservation,
  HealthSeverity,
  HealthTrendPoint,
  HealthTrendRange,
  PinnedMonitor,
  Runbook,
  RunbookRun,
  SyncProfile,
  SyncRun,
  TrustedHostKey
} from "../../../shared/operations.js";

const MAX_RUNBOOKS = 120;
const MAX_RUNBOOK_RUNS = 1_000;
const MAX_SYNC_PROFILES = 120;
const MAX_SYNC_RUNS = 1_000;
const MAX_HEALTH_OBSERVATIONS_PER_SESSION = 8_640;
const MAX_HEALTH_INCIDENTS = 2_000;
const MAX_HEALTH_INCIDENT_EVENTS = 20_000;

type IncidentSeverity = "warning" | "critical";

function severityRank(value: IncidentSeverity): number {
  return value === "critical" ? 2 : 1;
}

function clampPercent(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(100, Math.round(value)))
    : fallback;
}

function clampCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(1000, Math.round(value)))
    : fallback;
}

function normalizePinnedMonitor(input: PinnedMonitor): PinnedMonitor {
  const cpuWarnPercent = Math.min(99, clampPercent(input.cpuWarnPercent, 85));
  const memoryWarnPercent = Math.min(99, clampPercent(input.memoryWarnPercent, 85));
  const diskWarnPercent = Math.min(99, clampPercent(input.diskWarnPercent, 85));
  const minimumCritical = (warning: number, candidate: unknown) =>
    Math.max(warning + 1, clampPercent(candidate, 95));
  const failedServiceWarnCount = clampCount(input.failedServiceWarnCount, 1);
  return {
    sessionId: input.sessionId.trim(),
    enabled: input.enabled !== false,
    intervalSeconds: Math.max(60, Math.min(3600, Math.round(input.intervalSeconds || 60))),
    cpuWarnPercent,
    memoryWarnPercent,
    diskWarnPercent,
    cpuCriticalPercent: minimumCritical(cpuWarnPercent, input.cpuCriticalPercent),
    memoryCriticalPercent: minimumCritical(memoryWarnPercent, input.memoryCriticalPercent),
    diskCriticalPercent: minimumCritical(diskWarnPercent, input.diskCriticalPercent),
    alertOnFailedServices: input.alertOnFailedServices !== false,
    failedServiceWarnCount,
    failedServiceCriticalCount: Math.max(failedServiceWarnCount + 1, clampCount(input.failedServiceCriticalCount, 3)),
    cooldownSeconds: Math.max(60, Math.min(3600, Math.round(input.cooldownSeconds || 300))),
    recommendedRunbookIds: Array.from(new Set((input.recommendedRunbookIds ?? []).map((id) => id.trim()).filter(Boolean))).slice(0, 3),
    updatedAt: input.updatedAt || new Date().toISOString()
  };
}

function healthCondition(observation: HealthObservation, monitor: PinnedMonitor): { severity: IncidentSeverity; keys: string[] } | null {
  if (observation.connectionState === "needsAttention") return null;
  if (observation.connectionState === "unreachable") return { severity: "critical", keys: ["connection"] };
  const keys: string[] = [];
  let severity: IncidentSeverity | null = null;
  const compare = (name: string, value: number, warning: number, critical: number) => {
    if (value >= critical) {
      keys.push(name);
      severity = "critical";
    } else if (value >= warning) {
      keys.push(name);
      if (!severity) severity = "warning";
    }
  };
  compare("cpu", observation.cpuUsagePercent, monitor.cpuWarnPercent ?? 85, monitor.cpuCriticalPercent ?? 95);
  compare("memory", observation.memoryUsagePercent, monitor.memoryWarnPercent ?? 85, monitor.memoryCriticalPercent ?? 95);
  compare("disk", observation.diskUsagePercent, monitor.diskWarnPercent ?? 85, monitor.diskCriticalPercent ?? 95);
  if (monitor.alertOnFailedServices !== false && observation.failedServices >= (monitor.failedServiceWarnCount ?? 1)) {
    keys.push("services");
    if (observation.failedServices >= (monitor.failedServiceCriticalCount ?? 3)) severity = "critical";
    else if (!severity) severity = "warning";
  }
  return severity ? { severity, keys: keys.sort() } : null;
}

function parseIncident(value: string, fallback: HealthIncident): HealthIncident {
  return parsePayload<HealthIncident>(value, fallback);
}

function parsePayload<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function finiteHealthMetric(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeHealthObservation(
  input: Partial<HealthObservation>,
  fallbackSessionId = ""
): HealthObservation {
  const connectionState =
    input.connectionState === "healthy" ||
    input.connectionState === "unreachable" ||
    input.connectionState === "needsAttention"
      ? input.connectionState
      : "needsAttention";
  const percent = (value: unknown) => Math.max(0, Math.min(100, finiteHealthMetric(value)));
  const positive = (value: unknown) => Math.max(0, finiteHealthMetric(value));
  return {
    sessionId: input.sessionId?.trim() || fallbackSessionId,
    collectedAt: input.collectedAt || new Date().toISOString(),
    cpuUsagePercent: percent(input.cpuUsagePercent),
    memoryUsagePercent: percent(input.memoryUsagePercent),
    diskUsagePercent: percent(input.diskUsagePercent),
    ...(input.diskPath?.trim() ? { diskPath: input.diskPath.trim() } : {}),
    ...(input.cpuCoreCount !== undefined
      ? { cpuCoreCount: Math.max(0, Math.round(positive(input.cpuCoreCount))) }
      : {}),
    ...(input.cpuTotalTicks !== undefined ? { cpuTotalTicks: positive(input.cpuTotalTicks) } : {}),
    ...(input.cpuIdleTicks !== undefined ? { cpuIdleTicks: positive(input.cpuIdleTicks) } : {}),
    load1: positive(input.load1),
    load5: positive(input.load5),
    load15: positive(input.load15),
    swapUsagePercent: percent(input.swapUsagePercent),
    ...(input.networkRxBytes !== undefined ? { networkRxBytes: positive(input.networkRxBytes) } : {}),
    ...(input.networkTxBytes !== undefined ? { networkTxBytes: positive(input.networkTxBytes) } : {}),
    networkRxBytesPerSecond: positive(input.networkRxBytesPerSecond),
    networkTxBytesPerSecond: positive(input.networkTxBytesPerSecond),
    uptimeSeconds: positive(input.uptimeSeconds),
    failedServices: Math.max(0, Math.round(positive(input.failedServices))),
    connectionState
  };
}

function normalizeRunbook(input: Partial<Runbook>): Runbook {
  const now = new Date().toISOString();
  const variables = Array.isArray(input.variables)
    ? input.variables
        .filter((variable) => variable && typeof variable.name === "string")
        .map((variable) => ({
          name: variable.name.trim().replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 48),
          label: (variable.label || variable.name).trim().slice(0, 120),
          required: variable.required !== false,
          ...(variable.defaultValue?.trim() ? { defaultValue: variable.defaultValue.trim().slice(0, 500) } : {})
        }))
        .filter((variable) => variable.name.length > 0)
        .slice(0, 24)
    : [];
  return {
    id: input.id?.trim() || randomUUID(),
    name: input.name?.trim().slice(0, 120) || "Untitled Runbook",
    description: input.description?.trim().slice(0, 800) || "",
    command: input.command?.trim().slice(0, 16_000) || "",
    variables,
    concurrency:
      typeof input.concurrency === "number" && Number.isFinite(input.concurrency)
        ? Math.max(1, Math.min(16, Math.round(input.concurrency)))
        : 6,
    timeoutSeconds:
      typeof input.timeoutSeconds === "number" && Number.isFinite(input.timeoutSeconds)
        ? Math.max(5, Math.min(3600, Math.round(input.timeoutSeconds)))
        : 60,
    createdAt: input.createdAt || now,
    updatedAt: now
  };
}

function normalizeSyncProfile(input: Partial<SyncProfile>): SyncProfile {
  const now = new Date().toISOString();
  return {
    id: input.id?.trim() || randomUUID(),
    name: input.name?.trim().slice(0, 120) || "Untitled Sync",
    sessionId: input.sessionId?.trim() || "",
    direction: input.direction === "download" ? "download" : "upload",
    localRoot: input.localRoot?.trim().slice(0, 2048) || "",
    remoteRoot: input.remoteRoot?.trim().slice(0, 2048) || "/",
    excludePatterns: Array.isArray(input.excludePatterns)
      ? input.excludePatterns.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 80)
      : [],
    createdAt: input.createdAt || now,
    updatedAt: now
  };
}

export class SqliteOperationsStore {
  constructor(private readonly db: Database.Database) {}

  listTrustedHostKeys(): TrustedHostKey[] {
    return (this.db.prepare("SELECT * FROM trusted_host_keys ORDER BY host COLLATE NOCASE, port").all() as Array<Record<string, unknown>>).map((row) => ({
      endpoint: String(row.endpoint),
      host: String(row.host),
      port: Number(row.port),
      fingerprint: String(row.fingerprint),
      publicKeyBase64: String(row.public_key_base64),
      firstTrustedAt: String(row.first_trusted_at),
      lastTrustedAt: String(row.last_trusted_at)
    }));
  }

  getTrustedHostKey(endpoint: string): TrustedHostKey | null {
    const row = this.db.prepare("SELECT * FROM trusted_host_keys WHERE endpoint = ?").get(endpoint) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      endpoint: String(row.endpoint), host: String(row.host), port: Number(row.port),
      fingerprint: String(row.fingerprint), publicKeyBase64: String(row.public_key_base64),
      firstTrustedAt: String(row.first_trusted_at), lastTrustedAt: String(row.last_trusted_at)
    };
  }

  trustHostKey(input: Omit<TrustedHostKey, "endpoint" | "firstTrustedAt" | "lastTrustedAt">): TrustedHostKey {
    const host = input.host.trim();
    const port = Number.isFinite(input.port) ? Math.max(1, Math.min(65535, Math.round(input.port))) : 22;
    const endpoint = `${host.toLowerCase()}:${port}`;
    const existing = this.getTrustedHostKey(endpoint);
    const now = new Date().toISOString();
    const next: TrustedHostKey = {
      endpoint, host, port, fingerprint: input.fingerprint, publicKeyBase64: input.publicKeyBase64,
      firstTrustedAt: existing?.firstTrustedAt ?? now, lastTrustedAt: now
    };
    this.db.prepare(`INSERT INTO trusted_host_keys (endpoint, host, port, fingerprint, public_key_base64, first_trusted_at, last_trusted_at)
      VALUES (@endpoint, @host, @port, @fingerprint, @publicKeyBase64, @firstTrustedAt, @lastTrustedAt)
      ON CONFLICT(endpoint) DO UPDATE SET host = excluded.host, fingerprint = excluded.fingerprint,
      public_key_base64 = excluded.public_key_base64, last_trusted_at = excluded.last_trusted_at`).run(next);
    return next;
  }

  removeTrustedHostKey(endpoint: string): void {
    this.db.prepare("DELETE FROM trusted_host_keys WHERE endpoint = ?").run(endpoint.trim());
  }

  listRunbooks(): Runbook[] {
    return (this.db.prepare("SELECT payload_json FROM runbooks ORDER BY updated_at DESC").all() as Array<{ payload_json: string }>).map((row) => normalizeRunbook(parsePayload<Partial<Runbook>>(row.payload_json, {})));
  }

  saveRunbook(input: Partial<Runbook>): Runbook {
    const current = input.id ? this.getRunbook(input.id) : null;
    const next = normalizeRunbook({ ...current, ...input, createdAt: current?.createdAt ?? input.createdAt });
    const count = this.db.prepare("SELECT COUNT(*) AS count FROM runbooks").get() as { count: number };
    if (!current && count.count >= MAX_RUNBOOKS) throw new Error(`Runbook limit (${MAX_RUNBOOKS}) reached.`);
    this.db.prepare(`INSERT INTO runbooks (id, name, updated_at, payload_json) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at, payload_json = excluded.payload_json`)
      .run(next.id, next.name, Date.now(), JSON.stringify(next));
    return next;
  }

  getRunbook(id: string): Runbook | null {
    const row = this.db.prepare("SELECT payload_json FROM runbooks WHERE id = ?").get(id) as { payload_json: string } | undefined;
    return row ? normalizeRunbook(parsePayload<Partial<Runbook>>(row.payload_json, {})) : null;
  }

  removeRunbook(id: string): void {
    const transaction = this.db.transaction(() => {
      this.db.prepare("DELETE FROM runbooks WHERE id = ?").run(id);
      this.db.prepare("DELETE FROM runbook_runs WHERE runbook_id = ?").run(id);
    });
    transaction();
  }

  listRunbookRuns(limit = 200): RunbookRun[] {
    return (this.db.prepare("SELECT payload_json FROM runbook_runs ORDER BY started_at DESC LIMIT ?").all(Math.max(1, Math.min(limit, 1000))) as Array<{ payload_json: string }>).map((row) => parsePayload<RunbookRun>(row.payload_json, { id: "", runbookId: "", runbookName: "", command: "", status: "failed", startedAt: "", targetResults: [] }));
  }

  saveRunbookRun(run: RunbookRun): void {
    this.db.prepare(`INSERT INTO runbook_runs (id, runbook_id, started_at, finished_at, status, payload_json) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET finished_at = excluded.finished_at, status = excluded.status, payload_json = excluded.payload_json`)
      .run(run.id, run.runbookId, new Date(run.startedAt).getTime() || Date.now(), run.finishedAt ? new Date(run.finishedAt).getTime() : null, run.status, JSON.stringify(run));
    this.db.prepare(`DELETE FROM runbook_runs WHERE id IN (
      SELECT id FROM runbook_runs ORDER BY started_at DESC LIMIT -1 OFFSET ?
    )`).run(MAX_RUNBOOK_RUNS);
    this.db.prepare("DELETE FROM runbook_runs WHERE started_at < ?")
      .run(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  clearRunbookRuns(): void { this.db.prepare("DELETE FROM runbook_runs").run(); }

  listSyncProfiles(): SyncProfile[] {
    return (this.db.prepare("SELECT payload_json FROM sync_profiles ORDER BY updated_at DESC").all() as Array<{ payload_json: string }>).map((row) => normalizeSyncProfile(parsePayload<Partial<SyncProfile>>(row.payload_json, {})));
  }

  saveSyncProfile(input: Partial<SyncProfile>): SyncProfile {
    const current = input.id ? this.getSyncProfile(input.id) : null;
    const next = normalizeSyncProfile({ ...current, ...input, createdAt: current?.createdAt ?? input.createdAt });
    if (!current) {
      const count = this.db.prepare("SELECT COUNT(*) AS count FROM sync_profiles").get() as { count: number };
      if (count.count >= MAX_SYNC_PROFILES) throw new Error(`Sync profile limit (${MAX_SYNC_PROFILES}) reached.`);
    }
    this.db.prepare(`INSERT INTO sync_profiles (id, session_id, updated_at, payload_json) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET session_id = excluded.session_id, updated_at = excluded.updated_at, payload_json = excluded.payload_json`)
      .run(next.id, next.sessionId, Date.now(), JSON.stringify(next));
    return next;
  }

  getSyncProfile(id: string): SyncProfile | null {
    const row = this.db.prepare("SELECT payload_json FROM sync_profiles WHERE id = ?").get(id) as { payload_json: string } | undefined;
    return row ? normalizeSyncProfile(parsePayload<Partial<SyncProfile>>(row.payload_json, {})) : null;
  }

  removeSyncProfile(id: string): void { this.db.prepare("DELETE FROM sync_profiles WHERE id = ?").run(id); }

  listSyncRuns(limit = 200): SyncRun[] {
    return (this.db.prepare("SELECT payload_json FROM sync_runs ORDER BY started_at DESC LIMIT ?").all(Math.max(1, Math.min(limit, 1000))) as Array<{ payload_json: string }>).map((row) => parsePayload<SyncRun>(row.payload_json, {
      id: "", profileId: "", profileName: "", direction: "upload", status: "failed", startedAt: "",
      totalFiles: 0, completedFiles: 0, failedFiles: 0, canceledFiles: 0, errors: []
    }));
  }

  saveSyncRun(run: SyncRun): void {
    this.db.prepare(`INSERT INTO sync_runs (id, profile_id, started_at, finished_at, status, payload_json) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET finished_at = excluded.finished_at, status = excluded.status, payload_json = excluded.payload_json`)
      .run(run.id, run.profileId, new Date(run.startedAt).getTime() || Date.now(), run.finishedAt ? new Date(run.finishedAt).getTime() : null, run.status, JSON.stringify(run));
    this.db.prepare(`DELETE FROM sync_runs WHERE id IN (
      SELECT id FROM sync_runs ORDER BY started_at DESC LIMIT -1 OFFSET ?
    )`).run(MAX_SYNC_RUNS);
  }

  clearSyncRuns(): void { this.db.prepare("DELETE FROM sync_runs").run(); }

  listPinnedMonitors(): PinnedMonitor[] {
    return (this.db.prepare("SELECT * FROM pinned_monitors ORDER BY updated_at DESC").all() as Array<Record<string, unknown>>).map((row) =>
      normalizePinnedMonitor({
        sessionId: String(row.session_id),
        enabled: Number(row.enabled) === 1,
        intervalSeconds: Number(row.interval_seconds),
        ...parsePayload<Partial<PinnedMonitor>>(String(row.settings_json ?? ""), {}),
        updatedAt: String(row.updated_at)
      })
    );
  }

  getPinnedMonitor(sessionId: string): PinnedMonitor | null {
    const row = this.db.prepare("SELECT * FROM pinned_monitors WHERE session_id = ?").get(sessionId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return normalizePinnedMonitor({
      sessionId: String(row.session_id),
      enabled: Number(row.enabled) === 1,
      intervalSeconds: Number(row.interval_seconds),
      ...parsePayload<Partial<PinnedMonitor>>(String(row.settings_json ?? ""), {}),
      updatedAt: String(row.updated_at)
    });
  }

  savePinnedMonitor(input: PinnedMonitor): PinnedMonitor {
    const next = normalizePinnedMonitor({ ...input, updatedAt: new Date().toISOString() });
    const settingsJson = JSON.stringify({
      cpuWarnPercent: next.cpuWarnPercent,
      memoryWarnPercent: next.memoryWarnPercent,
      diskWarnPercent: next.diskWarnPercent,
      cpuCriticalPercent: next.cpuCriticalPercent,
      memoryCriticalPercent: next.memoryCriticalPercent,
      diskCriticalPercent: next.diskCriticalPercent,
      alertOnFailedServices: next.alertOnFailedServices,
      failedServiceWarnCount: next.failedServiceWarnCount,
      failedServiceCriticalCount: next.failedServiceCriticalCount,
      cooldownSeconds: next.cooldownSeconds,
      recommendedRunbookIds: next.recommendedRunbookIds
    });
    this.db.prepare(`INSERT INTO pinned_monitors (session_id, enabled, interval_seconds, updated_at, settings_json) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET enabled = excluded.enabled, interval_seconds = excluded.interval_seconds, updated_at = excluded.updated_at, settings_json = excluded.settings_json`)
      .run(next.sessionId, next.enabled ? 1 : 0, next.intervalSeconds, next.updatedAt, settingsJson);
    return next;
  }

  removePinnedMonitor(sessionId: string): void { this.db.prepare("DELETE FROM pinned_monitors WHERE session_id = ?").run(sessionId); }

  appendHealthObservation(observation: HealthObservation): void {
    const normalized = normalizeHealthObservation(observation, observation.sessionId);
    const collectedAt = new Date(normalized.collectedAt).getTime() || Date.now();
    this.db.prepare("INSERT INTO health_observations (session_id, collected_at, payload_json) VALUES (?, ?, ?)")
      .run(normalized.sessionId, collectedAt, JSON.stringify(normalized));
    this.db.prepare("DELETE FROM health_observations WHERE collected_at < ?")
      .run(Date.now() - 24 * 60 * 60 * 1000);
    this.db.prepare(`DELETE FROM health_observations WHERE id IN (
      SELECT id FROM health_observations WHERE session_id = ? ORDER BY collected_at DESC LIMIT -1 OFFSET ?
    )`).run(normalized.sessionId, MAX_HEALTH_OBSERVATIONS_PER_SESSION);
    const bucketAt = Math.floor(collectedAt / (5 * 60 * 1000)) * 5 * 60 * 1000;
    const unhealthy = normalized.connectionState !== "healthy" ? 1 : 0;
    this.db.prepare(`INSERT INTO health_observation_aggregates (
      session_id, bucket_at, sample_count, cpu_sum, memory_sum, disk_sum, load1_sum,
      load5_sum, load15_sum, swap_sum, network_rx_rate_sum, network_tx_rate_sum,
      failed_services_max, unhealthy_count
    ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id, bucket_at) DO UPDATE SET
      sample_count = sample_count + 1,
      cpu_sum = cpu_sum + excluded.cpu_sum,
      memory_sum = memory_sum + excluded.memory_sum,
      disk_sum = disk_sum + excluded.disk_sum,
      load1_sum = load1_sum + excluded.load1_sum,
      load5_sum = load5_sum + excluded.load5_sum,
      load15_sum = load15_sum + excluded.load15_sum,
      swap_sum = swap_sum + excluded.swap_sum,
      network_rx_rate_sum = network_rx_rate_sum + excluded.network_rx_rate_sum,
      network_tx_rate_sum = network_tx_rate_sum + excluded.network_tx_rate_sum,
      failed_services_max = MAX(failed_services_max, excluded.failed_services_max),
      unhealthy_count = unhealthy_count + excluded.unhealthy_count`)
      .run(
        normalized.sessionId,
        bucketAt,
        normalized.cpuUsagePercent,
        normalized.memoryUsagePercent,
        normalized.diskUsagePercent,
        normalized.load1,
        normalized.load5 ?? 0,
        normalized.load15 ?? 0,
        normalized.swapUsagePercent ?? 0,
        normalized.networkRxBytesPerSecond ?? 0,
        normalized.networkTxBytesPerSecond ?? 0,
        normalized.failedServices,
        unhealthy
      );
    this.db.prepare("DELETE FROM health_observation_aggregates WHERE bucket_at < ?")
      .run(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  listHealthObservations(sessionId: string, limit = 720): HealthObservation[] {
    return (this.db.prepare("SELECT payload_json FROM health_observations WHERE session_id = ? ORDER BY collected_at DESC LIMIT ?").all(sessionId, Math.max(1, Math.min(limit, 8640))) as Array<{ payload_json: string }>).map((row) => normalizeHealthObservation(parsePayload<Partial<HealthObservation>>(row.payload_json, {}), sessionId)).reverse();
  }

  /** Records a sample and advances the durable incident state for a pinned monitor. */
  recordHealthObservation(observation: HealthObservation): HealthIncident | null {
    observation = normalizeHealthObservation(observation, observation.sessionId);
    this.appendHealthObservation(observation);
    const monitor = this.getPinnedMonitor(observation.sessionId);
    if (!monitor?.enabled || observation.connectionState === "needsAttention") return null;
    const condition = healthCondition(observation, monitor);
    const active = this.getActiveHealthIncident(observation.sessionId);
    const now = observation.collectedAt || new Date().toISOString();

    if (!condition) {
      if (!active) return null;
      active.healthyStreak += 1;
      active.latestObservation = observation;
      this.appendHealthIncidentEvent(active.id, "healthySample", `Healthy sample ${active.healthyStreak}/2.`);
      if (active.healthyStreak >= 2) {
        active.status = "resolved";
        active.resolvedAt = now;
        this.appendHealthIncidentEvent(active.id, "resolved", "Two consecutive healthy samples resolved this incident.");
      }
      this.saveHealthIncident(active);
      return active;
    }

    if (!active) {
      const incident: HealthIncident = {
        id: randomUUID(),
        sessionId: observation.sessionId,
        status: "open",
        severity: condition.severity,
        conditionKeys: condition.keys,
        firstDetectedAt: now,
        lastDetectedAt: now,
        healthyStreak: 0,
        latestObservation: observation
      };
      this.saveHealthIncident(incident);
      this.appendHealthIncidentEvent(incident.id, "created", `Detected ${condition.keys.join(", ")} threshold breach.`, condition.severity);
      return incident;
    }

    const priorSeverity = active.severity;
    const priorConditions = active.conditionKeys.join("|");
    active.severity = condition.severity;
    active.conditionKeys = condition.keys;
    active.lastDetectedAt = now;
    active.healthyStreak = 0;
    active.latestObservation = observation;
    if (severityRank(condition.severity) > severityRank(priorSeverity)) {
      active.status = "open";
      active.acknowledgedAt = undefined;
      this.appendHealthIncidentEvent(active.id, "escalated", `Escalated to ${condition.severity}.`, condition.severity);
    } else if (priorConditions !== condition.keys.join("|")) {
      active.status = "open";
      active.acknowledgedAt = undefined;
      this.appendHealthIncidentEvent(active.id, "conditionsChanged", `Active conditions: ${condition.keys.join(", ")}.`, condition.severity);
    }
    this.saveHealthIncident(active);
    return active;
  }

  listFleetHealthOverview(): FleetHealthOverviewItem[] {
    return this.listPinnedMonitors().map((monitor) => {
      const observation = this.listHealthObservations(monitor.sessionId, 1).at(-1);
      const activeIncident = this.getActiveHealthIncident(monitor.sessionId);
      const severity: HealthSeverity = !monitor.enabled
        ? "unmonitored"
        : observation?.connectionState === "needsAttention"
          ? "needsAttention"
          : activeIncident?.severity ?? "healthy";
      return { sessionId: monitor.sessionId, monitored: monitor.enabled, severity, lastObservation: observation, activeIncident: activeIncident ?? undefined };
    });
  }

  listHealthTrend(sessionId: string, range: HealthTrendRange): HealthTrendPoint[] {
    const now = Date.now();
    const periodMs = range === "24h" ? 24 * 60 * 60 * 1_000 : range === "7d" ? 7 * 24 * 60 * 60 * 1_000 : 30 * 24 * 60 * 60 * 1_000;
    if (range === "24h") {
      return (this.db.prepare("SELECT payload_json FROM health_observations WHERE session_id = ? AND collected_at >= ? ORDER BY collected_at ASC").all(sessionId, now - periodMs) as Array<{ payload_json: string }>).map((row) => {
        const observation = normalizeHealthObservation(parsePayload<Partial<HealthObservation>>(row.payload_json, {}), sessionId);
        return {
          collectedAt: observation.collectedAt,
          cpuUsagePercent: observation.cpuUsagePercent,
          memoryUsagePercent: observation.memoryUsagePercent,
          diskUsagePercent: observation.diskUsagePercent,
          load1: observation.load1,
          load5: observation.load5 ?? 0,
          load15: observation.load15 ?? 0,
          swapUsagePercent: observation.swapUsagePercent ?? 0,
          networkRxBytesPerSecond: observation.networkRxBytesPerSecond ?? 0,
          networkTxBytesPerSecond: observation.networkTxBytesPerSecond ?? 0,
          failedServices: observation.failedServices,
          unhealthySamples: observation.connectionState === "healthy" ? 0 : 1,
          sampleCount: 1
        };
      });
    }
    return (this.db.prepare(`SELECT bucket_at, sample_count, cpu_sum, memory_sum, disk_sum, load1_sum,
      load5_sum, load15_sum, swap_sum, network_rx_rate_sum, network_tx_rate_sum,
      failed_services_max, unhealthy_count
      FROM health_observation_aggregates WHERE session_id = ? AND bucket_at >= ? ORDER BY bucket_at ASC`).all(sessionId, now - periodMs) as Array<Record<string, number>>).map((row) => ({
      collectedAt: new Date(row.bucket_at).toISOString(),
      cpuUsagePercent: row.cpu_sum / Math.max(1, row.sample_count),
      memoryUsagePercent: row.memory_sum / Math.max(1, row.sample_count),
      diskUsagePercent: row.disk_sum / Math.max(1, row.sample_count),
      load1: row.load1_sum / Math.max(1, row.sample_count),
      load5: row.load5_sum / Math.max(1, row.sample_count),
      load15: row.load15_sum / Math.max(1, row.sample_count),
      swapUsagePercent: row.swap_sum / Math.max(1, row.sample_count),
      networkRxBytesPerSecond: row.network_rx_rate_sum / Math.max(1, row.sample_count),
      networkTxBytesPerSecond: row.network_tx_rate_sum / Math.max(1, row.sample_count),
      failedServices: row.failed_services_max,
      unhealthySamples: row.unhealthy_count,
      sampleCount: row.sample_count
    }));
  }

  listHealthIncidents(status?: HealthIncidentStatus, limit = 200): HealthIncident[] {
    const rows = status
      ? this.db.prepare("SELECT payload_json FROM health_incidents WHERE status = ? ORDER BY last_detected_at DESC LIMIT ?").all(status, Math.max(1, Math.min(limit, MAX_HEALTH_INCIDENTS)))
      : this.db.prepare("SELECT payload_json FROM health_incidents ORDER BY CASE severity WHEN 'critical' THEN 0 ELSE 1 END, last_detected_at DESC LIMIT ?").all(Math.max(1, Math.min(limit, MAX_HEALTH_INCIDENTS)));
    return (rows as Array<{ payload_json: string }>).map((row) => parseIncident(row.payload_json, this.emptyIncident()));
  }

  getHealthIncident(incidentId: string): HealthIncident | null {
    const row = this.db.prepare("SELECT payload_json FROM health_incidents WHERE id = ?").get(incidentId.trim()) as { payload_json: string } | undefined;
    return row ? parseIncident(row.payload_json, this.emptyIncident()) : null;
  }

  listHealthIncidentEvents(incidentId: string): HealthIncidentEvent[] {
    return (this.db.prepare("SELECT payload_json FROM health_incident_events WHERE incident_id = ? ORDER BY created_at ASC").all(incidentId.trim()) as Array<{ payload_json: string }>).map((row) =>
      parsePayload<HealthIncidentEvent>(row.payload_json, { id: "", incidentId, type: "created", createdAt: "", detail: "" })
    );
  }

  acknowledgeHealthIncident(incidentId: string): HealthIncident | null {
    const incident = this.getHealthIncident(incidentId);
    if (!incident || incident.status === "resolved") return incident;
    incident.status = "acknowledged";
    incident.acknowledgedAt = new Date().toISOString();
    this.saveHealthIncident(incident);
    this.appendHealthIncidentEvent(incident.id, "acknowledged", "Operator acknowledged this incident.", incident.severity);
    return incident;
  }

  claimHealthIncidentNotification(incidentId: string, cooldownSeconds: number): HealthIncident | null {
    const incident = this.getHealthIncident(incidentId);
    if (!incident || incident.status === "resolved") return null;
    const lastNotifiedAt = incident.lastNotifiedAt ? new Date(incident.lastNotifiedAt).getTime() : 0;
    const escalated = incident.notifiedSeverity ? severityRank(incident.severity) > severityRank(incident.notifiedSeverity) : false;
    if (incident.status === "acknowledged" && !escalated) return null;
    if (lastNotifiedAt && !escalated && Date.now() - lastNotifiedAt < Math.max(60, cooldownSeconds) * 1_000) return null;
    incident.lastNotifiedAt = new Date().toISOString();
    incident.notifiedSeverity = incident.severity;
    this.saveHealthIncident(incident);
    return incident;
  }

  recordIncidentRunbookEvent(incidentId: string | undefined, run: RunbookRun, phase: "started" | "finished"): void {
    if (!incidentId || !this.getHealthIncident(incidentId)) return;
    this.appendHealthIncidentEvent(
      incidentId,
      phase === "started" ? "runbookStarted" : "runbookFinished",
      phase === "started" ? `Started Runbook: ${run.runbookName}.` : `Runbook ${run.runbookName} ${run.status}.`,
      undefined,
      run.id
    );
  }

  exportHealthIncidentEvidence(incidentId: string): HealthIncidentEvidence {
    const incident = this.getHealthIncident(incidentId);
    if (!incident) throw new Error("Health incident not found.");
    const { lastNotifiedAt: _lastNotifiedAt, notifiedSeverity: _notifiedSeverity, ...safeIncident } = incident;
    return {
      exportedAt: new Date().toISOString(),
      incident: safeIncident,
      events: this.listHealthIncidentEvents(incident.id),
      trends: {
        "24h": this.listHealthTrend(incident.sessionId, "24h"),
        "7d": this.listHealthTrend(incident.sessionId, "7d"),
        "30d": this.listHealthTrend(incident.sessionId, "30d")
      },
      runbooks: this.listRunbookRuns(1_000)
        .filter((run) => run.incidentId === incident.id)
        .map((run) => ({ id: run.id, runbookId: run.runbookId, runbookName: run.runbookName, incidentId: run.incidentId, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt }))
    };
  }

  private getActiveHealthIncident(sessionId: string): HealthIncident | null {
    const row = this.db.prepare("SELECT payload_json FROM health_incidents WHERE session_id = ? AND status IN ('open', 'acknowledged') ORDER BY last_detected_at DESC LIMIT 1").get(sessionId) as { payload_json: string } | undefined;
    return row ? parseIncident(row.payload_json, this.emptyIncident()) : null;
  }

  private saveHealthIncident(incident: HealthIncident): void {
    const firstDetectedAt = new Date(incident.firstDetectedAt).getTime() || Date.now();
    const lastDetectedAt = new Date(incident.lastDetectedAt).getTime() || Date.now();
    const resolvedAt = incident.resolvedAt ? new Date(incident.resolvedAt).getTime() : null;
    this.db.prepare(`INSERT INTO health_incidents (id, session_id, status, severity, first_detected_at, last_detected_at, resolved_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, severity = excluded.severity, last_detected_at = excluded.last_detected_at, resolved_at = excluded.resolved_at, payload_json = excluded.payload_json`)
      .run(incident.id, incident.sessionId, incident.status, incident.severity, firstDetectedAt, lastDetectedAt, resolvedAt, JSON.stringify(incident));
    this.db.prepare("DELETE FROM health_incidents WHERE id IN (SELECT id FROM health_incidents WHERE status = 'resolved' ORDER BY resolved_at DESC LIMIT -1 OFFSET ?)").run(MAX_HEALTH_INCIDENTS);
    this.db.prepare("DELETE FROM health_incident_events WHERE incident_id NOT IN (SELECT id FROM health_incidents)").run();
  }

  private appendHealthIncidentEvent(
    incidentId: string,
    type: HealthIncidentEvent["type"],
    detail: string,
    severity?: IncidentSeverity,
    runbookRunId?: string
  ): HealthIncidentEvent {
    const event: HealthIncidentEvent = { id: randomUUID(), incidentId, type, createdAt: new Date().toISOString(), detail, ...(severity ? { severity } : {}), ...(runbookRunId ? { runbookRunId } : {}) };
    this.db.prepare("INSERT INTO health_incident_events (id, incident_id, created_at, event_type, payload_json) VALUES (?, ?, ?, ?, ?)")
      .run(event.id, event.incidentId, new Date(event.createdAt).getTime(), event.type, JSON.stringify(event));
    this.db.prepare("DELETE FROM health_incident_events WHERE id IN (SELECT id FROM health_incident_events ORDER BY created_at DESC LIMIT -1 OFFSET ?)").run(MAX_HEALTH_INCIDENT_EVENTS);
    return event;
  }

  private emptyIncident(): HealthIncident {
    return {
      id: "", sessionId: "", status: "resolved", severity: "warning", conditionKeys: [], firstDetectedAt: "", lastDetectedAt: "", healthyStreak: 0,
      latestObservation: { sessionId: "", collectedAt: "", cpuUsagePercent: 0, memoryUsagePercent: 0, diskUsagePercent: 0, load1: 0, failedServices: 0, connectionState: "needsAttention" }
    };
  }
}
