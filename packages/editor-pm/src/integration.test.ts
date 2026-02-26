import { describe, expect, it } from "bun:test";
import { Editor } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";

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

function pressKey(editor: Editor, key: string): boolean {
	const event = new window.KeyboardEvent("keydown", {
		key,
		bubbles: true,
		cancelable: true,
	});

	let handled = false;
	editor.view.someProp("handleKeyDown", (handler) => {
		if (handler(editor.view, event)) {
			handled = true;
			return true;
		}
		return false;
	});

	if (handled) {
		return true;
	}

	const { from, to, empty } = editor.state.selection;
	if (!empty) {
		editor.view.dispatch(editor.state.tr.delete(from, to));
		return true;
	}

	if (key === "Backspace" && from > 0) {
		editor.view.dispatch(editor.state.tr.delete(from - 1, from));
		return true;
	}

	if (key === "Delete" && from < editor.state.doc.content.size) {
		editor.view.dispatch(editor.state.tr.delete(from, from + 1));
		return true;
	}

	return false;
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

function findHorizontalRulePos(editor: Editor): number {
	let horizontalRulePos: number | null = null;
	editor.state.doc.descendants((node, pos) => {
		if (node.type.name === "horizontalRule") {
			horizontalRulePos = pos;
			return false;
		}
		return true;
	});

	if (horizontalRulePos === null) {
		throw new Error("horizontal rule node not found");
	}

	return horizontalRulePos;
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

	it("shows horizontal rule markdown delimiter when the rule is selected", () => {
		const editor = createTestEditor();
		editor.commands.setContent({
			type: "doc",
			content: [
				{ type: "paragraph", content: [{ type: "text", text: "before" }] },
				{ type: "horizontalRule" },
				{ type: "paragraph", content: [{ type: "text", text: "after" }] },
			],
		});

		const horizontalRulePos = findHorizontalRulePos(editor);
		editor.view.dispatch(
			editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, horizontalRulePos)),
		);

		const horizontalRule = editor.options.element?.querySelector("hr");
		expect(horizontalRule?.classList.contains("pm-rollover-horizontal-rule")).toBe(true);
		expect(horizontalRule?.getAttribute("data-horizontal-rule-delimiter")).toBe("---");
		expect(horizontalRule?.getAttribute("data-horizontal-rule-cursor")).toBe("node");

		editor.destroy();
		editor.options.element?.remove();
	});

	it("converts a selected horizontal rule to editable markdown text on backspace", () => {
		const editor = createTestEditor();
		editor.commands.setContent({
			type: "doc",
			content: [
				{ type: "paragraph", content: [{ type: "text", text: "before" }] },
				{ type: "horizontalRule" },
				{ type: "paragraph", content: [{ type: "text", text: "after" }] },
			],
		});

		const horizontalRulePos = findHorizontalRulePos(editor);
		editor.view.dispatch(
			editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, horizontalRulePos)),
		);

		expect(pressKey(editor, "Backspace")).toBe(true);
		expect(editor.getJSON().content?.[1]?.type).toBe("paragraph");
		expect(editor.getJSON().content?.[1]?.content?.[0]?.text).toBe("--");

		expect(pressKey(editor, "Backspace")).toBe(true);
		expect(editor.getJSON().content?.[1]?.content?.[0]?.text).toBe("-");

		editor.destroy();
		editor.options.element?.remove();
	});

	it("upgrades a markdown --- paragraph to horizontal rule on Enter", () => {
		const editor = createTestEditor();
		editor.commands.setContent({
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "---" }] }],
		});
		editor.commands.setTextSelection(4);

		expect(pressKey(editor, "Enter")).toBe(true);
		expect(editor.getJSON().content?.[0]?.type).toBe("horizontalRule");
		expect(editor.getJSON().content?.[1]?.type).toBe("paragraph");

		editor.destroy();
		editor.options.element?.remove();
	});
});
