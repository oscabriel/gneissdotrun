import { analyzeRichModeSupport } from "@gneissdotrun/editor-markdown";
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";

import { MarkdownPreview } from "@/components/markdown-preview";
import {
	MarkdownSourceEditor,
	type MarkdownSourceEditorHandle,
} from "@/components/markdown-source-editor";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/rich-text-editor";
import type { EditorMode } from "@/lib/editor/editor-mode";
import { cn } from "@/lib/utils";

export interface NoteContentEditorHandle {
	focus: () => void;
}

interface NoteContentEditorProps {
	label: string;
	value: string;
	editorMode: EditorMode;
	previewOpen?: boolean;
	placeholder?: string;
	className?: string;
	autoFocus?: boolean;
	onChangeMarkdown: (value: string) => void;
	onBlur?: () => void;
	onRunShortcut?: () => void;
}

export const NoteContentEditor = forwardRef<NoteContentEditorHandle, NoteContentEditorProps>(
	function NoteContentEditor(
		{
			label,
			value,
			editorMode,
			previewOpen = false,
			placeholder,
			className,
			autoFocus,
			onChangeMarkdown,
			onBlur,
			onRunShortcut,
		},
		ref,
	) {
		const sourceRef = useRef<MarkdownSourceEditorHandle | null>(null);
		const richRef = useRef<RichTextEditorHandle | null>(null);

		const richSupport = useMemo(() => analyzeRichModeSupport(value), [value]);

		const richModeNotice = useMemo(() => {
			if (editorMode !== "rich") {
				return null;
			}

			if (!richSupport.supported) {
				return richSupport.issues[0]?.message ?? "Rich mode is unavailable for this note.";
			}

			return null;
		}, [editorMode, richSupport.issues, richSupport.supported]);

		const effectiveMode: EditorMode = editorMode === "rich" && !richModeNotice ? "rich" : "source";

		useImperativeHandle(
			ref,
			() => ({
				focus: () => {
					if (effectiveMode === "rich") {
						richRef.current?.focus();
						return;
					}

					if (effectiveMode === "source") {
						sourceRef.current?.focus();
					}
				},
			}),
			[effectiveMode],
		);

		if (previewOpen) {
			return (
				<div className={cn("bg-kumo-base min-h-40 rounded-md p-4", className)}>
					<MarkdownPreview markdown={value} />
				</div>
			);
		}

		return (
			<div className="space-y-2">
				{richModeNotice ? (
					<div className="bg-kumo-tint text-kumo-subtle rounded-md px-3 py-2 text-xs">
						{richModeNotice}
					</div>
				) : null}
				{effectiveMode === "rich" ? (
					<RichTextEditor
						ref={richRef}
						label={label}
						value={value}
						placeholder={placeholder}
						className={className}
						autoFocus={autoFocus}
						onChangeMarkdown={onChangeMarkdown}
						onBlur={onBlur}
						onRunShortcut={onRunShortcut}
					/>
				) : (
					<MarkdownSourceEditor
						ref={sourceRef}
						label={label}
						value={value}
						placeholder={placeholder}
						className={className}
						autoFocus={autoFocus}
						onChangeMarkdown={onChangeMarkdown}
						onBlur={onBlur}
						onRunShortcut={onRunShortcut}
					/>
				)}
			</div>
		);
	},
);
