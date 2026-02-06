# AGENTS.md (packages/config)

## Scope

- Applies to `packages/config/**`.
- Inherit shared monorepo rules from `../../AGENTS.md`.
- If guidance conflicts, this file wins for `packages/config` changes.

## Package Role

- This workspace holds shared TypeScript configuration.
- Main artifact: `packages/config/tsconfig.base.json`.
- Changes here affect multiple apps/packages transitively.

## Commands (Run From Repo Root)

- No local package scripts currently.
- Validate via monorepo typecheck: `bun run typecheck`
- Validate formatting/lint:
- `bunx oxlint packages/config`
- `bunx oxfmt --write packages/config`

## Tests

- Current state: no test files/scripts in this package.
- If tests are added, use Bun test runner.
- Run package tests: `bun test packages/config`
- Run single test file: `bun test packages/config/config.test.ts`
- Run single test case: `bun test packages/config/config.test.ts --test-name-pattern "extends base"`

## TS Config Conventions

- Keep `strict: true` and bundler-compatible settings.
- Avoid weakening safety flags (`noUnused*`, `noUncheckedIndexedAccess`, etc.).
- Prefer additive, backward-compatible config updates.
- Keep worker/node type declarations intentional and minimal.

## Change Safety

- Treat config edits as high-impact and cross-workspace.
- Validate at least the directly affected workspace typecheck after changes.
- Avoid introducing framework-specific settings in shared base unless truly global.

## Style

- Keep JSON structure concise and comment-light.
- Preserve existing key grouping/order when practical.
- Let formatter control whitespace/tabs.

## Delivery Checklist

- Run `bun run typecheck` after meaningful config changes.
- Run lint/format on touched config files.
- Confirm no unrelated workspace behavior changed unexpectedly.
