# TermDock Progress

Last updated: 2026-03-03

## Snapshot

- Milestone status:
  - `M0` (tech validation): effectively complete
  - `M1` (MVP alpha): in progress
- P0 totals:
  - `DONE`: 13
  - `PARTIAL`: 12
  - `TODO`: 8
- Global UI policy: `Compact-first` remains mandatory

## Release Readiness

- Official GitHub Release shipped: `v0.1.3`
- Current quality: usable for early production/power users, but not fully hardened GA
- Minimum gates before broad public rollout:
  - `P0-F3` cross-platform smoke tests (macOS + Windows 11)
  - `P0-F4` packaged installer validation + signing/notarization strategy
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
| P0-D4 | PARTIAL | Single-file upload/download + upload cancel available; queue/concurrency policy pending |
| P0-D5 | PARTIAL | Create folder / rename / delete implemented (non-recursive); advanced safety flows pending |
| P0-D6 | PARTIAL | Drag-and-drop file upload works; folder drag/bulk polish pending |
| P0-E1 | TODO | Startup optimization benchmark not done |
| P0-E2 | TODO | Large-transfer memory optimization not started |
| P0-E3 | TODO | Recoverable global error UX not complete |
| P0-E4 | TODO | Persistence recovery validation not finished |
| P0-F1 | TODO | Unit tests not added |
| P0-F2 | TODO | Integration tests not added |
| P0-F3 | TODO | Cross-platform smoke tests not done |
| P0-F4 | PARTIAL | electron-builder + GitHub Release workflow is in place (mac arm64/x64 + win); install/signing validation pending |
| P0-G1 | DONE | Server health panel is available (CPU/memory/disk/network/load/uptime + auto/manual refresh + detail toggle) |

## Recent Product-Facing Improvements

- Session double-click now opens a terminal tab directly
- Terminal tab supports middle-click close
- Settings moved into app menu (`Command+,` on macOS, `Ctrl+,` on Windows) and Windows top-right button
- Modal dialogs close only through explicit controls (no accidental outside-click close)
- SFTP panel loading indicator and transfer/status summaries moved below content frame to avoid list jump
- SFTP upload now supports cancel; canceled transfers are no longer surfaced as failure errors
- Session recency sorting now uses `lastConnectedAt` and Selected Session displays last connected time
- GitHub Actions release workflow now builds macOS + Windows packages and publishes Prerelease assets
- Release blank-screen issue fixed by switching production asset path to relative (`./assets/...`)
- Runtime icon configuration landed for packaged builds, plus dev-mode icon fallback handling
- Server health baseline shipped in right panel (active-tab metrics + manual/auto refresh)
- Monitoring detail toggle added: trend chart is now expandable on demand
- Monitoring threshold alerts shipped: configurable CPU/memory/disk thresholds + panel alert badge/highlight
- Monitoring drill-down shipped: top CPU processes + failed services in detail view (on-demand polling)
- Right-side layout compacted (session list + monitor cards) to improve information density
- Official GitHub Release `v0.1.3` published (stable tag workflow path validated)
- Hotkey settings upgraded from toggles to configurable key bindings (Windows terminal copy now defaults to `Alt+C`)
- Settings dialog reorganized into left-nav + right-content layout for clearer grouping

## Next Focus

1. Extend server health with trend time windows / export / multi-session overview (`P1-J3/J5/J6`)
2. Run and document full cross-platform smoke checklist (`P0-F3`)
3. Finalize installer signing/notarization strategy (`P0-F4`)
4. Implement recoverable global error actions (`P0-E3`)

## Product Scope Updates (2026-03-03)

- Added into product planning:
  - Server health panel (CPU/memory/disk/network/load/uptime + threshold alerts + process/service drill-down) is now implemented
  - SSH config import (`~/.ssh/config`)
  - Port forwarding UI (local/remote)
  - Remote file quick edit (download-edit-upload)
  - Recursive SFTP directory download
  - Snippets + command palette (`Cmd/Ctrl+K`)
  - Connection quality panel (RTT/reconnect/failure rate)
  - Host key trust + fingerprint change alerts (TOFU)
  - Multi-host command broadcast
- New extra candidates for future exploration:
  - Session templates + environment variables
  - Jump host / multi-hop (`ProxyJump`)
  - Transfer history and retry center
  - Local/remote directory sync
  - Runbook workflows
  - Sensitive command guard
  - Audit mode
  - Scheduled runbooks
  - Workspace snapshot restore (tabs/path/layout)
  - Transfer integrity verification (`sha256`)
  - Resumable transfer
  - Transfer bandwidth limit
  - SFTP recycle bin
  - Production safeguard mode
  - Log observability panel
  - In-app update channel
  - Monitor alert desktop notifications
  - Per-mount disk breakdown / inode usage
  - Network interface selector for traffic rate view

## Main Risks

- No automated test safety net yet
- Packaging pipeline exists but still lacks full installer/signing verification
- SFTP still lacks queue scheduling + recursive folder workflows
- Server health currently depends on Linux `/proc` parsing + single-root disk sampling (`/`)
- No in-app auto-update yet (manual overwrite/install upgrade only)
