# TermDock Task Board

Last updated: 2026-05-10

## Current Release State

- Stable release: `v0.1.22`
- Active branch: `feature/editor-workbench-ui`
- Branch baseline: `origin/feature/editor-workbench-ui`
- Priority direction: keep editor-workbench branch shippable while resuming self-use runtime hardening and workflow quality

## P0 Matrix

| ID | Status | Notes |
| --- | --- | --- |
| P0-A1 | DONE | Electron + React + TypeScript baseline is stable |
| P0-A2 | DONE | Core multi-pane shell workflow is stable |
| P0-A3 | PARTIAL | JSON persistence works; SQLite migration pending |
| P0-A4 | DONE | Secure credential storage via keytar/fallback |
| P0-A5 | PARTIAL | Structured logging module baseline landed (main+renderer, file logs, diagnostics panel) |
| P0-B1 | PARTIAL | Session list/search/favorite done; deeper group model pending |
| P0-B2 | PARTIAL | Session form is usable; stronger validation/bulk flows pending |
| P0-B3 | DONE | Delete with confirmation |
| P0-B4 | PARTIAL | Recency tracking exists; dedicated recent table pending |
| P0-B5 | PARTIAL | Favorite flow exists; grouped-favorite polish pending |
| P0-C1 | DONE | xterm rendering |
| P0-C2 | DONE | SSH password/private-key auth |
| P0-C3 | DONE | Terminal IO stream wiring |
| P0-C4 | DONE | Multi-tab terminal sessions |
| P0-C5 | PARTIAL | KeepAlive + auto reconnect done; extra manual recovery UX pending |
| P0-C6 | DONE | Platform-aware hotkeys |
| P0-C7 | DONE | Same-session dedupe open policy (focus existing tab) |
| P0-C8 | DONE | Terminal context menu |
| P0-D1 | DONE | SFTP channel reuse via active tab |
| P0-D2 | PARTIAL | SFTP panel is usable; final polish pending |
| P0-D3 | PARTIAL | Browse/open/refresh works; edge error states still improving |
| P0-D4 | PARTIAL | Queue/progress/cancel done; monitor contention plus upload directory-race/channel-backpressure hardening landed, long-run stress tuning still pending |
| P0-D5 | PARTIAL | Create/rename/delete done; recursive safety flows still evolving |
| P0-D6 | PARTIAL | Drag-and-drop works; very large folder workflows need more tuning |
| P0-E1 | TODO | Startup performance benchmark/optimization |
| P0-E2 | TODO | Large transfer memory optimization |
| P0-E3 | PARTIAL | Recoverable global error routing now covers disconnect copy, `Workspace` / `Safety` / `Hotkeys` / `Monitor` / `Port Fwd` / `Retry Center` / `Diagnostics` routing, and bug-report/export guidance; deeper edge-case coverage is still pending |
| P0-E4 | TODO | Persistence crash-recovery verification |
| P0-F1 | TODO | Unit tests; low priority for current self-use track |
| P0-F2 | TODO | Integration tests; low priority for current self-use track |
| P0-F3 | PARTIAL | Automation/report baseline plus embedded live SSH/SFTP, remote-open-file save-back, unexpected-disconnect, and SFTP fault-recovery smoke landed; remaining macOS evidence and targeted external-host validation are low priority for current self-use track |
| P0-F4 | PARTIAL | Release preflight/verify baseline and self-use Windows path landed; public-trust signing secret provisioning and first signed/notarized evidence are low priority for current self-use track |
| P0-G1 | DONE | Server health panel baseline plus tab-scoped monitor-state hardening shipped |

## In Progress Track (v0.1.3+)

0. Active editor-workbench UI branch:
   - shell, sidebars, terminal stage, transfer dock, and modal chrome have been refreshed into a flatter code-editor workbench language
   - SFTP explorer now has persisted `Compact` / `Details` view modes
   - right inspector now supports collapsible command history and narrow-width `Sessions` / `Health` / `History` tabs
   - large renderer UI regions were split into focused modules for settings, workbench modals, command snippets, UI preferences, and separated workbench/terminal CSS
   - multilingual baseline now exposes persisted English/Simplified Chinese interface selection in `Settings > Workspace`, with Chinese coverage for high-frequency workbench surfaces including Operation Center and Retry Center
   - post-refactor `pnpm run typecheck` passed
   - post-refactor `pnpm run build` passed
   - post-refactor `pnpm run smoke:ui` passed with `PASS 45 / FAIL 0 / SKIP 0`
   - post-refactor `pnpm run smoke:ui:packaged` passed with `PASS 45 / FAIL 0 / SKIP 0`
   - hardening follow-up `pnpm run typecheck`, `pnpm run build`, and `pnpm run smoke:ui` passed on 2026-05-10 with `PASS 46 / FAIL 0 / SKIP 0` at `artifacts/smoke/2026-05-10T07-36-38-904Z/summary.json`
0. UI compactness and list-shell stability governance:
   - enforce compact density defaults across pages
   - enforce fixed-height list shells with internal scrolling
   - keep rulebook in `UI_COMPACT_RULES.md` and require it for UI review
0.1 Session/command interaction hardening:
   - same-session repeated open now focuses existing tab
   - command-history blank-area right-click menu now available
   - startup session text normalization for known mojibake patterns
   - dangerous-command guardrails now intercept risky terminal writes with a fixed bottom approval bar and `Settings > Safety` controls, covering keyboard, clipboard, history, snippets, quick profiles, and startup commands
   - `Settings > Safety` now supports per-source toggles plus session-group pack/template overrides
   - approval bar now supports exact-command temporary scopes for the current tab or current session group
   - local shared safety-bundle catalog now supports save/import/export/apply flows
1. `P0-F3` Cross-platform smoke checklist and reproducible report
   - packaged smoke script now supports report generation (`summary.json` + `full-test-matrix.md`)
   - packaged executable path override is available for Windows/macOS validation
   - GitHub Actions packaged smoke workflow now runs on Windows/macOS runners and uploads smoke artifacts
   - embedded SSH/SFTP fixture now verifies live auth/connect, approval-bar flow, SFTP list/upload/download/delete, remote-open-file save-back conflict warnings, and unexpected disconnect-report capture without an external host
2. `P0-F4` Signing/notarization strategy and installation verification
   - `scripts/release-preflight.mjs` now validates Windows signing and macOS signing/notarization inputs before release build
   - `scripts/prepare-release-secrets.mjs` now materializes `APPLE_API_KEY_B64` into a temporary `.p8` path for CI notarization
   - `scripts/set-release-secrets.mjs` now supports seeding repo secrets from local cert/key files via `gh`
   - `scripts/verify-release-artifacts.mjs` now validates artifact presence and platform-specific release expectations
   - `scripts/create-self-use-windows-cert.ps1` now creates/reuses a local self-signed code-signing cert for private Windows release use
   - `scripts/build-self-use-windows-release.mjs` now signs `win-unpacked` + installer and verifies signature presence plus install smoke
   - Windows release verification now includes silent installer install/uninstall smoke
   - `.github/workflows/release.yml` now runs preflight + verify and uploads `artifacts/release-verify/**`
3. `F6` Session templates + env variables
   - local session-template store now persists template definitions and template-scoped env vars
   - create/edit session modal now supports `Apply Template...`, `Save as Template...`, and `Manage Templates...`
   - sessions context menu now supports `New Session From Template...` and `Save as Session Template...`
   - template application resolves `${ENV_NAME}` placeholders into concrete session form values before save/test
4. `P0-E3` Global error recovery follow-up (broader action coverage + guidance)
5. Transfer hardening for cancel races and large directory jobs
6. `F8` Operation center follow-up (baseline landed; broaden operation coverage)

## Post-v0.1.9 Hotfix Track (master)

1. Transfer + monitor contention hardening:
   - prevent overlapping monitor requests per tab
   - pause silent monitor polling during active transfer bursts
2. Terminal viewport stabilization:
   - deferred multi-pass fit on connect/activate
   - font-ready refit for packaged startup and small-window scenarios
3. Field validation:
   - verify no random disconnect regressions during large batch upload tests
   - verify no small-window editor rendering corruption
4. Soak tooling:
   - added `scripts/soak-transfer.mjs`
   - added `SOAK_TEST.md` runbook and matrix
5. Diagnostics logging baseline:
   - main process file logger with rotation
   - renderer global error/rejection auto-capture
   - `Settings > Diagnostics` log path actions
   - bug-report export now bundles disconnect-report snapshot when available
6. Transfer safety baseline:
   - conflict policy (`overwrite/skip/rename`) for upload/download
   - `Retry Failed` actions for upload/download docks
7. Retry persistence baseline:
   - failed transfer history persisted in local storage by session scope
   - `Retry Failed` now reuses persisted failures after app restart
8. Retry center baseline:
   - added transfer retry center modal with filter/search/select
   - supports batch retry and batch delete for persisted history records
   - added time-range filter and persisted retry-center filter view
   - added failure-reason filter, quick retry by top failure reason (active session, scope strategy aware), and visible delete by reason
   - added grouped-by-failure list mode with collapsible groups (`Flat` / `Grouped by Failure`)
   - grouped view now includes group-level select/retry/delete/export actions
   - grouped export now supports scope selection (`All` / `Failed` / `Retryable Active Session`)
   - grouped retry now supports scope selection (`All Retryable` / `Upload Only` / `Download Only`)
   - `Retry Visible Failed` now supports scope selection (`All Retryable` / `Upload Only` / `Download Only`)
   - `Retry Selected Failed` now supports scope selection (`All Retryable` / `Upload Only` / `Download Only`)
   - added one-click `Retry All Failed` (upload + download) in transfer dock, retry center, and operation center (scope strategy aware)
   - Retry Center action bar now includes direction-specific quick actions (`Retry Failed Uploads` / `Retry Failed Downloads`)
   - added large-batch retry confirmation guardrail with configurable threshold (`Retry Confirm Threshold`, default: `100`, set `0` to disable)
   - `Settings > SFTP` now also exposes `Retry Confirm Threshold` for global adjustment
   - retry-scope chooser now remembers and prioritizes last used scope (`Last Used`) across restart
   - added `Default Retry Scope` selector (all/upload/download) for manual retry-strategy preselection
   - added `Auto Retry Scope` toggle to skip scope chooser and apply last used scope directly when available
9. SSH config import baseline:
   - `sessions:parseSshConfig` parser for common directives
   - sessions context-menu import flow with preview and duplicate strategy
   - parser hardening: recursive `Include` support + `Host` wildcard/negation merge behavior
10. Port forwarding baseline:
   - `Settings > Port Fwd` panel
   - Local / Remote / Dynamic (`SOCKS5`) create, list, remove
   - bound to active terminal tab and auto-cleaned on disconnect/close
   - saved presets per session with optional auto-restore on connect
   - runtime status (`Active` / `Degraded`) and last-error metadata
   - recent events and diagnostics snapshot export for issue reporting
   - persisted event history (session scope) with filter and clear actions
   - visible-event analytics cards (error ratio, type mix, top error code/correlation)
   - analytics export (`JSON` / `CSV`) for filtered visible events
11. Session export baseline:
   - added `Export All Sessions...` in Sessions context menu
   - added `Export All Groups...` in Sessions context menu
   - exports JSON with group hierarchy and session metadata
   - save dialog export path with clipboard fallback
12. Transfer UX and diagnostics polish:
   - conflict pre-check now uses limited-concurrency directory scans
   - disconnected transfer queues now pause and auto-resume after reconnect
   - transfer completion success path switched from modal popup to dock inline notice
   - batch failure details logged for diagnostics handoff
   - logger write path switched to async queue with expanded archive retention
13. Retry-center analytics + export package:
   - top failure reason aggregation for visible failed history
   - analytics snapshot export (`JSON` / `CSV`)
   - history export stats now include top sessions/groups/failure reasons
14. Recoverable global error UX baseline (`P0-E3`):
   - upgraded global error bar with quick actions (`Reconnect`, `Open Logs`, `Diagnostics`, `Copy Error`)
   - added `Copy Latest Disconnect` quick action when disconnect reports exist
   - contextual recovery hints for connection/bridge related errors
   - high-frequency error types now route directly to `Connection Settings`, `Workspace`, `Safety`, `File Opening`, `Hotkeys`, `Monitor`, `SFTP Settings`, `Port Fwd`, `Retry Center`, `Operation Center`, `Diagnostics`, or `Export Bug Report` when that recovery path is more specific than generic diagnostics
   - Safety sync failures now retain contextual error-bar text and have smoke coverage for routing back to `Settings > Safety`
15. Operation center baseline (`F8`):
   - added `Operation Center` modal with active long-running operation summary
   - includes upload/download queue status, remote delete status, and port-forward busy status
   - includes unified activity timeline entries for recent/current transfer, delete, port-forward, and app-job events
   - includes grouped controls for transfer-wide, active-tab, and tool/navigation actions
   - quick actions for transfer cancel-all and navigation to diagnostics/port-forward settings
   - includes cross-tab transfer activity summary with tab focus action
   - includes per-tab and cross-tab one-click transfer cancellation actions
   - includes per-tab and bulk reconnect actions for disconnected transfer tabs
   - now also tracks session import/export, snippet import/export, and bug-report export jobs
16. Disconnect auto-diagnostic baseline (`F22`):
   - unexpected terminal `closed/error` events now auto-capture runtime context snapshots
   - `Settings > Diagnostics` now exposes disconnect report list with JSON/CSV export, copy-latest, and clear actions
   - added diagnostics auto-capture toggle for disconnect reports
   - added report filters (`scope` / `trigger` / `time range` / `search`) and visible-only export/clear
17. Hotkey conflict checker baseline (`F30` partial):
   - `Settings > Hotkeys` now detects conflicting enabled bindings
   - conflicting actions are highlighted inline in each hotkey row
   - one-click `Auto Resolve Conflicts` keeps first action by priority and disables duplicates
   - supports hotkey JSON backup/restore (`Import Hotkeys...` / `Export Hotkeys...`)
   - hotkey import now includes before/after diff preview before apply
   - hotkey import now reports imported conflict count and supports `Import + Auto Resolve`
   - import preview now lists auto-resolve disable-impact before confirmation
   - hotkey conflict panel now includes `Locate` and `Focus First Conflict` row navigation
   - hotkey conflict panel now includes `Prev` / `Next` conflict navigation with active index
   - hotkey conflict navigation now includes keyboard shortcuts (`Alt + [` / `Alt + ]`)
   - hotkey conflict cursor position now persists locally and restores by signature
18. Session import + quick-profile baseline:
   - added `Import Sessions JSON...` in Sessions context menu
   - import wizard supports group strategy (`keepSource` / `forceCurrent` / `ungrouped`)
   - import wizard supports duplicate strategy (`skip` / `overwrite` / `rename`)
   - added quick profile actions (`Run` / `Save` / `Manage`) on session context menu
19. Command snippet groups baseline:
   - command history panel now exposes `Run Snippet` and `Snippet Manager`
   - snippet manager supports add/import/export/clear grouped snippets
   - snippet templates support clipboard/time/session/tab placeholders
20. Command snippets/playbooks v2 baseline:
   - snippet editor now supports named parameters with required/default/regex validation
   - parameterized snippets now prompt for values and preview resolved commands before execution
   - snippet editor now highlights missing/unused parameter tokens
   - scoped remembered values now support snippet/group/session/global reuse
   - reusable prompt sets can now be shared across snippets inside a group
21. Transfer restart recovery baseline:
   - pending transfer queue snapshots persist for restart recovery
   - transfer dock provides one-click `Restore Pending` and `Discard Pending`
21. Remote file save-back guard baseline:
   - auto-sync save-back checks remote metadata baseline (`exists` / `size` / `mtime`)
   - skips unsafe overwrite when remote file changed unexpectedly
   - reopen with an unsynced local draft now prompts the user to reuse or discard+reload instead of silently reusing stale temp content
   - temp remote-open files are cleaned on tab/app dispose, and background-tab save-back failures remain visible per tab
22. Retry-center guidance baseline:
   - top failure reasons now show contextual suggestions for faster triage

## Immediate Next Target

1. `UI-WB-HANDOFF`: push or PR `feature/editor-workbench-ui` with current workspace and packaged smoke evidence
2. `UI-WB-FEEDBACK`: collect real-usage feedback on the refreshed workbench shell
3. `P0-E3`: continue global error recovery follow-up for remaining edge cases and guidance copy
4. `F8`: Operation Center follow-up (broader cancel/retry coverage)
5. `P0-A3`/`F9`: persistence hardening (`SQLite` migration planning + credential-safe backup/restore)
6. `P0-E1`/`P0-E2`: startup and large-transfer performance follow-up

## Not Done Yet (Top Blocking Items)

1. `UI-WB-FEEDBACK`: optional polish after real usage feedback
2. Remaining macOS/external-host packaged smoke evidence for broader release confidence
3. `P0-E3`: remaining recoverable global error edge-case coverage and guidance polish
4. `F8`: broader cancel/retry coverage for Operation Center
5. `P0-A3`: JSON-to-SQLite migration planning and execution
6. `P0-E1`/`P0-E2`: startup and large-transfer performance optimization
7. `P0-F3`: remaining macOS/external-host packaged validation, low priority for current self-use track
8. `P0-F4`: public-trust signing/notarization evidence, low priority for current self-use track
9. `P0-F1`/`P0-F2`: unit and integration test baseline, low priority for current self-use track

## Backlog Candidates

- Snippets and command palette / universal launcher
- Remote file quick-edit advanced flow
- Multi-host command broadcast
- Advanced retry-center analytics and history export
- Session tags and smart views
- Terminal recording and replay export
- Dangerous-command workspace-aware policy follow-up
- Remote file diff-first preview before overwrite/save-back
- Session health checks + proactive risk badges
- Session notes / runbook annotations
- Operation audit timeline (command/transfer traceability)
- Split-pane terminal layouts
- Detach/clone current tab into a new window or pane
- Recent directories / quick `cd` launcher
- Shell integration for command history, cwd tracking, and automatic profile switching
- Shared encrypted team vault / workspace sync for shared hosts and snippets
- Recurring folder sync profiles
- Connection quality timeline dashboard
- Workspace profile follow-up (broader automation and shared defaults)
- Editor-workbench follow-up: command palette, split panes, and richer editor-style layout affordances

## Exploration Pool (Unprioritized)

- Operation audit timeline (command/transfer actor+scope tracking)
- Disconnect auto-diagnostic v2 (deeper network/process evidence)
- Diff-first sync mode (preview then apply)
- Session health checks with proactive risk badges
- Team session bundle (encrypted)
- Temporary authorization mode for risky operations
- Environment policy templates (`dev` / `staging` / `prod`)
- Crash dump and symbolized stack pipeline
- Release channel management (`stable` / `beta` / `canary`)
- Accessibility and hotkey conflict checker
- Plugin extension hooks (ticketing/CMDB/alerts)
- Command allowlist/denylist policy packs

## Proposed Feature Track (Post-Hardening)

| ID | Priority | Status | Feature | Why |
| --- | --- | --- | --- | --- |
| F1 | P1 | DONE | Transfer conflict policy (overwrite/skip/rename) | Prevent accidental overwrite and clarify current behavior |
| F2 | P1 | DONE | Transfer retry center + persistent history | Fast recovery after network interruption or cancel race |
| F3 | P1 | DONE | Bug report bundle export | Fast support loop with one-click diagnostic package |
| F4 | P1 | DONE | SSH config import (`~/.ssh/config`) | Reduce manual session creation for existing users |
| F5 | P1 | DONE | Port forwarding manager (L/R/Dynamic + presets + diagnostics timeline) | Cover common SSH tunnel workflows without external tools |
| F6 | P2 | DONE | Session templates + env variables | Local template manager, env-var substitution, and create/apply flows now cover repeated host patterns |
| F7 | P2 | PARTIAL | Remote overwrite pre-check (mtime/size/checksum) | Metadata guard baseline shipped; conflict resolution UI/diff follow-up pending |
| F8 | P2 | PARTIAL | Unified operation center for long jobs | Transfer/delete/port-forward baseline, tracked session/snippet/diagnostics jobs, unified activity timeline, and grouped controls landed; broader cancel/retry coverage is still pending |
| F9 | P3 | PARTIAL | Session/group export baseline (JSON) + encrypted import/export follow-up | Basic export shipped; credential-safe backup/restore still pending |
| F10 | P2 | TODO | SSH jump-host chain builder | Simplify bastion/proxy workflows without manual `ProxyJump` typing |
| F11 | P2 | PARTIAL | Transfer bandwidth limiter + schedule window | Per-direction rate limits, queued-transfer weekday/time windows, one-click schedule presets, exact next-boundary wake-up with next-resume hints, transfer policy pack save/apply/import/export plus linked sync-file pull/push and optional auto-pull/auto-push, and upload reliability auto-recovery from transient missing-path plus SSH channel-pressure faults landed; richer schedule automation and auto-distribution are still pending |
| F12 | P2 | PARTIAL | Command snippets/playbooks with parameter prompts | Prompted variables, scoped remembered values, reusable prompt sets, regex validation, and preview-before-run landed; richer playbook workflows and validation packs are still pending |
| F13 | P2 | TODO | Multi-host command broadcast with dry-run preview | Speed up fleet operations while reducing blast radius |
| F14 | P3 | TODO | Remote file snapshot + one-click rollback | Recover quickly from accidental edits during remote file open/save |
| F15 | P2 | TODO | Session tags + smart views | Faster large-session navigation and operator context switching |
| F16 | P2 | TODO | Terminal recording/replay export | Improve incident review and asynchronous debugging collaboration |
| F17 | P1 | PARTIAL | Dangerous-command guardrails | Policy packs, environment templates, per-source toggles, session-group overrides, temporary exact-command approval scopes, persistent exact-command approval policies, shared-bundle import/export/apply plus manual shared sync-file pull/push, and workspace-profile sync landed; richer workspace-scoped defaults and distribution follow-up are still pending |
| F18 | P2 | TODO | Recurring folder sync profiles | Simplify repeated deployment/content sync workflows |
| F19 | P2 | TODO | Connection quality timeline | Make intermittent network/session issues measurable and diagnosable |
| F20 | P3 | DONE | Workspace profile mode (`dev`/`staging`/`prod`) | Persistent risk cues plus optional global Safety sync now reduce environment mix-ups |
| F21 | P2 | TODO | Operation audit timeline | Improve traceability for command/transfer actions during incidents |
| F22 | P1 | PARTIAL | Disconnect auto-diagnostic report | Baseline shipped (auto-capture + diagnostics export); deeper network/process evidence still pending |
| F23 | P2 | TODO | Diff-first sync mode | Reduce accidental overwrite risk by previewing remote/local deltas |
| F24 | P2 | TODO | Session health checks + risk badges | Surface unsafe session state before users run critical operations |
| F25 | P3 | TODO | Team session bundle (encrypted) | Simplify secure onboarding and workspace migration for teams |
| F26 | P2 | TODO | Temporary authorization mode | Add time-limited safety controls for high-risk operations |
| F27 | P2 | TODO | Environment policy templates | Standardize timeout/concurrency/alerts across environments |
| F28 | P1 | TODO | Crash dump + symbolized stack pipeline | Improve post-crash triage speed and release confidence |
| F29 | P2 | TODO | Release channel manager | Make stable/beta/canary rollout and rollback guidance explicit |
| F30 | P2 | PARTIAL | Accessibility + hotkey conflict checker | Conflict checker + auto-resolve shipped; broader accessibility coverage still pending |
| F31 | P3 | TODO | Plugin extension hooks | Enable ecosystem integrations without forking core product |
| F32 | P2 | TODO | Command allowlist/denylist policy packs | Provide environment-aware guardrails for dangerous command patterns |
| F33 | P2 | DONE | Session-scoped default transfer conflict strategy | Reduce repeated overwrite/skip/rename prompts during repeated folder jobs |
| F34 | P2 | DONE | Session quick profiles baseline | Reuse named startup command profiles without duplicating sessions |
| F35 | P1 | DONE | Pending transfer queue restore/discard | Recover queued/running transfer intent after restart |
| F36 | P2 | DONE | Session JSON import merge wizard baseline | Import external sessions with explicit merge/group policy |
| F37 | P2 | PARTIAL | Transfer failure suggestion knowledge base | Retry-center top-failure suggestion rows shipped; rule depth can expand |
| F38 | P2 | TODO | Command palette / universal launcher | Speed up navigation and reduce menu hunting |
| F39 | P2 | TODO | Remote file diff-first preview before overwrite/save-back | Reduce accidental overwrite risk during remote file edits |
| F40 | P2 | TODO | Session notes / runbook annotations | Keep operator notes close to the session they describe |
| F41 | P2 | TODO | Split-pane terminal layouts | Make side-by-side command work and comparisons faster |
| F42 | P2 | TODO | Detach/clone current tab into a new window or pane | Reuse an active session layout without rebuilding context |
| F43 | P2 | TODO | Recent directories / quick `cd` launcher | Speed up filesystem navigation on busy hosts |
| F44 | P2 | TODO | Shell integration for command history and cwd tracking | Improve recent command/directory awareness and automatic profile switching |
| F45 | P2 | TODO | Shared encrypted team vault / workspace sync | Keep hosts, snippets, and port-forward presets aligned across a team |
