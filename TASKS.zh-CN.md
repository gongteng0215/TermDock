# TermDock 任务看板

[English](TASKS.md)

Last updated: 2026-05-14

## 当前发布状态

- 当前稳定版：`v0.1.26`
- 当前分支：`master`
- 当前方向：加密会话迁移验证、首次导入和首次连接转化优化。
- 最新验证：`pnpm run typecheck`、`pnpm run build`、`pnpm run smoke:ui` 已通过。
- 最新 workspace smoke artifact：`artifacts/smoke/2026-05-14T07-36-10-928Z/summary.json`，结果为 `PASS 48 / FAIL 0 / SKIP 0`。

## P0 状态摘要

| 区域 | 状态 | 说明 |
| --- | --- | --- |
| Electron + React + TypeScript 基线 | DONE | 主体架构稳定。 |
| 多标签 SSH 终端 | DONE | xterm 渲染、SSH 认证、IO 流、多标签已可用。 |
| SFTP 基础工作流 | PARTIAL | 浏览、上传、下载、队列、取消、冲突策略和重试已可用，长时间大目录仍需继续调优。 |
| 安全凭据存储 | DONE | 通过应用凭据层接入系统安全存储。 |
| 诊断和日志 | PARTIAL | 日志、断连报告、bug report 导出已落地，边界仍需随反馈补强。 |
| 危险命令保护 | DONE | 已有底部审批栏、来源控制、临时授权和策略包能力。 |
| 服务器健康 | DONE | CPU、内存、磁盘、网络、进程、失败服务等信息已可见。 |
| 跨平台 smoke | PARTIAL | 自动化 smoke 已覆盖核心流程，仍需持续补充真实环境证据。 |
| 签名 / notarization | PARTIAL | 预检和验证脚本已可用，公开可信签名证据仍在推进。 |
| 自动更新 | TODO | 暂未实现。 |
| SQLite 迁移 | TODO | 当前仍使用 JSON 持久化。 |

## 当前进行中

1. 发布后仓库包装：
   - README 产品化。
   - 中文 README。
   - 截图和 Social Preview。
   - Release 文案和 GitHub 页面配置。
   - 安全、贡献、反馈分级和 Labels 文档。
2. 反馈接收：
   - 建立 GitHub Labels。
   - 记录发布平台反馈。
   - 优先处理安装/启动、安全/凭据、下载包选择问题。
3. 文档双语化：
   - 面向用户和贡献者的文档保持 English / 中文两份。
   - 内部维护类文档补充中文维护版。
4. 首次启动引导：
   - 空工作区显示导入 SSH 配置、新建会话和安全说明入口。
   - 关闭状态本地保存，避免重复打扰。
5. SSH config 导入打磨：
   - 导入预览显示新增会话、重复目标、私钥会话、目标分组和重复处理策略。
   - 重复处理策略选择时展示当前导入计划。
   - SSH config 和会话 JSON 导入成功后可以立即打开第一个导入的会话。
   - `IdentityFile` 支持展开常见 OpenSSH token。
   - 导入预览会提示展开后不存在或不是普通文件的 `IdentityFile` 路径。
   - 英文 / 简体中文 SSH 配置导入指南已记录导入流程、支持字段、重复项处理和当前限制。
   - 导入预览会提示常见暂不支持、需要导入后手动处理的 OpenSSH 指令。
6. 首次连接 SSH 诊断：
   - SSH 连接和测试连接错误现在会针对常见认证、私钥文件、DNS、端口、超时、网络、host key、握手和远端关闭场景显示清晰原因、下一步建议和原始错误。
   - 英文 / 简体中文故障排查文档已覆盖首次连接失败和 SSH config 导入后的检查项。
7. v0.1.26 发布准备：
   - Release notes 已从 `Unreleased` 提升为 `v0.1.26`。
   - package version 已提升到 `0.1.26`。
   - 最终 `pnpm run typecheck`、`pnpm run build` 和 `pnpm run smoke:ui` gates 已通过，结果为 `PASS 48 / FAIL 0 / SKIP 0`，artifact 为 `artifacts/smoke/2026-05-14T06-14-31-419Z/summary.json`。
8. 加密会话迁移：
   - `Export Encrypted Migration...` / `导出加密迁移包...` 和 `Import Encrypted Migration...` / `导入加密迁移包...` 已支持 passphrase 保护的 `.tdmigration` 文件。
   - 加密迁移包可以包含已保存密码、私钥 passphrase 和可选私钥文件内容。
   - 导入预览只解密展示，不会写入私钥文件；嵌入私钥只会在用户确认导入后恢复。
   - 恢复出的私钥文件写入 TermDock app data，不覆盖来源机器上的原始路径。
   - 英文 / 简体中文会话迁移文档已说明普通 JSON 导出和加密迁移包的差异。
   - `pnpm run typecheck`、`pnpm run build` 和 `pnpm run smoke:ui` 已通过，结果为 `PASS 48 / FAIL 0 / SKIP 0`，artifact 为 `artifacts/smoke/2026-05-14T07-36-10-928Z/summary.json`。

## 下一批建议任务

1. 手动验证加密迁移包在同机和跨机器路径下的导出 / 导入体验。
2. 给加密迁移包补 targeted smoke 或集成测试。
3. 观察安装、信任提示和首次连接反馈。
4. 根据首批评论补充 Release FAQ。

## 详细任务历史

英文版 `TASKS.md` 保留更完整的历史任务矩阵。中文维护版聚焦当前发布状态和后续优先级。
