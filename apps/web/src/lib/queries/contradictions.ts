import type { QueryClient } from "@tanstack/react-query";

import { orpc } from "@/utils/orpc";

export interface ContradictionItem {
	id: string;
	status: string;
	updatedAt: number;
	resolutionReason?: string | null;
	factA: {
		id: string;
		text: string;
	};
	factB: {
		id: string;
		text: string;
	};
}

export function contradictionsQueryOptions() {
	return orpc.review.contradictions.list.queryOptions();
}

export function analyzeContradictionMutationOptions() {
	return orpc.review.contradictions.analyze.mutationOptions();
}

export function resolveContradictionMutationOptions(queryClient: QueryClient) {
	return orpc.review.contradictions.resolve.mutationOptions({
		onSuccess: () => {
			return queryClient.invalidateQueries({
				queryKey: orpc.review.contradictions.list.queryKey(),
			});
		},
	});
}
