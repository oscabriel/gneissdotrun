# Markdown Editor Reset Migration Plan

> **Status:** Proposed  
> **Scope:** `apps/web`, `apps/server`, `packages/editor-core`, `packages/editor-pm`, `packages/api`, repo docs/tests  
> **Goal:** Tear down the current hybrid markdown editor and replace it with a markdown-canonical architecture built from `Source` mode (CodeMirror) and `Rich` mode (TipTap).

---

## 1) Summary

This is not an incremental migration.

We are deleting the hybrid system and rebuilding the editor stack around a simpler model:

1. canonical note content is markdown
2. `Source` mode edits raw markdown in CodeMirror
3. `Rich` mode edits a supported subset in TipTap
4. unsupported or lossy notes stay in `Source` mode

---

## 2) Package-Level Actions

| Package / Area         | Action                                  | Result                                       |
| ---------------------- | --------------------------------------- | -------------------------------------------- |
| `packages/editor-pm`   | Delete                                  | Hybrid PM runtime removed entirely           |
| `packages/editor-core` | Replace with `packages/editor-markdown` | Markdown-domain package only                 |
| `apps/web`             | Rebuild editor components               | Explicit source/rich editor shell            |
| `packages/api`         | Keep                                    | Slash-command parsing remains markdown-first |
| `apps/server`          | Keep prompt behavior                    | Agents continue to emit markdown             |

---

## 3) Hard Deletes

Delete these outright.

### 3.1 Delete the hybrid editor package

- `packages/editor-pm/`

This includes all extensions, tests, adapters, styles, and support files under that workspace.

### 3.2 Delete the PM wrapper in web

- `apps/web/src/components/pm-markdown-editor.tsx`
- `apps/web/src/components/pm-markdown-editor.test.ts`
- `apps/web/src/components/pm-markdown-editor.test.tsx`

### 3.3 Delete dead behavior-engine code from shared editor-core

- `packages/editor-core/src/behaviors/`
- `packages/editor-core/src/behaviors.test.ts`
- `packages/editor-core/src/behaviors-integration.test.ts`

### 3.4 Delete obsolete editor styling

Remove PM-specific styling from `apps/web/src/index.css`, including selectors for:

- `.pm-slash-command-box`
- `.pm-rollover-*`
- `.pm-fake-selection`
- `.shiki-token`

### 3.5 Delete obsolete planning docs

- `docs/plans/MARKDOWN-EDITOR-GAP-REMEDIATION-PLAN.md`

---

## 4) Rebuild Package Structure

### 4.1 Create `packages/editor-markdown`

This replaces `packages/editor-core`.

#### Keep / move into the new package

- canonical document model from `packages/editor-core/src/model/document.ts`
- markdown parse from `packages/editor-core/src/markdown/parse.ts`
- markdown serialize from `packages/editor-core/src/markdown/serialize.ts`
- markdown types from `packages/editor-core/src/markdown/types.ts`
- markdown converters from `packages/editor-core/src/model/converters/markdown.ts`
- markdown fixtures and roundtrip tests

#### Add new modules

- `src/rich-support.ts`
- `src/slash-safety.ts`

#### New package responsibilities

- parse markdown into canonical form
- serialize canonical form back to markdown
- report unsupported markdown constructs
- determine whether a note is safe for rich editing
- determine whether slash-command lines should block rich mode

### 4.2 Do not recreate `editor-pm`

TipTap runtime integration should live in `apps/web` unless a second consumer proves extraction is warranted.

---

## 5) New App Architecture

Create these new files in `apps/web`.

### 5.1 New components

- `apps/web/src/components/note-content-editor.tsx`
- `apps/web/src/components/markdown-source-editor.tsx`
- `apps/web/src/components/rich-text-editor.tsx`

### 5.2 New editor helpers

- `apps/web/src/lib/editor/tiptap-adapter.ts`
- `apps/web/src/lib/editor/tiptap-extensions.ts`
- `apps/web/src/lib/editor/editor-mode.ts`

### 5.3 Existing components to keep

- `apps/web/src/components/note-editor.tsx`
- `apps/web/src/components/markdown-preview.tsx`

### 5.4 Existing components to refactor

- `apps/web/src/components/workspace/workspace-shell.tsx`
- `apps/web/src/components/workspace/canvas-pane.tsx`
- `apps/web/src/components/workspace/right-utility-sidebar.tsx`

---

## 6) Target Behavior

### 6.1 Canonical content

`noteContent` remains a markdown string everywhere in `NoteEditor`.

### 6.2 `Source` mode behavior

- CodeMirror edits raw markdown directly
- no markdown parsing on every keystroke
- full fidelity for agent output
- slash commands remain ordinary text lines

### 6.3 `Rich` mode behavior

- TipTap imports from markdown when rich mode opens
- TipTap exports markdown back into canonical state on change or save
- supports only the approved markdown subset
- does not display markdown symbols as decorations
- does not emulate markdown typing or paste behavior

### 6.4 Mode gating

Before entering rich mode, run safety analysis.

If any of the following are present, block rich mode and stay in source mode:

- unsupported markdown nodes
- raw HTML or other lossy constructs
- slash-command lines pending execution
- any canonical content we cannot round-trip safely through rich mode

---

## 7) Phase Plan

## Phase A - Delete The Old System

### A.1 Remove the old workspaces and files

**Files / Paths**

- `packages/editor-pm/`
- `apps/web/src/components/pm-markdown-editor.tsx`
- `apps/web/src/components/pm-markdown-editor.test.ts`
- `apps/web/src/components/pm-markdown-editor.test.tsx`
- `packages/editor-core/src/behaviors/`
- `packages/editor-core/src/behaviors.test.ts`
- `packages/editor-core/src/behaviors-integration.test.ts`

**Acceptance**

- No imports from `@gneissdotrun/editor-pm` remain.
- No behavior-engine exports remain in `packages/editor-core/src/index.ts`.
- Typecheck does not reference deleted files.

---

## Phase B - Create The New Markdown Package

### B.1 Replace `editor-core` with `editor-markdown`

**Changes**

- rename workspace package to `@gneissdotrun/editor-markdown`
- keep only markdown-domain logic
- delete all behavior-engine exports
- update import sites in the repo

**Acceptance**

- Repo has one shared editor-domain package: markdown only.
- No shared package contains TipTap or CodeMirror runtime code.

### B.2 Add rich-mode safety analysis

**New Files**

- `packages/editor-markdown/src/rich-support.ts`
- `packages/editor-markdown/src/slash-safety.ts`

**Changes**

- expose helpers like:
  - `analyzeRichModeSupport(markdown)`
  - `hasPendingSlashCommands(markdown)`
  - `isLossyForRichMode(markdown)`

**Acceptance**

- The web app can decide whether a note may enter rich mode.
- Reasons for a rich-mode block are explicit and testable.

---

## Phase C - Build Source Mode

### C.1 Add CodeMirror source editor

**New File**

- `apps/web/src/components/markdown-source-editor.tsx`

**Changes**

- use CodeMirror 6 with markdown language support
- controlled by markdown string value
- expose `onChangeMarkdown`, `onBlur`, and `focus()` behavior
- preserve exact text typed by users or agents

**Acceptance**

- Source mode edits raw markdown with no transformations.
- Agent-written markdown remains unchanged unless the user edits it.

---

## Phase D - Build Rich Mode

### D.1 Add a minimal TipTap adapter

**New Files**

- `apps/web/src/lib/editor/tiptap-adapter.ts`
- `apps/web/src/lib/editor/tiptap-extensions.ts`

**Changes**

- convert canonical markdown package output into TipTap JSON
- convert TipTap JSON back into canonical markdown
- support only the approved rich subset

**Acceptance**

- Rich mode loads safe markdown notes.
- Rich edits serialize back to valid markdown.

### D.2 Add rich editor component

**New File**

- `apps/web/src/components/rich-text-editor.tsx`

**Changes**

- standard TipTap editor
- no delimiter rendering
- no markdown shortcuts emulation
- no source projection
- no fake selection

**Acceptance**

- Rich mode behaves like a normal rich-text editor.
- The component is materially smaller than the deleted `PmMarkdownEditor`.

---

## Phase E - Wire The New Mode Shell

### E.1 Create editor shell

**New File**

- `apps/web/src/components/note-content-editor.tsx`

**Changes**

- selects between `Source`, `Rich`, and optional `Preview`
- gates rich mode through `analyzeRichModeSupport()`
- provides shared focus and blur behavior

**Acceptance**

- One component owns all editor-surface switching.
- `NoteEditor` no longer knows about TipTap-specific details.

### E.2 Update note editor integration

**Files**

- `apps/web/src/components/note-editor.tsx`
- `apps/web/src/components/workspace/workspace-shell.tsx`
- `apps/web/src/components/workspace/canvas-pane.tsx`
- `apps/web/src/components/workspace/right-utility-sidebar.tsx`

**Changes**

- replace `markdownMode: "edit" | "preview"` with `editorMode: "source" | "rich" | "preview"`
- render the new editor shell
- keep `runCommandIntent()` operating on markdown text only

**Acceptance**

- User can toggle between source and rich modes.
- Rich mode is blocked automatically for unsafe notes.

---

## Phase F - Testing Reset

### F.1 Delete obsolete tests

- PM-hybrid tests removed with the deleted code

### F.2 Add new tests

**New Tests**

- `apps/web/src/components/markdown-source-editor.test.tsx`
- `apps/web/src/components/rich-text-editor.test.tsx`
- `apps/web/src/components/note-content-editor.test.tsx`
- `packages/editor-markdown/src/rich-support.test.ts`

**Coverage**

- source-mode fidelity
- rich-mode subset loading
- rich-mode rejection on unsupported markdown
- slash-command notes force source mode
- agent-style markdown can be loaded and edited safely
- wiki links survive rich round-trips for supported notes

---

## 8) Concrete Task List

## Repo Setup

- [ ] Delete `packages/editor-pm/`.
- [ ] Delete `apps/web/src/components/pm-markdown-editor.tsx`.
- [ ] Delete `apps/web/src/components/pm-markdown-editor.test.ts`.
- [ ] Delete `apps/web/src/components/pm-markdown-editor.test.tsx`.
- [ ] Delete `packages/editor-core/src/behaviors/`.
- [ ] Delete `packages/editor-core/src/behaviors.test.ts`.
- [ ] Delete `packages/editor-core/src/behaviors-integration.test.ts`.
- [ ] Delete `docs/plans/MARKDOWN-EDITOR-GAP-REMEDIATION-PLAN.md`.

## Shared Markdown Package

- [ ] Rename `packages/editor-core` to `packages/editor-markdown`.
- [ ] Update `package.json` name to `@gneissdotrun/editor-markdown`.
- [ ] Remove behavior-engine exports from `src/index.ts`.
- [ ] Add `src/rich-support.ts`.
- [ ] Add `src/slash-safety.ts`.
- [ ] Add tests for rich support and slash safety.
- [ ] Update all workspace imports from `@gneissdotrun/editor-core` to `@gneissdotrun/editor-markdown`.

## Web Dependencies

- [ ] Remove `@gneissdotrun/editor-pm` from `apps/web/package.json`.
- [ ] Add `@gneissdotrun/editor-markdown` to `apps/web/package.json`.
- [ ] Add CodeMirror dependencies to `apps/web/package.json`.
- [ ] Keep only the TipTap dependencies required by the new rich editor.
- [ ] Remove unused editor-related dependencies after the reset.

## New Web Editor Files

- [ ] Add `apps/web/src/components/markdown-source-editor.tsx`.
- [ ] Add `apps/web/src/components/rich-text-editor.tsx`.
- [ ] Add `apps/web/src/components/note-content-editor.tsx`.
- [ ] Add `apps/web/src/lib/editor/tiptap-adapter.ts`.
- [ ] Add `apps/web/src/lib/editor/tiptap-extensions.ts`.
- [ ] Add `apps/web/src/lib/editor/editor-mode.ts`.

## NoteEditor Integration

- [ ] Refactor `apps/web/src/components/note-editor.tsx` to use `note-content-editor`.
- [ ] Replace `markdownMode` with `editorMode` in `apps/web/src/components/note-editor.tsx`.
- [ ] Replace `markdownMode` with `editorMode` in `apps/web/src/components/workspace/workspace-shell.tsx`.
- [ ] Replace `markdownMode` with `editorMode` in `apps/web/src/components/workspace/canvas-pane.tsx`.
- [ ] Replace `markdownMode` with `editorMode` in `apps/web/src/components/workspace/right-utility-sidebar.tsx`.
- [ ] Update sidebar controls to explicitly switch between `Source`, `Rich`, and `Preview` if preview remains.

## Styling Cleanup

- [ ] Remove `.pm-slash-command-box` styles from `apps/web/src/index.css`.
- [ ] Remove `.pm-rollover-*` styles from `apps/web/src/index.css`.
- [ ] Remove `.pm-fake-selection` styles from `apps/web/src/index.css`.
- [ ] Remove `.shiki-token` styles from `apps/web/src/index.css`.
- [ ] Add styles for the new source and rich editors.

## Tests

- [ ] Add `apps/web/src/components/markdown-source-editor.test.tsx`.
- [ ] Add `apps/web/src/components/rich-text-editor.test.tsx`.
- [ ] Add `apps/web/src/components/note-content-editor.test.tsx`.
- [ ] Update `apps/web/src/components/note-editor.test.tsx` to mock the new editor shell.
- [ ] Expand markdown roundtrip tests in `packages/editor-markdown`.

## Verification

- [ ] `bun install`
- [ ] `bun run typecheck`
- [ ] `bun run build`
- [ ] Manually verify source-mode editing on desktop and mobile widths.
- [ ] Manually verify rich-mode editing on supported notes.
- [ ] Manually verify rich-mode blocking on unsupported notes and pending slash commands.

---

## 9) Acceptance Criteria

- [ ] There is no `@gneissdotrun/editor-pm` workspace left in the repo.
- [ ] There is no hybrid markdown-in-TipTap behavior left in the codebase.
- [ ] The only shared editor-domain package is markdown-focused.
- [ ] `Source` mode edits raw markdown exactly.
- [ ] `Rich` mode supports the approved subset and serializes back to markdown.
- [ ] Notes with unsupported or lossy markdown stay in `Source` mode.
- [ ] Agent-written markdown continues to work without prompt changes.

---

## 10) This Plan Replaces

This plan supersedes:

- `docs/plans/MARKDOWN-EDITOR-GAP-REMEDIATION-PLAN.md`

That plan should be removed during implementation.
