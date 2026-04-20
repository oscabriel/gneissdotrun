import type { QueryClient } from "@tanstack/react-query";

import { orpc } from "@/utils/orpc";

export type CollectionStatus = "active" | "resolved" | "archived";

export interface CollectionItem {
	id: string;
	title: string;
	summary: string;
	status: CollectionStatus;
	noteCount: number;
	lastCaptureAt: number | null;
	updatedAt: number;
}

export function collectionsQueryOptions() {
	return orpc.review.collections.list.queryOptions();
}

export function updateCollectionStatusMutationOptions(queryClient: QueryClient) {
	return orpc.review.collections.setStatus.mutationOptions({
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: orpc.review.collections.list.queryKey(),
			});
		},
	});
}
