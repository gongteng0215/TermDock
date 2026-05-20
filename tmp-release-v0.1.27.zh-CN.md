# Release 草稿（v0.1.27）

[English](tmp-release-v0.1.27.md)

Last updated: 2026-05-20

## Highlights

- 新增加密会话迁移：
  - 新增 `Export Encrypted Migration...` 和 `Import Encrypted Migration...`
  - 支持带口令保护的 `.tdmigration`，可包含已保存密码、私钥口令，以及可选的私钥文件内容
  - 嵌入的私钥文件会恢复到 TermDock 自己的 app data 目录，不会覆盖源机器路径
  - 导入预览可以先解密、先检查内容，再决定是否真正写入恢复后的密钥文件
- 刷新 editor-workbench UI：
  - topbar、侧栏、terminal stage、transfer dock、modal chrome 统一成更扁平的代码编辑器工作台语言
  - SFTP explorer 现在支持持久化的 `Compact` / `Details` 双视图
  - 右侧 inspector 支持可折叠 command history，以及窄宽度下的 `Sessions` / `Health` / `History` tabs
  - 英文 / 简体中文覆盖继续扩展到了 settings、dialogs、context menus、command history、retry center、operation center 和 diagnostics
- 强化 renderer 可维护性和启动结构：
  - 大块 renderer 区域被拆成更清晰的 hooks、props builders、modal hosts 和 workbench shell 分层
  - renderer bundle 现在拆成 workbench / settings / terminal 等独立 chunk，不再由一个超大的主包承担
  - `App.tsx` 现在更接近总装层，负责组装 workbench、dialogs、overlays、settings 和 transfer UI
- 提升发版信心：
  - encrypted migration 已有针对性测试覆盖
  - smoke 自动化现在覆盖 encrypted migration 可见性、workbench UI、live SSH/SFTP、remote-open-file 冲突流程、retry/operation center 和 diagnostics capture

## 验证

- `pnpm run typecheck` 通过。
- `pnpm run build` 通过。
- `pnpm run smoke:ui` 通过，结果为 `PASS 50 / FAIL 0 / SKIP 0`，见 `artifacts/smoke/2026-05-20T02-46-53-664Z/summary.json`。

## 发版备注

- `package.json` 里的版本号目前仍是 `0.1.26`，最终发版前还需要做版本 bump 和 tag。
- 这次 release 建议聚焦在用户可感知的 encrypted migration、刷新后的 editor-workbench UI，以及稳定性/可维护性提升。
