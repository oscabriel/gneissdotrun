# TanStack Start Frontend Remediation Plan (`apps/web`)

> **Status:** Phase 6 in progress
> **Owner:** Web app
> **Scope:** `apps/web` primarily, with small supporting touches in repo docs/config as needed
> **Goal:** Turn `apps/web` from a mostly client-driven React app into a TanStack Start app that actually leans on TanStack Router, TanStack Query, TanStack Form, and TanStack devtools patterns.

---

## 1) Summary

This plan is an architectural cleanup, not a visual redesign.

The biggest changes are:

1. move auth and page data to route `beforeLoad` / `loader`
2. make TanStack Query the canonical server-state layer
3. use oRPC query/mutation helpers instead of ad hoc `fetch` calls in UI code
4. break `WorkspaceShell` into composable hooks/modules
5. restore internal navigation, accessibility, and testing discipline
6. add TanStack devtools plus targeted runtime diagnostics in development

This should be executed in phases. Do not rewrite the entire frontend in one pass.

---

## 2) Constraints and Decisions Locked For This Plan

1. `apps/web` remains a TanStack Start app on the current route/file structure baseline.
2. TanStack Query becomes the single source of truth for server-backed frontend state.
3. oRPC remains the preferred typed transport for frontend data access.
4. Route guards belong in Router, not inside page components.
5. `WorkspaceShell` stops owning remote data directly; it becomes a composition root.
6. Internal app navigation must use TanStack Router primitives, not raw anchors.
7. Devtools/instrumentation stay development-only unless a later plan explicitly promotes them.
8. The migration should preserve current product behavior unless a task explicitly changes UX.
9. Route loaders remain isomorphic; server-only work belongs in TanStack Start server functions or server-facing APIs, not inside loader bodies.

---

## 3) Current Problems To Fix

### 3.1 Router/Start are underused

- Routes mostly define `component` only and do client-side auth/data loading inside React components.
- Repo guidance already says to prefer `beforeLoad` / `loader` and reuse router context.
- Evidence:
  - `apps/web/src/routes/index.tsx`
  - `apps/web/src/routes/collections.tsx`
  - `apps/web/src/routes/digest.tsx`
  - `apps/web/src/routes/history.tsx`
  - `apps/web/src/routes/contradictions.tsx`
  - `apps/web/src/routes/profile.tsx`
  - `docs/agents/workspaces.md`

### 3.2 Query/oRPC infrastructure exists but feature code ignores it

- `QueryClient` and `orpc` are wired centrally, but most feature code still uses raw `fetch`.
- This means we are missing cache reuse, invalidation, loader prefetch, SSR hydration, and typed query composition.
- Evidence:
  - `apps/web/src/utils/orpc.ts`
  - `apps/web/src/router.tsx`
  - `apps/web/src/components/workspace/workspace-shell.tsx`
  - `apps/web/src/routes/collections.tsx`
  - `apps/web/src/routes/digest.tsx`
  - `apps/web/src/routes/history.tsx`
  - `apps/web/src/routes/contradictions.tsx`
  - `apps/web/src/components/search-bar.tsx`

### 3.3 Remote state ownership is muddled

- `WorkspaceShell` keeps multiple note stores (`indexNotes`, `apiNotes`) and merges them manually.
- Agent events and API responses are acting like competing sources of truth.
- Evidence:
  - `apps/web/src/components/workspace/workspace-shell.tsx:138`
  - `apps/web/src/components/workspace/workspace-shell.tsx:203`
  - `apps/web/src/components/workspace/workspace-shell.tsx:321`
  - `apps/web/src/components/workspace/workspace-shell.tsx:338`

### 3.4 The workspace shell is too large and too coupled

- `WorkspaceShell` mixes fetching, persistence, preferences, streaming capture, hotkeys, navigation, and rendering.
- This makes testing, refactoring, and performance work harder than it should be.
- Evidence:
  - `apps/web/src/components/workspace/workspace-shell.tsx`

### 3.5 Navigation/accessibility regressions exist right now

- Several internal links are raw anchors that wrap buttons.
- Directory-search focus is wired, but the input itself is commented out.
- Prompt/confirm dialogs are still used in important flows.
- Evidence:
  - `apps/web/src/routes/collections.tsx:158`
  - `apps/web/src/routes/digest.tsx:130`
  - `apps/web/src/routes/history.tsx:163`
  - `apps/web/src/routes/contradictions.tsx:189`
  - `apps/web/src/routes/profile.tsx:45`
  - `apps/web/src/components/command-palette.tsx:41`
  - `apps/web/src/components/sidebar/notes-directory.tsx:266`
  - `apps/web/src/components/sidebar/notes-directory.tsx:483`
  - `apps/web/src/components/note-editor.tsx:540`
  - `apps/web/src/routes/history.tsx:98`
  - `apps/web/src/routes/contradictions.tsx:124`

### 3.6 Performance and observability are behind the complexity level of the app

- Both editors are statically imported.
- CodeMirror language support is broad.
- Shiki highlighting runs in multiple client paths.
- Router/query devtools are installed but unused.
- Editor telemetry is console-only.
- Evidence:
  - `apps/web/src/components/note-content-editor.tsx`
  - `apps/web/src/components/markdown-source-editor.tsx`
  - `apps/web/src/lib/editor/tiptap-extensions.ts`
  - `apps/web/src/components/markdown-preview.tsx`
  - `apps/web/package.json`
  - `apps/web/src/lib/editor-telemetry.ts`

### 3.7 Test coverage is much too small

- There is only one test file in `apps/web` today.
- Evidence:
  - `apps/web/src/lib/editor/shiki.test.ts`

---

## 4) Target End State

After this plan lands, the frontend should look like this:

### 4.1 Routing and auth

- route-level auth lives in `beforeLoad`
- page data loads in route `loader`s
- protected surfaces sit behind a pathless protected layout route
- session changes invalidate the router and auth query cleanly

### 4.2 Data layer

- a fresh `QueryClient` is created per router/request lifecycle
- supported TanStack Router + Query integration is wired up
- route loaders use `context.queryClient.ensureQueryData(...)`
- components consume `useSuspenseQuery` or `Route.useLoaderData()`
- oRPC query/mutation helpers live in shared feature modules

### 4.3 Workspace architecture

- `WorkspaceShell` becomes a light composition shell
- note data lives in Query cache, not duplicate component state
- agent/index events patch or invalidate Query cache
- local-only concerns stay in focused hooks (`preferences`, `hotkeys`, `palette`, `capture`)

### 4.4 Quality and operations

- router/query devtools are mounted in development
- targeted runtime diagnostics exist for editor/workspace flows
- internal navigation uses `Link`
- prompt/confirm flows use accessible dialogs/forms
- critical workspace and route behavior is covered by tests

---

## 5) Phase Plan

## Phase 0 - Baseline and TanStack Integration Alignment

### 0.1 Align the supported Router + Query integration path

**Files**

- `apps/web/package.json`
- `apps/web/src/router.tsx`
- `apps/web/src/routes/__root.tsx`
- `apps/web/src/utils/orpc.ts`

**Changes**

- Verify the correct TanStack Router + Query integration package for the currently installed Router/Start versions.
- Replace `@tanstack/react-router-with-query` with the supported SSR integration package (`@tanstack/react-router-ssr-query`) and wire `setupRouterSsrQueryIntegration(...)`.
- Stop treating `queryClient` as a module singleton.
- Create `QueryClient` inside router creation so query state is not shared globally by import side effect.
- Let the supported SSR integration own `QueryClientProvider` instead of keeping a manual ad hoc provider path.
- Preserve router context for `queryClient` and oRPC utilities.

**Acceptance**

- `apps/web` has one clear, supported router/query integration path.
- `QueryClient` is request/router scoped, not a global singleton export.
- SSR query dehydration/hydration flows through the supported TanStack integration package.
- Existing app boot still works before feature migration starts.

---

### 0.2 Turn on the Router/Query defaults we actually want

**Files**

- `apps/web/src/router.tsx`
- `apps/web/src/components/router/default-catch-boundary.tsx` (new)
- `apps/web/src/components/router/not-found.tsx` (new)

**Changes**

- Set `defaultPreload: "intent"` for route preloading.
- Keep `defaultPreloadStaleTime: 0` if we continue using Query loaders aggressively.
- Add a real router-wide error boundary plus a root-route not-found boundary instead of the current bare inline fallback.

**Acceptance**

- Router behavior matches TanStack Query-first navigation.
- Error and not-found states are centralized.

---

### 0.3 Mount TanStack devtools in development

**Files**

- `apps/web/src/routes/__root.tsx`
- `apps/web/src/router.tsx`
- `apps/web/src/components/router/tanstack-devtools.tsx` (new)

**Changes**

- Add Router devtools and Query devtools behind a development-only guard.
- Load devtools through a development-only/lazy path so they stay out of production bundles.
- Keep them out of production bundles.

**Acceptance**

- Developers can inspect route state and query cache in dev.
- No production behavior change.

---

## Phase 1 - Move Auth Into the Router

### 1.1 Create a session query/helper that the router can rely on

**Files**

- `apps/web/src/lib/queries/session.ts` (new)
- `apps/web/src/functions/get-user.ts`
- `apps/web/src/middleware/auth.ts`
- `apps/web/src/lib/auth-client.ts`

**Changes**

- Standardize one session-loading path for the frontend.
- Ensure the server-side auth path does not depend on React client auth helpers.
- Decide whether `getUser` remains a Start server function or whether session is loaded entirely through the existing auth API/oRPC path.
- Expose one query/options builder for session lookup.

**Acceptance**

- There is one canonical session source for router guards and page rendering.
- Server-side auth code no longer imports client-only abstractions.

---

### 1.2 Add a protected pathless route group

**Files**

- `apps/web/src/routes/_protected.tsx` (new)
- `apps/web/src/routes/_protected/collections.tsx`
- `apps/web/src/routes/_protected/digest.tsx`
- `apps/web/src/routes/_protected/history.tsx`
- `apps/web/src/routes/_protected/contradictions.tsx`
- `apps/web/src/routes/_protected/profile.tsx`

**Changes**

- Create a pathless protected layout route.
- Use `beforeLoad` to resolve session and redirect unauthenticated users before render.
- Move the protected routes under that layout.

**Acceptance**

- Protected pages no longer call `authClient.useSession()` just to decide whether they can render.
- Unauthenticated navigation redirects before page UI loads.

---

### 1.3 Clean up the `/` route

**Files**

- `apps/web/src/routes/index.tsx`
- `apps/web/src/components/sign-in-form.tsx`
- `apps/web/src/components/sign-up-form.tsx`
- `apps/web/src/routes/_protected/profile.tsx`

**Changes**

- Convert `/` to use loader-provided session state instead of `authClient.useSession()` inside the route component.
- Keep current product behavior: unauthenticated users see auth UI, authenticated users land in the workspace.
- After sign-in/sign-up/sign-out, invalidate the auth query and router so guards rerun immediately.

**Acceptance**

- The home route stops double-loading session client-side.
- Auth transitions are router-driven instead of component-driven.

---

## Phase 2 - Migrate Page Data to Query + Loaders + oRPC

### 2.1 Create feature query modules

**Files**

- `apps/web/src/lib/queries/notes.ts` (new)
- `apps/web/src/lib/queries/collections.ts` (new)
- `apps/web/src/lib/queries/digest.ts` (new)
- `apps/web/src/lib/queries/history.ts` (new)
- `apps/web/src/lib/queries/contradictions.ts` (new)
- `apps/web/src/lib/queries/search.ts` (new)
- `apps/web/src/utils/orpc.ts`

**Changes**

- Build shared oRPC/TanStack Query query and mutation option helpers by feature.
- Remove inline `fetch` request construction from route components.
- Keep query keys stable and explicit.

**Acceptance**

- Feature modules, not React components, define request details and query keys.
- Route components stop knowing about raw endpoint URLs.

---

### 2.2 Migrate the review routes first

**Files**

- `apps/web/src/routes/collections.tsx`
- `apps/web/src/routes/digest.tsx`
- `apps/web/src/routes/history.tsx`
- `apps/web/src/routes/contradictions.tsx`
- `apps/web/src/routes/profile.tsx`
- `apps/web/src/components/search-bar.tsx`

**Changes**

- Add route `loader`s that call `context.queryClient.ensureQueryData(...)`.
- Use `useSuspenseQuery` or route loader data in components.
- Convert writes to mutations with targeted invalidation instead of manual re-fetch logic.

**Acceptance**

- These pages no longer use local `isLoading` + `useEffect(fetch...)` patterns.
- Navigation to these routes can reuse prefetched/cached data.

---

### 2.3 Replace ad hoc post-action refreshes with invalidation/optimistic updates

**Files**

- `apps/web/src/routes/collections.tsx`
- `apps/web/src/routes/digest.tsx`
- `apps/web/src/routes/history.tsx`
- `apps/web/src/routes/contradictions.tsx`

**Changes**

- Replace `await loadX()` style follow-up fetches with mutation success handlers.
- Use targeted invalidation or optimistic cache updates where safe.

**Acceptance**

- Cache ownership is consistent.
- Mutations no longer manually rebuild page state from scratch.

---

## Phase 3 - Rebuild Workspace State Ownership

### 3.1 Make notes a Query-owned resource

**Files**

- `apps/web/src/components/workspace/workspace-shell.tsx`
- `apps/web/src/lib/queries/notes.ts`
- `apps/web/src/lib/agents/hooks.ts`

**Changes**

- Replace `apiNotes` and `indexNotes` dual state with Query-backed note data.
- Treat agent/index updates as cache patches, invalidations, or background refresh triggers.
- Remove manual reconciliation logic where possible.

**Acceptance**

- There is one canonical note collection in the frontend.
- Agent activity augments the cache instead of competing with it.

---

### 3.2 Split `WorkspaceShell` into focused hooks/modules

**Files**

- `apps/web/src/components/workspace/workspace-shell.tsx`
- `apps/web/src/components/workspace/use-workspace-notes.ts` (new)
- `apps/web/src/components/workspace/use-workspace-preferences.ts` (new)
- `apps/web/src/components/workspace/use-workspace-capture.ts` (new)
- `apps/web/src/components/workspace/use-workspace-shortcuts.ts` (new)
- `apps/web/src/components/workspace/use-workspace-navigation.ts` (new)

**Changes**

- Move remote data, local preferences, capture streaming, and keyboard/navigation concerns into separate hooks.
- Keep `WorkspaceShell` focused on layout and composition.

**Acceptance**

- `WorkspaceShell` is no longer the place where every workspace concern lives.
- Individual workspace behaviors become directly testable.

---

### 3.3 Normalize capture/streaming state boundaries

**Files**

- `apps/web/src/components/workspace/workspace-shell.tsx`
- `apps/web/src/components/workspace/canvas-pane.tsx`
- `apps/web/src/components/note-editor.tsx`

**Changes**

- Keep truly local/ephemeral UI state local.
- Keep persisted note data and server-backed workflow data in Query.
- Make capture streaming updates flow through one clear state model.

**Acceptance**

- Streaming UI can update without duplicating persisted note ownership.
- Post-stream persistence updates the canonical note cache correctly.

---

## Phase 4 - Router, UX, and Accessibility Cleanup

### 4.1 Replace internal anchors with Router links

**Files**

- `apps/web/src/routes/collections.tsx`
- `apps/web/src/routes/digest.tsx`
- `apps/web/src/routes/history.tsx`
- `apps/web/src/routes/contradictions.tsx`
- `apps/web/src/routes/profile.tsx`
- any shared nav/button surfaces touched during migration

**Changes**

- Replace `<a href>` for internal navigation with TanStack `Link`.
- Avoid nesting `Button` inside anchor tags.

**Acceptance**

- Internal navigation preserves router state and preload behavior.
- Invalid interactive nesting is removed.

---

### 4.2 Fix the dead directory-search shortcut path

**Files**

- `apps/web/src/components/command-palette.tsx`
- `apps/web/src/components/sidebar/notes-directory.tsx`
- `apps/web/src/components/workspace/workspace-shell.tsx`

**Changes**

- Either restore the actual search input or remove the focus shortcut/action until the feature exists.
- Do not keep dead command-palette actions.

**Acceptance**

- Every command-palette action points to a real UI affordance.

---

### 4.3 Replace `window.prompt` / `window.confirm` with accessible dialogs and forms

**Files**

- `apps/web/src/components/note-editor.tsx`
- `apps/web/src/routes/history.tsx`
- `apps/web/src/routes/contradictions.tsx`
- supporting dialog/form components under `apps/web/src/components/`

**Changes**

- Replace rename, revert, and contradiction-resolution prompt flows with accessible dialog components.
- Use TanStack Form for dialog-backed input flows where validation is needed.

**Acceptance**

- These flows are keyboard-accessible and testable.
- No important flow depends on browser prompt/confirm dialogs.

---

### 4.4 Revisit tree semantics and mobile drawer accessibility

**Files**

- `apps/web/src/components/sidebar/file-tree.tsx`
- `apps/web/src/components/sidebar/notes-directory.tsx`
- `apps/web/src/components/layout/workspace-grid-shell.tsx`

**Changes**

- Either finish the tree semantics properly or intentionally simplify to a list/navigation pattern.
- Ensure mobile panels behave like accessible dialogs/drawers.

**Acceptance**

- Keyboard navigation is intentional and screen-reader semantics are coherent.

---

## Phase 5 - Performance and Bundle Cleanup

### 5.1 Split heavy editor surfaces

**Files**

- `apps/web/src/components/note-content-editor.tsx`
- `apps/web/src/components/rich-text-editor.tsx`
- `apps/web/src/components/markdown-preview.tsx`
- `apps/web/src/components/highlighted-code-block.tsx`

**Changes**

- Lazy-load rich editor, preview, and heavy code-highlighting paths where possible.
- Keep the default workspace load focused on the mode the user actually needs first.

**Acceptance**

- Initial workspace bundle no longer eagerly loads every editor surface.

---

### 5.2 Reduce editor/highlighting cost

**Files**

- `apps/web/src/components/markdown-source-editor.tsx`
- `apps/web/src/lib/editor/tiptap-extensions.ts`
- `apps/web/src/lib/editor/shiki.ts`

**Changes**

- Reduce CodeMirror language payload if broad language-data import is unnecessary.
- Reassess whether Shiki should run entirely on the client for both preview and rich editor.
- Prefer a narrower language set or deferred highlighting strategy.

**Acceptance**

- Syntax highlighting remains correct enough for current product needs.
- Editor-related JS cost drops measurably.

---

### 5.3 Delete dead UI code after migration stabilizes

**Files**

- unused components discovered during the migration, for example:
  - `apps/web/src/components/layout/app-shell.tsx`
  - `apps/web/src/components/header.tsx`
  - `apps/web/src/components/user-menu.tsx`
  - `apps/web/src/components/upload-panel.tsx`
  - `apps/web/src/components/text-area-field.tsx`

**Changes**

- Confirm unused components and remove them.
- Remove stale imports, styles, and dependencies that become unnecessary.

**Acceptance**

- The web workspace contains fewer dead components and less maintenance surface.

---

## Phase 6 - Observability and TanStack Diagnostics

### 6.1 Replace console-only diagnostics with structured development instrumentation

**Files**

- `apps/web/src/lib/editor-telemetry.ts`
- `apps/web/src/lib/agents/hooks.ts`
- `apps/web/src/components/workspace/workspace-shell.tsx`
- new instrumentation modules under `apps/web/src/lib/devtools/` if needed

**Changes**

- Use the TanStack Intent skill mappings already added to `AGENTS.md` for `@tanstack/devtools-event-client`.
- Add one typed event client for workspace/editor diagnostics.
- Emit high-value events only at architecture boundaries: query lifecycle, workspace capture lifecycle, note persistence, editor parse/serialize failures.
- Keep all instrumentation behind a development guard.

**Acceptance**

- Runtime debugging no longer depends only on `console.info` / `console.error`.
- Instrumentation is structured and intentionally scoped.

---

### 6.2 Wire web-vitals and route-level performance visibility

**Files**

- app entry/root files in `apps/web/src/`

**Changes**

- Use the installed `web-vitals` package.
- Record baseline navigation/render metrics for the workspace and review routes.

**Acceptance**

- Performance work in Phase 5 has baseline metrics to compare against.

---

## Phase 7 - Tests and Quality Gates

### 7.1 Add route-level tests for auth and loaders

**Files**

- `apps/web/src/routes/*.test.tsx` (new)

**Changes**

- Add tests for:
  - protected-route redirects
  - loader success/error behavior
  - session-driven home route behavior

**Acceptance**

- Auth and loader regressions are caught without manual QA.

---

### 7.2 Add workspace behavior tests around the new hook boundaries

**Files**

- `apps/web/src/components/workspace/*.test.tsx` (new)
- `apps/web/src/components/note-editor.test.tsx` (new)
- `apps/web/src/components/command-palette.test.tsx` (new)

**Changes**

- Cover note loading, note selection, capture flows, command-palette actions, and dialog-based flows.
- Keep repo-specific test constraints in mind:
  - mock `agents` / `agents/workflows` before dynamic import where needed
  - guard `window.matchMedia`
  - wire both `onChange` and `onInput` in mocked text inputs when necessary

**Acceptance**

- The most failure-prone workspace interactions are under test.

---

### 7.3 Add accessibility-focused tests for navigation surfaces

**Files**

- tests around `notes-directory`, `file-tree`, dialogs, and drawers

**Changes**

- Add assertions for keyboard flow and visible/accessible states.

**Acceptance**

- Accessibility fixes from Phase 4 stay fixed.

---

## 6) Suggested Execution Order

1. Phase 0
2. Phase 1
3. Phase 2 review routes
4. Phase 3 workspace state ownership
5. Phase 4 router/accessibility cleanup
6. Phase 5 performance cleanup
7. Phase 6 instrumentation/devtools depth
8. Phase 7 tests and hardening

This ordering front-loads architecture and data ownership before performance polish.

---

## 7) Milestone Breakdown

### Milestone A - TanStack foundation corrected

- router/query integration aligned
- devtools mounted in development
- auth moved into the router

### Milestone B - Review routes modernized

- review routes use loaders + Query + mutations
- raw route-local `fetch` patterns are removed from those pages

### Milestone C - Workspace state untangled

- notes are Query-owned
- `WorkspaceShell` is decomposed
- agent/index events no longer create a second note store

### Milestone D - Quality uplift complete

- internal navigation fixed
- prompt/confirm flows replaced
- key interactions tested
- performance and diagnostics upgraded

---

## 8) Risks and Mitigations

### Risk: Router/query integration package mismatch or upgrade churn

- **Mitigation:** resolve Phase 0 first and keep the integration decision isolated before wider migration.

### Risk: Auth migration touches nearly every route

- **Mitigation:** land the protected route group first, then migrate routes one by one.

### Risk: Workspace behavior regressions during state ownership changes

- **Mitigation:** migrate review routes before touching `WorkspaceShell`, then add tests around the new hook boundaries.

### Risk: Performance work changes editor behavior

- **Mitigation:** separate bundle-splitting from editor behavior changes and verify both source/rich flows manually.

---

## 9) Verification

From repo root:

- `bun run check`
- `bunx turbo -F web typecheck`
- `bunx turbo -F web build`

Manual verification checklist:

- authenticated and unauthenticated navigation across `/`, `/collections`, `/digest`, `/history`, `/contradictions`, `/profile`
- note list loads and updates correctly in the workspace
- capture flow still streams and persists correctly
- command palette actions all point to working UI affordances
- internal navigation does not cause full document reloads
- dialogs work by keyboard
- devtools show query and route state in development

---

## 10) Definition of Done

- route auth and page data are handled by Router/Start primitives instead of per-page `useEffect` fetch flows
- TanStack Query is the canonical frontend server-state layer
- oRPC/TanStack Query helpers replace raw route-level REST fetch code in the main frontend surfaces
- `WorkspaceShell` is decomposed and no longer maintains duplicate note stores
- internal app navigation uses Router links consistently
- accessible dialog-based flows replace browser prompt/confirm usage
- router/query devtools and structured development diagnostics exist
- critical workspace and route behavior is covered by tests
- `apps/web` passes check, typecheck, and build
