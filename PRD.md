# TermDock PRD

Version: v1.13  
Last updated: 2026-03-16

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
- Startup normalization/migration for known mojibake session text in persisted JSON data
- Export all sessions and groups to JSON from session context menu
  - session export includes group metadata
  - group export includes per-group session lists
- Import sessions from JSON with merge wizard
  - group strategy (`keepSource` / `forceCurrent` / `ungrouped`)
  - duplicate strategy (`skip` / `overwrite` / `rename`)
- SSH config import workflow with preview and duplicate handling

### 5.2 Terminal

- xterm-based terminal rendering
- Multi-tab with single-tab-per-session behavior (open existing session => focus existing tab)
- Reconnect and context actions
- Configurable hotkeys
  - conflict detection with inline row highlight badges
  - one-click conflict auto-resolve
  - JSON import/export with before/after diff preview
  - import-time conflict count and optional `Import + Auto Resolve`
  - conflict navigation actions (`Locate`, `Focus First Conflict`, `Prev`, `Next`)
  - keyboard traversal (`Alt + [` / `Alt + ]`) and cursor restore across reopen
- KeepAlive and auto reconnect
- Command History side panel:
  - list-entry context actions (`Run` / `Copy` / `Delete`)
  - blank-area context actions (`Add` / `Import` / `Export` / `Manage`)
- Session quick profiles:
  - run/save/manage startup-command profiles per session
  - execute profile command when opening/focusing session tab
- Command snippet groups:
  - grouped snippet management (`run` / `add` / `import` / `export` / `clear`)
  - template placeholders for clipboard/time/session/tab metadata
- Port forwarding manager (`Local` / `Remote` / `Dynamic SOCKS5`) with saved presets and auto-restore
  - runtime status (`Active` / `Degraded`) and recent event timeline
  - event filtering (`type` / `time range` / `error code` / `correlation key`)
  - event analytics and export (`JSON` / `CSV`)
  - diagnostics snapshot export for support handoff

### 5.3 SFTP

- Browse/open/refresh/path jump
- Create folder, rename, delete
- Upload/download with queue and progress
- Cancel single task and cancel all
- Conflict policy for transfer collisions (`overwrite` / `skip` / `rename`)
- Session-scoped default conflict strategy memory for repeated transfer workflows
- Conflict pre-check acceleration with limited-concurrency directory scans
- Retry failed transfer tasks from transfer dock
- Session-scoped persistent failed-transfer history
- Transfer retry center (filter/search/select/retry/delete)
- Retry-center top failure suggestion rows for faster triage
- Disconnect-aware queue pause and reconnect resume for pending transfers
- Non-blocking transfer completion feedback in dock (modal-free for normal success path)
- Pending transfer queue snapshot + restart restore/discard actions
- Folder download
- Drag-and-drop upload

### 5.4 Remote File Open/Edit

- Open remote file into local temp file
- Prevent duplicate opens for same remote file
- Reopen after close
- Auto-upload on save back to remote path
- Save-back guard using remote metadata baseline (exists/size/mtime) to avoid silent overwrite

### 5.5 Monitoring

- CPU, memory, disk, network, load, uptime
- Alert thresholds for CPU/memory/disk
- Trend detail panel
- Top CPU processes and failed services

### 5.6 Settings

- Connection preferences
- Hotkey bindings
  - conflict diagnostics and navigation
  - import/export and restore workflow
- Server health alert thresholds
- File opening preferences
- Upload/download concurrency
- Port forwarding management section with preset save/apply controls
- Diagnostics section with log path actions
- Disconnect report controls (`auto-capture` toggle, JSON/CSV export, copy latest)

### 5.7 Diagnostics Logging

- Main process structured file logs with rotation
- Renderer global error and unhandled promise rejection capture
- User-visible log path access in Settings for bug triage
- Async queued log writes in main process to avoid blocking under burst logging
- Multi-file retention (`termdock.log` + archived rotation files) for longer investigation windows
- Disconnect-report capture for unexpected terminal `closed/error` events
- Disconnect-report export/copy tools in `Settings > Diagnostics`
- Bug-report bundle includes disconnect snapshot payload (`disconnect-reports.json`) when available
- Recoverable global error bar with quick actions (`Reconnect`, `Open Logs`, `Diagnostics`, `Copy Error`, `Copy Latest Disconnect`)

### 5.8 Stability Hardening (active)

- Prevent monitor request overlap per tab under high transfer load
- Reduce transfer-time disconnect risk when server resources are constrained
- Keep terminal viewport sizing stable on small windows and packaged startup
- Keep session-open behavior deterministic across keyboard-open dedupe and explicit double-click new-tab actions
- Enforce compact UI + fixed-height list-shell rulebook (`UI_COMPACT_RULES.md`) to prevent layout jitter

### 5.9 Quality Automation

- Electron smoke automation script for repeatable UI verification (`scripts/smoke-capture-all.mjs`)
- Screenshot-based artifact output for regression triage (`artifacts/smoke/<timestamp>`)
- Packaged smoke runbook and reproducible report baseline (`PACKAGED_SMOKE.md`, `summary.json`, `full-test-matrix.md`)
- GitHub Actions packaged smoke workflow baseline for Windows/macOS artifact capture
- Current baseline run includes sessions/menu/settings/command-history/retry-center/operation-center coverage

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
- Port forwarding diagnostics and analytics now exist in-session, but cross-device/shared correlation workflows are still pending; dynamic baseline is SOCKS5 no-auth `CONNECT` only
- Retry-center analytics/export baseline exists, but longitudinal trend analytics and richer clustering are still pending
- Session/group JSON export is available, but secure full-fidelity backup/restore (including credentials) is not complete

## 9. Release Gates Before Broader Rollout

1. Cross-platform smoke testing (`P0-F3`)
2. Installer signing/notarization and install verification (`P0-F4`)
3. Recoverable global error UX follow-up (`P0-E3`)

## 10. Version Plan

- `v0.1.12` (current stable): session double-click new-tab behavior fix and release polish
- Next patch cycle (master in progress):
  - packaged smoke automation/report baseline (`summary.json` + `full-test-matrix.md`)
  - packaged executable smoke launch override for Windows/macOS validation
  - packaged smoke workflow on GitHub Actions Windows/macOS runners
  - session tab dedupe on repeated open action (focus existing tab, no duplicate)
  - command history blank-area context menu actions
  - command snippet groups baseline with manager and grouped execution
  - known session text mojibake normalization on read/create/update
  - session/group JSON export actions from sessions context menu
  - session JSON import wizard with explicit group/duplicate strategy choices
  - session quick profiles baseline (run/save/manage)
  - transfer conflict pre-check parallelization (limited concurrency)
  - disconnect-aware transfer queue pause/resume UX
  - pending transfer queue snapshot persistence + restart restore/discard
  - transfer batch completion notice UX changed from blocking dialog to dock inline status
  - async diagnostics log writer with expanded rotation retention
  - monitor polling overlap guard during heavy transfer sessions
  - small-window packaged terminal refit stabilization
  - scripted transfer soak harness and matrix runbook
  - transfer conflict policy and failed-task retry actions
  - diagnostics logging baseline with settings log path tools
  - one-click bug report export (`Settings > Diagnostics`)
  - persistent failed-transfer history and retry-center baseline
  - session-scoped transfer conflict strategy memory
  - retry-center analytics snapshot export
  - retry-center top failure suggestion rows
  - SSH config import baseline + parser hardening (`Include`, wildcard/negation merge)
  - settings-based port forwarding baseline (`Local` / `Remote` / `Dynamic`)
  - saved port forwarding presets with optional auto-restore on connect
  - runtime status (`Active` / `Degraded`) and last-error metadata for active forwards
  - recent event timeline and diagnostics snapshot export
  - recent-event analytics cards and analytics export (`JSON` / `CSV`)
  - remote file auto-sync guard using remote metadata baseline checks before save-back upload
  - recoverable global error bar baseline with quick actions
  - hotkey conflict workflow expansion:
    - inline conflict badges and auto-resolve
    - JSON import/export with diff preview
    - import-time conflict count and `Import + Auto Resolve`
    - conflict navigation (`Locate`, `Focus First Conflict`, `Prev`, `Next`)
    - keyboard traversal (`Alt + [` / `Alt + ]`) and cursor signature persistence
- Next hardening cycle: testing, installer reliability, error recovery
- Capability cycle candidate A:
  - Cross-session/shared diagnostics correlation workflows
  - Retry-center longitudinal analytics and trend package
- Capability cycle candidate B:
  - Session templates and environment variable substitution
  - Operation center follow-up for richer long-running remote task coverage
  - Credential-safe encrypted session backup/restore (beyond current metadata export)
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

## 11. PRD Discussion Queue (for next development cycle)

Potential additions to discuss next (ordered by value-to-effort):

1. Remote file conflict resolution v2
   - When save-back guard detects remote drift, show explicit action chooser (`overwrite` / `reload` / `save-as`)
   - Optional fast diff preview before overwrite decision
2. Command snippet groups v2
   - Prompted variables (`${var}` form) with typed validation and defaults
   - Dry-run preview before execution on active tab
3. Session quick profiles v2
   - Multi-command profile chains and optional per-command delay
   - Profile-scoped environment variable presets for repeat workflows
4. Encrypted session backup/restore
   - Export/import full session bundle with secure payload (including credential references)
   - Integrity checks and import preview before apply
5. Operation center v2
   - Broader operation coverage (session import/export, snippet import/export, long diagnostics export)
   - Rich progress timeline and grouped cancel/retry controls
6. Transfer policy packs
   - Per-environment templates for concurrency/retry/conflict defaults
   - One-click apply for `dev` / `staging` / `prod` style workflows


