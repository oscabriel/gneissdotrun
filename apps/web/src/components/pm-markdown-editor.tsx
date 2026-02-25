import {
	createEditorPmExtensions,
	markdownToPmDoc,
	pmDocToMarkdown,
} from "@gneissdotrun/editor-pm";
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
					"prose prose-neutral min-h-40 max-w-none outline-none",
					"[&_.pm-rollover-delimiter]:text-kumo-subtle [&_.pm-rollover-delimiter]:opacity-75",
					"[&_.pm-fake-selection]:bg-kumo-tint/60",
				),
				"aria-label": label,
			},
			handleKeyDown: (_view, event) => {
				if (event.isComposing) {
					return false;
				}

				if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
					event.preventDefault();
					onRunShortcut?.();
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
