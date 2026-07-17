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
export const SQLITE_SCHEMA_VERSION = 6;

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
  db.pragma(`user_version = ${SQLITE_SCHEMA_VERSION}`);
  db.prepare(
    `INSERT INTO app_meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(SQLITE_SCHEMA_VERSION));
}
