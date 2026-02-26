import { describe, expect, it } from "bun:test";
import { Editor } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";

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

function pasteText(editor: Editor, text: string): void {
	const event = new window.Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
	Object.defineProperty(event, "clipboardData", {
		value: {
			getData: (type: string) => (type === "text/plain" ? text : ""),
		},
	});

	let handled = false;
	editor.view.someProp("handlePaste", (handler) => {
		if (handler(editor.view, event, new Slice(Fragment.empty, 0, 0))) {
			handled = true;
			return true;
		}
		return false;
	});

	if (!handled) {
		const { from, to } = editor.state.selection;
		editor.view.dispatch(editor.state.tr.insertText(text, from, to));
	}
}

function createTestEditor(): Editor {
	const host = document.createElement("div");
	document.body.appendChild(host);
	return new Editor({
		element: host,
		extensions: createEditorPmExtensions({ includeShikiHighlight: false }),
		content: {
			type: "doc",
			content: [{ type: "paragraph" }],
		},
	});
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
		const editor = createTestEditor();
		editor.commands.focus("end");
		typeText(editor, "`inline code`");

		expect(editor.getHTML()).toContain("<code>inline code</code>");

		editor.destroy();
		editor.options.element?.remove();
	});

	it("converts markdown paste into structured nodes", () => {
		const editor = createTestEditor();
		editor.commands.focus("end");
		pasteText(editor, "# Heading\n\n> quote\n\n- one\n- two");

		const json = editor.getJSON();
		expect(json.content?.[0]?.type).toBe("heading");
		expect(json.content?.[1]?.type).toBe("blockquote");
		expect(json.content?.[2]?.type).toBe("bulletList");

		editor.destroy();
		editor.options.element?.remove();
	});

	it("converts - [x] task syntax while typing", () => {
		const editor = createTestEditor();
		editor.commands.focus("end");
		typeText(editor, "- [x] ");

		const json = editor.getJSON();
		expect(json.content?.[0]?.type).toBe("taskList");
		expect(json.content?.[0]?.content?.[0]?.attrs?.checked).toBe(true);

		editor.destroy();
		editor.options.element?.remove();
	});

	it("converts markdown link syntax while typing", () => {
		const editor = createTestEditor();
		editor.commands.focus("end");
		typeText(editor, "[docs](https://example.com)");

		expect(editor.getHTML()).toContain('href="https://example.com"');

		editor.destroy();
		editor.options.element?.remove();
	});

	it("converts markdown image syntax while typing", () => {
		const editor = createTestEditor();
		editor.commands.focus("end");
		typeText(editor, '![alt text](https://cdn.example.com/a.png "title")');

		const json = editor.getJSON();
		expect(json.content?.[0]?.type).toBe("image");
		expect(json.content?.[0]?.attrs?.src).toBe("https://cdn.example.com/a.png");

		editor.destroy();
		editor.options.element?.remove();
	});

	it("removes markdown escape slash while typing", () => {
		const editor = createTestEditor();
		editor.commands.focus("end");
		typeText(editor, "\\*");

		expect(editor.state.doc.textContent).toBe("*");

		editor.destroy();
		editor.options.element?.remove();
	});

	it("converts ***text*** and ___text___ to bold+italic", () => {
		const editor = createTestEditor();
		editor.commands.focus("end");
		typeText(editor, "***alpha*** ");
		typeText(editor, "___beta___");

		const html = editor.getHTML();
		expect(html).toContain("<strong><em>");
		expect(editor.state.doc.textContent).toContain("alpha");
		expect(editor.state.doc.textContent).toContain("beta");

		editor.destroy();
		editor.options.element?.remove();
	});

	it("parses pasted markdown tables into table nodes", () => {
		const editor = createTestEditor();
		editor.commands.focus("end");
		pasteText(editor, "| a | b |\n| - | - |\n| 1 | 2 |");

		const json = editor.getJSON();
		expect(json.content?.[0]?.type).toBe("table");
		expect(json.content?.[0]?.content?.[0]?.type).toBe("tableRow");

		editor.destroy();
		editor.options.element?.remove();
	});
});
