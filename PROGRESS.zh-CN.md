# TermDock 进度快照

[English](PROGRESS.md)

Last updated: 2026-05-13

## 当前快照

- 当前主分支：`master`
- 远端：`origin/master`
- 当前方向：`v0.1.25` 首次启动引导发布准备、反馈驱动打磨。
- 最新验证：`pnpm run typecheck`、`pnpm run build`、`pnpm run smoke:ui` 已通过。
- 最新 workspace smoke artifact：`artifacts/smoke/2026-05-12T14-10-00-910Z/summary.json`，结果为 `PASS 47 / FAIL 0 / SKIP 0`。
- 当前打包目标：macOS (`arm64`, `x64`) 和 Windows (`nsis`, `zip`)。
- README 已从开发日志重构为产品主页，并补充中文 README、截图、安全说明、安装排查、反馈分级、贡献说明和 GitHub Labels 指南。

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
  - `~/.ssh/config` 导入基线。
- UI 和多语言：
  - 深色 editor-workbench 风格主界面。
  - SFTP Explorer rail、terminal stage、Inspector rail 和底部 transfer panel。
  - 简体中文界面基线和中文 README。
  - 首次启动会话引导：空工作区显示导入 SSH 配置、新建会话和安全说明入口，关闭状态本地保存。
- 发布准备：
  - Windows installer / portable zip。
  - macOS dmg / zip。
  - GitHub Releases 文案、Social Preview、截图、Issue templates、PR template。

## 当前发布状态

- 当前质量：适合自用、早期用户和 power users 试用。
- 尚未完全 GA：
  - 公开可信签名 / notarization 证据仍在完善。
  - 暂无应用内自动更新。
  - 数据持久化仍基于 JSON，SQLite 迁移待做。
- 近期推广重点：
  - 降低下载和首次启动困惑。
  - 收集 Windows/macOS 安装反馈。
  - 优先处理安全/凭据问题和 SSH/SFTP 核心流程反馈。

## 下一步优先级

1. 准备并发布 `v0.1.25` 小版本。
2. 继续观察安装、信任提示和首次连接反馈。
3. 如果安装/启动问题重复出现，优先更新 README、Release 描述和故障排查。
4. 根据真实反馈决定下一项小修复，而不是立即启动大型新功能。

## 详细历史

英文版 `PROGRESS.md` 保留更完整的历史进度流水。中文维护版聚焦当前公开发布、验证和后续推进方向，后续会随主线同步更新。
