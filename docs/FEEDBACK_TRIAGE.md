# Feedback Triage

[中文](FEEDBACK_TRIAGE.zh-CN.md)

Use this guide for the first wave of GitHub issues, release comments, article comments, and direct user feedback.

## Goals

- Respond quickly to install and launch blockers.
- Keep security-sensitive details out of public threads.
- Turn vague feedback into reproducible issues.
- Use early feedback to decide the next small, high-impact fix.

## Priority Levels

### P0: Blocking Or Sensitive

Handle first.

- App cannot install or launch on a supported platform.
- Release asset is missing, corrupt, or confusingly named.
- User reports credential exposure, private key handling, or log redaction risk.
- SSH/SFTP connection flow breaks for common password/private-key cases.
- Data loss risk: transfer overwrite, remote edit save-back, session persistence corruption.
- Crash loop or blank window on startup.

Expected action:

- Reply within 24 hours when possible.
- Ask for OS version, TermDock version, downloaded asset, and exact error text.
- Move security-sensitive reports to private security advisory flow.
- Create a focused follow-up issue if the report comes from comments outside GitHub.

### P1: Core Workflow Regressions

Fix soon after P0s.

- SFTP upload/download queue behaves incorrectly.
- Retry Center cannot retry expected failed transfers.
- Dangerous-command guardrails block safe commands or miss obvious risky commands.
- Port forwarding cannot create common Local/Remote/Dynamic forwards.
- Server health panel fails on common Linux hosts.
- Chinese/English UI makes a core flow hard to use.

Expected action:

- Confirm reproduction details.
- Ask for sanitized screenshots/logs.
- Link to the relevant release or commit once fixed.

### P2: Improvements And Polish

Track and batch.

- New workflow suggestions.
- Requests for importing other clients' session formats.
- UI density, layout, or copy polish.
- Additional platform/package requests.
- Documentation improvements.
- Nice-to-have integrations.

Expected action:

- Clarify the user workflow.
- Keep the issue open if it matches the project direction.
- Close or defer broad requests that do not fit the safer SSH + SFTP workspace focus.

## Labels

Recommended GitHub labels:

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

## Response Templates

### Need Reproduction

```md
Thanks for the report. Could you share a little more detail so I can reproduce it?

- TermDock version:
- Platform and OS version:
- Downloaded asset:
- Steps to reproduce:
- What you expected:
- What happened instead:

Please remove real hosts, usernames, passwords, private keys, tokens, and production paths from screenshots or logs.
```

### Install Or Launch Problem

```md
Thanks for trying TermDock. Install/launch issues are the highest priority right now.

Could you share:

- OS version:
- Which asset you downloaded (`.exe`, Windows `.zip`, `.dmg`, macOS `.zip`):
- Exact warning or error text:
- Whether the app opens at all or shows a blank window:

If you attach logs or screenshots, please remove private paths, usernames, tokens, and credentials first.
```

### Security Or Credential Concern

```md
Thanks for raising this. Because this may involve credentials or sensitive runtime data, please avoid posting secrets or full logs publicly.

If this is a concrete vulnerability or credential exposure risk, please use GitHub's private security advisory flow instead of continuing in a public issue:

https://github.com/gongteng0215/TermDock/security/advisories/new
```

### Feature Request Clarification

```md
Thanks for the suggestion. Could you describe the workflow where this would help?

- What are you trying to do?
- How do you handle it today?
- What would TermDock ideally do?
- Is this tied to SSH, SFTP, server health, port forwarding, guardrails, or diagnostics?
```

### Fixed In Release

```md
This should be fixed in the latest release. Please try the newest build from GitHub Releases and reopen/comment if the issue still reproduces.

Release page:
https://github.com/gongteng0215/TermDock/releases
```

## First 48 Hours After Posting

Track these signals manually:

```text
Date:
Platform posted:
Article/video URL:
GitHub stars:
Release downloads:
New issues:
Install/launch complaints:
Security/credential questions:
Most mentioned feature:
Most confusing README/release detail:
Next fix to prioritize:
```

## What To Prioritize From Early Feedback

1. Install/launch failures on Windows or macOS.
2. Security and credential-storage questions.
3. Missing or confusing download assets.
4. SSH/SFTP connection failures on common setups.
5. Chinese UI issues that block onboarding.
6. Requests that make migration easier, especially `~/.ssh/config` import improvements.

Avoid starting large new features from one comment. Wait for repeated signals unless the fix is small and clearly aligned.
