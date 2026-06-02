# Auto Update Design

## Goal

TermDock should check GitHub Releases for newer packaged versions and let users install them without manually downloading installers from the release page.

## Behavior

- Packaged apps check for updates shortly after startup.
- Development, smoke, and explicitly disabled runs do not contact the update feed.
- When an update is available, TermDock downloads it in the background.
- When the download is ready, TermDock asks whether to restart and install now or later.
- If the user chooses later, TermDock keeps running and the update can be installed the next time the app quits or starts.
- Update errors are logged but do not block app startup.

## Architecture

The main process owns update checks through `electron-updater`. The integration lives in a focused `src/main/auto-update.ts` module so startup logic in `src/main/main.ts` stays small. The module accepts Electron primitives as dependencies for testability, configures the GitHub provider, guards development/smoke runs, and wires updater events to logging and a restart prompt.

The existing `electron-builder` GitHub publish configuration remains the source of release metadata. Release artifacts must include updater metadata files (`latest.yml`, `latest-mac.yml`, and blockmaps where available), so the release workflow uploads those files alongside installers.

## Validation

- A targeted script verifies that the dependency, builder metadata settings, workflow asset upload patterns, and main-process bootstrap hook are present.
- `pnpm run typecheck` verifies the TypeScript integration.
- `pnpm run build` verifies renderer and main builds still compile.
