import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorSelection, EditorState, RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	type ViewUpdate,
	drawSelection,
	EditorView,
	keymap,
	placeholder as placeholderExtension,
	ViewPlugin,
} from "@codemirror/view";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import {
	getSlashCommandClassName,
	getSlashCommandPresentation,
} from "@/lib/editor/slash-command-presentation";
import { cn } from "@/lib/utils";

const sourceEditorTheme = EditorView.theme({
	"&": {
		backgroundColor: "transparent",
		color: "var(--text-color-kumo-default)",
		minHeight: "10rem",
		cursor: "text",
	},
	"&.cm-focused": {
		outline: "none",
	},
	".cm-scroller": {
		fontFamily: "var(--font-mono)",
		lineHeight: "1.65",
		minHeight: "10rem",
		cursor: "text",
	},
	".cm-content": {
		padding: "0",
		caretColor: "var(--text-color-kumo-default)",
		cursor: "text",
	},
	".cm-line": {
		padding: "0",
		cursor: "text",
	},
	".cm-gutters": {
		display: "none",
	},
	".cm-activeLine": {
		backgroundColor: "transparent",
	},
	".cm-cursor, .cm-dropCursor": {
		borderLeftColor: "var(--text-color-kumo-default)",
	},
});

function buildSlashCommandDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();

	for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber += 1) {
		const line = view.state.doc.line(lineNumber);
		const presentation = getSlashCommandPresentation(line.text);
		if (!presentation) {
			continue;
		}

		builder.add(
			line.from,
			line.from,
			Decoration.line({
				attributes: {
					class: getSlashCommandClassName(presentation.kind),
					"data-command-kind": presentation.kind,
					...(presentation.isKnown ? { "data-command-label": presentation.label } : {}),
				},
			}),
		);
	}

	return builder.finish();
}

const slashCommandLinePlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildSlashCommandDecorations(view);
		}

		update(update: ViewUpdate): void {
			if (!update.docChanged && !update.viewportChanged) {
				return;
			}

			this.decorations = buildSlashCommandDecorations(update.view);
		}
	},
	{
		decorations: (value) => value.decorations,
	},
);

export interface MarkdownSourceEditorHandle {
	focus: () => void;
}

interface MarkdownSourceEditorProps {
	label: string;
	value: string;
	placeholder?: string;
	className?: string;
	autoFocus?: boolean;
	onChangeMarkdown: (value: string) => void;
	onBlur?: () => void;
	onRunShortcut?: () => void;
}

export const MarkdownSourceEditor = forwardRef<
	MarkdownSourceEditorHandle,
	MarkdownSourceEditorProps
>(function MarkdownSourceEditor(
	{ label, value, placeholder, className, autoFocus, onChangeMarkdown, onBlur, onRunShortcut },
	ref,
) {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const viewRef = useRef<EditorView | null>(null);
	const lastAppliedValueRef = useRef(value);
	const onChangeRef = useRef(onChangeMarkdown);
	const onBlurRef = useRef(onBlur);
	const onRunShortcutRef = useRef(onRunShortcut);

	useEffect(() => {
		onChangeRef.current = onChangeMarkdown;
	}, [onChangeMarkdown]);

	useEffect(() => {
		onBlurRef.current = onBlur;
	}, [onBlur]);

	useEffect(() => {
		onRunShortcutRef.current = onRunShortcut;
	}, [onRunShortcut]);

	useImperativeHandle(ref, () => ({
		focus: () => {
			viewRef.current?.focus();
		},
	}));

	function focusEditorAtEnd(): void {
		const view = viewRef.current;
		if (!view) {
			return;
		}

		view.dispatch({
			selection: EditorSelection.cursor(view.state.doc.length),
		});
		view.focus();
	}

	useEffect(() => {
		if (!hostRef.current) {
			return;
		}

		const view = new EditorView({
			state: EditorState.create({
				doc: lastAppliedValueRef.current,
					extensions: [
						EditorView.lineWrapping,
						drawSelection(),
						history(),
						sourceEditorTheme,
						slashCommandLinePlugin,
						markdown({ codeLanguages: languages }),
					keymap.of([
						indentWithTab,
						...defaultKeymap,
						...historyKeymap,
						{
							key: "Mod-Enter",
							run: () => {
								onRunShortcutRef.current?.();
								return true;
							},
						},
					]),
					EditorView.editorAttributes.of({
						class: "markdown-source-editor__content",
						"aria-label": label,
					}),
					EditorView.domEventHandlers({
						blur: () => {
							onBlurRef.current?.();
							return false;
						},
					}),
					EditorView.updateListener.of((update: ViewUpdate) => {
						if (!update.docChanged) {
							return;
						}

						const nextMarkdown = update.state.doc.toString();
						lastAppliedValueRef.current = nextMarkdown;
						onChangeRef.current(nextMarkdown);
					}),
					placeholder ? placeholderExtension(placeholder) : [],
				],
			}),
			parent: hostRef.current,
		});

		viewRef.current = view;

		return () => {
			view.destroy();
			viewRef.current = null;
		};
	}, [label, placeholder]);

	useEffect(() => {
		if (!autoFocus) {
			return;
		}

		const view = viewRef.current;
		if (!view) {
			return;
		}

		focusEditorAtEnd();
	}, [autoFocus]);

	useEffect(() => {
		const view = viewRef.current;
		if (!view || value === lastAppliedValueRef.current) {
			return;
		}

		const selectionHead = Math.min(value.length, view.state.selection.main.head);
		view.dispatch({
			changes: {
				from: 0,
				to: view.state.doc.length,
				insert: value,
			},
			selection: EditorSelection.cursor(selectionHead),
		});
		lastAppliedValueRef.current = value;
	}, [value]);

	return (
		<div
			className={cn("markdown-source-editor bg-kumo-base min-h-40 cursor-text p-4", className)}
			onMouseDown={(event) => {
				const target = event.target as HTMLElement;
				if (target.closest(".cm-content") || target.closest(".cm-line")) {
					return;
				}

				event.preventDefault();
				focusEditorAtEnd();
			}}
		>
			<div ref={hostRef} />
		</div>
	);
});
