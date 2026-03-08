# TermDock

TermDock is a cross-platform desktop SSH + SFTP client for developers and operators.
It combines session management, multi-tab terminal, file transfer, diagnostics logging, and server health monitoring in one workspace.

## Current Status

- Current stable release: `v0.1.10` (2026-03-08)
- Current branch focus: `v0.1.11` hardening candidate on `master`
- Main targets: macOS and Windows 11
- Packaging: macOS (`arm64`, `x64`) and Windows (`nsis`, `zip`)

## In Progress on `master` (v0.1.11 candidate)

- Transfer conflict policy for upload/download (`Overwrite` / `Skip` / `Rename`)
- Failed transfer replay actions (`Retry Failed`) for upload/download docks
- Session-scoped persistent failed-transfer history (survives restart and feeds `Retry Failed`)
- Transfer Retry Center modal (filter/search/select/retry/delete persisted history records)
- SSH config import baseline (`~/.ssh/config`): preview + duplicate strategy (`skip`/`overwrite`/`rename`)
- SSH config parser hardening: recursive `Include` + `Host` wildcard/negation merge semantics
- Port forwarding manager in `Settings > Port Fwd`:
  - Local / Remote / Dynamic (`SOCKS5`) creation, list, and remove
  - saved per-session presets with one-click apply
  - optional auto-restore on terminal connect
  - runtime status (`Active` / `Degraded`) with last error and activity metadata
  - recent per-tab forwarding events (`created`/`removed`/`degraded`/`recovered`)
  - session-scoped persisted event history with filter and clear actions
  - one-click diagnostics snapshot export (clipboard)
  - bound to active terminal tab with auto-cleanup on disconnect/close
- Diagnostics logging baseline:
  - main process file logging with rotation
  - renderer global error auto-capture
  - `Settings > Diagnostics` for log path refresh/open/copy
- Added one-click bug report export (`zip`: logs + runtime metadata + settings snapshot)
- Reduced random disconnect risk during heavy transfer bursts by avoiding overlapping server-monitor polling requests per tab
- Improved terminal viewport stability on small windows and packaged startup by adding deferred multi-pass `fit` and font-ready refit
- Added transfer soak tool and runbook (`scripts/soak-transfer.mjs`, `SOAK_TEST.md`)

## Available Features

- Session create/edit/delete/test
- Password and private key authentication
- Session search, favorites, and recency sorting
- Folder-style session grouping and context-menu operations
- SSH config import with preview and duplicate-handling strategy
- Multi-tab xterm terminal (including same session multi-open)
- Terminal context menu and reconnect flow
- Port forwarding manager in Settings:
  - Local forward (`-L`)
  - Remote forward (`-R`)
  - Dynamic SOCKS5 forward (`-D`)
  - saved presets per session
  - auto-restore on connect
  - runtime status/failed-connection metadata
  - recent event timeline + persisted history controls + diagnostics snapshot export
  - tab-scoped lifecycle with one-click remove
- Configurable hotkeys in Settings (Windows defaults: `Ctrl+Shift+C` / `Ctrl+Shift+V`)
- KeepAlive and auto reconnect
- SFTP browse/create/rename/delete/open
- Upload/download queues with:
  - progress, per-task cancel, cancel-all
  - conflict policy (`Overwrite` / `Skip` / `Rename`)
  - retry failed tasks
  - persistent failed retry history per session
  - Retry Center for batch retry and history cleanup
- Remote file open/edit with duplicate-open protection and auto-upload on save
- Server health panel:
  - CPU, memory, disk, network, load, uptime
  - alert thresholds for CPU/memory/disk
  - detail view with trend samples, top CPU processes, and failed services
- Diagnostics logging:
  - runtime log file in app user-data directory
  - settings actions to open log folder and copy log path
  - one-click bug report bundle export (`.zip`)

## Quick Start

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```

## Soak Test

```bash
pnpm run soak:transfer
```

Set SSH/SFTP target environment variables first. See `SOAK_TEST.md` for full setup.

## Release

Workflow: `.github/workflows/release.yml`

Stable release:

```bash
git tag v0.1.10
git push origin v0.1.10
```

Prerelease example:

```bash
git tag v0.1.11-test.1
git push origin v0.1.11-test.1
```

Tag rules:

- Tag without `-` (for example `v0.1.10`) => stable release
- Tag with `-` (for example `v0.1.10-test.1`) => prerelease

## Known Limitations

- Data is still JSON-based (SQLite migration pending)
- Persistent transfer history is local-only (no sync/export yet)
- Active runtime port forwards remain tab-scoped; event history now persists locally per session, but there is no cross-device sync/export workflow yet
- Dynamic forwarding currently supports SOCKS5 no-auth `CONNECT` baseline only
- Broader cross-platform smoke tests are still pending
- Installer signing/notarization strategy is not fully complete
- No in-app auto-update yet

## Near-Term Execution Focus

1. Port forwarding diagnostics polish (file export + richer correlation metadata) (`F5+`)
2. Retry-center analytics and history export (`F2+`)
3. Cross-platform smoke checklist and reproducible reports (Windows/macOS)
4. Installer signing/notarization and installation verification
5. Recoverable global error UX (Reconnect / Open Logs / Copy Error)

## Candidate Features (Prioritized)

1. Advanced retry-center analytics and history export
2. Session templates and environment variable substitution
3. Remote compare before overwrite (size/mtime/checksum fast path)
4. Operation center for long-running tasks (delete/copy/move) with unified progress
5. Optional session export/import with encrypted payload
6. SSH jump-host chain builder (`ProxyJump`/bastion wizard)
7. Transfer bandwidth limiter and schedule window
8. Command snippets/playbooks with variable prompts and safety confirmation
9. Multi-host command broadcast with dry-run preview
10. Remote file snapshot and quick rollback for accidental edits
11. Session tags and smart saved views (by env/owner/risk)
12. Terminal session recording/replay with sanitized export
13. Dangerous-command guardrails (rule-based preflight confirmation)
14. One-way sync profiles for recurring upload/download folders
15. Connection quality timeline (latency/reconnect/throughput history)
16. Workspace profile mode (`dev` / `staging` / `prod`) with visual risk cues

## Exploration Ideas (Unprioritized)

- Operation audit timeline (who/when/where/what for command and transfer actions)
- Disconnect auto-diagnostic report (network + reconnect + runtime context snapshot)
- Diff-first sync mode (preview changes and transfer only deltas)
- Session health checks with proactive risk badges
- Team session bundle (encrypted import/export with tags and templates)
- Temporary authorization mode (time-limited operation window for risky sessions)
- Environment policy templates (`dev` / `staging` / `prod`) for timeout/concurrency/alerts
- Crash dump + symbolized stack pipeline for faster root-cause analysis
- Release channel management (`stable` / `beta` / `canary`) with rollback guidance
- Accessibility and hotkey conflict checker
- Plugin extension hooks for ticketing/CMDB/alerts integrations
- Built-in command allowlist/denylist policy packs per workspace

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
- `SOAK_TEST.md`: long-duration transfer stress test guide
- `news.md`: product notes and directional summary

## License

MIT
