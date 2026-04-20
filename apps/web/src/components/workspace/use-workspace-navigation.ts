import type { MutableRefObject } from "react";
import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import type { WorkspacePaletteAction } from "@/components/command-palette";
import type { SidebarNote } from "@/components/sidebar/sidebar-note";
import type { RightUtilitySidebarHandle, UtilitySectionId } from "@/components/workspace/right-utility-sidebar";
import { toast } from "@/lib/toast";

export function useWorkspaceNavigation({
	rightUtilityRef,
	selectedNote,
	selectedNoteId,
	createNewNote,
	onCanvasInput,
	onRunOrganization,
	onRunFanOut,
	toggleLeftPanel,
	toggleRightPanel,
	revealRightPanel,
}: {
	rightUtilityRef: MutableRefObject<RightUtilitySidebarHandle | null>;
	selectedNote: SidebarNote | null;
	selectedNoteId: string | null;
	createNewNote: () => Promise<string | null>;
	onCanvasInput: () => void;
	onRunOrganization: (input: { noteId?: string }) => Promise<void>;
	onRunFanOut: (input: { noteId: string; content: string }) => Promise<void>;
	toggleLeftPanel: () => void;
	toggleRightPanel: () => void;
	revealRightPanel: () => void;
}) {
	const navigate = useNavigate();
	const [editorFocusToken, setEditorFocusToken] = useState(0);
	const [externalCommandRequest, setExternalCommandRequest] = useState<{
		command: string;
		nonce: number;
	} | null>(null);

	const navigateToCollections = useCallback(() => {
		void navigate({ to: "/collections", search: { query: "" } });
	}, [navigate]);

	const navigateToDigest = useCallback(() => {
		void navigate({ to: "/digest" });
	}, [navigate]);

	const navigateToContradictions = useCallback(() => {
		void navigate({ to: "/contradictions" });
	}, [navigate]);

	const navigateToHistory = useCallback(() => {
		if (!selectedNote) {
			toast.warning("Select a note first to open history.");
			return;
		}

		void navigate({ to: "/history", search: { noteId: selectedNote.id } });
	}, [navigate, selectedNote]);

	const navigateToProfile = useCallback(() => {
		void navigate({ to: "/profile" });
	}, [navigate]);

	const downloadSelectedNote = useCallback(() => {
		if (!selectedNote) {
			toast.warning("Select a note first to download markdown.");
			return;
		}

		const blob = new Blob([selectedNote.content ?? ""], { type: "text/markdown;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		const safeTitle = (selectedNote.title || "note")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");
		anchor.href = url;
		anchor.download = `${safeTitle || "note"}.md`;
		anchor.click();
		URL.revokeObjectURL(url);
	}, [selectedNote]);

	const focusEditor = useCallback(() => {
		if (!selectedNoteId) {
			toast.warning("Select a note first to focus editor.");
			return;
		}

		setEditorFocusToken(Date.now());
	}, [selectedNoteId]);

	const openUtilitySection = useCallback(
		(section: UtilitySectionId) => {
			revealRightPanel();
			requestAnimationFrame(() => {
				rightUtilityRef.current?.focusSection(section);
			});
		},
		[rightUtilityRef, revealRightPanel],
	);

	const handlePaletteAction = useCallback(
		async (action: WorkspacePaletteAction) => {
			onCanvasInput();

			if (action.kind === "layout") {
				if (action.target === "left") {
					toggleLeftPanel();
					return;
				}

				toggleRightPanel();
				return;
			}

			if (action.kind === "focus") {
				focusEditor();
				return;
			}

			if (action.kind === "utility") {
				openUtilitySection(action.section);
				return;
			}

			if (action.kind === "navigation") {
				switch (action.to) {
					case "/collections": {
						navigateToCollections();
						return;
					}
					case "/digest": {
						navigateToDigest();
						return;
					}
					case "/history": {
						navigateToHistory();
						return;
					}
					case "/contradictions": {
						navigateToContradictions();
						return;
					}
				}
			}

			if (action.kind === "workflow") {
				try {
					if (action.workflow === "organize") {
						await onRunOrganization({ noteId: selectedNote?.id });
						return;
					}

					if (!selectedNote) {
						toast.warning("Select a note first to run fan-out.");
						return;
					}

					await onRunFanOut({
						noteId: selectedNote.id,
						content: selectedNote.content,
					});
				} catch {
					// errors are surfaced by action handlers
				}
				return;
			}

			if (!selectedNote) {
				const createdNoteId = await createNewNote();
				if (!createdNoteId) {
					return;
				}
			}

			setExternalCommandRequest({
				command: action.command,
				nonce: Date.now(),
			});
		},
		[
			createNewNote,
			focusEditor,
			navigateToCollections,
			navigateToContradictions,
			navigateToDigest,
			navigateToHistory,
			onCanvasInput,
			onRunFanOut,
			onRunOrganization,
			openUtilitySection,
			selectedNote,
			toggleLeftPanel,
			toggleRightPanel,
		],
	);

	return {
		downloadSelectedNote,
		editorFocusToken,
		externalCommandRequest,
		focusEditor,
		handlePaletteAction,
		navigateToCollections,
		navigateToContradictions,
		navigateToDigest,
		navigateToHistory,
		navigateToProfile,
	};
}
