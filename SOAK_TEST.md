# Transfer Soak Test

This document describes how to run long-duration transfer stress tests against a real SSH/SFTP server.

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
