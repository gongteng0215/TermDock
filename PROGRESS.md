# TermDock Progress

Last updated: 2026-03-05

## Snapshot

- Stable release shipped: `v0.1.9`
- Master branch includes post-`v0.1.9` hardening for transfer stability and terminal viewport sizing
- Milestone status:
  - `M0` (technical validation): complete
  - `M1` (MVP hardening): in progress
- P0 totals:
  - `DONE`: 13
  - `PARTIAL`: 12
  - `TODO`: 8

## Release Readiness

- Current quality: suitable for early production and power users
- Not fully GA-hardened yet
- Minimum gates before broad rollout:
  - `P0-F3`: cross-platform smoke tests
  - `P0-F4`: installer signing/notarization and install validation
  - `P0-E3`: recoverable global error UX

## Completed in v0.1.9

- Added protection to block raw wheel mouse-report sequences while mouse tracking is active
- Eliminated `%6`/`%9`-style garbage text artifacts caused by wheel input in full-screen editor modes

## In Progress on master (next patch)

- Added monitor polling in-flight guards per tab to reduce overload during high transfer activity
- Skip silent server monitor polling while uploads/downloads are running on the same tab
- Added deferred and font-ready terminal refit flow to stabilize small-window rendering in packaged builds

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
- Server health currently relies on Linux `/proc` and single-root disk sampling

## Next Focus

1. Validate post-`v0.1.9` hardening on long transfer sessions (multi-hour soak)
2. Execute and document full macOS/Windows smoke checklist (`P0-F3`)
3. Finalize signing/notarization path and verify installer flows (`P0-F4`)
4. Build recoverable global error actions and guidance (`P0-E3`)

## Feature Candidates After Hardening

1. Transfer conflict policy with explicit user choice (`overwrite/skip/rename`)
2. Transfer retry center and durable transfer history
3. SSH config import and session deduplication workflow
4. Port forwarding manager (local/remote/SOCKS)
5. Session templates for repeated infrastructure patterns
