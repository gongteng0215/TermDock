# TermDock Progress

Last updated: 2026-02-12

## 1. Snapshot

- `M0` overall: in progress
- Completed P0 tasks: 10
- Partial P0 tasks: 5
- Pending P0 tasks: 15

## 2. P0 Status by Task ID

| ID | Status | Notes |
| --- | --- | --- |
| P0-A1 | DONE | Electron + React + TypeScript baseline is runnable |
| P0-A2 | DONE | Three-pane shell state is wired |
| P0-A3 | PARTIAL | JSON store implemented; SQLite/groups/recent not done |
| P0-A4 | DONE | `keytar` integrated with fallback |
| P0-A5 | TODO | Structured logging module not yet added |
| P0-B1 | PARTIAL | Session list exists; group tree/search missing |
| P0-B2 | PARTIAL | Create form done; edit flow missing |
| P0-B3 | DONE | Delete with confirmation is implemented |
| P0-B4 | TODO | `recent_sessions` tracking not implemented |
| P0-B5 | PARTIAL | Favorite toggle exists; favorite filter missing |
| P0-C1 | DONE | xterm rendering integrated |
| P0-C2 | DONE | ssh2 connection (password/private key) works |
| P0-C3 | DONE | shell stream input/output wired |
| P0-C4 | DONE | multi-tab terminal sessions available |
| P0-C5 | PARTIAL | KeepAlive set; reconnect interaction missing |
| P0-C6 | TODO | macOS shortcut behavior not implemented |
| P0-C7 | DONE | same session can now open multiple terminal tabs in parallel |
| P0-C8 | DONE | right-click context menu is implemented with Clear item and extensible action model |
| P0-D1 | TODO | SFTP channel not started |
| P0-D2 | TODO | Right panel still placeholder |
| P0-D3 | TODO | Remote file browsing not implemented |
| P0-D4 | TODO | Transfer queue/progress not implemented |
| P0-D5 | TODO | File ops not implemented |
| P0-D6 | TODO | Drag upload not implemented |
| P0-E1 | TODO | Startup optimization not benchmarked |
| P0-E2 | TODO | Large transfer memory optimization not started |
| P0-E3 | TODO | Global recoverable error UX not complete |
| P0-E4 | TODO | Persistence recovery validation not finished |
| P0-F1 | TODO | Unit tests not added |
| P0-F2 | TODO | Integration tests not added |
| P0-F3 | TODO | Cross-platform smoke tests not done |
| P0-F4 | TODO | Packaging pipeline not implemented |

## 3. Recently Completed Deliverables

- SSH terminal service in main process (`src/main/terminal/terminal-service.ts`)
- Terminal IPC handlers (`src/main/ipc/register-terminal-handlers.ts`)
- Preload API for terminal channels (`src/main/preload.ts`)
- Renderer xterm workspace component (`src/renderer/components/terminal-workspace.tsx`)
- Same-session multi-open support in tab creation flow (`src/renderer/App.tsx`)
- Extensible terminal right-click context menu with Clear action (`src/renderer/components/terminal-workspace.tsx`)

## 4. Newly Added Requirements (2026-02-12)

- Same session can be opened in multiple terminal tabs simultaneously
- Terminal supports right-click context menu in MVP (includes Clear item and extension slots); hotkey clear is tracked in P1
