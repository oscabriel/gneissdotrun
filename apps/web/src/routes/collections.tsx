import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { env } from "@gneissdotrun/env/web";
import { Button } from "@cloudflare/kumo";

import { SearchBar } from "@/components/search-bar";
import { authClient } from "@/lib/auth-client";

type CollectionStatus = "active" | "resolved" | "archived";

interface CollectionItem {
	id: string;
	title: string;
	summary: string;
	status: CollectionStatus;
	noteCount: number;
	lastCaptureAt: number | null;
	updatedAt: number;
}

interface LifecycleResult {
	ok?: boolean;
	collections?: CollectionItem[];
	error?: string;
}

interface CollectionsSearch {
	query: string;
}

function validateCollectionsSearch(search: Record<string, unknown>): CollectionsSearch {
	const query = typeof search.query === "string" ? search.query.trim() : "";
	return { query };
}

export const Route = createFileRoute("/collections")({
	component: CollectionsRoute,
	validateSearch: validateCollectionsSearch,
});

function CollectionsRoute() {
	const { data: session, isPending } = authClient.useSession();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const [collections, setCollections] = useState<CollectionItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const loadCollections = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch(`${env.VITE_SERVER_URL}/api/collections`, {
				method: "GET",
				credentials: "include",
			});

			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? "Failed to load collections");
			}

			const payload = (await response.json()) as { collections: CollectionItem[] };
			setCollections(payload.collections ?? []);
		} catch (collectionsError) {
			setError(collectionsError instanceof Error ? collectionsError.message : "Load failed");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!session?.user.id) {
			return;
		}

		void loadCollections();
	}, [loadCollections, session?.user.id]);

	const updateStatus = async (collectionId: string, status: CollectionStatus) => {
		setIsUpdatingId(collectionId);
		setError(null);

		try {
			const response = await fetch(`${env.VITE_SERVER_URL}/api/collections/lifecycle`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({
					action: "set_collection_status",
					collectionId,
					status,
				}),
			});

			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? "Collection update failed");
			}

			const payload = (await response.json()) as LifecycleResult;
			setCollections(payload.collections ?? []);
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

	if (isPending) {
		return (
			<div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4">
				<p className="text-muted-foreground text-sm">Loading session...</p>
			</div>
		);
	}

	if (!session) {
		return (
			<div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-3 px-4">
				<p className="text-muted-foreground text-sm">Sign in to browse collections.</p>
				<a href="/" className="underline">
					Back to home
				</a>
			</div>
		);
	}

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
					<a href="/">
						<Button variant="outline">Back to workspace</Button>
					</a>
					<a href="/digest">
						<Button variant="ghost">Digest</Button>
					</a>
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
						onClick={() => void loadCollections()}
						disabled={isLoading}
					>
						{isLoading ? "Refreshing..." : "Refresh"}
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
