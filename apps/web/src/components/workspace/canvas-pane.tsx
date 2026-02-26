import { Button } from "@cloudflare/kumo";

import type { SidebarNote } from "@/components/sidebar/notes-sidebar";

import { NoteEditor } from "@/components/note-editor";

interface CanvasPaneProps {
	selectedNote: SidebarNote | null;
	onCapture: (
		input: { userInput: string; noteId?: string },
		options?: {
			onRewriteProgress?: (update: { mode: "append" | "replace"; text: string }) => void;
		},
	) => Promise<void>;
	onSaveNoteContent: (
		input: { noteId: string; content: string; title?: string },
		options?: { silent?: boolean },
	) => Promise<void>;
	onArchiveNote: (noteId: string) => Promise<void>;
	onCreateNote: () => void;
	isCapturing: boolean;
	ephemeralContent: string | null;
	onCanvasInput: () => void;
	markdownMode: "edit" | "preview";
	editorFocusToken: number;
	externalRunRequest?: { command: string; nonce: number } | null;
}

export function CanvasPane({
	selectedNote,
	onCapture,
	onSaveNoteContent,
	onArchiveNote,
	onCreateNote,
	isCapturing,
	ephemeralContent,
	onCanvasInput,
	markdownMode,
	editorFocusToken,
	externalRunRequest,
}: CanvasPaneProps) {
	if (!selectedNote) {
		return (
			<div className="flex h-full items-center justify-center">
				<Button variant="secondary" onClick={onCreateNote}>
					Create new note
				</Button>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4">
			{ephemeralContent ? (
				<div className="bg-kumo-tint mb-3 rounded-md px-3 py-2 text-sm">{ephemeralContent}</div>
			) : null}

			<div className="workspace-divider-h text-kumo-subtle mb-3 pb-2 text-xs tracking-wide uppercase">
				{selectedNote.title}
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto">
				<NoteEditor
					noteId={selectedNote.id}
					title={selectedNote.title}
					initialContent={selectedNote.content}
					onCapture={onCapture}
					onSaveNoteContent={onSaveNoteContent}
					onArchiveNote={onArchiveNote}
					onEditorInput={onCanvasInput}
					isCapturing={isCapturing}
					externalRunRequest={externalRunRequest}
					markdownMode={markdownMode}
					focusToken={editorFocusToken}
				/>
			</div>
		</div>
	);
}
