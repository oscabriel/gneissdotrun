import type { QueryClient } from "@tanstack/react-query";

import { queryOptions } from "@tanstack/react-query";

import { getUser } from "@/functions/get-user";

export const sessionQueryKey = ["auth", "session"] as const;

export function sessionQueryOptions() {
	return queryOptions({
		queryKey: sessionQueryKey,
		queryFn: () => getUser(),
		staleTime: 60_000,
		gcTime: 5 * 60_000,
	});
}

export function ensureSessionQueryData(queryClient: QueryClient) {
	return queryClient.ensureQueryData(sessionQueryOptions());
}

export function invalidateSessionQuery(queryClient: QueryClient) {
	return queryClient.invalidateQueries({
		queryKey: sessionQueryKey,
	});
}
