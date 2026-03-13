# TermDock

TermDock is a cross-platform desktop SSH + SFTP client for developers and operators.
It combines session management, multi-tab terminal, file transfer, diagnostics logging, and server health monitoring in one workspace.

## Current Status

- Current stable release: `v0.1.12` (2026-03-13)
- Current branch focus: `v0.1.13` hardening cycle on `master`
- Main targets: macOS and Windows 11
- Packaging: macOS (`arm64`, `x64`) and Windows (`nsis`, `zip`)

## UI Rules

- Compact UI and fixed-height list policy: `UI_COMPACT_RULES.md`

## Patch in `v0.1.12` (2026-03-13)

- Double-clicking the same session in the session list now always opens a new terminal tab.
- Other session open entry points still keep the single-tab-per-session focus behavior.

## Released in `v0.1.11` (2026-03-13)

- Session open behavior hardening:
  - opening a session now focuses existing tab when already open (no duplicate tab)
  - close-and-reopen flow for the same session is preserved
- Command History panel interaction polish:
  - blank-area right click now opens context menu (`Add` / `Import` / `Export` / `Manage`)
  - row right click keeps item actions (`Run` / `Copy` / `Delete`)
- Session text normalization migration:
  - added startup normalization for known mojibake session/group/remark text patterns
  - create/update paths now normalize known corrupted text before persistence
- Added/expanded Electron smoke automation (`scripts/smoke-capture-all.mjs`):
  - covers sessions context menus, settings sections, command history workflows, retry/operation center
  - latest local run: `PASS 21 / FAIL 0 / SKIP 0`
- Transfer conflict policy for upload/download (`Overwrite` / `Skip` / `Rename`)
- Parallelized transfer conflict pre-checks (directory-level limited concurrency)
- Failed transfer replay actions (`Retry Failed`) for upload/download docks
- Session-scoped persistent failed-transfer history (survives restart and feeds `Retry Failed`)
- Transfer Retry Center modal (scope/direction/status/time/search filter + select/retry/delete persisted history records)
- Retry Center analytics package:
  - top failure reason aggregation (failed-visible scope)
  - analytics snapshot export (`JSON` / `CSV`)
  - history export stats now include top sessions/groups/failure reasons
  - failure-reason quick filter, active-session quick retry by reason (scope strategy aware), and visible delete by reason
  - list view supports `Flat` and `Grouped by Failure` (collapsible groups + group-level select/retry/delete/export)
  - group export supports scoped payload selection (`All` / `Failed` / `Retryable Active Session`)
  - grouped retry now supports scope selection (`All Retryable` / `Upload Only` / `Download Only`)
  - retry-center view filters now persist locally (including time range/search)
  - `Retry Visible Failed` now supports scope selection (`All Retryable` / `Upload Only` / `Download Only`)
  - `Retry Selected Failed` now supports scope selection (`All Retryable` / `Upload Only` / `Download Only`)
  - one-click `Retry All Failed` action (upload + download) is available in Transfers, Retry Center, and Operation Center with retry-scope strategy
  - Retry Center action bar now includes direction-specific quick actions (`Retry Failed Uploads` / `Retry Failed Downloads`)
  - large retry batches require confirmation with configurable threshold (`Retry Confirm Threshold`, default: `100`, set `0` to disable)
  - `Settings > SFTP` now includes `Retry Confirm Threshold` as a global tuning entry
  - retry-scope chooser remembers last used scope across app restart (shown as `Last Used`)
  - `Default Retry Scope` selector allows manual preselection of all/upload/download strategy
  - `Auto Retry Scope` toggle can skip chooser and directly apply last used scope when available
- Transfer queue pause/resume behavior on disconnect:
  - queued jobs pause with explicit dock notice when tab disconnects
  - queue resumes after reconnect without forcing immediate batch failure
- Transfer completion UX polish:
  - removed blocking completion popup for normal batches
  - added lightweight dock notice for batch completion status
  - failure details are logged for diagnostics handoff
- Session data export from Sessions context menu:
  - export all sessions with group metadata to JSON
  - export all groups (and contained sessions) to JSON
- Session JSON import wizard from Sessions context menu:
  - import from JSON file with group strategy (`keepSource` / `forceCurrent` / `ungrouped`)
  - duplicate strategy (`skip` / `overwrite` / `rename`) with preview summary
- Session quick profiles:
  - save named startup command profile from session context menu
  - run/manage quick profiles per session
- Command snippet groups:
  - grouped snippet manager with run/add/import/export/reset actions
  - snippet template placeholders for clipboard/time/session/tab metadata
- Pending transfer queue restore:
  - app restart can detect saved pending transfer queue snapshot
  - transfer dock provides one-click `Restore Pending` and `Discard Pending`
- Remote file auto-sync guard:
  - before save-back upload, compare remote metadata (exists/size/mtime) against baseline
  - skip unsafe auto-upload when remote changed unexpectedly and log guard event
- Retry Center failure suggestions:
  - top failure reasons now include action suggestions for faster triage
- SSH config import baseline (`~/.ssh/config`): preview + duplicate strategy (`skip`/`overwrite`/`rename`)
- SSH config parser hardening: recursive `Include` + `Host` wildcard/negation merge semantics
- Port forwarding manager in `Settings > Port Fwd`:
  - Local / Remote / Dynamic (`SOCKS5`) creation, list, and remove
  - saved per-session presets with one-click apply
  - optional auto-restore on terminal connect
  - runtime status (`Active` / `Degraded`) with last error and activity metadata
  - recent per-tab forwarding events (`created`/`removed`/`degraded`/`recovered`)
  - session-scoped persisted event history with filter and clear actions
  - visible-event analytics cards (error ratio, type breakdown, top error codes, top correlations)
  - analytics export (`JSON` / `CSV`) plus visible-event detail export (`JSON` / `CSV`)
  - one-click diagnostics snapshot export to `.txt` (clipboard fallback)
  - bound to active terminal tab with auto-cleanup on disconnect/close
- Diagnostics logging baseline:
  - main process file logging with rotation
  - renderer global error auto-capture
  - `Settings > Diagnostics` for log path refresh/open/copy
- Disconnect report baseline:
  - unexpected tab disconnects now auto-capture runtime context snapshots
  - `Settings > Diagnostics` includes report list, JSON/CSV export, copy-latest, and clear actions
  - auto-capture toggle in diagnostics for quick enable/disable
  - report filters by session scope/trigger/time range/search query
  - supports visible-scope export and visible-scope clear actions
- Hotkey safety polish:
  - `Settings > Hotkeys` now detects conflicts across enabled shortcuts
  - conflicting actions are highlighted directly in each hotkey row with inline conflict badges
  - one-click `Auto Resolve Conflicts` keeps the first action and disables duplicate bindings
  - supports `Import Hotkeys...` / `Export Hotkeys...` JSON backup and restore
  - hotkey import now shows a before/after diff preview before applying changes
  - hotkey import now shows imported conflict count and supports `Import + Auto Resolve`
  - import preview now also lists which actions will be disabled by auto-resolve
  - hotkey conflict panel now supports `Locate` and `Focus First Conflict` for one-click row navigation
  - hotkey conflict panel now supports `Prev` / `Next` navigation with active conflict index
  - hotkey conflict navigation also supports keyboard shortcuts (`Alt + [` / `Alt + ]`)
  - conflict cursor position is persisted locally and restored on reopen when signature still matches
- Global error recovery baseline:
  - upgraded error bar with quick actions (`Reconnect`, `Open Logs`, `Diagnostics`, `Copy Error`)
  - includes `Copy Latest Disconnect` action when reports are available
  - connection/bridge related errors now show contextual recovery hints
- Operation center baseline:
  - new `Operation Center` modal for active long-running operations
  - consolidated status for upload/download queues, remote delete, and port-forward busy state
  - quick actions for cancel-all transfer queues and jump to diagnostics/port-forward settings
  - cross-tab transfer activity summary with one-click focus to target tab
  - per-tab and cross-tab one-click transfer cancellation actions
  - per-tab and bulk reconnect actions for disconnected tabs with active transfer queues
- Added one-click bug report export (`zip`: logs + runtime metadata + settings snapshot)
- Bug report export now includes disconnect report snapshot (`disconnect-reports.json`) when available
- Reduced random disconnect risk during heavy transfer bursts by avoiding overlapping server-monitor polling requests per tab
- Improved terminal viewport stability on small windows and packaged startup by adding deferred multi-pass `fit` and font-ready refit
- Added transfer soak tool and runbook (`scripts/soak-transfer.mjs`, `SOAK_TEST.md`)

## Available Features

- Session create/edit/delete/test
- Password and private key authentication
- Session search, favorites, and recency sorting
- Folder-style session grouping and context-menu operations
- Session/group bulk export actions from Sessions context menu:
  - `Export All Sessions...` (JSON with group data)
  - `Export All Groups...` (JSON with grouped session lists)
- Session import from JSON (`Import Sessions JSON...`) with group and duplicate strategy selection
- SSH config import with preview and duplicate-handling strategy
- Session quick profiles (`Run Quick Profile...`, `Save Quick Profile...`, `Manage Quick Profiles...`)
- Multi-tab xterm terminal with single-tab-per-session dedupe (opening an already-open session focuses existing tab)
- Terminal context menu and reconnect flow
- Command History side panel + manager, including blank-area context menu actions (`Add` / `Import` / `Export` / `Manage`)
- Command snippets manager and grouped snippet execution (`Run Snippet`, `Snippet Manager`)
- Port forwarding manager in Settings:
  - Local forward (`-L`)
  - Remote forward (`-R`)
  - Dynamic SOCKS5 forward (`-D`)
  - saved presets per session
  - auto-restore on connect
  - runtime status/failed-connection metadata
  - recent event timeline + persisted history controls + diagnostics snapshot file export
  - tab-scoped lifecycle with one-click remove
- Configurable hotkeys in Settings (Windows defaults: `Ctrl+Shift+C` / `Ctrl+Shift+V`) with conflict detection, one-click auto-resolve, and JSON import/export
- Hotkey conflict tooling includes diff preview, import-time auto-resolve options, row navigation (`Locate`/`Prev`/`Next`), keyboard traversal (`Alt + [` / `Alt + ]`), and cursor restore
- KeepAlive and auto reconnect
- SFTP browse/create/rename/delete/open
- Upload/download queues with:
  - progress, per-task cancel, cancel-all
  - conflict policy (`Overwrite` / `Skip` / `Rename`)
  - session-scoped remembered conflict default (`Overwrite` / `Skip` / `Rename`)
  - pending queue snapshot + restart restore/discard controls
  - directory conflict pre-check acceleration with limited concurrency
  - disconnect-aware queue pause and reconnect resume
  - non-blocking completion notice in transfer dock
  - retry failed tasks
  - persistent failed retry history per session
  - Retry Center for batch retry and history cleanup
  - Retry Center time-range + failure-reason filter and one-click retry for visible failed (active session)
- Remote file open/edit with duplicate-open protection and auto-upload on save
- Remote file auto-upload guard to prevent silent overwrite when remote file changed since last baseline
- Server health panel:
  - CPU, memory, disk, network, load, uptime
  - alert thresholds for CPU/memory/disk
  - detail view with trend samples, top CPU processes, and failed services
- Diagnostics logging:
  - runtime log file in app user-data directory
  - async queued writes with rotating archive retention (`termdock.log` + history files)
  - settings actions to open log folder and copy log path
  - one-click bug report bundle export (`.zip`)
  - bug report includes disconnect-report snapshot (`disconnect-reports.json`) when available
  - disconnect report capture for unexpected tab disconnect/error events
  - disconnect report JSON/CSV export and quick copy-latest from diagnostics panel
  - disconnect report filter view (scope/trigger/time/query) with visible-only export/clear
  - global error bar quick action to copy latest disconnect report

## Quick Start

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```

## Soak Test

```bash
pnpm run soak:transfer
```

Set SSH/SFTP target environment variables first. See `SOAK_TEST.md` for full setup.

## Release

Workflow: `.github/workflows/release.yml`

Stable release:

```bash
git tag v0.1.12
git push origin v0.1.12
```

Prerelease example:

```bash
git tag v0.1.13-test.1
git push origin v0.1.13-test.1
```

Tag rules:

- Tag without `-` (for example `v0.1.12`) => stable release
- Tag with `-` (for example `v0.1.13-test.1`) => prerelease

## Known Limitations

- Data is still JSON-based (SQLite migration pending)
- Persistent transfer history is local-only (no sync/export yet)
- Session/group exports currently exclude decrypted credentials/secrets
- Active runtime port forwards remain tab-scoped; event history now persists locally per session, but there is no cross-device sync workflow yet
- Dynamic forwarding currently supports SOCKS5 no-auth `CONNECT` baseline only
- Broader cross-platform smoke tests are still pending
- Installer signing/notarization strategy is not fully complete
- No in-app auto-update yet

## Near-Term Execution Focus

1. Cross-platform smoke checklist and reproducible reports (Windows/macOS)
2. Installer signing/notarization and installation verification
3. Recoverable global error UX follow-up (broader action coverage and contextual guidance)
4. Operation center follow-up for broader operation coverage and cancel controls

## Remaining Work (Not Done Yet)

1. `P0-F3`: complete and document cross-platform smoke test matrix on packaged builds
2. `P0-F4`: finalize signing/notarization and verify installer upgrade/uninstall paths
3. `P0-E3`: extend recoverable global error actions beyond current baseline coverage
4. `F8`: expand operation center baseline to cover more operation types and cancellation paths
5. `P0-F1` + `P0-F2`: establish unit/integration test baseline for regression safety
6. `P0-A3` + `F9` follow-up: SQLite migration and credential-safe encrypted backup/restore

## Candidate Features (Prioritized)

1. Advanced retry-center analytics and history export
2. Session templates and environment variable substitution
3. Operation center v2 (broader operation types, richer progress timeline, and action controls)
4. Encrypted session export/import with credential-safe payload
5. SSH jump-host chain builder (`ProxyJump`/bastion wizard)
6. Transfer bandwidth limiter and schedule window
7. Command snippets/playbooks v2 (parameter prompts, validation, scoped variables)
8. Session quick profiles v2 (multi-command chains, environment overrides)
9. Multi-host command broadcast with dry-run preview
10. Remote file snapshot and quick rollback for accidental edits
11. Session tags and smart saved views (by env/owner/risk)
12. Terminal session recording/replay with sanitized export
13. Dangerous-command guardrails (rule-based preflight confirmation)
14. One-way sync profiles for recurring upload/download folders
15. Connection quality timeline (latency/reconnect/throughput history)
16. Workspace profile mode (`dev` / `staging` / `prod`) with visual risk cues

## Exploration Ideas (Unprioritized)

- Operation audit timeline (who/when/where/what for command and transfer actions)
- Disconnect auto-diagnostic v2 (deeper network/process evidence + guided triage hints)
- Diff-first sync mode (preview changes and transfer only deltas)
- Session health checks with proactive risk badges
- Team session bundle (encrypted import/export with tags and templates)
- Temporary authorization mode (time-limited operation window for risky sessions)
- Environment policy templates (`dev` / `staging` / `prod`) for timeout/concurrency/alerts
- Crash dump + symbolized stack pipeline for faster root-cause analysis
- Release channel management (`stable` / `beta` / `canary`) with rollback guidance
- Accessibility and hotkey conflict checker
- Plugin extension hooks for ticketing/CMDB/alerts integrations
- Built-in command allowlist/denylist policy packs per workspace

## Project Structure

```txt
src/main      # Electron main process, IPC, storage
src/renderer  # React UI
src/shared    # Shared contracts and types
```

## Documentation

- `RELEASE_NOTES.md`: release notes
- `PROGRESS.md`: progress and readiness snapshot
- `TASKS.md`: execution tasks and status
- `PRD.md`: product requirements
- `SOAK_TEST.md`: long-duration transfer stress test guide
- `news.md`: product notes and directional summary
- `UI_COMPACT_RULES.md`: compact-density and fixed-height list-shell rules

## License

MIT


