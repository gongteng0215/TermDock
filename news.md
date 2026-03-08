# TermDock Product Notes

Last updated: 2026-03-08

## Confirmed Direction

- Keep a compact-first desktop workflow
- Prioritize operator efficiency over decorative UI
- Use context-menu-first interactions for session/group/file operations
- Keep core terminal and transfer actions deterministic and recoverable

## Release Baseline

- Current stable release: `v0.1.10` (2026-03-08)

## Shipped in Recent Cycles

- master (post-v0.1.9): added transfer conflict policy (`overwrite/skip/rename`) for upload/download queueing
- master (post-v0.1.9): added `Retry Failed` actions in transfer dock (upload/download)
- master (post-v0.1.9): added persistent failed-transfer history per session; `Retry Failed` now works after restart
- master (post-v0.1.9): added Transfer Retry Center modal with filters, batch retry, and history cleanup
- master (post-v0.1.9): added SSH config import baseline with preview and duplicate strategy
- master (post-v0.1.9): hardened SSH config parser with recursive `Include` and wildcard/negation host merge
- master (post-v0.1.9): added port forwarding baseline in `Settings > Port Fwd` (Local / Remote / Dynamic SOCKS5)
- master (post-v0.1.9): added saved port forwarding presets with one-click apply and optional auto-restore on connect
- master (post-v0.1.9): added port forwarding runtime status view (`Active` / `Degraded`) with last-error and activity metadata
- master (post-v0.1.9): added port forwarding recent event timeline and one-click diagnostics snapshot export
- master (post-v0.1.9): added persisted port forwarding event history (session scope), with filter and clear actions
- master (post-v0.1.9): added diagnostics logging baseline and `Settings > Diagnostics` log tools
- master (post-v0.1.9): added one-click bug report export (`zip` bundle of logs + metadata + settings snapshot)
- master (post-v0.1.9): added transfer soak-test tool (`scripts/soak-transfer.mjs`) and runbook (`SOAK_TEST.md`)
- master (post-v0.1.9): reduced transfer-time disconnect risk by preventing overlapping server monitor polling per tab
- master (post-v0.1.9): stabilized terminal rendering on small windows with deferred/font-ready xterm refit
- master (post-v0.1.9): fixed settings footer overlap on shorter window heights
- v0.1.9: blocked raw wheel mouse-report text artifacts (`%6`, `%9`) in alternate-buffer editor scenarios
- v0.1.8: refined terminal wheel mapping to reduce blank-line/jump effects in full-screen editors
- v0.1.7: improved wheel-scroll reliability in alternate-buffer editors by capturing terminal wheel events
- v0.1.6: terminal wheel scrolling fix for alternate-buffer editors (`nano`, `vim`)
- v0.1.4: settings version display, batch session/group operations, tab close menu expansion, move-to-group dropdown
- Server health baseline and detail drill-down
- Alert thresholds for CPU/memory/disk
- Folder-style session grouping
- Split transfer dock with queue stats and cancel-all actions
- Remote file open deduplication and auto-upload on save
- Windows hotkey defaults use `Ctrl+Shift+C` / `Ctrl+Shift+V`
- UI icon system upgraded to `lucide-react`

## Current Top Problems to Solve

1. Cross-platform smoke test coverage is still incomplete
2. Installer signing/notarization workflow is not finalized
3. Global recoverable error UX needs stronger action guidance
4. Retry center still lacks analytics and export workflow
5. Port forwarding still needs richer correlation/export workflows for complex failures
6. Large transfer/folder edge cases still need hardening

## Next Candidate Features

- Retry-center analytics and history export
- Session templates with variable substitution
- Unified operation center for long-running remote tasks
- Optional encrypted session export/import
- SSH jump-host chain builder (`ProxyJump`/bastion wizard)
- Transfer bandwidth limiter + schedule window
- Command snippets/playbooks with parameter prompts and guardrails
- Multi-host command broadcast with dry-run preview
- Remote file snapshot and one-click rollback
- Session tags and smart saved views
- Terminal recording/replay with sanitized share export
- Dangerous-command guardrails with confirmation policy
- Recurring folder sync profiles
- Connection quality timeline dashboard
- Workspace profile mode (`dev`/`staging`/`prod`) with persistent visual cues

## Long-Range Exploration (Unprioritized)

- Operation audit timeline (command + transfer traceability)
- Disconnect auto-diagnostic report with runtime context
- Diff-first sync mode (preview before apply)
- Session health checks with proactive risk badges
- Team session bundle (encrypted import/export)
- Temporary authorization mode for risky operations
- Environment policy templates (`dev` / `staging` / `prod`)
- Crash dump + symbolized stack pipeline
- Release channel management (`stable` / `beta` / `canary`)
- Accessibility and hotkey conflict checker
- Plugin extension hooks for external ops integrations
- Built-in command allowlist/denylist policy packs
