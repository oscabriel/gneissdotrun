import { Button, DropdownMenu } from "@cloudflare/kumo";
import { useNavigate } from "@tanstack/react-router";
import type { RouteExecutionOutcome } from "@gneissdotrun/api/capture-contract";
import { env } from "@gneissdotrun/env/web";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { NotesSidebar, type SidebarNote } from "@/components/sidebar/notes-sidebar";
import { CanvasPane } from "@/components/workspace/canvas-pane";
import { useIndexAgent } from "@/lib/agents/hooks";
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
		updatedAt: number;
	}>;
}

interface RewriteProgressUpdate {
	mode: "append" | "replace";
	text: string;
}

type CaptureStreamEvent =
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

function sortByUpdatedAtDesc<T extends { updatedAt: number }>(items: T[]): T[] {
	return [...items].sort((left, right) => right.updatedAt - left.updatedAt);
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

export function WorkspaceShell({ userId, selectedNoteId, onSelectNoteId }: WorkspaceShellProps) {
	const navigate = useNavigate();
	const ephemeralTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [indexNotes, setIndexNotes] = useState<SidebarNote[]>([]);
	const [apiNotes, setApiNotes] = useState<SidebarNote[]>([]);
	const [isApiLoading, setIsApiLoading] = useState(false);
	const [apiError, setApiError] = useState<string | null>(null);
	const [isCapturing, setIsCapturing] = useState(false);
	const [ephemeralContent, setEphemeralContent] = useState<string | null>(null);

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
					return {
						...note,
						content: hydrated?.content ?? note.content,
						summary: hydrated?.summary ?? note.summary,
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

	const handleSelectNote = (noteId: string) => {
		clearEphemeral();
		onSelectNoteId(noteId);
	};

	const createNewNote = useCallback(async () => {
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
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to create note");
		} finally {
			setIsCapturing(false);
		}
	}, [clearEphemeral, fetchApiNotes, onSelectNoteId]);

	const handleCapture = useCallback(
		async (
			input: { userInput: string; noteId?: string },
			options?: {
				onRewriteProgress?: (update: RewriteProgressUpdate) => void;
			},
		) => {
			setIsCapturing(true);

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

				await fetchApiNotes();
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Capture failed");
				if (options?.onRewriteProgress) {
					throw error;
				}
			} finally {
				setIsCapturing(false);
			}
		},
		[clearEphemeral, fetchApiNotes, onSelectNoteId, scheduleEphemeral],
	);

	const handleSaveNoteContent = useCallback(
		async (input: { noteId: string; content: string; title?: string }, options?: { silent?: boolean }) => {
			setIsCapturing(true);

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

				await fetchApiNotes();
				if (!options?.silent) {
					toast.success("Saved note.");
				}
			} catch (error) {
				if (!options?.silent) {
					toast.error(error instanceof Error ? error.message : "Failed to save note content");
				}
				throw error;
			} finally {
				setIsCapturing(false);
			}
		},
		[fetchApiNotes],
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
	const handleCanvasInput = useCallback(() => {
		clearEphemeral();
	}, [clearEphemeral]);

	useEffect(() => {
		const listener = (event: KeyboardEvent) => {
			if (event.defaultPrevented) {
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
	}, [createNewNote]);

	return (
		<AppShell
			header={
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-1">
						<h1 className="text-kumo-strong text-2xl font-semibold tracking-tight sm:text-3xl">
							Gneiss
						</h1>
						<p className="text-kumo-subtle text-sm">
							Ambient knowledge capture powered by Cloudflare agents.
						</p>
					</div>

					<div className="flex flex-wrap gap-2">
						<Button
							size="base"
							variant="outline"
							onClick={() => {
								void createNewNote();
							}}
							aria-keyshortcuts="N"
							aria-label="Create a new note"
						>
							New Note
						</Button>
						<Button
							size="base"
							variant="outline"
							onClick={() => {
								void navigate({ to: "/profile" });
							}}
						>
							Profile
						</Button>

						<DropdownMenu>
							<DropdownMenu.Trigger render={<Button size="base" variant="outline" />}>
								Review
							</DropdownMenu.Trigger>
							<DropdownMenu.Content>
								<DropdownMenu.Group>
									<DropdownMenu.Label>Workspace review surfaces</DropdownMenu.Label>
									<DropdownMenu.Separator />
									<DropdownMenu.Item
										onClick={() => {
											void navigate({ to: "/collections", search: { query: "" } });
										}}
									>
										Collections review
									</DropdownMenu.Item>
									<DropdownMenu.Item
										onClick={() => {
											void navigate({ to: "/digest" });
										}}
									>
										Weekly digest
									</DropdownMenu.Item>
									<DropdownMenu.Item
										onClick={() => {
											if (!selectedNoteId) {
												toast.warning("Select a note first to open history.");
												return;
											}

											void navigate({ to: "/history", search: { noteId: selectedNoteId } });
										}}
									>
										Note history
									</DropdownMenu.Item>
								</DropdownMenu.Group>
							</DropdownMenu.Content>
						</DropdownMenu>
					</div>
				</div>
			}
			sidebar={
				<NotesSidebar
					notes={sidebarNotes}
					selectedNoteId={selectedNoteId}
					onSelectNote={handleSelectNote}
					isLoading={usingFallback && isApiLoading}
					error={usingFallback ? apiError : null}
					usingFallback={usingFallback}
				/>
			}
			main={
				<CanvasPane
					selectedNote={selectedNote}
					onCapture={handleCapture}
					onSaveNoteContent={handleSaveNoteContent}
					onArchiveNote={handleArchiveNote}
					isCapturing={isCapturing}
					ephemeralContent={ephemeralContent}
					onCanvasInput={handleCanvasInput}
				/>
			}
		/>
	);
}
