import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CommandPalette, type WorkspacePaletteAction } from "@/components/command-palette";
import { NoteEditor } from "@/components/note-editor";
import type { SidebarNote } from "@/components/sidebar/notes-sidebar";
import { toast } from "@/lib/toast";

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
	isCapturing: boolean;
	ephemeralContent: string | null;
	onCanvasInput: () => void;
}

export function CanvasPane({
	selectedNote,
	onCapture,
	onSaveNoteContent,
	onArchiveNote,
	isCapturing,
	ephemeralContent,
	onCanvasInput,
}: CanvasPaneProps) {
	const navigate = useNavigate();
	const [externalRunRequest, setExternalRunRequest] = useState<{
		command: string;
		nonce: number;
	} | null>(null);

	useEffect(() => {
		setExternalRunRequest(null);
	}, [selectedNote?.id]);

	const handlePaletteAction = (action: WorkspacePaletteAction) => {
		onCanvasInput();

		if (action.kind === "navigation") {
			switch (action.to) {
				case "/collections": {
					void navigate({ to: "/collections", search: { query: "" } });
					return;
				}
				case "/digest": {
					void navigate({ to: "/digest" });
					return;
				}
				case "/history": {
					if (!selectedNote) {
						toast.warning("Select a note first to open history.");
						return;
					}

					void navigate({ to: "/history", search: { noteId: selectedNote.id } });
					return;
				}
			}
		}

		if (!selectedNote) {
			toast.warning("Select a note first to run note actions.");
			return;
		}

		setExternalRunRequest({
			command: action.command,
			nonce: Date.now(),
		});
	};

	return (
		<>
			{ephemeralContent ? (
				<div className="bg-kumo-tint mb-3 rounded-md px-3 py-2 text-sm">{ephemeralContent}</div>
			) : null}

			{selectedNote ? (
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
				/>
			) : (
				<div className="text-kumo-subtle rounded-md px-1 py-4 text-sm">
					Select a note from the sidebar, or create one with New Note.
				</div>
			)}

			<CommandPalette onSelectAction={handlePaletteAction} />
		</>
	);
}
