# TermDock 任务看板

[English](TASKS.md)

Last updated: 2026-07-14

## 当前发布状态

- 当前稳定版：`v0.1.39`
- 当前分支：`master`
- 当前方向：`v0.1.39` 之后继续跟进密度/主题/工作台清晰度反馈，并推进性能与可靠性硬化。
- 当前发布说明：`v0.1.32`-`v0.1.39` 已覆盖自动更新体验、面板打磨、渲染性能、终端全屏编辑器修复、更新检查可靠性、特权文件保存回写、强调色主题与布局密度偏好。
- 最新验证（2026-07-14）：`pnpm run typecheck` 和 `pnpm run build` 已通过。

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
| 自动更新 | PARTIAL | 打包应用会检查 GitHub Releases，新版本后台下载完成后提示重启安装；`v0.1.32`/`v0.1.36` 已补入手动检查、状态面板和 `latest.yml` 直读。 |
| 启动性能 | PARTIAL | `v0.1.34` 已做按需加载重型弹窗、分包去重和列表虚拟化；正式基准与大传输内存优化仍待跟进。 |
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
   - targeted `pnpm run test:session-migration` 已覆盖加密导出、错误 passphrase 失败、预览不恢复私钥、确认后恢复私钥、renderer-safe payload stripping 和 paths-only migration。
   - `pnpm run smoke:ui` 现在会断言加密迁移导入 / 导出菜单入口可见。
   - `pnpm run typecheck`、`pnpm run build` 和 `pnpm run smoke:ui` 已通过，结果为 `PASS 48 / FAIL 0 / SKIP 0`，artifact 为 `artifacts/smoke/2026-05-14T09-05-21-391Z/summary.json`。
9. `v0.1.32`-`v0.1.39` 主线发布：
   - 自动更新体验：手动检查更新、Diagnostics 状态面板、直接读取 `latest.yml`。
   - 工作台面板打磨：SFTP Details 本地化时间与滚动、空闲 Transfers 收紧、首启引导与 Server Health 刷新更稳。
   - 渲染性能：按需加载重型弹窗、分包去重、Retry Center / Command History 虚拟化、传输进度按帧批处理。
   - 终端全屏编辑器：修复 alternate-screen 布局闪烁，scoped xterm + WebGL / DOM fallback。
   - 特权远程文件保存回写：非可写文件支持 stage + `sudo install`，SFTP `~` 路径解析，上传权限失败提示更明确。
   - 强调色主题与布局密度：`Ocean` / `Lavender` / `Mint` / `Amber` / `Rose`，以及 Compact / Comfortable。
   - Retry Center 删除动作分组并标记为危险操作；Comfortable 密度下 Transfers 可读性更好。

## 下一批建议任务

1. 观察 `v0.1.38`/`v0.1.39` 之后密度、强调色主题和工作台清晰度的真实使用反馈。
2. 将反复出现的启动 / 信任提示 / 首次连接反馈整理成 GitHub issues 和 Release FAQ。
3. 继续 `P0-E3` 全局错误恢复边角场景和引导文案。
4. 继续 `F8` Operation Center 更广的取消 / 重试覆盖。
5. 规划 `P0-A3`/`F9` 持久化硬化（SQLite 迁移 + 凭据安全备份恢复）。
6. 继续 `P0-E1`/`P0-E2`：正式启动性能基准和大传输内存优化。

## 详细任务历史

英文版 `TASKS.md` 保留更完整的历史任务矩阵。中文维护版聚焦当前发布状态和后续优先级。
