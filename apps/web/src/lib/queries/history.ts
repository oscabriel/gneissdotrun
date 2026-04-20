import type { QueryClient } from "@tanstack/react-query";

import { orpc } from "@/utils/orpc";

export interface HistoryEntry {
	id: string;
	routeKind: string;
	prompt: string;
	actionSummary: string;
	interactionType: string;
	commandName: string | null;
	commandArgument: string;
	sourceNoteIds: string[];
	versionId: string | null;
	timestamp: number;
	versionCreatedAt: number | null;
}

export interface HistoryNoteSummary {
	id: string;
	title: string;
}

export interface NoteHistoryPayload {
	note: HistoryNoteSummary;
	history: HistoryEntry[];
}

export function noteHistoryQueryKey(noteId: string) {
	return orpc.review.history.get.queryKey({
		input: { noteId },
	});
}

export function noteHistoryQueryOptions(noteId: string) {
	return orpc.review.history.get.queryOptions({
		input: { noteId },
	});
}

export function revertNoteMutationOptions(queryClient: QueryClient) {
	return orpc.review.history.revert.mutationOptions({
		onSuccess: (_, { noteId }) => {
			return queryClient.invalidateQueries({ queryKey: noteHistoryQueryKey(noteId) });
		},
	});
}
