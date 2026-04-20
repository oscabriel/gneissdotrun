import { env } from "@gneissdotrun/env/web";
import type { CaptureRequest, RouteExecutionOutcome } from "@gneissdotrun/api/capture-contract";
import { useCallback, useEffect, useRef, useState } from "react";

import { mapOutcomeToUiIntent } from "@/lib/capture";
import { emitWorkspaceDevtoolsEvent } from "@/lib/devtools/workspace-devtools";
import { toast } from "@/lib/toast";

interface RewriteProgressUpdate {
	mode: "append" | "replace";
	text: string;
}

export type NoteProcessingState = "queued" | "streaming" | "persisting";

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

export function useWorkspaceCapture({
	onSelectNoteId,
	refreshApiNotes,
}: {
	onSelectNoteId: (noteId: string | null) => void;
	refreshApiNotes: () => Promise<void>;
}) {
	const ephemeralTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [isCapturing, setIsCapturing] = useState(false);
	const [noteProcessingStates, setNoteProcessingStates] = useState<
		Record<string, NoteProcessingState>
	>({});
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

	useEffect(() => {
		return () => {
			if (ephemeralTimerRef.current) {
				clearTimeout(ephemeralTimerRef.current);
			}
		};
	}, []);

	const handleCapture = useCallback(
		async (
			input: CaptureRequest,
			options?: {
				onRewriteProgress?: (update: RewriteProgressUpdate) => void;
			},
		) => {
			setIsCapturing(true);
			const touchedNoteIds = new Set<string>();
			const startedAt = performance.now();
			let lastPhase: "start" | "rewrite" | "persisting" | null = null;
			const emitCapturePhase = (phase: "start" | "rewrite" | "persisting") => {
				if (lastPhase === phase) {
					return;
				}

				lastPhase = phase;
				emitWorkspaceDevtoolsEvent("workspace-capture", {
					action: "capture",
					phase,
					noteId: input.noteId ?? null,
					noteIds: Array.from(touchedNoteIds),
					streaming: Boolean(options?.onRewriteProgress),
					timestamp: Date.now(),
				});
			};

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
			emitCapturePhase("start");

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
							emitCapturePhase("rewrite");
							return;
						}

						if (event.type === "rewrite_done") {
							markProcessingState(event.noteId ?? input.noteId, "persisting");
							emitCapturePhase("persisting");
							return;
						}

						if (event.type === "persisted") {
							for (const noteId of event.noteIds ?? []) {
								markProcessingState(noteId, "persisting");
							}
							emitCapturePhase("persisting");
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

				await refreshApiNotes();
				emitWorkspaceDevtoolsEvent("workspace-capture", {
					action: "capture",
					phase: "success",
					noteId: outcome.noteId ?? input.noteId ?? null,
					noteIds: Array.from(touchedNoteIds),
					streaming: Boolean(options?.onRewriteProgress),
					durationMs: Math.round(performance.now() - startedAt),
					message: outcome.toast?.message,
					timestamp: Date.now(),
				});
			} catch (error) {
				clearTouchedStates();
				emitWorkspaceDevtoolsEvent("workspace-capture", {
					action: "capture",
					phase: "error",
					noteId: input.noteId ?? null,
					noteIds: Array.from(touchedNoteIds),
					streaming: Boolean(options?.onRewriteProgress),
					durationMs: Math.round(performance.now() - startedAt),
					message: error instanceof Error ? error.message : "Capture failed",
					timestamp: Date.now(),
				});
				toast.error(error instanceof Error ? error.message : "Capture failed");
				if (options?.onRewriteProgress) {
					throw error;
				}
			} finally {
				setIsCapturing(false);
			}
		},
		[clearEphemeral, clearNoteProcessingState, onSelectNoteId, refreshApiNotes, scheduleEphemeral, setNoteProcessingState],
	);

	const handleRunOrganization = useCallback(async ({ noteId }: { noteId?: string }) => {
		setIsCapturing(true);
		const startedAt = performance.now();
		emitWorkspaceDevtoolsEvent("workspace-capture", {
			action: "organize",
			phase: "start",
			noteId: noteId ?? null,
			timestamp: Date.now(),
		});

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
			emitWorkspaceDevtoolsEvent("workspace-capture", {
				action: "organize",
				phase: "success",
				noteId: noteId ?? null,
				durationMs: Math.round(performance.now() - startedAt),
				timestamp: Date.now(),
			});
		} catch (error) {
			emitWorkspaceDevtoolsEvent("workspace-capture", {
				action: "organize",
				phase: "error",
				noteId: noteId ?? null,
				durationMs: Math.round(performance.now() - startedAt),
				message: error instanceof Error ? error.message : "Failed to trigger organization",
				timestamp: Date.now(),
			});
			toast.error(error instanceof Error ? error.message : "Failed to trigger organization");
			throw error;
		} finally {
			setIsCapturing(false);
		}
	}, []);

	const handleRunFanOut = useCallback(async ({ noteId, content }: { noteId: string; content: string }) => {
		setIsCapturing(true);
		const startedAt = performance.now();
		emitWorkspaceDevtoolsEvent("workspace-capture", {
			action: "fanout",
			phase: "start",
			noteId,
			timestamp: Date.now(),
		});

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
			emitWorkspaceDevtoolsEvent("workspace-capture", {
				action: "fanout",
				phase: "success",
				noteId,
				durationMs: Math.round(performance.now() - startedAt),
				timestamp: Date.now(),
			});
		} catch (error) {
			emitWorkspaceDevtoolsEvent("workspace-capture", {
				action: "fanout",
				phase: "error",
				noteId,
				durationMs: Math.round(performance.now() - startedAt),
				message: error instanceof Error ? error.message : "Failed to trigger fan-out workflow",
				timestamp: Date.now(),
			});
			toast.error(error instanceof Error ? error.message : "Failed to trigger fan-out workflow");
			throw error;
		} finally {
			setIsCapturing(false);
		}
	}, []);

	const handleCanvasInput = useCallback(() => {
		clearEphemeral();
	}, [clearEphemeral]);

	return {
		clearEphemeral,
		ephemeralContent,
		handleCanvasInput,
		handleCapture,
		handleRunFanOut,
		handleRunOrganization,
		isCapturing,
		noteProcessingStates,
	};
}
