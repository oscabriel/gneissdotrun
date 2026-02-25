import { describe, expect, it } from "bun:test";
import { Editor } from "@tiptap/core";
import type { Decoration } from "@tiptap/pm/view";

import "../test-dom";
import { createEditorPmExtensions } from "./bundle";
import { markdownDelimiterRolloverPluginKey } from "./delimiter-rollover";

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
