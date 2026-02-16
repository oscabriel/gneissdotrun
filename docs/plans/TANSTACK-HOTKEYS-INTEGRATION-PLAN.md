# TanStack Hotkeys Integration Plan (`apps/web`)

> **Status:** Draft
> **Owner:** Web app
> **Scope:** `apps/web` only

---

## Assumption

The request says **tanstack/keys**. The package in the TanStack ecosystem is **`tanstack/hotkeys`** (`@tanstack/react-hotkeys` for React). This plan targets that library.

---

## Background: What TanStack Hotkeys Provides

TanStack Hotkeys is a type-safe keyboard shortcut system for web apps with a React adapter.

Core capabilities relevant to us:

- **Type-safe shortcut strings** (`'Mod+K'`, `'N'`, `'Mod+Enter'`)
- **Cross-platform primary modifier** (`Mod` => Cmd on macOS, Ctrl on Windows/Linux)
- **Central registration model** (single manager, deterministic registration/unregistration)
- **Input-aware behavior controls** (`ignoreInputs`, `enabled`, `target`, `requireReset`)
- **Display formatting** (`formatForDisplay`) for platform-correct UI labels
- **SSR-safe behavior** (no document/window assumptions during SSR)

Notable caveat:

- Package is still early-stage (`0.1.x`), so we should isolate usage behind app-level helpers and avoid spreading raw API calls everywhere.

---

## Current State in `apps/web`

Keyboard behavior is currently split between manual global listeners and local `onKeyDown` handlers:

### Global listeners

1. `apps/web/src/components/command-palette.tsx`
   - `Cmd/Ctrl + K` opens palette
   - `Escape` closes palette
   - Implemented via `window.addEventListener('keydown', ...)`

2. `apps/web/src/components/workspace/workspace-shell.tsx`
   - Plain `N` opens blank canvas
   - Includes custom `isTypingTarget()` guard
   - Implemented via `window.addEventListener('keydown', ...)`

### Local handlers

3. `apps/web/src/components/note-editor.tsx`
   - `Cmd/Ctrl + Enter` submits interaction textarea

4. `apps/web/src/components/workspace/canvas-pane.tsx`
   - `Cmd/Ctrl + Enter` submits blank-capture textarea

5. `apps/web/src/components/search-bar.tsx`
   - `Enter` submits search input

### Current issues

- Hotkey logic is duplicated and decentralized.
- Global listeners are hand-rolled and independently managed.
- Display labels are hardcoded as `Cmd+...` while behavior also supports Ctrl.
- No centralized shortcut registry.
- No hotkey-specific tests.

---

## Migration Goals

1. Replace manual global hotkey listeners with `@tanstack/react-hotkeys`.
2. Centralize shortcut definitions and display labels.
3. Preserve existing UX behavior exactly (no shortcut changes in v1 migration).
4. Keep plain input Enter behavior (`SearchBar`) as-is unless explicitly moved.

## Non-goals

- No redesign of command palette UX.
- No new shortcut set in this migration.
- No cross-route/global shortcut expansion beyond current behavior.
- No server/API changes.

---

## Target Shortcut Registry (no behavior changes)

| Action                  | Current behavior                     | Target definition                          |
| ----------------------- | ------------------------------------ | ------------------------------------------ |
| Open command palette    | Cmd/Ctrl+K                           | `Mod+K`                                    |
| Close command palette   | Escape                               | `Escape`                                   |
| Open blank canvas       | `n` (no modifiers, not while typing) | `N` + `ignoreInputs: true`                 |
| Submit note interaction | Cmd/Ctrl+Enter                       | `Mod+Enter` scoped to interaction textarea |
| Submit blank capture    | Cmd/Ctrl+Enter                       | `Mod+Enter` scoped to blank textarea       |

---

## Implementation Plan (Discrete Tasks)

### Task 1 — Add dependency and baseline wiring

**Files**

- `apps/web/package.json`

**Changes**

- Add `@tanstack/react-hotkeys` dependency.

**Acceptance**

- Web workspace installs and typechecks with the new package.

---

### Task 2 — Add app-level hotkeys provider defaults

**Files**

- `apps/web/src/router.tsx`

**Changes**

- Wrap app tree with `HotkeysProvider` inside existing `Wrap` provider stack.
- Set conservative defaults aligned with existing behavior:
  - `hotkey.preventDefault: true`
  - `hotkey.stopPropagation: true`
  - `hotkey.requireReset: true`

**Acceptance**

- Existing app renders unchanged.
- Hotkey hooks can be used without per-component boilerplate.

---

### Task 3 — Create centralized shortcut definitions

**Files**

- `apps/web/src/lib/hotkeys/shortcuts.ts` (new)

**Changes**

- Add exported shortcut constants:
  - `OPEN_COMMAND_PALETTE = 'Mod+K'`
  - `CLOSE_COMMAND_PALETTE = 'Escape'`
  - `OPEN_BLANK_CANVAS = 'N'`
  - `SUBMIT_CAPTURE = 'Mod+Enter'`
- Add helper for display labels using `formatForDisplay`.

**Acceptance**

- No component hardcodes shortcut strings after migration.

---

### Task 4 — Migrate command palette global hotkeys

**Files**

- `apps/web/src/components/command-palette.tsx`

**Changes**

- Remove manual `window` keydown effect.
- Add `useHotkey` for:
  - open palette (`Mod+K`)
  - close palette (`Escape`, enabled only when open)

**Acceptance**

- `Cmd/Ctrl+K` opens palette.
- `Escape` closes palette when open.
- No direct `window.addEventListener` remains in this component.

---

### Task 5 — Migrate workspace blank-canvas shortcut

**Files**

- `apps/web/src/components/workspace/workspace-shell.tsx`

**Changes**

- Remove manual `window` keydown effect for `n`.
- Remove now-unused `isTypingTarget()` helper.
- Add `useHotkey('N', ...)` with `ignoreInputs: true`.

**Acceptance**

- Pressing `n` outside text-entry targets opens blank canvas.
- Pressing `n` while typing does nothing.
- No manual keydown listener remains in this component.

---

### Task 6 — Migrate `Cmd/Ctrl+Enter` submit handlers to scoped hotkeys

**Files**

- `apps/web/src/components/note-editor.tsx`
- `apps/web/src/components/workspace/canvas-pane.tsx`

**Changes**

- Add textarea refs for target-scoped registration.
- Replace local keyboard combo checks with `useHotkey('Mod+Enter', ...)` scoped to each textarea target.
- Keep IME-safe behavior (`isComposing` guard in callback logic).

**Acceptance**

- `Cmd/Ctrl+Enter` still submits in both textareas.
- No behavior regressions for composition input.

---

### Task 7 — Normalize shortcut labels in UI

**Files**

- `apps/web/src/components/workspace/workspace-shell.tsx`
- `apps/web/src/components/workspace/canvas-pane.tsx`
- `apps/web/src/components/note-editor.tsx`

**Changes**

- Replace hardcoded `Cmd+...` label text with `formatForDisplay(...)` output from shared shortcut constants.

**Acceptance**

- Labels show platform-correct shortcuts (Cmd on macOS, Ctrl on Windows/Linux).

---

### Task 8 — Keep SearchBar Enter handling unchanged (explicitly)

**Files**

- `apps/web/src/components/search-bar.tsx`

**Changes**

- No migration in this phase.
- Document reason in code comment: plain input Enter submit is local form behavior, not global hotkey behavior.

**Acceptance**

- Search input Enter behavior remains exactly as-is.

---

### Task 9 — Add focused regression tests for migrated shortcuts

**Files**

- `apps/web/src/components/command-palette.test.tsx` (new)
- `apps/web/src/components/workspace/workspace-shell.test.tsx` (new)
- `apps/web/src/components/note-editor.test.tsx` (new)
- `apps/web/src/components/workspace/canvas-pane.test.tsx` (new)

**Changes**

- Add keyboard interaction tests for:
  - `Mod+K` open
  - `Escape` close
  - `N` behavior with/without typing target
  - `Mod+Enter` submit behavior in both textareas

**Acceptance**

- Tests pass and prove no regression against current shortcuts.

---

## Suggested Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8
9. Task 9

This ordering minimizes risk: establish provider/constants first, then migrate one hotkey surface at a time.

---

## Verification

From repo root:

- `bunx turbo -F web typecheck`
- `bunx turbo -F web build`
- Run web tests after Task 9 (or targeted test command for `apps/web` if available in workspace scripts).

Manual verification matrix:

- macOS: Cmd+K, Cmd+Enter, Escape, N behavior in and out of inputs
- Windows/Linux: Ctrl+K, Ctrl+Enter, Escape, N behavior in and out of inputs

---

## Risks and Mitigations

### Risk: Upstream API churn (pre-1.0 package)

- **Mitigation:** Centralize shortcut constants and keep hotkey hook usage constrained to a few components.

### Risk: Input focus regressions

- **Mitigation:** Explicit `ignoreInputs` usage and targeted tests for text-entry surfaces.

### Risk: Duplicate bindings during migration

- **Mitigation:** Migrate component-by-component and remove old listeners in the same commit.

---

## Definition of Done

- No manual global `window` keydown listeners remain for workspace/palette hotkeys.
- Existing shortcut behavior is preserved.
- Shortcut labels are platform-aware.
- Hotkey behavior is covered by focused component tests.
- `apps/web` typechecks and builds cleanly.
