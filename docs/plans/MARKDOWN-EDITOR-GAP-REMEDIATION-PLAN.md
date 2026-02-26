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

## 3) Implementation Plan (Phased)

## Phase A — Paste Path Parity (Highest Priority)

### A.1 Add markdown-aware paste extension
- [ ] Create `packages/editor-pm/src/extensions/markdown-paste.ts`.
- [ ] Implement ProseMirror `handlePaste` to:
  - [ ] Read plain text from clipboard.
  - [ ] Parse clipboard markdown via `markdownToPmDoc`.
  - [ ] Replace current selection with parsed PM content.
  - [ ] Fall back to default paste behavior when parse yields no structured delta or fails.
- [ ] Export extension from `packages/editor-pm/src/extensions/index.ts`.
- [ ] Register in `packages/editor-pm/src/extensions/bundle.ts`.

### A.2 Web editor wiring
- [ ] Ensure `apps/web/src/components/pm-markdown-editor.tsx` uses extension bundle without overriding paste behavior in a conflicting way.
- [ ] Add targeted test coverage for paste behavior in `apps/web/src/components/pm-markdown-editor.test.ts`.

---

## Phase B — Typing Shortcut Coverage for Missing Syntax

### B.1 Add markdown shortcut extension
- [ ] Create `packages/editor-pm/src/extensions/markdown-shortcuts.ts`.
- [ ] Implement input/text rules for:
  - [ ] `- [ ]` -> unchecked task item.
  - [ ] `- [x]` -> checked task item.
  - [ ] `[label](url)` -> link mark.
  - [ ] `![alt](url "title")` / `![alt](url)` -> image node.
  - [ ] `***text***` and `___text___` -> bold + italic marks.
  - [ ] escaped sequences (`\*`, `\_`, `\``, `\[`, `\]`, `\(`, `\)`, etc.) -> literal chars with slash removed.
- [ ] Register shortcut extension in `packages/editor-pm/src/extensions/bundle.ts`.

### B.2 Keep existing inline code fallback stable
- [ ] Preserve and validate `tryInlineCodeInputRuleFallback` behavior in `apps/web/src/components/pm-markdown-editor.tsx`.
- [ ] Confirm no regressions with typing after closing backtick.

---

## Phase C — Missing PM Schema/Extension Support (Images + Tables)

### C.1 Image support
- [ ] Add `@tiptap/extension-image` dependency to `packages/editor-pm/package.json`.
- [ ] Add image extension to `packages/editor-pm/src/extensions/bundle.ts`.
- [ ] Validate adapter compatibility in `packages/editor-pm/src/adapters.ts` (already maps image nodes; confirm behavior with real schema).
- [ ] Add editor styles for rendered images in `apps/web/src/index.css`.

### C.2 Table support end-to-end
- [ ] Extend canonical model in `packages/editor-core/src/model/document.ts` with table block types:
  - [ ] table
  - [ ] tableRow
  - [ ] tableCell (header/body distinction)
- [ ] Extend markdown parsing in `packages/editor-core/src/markdown/parse.ts`:
  - [ ] map mdast `table`, `tableRow`, `tableCell` to canonical.
- [ ] Extend markdown serialization in `packages/editor-core/src/markdown/serialize.ts`:
  - [ ] map canonical table blocks back to mdast table nodes.
- [ ] Extend PM adapters in `packages/editor-pm/src/adapters.ts`:
  - [ ] canonical -> PM table JSON
  - [ ] PM table JSON -> canonical
- [ ] Add TipTap table extensions to bundle (`table`, `table-row`, `table-cell`, `table-header`).
- [ ] Add table visual styles in `apps/web/src/index.css`.

---

## Phase D — Link/Blockquote/Checklist Behavior Validation

### D.1 Link rendering and interactions
- [ ] Verify link marks render in editor after:
  - [ ] typing markdown link syntax
  - [ ] pasting markdown content
  - [ ] loading persisted markdown
- [ ] Verify wiki links continue to use `data-wiki-link` attribute path.

### D.2 Blockquote behavior
- [ ] Verify blockquote creation via typing (`> `), paste, and load-from-markdown.
- [ ] Add tests ensuring blockquote roundtrip through PM JSON and markdown serialization.

### D.3 Task list behavior
- [ ] Verify task list creation via typing and paste.
- [ ] Ensure task list roundtrip keeps checked state (`[ ]` / `[x]`).

---

## Phase E — Tests, Fixtures, and Regression Net

### E.1 `packages/editor-core` tests
- [ ] Add/expand fixtures in `packages/editor-core/src/__fixtures__/markdown/`:
  - [ ] task lists
  - [ ] links + images
  - [ ] escaped characters
  - [ ] combined bold+italic
  - [ ] blockquotes
  - [ ] tables
- [ ] Update `packages/editor-core/src/markdown-roundtrip.test.ts` snapshots.

### E.2 `packages/editor-pm` tests
- [ ] Expand `packages/editor-pm/src/adapters.test.ts` for images, tables, task lists, links.
- [ ] Add extension tests for paste + markdown shortcuts in `packages/editor-pm/src/integration.test.ts`.
- [ ] Add table-specific extension tests if needed.

### E.3 `apps/web` tests
- [ ] Expand `apps/web/src/components/pm-markdown-editor.test.ts` for:
  - [ ] paste conversion of headings/lists/code fences/quotes
  - [ ] link markdown typing conversion
  - [ ] image markdown typing conversion
  - [ ] escape behavior (`\*` => `*` etc.)
  - [ ] `***bold+italic***` conversion
- [ ] Ensure existing note editor tests keep passing.

---

## 4) Concrete File-by-File Task List

## `packages/editor-pm`
- [ ] `src/extensions/markdown-paste.ts` (new)
- [ ] `src/extensions/markdown-shortcuts.ts` (new)
- [ ] `src/extensions/bundle.ts` (register new extensions, image/table extensions)
- [ ] `src/extensions/index.ts` (export new extensions)
- [ ] `src/adapters.ts` (table mappings + verify image/task/link paths)
- [ ] `src/integration.test.ts` (paste/shortcut coverage)
- [ ] `src/adapters.test.ts` (new assertions)
- [ ] `package.json` (add TipTap image/table deps)

## `packages/editor-core`
- [ ] `src/model/document.ts` (table model types)
- [ ] `src/markdown/parse.ts` (table parse support)
- [ ] `src/markdown/serialize.ts` (table serialize support)
- [ ] `src/__fixtures__/markdown/*` (add fixture docs)
- [ ] `src/markdown-roundtrip.test.ts` (snapshot updates)

## `apps/web`
- [ ] `src/components/pm-markdown-editor.tsx` (verify no conflict with paste/shortcut extension wiring)
- [ ] `src/components/pm-markdown-editor.test.ts` (paste + typing regression coverage)
- [ ] `src/index.css` (image/table styling polish)

## Repo-level docs
- [ ] `AGENTS.md` Learnings section (append any new non-obvious constraints discovered during implementation)

---

## 5) Acceptance Criteria

- [ ] Pasting markdown immediately produces structured nodes (no extra “press space to activate” workaround).
- [ ] Task list markdown (`- [ ]`, `- [x]`) works on type, paste, load, and serialize.
- [ ] Markdown links render correctly on type, paste, and load.
- [ ] Markdown images render correctly on type, paste, and load.
- [ ] Escaped markdown characters render as literal characters without stray backslashes.
- [ ] `***bold+italic***` and `___bold+italic___` work in typing flow.
- [ ] Blockquotes work in type, paste, load, and roundtrip serialize.
- [ ] Tables parse/render/serialize correctly.

---

## 6) Verification Commands

- [ ] `bun test packages/editor-core/src/markdown-roundtrip.test.ts`
- [ ] `bun test packages/editor-pm/src/adapters.test.ts packages/editor-pm/src/integration.test.ts`
- [ ] `bun test apps/web/src/components/pm-markdown-editor.test.ts`
- [ ] `bunx turbo -F web typecheck`
- [ ] `bun run typecheck`
- [ ] `bun run build`

---

## 7) Suggested PR Slices (Execution Order)

### PR 1 — Paste Path Parity
**Goal:** Markdown pasted into the editor immediately renders as structured content.

- [ ] Add `packages/editor-pm/src/extensions/markdown-paste.ts`.
- [ ] Wire extension into `packages/editor-pm/src/extensions/index.ts` and `packages/editor-pm/src/extensions/bundle.ts`.
- [ ] Validate `apps/web/src/components/pm-markdown-editor.tsx` does not conflict with paste handling.
- [ ] Add paste-focused tests in `apps/web/src/components/pm-markdown-editor.test.ts`.
- [ ] Add/adjust integration coverage in `packages/editor-pm/src/integration.test.ts`.

**Exit criteria:** Pasted headings/lists/code fences/quotes/links render without extra typing.

### PR 2 — Typing Shortcut Coverage
**Goal:** Missing markdown typing patterns convert as users type.

- [ ] Add `packages/editor-pm/src/extensions/markdown-shortcuts.ts`.
- [ ] Implement rules for task list syntax (`- [ ]`, `- [x]`).
- [ ] Implement rules for markdown links (`[label](url)`).
- [ ] Implement rules for markdown images (`![alt](url)`, optional title).
- [ ] Implement rules for combined emphasis (`***text***`, `___text___`).
- [ ] Implement escape handling so backslash decorators resolve to literal chars.
- [ ] Register shortcut extension in the bundle.
- [ ] Add regression coverage in `apps/web/src/components/pm-markdown-editor.test.ts` and `packages/editor-pm/src/integration.test.ts`.

**Exit criteria:** Typing flows for links/tasks/combined emphasis/escapes work without manual workaround.

### PR 3 — Image Support End-to-End
**Goal:** Images render and round-trip correctly.

- [ ] Add `@tiptap/extension-image` in `packages/editor-pm/package.json`.
- [ ] Register image extension in `packages/editor-pm/src/extensions/bundle.ts`.
- [ ] Verify adapter behavior in `packages/editor-pm/src/adapters.ts` for image nodes.
- [ ] Add/expand image assertions in `packages/editor-pm/src/adapters.test.ts`.
- [ ] Add image styles in `apps/web/src/index.css`.
- [ ] Add web-level editor tests for markdown-image paste/typing.

**Exit criteria:** Markdown image syntax works for type/paste/load/serialize with visible rendering.

### PR 4 — Table Support End-to-End
**Goal:** Tables are supported in canonical model, adapters, and editor schema.

- [ ] Extend `packages/editor-core/src/model/document.ts` with table types.
- [ ] Add table parse support in `packages/editor-core/src/markdown/parse.ts`.
- [ ] Add table serialize support in `packages/editor-core/src/markdown/serialize.ts`.
- [ ] Add table fixtures in `packages/editor-core/src/__fixtures__/markdown/`.
- [ ] Update roundtrip snapshots via `packages/editor-core/src/markdown-roundtrip.test.ts`.
- [ ] Add TipTap table extensions to `packages/editor-pm/src/extensions/bundle.ts`.
- [ ] Extend `packages/editor-pm/src/adapters.ts` for table mappings.
- [ ] Add table assertions in `packages/editor-pm/src/adapters.test.ts` and integration tests.
- [ ] Add table styles in `apps/web/src/index.css`.
- [ ] Add web editor tests for pasted markdown tables.

**Exit criteria:** Tables parse, render, and serialize with stable roundtrip behavior.

### PR 5 — Validation Sweep + Documentation
**Goal:** Confirm complete behavior matrix and lock in regressions.

- [ ] Expand final regression matrix in `apps/web/src/components/pm-markdown-editor.test.ts`.
- [ ] Verify blockquote/link/task flows for type + paste + persisted content load.
- [ ] Run full verification commands in Section 6.
- [ ] Update `AGENTS.md` Learnings with any implementation surprises.
- [ ] Capture final manual QA checklist results in this plan doc (or linked QA note).

**Exit criteria:** All acceptance criteria in Section 5 are checked and reproducible.
