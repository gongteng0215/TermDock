# TermDock Progress

Last updated: 2026-02-14

## Snapshot

- Milestone status:
  - `M0` (tech validation): effectively complete
  - `M1` (MVP alpha): in progress
- P0 totals:
  - `DONE`: 12
  - `PARTIAL`: 11
  - `TODO`: 9
- Global UI policy: `Compact-first` remains mandatory

## Release Readiness

- Recommended now: ship `v0.1.0-preview` to internal users / small beta
- Not recommended yet: public GA rollout
- Minimum gates before public release:
  - `P0-F3` cross-platform smoke tests (macOS + Windows 11)
  - `P0-F4` packaging/install flow (DMG/EXE)
  - `P0-E3` recoverable global error guidance

## P0 Task Matrix

| ID | Status | Notes |
| --- | --- | --- |
| P0-A1 | DONE | Electron + React + TypeScript baseline is stable |
| P0-A2 | DONE | Three-pane shell state is wired |
| P0-A3 | PARTIAL | JSON storage works; SQLite/groups/recent_sessions pending |
| P0-A4 | DONE | `keytar` integrated with fallback |
| P0-A5 | TODO | Structured logging module not added |
| P0-B1 | PARTIAL | Session list + search + favorite-only filter available; group tree pending |
| P0-B2 | PARTIAL | Create/edit usable; stronger validation and bulk editing pending |
| P0-B3 | DONE | Delete with confirmation implemented |
| P0-B4 | PARTIAL | `lastConnectedAt` is recorded; dedicated `recent_sessions` table pending |
| P0-B5 | PARTIAL | Favorite toggle + filter available; grouped favorite UX pending |
| P0-C1 | DONE | xterm rendering integrated |
| P0-C2 | DONE | ssh2 password/private-key auth works |
| P0-C3 | DONE | shell stream input/output wired |
| P0-C4 | DONE | multi-tab terminal sessions available |
| P0-C5 | PARTIAL | KeepAlive + auto reconnect available; explicit manual reconnect entry pending |
| P0-C6 | DONE | Platform-aware shortcuts (Cmd on macOS, Ctrl on Windows) |
| P0-C7 | DONE | Same session can open multiple tabs |
| P0-C8 | DONE | Right-click context menu implemented (includes Clear) |
| P0-D1 | DONE | SFTP channel available via active tab connection |
| P0-D2 | PARTIAL | SFTP panel is usable; fold/collapse polish pending |
| P0-D3 | PARTIAL | Directory browse/open/up + compact row metadata available; error-state polish pending |
| P0-D4 | PARTIAL | Single-file upload/download with progress events available; queue/concurrency policy pending |
| P0-D5 | PARTIAL | Create folder / rename / delete implemented (non-recursive); advanced safety flows pending |
| P0-D6 | PARTIAL | Drag-and-drop file upload works; folder drag/bulk polish pending |
| P0-E1 | TODO | Startup optimization benchmark not done |
| P0-E2 | TODO | Large-transfer memory optimization not started |
| P0-E3 | TODO | Recoverable global error UX not complete |
| P0-E4 | TODO | Persistence recovery validation not finished |
| P0-F1 | TODO | Unit tests not added |
| P0-F2 | TODO | Integration tests not added |
| P0-F3 | TODO | Cross-platform smoke tests not done |
| P0-F4 | TODO | Packaging pipeline not implemented |

## Recent Product-Facing Improvements

- Session double-click now opens a terminal tab directly
- Terminal tab supports middle-click close
- Settings moved into app menu (`Command+,` on macOS, `Ctrl+,` on Windows) and Windows top-right button
- Modal dialogs close only through explicit controls (no accidental outside-click close)
- SFTP panel loading indicator and transfer/status summaries moved below content frame to avoid list jump
- Session recency sorting now uses `lastConnectedAt` and Selected Session displays last connected time

## Main Risks

- No automated test safety net yet
- No end-user packaging/install channel yet
- SFTP still lacks queue scheduling + recursive folder workflows
