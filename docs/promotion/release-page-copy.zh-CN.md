# TermDock Release 页面文案

[English](release-page-copy.md)

这份文案用于 GitHub Releases 页面。Release 页面要保持简单：用户来到这里主要是为了判断这个应用适不适合自己，以及应该下载哪个文件。

## 模板

```md
## TermDock vX.Y.Z

TermDock 是一个给经常登录服务器的开发者用的本地优先 SSH + SFTP 桌面工作台。

它把 SSH 终端、多标签会话、SFTP 文件浏览、失败传输恢复、服务器健康、端口转发、危险命令保护和诊断导出放在一个桌面窗口里。不需要云账号；会话和凭据默认留在本机。

### 推荐下载

- Windows 安装包：下载 `TermDock.Setup.X.Y.Z.exe`
- Windows 便携版：下载 Windows `.zip`
- macOS Apple Silicon：下载 `arm64` `.dmg` 或 `.zip`
- macOS Intel：下载 `x64` `.dmg` 或 `.zip`

如果不确定自己的 Mac 芯片类型，可以打开 Apple 菜单 -> 关于本机查看。

### 这一版更新了什么

- <面向用户的更新 1>
- <面向用户的更新 2>
- <重要修复或兼容性说明>

### 为什么使用 TermDock

- SSH + SFTP 同屏工作：终端标签、远程文件、命令历史和传输队列放在一个工作区里。
- 失败传输恢复：Retry Center 可以恢复失败上传/下载，不用从头来过。
- 工作时顺手看服务器健康：登录后就能查看 CPU、内存、磁盘、网络、进程和失败服务。
- 危险命令保护：高风险命令真正写入生产类主机前先停下来确认。
- 本地优先：不需要云账号；支持英文 / 简体中文界面。

### 第一次使用提示

- TermDock 是本地优先桌面应用，不需要云账号。
- SSH 凭据、会话数据和诊断信息保存在本地。
- 会话 / 分组导出不会包含解密后的凭据。
- 公开分享诊断包前，请先自行检查内容。
- Windows 可能会对新的开源构建显示 SmartScreen 或发布者提示。
- macOS 可能会在公开可信签名 / notarization 完善前显示 Gatekeeper 提示。

### 当前限制

- 已支持应用内自动更新，但公开可信签名和 notarization 仍在完善。
- 持久化仍基于 JSON，后续计划迁移 SQLite。
- macOS 或 Windows 可能根据平台策略显示信任提示。

截图、功能细节和安全说明见 `README.md`、`README.zh-CN.md` 和 `SECURITY.zh-CN.md`。
```

## 短 Release 摘要

```text
TermDock vX.Y.Z 更新了<一句话用户视角主题>。它是一个本地优先 SSH + SFTP 桌面工作台，把终端标签、远程文件、服务器健康、传输恢复和危险命令保护放在一个窗口里。
```

## Asset 命名检查

- `TermDock.Setup.X.Y.Z.exe`
- Windows portable `.zip`
- macOS `arm64` `.dmg` / `.zip`
- macOS `x64` `.dmg` / `.zip`

如果某个 asset 还没上传完成，不要在 release 描述里写它已经可用。
