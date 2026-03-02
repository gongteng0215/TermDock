# TermDock Release Notes

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
