# Editor Deprecation Notes

## Removed APIs and bridges

The following compatibility surfaces were removed:

- `parseProjectionMarkdown(markdown)`
- `serializeProjectionMarkdown(projection)`
- `parseInlineMarkdown(input)`
- `serializeInlineMarkdown(segments)`
- Projection model exports (`ProjectionDocument`, `ProjectionLine`, `ProjectionInlineSegment`)
- Projection converter exports (`canonicalToProjection`, `projectionToCanonical`)
- Web runtime mode toggles (`projection`/`canonical`/`pm`)

## Current expectations

- `editor-core` is canonical-first.
- `editor-pm` is the app runtime integration layer.
- `apps/web` uses PM runtime only.

## Contributor guidance

- Build new features on canonical document + behavior engine APIs.
- Do not reintroduce projection compatibility wrappers or runtime fallback modes.
