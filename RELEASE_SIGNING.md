# TermDock Release Signing

[中文](RELEASE_SIGNING.zh-CN.md)

Last updated: 2026-05-09

## Goal

Use one deterministic preflight/build/verify flow for:

- signed Windows release artifacts
- signed and notarized macOS release artifacts
- reproducible installation verification evidence

For local/private Windows use, a self-signed path is also available.

Current branch note:

- `feature/editor-workbench-ui` does not change the signing or notarization flow.
- Post-refactor `pnpm run build`, workspace `pnpm run smoke:ui`, and `pnpm run smoke:ui:packaged` pass for this branch. Public-trust signing/notarization evidence remains a separate broader-rollout gate.
- Public-trust signing/notarization evidence remains a lower-priority self-use backlog item.

## CI Secrets

Windows signing:

- `WIN_CSC_LINK`
- `WIN_CSC_KEY_PASSWORD`

macOS signing:

- `MAC_CSC_LINK`
- `MAC_CSC_KEY_PASSWORD`

macOS notarization, choose one method:

- `APPLE_API_KEY_B64` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER`
- `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`
- `APPLE_KEYCHAIN` + `APPLE_KEYCHAIN_PROFILE`

Notes:

- The release workflow reads Windows signing from `WIN_CSC_*` and macOS signing from `MAC_CSC_*`.
- When using the Apple API key method, store the `.p8` contents as `APPLE_API_KEY_B64`; `scripts/prepare-release-secrets.mjs` materializes it to a temporary file and exports `APPLE_API_KEY` for `electron-builder`.
- macOS hardened runtime entitlements are provided by `build/entitlements.mac.plist` and `build/entitlements.mac.inherit.plist`.

## Repo Secret Bootstrap

If the credential files already exist on your local machine, you can seed the repo secrets with `gh`:

Windows code-signing cert:

```powershell
pnpm run release:set-secrets -- --repo=gongteng0215/TermDock --dry-run --win-csc-file=path\\to\\windows-cert.pfx --win-csc-key-password=your-password
```

macOS signing cert + API key notarization:

```powershell
pnpm run release:set-secrets -- --repo=gongteng0215/TermDock --dry-run --mac-csc-file=path\\to\\mac-cert.p12 --mac-csc-key-password=your-password --apple-api-key-file=path\\to\\AuthKey_ABC123.p8 --apple-api-key-id=ABC123 --apple-api-issuer=issuer-guid
```

Remove `--dry-run` when the names and file paths are correct.

## Self-Use Windows Path

Use this when you only need a Windows installer for your own machine or a small trusted environment.

```powershell
pnpm run release:self-use:cert:win
pnpm run release:self-use:win
```

This flow:

- creates or reuses a self-signed code-signing certificate under `%USERPROFILE%\\.termdock-secrets\\windows`
- builds `win-unpacked`
- signs the unpacked `TermDock.exe` with local `signtool.exe`
- repackages via `--prepackaged`
- signs the top-level installer
- runs `pnpm run release:verify -- --platform=win --expect-signature --install-smoke`

Limits:

- This is for self-use/private distribution only
- The signature is expected to be untrusted on machines that do not trust your self-signed cert
- It does not replace a public-trust CA certificate for formal release

## Preflight

Check whether signing/notarization inputs are present before building.

Windows:

```powershell
pnpm run release:preflight -- --platform=win --require-signing
```

macOS:

```bash
pnpm run release:preflight -- --platform=mac --require-signing --require-notarization
```

The script prints what is missing and exits non-zero when a required input is absent.

## Artifact Verification

After building release artifacts, verify signatures and installer behavior.

Windows signed verification + installer smoke:

```powershell
pnpm run release:verify -- --platform=win --expect-signed --install-smoke
```

macOS signed/notarized verification + DMG mount check:

```bash
pnpm run release:verify -- --platform=mac --expect-signed --expect-notarized --install-smoke
```

Each run writes a report under `artifacts/release-verify/<timestamp>/`.

## Local Windows Unsigned Validation

For local installer validation without signing secrets:

```powershell
pnpm run build
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://github.com/electron-userland/electron-builder-binaries/releases/download/"
pnpm exec electron-builder --win nsis zip --publish never --config.win.signAndEditExecutable=false
pnpm run release:verify -- --platform=win --install-smoke
```

This validates:

- release artifact presence
- silent NSIS install to a temporary directory
- silent uninstall cleanup

It does not validate Authenticode signing.

## CI Workflow

Workflow file:

- `.github/workflows/release.yml`

Current behavior:

- materializes `APPLE_API_KEY_B64` into a temporary `.p8` file when needed
- runs release signing preflight before each platform build
- builds platform release artifacts
- verifies signatures/notarization/install behavior via `scripts/verify-release-artifacts.mjs`
- uploads `artifacts/release-verify/**` as workflow artifacts
- publishes GitHub release assets only after build/verify jobs succeed

## Current Gap

- Secret provisioning still needs to be completed in GitHub Actions
- First public-trust signed Windows evidence and first signed/notarized macOS evidence are still pending
- Self-use Windows release flow is available locally, but it is not a substitute for CA-backed public release signing
