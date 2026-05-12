# Editor Workbench UI 实施计划

[English](2026-05-01-editor-workbench-ui.md)

## 进度快照

Last updated: 2026-05-12

### 当前状态

- `Task 1`：完成并提交。
- `Task 2`：完成并提交。
- `Task 3`：完成并提交。
- `Task 4`：完成并提交。
- `Task 5`：renderer module split 完成并提交。
- 后续：根据真实使用反馈继续打磨。

### 已完成

- 将 renderer shell 从大型 `App.tsx` 主体中拆成可复用 workbench components。
- 增加共享 workbench shell、sidebar、panel 和 icon components。
- 统一 left explorer 和 right inspector 的 panel/list-shell/status surface 语言。
- 将右栏改造成更清晰的 inspector，包含 context cards、session details 和可折叠 command history。
- 增加 SFTP `Compact / Details` 双视图并本地持久化。
- 增加窄宽度 `Sessions / Health / History` tabbed inspector 行为。
- 将 transfer dock 重新定义为底部 panel，并让 modal chrome 对齐 workbench shell。
- 统一高频按钮状态、focus rings、topbar、toggles 和 compact inspector controls。
- 恢复稳定 UI 验证和 smoke 覆盖。
- 将高频 renderer UI 拆到 settings、command snippet、workbench-modal、UI-preference 和 CSS modules。

### 最新验证

- `pnpm run typecheck`
- `pnpm run build`
- `node scripts/test-transfer-progress.mjs`
- `pnpm run bench:transfer:local`
- `pnpm run smoke:ui`
- post-refactor `pnpm run smoke:ui` 通过：`artifacts/smoke/2026-05-09T13-35-51-500Z/summary.json` (`pass=45, fail=0, skip=0`)
- post-refactor `pnpm run smoke:ui:packaged` 通过：`artifacts/smoke/2026-05-09T13-44-46-628Z/summary.json` (`pass=45, fail=0, skip=0`)

## 目标

将 renderer UI 改造成现代深色 code-editor workbench，同时保留现有 SSH、SFTP、transfer 和 diagnostics 行为。

## 架构

尽量保持当前 React + Electron component boundaries，通过收紧 shell hierarchy、重塑 sidebars 和 bottom panels、刷新 terminal/tab 样式来完成 redesign。只有当现有 DOM 阻碍 left explorer、center stage、right inspector 和 bottom panel 清晰表达时，才修改 markup。

## 技术栈

- Electron
- React 18
- TypeScript
- Vite
- custom CSS
- xterm.js

## 文件结构

核心 renderer 文件：

- `src/renderer/App.tsx`
- `src/renderer/styles.css`
- `src/renderer/components/terminal-workspace.tsx`
- `src/renderer/styles/workbench-shell.css`
- `src/renderer/styles/terminal.css`
- `src/renderer/components/settings-modal-shell.tsx`
- `src/renderer/components/settings-sections.tsx`
- `src/renderer/components/command-snippet-manager-modal.tsx`
- `src/renderer/components/workbench-modals.tsx`
- `src/renderer/workbench-ui-preferences.ts`

设计和跟踪文档：

- `docs/superpowers/specs/2026-05-01-termdock-editor-workbench-design.md`
- `docs/superpowers/plans/2026-05-01-editor-workbench-ui.md`

## 任务摘要

1. 重建 workbench shell 和共享视觉 tokens。
2. 将 left SFTP panel 改造成 Explorer rail。
3. 将 center terminal workspace 改造成主舞台。
4. 将 right utility stack 改造成 Inspector rail。
5. 将 transfer dock 和 modals 对齐 workbench 语言。
6. 拆分 renderer 大模块，降低 `App.tsx` 负担。

英文版保留逐步实施 checklist 和历史命令输出。
