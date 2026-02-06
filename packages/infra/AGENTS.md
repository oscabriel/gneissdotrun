# AGENTS.md (packages/infra)

## Scope

- Applies to `packages/infra/**`.
- Inherit shared monorepo rules from `../../AGENTS.md`.
- If guidance conflicts, this file wins for `packages/infra` changes.

## Stack

- Alchemy Cloudflare infrastructure orchestration
- D1 database provisioning and binding
- Worker/TanStack Start deployment configuration

## Commands (Run From Repo Root)

- Infra dev orchestration: `bun --filter @gneissdotrun/infra run dev`
- Deploy infra/resources: `bun --filter @gneissdotrun/infra run deploy`
- Destroy infra/resources: `bun --filter @gneissdotrun/infra run destroy`
- Lint infra: `bunx oxlint packages/infra`
- Format infra (mutating): `bunx oxfmt --write packages/infra`
- Typecheck via monorepo: `bun run typecheck`

## Tests

- Current state: no `test` script in `packages/infra/package.json`.
- Use Bun test runner directly if tests are added.
- Run package tests: `bun test packages/infra`
- Run single test file: `bun test packages/infra/alchemy.run.test.ts`
- Run single test case: `bun test packages/infra/alchemy.run.test.ts --test-name-pattern "binds DB"`

## Infra Conventions

- Keep env loading explicit and minimal.
- Keep binding names consistent with app/server env modules.
- Keep resource creation deterministic and idempotent.
- Keep ports/entrypoints explicit in config.

## Security/Deployment Rules

- Never hardcode production secrets.
- Use secret env accessors where applicable.
- Avoid destructive infra changes unless requested.
- Keep deploy/destroy scripts unchanged unless required.

## Style

- Use `import type` for type-only imports.
- Keep infra file readable; avoid hidden side effects.
- Preserve current module style and export structure.

## Delivery Checklist

- Run relevant infra command (`dev`, `deploy`, or `destroy`) only when requested.
- Run lint/format on touched infra files.
- Re-validate app/server bindings when changing resource names.
