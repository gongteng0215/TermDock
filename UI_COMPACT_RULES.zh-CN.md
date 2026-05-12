# TermDock UI 紧凑规则

[English](UI_COMPACT_RULES.md)

Last updated: 2026-05-12

## 目标

保持整个应用视觉紧凑且稳定。页面不应因为运行时列表数量变化而扩张或收缩。

## 全局密度规则

1. 默认使用紧凑控件尺寸。
2. 优先使用更小间距、更紧标题和紧凑按钮 / 输入框高度。
3. 不要引入过大的操作行或大块垂直空白。
4. 弹窗操作区保持紧凑，宽度不足时允许换行。
5. 保持 editor-workbench 层级：Explorer rail、terminal stage、Inspector rail 和底部 transfer panel 应保持清晰，但不要变成嵌套卡片堆。

## 禁止布局跳动规则

1. 运行时数据更新不能改变组件几何尺寸。
2. 动态计数 / 状态文本不能横向挤压相邻控件。
3. 为动态动作预留固定槽位，例如固定宽度按钮或固定 grid columns。
4. 可选状态行出现 / 消失时使用占位行，保持 header/footer 高度稳定。
5. 计数 / 指标使用 tabular numbers，避免数字宽度抖动。
6. 列表面板即使为空，也应保留空白区域上下文菜单入口。
7. 固定底部审批栏和内联安全提示必须预留自己的高度，出现动作时不能撑开 workspace。

## 固定高度列表规则

1. 每个列表展示区域都必须使用固定高度：`height`、`min-height` 或 `max-height`。
2. 列表容器内部滚动：`overflow: auto`，不要让父布局跟着内容变化。
3. Grid 列表容器使用 `align-content: start`，避免 item 拉伸。
4. 运维列表不要依赖内容驱动高度。

## 适用范围

- Sessions：group list 和 session list。
- SFTP browser list 和 transfer list。
- Server health process/services lists。
- Settings 中的 hotkeys、conflicts、Safety guardrails、Port Forward、Disconnect report。
- Retry Center。
- Operation Center activity list。
- Terminal command history list。
- Editor-workbench Inspector tabs。
- Workbench modal section lists 和 manager lists。

## 实现基线

优先使用 `src/renderer/styles.css` 中的共享 compact tokens，以及 `src/renderer/styles/workbench-shell.css` / `src/renderer/styles/terminal.css`：

- `--ui-control-height`
- `--ui-control-height-small`
- `--ui-control-font-size`
- `--ui-list-height-sm`
- `--ui-list-height-md`
- `--ui-list-height-lg`

新增列表时：

1. 创建专用 `*-list-shell` 容器或等价结构。
2. 在容器上设置固定高度。
3. 在容器上设置 `overflow: auto`。
4. 如果列表内容是 grid，确保使用 `align-content: start`。

## UI 变更 Review Checklist

1. 页面在默认桌面尺寸下是否仍然紧凑？
2. 列表区域是否会随着 item 数量变化而改变尺寸？
3. 运行时值变化是否触发布局横向 / 纵向跳动？
4. 动态计数和可选状态信息是否在预留 / 固定槽位中渲染？
5. 操作行在窄宽度下是否紧凑且可读？
6. 所有列表表面是否都有固定高度 shell 和内部滚动？
7. Explorer、terminal stage、Inspector 和 bottom panel 是否仍像一个工作台，而不是互不相关的卡片？
8. 验证 `pnpm run typecheck` 和 `pnpm run build:renderer`。
9. 大范围 shell 改动合并前也运行 `pnpm run smoke:ui`。
