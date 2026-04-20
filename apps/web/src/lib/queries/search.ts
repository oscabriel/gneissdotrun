import { orpc } from "@/utils/orpc";

export interface SearchResult {
	answer: string;
	citations: Array<{ id: string; title: string }>;
	relatedCollections: Array<{ id: string; title: string; summary: string }>;
	followUps: string[];
}

export function searchQueryKey(question: string) {
	return orpc.review.search.queryKey({
		input: { question },
	});
}

export function searchQueryOptions(question: string) {
	return orpc.review.search.queryOptions({
		input: { question },
	});
}
