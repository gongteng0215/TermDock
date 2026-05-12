# Security

[中文](SECURITY.zh-CN.md)

TermDock is an SSH/SFTP desktop client, so credential handling and local data boundaries matter.

## Local-First Design

- TermDock does not require a cloud account to manage servers.
- Session data, transfer history, settings, logs, and diagnostics are stored locally on the machine running the app.
- Diagnostics and bug report bundles are created locally so you can inspect them before sharing.

## Credentials

- TermDock stores connection secrets through the app credential layer, using OS secure storage where available.
- Session and group JSON exports intentionally exclude decrypted credentials.
- Imported session data should be reviewed before saving, especially when it comes from another machine or team member.

## Diagnostics

Bug report exports may include runtime metadata, logs, settings snapshots, and disconnect reports. Review the generated archive before uploading it to a public issue or sending it to another person.

## Current Limitations

- Data persistence is still JSON-based while the SQLite migration is pending.
- Public-trust signing/notarization evidence is still in progress.
- There is no in-app auto-update yet.
- Team/shared vault sync is not implemented.

## Reporting Security Issues

Please do not disclose sensitive security issues publicly before they can be triaged.

Open a private report through GitHub security advisories if available, or contact the maintainer with enough detail to reproduce the issue without including real production credentials.
