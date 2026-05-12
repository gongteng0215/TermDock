# TermDock Editor Workbench UI 设计

[English](2026-05-01-termdock-editor-workbench-design.md)

Date: 2026-05-01
Last updated: 2026-05-12

## 目标

刷新 TermDock 桌面 UI，让它更接近现代代码编辑器工作台，尤其是类似 VS Code 的深色 workspace，同时保留现有 SSH、SFTP、transfer 和 diagnostics 能力。

改造方向是从“堆叠式运维 dashboard”转向“开发者工作台”。终端仍然是主舞台，侧边区域和底部区域应像编辑器 sidebar / bottom panel，而不是互相独立的产品卡片。

## 当前实现状态

- 状态：已合并到主线。
- Shell 已使用更扁平的 editor-workbench 层级：
  - SFTP 作为 Explorer rail。
  - Terminal 作为 center stage。
  - Sessions / Health / History 作为 Inspector rail。
  - Transfers 作为 bottom panel。
- 右侧 Inspector 包含可折叠 command history 和窄宽度 tabs。
- SFTP Explorer 支持持久化 `Compact` / `Details` 视图。
- Settings 和 manager modal chrome 使用同一套紧凑 workbench 语言。
- 大型 renderer surface 已拆成 settings sections、workbench modals、command snippets、UI preferences 和独立 workbench/terminal CSS。

## 设计方向

### 已选择方向

- 结构：editor-style reflow。
- 视觉语言：Workbench Dark。
- 风险：中等范围 UI refactor，低业务逻辑风险。

### 产品意图

界面应传达：TermDock 是专注于远程系统操作的开发者工具，而不是通用监控控制台。它应该精确、冷静、信息密度高，并适合长时间使用。

## 目标架构

### Shell

- 保留深色主题。
- 减少装饰性 glass treatment。
- 使用稳定面板背景和清晰分隔线。
- 使用更紧的 editor-style spacing。
- 统一 border、radius 和标题样式。

### 左侧栏

- 主身份：远程文件 Explorer。
- 次身份：快速文件动作和路径导航。
- SFTP 功能保持不变。
- 视觉上更接近编辑器文件树。

### 中心工作区

- Terminal tabs 更像 editor tabs。
- Terminal canvas 拥有最强视觉权重。
- Editor focus mode 保留，但风格并入整体 workbench。
- 减少终端外部装饰，让终端本身成为重点。

### 右侧栏

右侧统一为 Inspector / Utility sidebar：

- Sessions。
- Server health。
- Command history。

这些仍是独立功能区，但共享标题、动作行、列表 shell 和节奏。

### 底部面板

Transfer dock 重新定义为 bottom workbench panel，而不是独立浮动卡片。

## 实现摘要

主要模块：

- `src/renderer/components/workbench-shell.tsx`
- `src/renderer/components/workbench-sidebars.tsx`
- `src/renderer/components/workbench-panels.tsx`
- `src/renderer/components/workbench-modals.tsx`
- `src/renderer/components/settings-modal-shell.tsx`
- `src/renderer/components/settings-sections.tsx`
- `src/renderer/components/command-snippet-manager-modal.tsx`
- `src/renderer/workbench-ui-preferences.ts`
- `src/renderer/styles/workbench-shell.css`
- `src/renderer/styles/terminal.css`

## 验证

- `pnpm run typecheck`
- `pnpm run build`
- `pnpm run smoke:ui`
- `pnpm run smoke:ui:packaged`

英文版保留完整设计细节和原始上下文。
