# TermDock Task Board

Last updated: 2026-03-08

## Current Release State

- Stable release: `v0.1.10`
- Branch baseline: `master`
- Priority direction: hardening and release quality, not new broad feature expansion

## P0 Matrix

| ID | Status | Notes |
| --- | --- | --- |
| P0-A1 | DONE | Electron + React + TypeScript baseline is stable |
| P0-A2 | DONE | Core multi-pane shell workflow is stable |
| P0-A3 | PARTIAL | JSON persistence works; SQLite migration pending |
| P0-A4 | DONE | Secure credential storage via keytar/fallback |
| P0-A5 | PARTIAL | Structured logging module baseline landed (main+renderer, file logs, diagnostics panel) |
| P0-B1 | PARTIAL | Session list/search/favorite done; deeper group model pending |
| P0-B2 | PARTIAL | Session form is usable; stronger validation/bulk flows pending |
| P0-B3 | DONE | Delete with confirmation |
| P0-B4 | PARTIAL | Recency tracking exists; dedicated recent table pending |
| P0-B5 | PARTIAL | Favorite flow exists; grouped-favorite polish pending |
| P0-C1 | DONE | xterm rendering |
| P0-C2 | DONE | SSH password/private-key auth |
| P0-C3 | DONE | Terminal IO stream wiring |
| P0-C4 | DONE | Multi-tab terminal sessions |
| P0-C5 | PARTIAL | KeepAlive + auto reconnect done; extra manual recovery UX pending |
| P0-C6 | DONE | Platform-aware hotkeys |
| P0-C7 | DONE | Same session multi-open |
| P0-C8 | DONE | Terminal context menu |
| P0-D1 | DONE | SFTP channel reuse via active tab |
| P0-D2 | PARTIAL | SFTP panel is usable; final polish pending |
| P0-D3 | PARTIAL | Browse/open/refresh works; edge error states still improving |
| P0-D4 | PARTIAL | Queue/progress/cancel done; monitor contention mitigations landed, long-run stress hardening still pending |
| P0-D5 | PARTIAL | Create/rename/delete done; recursive safety flows still evolving |
| P0-D6 | PARTIAL | Drag-and-drop works; very large folder workflows need more tuning |
| P0-E1 | TODO | Startup performance benchmark/optimization |
| P0-E2 | TODO | Large transfer memory optimization |
| P0-E3 | PARTIAL | Diagnostics logging baseline landed; recoverable action UX still pending |
| P0-E4 | TODO | Persistence crash-recovery verification |
| P0-F1 | TODO | Unit tests |
| P0-F2 | TODO | Integration tests |
| P0-F3 | TODO | Cross-platform smoke tests |
| P0-F4 | PARTIAL | Build/release pipeline works; signing/notarization pending |
| P0-G1 | DONE | Server health panel baseline shipped |

## In Progress Track (v0.1.3+)

1. `P0-F3` Cross-platform smoke checklist and reproducible report
2. `P0-F4` Signing/notarization strategy and installation verification
3. `P0-E3` Global error recovery actions and user guidance
4. Transfer hardening for cancel races and large directory jobs
5. `F5` Port forwarding hardening: diagnostics/event-history polish

## Post-v0.1.9 Hotfix Track (master)

1. Transfer + monitor contention hardening:
   - prevent overlapping monitor requests per tab
   - pause silent monitor polling during active transfer bursts
2. Terminal viewport stabilization:
   - deferred multi-pass fit on connect/activate
   - font-ready refit for packaged startup and small-window scenarios
3. Field validation:
   - verify no random disconnect regressions during large batch upload tests
   - verify no small-window editor rendering corruption
4. Soak tooling:
   - added `scripts/soak-transfer.mjs`
   - added `SOAK_TEST.md` runbook and matrix
5. Diagnostics logging baseline:
   - main process file logger with rotation
   - renderer global error/rejection auto-capture
   - `Settings > Diagnostics` log path actions
6. Transfer safety baseline:
   - conflict policy (`overwrite/skip/rename`) for upload/download
   - `Retry Failed` actions for upload/download docks
7. Retry persistence baseline:
   - failed transfer history persisted in local storage by session scope
   - `Retry Failed` now reuses persisted failures after app restart
8. Retry center baseline:
   - added transfer retry center modal with filter/search/select
   - supports batch retry and batch delete for persisted history records
9. SSH config import baseline:
   - `sessions:parseSshConfig` parser for common directives
   - sessions context-menu import flow with preview and duplicate strategy
   - parser hardening: recursive `Include` support + `Host` wildcard/negation merge behavior
10. Port forwarding baseline:
   - `Settings > Port Fwd` panel
   - Local / Remote / Dynamic (`SOCKS5`) create, list, remove
   - bound to active terminal tab and auto-cleaned on disconnect/close
   - saved presets per session with optional auto-restore on connect
   - runtime status (`Active` / `Degraded`) and last-error metadata
   - recent events and diagnostics snapshot export for issue reporting
   - persisted event history (session scope) with filter and clear actions

## Immediate Next Target

1. `F5+` Port forwarding diagnostics polish (file export + richer correlation metadata)
2. `F2+` Retry-center analytics + history export package
3. `P0-F3` Cross-platform smoke checklist and reproducible report
4. `P0-F4` Signing/notarization strategy and installation verification

## Backlog Candidates

- Snippets and command palette
- Remote file quick-edit advanced flow
- Multi-host command broadcast
- Advanced retry-center analytics and history export
- Session tags and smart views
- Terminal recording and replay export
- Dangerous-command guardrails
- Recurring folder sync profiles
- Connection quality timeline dashboard
- Workspace profile mode (`dev` / `staging` / `prod`)

## Exploration Pool (Unprioritized)

- Operation audit timeline (command/transfer actor+scope tracking)
- Disconnect auto-diagnostic report
- Diff-first sync mode (preview then apply)
- Session health checks with proactive risk badges
- Team session bundle (encrypted)
- Temporary authorization mode for risky operations
- Environment policy templates (`dev` / `staging` / `prod`)
- Crash dump and symbolized stack pipeline
- Release channel management (`stable` / `beta` / `canary`)
- Accessibility and hotkey conflict checker
- Plugin extension hooks (ticketing/CMDB/alerts)
- Command allowlist/denylist policy packs

## Proposed Feature Track (Post-Hardening)

| ID | Priority | Status | Feature | Why |
| --- | --- | --- | --- | --- |
| F1 | P1 | DONE | Transfer conflict policy (overwrite/skip/rename) | Prevent accidental overwrite and clarify current behavior |
| F2 | P1 | DONE | Transfer retry center + persistent history | Fast recovery after network interruption or cancel race |
| F3 | P1 | DONE | Bug report bundle export | Fast support loop with one-click diagnostic package |
| F4 | P1 | DONE | SSH config import (`~/.ssh/config`) | Reduce manual session creation for existing users |
| F5 | P1 | PARTIAL | Port forwarding manager (L/R/Dynamic + presets + diagnostics timeline) | Cover common SSH tunnel workflows without external tools |
| F6 | P2 | TODO | Session templates + env variables | Faster provisioning for repeated host patterns |
| F7 | P2 | TODO | Remote overwrite pre-check (mtime/size/checksum) | Safer file edit and sync workflows |
| F8 | P2 | TODO | Unified operation center for long jobs | Better visibility for recursive delete/copy/move tasks |
| F9 | P3 | TODO | Encrypted session export/import | Easier migration and backup across machines |
| F10 | P2 | TODO | SSH jump-host chain builder | Simplify bastion/proxy workflows without manual `ProxyJump` typing |
| F11 | P2 | TODO | Transfer bandwidth limiter + schedule window | Avoid saturating production links during peak hours |
| F12 | P2 | TODO | Command snippets/playbooks with parameter prompts | Standardize repeat operations with safer execution |
| F13 | P2 | TODO | Multi-host command broadcast with dry-run preview | Speed up fleet operations while reducing blast radius |
| F14 | P3 | TODO | Remote file snapshot + one-click rollback | Recover quickly from accidental edits during remote file open/save |
| F15 | P2 | TODO | Session tags + smart views | Faster large-session navigation and operator context switching |
| F16 | P2 | TODO | Terminal recording/replay export | Improve incident review and asynchronous debugging collaboration |
| F17 | P1 | TODO | Dangerous-command guardrails | Reduce destructive operation risk in production environments |
| F18 | P2 | TODO | Recurring folder sync profiles | Simplify repeated deployment/content sync workflows |
| F19 | P2 | TODO | Connection quality timeline | Make intermittent network/session issues measurable and diagnosable |
| F20 | P3 | TODO | Workspace profile mode (`dev`/`staging`/`prod`) | Add persistent risk cues and reduce environment mix-ups |
| F21 | P2 | TODO | Operation audit timeline | Improve traceability for command/transfer actions during incidents |
| F22 | P1 | TODO | Disconnect auto-diagnostic report | Shorten root-cause analysis when random disconnects happen |
| F23 | P2 | TODO | Diff-first sync mode | Reduce accidental overwrite risk by previewing remote/local deltas |
| F24 | P2 | TODO | Session health checks + risk badges | Surface unsafe session state before users run critical operations |
| F25 | P3 | TODO | Team session bundle (encrypted) | Simplify secure onboarding and workspace migration for teams |
| F26 | P2 | TODO | Temporary authorization mode | Add time-limited safety controls for high-risk operations |
| F27 | P2 | TODO | Environment policy templates | Standardize timeout/concurrency/alerts across environments |
| F28 | P1 | TODO | Crash dump + symbolized stack pipeline | Improve post-crash triage speed and release confidence |
| F29 | P2 | TODO | Release channel manager | Make stable/beta/canary rollout and rollback guidance explicit |
| F30 | P2 | TODO | Accessibility + hotkey conflict checker | Prevent unusable keybinding combinations and improve UX consistency |
| F31 | P3 | TODO | Plugin extension hooks | Enable ecosystem integrations without forking core product |
| F32 | P2 | TODO | Command allowlist/denylist policy packs | Provide environment-aware guardrails for dangerous command patterns |
