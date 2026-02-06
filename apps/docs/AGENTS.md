# AGENTS.md (apps/docs)

## Scope

- Applies to `apps/docs/**`.
- Inherit shared monorepo rules from `../../AGENTS.md`.
- If guidance conflicts, this file wins for `apps/docs` changes.

## Stack

- Astro + Starlight documentation site
- Markdown/MDX content in `src/content/docs`
- Content collections configured in `src/content.config.ts`

## Commands (Run From Repo Root)

- Dev server: `bun --filter docs run dev`
- Build docs: `bun --filter docs run build`
- Preview docs: `bun --filter docs run preview`
- Typecheck docs: `bun --filter docs run typecheck`
- Lint docs: `bunx oxlint apps/docs`
- Format docs (mutating): `bunx oxfmt --write apps/docs`

## Tests

- Current state: no `test` script in `apps/docs/package.json`.
- Use Bun test runner directly for any added tests.
- Run workspace tests: `bun test apps/docs`
- Run single test file: `bun test apps/docs/src/content/docs/example.test.ts`
- Run single test case: `bun test apps/docs/src/content/docs/example.test.ts --test-name-pattern "renders heading"`

## Docs Content Conventions

- Keep page metadata in frontmatter (`title`, `description`).
- Keep navigation definitions aligned with `astro.config.mjs` sidebar.
- Prefer clear, task-oriented documentation over marketing copy.
- Keep examples runnable and consistent with actual repo commands.

## Style

- Keep file names/content structure consistent with Starlight defaults.
- Use concise headings and short sections.
- Preserve existing Markdown/MDX style in touched files.
- Keep TS strictness from `astro/tsconfigs/strict`.

## Generated Files

- Do not manually edit `apps/docs/.astro/*`.
- Treat `.astro` output as generated/tool-managed.

## Delivery Checklist

- Run `bun --filter docs run typecheck`.
- Run build for substantial docs/config changes.
- Run lint/format for touched docs paths.
