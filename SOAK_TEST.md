# Transfer Soak Test

This document describes how to run long-duration transfer stress tests against a real SSH/SFTP server.

Last updated: 2026-03-13

## Goal

- Reproduce and measure random disconnect issues during heavy upload workloads.
- Validate monitor-polling and terminal stability hardening on `master`.

## Script

- Script path: `scripts/soak-transfer.mjs`
- Runtime: Node.js 22+
- Transport: `ssh2` (same core library used by app backend)

## Required Environment Variables

- `TD_SSH_HOST`: server host/IP
- `TD_SSH_USER`: username
- Authentication:
  - `TD_SSH_PASSWORD`, or
  - `TD_SSH_KEY_PATH` (+ optional `TD_SSH_PASSPHRASE`)

## Optional Environment Variables

- `TD_SSH_PORT` (default `22`)
- `TD_DURATION_MINUTES` (default `30`)
- `TD_UPLOAD_CONCURRENCY` (default `4`)
- `TD_FIXTURE_FILES` (default `24`)
- `TD_FILE_SIZE_KB` (default `128`)
- `TD_MAX_UPLOADS` (default `4000`)
- `TD_REMOTE_BASE_DIR` (default `/tmp/termdock-soak`)
- `TD_MONITOR_INTERVAL_MS` (default `5000`)
- `TD_MONITOR_TIMEOUT_MS` (default `10000`)
- `TD_MONITOR_ALLOW_OVERLAP` (default `false`)
- `TD_KEEP_REMOTE` (default `false`)
- `TD_PROGRESS_EVERY` (default `50`)

## Run (PowerShell)

```powershell
$env:TD_SSH_HOST="10.0.0.12"
$env:TD_SSH_USER="root"
$env:TD_SSH_PASSWORD="your-password"
$env:TD_DURATION_MINUTES="60"
$env:TD_UPLOAD_CONCURRENCY="5"
$env:TD_FILE_SIZE_KB="256"
$env:TD_MAX_UPLOADS="10000"
node scripts/soak-transfer.mjs
```

## Result Interpretation

The script prints a JSON summary at the end. Check these fields first:

- `disconnectedUnexpectedly`:
  - `true` means the SSH session closed unexpectedly during the test window.
- `uploadsFailed`:
  - non-zero indicates file transfer failures.
- `monitorErrors`:
  - non-zero indicates monitoring command failures/timeouts.
- `sampleErrors`:
  - first error samples for quick triage.

The script exits with code:

- `0`: no disconnect/failure detected
- `2`: disconnect or transfer/monitor failures detected
- `1`: fatal setup/runtime error

## Log Collection for Bug Triage

When a soak run shows disconnects or failures, collect app diagnostics logs together with the soak summary:

1. Open app `Settings > Diagnostics`.
2. Click `Export Bug Report` and save the generated zip.
3. Click `Export Disconnect Reports` (JSON) or `Export CSV` for disconnect timeline evidence.
4. (Optional) click `Copy Latest Report` for quick handoff in chat/tickets.
5. (Optional) click `Open Folder` for raw logs.
6. Attach the bug-report zip, disconnect export, and soak summary JSON to bug reports.

Notes:

- Logger now keeps rotating archives (`termdock.log` + `termdock.log.1` ... `.5`), so include all available files when investigating long runs.
- Batch failure detail lines are written into diagnostics logs for faster failed-item triage.

This shortens root-cause analysis for transfer/session issues.

If the issue involves SSH tunnels/port forwarding, also collect forwarding diagnostics:

1. Open app `Settings > Port Fwd` on the affected tab.
2. Click `Export Snapshot`.
3. Click `Export Analytics JSON` (or `Export Analytics CSV`) under `Recent Events`.
4. Attach exported files together with the bug-report zip and soak summary JSON.

If the issue also involves session/group integrity, export session metadata for correlation:

1. Open Sessions panel context menu.
2. Run `Export All Sessions...` and `Export All Groups...`.
3. Attach both JSON exports with the soak summary.

## Recommended Test Matrix

1. Baseline:
   - `30 min`, concurrency `2`, file size `128 KB`
2. Medium:
   - `60 min`, concurrency `4`, file size `256 KB`
3. High pressure:
   - `90 min`, concurrency `6`, file size `512 KB`

## Manual UI Validation (Packaged App)

After each script run, validate packaged UI (`release` build):

1. Open a small window (not maximized) and edit a large file in `nano`/`vim`.
2. Scroll continuously for `2-3` minutes.
3. Confirm no viewport corruption and no garbage wheel text.
4. Repeat after maximizing/restoring the window.
5. Run a large upload/download batch and confirm completion is shown via dock inline notice (no blocking modal on normal success).
6. Trigger one recoverable error path (for example disconnect/retry) and confirm global error bar actions are available (`Reconnect`, `Open Logs`, `Diagnostics`, `Copy Error`, `Copy Latest Disconnect` when reports exist).
7. Open `Settings > Hotkeys` and verify conflict tooling behavior:
   - conflict list supports `Locate`, `Prev`, `Next`, and `Focus First Conflict`
   - keyboard traversal works with `Alt + [` / `Alt + ]`
   - reopening settings restores the previous conflict cursor position when signature still exists
8. In Sessions panel, repeatedly open the same session and verify:
   - keyboard/open-selected flow still focuses the existing tab
   - double-clicking the session opens a fresh tab
   - closing and reopening still works
9. If a transfer run is interrupted by app restart, verify transfer dock shows:
   - `Restore Pending`
   - `Discard Pending`
   - restoring re-queues valid pending items for existing sessions
10. Open and edit one remote file from external editor and verify:
   - save-back works on normal path
   - when remote file changes externally, auto-sync guard skips unsafe overwrite and logs a diagnostics warning

