import type { QueryClient } from "@tanstack/react-query";

import { orpc } from "@/utils/orpc";

export interface WeeklyDigest {
	title: string;
	overview: string;
	highlights: string[];
	risks: string[];
	nextActions: string[];
	generatedAt: number;
	rangeStart: number;
	rangeEnd: number;
	noteCount: number;
	pendingActionCount: number;
}

export function digestQueryOptions() {
	return orpc.review.digest.get.queryOptions();
}

export function generateDigestMutationOptions(queryClient: QueryClient) {
	return orpc.review.digest.generate.mutationOptions({
		onSuccess: (payload) => {
			queryClient.setQueryData(orpc.review.digest.get.queryKey(), {
				digest: payload.digest,
				updatedAt: payload.digest.generatedAt,
			});
		},
	});
}
