import { Fragment } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";

import {
	markdownDelimiterRolloverPluginKey,
	type RolloverPluginMeta,
} from "./delimiter-rollover-shared";

export type ActiveHorizontalRuleRange = {
	from: number;
	to: number;
	cursor: "start" | "end" | "node";
};

export type HorizontalRuleEditTarget = {
	from: number;
	to: number;
	cursor: "start" | "end";
};

export function findActiveHorizontalRuleRange(
	state: EditorState,
): ActiveHorizontalRuleRange | null {
	const { selection } = state;

	if (selection instanceof NodeSelection && selection.node.type.name === "horizontalRule") {
		return {
			from: selection.from,
			to: selection.to,
			cursor: "node",
		};
	}

	if (!selection.empty) {
		return null;
	}

	const { $from, from } = selection;
	const nodeBefore = $from.nodeBefore;
	if (nodeBefore?.type.name === "horizontalRule") {
		return {
			from: from - nodeBefore.nodeSize,
			to: from,
			cursor: "end",
		};
	}

	const nodeAfter = $from.nodeAfter;
	if (nodeAfter?.type.name === "horizontalRule") {
		return {
			from,
			to: from + nodeAfter.nodeSize,
			cursor: "start",
		};
	}

	return null;
}

export function resolveHorizontalRuleEditTarget(
	state: EditorState,
	key: "Backspace" | "Delete",
): HorizontalRuleEditTarget | null {
	const { selection } = state;

	if (selection instanceof NodeSelection && selection.node.type.name === "horizontalRule") {
		return {
			from: selection.from,
			to: selection.to,
			cursor: key === "Backspace" ? "end" : "start",
		};
	}

	if (!selection.empty) {
		return null;
	}

	const { $from, from } = selection;
	if (key === "Backspace") {
		const nodeBefore = $from.nodeBefore;
		if (nodeBefore?.type.name === "horizontalRule") {
			return {
				from: from - nodeBefore.nodeSize,
				to: from,
				cursor: "end",
			};
		}
		return null;
	}

	const nodeAfter = $from.nodeAfter;
	if (nodeAfter?.type.name === "horizontalRule") {
		return {
			from,
			to: from + nodeAfter.nodeSize,
			cursor: "start",
		};
	}

	return null;
}

export function convertHorizontalRuleToMarkdownText(
	state: EditorState,
	target: HorizontalRuleEditTarget,
	dispatch?: (tr: Transaction) => void,
): boolean {
	const paragraphType = state.schema.nodes.paragraph;
	if (!paragraphType) {
		return false;
	}

	const markdownText = "--";
	const paragraph = paragraphType.create(null, state.schema.text(markdownText));
	const tr = state.tr
		.replaceWith(target.from, target.to, paragraph)
		.setMeta(markdownDelimiterRolloverPluginKey, {
			kind: "set-boundary",
			boundary: null,
		} satisfies RolloverPluginMeta);

	const cursorPos = target.from + 1 + (target.cursor === "end" ? markdownText.length : 0);
	tr.setSelection(TextSelection.create(tr.doc, cursorPos));
	dispatch?.(tr.scrollIntoView());
	return true;
}

function shouldUpgradeParagraphToHorizontalRuleOnEnter(state: EditorState): boolean {
	const { selection } = state;
	if (!selection.empty) {
		return false;
	}

	const { $from } = selection;
	const parent = $from.parent;
	if (!parent.isTextblock || parent.type.name !== "paragraph") {
		return false;
	}

	if ($from.parentOffset !== parent.content.size) {
		return false;
	}

	return parent.textBetween(0, parent.content.size, "\n", "\0") === "---";
}

export function upgradeMarkdownParagraphToHorizontalRule(
	state: EditorState,
	dispatch?: (tr: Transaction) => void,
): boolean {
	if (!shouldUpgradeParagraphToHorizontalRuleOnEnter(state)) {
		return false;
	}

	const horizontalRuleType = state.schema.nodes.horizontalRule;
	const paragraphType = state.schema.nodes.paragraph;
	if (!horizontalRuleType || !paragraphType) {
		return false;
	}

	const { $from } = state.selection;
	const paragraphDepth = $from.depth;
	const paragraphNode = $from.node(paragraphDepth);
	if (paragraphNode.type.name !== "paragraph") {
		return false;
	}

	const paragraphFrom = $from.before(paragraphDepth);
	const paragraphTo = $from.after(paragraphDepth);
	const horizontalRuleNode = horizontalRuleType.create();
	const trailingParagraph = paragraphType.create();
	const tr = state.tr.replaceWith(
		paragraphFrom,
		paragraphTo,
		Fragment.fromArray([horizontalRuleNode, trailingParagraph]),
	);

	const cursorPos = tr.mapping.map(paragraphFrom) + horizontalRuleNode.nodeSize + 1;
	tr.setSelection(TextSelection.create(tr.doc, cursorPos));
	dispatch?.(tr.scrollIntoView());
	return true;
}
