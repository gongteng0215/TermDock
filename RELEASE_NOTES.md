# TermDock Release Notes

## Unreleased (v0.1.10 candidate)

Release type: Stable candidate

### Highlights

- Reduced random disconnect risk during heavy transfer workloads:
  - Added per-tab in-flight guards for server health/process polling
  - Skip silent monitor polling while active upload/download tasks are running on the same tab
- Stabilized terminal viewport behavior on smaller windows and packaged startup:
  - Added deferred multi-pass `fit` scheduling after tab activation/connect
  - Added a font-ready refit path to prevent stale row/column sizing

### Validation

- Type check passed: `pnpm run typecheck`
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

## Unreleased (Planning)

### Candidate Scope

- Transfer conflict policy (`overwrite/skip/rename`) for upload/download
- Transfer retry center and persistent task history
- SSH config import from existing local environments
- Port forwarding manager (local/remote/dynamic SOCKS)
- Session templates and environment variable substitution

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
