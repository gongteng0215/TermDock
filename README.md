# TermDock

TermDock is a cross-platform desktop SSH + SFTP client focused on a macOS-first experience with full Windows 11 support.

## Current status

This repository now includes the initial development baseline:

- Electron + React + TypeScript app scaffold
- Three-pane shell layout (Sessions / Terminal workspace / SFTP panel)
- Session CRUD via IPC
- Local session persistence (JSON storage; SQLite migration planned)
- OS credential-store adapter (`keytar` with in-memory fallback)
- Real SSH terminal pipeline (`ssh2` + `xterm`) with multi-tab sessions
- Terminal IPC channels (`connect/write/resize/close`) and status events

## Run locally

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```

## Troubleshooting

If Electron reports `failed to install correctly`:

```bash
pnpm install
pnpm rebuild electron
```

This project already allows `electron` and `keytar` build scripts through pnpm policy.

`ssh2` may print optional native build warnings on Node 24; SSH still works with its JS fallback.

If you see repeated EGL/GL driver messages (for example `eglQueryDeviceAttribEXT: Bad attribute`), run with GPU disabled:

```bash
TERMDOCK_DISABLE_GPU=1 pnpm dev
```

If UI shows `Terminal bridge is not ready`, fully restart the dev process (`Ctrl+C` then `pnpm dev`) so Electron preload/main and renderer stay in sync.
The preload is now emitted as CommonJS (`preload.cjs`) for better Electron compatibility.

If Vite says `Port 5273 is in use`, stop the old process first. Electron dev mode is pinned to `http://localhost:5273`.
On macOS/Linux you can check and stop the listener with:

```bash
lsof -nP -iTCP:5273 -sTCP:LISTEN
kill <PID>
```

If you previously exported `ELECTRON_RUN_AS_NODE`, remove it before dev. This repo now strips it automatically in `scripts/run-electron-dev.mjs`.

If you see console lines like `Autofill.enable wasn't found`, they come from Chromium DevTools internals. They are harmless. DevTools is now opt-in:

```bash
TERMDOCK_OPEN_DEVTOOLS=1 pnpm dev
```

## Project structure

```txt
src/main      # Electron main process, IPC, local storage
src/renderer  # React UI
src/shared    # Shared type contracts between main and renderer
```

## Next milestones

- Complete SFTP channel + file manager workflow (upload/download/queue)
- Replace JSON persistence with SQLite migration layer (`sessions/groups/recent_sessions`)
- Add reconnect UX and macOS-first keyboard shortcuts
- Allow opening the same saved session in multiple terminal tabs
- Add extensible terminal right-click context menu in MVP (with a Clear item), then configurable clear hotkey in V2
