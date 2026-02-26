import { beforeAll, describe, expect, it } from "bun:test";
import { Fragment, Slice } from "@tiptap/pm/model";
import { JSDOM } from "jsdom";

if (typeof window === "undefined") {
	const dom = new JSDOM("<!doctype html><html><body></body></html>", {
		url: "https://pm-markdown-editor.test",
	});
	(globalThis as typeof globalThis & { window: Window }).window = dom.window as unknown as Window;
	(globalThis as typeof globalThis & { document: Document }).document = dom.window.document;
	(globalThis as typeof globalThis & { navigator: Navigator }).navigator = dom.window
		.navigator as unknown as Navigator;
	(globalThis as typeof globalThis & { HTMLElement: typeof HTMLElement }).HTMLElement = dom.window
		.HTMLElement as typeof HTMLElement;
	(globalThis as typeof globalThis & { Node: typeof Node }).Node = dom.window.Node as typeof Node;
	(
		globalThis as typeof globalThis & { requestAnimationFrame: typeof requestAnimationFrame }
	).requestAnimationFrame = (callback: FrameRequestCallback) =>
		setTimeout(() => callback(performance.now()), 16) as unknown as number;
	(
		globalThis as typeof globalThis & { cancelAnimationFrame: typeof cancelAnimationFrame }
	).cancelAnimationFrame = (handle: number) =>
		clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
}

type TiptapEditorClass = typeof import("@tiptap/core").Editor;
type CreateEditorPmExtensions = typeof import("@gneissdotrun/editor-pm").createEditorPmExtensions;
type MarkdownToPmDoc = typeof import("@gneissdotrun/editor-pm").markdownToPmDoc;

type InlineCodeFallback = (
	view: import("@tiptap/pm/view").EditorView,
	from: number,
	to: number,
	text: string,
) => boolean;

let Editor: TiptapEditorClass;
let createEditorPmExtensions: CreateEditorPmExtensions;
let markdownToPmDoc: MarkdownToPmDoc;
let tryInlineCodeInputRuleFallback: InlineCodeFallback;

beforeAll(async () => {
	({ Editor } = await import("@tiptap/core"));
	({ createEditorPmExtensions, markdownToPmDoc } = await import("@gneissdotrun/editor-pm"));
	({ tryInlineCodeInputRuleFallback } = await import("./pm-markdown-editor"));
});

function typeText(editor: import("@tiptap/core").Editor, text: string): void {
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

function pasteText(editor: import("@tiptap/core").Editor, text: string): void {
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

function createTestEditor(content?: object): import("@tiptap/core").Editor {
	const host = document.createElement("div");
	document.body.appendChild(host);
	return new Editor({
		element: host,
		extensions: createEditorPmExtensions({ includeShikiHighlight: false }),
		content:
			content ??
			({
				type: "doc",
				content: [{ type: "paragraph" }],
			} as const),
		editorProps: {
			handleTextInput: (view, from, to, text) => {
				return tryInlineCodeInputRuleFallback(view, from, to, text);
			},
		},
	});
}

describe("pm markdown inline code fallback", () => {
	it("stops inline code formatting when the closing backtick is typed", () => {
		const editor = createTestEditor();

		editor.commands.focus("end");
		typeText(editor, "We are here to see if `inline code blocks` work.");

		expect(editor.getHTML()).toContain("<code>inline code blocks</code> work.");

		editor.destroy();
		editor.options.element?.remove();
	});

	it("does not delete the character immediately after the closing backtick", () => {
		const editor = createTestEditor({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "prefix inline suffix" }],
				},
			],
		});

		const rawText = editor.state.doc.textContent;
		const startIndex = rawText.indexOf("inline");
		const endIndex = startIndex + "inline".length;

		editor.commands.setTextSelection(startIndex + 1);
		typeText(editor, "`");
		editor.commands.setTextSelection(endIndex + 2);
		typeText(editor, "`");

		expect(editor.getHTML()).toContain("prefix <code>inline</code> suffix");

		editor.destroy();
		editor.options.element?.remove();
	});
});

describe("pm markdown editor markdown coverage", () => {
	it("converts pasted markdown headings/lists/code fences/quotes immediately", () => {
		const editor = createTestEditor();
		editor.commands.focus("end");
		pasteText(editor, "# Heading\n\n> Quote\n\n- item\n\n```ts\nconst n = 1\n```");

		const json = editor.getJSON();
		expect(json.content?.[0]?.type).toBe("heading");
		expect(json.content?.[1]?.type).toBe("blockquote");
		expect(json.content?.[2]?.type).toBe("bulletList");
		expect(json.content?.[3]?.type).toBe("codeBlock");

		editor.destroy();
		editor.options.element?.remove();
	});

	it("converts task list markdown while typing", () => {
		const editor = createTestEditor();
		editor.commands.focus("end");
		typeText(editor, "- [x] ");

		expect(editor.getJSON().content?.[0]?.type).toBe("taskList");
		expect(editor.getJSON().content?.[0]?.content?.[0]?.attrs?.checked).toBe(true);

		editor.destroy();
		editor.options.element?.remove();
	});

	it("converts blockquote markdown while typing", () => {
		const editor = createTestEditor();
		editor.commands.focus("end");
		typeText(editor, "> quote");

		expect(editor.getJSON().content?.[0]?.type).toBe("blockquote");

		editor.destroy();
		editor.options.element?.remove();
	});

	it("converts markdown link syntax while typing", () => {
		const editor = createTestEditor();
		editor.commands.focus("end");
		typeText(editor, "[label](https://example.com)");

		expect(editor.getHTML()).toContain('href="https://example.com"');

		editor.destroy();
		editor.options.element?.remove();
	});

	it("converts markdown image syntax while typing", () => {
		const editor = createTestEditor();
		editor.commands.focus("end");
		typeText(editor, "![alt](https://cdn.example.com/example.png)");

		expect(editor.getJSON().content?.[0]?.type).toBe("image");

		editor.destroy();
		editor.options.element?.remove();
	});

	it("converts pasted markdown tables", () => {
		const editor = createTestEditor();
		editor.commands.focus("end");
		pasteText(editor, "| a | b |\n| - | - |\n| 1 | 2 |");

		expect(editor.getJSON().content?.[0]?.type).toBe("table");

		editor.destroy();
		editor.options.element?.remove();
	});

	it("resolves escaped markdown characters", () => {
		const editor = createTestEditor();
		editor.commands.focus("end");
		typeText(editor, "a\\# b\\! c\\|");

		expect(editor.state.doc.textContent).toContain("a# b! c|");

		editor.destroy();
		editor.options.element?.remove();
	});

	it("converts ***bold+italic*** syntax", () => {
		const editor = createTestEditor();
		editor.commands.focus("end");
		typeText(editor, "***both***");

		expect(editor.getHTML()).toContain("<strong><em>both</em></strong>");

		editor.destroy();
		editor.options.element?.remove();
	});

	it("renders wiki-link attribute when loading persisted markdown", () => {
		const editor = createTestEditor(markdownToPmDoc("[[Roadmap]]"));

		const markAttrs = editor.getJSON().content?.[0]?.content?.[0]?.marks?.[0]?.attrs as
			| Record<string, string>
			| undefined;
		expect(markAttrs?.["data-wiki-link"]).toBe("Roadmap");

		editor.destroy();
		editor.options.element?.remove();
	});
});
