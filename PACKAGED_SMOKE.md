# TermDock Packaged Smoke

Last updated: 2026-03-19

## Goal

Use one repeatable smoke flow for:

- local workspace automation
- packaged Windows/macOS executable verification
- reproducible report export for release validation

The baseline automation entry points are:

- `pnpm run smoke:ui`
- `pnpm run smoke:ui:packaged`

## Outputs

Each run writes a new directory under `artifacts/smoke/<timestamp>` with:

- `summary.json`
- `full-test-matrix.md`
- PNG screenshots

Exit codes:

- `0`: all smoke steps passed
- `2`: one or more smoke steps failed
- `1`: fatal script/app launch error

## Local Workspace Run

Use this when validating current source + local build output.

```powershell
pnpm run typecheck
pnpm run build
pnpm run smoke:ui
```

Default mode:

- launches Electron against the current workspace
- writes report artifacts automatically

## Packaged Run

You can still produce a packaged directory build manually:

```powershell
pnpm run build
pnpm run pack
```

Fast local packaged wrapper:

```powershell
pnpm run smoke:ui:packaged
```

This wrapper now runs `pnpm run pack` first and then launches the packaged executable from `release/*`, so it does not silently reuse stale packaged output.

Windows PowerShell example:

```powershell
$env:TERMDOCK_SMOKE_EXECUTABLE = (Resolve-Path "release\\win-unpacked\\TermDock.exe")
$env:TERMDOCK_SMOKE_LABEL = "Packaged App (Windows)"
$env:TERMDOCK_SMOKE_PLATFORM = "windows"
pnpm run smoke:ui
```

macOS example:

```bash
export TERMDOCK_SMOKE_EXECUTABLE="$(find release -path '*TermDock.app/Contents/MacOS/TermDock' | head -n 1)"
export TERMDOCK_SMOKE_LABEL="Packaged App (macOS)"
export TERMDOCK_SMOKE_PLATFORM="macos"
pnpm run smoke:ui
```

Notes:

- For macOS, point to the actual executable inside the `.app` bundle, not the `.app` directory itself.
- Keep `TERMDOCK_SMOKE_EXECUTABLE` unset when you want workspace/dev-mode launch.
- On local Windows packaging, `pnpm run pack` uses a smoke-friendly Electron Builder override so the unpacked build can be produced without native rebuilds or `winCodeSign` resource-edit extraction. Use `dist:win` if you need the full release packaging path.

## Embedded Fixture Baseline

The smoke runner now starts a local embedded SSH/SFTP fixture (`scripts/smoke-ssh-fixture.mjs`) before launching Electron.

This baseline covers:

- SSH auth/connect and shell open
- dangerous-command approval on a live session
- SFTP list/upload/download/delete against a real temporary remote filesystem

No external host is required for the default workspace or packaged smoke pass.

## Optional Real SSH Annotation

If you also run a manual external-host SSH packaged check, append that evidence into the generated report:

```powershell
$env:TERMDOCK_SMOKE_REAL_SSH_STATUS = "Separate packaged check reached connected state on target host."
$env:TERMDOCK_SMOKE_REAL_SSH_SCREENSHOT = "E:\\AI\\TermDock\\artifacts\\smoke\\real-ssh-<timestamp>\\real-ssh-connect-check.png"
pnpm run smoke:ui
```

This adds a `Real SSH extension` section into `full-test-matrix.md`.

## Current Automated Coverage

- Embedded live SSH auth/connect lifecycle
- Embedded live SFTP list/upload/download/delete
- Dangerous-command approval bar on a live SSH session
- Sessions explorer context menus (blank/group/session)
- Group open/back navigation
- Same-session keyboard-open dedupe
- Session list double-click new-tab behavior
- Close and reopen same session
- `Settings > Safety` section, built-in rule reset, and approval-bar UI baseline
- Settings sections
- Snippet manager group/snippet/prompt-set baseline
- Command history manager flows
- Command history side-panel context menu
- Operation Center tracked app-job card baseline
- Retry Center grouped view

## Still Manual / Live-Host Coverage

- External-host auth differences (agent auth, key prompts, bastion/proxy rules, host-key policy)
- Conflict strategy behavior on real remote files
- Transfer cancellation under active network load
- Remote external-editor save-back against a live host
- Port forwarding against real sockets
- Server Health values from a live Linux host
- Unexpected disconnect evidence capture during real interruptions
- Targeted external-host packaged sanity pass when transport/auth/SFTP internals change

## Release Matrix

Windows packaged checklist:

1. Run `pnpm run pack`.
2. Run packaged smoke against `release/win-unpacked/TermDock.exe`.
3. Verify `full-test-matrix.md` is generated.
4. If the release touches transport/auth/SFTP/server-health behavior, run one external-host packaged pass and attach screenshot evidence.

macOS packaged checklist:

1. Run `pnpm run pack` on macOS.
2. Run packaged smoke against the executable inside `TermDock.app`.
3. Verify `full-test-matrix.md` is generated.
4. If the release touches transport/auth/SFTP/server-health behavior, run one external-host packaged pass and attach screenshot evidence.

## Release Evidence Bundle

For each platform attach:

- packaged smoke `summary.json`
- packaged smoke `full-test-matrix.md`
- relevant screenshots
- bug-report zip if the run exposed errors
- optional external-host packaged screenshot evidence

## CI Workflow

Workflow file:

- `.github/workflows/packaged-smoke.yml`

Current behavior:

- runs on GitHub Actions Windows and macOS runners
- builds unpacked packaged output with `pnpm run pack`
- runs `pnpm run smoke:ui:packaged`
- uploads `artifacts/smoke/**` as workflow artifacts
