# TermDock Progress

Last updated: 2026-03-20

## Snapshot

- Stable release shipped: `v0.1.14`
- Packaged smoke automation/report baseline with embedded SSH/SFTP fixture landed on `master`
- Master branch includes post-`v0.1.9` hardening plus transfer safety, diagnostics, and port forwarding baseline updates
- Master branch now also includes dangerous-command guardrails baseline with `Settings > Safety` and a fixed bottom approval bar
- Master branch now also includes session templates baseline with template-scoped env var substitution
- Master branch now also includes command snippets/playbooks v2 baseline with prompted variables, scoped remembered values, reusable prompt sets, and preview-before-run
- Master branch now also includes dangerous-command approval scopes, persistent approval policies, shared policy-bundle import/export/apply, manual sync-file pull/push, and workspace-profile mode with optional Safety sync
- Master branch now also includes Operation Center tracked app jobs for session/snippet import-export plus bug-report export
- Milestone status:
  - `M0` (technical validation): complete
  - `M1` (MVP hardening): in progress
- P0 totals:
  - `DONE`: 13
  - `PARTIAL`: 14
  - `TODO`: 6

## Release Readiness

- Current quality: suitable for early production and power users
- Not fully GA-hardened yet
- Minimum gates before broad rollout:
  - `P0-F3`: cross-platform smoke tests
  - `P0-F4`: installer signing/notarization and install validation
  - `P0-E3`: recoverable global error UX follow-up

## Completed in v0.1.14

- Command snippets/playbooks v2 baseline with prompted variables, scoped remembered values, reusable prompt sets, and preview-before-run
- Dangerous-command guardrails follow-up with policy packs, environment templates, per-source toggles, session-group overrides, exact-command approval scopes, persistent approval policies, shared bundles, and workspace-profile sync
- Workspace profile mode (`dev` / `staging` / `prod`) with persistent risk cues and optional global Safety pack/template sync
- Operation Center tracked app jobs for session/snippet import-export plus bug-report export

## Completed in v0.1.13

- Packaged smoke automation/report baseline with embedded SSH/SFTP fixture and packaged validation workflow
- Release preflight/verify tooling plus self-use Windows release helper path
- Session templates baseline with template-scoped env vars and create/apply/manage flows

## Completed in v0.1.12

- Session list double-click now forces a new tab for the same session instead of focusing the existing tab

## Current master additions

- Dangerous-command policy-pack baseline:
  - `Settings > Safety` now exposes `Balanced`, `Operations`, and `Strict` policy packs
  - environment templates now layer `Development`, `Staging`, and `Production` presets on top of the selected ruleset
  - source-specific guard toggles let keyboard, clipboard, history, snippet, startup-command, and quick-profile flows be enabled independently
  - session-group overrides can pin pack/template combinations per named session group
  - bottom approval bar now supports exact-command temporary scopes for the current tab or current session group
  - bottom approval bar can now also save persistent exact-command approval policies for future matches
  - shared policy bundles can capture, import, export, apply, and manually sync complete safety configurations through a shared JSON file
  - workspace profile mode now adds `dev` / `staging` / `prod` risk cues plus optional global Safety pack/template sync
  - active supplemental rules are visible directly inside the safety settings panel
- Command snippets/playbooks v2 baseline:
  - snippet editor now supports named parameters with required/default/regex validation rules
  - parameterized snippets prompt for values, preview the resolved command, and warn on missing/unused parameter tokens
  - variables can now remember last used values by snippet/group/session/global scope
  - reusable prompt sets can now be shared across snippets inside the same group
- `scripts/smoke-capture-all.mjs` now:
  - supports packaged executable launch via `TERMDOCK_SMOKE_EXECUTABLE`
  - writes `summary.json` and `full-test-matrix.md` automatically
  - validates keyboard-open dedupe and explicit double-click new-tab behavior
- Added `.github/workflows/packaged-smoke.yml`:
  - runs packaged smoke on GitHub Actions Windows/macOS runners
  - uploads smoke artifacts for release validation
- Added `PACKAGED_SMOKE.md` for Windows/macOS packaged validation workflow and evidence collection
- Added embedded smoke SSH/SFTP fixture baseline:
  - local auth/connect + shell flow is exercised without an external host
  - SFTP list/upload/download/delete is exercised against a temporary remote filesystem
- Added dangerous-command guardrails baseline:
  - `Settings > Safety` exposes built-in risky-command rules and custom patterns
  - a fixed bottom approval bar blocks risky writes until a one-time run is approved
  - guardrails cover keyboard Enter, clipboard paste, command history run/paste, snippets, quick profiles, and startup commands
- Packaged smoke now covers embedded live SSH connect, embedded live SFTP upload/download/delete, the `Settings > Workspace` + `Settings > Safety` sections, built-in rule reset flow, and approval-bar UI baseline
- `pnpm run pack` is now smoke-friendly on local Windows shells by skipping native rebuilds and `winCodeSign` resource-edit extraction, so `pnpm run smoke:ui:packaged` runs on this machine
- `pnpm run smoke:ui:packaged` now rebuilds the packaged directory first, so local packaged smoke does not accidentally reuse stale `release/*` output
- Latest local workspace and packaged smoke runs: `PASS 30 / FAIL 0 / SKIP 0`
- Added release signing/notarization preflight baseline:
  - `scripts/release-preflight.mjs` validates required Windows signing and macOS signing/notarization inputs before release build
  - macOS hardened runtime entitlements are now checked in-repo via `build/entitlements.mac.plist` and `build/entitlements.mac.inherit.plist`
- Added release artifact verification baseline:
  - `scripts/verify-release-artifacts.mjs` verifies artifact presence plus signature/notarization expectations per platform
  - Windows release verification now includes silent NSIS install/uninstall smoke
  - release verification reports are written to `artifacts/release-verify/<timestamp>`
- Added release secret bootstrap/materialization helpers:
  - `scripts/prepare-release-secrets.mjs` materializes `APPLE_API_KEY_B64` into a temporary `.p8` path for CI
  - `scripts/set-release-secrets.mjs` can seed GitHub repo secrets from local cert/key files via `gh`
- Added self-use Windows release path:
  - `scripts/create-self-use-windows-cert.ps1` creates/reuses a local self-signed code-signing certificate and exports `.pfx` / `.cer` / password files
  - `scripts/build-self-use-windows-release.mjs` signs `win-unpacked` + top-level installer and verifies signature presence plus silent install/uninstall
- Added session templates + env vars baseline:
  - local session-template store persists template definitions and template-scoped env var values
  - create/edit session modal now supports `Apply Template...`, `Save as Template...`, and `Manage Templates...`
  - sessions context menu now supports `New Session From Template...` and `Save as Session Template...`
  - template application resolves `${ENV_NAME}` placeholders into concrete session form values before save/test
- Updated `.github/workflows/release.yml`:
  - runs release preflight before each platform build
  - runs signed/notarized artifact verification before publish
  - uploads `artifacts/release-verify/**` for release evidence
- Latest local Windows installer smoke run: `PASS artifact presence + silent install + silent uninstall`
- Latest local self-use Windows release run: `PASS signature present on installer/unpacked exe + silent install + silent uninstall`

## Completed in v0.1.11
- Port forwarding presets with optional auto-restore
- Runtime status/failure visibility (`Active` / `Degraded`, counters, last error/activity)
- Recent forwarding events and snapshot export
- Session-scoped persisted forwarding event history with filter and clear actions
- SSH config parser hardening (`Include`, wildcard/negation merge)
- Diagnostics bug-report export workflow

## Completed in v0.1.9

- Added protection to block raw wheel mouse-report sequences while mouse tracking is active
- Eliminated `%6`/`%9`-style garbage text artifacts caused by wheel input in full-screen editor modes

## Completed on master for v0.1.11

- Session tab dedupe hardening:
  - opening an already-open session now focuses existing tab
  - repeated double-open no longer creates duplicate tabs
  - close-then-reopen path remains valid
- Command history side-panel context-menu polish:
  - blank-area right-click now exposes `Add` / `Import` / `Export` / `Manage`
  - row-level right-click actions remain `Run` / `Copy` / `Delete`
- Session persistence text normalization:
  - startup read path now repairs known mojibake patterns in `name` / `groupId` / `remark`
  - create/update persistence path now applies the same normalization
- Expanded UI smoke automation:
  - `scripts/smoke-capture-all.mjs` now covers sessions/menu/settings/snippet-manager/command-history/retry/operation flows plus embedded live SSH/SFTP verification
  - latest local run result: `PASS 30 / FAIL 0 / SKIP 0`
- Added compact UI governance baseline and fixed-height list policy:
  - created `UI_COMPACT_RULES.md` as mandatory UI rule reference
  - applied compact density + fixed list-shell heights across main panels/modals
  - list surfaces now use internal scrolling instead of content-driven expansion
- Added session export actions in Sessions context menu:
  - `Export All Sessions...` outputs JSON with full session rows plus group metadata
  - `Export All Groups...` outputs JSON with each group and contained session list
  - save dialog path export (clipboard fallback when save bridge is unavailable)
- Added session JSON import wizard:
  - import file picker + candidate parser preview
  - group strategy (`keepSource` / `forceCurrent` / `ungrouped`)
  - duplicate strategy (`skip` / `overwrite` / `rename`)
- Added session quick profiles baseline:
  - run/save/manage quick startup-command profiles from Sessions context menu
  - open/focus session and execute selected startup command profile
- Added command snippet groups baseline:
  - grouped snippet manager with run/add/import/export/clear flows
  - snippet template placeholders for clipboard/date/time/session/tab metadata
- Added transfer conflict pre-check acceleration:
  - local/remote directory conflict scans now run with limited concurrency
  - improves queueing latency for larger folder batches
- Added disconnect-aware transfer queue pause/resume UX:
  - queue marks paused when tab disconnects
  - queued jobs resume after reconnect instead of immediate mass-failure
- Replaced intrusive transfer completion modal on success path:
  - completion now shown as lightweight transfer-dock notice
  - batch failure details remain in diagnostics logs for triage
- Hardened diagnostics logging throughput:
  - main-process logger now uses async write queue
  - rotation retention expanded to multiple archive files
- Added monitor polling in-flight guards per tab to reduce overload during high transfer activity
- Skip silent server monitor polling while uploads/downloads are running on the same tab
- Added deferred and font-ready terminal refit flow to stabilize small-window rendering in packaged builds
- Added reusable transfer soak-test harness (`scripts/soak-transfer.mjs`) and execution guide (`SOAK_TEST.md`)
- Added transfer conflict policy for upload/download queueing (`Overwrite` / `Skip` / `Rename`)
- Added `Retry Failed` actions for upload/download transfer panels
- Added diagnostics logging baseline:
  - main process file logger with rotation (`userData/logs/termdock.log`)
  - renderer global `error` and `unhandledrejection` capture
  - settings panel actions to refresh/open/copy log paths
- Added one-click bug report export from `Settings > Diagnostics`:
  - writes `.zip` bundle with logs + runtime metadata + safe settings snapshot
  - copies export path for fast support handoff
- Added persistent failed-transfer retry baseline:
  - terminal-status transfer history now persists in local storage
  - `Retry Failed` includes persisted failures for the active session after restart
- Added transfer retry center view:
  - modal with scope/direction/status/search filters
  - batch select + retry selected failed + delete selected/visible/all
  - added time-range filter and persisted retry-center filter view
  - added failure-reason filter, quick retry by top failure reason (active session, scope strategy aware), and visible delete by reason
  - added grouped-by-failure list mode with collapsible sections (`Flat` / `Grouped by Failure`)
  - grouped view now supports group-level select/retry/delete/export actions
  - group-level JSON/CSV export now supports scope selection (`All` / `Failed` / `Retryable Active Session`)
  - grouped retry action now supports scope selection (`All Retryable` / `Upload Only` / `Download Only`)
  - `Retry Visible Failed` now supports scope selection (`All Retryable` / `Upload Only` / `Download Only`)
  - `Retry Selected Failed` now supports scope selection (`All Retryable` / `Upload Only` / `Download Only`)
  - added one-click `Retry All Failed` (upload + download) in transfer dock, retry center, and operation center (scope strategy aware)
  - Retry Center action bar now includes direction-specific quick actions (`Retry Failed Uploads` / `Retry Failed Downloads`)
  - added large-batch retry confirmation guardrail with configurable threshold (`Retry Confirm Threshold`, default: `100`, set `0` to disable)
  - `Settings > SFTP` now also exposes `Retry Confirm Threshold` for global adjustment
  - retry-scope chooser now remembers and prioritizes last used scope (`Last Used`) across restart
  - added `Default Retry Scope` selector (all/upload/download) for manual retry-strategy preselection
  - added `Auto Retry Scope` toggle to skip scope chooser and use last scope directly when possible
- Added pending transfer queue restore controls:
  - queued/running transfer intent snapshot persists for restart recovery
  - transfer dock now supports one-click `Restore Pending` and `Discard Pending`
- Added retry-center analytics and export package:
  - top failure reason aggregation for visible failed history
  - top failure reason suggestion rows for faster operator action
  - analytics snapshot export (`JSON` / `CSV`)
  - history export stats now include top sessions/groups/failure reasons
- Added remote file auto-sync guard baseline:
  - save-back checks remote metadata baseline (`exists` / `size` / `mtime`) before upload
  - skips unsafe auto-upload when remote changed unexpectedly and records guard log
- Added recoverable global error UX baseline (`P0-E3`):
  - global error bar now includes quick actions (`Reconnect`, `Open Logs`, `Diagnostics`, `Copy Error`)
  - connection/bridge related errors now include contextual recovery hints
- Added disconnect auto-diagnostic baseline (`F22` follow-up):
  - unexpected terminal tab `closed/error` events now auto-capture runtime context snapshots
  - `Settings > Diagnostics` now includes disconnect report list with JSON/CSV export, copy-latest, and clear actions
  - added auto-capture toggle in diagnostics for quick enable/disable
  - added report filters (`scope` / `trigger` / `time range` / `search`) and visible-only export/clear
- Improved diagnostics handoff:
  - `Export Bug Report` now includes disconnect report snapshot (`disconnect-reports.json`) when captured
- Improved recoverable global error UX follow-up:
  - global error bar now also supports `Copy Latest Disconnect` when report history exists
- Added operation center baseline (`F8`):
  - new modal to consolidate active long-running operations
  - includes queue state for uploads/downloads, remote delete status, and port-forward busy state
  - provides quick actions for cancel-all transfer queues and diagnostics navigation
  - adds cross-tab transfer activity summary with one-click tab focus
  - adds per-tab and cross-tab one-click transfer cancellation actions
  - adds per-tab and bulk reconnect actions for disconnected transfer tabs
  - now also tracks recent session import/export, snippet import/export, and bug-report export jobs
- Added hotkey conflict checker baseline (`F30` partial):
  - `Settings > Hotkeys` now highlights conflicting enabled shortcut bindings
  - conflicting actions are marked inline in each hotkey row for faster correction
  - one-click `Auto Resolve Conflicts` keeps first action by priority and disables duplicates
  - added hotkey JSON backup/restore actions (`Import Hotkeys...` / `Export Hotkeys...`)
  - hotkey import now shows action-level before/after diff preview in confirm dialog
  - hotkey import now reports imported conflict count and provides `Import + Auto Resolve` option
  - import preview now includes explicit auto-resolve disable-impact list
  - hotkey conflict panel now supports one-click row navigation (`Locate`, `Focus First Conflict`)
  - hotkey conflict panel now supports `Prev` / `Next` navigation with active conflict position indicator
  - hotkey conflict navigation now also supports keyboard shortcuts (`Alt + [` / `Alt + ]`)
  - hotkey conflict cursor now persists locally by conflict signature and restores on reopen
- Added SSH config import baseline:
  - parser for common `Host` directives (`HostName`, `User`, `Port`, `IdentityFile`)
  - sessions context-menu import flow with preview and duplicate strategy (`skip`/`overwrite`/`rename`)
- Added SSH config parser hardening:
  - recursive `Include` expansion (supports glob include paths)
  - `Host` wildcard/negation matching with order-aware option merge (SSH first-match semantics)
- Added port forwarding baseline:
  - `Settings > Port Fwd` panel for active tab
  - Local / Remote / Dynamic (`SOCKS5`) create, list, remove
  - automatic cleanup when the owning tab disconnects or closes
- Added saved port forwarding presets:
  - presets persist locally per session
  - one-click apply from `Settings > Port Fwd`
  - optional auto-restore when the owning session tab connects
- Improved port forwarding runtime status/failure UX:
  - per-forward status badge (`Active` / `Degraded`)
  - per-forward connection/failed counters
  - last activity and last failure reason display
  - periodic auto-refresh in port forwarding settings view
- Added port forwarding event timeline and snapshot export:
  - recent create/remove/degraded/recovered events in settings
  - one-click snapshot export to clipboard for diagnostics handoff
- Added persisted port forwarding event history (session scope):
  - event history now survives app restart
  - settings panel now supports event filtering and clear actions
  - event history merges live diagnostics with local persisted entries per session
- Added port-forward event analytics polish (`F5+`):
  - visible-event analytics cards (error ratio, type breakdown, top error codes/correlations)
  - one-click analytics export (`JSON` / `CSV`)
  - visible-event export metadata now includes aggregated analytics fields
- Fixed settings panel footer overlap on shorter window heights

## Previously Completed (v0.1.8 / v0.1.7 / v0.1.6)

- Refined wheel-input forwarding to reduce extra blank-line/jump effects during editor scrolling
- Added mode-aware wheel mapping for `application cursor keys` and mouse-tracking compatibility
- Added accumulated wheel-delta handling to avoid over-stepping lines

- Terminal mouse wheel scrolling now works in alternate-buffer editors (`nano`, `vim`)
- Added terminal wheel listener cleanup on tab close/unmount to avoid stale handlers

## Previously Completed (v0.1.5 / v0.1.4)

- Settings now displays current app version
- Added session/group multi-select and batch context operations
- Added `Move to Group` dropdown selection flow
- Added session sort mode options with persisted preference
- Default session ordering now stays stable during reconnect activity
- Added terminal tab right-click close actions (left/right/others/all)
- Improved tab overflow horizontal scrolling behavior
- Updated roadmap and planning markdown documents

## Previously Completed (v0.1.3)

- Session grouping moved to folder-style navigation
- Session/group actions moved to context menu workflows
- Sessions blank-area context menu support
- Transfer dock fixed at bottom with split upload/download panels
- Upload/download batch progress and cancel-all controls
- Download flow aligned with upload flow
- Transfer concurrency settings in Settings
- Remote file open deduplication and reopen handling
- Auto-sync upload on save for remotely opened files
- Improved delete operation feedback and behavior
- Windows menu bar hidden by default
- Windows clipboard hotkey defaults switched to `Alt+C` / `Alt+V`
- UI icon refresh with `lucide-react`

## Main Risks

- No automated unit/integration test safety net yet
- Packaging pipeline exists and self-use Windows signing works locally, but public-trust signing/notarization policy is still incomplete
- Some SFTP recursive/safety operations still need hardening
- Port-forward diagnostics are now richer, but there is still no cross-device/shared diagnostics sync workflow
- Server health currently relies on Linux `/proc` and single-root disk sampling

## Next Focus

1. Finish macOS release evidence and targeted external-host validation for packaged smoke (`P0-F3`)
2. Provision signing secrets and capture first public-trust signed/notarized release evidence (`P0-F4`)
3. Extend recoverable global error actions and guidance coverage (`P0-E3`)
4. Continue session templates v2 follow-up with import/export and runtime prompts (`F6` follow-up)
5. Continue dangerous-command/workspace follow-up with richer workspace-scoped defaults (`F17`/`F20`)

## Remaining Work Snapshot

1. Finish the remaining macOS/external-host packaged smoke evidence and reproducible issue report template (`P0-F3`)
2. Complete secret provisioning and first public-trust signed/notarized installer evidence capture (`P0-F4`)
3. Expand global error recovery actions beyond current baseline (`P0-E3`)
4. Expand Operation Center from the current tracked jobs into richer timeline and grouped control coverage (`F8`)
5. Build regression safety net (unit + integration tests, `P0-F1`/`P0-F2`)
6. Complete persistence hardening (SQLite migration + credential-safe backup/restore, `P0-A3`/`F9`)
7. Dangerous-command/workspace follow-up with richer workspace-scoped defaults (`F17`/`F20`)
8. Session templates v2 (import/export, runtime prompt overrides, layered presets)

## Feature Candidates After Hardening

1. Advanced retry-center analytics and history export
2. Session templates v2 (runtime prompts, import/export, layered presets)
3. SSH jump-host chain builder for bastion environments
4. Transfer bandwidth limiter and schedule window
5. Command snippets/playbooks v2 follow-up with richer playbook workflows and validation packs
6. Session quick profiles v2 with multi-command chain support
7. Multi-host command broadcast with dry-run preview
8. Remote file snapshot and rollback workflow
9. Session tags and smart saved views
10. Terminal session recording/replay export
11. Dangerous-command follow-up with workspace-scoped defaults and richer shared distribution
12. Recurring folder sync profiles
13. Connection quality timeline dashboard
14. Workspace profile follow-up with broader automation and shared defaults
15. Operation audit timeline (command/transfer traceability)
16. Disconnect auto-diagnostic v2 (deeper network/process evidence and guided triage hints)
17. Diff-first sync mode (preview changes before apply)
18. Session health checks and proactive risk badges
19. Team session bundle (encrypted import/export)
20. Temporary authorization mode for risky operations
21. Environment policy templates (`dev` / `staging` / `prod`)
21. Crash dump and symbolized stack pipeline
22. Release channel management (`stable` / `beta` / `canary`)
23. Accessibility and hotkey conflict checker
24. Plugin extension hooks for external ops integrations
25. Command allowlist/denylist policy packs by workspace
26. Command palette / universal action launcher
27. Remote file diff-first preview before overwrite/save-back
28. Session notes / runbook annotations
29. Split-pane terminal layouts for side-by-side work
30. Detach/clone current tab into a new window or pane
31. Recent directories / quick `cd` launcher
32. Shell integration for command history, cwd tracking, and automatic profile switching
33. Shared encrypted team vault / workspace sync for shared hosts and snippets
