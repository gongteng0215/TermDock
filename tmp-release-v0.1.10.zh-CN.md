# Release 草稿：master hardening, pre-v0.1.12

[English](tmp-release-v0.1.10.md)

Last updated: 2026-05-12

这是早期 v0.1.10/v0.1.12 前后的 master 加固草稿，保留作历史参考。

## Highlights

- 修复同一会话重复打开创建重复标签的问题：
  - 重复打开同一 session 时会聚焦已有标签。
  - 关闭后重新打开仍然正常。
- 增加 Command History 空白区域上下文菜单：
  - 右键空白区域支持 `Add` / `Import` / `Export` / `Manage`。
- 增加会话文本 normalization migration：
  - 载入时修复已知 mojibake 文本。
  - create/update 会持久化 normalized text。
- 扩展本地 UI smoke 自动化并获得完整通过。
- 增加 Sessions 上下文菜单导出动作：
  - `Export All Sessions...`
  - `Export All Groups...`
- 增加 session JSON import wizard。
- 增加 session quick profiles。
- 扩展 `Settings > Hotkeys` 冲突工作流。
- 增加上传 / 下载冲突策略：`Overwrite`、`Skip`、`Rename`。
- 增加 pending transfer queue restart recovery：`Restore Pending` / `Discard Pending`。
- 增加 transfer disconnect-aware pause/resume。
- 用 dock inline completion notice 替代阻塞式传输完成弹窗。
- 增加 failed-transfer replay actions 和 Transfer Retry Center。
- 增加 SSH config import workflow。
- 增加 `Settings > Port Fwd` 端口转发管理。
- 增加 recoverable global error bar actions。
- 增加 operation center baseline modal。
- 增加 remote open-file save-back guard baseline。

## Diagnostics and Stability

- 增加 diagnostics logging baseline 和 `Settings > Diagnostics`。
- 增加 one-click bug report export。
- Bug report export 包含 disconnect-report snapshot。
- 减少传输时 monitor polling 重叠导致的断连风险。
- 稳定 packaged/small-window terminal viewport 行为。
- 增加 long-duration transfer soak tooling：`scripts/soak-transfer.mjs` 和 `SOAK_TEST.md`。

## 当时尚未完成

1. Cross-platform packaged smoke checklist。
2. Signing/notarization + installer verification。
3. Recoverable global error UX follow-up。
4. Operation Center 更广泛操作类型和取消覆盖。
5. Unit/integration regression baseline。

## 验证

- `pnpm run typecheck` passed。
- `pnpm run build` passed。
