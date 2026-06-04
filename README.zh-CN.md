# TermDock

**面向个人开发者和小团队的本地优先 SSH + SFTP 服务器工作台。**

TermDock 帮你在一个桌面应用里连接服务器、传输文件、查看服务器健康状态、恢复失败传输、管理端口转发，并在危险命令真正打到生产环境前拦下来。

[English README](README.md) · [下载](https://github.com/gongteng0215/TermDock/releases) · [SSH 配置导入](docs/SSH_CONFIG_IMPORT.zh-CN.md) · [SSH 连接排查](docs/SSH_CONNECTION_TROUBLESHOOTING.zh-CN.md) · [安全说明](SECURITY.zh-CN.md) · [参与贡献](CONTRIBUTING.zh-CN.md) · [更新记录](RELEASE_NOTES.zh-CN.md)

![TermDock 终端工作台](docs/assets/screenshots/preview/terminal-workspace.png)

## 为什么做 TermDock？

TermDock 不想成为另一个“大而全”的终端工具。它更像一个把 SSH、SFTP、传输恢复和服务器检查放在同一个工作台里的实用型服务器桌面应用。

### TermDock 最特别的地方

1. 危险命令保护
在命令真正打到服务器前先拦一次，减少手滑风险。

2. SFTP 失败传输恢复
上传或下载失败后，可以直接在 Retry Center 里重试，而不是从头来过。

3. 同一个工作台里看服务器健康状态
SSH 登录后就能顺手查看 CPU、内存、磁盘、网络、进程和失败服务。

4. 本地优先
不需要云账号，SSH 凭据默认留在本机。

## 下载

从 [GitHub Releases](https://github.com/gongteng0215/TermDock/releases) 下载最新版本。

### 推荐先下载这个

- Windows 安装包：`TermDock.Setup.*.exe`
- Windows 便携版：Windows `.zip`
- macOS Apple Silicon：`arm64` `.dmg`
- macOS Intel：`x64` `.dmg`

### 我应该下载哪个文件？

| 平台 | 推荐文件 | 适用场景 |
| --- | --- | --- |
| Windows | `TermDock.Setup.*.exe` | 想用普通安装包。 |
| Windows | Windows `.zip` | 想使用免安装便携版。 |
| macOS Apple Silicon | macOS `arm64` `.dmg` 或 `.zip` | 你的 Mac 使用 M1/M2/M3/M4 等 Apple Silicon 芯片。 |
| macOS Intel | macOS `x64` `.dmg` 或 `.zip` | 你的 Mac 使用 Intel 处理器。 |
| Source | 源码 | 想本地运行或参与开发。 |

TermDock 当前主要面向 macOS 和 Windows 11。

### 第一次启动提示

- 请只从官方 GitHub Releases 页面下载 TermDock。
- Windows 可能会对新的开源构建显示 SmartScreen 或发布者提示。
- macOS 可能会在公开可信签名 / notarization 完善前显示 Gatekeeper 提示。
- 如果不确定自己的 Mac 芯片类型，可以打开 Apple 菜单 -> 关于本机查看。

如果应用无法安装或打开，请先看 [安装和启动故障排查](docs/INSTALL_TROUBLESHOOTING.zh-CN.md)。

## 截图

### 多标签 SSH 终端

![多标签 SSH 终端](docs/assets/screenshots/preview/terminal-workspace.png)

### SFTP 文件管理

![SFTP 文件管理](docs/assets/screenshots/preview/sftp-file-browser.png)

### 危险命令保护

![危险命令保护](docs/assets/screenshots/preview/dangerous-command-guardrails.png)

### 操作中心

![操作中心](docs/assets/screenshots/preview/operation-center.png)

### 重试中心

![重试中心](docs/assets/screenshots/preview/retry-center.png)

### 端口转发管理

![端口转发管理](docs/assets/screenshots/preview/port-forwarding-settings.png)

## 核心功能

### SSH 工作台

- 支持密码和私钥认证
- 会话创建、编辑、删除、测试
- 会话分组、搜索、收藏和最近使用排序
- 多标签 xterm 终端和重连流程
- 从 `~/.ssh/config` 导入 SSH 配置，支持预览、重复项处理和导入后直接打开
- SSH 连接失败会显示更清晰的原因、下一步建议和原始错误
- 会话模板和启动命令快捷配置

### SFTP 文件传输

- 浏览、新建、重命名、删除、上传和下载远程文件
- 上传/下载队列，支持单任务取消和批量取消
- 上传/下载方向分别限速
- 传输时间窗口和计划任务
- 冲突策略：覆盖、跳过、重命名
- 应用重启后恢复待处理传输队列
- 远程文件打开/编辑，并带有保存回传冲突保护

### 安全和恢复

- 风险命令写入终端前显示审批栏
- 内置规则和自定义危险命令规则
- 可按来源控制：键盘输入、粘贴、命令历史、片段、快捷配置、启动命令
- 支持当前标签页或当前会话组的临时授权
- Retry Center 保存失败传输历史并支持一键重试
- 全局错误恢复栏会提供上下文相关的恢复动作

### 运维工具

- 服务器健康面板：CPU、内存、磁盘、网络、负载、运行时间、进程、失败服务
- 端口转发管理：Local (`-L`)、Remote (`-R`)、Dynamic SOCKS5 (`-D`)
- Operation Center 汇总传输、删除、端口转发、诊断任务和重连动作
- 诊断日志、断连报告和 bug report `.zip` 导出

## 安全模型

TermDock 是本地桌面应用，不需要云账号来管理服务器。

本地优先：TermDock 不需要云账号，也不会上传你的 SSH 密码、私钥和服务器配置。

- 会话数据保存在本地。
- 凭据会尽量通过应用凭据层使用系统安全存储。
- 会话和分组导出不会包含解密后的凭据。
- 加密迁移包可以在你设置的 passphrase 保护下包含密码和可选私钥文件。见 [会话迁移](docs/SESSION_MIGRATION.zh-CN.md)。
- 诊断日志和 bug report 在本地生成，你可以检查后再决定是否分享。

更多细节和当前限制见 [安全说明](SECURITY.zh-CN.md)。

## 开发运行

```bash
pnpm install
pnpm dev
```

构建：

```bash
pnpm build
```

运行 UI smoke：

```bash
pnpm run smoke:ui
```

默认 smoke 会启动本地内置 SSH/SFTP fixture，不需要外部服务器即可验证核心认证、终端、SFTP、端口转发、设置、诊断、命令历史、重试中心和操作中心流程。

## 项目结构

```txt
src/main       Electron 主进程、IPC、存储
src/renderer   React UI
src/shared     共享契约和类型
docs/assets    README 截图和产品素材
```

## 当前状态

- 最新验证：`pnpm run typecheck`、`pnpm run build`、`pnpm run smoke:ui` 均通过。
- 最新 workspace smoke artifact：`artifacts/smoke/2026-05-14T06-14-31-419Z/summary.json` (`PASS 48 / FAIL 0 / SKIP 0`)。
- 当前打包目标：macOS (`arm64`, `x64`) 和 Windows (`nsis`, `zip`)。

更细的进度、验证和计划见：

- [更新记录](RELEASE_NOTES.zh-CN.md) / [English](RELEASE_NOTES.md)
- [文档索引](docs/DOCUMENTATION.zh-CN.md) / [English](docs/DOCUMENTATION.md)
- [进度快照](PROGRESS.zh-CN.md) / [English](PROGRESS.md)
- [任务看板](TASKS.zh-CN.md) / [English](TASKS.md)
- [打包 Smoke Runbook](PACKAGED_SMOKE.zh-CN.md) / [English](PACKAGED_SMOKE.md)
- [签名发布 Runbook](RELEASE_SIGNING.zh-CN.md) / [English](RELEASE_SIGNING.md)
- [紧凑 UI 规则](UI_COMPACT_RULES.zh-CN.md) / [English](UI_COMPACT_RULES.md)
- [SSH 配置导入](docs/SSH_CONFIG_IMPORT.zh-CN.md) / [English](docs/SSH_CONFIG_IMPORT.md)
- [SSH 连接故障排查](docs/SSH_CONNECTION_TROUBLESHOOTING.zh-CN.md) / [English](docs/SSH_CONNECTION_TROUBLESHOOTING.md)
- [安装和启动故障排查](docs/INSTALL_TROUBLESHOOTING.zh-CN.md) / [English](docs/INSTALL_TROUBLESHOOTING.md)
- [反馈处理流程](docs/FEEDBACK_TRIAGE.zh-CN.md) / [English](docs/FEEDBACK_TRIAGE.md)
- [GitHub Labels](docs/GITHUB_LABELS.zh-CN.md) / [English](docs/GITHUB_LABELS.md)
- [参与贡献](CONTRIBUTING.zh-CN.md) / [English](CONTRIBUTING.md)
- [60 秒演示脚本](docs/promotion/60-second-demo.zh-CN.md) / [English](docs/promotion/60-second-demo.md)
- [GitHub 页面配置](docs/promotion/github-page-setup.zh-CN.md) / [English](docs/promotion/github-page-setup.md)
- [Release 页面文案](docs/promotion/release-page-copy.zh-CN.md) / [English](docs/promotion/release-page-copy.md)

## 已知限制

- 数据持久化仍基于 JSON，SQLite 迁移在计划中。
- 已支持应用内自动更新，但公开可信签名和 notarization 仍在完善。
- 公开可信签名和 notarization 证据仍在完善。
- 运行中的端口转发目前按标签页管理。
- Dynamic 转发当前支持 SOCKS5 no-auth `CONNECT` 基线。

## License

MIT
