# TermDock 产品记录

[English](news.md)

Last updated: 2026-06-02

## 已确认方向

- 保持紧凑优先的桌面工作流。
- 运维效率优先于装饰性 UI。
- 会话 / 分组 / 文件操作优先使用上下文菜单。
- 核心终端和传输动作必须确定、可恢复。
- 风险终端执行来源必须经过明确安全审批。

## 当前发布基线

- 当前公开稳定版本：`v0.1.30`
- 当前主分支：`master`
- 当前重点：`v0.1.30` 热修复验证和发布跟进。

## 最近周期已交付

- v0.1.30：修复打包应用因从 `electron-updater` named import `autoUpdater` 导致的主进程启动崩溃。
- v0.1.29：打包应用现在会检查 GitHub Releases，新版本后台下载完成后提示重启安装。
- 主界面已调整为深色 code-editor workbench：
  - SFTP Explorer rail。
  - 右侧 Inspector rail。
  - terminal-dominant center stage。
  - bottom transfer panel。
- 右侧 Inspector 支持可折叠命令历史和窄宽度 `Sessions` / `Health` / `History` tabs。
- SFTP Explorer 支持 `Compact` / `Details` 视图并持久化。
- Settings/modal chrome 与紧凑 workbench 语言保持一致。
- Renderer UI 从大型 `App.tsx` 拆成 settings、snippet、workbench-modal、UI-preference 和 CSS 模块。
- 简体中文界面基线已落地。
- 危险命令保护、Retry Center、Operation Center、服务器健康、端口转发、诊断导出等能力已进入产品包装。
- README、中文 README、截图、Social Preview、安全说明、安装排查、贡献说明、反馈分级和 GitHub Labels 文档已补齐。

## 当前关注点

1. 发布后用户能否快速判断下载哪个文件。
2. Windows/macOS 首次启动信任提示是否导致流失。
3. 用户是否关心凭据存储和诊断日志边界。
4. SSH/SFTP 常见环境是否稳定。
5. 哪些功能反馈重复出现，值得进入下一个小版本。

## 详细历史

英文版 `news.md` 保留了更完整的历史交付列表。中文维护版聚焦当前产品方向和发布后执行重点。
