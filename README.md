# TermDock

TermDock is a cross-platform desktop SSH + SFTP client for developers and operators.
It combines session management, multi-tab terminal, file transfer, diagnostics logging, and server health monitoring in one workspace.

## Current Status

- Current stable release: `v0.1.18` (2026-03-30)
- Current branch focus: post-`v0.1.18` validation cycle on `master`
- Current master addition: no unreleased notes yet after the `v0.1.18` transfer-governance release
- Current smoke baseline: embedded SSH/SFTP fixture-backed workspace and packaged verification
- Main targets: macOS and Windows 11
- Packaging: macOS (`arm64`, `x64`) and Windows (`nsis`, `zip`)

## UI Rules

- Compact UI and fixed-height list policy: `UI_COMPACT_RULES.md`

## Release in `v0.1.18` (2026-03-30)

- `Settings > SFTP` now supports per-direction transfer rate limits for upload and download workers.
- Queued upload/download work can now be restricted to selected weekdays plus a start/end time window.
- Transfer queues now pause outside the configured window and auto-resume when the next allowed window opens.
- Latest local workspace and packaged smoke runs remain green at `PASS 35 / FAIL 0 / SKIP 0`.

## Release in `v0.1.17` (2026-03-30)

- Uploads now run through a dedicated SFTP transfer channel with `fastPut`, so single-file throughput is better than the previous single-stream write path.
- Upload progress updates are throttled, which reduces renderer IPC overhead during larger transfers.
- Default upload threads now start at `4`, the max thread setting is `12`, and legacy saved transfer preferences are migrated forward automatically.
- Upload batches now prewarm remote directories in the background, and local folder expansion scans directories concurrently to reduce delay before many small files begin transferring.
- Latest local workspace and packaged smoke runs remain green at `PASS 35 / FAIL 0 / SKIP 0`.

## Release in `v0.1.16` (2026-03-30)

- GitHub Actions runtimes used by `Packaged Smoke` and `Release` were upgraded to current supported versions.
- The packaged smoke workflow now runs green without the previous `Node.js 20 actions are deprecated` warning path.
- Latest GitHub packaged smoke workflow after the upgrade: [run #23733492999](https://github.com/gongteng0215/TermDock/actions/runs/23733492999)

## Release in `v0.1.15` (2026-03-30)

- Remote-open/editor hardening now covers stricter Windows preferred-editor parsing, stale-draft reopen choice, temp-file cleanup on tab/app dispose, and explicit save-back conflict warnings.
- Port forwarding state is now tracked per tab, and Operation Center queue/port-forward summaries now reflect open-workspace totals instead of only the active tab.
- Server Health and Disconnect Reports now keep tab-scoped monitor state, invalidate stale async refreshes, and keep disconnect evidence tied to the correct tab.
- Smoke automation now verifies remote-open conflict/reload/cleanup, Windows preferred-opener launch validation, live port-forward baseline, and unexpected-fixture-shutdown disconnect-report capture.
- Latest local workspace smoke run remains green at `PASS 35 / FAIL 0 / SKIP 0`.

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
- Dangerous-command guardrails:
- `Settings > Safety` exposes built-in risky-command rules, per-source toggles, policy packs, environment templates, session-group overrides, temporary approval management, persistent approval policies, shared policy bundles with manual sync-file pull/push, and custom patterns
  - risky terminal writes now require bottom-bar approval before execution
  - guardrails cover keyboard Enter, clipboard paste, command history run/paste, snippets, quick profiles, and startup commands
  - approval bar now supports `Run Once`, `Allow In Tab`, and `Allow In Group` for exact-command temporary scopes
  - built-in safety rules can be reset from the Safety panel
- Session text normalization migration:
  - added startup normalization for known mojibake session/group/remark text patterns
  - create/update paths now normalize known corrupted text before persistence
- Added/expanded Electron smoke automation (`scripts/smoke-capture-all.mjs`):
  - covers sessions context menus, settings sections, command history workflows, retry/operation center
  - baseline local run at delivery: `PASS 21 / FAIL 0 / SKIP 0`
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
  - prompted parameters with required/default/regex validation
  - scoped remembered values (`per snippet` / `per group` / `per session` / `global`)
  - reusable prompt sets shared within a snippet group
  - preview-before-run flow and missing/unused parameter hints in the editor
- Pending transfer queue restore:
  - app restart can detect saved pending transfer queue snapshot
  - transfer dock provides one-click `Restore Pending` and `Discard Pending`
- Remote file auto-sync guard:
  - before save-back upload, compare remote metadata (exists/size/mtime) against baseline
  - skip unsafe auto-upload when remote changed unexpectedly and log guard event
  - show explicit UI warnings when save-back is blocked or upload-back fails
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
  - tracked app-job list for session import/export, snippet import/export, and bug-report export
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
- Session templates (`New Session From Template...`, `Save as Template...`, `Manage Session Templates...`) with template-scoped env var substitution
- Multi-tab xterm terminal with single-tab-per-session dedupe (opening an already-open session focuses existing tab)
- Terminal context menu and reconnect flow
- Recoverable global error bar with quick actions (`Reconnect`, `Open Logs`, `Diagnostics`, `Copy Error`, `Copy Latest Disconnect`)
- Dangerous-command guardrails with `Settings > Safety`, a fixed bottom approval bar, exact-command temporary approval scopes, persistent approval policies, per-source toggles, policy packs, environment templates, session-group overrides, optional workspace-profile sync, and shared bundle import/export/apply/sync-file pull/push for risky execution sources
- Workspace profile mode (`dev` / `staging` / `prod`) with persistent risk badges and optional global Safety pack/template sync
- Command History side panel + manager, including blank-area context menu actions (`Add` / `Import` / `Export` / `Manage`)
- Command snippets manager and grouped snippet execution (`Run Snippet`, `Snippet Manager`) with prompted variables, scoped remembered values, reusable prompt sets, and preview-before-run
- Operation Center modal with active transfer/delete/port-forward status, tracked session/snippet/diagnostics jobs, cross-tab activity summary, cancel-all actions, and bulk reconnect shortcuts
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
  - per-direction transfer rate limits (`Upload Limit` / `Download Limit`)
  - optional queued-transfer schedule window with weekday + time range controls
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
- Remote file open/edit with duplicate-open protection, stale-draft reopen choice, auto-upload on save, and temp-file cleanup on tab/app dispose
- Remote file auto-upload guard to prevent silent overwrite when remote file changed since last baseline
- Server health panel:
  - CPU, memory, disk, network, load, uptime
  - alert thresholds for CPU/memory/disk
  - detail view with trend samples, top CPU processes, and failed services
  - tab-scoped monitor state with request invalidation on reconnect/close
- Diagnostics logging:
  - runtime log file in app user-data directory
  - async queued writes with rotating archive retention (`termdock.log` + history files)
  - settings actions to open log folder and copy log path
  - one-click bug report bundle export (`.zip`)
  - bug report includes disconnect-report snapshot (`disconnect-reports.json`) when available
  - disconnect report capture for unexpected tab disconnect/error events
  - disconnect report capture now keeps per-tab monitor/loading/error context instead of the active-tab snapshot only
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

## UI Smoke Test

```bash
pnpm run smoke:ui
```

The default smoke run boots an embedded local SSH/SFTP fixture, so auth/connect, baseline SFTP transfer coverage, remote-open-file conflict/reload/cleanup coverage, Windows preferred-opener parser coverage, live port-forward creation, and disconnect-report auto-capture validation do not require an external host.

Use `PACKAGED_SMOKE.md` for packaged executable runs, output artifacts, and the Windows/macOS validation matrix.

Packaged wrapper:

```bash
pnpm run smoke:ui:packaged
```

This wrapper now runs `pnpm run pack` first so the packaged smoke flow does not reuse stale `release/*` output.

Latest local workspace smoke run: `PASS 35 / FAIL 0 / SKIP 0`

## Release

Workflow: `.github/workflows/release.yml`

Runbook: `RELEASE_SIGNING.md`

Secret bootstrap helper: `pnpm run release:set-secrets -- --repo=<owner/name> --dry-run ...`

Self-use Windows helper:

```powershell
pnpm run release:self-use:cert:win
pnpm run release:self-use:win
```

Stable release:

```bash
git tag v0.1.18
git push origin v0.1.18
```

Prerelease example:

```bash
git tag v0.1.19-test.1
git push origin v0.1.19-test.1
```

Tag rules:

- Tag without `-` (for example `v0.1.18`) => stable release
- Tag with `-` (for example `v0.1.19-test.1`) => prerelease

## Known Limitations

- Data is still JSON-based (SQLite migration pending)
- Persistent transfer history is local-only (no sync/export yet)
- Session/group exports currently exclude decrypted credentials/secrets
- Active runtime port forwards remain tab-scoped; event history now persists locally per session, but there is no cross-device sync workflow yet
- Dynamic forwarding currently supports SOCKS5 no-auth `CONNECT` baseline only
- Cross-platform packaged smoke baseline is in place, but macOS release evidence and targeted external-host validation are still pending
- Release signing/notarization preflight and verification baseline now exists, and self-use Windows release is available locally, but CI secret provisioning and first public-trust signed/notarized evidence are still pending
- No in-app auto-update yet

## Near-Term Execution Focus

1. Finish macOS/external-host packaged smoke evidence using `PACKAGED_SMOKE.md`
2. Provision release signing secrets and capture first signed/notarized evidence using `RELEASE_SIGNING.md`
3. Recoverable global error UX follow-up (broader action coverage and contextual guidance)
4. Operation center follow-up for richer progress timeline and grouped cancel/retry controls

## Remaining Work (Not Done Yet)

1. `P0-F3`: finish the remaining macOS/external-host packaged smoke evidence on top of the current automated matrix
2. `P0-F4`: finish secret provisioning and capture first signed/notarized installer evidence on top of the current preflight/verify baseline
3. `P0-E3`: extend recoverable global error actions beyond current baseline coverage
4. `F8`: extend Operation Center beyond the current tracked jobs with richer timeline and cancellation controls
5. `P0-F1` + `P0-F2`: establish unit/integration test baseline for regression safety
6. `P0-A3` + `F9` follow-up: SQLite migration and credential-safe encrypted backup/restore

## Candidate Features (Prioritized)

Current next-wave emphasis: operation center timeline/control follow-up, session templates v2, and dangerous-command/workspace follow-up. Additional ideas are listed below.

1. Advanced retry-center analytics and history export
2. Session templates v2 (runtime prompts, import/export, layered presets)
3. Operation center v2 (richer progress timeline, grouped controls, and broader cancel/retry actions)
4. Encrypted session export/import with credential-safe payload
5. SSH jump-host chain builder (`ProxyJump`/bastion wizard)
6. Transfer policy packs and richer schedule automation
7. Command snippets/playbooks v2 follow-up (richer playbook workflows and validation packs)
8. Session quick profiles v2 (multi-command chains, environment overrides)
9. Multi-host command broadcast with dry-run preview
10. Remote file snapshot and quick rollback for accidental edits
11. Session tags and smart saved views (by env/owner/risk)
12. Terminal session recording/replay with sanitized export
13. Dangerous-command follow-up (workspace-scoped defaults and richer team distribution)
14. One-way sync profiles for recurring upload/download folders
15. Connection quality timeline (latency/reconnect/throughput history)
16. Workspace profile follow-up (broader auto-switching and shared-profile workflows)
17. Command palette / universal action launcher
18. Remote file diff-first preview before overwrite/save-back
19. Session health checks with proactive risk badges
20. Operation audit timeline (command and transfer traceability)
21. Session notes / runbook annotations
22. Split-pane terminal layouts for side-by-side command work
23. Detach/clone current tab into a new window or pane
24. Recent directories / quick `cd` launcher with per-host history
25. Shell integration for command history, cwd tracking, and automatic profile switching
26. Shared encrypted team vault / workspace sync for hosts, snippets, and port-forward presets

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
- `RELEASE_SIGNING.md`: release signing/notarization and installer verification runbook
- `PROGRESS.md`: progress and readiness snapshot
- `TASKS.md`: execution tasks and status
- `PRD.md`: product requirements
- `PACKAGED_SMOKE.md`: packaged smoke runbook and report matrix
- `SOAK_TEST.md`: long-duration transfer stress test guide
- `news.md`: product notes and directional summary
- `UI_COMPACT_RULES.md`: compact-density and fixed-height list-shell rules

## License

MIT


