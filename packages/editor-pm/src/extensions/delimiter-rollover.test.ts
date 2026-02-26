import { describe, expect, it } from "bun:test";
import { Editor } from "@tiptap/core";
import type { Decoration } from "@tiptap/pm/view";

import "../test-dom";
import { createEditorPmExtensions } from "./bundle";
import { markdownDelimiterRolloverPluginKey } from "./delimiter-rollover";

if (typeof KeyboardEvent === "undefined") {
	(globalThis as unknown as { KeyboardEvent: typeof window.KeyboardEvent }).KeyboardEvent =
		window.KeyboardEvent;
}

function getRolloverDecorations(editor: Editor): Decoration[] {
	const plugin = editor.state.plugins.find(
		(candidate) => candidate.key === markdownDelimiterRolloverPluginKey.key,
	);
	const decorationSet = plugin?.props.decorations?.(editor.state);
	if (!decorationSet) {
		return [];
	}
	return decorationSet.find();
}

function topLevelBlockStart(editor: Editor, index: number): number {
	let pos = 1;
	for (let cursor = 0; cursor < index; cursor += 1) {
		pos += editor.state.doc.child(cursor).nodeSize;
	}
	return pos;
}

function paragraphStartByText(editor: Editor, text: string, occurrence = 0): number {
	let seen = 0;
	let matchPos: number | null = null;
	editor.state.doc.descendants((node, pos) => {
		if (node.type.name !== "paragraph" || node.textContent !== text) {
			return true;
		}
		if (seen === occurrence) {
			matchPos = pos;
			return false;
		}
		seen += 1;
		return true;
	});
	if (matchPos === null) {
		throw new Error(`Could not find paragraph with text: ${text}`);
	}
	return matchPos + 1;
}

describe("delimiter rollover markdown projection", () => {
	it("renders bold and italic delimiters around marked text on the active line", () => {
		const element = document.createElement("div");
		const editor = new Editor({
			element,
			extensions: createEditorPmExtensions(),
			content: {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{ type: "text", text: "A " },
							{
								type: "text",
								text: "bold",
								marks: [{ type: "bold" }],
							},
							{ type: "text", text: " and " },
							{
								type: "text",
								text: "it",
								marks: [{ type: "italic" }],
							},
						],
					},
				],
			},
		});

		editor.commands.setTextSelection(2);

		const decorations = getRolloverDecorations(editor);
		const markers = decorations.filter((decoration) => {
			return decoration.spec.markerRole === "open" || decoration.spec.markerRole === "close";
		});

		expect(markers).toHaveLength(4);

		expect(
			markers.find(
				(decoration) =>
					decoration.spec.markName === "bold" && decoration.spec.markerRole === "open",
			)?.from,
		).toBe(3);
		expect(
			markers.find(
				(decoration) =>
					decoration.spec.markName === "bold" && decoration.spec.markerRole === "close",
			)?.from,
		).toBe(7);
		expect(
			markers.find(
				(decoration) =>
					decoration.spec.markName === "italic" && decoration.spec.markerRole === "open",
			)?.from,
		).toBe(12);
		expect(
			markers.find(
				(decoration) =>
					decoration.spec.markName === "italic" && decoration.spec.markerRole === "close",
			)?.from,
		).toBe(14);

		editor.destroy();
	});

	it("does not project inline code delimiters as markdown widgets", () => {
		const element = document.createElement("div");
		const editor = new Editor({
			element,
			extensions: createEditorPmExtensions(),
			content: {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{ type: "text", text: "A " },
							{
								type: "text",
								text: "code",
								marks: [{ type: "code" }],
							},
						],
					},
				],
			},
		});

		editor.commands.setTextSelection(2);

		const decorations = getRolloverDecorations(editor);
		const codeDelimiters = decorations.filter((decoration) => decoration.spec.symbol === "`");
		expect(codeDelimiters).toHaveLength(0);

		editor.destroy();
	});

	it("does not render delimiter widgets at the cursor when inside marked text", () => {
		const element = document.createElement("div");
		const editor = new Editor({
			element,
			extensions: createEditorPmExtensions(),
			content: {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{ type: "text", text: "A " },
							{
								type: "text",
								text: "bold",
								marks: [{ type: "bold" }],
							},
						],
					},
				],
			},
		});

		editor.commands.setTextSelection(4);
		const cursorPos = editor.state.selection.from;

		const decorations = getRolloverDecorations(editor);
		const markerAtCursor = decorations.some((decoration) => {
			return decoration.spec.markerRole !== undefined && decoration.from === cursorPos;
		});

		expect(markerAtCursor).toBe(false);

		editor.destroy();
	});

	it("renders heading markers for the active heading line", () => {
		const element = document.createElement("div");
		const editor = new Editor({
			element,
			extensions: createEditorPmExtensions(),
			content: {
				type: "doc",
				content: [
					{
						type: "heading",
						attrs: { level: 3 },
						content: [{ type: "text", text: "Title" }],
					},
					{
						type: "paragraph",
						content: [{ type: "text", text: "Body" }],
					},
				],
			},
		});

		editor.commands.setTextSelection(2);

		const decorations = getRolloverDecorations(editor);
		const headingPrefix = decorations.find(
			(decoration) => decoration.spec.markerRole === "heading-prefix",
		);

		expect(headingPrefix?.from).toBe(1);
		expect(headingPrefix?.spec.symbol).toBe("### ");

		editor.destroy();
	});

	it("switches only the active blockquote paragraph to markdown source and restores on exit", () => {
		const element = document.createElement("div");
		const editor = new Editor({
			element,
			extensions: createEditorPmExtensions({ includeShikiHighlight: false }),
			content: {
				type: "doc",
				content: [
					{
						type: "blockquote",
						content: [
							{ type: "paragraph", content: [{ type: "text", text: "Quote A" }] },
							{ type: "paragraph", content: [{ type: "text", text: "Quote B" }] },
						],
					},
					{ type: "paragraph", content: [{ type: "text", text: "Tail" }] },
				],
			},
		});

		editor.commands.setTextSelection(paragraphStartByText(editor, "Quote A") + 1);
		expect(editor.getJSON().content?.[0]?.type).toBe("blockquote");
		expect(editor.state.doc.child(0)?.child(0)?.textContent).toBe("> Quote A");
		expect(editor.state.doc.child(0)?.child(1)?.textContent).toBe("Quote B");

		editor.commands.focus("end");
		expect(editor.state.doc.child(0)?.type.name).toBe("blockquote");
		expect(editor.state.doc.child(0)?.child(0)?.textContent).toBe("Quote A");
		expect(editor.state.doc.child(0)?.child(1)?.textContent).toBe("Quote B");

		editor.destroy();
	});

	it("keeps list items rendered while navigating list selections", () => {
		const element = document.createElement("div");
		const editor = new Editor({
			element,
			extensions: createEditorPmExtensions({ includeShikiHighlight: false }),
			content: {
				type: "doc",
				content: [
					{
						type: "bulletList",
						content: [
							{
								type: "listItem",
								content: [{ type: "paragraph", content: [{ type: "text", text: "item a" }] }],
							},
							{
								type: "listItem",
								content: [{ type: "paragraph", content: [{ type: "text", text: "item b" }] }],
							},
						],
					},
					{
						type: "taskList",
						content: [
							{
								type: "taskItem",
								attrs: { checked: false },
								content: [{ type: "paragraph", content: [{ type: "text", text: "todo a" }] }],
							},
							{
								type: "taskItem",
								attrs: { checked: true },
								content: [{ type: "paragraph", content: [{ type: "text", text: "done b" }] }],
							},
						],
					},
					{ type: "paragraph", content: [{ type: "text", text: "Tail" }] },
				],
			},
		});

		editor.commands.setTextSelection(paragraphStartByText(editor, "item a") + 1);
		expect(editor.state.doc.child(0)?.child(0)?.child(0)?.textContent).toBe("item a");

		editor.commands.setTextSelection(paragraphStartByText(editor, "done b") + 1);
		expect(editor.state.doc.child(1)?.child(1)?.child(0)?.textContent).toBe("done b");
		expect(
			getRolloverDecorations(editor).some(
				(decoration) => decoration.spec.markerRole === "list-source-item",
			),
		).toBe(false);

		editor.destroy();
	});

	it("keeps ordered list start stable when editing a non-first list line", () => {
		const element = document.createElement("div");
		const editor = new Editor({
			element,
			extensions: createEditorPmExtensions({ includeShikiHighlight: false }),
			content: {
				type: "doc",
				content: [
					{
						type: "orderedList",
						attrs: { start: 1 },
						content: [
							{
								type: "listItem",
								content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }],
							},
							{
								type: "listItem",
								content: [{ type: "paragraph", content: [{ type: "text", text: "b" }] }],
							},
						],
					},
					{ type: "paragraph", content: [{ type: "text", text: "Tail" }] },
				],
			},
		});

		editor.commands.setTextSelection(paragraphStartByText(editor, "b") + 1);
		expect(editor.state.doc.child(0)?.type.name).toBe("orderedList");
		expect(Number(editor.state.doc.child(0)?.attrs.start ?? 1)).toBe(1);
		expect(editor.state.doc.child(0)?.child(1)?.child(0)?.textContent).toBe("b");

		editor.commands.focus("end");
		expect(Number(editor.state.doc.child(0)?.attrs.start ?? 1)).toBe(1);
		expect(editor.state.doc.child(0)?.child(1)?.child(0)?.textContent).toBe("b");

		editor.destroy();
	});

	it("creates the next list entry on Enter in bullet lists", () => {
		const element = document.createElement("div");
		const editor = new Editor({
			element,
			extensions: createEditorPmExtensions({ includeShikiHighlight: false }),
			content: {
				type: "doc",
				content: [
					{
						type: "bulletList",
						content: [
							{
								type: "listItem",
								content: [{ type: "paragraph", content: [{ type: "text", text: "item a" }] }],
							},
						],
					},
				],
			},
		});

		editor.commands.setTextSelection(paragraphStartByText(editor, "item a") + "item a".length);
		editor.commands.enter();

		expect(editor.state.doc.child(0)?.type.name).toBe("bulletList");
		expect(editor.state.doc.child(0)?.childCount).toBe(2);
		expect(editor.state.doc.child(0)?.child(0)?.child(0)?.textContent).toBe("item a");
		expect(editor.state.doc.child(0)?.child(1)?.child(0)?.textContent).toBe("");

		editor.destroy();
	});

	it("projects markdown source for links, images, and fenced code blocks with editable fences", () => {
		const element = document.createElement("div");
		const editor = new Editor({
			element,
			extensions: createEditorPmExtensions({ includeShikiHighlight: false }),
			content: {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{
								type: "text",
								text: "label",
								marks: [{ type: "link", attrs: { href: "https://example.com", title: null } }],
							},
						],
					},
					{
						type: "image",
						attrs: { src: "https://cdn.example.com/a.png", alt: "Alt", title: null },
					},
					{
						type: "codeBlock",
						attrs: { language: "ts" },
						content: [{ type: "text", text: "const n = 1;" }],
					},
					{ type: "paragraph", content: [{ type: "text", text: "Tail" }] },
				],
			},
		});

		editor.commands.setTextSelection(topLevelBlockStart(editor, 0) + 1);
		expect(editor.state.doc.child(0)?.type.name).toBe("paragraph");
		expect(editor.state.doc.child(0)?.textContent).toBe("[label](https://example.com)");

		editor.commands.setNodeSelection(topLevelBlockStart(editor, 1) - 1);
		editor.commands.setNodeSelection(topLevelBlockStart(editor, 1) - 1);
		expect(editor.state.doc.child(1)?.type.name).toBe("paragraph");
		expect(editor.state.doc.child(1)?.textContent).toContain(
			"![Alt](https://cdn.example.com/a.png)",
		);

		editor.commands.setTextSelection(topLevelBlockStart(editor, 2) + 1);
		editor.commands.setTextSelection(topLevelBlockStart(editor, 2) + 1);
		expect(editor.state.doc.child(2)?.type.name).toBe("paragraph");
		expect(editor.state.doc.child(2)?.textContent).toContain("```ts\nconst n = 1;\n```");
		expect(
			getRolloverDecorations(editor).some(
				(decoration) => decoration.spec.markerRole === "code-source-block",
			),
		).toBe(true);

		const codeSourceStart = topLevelBlockStart(editor, 2);
		const sourceText = editor.state.doc.child(2)?.textContent ?? "";
		const updatedSource = sourceText.replace("```ts", "```tsx");
		editor.view.dispatch(
			editor.state.tr.insertText(
				updatedSource,
				codeSourceStart + 1,
				codeSourceStart + 1 + sourceText.length,
			),
		);

		editor.commands.focus("end");
		expect(editor.state.doc.child(0)?.type.name).toBe("paragraph");
		expect(editor.state.doc.child(0)?.firstChild?.marks?.[0]?.type.name).toBe("link");
		expect(editor.state.doc.child(1)?.type.name).toBe("image");
		expect(editor.state.doc.child(2)?.type.name).toBe("codeBlock");
		expect(editor.state.doc.child(2)?.attrs.language).toBe("tsx");

		editor.destroy();
	});

	it("enters code fence source projection immediately when focus activates without selection movement", () => {
		const element = document.createElement("div");
		const editor = new Editor({
			element,
			extensions: createEditorPmExtensions({ includeShikiHighlight: false }),
			content: {
				type: "doc",
				content: [
					{
						type: "codeBlock",
						attrs: { language: "ts" },
						content: [{ type: "text", text: "const n = 1;" }],
					},
				],
			},
		});

		editor.commands.setTextSelection(2);
		editor.view.dispatch(
			editor.state.tr.setMeta(markdownDelimiterRolloverPluginKey, {
				kind: "set-active",
				active: false,
			}),
		);
		expect(editor.state.doc.child(0)?.type.name).toBe("codeBlock");

		editor.view.dispatch(
			editor.state.tr.setMeta(markdownDelimiterRolloverPluginKey, {
				kind: "set-active",
				active: true,
			}),
		);
		expect(editor.state.doc.child(0)?.type.name).toBe("paragraph");
		expect(editor.state.doc.child(0)?.textContent).toContain("```ts\nconst n = 1;\n```");

		editor.destroy();
	});

	it("hides decorations when plugin is marked inactive", () => {
		const element = document.createElement("div");
		const editor = new Editor({
			element,
			extensions: createEditorPmExtensions(),
			content: {
				type: "doc",
				content: [
					{
						type: "heading",
						attrs: { level: 2 },
						content: [{ type: "text", text: "Title" }],
					},
				],
			},
		});

		editor.commands.setTextSelection(2);
		expect(getRolloverDecorations(editor).length).toBeGreaterThan(0);

		editor.view.dispatch(
			editor.state.tr.setMeta(markdownDelimiterRolloverPluginKey, {
				kind: "set-active",
				active: false,
			}),
		);
		expect(getRolloverDecorations(editor)).toHaveLength(0);

		editor.destroy();
	});
});
