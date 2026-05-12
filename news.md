# TermDock Product Notes

[中文](news.zh-CN.md)

Last updated: 2026-05-09

## Confirmed Direction

- Keep a compact-first desktop workflow
- Prioritize operator efficiency over decorative UI
- Use context-menu-first interactions for session/group/file operations
- Keep core terminal and transfer actions deterministic and recoverable
- Require explicit safety approval for risky terminal execution sources

## Release Baseline

- Current stable release: `v0.1.22` (2026-04-12)
- Active branch: `feature/editor-workbench-ui`
- Active branch focus: editor-workbench UI refresh and post-refactor validation

## Shipped in Recent Cycles

- feature/editor-workbench-ui: the main renderer now reads as a dark code-editor workbench with a flatter shell, SFTP Explorer rail, right Inspector rail, terminal-dominant center stage, and bottom transfer panel
- feature/editor-workbench-ui: the right Inspector now supports collapsible command history and narrow-width `Sessions` / `Health` / `History` tabs
- feature/editor-workbench-ui: SFTP Explorer view mode now persists as `Compact` / `Details`
- feature/editor-workbench-ui: settings/modal chrome and high-frequency compact controls now align with the refreshed workbench language
- feature/editor-workbench-ui: renderer UI regions were split out of `App.tsx` into focused settings, snippet, workbench-modal, UI-preference, and CSS modules
- feature/editor-workbench-ui: post-refactor `pnpm run typecheck`, `pnpm run build`, `pnpm run smoke:ui`, and `pnpm run smoke:ui:packaged` pass; latest workspace and packaged smoke are both `PASS 45 / FAIL 0 / SKIP 0`
- v0.1.22: global error recovery now routes hotkey/port-forward failures into `Hotkeys` / `Port Fwd`, and transfer failures can jump straight into `Retry Center` when history exists
- v0.1.22: error bar long messages now wrap instead of forcing horizontal scrolling
- v0.1.22: SFTP create-directory now treats "already exists" as success and gives clearer permission/path guidance on true failures
- v0.1.22: smoke now verifies the hotkey error recovery route in both workspace and packaged runs
- v0.1.21: `Settings > Workspace` now also exposes `Compact`, `Balanced`, and `Reading` editor-typography presets for alternate-screen terminal editors, separate from the editor theme selection
- v0.1.21: workspace/packaged smoke now verify the `Reading` typography preset path and the active editor pane refit behavior after the preset switch
- v0.1.21: `Settings > Workspace` now also exposes `System Mono`, `Coding Mono`, and `Drafting Mono` editor-font presets for alternate-screen terminal editors
- v0.1.21: workspace/packaged smoke now verify the `Drafting Mono` editor-font path against the actual focused xterm surface
- v0.1.21: `Settings > Workspace` now also exposes `Crisp`, `Steady`, and `Open` text-rhythm presets for alternate-screen terminal editors
- v0.1.21: workspace/packaged smoke now verify the `Open` text-rhythm path against the actual focused xterm spacing and font-weight metrics
- v0.1.21: `Settings > Workspace` now also exposes `Beam`, `Underline`, and `Block` editor-cursor presets for alternate-screen terminal editors
- v0.1.21: workspace/packaged smoke now verify the `Underline` cursor preset path against the focused xterm cursor shape
- v0.1.21: editor focus mode now compacts inactive tabs into smaller navigation pills so the active editor tab keeps most of the top-bar emphasis during multi-tab editing
- v0.1.20: alternate-screen terminal editors now trigger a focused layout that collapses side panels and tightens terminal chrome without rewriting editor content, and `Settings > Workspace` can disable that auto-focus behavior or switch between `Midnight`, `Graphite`, and `Paper` editor themes
- v0.1.20: smoke fixture shell now replays `printf` ESC sequences, and workspace/packaged smoke now verify editor focus mode enter/exit, theme selection, and the disabled-toggle path
- v0.1.19: batch SFTP uploads now recover from transient missing-path races and SSH SFTP channel pressure with targeted retries plus adaptive per-tab concurrency fallback
- v0.1.19: `Settings > SFTP` now supports transfer policy pack save/apply/import/export plus linked sync-file pull/push and optional auto-pull/auto-push
- v0.1.19: `Settings > SFTP` now adds one-click schedule presets, and smoke runs now use isolated per-run app profiles so saved settings do not bleed across workspace/packaged validation
- v0.1.18: `Settings > SFTP` now adds per-direction transfer rate limits plus queued-transfer weekday/time schedule windows
- v0.1.17: upload throughput now uses dedicated SFTP channels plus `fastPut`, default upload threads increased to `4`, and upload batches now prewarm remote directories with concurrent local folder expansion
- v0.1.16: GitHub Actions runtimes for packaged smoke and release were upgraded to current supported versions, and packaged smoke stayed green after the change
- v0.1.14: command snippets/playbooks v2 baseline, dangerous-command/workspace follow-up, and Operation Center tracked app jobs
- v0.1.15: remote-open/editor reliability hardening, per-tab port-forward and Operation Center summary hardening, and tab-scoped server-health/disconnect-report state tracking
- v0.1.15: smoke now verifies Windows preferred-opener launch/failure, remote-open conflict/reload/cleanup, live port-forward baseline, and unexpected disconnect-report capture
- v0.1.13: packaged smoke baseline, release preflight/verify tooling, and session templates baseline
- master (post-v0.1.13): added command snippets/playbooks v2 baseline with prompted parameters, regex validation, and preview-before-run
- master (post-v0.1.13): added command snippet scoped remembered values (`snippet/group/session/global`) plus reusable prompt sets
- master (post-v0.1.13): Operation Center now tracks session/snippet import-export jobs plus bug-report export with recent-job visibility
- master (post-v0.1.13): added dangerous-command shared safety bundles with local save/import/export/apply flows
- master (post-v0.1.13): added dangerous-command shared safety bundle sync-file pull/push for manual team distribution
- master (post-v0.1.13): added dangerous-command temporary approval scopes for exact-command tab/group approvals
- master (post-v0.1.13): added dangerous-command persistent exact-command approval policies from the bottom approval bar
- master (post-v0.1.13): added workspace profile mode (`dev` / `staging` / `prod`) with persistent risk cues and optional global Safety sync
- v0.1.12: session list double-click now explicitly opens a fresh terminal tab for the same session while other open flows still focus the existing tab
- master (post-v0.1.9): dangerous-command guardrails baseline with `Settings > Safety` and a fixed bottom approval bar
- master (post-v0.1.9): session open is now deduplicated by session id (open existing tab instead of creating duplicates)
- master (post-v0.1.9): command history panel now supports blank-area right-click menu (`Add` / `Import` / `Export` / `Manage`)
- master (post-v0.1.9): session JSON load/create/update now normalizes known mojibake text patterns for better data hygiene
- master (post-v0.1.9): expanded Electron smoke automation (`scripts/smoke-capture-all.mjs`) with latest full pass `31/31`
- master (post-v0.1.9): added self-use Windows release path with local self-signed certificate bootstrap, installer signing, and install smoke validation
- master (post-v0.1.9): added session templates baseline with template-scoped env vars and create/apply/manage flows
- master (post-v0.1.9): added transfer conflict policy (`overwrite/skip/rename`) for upload/download queueing
- master (post-v0.1.9): accelerated upload/download conflict pre-check using limited-concurrency directory scans
- master (post-v0.1.9): improved transfer disconnect behavior with queue pause + reconnect resume
- master (post-v0.1.9): added pending transfer queue restart recovery with one-click `Restore Pending` / `Discard Pending`
- master (post-v0.1.9): replaced intrusive transfer completion modal with dock-level inline completion notice
- master (post-v0.1.9): added batch failure detail logging for easier post-run triage
- master (post-v0.1.9): added session export actions in Sessions context menu:
  - `Export All Sessions...` exports JSON with session rows and group metadata
  - `Export All Groups...` exports JSON with group lists and nested sessions
- master (post-v0.1.9): added session JSON import wizard (`Import Sessions JSON...`) with group strategy and duplicate strategy selectors
- master (post-v0.1.9): added session quick profiles (`Run` / `Save` / `Manage`) for startup command reuse
- master (post-v0.1.9): added command snippet groups baseline with grouped run/manage/import/export flows
- master (post-v0.1.9): added `Retry Failed` actions in transfer dock (upload/download)
- master (post-v0.1.9): added persistent failed-transfer history per session; `Retry Failed` now works after restart
- master (post-v0.1.9): added Transfer Retry Center modal with filters, batch retry, and history cleanup
- master (post-v0.1.9): added Retry Center analytics cards and snapshot export (`JSON` / `CSV`)
- master (post-v0.1.9): Retry Center top failure reasons now include contextual suggestion rows for faster triage
- master (post-v0.1.9): improved Retry Center with time-range filter, persisted filter view, and one-click `Retry Visible Failed`
- master (post-v0.1.9): Retry Center now supports failure-reason quick filter and one-click retry by top failure reason for active session
- master (post-v0.1.9): Retry Center top-failure card now supports visible delete-by-reason for faster failed-history cleanup
- master (post-v0.1.9): Retry Center now supports grouped-by-failure list mode with collapsible sections
- master (post-v0.1.9): grouped Retry Center view now supports group-level select/retry/delete actions
- master (post-v0.1.9): grouped Retry Center view now supports group-level JSON/CSV export for targeted diagnostics handoff
- master (post-v0.1.9): grouped Retry Center export now supports scope selection (`All` / `Failed` / `Retryable Active Session`)
- master (post-v0.1.9): grouped Retry Center retry action now supports scope selection (`All Retryable` / `Upload Only` / `Download Only`)
- master (post-v0.1.9): `Retry Visible Failed` now supports scope selection (`All Retryable` / `Upload Only` / `Download Only`)
- master (post-v0.1.9): `Retry Selected Failed` now supports scope selection (`All Retryable` / `Upload Only` / `Download Only`)
- master (post-v0.1.9): top-failure-reason quick retry now uses retry-scope strategy (chooser or auto last scope)
- master (post-v0.1.9): added one-click `Retry All Failed` (upload + download) in transfer dock, retry center, and operation center with retry-scope strategy
- master (post-v0.1.9): Retry Center action bar now includes direction-specific quick actions (`Retry Failed Uploads` / `Retry Failed Downloads`)
- master (post-v0.1.9): added large-batch retry confirmation guardrail with configurable threshold (`Retry Confirm Threshold`, default: `100`, set `0` to disable)
- master (post-v0.1.9): `Settings > SFTP` now also exposes `Retry Confirm Threshold` for global adjustment
- master (post-v0.1.9): retry-scope chooser now remembers and prioritizes last used scope (`Last Used`) across restart
- master (post-v0.1.9): added `Default Retry Scope` selector (all/upload/download) for manual retry-strategy preselection
- master (post-v0.1.9): added `Auto Retry Scope` toggle in Retry Center to skip chooser and apply last used scope directly
- master (post-v0.1.9): added SSH config import baseline with preview and duplicate strategy
- master (post-v0.1.9): hardened SSH config parser with recursive `Include` and wildcard/negation host merge
- master (post-v0.1.9): added port forwarding baseline in `Settings > Port Fwd` (Local / Remote / Dynamic SOCKS5)
- master (post-v0.1.9): added saved port forwarding presets with one-click apply and optional auto-restore on connect
- master (post-v0.1.9): added port forwarding runtime status view (`Active` / `Degraded`) with last-error and activity metadata
- master (post-v0.1.9): added port forwarding recent event timeline and one-click diagnostics snapshot export
- master (post-v0.1.9): added persisted port forwarding event history (session scope), with filter and clear actions
- master (post-v0.1.9): added port forwarding visible-event analytics cards and analytics export (`JSON` / `CSV`)
- master (post-v0.1.9): upgraded forwarding snapshot export to save `.txt` file with clipboard path copy
- master (post-v0.1.9): added diagnostics logging baseline and `Settings > Diagnostics` log tools
- master (post-v0.1.9): hardened diagnostics writer with async queued writes and multi-file rotation retention
- master (post-v0.1.9): added automatic disconnect report capture with diagnostics-panel JSON export/copy/clear actions
- master (post-v0.1.9): `Export Bug Report` now includes disconnect-report snapshot payload for one-file issue handoff
- master (post-v0.1.9): disconnect reports now support CSV export, copy-latest action, and diagnostics auto-capture toggle
- master (post-v0.1.9): global error bar now adds `Copy Latest Disconnect` when reports exist
- master: global error bar now routes high-frequency error types directly to `Connection Settings`, `File Opening`, `Hotkeys`, `SFTP Settings`, `Port Fwd`, `Retry Center`, `Operation Center`, or `Export Bug Report` when that path is more specific than generic diagnostics
- master (post-v0.1.9): disconnect reports now support filters (scope/trigger/time/query) and visible-only export/clear
- master (post-v0.1.9): added recoverable global error bar actions (`Reconnect`, `Open Logs`, `Diagnostics`, `Copy Error`)
- master (post-v0.1.9): added operation center baseline modal for active long-running operation visibility
- master (post-v0.1.9): added cross-tab transfer activity summary and focus action inside Operation Center
- master (post-v0.1.9): added per-tab and all-tab transfer cancellation actions inside Operation Center
- master (post-v0.1.9): added per-tab and bulk reconnect actions for disconnected transfer tabs inside Operation Center
- master (post-v0.1.9): added one-click bug report export (`zip` bundle of logs + metadata + settings snapshot)
- master (post-v0.1.9): added transfer soak-test tool (`scripts/soak-transfer.mjs`) and runbook (`SOAK_TEST.md`)
- master (post-v0.1.9): reduced transfer-time disconnect risk by preventing overlapping server monitor polling per tab
- master (post-v0.1.9): stabilized terminal rendering on small windows with deferred/font-ready xterm refit
- master (post-v0.1.9): remote open-file auto-sync now guards against silent overwrite via remote metadata baseline check
- master (post-v0.1.9): added hotkey conflict checker in `Settings > Hotkeys` with inline row highlights/badges and one-click auto resolve
- master (post-v0.1.9): added hotkey JSON backup/restore actions (`Import Hotkeys...` / `Export Hotkeys...`)
- master (post-v0.1.9): hotkey import now previews action-level before/after changes before apply
- master (post-v0.1.9): hotkey import now reports conflict count and adds `Import + Auto Resolve` option
- master (post-v0.1.9): hotkey import preview now lists which actions auto-resolve will disable
- master (post-v0.1.9): hotkey conflict panel now supports `Locate` / `Focus First Conflict` row navigation
- master (post-v0.1.9): hotkey conflict panel now supports `Prev` / `Next` traversal with active conflict index
- master (post-v0.1.9): hotkey conflict traversal now supports keyboard shortcuts (`Alt + [` / `Alt + ]`)
- master (post-v0.1.9): hotkey conflict cursor now persists locally and restores by signature
- master (post-v0.1.9): fixed settings footer overlap on shorter window heights
- v0.1.9: blocked raw wheel mouse-report text artifacts (`%6`, `%9`) in alternate-buffer editor scenarios
- v0.1.8: refined terminal wheel mapping to reduce blank-line/jump effects in full-screen editors
- v0.1.7: improved wheel-scroll reliability in alternate-buffer editors by capturing terminal wheel events
- v0.1.6: terminal wheel scrolling fix for alternate-buffer editors (`nano`, `vim`)
- v0.1.4: settings version display, batch session/group operations, tab close menu expansion, move-to-group dropdown
- Server health baseline and detail drill-down
- Alert thresholds for CPU/memory/disk
- Folder-style session grouping
- Split transfer dock with queue stats and cancel-all actions
- Remote file open deduplication and auto-upload on save
- Windows hotkey defaults use `Ctrl+Shift+C` / `Ctrl+Shift+V`
- UI icon system upgraded to `lucide-react`

## Current Top Problems to Solve

1. The refreshed workbench needs a final live design-nit pass for inspector tabs, bottom transfer density, and modal chrome
2. Packaged smoke remains optional before release or broad handoff
3. Global recoverable error UX still needs broader action coverage/guidance
4. Operation center now tracks more app jobs, but richer timeline and grouped controls are still limited
5. Large transfer/folder edge cases still need hardening
6. SQLite migration and credential-safe encrypted backup/restore are not complete
7. Cross-platform smoke test coverage is still incomplete, but that is currently low priority for this self-use workflow
8. Public-trust installer signing/notarization workflow is not finalized, but that is currently low priority for this self-use workflow
9. Automated unit/integration regression coverage is still weak, but that is currently low priority for this self-use workflow

## Next Candidate Features

- Editor-workbench follow-up after verification: command palette, split panes, and richer editor-style layout affordances
- Session templates v2 (runtime prompts, import/export, layered presets)
- Command snippets/playbooks v2 follow-up with richer playbook workflows and validation packs
- Dangerous-command follow-up with workspace-scoped defaults and richer shared distribution
- Command palette / universal action launcher
- Remote file diff-first preview before overwrite/save-back
- Session health checks with proactive risk badges
- Session notes / runbook annotations
- Operation audit timeline (command + transfer traceability)
- Deeper retry-center longitudinal analytics and clustering
- Split-pane terminal layouts for parallel command work
- Detach/clone tab into a new window or pane
- Recent directories / quick `cd` launcher
- Shell integration for command history, cwd tracking, and automatic profile switching
- Shared encrypted team vault / workspace sync for shared hosts and snippets

## Long-Range Exploration (Unprioritized)

- Operation audit timeline (command + transfer traceability)
- Disconnect auto-diagnostic v2 with deeper network/process evidence
- Diff-first sync mode (preview before apply)
- Session health checks with proactive risk badges
- Team session bundle (encrypted import/export)
- Temporary authorization mode for risky operations
- Environment policy templates (`dev` / `staging` / `prod`)
- Crash dump + symbolized stack pipeline
- Release channel management (`stable` / `beta` / `canary`)
- Accessibility and hotkey conflict checker
- Plugin extension hooks for external ops integrations
- Built-in command allowlist/denylist policy packs
