# TermDock

**面向开发者和运维的安全 SSH + SFTP 桌面工作台。**

TermDock 把日常服务器操作放在一个桌面应用里：多标签 SSH 终端、SFTP 文件传输、服务器健康监控、端口转发、危险命令保护、失败重试中心和诊断导出。

[English README](README.md) · [下载](https://github.com/gongteng0215/TermDock/releases) · [安全说明](SECURITY.md) · [更新记录](RELEASE_NOTES.md)

![TermDock 终端工作台](docs/assets/screenshots/preview/terminal-workspace.png)

## 为什么做 TermDock？

TermDock 不想成为另一个“大而全”的终端工具。它更像一个个人开发者、小团队和运维人员使用的服务器工作台，解决 SSH、SFTP、端口转发、服务器状态检查和故障恢复之间来回切换的问题。

- SSH + SFTP 集成在一个桌面应用里
- 多标签终端，适合同时管理多台服务器
- 内置服务器健康面板：CPU、内存、磁盘、网络、负载、运行时间
- 危险命令执行前拦截确认，减少手滑风险
- 上传/下载队列、失败重试中心、限速和时间窗口
- 远程文件打开/编辑，并带有覆盖保护
- 端口转发管理：Local、Remote、Dynamic SOCKS5
- 一键导出诊断日志和 bug report

## 下载

从 [GitHub Releases](https://github.com/gongteng0215/TermDock/releases) 下载最新版本。

- Windows：安装包 `.exe` 和便携版 `.zip`
- macOS：`.dmg` 和 `.zip`
- 源码构建：Electron + React + TypeScript

TermDock 当前主要面向 macOS 和 Windows 11。

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
- 从 `~/.ssh/config` 导入 SSH 配置，支持预览和重复项处理
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

- 会话数据保存在本地。
- 凭据会尽量通过应用凭据层使用系统安全存储。
- 会话和分组导出不会包含解密后的凭据。
- 诊断日志和 bug report 在本地生成，你可以检查后再决定是否分享。

更多细节和当前限制见 [SECURITY.md](SECURITY.md)。

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
- 最新 workspace smoke artifact：`artifacts/smoke/2026-05-11T08-35-26-189Z/summary.json` (`PASS 47 / FAIL 0 / SKIP 0`)。
- 当前打包目标：macOS (`arm64`, `x64`) 和 Windows (`nsis`, `zip`)。

更细的进度、验证和计划见：

- [更新记录](RELEASE_NOTES.md)
- [进度快照](PROGRESS.md)
- [任务看板](TASKS.md)
- [打包 Smoke Runbook](PACKAGED_SMOKE.md)
- [签名发布 Runbook](RELEASE_SIGNING.md)
- [紧凑 UI 规则](UI_COMPACT_RULES.md)
- [60 秒演示脚本](docs/promotion/60-second-demo.md)

## 已知限制

- 数据持久化仍基于 JSON，SQLite 迁移在计划中。
- 暂无应用内自动更新。
- 公开可信签名和 notarization 证据仍在完善。
- 运行中的端口转发目前按标签页管理。
- Dynamic 转发当前支持 SOCKS5 no-auth `CONNECT` 基线。

## License

MIT
