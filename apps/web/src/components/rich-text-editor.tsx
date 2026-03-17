import { useEditor, EditorContent } from "@tiptap/react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";

import { createTiptapExtensions } from "@/lib/editor/tiptap-extensions";
import { markdownToTiptapDoc, tiptapDocToMarkdown } from "@/lib/editor/tiptap-adapter";
import { cn } from "@/lib/utils";

export interface RichTextEditorHandle {
	focus: () => void;
}

interface RichTextEditorProps {
	label: string;
	value: string;
	placeholder?: string;
	className?: string;
	autoFocus?: boolean;
	onChangeMarkdown: (value: string) => void;
	onBlur?: () => void;
	onRunShortcut?: () => void;
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
	function RichTextEditor(
		{ label, value, placeholder, className, autoFocus, onChangeMarkdown, onBlur, onRunShortcut },
		ref,
	) {
		const lastAppliedValueRef = useRef(value);
		const extensions = useMemo(() => createTiptapExtensions(), []);
		const initialDoc = useMemo(() => markdownToTiptapDoc(value), [value]);

		const editor = useEditor({
			extensions,
			content: initialDoc,
			editorProps: {
				attributes: {
					class: cn("min-h-40 max-w-none outline-none", placeholder ? "" : ""),
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
				const markdown = tiptapDocToMarkdown(currentEditor.getJSON());
				lastAppliedValueRef.current = markdown;
				onChangeMarkdown(markdown);
			},
			onBlur: () => {
				onBlur?.();
			},
		});

		useImperativeHandle(
			ref,
			() => ({
				focus: () => {
					editor?.commands.focus("end");
				},
			}),
			[editor],
		);

		useEffect(() => {
			if (!editor || value === lastAppliedValueRef.current) {
				return;
			}

			editor.commands.setContent(markdownToTiptapDoc(value), {
				emitUpdate: false,
			});
			lastAppliedValueRef.current = value;
		}, [editor, value]);

		useEffect(() => {
			if (!editor || !autoFocus) {
				return;
			}

			editor.commands.focus("end");
		}, [autoFocus, editor]);

		if (!editor) {
			return (
				<div className={cn("rich-text-editor bg-kumo-base min-h-40 p-4", className)}>
					{placeholder ?? "Loading editor..."}
				</div>
			);
		}

		return (
			<div className={cn("rich-text-editor bg-kumo-base min-h-40 p-4", className)}>
				<EditorContent editor={editor} />
			</div>
		);
	},
);
