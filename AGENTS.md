# AGENTS.md

## Workflow Notes

- Prefer targeted verification during iterative work: run `pnpm run typecheck` and `pnpm run build` first.
- Do not run `pnpm run smoke:ui` frequently during normal iteration.
- Reserve `pnpm run smoke:ui` for meaningful milestones, high-risk UI/runtime changes, or final pre-handoff verification.
