# TermDock Editor Workbench UI Design

Date: 2026-05-01

## Goal

Refresh the TermDock desktop UI so it feels closer to a modern code editor workbench, specifically a VS Code-like dark workspace, while preserving the existing SSH, SFTP, transfer, and diagnostics capabilities.

The redesign should shift the product away from a "stacked operations dashboard" feel and toward a "developer workbench" feel. The terminal remains the primary stage. Side areas should read as editor sidebars and bottom panels rather than independent product cards.

## Design Direction

### Chosen direction

- Structure: editor-style reflow
- Visual language: Workbench Dark
- Risk profile: medium-scope UI refactor, low business-logic risk

### Product intent

The UI should communicate that TermDock is a focused developer tool for working inside remote systems, not a generic monitoring console. The interface should feel precise, calm, dense in a controlled way, and built for long sessions.

## Existing UI Summary

The current renderer is a custom Electron + React + CSS interface. The main UI is assembled in [App.tsx](/E:/AI/TermDock/src/renderer/App.tsx:22984), with terminal-specific behavior in [terminal-workspace.tsx](/E:/AI/TermDock/src/renderer/components/terminal-workspace.tsx:640), and the visual system concentrated in [styles.css](/E:/AI/TermDock/src/renderer/styles.css:1).

The current high-level structure is:

- Top shell / header
- Three-column main layout
- Left SFTP panel
- Center terminal workspace
- Right utility stack for sessions, health, and command history
- Bottom transfer dock
- Modal system for settings and managers

The current interface already has a dark, technical tone, but it leans heavily on boxed panels, glassy surfaces, and dense stacked modules. This creates a strong "operations console" impression and makes the main workbench hierarchy less clear than it should be.

## Target Architecture

### Shell

The app shell should become flatter, more workbench-like, and less card-heavy.

- Keep the dark theme
- Reduce decorative glass treatment
- Use steadier panel backgrounds and clearer separators
- Use a tighter editor-style spacing system
- Standardize border strength, radius, and title treatment

The shell should visually resemble an IDE frame rather than a dashboard canvas.

### Left sidebar

The left side should read as an Explorer area.

- Primary identity: remote file explorer
- Secondary identity: quick file actions and path navigation
- SFTP remains functionally unchanged
- The visual goal is to make remote file browsing feel closer to an editor file tree

This area should feel lighter and more navigational than the current "large functional card" treatment.

### Center workspace

The center must remain the dominant area.

- Terminal tabs should look more like editor tabs
- The terminal canvas should visually own the screen
- Editor focus mode should remain supported, but be restyled to fit the broader workbench system
- Decorative framing around the terminal should be reduced so the terminal itself remains the emphasis

This is the main product stage and should receive the clearest visual weight.

### Right sidebar

The right side should be unified into an Inspector / Utility sidebar.

- Sessions
- Server health
- Command history

These stay as separate functional sections, but should share a more consistent structural language:

- same title style
- same action row style
- same list shell language
- same section rhythm

The goal is for the right side to feel like one coordinated utility rail rather than three unrelated modules.

### Bottom panel

The transfer dock should be reframed as a bottom workbench panel.

- Upload queue
- Download queue
- Retry affordances
- Operation Center entry points

This area should feel more like an editor's bottom panel or drawer and less like a separate dashboard band. It should still expose active queue state clearly, but with less visual heaviness.

## Visual System

### Tone

The preferred tone is closer to VS Code's dark workbench than to a futuristic glass UI.

- dark neutral foundations
- cool blue accents used sparingly
- reduced glow
- cleaner separators
- more confident use of flat surfaces

### Spacing and density

Density should stay professional and information-rich, but it should be organized rather than cramped.

- slightly more breathing room between major regions
- tighter consistency in control sizing
- more deliberate title and section spacing
- clearer contrast between primary and secondary information

### Shape language

Rounded corners should remain, but be less soft and less decorative.

- moderate radius for tabs and panels
- smaller radius for utility controls
- fewer nested heavy containers

### Typography

Typography should reinforce the editor/workbench feel.

- shell and utility UI: modern sans UI stack
- dense metadata: readable but restrained sizing
- terminal: keep xterm behavior, but align surrounding tab/header language with editor expectations

## Component-Level Changes

### Top shell

- simplify header background treatment
- tighten metadata presentation
- make the shell read as an app chrome, not a hero banner

### Section headers

- unify heading weight, size, tracking, and action placement
- reduce variation between left, right, and bottom regions

### Session and SFTP list surfaces

- move toward explorer/list styling
- reduce standalone card feeling
- improve selected row contrast to feel closer to editor selection states

### Terminal tabs

- shift toward editor tab proportions and contrast
- keep active state clear
- preserve support for many open tabs and overflow

### Terminal canvas frame

- simplify frame treatment in normal mode
- keep focus mode distinct but less ornamental

### Bottom panel controls

- reorganize transfer actions so the panel header reads more like a panel toolbar
- keep retry and operation center access visible
- preserve quick queue scanning

### Modal system

The modal system is not the first visual priority, but it should follow the new workbench language so the product does not feel split between two design systems.

- align spacing, borders, buttons, and headers with the new shell
- especially update settings modal framing so it feels consistent with the new workbench design

## Data Flow and Behavior

This redesign is primarily presentational and structural. Existing data flow should remain intact.

- existing terminal lifecycle stays unchanged
- existing SFTP actions stay unchanged
- existing transfer queue behavior stays unchanged
- existing server health and command history behavior stays unchanged

The main implementation method should be:

- reorganize markup only where needed for clearer structure
- re-skin and re-space existing regions through CSS
- avoid coupling the visual redesign to business-logic refactors

## Error Handling and UX Safety

The redesign must not reduce visibility of important state.

- active transfer notices must remain easy to see
- reconnect and terminal status must stay legible
- health alert states must stay distinguishable
- destructive or risky actions must not lose contrast or discoverability

When visual simplification conflicts with operational clarity, operational clarity wins.

## Testing and Verification

Validation should focus on both appearance and regression safety.

### Functional verification

- `pnpm run typecheck`
- `pnpm run build`
- `pnpm run build:main`

### Existing transfer safety checks

- `node scripts/test-transfer-progress.mjs`
- `pnpm run bench:transfer:local`

### UI verification

- inspect the renderer at `http://localhost:5273`
- verify three-column workbench layout
- verify terminal remains dominant
- verify transfer panel reads as bottom panel
- verify editor focus mode still behaves correctly
- verify settings and key panels still remain usable on desktop and narrower widths

## Scope Boundaries

### In scope

- shell styling refresh
- layout hierarchy adjustment
- sidebar and bottom-panel visual restructuring
- terminal tab and canvas presentation updates
- consistency pass across major workbench surfaces

### Out of scope

- rewriting SSH or SFTP core logic
- changing transfer scheduling behavior
- redesigning settings information architecture in depth
- large state-management refactors
- feature additions unrelated to the visual/workbench refresh

## Acceptance Criteria

The redesign succeeds when:

- the first impression is "editor workbench" rather than "operations dashboard"
- the center terminal is the obvious primary stage
- the left and right regions feel like sidebars, not separate product slabs
- the bottom transfer area feels like a panel, not a second application band
- functional behavior remains intact and current verification still passes

## Implementation Recommendation

Execute this as a medium-scope renderer refactor focused on structure and styling. Prefer preserving component boundaries where possible, and use markup changes only when the current DOM prevents the intended workbench hierarchy from reading clearly.
