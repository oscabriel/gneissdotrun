import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorState } from "@tiptap/pm/state";

type RolloverBoundary = {
	markName: "bold" | "italic" | "strike" | "code";
	pos: number;
	side: "inside" | "outside";
} | null;

const ROLLOVER_DELIMITERS: Record<"bold" | "italic" | "strike" | "code", string> = {
	bold: "**",
	italic: "*",
	strike: "~~",
	code: "`",
};

const MARK_ORDER: Array<"code" | "bold" | "italic" | "strike"> = [
	"code",
	"bold",
	"italic",
	"strike",
];

export const markdownDelimiterRolloverPluginKey = new PluginKey<RolloverBoundary>(
	"markdown-delimiter-rollover",
);

function detectBoundary(state: EditorState): RolloverBoundary {
	const { selection } = state;
	if (!selection.empty) {
		return null;
	}

	const $from = selection.$from;
	const beforeMarks = $from.nodeBefore?.marks ?? [];
	const afterMarks = $from.nodeAfter?.marks ?? [];
	const merged = [...beforeMarks, ...afterMarks];

	for (const markName of MARK_ORDER) {
		if (merged.some((mark) => mark.type.name === markName)) {
			const beforeHas = beforeMarks.some((mark) => mark.type.name === markName);
			return {
				markName,
				pos: selection.from,
				side: beforeHas ? "outside" : "inside",
			};
		}
	}

	return null;
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
				const boundary = markdownDelimiterRolloverPluginKey.getState(this.editor.state);
				if (!boundary) {
					return false;
				}
				const nextBoundary: RolloverBoundary = {
					...boundary,
					side: boundary.side === "inside" ? "outside" : "inside",
				};
				const tr = this.editor.state.tr.setMeta(markdownDelimiterRolloverPluginKey, nextBoundary);
				this.editor.view.dispatch(tr);
				return true;
			},
			ArrowRight: () => {
				const boundary = markdownDelimiterRolloverPluginKey.getState(this.editor.state);
				if (!boundary) {
					return false;
				}
				const nextBoundary: RolloverBoundary = {
					...boundary,
					side: boundary.side === "inside" ? "outside" : "inside",
				};
				const tr = this.editor.state.tr.setMeta(markdownDelimiterRolloverPluginKey, nextBoundary);
				this.editor.view.dispatch(tr);
				return true;
			},
			Backspace: () => {
				const boundary = markdownDelimiterRolloverPluginKey.getState(this.editor.state);
				if (!boundary) {
					return false;
				}
				const markType = this.editor.state.schema.marks[boundary.markName];
				if (!markType) {
					return false;
				}
				this.editor.chain().focus().unsetMark(markType.name).run();
				return true;
			},
			Delete: () => {
				const boundary = markdownDelimiterRolloverPluginKey.getState(this.editor.state);
				if (!boundary) {
					return false;
				}
				const markType = this.editor.state.schema.marks[boundary.markName];
				if (!markType) {
					return false;
				}
				this.editor.chain().focus().unsetMark(markType.name).run();
				return true;
			},
		};
	},
	addProseMirrorPlugins() {
		return [
			new Plugin<RolloverBoundary>({
				key: markdownDelimiterRolloverPluginKey,
				state: {
					init: (_config, state) => detectBoundary(state),
					apply: (tr, _value, _oldState, newState) => {
						const fromMeta = tr.getMeta(markdownDelimiterRolloverPluginKey) as RolloverBoundary;
						if (fromMeta !== undefined) {
							return fromMeta;
						}
						return detectBoundary(newState);
					},
				},
				props: {
					decorations: (state) => {
						const boundary = markdownDelimiterRolloverPluginKey.getState(state);
						if (!boundary) {
							return DecorationSet.empty;
						}
						const delimiter = ROLLOVER_DELIMITERS[boundary.markName];
						const widget = document.createElement("span");
						widget.className = "pm-rollover-delimiter";
						widget.textContent = delimiter;
						widget.dataset.side = boundary.side;
						return DecorationSet.create(state.doc, [
							Decoration.widget(boundary.pos, widget, {
								side: boundary.side === "inside" ? -1 : 1,
							}),
						]);
					},
				},
			}),
		];
	},
});
