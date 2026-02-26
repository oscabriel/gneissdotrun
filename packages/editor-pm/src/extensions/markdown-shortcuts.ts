import { Extension, InputRule } from "@tiptap/core";
import { Plugin, type EditorState, type Transaction } from "@tiptap/pm/state";

const TASK_ITEM_INPUT_REGEX = /^(?:-\s)?\[( |x|X)\]\s$/;
const LINK_INPUT_REGEX = /(?<!!)\[([^\]\n]+)\]\(([^)\s]+)(?:\s+['"]([^'"]+)['"])?\)$/;
const IMAGE_INPUT_REGEX = /!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+['"]([^'"]+)['"])?\)$/;
const COMBINED_ASTERISK_REGEX = /\*\*\*([^*\n]+)\*\*\*$/;
const COMBINED_UNDERSCORE_REGEX = /___([^_\n]+)___$/;
const ESCAPE_INPUT_REGEX = /(^|[^\\])\\([\\`*_[\](){}#+\-.!>~|])$/;

function isCodeContext(state: EditorState): boolean {
	if (state.selection.$from.parent.type.spec.code) {
		return true;
	}

	const codeMark = state.schema.marks.code;
	if (!codeMark) {
		return false;
	}

	return state.selection.$from.marks().some((mark) => mark.type === codeMark);
}

function combinedEmphasisRule(find: RegExp): InputRule {
	return new InputRule({
		find,
		handler: ({ state, range, match, commands }) => {
			if (isCodeContext(state)) {
				return;
			}

			const text = match[1] ?? "";
			if (!text) {
				return;
			}

			commands.insertContentAt(range, {
				type: "text",
				text,
				marks: [{ type: "bold" }, { type: "italic" }],
			});
		},
	});
}

function escapedCharacterRule(): InputRule {
	return new InputRule({
		find: ESCAPE_INPUT_REGEX,
		handler: ({ state, range, match, commands }) => {
			if (isCodeContext(state)) {
				return;
			}

			const prefix = match[1] ?? "";
			const escaped = match[2] ?? "";
			if (!escaped) {
				return;
			}

			commands.insertContentAt(range, `${prefix}${escaped}`);
		},
	});
}

function taskListRule(): InputRule {
	return new InputRule({
		find: TASK_ITEM_INPUT_REGEX,
		handler: ({ state, range, match, chain }) => {
			if (isCodeContext(state)) {
				return;
			}

			const checked = (match[1] ?? " ").toLowerCase() === "x";
			chain()
				.deleteRange(range)
				.toggleList("taskList", "taskItem")
				.updateAttributes("taskItem", { checked })
				.run();
		},
	});
}

function linkRule(): InputRule {
	return new InputRule({
		find: LINK_INPUT_REGEX,
		handler: ({ state, range, match, commands }) => {
			if (isCodeContext(state)) {
				return;
			}

			const label = match[1] ?? "";
			const href = match[2] ?? "";
			const title = match[3] ?? null;
			if (!label || !href || !state.schema.marks.link) {
				return;
			}

			commands.insertContentAt(range, {
				type: "text",
				text: label,
				marks: [
					{
						type: "link",
						attrs: {
							href,
							title,
						},
					},
				],
			});
		},
	});
}

function tryConvertImageSyntax(
	state: EditorState,
	from: number,
	to: number,
	text: string,
	dispatch?: (tr: Transaction) => void,
): boolean {
	if (text !== ")" || from !== to || !state.schema.nodes.image) {
		return false;
	}

	const $from = state.doc.resolve(from);
	if (!$from.parent.isTextblock || $from.parent.type.spec.code) {
		return false;
	}

	const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "\0");
	const candidate = `${before}${text}`;
	const match = candidate.match(IMAGE_INPUT_REGEX);
	if (!match) {
		return false;
	}

	const rawMatch = match[0] ?? "";
	const src = match[2] ?? "";
	if (!rawMatch || !src) {
		return false;
	}

	const startOffset = candidate.length - rawMatch.length;
	if (startOffset !== 0 || $from.parentOffset !== $from.parent.content.size) {
		return false;
	}

	const imageNode = state.schema.nodes.image.create({
		src,
		alt: match[1] ?? "",
		title: match[3] ?? null,
	});
	const tr = state.tr.replaceWith($from.before(), $from.after(), imageNode);
	dispatch?.(tr.scrollIntoView());
	return true;
}

export const MarkdownShortcutsExtension = Extension.create({
	name: "markdownShortcuts",
	addInputRules() {
		return [
			taskListRule(),
			linkRule(),
			combinedEmphasisRule(COMBINED_ASTERISK_REGEX),
			combinedEmphasisRule(COMBINED_UNDERSCORE_REGEX),
			escapedCharacterRule(),
		];
	},
	addProseMirrorPlugins() {
		return [
			new Plugin({
				props: {
					handleTextInput: (view, from, to, text) => {
						return tryConvertImageSyntax(view.state, from, to, text, view.dispatch);
					},
				},
			}),
		];
	},
});
