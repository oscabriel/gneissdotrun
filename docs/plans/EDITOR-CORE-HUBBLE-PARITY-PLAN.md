# Editor Core → Hubble Parity Plan

> **Status:** Draft  
> **Owner:** `@gneissdotrun/editor-core` maintainers  
> **Target:** Reach practical feature parity with Hubble’s editor runtime while preserving our existing markdown-projection UX and API stability.

---

## Why this plan exists

Today, `packages/editor-core` is a regex + line-based markdown projection parser:

- `packages/editor-core/src/markdown-projection.ts`
- consumed by `apps/web/src/components/markdown-projection-editor.tsx`

That is fast and simple, but it will not scale to nested markdown correctness or advanced editor behavior (delimiter rollover, list normalization, fake selection, etc.).

This plan transitions us in phases to a Hubble-like architecture:

1. AST-based markdown pipeline
2. Canonical editor document model
3. Headless behavior engine
4. ProseMirror/TipTap runtime package as the default app engine
5. App adoption + hardening

---

## Parity scope (what “more or less parity” means)

### In scope

- Markdown parse/serialize correctness for common GFM content
- Stable round-tripping through a structured internal model
- Task list + list normalization behavior
- Mark delimiter boundary behavior (Typora-style rollover)
- Fake selection behavior (blur/focus preservation)
- First-party PM/TipTap runtime package that mirrors Hubble extension behavior

### Out of scope (for now)

- Full desktop/runtime parity with Hubble apps (`apps/desktop`, `apps/www`)
- Realtime collaboration / CRDT
- Persistent editor-level storage/cache in `editor-core`

### Runtime architecture decision (required)

- ProseMirror/TipTap is considered **core to the product experience** (Obsidian-like seamless render/edit).
- `editor-core` remains headless and runtime-agnostic.
- A separate first-party package (`editor-pm`) is the **default runtime used by apps**.
- This separation is for layering and reuse, not to make PM optional in the product roadmap.

---

## Current baseline (must preserve)

- Public API exports from `packages/editor-core/src/index.ts`
- Existing projection model types (`ProjectionLine`, `ProjectionInlineSegment`, etc.)
- Existing tests + snapshots:
  - `packages/editor-core/src/markdown-projection.test.ts`
  - `packages/editor-core/src/__snapshots__/markdown-projection.test.ts.snap`
- Existing app behavior in:
  - `apps/web/src/components/markdown-projection-editor.tsx`
  - `apps/web/src/components/note-editor.tsx`

---

## Phase 0 — Baseline, fixtures, and migration guardrails

## Objective

Create safety rails before we change parsing architecture.

## Concrete steps

1. Add golden markdown fixtures covering edge cases not currently tested:
   - nested emphasis/strong/code
   - mixed ordered/unordered/task lists
   - blockquotes + lists + headings
   - fenced code blocks with language/meta
   - links + wiki links + bare URLs
2. Add round-trip assertions for each fixture.
3. Add a compatibility test suite proving current projection API still works.
4. Add a migration RFC section in this plan (or linked doc) for any API change that is not backward-compatible.

## Deliverables

- `packages/editor-core/src/__fixtures__/markdown/*.md` (new)
- `packages/editor-core/src/markdown-roundtrip.test.ts` (new)
- Updated snapshot coverage

## Exit criteria

- Green tests for existing parser + new fixtures
- No public API change yet

## Migration guardrails update (implemented)

- `parseProjectionMarkdown` and `serializeProjectionMarkdown` remain exported as compatibility wrappers.
- `ProjectionLine` and `ProjectionInlineSegment` stay source-compatible for existing consumers.
- New canonical model + behavior APIs are additive exports from `@gneissdotrun/editor-core`.
- Any projection output churn is captured via fixtures and snapshot review rather than silent runtime behavior changes.

---

## Phase 1 — Replace regex parser with AST markdown pipeline

## Objective

Move parsing/serialization to a `remark`-based AST flow while retaining the projection API.

## Concrete steps

1. Add parser dependencies to `packages/editor-core/package.json`:
   - `unified`
   - `remark-parse`
   - `remark-gfm`
   - (optional) `mdast-util-to-markdown` if serializer implementation benefits
2. Create new markdown modules:
   - `packages/editor-core/src/markdown/parse.ts`
   - `packages/editor-core/src/markdown/serialize.ts`
   - `packages/editor-core/src/markdown/types.ts`
3. Implement mdast → projection conversion:
   - preserve existing `ProjectionDocument` output shape where feasible
   - explicitly handle unsupported nodes with deterministic fallback
4. Implement projection/canonical nodes → markdown serializer with stable output.
5. Keep `parseProjectionMarkdown`/`serializeProjectionMarkdown` as stable API wrappers.
6. Add tests for AST node mapping + failure/fallback behavior.

## Deliverables

- New `src/markdown/*` pipeline
- Old parser internals either removed or kept as fallback behind internal flag
- Enhanced tests with fixture-based coverage

## Exit criteria

- Existing snapshots pass or are intentionally updated with documented rationale
- Round-trip correctness improved on edge fixtures
- Public API remains source-compatible

---

## Phase 2 — Introduce canonical editor document model

## Objective

Stop treating projection as source-of-truth; make it a view over a canonical document tree.

## Concrete steps

1. Add canonical model types:
   - `packages/editor-core/src/model/document.ts`
   - blocks: paragraph, heading, quote, code, list, listItem, thematicBreak, image
   - inlines: text, strong, emphasis, strike, code, link, wikiLink, hardBreak
2. Build conversion layers:
   - markdown AST ↔ canonical model
   - canonical model ↔ projection model
3. Update exports in `packages/editor-core/src/index.ts`:
   - expose canonical model types + converters
   - keep existing projection exports
4. Mark projection parser as compatibility layer in code comments/docs.
5. Add regression tests that prove equivalence between:
   - direct markdown→projection
   - markdown→canonical→projection

## Deliverables

- Canonical model package internals
- Conversion utilities
- Backward-compatible exports

## Exit criteria

- Canonical model is the primary internal representation
- Projection is derived, not canonical

---

## Phase 3 — Add headless behavior engine (Hubble-style capabilities without PM lock-in)

## Objective

Implement advanced editing behaviors as pure, testable operations independent of UI runtime.

## Concrete steps

1. Add behavior engine structure:
   - `packages/editor-core/src/behaviors/types.ts` (selection, range, intent, op)
   - `packages/editor-core/src/behaviors/engine.ts` (dispatch/apply)
2. Implement parity-target behavior modules:
   - `delimiter-rollover.ts`
   - `fake-selection.ts` (state machine + decoration intent, runtime-agnostic)
   - `list-normalization.ts`
3. Add command helpers for editor actions:
   - toggle heading/quote/list/task
   - clear task markers in ordered lists
4. Add deterministic tests for each behavior module.
5. Add integration tests simulating text input and cursor movement flows.

## Deliverables

- Headless behavior engine with stable operation protocol
- Coverage for edge cursor/list transformations

## Exit criteria

- Core parity behaviors are implemented headlessly and ready for PM integration
- Behavior modules are UI-framework agnostic

---

## Phase 4 — Core ProseMirror/TipTap runtime package

## Objective

Make PM/TipTap the default production runtime for our editor UX while preserving a clean headless core boundary.

## Concrete steps

1. Create new workspace package:
   - `packages/editor-pm` (or `packages/editor-prosemirror`)
2. Add PM/TipTap dependencies to the new package only.
3. Implement adapters:
   - canonical model ↔ ProseMirror JSON
   - PM plugin/extension wrappers for behavior engine modules
4. Implement PM extensions mirroring Hubble-like features:
   - rollover decorations + boundary key handling
   - fake selection decoration plugin
   - list item checkbox attrs/node views + normalization plugin
5. Expose composable extension bundles for app usage.
6. Add adapter tests (unit + minimal integration).

## Deliverables

- New adapter package with typed public API
- No forced PM dependency in `editor-core`

## Exit criteria

- PM-backed editor runs with parity behavior set in app integration environments
- PM runtime is the default path for `apps/web`
- `editor-core` remains runtime-agnostic and reusable

---

## Phase 5 — App integration, rollout, and hardening

## Objective

Adopt the new architecture safely in `apps/web` with staged rollout.

## Concrete steps

1. Add feature flags for editor runtime selection:
   - projection-only (existing, temporary fallback)
   - canonical + projection renderer (migration mode)
   - PM runtime mode (default target)
2. Incrementally migrate `apps/web/src/components/markdown-projection-editor.tsx` and `note-editor.tsx`:
   - keep current UX intact while swapping internals
3. Add telemetry + error logging for parse/serialize/behavior failures.
4. Add performance guardrails:
   - parse latency measurements
   - large-note test fixtures
5. Add migration docs for contributors:
   - architecture map
   - extension/behavior authoring guide
6. Remove dead code once rollout is complete.

## Deliverables

- Runtime toggleable editor integration in web app
- Contributor docs for new architecture

## Exit criteria

- Stable production behavior under default mode
- Ability to switch runtimes safely during rollout
- Legacy parser path removable with low risk

---

## Suggested task order (cross-phase)

1. Phase 0 fixtures/tests
2. Phase 1 AST parse/serialize
3. Phase 2 canonical model
4. Phase 3 behavior engine
5. Phase 4 PM runtime package
6. Phase 5 staged app rollout + hardening
7. Final cleanup (remove legacy parser/projection-only paths)

---

## Risk register and mitigations

- **Risk:** Markdown output churn breaks user expectations  
  **Mitigation:** golden fixtures + snapshot diff approvals + serializer stability constraints.

- **Risk:** Over-coupling to ProseMirror too early  
  **Mitigation:** keep PM in separate package; `editor-core` remains headless.

- **Risk:** Performance regressions from AST pipeline  
  **Mitigation:** benchmark fixtures; cache parsed trees per edit frame if needed.

- **Risk:** API churn for current consumers  
  **Mitigation:** compatibility wrappers and deprecation period.

---

## Validation commands

- Targeted tests while iterating:
  - `bun test packages/editor-core/src/markdown-projection.test.ts`
  - `bun test packages/editor-core/src/markdown-roundtrip.test.ts` (new)
- Workspace checks before merge:
  - `bun run check`
  - `bun run typecheck`

---

## Definition of done (full plan)

We consider parity achieved when:

1. `editor-core` uses AST parsing + canonical model internally.
2. Existing projection UI works with no regressions in core editing paths.
3. Delimiter rollover, fake selection semantics, and list normalization are implemented in headless behavior modules.
4. First-party PM runtime package exists, is integrated by default in `apps/web`, and enables high-parity behavior equivalent to Hubble’s extension model.
5. Tests/fixtures and docs are sufficient for confident iteration.
