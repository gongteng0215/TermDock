# SQLite Migration Plan

[中文](2026-07-15-sqlite-migration-plan.zh-CN.md)

Last updated: 2026-07-16

## Goal

Move TermDock persistence from ad-hoc JSON files and renderer `localStorage` into a versioned SQLite database owned by the main process, without weakening credential isolation or breaking existing session/settings data.

Phase 1–5 have landed (sessions cutover, durable preference ports, `.tdbackup` credential-safe backup). Packaged native smoke is green. P0-E4 crash-recovery verification landed (WAL mode + automated reopen / corrupt-file / rollback checks).

## Current Persistence Map

### Main process

| Store | Location | Owner | Contains secrets? |
| --- | --- | --- | --- |
| Sessions | `userData/db/sessions.json` via `SessionStore` | Main | No (host/user/metadata only) |
| Credentials | OS secret store via `keytar` | Main | Yes (passwords / key passphrases) |
| Logs / diagnostics | File-backed main logging | Main | May include connection metadata |

Session records currently live behind a thin JSON schema (`{ sessions: SessionRecord[] }`) with no explicit schema version field.

### Renderer `localStorage`

Preferences and UI state live in many `termdock.*.v1` (and a few `.v2` / `.v3`) keys. Important groups:

- Workspace / UI: language, accent, density, explorer view, inspector tabs, onboarding dismiss
- Connection / terminal: connection preferences, editor-focus preferences, hotkeys
- SFTP / transfers: transfer preferences, conflict strategy, history, pending restore, policy packs
- Sessions / templates: groups, sort mode, quick profiles, templates, workspace profile
- Port forwarding / disconnect / retry: presets, event history, view prefs, disconnect reports
- Safety / server health: dangerous-command guard prefs and policy bundles, alert prefs
- Command history / snippets: terminal command history, snippet groups, scoped values

Secrets must continue to stay out of SQLite and out of renderer storage. Encrypted migration packages (`.tdmigration`) already prove that passphrase + secret bundling is a separate path from ordinary preference export.

## Why SQLite

- Atomic multi-record updates for sessions and derived indexes (favorites, recency, groups).
- Explicit schema versions and forward-only migrations.
- Better crash recovery than overwrite-in-place JSON for growing history tables (transfer history, disconnect reports, port-forward events).
- Opens a clear path to back up / restore non-secret app state without scraping dozens of `localStorage` keys.

## Non-Goals (this planning phase)

- No dependency on `better-sqlite3`, `sql.js`, or any other SQLite binding yet.
- No live dual-write / cutover implementation.
- No automatic rewrite of renderer preferences into main-process storage yet.
- No change to keytar credential ownership.

## Proposed Target Architecture

1. Main process owns a single SQLite file under `userData/db/termdock.sqlite`.
2. Schema is versioned (`PRAGMA user_version` or a `schema_migrations` table).
3. Credentials remain in keytar; SQLite stores only `credentialRef` / session id linkage.
4. Renderer continues to talk through existing IPC contracts; storage details stay behind main-process repositories.
5. Preference migration happens after session-store migration, keyed per `termdock.*.vN` localStorage namespace.

## Migration Phases

### Phase 0 — Inventory freeze (done by this doc)

Capture the current owners, files, and secret boundaries. Keep JSON + localStorage as source of truth until Phase 2.

### Phase 1 — Schema design

Draft tables for:

- `sessions` (core host metadata currently in `SessionRecord`)
- `session_groups` / membership mapping (today partly renderer-managed)
- optional early `app_meta` for version stamps and migration flags

Defer large history tables until after session cutover unless they block crash-recovery (`P0-E4`).

### Phase 2 — Dual write / shadow read for sessions

1. Introduce SQLite behind `SessionStore` with the same public methods.
2. Import existing `sessions.json` on first launch.
3. Dual-write for a soak period; compare list/get results in diagnostics.
4. Keep `sessions.json` as rollback snapshot until Phase 3 evidence is green.

### Phase 3 — Cutover + rollback

1. Make SQLite authoritative for sessions.
2. Keep a one-shot export of `sessions.json` as backup for the cutover release.
3. Document rollback: restore JSON snapshot, disable SQLite feature flag if needed.
4. Only then expand to selected preference / history tables.

### Phase 3 Cutover (landed)

Runtime behavior (2026-07-15):

- `DualWriteSessionStore` reads/writes SQLite first; JSON is a best-effort live mirror.
- On first cutover boot, copies `sessions.json` → `sessions.json.pre-sqlite-cutover` (one-shot).
- Sets `app_meta.sessions_authority=sqlite` and `sessions_cutover_at`.
- Empty SQLite still imports from `sessions.json` before marking cutover.
- Rollback:
  1. Quit TermDock.
  2. Restore `sessions.json` from `sessions.json.pre-sqlite-cutover` (or the live JSON mirror if trusted).
  3. Optionally delete/rename `termdock.sqlite`.
  4. Launch with `TERMDOCK_SESSION_STORE=json` to force JSON-only, or let SQLite open fail and fall back.
- Packaging: `better-sqlite3` / `keytar` are listed in `asarUnpack`; startup still falls back to JSON if the native module fails to load.
- Test: `pnpm run test:session-sqlite-cutover`.

### Phase 4 — Preference and history ports

Prioritize durable / recoverable data over pure UI chrome:

1. Transfer pending restore + transfer history
2. Disconnect report history
3. Port-forward event history
4. Session templates / quick profiles / snippet groups
5. Remaining preference keys

UI chrome (accent, density, collapsed inspector) can remain in `localStorage` longer without blocking persistence hardening.

### Phase 4 Slice 1 (landed) — transfer history + pending restore

Runtime behavior (2026-07-15):

- Schema version bumped to **2** with `transfer_history` + `transfer_pending_restore` tables (idempotent `IF NOT EXISTS` migrations).
- Main `SqliteTransferStore` + IPC: `storage:get/replaceTransferHistory`, `storage:get/replacePendingTransferRestore`.
- Renderer dual-write soak: boot hydrates from SQLite when non-empty (else imports localStorage → SQLite); subsequent writes go to localStorage **and** SQLite.
- Retry Center stays a pure view over `transferHistory` (no separate store).
- Fixed repeated-open schema init (base DDL is now `CREATE TABLE IF NOT EXISTS`).
- Test: `pnpm run test:session-sqlite-transfer-persistence`.

Still deferred in Phase 4: disconnect reports, port-forward event history, templates/profiles/snippets, remaining preference keys.

### Phase 4 Slice 2 (landed) — disconnect report history

Runtime behavior (2026-07-15):

- Schema version bumped to **3** with `disconnect_reports` (`id`, `created_at`, `session_id`, `payload_json`).
- Main `SqliteDisconnectReportStore` + IPC: `storage:get/replaceDisconnectReports`.
- Renderer dual-write soak (same hydrate-then-mirror pattern as transfer history); view/capture prefs stay in localStorage.
- Test: `pnpm run test:session-sqlite-disconnect-reports`.

Still deferred in Phase 4: port-forward event history, templates/profiles/snippets, remaining preference keys.

### Phase 4 Slice 3 (landed) — port-forward event history

Runtime behavior (2026-07-15):

- Schema version bumped to **4** with `port_forward_events` (`entry_key`, `session_id`, `created_at`, `payload_json`).
- Main `SqlitePortForwardEventStore` + IPC: `storage:get/replacePortForwardEventHistory`.
- Renderer dual-write soak (hydrate-then-mirror); event view prefs stay in localStorage.
- Live main-process event ring buffer + list IPC unchanged; durable cross-session history is what moves to SQLite.
- Test: `pnpm run test:session-sqlite-port-forward-events`.

Still deferred in Phase 4: remaining preference keys.

### Phase 4 Slice 4 (landed) — session templates / quick profiles / snippet groups

Runtime behavior (2026-07-15):

- Schema version bumped to **5** with `session_quick_profiles`, `session_templates` (`has_secret` flag, no plaintext secrets in `payload_json`), `command_snippet_groups`, and `command_snippet_scoped_values`.
- Main `SqliteWorkbenchStore` + IPC: `storage:get/replaceSessionQuickProfiles`, `storage:get/replaceSessionTemplates`, `storage:get/replaceCommandSnippetGroups`, `storage:get/replaceCommandSnippetScopedValues`.
- Renderer dual-write soak (hydrate-then-mirror); template passwords stay in localStorage during soak (SQLite stores `hasSecret` only).
- Test: `pnpm run test:session-sqlite-workbench-data`.

Still deferred in Phase 4: remaining preference keys.

### Phase 4 Slice 5 (landed) — durable app preference ports

Runtime behavior (2026-07-15):

- Schema version bumped to **6** with generic `app_preferences` (`pref_key`, `payload_json`, `updated_at`).
- Main `SqlitePreferenceStore` + IPC: `storage:getAppPreferences`, `storage:setAppPreference`, `storage:replaceAppPreferences`.
- Dual-write soak for 18 durable keys (connection, terminal focus, hotkeys, file-open, SFTP prefs/policy packs/conflict strategy, port-forward presets, session groups/sort, workspace profile, server-health alerts, dangerous-command guard/bundles/sync, disconnect-capture prefs, terminal command history).
- Store rejects non-allowlisted keys (UI chrome such as accent/density/view filters stay in localStorage).
- Test: `pnpm run test:session-sqlite-app-preferences`.

Phase 4 durable ports complete; UI chrome may remain in localStorage.

### Phase 5 (landed) — Credential-safe backup / restore

Runtime behavior (2026-07-15):

- New `.tdbackup` format (`termdock-app-backup` v1) dumps non-secret SQLite durable state: sessions (`hasSecret` only), transfer history/pending restore, disconnect reports, port-forward events, workbench data, allowlisted app preferences.
- Optional passphrase-protected **credentials attachment** reuses the existing `.tdmigration` envelope (`exportEncryptedSessionMigration` / keytar).
- Export/import UX mirrors session migration: preview counts, skip/overwrite/rename for sessions (`host:port:username`), optional credential restore.
- IPC: `storage:exportAppBackup`, `storage:previewAppBackup`, `storage:importAppBackup`.
- Plain dump refuses `"secret"` fields; template passwords stay out of SQLite payloads.
- Test: `pnpm run test:session-sqlite-app-backup`.

### P0-E4 (landed) — Crash-recovery verification

Runtime behavior (2026-07-16):

- New SQLite connections use `configureSqliteConnection()`: `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=5000`, `foreign_keys=ON`.
- Automated checks in `pnpm run test:session-sqlite-crash-recovery`:
  - close/reopen durability for sessions + transfer history
  - corrupt `.sqlite` file fails open (main falls back to JSON)
  - corrupt JSON mirror does not block SQLite-authoritative reads
  - restore `sessions.json.pre-sqlite-cutover` for JSON-only rollback
- `DualWriteSessionStore.flushJsonMirror()` waits for the best-effort JSON mirror write.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Native module packaging / Electron ABI mismatch | Prefer a single vetted binding; CI pack smoke before enabling default cutover |
| Data loss during migration | Dual write, pre-cutover JSON snapshot, restore docs |
| Partial preference migration leaves split brain | Migrate by storage-key groups with clear “owned by main” markers |
| Secret leakage into SQLite backups | Never store passwords/passphrases; redact diagnostics; reuse encrypted migration packaging |
| Startup regression | Benchmark session list load before/after (`bench:startup` plus a future sessions-load benchmark) |

## Exit Criteria

`P0-A3` / `F9` can move from PARTIAL toward DONE when:

1. Sessions load/save exclusively from SQLite with proven rollback.
2. Schema versioning and migration scripts are documented and tested.
3. Credential-safe backup/restore covers sessions + non-secret durable state without writing secrets to plain files.
4. Remaining preference history migration has an explicit backlog order rather than an open rewrite.
5. Crash-recovery paths (WAL, corrupt DB fallback, pre-cutover rollback) are covered by automated tests.

## Validation Plan (when implementation starts)

- Dedicated import / dual-write / rollback script tests (mirror `test:session-migration`).
- Packaged Windows smoke after enabling SQLite by default.
- Manual check that keytar credentials survive migration and are absent from the SQLite dump.
- Startup / sessions-load benchmark note in `artifacts/benchmark/`.

## Phase 1 Schema (landed)

Source of truth: `src/main/storage/sqlite/schema.ts` (`SQLITE_SCHEMA_VERSION = 1`).

Secrets remain in keytar; SQLite only stores `has_secret`. Group membership is denormalized on `sessions.group_id` (group name string), not a join table.

```sql
CREATE TABLE sessions (
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

CREATE TABLE session_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```
