# TermDock Release Page Copy

Use this copy for the GitHub Releases page. Keep the release page simple: users are there to decide whether to download.

## English Template

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
- macOS disk image: download the `.dmg`
- macOS archive: download the macOS `.zip`

### First Run Notes

- TermDock is a local-first desktop app and does not require a cloud account.
- Session data and diagnostics are stored locally.
- Session/group exports exclude decrypted credentials.
- Review diagnostic bundles before sharing them publicly.

### Known Limitations

- No in-app auto-update yet.
- Persistence is still JSON-based; SQLite migration is planned.
- Public-trust signing/notarization evidence is still in progress.
- macOS or Windows may show trust warnings depending on the asset and platform policy.

See `README.md`, `README.zh-CN.md`, and `SECURITY.md` for screenshots, feature details, and security notes.
```

## Chinese Template

```md
## TermDock v0.1.24

TermDock 是一个面向开发者和运维的安全 SSH + SFTP 桌面工作台。

它把多标签 SSH、SFTP 文件传输、服务器健康监控、端口转发、危险命令保护、失败重试和诊断导出放在一个本地优先的桌面应用里。

### 主要功能

- 多标签 SSH 终端和会话管理
- SFTP 文件浏览、上传/下载队列
- 危险命令写入终端前拦截确认
- Retry Center，用于失败传输恢复
- 服务器健康面板：CPU、内存、磁盘、网络、负载、进程、失败服务
- 端口转发管理：Local、Remote、Dynamic SOCKS5
- Operation Center 汇总传输、删除、端口转发、诊断任务和重连动作
- 英文 / 简体中文界面

### 下载说明

- Windows 安装包：下载 `TermDock.Setup.*.exe`
- Windows 便携版：下载 Windows `.zip`
- macOS 安装镜像：下载 `.dmg`
- macOS 压缩包：下载 macOS `.zip`

### 第一次使用提示

- TermDock 是本地优先桌面应用，不需要云账号。
- 会话数据和诊断信息保存在本地。
- 会话/分组导出不会包含解密后的凭据。
- 公开分享诊断包前，请先自行检查内容。

### 已知限制

- 暂无应用内自动更新。
- 持久化仍基于 JSON，后续计划迁移 SQLite。
- 公开可信签名 / notarization 证据仍在完善。
- macOS 或 Windows 可能根据平台策略显示信任提示。

截图、功能细节和安全说明见 `README.md`、`README.zh-CN.md` 和 `SECURITY.md`。
```

## Short Release Summary

```text
TermDock v0.1.24 packages the safer SSH + SFTP desktop workspace: multi-tab SSH, SFTP queues, dangerous-command guardrails, Retry Center, server health, port forwarding, diagnostics, and English/Simplified Chinese UI.
```

## Asset Naming Checklist

- `TermDock.Setup.0.1.24.exe`
- Windows portable `.zip`
- macOS `.dmg`
- macOS `.zip`

If an asset is missing, avoid mentioning it as available until the release upload is complete.
