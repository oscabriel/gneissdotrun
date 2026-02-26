import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

type RolloverMarkName = "bold" | "italic" | "strike";

type RolloverBoundary = {
	markName: RolloverMarkName;
	pos: number;
	side: "inside" | "outside";
} | null;

type RolloverPluginState = {
	boundary: RolloverBoundary;
	active: boolean;
};

type RolloverPluginMeta =
	| {
			kind: "set-boundary";
			boundary: RolloverBoundary;
	  }
	| {
			kind: "set-active";
			active: boolean;
	  };

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

export const markdownDelimiterRolloverPluginKey = new PluginKey<RolloverPluginState>(
	"markdown-delimiter-rollover",
);

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

function getBoundaryMarkRange(state: EditorState, boundary: Exclude<RolloverBoundary, null>): MarkRange | null {
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

function detectBoundary(state: EditorState): RolloverBoundary {
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
				candidate.markName === markName &&
				(candidate.from === cursor || candidate.to === cursor),
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

function buildDecorations(state: EditorState, boundary: RolloverBoundary): DecorationSet {
	if (!state.selection.empty) {
		return DecorationSet.empty;
	}

	const activeBlock = findActiveTextBlock(state);
	if (!activeBlock) {
		return DecorationSet.empty;
	}

	const decorations: Decoration[] = [];

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

export const DelimiterRolloverExtension = Extension.create({
	name: "delimiterRollover",
	addStorage() {
		return {
			boundary: null as RolloverBoundary,
		};
	},
	addKeyboardShortcuts() {
		return {
			ArrowLeft: () => {
				const pluginState = markdownDelimiterRolloverPluginKey.getState(this.editor.state);
				const boundary = pluginState?.boundary ?? null;
				if (!boundary) {
					return false;
				}
				const nextBoundary: RolloverBoundary = {
					...boundary,
					side: boundary.side === "inside" ? "outside" : "inside",
				};
				const tr = this.editor.state.tr.setMeta(markdownDelimiterRolloverPluginKey, {
					kind: "set-boundary",
					boundary: nextBoundary,
				} satisfies RolloverPluginMeta);
				this.editor.view.dispatch(tr);
				return true;
			},
			ArrowRight: () => {
				const pluginState = markdownDelimiterRolloverPluginKey.getState(this.editor.state);
				const boundary = pluginState?.boundary ?? null;
				if (!boundary) {
					return false;
				}
				const nextBoundary: RolloverBoundary = {
					...boundary,
					side: boundary.side === "inside" ? "outside" : "inside",
				};
				const tr = this.editor.state.tr.setMeta(markdownDelimiterRolloverPluginKey, {
					kind: "set-boundary",
					boundary: nextBoundary,
				} satisfies RolloverPluginMeta);
				this.editor.view.dispatch(tr);
				return true;
			},
			Backspace: () => {
				const pluginState = markdownDelimiterRolloverPluginKey.getState(this.editor.state);
				const boundary = pluginState?.boundary ?? null;
				if (!boundary) {
					return false;
				}
				const markType = this.editor.state.schema.marks[boundary.markName];
				if (!markType) {
					return false;
				}
				const range = getBoundaryMarkRange(this.editor.state, boundary);
				if (!range) {
					return false;
				}
				const tr = this.editor.state.tr
					.removeMark(range.from, range.to, markType)
					.setMeta(markdownDelimiterRolloverPluginKey, {
						kind: "set-boundary",
						boundary: null,
					} satisfies RolloverPluginMeta);
				this.editor.view.dispatch(tr);
				return true;
			},
			Delete: () => {
				const pluginState = markdownDelimiterRolloverPluginKey.getState(this.editor.state);
				const boundary = pluginState?.boundary ?? null;
				if (!boundary) {
					return false;
				}
				const markType = this.editor.state.schema.marks[boundary.markName];
				if (!markType) {
					return false;
				}
				const range = getBoundaryMarkRange(this.editor.state, boundary);
				if (!range) {
					return false;
				}
				const tr = this.editor.state.tr
					.removeMark(range.from, range.to, markType)
					.setMeta(markdownDelimiterRolloverPluginKey, {
						kind: "set-boundary",
						boundary: null,
					} satisfies RolloverPluginMeta);
				this.editor.view.dispatch(tr);
				return true;
			},
		};
	},
	addProseMirrorPlugins() {
		return [
			new Plugin<RolloverPluginState>({
				key: markdownDelimiterRolloverPluginKey,
				state: {
					init: (_config, state) => ({
						boundary: detectBoundary(state),
						active: true,
					}),
					apply: (tr, value, _oldState, newState) => {
						const fromMeta = tr.getMeta(markdownDelimiterRolloverPluginKey) as
							| RolloverPluginMeta
							| undefined;
						if (fromMeta?.kind === "set-active") {
							return {
								active: fromMeta.active,
								boundary: fromMeta.active ? detectBoundary(newState) : null,
							};
						}
						if (fromMeta?.kind === "set-boundary") {
							return {
								...value,
								boundary: fromMeta.boundary,
							};
						}
						if (!value.active) {
							return {
								...value,
								boundary: null,
							};
						}
						return {
							...value,
							boundary: detectBoundary(newState),
						};
					},
				},
				props: {
					handleDOMEvents: {
						focus: (view) => {
							view.dispatch(
								view.state.tr.setMeta(markdownDelimiterRolloverPluginKey, {
									kind: "set-active",
									active: true,
								} satisfies RolloverPluginMeta),
							);
							return false;
						},
						blur: (view) => {
							view.dispatch(
								view.state.tr.setMeta(markdownDelimiterRolloverPluginKey, {
									kind: "set-active",
									active: false,
								} satisfies RolloverPluginMeta),
							);
							return false;
						},
					},
					decorations: (state) => {
						const pluginState = markdownDelimiterRolloverPluginKey.getState(state);
						if (!pluginState?.active) {
							return DecorationSet.empty;
						}
						return buildDecorations(state, pluginState.boundary);
					},
				},
			}),
		];
	},
});
