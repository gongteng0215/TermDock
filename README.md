# TermDock

**Local-first SSH + SFTP server workspace for solo developers and small teams.**

TermDock helps you connect to servers, transfer files, check server health, recover failed transfers, manage port forwarding, and catch risky commands before they hit production.

[中文 README](README.zh-CN.md) · [Download](https://github.com/gongteng0215/TermDock/releases) · [SSH Config Import](docs/SSH_CONFIG_IMPORT.md) · [SSH Troubleshooting](docs/SSH_CONNECTION_TROUBLESHOOTING.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md) · [Release Notes](RELEASE_NOTES.md)

![TermDock terminal workspace](docs/assets/screenshots/preview/terminal-workspace.png)

## Why TermDock?

TermDock is not trying to be another giant terminal app. It is built as a practical server workspace for people who need SSH, SFTP, transfer recovery, and server checks in the same place.

## What makes TermDock different?

1. Dangerous command guardrails
Catch risky commands before they hit your server.

2. SFTP transfer recovery
Retry failed uploads and downloads from Retry Center instead of starting over.

3. Server health in the same workspace
Check CPU, memory, disk, network, processes, and failed services after SSH login.

4. Local-first workflow
No cloud account required, and SSH credentials stay local.

## Download

Get the latest build from [GitHub Releases](https://github.com/gongteng0215/TermDock/releases).

### Download This First

- Windows installer: `TermDock.Setup.*.exe`
- Windows portable: the Windows `.zip`
- macOS Apple Silicon: the `arm64` `.dmg`
- macOS Intel: the `x64` `.dmg`

### Which File Should I Download?

| Platform | Recommended file | Use when |
| --- | --- | --- |
| Windows | `TermDock.Setup.*.exe` | You want the normal installer. |
| Windows | Windows `.zip` | You want a portable build without installation. |
| macOS Apple Silicon | macOS `arm64` `.dmg` or `.zip` | Your Mac uses Apple Silicon, such as M1/M2/M3/M4. |
| macOS Intel | macOS `x64` `.dmg` or `.zip` | Your Mac uses an Intel processor. |
| Source | Source code | You want to run or develop TermDock locally. |

TermDock is currently focused on macOS and Windows 11.

### First Launch Notes

- Download TermDock only from the official GitHub Releases page.
- Windows may show SmartScreen or publisher warnings for new open-source builds.
- macOS may show Gatekeeper warnings while public-trust signing/notarization is still in progress.
- If you are not sure which macOS CPU you have, check Apple menu -> About This Mac.

If the app cannot be installed or opened, see [Install And Launch Troubleshooting](docs/INSTALL_TROUBLESHOOTING.md).

## Screenshots

### Multi-Tab SSH Terminal

![Multi-tab SSH terminal](docs/assets/screenshots/preview/terminal-workspace.png)

### SFTP File Browser

![SFTP file browser](docs/assets/screenshots/preview/sftp-file-browser.png)

### Dangerous Command Guardrails

![Dangerous command guardrails](docs/assets/screenshots/preview/dangerous-command-guardrails.png)

### Operation Center

![Operation Center](docs/assets/screenshots/preview/operation-center.png)

### Retry Center

![Retry Center](docs/assets/screenshots/preview/retry-center.png)

### Port Forwarding Manager

![Port forwarding settings](docs/assets/screenshots/preview/port-forwarding-settings.png)

## Core Features

### SSH Workspace

- Password and private-key authentication
- Session create/edit/delete/test
- Folder-style session grouping, search, favorites, and recency sorting
- Multi-tab xterm terminal with reconnect flow
- SSH config import from `~/.ssh/config` with preview, duplicate handling, and post-import open action
- SSH connection errors include a plain-language reason, next-step suggestion, and raw error
- Session templates and quick startup command profiles

### SFTP Transfer

- Browse, create, rename, delete, upload, and download remote files
- Upload/download queues with per-task cancel and cancel-all actions
- Per-direction transfer rate limits
- Schedule windows for queued transfers
- Conflict policies: overwrite, skip, rename
- Pending queue restore after app restart
- Remote file open/edit with save-back conflict protection

### Safety And Recovery

- Dangerous-command approval bar before risky terminal writes
- Built-in and custom guardrail rules
- Per-source toggles for keyboard, paste, command history, snippets, quick profiles, and startup commands
- Temporary approvals for the current tab or session group
- Retry Center for failed transfer history and one-click requeue
- Recoverable global error bar with contextual actions

### Operations Tooling

- Server health panel for CPU, memory, disk, network, load, uptime, processes, and failed services
- Port forwarding manager for Local (`-L`), Remote (`-R`), and Dynamic SOCKS5 (`-D`) forwards
- Operation Center for active transfers, deletes, port forwards, diagnostics jobs, and reconnect actions
- Diagnostics logs, disconnect reports, and bug report `.zip` export

## Security Model

TermDock is designed as a local desktop app. It does not require a cloud account to manage servers.

Local-first: TermDock does not require a cloud account and does not upload your SSH credentials.

- Session data is stored locally.
- Credentials use secure OS storage through the app credential layer where available.
- Session and group exports exclude decrypted credentials.
- Encrypted migration exports can include passwords and optional private-key files when protected by your passphrase. See [Session Migration](docs/SESSION_MIGRATION.md).
- Diagnostics and bug reports are generated locally for you to inspect before sharing.

See [SECURITY.md](SECURITY.md) for details and current limitations.

## Quick Start For Development

```bash
pnpm install
pnpm dev
```

Build the app:

```bash
pnpm build
```

Run the workspace smoke test:

```bash
pnpm run smoke:ui
```

The default smoke run boots an embedded local SSH/SFTP fixture, so core auth, terminal, SFTP, port-forwarding, settings, diagnostics, command history, retry, and operation-center flows can be verified without an external host.

## Project Structure

```txt
src/main       Electron main process, IPC, storage
src/renderer   React UI
src/shared     Shared contracts and types
docs/assets    README screenshots and product assets
```

## Status

- Current validation: `pnpm run typecheck`, `pnpm run build`, and `pnpm run smoke:ui` passed.
- Latest workspace smoke artifact: `artifacts/smoke/2026-05-14T06-14-31-419Z/summary.json` (`PASS 48 / FAIL 0 / SKIP 0`).
- Current packaging targets: macOS (`arm64`, `x64`) and Windows (`nsis`, `zip`).

For detailed progress, release validation, and planning notes, see:

- [Release Notes](RELEASE_NOTES.md)
- [Documentation Index](docs/DOCUMENTATION.md) / [中文](docs/DOCUMENTATION.zh-CN.md)
- [Progress Snapshot](PROGRESS.md) / [中文](PROGRESS.zh-CN.md)
- [Task Board](TASKS.md) / [中文](TASKS.zh-CN.md)
- [Packaged Smoke Runbook](PACKAGED_SMOKE.md) / [中文](PACKAGED_SMOKE.zh-CN.md)
- [Release Signing Runbook](RELEASE_SIGNING.md) / [中文](RELEASE_SIGNING.zh-CN.md)
- [UI Compact Rules](UI_COMPACT_RULES.md) / [中文](UI_COMPACT_RULES.zh-CN.md)
- [SSH Config Import](docs/SSH_CONFIG_IMPORT.md) / [中文](docs/SSH_CONFIG_IMPORT.zh-CN.md)
- [SSH Connection Troubleshooting](docs/SSH_CONNECTION_TROUBLESHOOTING.md) / [中文](docs/SSH_CONNECTION_TROUBLESHOOTING.zh-CN.md)
- [Install And Launch Troubleshooting](docs/INSTALL_TROUBLESHOOTING.md) / [中文](docs/INSTALL_TROUBLESHOOTING.zh-CN.md)
- [Feedback Triage](docs/FEEDBACK_TRIAGE.md) / [中文](docs/FEEDBACK_TRIAGE.zh-CN.md)
- [GitHub Labels](docs/GITHUB_LABELS.md) / [中文](docs/GITHUB_LABELS.zh-CN.md)
- [Contributing](CONTRIBUTING.md) / [中文](CONTRIBUTING.zh-CN.md)
- [60-Second Demo Script](docs/promotion/60-second-demo.md) / [中文](docs/promotion/60-second-demo.zh-CN.md)
- [GitHub Page Setup](docs/promotion/github-page-setup.md) / [中文](docs/promotion/github-page-setup.zh-CN.md)
- [Release Page Copy](docs/promotion/release-page-copy.md) / [中文](docs/promotion/release-page-copy.zh-CN.md)

## Known Limitations

- Data persistence is still JSON-based; SQLite migration is planned.
- In-app auto-update is supported, but public-trust signing/notarization is still in progress.
- Public-trust signing/notarization evidence is still in progress.
- Active runtime port forwards are tab-scoped.
- Dynamic forwarding currently supports SOCKS5 no-auth `CONNECT` baseline.

## License

MIT
