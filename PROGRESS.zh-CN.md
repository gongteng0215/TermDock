# TermDock 进度快照

[English](PROGRESS.md)

Last updated: 2026-07-16

## 当前快照

- 当前主分支：`master`
- 远端：`origin/master`
- 当前稳定版：`v0.1.41`
- 当前方向：`v0.1.41` 发版准备完成（自用 Windows 可发）；下一步是可选 shared-buffer E2 或真实使用反馈打磨。
- 公开文档已经对齐到现有自动更新能力、本地优先信任模型和推荐下载包说明。
- 最新验证（2026-07-16）：`pnpm run typecheck`、`pnpm run build`、`pnpm run bench:startup`（脚本约 0.76 MiB）、`pnpm run bench:transfer:memory`、`pnpm run smoke:ui` + `pnpm run smoke:ui:packaged` → `PASS 51 / FAIL 0`（`artifacts/smoke/2026-07-16T09-37-42-134Z/summary.json`）。
- `P0-E2` 下载侧现在也复用了每标签 SFTP 通道池，并保持与上传一致的 in-flight slot cap；`pnpm run bench:transfer:memory` 已通过。
- 当前打包目标：macOS (`arm64`, `x64`) 和 Windows (`nsis`, `zip`)。
- README 已从开发日志重构为产品主页，并补充中文 README、截图、安全说明、安装排查、反馈分级、贡献说明和 GitHub Labels 指南。
- `v0.1.41` 已落地：SQLite 权威会话、耐久偏好端口、凭据安全 `.tdbackup`、懒加载终端启动、下载通道复用与备份向导。
- `v0.1.40` 已落地：更广的可恢复全局错误路由、Operation Center 按标签 / 跨标签重试与端口转发拆除、正式启动 / 传输内存基准，以及 SQLite 迁移规划文档。
- 发布后硬化已落地：剩余全局错误匹配、延迟 `renderer-settings` / 懒加载 WebGL、传输并发与通道上限、Operation Center 删除/app job 取消、会话双写、Phase 3 SQLite 权威切流。

## 已完成的重点能力

- SSH + SFTP 桌面工作台基础能力：
  - 多标签 SSH 终端。
  - 会话创建、编辑、删除、测试、搜索、收藏和分组。
  - SFTP 浏览、上传、下载、队列、取消、冲突策略和失败重试。
- 安全和恢复：
  - 危险命令保护和底部审批栏。
  - Retry Center 保存失败传输历史并支持恢复。
  - Operation Center 汇总传输、删除、端口转发、诊断任务和重连动作。
  - 诊断日志、断连报告和 bug report 导出。
- 运维工具：
  - 服务器健康面板。
  - Local / Remote / Dynamic SOCKS5 端口转发管理。
  - `~/.ssh/config` 导入基线，并补充导入预览统计、导入后打开首个会话和 OpenSSH `IdentityFile` token 展开。
  - SSH config 导入预览会提示当前机器上缺失的 `IdentityFile` 路径。
  - SSH config 导入预览会对常见暂不支持的 OpenSSH 指令给出 warning，提醒导入后手动处理。
  - 加密 `.tdmigration` 会话迁移支持用用户 passphrase 保护已保存密码、私钥 passphrase 和可选私钥文件内容。
- 首次连接诊断：
  - SSH 连接和测试连接失败时会显示更清晰的原因、下一步建议和原始错误。
- 文档：
  - 新增英文 / 简体中文 SSH 配置导入指南，并从 README 和文档索引链接。
  - 新增英文 / 简体中文 SSH 连接故障排查指南。
  - 新增英文 / 简体中文会话迁移指南，说明普通 JSON 导出和加密迁移包的安全边界。
- UI 和多语言：
  - 深色 editor-workbench 风格主界面。
  - SFTP Explorer rail、terminal stage、Inspector rail 和底部 transfer panel。
  - 简体中文界面基线和中文 README。
  - 首次启动会话引导：空工作区显示导入 SSH 配置、新建会话和安全说明入口，关闭状态本地保存。
- `v0.1.32`-`v0.1.40` 新增：
  - `v0.1.40`：更广的可恢复全局错误路由、Operation Center 按标签 / 跨标签重试与端口转发拆除、正式启动 / 传输内存基准、SQLite 迁移规划。
  - 发布后硬化：剩余错误匹配、启动分包再削减（~1.22 MiB）、传输并发/通道上限、远程删除与 app job 取消、SQLite Phase 1–3（双写 + 切流/回滚）。
  - 强调色主题（`Ocean` / `Lavender` / `Mint` / `Amber` / `Rose`）与 Compact / Comfortable 布局密度。
  - 渲染性能优化：按需加载重型弹窗、分包去重、列表虚拟化、传输进度按帧批处理。
  - 终端 WebGL 渲染与 alternate-screen 全屏编辑器闪烁修复。
  - 特权远程文件保存回写（stage + `sudo install`）、SFTP `~` 路径解析与更明确的权限失败提示。
  - 自动更新可靠性：手动检查更新、Diagnostics 状态面板、直接读取 `latest.yml`。
- 发布准备：
  - Windows installer / portable zip。
  - macOS dmg / zip。
  - GitHub Releases 文案、Social Preview、截图、Issue templates、PR template。

## 当前发布状态

- 当前质量：适合自用、早期用户和 power users 试用。
- 尚未完全 GA：
  - 公开可信签名 / notarization 证据仍在完善。
  - 已接入应用内自动更新：打包应用检查 GitHub Releases，后台下载新版本，并在更新就绪后提示重启安装；已修复 electron-updater 在打包 ESM 环境下的 CommonJS 导入兼容问题，并补上手动检查与 `latest.yml` 直读。
  - 数据持久化：会话已切到 SQLite 权威读写；Phase 4 耐久偏好双写与 Phase 5 `.tdbackup` 凭据安全备份已落地。
  - 启动负载与传输：post-hardening 已再切一刀；正式基准仍可用于更深架构优化评估。
- 近期推广重点：
  - 降低下载和首次启动困惑。
  - 收集 Windows/macOS 安装反馈。
  - 优先处理安全/凭据问题和 SSH/SFTP 核心流程反馈。

## 下一步优先级

1. 观察密度、强调色主题和工作台清晰度相关的真实使用反馈。
2. 可选：更深的传输 shared-buffer / 通道复用（`P0-E2`）。
3. 可选：单次主进程迁移 / bug-report 任务的真正中途中止。

## 详细历史

英文版 `PROGRESS.md` 保留更完整的历史进度流水。中文维护版聚焦当前公开发布、验证和后续推进方向，后续会随主线同步更新。
