# Contributing To TermDock

Thanks for helping improve TermDock. The project is currently focused on being a safer SSH + SFTP desktop workspace for individual developers, small teams, and operators.

Please keep reports and contributions practical: explain the server workflow, the platform, and the exact place where TermDock helps or breaks.

## Before Opening An Issue

- Check the latest [GitHub Releases](https://github.com/gongteng0215/TermDock/releases).
- For install or launch problems, read [Install And Launch Troubleshooting](docs/INSTALL_TROUBLESHOOTING.md).
- For sensitive security or credential concerns, do not open a public issue. Use GitHub's private security advisory flow:
  <https://github.com/gongteng0215/TermDock/security/advisories/new>

Do not post real hosts, usernames, passwords, private keys, tokens, production paths, or full unsanitized logs.

## Useful Reports

Good bug reports include:

- TermDock version
- Platform and OS version
- Downloaded asset (`.exe`, Windows `.zip`, `.dmg`, macOS `.zip`, or source build)
- Steps to reproduce
- Expected behavior
- Actual behavior
- Sanitized screenshots, logs, or bug report exports when useful

Good feature requests describe the workflow first:

- What are you trying to do?
- How do you handle it today?
- Which area does it affect: SSH, SFTP, server health, port forwarding, guardrails, diagnostics, packaging, or docs?
- What would make the workflow simpler or safer?

## Development Setup

```bash
pnpm install
pnpm dev
```

Build and validate:

```bash
pnpm run typecheck
pnpm run build
pnpm run smoke:ui
```

The smoke test starts a local SSH/SFTP fixture, so core UI flows can be checked without an external server.

## Pull Request Guidelines

- Keep changes focused on one workflow or problem.
- Follow the existing Electron, React, TypeScript, and IPC patterns.
- Avoid unrelated refactors in feature or bug-fix PRs.
- Update docs when behavior, packaging, or user-facing workflows change.
- Add or update focused tests when changing shared behavior or core workflows.
- Run at least `pnpm run typecheck` and `pnpm run build` before submitting code changes.
- Run `pnpm run smoke:ui` for changes that affect SSH, SFTP, settings, diagnostics, operation center, guardrails, retry center, or layout.

## Project Direction

TermDock is not trying to compete by becoming the largest terminal app. Contributions that fit best usually improve one of these areas:

- Safer SSH usage
- SFTP transfer reliability
- Server health visibility
- Port forwarding ergonomics
- Import/migration from existing SSH workflows
- Install, signing, update, and first-run trust
- Clear documentation for developers and operators

Large feature ideas are welcome, but they are easier to discuss when opened as an issue first.

---

# 参与 TermDock

感谢你帮助改进 TermDock。项目当前定位是：面向个人开发者、小团队和运维人员的安全 SSH + SFTP 桌面工作台。

提交反馈时，请尽量描述真实工作流：你在管理服务器时想做什么，在哪个平台上遇到问题，TermDock 当前哪里帮到了你或卡住了你。

## 提 Issue 前

- 先确认是否已经下载最新 [GitHub Releases](https://github.com/gongteng0215/TermDock/releases)。
- 安装或启动问题请先看 [安装和启动故障排查](docs/INSTALL_TROUBLESHOOTING.md)。
- 如果涉及安全、凭据、私钥、日志泄露等敏感问题，请不要发公开 issue，请使用 GitHub 私密安全报告：
  <https://github.com/gongteng0215/TermDock/security/advisories/new>

请不要在公开 issue 里贴真实主机、用户名、密码、私钥、token、生产路径或未脱敏日志。

## 有帮助的反馈

好的 bug report 通常包含：

- TermDock 版本
- 平台和系统版本
- 下载的安装包类型（`.exe`、Windows `.zip`、`.dmg`、macOS `.zip` 或源码构建）
- 复现步骤
- 预期行为
- 实际行为
- 已脱敏的截图、日志或 bug report 导出

好的功能建议优先描述工作流：

- 你想完成什么操作？
- 现在是怎么处理的？
- 属于哪个区域：SSH、SFTP、服务器健康、端口转发、危险命令保护、诊断、打包发布或文档？
- TermDock 怎么做会让这个流程更简单或更安全？

## 本地开发

```bash
pnpm install
pnpm dev
```

构建和验证：

```bash
pnpm run typecheck
pnpm run build
pnpm run smoke:ui
```

默认 smoke 会启动本地 SSH/SFTP fixture，不需要外部服务器即可验证核心 UI 流程。

## PR 建议

- 每个 PR 聚焦一个工作流或一个问题。
- 尽量沿用现有 Electron、React、TypeScript 和 IPC 写法。
- 功能或修复 PR 里避免混入无关重构。
- 用户行为、打包发布或工作流变化时同步更新文档。
- 修改共享行为或核心流程时补充聚焦的测试。
- 代码变更提交前至少运行 `pnpm run typecheck` 和 `pnpm run build`。
- 修改 SSH、SFTP、设置、诊断、操作中心、危险命令保护、重试中心或布局时，建议运行 `pnpm run smoke:ui`。

## 项目方向

TermDock 不靠“大而全”竞争。更适合的贡献通常集中在：

- 更安全的 SSH 使用体验
- 更可靠的 SFTP 文件传输
- 更清晰的服务器状态可见性
- 更顺手的端口转发管理
- 从现有 SSH 工作流迁移和导入
- 安装、签名、更新和首次运行信任
- 面向开发者和运维的清晰文档

较大的功能想法也欢迎，但建议先开 issue 讨论。
