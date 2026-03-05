# TermDock

TermDock is a cross-platform desktop SSH + SFTP client for developers and operators.
It combines session management, multi-tab terminal, file transfer, and server health monitoring in one workspace.

## Current Status

- Current stable release: `v0.1.9` (2026-03-05)
- Main targets: macOS and Windows 11
- Packaging: macOS (`arm64`, `x64`) and Windows (`nsis`, `zip`)

## In Progress on `master` (next patch candidate)

- Reduced random disconnect risk during heavy transfer bursts by avoiding overlapping server-monitor polling requests per tab
- Improved terminal viewport stability on small windows and packaged startup by adding deferred multi-pass `fit` and font-ready refit

## Highlights in v0.1.9

- Prevented raw wheel mouse-report sequences from leaking into terminal text in alternate-buffer editor states
- Reduced visible garbage input such as `%6`/`%9` when mouse tracking is enabled

## Highlights in v0.1.8

- Refined terminal wheel input mapping to reduce extra blank-line jumps while scrolling in full-screen editors
- Added mode-aware wheel forwarding (`application cursor keys` and `mouse tracking` guards) for cleaner `vim`/`nano` behavior

## Highlights in v0.1.7

- Improved wheel-scroll reliability in full-screen terminal editors (`nano`, `vim`) by capturing wheel events on terminal surfaces

## Highlights in v0.1.6

- Terminal mouse wheel now scrolls correctly in full-screen terminal editors (alternate buffer), including `nano` and `vim`

## Highlights in v0.1.5

- Windows clipboard defaults now use `Ctrl+Shift+C` / `Ctrl+Shift+V`
- Session context actions: `Duplicate Session` and `Copy SSH Command`
- Session quick connect via `Enter`
- Transfer dock actions: `Clear Finished` for upload/download lists
- Settings now shows current app version
- Batch session/group operations via multi-select context menu
- `Move session to group` now uses dropdown selection
- Session sort modes with persistence (`Default`, `Recent`, `Name A-Z`, `Name Z-A`)
- Stable default list ordering (no reconnect reorder jumps)
- Terminal tab right-click actions: close current/left/right/others/all
- Improved horizontal tab scrolling behavior
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
- Windows terminal copy/paste defaults switched to `Ctrl+Shift+C` / `Ctrl+Shift+V`
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
git tag v0.1.9
git push origin v0.1.9
```

Prerelease example:

```bash
git tag v0.1.9-test.1
git push origin v0.1.9-test.1
```

Tag rules:

- Tag without `-` (for example `v0.1.9`) => stable release
- Tag with `-` (for example `v0.1.9-test.1`) => prerelease

## Known Limitations

- Data is still JSON-based (SQLite migration pending)
- Some advanced SFTP safety flows are still in progress
- Broader cross-platform smoke tests are still pending
- Installer signing/notarization strategy is not fully complete
- No in-app auto-update yet

## Near-Term Execution Focus

1. Transfer stress hardening:
   - long-running upload/download soak tests
   - per-tab transfer + monitor pressure validation
2. Small-window terminal stability:
   - add explicit smoke checklist for 720p / scaled Windows displays
3. Error recovery UX:
   - clear reconnect guidance when remote host drops or throttles sessions

## Planned Features (Prioritized)

1. Transfer conflict policy (overwrite / skip / rename) for file and folder jobs
2. Transfer retry center with failed-task replay and persistent history
3. SSH config import from `~/.ssh/config` with duplicate detection
4. Port forwarding manager (local / remote / dynamic SOCKS)
5. Session templates and environment variables
6. Remote compare before overwrite (size/mtime/checksum fast path)
7. Operation center for long-running tasks (delete/copy/move) with unified progress
8. Optional session export/import with encrypted payload

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
