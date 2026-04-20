import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Button, buttonVariants } from "@cloudflare/kumo";

import { SearchBar } from "@/components/search-bar";
import {
	type CollectionStatus,
	collectionsQueryOptions,
	updateCollectionStatusMutationOptions,
} from "@/lib/queries/collections";
import { searchQueryOptions } from "@/lib/queries/search";

interface CollectionsSearch {
	query: string;
}

function validateCollectionsSearch(search: Record<string, unknown>): CollectionsSearch {
	const query = typeof search.query === "string" ? search.query.trim() : "";
	return { query };
}

export const Route = createFileRoute("/_protected/collections")({
	validateSearch: validateCollectionsSearch,
	loaderDeps: ({ search }) => ({ query: search.query }),
	loader: async ({ context, deps }) => {
		await Promise.all([
			context.queryClient.ensureQueryData(collectionsQueryOptions()),
			deps.query.length > 0
				? context.queryClient.ensureQueryData(searchQueryOptions(deps.query))
				: Promise.resolve(null),
		]);
	},
	component: CollectionsRoute,
});

function CollectionsRoute() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();
	const { data, refetch, isFetching } = useSuspenseQuery(collectionsQueryOptions());
	const updateStatusMutation = useMutation(updateCollectionStatusMutationOptions(queryClient));
	const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const collections = data.collections ?? [];

	const updateStatus = async (collectionId: string, status: CollectionStatus) => {
		setIsUpdatingId(collectionId);
		setError(null);

		try {
			await updateStatusMutation.mutateAsync({ collectionId, status });
		} catch (updateError) {
			setError(updateError instanceof Error ? updateError.message : "Collection update failed");
		} finally {
			setIsUpdatingId(null);
		}
	};

	const handleSearchCommit = useCallback(
		(nextQuery: string) => {
			void navigate({
				search: (previous) => ({
					...previous,
					query: nextQuery.trim(),
				}),
			});
		},
		[navigate],
	);

	return (
		<div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-6">
			<header className="border-border flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
						Optional review surface
					</p>
					<h1 className="text-3xl font-semibold tracking-tight">Collections</h1>
					<p className="text-muted-foreground mt-1 text-sm">
						Background organization groups related captures here. Reviewing is optional.
					</p>
				</div>
				<div className="flex gap-2">
					<Link to="/" className={buttonVariants({ variant: "outline" })}>
						Back to workspace
					</Link>
					<Link to="/digest" className={buttonVariants({ variant: "ghost" })}>
						Digest
					</Link>
				</div>
			</header>

			<section className="border-border bg-card space-y-3 border p-4">
				<div className="flex items-center justify-between">
					<p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
						Collections
					</p>
					<Button
						variant="outline"
						size="sm"
						onClick={() => void refetch()}
						disabled={isFetching}
					>
						{isFetching ? "Refreshing..." : "Refresh"}
					</Button>
				</div>

				{error ? <p className="text-destructive text-xs">{error}</p> : null}

				{collections.length === 0 ? (
					<p className="text-muted-foreground text-xs">
						No collections yet. New captures are organized in the background and appear here
						automatically.
					</p>
				) : (
					<div className="space-y-3">
						{collections.map((collection) => (
							<div
								key={collection.id}
								className="border-border bg-background space-y-2 border p-3 text-xs"
							>
								<div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
									<div>
										<p className="font-medium">{collection.title}</p>
										<p className="text-muted-foreground">
											{collection.noteCount} notes · status: {collection.status}
										</p>
									</div>
									<p className="text-muted-foreground">
										Updated {new Date(collection.updatedAt).toLocaleString()}
									</p>
								</div>

								{collection.summary ? (
									<p className="text-muted-foreground whitespace-pre-wrap">{collection.summary}</p>
								) : null}

								<div className="flex flex-wrap gap-2">
									{collection.status !== "active" ? (
										<Button
											variant="outline"
											size="sm"
											onClick={() => void updateStatus(collection.id, "active")}
											disabled={isUpdatingId === collection.id}
										>
											Set active
										</Button>
									) : null}
									{collection.status !== "resolved" ? (
										<Button
											variant="outline"
											size="sm"
											onClick={() => void updateStatus(collection.id, "resolved")}
											disabled={isUpdatingId === collection.id}
										>
											Mark resolved
										</Button>
									) : null}
									{collection.status !== "archived" ? (
										<Button
											variant="ghost"
											size="sm"
											onClick={() => void updateStatus(collection.id, "archived")}
											disabled={isUpdatingId === collection.id}
										>
											Archive
										</Button>
									) : null}
								</div>
							</div>
						))}
					</div>
				)}
			</section>

			<div>
				<p className="text-muted-foreground mb-2 text-xs">
					Need a targeted lookup? Search stays available here without interrupting canvas-first
					capture.
				</p>
				<SearchBar query={search.query} onQueryCommit={handleSearchCommit} />
			</div>
		</div>
	);
}
