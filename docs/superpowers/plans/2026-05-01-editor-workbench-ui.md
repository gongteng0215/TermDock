# Editor Workbench UI Implementation Plan

## Progress Snapshot

Last updated: 2026-05-09

### Current status

- `Task 1`: Complete in workspace
- `Task 2`: Complete in workspace
- `Task 3`: Complete in workspace
- `Task 4`: Complete in workspace

### Completed so far

- Split the renderer shell out of the large `App.tsx` body into reusable workbench components
- Added shared workbench shell, sidebar, panel, and icon components
- Unified panel/list-shell/status surface language across the left explorer and right inspector
- Reshaped the right rail into a clearer inspector with context cards, session details, and collapsible command history
- Added SFTP `Compact / Details` dual-view mode with local persistence
- Added narrow-width tabbed inspector behavior for `Sessions / Health / History`
- Reframed the transfer dock as a clearer bottom panel and aligned modal chrome with the workbench shell
- Unified high-frequency button states, focus rings, and workbench chrome polish across topbar, toggles, and compact inspector controls
- Restored stable UI validation, including smoke coverage

### Remaining follow-ups

- Optional: create final commit(s) for the UI refresh
- Optional: do a manual design-nit pass after live usage feedback

### Latest verification

- `pnpm run typecheck`
- `pnpm run build`
- `node scripts/test-transfer-progress.mjs`
- `pnpm run bench:transfer:local`
- `pnpm run smoke:ui`
- Latest smoke artifact on 2026-05-09: `artifacts/smoke/2026-05-09T02-44-14-552Z/summary.json` (`pass=45, fail=0, skip=0`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the renderer UI so TermDock reads like a modern dark code-editor workbench while preserving existing SSH, SFTP, transfer, and diagnostics behavior.

**Architecture:** Keep the current React + Electron component boundaries mostly intact, and implement the redesign by tightening shell hierarchy, reshaping sidebars and bottom panels, and refreshing terminal/tab styling. Limit markup changes to places where the current DOM prevents the left explorer, center stage, right inspector, and bottom panel from reading clearly.

**Tech Stack:** Electron, React 18, TypeScript, Vite, custom CSS, xterm.js

---

## File Structure

### Core renderer files to modify

- Modify: `src/renderer/App.tsx`
  - Main shell, left SFTP region, right utility region, bottom transfer panel, settings modal entry points
- Modify: `src/renderer/styles.css`
  - Global tokens, shell chrome, panel hierarchy, sidebar language, transfer panel language, modal language
- Modify: `src/renderer/components/terminal-workspace.tsx`
  - Terminal tab/header markup only if needed for workbench semantics
- Modify: `src/renderer/styles.css` terminal sections
  - Terminal tabs, terminal stage, editor-focus treatment, status pill styling

### Design and tracking docs

- Existing spec: `docs/superpowers/specs/2026-05-01-termdock-editor-workbench-design.md`
- Create: `docs/superpowers/plans/2026-05-01-editor-workbench-ui.md`

### Verification commands reused throughout

- `pnpm run typecheck`
- `pnpm run build`
- `pnpm run build:main`
- `node scripts/test-transfer-progress.mjs`
- `pnpm run bench:transfer:local`

---

### Task 1: Rebuild the workbench shell and shared visual tokens

**Status:** Complete in workspace. Shell extraction, shared surface tokens, topbar grouping, and safety verification are in place. The only unchecked step below is the commit step because this progress tracker is documenting workspace state, not a commit history.

**Files:**
- Modify: `src/renderer/styles.css:1`
- Modify: `src/renderer/styles.css:69`
- Modify: `src/renderer/styles.css:80`
- Modify: `src/renderer/styles.css:138`
- Modify: `src/renderer/styles.css:309`
- Modify: `src/renderer/styles.css:3625`
- Modify: `src/renderer/App.tsx:22984`

- [x] **Step 1: Capture the exact shell areas to change before editing**

Run:

```powershell
Get-Content src/renderer/styles.css | Select-Object -First 220
Get-Content src/renderer/App.tsx | Select-Object -Skip 22980 -First 80
```

Expected:

```text
Shows :root tokens, .app/.topbar/.layout blocks, and the App shell JSX around the header and main layout.
```

- [x] **Step 2: Replace the global token set with flatter workbench-oriented surfaces**

Update the root token block so the shell shifts from glass-heavy blue panels to a steadier workbench palette:

```css
:root {
  --bg-base: #101317;
  --bg-app: #161a20;
  --bg-elevated: #1b2129;
  --bg-sidebar: #181d24;
  --bg-panel: #1b2129;
  --bg-panel-2: #20262f;
  --bg-panel-hover: #252d38;
  --bg-field: #20262f;
  --bg-terminal: #0f1318;
  --text-main: #d7dee7;
  --text-soft: #9aa7b5;
  --text-faint: #7e8a98;
  --accent: #4ea1ff;
  --accent-strong: #2f81f7;
  --accent-muted: #27466b;
  --border-main: #2f3844;
  --border-soft: #252d37;
  --border-strong: #404c5b;
  --shadow-elevated: 0 18px 40px rgba(0, 0, 0, 0.28);
  --radius-panel: 10px;
  --radius-control: 8px;
}
```

- [x] **Step 3: Rework the app background, topbar, and panel shell to read like editor chrome**

Implement the shell treatment with flatter surfaces and clearer separators:

```css
body {
  background: linear-gradient(180deg, #181c22 0%, #14181d 100%);
}

body::before {
  display: none;
}

.topbar {
  border-bottom: 1px solid var(--border-main);
  background: #181d24;
  backdrop-filter: none;
  box-shadow: none;
}

.layout {
  gap: 0;
  padding: 0;
  background: var(--bg-app);
}

.panel {
  border: 0;
  border-right: 1px solid var(--border-soft);
  border-radius: 0;
  background: var(--bg-sidebar);
  box-shadow: none;
}

.panel::before {
  display: none;
}
```

- [x] **Step 4: Tighten shared heading and section rhythm so all regions use the same language**

Normalize headings and section spacing:

```css
.panel__section {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-soft);
}

.panel__section h2,
.transfer-dock__heading h3 {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-soft);
}

.panel__heading {
  margin-bottom: 8px;
}
```

- [x] **Step 5: Adjust the topbar JSX only if needed to support cleaner workbench metadata grouping**

Keep the existing metadata but simplify the markup if the current shell needs one extra wrapper:

```tsx
<header className="topbar">
  <div className="topbar__brand">
    <strong>TermDock</strong>
    <span>SSH + SFTP Workbench</span>
  </div>
  <div className="topbar__meta">
    <span className="topbar__meta-dot" />
    <span>{connectionPreferences.autoReconnect ? `Auto Reconnect ${connectionPreferences.reconnectDelaySeconds}s` : "Auto Reconnect Off"}</span>
    {workspaceProfilePreferences.profileId !== "none" ? (
      <span className={`workspace-profile-badge workspace-profile-badge--${workspaceProfilePreferences.profileId}`}>
        {selectedWorkspaceProfile.shortLabel}
      </span>
    ) : null}
  </div>
</header>
```

- [x] **Step 6: Run renderer safety checks after the shell pass**

Run:

```powershell
pnpm run typecheck
pnpm run build
```

Expected:

```text
Typecheck passes. Renderer build passes; Vite chunk-size warning is acceptable if unchanged.
```

- [ ] **Step 7: Commit the shell pass**

Run:

```powershell
git add src/renderer/App.tsx src/renderer/styles.css
git commit -m "feat: restyle renderer shell as editor workbench"
```

Expected:

```text
Creates a commit containing the token, shell, and shared panel-language refresh.
```

---

### Task 2: Reshape the left explorer and right inspector sidebars

**Status:** Complete in workspace. The explorer/inspector split is live, shared sidebar language is in place, the SFTP dual-view shipped, the sessions inspector now exposes detail/context layers, command history is collapsible, and narrow-width tabbed inspector behavior is implemented. The commit step remains intentionally unchecked.

**Files:**
- Modify: `src/renderer/App.tsx:23008`
- Modify: `src/renderer/App.tsx:23202`
- Modify: `src/renderer/styles.css:471`
- Modify: `src/renderer/styles.css:479`
- Modify: `src/renderer/styles.css:590`
- Modify: `src/renderer/styles.css:2953`
- Modify: `src/renderer/styles.css:3186`

- [x] **Step 1: Capture the sidebar JSX and CSS before restructuring**

Run:

```powershell
Get-Content src/renderer/App.tsx | Select-Object -Skip 23000 -First 260
Get-Content src/renderer/styles.css | Select-Object -Skip 460 -First 320
Get-Content src/renderer/styles.css | Select-Object -Skip 2920 -First 340
```

Expected:

```text
Shows the left SFTP panel, right utility sections, list styles, and server-health/command-history blocks that need to be unified.
```

- [x] **Step 2: Introduce explicit explorer and inspector wrappers in App.tsx**

Wrap the existing content so the left and right areas can be styled as coordinated sidebars:

```tsx
<aside className="panel panel--left">
  <div className="workbench-sidebar workbench-sidebar--explorer">
    <section className="panel__section panel__section--sftp">
      {/* existing SFTP content */}
    </section>
  </div>
</aside>

<aside className="panel panel--right">
  <div className="workbench-sidebar workbench-sidebar--inspector">
    <section className="panel__section">{/* sessions */}</section>
    <section className="panel__section panel__section--server-health">{/* health */}</section>
    <section className="panel__section panel__section--command-history">{/* history */}</section>
  </div>
</aside>
```

- [x] **Step 3: Replace the current sidebar surfaces with editor-style list and rail styling**

Add shared sidebar language:

```css
.workbench-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--bg-sidebar);
}

.workbench-sidebar--explorer {
  border-right: 1px solid var(--border-soft);
}

.workbench-sidebar--inspector {
  border-left: 1px solid var(--border-soft);
  background: var(--bg-elevated);
}

.panel--right {
  grid-template-rows: 220px 210px minmax(0, 1fr);
}
```

- [x] **Step 4: Update session and SFTP row styling to feel more like an editor explorer**

Convert rows away from card feeling and toward workbench list states:

```css
.session-list,
.sftp-list {
  gap: 0;
}

.session-list__item,
.sftp-list__item {
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
}

.session-list__item:hover,
.sftp-list__item:hover {
  background: #232b36;
}

.session-list__item.is-selected,
.sftp-list__item.is-selected {
  background: #26374b;
  border-color: #37577c;
}
```

- [x] **Step 5: Unify right-rail section headers and list shells**

Apply one inspector rhythm across sessions, health, and history:

```css
.panel--right .panel__section {
  padding: 10px 12px;
  background: var(--bg-elevated);
}

.server-health-grid,
.command-history-panel__list-shell,
.panel--right .session-list {
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  background: var(--bg-panel-2);
}
```

- [x] **Step 6: Verify the sidebar reshape in the browser and with typecheck**

Run:

```powershell
pnpm run typecheck
```

Manual check at `http://localhost:5273`:

```text
Left side reads as an explorer, right side reads as a coordinated utility rail, and selection states remain obvious.
```

- [ ] **Step 7: Commit the sidebar reshape**

Run:

```powershell
git add src/renderer/App.tsx src/renderer/styles.css
git commit -m "feat: reshape sidebars into explorer and inspector rails"
```

Expected:

```text
Creates a commit containing the left/right structural and list-surface refresh.
```

---

### Task 3: Strengthen the terminal as the main stage

**Status:** Complete in workspace. Terminal tabs, the stage surface, and editor-focus treatment have been tightened to read more like the main editor stage. The commit step remains intentionally unchecked.

**Files:**
- Modify: `src/renderer/components/terminal-workspace.tsx:2335`
- Modify: `src/renderer/styles.css:2094`
- Modify: `src/renderer/styles.css:2265`
- Modify: `src/renderer/styles.css:2383`

- [x] **Step 1: Capture the terminal workspace markup and active styles**

Run:

```powershell
Get-Content src/renderer/components/terminal-workspace.tsx | Select-Object -Skip 2330 -First 220
Get-Content src/renderer/styles.css | Select-Object -Skip 2090 -First 340
```

Expected:

```text
Shows the terminal tab markup, tab action area, stage, pane, and editor-focus styling blocks.
```

- [x] **Step 2: Simplify terminal tab styling toward editor tabs**

Apply flatter, editor-like tabs:

```css
.terminal-tabs {
  gap: 0;
  padding: 0 10px;
  border-bottom: 1px solid var(--border-soft);
  background: #181d24;
}

.tab {
  border: 0;
  border-right: 1px solid var(--border-soft);
  border-radius: 0;
  background: transparent;
  color: var(--text-soft);
  padding: 10px 12px;
}

.tab.is-active {
  background: #1f2630;
  color: var(--text-main);
  box-shadow: inset 0 2px 0 var(--accent-strong);
}
```

- [x] **Step 3: Give the terminal stage a cleaner editor main area**

Reduce ornate framing and make the terminal the dominant surface:

```css
.panel--center {
  background: var(--bg-app);
}

.terminal-stage {
  background: var(--bg-terminal);
}

.terminal-pane {
  padding: 0;
}

.terminal-pane__canvas {
  width: 100%;
  height: 100%;
}
```

- [x] **Step 4: Restyle editor-focus mode so it still feels distinct without looking like a separate product**

Keep the editor-focus behavior, but harmonize the surface:

```css
.terminal-pane.is-editor-focus {
  padding: 10px;
}

.terminal-pane.is-editor-focus .terminal-pane__canvas {
  border: 1px solid var(--border-main);
  border-radius: 12px;
  background: #0f1318;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
}
```

- [x] **Step 5: Only adjust terminal-workspace JSX if the tabs need a dedicated workbench action region**

If current markup prevents the desired alignment, keep the same behavior and only rebalance the wrapper:

```tsx
<div className={isActiveEditorMode ? "terminal-tabs is-editor-focus" : "terminal-tabs"}>
  {tabs.map((tab) => (
    <button key={tab.id} className={tabClassName} type="button">
      <span>{tab.title}</span>
      <span className="tab__close">
        <X aria-hidden="true" className="ui-icon tab__close-icon" strokeWidth={2} />
      </span>
    </button>
  ))}
  <div className="terminal-tabs__actions">
    <button className="icon-button terminal-tabs__action" type="button">
      <History aria-hidden="true" className="ui-icon" strokeWidth={2} />
    </button>
  </div>
</div>
```

- [x] **Step 6: Validate terminal behavior and build safety**

Run:

```powershell
pnpm run typecheck
pnpm run build
pnpm run build:main
```

Manual check at `http://localhost:5273`:

```text
Terminal remains the dominant surface, tab switching still works, and editor focus mode still tightens the layout correctly.
```

- [ ] **Step 7: Commit the terminal stage refresh**

Run:

```powershell
git add src/renderer/components/terminal-workspace.tsx src/renderer/styles.css
git commit -m "feat: refresh terminal stage as editor workspace"
```

Expected:

```text
Creates a commit containing the tab, terminal, and editor-focus visual refresh.
```

---

### Task 4: Convert the transfer dock into a bottom workbench panel and finish verification

**Status:** Complete in workspace. The transfer dock now reads like a bottom workbench panel, the modal shell is aligned to the shared workbench chrome, and transfer-focused verification has passed. The commit step remains intentionally unchecked.

**Files:**
- Modify: `src/renderer/App.tsx:23695`
- Modify: `src/renderer/styles.css:155`
- Modify: `src/renderer/styles.css:172`
- Modify: `src/renderer/styles.css:279`
- Modify: `src/renderer/styles.css:3654`

- [x] **Step 1: Capture the transfer dock markup and existing styles**

Run:

```powershell
Get-Content src/renderer/App.tsx | Select-Object -Skip 23690 -First 120
Get-Content src/renderer/styles.css | Select-Object -Skip 150 -First 180
Get-Content src/renderer/styles.css | Select-Object -Skip 3648 -First 60
```

Expected:

```text
Shows the transfer dock header, queue panels, action buttons, and modal-settings shell blocks that need to align with the new panel language.
```

- [x] **Step 2: Reframe the transfer dock as a bottom panel with a toolbar-like header**

Adjust the dock shell and action area:

```css
.transfer-dock {
  margin: 0;
  border: 0;
  border-top: 1px solid var(--border-main);
  border-radius: 0;
  background: #181d24;
  box-shadow: none;
  padding: 8px 10px 10px;
  height: 208px;
}

.transfer-dock__heading {
  align-items: center;
  min-height: 32px;
}

.transfer-dock__heading-actions {
  gap: 6px;
}
```

- [x] **Step 3: Make upload/download areas read as bottom-panel panes rather than boxed cards**

Flatten the queue panes:

```css
.transfer-dock__grid {
  gap: 10px;
}

.transfer-dock__panel {
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  background: var(--bg-panel-2);
  padding: 8px;
}

.transfer-dock__action-button {
  width: auto;
  min-width: 112px;
  height: 24px;
  border-radius: 6px;
  font-size: 11px;
}
```

- [x] **Step 4: Bring the settings modal shell into the same workbench system**

Keep the same modal behavior but align its frame with the new shell:

```css
.modal {
  border: 1px solid var(--border-main);
  border-radius: 12px;
  background: var(--bg-elevated);
  box-shadow: var(--shadow-elevated);
}

.modal--settings .primary-button,
.modal--settings .secondary-button,
.modal--settings .icon-button {
  height: 24px;
  font-size: 11px;
}
```

- [x] **Step 5: Run full verification including transfer regression checks**

Run:

```powershell
pnpm run typecheck
pnpm run build
pnpm run build:main
node scripts/test-transfer-progress.mjs
pnpm run bench:transfer:local
```

Expected:

```text
All commands pass. Transfer benchmark still completes successfully, with no regression in the existing optimized upload/download paths.
```

- [x] **Step 6: Perform final UI acceptance pass**

Manual check at `http://localhost:5273`:

```text
The first impression is "editor workbench", the bottom area reads as a panel, the center terminal stays dominant, and the sidebars feel coordinated rather than card-stacked.
```

- [ ] **Step 7: Commit the bottom-panel pass and final work**

Run:

```powershell
git add src/renderer/App.tsx src/renderer/styles.css src/renderer/components/terminal-workspace.tsx
git commit -m "feat: restyle transfer dock as bottom workbench panel"
```

Expected:

```text
Creates the final implementation commit for the editor-workbench UI refresh.
```

---

## Self-Review

### Spec coverage

- Shell refresh: covered by Task 1
- Explorer/inspector hierarchy: covered by Task 2
- Terminal-first emphasis: covered by Task 3
- Bottom-panel transfer treatment: covered by Task 4
- Modal consistency: covered by Task 4
- Verification and regression safety: covered by Tasks 1, 3, and 4

### Placeholder scan

- No `TODO` or `TBD` placeholders remain
- Each task includes exact files, concrete snippets, and verification commands

### Type consistency

- Uses existing component/file names from the current renderer
- Keeps `App.tsx`, `styles.css`, and `terminal-workspace.tsx` as the primary edit surfaces
- Reuses existing verification commands already present in the repository
