# TanStack Start Frontend Remediation Summary (`apps/web`)

> **Status:** Phase 6 in progress
> **Source of truth:** `docs/plans/TANSTACK-START-FRONTEND-REMEDIATION-PLAN.md`
> **Scope covered here:** work completed so far across the remediation effort

---

## 1) Overview

This summary captures the implementation progress made against the TanStack Start frontend remediation plan for `apps/web`.

The remediation has already delivered the core architectural migration the plan called for:

1. auth moved into TanStack Router/Start primitives
2. TanStack Query became the canonical frontend server-state layer
3. review data flows moved from ad hoc route fetches to oRPC-backed query helpers
4. `WorkspaceShell` was decomposed into focused hooks and composition boundaries
5. navigation and accessibility regressions were cleaned up
6. performance work began with substantial bundle splitting and editor/highlighting reductions
7. structured development diagnostics replaced console-only editor telemetry

---

## 2) Current Status by Phase

### Phase 0 - Baseline and TanStack Integration Alignment

**Status:** complete

Completed:

- replaced `@tanstack/react-router-with-query` with `@tanstack/react-router-ssr-query`
- stopped using a module-scope singleton `QueryClient`
- added `createQueryClient()` and scoped query client creation to router creation/request lifecycle
- wired `setupRouterSsrQueryIntegration(...)`
- enabled router defaults like `defaultPreload: "intent"` and kept query-first preload staleness behavior
- added centralized router error and not-found UI surfaces
- mounted TanStack Router/Query devtools behind a development-only lazy path

Key files:

- `apps/web/src/router.tsx`
- `apps/web/src/routes/__root.tsx`
- `apps/web/src/utils/orpc.ts`
- `apps/web/src/components/router/default-catch-boundary.tsx`
- `apps/web/src/components/router/not-found.tsx`
- `apps/web/src/components/router/tanstack-devtools.tsx`

### Phase 1 - Move Auth Into the Router

**Status:** complete

Completed:

- added a canonical session query helper for router guards and page rendering
- fixed server-side auth middleware to use `@gneissdotrun/auth` instead of client-only React auth helpers
- added a pathless protected route group and moved protected pages under it
- converted `/` to loader-provided session state instead of `authClient.useSession()`
- ensured sign-in, sign-up, and sign-out invalidate session query state and router guards immediately

Key files:

- `apps/web/src/lib/queries/session.ts`
- `apps/web/src/middleware/auth.ts`
- `apps/web/src/routes/_protected.tsx`
- `apps/web/src/routes/index.tsx`
- `apps/web/src/components/sign-in-form.tsx`
- `apps/web/src/components/sign-up-form.tsx`

### Phase 2 - Migrate Page Data to Query + Loaders + oRPC

**Status:** complete

Completed:

- added typed oRPC procedures for review and notes data in `packages/api`
- extended API context and supporting history utilities for the new procedures
- created feature query modules in `apps/web/src/lib/queries/`
- migrated review routes to route loaders plus TanStack Query cache usage
- removed temporary route-local REST wrappers in favor of oRPC-backed query helpers
- replaced ad hoc route refresh flows with invalidation-driven query ownership

Key files:

- `packages/api/src/context.ts`
- `packages/api/src/history.ts`
- `packages/api/src/routers/index.ts`
- `packages/api/src/routers/notes.ts`
- `packages/api/src/routers/review.ts`
- `apps/web/src/lib/queries/collections.ts`
- `apps/web/src/lib/queries/digest.ts`
- `apps/web/src/lib/queries/history.ts`
- `apps/web/src/lib/queries/contradictions.ts`
- `apps/web/src/lib/queries/search.ts`
- `apps/web/src/lib/queries/notes.ts`

### Phase 3 - Rebuild Workspace State Ownership

**Status:** complete

Completed:

- made notes Query-owned instead of maintaining separate competing API and index stores in `WorkspaceShell`
- shifted note refresh/update responsibility into query cache helpers and mutation flows
- extracted focused workspace hooks for notes, capture, preferences, shortcuts, and navigation
- reduced `WorkspaceShell` to a composition root rather than a monolithic state owner
- kept ephemeral capture state local while persisted note state remains query-backed

Key files:

- `apps/web/src/components/workspace/workspace-shell.tsx`
- `apps/web/src/components/workspace/use-workspace-notes.ts`
- `apps/web/src/components/workspace/use-workspace-capture.ts`
- `apps/web/src/components/workspace/use-workspace-preferences.ts`
- `apps/web/src/components/workspace/use-workspace-shortcuts.ts`
- `apps/web/src/components/workspace/use-workspace-navigation.ts`

### Phase 4 - Router, UX, and Accessibility Cleanup

**Status:** complete

Completed:

- replaced important `window.prompt` / `window.confirm` flows with reusable accessible dialogs
- converted remaining internal review-route navigation from raw anchors to TanStack `Link`
- removed the dead command-palette directory-search action and stale shortcut wiring
- restored the notes directory filter UI and aligned it with working keyboard behavior
- replaced the faux tree surface with clearer nested disclosure/list semantics and roving keyboard focus
- converted mobile workspace side panels into dialog-backed drawers with titles, close controls, and `aria-*` state

Key files:

- `apps/web/src/components/dialogs/confirm-dialog.tsx`
- `apps/web/src/components/dialogs/text-prompt-dialog.tsx`
- `apps/web/src/components/sidebar/file-tree.tsx`
- `apps/web/src/components/sidebar/notes-directory.tsx`
- `apps/web/src/components/layout/workspace-grid-shell.tsx`
- `apps/web/src/components/workspace/right-utility-sidebar.tsx`
- `apps/web/src/components/command-palette.tsx`
- `apps/web/src/components/command-palette.test.js`

### Phase 5 - Performance and Bundle Cleanup

**Status:** in progress, substantially advanced

Completed so far:

- lazy-loaded `WorkspaceShell` from the home route so `/` no longer eagerly includes the full authenticated workspace runtime
- lazy-loaded markdown preview and rich editor surfaces from `NoteContentEditor`
- kept focus behavior working across lazy editor loads
- moved Shiki imports behind runtime boundaries for preview and Tiptap code-block highlighting
- extracted lightweight code-language parsing so preview paths do not import full Shiki helpers unnecessarily
- replaced broad Shiki bundle loading with an explicit allowlist of supported languages and themes
- split the rich editor into a tiny wrapper chunk plus a heavy implementation chunk
- deferred rich-mode support analysis until users actually enter rich mode
- eliminated the client large-chunk build warning during the web build

Key files:

- `apps/web/src/routes/index.tsx`
- `apps/web/src/components/note-content-editor.tsx`
- `apps/web/src/components/rich-text-editor.tsx`
- `apps/web/src/components/rich-text-editor-impl.tsx`
- `apps/web/src/components/highlighted-code-block.tsx`
- `apps/web/src/lib/editor/code-language.ts`
- `apps/web/src/lib/editor/shiki.ts`
- `apps/web/src/lib/editor/tiptap-extensions.ts`

Current Phase 5 outcome:

- default workspace loading is materially more segmented than the original all-in-one editor path
- rich editor, preview, and highlighter paths now load much later and more selectively
- server/editor-heavy chunks still exist, but the worst client-side eager loading has been reduced significantly

### Phase 6 - Observability and TanStack Diagnostics

**Status:** in progress

Completed so far:

- introduced a development-only structured diagnostics client using `@tanstack/devtools-event-client`
- replaced editor console-only reporting with typed devtools event emission while keeping console output for immediate debugging
- added editor diagnostic events around rich-mode support lifecycle
- added consolidated workspace capture lifecycle events for capture, organize, and fan-out flows
- added note persistence events for create, save, archive, and restore flows

Key files:

- `apps/web/src/lib/devtools/workspace-devtools.ts`
- `apps/web/src/lib/editor-telemetry.ts`
- `apps/web/src/components/note-content-editor.tsx`
- `apps/web/src/components/workspace/use-workspace-capture.ts`
- `apps/web/src/components/workspace/use-workspace-notes.ts`

Remaining likely Phase 6 work:

- add `web-vitals` / route-level performance visibility
- wire these events into an immediately inspectable devtools workflow or panel

### Phase 7 - Tests and Quality Gates

**Status:** not started as a full phase

Completed so far:

- added a regression test ensuring the removed directory-search command-palette action stays gone
- kept editor highlight tests passing through the performance work

Still open:

- route auth/loader tests
- workspace hook boundary tests
- accessibility-focused navigation/dialog tests

---

## 3) Notable Architectural Outcomes Already Achieved

The plan is no longer just an audit document. It has already been converted into implemented architecture.

Notable outcomes:

- Router/Start primitives now own auth and major route-loading boundaries.
- Query is the canonical server-state layer for the main web app surfaces.
- oRPC-backed query helpers now replace the old route-level REST-style fetch sprawl for review data.
- `WorkspaceShell` is no longer the single source of truth for every workspace concern.
- navigation/accessibility regressions called out in the plan were actually removed rather than merely documented.
- bundle and editor-loading work is underway with real chunking changes already landed.
- development diagnostics now have a structured foundation instead of relying only on `console.info` and `console.error`.

---

## 4) Verification Completed Repeatedly During This Work

The following commands were run repeatedly and kept green as the remediation progressed:

- `bunx turbo -F @gneissdotrun/api typecheck`
- `bunx turbo -F web typecheck`
- `bunx turbo -F web build`
- `bun test apps/web/src/components/command-palette.test.js`
- `bun test apps/web/src/lib/editor/shiki.test.ts`

Additional repo-wide expectations from the plan remain:

- `bun run check`
- manual verification across auth navigation, workspace note loading, capture flows, router navigation, and dialog keyboard support

---

## 5) Important Learnings and Course Corrections Applied During Execution

- TanStack Router integration was corrected to the supported SSR query path instead of relying on the old integration package.
- integration/devtools package versions do not necessarily match `@tanstack/react-router` exactly; published TanStack integration packages can lag behind router core.
- `apps/web` TypeScript 6 deprecation handling required the repo-specific `ignoreDeprecations` workaround already captured in repo learnings.
- command-palette dead paths were removed instead of preserved.
- Kumo dialog interaction tests were not retained after the quick jsdom harness proved unreliable; the repo stayed green instead of keeping brittle tests.
- client bundle cleanup was more effective when done in layers: route chunking first, then surface chunking, then Shiki reduction, then rich-editor second-stage loading.

---

## 6) What Remains To Reach Full Definition of Done

Primary remaining work:

1. finish Phase 5 by pushing editor/runtime cost down further where it is still justified
2. finish Phase 6 with route/workspace performance visibility and practical event inspection
3. complete Phase 7 with route, workspace, and accessibility-focused tests

At this point the biggest architectural goals are already in place. The remaining work is mostly performance depth, diagnostics depth, and test coverage hardening rather than foundational migration.
