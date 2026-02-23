import { describe, expect, it } from "bun:test";
import { Editor } from "@tiptap/core";

import "./test-dom";
import { createEditorPmExtensions } from "./extensions";

describe("editor-pm extensions", () => {
	it("builds extension bundle with parity features", () => {
		const extensions = createEditorPmExtensions();
		const names = extensions.map((extension) => extension.name);

		expect(names).toContain("delimiterRollover");
		expect(names).toContain("fakeSelection");
		expect(names).toContain("listNormalization");
	});

	it("supports fake-selection state transitions", () => {
		const element = document.createElement("div");
		const editor = new Editor({
			element,
			extensions: createEditorPmExtensions(),
			content: "<p>Hello world</p>",
		});

		editor.commands.setTextSelection({ from: 1, to: 5 });
		const froze = editor.commands.freezeSelection();
		expect(froze).toBe(true);
		expect(editor.storage.fakeSelection.frozenSelection).toEqual({ from: 1, to: 5 });

		const restored = editor.commands.restoreSelection({ focus: false });
		expect(restored).toBe(true);
		expect(editor.storage.fakeSelection.frozenSelection).toBeNull();

		editor.destroy();
	});
});
