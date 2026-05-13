# TermDock 更新记录

[English](RELEASE_NOTES.md)

## v0.1.25 (2026-05-12)

发布类型：稳定候选版

### 主要变化

- 首次启动会话引导：
  - 空工作区现在会在 Sessions Inspector 中显示紧凑的新用户引导卡片。
  - 引导动作可直接进入 `Import SSH Config`、`New Session` 和 `Security Notes`。
  - 关闭状态会保存在本地，避免引导卡片反复出现。
- 简体中文打磨：
  - 补充首次启动引导卡片和安全说明弹窗的中文翻译。

### 验证

- Type check 通过：`pnpm run typecheck`
- Build 通过：`pnpm run build`
- 最新 workspace smoke 通过：`PASS 47 / FAIL 0 / SKIP 0`
- 最新 workspace smoke artifact：`artifacts/smoke/2026-05-12T14-10-00-910Z/summary.json`

## v0.1.24 (2026-05-11)

发布类型：稳定版

### 主要变化

- 右侧 Inspector 密度优化：
  - 移除右栏中的选中会话详情，让面板聚焦当前活动会话、服务器健康和最近命令历史。
  - Inspector 中命令历史默认显示最近 5 条，完整管理器仍可打开。
  - 服务器健康在右栏保持紧凑，并通过独立详情弹窗展示完整信息。
- 服务器健康详情升级：
  - 详情弹窗增加 `Overview`、`Disk`、`Network`、`Processes`、`Services` tabs。
  - Overview 增加 OS/kernel/architecture、CPU cores、load per core、free/cache/buffer memory、Swap 和采集时间。
  - Disk 展示挂载文件系统、类型、已用/可用/总量、使用率和 inode 使用率。
  - Network 展示接口 RX/TX、错误数和 dropped packets。
  - Processes 展示 CPU 和内存占用较高的进程。
  - Failed services 增加 load/active/sub 状态和服务描述。
- SFTP Explorer 紧凑布局修复：
  - Compact 模式优先显示文件和文件夹名称，只保留类型点、大小和文件夹标记。
  - permission、owner、group、link 等元信息保留在 Details 模式。
- 简体中文打磨：
  - 补充新的服务器健康 tabs、表格标签、状态标签和 SFTP 文件夹标记翻译。

### 验证

- Type check 通过：`pnpm run typecheck`
- Build 通过：`pnpm run build`
- 最新 workspace smoke 通过：`PASS 47 / FAIL 0 / SKIP 0`
- 最新 workspace smoke artifact：`artifacts/smoke/2026-05-11T13-10-47-081Z/summary.json`
- 最新 packaged smoke 通过：`PASS 47 / FAIL 0 / SKIP 0`
- 最新 packaged smoke artifact：`artifacts/smoke/2026-05-11T03-40-28-692Z/summary.json`
- 手动服务器健康 tabs 截图：`artifacts/manual-server-health-tabs/2026-05-11T02-16-53-783Z/disk-tab.png`
- 手动简体中文服务器健康截图：`artifacts/manual-zh-server-health-tabs/2026-05-11T03-37-24-976Z/zh-disk-tab.png`
- 手动 SFTP compact 截图：`artifacts/manual-sftp-compact/2026-05-11T01-43-53-116Z/sftp-compact.png`
- 本地 `dist:mac:x64` 产出了 ZIP，但当前 macOS 12 主机上的 DMG 创建失败，因为 electron-builder 下载的 `dmgbuild` runtime 需要 `_mkfifoat`；带 tag 的 GitHub Actions release build 在 macOS 14 上运行。

## v0.1.23 (2026-05-10)

发布类型：稳定版

### 主要变化

- Editor workbench UI 刷新：
  - 主界面更接近深色代码编辑器工作台，而不是堆叠式运维 dashboard。
  - SFTP 视觉上进入 Explorer rail；sessions、server health、command history 组成 Inspector rail。
  - terminal tabs/stage 和 transfer dock 重新设计，让终端保持主视觉，传输区成为底部工作台面板。
  - settings 和 manager modal chrome 与紧凑工作台语言保持一致。
- 简体中文界面基线：
  - `Settings > Workspace` 增加持久化语言选择器，支持 English 和 Simplified Chinese。
  - 简体中文覆盖 settings、workbench chrome、dialogs、context menus、terminal errors、port forwarding、diagnostics、hotkeys、snippets、Operation Center、Retry Center、Command History Manager 和 Safety settings。
  - DOM localization 通过 `MutationObserver` / `requestAnimationFrame` 批处理，避免每次 render 后全量扫描。
- Renderer 模块拆分：
  - settings modal shell/sections、command snippet manager、workbench modals、persisted workbench UI preferences 从 `App.tsx` 拆出。
  - workbench shell 和 terminal CSS 从 root stylesheet 拆出。
- 侧栏可用性打磨：
  - SFTP Explorer view mode 持久化为 `Compact` 或 `Details`。
  - command history 可在右侧 Inspector 中折叠。
  - 窄宽度下右侧 Inspector 提供 `Sessions` / `Health` / `History` tabs。
- 命令历史和细节修复：
  - 长命令历史捕获会回看更多换行 terminal rows。
  - 存储的命令历史保留更长命令后再截断。
  - 移除右侧 Inspector 选中详情，提高有效信息密度。
  - 应用图标从更紧凑源裁切重新生成。
  - Settings 滚动更顺，因为 settings modal 不再使用实时全屏 backdrop blur。

### 验证

- Post-refactor type check 通过：`pnpm run typecheck`
- Post-refactor build 通过：`pnpm run build`
- Post-refactor workspace smoke 通过：`PASS 45 / FAIL 0 / SKIP 0`
- Post-refactor packaged smoke 通过：`PASS 45 / FAIL 0 / SKIP 0`
- 最新多语言 workspace smoke 通过：`PASS 47 / FAIL 0 / SKIP 0`
- 最新多语言 workspace smoke artifact：`artifacts/smoke/2026-05-10T14-23-35-255Z/summary.json`
- 最新 packaged smoke artifact：`artifacts/smoke/2026-05-09T13-44-46-628Z/summary.json`

## Unreleased (master)

发布类型：开发中

### 主要变化

- 下一批变化会记录在这里。

### 验证

- 待验证。

## 历史版本索引

英文版 `RELEASE_NOTES.md` 保留了 v0.1.22 及更早版本的完整逐条历史。中文维护版从当前公开推广版本开始同步记录详细内容，后续 release 会保持中英文同时更新。
