import {
	createEditorPmExtensions,
	markdownToPmDoc,
	pmDocToMarkdown,
} from "@gneissdotrun/editor-pm";
import { EditorContent, useEditor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useEffect, useMemo, useRef, type KeyboardEventHandler } from "react";

import { reportEditorError, reportEditorTelemetry } from "@/lib/editor-telemetry";
import { cn } from "@/lib/utils";

interface PmMarkdownEditorProps {
	label: string;
	value: string;
	placeholder?: string;
	className?: string;
	onChangeMarkdown: (value: string) => void;
	onBlur?: () => void;
	onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
}

const ACTIVE_LINE_CLASS = "pm-editor-active-line";
const PARSE_WARN_THRESHOLD_MS = 12;

const ActiveLineExtension = Extension.create({
	name: "activeLineDecoration",
	addProseMirrorPlugins() {
		return [
			new Plugin({
				props: {
					decorations: (state) => {
						if (!state.selection.empty) {
							return DecorationSet.empty;
						}

						const $from = state.selection.$from;
						for (let depth = $from.depth; depth > 0; depth -= 1) {
							const node = $from.node(depth);
							if (!node.isTextblock) {
								continue;
							}
							const from = $from.start(depth) - 1;
							const to = from + node.nodeSize;
							return DecorationSet.create(state.doc, [
								Decoration.node(from, to, {
									class: ACTIVE_LINE_CLASS,
								}),
							]);
						}

						return DecorationSet.empty;
					},
				},
			}),
		];
	},
});

export function PmMarkdownEditor({
	label,
	value,
	placeholder,
	className,
	onChangeMarkdown,
	onBlur,
	onKeyDown,
}: PmMarkdownEditorProps) {
	const lastAppliedValueRef = useRef(value);
	const initialDoc = useMemo(() => markdownToPmDoc(value), [value]);

	const editor = useEditor({
		extensions: [...createEditorPmExtensions(), ActiveLineExtension],
		content: initialDoc,
		editorProps: {
			attributes: {
				class: cn(
					"prose prose-neutral min-h-40 max-w-none outline-none",
					"[&_.pm-rollover-delimiter]:text-kumo-subtle [&_.pm-rollover-delimiter]:opacity-75",
					"[&_.pm-fake-selection]:bg-kumo-tint/60",
					"[&_.pm-editor-active-line]:ring-kumo-line/30 [&_.pm-editor-active-line]:rounded-sm [&_.pm-editor-active-line]:ring-1",
				),
				"aria-label": label,
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

	if (!editor) {
		return (
			<div
				className={cn(
					"border-kumo-line bg-kumo-base text-kumo-subtle min-h-40 rounded-md border p-4",
					className,
				)}
			>
				{placeholder ?? "Loading editor..."}
			</div>
		);
	}

	return (
		<div className={cn("border-kumo-line bg-kumo-base rounded-md border p-4", className)}>
			<EditorContent editor={editor} onKeyDown={onKeyDown} />
		</div>
	);
}
