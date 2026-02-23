# Contributor Guide: Behaviors + PM Extensions

## Add a headless behavior (`editor-core`)

1. Add or update behavior types in `packages/editor-core/src/behaviors/types.ts`.
2. Implement behavior module in `packages/editor-core/src/behaviors/`.
3. Add deterministic unit tests plus integration sequence tests.
4. Export from `packages/editor-core/src/index.ts`.

Behavior modules should be deterministic and runtime-agnostic.

## Add a PM extension (`editor-pm`)

1. Implement extension in `packages/editor-pm/src/extensions/`.
2. Keep PM/plugin specifics in `editor-pm` only.
3. Add tests for plugin transitions and integration mounting.
4. Register in `createEditorPmExtensions()` if it is part of default product behavior.

## Add markdown/canonical transformations

1. Update parse pipeline in `packages/editor-core/src/markdown/parse.ts`.
2. Update serializer in `packages/editor-core/src/markdown/serialize.ts`.
3. Add fixture updates under `packages/editor-core/src/__fixtures__/markdown/`.
4. Run snapshot + roundtrip tests.

## Validation checklist

- `bun test packages/editor-core/src`
- `bun test packages/editor-pm/src`
- `bun test apps/web/src/components/note-editor.test.tsx`
- `bun run check`
- `bun run typecheck`
