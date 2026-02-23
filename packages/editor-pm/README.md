# @gneissdotrun/editor-pm

ProseMirror/TipTap runtime package for `@gneissdotrun/editor-core`.

## What it provides

- Canonical model `<->` ProseMirror JSON adapters
- Markdown `<->` PM JSON bridge via `editor-core`
- Extension bundle with:
  - delimiter rollover behavior
  - fake selection decorations
  - list normalization and task list support
  - wiki-link aware link attributes

## Usage

```ts
import { Editor } from "@tiptap/core";
import {
	createEditorPmExtensions,
	markdownToPmDoc,
	pmDocToMarkdown,
} from "@gneissdotrun/editor-pm";

const editor = new Editor({
	element: document.querySelector("#editor")!,
	extensions: createEditorPmExtensions(),
	content: markdownToPmDoc("# Hello [[Roadmap]]"),
	onUpdate: ({ editor }) => {
		const markdown = pmDocToMarkdown(editor.getJSON());
		console.log(markdown);
	},
});
```

## Notes

- `editor-core` remains runtime-agnostic and does not depend on PM.
- This package is the default runtime path for app integrations.
