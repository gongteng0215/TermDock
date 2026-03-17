# TermDock Packaged Smoke

Last updated: 2026-03-16

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

First produce a packaged directory build:

```powershell
pnpm run build
pnpm run pack
```

Then point the smoke script at the packaged executable.

Fast local packaged wrapper:

```powershell
pnpm run smoke:ui:packaged
```

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
- On local Windows packaging, Electron may require Visual Studio Build Tools for native dependency rebuilds (`keytar`, `cpu-features`). GitHub Actions runners already provide this path.

## Optional Real SSH Annotation

If you also run a manual real-SSH packaged check, append that evidence into the generated report:

```powershell
$env:TERMDOCK_SMOKE_REAL_SSH_STATUS = "Separate packaged check reached connected state on target host."
$env:TERMDOCK_SMOKE_REAL_SSH_SCREENSHOT = "E:\\AI\\TermDock\\artifacts\\smoke\\real-ssh-<timestamp>\\real-ssh-connect-check.png"
pnpm run smoke:ui
```

This adds a `Real SSH extension` section into `full-test-matrix.md`.

## Current Automated Coverage

- Sessions explorer context menus (blank/group/session)
- Group open/back navigation
- Same-session keyboard-open dedupe
- Session list double-click new-tab behavior
- Close and reopen same session
- Settings sections
- Command history manager flows
- Command history side-panel context menu
- Operation Center
- Retry Center grouped view

## Still Manual / Live-Host Coverage

- Real SSH auth/connect lifecycle
- Live SFTP list/upload/download/delete
- Conflict strategy behavior on real remote files
- Transfer cancellation under active network load
- Remote external-editor save-back against a live host
- Port forwarding against real sockets
- Server Health values from a live Linux host
- Unexpected disconnect evidence capture during real interruptions

## Release Matrix

Windows packaged checklist:

1. Run `pnpm run pack`.
2. Run packaged smoke against `release/win-unpacked/TermDock.exe`.
3. Verify `full-test-matrix.md` is generated.
4. Run one real-SSH packaged manual pass and attach screenshot evidence.

macOS packaged checklist:

1. Run `pnpm run pack` on macOS.
2. Run packaged smoke against the executable inside `TermDock.app`.
3. Verify `full-test-matrix.md` is generated.
4. Run one real-SSH packaged manual pass and attach screenshot evidence.

## Release Evidence Bundle

For each platform attach:

- packaged smoke `summary.json`
- packaged smoke `full-test-matrix.md`
- relevant screenshots
- bug-report zip if the run exposed errors
- optional real-SSH packaged screenshot

## CI Workflow

Workflow file:

- `.github/workflows/packaged-smoke.yml`

Current behavior:

- runs on GitHub Actions Windows and macOS runners
- builds unpacked packaged output with `pnpm run pack`
- runs `pnpm run smoke:ui:packaged`
- uploads `artifacts/smoke/**` as workflow artifacts
