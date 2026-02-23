# Editor Architecture Map

The editor stack now runs on a single canonical model with a PM runtime.

1. `@gneissdotrun/editor-core` (headless)
   - AST markdown parse/serialize (`src/markdown/*`)
   - canonical document model (`src/model/document.ts`)
   - markdown/canonical converters (`src/model/converters/markdown.ts`)
   - headless behavior engine (`src/behaviors/*`)
2. `@gneissdotrun/editor-pm` (runtime adapter)
   - canonical `<->` ProseMirror JSON adapters (`src/adapters.ts`)
   - PM extension bundle (`src/extensions/*`)
3. `apps/web` (product integration)
   - PM editor component (`src/components/pm-markdown-editor.tsx`)
   - note workflow integration (`src/components/note-editor.tsx`)

## Runtime model

- PM/TipTap is the only app runtime path.
- There are no projection/canonical feature-flag modes in `apps/web`.

## Data flow

- Markdown input -> canonical model (`editor-core`) -> PM JSON (`editor-pm`) for editing.
- Runtime updates in PM mode serialize PM JSON back to canonical, then markdown.

## Compatibility/deprecation notes

- Projection wrappers and runtime bridges were removed.
- New editor behavior should be implemented through canonical + behavior-engine APIs.
