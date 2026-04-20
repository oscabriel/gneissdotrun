import type { QueryClient } from "@tanstack/react-query";

import { orpc } from "@/utils/orpc";

export interface NoteRecord {
	id: string;
	title: string;
	content: string;
	summary: string;
	tags: string[];
	updatedAt: number;
}

export function notesListQueryOptions() {
	return orpc.notes.list.queryOptions();
}

export function notesListQueryKey() {
	return orpc.notes.list.queryKey();
}

export function invalidateNotesQuery(queryClient: QueryClient) {
	return queryClient.invalidateQueries({
		queryKey: notesListQueryKey(),
	});
}
