import { describe, expect, it } from "bun:test";
import { Editor } from "@tiptap/core";

import "./test-dom";
import { createEditorPmExtensions } from "./extensions";

function typeText(editor: Editor, text: string): void {
	for (const char of text) {
		const { from, to } = editor.state.selection;
		let handled = false;
		editor.view.someProp("handleTextInput", (handler) => {
			if (handler(editor.view, from, to, char)) {
				handled = true;
				return true;
			}
			return false;
		});
		if (!handled) {
			editor.view.dispatch(editor.state.tr.insertText(char, from, to));
		}
	}
}

describe("editor-pm integration", () => {
	it("mounts an editor instance with extension bundle", () => {
		const host = document.createElement("div");
		document.body.appendChild(host);

		const editor = new Editor({
			element: host,
			extensions: createEditorPmExtensions(),
			content: "<h1>Hello</h1><p>World</p>",
		});

		expect(editor.isDestroyed).toBe(false);
		expect(editor.getHTML()).toContain("Hello");

		editor.destroy();
		host.remove();
	});

	it("converts backtick-delimited inline code while typing", () => {
		const host = document.createElement("div");
		document.body.appendChild(host);

		const editor = new Editor({
			element: host,
			extensions: createEditorPmExtensions({ includeShikiHighlight: false }),
			content: {
				type: "doc",
				content: [{ type: "paragraph" }],
			},
		});

		editor.commands.focus("end");
		typeText(editor, "`inline code`");

		expect(editor.getHTML()).toContain("<code>inline code</code>");

		editor.destroy();
		host.remove();
	});
});
