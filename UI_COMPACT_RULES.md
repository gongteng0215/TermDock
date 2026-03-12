# TermDock UI Compact Rules

Last updated: 2026-03-13

## Objective

Keep the entire app visually compact and stable.
No page should expand/collapse based on list item count during runtime.

## Global Density Rules

1. Use compact control sizes by default.
2. Prefer smaller spacing, tighter headers, and compact button/input heights.
3. Do not introduce oversized action rows or large empty vertical gaps.
4. Keep modal actions compact and wrapped when width is limited.

## No Layout Shift Rule (Mandatory)

1. Runtime data updates must not change component geometry.
2. Dynamic counters/status text must not push sibling controls horizontally.
3. Reserve fixed slots for dynamic actions (fixed width buttons or fixed grid columns).
4. Use placeholder rows when optional status lines appear/disappear, so header/footer height stays constant.
5. Use tabular numbers for counters/metrics (`font-variant-numeric: tabular-nums`) to avoid digit-width jitter.
6. Context-menu entry points for list panels should remain available even when list data is empty (blank-area trigger).

## Fixed-Height List Rules

1. Every list display area must use a fixed height (`height`, `min-height`, `max-height`).
2. List containers must scroll internally (`overflow: auto`), never resize parent layout.
3. Use `align-content: start` on grid-based list containers to avoid item stretching.
4. Do not rely on content-driven height for operational lists.

## Coverage Scope (Must Follow)

- Sessions: group list and session list
- SFTP browser list and transfer list
- Server health process/services lists
- Settings lists:
  - Hotkeys list
  - Hotkey conflict list
  - Port-forward presets/active/events list shells
  - Disconnect report shell/list
- Retry Center list shell and grouped/flat lists
- Operation Center tab activity list
- Terminal command history list shell

## Implementation Baseline

Use shared compact tokens in `src/renderer/styles.css`:

- `--ui-control-height`
- `--ui-control-height-small`
- `--ui-control-font-size`
- `--ui-list-height-sm`
- `--ui-list-height-md`
- `--ui-list-height-lg`

When adding a new list:

1. Create a dedicated `*-list-shell` container (or equivalent).
2. Set fixed heights (`height`, `min-height`, `max-height`) on that container.
3. Set `overflow: auto` on the container.
4. Ensure list content itself uses `align-content: start` if grid-based.

## Review Checklist (Required for UI Changes)

1. Does the page remain compact at default desktop size?
2. Does any list area resize as item count changes? If yes, fix before merge.
3. Does any runtime value change trigger horizontal/vertical layout shift? If yes, fix before merge.
4. Are dynamic counters and optional status messages rendered in reserved/fixed slots?
5. Are action rows compact and readable in narrow widths?
6. Are all list surfaces internally scrollable with fixed-height shells?
7. Verify both `pnpm run typecheck` and `pnpm run build:renderer`.

