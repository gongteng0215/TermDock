# AGENTS.md

## Workflow Notes

- Prefer targeted verification during iterative work: run `pnpm run typecheck` and `pnpm run build` first.
- Do not run `pnpm run smoke:ui` frequently during normal iteration.
- Reserve `pnpm run smoke:ui` for meaningful milestones, high-risk UI/runtime changes, or final pre-handoff verification.
- Native modules (`better-sqlite3`, `keytar`) must be compiled for Electron (not system Node). `postinstall` / `pnpm run rebuild:native` rebuilds them for the installed Electron ABI. SQLite test scripts run via `ELECTRON_RUN_AS_NODE` for the same reason.
