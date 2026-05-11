# GitHub Page Setup

Use this file to configure the public GitHub repository page after README assets are in place.

## About Description

```text
A safer SSH + SFTP desktop workspace for developers and operators.
```

## Website

Leave empty until there is a product site. The GitHub repository and Releases page are the primary landing pages for now.

## Topics

Add these topics from the repository page:

```text
ssh
sftp
terminal
xterm
electron
react
typescript
devops
sysadmin
server-management
port-forwarding
desktop-app
windows
macos
ssh-client
sftp-client
```

## Social Preview

Use the dedicated repository social preview image.

Recommended candidate:

```text
docs/assets/social-preview.png
```

The image is 1280x640 and cropped from the terminal workspace so GitHub does not need to guess a crop.

## Latest Release Description Template

```md
## TermDock

A safer SSH + SFTP desktop workspace for developers and operators.

### Highlights

- Multi-tab SSH terminal
- SFTP file browser and transfer queues
- Dangerous-command guardrails
- Retry Center for failed transfers
- Server health panel
- Port forwarding manager
- Diagnostics and bug report export
- English and Simplified Chinese interface

### Downloads

- Windows installer: `TermDock.Setup.*.exe`
- Windows portable: `*.zip`
- macOS disk image: `*.dmg`
- macOS archive: `*.zip`

### Notes

TermDock is a local-first desktop app. Session data and diagnostics are stored locally. See `SECURITY.md` for credential and diagnostic-export notes.

If macOS or Windows shows signing/trust warnings, check the release notes and signing documentation before installing.
```

## Manual Steps

1. Open `https://github.com/gongteng0215/TermDock`.
2. Click the repository About settings gear.
3. Set the description to the text above.
4. Add the listed topics.
5. Confirm Releases are visible from the README download link.
6. Update the latest release description with the template above.
7. Upload or configure a social preview image if desired.
