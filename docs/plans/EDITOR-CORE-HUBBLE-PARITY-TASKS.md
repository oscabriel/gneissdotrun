# Editor Core Hubble Parity Tasks

> **Status:** Draft  
> **Source Plan:** `docs/plans/EDITOR-CORE-HUBBLE-PARITY-PLAN.md`

---

## Conventions

- Follow `docs/agents/standards.md` and `docs/agents/workspaces.md`.
- Prefer canonical-first changes; do not preserve projection compatibility paths.
- Keep `@gneissdotrun/editor-core` runtime-agnostic.
- Treat PM/TipTap runtime as required for product parity, implemented in a separate first-party package.
- Transitional compatibility tasks (projection wrappers/runtime flags) are considered retired once Phase 6 cleanup lands.

---

## Milestones

- **M0:** Test and fixture baseline is in place.
- **M1:** AST markdown pipeline replaces regex parser internals.
- **M2:** Canonical document model is source of truth.
- **M3:** Headless behavior engine is implemented and tested.
- **M4:** `editor-pm` package exists and is the default runtime path.
- **M5:** `apps/web` is migrated with rollout flags and hardened.
- **M6:** Legacy projection-only core paths are fully removed.

---

## Phase 0 — Baseline + Guardrails (M0)

- [x] `EHP-001` Create markdown fixture directory: `packages/editor-core/src/__fixtures__/markdown/`.
- [x] `EHP-002` Add fixture: nested marks and escaped delimiters.
- [x] `EHP-003` Add fixture: mixed ordered/unordered/task nesting.
- [x] `EHP-004` Add fixture: blockquote + headings + nested lists.
- [x] `EHP-005` Add fixture: fenced code blocks (language + meta + empty lines).
- [x] `EHP-006` Add fixture: links, wiki links, and bare URL scenarios.
- [x] `EHP-007` Add fixture: thematic break + image + html fallback cases.
- [x] `EHP-008` Add `markdown-roundtrip.test.ts` using all fixtures.
- [x] `EHP-009` Add compatibility tests for current public projection API (`parseProjectionMarkdown`, `serializeProjectionMarkdown`).
- [x] `EHP-010` Snapshot current behavior before parser replacement.
- [x] `EHP-011` Document migration guardrails section updates in the parity plan if API shape changes are needed.

**Exit gate (M0):** fixtures + baseline tests pass with current implementation.

---

## Phase 1 — AST Markdown Pipeline (M1)

- [x] `EHP-012` Add dependencies in `packages/editor-core/package.json`: `unified`, `remark-parse`, `remark-gfm`.
- [x] `EHP-013` Add optional serializer dependency if needed (`mdast-util-to-markdown`).
- [x] `EHP-014` Create `packages/editor-core/src/markdown/types.ts` (internal AST conversion types).
- [x] `EHP-015` Create `packages/editor-core/src/markdown/parse.ts` (markdown -> mdast -> internal nodes).
- [x] `EHP-016` Create `packages/editor-core/src/markdown/serialize.ts` (internal nodes -> markdown).
- [x] `EHP-017` Implement mdast -> projection conversion with deterministic fallback for unsupported nodes.
- [x] `EHP-018` Implement projection/canonical -> markdown serializer with stable output contract.
- [x] `EHP-019` Keep public wrappers stable in `src/markdown-projection.ts` or equivalent facade.
- [x] `EHP-020` Add unit tests for unsupported-node fallback behavior.
- [x] `EHP-021` Update snapshots with rationale in PR notes when output intentionally changes.
- [x] `EHP-022` Ensure all Phase 0 fixtures pass round-trip through AST pipeline.

**Exit gate (M1):** regex internals are no longer primary; AST pipeline is primary with compatibility wrappers intact.

---

## Phase 2 — Canonical Document Model (M2)

- [x] `EHP-023` Create canonical model types at `packages/editor-core/src/model/document.ts`.
- [x] `EHP-024` Define canonical block nodes: paragraph, heading, quote, codeBlock, list, listItem, thematicBreak, image.
- [x] `EHP-025` Define canonical inline nodes: text, strong, emphasis, strike, inlineCode, link, wikiLink, hardBreak.
- [x] `EHP-026` Add `markdown <-> canonical` converters.
- [x] `EHP-027` Add `canonical <-> projection` converters.
- [x] `EHP-028` Update `packages/editor-core/src/index.ts` exports to include canonical model + converters.
- [x] `EHP-029` Mark projection parser path as compatibility mode in code docs.
- [x] `EHP-030` Add regression tests proving equivalence:
  - markdown -> projection
  - markdown -> canonical -> projection
- [x] `EHP-031` Add serializer tests proving canonical -> markdown stability.

**Exit gate (M2):** canonical model is source of truth; projection becomes derived view model.

---

## Phase 3 — Headless Behavior Engine (M3)

- [x] `EHP-032` Create behavior core types: `packages/editor-core/src/behaviors/types.ts`.
- [x] `EHP-033` Create behavior engine dispatcher: `packages/editor-core/src/behaviors/engine.ts`.
- [x] `EHP-034` Add selection/range abstraction compatible with line + tree addressing.
- [x] `EHP-035` Implement `delimiter-rollover` behavior module.
- [x] `EHP-036` Implement `fake-selection` behavior module (stateful semantics, runtime-agnostic outputs).
- [x] `EHP-037` Implement `list-normalization` behavior module.
- [x] `EHP-038` Implement command helpers: heading/quote/list/task toggles.
- [x] `EHP-039` Implement ordered-list task clearing rule.
- [x] `EHP-040` Add deterministic unit tests per behavior module.
- [x] `EHP-041` Add integration tests for cursor movement/input sequences (left/right boundaries, backspace/delete cases).
- [x] `EHP-042` Export behavior engine APIs from `editor-core` without PM dependencies.

**Exit gate (M3):** behavior modules are stable, tested, and ready to be consumed by PM runtime.

---

## Phase 4 — Core ProseMirror Runtime Package (M4)

- [x] `EHP-043` Create workspace package: `packages/editor-pm`.
- [x] `EHP-044` Add workspace entry in package manager config and run install to update lockfile.
- [x] `EHP-045` Add package metadata/exports/scripts for `editor-pm`.
- [x] `EHP-046` Add PM/TipTap dependencies in `packages/editor-pm/package.json`.
- [x] `EHP-047` Implement canonical <-> ProseMirror JSON adapters.
- [x] `EHP-048` Implement PM extension: delimiter rollover decorations + boundary key handling.
- [x] `EHP-049` Implement PM extension: fake selection decoration behavior.
- [x] `EHP-050` Implement PM list support: checkbox attrs/node views + normalization plugin.
- [x] `EHP-051` Expose extension bundle API from `editor-pm` for app consumption.
- [x] `EHP-052` Add unit tests for adapters + plugin state transitions.
- [x] `EHP-053` Add minimal integration test mounting editor with extension bundle.
- [x] `EHP-054` Add docs in package README for runtime wiring in app code.

**Exit gate (M4):** `editor-pm` is functional and ready to become default runtime in `apps/web`.

---

## Phase 5 — Apps/Web Integration + Rollout (M5)

- [x] `EHP-055` Add runtime feature flag plumbing in `apps/web` (projection fallback, canonical migration mode, PM default target).
- [x] `EHP-056` Add new PM-backed editor component in `apps/web/src/components/` (kebab-case file naming).
- [x] `EHP-057` Wire PM editor into `apps/web/src/components/note-editor.tsx` behind flag.
- [x] `EHP-058` Preserve current note save/capture/autosave semantics while swapping editor runtime.
- [x] `EHP-059` Implement active-line syntax reveal behavior to match Obsidian-like UX goal.
- [x] `EHP-060` Ensure non-active lines keep rendered styling while editing session remains active.
- [x] `EHP-061` Preserve slash-command behavior and ensure command lines do not persist in final note body.
- [x] `EHP-062` Verify wiki-link display + navigation behavior in PM runtime mode.
- [x] `EHP-063` Add telemetry/error logging hooks for parse/serialize/plugin failures.
- [x] `EHP-064` Add performance checks for large-note editing and parse latency.
- [x] `EHP-065` Add web tests for render/edit seamless switching behavior.
- [x] `EHP-066` Add web tests for keyboard controls and command execution (`Cmd+Enter`, `Escape`, etc.).
- [x] `EHP-067` Set PM runtime as default in `apps/web` once quality gates pass.

**Exit gate (M5):** PM runtime is default in web app with no regressions in core note workflows.

---

## Phase 6 — Cleanup + Stabilization (M6)

- [x] `EHP-068` Remove dead code paths from legacy regex parser internals.
- [x] `EHP-069` Keep explicit compatibility module only if needed; otherwise remove projection-only mode.
- [x] `EHP-070` Update docs to reflect final architecture (`editor-core` + `editor-pm` + app wiring).
- [x] `EHP-071` Add contributor guide for behavior modules and PM extension authoring.
- [x] `EHP-072` Finalize deprecation notes for any renamed/moved APIs.
- [x] `EHP-073` Run full repo validation: `bun run check`, `bun run typecheck`, targeted tests.

**Exit gate (M6):** architecture is stable, documented, and default runtime is PM-backed.

---

## Cross-phase quality checklist

- [x] `EHP-074` Every phase update includes tests for new behavior.
- [x] `EHP-075` Public API changes are documented with migration notes.
- [x] `EHP-076` No `editor-core` PM dependency leakage.
- [x] `EHP-077` Serializer output changes are intentional and reviewed against fixtures.
- [x] `EHP-078` Obsidian-like active-line markdown symbol reveal remains preserved through rollout.

---

## Final acceptance criteria

- [x] `EHP-079` Markdown parse/serialize is AST-driven and canonical-model based.
- [x] `EHP-080` Headless behaviors (rollover, fake selection, list normalization) are implemented and tested.
- [x] `EHP-081` `packages/editor-pm` exists and is the default runtime path in `apps/web`.
- [x] `EHP-082` Users can seamlessly edit rendered markdown with syntax visible only on actively edited lines.
- [x] `EHP-083` Legacy modes are either removed or explicitly marked as fallback compatibility paths.
