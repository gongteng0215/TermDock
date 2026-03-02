# TermDock

TermDock is a cross-platform desktop SSH + SFTP client for developers and operators.
It combines session management, multi-tab terminal, file transfer, and server health monitoring in one workspace.

## Current Status

- Current stable release: `v0.1.3` (2026-03-03)
- Main targets: macOS and Windows 11
- Packaging: macOS (`arm64`, `x64`) and Windows (`nsis`, `zip`)

## Highlights in v0.1.3

- Folder-style session grouping workflow
- Context-menu-driven session and group management
- Transfer dock pinned at bottom with split upload/download panels
- Batch transfer progress stats and one-click cancel-all
- Upload/download concurrency settings
- Folder download support from SFTP context menu
- Remote file open deduplication and reopen support
- Auto-upload back to server when a remotely opened file is saved
- Improved delete progress feedback
- Windows menu bar hidden by default
- Windows terminal copy/paste defaults switched to `Alt+C` / `Alt+V`
- Unified icon system using `lucide-react`

## Available Features

- Session create/edit/delete/test
- Password and private key authentication
- Session search, favorites, and recency sorting
- Multi-tab xterm terminal (including same session multi-open)
- Terminal context menu and reconnect flow
- Configurable hotkeys in Settings
- KeepAlive and auto reconnect
- SFTP browse/create/rename/delete and file open
- Upload/download queue with progress and cancellation
- Server health panel:
  - CPU, memory, disk, network, load, uptime
  - Alert thresholds for CPU/memory/disk
  - Detail view with trend samples
  - Top CPU processes and failed services

## Quick Start

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```

## Release

Workflow: `.github/workflows/release.yml`

Stable release:

```bash
git tag v0.1.3
git push origin v0.1.3
```

Prerelease example:

```bash
git tag v0.1.3-test.1
git push origin v0.1.3-test.1
```

Tag rules:

- Tag without `-` (for example `v0.1.3`) => stable release
- Tag with `-` (for example `v0.1.3-test.1`) => prerelease

## Known Limitations

- Data is still JSON-based (SQLite migration pending)
- Some advanced SFTP safety flows are still in progress
- Broader cross-platform smoke tests are still pending
- Installer signing/notarization strategy is not fully complete
- No in-app auto-update yet

## Project Structure

```txt
src/main      # Electron main process, IPC, storage
src/renderer  # React UI
src/shared    # Shared contracts and types
```

## Documentation

- `RELEASE_NOTES.md`: release notes
- `PROGRESS.md`: progress and readiness snapshot
- `TASKS.md`: execution tasks and status
- `PRD.md`: product requirements

## License

MIT
