# Draft Release Notes (master hardening, pre-v0.1.12)

Last updated: 2026-03-13

## Highlights

- Fixed same-session duplicate tab creation:
  - opening the same session repeatedly now focuses the existing tab
  - close-then-reopen still works as expected
- Added Command History blank-area context menu:
  - right-click blank area now supports `Add` / `Import` / `Export` / `Manage`
- Added session text normalization migration:
  - known mojibake text patterns are repaired on load
  - create/update flows now persist normalized text
- Expanded local UI smoke automation and captured full pass (`21/21`)
- Added session export actions in Sessions context menus:
  - `Export All Sessions...` (JSON with group metadata)
  - `Export All Groups...` (JSON with per-group session lists)
- Added session JSON import wizard:
  - `Import Sessions JSON...` with group strategy and duplicate strategy selectors
- Added session quick profiles:
  - `Run Quick Profile...`, `Save Quick Profile...`, `Manage Quick Profiles...`
- Added command snippet groups baseline:
  - command history panel supports `Run Snippet` and `Snippet Manager`
- Expanded hotkey conflict workflow in `Settings > Hotkeys`:
  - inline conflict badges and one-click `Auto Resolve Conflicts`
  - hotkey JSON import/export (`Import Hotkeys...` / `Export Hotkeys...`)
  - import-time before/after diff preview and conflict count
  - optional `Import + Auto Resolve` path with disable-impact preview
  - conflict navigation controls (`Locate`, `Focus First Conflict`, `Prev`, `Next`)
  - keyboard traversal (`Alt + [` / `Alt + ]`) and cursor signature persistence across reopen
- Added transfer conflict policy for upload/download workflows (`Overwrite`, `Skip`, `Rename`).
- Added session-scoped conflict strategy memory (`Remember for Session`) for upload/download collisions.
- Added pending transfer queue restart recovery (`Restore Pending` / `Discard Pending`).
- Accelerated transfer conflict pre-check with limited-concurrency directory scans.
- Added disconnect-aware transfer queue pause/resume behavior.
- Replaced blocking transfer completion popup with dock inline completion notice.
- Added batch failure detail logging for transfer triage.
- Added failed-transfer replay actions and a Transfer Retry Center with filter/search/select/retry/delete operations.
- Added session-scoped persistent failed-transfer history (survives restart).
- Added Retry Center analytics package (top failure reasons + analytics export `JSON` / `CSV`).
- Added SSH config import workflow with preview and duplicate strategies (`skip`, `overwrite`, `rename`).
- Hardened SSH config parsing with recursive `Include` support and wildcard/negation host merge semantics.
- Added a port forwarding manager in `Settings > Port Fwd` with Local/Remote/Dynamic forwarding.
- Added forwarding presets with optional auto-restore on reconnect.
- Added forwarding runtime diagnostics: status (`Active`/`Degraded`), per-forward counters, last activity, and last error.
- Added forwarding event timeline (`created`, `removed`, `degraded`, `recovered`) and snapshot export for support handoff.
- Added persisted forwarding event history per session, with filters and clear actions.
- Added port-forward event analytics cards and analytics export (`JSON` / `CSV`).
- Added recoverable global error bar actions (`Reconnect`, `Open Logs`, `Diagnostics`, `Copy Error`).
- Added global error-bar quick action `Copy Latest Disconnect` when disconnect reports exist.
- Added operation center baseline modal for active long-running operation visibility.
- Added remote open-file save-back guard baseline (remote metadata baseline check before auto-upload).
- Added retry-center top-failure suggestion rows for faster troubleshooting.

## Diagnostics and Stability

- Added diagnostics logging baseline and `Settings > Diagnostics` actions.
- Upgraded diagnostics writer to async queued writes with multi-file archive retention.
- Added one-click bug report export (logs + runtime metadata + settings snapshot).
- Bug-report export now includes disconnect-report snapshot payload (`disconnect-reports.json`) when available.
- Added disconnect-report controls in diagnostics: auto-capture toggle, JSON/CSV export, and copy-latest action.
- Reduced transfer-time disconnect risk by preventing overlapping monitor polling during active transfers.
- Stabilized packaged/small-window terminal viewport behavior with deferred + font-ready fit flow.
- Added long-duration transfer soak tooling and runbook (`scripts/soak-transfer.mjs`, `SOAK_TEST.md`).

## Still Not Done

1. Cross-platform packaged smoke checklist and reproducible report (`P0-F3`)
2. Signing/notarization + installer verification (`P0-F4`)
3. Recoverable global error UX follow-up coverage (`P0-E3`)
4. Operation center follow-up for broader operation types and cancellation coverage (`F8`)
5. Unit/integration regression baseline (`P0-F1` / `P0-F2`)

## Validation

- `pnpm run typecheck` passed.
- `pnpm run build` passed.


