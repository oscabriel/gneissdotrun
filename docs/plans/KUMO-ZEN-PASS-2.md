# Kumo Zen Workspace — Pass 2 Plan

> **Status:** Draft plan (no implementation in this document)
> **Scope:** `apps/web` — shell layout, sidebar behavior, file tree, right utility rail
> **Builds on:** Pass 1 (workspace-grid-shell, notes-directory, right-utility-sidebar, keyboard shortcuts, command palette)

## Current-State Problems (from screenshot review)

1. **Outer "Gneiss" header + tagline** still sits above the workspace grid, eating vertical space and adding a non-functional chrome layer.
2. **Top-right icon strip** (new note, toggle left, toggle right, theme, profile) duplicates controls that should live inside each sidebar rail.
3. **Grid system** uses a padded flex container (`px-3 py-3`, `max-w-[120rem]`) instead of the fixed-rail + sliding-panel pattern the Kumo docs-astro site uses.
4. **Left sidebar** is conditionally rendered (`{!leftCollapsed ? … : null}`), so collapse/expand is an instant mount/unmount — no slide animation, no persistent rail icon.
5. **Right sidebar** is wide (`max-w-[22rem]`) with full text labels; should be a thin icon-only strip.
6. **File tree** uses generic Kumo `Button` rows for each tree item; needs a purpose-built tree component with proper indentation, chevron rotation, and keyboard nav.

## Kumo Docs-Astro Reference Patterns

Source: `packages/kumo-docs-astro` in the `cloudflare/kumo` clone.

### Fixed Rail + Sliding Panel (SidebarNav.tsx, MainLayout.astro)

```
┌──────────────────────────────────────────────┐
│  12px rail (fixed, always visible)           │
│  ┌─────────────────────────────────────────┐ │
│  │  Sliding panel (w-64, translate-x)      │ │
│  │  border-r border-kumo-line              │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  Main content margin-left via CSS :has()     │
│    sidebar open  → ml = 48px + 256px = 304px │
│    sidebar closed → ml = 48px                │
└──────────────────────────────────────────────┘
```

Key details:
- Rail is `fixed inset-y-0 left-0 w-12 bg-kumo-elevated border-r border-kumo-line`.
- Rail contains a toggle button (KumoMenuIcon) inside a `h-12 border-b` top cell.
- Panel is `fixed inset-y-0 left-12 w-64` with `transition-transform duration-300 ease-out will-change-transform`. Open = `translate-x-0 border-r`, closed = `-translate-x-full`.
- Panel has a blank `h-12 border-b` spacer so it visually aligns with the header row.
- Main content uses `transition-[margin] duration-300` and CSS `:has(aside[data-sidebar-open="true/false"])` to smoothly shift.

### Header (Header.astro)

- `sticky top-0 z-10 h-12 border-b border-kumo-line bg-kumo-elevated`.
- Split into a flex content area (with `border-r`) and a 12px-wide right cell for theme toggle.
- Hidden on mobile (`hidden md:flex`); mobile uses a fixed top bar inside SidebarNav.

### Mobile (SidebarNav.tsx)

- Fixed top bar: `fixed inset-x-0 top-0 h-12 border-b border-kumo-line bg-kumo-elevated md:hidden`.
- Slide-out drawer: `fixed inset-y-0 left-0 w-72 transition-transform duration-300`.
- Toggled via translate (`translate-x-0` / `-translate-x-full`).

---

## Plan

### 1. Remove Outer Shell

**What:** Delete the `<header>` block (lines 997–1069 in `workspace-shell.tsx`) that renders the "Gneiss" title, tagline, and top-right icon strip. Remove the `header` prop from `WorkspaceGridShell`.

**Why:** The workspace grid _is_ the app. No outer chrome needed; all controls move into their respective sidebar rails.

**Files:**
- `workspace-shell.tsx` — remove header JSX + `header` prop usage.
- `workspace-grid-shell.tsx` — remove `header` prop/slot and the `<header>` wrapper; layout starts directly with the rail/main/rail row.

### 2. Adopt Fixed-Rail + Sliding-Panel Grid (Kumo Pattern)

**What:** Rewrite `workspace-grid-shell.tsx` to match the Kumo docs-astro layout model:

- **Left rail:** `fixed inset-y-0 left-0 w-12 bg-kumo-elevated border-r border-kumo-line` — always visible on desktop. Contains a toggle icon button at the top (`h-12 border-b` cell).
- **Left panel:** `fixed inset-y-0 left-12 w-64 bg-kumo-elevated` — slides in/out with `transition-transform duration-300`. Renders `leftRail` content (notes directory). Has a `data-sidebar-open` attribute for CSS `:has()` detection.
- **Right rail:** `fixed inset-y-0 right-0 w-12 bg-kumo-elevated border-l border-kumo-line` — always visible on desktop. Contains a toggle icon button at the top and stacked icon buttons below for utility actions.
- **Right panel:** (future, not this pass) — could slide out a wider detail panel for review surfaces. For now the right rail is icon-only.
- **Main content:** `transition-[margin] duration-300` with CSS `:has()` rules to set `margin-left` (48px or 304px) and `margin-right` (48px) based on panel open states.

**Why:** Matches the Kumo visual system exactly. The fixed-rail pattern keeps the toggle always accessible, and the translate animation is smoother than conditional rendering.

**CSS `:has()` rules** (added to `index.css`):

```css
@media (min-width: 1024px) {
  body:has(aside[data-left-sidebar-open="true"]) .workspace-main {
    margin-left: 304px; /* 48px rail + 256px panel */
  }
  body:has(aside[data-left-sidebar-open="false"]) .workspace-main {
    margin-left: 48px;
  }
}
```

**Files:**
- `workspace-grid-shell.tsx` — full rewrite to fixed-rail pattern.
- `index.css` — replace `.workspace-grid`, `.workspace-rail-left`, `.workspace-rail-right` classes with `:has()`-based margin rules.

### 3. Left Sidebar: Rail Icon + Sliding Panel

**What:**

- The left **rail** (`w-12`) renders:
  - Top cell (`h-12 border-b border-kumo-line`): A branded icon/logo button that toggles the panel open/closed (like KumoMenuIcon). Use a simple Lucide `PanelLeftClose`/`PanelLeftOpen` or a custom Gneiss glyph.
- The left **panel** (`w-64`) renders:
  - A blank `h-12 border-b` spacer to align with the rail top cell.
  - The `NotesDirectory` tree below the spacer.
- Panel slides via `translate-x-0` (open) / `-translate-x-full` (closed) with `duration-300 ease-out`.
- Store `data-left-sidebar-open="true|false"` on the panel `<aside>` for CSS `:has()` targeting.

**Files:**
- `workspace-grid-shell.tsx` — left rail + panel structure.
- `workspace-shell.tsx` — pass `leftCollapsed` / `onToggleLeft` to grid shell (already exists, just wiring).

### 4. Right Sidebar: Thin Icon-Only Rail

**What:** Redesign the right sidebar from a wide labeled list to a thin icon-only rail.

- **Rail** (`w-12`, `fixed inset-y-0 right-0`):
  - Top cell (`h-12 border-b`): Toggle icon (e.g. `PanelRightClose`) to collapse/expand.
  - Below: stacked icon buttons with tooltips, separated by `border-b` dividers between groups.
  - **Group 1 (review):** History, Collections, Contradictions, Digest.
  - **Group 2 (workspace controls):** Theme toggle, Font toggle, Markdown mode toggle, Download note.
  - **Group 3 (new note):** Plus icon — moved here from the old header.
  - **Footer (pushed to bottom with `mt-auto`):** Profile, Settings, Info.
- All buttons are `shape="square"` with Kumo `Tooltip` for accessible labels.
- No sliding panel for right side in this pass — the rail _is_ the full sidebar.
- When collapsed, the right rail hides entirely (or stays as a very thin line — TBD based on feel; start with full hide for symmetry with left).

**Actually — revision:** Since the right sidebar is icon-only and already thin (`w-12`), there's no sliding panel to toggle. The "collapse" toggle should simply hide/show the rail itself. This differs from the left side. Keep this simple: collapsed = rail hidden, `margin-right: 0`; expanded = rail visible, `margin-right: 48px`.

**Files:**
- `right-utility-sidebar.tsx` — rewrite to vertical icon stack, remove all text labels, add tooltips.
- `workspace-grid-shell.tsx` — right rail structure.
- `workspace-shell.tsx` — move `onCreateNote` into right rail props; remove new-note from old header.

### 5. Custom File Tree Component

**What:** Replace the current `NotesDirectory` tree rendering (which uses flat `Button` rows with manual indentation) with a purpose-built tree component.

Design:
- `<FileTree>` wrapper: `role="tree"`, `tabIndex={0}`, handles keyboard nav (Arrow Up/Down, Left/Right for collapse/expand, Home/End, Enter to select, type-ahead filter).
- `<FileTreeFolder>`: renders a row with a rotating chevron (`ChevronRight` → rotates 90° on open), folder name, note count badge. Click or Enter toggles expand/collapse.
- `<FileTreeItem>`: renders a note row with subtle `·` or `FileText` icon, title (truncated), and updated-date subtext. Click or Enter selects the note.
- Indentation via `padding-left` scaled by `depth * 12px` (or a CSS variable `--tree-depth`).
- Styling: `hover:bg-kumo-tint`, `aria-selected` → `bg-kumo-tint ring-1 ring-kumo-line`, focus ring via `ring-kumo-ring`.
- Chevron animation: `transition-transform duration-200 rotate-0` → `rotate-90`.
- Scroll container: `overflow-y-auto` with `overscroll-contain`.

This component lives in `apps/web/src/components/sidebar/file-tree.tsx` and is consumed by `notes-directory.tsx`.

**Files:**
- `file-tree.tsx` (new) — `FileTree`, `FileTreeFolder`, `FileTreeItem` components.
- `notes-directory.tsx` — refactor to use `<FileTree>` instead of inline `Button` row mapping.

### 6. Mobile Adaptation

**What:** Keep the existing mobile drawer pattern but adapt it to the new structure:

- Mobile header: `fixed inset-x-0 top-0 h-12 border-b bg-kumo-elevated lg:hidden` with hamburger (left drawer toggle) and a right-side icon (right rail toggle).
- Left drawer: `fixed inset-y-0 left-0 w-72 transition-transform duration-300` with the same NotesDirectory content.
- Right drawer: `fixed inset-y-0 right-0 w-12 transition-transform duration-300` — the icon rail, same as desktop.
- Overlay backdrop when either drawer is open.

**Files:**
- `workspace-grid-shell.tsx` — mobile sections.

### 7. Keyboard Shortcuts (no change)

All existing shortcuts remain:
- `Cmd/Ctrl+\`: toggle left panel.
- `Cmd/Ctrl+.`: toggle right rail.
- `Cmd/Ctrl+K`: command palette.
- `N`: new note (when not in typing target).
- `Cmd/Ctrl+Shift+1`: focus left directory search.
- `Cmd/Ctrl+Shift+2`: focus editor.

No new shortcuts needed. Wiring already exists in `workspace-shell.tsx`.

---

## Execution Order

1. **Grid shell rewrite** — `workspace-grid-shell.tsx` + `index.css` `:has()` rules. Fixed left rail + sliding panel, fixed right rail, main content with margin transitions. Remove header prop.
2. **Workspace shell cleanup** — `workspace-shell.tsx`: remove header JSX, wire new grid shell props, move new-note to right rail.
3. **Right utility rail** — `right-utility-sidebar.tsx`: rewrite to icon-only vertical stack with tooltips.
4. **File tree** — `file-tree.tsx` (new), `notes-directory.tsx` refactor.
5. **Mobile pass** — mobile header + drawers in grid shell.
6. **Polish** — spacing, transitions, dark/light validation, keyboard/screen-reader flow.

## Validation

- `bunx turbo -F web typecheck` passes.
- `bunx turbo -F web build` passes.
- Existing tests pass (`bun test apps/web`).
- Visual: no outer header/tagline; left sidebar slides in/out from fixed rail; right sidebar is thin icon-only strip; file tree has chevrons and proper indentation.
- Keyboard: all shortcuts still work; tree is navigable with arrows/Enter.
- Mobile: drawers slide in/out with backdrop overlay.

## Risks

1. **CSS `:has()` browser support** — supported in all modern browsers (Chrome 105+, Safari 15.4+, Firefox 121+). Acceptable for this app's audience.
2. **Fixed positioning conflicts** — command palette and toast overlays must have higher `z-index` than sidebar rails. Verify z-index stack: rails (z-40/z-50), palette (z-50+), toasts (z-50+).
3. **Transition jank** — `will-change-transform` on sliding panels, `transition-[margin]` on main content. Test at 60fps.
