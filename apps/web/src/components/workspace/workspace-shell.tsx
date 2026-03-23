import { Button, Dialog, TooltipProvider } from "@cloudflare/kumo";
import type { CaptureRequest, RouteExecutionOutcome } from "@gneissdotrun/api/capture-contract";
import { env } from "@gneissdotrun/env/web";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CommandPalette, type WorkspacePaletteAction } from "@/components/command-palette";
import { WorkspaceGridShell } from "@/components/layout/workspace-grid-shell";
import { NotesDirectory, type NotesDirectoryHandle } from "@/components/sidebar/notes-directory";
import type { SidebarNote } from "@/components/sidebar/notes-sidebar";
import { CanvasPane } from "@/components/workspace/canvas-pane";
import {
	RightUtilitySidebar,
	type RightUtilitySidebarHandle,
	type UtilitySectionId,
} from "@/components/workspace/right-utility-sidebar";
import { useIndexAgent } from "@/lib/agents/hooks";
import { toggleEditorMode, type EditorMode } from "@/lib/editor/editor-mode";
import { toggleEditorWidth, type EditorWidth } from "@/lib/editor/editor-width";
import { mapOutcomeToUiIntent } from "@/lib/capture";
import { toast } from "@/lib/toast";

interface WorkspaceShellProps {
	userId: string;
	selectedNoteId: string | null;
	onSelectNoteId: (noteId: string | null) => void;
}

interface NotesResponse {
	notes: Array<{
		id: string;
		title: string;
		content: string;
		summary: string;
		tags: string[];
		updatedAt: number;
	}>;
}

interface RewriteProgressUpdate {
	mode: "append" | "replace";
	text: string;
}

type NoteProcessingState = "queued" | "streaming" | "persisting";

type CaptureStreamEvent =
	| {
			type: "capture_started";
			noteId?: string;
	  }
	| {
			type: "rewrite_started";
			noteId?: string;
	  }
	| {
			type: "rewrite_done";
			noteId?: string;
	  }
	| {
			type: "persisted";
			noteIds: string[];
	  }
	| {
			type: "rewrite_progress";
			update: RewriteProgressUpdate;
	  }
	| {
			type: "outcome";
			outcome: RouteExecutionOutcome;
	  }
	| {
			type: "error";
			error?: { message?: string };
	  };

type ThemeMode = "light" | "dark";
type FontMode = "mono" | "serif";

const THEME_STORAGE_KEY = "theme";
const LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY = "workspace-left-sidebar-collapsed";
const RIGHT_SIDEBAR_COLLAPSED_STORAGE_KEY = "workspace-right-sidebar-collapsed";
const FONT_MODE_STORAGE_KEY = "workspace-font-mode";
const EDITOR_MODE_STORAGE_KEY = "workspace-editor-mode";
const EDITOR_WIDTH_STORAGE_KEY = "workspace-editor-width";
const LAYOUT_SEEN_STORAGE_KEY = "workspace-layout-seen";

function sortByUpdatedAtDesc<T extends { updatedAt: number }>(items: T[]): T[] {
	return [...items].sort((left, right) => right.updatedAt - left.updatedAt);
}

function summarizeContent(content: string): string {
	return content.replace(/\s+/g, " ").trim().slice(0, 240);
}

function upsertSidebarNote(notes: SidebarNote[], note: SidebarNote): SidebarNote[] {
	return sortByUpdatedAtDesc([note, ...notes.filter((existing) => existing.id !== note.id)]);
}

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}

	if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
		return true;
	}

	if (target.isContentEditable) {
		return true;
	}

	return Boolean(target.closest('[contenteditable="true"], [role="textbox"]'));
}

function readThemeMode(): ThemeMode {
	if (typeof document === "undefined") {
		return "light";
	}

	return document.documentElement.getAttribute("data-mode") === "dark" ? "dark" : "light";
}

function isMobileViewport(): boolean {
	if (typeof window === "undefined") {
		return false;
	}

	return window.matchMedia("(max-width: 1023px)").matches;
}

export function WorkspaceShell({ userId, selectedNoteId, onSelectNoteId }: WorkspaceShellProps) {
	const navigate = useNavigate();
	const ephemeralTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const directoryRef = useRef<NotesDirectoryHandle | null>(null);
	const rightUtilityRef = useRef<RightUtilitySidebarHandle | null>(null);

	const [indexNotes, setIndexNotes] = useState<SidebarNote[]>([]);
	const [apiNotes, setApiNotes] = useState<SidebarNote[]>([]);
	const [isApiLoading, setIsApiLoading] = useState(false);
	const [apiError, setApiError] = useState<string | null>(null);
	const [isCapturing, setIsCapturing] = useState(false);
	const [noteProcessingStates, setNoteProcessingStates] = useState<
		Record<string, NoteProcessingState>
	>({});
	const [ephemeralContent, setEphemeralContent] = useState<string | null>(null);
	const [themeMode, setThemeMode] = useState<ThemeMode>("light");
	const [fontMode, setFontMode] = useState<FontMode>("mono");
	const [editorWidth, setEditorWidth] = useState<EditorWidth>("full");
	const [editorMode, setEditorMode] = useState<EditorMode>("source");
	const [previewOpen, setPreviewOpen] = useState(false);
	const [leftCollapsed, setLeftCollapsed] = useState(false);
	const [rightCollapsed, setRightCollapsed] = useState(false);
	const [mobilePanel, setMobilePanel] = useState<"left" | "right" | null>(null);
	const [editorFocusToken, setEditorFocusToken] = useState(0);
	const [layoutInteracted, setLayoutInteracted] = useState(false);
	const [preferencesReady, setPreferencesReady] = useState(false);
	const [externalCommandRequest, setExternalCommandRequest] = useState<{
		command: string;
		nonce: number;
	} | null>(null);
	const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);

	const clearEphemeral = useCallback(() => {
		if (ephemeralTimerRef.current) {
			clearTimeout(ephemeralTimerRef.current);
			ephemeralTimerRef.current = null;
		}

		setEphemeralContent(null);
	}, []);

	const scheduleEphemeral = useCallback(
		(content: string, timeoutMs: number) => {
			clearEphemeral();
			setEphemeralContent(content);
			ephemeralTimerRef.current = setTimeout(() => {
				setEphemeralContent(null);
				ephemeralTimerRef.current = null;
			}, timeoutMs);
		},
		[clearEphemeral],
	);

	const setNoteProcessingState = useCallback((noteId: string, state: NoteProcessingState) => {
		setNoteProcessingStates((current) => ({
			...current,
			[noteId]: state,
		}));
	}, []);

	const clearNoteProcessingState = useCallback((noteId: string) => {
		setNoteProcessingStates((current) => {
			if (!current[noteId]) {
				return current;
			}
			const next = { ...current };
			delete next[noteId];
			return next;
		});
	}, []);

	const fetchApiNotes = useCallback(async () => {
		setIsApiLoading(true);
		setApiError(null);

		try {
			const response = await fetch(`${env.VITE_SERVER_URL}/api/notes`, {
				method: "GET",
				credentials: "include",
			});

			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? "Failed to load notes");
			}

			const payload = (await response.json()) as NotesResponse;
			setApiNotes(
				sortByUpdatedAtDesc(
					(payload.notes ?? []).map((note) => ({
						id: note.id,
						title: note.title,
						content: note.content,
						summary: note.summary,
						tags: note.tags,
						updatedAt: note.updatedAt,
					})),
				),
			);
		} catch (error) {
			setApiError(error instanceof Error ? error.message : "Failed to load notes");
		} finally {
			setIsApiLoading(false);
		}
	}, [userId]);

	useEffect(() => {
		void fetchApiNotes();
	}, [fetchApiNotes]);

	useEffect(() => {
		setThemeMode(readThemeMode());
		if (typeof window === "undefined") {
			setPreferencesReady(true);
			return;
		}

		const hasSeenLayout = window.localStorage.getItem(LAYOUT_SEEN_STORAGE_KEY) === "1";
		setLayoutInteracted(hasSeenLayout);

		setLeftCollapsed(
			hasSeenLayout && window.localStorage.getItem(LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY) === "1",
		);
		setRightCollapsed(
			hasSeenLayout && window.localStorage.getItem(RIGHT_SIDEBAR_COLLAPSED_STORAGE_KEY) === "1",
		);

		const storedFont = window.localStorage.getItem(FONT_MODE_STORAGE_KEY);
		if (storedFont === "mono" || storedFont === "serif") {
			setFontMode(storedFont);
		}

		const storedWidth = window.localStorage.getItem(EDITOR_WIDTH_STORAGE_KEY);
		if (storedWidth === "narrow" || storedWidth === "full") {
			setEditorWidth(storedWidth);
		}

		const storedMode = window.localStorage.getItem(EDITOR_MODE_STORAGE_KEY);
		if (storedMode === "source" || storedMode === "rich") {
			setEditorMode(storedMode);
		}

		setPreferencesReady(true);
	}, []);

	useEffect(() => {
		if (!preferencesReady || typeof document === "undefined") {
			return;
		}
		document.body.setAttribute("data-font-mode", fontMode);
	}, [fontMode, preferencesReady]);

	useEffect(() => {
		if (!preferencesReady || typeof window === "undefined") {
			return;
		}
		window.localStorage.setItem(FONT_MODE_STORAGE_KEY, fontMode);
	}, [fontMode, preferencesReady]);

	useEffect(() => {
		if (!preferencesReady || typeof window === "undefined") {
			return;
		}
		window.localStorage.setItem(EDITOR_WIDTH_STORAGE_KEY, editorWidth);
	}, [editorWidth, preferencesReady]);

	useEffect(() => {
		if (!preferencesReady || typeof window === "undefined") {
			return;
		}
		window.localStorage.setItem(EDITOR_MODE_STORAGE_KEY, editorMode);
	}, [editorMode, preferencesReady]);

	useEffect(() => {
		if (!preferencesReady || !layoutInteracted || typeof window === "undefined") {
			return;
		}
		window.localStorage.setItem(LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY, leftCollapsed ? "1" : "0");
		window.localStorage.setItem(RIGHT_SIDEBAR_COLLAPSED_STORAGE_KEY, rightCollapsed ? "1" : "0");
	}, [layoutInteracted, leftCollapsed, preferencesReady, rightCollapsed]);

	useEffect(() => {
		return () => {
			if (ephemeralTimerRef.current) {
				clearTimeout(ephemeralTimerRef.current);
			}
		};
	}, []);

	useIndexAgent({
		userId,
		onStateUpdate: (state) => {
			const nextNotes = sortByUpdatedAtDesc(
				state.notes.map((note) => ({
					id: note.id,
					title: note.title,
					content: note.summary,
					summary: note.summary,
					tags: note.tags ?? [],
					updatedAt: note.updatedAt,
				})),
			);
			setIndexNotes(nextNotes);
		},
	});

	const usingFallback = indexNotes.length === 0;

	const apiNotesById = useMemo(() => {
		return new Map(apiNotes.map((note) => [note.id, note]));
	}, [apiNotes]);

	const sidebarNotes = useMemo(() => {
		if (indexNotes.length > 0) {
			return sortByUpdatedAtDesc(
				indexNotes.map((note) => {
					const hydrated = apiNotesById.get(note.id);
					if (!hydrated) {
						return note;
					}

					return {
						...note,
						title: hydrated.title,
						content: hydrated.content,
						summary: hydrated.summary,
						tags: hydrated.tags,
						updatedAt: Math.max(note.updatedAt, hydrated.updatedAt),
					};
				}),
			);
		}

		return sortByUpdatedAtDesc(apiNotes);
	}, [apiNotes, apiNotesById, indexNotes]);

	const selectedNote = useMemo(() => {
		if (!selectedNoteId) {
			return null;
		}

		return sidebarNotes.find((note) => note.id === selectedNoteId) ?? null;
	}, [selectedNoteId, sidebarNotes]);

	useEffect(() => {
		if (!selectedNoteId) {
			return;
		}

		if (usingFallback && isApiLoading) {
			return;
		}

		const exists = sidebarNotes.some((note) => note.id === selectedNoteId);
		if (!exists) {
			onSelectNoteId(null);
		}
	}, [isApiLoading, onSelectNoteId, selectedNoteId, sidebarNotes, usingFallback]);

	const markLayoutInteraction = useCallback(() => {
		if (typeof window !== "undefined") {
			window.localStorage.setItem(LAYOUT_SEEN_STORAGE_KEY, "1");
		}
		setLayoutInteracted(true);
	}, []);

	const openMobilePanel = useCallback((panel: "left" | "right") => {
		setMobilePanel((current) => (current === panel ? null : panel));
	}, []);

	const toggleLeftPanel = useCallback(() => {
		if (isMobileViewport()) {
			openMobilePanel("left");
			return;
		}

		markLayoutInteraction();
		setLeftCollapsed((current) => !current);
	}, [markLayoutInteraction, openMobilePanel]);

	const toggleRightPanel = useCallback(() => {
		if (isMobileViewport()) {
			openMobilePanel("right");
			return;
		}

		markLayoutInteraction();
		setRightCollapsed((current) => !current);
	}, [markLayoutInteraction, openMobilePanel]);

	const closeMobilePanel = useCallback(() => {
		setMobilePanel(null);
	}, []);

	const handleSelectNote = (noteId: string) => {
		clearEphemeral();
		onSelectNoteId(noteId);
		closeMobilePanel();
	};

	const createNewNote = useCallback(async (): Promise<string | null> => {
		clearEphemeral();
		setIsCapturing(true);

		try {
			const response = await fetch(`${env.VITE_SERVER_URL}/api/notes`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({
					title: "Untitled note",
					content: "",
					tags: [],
				}),
			});

			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? "Failed to create note");
			}

			const payload = (await response.json()) as { note: { id: string } };
			await fetchApiNotes();
			onSelectNoteId(payload.note.id);
			return payload.note.id;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to create note");
			return null;
		} finally {
			setIsCapturing(false);
		}
	}, [clearEphemeral, fetchApiNotes, onSelectNoteId]);

	const handleCapture = useCallback(
		async (
			input: CaptureRequest,
			options?: {
				onRewriteProgress?: (update: RewriteProgressUpdate) => void;
			},
		) => {
			setIsCapturing(true);
			const touchedNoteIds = new Set<string>();
			const markProcessingState = (noteId: string | undefined, state: NoteProcessingState) => {
				if (!noteId) {
					return;
				}
				touchedNoteIds.add(noteId);
				setNoteProcessingState(noteId, state);
			};
			const clearTouchedStates = () => {
				for (const noteId of touchedNoteIds) {
					clearNoteProcessingState(noteId);
				}
			};

			markProcessingState(input.noteId, "queued");

			try {
				let outcome: RouteExecutionOutcome | null = null;

				if (options?.onRewriteProgress) {
					const response = await fetch(`${env.VITE_SERVER_URL}/api/capture?stream=1`, {
						method: "POST",
						headers: {
							"content-type": "application/json",
						},
						credentials: "include",
						body: JSON.stringify(input),
					});

					if (!response.ok) {
						let message = "Capture request failed";
						try {
							const payload = (await response.json()) as {
								error?: { message?: string };
							};
							message = payload.error?.message ?? message;
						} catch {
							// no-op
						}

						throw new Error(message);
					}

					if (!response.body) {
						throw new Error("Capture stream unavailable");
					}

					const reader = response.body.getReader();
					const decoder = new TextDecoder();
					let buffered = "";

					const processLine = (line: string) => {
						const event = JSON.parse(line) as CaptureStreamEvent;
						if (event.type === "capture_started") {
							markProcessingState(event.noteId ?? input.noteId, "queued");
							return;
						}

						if (event.type === "rewrite_started") {
							markProcessingState(event.noteId ?? input.noteId, "streaming");
							return;
						}

						if (event.type === "rewrite_done") {
							markProcessingState(event.noteId ?? input.noteId, "persisting");
							return;
						}

						if (event.type === "persisted") {
							for (const noteId of event.noteIds ?? []) {
								markProcessingState(noteId, "persisting");
							}
							return;
						}

						if (event.type === "rewrite_progress") {
							options.onRewriteProgress?.(event.update);
							return;
						}

						if (event.type === "error") {
							throw new Error(event.error?.message ?? "Capture request failed");
						}

						if (event.type === "outcome") {
							outcome = event.outcome;
						}
					};

					while (true) {
						const chunk = await reader.read();
						if (chunk.done) {
							break;
						}

						buffered += decoder.decode(chunk.value, { stream: true });
						let newlineIndex = buffered.indexOf("\n");
						while (newlineIndex >= 0) {
							const line = buffered.slice(0, newlineIndex).trim();
							buffered = buffered.slice(newlineIndex + 1);
							if (line.length > 0) {
								processLine(line);
							}

							newlineIndex = buffered.indexOf("\n");
						}
					}

					const tail = `${buffered}${decoder.decode()}`.trim();
					if (tail.length > 0) {
						processLine(tail);
					}
				} else {
					const response = await fetch(`${env.VITE_SERVER_URL}/api/capture`, {
						method: "POST",
						headers: {
							"content-type": "application/json",
						},
						credentials: "include",
						body: JSON.stringify(input),
					});

					if (!response.ok) {
						const payload = (await response.json()) as {
							error?: { message?: string };
						};
						throw new Error(payload.error?.message ?? "Capture request failed");
					}

					const payload = (await response.json()) as {
						outcome: RouteExecutionOutcome;
					};
					outcome = payload.outcome;
				}

				if (!outcome) {
					throw new Error("Capture request failed");
				}

				const intent = mapOutcomeToUiIntent(outcome);

				if (intent.showToast && outcome.toast) {
					switch (outcome.toast.tone) {
						case "error": {
							toast.error(outcome.toast.message);
							break;
						}
						case "warning": {
							toast.warning(outcome.toast.message);
							break;
						}
						default: {
							toast.success(outcome.toast.message);
							break;
						}
					}
				}

				const failedSideEffects = (outcome.sideEffects ?? []).filter(
					(effect) => effect.status === "failed",
				);
				if (failedSideEffects.length > 0) {
					const sideEffectLabels = failedSideEffects.map((effect) => effect.name).join(", ");
					toast.warning(`Saved, but some background steps failed (${sideEffectLabels}).`);
				}

				if (intent.showEphemeral && outcome.ephemeral?.content) {
					scheduleEphemeral(outcome.ephemeral.content, outcome.ephemeral.timeoutMs ?? 8000);
				} else if (intent.resetCanvas) {
					clearEphemeral();
				}

				if (intent.openNoteId) {
					onSelectNoteId(intent.openNoteId);
				} else if (intent.resetCanvas) {
					onSelectNoteId(null);
				}

				for (const noteId of [input.noteId, outcome.noteId, ...(outcome.noteIds ?? [])]) {
					if (noteId) {
						clearNoteProcessingState(noteId);
					}
				}
				clearTouchedStates();

				await fetchApiNotes();
			} catch (error) {
				clearTouchedStates();
				toast.error(error instanceof Error ? error.message : "Capture failed");
				if (options?.onRewriteProgress) {
					throw error;
				}
			} finally {
				setIsCapturing(false);
			}
		},
		[
			clearEphemeral,
			clearNoteProcessingState,
			fetchApiNotes,
			onSelectNoteId,
			scheduleEphemeral,
			setNoteProcessingState,
		],
	);

	const handleSaveNoteContent = useCallback(
		async (
			input: { noteId: string; content: string; title?: string },
			options?: { silent?: boolean },
		) => {
			if (!options?.silent) {
				setIsCapturing(true);
			}

			try {
				const response = await fetch(`${env.VITE_SERVER_URL}/api/notes/${input.noteId}`, {
					method: "PUT",
					headers: {
						"content-type": "application/json",
					},
					credentials: "include",
					body: JSON.stringify({
						content: input.content,
						title: input.title,
					}),
				});

				if (!response.ok) {
					const payload = (await response.json()) as { error?: string };
					throw new Error(payload.error ?? "Failed to save note content");
				}

				const payload = (await response.json()) as {
					note: {
						id: string;
						title: string;
						content: string;
						updatedAt: number;
						summary?: string;
						tags?: string[];
					};
				};

				setApiNotes((current) =>
					upsertSidebarNote(current, {
						id: payload.note.id,
						title: payload.note.title,
						content: payload.note.content,
						summary: payload.note.summary ?? summarizeContent(payload.note.content),
						tags: payload.note.tags ?? [],
						updatedAt: payload.note.updatedAt,
					}),
				);

				if (!options?.silent) {
					toast.success("Saved note.");
				}
			} catch (error) {
				if (!options?.silent) {
					toast.error(error instanceof Error ? error.message : "Failed to save note content");
				}
				throw error;
			} finally {
				if (!options?.silent) {
					setIsCapturing(false);
				}
			}
		},
		[],
	);

	const handleRestoreNote = useCallback(
		async (noteId: string) => {
			const response = await fetch(`${env.VITE_SERVER_URL}/api/notes/${noteId}/restore`, {
				method: "POST",
				credentials: "include",
			});

			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? "Failed to restore note");
			}

			await fetchApiNotes();
			onSelectNoteId(noteId);
			toast.success("Restored note.");
		},
		[fetchApiNotes, onSelectNoteId],
	);

	const handleArchiveNote = useCallback(
		async (noteId: string) => {
			setIsCapturing(true);

			try {
				const response = await fetch(`${env.VITE_SERVER_URL}/api/notes/${noteId}`, {
					method: "DELETE",
					credentials: "include",
				});

				if (!response.ok) {
					const payload = (await response.json()) as { error?: string };
					throw new Error(payload.error ?? "Failed to archive note");
				}

				if (selectedNoteId === noteId) {
					onSelectNoteId(null);
				}

				await fetchApiNotes();
				toast.success("Archived note.", {
					action: {
						label: "Undo",
						onClick: () => {
							void handleRestoreNote(noteId);
						},
					},
				});
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Failed to archive note");
				throw error;
			} finally {
				setIsCapturing(false);
			}
		},
		[fetchApiNotes, handleRestoreNote, onSelectNoteId, selectedNoteId],
	);

	const handleNoteRewritePersisted = useCallback(async () => {
		await fetchApiNotes();
	}, [fetchApiNotes]);

	const handleEditorNotice = useCallback(
		(notice: { tone: "info" | "success" | "warning" | "error"; message: string }) => {
			switch (notice.tone) {
				case "error": {
					toast.error(notice.message);
					break;
				}
				case "warning": {
					toast.warning(notice.message);
					break;
				}
				case "info": {
					toast.success(notice.message);
					break;
				}
				default: {
					toast.success(notice.message);
				}
			}
		},
		[],
	);

	const handleRunOrganization = useCallback(async ({ noteId }: { noteId?: string }) => {
		setIsCapturing(true);

		try {
			const response = await fetch(`${env.VITE_SERVER_URL}/api/collections/lifecycle`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({
					action: "run_organize",
					noteIds: noteId ? [noteId] : undefined,
				}),
			});

			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? "Failed to trigger organization");
			}

			toast.success(
				noteId ? "Organization refresh queued for this note." : "Organization refresh queued.",
			);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to trigger organization");
			throw error;
		} finally {
			setIsCapturing(false);
		}
	}, []);

	const handleRunFanOut = useCallback(
		async ({ noteId, content }: { noteId: string; content: string }) => {
			setIsCapturing(true);

			try {
				const response = await fetch(`${env.VITE_SERVER_URL}/api/workflows/fanout/run`, {
					method: "POST",
					headers: {
						"content-type": "application/json",
					},
					credentials: "include",
					body: JSON.stringify({
						sourceNoteId: noteId,
						input: content,
					}),
				});

				if (!response.ok) {
					const payload = (await response.json()) as { error?: string };
					throw new Error(payload.error ?? "Failed to trigger fan-out workflow");
				}

				toast.success("Fan-out workflow queued.");
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Failed to trigger fan-out workflow");
				throw error;
			} finally {
				setIsCapturing(false);
			}
		},
		[],
	);

	const handleCanvasInput = useCallback(() => {
		clearEphemeral();
	}, [clearEphemeral]);

	const toggleThemeMode = useCallback(() => {
		const current = readThemeMode();
		const nextMode: ThemeMode = current === "dark" ? "light" : "dark";
		setThemeMode(nextMode);

		if (typeof document !== "undefined") {
			document.documentElement.setAttribute("data-mode", nextMode);
		}
		if (typeof window !== "undefined") {
			window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
		}
	}, []);

	const toggleFontMode = useCallback(() => {
		setFontMode((current) => (current === "mono" ? "serif" : "mono"));
	}, []);

	const handleToggleEditorWidth = useCallback(() => {
		setEditorWidth((current) => toggleEditorWidth(current));
	}, []);

	const handleToggleEditorMode = useCallback(() => {
		setEditorMode((current) => toggleEditorMode(current));
		setPreviewOpen(false);
	}, []);

	const handleTogglePreview = useCallback(() => {
		setPreviewOpen((current) => !current);
	}, []);

	const downloadSelectedNote = useCallback(() => {
		if (!selectedNote) {
			toast.warning("Select a note first to download markdown.");
			return;
		}

		const content = selectedNote.content ?? "";
		const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
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

	const focusDirectorySearch = useCallback(() => {
		if (leftCollapsed) {
			setLeftCollapsed(false);
			markLayoutInteraction();
		}
		if (isMobileViewport()) {
			setMobilePanel("left");
		}
		requestAnimationFrame(() => {
			directoryRef.current?.focusSearch();
		});
	}, [leftCollapsed, markLayoutInteraction]);

	const focusEditor = useCallback(() => {
		if (!selectedNoteId) {
			toast.warning("Select a note first to focus editor.");
			return;
		}
		setEditorFocusToken(Date.now());
	}, [selectedNoteId]);

	const openUtilitySection = useCallback(
		(section: UtilitySectionId) => {
			if (rightCollapsed) {
				setRightCollapsed(false);
				markLayoutInteraction();
			}
			if (isMobileViewport()) {
				setMobilePanel("right");
			}
			requestAnimationFrame(() => {
				rightUtilityRef.current?.focusSection(section);
			});
		},
		[markLayoutInteraction, rightCollapsed],
	);

	const handlePaletteAction = useCallback(
		async (action: WorkspacePaletteAction) => {
			handleCanvasInput();

			if (action.kind === "layout") {
				if (action.target === "left") {
					toggleLeftPanel();
					return;
				}
				toggleRightPanel();
				return;
			}

			if (action.kind === "focus") {
				if (action.target === "directory_search") {
					focusDirectorySearch();
					return;
				}
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
					case "/contradictions": {
						void navigate({ to: "/contradictions" });
						return;
					}
				}
			}

			if (action.kind === "workflow") {
				try {
					if (action.workflow === "organize") {
						await handleRunOrganization({ noteId: selectedNote?.id });
						return;
					}

					if (!selectedNote) {
						toast.warning("Select a note first to run fan-out.");
						return;
					}

					await handleRunFanOut({
						noteId: selectedNote.id,
						content: selectedNote.content,
					});
				} catch {
					// errors are surfaced by handlers
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
			focusDirectorySearch,
			focusEditor,
			handleCanvasInput,
			handleRunFanOut,
			handleRunOrganization,
			navigate,
			openUtilitySection,
			selectedNote,
			toggleLeftPanel,
			toggleRightPanel,
		],
	);

	useEffect(() => {
		const listener = (event: KeyboardEvent) => {
			if (event.defaultPrevented) {
				return;
			}

			if (
				(event.metaKey || event.ctrlKey) &&
				!event.shiftKey &&
				!event.altKey &&
				event.key === "\\"
			) {
				event.preventDefault();
				toggleLeftPanel();
				return;
			}

			if (
				(event.metaKey || event.ctrlKey) &&
				!event.shiftKey &&
				!event.altKey &&
				event.key === "."
			) {
				event.preventDefault();
				toggleRightPanel();
				return;
			}

			if (
				(event.metaKey || event.ctrlKey) &&
				event.shiftKey &&
				!event.altKey &&
				event.key === "1"
			) {
				event.preventDefault();
				focusDirectorySearch();
				return;
			}

			if (
				(event.metaKey || event.ctrlKey) &&
				event.shiftKey &&
				!event.altKey &&
				event.key === "2"
			) {
				event.preventDefault();
				focusEditor();
				return;
			}

			if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
				return;
			}

			if (event.key.toLowerCase() !== "n") {
				return;
			}

			if (isTypingTarget(event.target)) {
				return;
			}

			event.preventDefault();
			void createNewNote();
		};

		window.addEventListener("keydown", listener);
		return () => {
			window.removeEventListener("keydown", listener);
		};
	}, [createNewNote, focusDirectorySearch, focusEditor, toggleLeftPanel, toggleRightPanel]);

	return (
		<>
			<TooltipProvider>
				<WorkspaceGridShell
					leftCollapsed={leftCollapsed}
					rightCollapsed={rightCollapsed}
					onToggleLeft={toggleLeftPanel}
					onToggleRight={toggleRightPanel}
					mobilePanel={mobilePanel}
					onCloseMobilePanel={closeMobilePanel}
					leftRail={
						<NotesDirectory
							ref={directoryRef}
							notes={sidebarNotes}
							selectedNoteId={selectedNoteId}
							onSelectNote={handleSelectNote}
							isLoading={usingFallback && isApiLoading}
							error={usingFallback ? apiError : null}
							usingFallback={usingFallback}
							processingStatesByNoteId={noteProcessingStates}
						/>
					}
					main={
						<CanvasPane
							userId={userId}
							selectedNote={selectedNote}
							onCapture={handleCapture}
							onSaveNoteContent={handleSaveNoteContent}
							onArchiveNote={handleArchiveNote}
							onCreateNote={createNewNote}
							isCapturing={isCapturing}
							runStateByNoteId={noteProcessingStates}
							ephemeralContent={ephemeralContent}
							onCanvasInput={handleCanvasInput}
							editorWidth={editorWidth}
							editorMode={editorMode}
							previewOpen={previewOpen}
							editorFocusToken={editorFocusToken}
							externalCommandRequest={externalCommandRequest}
							rightSidebarCollapsed={rightCollapsed}
							onNotify={handleEditorNotice}
							onRewritePersisted={handleNoteRewritePersisted}
						/>
					}
					rightRail={
						<RightUtilitySidebar
							ref={rightUtilityRef}
							collapsed={rightCollapsed}
							onToggle={toggleRightPanel}
							onCreateNote={() => {
								void createNewNote();
							}}
							onNavigateHistory={() => {
								if (!selectedNoteId) {
									toast.warning("Select a note first to open history.");
									return;
								}
								void navigate({ to: "/history", search: { noteId: selectedNoteId } });
							}}
							onNavigateCollections={() => {
								void navigate({ to: "/collections", search: { query: "" } });
							}}
							onNavigateContradictions={() => {
								void navigate({ to: "/contradictions" });
							}}
							onNavigateDigest={() => {
								void navigate({ to: "/digest" });
							}}
							onToggleTheme={toggleThemeMode}
							themeMode={themeMode}
							onToggleFont={toggleFontMode}
							fontMode={fontMode}
							onToggleEditorWidth={handleToggleEditorWidth}
							editorWidth={editorWidth}
							onToggleEditorMode={handleToggleEditorMode}
							editorMode={editorMode}
							onTogglePreview={handleTogglePreview}
							previewOpen={previewOpen}
							onDownloadMarkdown={downloadSelectedNote}
							onOpenProfile={() => {
								void navigate({ to: "/profile" });
							}}
							onOpenSettings={() => {
								toast.warning("Settings is coming soon.");
							}}
							onOpenInfo={() => {
								setIsInfoDialogOpen(true);
							}}
						/>
					}
				/>
			</TooltipProvider>
			<CommandPalette
				onSelectAction={(action) => {
					void handlePaletteAction(action);
				}}
			/>
			<Dialog.Root
				open={isInfoDialogOpen}
				onOpenChange={(open) => {
					setIsInfoDialogOpen(open);
				}}
			>
				<Dialog size="sm" className="space-y-4 p-6">
					<Dialog.Title className="text-kumo-default text-base font-semibold">
						About Gneiss
					</Dialog.Title>
					<Dialog.Description className="text-kumo-subtle text-sm leading-6">
						Gneiss captures first and organizes with agents in the background.
					</Dialog.Description>
					<div className="flex justify-end">
						<Dialog.Close
							render={(props) => (
								<Button {...props} size="sm" variant="secondary">
									Close
								</Button>
							)}
						/>
					</div>
				</Dialog>
			</Dialog.Root>
		</>
	);
}
