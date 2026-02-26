# Kumo Zen Workspace UI/UX Upgrade Plan

> **Status:** Draft plan (no implementation in this document)
> **Scope:** `apps/web` workspace shell, navigation structure, and interaction model
> **Driver:** Introduce a calmer default UI with richer keyboard-first controls and Kumo-inspired visual structure

## Goals

1. Replace the current flat notes sidebar with a directory/tree-style navigation model built from `@cloudflare/kumo` primitives/components.
2. Adopt a Kumo-like full-length gridline/border aesthetic across shell regions (header, left nav, canvas, right utilities).
3. Make left and right sidebars collapsible while preserving a focused, zen default state.
4. Convert top-right header actions into subtle icon-first controls.
5. Keep all functionality summonable via keyboard shortcuts and command palette, with the right sidebar as an optional utility surface.

## Product Decisions Locked

- Directory/folder view is a **UI grouping layer managed by agents/workflows**, not a user-managed filesystem.
- Organization remains system-driven; users are not expected to drag/drop notes into folders.
- Initial note grouping should be adaptable to future agent-driven tags and classification metadata.
- Right utility sidebar includes:
  - Review section: `history`, `collections`, `contradictions`, `digest`.
  - Workspace controls: `theme toggle`, `font toggle`, `markdown edit/render toggle`, `download active note (.md)`.
  - Utility footer actions: `profile`, `settings`, `info` (extensible later).
- Layout behavior:
  - First visit: both sidebars visible.
  - After first interaction: restore last-used pane state.
- Iconography standard: **Lucide** for this pass.
- Responsive strategy: **mobile-first and PWA-oriented**, then desktop-specific enhancements.

## Offworld / Kumo Findings Used In This Plan

Based on Offworld reference `cloudflare-kumo.md`:

- Use semantic tokens (`bg-kumo-*`, `text-kumo-*`, `border-kumo-line`, `ring-kumo-line`) to keep automatic light/dark behavior intact.
- Use `CommandPalette`, `DropdownMenu`, `Tooltip`, `Surface`, `Collapsible`, and primitives (`separator`, `scroll-area`, `navigation-menu`, `accordion`) for accessible keyboard/focus behavior.
- Avoid `dark:` overrides and raw color classes; rely on Kumo token system.

Direct code references from the Kumo repo clone that informed this plan:

- `packages/kumo-docs-astro/src/components/Header.astro`: header uses full-width `border-b border-kumo-line` and split rail pattern (`border-r`) for structural calm.
- `packages/kumo-docs-astro/src/components/SidebarNav.tsx`: collapsible nav sections, keyboard search invocation, and token-first line/hover styling.
- `packages/kumo/src/components/collapsible/collapsible.tsx`: minimal-accessible collapsible semantics (`aria-expanded`, controlled open state).

## UX Direction

### Default Experience (Zen Mode)

- App opens with minimal chrome and maximum writing focus.
- Left directory and right utilities can both be collapsed.
- First load defaults to both sidebars visible; subsequent loads restore last-used layout.
- Keyboard actions are first-class:
  - `Cmd/Ctrl+K`: command palette.
  - `N`: new note.
  - `Cmd/Ctrl+\`: toggle left directory.
  - `Cmd/Ctrl+.`: toggle right utilities.
  - `Cmd/Ctrl+Shift+1`: focus left directory search.
  - `Cmd/Ctrl+Shift+2`: focus editor.

### Visible Structure

- Persistent full-height vertical separators between regions.
- Full-width horizontal separators for header and section boundaries.
- Subtle icon actions in header (tooltip-backed, no heavy button chrome by default).

### Mobile-First Behavior

- Mobile baseline is single-canvas priority with summonable drawers/panels for left and right sidebars.
- Keyboard-first affordances remain available where platform keyboards exist, while touch-first triggers stay visible.
- PWA-safe layout avoids brittle fixed heights and preserves scroll/focus behavior across virtual keyboard open/close.

## Information Architecture Changes

### Directory Tree Model

Introduce a UI-level note hierarchy model (backed by metadata, with flat-note fallback):

- `WorkspaceNode`
  - `id: string`
  - `type: "folder" | "note"`
  - `name: string`
  - `noteId?: string`
  - `parentId: string | null`
  - `children?: WorkspaceNode[]`
  - `updatedAt?: number`

### Behavior

- Tree supports expand/collapse, single active note selection, and inline filtering.
- Grouping is agent-led and non-manual; no drag/drop folder management in this initiative.
- If backend folder metadata is unavailable, infer pseudo-folders by heuristics (for example date buckets or tag prefixes) as a temporary adapter.
- Prepare adapter hooks for future tag-aware grouping once tagging is introduced.
- Keep existing note selection and note CRUD endpoints unchanged in Phase 1.

## Component Architecture Plan

### New/Updated Components

1. `apps/web/src/components/sidebar/notes-directory.tsx` (new)
  - Replaces `notes-sidebar.tsx` in workspace shell.
  - Uses Kumo `Input`, `Button`, `Collapsible`, and optional primitives (`ScrollArea`, `Separator`) for tree rendering.
  - Supports keyboard nav: arrows, Enter, Home/End, type-to-filter.

2. `apps/web/src/components/layout/workspace-grid-shell.tsx` (new or refactor of `app-shell.tsx`)
  - Three-column shell: left directory, center editor, right utilities.
  - Full-length line system via explicit border rails.
  - Collapsible left/right panes with persisted localStorage state.

3. `apps/web/src/components/workspace/right-utility-sidebar.tsx` (new)
  - Contains summonable functions in three stacked sections:
    - review surfaces (`history`, `collections`, `contradictions`, `digest`)
    - workspace controls (`theme`, `font`, `edit/render mode`, `download markdown`)
    - footer utilities (`profile`, `settings`, `info`)
  - Built with Kumo `Surface`, `DropdownMenu`, `Button`, `Tabs`/`Collapsible` where helpful.

4. `apps/web/src/components/workspace/workspace-shell.tsx` (update)
  - Orchestrates pane state, keyboard shortcut bindings, route navigation, and note data adapters.
  - Moves heavy top-right actions into Lucide icon-strip plus command palette.

5. `apps/web/src/components/command-palette.tsx` (update)
  - Add actions for toggling/focusing panes and jumping to utility sidebar sections.

6. `apps/web/src/components/note-editor.tsx` and `canvas-pane.tsx` (minor updates)
  - Ensure editor remains primary focus target in zen mode.
  - Keep current slash-command and autosave behavior intact.

## Visual System Plan (Gridline Aesthetic)

Add a shell-specific style layer in `apps/web/src/index.css`:

- Define layout utility classes:
  - `.workspace-grid`
  - `.workspace-rail-left`
  - `.workspace-main`
  - `.workspace-rail-right`
  - `.workspace-divider-v`
  - `.workspace-divider-h`
- Use tokenized borders (`border-kumo-line`) with `min-h-screen` continuity.
- Keep pane padding restrained; prioritize editorial whitespace in center pane.
- Introduce subtle hover/focus state, not heavy fill blocks.

## Keyboard-First Interaction Plan

1. Centralize shortcuts in workspace shell effect/hook.
2. Add pane focus management refs:
  - left search input ref
  - editor ref / run shortcut passthrough
  - right sidebar first actionable item ref
3. Register palette actions for all nav/workflow operations currently in header menu.
4. Ensure accessibility parity:
  - `aria-expanded` on collapse toggles
  - tooltips for icon-only actions
  - visible focus ring on keyboard focus
5. Keep mobile parity by exposing all keyboard actions through visible command/UI entry points.

## Data and API Considerations

### Phase 1 (UI-only, fast path)

- Keep existing `/api/notes` contract.
- Build `notes -> tree` adapter client-side.
- Persist expanded folder ids and collapsed pane states in localStorage.
- Add font preference and editor-mode preference persistence in localStorage.

### Phase 2 (optional backend support)

- Add server metadata for directory ordering and parent relationships.
- Update D1 schema and note lifecycle endpoints with `parentId` and ordering semantics.
- Add migration + optimistic UI reconciliation.

## Execution Plan

1. **Foundation:** Introduce `workspace-grid-shell` and tokenized divider classes without changing note behavior.
2. **Left Navigation:** Implement `notes-directory` tree with fallback adapter and parity for select/filter/loading/error states.
3. **Right Utilities:** Add collapsible right sidebar with review, controls, and footer utility sections.
4. **Header Refinement:** Replace text-heavy top-right buttons with Lucide icon actions + tooltips + dropdown overflow.
5. **Keyboard Expansion:** Add pane toggles/focus shortcuts and palette actions.
6. **Mobile/PWA Pass:** Validate drawer behavior, viewport/keyboard interactions, and touch target sizing.
7. **Polish:** Tune spacing/contrast/motion for calm default; validate keyboard and screen reader flow.

## Validation Plan

### Functional

- Note select/open/save/capture/archive behavior remains unchanged.
- Command palette actions still run navigation/workflow commands.
- Left/right collapse state persists across reloads.
- Edit/render mode, font, and theme controls work from right sidebar.
- Active note can be downloaded as markdown from right sidebar control.

### UX / Accessibility

- All icon actions have accessible names.
- Full keyboard traversal works in tree and sidebars.
- Focus states are visible and non-jarring in both modes.
- Mobile interaction remains complete without requiring physical keyboard shortcuts.

### Performance

- No regressions in initial route render or editor input latency.
- Tree filtering remains responsive with large note lists.

## Risks and Mitigations

1. **Conflict with existing design direction ("no folders")**
   - Mitigation: ship folder tree as a view layer first, with optional backend hierarchy later.
2. **Visual over-structuring hurting zen goal**
   - Mitigation: keep line contrast low and hide secondary chrome behind collapse/shortcuts.
3. **Keyboard shortcut collisions**
   - Mitigation: central shortcut registry + guard for typing targets.
4. **State sync complexity between index stream and UI tree**
   - Mitigation: single adapter function + deterministic sort/merge rules.
5. **Preference sprawl (theme/font/editor-mode/layout) causing inconsistency**
   - Mitigation: centralized preference store keys and hydration order in workspace shell.

## Deliverables

1. Updated shell/layout components with left/right collapsible rails.
2. Tree-based directory navigation component replacing current notes sidebar.
3. Icon-first header action strip with keyboard and tooltip accessibility.
4. Expanded command palette and shortcut registry.
5. Follow-up proposal (optional) for persisted backend folder semantics.
