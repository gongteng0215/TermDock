# Install And Launch Troubleshooting

[中文](INSTALL_TROUBLESHOOTING.zh-CN.md)

Use this guide when TermDock cannot be installed, opened, or launched.

## Download The Right Asset

Download TermDock only from the official GitHub Releases page:

```text
https://github.com/gongteng0215/TermDock/releases
```

Recommended assets:

| Platform | Recommended file | Use when |
| --- | --- | --- |
| Windows | `TermDock.Setup.*.exe` | You want the normal installer. |
| Windows | Windows `.zip` | You want a portable build without installation. |
| macOS Apple Silicon | macOS `arm64` `.dmg` or `.zip` | Your Mac uses Apple Silicon, such as M1/M2/M3/M4. |
| macOS Intel | macOS `x64` `.dmg` or `.zip` | Your Mac uses an Intel processor. |
| Source | Source code | You want to run or develop TermDock locally. |

If you are unsure, use the installer on Windows and the `.dmg` on macOS. If you are unsure which macOS CPU you have, check Apple menu -> About This Mac.

## Windows

### Windows Shows A Security Warning

Windows may show SmartScreen or publisher warnings for new or unsigned apps.

Before continuing:

- Confirm the file came from the official GitHub Releases page.
- Confirm the filename matches the expected TermDock release asset.
- Do not install files downloaded from mirrors or unknown links.

If Windows blocks the installer, capture the exact warning text and open an install issue.

### Portable ZIP Does Not Start

Try these checks:

1. Extract the `.zip` before running the app.
2. Move the extracted folder to a normal user path, such as `Downloads` or `Documents`.
3. Avoid running directly from a network share or protected system directory.
4. If antivirus software quarantines files, include the exact detection text in the issue.

## macOS

### macOS Says The App Cannot Be Opened

macOS may block apps that are not yet fully notarized or trusted by Gatekeeper.

Before continuing:

- Confirm the file came from the official GitHub Releases page.
- Prefer the `.dmg` release asset when available.
- Do not run copies from unknown mirrors.

If macOS blocks the app, capture the exact dialog text and your macOS version.

### App Opens To A Blank Window

If the app launches but shows a blank window:

1. Quit TermDock.
2. Reopen it once.
3. If the blank window persists, open an install issue with:
   - TermDock version
   - macOS version
   - downloaded asset
   - screenshot of the blank window

## Source Build

For source builds:

```bash
pnpm install
pnpm dev
```

Production build:

```bash
pnpm build
```

If source startup fails, include:

- Node.js version
- pnpm version
- OS version
- full terminal output

Remove private paths, tokens, hosts, usernames, and credentials before posting logs.

## Logs And Diagnostics

TermDock includes diagnostics and bug report export tools inside the app. If the app opens:

1. Open Settings.
2. Go to Diagnostics.
3. Use the log or bug report export actions.
4. Review the exported files before sharing.

Bug report exports may contain runtime metadata, logs, settings snapshots, or disconnect reports. Remove sensitive details before uploading them publicly.

If the app does not open at all, attach:

- exact installer/startup error text
- screenshot of the error dialog
- OS version
- downloaded release asset name

## Before Opening An Issue

Please include:

- TermDock version
- Platform and OS version
- Downloaded asset name
- Whether this is install failure, launch failure, blank window, or system warning
- Exact warning/error text
- Screenshot if possible
- Whether the asset came from the official GitHub Releases page

Do not include:

- passwords
- private keys
- tokens
- production hostnames
- real usernames
- sensitive server paths

Open an install issue here:

```text
https://github.com/gongteng0215/TermDock/issues/new/choose
```
