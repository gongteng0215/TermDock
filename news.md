# TermDock Product Notes

Last updated: 2026-03-05

## Confirmed Direction

- Keep a compact-first desktop workflow
- Prioritize operator efficiency over decorative UI
- Use context-menu-first interactions for session/group/file operations
- Keep core terminal and transfer actions deterministic and recoverable

## Shipped in Recent Cycles

- master (post-v0.1.9): added transfer soak-test tool (`scripts/soak-transfer.mjs`) and runbook (`SOAK_TEST.md`)
- master (post-v0.1.9): reduced transfer-time disconnect risk by preventing overlapping server monitor polling per tab
- master (post-v0.1.9): stabilized terminal rendering on small windows with deferred/font-ready xterm refit
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
