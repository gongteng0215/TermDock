# TermDock Release Page Copy

[中文](release-page-copy.zh-CN.md)

Use this copy for the GitHub Releases page. Keep the release page simple: users are there to decide whether to download.

## Template

```md
## TermDock v0.1.32

Local-first SSH + SFTP server workspace for solo developers and small teams.

TermDock brings SSH terminal tabs, SFTP transfer recovery, server health, port forwarding, dangerous-command guardrails, and diagnostics into one local-first desktop app.

### Why download this build

- Dangerous-command guardrails before risky terminal writes
- Retry Center for failed upload/download recovery
- Server health in the same workspace as SSH and SFTP
- Local-first workflow with no cloud account required
- English and Simplified Chinese interface

### Downloads

- Windows installer: download `TermDock.Setup.*.exe`
- Windows portable: download the Windows `.zip`
- macOS Apple Silicon: download the `arm64` `.dmg` or `.zip`
- macOS Intel: download the `x64` `.dmg` or `.zip`

### First Run Notes

- TermDock is a local-first desktop app and does not require a cloud account.
- SSH credentials, session data, and diagnostics are stored locally.
- Session/group exports exclude decrypted credentials.
- Review diagnostic bundles before sharing them publicly.
- Windows may show SmartScreen or publisher warnings for new open-source builds.
- macOS may show Gatekeeper warnings while public-trust signing/notarization is still in progress.

### Current Limitations

- In-app auto-update is supported, but public-trust signing/notarization is still in progress.
- Persistence is still JSON-based; SQLite migration is planned.
- Public-trust signing/notarization evidence is still in progress.
- macOS or Windows may show trust warnings depending on the asset and platform policy.

See `README.md`, `README.zh-CN.md`, and `SECURITY.md` for screenshots, feature details, and security notes.
```

## Short Release Summary

```text
TermDock v0.1.32 tightens the update experience with a manual update check, a visible in-app update status card, and cleaner icon alignment across high-frequency controls.
```

## Asset Naming Checklist

- `TermDock.Setup.0.1.32.exe`
- Windows portable `.zip`
- macOS `arm64` `.dmg` / `.zip`
- macOS `x64` `.dmg` / `.zip`

If an asset is missing, avoid mentioning it as available until the release upload is complete.
