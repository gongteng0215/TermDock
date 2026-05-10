# TermDock

TermDock is a cross-platform desktop SSH + SFTP client for developers and operators.
It combines session management, multi-tab terminal, file transfer, diagnostics logging, and server health monitoring in one workspace.

## Current Status

- Current stable release: `v0.1.22` (2026-04-12)
- Current active branch: `feature/editor-workbench-ui`
- Current branch focus: editor-workbench UI refresh plus self-use hardening follow-up
- Current stable release includes alternate-screen editor focus mode with selectable `Midnight` / `Graphite` / `Paper` themes in `Settings > Workspace`
- Current stable release also includes `Compact` / `Balanced` / `Reading` typography presets, `System Mono` / `Coding Mono` / `Drafting Mono` font presets, `Crisp` / `Steady` / `Open` text-rhythm presets, `Beam` / `Underline` / `Block` cursor presets, and inactive-tab compaction for editor-only focus mode
- Current master addition: recoverable global error UX now also routes hotkey and port-forward failures into `Hotkeys` / `Port Fwd`, and transfer-style failures can jump straight into `Retry Center` in addition to the existing settings, `Operation Center`, and bug-report actions
- Current branch addition: the main renderer now reads as a code-editor-style workbench with a flatter shell, left Explorer rail, right Inspector rail, stronger terminal stage, bottom transfer panel, aligned modal chrome, SFTP `Compact` / `Details` view persistence, collapsible command history, and narrow-width inspector tabs
- Current branch refactor: large `App.tsx` UI regions were split into focused renderer modules for workbench modals, settings sections, command snippets, UI preferences, and workbench/terminal CSS
- Current branch hardening: recoverable global error routing now also points Safety bundle/guardrail, Workspace profile, Monitor/server-health, and Diagnostics-specific failures at their matching settings sections, with Safety sync failures covered by smoke automation
- Current branch Operation Center follow-up: added a unified activity timeline plus grouped controls for transfer, active-tab, and tools workflows
- Current branch multilingual baseline: `Settings > Workspace` now has a persisted interface-language selector with English and Simplified Chinese, covering the settings shell, Workspace controls, topbar, transfer dock, Operation Center, and Retry Center
- Latest branch validation on 2026-05-10: `pnpm run typecheck`, `pnpm run build`, and `pnpm run smoke:ui` passed; latest workspace smoke artifact is `artifacts/smoke/2026-05-10T07-36-38-904Z/summary.json` (`PASS 46 / FAIL 0 / SKIP 0`)
- Latest post-refactor validation on 2026-05-09: `pnpm run typecheck`, `pnpm run build`, `pnpm run smoke:ui`, and `pnpm run smoke:ui:packaged` all passed; latest workspace smoke artifact is `artifacts/smoke/2026-05-09T13-35-51-500Z/summary.json`, and latest packaged smoke artifact is `artifacts/smoke/2026-05-09T13-44-46-628Z/summary.json`
- Current smoke baseline: embedded SSH/SFTP fixture-backed workspace and packaged verification
- Main targets: macOS and Windows 11
- Packaging: macOS (`arm64`, `x64`) and Windows (`nsis`, `zip`)

## UI Rules

- Compact UI and fixed-height list policy: `UI_COMPACT_RULES.md`

## Release in `v0.1.22` (2026-04-12)

- Global error recovery bar now routes hotkey/port-forward failures into `Hotkeys` / `Port Fwd`, and transfer failures can jump straight into `Retry Center` when history exists.
- Error bar long messages now wrap instead of forcing horizontal scrolling.
- SFTP create-directory failures now treat "already exists" as success and provide clearer permission/path guidance when creation truly fails.
- Smoke automation now verifies the hotkey error recovery route in both workspace and packaged runs.

## Release in `v0.1.21` (2026-04-02)

- Alternate-screen terminal editors now trigger a focused layout that collapses side panels and tightens terminal chrome while full-screen TUI editors are active.
- `Settings > Workspace` now includes an explicit auto-focus toggle for that layout behavior.
- `Settings > Workspace` now also includes `Midnight`, `Graphite`, and `Paper` editor-theme presets that restyle the focused terminal canvas and xterm palette without rewriting TUI content.
- `Settings > Workspace` now also includes `Compact`, `Balanced`, and `Reading` typography presets, `System Mono`, `Coding Mono`, and `Drafting Mono` font presets, `Crisp`, `Steady`, and `Open` text-rhythm presets, plus `Beam`, `Underline`, and `Block` editor-cursor presets.
- Multi-tab editor focus mode now compresses inactive tabs into smaller navigation pills so the active editor tab keeps most of the top-bar emphasis.
- Smoke automation now verifies editor focus mode enter/exit, theme selection, typography selection, font preset selection, text-rhythm selection, cursor preset selection, inactive-tab compaction, and the disabled-toggle path in both workspace and packaged runs.
- Latest local workspace and packaged smoke runs remain green at `PASS 45 / FAIL 0 / SKIP 0`.

## Release in `v0.1.19` (2026-03-31)

- Batch SFTP uploads now invalidate only the affected remote-directory branch when a first write hits a transient `No such file` path race, then retry automatically.
- SSH SFTP channel-open backpressure now triggers automatic requeue/backoff plus adaptive per-tab upload concurrency reduction instead of failing the whole batch immediately.
- `Settings > SFTP` now adds one-click schedule presets on top of the custom weekday/time editor.
- Transfer policy pack sync-file links now support optional `auto-pull` on launch and `auto-push` on local catalog changes.
- Automated smoke runs now use isolated per-run `userData` profiles so saved local settings do not leak between workspace and packaged passes.
- Latest local workspace and packaged smoke runs remain green at `PASS 36 / FAIL 0 / SKIP 0`.

## Release in `v0.1.18` (2026-03-30)

- `Settings > SFTP` now supports per-direction transfer rate limits for upload and download workers.
- Queued upload/download work can now be restricted to selected weekdays plus a start/end time window.
- Transfer queues now pause outside the configured window and auto-resume when the next allowed window opens.
- Latest local workspace and packaged smoke runs remain green at `PASS 36 / FAIL 0 / SKIP 0`.

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
- high-frequency error types now route directly to `Connection Settings`, `Workspace`, `Safety`, `File Opening`, `Hotkeys`, `Monitor`, `SFTP Settings`, `Port Fwd`, `Retry Center`, `Operation Center`, `Diagnostics`, or `Export Bug Report` when that recovery path is more specific than plain diagnostics
- Operation center baseline:
  - new `Operation Center` modal for active long-running operations
  - consolidated status for upload/download queues, remote delete, and port-forward busy state
  - unified activity timeline for recent transfer, delete, port-forward, and tracked app-job events
  - grouped controls for transfer-wide, active-tab, and tool/navigation actions
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
- Alternate-screen editor focus mode that can be enabled or disabled from `Settings > Workspace`, automatically collapsing side panels and tightening terminal chrome while full-screen terminal editors are active
- Editor focus theme presets (`Midnight`, `Graphite`, `Paper`) that restyle the focused terminal canvas and xterm palette without rewriting terminal editor content
- Editor focus typography presets (`Compact`, `Balanced`, `Reading`) that adjust editor-mode font size and row height without changing regular shell density
- Editor focus font presets (`System Mono`, `Coding Mono`, `Drafting Mono`) that swap the editor-only xterm mono stack without changing the regular shell font
- Editor focus text-rhythm presets (`Crisp`, `Steady`, `Open`) that adjust editor-only xterm letter spacing and font weight without changing the regular shell renderer
- Editor focus cursor presets (`Beam`, `Underline`, `Block`) that switch editor-only xterm cursor shape without affecting the normal shell cursor
- Editor focus multi-tab compaction that compresses inactive tabs into smaller pills while the active editor tab remains full-width
- Terminal context menu and reconnect flow
- Recoverable global error bar with quick actions (`Reconnect`, `Open Logs`, `Diagnostics`, `Copy Error`, `Copy Latest Disconnect`) plus contextual routing into `Connection Settings`, `File Opening`, `Hotkeys`, `SFTP Settings`, `Port Fwd`, `Retry Center`, `Operation Center`, or `Export Bug Report` for high-frequency recovery paths
- Dangerous-command guardrails with `Settings > Safety`, a fixed bottom approval bar, exact-command temporary approval scopes, persistent approval policies, per-source toggles, policy packs, environment templates, session-group overrides, optional workspace-profile sync, and shared bundle import/export/apply/sync-file pull/push for risky execution sources
- Workspace profile mode (`dev` / `staging` / `prod`) with persistent risk badges and optional global Safety pack/template sync
- Command History side panel + manager, including blank-area context menu actions (`Add` / `Import` / `Export` / `Manage`)
- Command snippets manager and grouped snippet execution (`Run Snippet`, `Snippet Manager`) with prompted variables, scoped remembered values, reusable prompt sets, and preview-before-run
- Operation Center modal with active transfer/delete/port-forward status, grouped controls, unified activity timeline, tracked session/snippet/diagnostics jobs, cross-tab activity summary, cancel-all actions, and bulk reconnect shortcuts
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
  - one-click schedule presets (`Always On` / `Business Hours` / `Weeknights` / `Weekends`)
  - next queued-transfer resume preview when the window is currently closed
  - reusable transfer policy packs with local save/apply/import/export plus linked sync-file pull/push and optional auto-pull/auto-push
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

The default smoke run boots an embedded local SSH/SFTP fixture, so auth/connect, alternate-screen editor focus mode coverage, workspace toggle coverage, editor-theme coverage, editor-typography coverage, editor-font coverage, editor-rhythm coverage, editor-cursor coverage, multi-tab compaction coverage, baseline SFTP transfer coverage, remote-open-file conflict/reload/cleanup coverage, Windows preferred-opener parser coverage, live port-forward creation, and disconnect-report auto-capture validation do not require an external host.

Use `PACKAGED_SMOKE.md` for packaged executable runs, output artifacts, and the Windows/macOS validation matrix.

Packaged wrapper:

```bash
pnpm run smoke:ui:packaged
```

This wrapper now runs `pnpm run pack` first so the packaged smoke flow does not reuse stale `release/*` output.

Latest full local workspace smoke artifact for the UI refresh: `PASS 45 / FAIL 0 / SKIP 0`

Latest post-refactor checks after the renderer module split: `pnpm run typecheck`, `pnpm run build`, and `pnpm run smoke:ui` passed. Latest workspace smoke artifact: `artifacts/smoke/2026-05-09T13-35-51-500Z/summary.json` (`PASS 45 / FAIL 0 / SKIP 0`).

Latest packaged smoke after the Settings footer polish: `pnpm run smoke:ui:packaged` passed. Latest packaged smoke artifact: `artifacts/smoke/2026-05-09T13-44-46-628Z/summary.json` (`PASS 45 / FAIL 0 / SKIP 0`).

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
git tag v0.1.22
git push origin v0.1.22
```

Prerelease example:

```bash
git tag v0.1.23-test.1
git push origin v0.1.23-test.1
```

Tag rules:

- Tag without `-` (for example `v0.1.22`) => stable release
- Tag with `-` (for example `v0.1.23-test.1`) => prerelease

## Known Limitations

- Data is still JSON-based (SQLite migration pending)
- Persistent transfer history is local-only (no sync/export yet)
- Session/group exports currently exclude decrypted credentials/secrets
- Active runtime port forwards remain tab-scoped; event history now persists locally per session, but there is no cross-device sync workflow yet
- Dynamic forwarding currently supports SOCKS5 no-auth `CONNECT` baseline only
- Cross-platform packaged smoke baseline is in place, but the remaining macOS release evidence and targeted external-host validation are currently low priority for this self-use workflow
- Release signing/notarization preflight and verification baseline now exists, and self-use Windows release is available locally, but public-trust signed/notarized evidence is currently low priority for this self-use workflow
- No in-app auto-update yet

## Near-Term Execution Focus

1. Push or PR `feature/editor-workbench-ui` with current workspace and packaged smoke evidence
2. Review any feedback from real usage of the refreshed workbench shell
3. Continue the self-use hardening backlog: recoverable global error coverage, Operation Center broader control coverage, persistence hardening, and startup/large-transfer performance
4. Keep signing/notarization and broader release/test evidence in the low-priority self-use backlog

## Remaining Work (Not Done Yet)

1. Optional workbench polish after real usage feedback
2. Remaining macOS/external-host packaged evidence for broader release confidence
3. `P0-E3`: extend recoverable global error actions beyond current baseline coverage
4. `F8`: extend Operation Center beyond the current grouped controls with broader cancel/retry coverage
5. `P0-A3` + `F9` follow-up: SQLite migration and credential-safe encrypted backup/restore
6. `P0-E1` + `P0-E2`: startup and large-transfer performance follow-up
7. `P0-F3`: remaining macOS/external-host packaged validation, now low priority for self-use
8. `P0-F4`: public-trust signing/notarization evidence, now low priority for self-use
9. `P0-F1` + `P0-F2`: unit/integration test baseline, now low priority for self-use

## Candidate Features (Prioritized)

Current next-wave emphasis after the editor-workbench branch is verified: operation center control-coverage follow-up, session templates v2, and dangerous-command/workspace follow-up. Additional ideas are listed below.

1. Advanced retry-center analytics and history export
2. Session templates v2 (runtime prompts, import/export, layered presets)
3. Operation center v2 (richer progress timeline, grouped controls, and broader cancel/retry actions)
4. Encrypted session export/import with credential-safe payload
5. SSH jump-host chain builder (`ProxyJump`/bastion wizard)
6. Richer transfer schedule automation and transfer-pack distribution follow-up
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
- `docs/superpowers/specs/2026-05-01-termdock-editor-workbench-design.md`: editor-workbench UI design spec
- `docs/superpowers/plans/2026-05-01-editor-workbench-ui.md`: editor-workbench UI implementation plan and verification tracker

## License

MIT
