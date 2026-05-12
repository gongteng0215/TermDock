# TermDock Release Page Copy

[中文](release-page-copy.zh-CN.md)

Use this copy for the GitHub Releases page. Keep the release page simple: users are there to decide whether to download.

## Template

```md
## TermDock v0.1.24

A safer SSH + SFTP desktop workspace for developers and operators.

TermDock brings multi-tab SSH, SFTP transfer, server health monitoring, port forwarding, dangerous-command guardrails, transfer retry, and diagnostics export into one local-first desktop app.

### Highlights

- Multi-tab SSH terminal and session management
- SFTP file browser with upload/download queues
- Dangerous-command guardrails before risky terminal writes
- Retry Center for failed transfer recovery
- Server health panel with CPU, memory, disk, network, load, processes, and failed services
- Port forwarding manager for Local, Remote, and Dynamic SOCKS5 forwards
- Operation Center for active transfers, deletes, port forwards, diagnostics jobs, and reconnect actions
- English and Simplified Chinese interface

### Downloads

- Windows installer: download `TermDock.Setup.*.exe`
- Windows portable: download the Windows `.zip`
- macOS Apple Silicon: download the `arm64` `.dmg` or `.zip`
- macOS Intel: download the `x64` `.dmg` or `.zip`

### First Run Notes

- TermDock is a local-first desktop app and does not require a cloud account.
- Session data and diagnostics are stored locally.
- Session/group exports exclude decrypted credentials.
- Review diagnostic bundles before sharing them publicly.
- Windows may show SmartScreen or publisher warnings for new open-source builds.
- macOS may show Gatekeeper warnings while public-trust signing/notarization is still in progress.

### Known Limitations

- No in-app auto-update yet.
- Persistence is still JSON-based; SQLite migration is planned.
- Public-trust signing/notarization evidence is still in progress.
- macOS or Windows may show trust warnings depending on the asset and platform policy.

See `README.md`, `README.zh-CN.md`, and `SECURITY.md` for screenshots, feature details, and security notes.
```

## Short Release Summary

```text
TermDock v0.1.24 packages the safer SSH + SFTP desktop workspace: multi-tab SSH, SFTP queues, dangerous-command guardrails, Retry Center, server health, port forwarding, diagnostics, and English/Simplified Chinese UI.
```

## Asset Naming Checklist

- `TermDock.Setup.0.1.24.exe`
- Windows portable `.zip`
- macOS `arm64` `.dmg` / `.zip`
- macOS `x64` `.dmg` / `.zip`

If an asset is missing, avoid mentioning it as available until the release upload is complete.
