# TermDock Progress

Last updated: 2026-03-08

## Snapshot

- Stable release shipped: `v0.1.10`
- Master branch includes post-`v0.1.9` hardening plus transfer safety, diagnostics, and port forwarding baseline updates
- Milestone status:
  - `M0` (technical validation): complete
  - `M1` (MVP hardening): in progress
- P0 totals:
  - `DONE`: 13
  - `PARTIAL`: 13
  - `TODO`: 7

## Release Readiness

- Current quality: suitable for early production and power users
- Not fully GA-hardened yet
- Minimum gates before broad rollout:
  - `P0-F3`: cross-platform smoke tests
  - `P0-F4`: installer signing/notarization and install validation
  - `P0-E3`: recoverable global error UX

## Completed in v0.1.10

- Port forwarding presets with optional auto-restore
- Runtime status/failure visibility (`Active` / `Degraded`, counters, last error/activity)
- Recent forwarding events and snapshot export
- Session-scoped persisted forwarding event history with filter and clear actions
- SSH config parser hardening (`Include`, wildcard/negation merge)
- Diagnostics bug-report export workflow

## Completed in v0.1.9

- Added protection to block raw wheel mouse-report sequences while mouse tracking is active
- Eliminated `%6`/`%9`-style garbage text artifacts caused by wheel input in full-screen editor modes

## In Progress on master (next patch)

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
- Packaging pipeline exists but final signing/notarization policy is incomplete
- Some SFTP recursive/safety operations still need hardening
- Port forwarding diagnostics are persisted locally, but richer correlation metadata/export workflow is still pending
- Server health currently relies on Linux `/proc` and single-root disk sampling

## Next Focus

1. Finish port forwarding diagnostics polish (`F5+`)
2. Add retry-center analytics + export package (`F2+`)
3. Execute and document full macOS/Windows smoke checklist (`P0-F3`)
4. Finalize signing/notarization path and verify installer flows (`P0-F4`)
5. Build recoverable global error actions and guidance (`P0-E3`)

## Feature Candidates After Hardening

1. Advanced retry-center analytics and history export
2. Session templates for repeated infrastructure patterns
3. SSH jump-host chain builder for bastion environments
4. Transfer bandwidth limiter and schedule window
5. Command snippets/playbooks with parameter prompts
6. Multi-host command broadcast with dry-run preview
7. Remote file snapshot and rollback workflow
8. Session tags and smart saved views
9. Terminal session recording/replay export
10. Dangerous-command guardrails
11. Recurring folder sync profiles
12. Connection quality timeline dashboard
13. Workspace profile mode with environment risk cues
14. Operation audit timeline (command/transfer traceability)
15. Disconnect auto-diagnostic report with runtime context capture
16. Diff-first sync mode (preview changes before apply)
17. Session health checks and proactive risk badges
18. Team session bundle (encrypted import/export)
19. Temporary authorization mode for risky operations
20. Environment policy templates (`dev` / `staging` / `prod`)
21. Crash dump and symbolized stack pipeline
22. Release channel management (`stable` / `beta` / `canary`)
23. Accessibility and hotkey conflict checker
24. Plugin extension hooks for external ops integrations
25. Command allowlist/denylist policy packs by workspace
