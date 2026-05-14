# TermDock Progress

[中文](PROGRESS.zh-CN.md)

Last updated: 2026-05-14

## Snapshot

- Stable release shipped: `v0.1.26`
- Active branch: `master`
- Active focus: SSH config import polish and first-connect conversion
- Packaged smoke automation/report baseline with embedded SSH/SFTP fixture landed on `master`
- Master branch includes post-`v0.1.9` hardening plus transfer safety, diagnostics, and port forwarding baseline updates
- Master branch now also includes dangerous-command guardrails baseline with `Settings > Safety` and a fixed bottom approval bar
- Master branch now also includes session templates baseline with template-scoped env var substitution
- Master branch now also includes command snippets/playbooks v2 baseline with prompted variables, scoped remembered values, reusable prompt sets, and preview-before-run
- Master branch now also includes dangerous-command approval scopes, persistent approval policies, shared policy-bundle import/export/apply, manual sync-file pull/push, and workspace-profile mode with optional Safety sync
- Master branch now also includes Operation Center tracked app jobs for session/snippet import-export plus bug-report export
- Master branch now also includes remote file open reliability fixes for Windows preferred-editor cold-start and stale temp-file reuse after remote-side changes
- Master branch now also includes explicit UI warnings when remote-open-file save-back is blocked or upload-back fails
- Master branch now also includes remote-open temp-file cleanup on tab/app dispose, background-tab persistent warnings, and an explicit stale-draft reopen chooser
- Master branch now also includes per-tab port-forward state tracking, tab-switch-safe port-forward refresh, and Operation Center summaries that no longer depend on the active tab only
- Master branch now also includes tab-scoped server-health/process state, stale monitor-request invalidation, and disconnect-report capture that now records the correct tab's monitor status
- Master branch now also includes GitHub Actions runtime upgrades for packaged-smoke/release workflows, removing the previous Node 20 deprecation path from CI
- Master branch now also includes upload fast-path/channel isolation, higher default upload concurrency, remote-directory prewarm, and concurrent local directory scan for upload batches
- Master branch now also includes per-direction SFTP transfer rate limits plus queued-transfer weekday/time schedule windows
- Master branch now also includes upload batch reliability hardening for transient missing-path races and SSH SFTP channel-open backpressure, plus a fault-injected smoke path that verifies recovery
- Master branch now also includes alternate-screen terminal editor focus mode that auto-tightens the main layout and terminal chrome while full-screen TUI editors are active, with a workspace-level enable/disable toggle plus editor-theme, typography, font, text-rhythm, and cursor presets
- Master branch now also includes richer recoverable global error routing so high-frequency errors can jump directly to `Hotkeys`, `Port Fwd`, `Retry Center`, settings, `Operation Center`, or bug-report export instead of generic diagnostics only
- Master branch now also treats SFTP create-directory "already exists" failures as idempotent success and wraps long error-bar messages instead of forcing horizontal scroll
- Master branch now includes first-run session onboarding with `Import SSH Config`, `New Session`, and `Security Notes` actions for empty workspaces
- Master branch now includes SSH config import preview stats, post-import open-first-session action, and OpenSSH `IdentityFile` token expansion for more reliable first-run imports
- Master branch now warns during SSH config import when expanded `IdentityFile` paths are missing on the current machine
- Master branch now warns during SSH config import when common unsupported OpenSSH directives need manual follow-up
- Master branch now includes a paired English/Simplified Chinese SSH config import guide linked from the README and documentation index
- Master branch now includes first-connect SSH error diagnostics with reason/suggestion/raw-error output plus a paired troubleshooting guide
- Editor workbench branch now reshapes the renderer into a flatter code-editor-style workbench: left Explorer rail, right Inspector rail, terminal-dominant center stage, bottom transfer panel, aligned modal chrome, SFTP `Compact` / `Details` persistence, collapsible command history, and narrow-width inspector tabs
- Editor workbench branch now splits the large renderer surface into focused modules for workbench modals, settings modal shell/sections, command snippet manager, persisted workbench UI preferences, and separate workbench/terminal CSS files
- Editor workbench branch now extends recoverable global error routing for Safety bundle/guardrail, Workspace profile, Monitor/server-health, and Diagnostics-specific failures, with smoke coverage for Safety sync recovery
- Editor workbench branch now adds an Operation Center activity timeline plus grouped controls for transfer, active-tab, and tool workflows
- Editor workbench branch now extends the persisted English/Simplified Chinese interface language selector with a broad Simplified Chinese coverage layer for settings, workbench chrome, dialogs, context menus, terminal errors, port forwarding, diagnostics, hotkeys, snippets, Operation Center, Retry Center, and Command History Manager
- Latest master validation on 2026-05-14: `pnpm run typecheck`, `pnpm run build`, and `pnpm run smoke:ui` passed. Latest workspace smoke artifact is `artifacts/smoke/2026-05-14T06-14-31-419Z/summary.json` (`PASS 48 / FAIL 0 / SKIP 0`).
- Latest post-refactor validation on 2026-05-09: `pnpm run typecheck`, `pnpm run build`, `pnpm run smoke:ui`, and `pnpm run smoke:ui:packaged` passed. Latest workspace smoke artifact is `artifacts/smoke/2026-05-09T13-35-51-500Z/summary.json`; latest packaged smoke artifact is `artifacts/smoke/2026-05-09T13-44-46-628Z/summary.json`.
- Milestone status:
  - `M0` (technical validation): complete
  - `M1` (MVP hardening): in progress
- P0 totals:
  - `DONE`: 13
  - `PARTIAL`: 14
  - `TODO`: 6

## Release Readiness

- Current quality: suitable for self-use and power users
- Not fully GA-hardened yet
- Minimum gates before broad rollout:
  - `P0-F3`: cross-platform smoke tests
  - `P0-F4`: installer signing/notarization and install validation
  - `P0-E3`: recoverable global error UX follow-up
- Those broad-rollout gates are not the active priority for the current self-use track

## Completed in v0.1.17

- Upload throughput improvements:
  - uploads now use dedicated SFTP channels plus `fastPut`
  - upload progress emission is now throttled to lower IPC overhead
  - canceling an upload no longer depends on tearing down shared SFTP state
- Upload batch preparation improvements:
  - default upload concurrency increased to `4`
  - max upload/download thread setting increased to `12`
  - legacy stored transfer preferences migrate to the new upload default baseline
  - upload queue now prewarms remote directories before workers need them
  - local upload directory expansion now scans folders concurrently

## Completed on feature/editor-workbench-ui

- Editor workbench shell refresh:
  - app chrome shifted from a card-heavy operations-console feel toward a flatter dark code-editor workbench
  - left side now reads as a remote-file Explorer rail
  - right side now reads as a coordinated Inspector rail for sessions, health, and command history
  - terminal workspace remains the visual center and uses tighter editor-tab/stage language
  - transfer dock now reads as a bottom workbench panel
  - modal chrome and compact action states now align with the new shell language
- Sidebar and inspector follow-up:
  - SFTP explorer now has persisted `Compact` / `Details` view modes
  - command history can collapse inside the inspector rail
  - narrow widths switch the inspector into `Sessions` / `Health` / `History` tab behavior
- Renderer module split:
  - settings modal structure moved into dedicated shell and section components
  - command snippet manager and workbench modals moved out of `App.tsx`
  - workbench UI local-storage preferences moved into a small helper module
  - workbench shell and terminal CSS were split out from the root stylesheet
- Multilingual baseline:
  - `Settings > Workspace` now exposes a persisted interface-language selector
  - English remains the default language; Simplified Chinese now includes an explicit label set plus DOM localization fallback for remaining hardcoded UI text/attributes
  - Simplified Chinese coverage now includes the settings shell, Workspace controls, topbar, transfer dock, terminal/workbench chrome, context menus, common dialogs, Operation Center, Retry Center, Command History Manager, port forwarding, diagnostics, hotkeys, and snippets
  - smoke coverage now verifies the Simplified Chinese language option is present and opens localized Retry Center and Command History Manager modals
- Verification so far:
  - hardening follow-up `pnpm run typecheck`: passed
  - hardening follow-up `pnpm run build`: passed
  - master follow-up `pnpm run smoke:ui`: `PASS 47 / FAIL 0 / SKIP 0` at `artifacts/smoke/2026-05-11T13-10-47-081Z/summary.json`
  - hardening follow-up `pnpm run smoke:ui`: `PASS 46 / FAIL 0 / SKIP 0` at `artifacts/smoke/2026-05-10T07-36-38-904Z/summary.json`
  - full UI refresh smoke artifact: `PASS 45 / FAIL 0 / SKIP 0`
  - post-refactor `pnpm run typecheck`: passed
  - post-refactor `pnpm run build`: passed
  - post-refactor `pnpm run smoke:ui`: `PASS 45 / FAIL 0 / SKIP 0` at `artifacts/smoke/2026-05-09T13-35-51-500Z/summary.json`
  - post-refactor `pnpm run smoke:ui:packaged`: `PASS 45 / FAIL 0 / SKIP 0` at `artifacts/smoke/2026-05-09T13-44-46-628Z/summary.json`

## Completed in v0.1.25

- First-run session onboarding:
  - empty workspaces now show a compact onboarding card in the Sessions inspector
  - onboarding actions open `Import SSH Config`, `New Session`, and `Security Notes`
  - dismissed onboarding state persists locally
  - Simplified Chinese translations cover the onboarding card and security-notes prompt

## Completed in v0.1.26

- SSH config import polish:
  - preview now summarizes new sessions, duplicate targets, private-key sessions, target group, and duplicate strategy
  - duplicate strategy selection shows the current import plan before any session data is written
  - SSH config and session JSON imports can open the first imported session immediately after completion
  - `IdentityFile` now expands common OpenSSH tokens `%d`, `%u`, `%r`, `%h`, `%n`, `%p`, and `%%`
  - import preview warns when expanded `IdentityFile` paths are missing on the current machine
  - import preview warns when common unsupported OpenSSH directives need manual follow-up
- First-connect diagnostics:
  - SSH connection and test-connection errors now include a plain-language reason, next-step suggestion, and raw error for common auth, key-file, DNS, port, timeout, network, host-key, handshake, and remote-close cases
- Documentation:
  - paired English/Simplified Chinese SSH config import and SSH connection troubleshooting guides now cover the first-import and first-connect paths
- Verification:
  - `pnpm run typecheck`: passed
  - `pnpm run build`: passed
  - `pnpm run smoke:ui`: `PASS 48 / FAIL 0 / SKIP 0` at `artifacts/smoke/2026-05-14T06-14-31-419Z/summary.json`

## Completed in v0.1.18

- SFTP transfer governance baseline:
  - per-direction upload/download rate limits in `Settings > SFTP`
  - queued-transfer weekday/time schedule windows
  - queue pause outside the configured window plus automatic resume when the next allowed window opens
  - transfer-preferences schema migration for the new controls

## Completed in v0.1.21

- Terminal editor focus mode:
  - entering alternate-screen editors now switches the app into a chrome-light focus layout instead of leaving SFTP/session panels open beside the editor canvas
  - terminal workspace tracks alternate-screen state per tab and restores the full layout immediately after the editor exits
  - `Settings > Workspace` now exposes an explicit auto-focus toggle so the behavior can be disabled without changing terminal rendering
  - `Settings > Workspace` now also exposes `Midnight` / `Graphite` / `Paper` editor-theme presets that retheme the focused terminal canvas and xterm palette without rewriting TUI output
  - `Settings > Workspace` now also exposes `Compact` / `Balanced` / `Reading` typography presets, `System Mono` / `Coding Mono` / `Drafting Mono` font presets, `Crisp` / `Steady` / `Open` text-rhythm presets, and `Beam` / `Underline` / `Block` cursor presets for editor-only tuning
  - inactive editor tabs now collapse into smaller pills so the active editor tab keeps most of the top-bar emphasis during multi-tab editing
  - smoke fixture shell now supports `printf` ESC-sequence playback so workspace and packaged smoke both verify focus-mode enter/exit behavior, theme selection, typography selection, font selection, text-rhythm selection, cursor selection, inactive-tab compaction, and the disabled-toggle path

## Completed in v0.1.19

- SFTP transfer policy packs:
  - `Settings > SFTP` can now save the current concurrency/rate-limit/window configuration as a reusable local policy pack
  - saved packs can be applied, imported, exported individually, exported in bulk, and linked to a shared sync JSON file for manual pull/push plus optional auto-pull/auto-push
  - workspace and packaged smoke now verify a real save/apply flow plus the presence of the sync/auto-sync controls in the SFTP settings panel
- SFTP schedule automation follow-up:
  - schedule-window evaluation now arms an exact next-boundary wake-up instead of relying only on the coarse polling interval
  - `Settings > SFTP` and paused transfer queues now show the next queued-transfer resume time when the current window is closed
  - `Settings > SFTP` now exposes one-click schedule presets for `Always On`, `Business Hours`, `Weeknights`, and `Weekends`
  - workspace and packaged smoke now launch each run inside an isolated smoke-only `userData` profile so persisted settings from older runs do not leak into the next matrix
- SFTP batch upload reliability:
  - first-write `No such file` failures now invalidate only the affected remote-directory branch instead of flushing the entire tab cache
  - SSH SFTP channel-open backpressure now triggers automatic requeue/backoff instead of immediate batch failure
  - effective upload concurrency now shrinks per tab under backpressure and recovers after successful retries
  - smoke fixture now injects transient directory-race and channel-pressure faults so this path is covered in both workspace and packaged smoke
## Completed in v0.1.16

- Upgraded workflow action runtimes:
  - `actions/checkout` -> `v6`
  - `pnpm/action-setup` -> `v5`
  - `actions/setup-node` -> `v6`
  - `actions/upload-artifact` -> `v7`
  - `actions/download-artifact` -> `v8`
- Confirmed GitHub `Packaged Smoke` still passes after the runtime upgrade without the previous Node 20 deprecation warning path

## Completed in v0.1.15

- Remote-open/editor reliability hardening:
  - stricter Windows preferred-editor parsing and clearer invalid-path failure
  - stale-draft reopen chooser plus discard+reload replacement path
  - temp-file cleanup on tab/app dispose
  - explicit per-tab save-back conflict/upload-failure warning path
- Port-forward / Operation Center hardening:
  - per-tab port-forward state and request-id guarded refresh
  - Operation Center queue/port-forward summaries now reflect open-workspace totals
- Monitor / diagnostics hardening:
  - server-health/process refreshes now keep tab-scoped state and ignore stale async responses
  - disconnect reports now capture the correct tab's monitor/loading/error state instead of the active tab snapshot
  - disconnect-report fingerprint cleanup now follows reconnect/clear/close flows
- Smoke coverage expanded to:
  - Windows preferred-opener real launch/failure validation
  - remote-open conflict/reload/cleanup flows
  - live port-forward creation baseline
  - unexpected fixture shutdown -> disconnect-report capture path

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
  - remote-open-file conflict/reload/cleanup paths are exercised against the same embedded fixture
  - Windows preferred-opener parser is now exercised against a real helper script with a quoted-path success case and an explicit broken-path failure case
- Added dangerous-command guardrails baseline:
  - `Settings > Safety` exposes built-in risky-command rules and custom patterns
  - a fixed bottom approval bar blocks risky writes until a one-time run is approved
  - guardrails cover keyboard Enter, clipboard paste, command history run/paste, snippets, quick profiles, and startup commands
- Packaged smoke now covers embedded live SSH connect, embedded live SFTP upload/download/delete, remote-open-file conflict/reload/cleanup flows, Windows preferred-opener parser/launch validation, the `Settings > Workspace` + `Settings > Safety` sections, built-in rule reset flow, and approval-bar UI baseline
- `pnpm run pack` is now smoke-friendly on local Windows shells by skipping native rebuilds and `winCodeSign` resource-edit extraction, so `pnpm run smoke:ui:packaged` runs on this machine
- `pnpm run smoke:ui:packaged` now rebuilds the packaged directory first, so local packaged smoke does not accidentally reuse stale `release/*` output
- Latest local workspace smoke run: `PASS 36 / FAIL 0 / SKIP 0`
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
- Added SFTP transfer governance baseline:
  - `Settings > SFTP` now supports upload/download rate limits in KiB/s
  - queued transfer workers can now be constrained to selected weekdays plus a start/end time window
  - queues pause outside the configured window and automatically resume when the next allowed window opens

## Current branch additions

- `feature/editor-workbench-ui` now has three local commits ahead of `origin/feature/editor-workbench-ui`:
  - `feat: complete editor workbench ui refresh`
  - `docs: update editor workbench progress tracker`
  - `refactor: split editor workbench renderer modules`
- The branch is currently suitable for source-level continuation, with type safety verified after the refactor.
- Before merge/release handoff, refresh build and smoke evidence after the module split.

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
- high-frequency error types now route directly to `Connection Settings`, `File Opening`, `Hotkeys`, `SFTP Settings`, `Port Fwd`, `Retry Center`, `Operation Center`, or `Export Bug Report` when that recovery path is more specific than generic diagnostics
- Added operation center baseline (`F8`):
  - new modal to consolidate active long-running operations
  - includes queue state for uploads/downloads, remote delete status, and port-forward busy state
  - adds an activity timeline for recent transfer, delete, port-forward, and app-job events
  - adds grouped controls for transfer-wide retry/cancel/reconnect, active-tab transfer actions, and tool navigation
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

- No automated unit/integration test safety net yet, but that is currently low priority for the self-use track
- Packaging pipeline exists and self-use Windows signing works locally, but public-trust signing/notarization policy is intentionally deprioritized for the self-use track
- Some SFTP recursive/safety operations still need hardening
- Port-forward diagnostics are now richer, but there is still no cross-device/shared diagnostics sync workflow
- Server health currently relies on Linux `/proc` and single-root disk sampling

## Next Focus

1. Push or PR the editor-workbench branch with current workspace and packaged smoke evidence
2. Review feedback from real usage of the refreshed workbench shell
3. Resume recoverable global error actions and guidance coverage (`P0-E3`)
4. Resume recoverable global error actions and guidance coverage (`P0-E3`)
5. Expand Operation Center from the current grouped controls into broader cancel/retry coverage (`F8`)
6. Continue persistence hardening and startup/large-transfer performance follow-up

## Remaining Work Snapshot

1. Optional editor-workbench polish after live usage feedback
2. Remaining macOS/external-host packaged evidence for broader release confidence
3. Expand global error recovery actions beyond current baseline (`P0-E3`)
4. Expand Operation Center from the current grouped controls into broader cancel/retry coverage (`F8`)
5. Complete persistence hardening (SQLite migration + credential-safe backup/restore, `P0-A3`/`F9`)
6. Continue startup and large-transfer performance follow-up (`P0-E1`/`P0-E2`)
7. Dangerous-command/workspace follow-up with richer workspace-scoped defaults (`F17`/`F20`)
8. Session templates v2 (import/export, runtime prompt overrides, layered presets)
9. Finish the remaining macOS/external-host packaged smoke evidence and reproducible issue report template (`P0-F3`), low priority for self-use
10. Complete secret provisioning and first public-trust signed/notarized installer evidence capture (`P0-F4`), low priority for self-use
11. Build regression safety net (unit + integration tests, `P0-F1`/`P0-F2`), low priority for self-use

## Feature Candidates After Hardening

1. Advanced retry-center analytics and history export
2. Session templates v2 (runtime prompts, import/export, layered presets)
3. SSH jump-host chain builder for bastion environments
4. Transfer policy packs and schedule automation follow-up
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
