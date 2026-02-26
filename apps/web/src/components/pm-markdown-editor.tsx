import {
	createEditorPmExtensions,
	markdownToPmDoc,
	pmDocToMarkdown,
} from "@gneissdotrun/editor-pm";
import type { NodeType } from "@tiptap/pm/model";
import { liftListItem, sinkListItem } from "@tiptap/pm/schema-list";
import type { EditorView } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useMemo, useRef, type KeyboardEventHandler } from "react";

import { reportEditorError, reportEditorTelemetry } from "@/lib/editor-telemetry";
import { cn } from "@/lib/utils";

interface PmMarkdownEditorProps {
	label: string;
	value: string;
	placeholder?: string;
	className?: string;
	autoFocus?: boolean;
	onChangeMarkdown: (value: string) => void;
	onBlur?: () => void;
	onRunShortcut?: () => void;
	onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
}

const PARSE_WARN_THRESHOLD_MS = 12;

function getListItemTypes(view: EditorView): NodeType[] {
	const listItem = view.state.schema.nodes.listItem;
	const taskItem = view.state.schema.nodes.taskItem;
	return [listItem, taskItem].filter((nodeType): nodeType is NodeType => Boolean(nodeType));
}

function tryListIndent(view: EditorView, outdent: boolean): boolean {
	for (const itemType of getListItemTypes(view)) {
		const command = outdent ? liftListItem(itemType) : sinkListItem(itemType);
		if (command(view.state, view.dispatch)) {
			return true;
		}
	}
	return false;
}

export function tryInlineCodeInputRuleFallback(
	view: EditorView,
	from: number,
	to: number,
	text: string,
): boolean {
	if (text !== "`" || from !== to) {
		return false;
	}

	const { state } = view;
	const codeMark = state.schema.marks.code;
	if (!codeMark) {
		return false;
	}

	const $from = state.doc.resolve(from);
	if (!$from.parent.isTextblock || $from.parent.type.name === "codeBlock") {
		return false;
	}

	const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "\0");
	const match = before.match(/(^|[^`])`([^`\n]+)$/);
	if (!match) {
		return false;
	}

	const matchText = match[0];
	const codeText = match[2] ?? "";
	if (!codeText) {
		return false;
	}

	const suffixStartOffset = before.length - matchText.length;
	const openingOffset = suffixStartOffset + (matchText.startsWith("`") ? 0 : 1);
	const openingPos = $from.start() + openingOffset;
	if (openingOffset > 0 && before[openingOffset - 1] === "\\") {
		return false;
	}

	const tr = state.tr.replaceWith(openingPos, from, state.schema.text(codeText, [codeMark.create()]));
	tr.removeStoredMark(codeMark);
	view.dispatch(tr);
	return true;
}

export function PmMarkdownEditor({
	label,
	value,
	placeholder,
	className,
	autoFocus,
	onChangeMarkdown,
	onBlur,
	onRunShortcut,
	onKeyDown,
}: PmMarkdownEditorProps) {
	const lastAppliedValueRef = useRef(value);
	const initialDoc = useMemo(() => markdownToPmDoc(value), [value]);

	const editor = useEditor({
		extensions: createEditorPmExtensions(),
		content: initialDoc,
		editorProps: {
			attributes: {
				class: cn(
					"min-h-40 max-w-none outline-none",
					"[&_.pm-rollover-delimiter]:text-kumo-subtle [&_.pm-rollover-delimiter]:opacity-75",
					"[&_.pm-fake-selection]:bg-kumo-tint/60",
				),
				"aria-label": label,
			},
			handleTextInput: (view, from, to, text) => {
				return tryInlineCodeInputRuleFallback(view, from, to, text);
			},
			handleKeyDown: (view, event) => {
				if (event.isComposing) {
					return false;
				}

				if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
					event.preventDefault();
					onRunShortcut?.();
					return true;
				}

				if (event.key === "Tab") {
					event.preventDefault();

					if (tryListIndent(view, event.shiftKey)) {
						return true;
					}

					if (event.shiftKey) {
						return true;
					}

					const { from, to } = view.state.selection;
					view.dispatch(view.state.tr.insertText("\t", from, to));
					return true;
				}

				return false;
			},
		},
		onUpdate: ({ editor: currentEditor }) => {
			try {
				const markdown = pmDocToMarkdown(currentEditor.getJSON());
				lastAppliedValueRef.current = markdown;
				onChangeMarkdown(markdown);
			} catch (error) {
				reportEditorError("serialize-error", error, { runtime: "pm" });
			}
		},
		onBlur: () => {
			onBlur?.();
		},
	});

	useEffect(() => {
		if (!editor) {
			return;
		}

		if (value === lastAppliedValueRef.current) {
			return;
		}

		const startedAt = performance.now();
		try {
			editor.commands.setContent(markdownToPmDoc(value), {
				emitUpdate: false,
			});
			lastAppliedValueRef.current = value;
		} catch (error) {
			reportEditorError("parse-error", error, { runtime: "pm" });
		}
		const durationMs = performance.now() - startedAt;
		reportEditorTelemetry({
			event: "parse-latency",
			detail: {
				durationMs,
				largeNote: value.length > 20_000,
			},
		});
		if (durationMs > PARSE_WARN_THRESHOLD_MS) {
			console.warn("PM markdown parse latency", { durationMs, size: value.length });
		}
	}, [editor, value]);

	useEffect(() => {
		if (!editor || !autoFocus) {
			return;
		}

		editor.commands.focus("end");
	}, [autoFocus, editor]);

	if (!editor) {
		return (
			<div className={cn("bg-kumo-base text-kumo-subtle min-h-40 p-4", className)}>
				{placeholder ?? "Loading editor..."}
			</div>
		);
	}

	return (
		<div className={cn("bg-kumo-base min-h-40 p-4", className)}>
			<EditorContent editor={editor} onKeyDown={onKeyDown} />
		</div>
	);
}
