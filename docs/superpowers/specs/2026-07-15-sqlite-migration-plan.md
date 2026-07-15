# SQLite Migration Plan

[中文](2026-07-15-sqlite-migration-plan.zh-CN.md)

Last updated: 2026-07-15

## Goal

Move TermDock persistence from ad-hoc JSON files and renderer `localStorage` into a versioned SQLite database owned by the main process, without weakening credential isolation or breaking existing session/settings data.

This document is planning only. It does not add SQLite dependencies or migration code.

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

### Phase 4 — Preference and history ports

Prioritize durable / recoverable data over pure UI chrome:

1. Transfer pending restore + transfer history
2. Disconnect report history
3. Port-forward event history
4. Session templates / quick profiles / snippet groups
5. Remaining preference keys

UI chrome (accent, density, collapsed inspector) can remain in `localStorage` longer without blocking persistence hardening.

### Phase 5 — Credential-safe backup / restore

Build on current encrypted migration (`.tdmigration`):

- Non-secret SQLite dump / export
- Optional passphrase-protected credential attachment via existing keytar export path
- Explicit preview + duplicate strategies matching current session migration UX

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

## Validation Plan (when implementation starts)

- Dedicated import / dual-write / rollback script tests (mirror `test:session-migration`).
- Packaged Windows smoke after enabling SQLite by default.
- Manual check that keytar credentials survive migration and are absent from the SQLite dump.
- Startup / sessions-load benchmark note in `artifacts/benchmark/`.
