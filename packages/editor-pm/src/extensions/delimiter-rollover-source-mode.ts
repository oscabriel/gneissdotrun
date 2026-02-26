import type { JSONContent } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";

import { markdownToPmDoc, pmDocToMarkdown } from "../adapters";
import {
	markdownDelimiterRolloverPluginKey,
	type RolloverPluginMeta,
	type SourceBlockMode,
} from "./delimiter-rollover-shared";

type SourceTarget = {
	kind: SourceBlockMode["kind"];
	node: ProseMirrorNode;
	from: number;
	to: number;
	typeName: string;
	markdown: string;
	listPos?: number;
	itemPos?: number;
	quotePos?: number;
};

type ParsedListLine = {
	kind: "task" | "bullet" | "ordered" | "paragraph";
	paragraph: ProseMirrorNode;
	checked?: boolean;
	start?: number;
};

type ParsedQuoteLine = {
	kind: "quote" | "paragraph";
	paragraph: ProseMirrorNode;
};

function nodeHasLinkMark(node: ProseMirrorNode): boolean {
	let found = false;
	node.descendants((child) => {
		if (found || !child.isText) {
			return !found;
		}
		if (child.marks.some((mark) => mark.type.name === "link")) {
			found = true;
			return false;
		}
		return true;
	});
	return found;
}

function isTopLevelSourceConvertibleBlock(node: ProseMirrorNode): boolean {
	if (node.type.name === "codeBlock" || node.type.name === "image") {
		return true;
	}

	if (node.type.name === "paragraph" && nodeHasLinkMark(node)) {
		return true;
	}

	return false;
}

function createParagraphFromMarkdown(state: EditorState, markdown: string): ProseMirrorNode | null {
	const paragraphType = state.schema.nodes.paragraph;
	if (!paragraphType) {
		return null;
	}

	if (!markdown) {
		return paragraphType.create();
	}

	return paragraphType.create(null, state.schema.text(markdown));
}

function serializeNodeMarkdown(node: ProseMirrorNode): string {
	const doc = {
		type: "doc",
		content: [node.toJSON()],
	} satisfies JSONContent;

	return pmDocToMarkdown(doc).replace(/\n$/, "");
}

function findTopLevelSourceTarget(state: EditorState): SourceTarget | null {
	const { selection } = state;

	if (selection instanceof NodeSelection && selection.node.isBlock) {
		if (!isTopLevelSourceConvertibleBlock(selection.node)) {
			return null;
		}
		return {
			kind: "top-level",
			node: selection.node,
			from: selection.from,
			to: selection.to,
			typeName: selection.node.type.name,
			markdown: serializeNodeMarkdown(selection.node),
		};
	}

	if (selection.$from.depth < 1 || selection.$to.depth < 1) {
		return null;
	}

	const fromBefore = selection.$from.before(1);
	const toBefore = selection.$to.before(1);
	if (fromBefore !== toBefore) {
		return null;
	}

	const node = selection.$from.node(1);
	if (!isTopLevelSourceConvertibleBlock(node)) {
		return null;
	}

	return {
		kind: "top-level",
		node,
		from: fromBefore,
		to: selection.$from.after(1),
		typeName: node.type.name,
		markdown: serializeNodeMarkdown(node),
	};
}

function findListItemIndexByPos(
	listNode: ProseMirrorNode,
	listPos: number,
	itemPos: number,
): number | null {
	let match: number | null = null;
	listNode.forEach((_child, offset, index) => {
		if (match !== null) {
			return;
		}
		const childPos = listPos + 1 + offset;
		if (childPos === itemPos) {
			match = index;
		}
	});
	return match;
}

function findParagraphSourceTarget(state: EditorState): SourceTarget | null {
	const { selection } = state;
	if (!selection.empty || selection.$from.depth !== selection.$to.depth) {
		return null;
	}

	const $from = selection.$from;
	const paragraphDepth = $from.depth;
	const paragraphNode = $from.node(paragraphDepth);
	if (paragraphNode.type.name !== "paragraph") {
		return null;
	}

	const paragraphFrom = $from.before(paragraphDepth);
	const paragraphTo = $from.after(paragraphDepth);
	const paragraphMarkdown = serializeNodeMarkdown(paragraphNode);

	for (let depth = paragraphDepth - 1; depth >= 1; depth -= 1) {
		if ($from.node(depth).type.name !== "blockquote") {
			continue;
		}
		return {
			kind: "quote-line",
			node: paragraphNode,
			from: paragraphFrom,
			to: paragraphTo,
			typeName: "quote-line",
			markdown: `> ${paragraphMarkdown}`,
			quotePos: $from.before(depth),
		};
	}

	return null;
}

export function findSourceTarget(state: EditorState): SourceTarget | null {
	return findParagraphSourceTarget(state) ?? findTopLevelSourceTarget(state);
}

function setSourceSelection(
	tr: Transaction,
	selection: EditorState["selection"],
	target: SourceTarget,
	paragraphNode: ProseMirrorNode,
): void {
	const sourceTextFrom = target.from + 1;
	const sourceTextTo = sourceTextFrom + paragraphNode.content.size;
	const cursorFrom = selection.from;
	const cursorTo = selection.to;
	const clampedFrom = Math.max(target.from, Math.min(cursorFrom, target.to));
	const clampedTo = Math.max(target.from, Math.min(cursorTo, target.to));
	const sourceOffsetFrom = Math.max(0, clampedFrom - target.from - 1);
	const sourceOffsetTo = Math.max(0, clampedTo - target.from - 1);
	const prefixLength =
		target.kind === "list-line" || target.kind === "quote-line"
			? Math.max(0, target.markdown.length - serializeNodeMarkdown(target.node).length)
			: 0;
	const anchor = Math.min(sourceTextTo, sourceTextFrom + sourceOffsetFrom + prefixLength);
	const head = Math.min(sourceTextTo, sourceTextFrom + sourceOffsetTo + prefixLength);
	tr.setSelection(TextSelection.create(tr.doc, anchor, head));
}

export function enterSourceBlockMode(state: EditorState, target: SourceTarget): Transaction | null {
	const paragraphNode = createParagraphFromMarkdown(state, target.markdown);
	if (!paragraphNode) {
		return null;
	}

	const tr = state.tr
		.replaceWith(target.from, target.to, paragraphNode)
		.setMeta(markdownDelimiterRolloverPluginKey, {
			kind: "set-source-block",
			sourceBlock: {
				kind: target.kind,
				from: target.from,
				to: target.from + paragraphNode.nodeSize,
				typeName: target.typeName,
				listPos: target.listPos,
				itemPos: target.itemPos,
				quotePos: target.quotePos,
			},
		} satisfies RolloverPluginMeta)
		.setMeta("addToHistory", false);

	setSourceSelection(tr, state.selection, target, paragraphNode);
	return tr;
}

function parseMarkdownToNodes(state: EditorState, markdown: string): ProseMirrorNode[] {
	try {
		const parsed = markdownToPmDoc(markdown);
		const parsedNodes = parsed.content ?? [];
		if (parsedNodes.length === 0) {
			const paragraphType = state.schema.nodes.paragraph;
			return paragraphType ? [paragraphType.create()] : [];
		}

		return parsedNodes.map((node) => state.schema.nodeFromJSON(node));
	} catch {
		const paragraph = createParagraphFromMarkdown(state, markdown);
		return paragraph ? [paragraph] : [];
	}
}

function extractParagraphFromListItem(
	state: EditorState,
	itemNode: JSONContent | undefined,
	fallback: string,
): ProseMirrorNode {
	const paragraphJson = itemNode?.content?.find((child) => child.type === "paragraph");
	if (paragraphJson) {
		const paragraphNode = state.schema.nodeFromJSON(paragraphJson);
		if (paragraphNode.type.name === "paragraph") {
			return paragraphNode;
		}
	}

	return createParagraphFromMarkdown(state, fallback) ?? state.schema.nodes.paragraph!.create();
}

function parseListLineMarkdown(state: EditorState, markdown: string): ParsedListLine {
	const fallback =
		createParagraphFromMarkdown(state, markdown) ?? state.schema.nodes.paragraph!.create();
	try {
		const parsed = markdownToPmDoc(markdown);
		const firstNode = parsed.content?.[0];
		if (!firstNode) {
			return { kind: "paragraph", paragraph: fallback };
		}

		if (firstNode.type === "taskList") {
			const firstItem = firstNode.content?.[0];
			return {
				kind: "task",
				paragraph: extractParagraphFromListItem(state, firstItem, markdown),
				checked: Boolean(firstItem?.attrs?.checked),
			};
		}

		if (firstNode.type === "bulletList") {
			return {
				kind: "bullet",
				paragraph: extractParagraphFromListItem(state, firstNode.content?.[0], markdown),
			};
		}

		if (firstNode.type === "orderedList") {
			return {
				kind: "ordered",
				paragraph: extractParagraphFromListItem(state, firstNode.content?.[0], markdown),
				start: Number(firstNode.attrs?.start ?? 1),
			};
		}

		if (firstNode.type === "paragraph") {
			const paragraph = state.schema.nodeFromJSON(firstNode);
			if (paragraph.type.name === "paragraph") {
				return { kind: "paragraph", paragraph };
			}
		}
	} catch {
		// fall through
	}

	return { kind: "paragraph", paragraph: fallback };
}

function parseQuoteLineMarkdown(state: EditorState, markdown: string): ParsedQuoteLine {
	const fallback =
		createParagraphFromMarkdown(state, markdown) ?? state.schema.nodes.paragraph!.create();
	try {
		const parsed = markdownToPmDoc(markdown);
		const firstNode = parsed.content?.[0];
		if (!firstNode) {
			return { kind: "paragraph", paragraph: fallback };
		}

		if (firstNode.type === "blockquote") {
			const firstParagraph = firstNode.content?.find((child) => child.type === "paragraph");
			if (firstParagraph) {
				const paragraph = state.schema.nodeFromJSON(firstParagraph);
				if (paragraph.type.name === "paragraph") {
					return { kind: "quote", paragraph };
				}
			}
		}

		if (firstNode.type === "paragraph") {
			const paragraph = state.schema.nodeFromJSON(firstNode);
			if (paragraph.type.name === "paragraph") {
				return { kind: "paragraph", paragraph };
			}
		}
	} catch {
		// fall through
	}

	return { kind: "paragraph", paragraph: fallback };
}

function clearSourceBlockMode(tr: Transaction): Transaction {
	return tr.setMeta(markdownDelimiterRolloverPluginKey, {
		kind: "set-source-block",
		sourceBlock: null,
		recheckSelection: true,
	} satisfies RolloverPluginMeta);
}

function commitTopLevelSourceBlockMode(
	state: EditorState,
	source: SourceBlockMode,
): Transaction | null {
	const nodeAtSource = state.doc.nodeAt(source.from);
	if (!nodeAtSource || nodeAtSource.type.name !== "paragraph") {
		return clearSourceBlockMode(state.tr);
	}

	const markdown = nodeAtSource.textBetween(0, nodeAtSource.content.size, "\n", "\0");
	const nodes = parseMarkdownToNodes(state, markdown);
	if (nodes.length === 0) {
		return null;
	}

	return clearSourceBlockMode(
		state.tr
			.replaceWith(source.from, source.to, Fragment.fromArray(nodes))
			.setMeta("addToHistory", false),
	).setMeta("addToHistory", false);
}

function commitListLineSourceBlockMode(
	state: EditorState,
	source: SourceBlockMode,
): Transaction | null {
	if (source.listPos === undefined || source.itemPos === undefined) {
		return clearSourceBlockMode(state.tr);
	}

	const sourceNode = state.doc.nodeAt(source.from);
	const listNode = state.doc.nodeAt(source.listPos);
	const itemNode = state.doc.nodeAt(source.itemPos);
	if (
		!sourceNode ||
		sourceNode.type.name !== "paragraph" ||
		!listNode ||
		!itemNode ||
		(itemNode.type.name !== "listItem" && itemNode.type.name !== "taskItem")
	) {
		return clearSourceBlockMode(state.tr);
	}

	const markdown = sourceNode.textBetween(0, sourceNode.content.size, "\n", "\0");
	const parsed = parseListLineMarkdown(state, markdown);
	const singleItemList = listNode.childCount === 1;

	if (parsed.kind === "paragraph" && singleItemList) {
		const tr = state.tr
			.replaceWith(source.listPos, source.listPos + listNode.nodeSize, parsed.paragraph)
			.setMeta("addToHistory", false);
		return clearSourceBlockMode(tr).setMeta("addToHistory", false);
	}

	const tr = state.tr.replaceWith(source.from, source.to, parsed.paragraph);

	const listTypeByKind: Record<
		Exclude<ParsedListLine["kind"], "paragraph">,
		"taskList" | "bulletList" | "orderedList"
	> = {
		task: "taskList",
		bullet: "bulletList",
		ordered: "orderedList",
	};

	if (parsed.kind !== "paragraph") {
		const targetListTypeName = listTypeByKind[parsed.kind];
		const canConvertListType = singleItemList || listNode.type.name === targetListTypeName;
		if (canConvertListType) {
			const targetListType = state.schema.nodes[targetListTypeName];
			if (targetListType) {
				const currentStart = Number(listNode.attrs.start ?? 1);
				const itemIndex = findListItemIndexByPos(listNode, source.listPos, source.itemPos) ?? 0;
				const attrs =
					targetListTypeName === "orderedList"
						? {
								start: itemIndex === 0 ? (parsed.start ?? currentStart) : currentStart,
							}
						: {};
				tr.setNodeMarkup(source.listPos, targetListType, attrs);
			}

			if (targetListTypeName === "taskList") {
				const taskItemType = state.schema.nodes.taskItem;
				if (taskItemType) {
					tr.setNodeMarkup(source.itemPos, taskItemType, { checked: parsed.checked ?? false });
				}
			} else {
				const listItemType = state.schema.nodes.listItem;
				if (listItemType) {
					tr.setNodeMarkup(source.itemPos, listItemType, {});
				}
			}
		}
	}

	tr.setMeta("addToHistory", false);
	return clearSourceBlockMode(tr).setMeta("addToHistory", false);
}

function commitQuoteLineSourceBlockMode(
	state: EditorState,
	source: SourceBlockMode,
): Transaction | null {
	if (source.quotePos === undefined) {
		return clearSourceBlockMode(state.tr);
	}

	const sourceNode = state.doc.nodeAt(source.from);
	const quoteNode = state.doc.nodeAt(source.quotePos);
	if (
		!sourceNode ||
		sourceNode.type.name !== "paragraph" ||
		!quoteNode ||
		quoteNode.type.name !== "blockquote"
	) {
		return clearSourceBlockMode(state.tr);
	}

	const markdown = sourceNode.textBetween(0, sourceNode.content.size, "\n", "\0");
	const parsed = parseQuoteLineMarkdown(state, markdown);

	if (parsed.kind === "paragraph" && quoteNode.childCount === 1) {
		const tr = state.tr
			.replaceWith(source.quotePos, source.quotePos + quoteNode.nodeSize, parsed.paragraph)
			.setMeta("addToHistory", false);
		return clearSourceBlockMode(tr).setMeta("addToHistory", false);
	}

	const tr = state.tr
		.replaceWith(source.from, source.to, parsed.paragraph)
		.setMeta("addToHistory", false);
	return clearSourceBlockMode(tr).setMeta("addToHistory", false);
}

export function commitSourceBlockMode(
	state: EditorState,
	source: SourceBlockMode,
): Transaction | null {
	if (source.kind === "top-level") {
		return commitTopLevelSourceBlockMode(state, source);
	}
	if (source.kind === "list-line") {
		return commitListLineSourceBlockMode(state, source);
	}
	return commitQuoteLineSourceBlockMode(state, source);
}
