# GitHub Labels

Use these labels with the issue templates and [Feedback Triage](FEEDBACK_TRIAGE.md). The goal is to make early feedback easy to scan during the first launch wave.

## Core Labels

| Label | Color | Use |
| --- | --- | --- |
| `bug` | `#d73a4a` | Reproducible broken behavior. |
| `enhancement` | `#a2eeef` | Feature requests and workflow improvements. |
| `docs` | `#0075ca` | README, troubleshooting, release notes, screenshots, or guides. |
| `good-first-issue` | `#7057ff` | Small, well-scoped fixes suitable for new contributors. |

## Priority And Triage

| Label | Color | Use |
| --- | --- | --- |
| `p0` | `#b60205` | Install blockers, launch blockers, security-sensitive issues, data loss risk, crash loops. |
| `p1` | `#d93f0b` | Core SSH/SFTP/guardrail/health/port-forwarding regressions. |
| `p2` | `#fbca04` | Improvements, polish, migration helpers, and docs cleanup. |
| `needs-repro` | `#d4c5f9` | Needs steps, environment details, or a minimal reproduction. |
| `needs-logs` | `#bfdadc` | Needs sanitized logs, screenshots, or bug report export. |

## Product Areas

| Label | Color | Use |
| --- | --- | --- |
| `install` | `#c2e0c6` | Download, install, first launch, OS warnings, Gatekeeper, SmartScreen. |
| `packaging` | `#bfd4f2` | Release assets, signing, notarization, updater, package names. |
| `security` | `#ee0701` | Credential handling, private-key concerns, log redaction, risky defaults. |
| `ssh` | `#0e8a16` | SSH auth, terminal, reconnect, command history, session startup. |
| `sftp` | `#1d76db` | File browser, upload, download, queue, conflict policies, remote edit. |
| `guardrails` | `#b60205` | Dangerous-command approval, policies, temporary approvals, false positives. |
| `retry-center` | `#5319e7` | Failed transfer history, requeue, recovery, queue restore. |
| `operation-center` | `#006b75` | Active operations, global error actions, diagnostics jobs, reconnect actions. |
| `server-health` | `#0e8a16` | CPU, memory, disk, network, load, uptime, process/service checks. |
| `port-forwarding` | `#5319e7` | Local, Remote, Dynamic SOCKS5 forwarding and saved presets. |

## Manual Setup

If GitHub CLI is unavailable, create labels manually from:

```text
Repository -> Issues -> Labels -> New label
```

Recommended first-pass setup:

1. Create the core labels.
2. Create `p0`, `p1`, `p2`, `needs-repro`, and `needs-logs`.
3. Create product-area labels as the first real issues arrive.
4. Apply only the labels that help decide the next action.

For the first 48 hours after a launch post, prioritize `p0`, `install`, `packaging`, `security`, `needs-repro`, and `needs-logs`.
