import { Button } from "@cloudflare/kumo";

import type { SidebarNote } from "@/components/sidebar/sidebar-note";
import type { EditorMode } from "@/lib/editor/editor-mode";
import type { EditorWidth } from "@/lib/editor/editor-width";

import { NoteEditor } from "@/components/note-editor";

type NoteRunState = "idle" | "queued" | "streaming" | "persisting";

interface CanvasPaneProps {
	userId: string;
	selectedNote: SidebarNote | null;
	onCapture: (
		input: import("@gneissdotrun/api/capture-contract").CaptureRequest,
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
	editorMode: EditorMode;
	editorWidth: EditorWidth;
	previewOpen: boolean;
	editorFocusToken: number;
	externalCommandRequest?: { command: string; nonce: number } | null;
	rightSidebarCollapsed: boolean;
	runStateByNoteId?: Record<string, NoteRunState>;
	onNotify?: (notice: { tone: "info" | "success" | "warning" | "error"; message: string }) => void;
	onRewritePersisted?: (noteId: string) => Promise<void> | void;
}

export function CanvasPane({
	userId,
	selectedNote,
	onCapture,
	onSaveNoteContent,
	onArchiveNote,
	onCreateNote,
	isCapturing,
	ephemeralContent,
	onCanvasInput,
	editorMode,
	editorWidth,
	previewOpen,
	editorFocusToken,
	externalCommandRequest,
	rightSidebarCollapsed,
	runStateByNoteId = {},
	onNotify,
	onRewritePersisted,
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
					userId={userId}
					noteId={selectedNote.id}
					title={selectedNote.title}
					initialContent={selectedNote.content}
					onCapture={onCapture}
					onSaveNoteContent={onSaveNoteContent}
					onArchiveNote={onArchiveNote}
					onEditorInput={onCanvasInput}
					isCapturing={isCapturing}
					runStatus={runStateByNoteId[selectedNote.id] ?? "idle"}
					externalCommandRequest={externalCommandRequest}
					editorMode={editorMode}
					editorWidth={editorWidth}
					previewOpen={previewOpen}
					focusToken={editorFocusToken}
					rightSidebarCollapsed={rightSidebarCollapsed}
					onNotify={onNotify}
					onRewritePersisted={onRewritePersisted}
				/>
			</div>
		</div>
	);
}
