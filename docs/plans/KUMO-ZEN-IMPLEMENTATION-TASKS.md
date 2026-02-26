# Kumo Zen Workspace UI/UX Upgrade: Implementation Tasks

> **Status:** Draft task list
> **Scope:** `apps/web` workspace shell, navigation structure, and interaction model
> **Driver:** Introduce a calmer default UI with richer keyboard-first controls and Kumo-inspired visual structure

---

## Phase 1: Zen Workspace UX Overhaul (Kumo + Mobile-First)

Reference: `docs/plans/KUMO-ZEN-WORKSPACE-UX-PLAN.md`

### 1.1 Product Decisions (Locked)

- [ ] Treat directory/folder UI as agent-managed grouping only (no manual drag/drop file management).
- [ ] Keep organization logic system-driven; design adapter for future tag-aware grouping.
- [ ] Right sidebar includes three sections:
  - [ ] Review: history, collections, contradictions, digest.
  - [ ] Workspace controls: theme, font, markdown edit/render mode, download active note as `.md`.
  - [ ] Utility footer: profile, settings, info.
- [ ] Layout behavior: first visit shows both sidebars; subsequent visits restore last-used state.
- [ ] Standardize iconography to Lucide for this initiative.
- [ ] Maintain mobile-first and PWA-oriented interaction baseline.

### 1.2 File-by-File Implementation Checklist

#### Shell + Layout

- [ ] Create `apps/web/src/components/layout/workspace-grid-shell.tsx` for 3-region layout with full-height vertical rails and header divider.
- [ ] Update or deprecate `apps/web/src/components/layout/app-shell.tsx` usage in workspace route flow.
- [ ] Update `apps/web/src/components/workspace/workspace-shell.tsx` to orchestrate left/right panel collapse state and first-visit defaults.
- [ ] Add localStorage preference hydration/persistence in `workspace-shell.tsx` for:
  - [ ] left panel collapsed
  - [ ] right panel collapsed
  - [ ] font mode
  - [ ] markdown edit/render mode

#### Left Sidebar (Directory Grouping)

- [ ] Add `apps/web/src/components/sidebar/notes-directory.tsx` (new) built from Kumo primitives/components.
- [ ] Implement notes -> grouped tree adapter in `workspace-shell.tsx` or `apps/web/src/lib/*` helper module.
- [ ] Keep parity for loading/error/empty/filter/selection behavior currently in `apps/web/src/components/sidebar/notes-sidebar.tsx`.
- [ ] Wire keyboard navigation for tree list (arrow keys, Enter, Home/End).
- [ ] Preserve existing note selection route integration in `apps/web/src/routes/index.tsx`.

#### Right Sidebar (Utilities)

- [ ] Create `apps/web/src/components/workspace/right-utility-sidebar.tsx` with three sections (review, controls, utility footer).
- [ ] Add review-route launchers to `right-utility-sidebar.tsx`:
  - [ ] `/history`
  - [ ] `/collections`
  - [ ] `/contradictions`
  - [ ] `/digest`
- [ ] Add workspace controls in `right-utility-sidebar.tsx` + shell/editor wiring:
  - [ ] theme toggle integration with existing `data-mode` + `theme` localStorage
  - [ ] font toggle tied to CSS class/data attr strategy in `apps/web/src/index.css`
  - [ ] markdown edit/render toggle surfaced in `apps/web/src/components/workspace/canvas-pane.tsx` and/or `apps/web/src/components/note-editor.tsx`
  - [ ] download active note as markdown action from current selected note state
- [ ] Add footer utility actions for profile/settings/info destinations.

#### Header + Iconography

- [ ] Replace text-heavy top-right workspace action buttons in `apps/web/src/components/workspace/workspace-shell.tsx` with subtle icon actions.
- [ ] Standardize action icons to Lucide usage across:
  - [ ] `workspace-shell.tsx`
  - [ ] `command-palette.tsx` (if item icon affordances are added)
  - [ ] any new sidebar control/action buttons
- [ ] Add Kumo tooltip wrappers and accessible labels for icon-only controls.

#### Editor + Canvas Integration

- [ ] Extend `apps/web/src/components/workspace/canvas-pane.tsx` to support markdown view mode switching.
- [ ] Update `apps/web/src/components/note-editor.tsx` to support explicit edit/render mode handoff without breaking autosave/slash-run flow.
- [ ] Keep `Run` workflow and external command execution behavior unchanged.

#### Command Palette + Keyboard

- [ ] Extend `apps/web/src/components/command-palette.tsx` actions for:
  - [ ] toggle left sidebar
  - [ ] toggle right sidebar
  - [ ] focus directory search
  - [ ] focus editor
  - [ ] open right-sidebar sections
- [ ] Add workspace-level shortcut registration in `workspace-shell.tsx` with typing-target guards.
- [ ] Ensure every critical keyboard action has a visible touch/click equivalent for mobile parity.

#### Styling + Theming

- [ ] Add workspace gridline classes in `apps/web/src/index.css`:
  - [ ] `.workspace-grid`
  - [ ] `.workspace-rail-left`
  - [ ] `.workspace-main`
  - [ ] `.workspace-rail-right`
  - [ ] `.workspace-divider-v`
  - [ ] `.workspace-divider-h`
- [ ] Keep Kumo semantic token usage (`bg-kumo-*`, `text-kumo-*`, `border-kumo-line`, `ring-kumo-line`); avoid raw color classes.
- [ ] Add font-mode CSS strategy (for example body data attr or utility class toggle) without regressing existing typography defaults.

#### Routes + Root Document

- [ ] Verify `apps/web/src/routes/index.tsx` keeps noteId URL sync and new shell props.
- [ ] Verify `apps/web/src/routes/__root.tsx` theme boot script remains source of truth for initial mode hydration.

#### Backend/API Touchpoints (Only If Needed)

- [ ] Keep `apps/server/src/index.ts` note APIs unchanged for Phase 7 baseline.
- [ ] Only introduce server changes if markdown download or grouping metadata requires new endpoints.

### 1.3 Suggested PR Slices

- [ ] **PR 1: Shell Foundation + Gridlines**
  - Files: `workspace-shell.tsx`, `workspace-grid-shell.tsx` (new), `app-shell.tsx` (refactor/deprecate), `index.css`.
  - Outcome: 3-region layout, collapsible rails, divider aesthetic, persisted panel state.

- [ ] **PR 2: Directory Sidebar Replacement**
  - Files: `notes-directory.tsx` (new), `notes-sidebar.tsx` (retire or adapter), `workspace-shell.tsx`, optional grouping helper module.
  - Outcome: tree/grouped navigation with selection/filter parity.

- [ ] **PR 3: Right Utility Sidebar + Controls**
  - Files: `right-utility-sidebar.tsx` (new), `workspace-shell.tsx`, `canvas-pane.tsx`, `note-editor.tsx`, `index.css`.
  - Outcome: review surfaces + theme/font/mode/download + utility footer.

- [ ] **PR 4: Header Icon Pass + Lucide Standardization**
  - Files: `workspace-shell.tsx`, `command-palette.tsx`, any shared action button helpers.
  - Outcome: subtle icon-driven top-right actions with tooltips and accessibility labels.

- [ ] **PR 5: Keyboard + Palette Expansion + Mobile Parity**
  - Files: `command-palette.tsx`, `workspace-shell.tsx`, any sidebar focus refs/hooks.
  - Outcome: full summonable UX via keyboard and touch-equivalent controls.

- [ ] **PR 6: QA + Regression Sweep**
  - Files: targeted `apps/web/src/__tests__/*` additions/updates.
  - Outcome: confidence for note CRUD/capture/editor parity, layout persistence, and a11y basics.

### 1.4 Verification Checklist

- [ ] Run `bun --filter web run typecheck`.
- [ ] Run `bun --filter web run build`.
- [ ] Run targeted web tests for updated workspace components.
- [ ] Manually validate desktop + mobile viewport behavior.
- [ ] Manually validate PWA install context (viewport/virtual keyboard behavior, no blocked core actions).
