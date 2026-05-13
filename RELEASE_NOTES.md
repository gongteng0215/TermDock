# TermDock Release Notes

[中文](RELEASE_NOTES.zh-CN.md)

## v0.1.25 (2026-05-12)

Release type: Stable candidate

### Highlights

- First-run session onboarding:
  - empty workspaces now show a compact Sessions inspector card for new users
  - onboarding actions jump directly to `Import SSH Config`, `New Session`, and `Security Notes`
  - dismissed onboarding state is persisted locally so the card does not keep returning
- Simplified Chinese polish:
  - added translations for the first-run onboarding card and security-notes prompt

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`
- Latest workspace smoke passed: `PASS 47 / FAIL 0 / SKIP 0`
- Latest workspace smoke artifact: `artifacts/smoke/2026-05-12T14-10-00-910Z/summary.json`

## v0.1.24 (2026-05-11)

Release type: Stable

### Highlights

- Right Inspector density pass:
  - selected-session details were removed from the right rail so the panel focuses on active session, server health, and recent command history
  - command history now defaults to the latest 5 visible entries in the Inspector, with the full manager still available for deeper review
  - server health stays compact in the right rail and opens a dedicated detail dialog instead of expanding inline
- Server Health detail upgrade:
  - the detail dialog now uses tabs for `Overview`, `Disk`, `Network`, `Processes`, and `Services`
  - overview adds OS/kernel/architecture, CPU cores, load per core, free/cache/buffer memory, Swap, and collection time
  - disk details now list mounted filesystems with type, used/free/total, usage percent, and inode usage
  - network details now list interfaces with RX/TX totals, error counts, and dropped packet counts
  - process details now show both CPU-heavy and memory-heavy processes with PID/user/command/CPU/MEM
  - failed services now include structured load/active/sub states plus service descriptions when available
- SFTP Explorer compact layout fix:
  - compact mode now prioritizes file and folder names, showing only a type dot and size/folder marker
  - permission, owner, group, and link metadata remain available in Details mode where there is enough horizontal space
- Simplified Chinese polish:
  - added translations for the new server health tabs, table labels, status labels, and SFTP folder marker

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`
- Latest workspace smoke passed: `PASS 47 / FAIL 0 / SKIP 0`
- Latest workspace smoke artifact: `artifacts/smoke/2026-05-11T13-10-47-081Z/summary.json`
- Latest packaged smoke passed: `PASS 47 / FAIL 0 / SKIP 0`
- Latest packaged smoke artifact: `artifacts/smoke/2026-05-11T03-40-28-692Z/summary.json`
- Manual server health tabs screenshot artifact: `artifacts/manual-server-health-tabs/2026-05-11T02-16-53-783Z/disk-tab.png`
- Manual Simplified Chinese server health screenshot artifact: `artifacts/manual-zh-server-health-tabs/2026-05-11T03-37-24-976Z/zh-disk-tab.png`
- Manual SFTP compact screenshot artifact: `artifacts/manual-sftp-compact/2026-05-11T01-43-53-116Z/sftp-compact.png`
- Local `dist:mac:x64` produced ZIP output but DMG creation failed on this macOS 12 host because electron-builder's downloaded `dmgbuild` runtime requires `_mkfifoat`; tagged GitHub Actions release builds run on macOS 14.

## v0.1.23 (2026-05-10)

Release type: Stable

### Highlights

- Editor workbench UI refresh on `feature/editor-workbench-ui`:
  - main shell now reads more like a dark code-editor workbench instead of a stacked operations dashboard
  - SFTP moved visually into an Explorer-style rail, while sessions, server health, and command history read as a coordinated Inspector rail
  - terminal tabs/stage and the transfer dock were restyled so the terminal remains primary and transfers read as a bottom workbench panel
  - settings and manager modal chrome now follows the same compact workbench language
- Simplified Chinese interface baseline:
  - `Settings > Workspace` now includes a persisted interface-language selector for English and Simplified Chinese
  - Simplified Chinese coverage now spans settings, workbench chrome, dialogs, context menus, terminal errors, port forwarding, diagnostics, hotkeys, snippets, Operation Center, Retry Center, Command History Manager, and Safety settings
  - DOM localization now batches updates through `MutationObserver` / `requestAnimationFrame` instead of rescanning after every render
- Renderer module split:
  - settings modal shell/sections, command snippet manager, workbench modals, and persisted workbench UI preferences were split out of `App.tsx`
  - workbench shell and terminal CSS were separated from the root stylesheet
- Sidebar usability polish:
  - SFTP Explorer view mode now persists as `Compact` or `Details`
  - command history can collapse inside the right Inspector
  - narrow widths expose `Sessions` / `Health` / `History` Inspector tabs
- Command history and polish fixes:
  - long command-history capture now looks back across more wrapped terminal rows
  - stored command-history entries keep longer commands before truncation
  - right Inspector selection details were removed to keep useful information denser
  - application icons were regenerated from a tighter source crop
  - Settings scrolling is smoother because the settings modal no longer applies a live full-screen backdrop blur

### Validation

- Post-refactor type check passed: `pnpm run typecheck`
- Post-refactor build passed: `pnpm run build`
- Post-refactor workspace smoke passed: `PASS 45 / FAIL 0 / SKIP 0`
- Post-refactor packaged smoke passed: `PASS 45 / FAIL 0 / SKIP 0`
- Latest multilingual workspace smoke passed: `PASS 47 / FAIL 0 / SKIP 0`
- Latest multilingual workspace smoke artifact: `artifacts/smoke/2026-05-10T14-23-35-255Z/summary.json`
- Latest packaged smoke artifact: `artifacts/smoke/2026-05-09T13-44-46-628Z/summary.json`

## Unreleased (master)

Release type: In development

### Highlights

- Next changes will be tracked here.

### Validation

- Pending.

## v0.1.22 (2026-04-12)

Release type: Stable

### Highlights

- Recoverable global error UX follow-up:
  - global error bar now routes high-frequency error types directly to `Connection Settings`, `File Opening`, `Hotkeys`, `SFTP Settings`, `Port Fwd`, `Retry Center`, `Operation Center`, or `Export Bug Report` when that recovery path is more specific than generic diagnostics
  - bridge/runtime issues now steer toward logs or bug-report export, and transfer-style failures now reuse the existing failure-suggestion guidance in the error bar hint
  - invalid hotkey error routing now has direct smoke coverage so the `Hotkeys` recovery action is exercised instead of only rendered
- Error bar long messages now wrap instead of forcing horizontal scrolling.
- SFTP create-directory failures now treat "already exists" as success and provide clearer permission/path guidance when creation truly fails.

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`
- Latest local workspace smoke run: `PASS 45 / FAIL 0 / SKIP 0`
- Latest local packaged smoke run: `PASS 45 / FAIL 0 / SKIP 0`

## v0.1.21 (2026-04-02)

Release type: Stable

### Highlights

- Terminal editor focus follow-up:
  - `Settings > Workspace` now also exposes `Compact`, `Balanced`, and `Reading` typography presets for editor-only font size and row height tuning
  - editor typography changes trigger a refit of the active alternate-screen terminal so rows/columns do not stay stale after the preset switch
  - `Settings > Workspace` now also exposes `System Mono`, `Coding Mono`, and `Drafting Mono` font presets for editor-only xterm font stack changes
  - `Settings > Workspace` now also exposes `Crisp`, `Steady`, and `Open` text-rhythm presets for editor-only xterm spacing and stroke-weight changes
  - `Settings > Workspace` now also exposes `Beam`, `Underline`, and `Block` cursor presets for editor-only xterm cursor-shape changes
  - inactive editor tabs now collapse into smaller pills so the active editor tab keeps most of the top-bar emphasis during multi-tab editing
- Smoke coverage expansion:
  - `scripts/smoke-capture-all.mjs` now verifies the `Reading` editor-typography preset, the `Drafting Mono` editor-font preset, the `Open` text-rhythm preset, the `Underline` cursor preset, and inactive-tab compaction in both workspace and packaged runs

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`
- Latest local workspace smoke run: `PASS 44 / FAIL 0 / SKIP 0`
- Latest local packaged smoke run: `PASS 44 / FAIL 0 / SKIP 0`

## v0.1.20 (2026-03-31)

Release type: Stable

### Highlights

- Terminal editor focus mode:
  - alternate-screen terminal editors now trigger an automatic focus layout that hides side panels and tightens terminal chrome
  - `Settings > Workspace` now exposes an explicit toggle for that auto-focus behavior
  - `Settings > Workspace` now also exposes `Midnight`, `Graphite`, and `Paper` editor-theme presets for the focused terminal canvas and xterm palette
  - the focus mode is driven by terminal alternate-screen state only, so it does not rewrite `nano`/`vim` content
- Smoke coverage expansion:
  - `scripts/smoke-ssh-fixture.mjs` shell handling now replays `printf` ESC sequences needed for alternate-screen validation
  - `scripts/smoke-capture-all.mjs` now verifies editor focus mode enter/exit, editor-theme selection, and the disabled-toggle path in both workspace and packaged runs

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`
- Latest local workspace smoke run: `PASS 39 / FAIL 0 / SKIP 0`
- Latest local packaged smoke run: `PASS 39 / FAIL 0 / SKIP 0`

## v0.1.19 (2026-03-31)

Release type: Stable

### Highlights

- SFTP batch upload reliability hardening:
  - transient first-write `No such file` failures now invalidate only the affected remote-directory branch and retry automatically
  - SSH SFTP channel-open backpressure now requeues with backoff instead of failing the batch immediately
  - effective upload concurrency now shrinks per tab under channel pressure and recovers after successful retries
- SFTP transfer policy packs:
  - `Settings > SFTP` can now save the current transfer concurrency, rate-limit, and schedule-window settings as reusable local policy packs
  - saved packs support apply, single-pack export, bulk export, JSON import, linked sync-file pull/push, and optional auto-pull/auto-push
- SFTP schedule automation polish:
  - queued-transfer schedule windows now arm an exact next-boundary wake-up instead of depending only on the coarse polling interval
  - the SFTP settings summary and paused queue banners now show the next queued-transfer resume time when the current window is closed
  - `Settings > SFTP` now includes one-click schedule presets (`Always On`, `Business Hours`, `Weeknights`, `Weekends`) on top of the custom weekday/time editor
- Smoke coverage expansion:
  - `scripts/smoke-ssh-fixture.mjs` now injects transient directory-race and SFTP session-pressure faults
  - `scripts/smoke-capture-all.mjs` now verifies the renderer queue recovers from those faults and that `Settings > SFTP` transfer policy pack save/apply, sync controls, auto-sync toggle wiring, schedule preset wiring, and next-resume schedule hint are present in both workspace and packaged runs
  - smoke launches now use an isolated smoke-only `userData` profile so workspace and packaged runs do not inherit persisted settings from older passes

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`
- Latest local workspace smoke run: `PASS 36 / FAIL 0 / SKIP 0`
- Latest local packaged smoke run: `PASS 36 / FAIL 0 / SKIP 0`

## v0.1.18 (2026-03-30)

Release type: Stable

### Highlights

- Added SFTP transfer governance baseline:
  - `Settings > SFTP` now supports per-direction transfer rate limits for upload and download workers
  - queued upload/download work can now be restricted to a weekday + time-range schedule window
  - queues outside the configured window now pause cleanly and auto-resume when the next allowed window opens
  - stored SFTP transfer preferences now migrate forward to the new schema without losing prior concurrency settings
- Expanded SFTP smoke coverage:
  - `scripts/smoke-capture-all.mjs` now verifies the new `Settings > SFTP` rate-limit and schedule-window controls are visible in the settings capture flow

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`
- Latest local workspace smoke run: `PASS 35 / FAIL 0 / SKIP 0`
- Latest local packaged smoke run: `PASS 35 / FAIL 0 / SKIP 0`

## v0.1.17 (2026-03-30)

Release type: Stable

### Highlights

- Upload performance tuning:
  - SFTP uploads now use a dedicated transfer channel plus `fastPut` instead of the slower single-stream write path
  - upload progress events are now throttled to reduce renderer IPC overhead during large transfers
  - canceling an upload now closes only that upload's transfer channel instead of interfering with the shared SFTP session
- Batch and directory upload tuning:
  - default upload concurrency is now `4`
  - upload/download thread setting max is now `12`
  - legacy stored SFTP transfer preferences are migrated so old default installs pick up the higher upload baseline automatically
  - upload queue now prewarms remote directories in the background so batches with many small files reach steady-state faster
  - local directory expansion for upload now scans directories concurrently to reduce pre-queue delay on larger folder trees

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`
- Latest local workspace smoke run: `PASS 35 / FAIL 0 / SKIP 0`
- Latest local packaged smoke run: `PASS 35 / FAIL 0 / SKIP 0`

## v0.1.16 (2026-03-30)

Release type: Stable

### Highlights

- Upgraded GitHub Actions runtimes used by packaged smoke and release workflows:
  - `actions/checkout` -> `v6`
  - `pnpm/action-setup` -> `v5`
  - `actions/setup-node` -> `v6`
  - `actions/upload-artifact` -> `v7`
  - `actions/download-artifact` -> `v8`
- Removed the Node 20 deprecation path from the current CI baseline so routine `Packaged Smoke` and future tagged releases use the current supported action runtime stack.

### Validation

- GitHub Actions packaged smoke passed after the runtime upgrade:
  - workflow: `Packaged Smoke`
  - run: `#23733492999`
  - result: `success`

## v0.1.15 (2026-03-30)

Release type: Stable

### Highlights

- Fixed remote file open/edit reliability:
  - Windows preferred external editor launch now validates configured commands more strictly and still handles VS Code style launcher invocations
  - reopening a remote file with an unsynced local draft now prompts for reuse vs discard+reload instead of silently reusing stale temp content
  - remote open-file save-back now shows an explicit per-tab UI warning when remote drift blocks auto-sync or when upload-back fails
  - temp remote-open files are now cleaned when the owning tab closes or the app disposes the session
- Port forwarding / Operation Center hardening:
  - port-forward state is now stored per tab, so tab switches no longer race stale forward lists or status messages into the wrong session
  - Operation Center queue/port-forward cards now summarize open-workspace activity instead of only the current tab
- Server Health / Disconnect Report hardening:
  - server-health and process refreshes now keep tab-scoped state and ignore stale async responses from older refreshes
  - disconnect reports now capture the correct tab's monitor/loading/error state rather than the active tab snapshot
  - disconnect-report dedupe state is now cleared on reconnect, clear-history, and tab close
- Expanded smoke coverage:
  - `scripts/smoke-capture-all.mjs` now verifies the remote-open-file conflict warning, stale-draft reload/replace, temp-file cleanup path, and Windows preferred-opener parser/launch behavior against local helpers
  - `scripts/smoke-capture-all.mjs` now also verifies a live port-forward creation baseline, Operation Center summary visibility, and unexpected fixture shutdown -> disconnect-report capture

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`
- Latest local workspace smoke run: `PASS 35 / FAIL 0 / SKIP 0`
- Latest local packaged smoke run: `PASS 35 / FAIL 0 / SKIP 0`

## v0.1.14 (2026-03-20)

Release type: Stable

### Highlights

- Expanded dangerous-command guardrails:
  - `Settings > Safety` now exposes `Balanced`, `Operations`, and `Strict` policy packs
  - environment templates now layer `Development`, `Staging`, and `Production` presets on top of the policy-pack baseline
  - source-specific toggles now control keyboard, clipboard, history, snippet, startup-command, and quick-profile inspection paths
  - session-group overrides can pin pack/template combinations for grouped tabs
  - bottom approval bar now supports exact-command temporary scopes for the current tab or current session group
  - bottom approval bar can now also save persistent exact-command approval policies for future matches
  - shared safety bundles can now save/import/export/apply complete guard configurations locally
  - shared safety bundles now also support manual shared sync-file pull/push for team distribution baseline
  - workspace profile mode now adds `dev` / `staging` / `prod` risk cues with optional global Safety pack/template sync
- Added command snippets/playbooks v2 baseline:
  - snippet editor now supports named parameters with required/default/regex validation
  - parameterized snippets now prompt for values, preview resolved commands, and surface missing/unused parameter-token hints
  - variables can now remember last used values by snippet/group/session/global scope
  - reusable prompt sets can now be shared across snippets inside the same group
- Expanded Operation Center follow-up:
  - Operation Center now tracks recent session import/export jobs
  - Operation Center now tracks recent snippet import/export jobs
  - Operation Center now tracks recent bug-report export jobs with copy-path support
- Expanded smoke coverage:
  - settings capture now includes `Settings > Workspace` alongside the existing Safety/Hotkeys/Monitor/File Open/SFTP/Port Fwd/Diagnostics coverage
  - `pnpm run smoke:ui:packaged` now rebuilds the packaged directory before launch so stale release artifacts do not hide new settings/UI changes
  - snippet manager baseline now exercises group/snippet/prompt-set creation in both workspace and packaged runs
  - operation-center baseline now asserts the tracked app-jobs card in both workspace and packaged runs

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`
- Latest local workspace smoke run: `PASS 30 / FAIL 0 / SKIP 0`
- Latest local packaged smoke run: `PASS 30 / FAIL 0 / SKIP 0`

## v0.1.13 (2026-03-19)

Release type: Stable

### Highlights

- Added packaged smoke automation/report baseline with embedded live SSH/SFTP coverage and packaged validation workflow.
- Added release preflight/verify tooling, self-use Windows release helper path, and release signing runbook.
- Added session templates baseline with template-scoped env vars plus create/apply/manage flows.
- Expanded dangerous-command smoke coverage and safety-panel validation.

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`
- Latest local workspace and packaged smoke runs: `PASS 30 / FAIL 0 / SKIP 0`

## v0.1.12 (2026-03-13)

Release type: Stable

### Highlights

- Session list double-click now always opens a new terminal tab for the same session.
- Default session-open dedupe behavior is preserved for other entry points, so existing-tab focus still applies outside the explicit double-click flow.

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`

## v0.1.11 (2026-03-13)

Release type: Stable

### Highlights

- Session open behavior hardening:
  - opening the same session repeatedly now focuses existing tab instead of creating duplicates
  - close-then-reopen behavior is preserved
- Command History panel context menu polish:
  - blank-area right-click now opens context menu (`Add` / `Import` / `Export` / `Manage`)
  - existing row-level menu (`Run` / `Copy` / `Delete`) remains unchanged
- Session text normalization migration:
  - startup session JSON load now repairs known mojibake patterns for `name` / `groupId` / `remark`
  - create/update paths now apply the same normalization before persistence
- Expanded UI smoke automation coverage:
  - `scripts/smoke-capture-all.mjs` now validates sessions/menu/settings/command-history/retry/operation flows
  - baseline local smoke run at delivery: `PASS 21 / FAIL 0 / SKIP 0`
- Added session-scoped transfer conflict strategy memory:
  - conflict dialogs now support `Remember for Session`
  - `Settings > SFTP` includes clear actions for remembered upload/download defaults
- Added Retry Center analytics improvements:
  - top failure reasons summary card
  - analytics snapshot export (`JSON` / `CSV`)
  - visible-history export metadata now includes top sessions/groups/failure reasons
- Improved Retry Center usability:
  - added time-range filter (`all` / `5m` / `30m` / `1h` / `24h`)
  - added list-mode switch (`Flat` / `Grouped by Failure`) with collapsible groups
  - grouped list now supports group-level select/retry/delete/export actions
  - grouped export now supports scope selection (`All` / `Failed` / `Retryable Active Session`)
  - grouped retry now supports scope selection (`All Retryable` / `Upload Only` / `Download Only`)
  - added failure-reason quick filter for failed-history triage
  - added quick retry actions by top failure reason (active-session scope, retry-scope strategy aware)
  - added visible delete actions by failure reason in top-reason card
  - `Retry Visible Failed` now supports scope selection (`All Retryable` / `Upload Only` / `Download Only`)
  - `Retry Selected Failed` now supports scope selection (`All Retryable` / `Upload Only` / `Download Only`)
  - added one-click `Retry All Failed` (upload + download) in transfer dock, retry center, and operation center (retry-scope strategy aware)
  - Retry Center action bar now includes direction-specific quick actions (`Retry Failed Uploads` / `Retry Failed Downloads`)
  - added large-batch retry confirmation guardrail with configurable threshold (`Retry Confirm Threshold`, default: `100`, set `0` to disable)
  - `Settings > SFTP` now also exposes `Retry Confirm Threshold` for global adjustment
  - retry-scope chooser now remembers and prioritizes last used scope (`Last Used`) across restart
  - added `Default Retry Scope` selector (all/upload/download) for manual retry-strategy preselection
  - added `Auto Retry Scope` toggle to skip chooser and apply last used scope directly when available
  - retry-center filter view now persists locally with quick reset support
- Added port forwarding diagnostics analytics improvements:
  - visible-event analytics cards (error ratio, type breakdown, top error code/correlation)
  - analytics export (`JSON` / `CSV`) under `Settings > Port Fwd > Recent Events`
  - visible-event export now includes aggregated analytics fields
- Added recoverable global error UX baseline:
  - global error bar now includes quick actions (`Reconnect`, `Open Logs`, `Diagnostics`, `Copy Error`)
  - contextual recovery hints for connection/bridge-related errors
- Added disconnect diagnostics baseline:
  - unexpected terminal `closed/error` events now auto-capture runtime context snapshots
  - `Settings > Diagnostics` now shows disconnect reports with JSON/CSV export, copy-latest, and clear actions
  - added diagnostics auto-capture toggle for disconnect reports
  - added report filters (`scope` / `trigger` / `time range` / `search`) and visible-only export/clear
- Improved bug-report bundle diagnostics:
  - `Export Bug Report` now includes disconnect-report snapshot (`disconnect-reports.json`) when available
- Improved global error recovery actions:
  - added `Copy Latest Disconnect` quick action when disconnect reports are available
- Added operation center baseline (`F8`):
  - new modal to consolidate active long-running operation state
  - includes upload/download queue, remote delete progress, and port-forward busy status
  - includes quick actions for transfer cancel-all and diagnostics navigation
  - includes cross-tab transfer activity summary with one-click tab focus
  - includes per-tab and all-tab transfer cancellation controls
  - includes per-tab and bulk reconnect controls for disconnected transfer tabs
- Added hotkey conflict checker baseline (`F30` partial):
  - `Settings > Hotkeys` now detects conflicting enabled shortcuts
  - conflicting actions are highlighted inline in hotkey rows with conflict badges
  - new `Auto Resolve Conflicts` action keeps the first matching action and disables duplicates
  - added `Import Hotkeys...` / `Export Hotkeys...` JSON actions for quick backup and restore
  - hotkey import flow now previews per-action before/after changes before confirm
  - hotkey import flow now reports imported conflict count and adds `Import + Auto Resolve` option
  - import preview now includes auto-resolve disable-impact details before apply
  - hotkey conflict panel now supports one-click row navigation (`Locate`, `Focus First Conflict`)
  - hotkey conflict panel now adds `Prev` / `Next` traversal with active conflict index
  - hotkey conflict traversal now also supports keyboard shortcuts (`Alt + [` / `Alt + ]`)
  - hotkey conflict cursor now persists locally and restores by conflict signature when possible
- Added session export actions to Sessions context menus:
  - `Export All Sessions...`
  - `Export All Groups...`
- Added session JSON import wizard in Sessions context menu:
  - `Import Sessions JSON...` with parsed candidate preview
  - group strategy chooser (`keepSource` / `forceCurrent` / `ungrouped`)
  - duplicate strategy chooser (`skip` / `overwrite` / `rename`)
- Added session quick profiles:
  - session context menu now supports `Run Quick Profile...`, `Save Quick Profile...`, and `Manage Quick Profiles...`
  - quick profile commands execute on open/focused session tab
- Added command snippet groups baseline:
  - command history panel now exposes `Run Snippet` and `Snippet Manager`
  - snippet manager supports grouped add/import/export/clear and template placeholders
- `Export All Sessions...` now outputs JSON including:
  - all sessions
  - group metadata summary (including `Ungrouped` when present)
  - app version and export timestamp
- `Export All Groups...` now outputs JSON including:
  - all groups
  - per-group session lists and counts
  - app version and export timestamp
- Export UX:
  - save-to-file flow via native save dialog (`.json`)
  - clipboard fallback when save bridge is unavailable
  - success dialog includes exported path and clipboard copy when possible
- Improved transfer conflict pre-check performance:
  - local/remote directory conflict scans now run with limited concurrency
  - reduces pre-queue delay on larger upload/download folder batches
- Improved disconnect behavior during transfers:
  - queued transfers now pause when tab disconnects
  - queued jobs resume after reconnect instead of being marked failed immediately
- Improved transfer completion UX:
  - removed blocking completion dialog in normal success path
  - completion status now appears as lightweight dock notice
  - failure guidance points to Retry Center; detailed failures remain in diagnostics logs
- Improved diagnostics log durability under heavy activity:
  - logger write path moved to async queued writes
  - rotation now retains multiple archive files (`termdock.log.1` ... `.5`)
- Added pending transfer queue restart recovery:
  - pending queue snapshot persists for restart recovery
  - transfer dock now provides `Restore Pending` and `Discard Pending` actions
- Added remote open-file save-back guard baseline:
  - metadata baseline check (`exists` / `size` / `mtime`) before auto-upload
  - unsafe auto-sync is skipped when remote file changed unexpectedly
- Added retry-center guidance baseline:
  - top failure reasons now include contextual suggestion rows for operator triage

### Still Not Done (Tracked)

1. `P0-F3`: cross-platform packaged smoke checklist and reproducible report set
2. `P0-F4`: signing/notarization finalization and installer verification
3. `P0-E3`: broader global error recovery action/guidance coverage
4. `F8`: operation center follow-up for richer timeline and grouped controls
5. `P0-F1`/`P0-F2`: unit + integration test baseline

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`

## v0.1.10 (2026-03-08)

Release type: Stable

### Highlights

- Added transfer conflict policy for upload/download queues:
  - batch-level strategy selection: `Overwrite`, `Skip`, `Rename`
  - rename strategy auto-generates non-conflicting names (`name (1).ext`)
  - upload path now supports explicit target remote path for rename-safe queueing
- Added failed-transfer retry actions in transfer dock:
  - `Retry Failed` for uploads
  - `Retry Failed` for downloads (with conflict policy check before requeue)
- Added persistent failed-transfer history (session scope, restart-safe):
  - terminal-status transfer history persisted in local storage
  - dock-level `Retry Failed` now reuses persisted failures after app restart
- Added Transfer Retry Center:
  - modal view with scope/direction/status/search filters
  - batch actions: select visible, retry selected failed, delete selected/visible/all
- Added diagnostics logging baseline:
  - main process file logger with rotation (`userData/logs/termdock.log`)
  - renderer global `error` and `unhandledrejection` auto-log
  - new `Settings > Diagnostics` panel to refresh/open/copy log paths
- Added one-click bug report export in `Settings > Diagnostics`:
  - exports zip bundle with logs + runtime metadata + safe settings snapshot
  - copyable export path for support handoff
- Added SSH config import baseline:
  - sessions context-menu action `Import SSH Config...`
  - parser + preview + duplicate strategy (`skip` / `overwrite` / `rename`)
- Hardened SSH config parser behavior:
  - recursive `Include` expansion (glob include paths supported)
  - wildcard and negation `Host` matching with order-aware option merge
- Added port forwarding baseline in `Settings > Port Fwd`:
  - Local (`-L`), Remote (`-R`), and Dynamic (`-D` / `SOCKS5`) create/list/remove
  - forward lifecycle is bound to the active terminal tab
  - forwards auto-clean up on disconnect or tab close
- Added saved port forwarding presets:
  - presets persist locally per session
  - one-click apply from `Settings > Port Fwd`
  - optional auto-restore when the terminal tab reconnects
- Improved port forwarding runtime visibility:
  - active forwards now expose runtime status (`Active` / `Degraded`)
  - track per-forward connection totals and failed connection counts
  - expose last activity timestamp and last failure reason in `Settings > Port Fwd`
  - auto-refresh forwarding status while the settings panel is open
- Added port forwarding event timeline and diagnostics snapshot:
  - `Settings > Port Fwd > Recent Events` shows recent create/remove/degraded/recovered entries
  - `Export Snapshot` copies active forwarding state + recent events to clipboard for issue reporting
- Added persisted port forwarding history controls:
  - event timeline is persisted locally by session and survives restart
  - new event filter (`All` / `Errors` / `Create-Remove` / `Degraded-Recovered`)
  - one-click clear for visible events or current-session event history
- Improved snapshot export behavior for forwarding diagnostics:
  - `Export Snapshot` now saves a `.txt` file through a save dialog
  - exported file path is copied to clipboard when available
  - clipboard text export remains as fallback when save bridge is unavailable
- Updated project markdown docs to reflect current `F5+` status and next diagnostics priorities
- Reduced random disconnect risk during heavy transfer workloads:
  - Added per-tab in-flight guards for server health/process polling
  - Skip silent monitor polling while active upload/download tasks are running on the same tab
- Stabilized terminal viewport behavior on smaller windows and packaged startup:
  - Added deferred multi-pass `fit` scheduling after tab activation/connect
  - Added a font-ready refit path to prevent stale row/column sizing
- Fixed settings panel footer overlap on shorter window heights
- Added long-duration transfer soak tooling:
  - `scripts/soak-transfer.mjs`
  - `SOAK_TEST.md` execution matrix and validation runbook

### Validation

- Type check passed:
  - `tsc --noEmit -p tsconfig.json`
  - `tsc --noEmit -p tsconfig.node.json`
- Build passed: `pnpm run build`

## v0.1.9 (2026-03-05)

Release type: Stable

### Highlights

- Added a protection path for alternate-buffer wheel handling when mouse tracking is active
- Prevents raw wheel mouse-report sequences from appearing as terminal text (for example `%6`, `%9`)
- Keeps scrolling behavior stable in full-screen editors while avoiding garbage input artifacts

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`

## v0.1.8 (2026-03-05)

Release type: Stable

### Highlights

- Refined terminal wheel input behavior to reduce extra blank-line/jump effects during scroll
- Added mode-aware wheel forwarding strategy:
  - respects `application cursor keys` mode for correct arrow sequence mapping
  - skips injected wheel navigation when terminal mouse tracking is active
  - uses accumulated wheel deltas to avoid over-triggering line movements

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`

## v0.1.7 (2026-03-05)

Release type: Stable

### Highlights

- Improved terminal wheel-scroll reliability in alternate-buffer applications
  - Uses `buffer.active.type === "alternate"` detection for robust mode detection
  - Captures wheel events on terminal surfaces to avoid dropped events
- Kept lifecycle cleanup for wheel listeners on tab close/unmount

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`

## v0.1.6 (2026-03-05)

Release type: Stable

### Highlights

- Fixed terminal mouse wheel behavior in alternate-buffer applications
  - Scrolling now works in long files when using `nano`
  - Scrolling now works in `vim` through the same input path
- Added safe wheel-listener lifecycle cleanup on terminal tab close/unmount

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`

## v0.1.5 (2026-03-04)

Release type: Stable

### Highlights

- Updated Windows terminal clipboard defaults to:
  - `Ctrl+Shift+C` for copy
  - `Ctrl+Shift+V` for paste
- Removed temporary Alt clipboard compatibility fallback to avoid terminal Meta-key conflicts
- Added `Clear Finished` actions in Transfer panels (upload/download):
  - Clears only `completed/failed/canceled` items
  - Keeps `running/queued` tasks visible
- Added session context action: `Duplicate Session`
  - Auto-fills a copied session form with a unique `copy` suffix
  - Prompts for password re-entry when duplicating password-based sessions
- Added session context action: `Copy SSH Command`
  - Copies a ready-to-run `ssh` command based on session settings
- Added quick-connect keyboard action in session list:
  - Press `Enter` on selected session to open terminal tab

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`

## v0.1.4 (2026-03-03)

Release type: Stable

### Highlights

- Added app version display in `Settings`
- Added multi-select batch workflows in Sessions:
  - Batch operations for selected groups and sessions
  - Batch move and batch delete from context menus
  - `Move to Group` now uses a dropdown selector instead of free-text input
- Improved session ordering controls:
  - Added context-menu sort modes (`Default`, `Recent`, `Name A-Z`, `Name Z-A`)
  - Sort mode is persisted across restarts
  - Default mode keeps list position stable (no unexpected reorder on reconnect)
- Added terminal tab context menu actions:
  - `Close Tab`
  - `Close Tabs to Left`
  - `Close Tabs to Right`
  - `Close Other Tabs`
  - `Close All Tabs`
- Improved terminal tab overflow handling with horizontal scrolling
- Fixed UI text consistency issues in sort labels
- Updated project markdown docs with prioritized feature roadmap

### Validation

- Type check passed: `pnpm run typecheck`
- Build passed: `pnpm run build`

## v0.1.3 (2026-03-03)

Release type: Stable

### Highlights

- Reworked Sessions into a folder-style flow:
  - Browse groups first, then enter a group to view sessions
  - Group and session actions unified under context menus
  - Removed the dedicated right-side session info panel
- Added blank-area context menu support in the Sessions panel
- Split upload/download and pinned transfer panels to a fixed bottom dock
- Added batch progress stats for transfer workflows
- Added one-click cancel-all for upload and download
- Fixed cancellation races where tasks could continue after cancel
- Added folder download from SFTP context menu
- Unified upload/download queue behavior and controls
- Added configurable upload/download thread counts in Settings (default: 2)
- Improved remote file open/edit behavior:
  - Prevent duplicate windows for the same remote file
  - Reopen works after close
  - Auto-upload on save back to server
- Added visible delete progress feedback
- Improved directory delete path handling on remote host
- Windows menu bar is now hidden by default
- Windows terminal copy/paste defaults changed to `Alt+C` / `Alt+V`
- UI icon refresh with `lucide-react` for consistent controls

### Compatibility Notes

- After upgrade, check:
  - `Settings > SFTP > Upload Threads`
  - `Settings > SFTP > Download Threads`
  - `Settings > Hotkeys` (especially copy/paste bindings)
- If upgrading from `0.1.3-test.1`, session-group and context-menu interactions have changed.

### Validation

- Build verification completed: `pnpm run build` (renderer + main passed)
