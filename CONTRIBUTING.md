# Contributing To TermDock

[中文](CONTRIBUTING.zh-CN.md)

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
