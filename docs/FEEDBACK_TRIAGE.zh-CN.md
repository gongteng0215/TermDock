# 反馈处理流程

[English](FEEDBACK_TRIAGE.md)

这份指南用于处理第一波 GitHub Issues、Release 评论、文章评论和直接用户反馈。

## 目标

- 快速响应安装和启动阻塞问题。
- 避免安全敏感细节出现在公开讨论里。
- 把模糊反馈转成可复现 issue。
- 用早期反馈决定下一个小而有效的修复。

## 优先级

### P0：阻塞或敏感问题

优先处理。

- 应用无法在支持平台上安装或启动。
- Release asset 缺失、损坏或命名令人困惑。
- 用户报告凭据暴露、私钥处理或日志脱敏风险。
- 常见密码 / 私钥场景下 SSH/SFTP 连接流程失败。
- 数据丢失风险：传输覆盖、远程编辑保存回写、会话持久化损坏。
- 启动崩溃循环或空白窗口。

预期动作：

- 条件允许时 24 小时内回复。
- 询问 OS 版本、TermDock 版本、下载的 asset 和完整错误文字。
- 将安全敏感报告转到私密 security advisory 流程。
- 如果反馈来自 GitHub 之外的评论区，创建聚焦的后续 issue。

### P1：核心工作流回归

在 P0 之后尽快修复。

- SFTP 上传 / 下载队列行为异常。
- Retry Center 无法重试预期的失败传输。
- 危险命令保护误拦安全命令，或漏掉明显危险命令。
- 端口转发无法创建常见 Local / Remote / Dynamic 转发。
- 服务器健康面板在常见 Linux 主机上失败。
- 中文 / 英文界面让核心流程难以使用。

预期动作：

- 确认复现细节。
- 请求已脱敏截图 / 日志。
- 修复后链接到相关 release 或 commit。

### P2：改进和打磨

记录并批量处理。

- 新工作流建议。
- 导入其他客户端会话格式的请求。
- UI 密度、布局或文案打磨。
- 额外平台 / 安装包请求。
- 文档改进。
- 锦上添花的集成。

预期动作：

- 明确用户工作流。
- 如果符合项目方向，保持 issue 打开。
- 对不符合“安全 SSH + SFTP 工作台”定位的宽泛请求进行关闭或延期。

## Labels

推荐 GitHub labels：

- `bug`
- `enhancement`
- `install`
- `packaging`
- `security`
- `needs-repro`
- `needs-logs`
- `ssh`
- `sftp`
- `port-forwarding`
- `server-health`
- `guardrails`
- `retry-center`
- `docs`
- `good-first-issue`

## 回复模板

### 需要复现信息

```md
感谢反馈。为了方便复现，可以再补充一点信息吗？

- TermDock 版本：
- 平台和 OS 版本：
- 下载的 asset：
- 复现步骤：
- 你的预期：
- 实际发生了什么：

请先从截图或日志里移除真实主机、用户名、密码、私钥、token 和生产路径。
```

### 安装或启动问题

```md
感谢试用 TermDock。安装 / 启动问题现在是最高优先级。

可以麻烦补充：

- OS 版本：
- 下载的是哪个文件（`.exe`、Windows `.zip`、`.dmg`、macOS `.zip`）：
- 完整警告或错误文字：
- 应用是完全打不开，还是打开后空白窗口：

如果附日志或截图，请先移除私有路径、用户名、token 和凭据。
```

### 安全或凭据问题

```md
感谢提醒。这个问题可能涉及凭据或敏感运行时数据，请不要在公开 issue 里贴 secrets 或完整日志。

如果这是具体漏洞或凭据暴露风险，请使用 GitHub 私密 security advisory 流程，而不是继续在公开 issue 里讨论：

https://github.com/gongteng0215/TermDock/security/advisories/new
```

### 功能请求澄清

```md
感谢建议。可以描述一下这个功能会帮助哪个工作流吗？

- 你想完成什么？
- 现在怎么处理？
- 你希望 TermDock 怎么做？
- 这个需求和 SSH、SFTP、服务器健康、端口转发、危险命令保护或诊断有关吗？
```

### 已在版本中修复

```md
这个问题应该已经在最新版本修复。请从 GitHub Releases 下载最新构建试一下；如果仍然复现，可以继续评论或重新打开 issue。

Release 页面：
https://github.com/gongteng0215/TermDock/releases
```

## 发布后前 48 小时

手动跟踪这些信号：

```text
日期：
发布平台：
文章 / 视频 URL：
GitHub stars：
Release downloads：
新增 issues：
安装 / 启动投诉：
安全 / 凭据问题：
最常被提到的功能：
最令人困惑的 README / Release 细节：
下一个优先修复：
```

## 如何从早期反馈决定优先级

1. Windows 或 macOS 安装 / 启动失败。
2. 安全和凭据存储问题。
3. 缺失或令人困惑的下载文件。
4. 常见环境下 SSH/SFTP 连接失败。
5. 阻塞上手的中文 UI 问题。
6. 让迁移更容易的请求，尤其是 `~/.ssh/config` 导入改进。

不要因为单条评论就启动大型新功能。除非修复很小且明显符合方向，否则先等待重复信号。
