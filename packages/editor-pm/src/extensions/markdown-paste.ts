import { Extension } from "@tiptap/core";
import { Slice } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";

import { markdownToPmDoc } from "../adapters";

function hasStructuredDelta(
	markdown: string,
	parsedDoc: ReturnType<typeof markdownToPmDoc>,
): boolean {
	const content = parsedDoc.content ?? [];
	if (content.length !== 1) {
		return true;
	}

	const onlyBlock = content[0];
	if (onlyBlock?.type !== "paragraph") {
		return true;
	}

	const inlines = onlyBlock.content ?? [];
	if (inlines.length !== 1) {
		return true;
	}

	const onlyInline = inlines[0];
	if (onlyInline?.type !== "text") {
		return true;
	}

	if ((onlyInline.marks?.length ?? 0) > 0) {
		return true;
	}

	return (onlyInline.text ?? "") !== markdown;
}

export const MarkdownPasteExtension = Extension.create({
	name: "markdownPaste",
	addProseMirrorPlugins() {
		return [
			new Plugin({
				props: {
					handlePaste: (view, event) => {
						if (view.state.selection.$from.parent.type.spec.code) {
							return false;
						}

						const plainText = event.clipboardData?.getData("text/plain") ?? "";
						if (!plainText) {
							return false;
						}

						let parsed: ReturnType<typeof markdownToPmDoc>;
						try {
							parsed = markdownToPmDoc(plainText);
						} catch {
							return false;
						}

						if (!hasStructuredDelta(plainText, parsed)) {
							return false;
						}

						try {
							const parsedNode = view.state.schema.nodeFromJSON(parsed);
							const tr = view.state.tr.replaceSelection(new Slice(parsedNode.content, 0, 0));
							view.dispatch(tr.scrollIntoView());
							return true;
						} catch {
							return false;
						}
					},
				},
			}),
		];
	},
});
