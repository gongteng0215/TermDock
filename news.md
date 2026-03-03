# TermDock Product Notes

Last updated: 2026-03-03

## Confirmed Direction

- Keep a compact-first desktop workflow
- Prioritize operator efficiency over decorative UI
- Use context-menu-first interactions for session/group/file operations
- Keep core terminal and transfer actions deterministic and recoverable

## Shipped in Recent Cycles

- v0.1.4: settings version display, batch session/group operations, tab close menu expansion, move-to-group dropdown
- Server health baseline and detail drill-down
- Alert thresholds for CPU/memory/disk
- Folder-style session grouping
- Split transfer dock with queue stats and cancel-all actions
- Remote file open deduplication and auto-upload on save
- Windows hotkey defaults updated to `Alt+C` / `Alt+V`
- UI icon system upgraded to `lucide-react`

## Current Top Problems to Solve

1. Cross-platform smoke test coverage is still incomplete
2. Installer signing/notarization workflow is not finalized
3. Global recoverable error UX needs stronger action guidance
4. Large transfer/folder edge cases still need hardening

## Next Candidate Features

- Transfer conflict policy with explicit choice (`overwrite/skip/rename`)
- Transfer retry center and persistent history
- SSH config import with duplicate detection
- Port forwarding UI (local/remote/SOCKS)
- Session templates with variable substitution
- Unified operation center for long-running remote tasks
- Optional encrypted session export/import
