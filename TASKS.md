# TermDock Task Board

Last updated: 2026-03-05

## Current Release State

- Stable release: `v0.1.9`
- Branch baseline: `master`
- Priority direction: hardening and release quality, not new broad feature expansion

## P0 Matrix

| ID | Status | Notes |
| --- | --- | --- |
| P0-A1 | DONE | Electron + React + TypeScript baseline is stable |
| P0-A2 | DONE | Core multi-pane shell workflow is stable |
| P0-A3 | PARTIAL | JSON persistence works; SQLite migration pending |
| P0-A4 | DONE | Secure credential storage via keytar/fallback |
| P0-A5 | TODO | Structured logging module |
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
| P0-C7 | DONE | Same session multi-open |
| P0-C8 | DONE | Terminal context menu |
| P0-D1 | DONE | SFTP channel reuse via active tab |
| P0-D2 | PARTIAL | SFTP panel is usable; final polish pending |
| P0-D3 | PARTIAL | Browse/open/refresh works; edge error states still improving |
| P0-D4 | PARTIAL | Queue/progress/cancel for upload/download done; more stress hardening pending |
| P0-D5 | PARTIAL | Create/rename/delete done; recursive safety flows still evolving |
| P0-D6 | PARTIAL | Drag-and-drop works; very large folder workflows need more tuning |
| P0-E1 | TODO | Startup performance benchmark/optimization |
| P0-E2 | TODO | Large transfer memory optimization |
| P0-E3 | TODO | Recoverable global error UX |
| P0-E4 | TODO | Persistence crash-recovery verification |
| P0-F1 | TODO | Unit tests |
| P0-F2 | TODO | Integration tests |
| P0-F3 | TODO | Cross-platform smoke tests |
| P0-F4 | PARTIAL | Build/release pipeline works; signing/notarization pending |
| P0-G1 | DONE | Server health panel baseline shipped |

## In Progress Track (v0.1.3+)

1. `P0-F3` Cross-platform smoke checklist and reproducible report
2. `P0-F4` Signing/notarization strategy and installation verification
3. `P0-E3` Global error recovery actions and user guidance
4. Transfer hardening for cancel races and large directory jobs

## Backlog Candidates

- SSH config import (`~/.ssh/config`)
- Port forwarding UI
- Snippets and command palette
- Remote file quick-edit advanced flow
- Multi-host command broadcast
- Transfer retry center and history

## Proposed Feature Track (Post-Hardening)

| ID | Priority | Status | Feature | Why |
| --- | --- | --- | --- | --- |
| F1 | P1 | TODO | Transfer conflict policy (overwrite/skip/rename) | Prevent accidental overwrite and clarify current behavior |
| F2 | P1 | TODO | Transfer retry center + persistent history | Fast recovery after network interruption or cancel race |
| F3 | P1 | TODO | SSH config import (`~/.ssh/config`) | Reduce manual session creation for existing users |
| F4 | P1 | TODO | Port forwarding manager (L/R/Dynamic) | Cover common SSH tunnel workflows without external tools |
| F5 | P2 | TODO | Session templates + env variables | Faster provisioning for repeated host patterns |
| F6 | P2 | TODO | Remote overwrite pre-check (mtime/size/checksum) | Safer file edit and sync workflows |
| F7 | P2 | TODO | Unified operation center for long jobs | Better visibility for recursive delete/copy/move tasks |
| F8 | P3 | TODO | Encrypted session export/import | Easier migration and backup across machines |
