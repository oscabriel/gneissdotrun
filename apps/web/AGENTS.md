# AGENTS.md (apps/web)

## Scope

- Applies to `apps/web/**`.
- Inherit shared monorepo rules from `../../AGENTS.md`.
- If guidance conflicts, this file wins for `apps/web` changes.

## Stack

- TanStack Start + React + Vite
- TanStack Router + TanStack Query
- oRPC client utilities
- Tailwind CSS + shadcn/ui components

## Commands (Run From Repo Root)

- Start web in turbo graph: `bun run dev:web`
- Start web directly: `bun --filter web run dev:bare`
- Build web: `bun --filter web run build`
- Typecheck web: `bun --filter web run typecheck`
- Lint web: `bunx oxlint apps/web`
- Format web (mutating): `bunx oxfmt --write apps/web`

## Tests

- Current state: no `test` script in `apps/web/package.json`.
- Use Bun test runner directly.
- Run all web tests (if present): `bun test apps/web`
- Run single test file: `bun test apps/web/src/routes/todos.test.tsx`
- Run single test case: `bun test apps/web/src/routes/todos.test.tsx --test-name-pattern "adds todo"`
- Prefer file-targeted runs while iterating.

## Routing/Data Patterns

- Keep route modules in `apps/web/src/routes`.
- Prefer route lifecycle APIs (`beforeLoad`, `loader`) for auth/data prefetch when needed.
- Use route context for shared instances (`orpc`, `queryClient`) rather than recreating per component.
- Keep server functions in `apps/web/src/functions` with middleware in `apps/web/src/middleware`.

## Style And Architecture

- Keep strict TypeScript; do not relax compiler flags.
- Use `import type` for type-only imports.
- Import grouping order:
- 1. third-party packages
- 2. `@/` alias imports
- 3. relative imports
- Use `@/` alias instead of deep relative paths where available.
- Prefer small, focused route/components; extract reusable UI to `components/`.
- Keep form validation with Zod/TanStack Form at input boundaries.

## Error Handling

- Surface user-visible async errors with toast notifications (`sonner`).
- Keep query-level defaults centralized (see `src/utils/orpc.ts`).
- Avoid silent failures in UI actions; preserve actionable messages.

## Naming/Files

- Components/types: `PascalCase`.
- Functions/vars/hooks: `camelCase`.
- Route and utility file names follow existing conventions (`kebab-case`, `__root.tsx`).
- Do not manually edit generated route tree: `apps/web/src/routeTree.gen.ts`.

## Generated Or Tool-Managed

- Treat as generated: `apps/web/src/routeTree.gen.ts`.
- Regenerate via project tooling; do not hand-edit unless absolutely required.

## Delivery Checklist

- Run the narrowest relevant commands (`typecheck`, targeted tests).
- Run lint/format for touched paths.
- Keep edits minimal and avoid cross-workspace refactors unless requested.
