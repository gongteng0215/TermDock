## Highlights

- Added transfer conflict policy for upload/download workflows (`Overwrite`, `Skip`, `Rename`).
- Added failed-transfer replay actions and a Transfer Retry Center with filter/search/select/retry/delete operations.
- Added session-scoped persistent failed-transfer history (survives restart).
- Added SSH config import workflow with preview and duplicate strategies (`skip`, `overwrite`, `rename`).
- Hardened SSH config parsing with recursive `Include` support and wildcard/negation host merge semantics.
- Added a port forwarding manager in `Settings > Port Fwd` with Local/Remote/Dynamic forwarding.
- Added forwarding presets with optional auto-restore on reconnect.
- Added forwarding runtime diagnostics: status (`Active`/`Degraded`), per-forward counters, last activity, and last error.
- Added forwarding event timeline (`created`, `removed`, `degraded`, `recovered`) and snapshot export for support handoff.
- Added persisted forwarding event history per session, with filters and clear actions.

## Diagnostics and Stability

- Added diagnostics logging baseline and `Settings > Diagnostics` actions.
- Added one-click bug report export (logs + runtime metadata + settings snapshot).
- Reduced transfer-time disconnect risk by preventing overlapping monitor polling during active transfers.
- Stabilized packaged/small-window terminal viewport behavior with deferred + font-ready fit flow.
- Added long-duration transfer soak tooling and runbook (`scripts/soak-transfer.mjs`, `SOAK_TEST.md`).

## Validation

- `pnpm run typecheck` passed.
- `pnpm run build` passed.
