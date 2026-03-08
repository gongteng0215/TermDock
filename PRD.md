# TermDock PRD

Version: v1.11  
Last updated: 2026-03-08

## 1. Product Positioning

TermDock is a desktop SSH + SFTP workspace for developers and operators.
The product goal is to complete session management, terminal operations, and file transfer inside one window with low context switching.

Target platforms:

- macOS (experience-first)
- Windows 11 (full compatibility)

## 2. Product Goals

### MVP (P0)

- Fast and reliable remote login
- Stable multi-tab terminal workflow
- Usable SFTP browsing and transfer workflow
- Safe and efficient daily operations

### Non-goals for MVP

- Enterprise bastion/governance suite
- Cloud account identity platform
- Mobile clients

## 3. Target Users

- Backend/frontend engineers
- SRE/operations engineers
- Users with high-frequency SSH + file transfer tasks

## 4. UX Principles

- Compact-first layout
- Information density over decorative spacing
- Context-menu-first operation for list/tree actions
- Strong safeguards for destructive operations
- Platform-native keyboard behavior

## 5. Functional Scope

### 5.1 Session Management

- Create/edit/delete/test connection
- Search, favorite filter, recency sorting
- Folder-style group navigation
- Group/session context menu operations
- SSH config import workflow with preview and duplicate handling

### 5.2 Terminal

- xterm-based terminal rendering
- Multi-tab and same-session multi-open
- Reconnect and context actions
- Configurable hotkeys
- KeepAlive and auto reconnect
- Port forwarding manager (`Local` / `Remote` / `Dynamic SOCKS5`) with saved presets and auto-restore
  - runtime status (`Active` / `Degraded`) and recent event timeline
  - diagnostics snapshot export for support handoff

### 5.3 SFTP

- Browse/open/refresh/path jump
- Create folder, rename, delete
- Upload/download with queue and progress
- Cancel single task and cancel all
- Conflict policy for transfer collisions (`overwrite` / `skip` / `rename`)
- Retry failed transfer tasks from transfer dock
- Session-scoped persistent failed-transfer history
- Transfer retry center (filter/search/select/retry/delete)
- Folder download
- Drag-and-drop upload

### 5.4 Remote File Open/Edit

- Open remote file into local temp file
- Prevent duplicate opens for same remote file
- Reopen after close
- Auto-upload on save back to remote path

### 5.5 Monitoring

- CPU, memory, disk, network, load, uptime
- Alert thresholds for CPU/memory/disk
- Trend detail panel
- Top CPU processes and failed services

### 5.6 Settings

- Connection preferences
- Hotkey bindings
- Server health alert thresholds
- File opening preferences
- Upload/download concurrency
- Port forwarding management section with preset save/apply controls
- Diagnostics section with log path actions

### 5.7 Diagnostics Logging

- Main process structured file logs with rotation
- Renderer global error and unhandled promise rejection capture
- User-visible log path access in Settings for bug triage

### 5.8 Stability Hardening (active)

- Prevent monitor request overlap per tab under high transfer load
- Reduce transfer-time disconnect risk when server resources are constrained
- Keep terminal viewport sizing stable on small windows and packaged startup

## 6. Security Requirements

- No plain-text credential persistence
- Use keychain/credential manager via keytar where available
- Controlled destructive operations with confirmation

## 7. Non-functional Requirements

- Stable startup and reconnect behavior
- Transfer cancellation should be responsive and deterministic
- UI should avoid layout jumps in core workflows
- Release builds for macOS and Windows should be reproducible
- Background monitor requests must avoid overlap-induced connection pressure
- Long-duration transfer soak runs should be repeatable with scriptable parameters

## 8. Current Limitations

- SQLite migration not complete
- Automated test coverage is incomplete
- Signing/notarization process is not fully finalized
- Some recursive SFTP safety flows still need hardening
- Port forwarding presets and event history now persist locally with runtime status/last-error visibility, but deeper correlation/export workflows are still pending; dynamic baseline is SOCKS5 no-auth `CONNECT` only
- Retry center analytics/export workflow is not available yet

## 9. Release Gates Before Broader Rollout

1. Cross-platform smoke testing (`P0-F3`)
2. Installer signing/notarization and install verification (`P0-F4`)
3. Recoverable global error UX (`P0-E3`)

## 10. Version Plan

- `v0.1.10` (current stable): transfer safety + diagnostics + SSH config hardening + port forwarding manager baseline
- Next patch cycle (master in progress):
  - monitor polling overlap guard during heavy transfer sessions
  - small-window packaged terminal refit stabilization
  - scripted transfer soak harness and matrix runbook
  - transfer conflict policy and failed-task retry actions
  - diagnostics logging baseline with settings log path tools
  - one-click bug report export (`Settings > Diagnostics`)
  - persistent failed-transfer history and retry-center baseline
  - SSH config import baseline + parser hardening (`Include`, wildcard/negation merge)
  - settings-based port forwarding baseline (`Local` / `Remote` / `Dynamic`)
  - saved port forwarding presets with optional auto-restore on connect
  - runtime status (`Active` / `Degraded`) and last-error metadata for active forwards
  - recent event timeline and diagnostics snapshot export
- Next hardening cycle: testing, installer reliability, error recovery
- Capability cycle candidate A:
  - Port forwarding diagnostics correlation/export polish
  - Retry-center analytics and history export
- Capability cycle candidate B:
  - Session templates and environment variable substitution
  - Unified operation center for long-running remote tasks
  - Optional encrypted session export/import
- Capability cycle candidate C:
  - SSH jump-host chain builder (ProxyJump/bastion visual flow)
  - Transfer bandwidth limiter and schedule window
  - Command snippets/playbooks with parameter prompts and safety checks
  - Multi-host command broadcast with dry-run preview
  - Remote file snapshot and quick rollback
- Capability cycle candidate D:
  - Session tags and smart saved views
  - Terminal session recording/replay with sanitized export
  - Dangerous-command guardrails with policy-based confirmation
  - Recurring folder sync profiles (one-way sync presets)
  - Connection quality timeline dashboard
  - Workspace profile mode (`dev` / `staging` / `prod`) with visual risk cues
- Capability cycle candidate E:
  - Operation audit timeline (command + transfer traceability)
  - Disconnect auto-diagnostic report with runtime context snapshot
  - Session health checks with proactive risk badges
  - Crash dump + symbolized stack pipeline for faster triage
- Capability cycle candidate F:
  - Diff-first sync mode (preview and apply deltas)
  - Temporary authorization mode for high-risk actions
  - Environment policy templates (`dev` / `staging` / `prod`) for timeout/concurrency/alerts
  - Release channel management (`stable` / `beta` / `canary`) with rollback guidance
  - Accessibility and hotkey conflict checker
  - Plugin extension hooks for ticketing/CMDB/alert integrations
  - Built-in command allowlist/denylist policy packs
