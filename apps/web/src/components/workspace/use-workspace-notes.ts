import { env } from "@gneissdotrun/env/web";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { SidebarNote } from "@/components/sidebar/sidebar-note";
import { useIndexAgent } from "@/lib/agents/hooks";
import { emitWorkspaceDevtoolsEvent } from "@/lib/devtools/workspace-devtools";
import { invalidateNotesQuery, notesListQueryKey, notesListQueryOptions, type NoteRecord } from "@/lib/queries/notes";
import { toast } from "@/lib/toast";

function sortByUpdatedAtDesc<T extends { updatedAt: number }>(items: T[]): T[] {
	return [...items].sort((left, right) => right.updatedAt - left.updatedAt);
}

function summarizeContent(content: string): string {
	return content.replace(/\s+/g, " ").trim().slice(0, 240);
}

function upsertSidebarNote(notes: SidebarNote[], note: SidebarNote): SidebarNote[] {
	return sortByUpdatedAtDesc([note, ...notes.filter((existing) => existing.id !== note.id)]);
}

export function useWorkspaceNotes({
	userId,
	selectedNoteId,
	onSelectNoteId,
}: {
	userId: string;
	selectedNoteId: string | null;
	onSelectNoteId: (noteId: string | null) => void;
}) {
	const queryClient = useQueryClient();
	const notesQuery = useQuery(notesListQueryOptions());
	const [indexNotes, setIndexNotes] = useState<SidebarNote[]>([]);
	const [isMutating, setIsMutating] = useState(false);

	const apiNotes = notesQuery.data?.notes ?? [];
	const isApiLoading = notesQuery.isLoading;
	const apiError = notesQuery.error instanceof Error ? notesQuery.error.message : null;

	const refreshApiNotes = useCallback(async () => {
		await invalidateNotesQuery(queryClient);
		await queryClient.fetchQuery(notesListQueryOptions());
	}, [queryClient]);

	const upsertApiNote = useCallback(
		(note: NoteRecord) => {
			queryClient.setQueryData(
				notesListQueryKey(),
				(current: { notes: NoteRecord[] } | undefined) => ({
					notes: upsertSidebarNote(current?.notes ?? [], note),
				}),
			);
		},
		[queryClient],
	);

	const removeApiNote = useCallback(
		(noteId: string) => {
			queryClient.setQueryData(
				notesListQueryKey(),
				(current: { notes: NoteRecord[] } | undefined) => ({
					notes: (current?.notes ?? []).filter((note) => note.id !== noteId),
				}),
			);
		},
		[queryClient],
	);

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

	const usingFallback = isApiLoading && apiNotes.length === 0 && indexNotes.length > 0;

	const indexNotesById = useMemo(() => {
		return new Map(indexNotes.map((note) => [note.id, note]));
	}, [indexNotes]);

	const apiNotesById = useMemo(() => {
		return new Map(apiNotes.map((note) => [note.id, note]));
	}, [apiNotes]);

	const sidebarNotes = useMemo(() => {
		const noteIds = new Set([...apiNotes.map((note) => note.id), ...indexNotes.map((note) => note.id)]);

		return sortByUpdatedAtDesc(
			Array.from(noteIds)
				.map((noteId) => {
					const apiNote = apiNotesById.get(noteId);
					const indexedNote = indexNotesById.get(noteId);

					if (apiNote && indexedNote) {
						return {
							...indexedNote,
							title: apiNote.title,
							content: apiNote.content,
							summary: apiNote.summary,
							tags: apiNote.tags,
							updatedAt: Math.max(apiNote.updatedAt, indexedNote.updatedAt),
						};
					}

					return apiNote ?? indexedNote ?? null;
				})
				.filter((note): note is SidebarNote => note !== null),
		);
	}, [apiNotes, apiNotesById, indexNotes, indexNotesById]);

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

		if (!sidebarNotes.some((note) => note.id === selectedNoteId)) {
			onSelectNoteId(null);
		}
	}, [isApiLoading, onSelectNoteId, selectedNoteId, sidebarNotes, usingFallback]);

	const createNewNote = useCallback(async () => {
		setIsMutating(true);
		const startedAt = performance.now();

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
			upsertApiNote({
				id: payload.note.id,
				title: "Untitled note",
				content: "",
				summary: "",
				tags: [],
				updatedAt: Date.now(),
			});
			onSelectNoteId(payload.note.id);
			emitWorkspaceDevtoolsEvent("note-persistence", {
				action: "create",
				status: "success",
				noteId: payload.note.id,
				durationMs: Math.round(performance.now() - startedAt),
				timestamp: Date.now(),
			});
			return payload.note.id;
		} catch (error) {
			emitWorkspaceDevtoolsEvent("note-persistence", {
				action: "create",
				status: "error",
				durationMs: Math.round(performance.now() - startedAt),
				message: error instanceof Error ? error.message : "Failed to create note",
				timestamp: Date.now(),
			});
			toast.error(error instanceof Error ? error.message : "Failed to create note");
			return null;
		} finally {
			setIsMutating(false);
		}
	}, [onSelectNoteId, upsertApiNote]);

	const saveNoteContent = useCallback(
		async (
			input: { noteId: string; content: string; title?: string },
			options?: { silent?: boolean },
		) => {
			if (!options?.silent) {
				setIsMutating(true);
			}
			const startedAt = performance.now();

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

				upsertApiNote({
					id: payload.note.id,
					title: payload.note.title,
					content: payload.note.content,
					summary: payload.note.summary ?? summarizeContent(payload.note.content),
					tags: payload.note.tags ?? [],
					updatedAt: payload.note.updatedAt,
				});

				if (!options?.silent) {
					toast.success("Saved note.");
				}
				if (!options?.silent) {
					emitWorkspaceDevtoolsEvent("note-persistence", {
						action: "save",
						status: "success",
						noteId: payload.note.id,
						silent: false,
						durationMs: Math.round(performance.now() - startedAt),
						timestamp: Date.now(),
					});
				}
			} catch (error) {
				emitWorkspaceDevtoolsEvent("note-persistence", {
					action: "save",
					status: "error",
					noteId: input.noteId,
					silent: Boolean(options?.silent),
					durationMs: Math.round(performance.now() - startedAt),
					message: error instanceof Error ? error.message : "Failed to save note content",
					timestamp: Date.now(),
				});
				if (!options?.silent) {
					toast.error(error instanceof Error ? error.message : "Failed to save note content");
				}
				throw error;
			} finally {
				if (!options?.silent) {
					setIsMutating(false);
				}
			}
		},
		[upsertApiNote],
	);

	const restoreNote = useCallback(
		async (noteId: string) => {
			setIsMutating(true);
			const startedAt = performance.now();

			try {
				const response = await fetch(`${env.VITE_SERVER_URL}/api/notes/${noteId}/restore`, {
					method: "POST",
					credentials: "include",
				});

				if (!response.ok) {
					const payload = (await response.json()) as { error?: string };
					throw new Error(payload.error ?? "Failed to restore note");
				}

				await refreshApiNotes();
				onSelectNoteId(noteId);
				toast.success("Restored note.");
				emitWorkspaceDevtoolsEvent("note-persistence", {
					action: "restore",
					status: "success",
					noteId,
					durationMs: Math.round(performance.now() - startedAt),
					timestamp: Date.now(),
				});
			} catch (error) {
				emitWorkspaceDevtoolsEvent("note-persistence", {
					action: "restore",
					status: "error",
					noteId,
					durationMs: Math.round(performance.now() - startedAt),
					message: error instanceof Error ? error.message : "Failed to restore note",
					timestamp: Date.now(),
				});
				throw error;
			} finally {
				setIsMutating(false);
			}
		},
		[onSelectNoteId, refreshApiNotes],
	);

	const archiveNote = useCallback(
		async (noteId: string) => {
			setIsMutating(true);
			const startedAt = performance.now();

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

				setIndexNotes((current) => current.filter((note) => note.id !== noteId));
				removeApiNote(noteId);
				toast.success("Archived note.", {
					action: {
						label: "Undo",
						onClick: () => {
							void restoreNote(noteId);
						},
					},
				});
				emitWorkspaceDevtoolsEvent("note-persistence", {
					action: "archive",
					status: "success",
					noteId,
					durationMs: Math.round(performance.now() - startedAt),
					timestamp: Date.now(),
				});
			} catch (error) {
				emitWorkspaceDevtoolsEvent("note-persistence", {
					action: "archive",
					status: "error",
					noteId,
					durationMs: Math.round(performance.now() - startedAt),
					message: error instanceof Error ? error.message : "Failed to archive note",
					timestamp: Date.now(),
				});
				toast.error(error instanceof Error ? error.message : "Failed to archive note");
				throw error;
			} finally {
				setIsMutating(false);
			}
		},
		[onSelectNoteId, removeApiNote, restoreNote, selectedNoteId],
	);

	const handleNoteRewritePersisted = useCallback(async () => {
		await refreshApiNotes();
	}, [refreshApiNotes]);

	return {
		apiError,
		archiveNote,
		createNewNote,
		handleNoteRewritePersisted,
		isApiLoading,
		isMutating,
		refreshApiNotes,
		restoreNote,
		saveNoteContent,
		selectedNote,
		sidebarNotes,
		usingFallback,
	};
}
