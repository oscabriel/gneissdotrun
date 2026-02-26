import type { EditorState } from "@tiptap/pm/state";

import type { SourceBlockMode } from "./delimiter-rollover-shared";

export function paragraphStartAtSelectionPos(
	selection: EditorState["selection"],
	side: "from" | "to",
) {
	const $pos = side === "from" ? selection.$from : selection.$to;
	for (let depth = $pos.depth; depth > 0; depth -= 1) {
		if ($pos.node(depth).type.name !== "paragraph") {
			continue;
		}
		return $pos.before(depth);
	}
	return null;
}

export function sourceSelectionInside(
	selection: EditorState["selection"],
	source: SourceBlockMode,
): boolean {
	if (source.kind === "list-line" || source.kind === "quote-line") {
		const fromParagraphStart = paragraphStartAtSelectionPos(selection, "from");
		const toParagraphStart = paragraphStartAtSelectionPos(selection, "to");
		return fromParagraphStart === source.from && toParagraphStart === source.from;
	}

	return selection.from >= source.from && selection.to <= source.to;
}
