import { beforeAll, describe, expect, it } from "bun:test";
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
	(globalThis as typeof globalThis & { requestAnimationFrame: typeof requestAnimationFrame })
		.requestAnimationFrame = (callback: FrameRequestCallback) =>
			setTimeout(() => callback(performance.now()), 16) as unknown as number;
	(globalThis as typeof globalThis & { cancelAnimationFrame: typeof cancelAnimationFrame })
		.cancelAnimationFrame = (handle: number) =>
			clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
}

type TiptapEditorClass = typeof import("@tiptap/core").Editor;
type CreateEditorPmExtensions = typeof import("@gneissdotrun/editor-pm").createEditorPmExtensions;

type InlineCodeFallback = (
	view: import("@tiptap/pm/view").EditorView,
	from: number,
	to: number,
	text: string,
) => boolean;

let Editor: TiptapEditorClass;
let createEditorPmExtensions: CreateEditorPmExtensions;
let tryInlineCodeInputRuleFallback: InlineCodeFallback;

beforeAll(async () => {
	({ Editor } = await import("@tiptap/core"));
	({ createEditorPmExtensions } = await import("@gneissdotrun/editor-pm"));
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

describe("pm markdown inline code fallback", () => {
	it("stops inline code formatting when the closing backtick is typed", () => {
		const host = document.createElement("div");
		document.body.appendChild(host);

		const editor = new Editor({
			element: host,
			extensions: createEditorPmExtensions({ includeShikiHighlight: false }),
			content: {
				type: "doc",
				content: [{ type: "paragraph" }],
			},
			editorProps: {
				handleTextInput: (view, from, to, text) => {
					return tryInlineCodeInputRuleFallback(view, from, to, text);
				},
			},
		});

		editor.commands.focus("end");
		typeText(editor, "We are here to see if `inline code blocks` work.");

		expect(editor.getHTML()).toContain("<code>inline code blocks</code> work.");

		editor.destroy();
		host.remove();
	});

	it("does not delete the character immediately after the closing backtick", () => {
		const host = document.createElement("div");
		document.body.appendChild(host);

		const editor = new Editor({
			element: host,
			extensions: createEditorPmExtensions({ includeShikiHighlight: false }),
			content: {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: "prefix inline suffix" }],
					},
				],
			},
			editorProps: {
				handleTextInput: (view, from, to, text) => {
					return tryInlineCodeInputRuleFallback(view, from, to, text);
				},
			},
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
		host.remove();
	});
});
