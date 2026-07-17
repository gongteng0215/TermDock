# TermDock 产品记录

[English](news.md)

Last updated: 2026-07-16

## 已确认方向

- 保持紧凑优先的桌面工作流。
- 运维效率优先于装饰性 UI。
- 会话 / 分组 / 文件操作优先使用上下文菜单。
- 核心终端和传输动作必须确定、可恢复。
- 风险终端执行来源必须经过明确安全审批。

## 当前发布基线

- 当前公开稳定版本：`v0.1.41`（2026-07-16）
- 当前主分支：`master`
- 当前重点：`v0.1.41` 之后可选 shared-buffer 传输优化与真实使用反馈打磨。

## 最近周期已交付

- v0.1.41：SQLite 权威会话 + 耐久偏好端口 + 凭据安全 `.tdbackup`、懒加载终端启动（脚本约 0.76 MiB）、下载 SFTP 通道复用、备份向导/Settings 入口，以及 selection-prune 重渲染修复；打包 smoke `PASS 51`。
- v0.1.40：更广的可恢复全局错误路由（会话创建 / 片段 / 模板 / 命令历史 / 分组）、Operation Center 按标签 / 跨标签失败传输重试与当前标签端口转发拆除、正式 `bench:startup` / `bench:transfer:memory` 基准，以及英文 / 简体中文 SQLite 迁移规划（仅规划）。
- v0.1.39：设置 > 工作区增加界面密度（紧凑默认 / 宽松）、进一步压紧侧栏间距、Retry Center 底部操作分组并标记危险删除、宽松密度下传输面板文字更清晰。
- v0.1.38：整套工作台主题色（海洋蓝 / 淡紫色 / 薄荷绿 / 琥珀黄 / 玫瑰粉）、更强的面板对比与选中态、更清晰的按钮层级与分区图标、修复设置齿轮对齐，并恢复可见滚动条。
- v0.1.37：不可写远程路径支持只读打开或「暂存 + sudo install」写回（含 staging 清理）、SFTP `~` 家目录跳转，以及上传到不可写目录时更明确的 Permission denied。
- v0.1.36：打包应用现在直接从 GitHub Releases 的 `latest/download/latest.yml` 读取更新元数据，避免 GitHub API rate limit 和旧 API 响应导致的误判。
- v0.1.35：修复全屏终端编辑器闪烁——稳定 alternate-screen 的编辑器聚焦布局检测，保留主题 / 全屏效果，并迁移到 scoped xterm 包，在可用时使用 WebGL 渲染。
- v0.1.34：渲染层性能优化——较重弹窗按需加载并对渲染产物分包以加快启动、Retry Center 与命令历史列表虚拟化、SFTP 与会话行 memo 化、SFTP 传输进度按动画帧合并刷新。
- v0.1.33：优化工作台面板——SFTP Details 时间跟随界面语言、SFTP Details 行支持横向滚动、Transfers 空闲时更紧凑、首次引导步骤更清晰、Server Health 刷新不再跳动。
- v0.1.32：在 `Settings > Diagnostics` 增加可见的更新状态卡片，保留应用内手动检查更新，强化更新状态桥接，并统一高频控件的图标对齐。
- v0.1.31：刷新 README、release 页面文案、产品记录和 release notes，让公开描述与现有自动更新能力、本地优先定位保持一致。
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
