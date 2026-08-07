/**
 * SQLite schema + forward migrations for TermDock main-process storage.
 *
 * Secrets (passwords, private-key passphrases) stay in keytar keyed by session id.
 * SQLite stores only `sessions.has_secret` to record whether a secret exists.
 *
 * Group membership stays denormalized on `sessions.group_id` (group name string).
 * `session_groups` is a registry of known names, not a foreign-key parent table.
 */

import type Database from "better-sqlite3";

/** Current schema version; bump when adding forward migrations. */
export const SQLITE_SCHEMA_VERSION = 12;

/** Where session secrets are stored; never written into SQLite rows. */
export const SQLITE_SECRET_STORAGE_OWNER = "keytar" as const;

/**
 * Column on `sessions` that holds group membership as a denormalized group name string.
 * There is no session↔group join table in Phase 1.
 */
export const SQLITE_SESSION_GROUP_MEMBERSHIP_COLUMN = "group_id" as const;

/** Phase 1 base DDL (idempotent). */
export const SQLITE_SCHEMA_DDL_V1 = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT NOT NULL,
  auth_type TEXT NOT NULL,
  private_key_path TEXT NULL,
  group_id TEXT NULL,
  remark TEXT NULL,
  favorite INTEGER NOT NULL,
  has_secret INTEGER NOT NULL,
  last_connected_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`.trim();

/** Phase 4 slice 1: transfer history + pending restore. */
export const SQLITE_SCHEMA_DDL_V2 = `
CREATE TABLE IF NOT EXISTS transfer_history (
  entry_key TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL,
  name TEXT NOT NULL,
  local_path TEXT NOT NULL,
  remote_path TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL,
  message TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_transfer_history_updated_at
  ON transfer_history (updated_at DESC);

CREATE TABLE IF NOT EXISTS transfer_pending_restore (
  entry_key TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  local_path TEXT NOT NULL,
  remote_path TEXT NOT NULL,
  name TEXT NOT NULL
);
`.trim();

/** Phase 4 slice 2: disconnect report history. */
export const SQLITE_SCHEMA_DDL_V3 = `
CREATE TABLE IF NOT EXISTS disconnect_reports (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  session_id TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_disconnect_reports_created_at
  ON disconnect_reports (created_at DESC);
`.trim();

/** Phase 4 slice 3: port-forward event history. */
export const SQLITE_SCHEMA_DDL_V4 = `
CREATE TABLE IF NOT EXISTS port_forward_events (
  entry_key TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_port_forward_events_created_at
  ON port_forward_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_port_forward_events_session_id
  ON port_forward_events (session_id);
`.trim();

/** Phase 4 slice 4: session quick profiles, templates, command snippets. */
export const SQLITE_SCHEMA_DDL_V5 = `
CREATE TABLE IF NOT EXISTS session_quick_profiles (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_templates (
  id TEXT PRIMARY KEY,
  updated_at INTEGER NOT NULL,
  has_secret INTEGER NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_templates_updated_at
  ON session_templates (updated_at DESC);

CREATE TABLE IF NOT EXISTS command_snippet_groups (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS command_snippet_scoped_values (
  scope_key TEXT PRIMARY KEY,
  updated_at INTEGER NOT NULL,
  payload_json TEXT NOT NULL
);
`.trim();

/** Phase 4 slice 5: durable app preference blobs (localStorage dual-write soak). */
export const SQLITE_SCHEMA_DDL_V6 = `
CREATE TABLE IF NOT EXISTS app_preferences (
  pref_key TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_preferences_updated_at
  ON app_preferences (updated_at DESC);
`.trim();

/** v7: connection trust, session asset metadata, and runbook persistence. */
export const SQLITE_SCHEMA_DDL_V7 = `
CREATE TABLE IF NOT EXISTS trusted_host_keys (
  endpoint TEXT PRIMARY KEY,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  public_key_base64 TEXT NOT NULL,
  first_trusted_at TEXT NOT NULL,
  last_trusted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runbooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runbook_runs (
  id TEXT PRIMARY KEY,
  runbook_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runbook_runs_started_at ON runbook_runs (started_at DESC);
`.trim();

/** v8: one-way sync profiles and persisted Fleet Health observations. */
export const SQLITE_SCHEMA_DDL_V8 = `
CREATE TABLE IF NOT EXISTS sync_profiles (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pinned_monitors (
  session_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL,
  interval_seconds INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS health_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  collected_at INTEGER NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_health_observations_session_time
  ON health_observations (session_id, collected_at DESC);
`.trim();

/** v9: persisted sync execution summaries for Operation Center recovery. */
export const SQLITE_SCHEMA_DDL_V9 = `
CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON sync_runs (started_at DESC);
`.trim();

/** v10: retain raw Fleet samples for 24h and compact five-minute history for 30d. */
export const SQLITE_SCHEMA_DDL_V10 = `
CREATE TABLE IF NOT EXISTS health_observation_aggregates (
  session_id TEXT NOT NULL,
  bucket_at INTEGER NOT NULL,
  sample_count INTEGER NOT NULL,
  cpu_sum REAL NOT NULL,
  memory_sum REAL NOT NULL,
  disk_sum REAL NOT NULL,
  load1_sum REAL NOT NULL,
  failed_services_max INTEGER NOT NULL,
  unhealthy_count INTEGER NOT NULL,
  PRIMARY KEY (session_id, bucket_at)
);

CREATE INDEX IF NOT EXISTS idx_health_aggregate_session_time
  ON health_observation_aggregates (session_id, bucket_at DESC);
`.trim();

/** v11: per-target Fleet alert thresholds and cooldown preferences. */
export const SQLITE_SCHEMA_DDL_V11 = `
ALTER TABLE pinned_monitors ADD COLUMN settings_json TEXT NULL;
`.trim();

/** v12: durable Fleet Health incident lifecycle and operator audit trail. */
export const SQLITE_SCHEMA_DDL_V12 = `
CREATE TABLE IF NOT EXISTS health_incidents (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL,
  severity TEXT NOT NULL,
  first_detected_at INTEGER NOT NULL,
  last_detected_at INTEGER NOT NULL,
  resolved_at INTEGER NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_health_incidents_session_status
  ON health_incidents (session_id, status, last_detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_incidents_status_severity
  ON health_incidents (status, severity, last_detected_at DESC);

CREATE TABLE IF NOT EXISTS health_incident_events (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_health_incident_events_incident_time
  ON health_incident_events (incident_id, created_at ASC);
`.trim();

/** @deprecated Use migrateSqliteSchema(); kept for docs / dual-write test imports. */
export const SQLITE_SCHEMA_DDL = SQLITE_SCHEMA_DDL_V1;

/**
 * Crash-recovery-friendly connection defaults for TermDock SQLite databases.
 * WAL survives abrupt process exits better than the default DELETE journal.
 */
export function configureSqliteConnection(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
}

export function migrateSqliteSchema(db: Database.Database): void {
  db.exec(SQLITE_SCHEMA_DDL_V1);
  const userVersion = Number(db.pragma("user_version", { simple: true }) ?? 0);
  if (userVersion < 2) {
    db.exec(SQLITE_SCHEMA_DDL_V2);
  }
  if (userVersion < 3) {
    db.exec(SQLITE_SCHEMA_DDL_V3);
  }
  if (userVersion < 4) {
    db.exec(SQLITE_SCHEMA_DDL_V4);
  }
  if (userVersion < 5) {
    db.exec(SQLITE_SCHEMA_DDL_V5);
  }
  if (userVersion < 6) {
    db.exec(SQLITE_SCHEMA_DDL_V6);
  }
  if (userVersion < 7) {
    for (const statement of [
      "ALTER TABLE sessions ADD COLUMN jump_session_id TEXT NULL",
      "ALTER TABLE sessions ADD COLUMN environment TEXT NULL",
      "ALTER TABLE sessions ADD COLUMN tags_json TEXT NULL",
      "ALTER TABLE sessions ADD COLUMN owner TEXT NULL",
      "ALTER TABLE sessions ADD COLUMN custom_fields_json TEXT NULL"
    ]) {
      try {
        db.exec(statement);
      } catch (error) {
        if (!String(error).includes("duplicate column name")) {
          throw error;
        }
      }
    }
    db.exec(SQLITE_SCHEMA_DDL_V7);
  }
  if (userVersion < 8) {
    db.exec(SQLITE_SCHEMA_DDL_V8);
  }
  if (userVersion < 9) {
    db.exec(SQLITE_SCHEMA_DDL_V9);
  }
  if (userVersion < 10) {
    db.exec(SQLITE_SCHEMA_DDL_V10);
  }
  if (userVersion < 11) {
    try {
      db.exec(SQLITE_SCHEMA_DDL_V11);
    } catch (error) {
      if (!String(error).includes("duplicate column name")) {
        throw error;
      }
    }
  }
  if (userVersion < 12) {
    db.exec(SQLITE_SCHEMA_DDL_V12);
  }
  db.pragma(`user_version = ${SQLITE_SCHEMA_VERSION}`);
  db.prepare(
    `INSERT INTO app_meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(SQLITE_SCHEMA_VERSION));
}
