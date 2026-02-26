# Markdown Editor Gap Remediation Plan

> **Status:** Draft implementation plan + concrete task list  
> **Scope:** `apps/web`, `packages/editor-pm`, `packages/editor-core`  
> **Goal:** Close the remaining markdown behavior gaps found in manual QA

---

## 1) Gaps Confirmed in Manual QA

1. Markdown syntax in pasted text does not structurally render until additional typing occurs.
2. `- [ ]` / `- [x]` task checkboxes are not supported in typing flow.
3. Markdown links and images are not rendering in editor flow.
4. Escaped markdown characters keep the `\` literal instead of resolving to literal characters.
5. Combined bold+italic syntax (`***text***`) is not supported in typing flow.
6. Blockquote typing/paste behavior is inconsistent.
7. Markdown tables are unsupported.

---

## 2) Root Cause Summary

- We currently rely heavily on TipTap input rules (typing-time conversions), but we do not have a markdown-aware paste pipeline.
- Several markdown features are parse/serialize-capable in `editor-core` but missing in live typing shortcuts and/or PM schema extensions.
- Images are mapped in adapters, but the extension bundle lacks image node support.
- Tables are not represented in the canonical document model, so they fall back to unsupported nodes.

---

w

## 3) Implementation Plan (Phased)

## Phase A — Paste Path Parity (Highest Priority)

### A.1 Add markdown-aware paste extension

- [x] Create `packages/editor-pm/src/extensions/markdown-paste.ts`.
- [x] Implement ProseMirror `handlePaste` to:
  - [x] Read plain text from clipboard.
  - [x] Parse clipboard markdown via `markdownToPmDoc`.
  - [x] Replace current selection with parsed PM content.
  - [x] Fall back to default paste behavior when parse yields no structured delta or fails.
- [x] Export extension from `packages/editor-pm/src/extensions/index.ts`.
- [x] Register in `packages/editor-pm/src/extensions/bundle.ts`.

### A.2 Web editor wiring

- [x] Ensure `apps/web/src/components/pm-markdown-editor.tsx` uses extension bundle without overriding paste behavior in a conflicting way.
- [x] Add targeted test coverage for paste behavior in `apps/web/src/components/pm-markdown-editor.test.ts`.

---

## Phase B — Typing Shortcut Coverage for Missing Syntax

### B.1 Add markdown shortcut extension

- [x] Create `packages/editor-pm/src/extensions/markdown-shortcuts.ts`.
- [x] Implement input/text rules for:
  - [x] `- [ ]` -> unchecked task item.
  - [x] `- [x]` -> checked task item.
  - [x] `[label](url)` -> link mark.
  - [x] `![alt](url "title")` / `![alt](url)` -> image node.
  - [x] `***text***` and `___text___` -> bold + italic marks.
  - [x] escaped sequences (`\*`, `\_`, `\``, `\[`, `\]`, `\(`, `\)`, etc.) -> literal chars with slash removed.
- [x] Register shortcut extension in `packages/editor-pm/src/extensions/bundle.ts`.

### B.2 Keep existing inline code fallback stable

- [x] Preserve and validate `tryInlineCodeInputRuleFallback` behavior in `apps/web/src/components/pm-markdown-editor.tsx`.
- [x] Confirm no regressions with typing after closing backtick.

---

## Phase C — Missing PM Schema/Extension Support (Images + Tables)

### C.1 Image support

- [x] Add `@tiptap/extension-image` dependency to `packages/editor-pm/package.json`.
- [x] Add image extension to `packages/editor-pm/src/extensions/bundle.ts`.
- [x] Validate adapter compatibility in `packages/editor-pm/src/adapters.ts` (already maps image nodes; confirm behavior with real schema).
- [x] Add editor styles for rendered images in `apps/web/src/index.css`.

### C.2 Table support end-to-end

- [x] Extend canonical model in `packages/editor-core/src/model/document.ts` with table block types:
  - [x] table
  - [x] tableRow
  - [x] tableCell (header/body distinction)
- [x] Extend markdown parsing in `packages/editor-core/src/markdown/parse.ts`:
  - [x] map mdast `table`, `tableRow`, `tableCell` to canonical.
- [x] Extend markdown serialization in `packages/editor-core/src/markdown/serialize.ts`:
  - [x] map canonical table blocks back to mdast table nodes.
- [x] Extend PM adapters in `packages/editor-pm/src/adapters.ts`:
  - [x] canonical -> PM table JSON
  - [x] PM table JSON -> canonical
- [x] Add TipTap table extensions to bundle (`table`, `table-row`, `table-cell`, `table-header`).
- [x] Add table visual styles in `apps/web/src/index.css`.

---

## Phase D — Link/Blockquote/Checklist Behavior Validation

### D.1 Link rendering and interactions

- [x] Verify link marks render in editor after:
  - [x] typing markdown link syntax
  - [x] pasting markdown content
  - [x] loading persisted markdown
- [x] Verify wiki links continue to use `data-wiki-link` attribute path.

### D.2 Blockquote behavior

- [x] Verify blockquote creation via typing (`> `), paste, and load-from-markdown.
- [x] Add tests ensuring blockquote roundtrip through PM JSON and markdown serialization.

### D.3 Task list behavior

- [x] Verify task list creation via typing and paste.
- [x] Ensure task list roundtrip keeps checked state (`[ ]` / `[x]`).

---

## Phase E — Tests, Fixtures, and Regression Net

### E.1 `packages/editor-core` tests

- [x] Add/expand fixtures in `packages/editor-core/src/__fixtures__/markdown/`:
  - [x] task lists
  - [x] links + images
  - [x] escaped characters
  - [x] combined bold+italic
  - [x] blockquotes
  - [x] tables
- [x] Update `packages/editor-core/src/markdown-roundtrip.test.ts` snapshots.

### E.2 `packages/editor-pm` tests

- [x] Expand `packages/editor-pm/src/adapters.test.ts` for images, tables, task lists, links.
- [x] Add extension tests for paste + markdown shortcuts in `packages/editor-pm/src/integration.test.ts`.
- [x] Add table-specific extension tests if needed.

### E.3 `apps/web` tests

- [x] Expand `apps/web/src/components/pm-markdown-editor.test.ts` for:
  - [x] paste conversion of headings/lists/code fences/quotes
  - [x] link markdown typing conversion
  - [x] image markdown typing conversion
  - [x] escape behavior (`\*` => `*` etc.)
  - [x] `***bold+italic***` conversion
- [x] Ensure existing note editor tests keep passing.

---

## 4) Concrete File-by-File Task List

## `packages/editor-pm`

- [x] `src/extensions/markdown-paste.ts` (new)
- [x] `src/extensions/markdown-shortcuts.ts` (new)
- [x] `src/extensions/bundle.ts` (register new extensions, image/table extensions)
- [x] `src/extensions/index.ts` (export new extensions)
- [x] `src/adapters.ts` (table mappings + verify image/task/link paths)
- [x] `src/integration.test.ts` (paste/shortcut coverage)
- [x] `src/adapters.test.ts` (new assertions)
- [x] `package.json` (add TipTap image/table deps)

## `packages/editor-core`

- [x] `src/model/document.ts` (table model types)
- [x] `src/markdown/parse.ts` (table parse support)
- [x] `src/markdown/serialize.ts` (table serialize support)
- [x] `src/__fixtures__/markdown/*` (add fixture docs)
- [x] `src/markdown-roundtrip.test.ts` (snapshot updates)

## `apps/web`

- [x] `src/components/pm-markdown-editor.tsx` (verify no conflict with paste/shortcut extension wiring)
- [x] `src/components/pm-markdown-editor.test.ts` (paste + typing regression coverage)
- [x] `src/index.css` (image/table styling polish)

## Repo-level docs

- [x] `AGENTS.md` Learnings section (append any new non-obvious constraints discovered during implementation)

---

## 5) Acceptance Criteria

- [x] Pasting markdown immediately produces structured nodes (no extra “press space to activate” workaround).
- [x] Task list markdown (`- [ ]`, `- [x]`) works on type, paste, load, and serialize.
- [x] Markdown links render correctly on type, paste, and load.
- [x] Markdown images render correctly on type, paste, and load.
- [x] Escaped markdown characters render as literal characters without stray backslashes.
- [x] `***bold+italic***` and `___bold+italic___` work in typing flow.
- [x] Blockquotes work in type, paste, load, and roundtrip serialize.
- [x] Tables parse/render/serialize correctly.

---

## 6) Verification Commands

- [x] `bun test packages/editor-core/src/markdown-roundtrip.test.ts`
- [x] `bun test packages/editor-pm/src/adapters.test.ts packages/editor-pm/src/integration.test.ts`
- [x] `bun test apps/web/src/components/pm-markdown-editor.test.ts`
- [x] `bunx turbo -F web typecheck`
- [x] `bun run typecheck`
- [ ] `bun run build` _(currently blocked by unrelated `apps/docs` Starlight/Zod `/404` build error)_

---

## 7) Suggested PR Slices (Execution Order)

### PR 1 — Paste Path Parity

**Goal:** Markdown pasted into the editor immediately renders as structured content.

- [x] Add `packages/editor-pm/src/extensions/markdown-paste.ts`.
- [x] Wire extension into `packages/editor-pm/src/extensions/index.ts` and `packages/editor-pm/src/extensions/bundle.ts`.
- [x] Validate `apps/web/src/components/pm-markdown-editor.tsx` does not conflict with paste handling.
- [x] Add paste-focused tests in `apps/web/src/components/pm-markdown-editor.test.ts`.
- [x] Add/adjust integration coverage in `packages/editor-pm/src/integration.test.ts`.

**Exit criteria:** Pasted headings/lists/code fences/quotes/links render without extra typing.

### PR 2 — Typing Shortcut Coverage

**Goal:** Missing markdown typing patterns convert as users type.

- [x] Add `packages/editor-pm/src/extensions/markdown-shortcuts.ts`.
- [x] Implement rules for task list syntax (`- [ ]`, `- [x]`).
- [x] Implement rules for markdown links (`[label](url)`).
- [x] Implement rules for markdown images (`![alt](url)`, optional title).
- [x] Implement rules for combined emphasis (`***text***`, `___text___`).
- [x] Implement escape handling so backslash decorators resolve to literal chars.
- [x] Register shortcut extension in the bundle.
- [x] Add regression coverage in `apps/web/src/components/pm-markdown-editor.test.ts` and `packages/editor-pm/src/integration.test.ts`.

**Exit criteria:** Typing flows for links/tasks/combined emphasis/escapes work without manual workaround.

### PR 3 — Image Support End-to-End

**Goal:** Images render and round-trip correctly.

- [x] Add `@tiptap/extension-image` in `packages/editor-pm/package.json`.
- [x] Register image extension in `packages/editor-pm/src/extensions/bundle.ts`.
- [x] Verify adapter behavior in `packages/editor-pm/src/adapters.ts` for image nodes.
- [x] Add/expand image assertions in `packages/editor-pm/src/adapters.test.ts`.
- [x] Add image styles in `apps/web/src/index.css`.
- [x] Add web-level editor tests for markdown-image paste/typing.

**Exit criteria:** Markdown image syntax works for type/paste/load/serialize with visible rendering.

### PR 4 — Table Support End-to-End

**Goal:** Tables are supported in canonical model, adapters, and editor schema.

- [x] Extend `packages/editor-core/src/model/document.ts` with table types.
- [x] Add table parse support in `packages/editor-core/src/markdown/parse.ts`.
- [x] Add table serialize support in `packages/editor-core/src/markdown/serialize.ts`.
- [x] Add table fixtures in `packages/editor-core/src/__fixtures__/markdown/`.
- [x] Update roundtrip snapshots via `packages/editor-core/src/markdown-roundtrip.test.ts`.
- [x] Add TipTap table extensions to `packages/editor-pm/src/extensions/bundle.ts`.
- [x] Extend `packages/editor-pm/src/adapters.ts` for table mappings.
- [x] Add table assertions in `packages/editor-pm/src/adapters.test.ts` and integration tests.
- [x] Add table styles in `apps/web/src/index.css`.
- [x] Add web editor tests for pasted markdown tables.

**Exit criteria:** Tables parse, render, and serialize with stable roundtrip behavior.

### PR 5 — Validation Sweep + Documentation

**Goal:** Confirm complete behavior matrix and lock in regressions.

- [x] Expand final regression matrix in `apps/web/src/components/pm-markdown-editor.test.ts`.
- [x] Verify blockquote/link/task flows for type + paste + persisted content load.
- [x] Run full verification commands in Section 6.
- [x] Update `AGENTS.md` Learnings with any implementation surprises.
- [x] Capture final manual QA checklist results in this plan doc (or linked QA note).

**Exit criteria:** All acceptance criteria in Section 5 are checked and reproducible.

## 8) Execution Notes

- Implemented Phase A-E scope across `packages/editor-core`, `packages/editor-pm`, and `apps/web`.
- Added markdown paste pipeline, typing shortcuts, image/table schema support, adapter mappings, fixtures, and regression tests.
- Verification commands executed:
  - ✅ `bun test packages/editor-core/src/markdown-roundtrip.test.ts`
  - ✅ `bun test packages/editor-pm/src/adapters.test.ts packages/editor-pm/src/integration.test.ts`
  - ✅ `bun test apps/web/src/components/pm-markdown-editor.test.ts`
  - ✅ `bunx turbo -F web typecheck`
  - ✅ `bun run typecheck`
  - ⚠️ `bun run build` currently fails in existing docs workspace with `apps/docs` `/404` Zod/Starlight error unrelated to markdown editor changes.
