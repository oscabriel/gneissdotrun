import { EditorContent, useEditor } from "@tiptap/react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";

import type { RichTextEditorHandle, RichTextEditorProps } from "@/components/rich-text-editor";
import { createTiptapExtensions } from "@/lib/editor/tiptap-extensions";
import { markdownToTiptapDoc, tiptapDocToMarkdown } from "@/lib/editor/tiptap-adapter";
import { cn } from "@/lib/utils";

export const RichTextEditorImpl = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
	function RichTextEditorImpl(
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
