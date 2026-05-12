# GitHub Labels

[English](GITHUB_LABELS.md)

这些 labels 搭配 issue templates 和 [反馈处理流程](FEEDBACK_TRIAGE.zh-CN.md) 使用。目标是在第一波发布反馈中快速扫描问题类型和优先级。

## 核心 Labels

| Label | 颜色 | 用途 |
| --- | --- | --- |
| `bug` | `#d73a4a` | 可复现的错误行为。 |
| `enhancement` | `#a2eeef` | 功能请求和工作流改进。 |
| `docs` | `#0075ca` | README、排查指南、release notes、截图或指南。 |
| `good-first-issue` | `#7057ff` | 适合新贡献者的小范围明确修复。 |

## 优先级和分级

| Label | 颜色 | 用途 |
| --- | --- | --- |
| `p0` | `#b60205` | 安装阻塞、启动阻塞、安全敏感问题、数据丢失风险、崩溃循环。 |
| `p1` | `#d93f0b` | SSH/SFTP/危险命令保护/服务器健康/端口转发核心回归。 |
| `p2` | `#fbca04` | 改进、打磨、迁移帮助和文档清理。 |
| `needs-repro` | `#d4c5f9` | 需要复现步骤、环境信息或最小复现。 |
| `needs-logs` | `#bfdadc` | 需要已脱敏日志、截图或 bug report 导出。 |

## 产品区域

| Label | 颜色 | 用途 |
| --- | --- | --- |
| `install` | `#c2e0c6` | 下载、安装、首次启动、OS 提示、Gatekeeper、SmartScreen。 |
| `packaging` | `#bfd4f2` | Release assets、签名、notarization、更新器、安装包名称。 |
| `security` | `#ee0701` | 凭据处理、私钥问题、日志脱敏、危险默认值。 |
| `ssh` | `#0e8a16` | SSH 认证、终端、重连、命令历史、会话启动。 |
| `sftp` | `#1d76db` | 文件浏览、上传、下载、队列、冲突策略、远程编辑。 |
| `guardrails` | `#b60205` | 危险命令审批、策略、临时授权、误报。 |
| `retry-center` | `#5319e7` | 失败传输历史、重新入队、恢复、队列恢复。 |
| `operation-center` | `#006b75` | 活动操作、全局错误动作、诊断任务、重连动作。 |
| `server-health` | `#0e8a16` | CPU、内存、磁盘、网络、负载、运行时间、进程 / 服务检查。 |
| `port-forwarding` | `#5319e7` | Local、Remote、Dynamic SOCKS5 转发和保存的预设。 |

## 手动设置

如果不能使用 GitHub CLI，可以手动创建：

```text
Repository -> Issues -> Labels -> New label
```

推荐第一批设置：

1. 创建核心 labels。
2. 创建 `p0`、`p1`、`p2`、`needs-repro`、`needs-logs`。
3. 随着真实 issues 出现，再创建产品区域 labels。
4. 只加能帮助判断下一步动作的 labels。

发布后前 48 小时，优先关注 `p0`、`install`、`packaging`、`security`、`needs-repro` 和 `needs-logs`。
