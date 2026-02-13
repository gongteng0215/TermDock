# TermDock Progress

Last updated: 2026-02-12

## 1. Snapshot

- `M0` overall: in progress
- Completed P0 tasks: 12
- Partial P0 tasks: 10
- Pending P0 tasks: 8
- Global UI policy: `Compact-first` is now mandatory for future features

## 2. P0 Status by Task ID

| ID | Status | Notes |
| --- | --- | --- |
| P0-A1 | DONE | Electron + React + TypeScript baseline is runnable |
| P0-A2 | DONE | Three-pane shell state is wired |
| P0-A3 | PARTIAL | JSON store implemented; SQLite/groups/recent not done |
| P0-A4 | DONE | `keytar` integrated with fallback |
| P0-A5 | TODO | Structured logging module not yet added |
| P0-B1 | PARTIAL | Session list exists; group tree/search missing |
| P0-B2 | PARTIAL | Create + edit flow are available; advanced validation/bulk flows still missing |
| P0-B3 | DONE | Delete with confirmation is implemented |
| P0-B4 | PARTIAL | Successful terminal connect now records `lastConnectedAt`; dedicated `recent_sessions` table is still pending |
| P0-B5 | PARTIAL | Favorite toggle and favorites-only filter are available; grouped favorite views still pending |
| P0-C1 | DONE | xterm rendering integrated |
| P0-C2 | DONE | ssh2 connection (password/private key) works |
| P0-C3 | DONE | shell stream input/output wired |
| P0-C4 | DONE | multi-tab terminal sessions available |
| P0-C5 | PARTIAL | KeepAlive set; reconnect interaction missing |
| P0-C6 | DONE | macOS-first shortcuts implemented (Cmd/Ctrl+T/W/C/V/F) |
| P0-C7 | DONE | same session can now open multiple terminal tabs in parallel |
| P0-C8 | DONE | right-click context menu is implemented with Clear item and extensible action model |
| P0-D1 | DONE | SFTP directory channel is available via active terminal tab SSH connection |
| P0-D2 | PARTIAL | Right SFTP panel now has path toolbar and remote list but lacks fold/interaction polish |
| P0-D3 | PARTIAL | Supports list/open directory/up navigation and `ls -l`-style compact metadata display; transfer/file-op UX still incomplete |
| P0-D4 | PARTIAL | Supports single-file upload/download with transfer progress events and in-panel task list; queue scheduling/concurrency policy still pending |
| P0-D5 | PARTIAL | Supports create-directory / rename / delete (non-recursive) on selected entry; advanced ops and bulk flow pending |
| P0-D6 | PARTIAL | Supports drag-and-drop file upload into SFTP panel; folder drag and bulk UX polish pending |
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
- Keyboard shortcuts for tab/session and terminal actions (`src/renderer/App.tsx`, `src/renderer/components/terminal-workspace.tsx`)
- SFTP IPC + directory listing backed by active tab SSH connection (`src/main/terminal/terminal-service.ts`, `src/main/ipc/register-sftp-handlers.ts`)
- SFTP panel path navigation and remote directory browser UI (`src/renderer/App.tsx`)
- SFTP remote list compacted to `ls -l`-like rows (`mode/links/owner/group/size/mtime/name`) and aligned to Linux-style dense display (`src/renderer/App.tsx`, `src/renderer/styles.css`)
- SFTP toolbar actions added for create-directory / rename / delete with main+preload+renderer wiring (`src/main/terminal/terminal-service.ts`, `src/main/ipc/register-sftp-handlers.ts`, `src/main/preload.cts`, `src/renderer/App.tsx`)
- SFTP single-file upload/download pipeline with stream-based progress events and transfer list UI (`src/main/terminal/terminal-service.ts`, `src/main/ipc/register-sftp-handlers.ts`, `src/main/ipc/register-system-handlers.ts`, `src/main/preload.cts`, `src/renderer/App.tsx`)
- SFTP panel supports drag-and-drop file upload to current remote directory with visual drop state (`src/renderer/App.tsx`, `src/renderer/styles.css`)

## 4. Newly Added Requirements (2026-02-12)

- Same session can be opened in multiple terminal tabs simultaneously
- Terminal supports right-click context menu in MVP (includes Clear item and extension slots); hotkey clear is tracked in P1
- All future UI/features must follow compact-first layout and interaction density by default
