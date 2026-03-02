# TermDock PRD

Version: v1.6  
Last updated: 2026-03-03

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

### 5.2 Terminal

- xterm-based terminal rendering
- Multi-tab and same-session multi-open
- Reconnect and context actions
- Configurable hotkeys
- KeepAlive and auto reconnect

### 5.3 SFTP

- Browse/open/refresh/path jump
- Create folder, rename, delete
- Upload/download with queue and progress
- Cancel single task and cancel all
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

## 6. Security Requirements

- No plain-text credential persistence
- Use keychain/credential manager via keytar where available
- Controlled destructive operations with confirmation

## 7. Non-functional Requirements

- Stable startup and reconnect behavior
- Transfer cancellation should be responsive and deterministic
- UI should avoid layout jumps in core workflows
- Release builds for macOS and Windows should be reproducible

## 8. Current Limitations

- SQLite migration not complete
- Automated test coverage is incomplete
- Signing/notarization process is not fully finalized
- Some recursive SFTP safety flows still need hardening

## 9. Release Gates Before Broader Rollout

1. Cross-platform smoke testing (`P0-F3`)
2. Installer signing/notarization and install verification (`P0-F4`)
3. Recoverable global error UX (`P0-E3`)

## 10. Version Plan

- `v0.1.3` (current stable): session/group workflow refresh, transfer improvements, remote file auto-sync, icon unification
- Next hardening cycle: testing, installer reliability, error recovery
- Next capability cycle: SSH config import, port forwarding, advanced transfer/workflow tooling
