import { Suspense, forwardRef, lazy, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import {
	MarkdownSourceEditor,
	type MarkdownSourceEditorHandle,
} from "@/components/markdown-source-editor";
import type { RichTextEditorHandle } from "@/components/rich-text-editor";
import { emitWorkspaceDevtoolsEvent } from "@/lib/devtools/workspace-devtools";
import type { EditorMode } from "@/lib/editor/editor-mode";
import { cn } from "@/lib/utils";

const LazyMarkdownPreview = lazy(async () => {
	const module = await import("@/components/markdown-preview");
	return { default: module.MarkdownPreview };
});

const LazyRichTextEditor = lazy(async () => {
	const module = await import("@/components/rich-text-editor");
	return { default: module.RichTextEditor };
});

interface RichSupportResultLike {
	supported: boolean;
	issues: Array<{ message: string }>;
}

function EditorSurfaceFallback({ className, message }: { className?: string; message: string }) {
	return <div className={cn("bg-kumo-base min-h-40 rounded-md p-4 text-sm text-kumo-subtle", className)}>{message}</div>;
}

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
		const pendingFocusRef = useRef(false);
		const richSupportAnalyzerRef = useRef<((markdown: string) => RichSupportResultLike) | null>(null);
		const [richSupportAnalyzerReady, setRichSupportAnalyzerReady] = useState(false);
		const [richSupportAnalyzerError, setRichSupportAnalyzerError] = useState<string | null>(null);

		useEffect(() => {
			if (editorMode !== "rich" || richSupportAnalyzerRef.current) {
				return;
			}

			let cancelled = false;
			emitWorkspaceDevtoolsEvent("editor-diagnostic", {
				kind: "rich-support-loading",
				source: "note-content-editor",
				detail: {
					editorMode,
				},
				timestamp: Date.now(),
			});

			void import("@gneissdotrun/editor-markdown")
				.then((module) => {
					if (cancelled) {
						return;
					}

					richSupportAnalyzerRef.current = module.analyzeRichModeSupport;
					setRichSupportAnalyzerReady(true);
					setRichSupportAnalyzerError(null);
					emitWorkspaceDevtoolsEvent("editor-diagnostic", {
						kind: "rich-support-ready",
						source: "note-content-editor",
						detail: {
							editorMode,
						},
						timestamp: Date.now(),
					});
				})
				.catch(() => {
					if (cancelled) {
						return;
					}

					setRichSupportAnalyzerError("Rich mode is temporarily unavailable.");
					emitWorkspaceDevtoolsEvent("editor-diagnostic", {
						kind: "rich-support-error",
						source: "note-content-editor",
						message: "Rich mode is temporarily unavailable.",
						detail: {
							editorMode,
						},
						timestamp: Date.now(),
					});
				});

			return () => {
				cancelled = true;
			};
		}, [editorMode]);

		const richSupport = useMemo(() => {
			if (editorMode !== "rich") {
				return null;
			}

			const analyzeRichModeSupport = richSupportAnalyzerRef.current;
			if (!analyzeRichModeSupport) {
				return null;
			}

			return analyzeRichModeSupport(value);
		}, [editorMode, richSupportAnalyzerReady, value]);

		const richModeNotice = useMemo(() => {
			if (editorMode !== "rich") {
				return null;
			}

			if (richSupportAnalyzerError) {
				return richSupportAnalyzerError;
			}

			if (!richSupport) {
				return "Preparing rich editor...";
			}

			if (!richSupport.supported) {
				return richSupport.issues[0]?.message ?? "Rich mode is unavailable for this note.";
			}

			return null;
		}, [editorMode, richSupport, richSupportAnalyzerError]);

		const effectiveMode: EditorMode = editorMode === "rich" && !richModeNotice ? "rich" : "source";

		useImperativeHandle(
			ref,
			() => ({
				focus: () => {
					pendingFocusRef.current = true;
					if (effectiveMode === "rich") {
						if (richRef.current) {
							richRef.current.focus();
							pendingFocusRef.current = false;
						}
						return;
					}

					if (effectiveMode === "source") {
						if (sourceRef.current) {
							sourceRef.current.focus();
							pendingFocusRef.current = false;
						}
					}
				},
			}),
			[effectiveMode],
		);

		useEffect(() => {
			if (!pendingFocusRef.current || previewOpen) {
				return;
			}

			if (effectiveMode === "rich" && richRef.current) {
				richRef.current.focus();
				pendingFocusRef.current = false;
				return;
			}

			if (effectiveMode === "source" && sourceRef.current) {
				sourceRef.current.focus();
				pendingFocusRef.current = false;
			}
		}, [effectiveMode, previewOpen]);

		if (previewOpen) {
			return (
				<Suspense fallback={<EditorSurfaceFallback className={className} message="Loading preview..." />}>
					<div className={cn("bg-kumo-base min-h-40 rounded-md p-4", className)}>
						<LazyMarkdownPreview markdown={value} />
					</div>
				</Suspense>
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
					<Suspense fallback={<EditorSurfaceFallback className={className} message="Loading rich editor..." />}>
						<LazyRichTextEditor
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
					</Suspense>
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
