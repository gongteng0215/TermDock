# GitHub 页面配置

[English](github-page-setup.md)

README 素材就绪后，用这份文档配置公开 GitHub 仓库页面。

## About 描述

```text
A safer SSH + SFTP desktop workspace for developers and operators.
```

## Website

暂时留空，直到有独立产品网站。目前 GitHub 仓库和 Releases 页面就是主要落地页。

## Topics

在仓库页面添加这些 topics：

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

使用专门的仓库 social preview 图片。

推荐文件：

```text
docs/assets/social-preview.png
```

图片尺寸为 1280x640，从终端工作台截图裁切，避免 GitHub 自动裁切出不合适的画面。

## 最新 Release 描述模板

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
- macOS Apple Silicon: `arm64` `.dmg` or `.zip`
- macOS Intel: `x64` `.dmg` or `.zip`

### Notes

TermDock is a local-first desktop app. Session data and diagnostics are stored locally. See `SECURITY.md` for credential and diagnostic-export notes.

If macOS or Windows shows signing/trust warnings, check the release notes and signing documentation before installing.
```

## 手动步骤

1. 打开 `https://github.com/gongteng0215/TermDock`。
2. 点击仓库 About 设置齿轮。
3. 将描述设置为上面的文字。
4. 添加 topics。
5. 确认 README 下载链接可以进入 Releases。
6. 用上面的模板更新最新 Release 描述。
7. 如需要，上传或配置 social preview 图片。
