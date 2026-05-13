# TermDock 任务看板

[English](TASKS.md)

Last updated: 2026-05-13

## 当前发布状态

- 当前分支：`master`
- 当前方向：`v0.1.25` 首次启动引导发布准备、反馈驱动打磨。
- 最新验证：`pnpm run typecheck`、`pnpm run build`、`pnpm run smoke:ui` 已通过。
- 最新 workspace smoke artifact：`artifacts/smoke/2026-05-12T14-10-00-910Z/summary.json`，结果为 `PASS 47 / FAIL 0 / SKIP 0`。

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

## 下一批建议任务

1. 准备并发布 `v0.1.25`。
2. 观察安装、信任提示和首次连接反馈。
3. 根据首批评论补充 Release FAQ。
4. 如果反馈稳定，再选择一个小功能或修复进入下一个版本。

## 详细任务历史

英文版 `TASKS.md` 保留更完整的历史任务矩阵。中文维护版聚焦当前发布状态和后续优先级。
