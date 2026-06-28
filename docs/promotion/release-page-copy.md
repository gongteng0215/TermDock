# TermDock Release Page Copy

[中文](release-page-copy.zh-CN.md)

Use this copy for the GitHub Releases page. Keep the release page simple: users are there to decide whether this app is for them and which file to download.

## Template

```md
## TermDock vX.Y.Z

TermDock is a local-first SSH + SFTP desktop workspace for developers who live on servers.

It keeps terminal tabs, remote files, transfer recovery, server health, port forwarding, dangerous-command guardrails, and diagnostics in one desktop window. No cloud account required; your sessions and credentials stay local.

### Recommended Download

- Windows installer: download `TermDock.Setup.X.Y.Z.exe`
- Windows portable: download the Windows `.zip`
- macOS Apple Silicon: download the `arm64` `.dmg` or `.zip`
- macOS Intel: download the `x64` `.dmg` or `.zip`

If you are not sure which Mac you have, open Apple menu -> About This Mac.

### What's New In This Release

- <User-facing change 1>
- <User-facing change 2>
- <Important fix or compatibility note>

### Why Use TermDock

- SSH + SFTP in one workspace: terminal tabs, remote files, command history, and transfer queues stay visible together.
- Transfer recovery: Retry Center helps recover failed uploads and downloads without starting over.
- Server health where you work: check CPU, memory, disk, network, processes, and failed services after login.
- Dangerous-command guardrails: pause risky commands before they reach production-like hosts.
- Local-first workflow: no cloud account required; English and Simplified Chinese interfaces are available.

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
- macOS or Windows may show trust warnings depending on the asset and platform policy.

See `README.md`, `README.zh-CN.md`, and `SECURITY.md` for screenshots, feature details, and security notes.
```

## Short Release Summary

```text
TermDock vX.Y.Z updates <short user-facing theme>. It is a local-first SSH + SFTP desktop workspace with terminal tabs, remote files, server health, transfer recovery, and dangerous-command guardrails in one window.
```

## Asset Naming Checklist

- `TermDock.Setup.X.Y.Z.exe`
- Windows portable `.zip`
- macOS `arm64` `.dmg` / `.zip`
- macOS `x64` `.dmg` / `.zip`

If an asset is missing, avoid mentioning it as available until the release upload is complete.
