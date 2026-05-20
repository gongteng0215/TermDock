# Draft Release Notes (v0.1.27)

[中文](tmp-release-v0.1.27.zh-CN.md)

Last updated: 2026-05-20

## Highlights

- Added encrypted session migration:
  - new `Export Encrypted Migration...` and `Import Encrypted Migration...` flows
  - passphrase-protected `.tdmigration` packages can include saved passwords, private-key passphrases, and optional private-key file contents
  - embedded private-key files are restored into TermDock app data instead of overwriting source-machine paths
  - import preview can decrypt and inspect migration content before writing restored key files
- Refreshed the editor-workbench UI:
  - flatter code-editor workbench shell across topbar, sidebars, terminal stage, transfer dock, and modal chrome
  - SFTP explorer now supports persisted `Compact` / `Details` views
  - right inspector supports collapsible command history and narrow-width `Sessions` / `Health` / `History` tabs
  - English and Simplified Chinese UI coverage now extends across settings, dialogs, context menus, command history, retry center, operation center, and diagnostics
- Hardened renderer maintainability and startup structure:
  - large renderer regions were split into focused hooks, prop builders, modal hosts, and workbench shell layers
  - renderer bundles are now split into dedicated workbench/settings/terminal chunks instead of one oversized main bundle
  - `App.tsx` now behaves much more like an assembly layer for workbench, dialogs, overlays, settings, and transfer UI
- Expanded release confidence:
  - encrypted migration now has targeted test coverage
  - smoke automation now covers encrypted migration visibility, workbench UI, live SSH/SFTP, remote-open-file conflict flows, retry/operation center, and diagnostics capture

## Validation

- `pnpm run typecheck` passed.
- `pnpm run build` passed.
- `pnpm run smoke:ui` passed with `PASS 50 / FAIL 0 / SKIP 0` at `artifacts/smoke/2026-05-20T02-46-53-664Z/summary.json`.

## Notes for Release Page

- Version in `package.json` is still `0.1.26`; bump/version-tagging should happen as part of final release prep.
- Keep this release focused on user-visible encrypted migration, the refreshed editor-workbench UI, and stability/maintainability wins.
