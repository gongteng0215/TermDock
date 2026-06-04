# TermDock Release 页面文案

[English](release-page-copy.md)

这份文案用于 GitHub Releases 页面。Release 页面要保持简单：用户来到这里主要是为了判断要不要下载、应该下载哪个文件。

## 模板

```md
## TermDock v0.1.31

TermDock 是一个面向个人开发者和小团队的本地优先 SSH + SFTP 服务器工作台。

它把 SSH 终端、多标签会话、SFTP 失败恢复、服务器健康、端口转发、危险命令保护和诊断导出放在一个本地优先的桌面应用里。

### 为什么推荐下载这一版

- 危险命令写入终端前拦截确认
- Retry Center 支持失败上传/下载恢复
- 在同一个工作台里查看 SSH、SFTP 和服务器健康
- 本地优先，不需要云账号
- 英文 / 简体中文界面

### 下载说明

- Windows 安装包：下载 `TermDock.Setup.*.exe`
- Windows 便携版：下载 Windows `.zip`
- macOS Apple Silicon：下载 `arm64` `.dmg` 或 `.zip`
- macOS Intel：下载 `x64` `.dmg` 或 `.zip`

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
- 公开可信签名 / notarization 证据仍在完善。
- macOS 或 Windows 可能根据平台策略显示信任提示。

截图、功能细节和安全说明见 `README.md`、`README.zh-CN.md` 和 `SECURITY.zh-CN.md`。
```

## 短 Release 摘要

```text
TermDock v0.1.31 主要刷新了公开发版文案：补清楚下载指引，强化本地优先和危险命令保护的价值表达，并移除了已经过期的“暂无自动更新”描述。
```

## Asset 命名检查

- `TermDock.Setup.0.1.31.exe`
- Windows portable `.zip`
- macOS `arm64` `.dmg` / `.zip`
- macOS `x64` `.dmg` / `.zip`

如果某个 asset 还没上传完成，不要在 release 描述里写它已经可用。
