import { describe, expect, it } from "bun:test";
import { Editor } from "@tiptap/core";

import "./test-dom";
import { createEditorPmExtensions } from "./extensions";

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
});
