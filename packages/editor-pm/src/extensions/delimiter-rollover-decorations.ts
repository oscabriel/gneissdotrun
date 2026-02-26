import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { findActiveHorizontalRuleRange } from "./delimiter-rollover-horizontal-rule";
import type {
	RolloverBoundary,
	RolloverMarkName,
	SourceBlockMode,
} from "./delimiter-rollover-shared";

type MarkRange = {
	markName: RolloverMarkName;
	from: number;
	to: number;
};

type ActiveTextBlock = {
	node: ProseMirrorNode;
	start: number;
};

const ROLLOVER_DELIMITERS: Record<RolloverMarkName, string> = {
	bold: "**",
	italic: "*",
	strike: "~~",
};

const MARK_ORDER: RolloverMarkName[] = ["bold", "italic", "strike"];

function findActiveTextBlock(state: EditorState): ActiveTextBlock | null {
	const $from = state.selection.$from;
	for (let depth = $from.depth; depth > 0; depth -= 1) {
		const node = $from.node(depth);
		if (!node.isTextblock) {
			continue;
		}
		return {
			node,
			start: $from.start(depth),
		};
	}
	return null;
}

function collectMarkRanges(block: ActiveTextBlock): MarkRange[] {
	const ranges: MarkRange[] = [];

	for (const markName of MARK_ORDER) {
		let rangeStart: number | null = null;

		block.node.forEach((child, offset) => {
			const from = block.start + offset;
			const hasMark = child.isText && child.marks.some((mark) => mark.type.name === markName);

			if (hasMark && rangeStart === null) {
				rangeStart = from;
				return;
			}
			if (!hasMark && rangeStart !== null) {
				ranges.push({
					markName,
					from: rangeStart,
					to: from,
				});
				rangeStart = null;
			}
		});

		if (rangeStart !== null) {
			ranges.push({
				markName,
				from: rangeStart,
				to: block.start + block.node.content.size,
			});
		}
	}

	return ranges;
}

export function getBoundaryMarkRange(
	state: EditorState,
	boundary: Exclude<RolloverBoundary, null>,
): MarkRange | null {
	const activeBlock = findActiveTextBlock(state);
	if (!activeBlock) {
		return null;
	}
	const ranges = collectMarkRanges(activeBlock);
	return (
		ranges.find(
			(range) =>
				range.markName === boundary.markName &&
				(range.from === boundary.pos || range.to === boundary.pos),
		) ?? null
	);
}

export function detectBoundary(state: EditorState): RolloverBoundary {
	if (!state.selection.empty) {
		return null;
	}

	const activeBlock = findActiveTextBlock(state);
	if (!activeBlock) {
		return null;
	}

	const cursor = state.selection.from;
	const ranges = collectMarkRanges(activeBlock);

	for (const markName of MARK_ORDER) {
		const range = ranges.find(
			(candidate) =>
				candidate.markName === markName && (candidate.from === cursor || candidate.to === cursor),
		);
		if (!range) {
			continue;
		}
		return {
			markName,
			pos: cursor,
			side: range.from === cursor ? "inside" : "outside",
		};
	}

	return null;
}

function delimiterSideAtBoundary(
	boundary: RolloverBoundary,
	range: MarkRange,
	kind: "open" | "close",
): number {
	if (!boundary || boundary.markName !== range.markName) {
		return kind === "open" ? -1 : 1;
	}

	if (kind === "open" && boundary.pos === range.from) {
		return boundary.side === "inside" ? -1 : 1;
	}

	if (kind === "close" && boundary.pos === range.to) {
		return boundary.side === "inside" ? 1 : -1;
	}

	return kind === "open" ? -1 : 1;
}

type MarkerRole = "open" | "close" | "heading-prefix";

function createMarkerWidget(symbol: string, markerRole: MarkerRole) {
	const widget = document.createElement("span");
	widget.className = "pm-rollover-delimiter";
	if (markerRole === "heading-prefix") {
		widget.classList.add("pm-rollover-heading-prefix");
	}
	widget.dataset.markerRole = markerRole;
	widget.textContent = symbol;
	return widget;
}

export function buildDecorations(
	state: EditorState,
	boundary: RolloverBoundary,
	sourceBlock: SourceBlockMode | null,
): DecorationSet {
	if (sourceBlock) {
		const sourceDecorations: Decoration[] = [];

		if (sourceBlock.kind === "list-line") {
			sourceDecorations.push(
				Decoration.node(
					sourceBlock.from,
					sourceBlock.to,
					{
						class: "pm-rollover-list-source-line",
						"data-source-type": "list-line",
					},
					{
						markerRole: "list-source-line",
					},
				),
			);

			if (typeof sourceBlock.itemPos === "number") {
				const itemNode = state.doc.nodeAt(sourceBlock.itemPos);
				if (itemNode && (itemNode.type.name === "listItem" || itemNode.type.name === "taskItem")) {
					sourceDecorations.push(
						Decoration.node(
							sourceBlock.itemPos,
							sourceBlock.itemPos + itemNode.nodeSize,
							{
								class: "pm-rollover-list-source-item",
								"data-source-type": "list-line-item",
							},
							{
								markerRole: "list-source-item",
							},
						),
					);
				}
			}
		}

		if (sourceBlock.typeName === "codeBlock") {
			sourceDecorations.push(
				Decoration.node(
					sourceBlock.from,
					sourceBlock.to,
					{
						class: "pm-rollover-code-source-block",
						"data-source-type": "code-block",
					},
					{
						markerRole: "code-source-block",
					},
				),
			);
		}

		return sourceDecorations.length > 0
			? DecorationSet.create(state.doc, sourceDecorations)
			: DecorationSet.empty;
	}

	const decorations: Decoration[] = [];

	const activeHorizontalRule = findActiveHorizontalRuleRange(state);
	if (activeHorizontalRule) {
		decorations.push(
			Decoration.node(
				activeHorizontalRule.from,
				activeHorizontalRule.to,
				{
					class: "pm-rollover-horizontal-rule",
					"data-horizontal-rule-delimiter": "---",
					"data-horizontal-rule-cursor": activeHorizontalRule.cursor,
				},
				{
					markerRole: "horizontal-rule",
					symbol: "---",
					cursor: activeHorizontalRule.cursor,
				},
			),
		);
	}

	if (!state.selection.empty) {
		return decorations.length > 0
			? DecorationSet.create(state.doc, decorations)
			: DecorationSet.empty;
	}

	const activeBlock = findActiveTextBlock(state);
	if (!activeBlock) {
		return decorations.length > 0
			? DecorationSet.create(state.doc, decorations)
			: DecorationSet.empty;
	}

	if (activeBlock.node.type.name === "heading") {
		const level = Math.max(1, Math.min(6, Number(activeBlock.node.attrs.level ?? 1)));
		const prefix = `${"#".repeat(level)} `;
		decorations.push(
			Decoration.widget(activeBlock.start, createMarkerWidget(prefix, "heading-prefix"), {
				side: -1,
				key: `heading-prefix-${activeBlock.start}`,
				markerRole: "heading-prefix",
				symbol: prefix,
			}),
		);
	}

	if (activeBlock.node.type.name === "codeBlock") {
		const lang = activeBlock.node.attrs.language as string | null;
		const openFence = lang ? `\`\`\`${lang}` : "```";
		const closeFence = "```";
		const nodeStart = activeBlock.start - 1;
		const nodeEnd = activeBlock.start + activeBlock.node.content.size + 1;
		decorations.push(
			Decoration.node(
				nodeStart,
				nodeEnd,
				{
					class: "pm-rollover-code-fenced-block",
					"data-fence-open": openFence,
					"data-fence-close": closeFence,
				},
				{
					markerRole: "fence-block",
					openSymbol: openFence,
					closeSymbol: closeFence,
				},
			),
		);
	}

	for (const range of collectMarkRanges(activeBlock)) {
		const delimiter = ROLLOVER_DELIMITERS[range.markName];
		decorations.push(
			Decoration.widget(range.from, createMarkerWidget(delimiter, "open"), {
				side: delimiterSideAtBoundary(boundary, range, "open"),
				key: `mark-open-${range.markName}-${range.from}-${range.to}`,
				markName: range.markName,
				markerRole: "open",
				symbol: delimiter,
			}),
		);
		decorations.push(
			Decoration.widget(range.to, createMarkerWidget(delimiter, "close"), {
				side: delimiterSideAtBoundary(boundary, range, "close"),
				key: `mark-close-${range.markName}-${range.from}-${range.to}`,
				markName: range.markName,
				markerRole: "close",
				symbol: delimiter,
			}),
		);
	}

	if (decorations.length === 0) {
		return DecorationSet.empty;
	}

	return DecorationSet.create(state.doc, decorations);
}
