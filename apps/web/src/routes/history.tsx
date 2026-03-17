import { Button } from "@cloudflare/kumo";
import { env } from "@gneissdotrun/env/web";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";

interface HistorySearch {
	noteId?: string;
}

interface HistoryEntry {
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

function validateHistorySearch(search: Record<string, unknown>): HistorySearch {
	const noteId =
		typeof search.noteId === "string" && search.noteId.trim().length > 0
			? search.noteId
			: undefined;
	return { noteId };
}

export const Route = createFileRoute("/history")({
	validateSearch: validateHistorySearch,
	component: HistoryRoute,
});

function HistoryRoute() {
	const { data: session, isPending } = authClient.useSession();
	const search = Route.useSearch();
	const [note, setNote] = useState<{ id: string; title: string } | null>(null);
	const [history, setHistory] = useState<HistoryEntry[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isRevertingVersionId, setIsRevertingVersionId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const loadHistory = useCallback(async () => {
		if (!search.noteId) {
			setNote(null);
			setHistory([]);
			setError(null);
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch(`${env.VITE_SERVER_URL}/api/notes/${search.noteId}/history`, {
				method: "GET",
				credentials: "include",
			});

			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? "Failed to load history");
			}

			const payload = (await response.json()) as {
				note: { id: string; title: string };
				history: HistoryEntry[];
			};

			setNote(payload.note);
			setHistory(payload.history ?? []);
		} catch (historyError) {
			setError(historyError instanceof Error ? historyError.message : "Failed to load history");
		} finally {
			setIsLoading(false);
		}
	}, [search.noteId]);

	useEffect(() => {
		if (!session?.user.id) {
			return;
		}

		void loadHistory();
	}, [loadHistory, session?.user.id]);

	const revertToVersion = async (versionId: string) => {
		if (!search.noteId) {
			return;
		}

		const confirmed = window.confirm("Revert note to this version? This creates a new snapshot.");
		if (!confirmed) {
			return;
		}

		setIsRevertingVersionId(versionId);
		setError(null);
		setNotice(null);

		try {
			const response = await fetch(`${env.VITE_SERVER_URL}/api/notes/${search.noteId}/revert`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({ versionId }),
			});

			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? "Revert failed");
			}

			setNotice("Reverted note to selected version.");
			await loadHistory();
		} catch (revertError) {
			setError(revertError instanceof Error ? revertError.message : "Revert failed");
		} finally {
			setIsRevertingVersionId(null);
		}
	};

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
				<p className="text-muted-foreground text-sm">Sign in to view note history.</p>
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
					<h1 className="text-3xl font-semibold tracking-tight">Note history</h1>
					<p className="text-muted-foreground mt-1 text-sm">
						Inspect prior capture actions and revert safely when needed.
					</p>
				</div>
				<div className="flex gap-2">
					<a href="/">
						<Button variant="outline">Back to workspace</Button>
					</a>
					<a href="/collections">
						<Button variant="ghost">Collections</Button>
					</a>
				</div>
			</header>

			{!search.noteId ? (
				<section className="border-border bg-card border p-4 text-sm">
					<p className="text-muted-foreground">
						Select a note from the workspace, then open Note history from the More menu.
					</p>
				</section>
			) : (
				<>
					<section className="border-border bg-card border p-4">
						<p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
							Active note
						</p>
						<p className="mt-1 text-sm font-medium">{note?.title ?? "Loading note..."}</p>
					</section>

					{error ? <p className="text-destructive text-xs">{error}</p> : null}
					{notice ? <p className="text-muted-foreground text-xs">{notice}</p> : null}

					{isLoading ? (
						<p className="text-muted-foreground text-sm">Loading history...</p>
					) : history.length === 0 ? (
						<section className="border-border bg-card border p-4 text-xs">
							<p className="text-muted-foreground">No history entries yet for this note.</p>
						</section>
					) : (
						<section className="space-y-3">
							{history.map((entry) => (
								<div key={entry.id} className="border-border bg-card space-y-2 border p-3">
									<div className="flex flex-wrap items-center justify-between gap-2 text-xs">
										<p className="text-muted-foreground uppercase">
											{entry.interactionType.replaceAll("_", " ")} -{" "}
											{entry.routeKind.replaceAll("_", " ")}
										</p>
										<p className="text-muted-foreground">
											{new Date(entry.timestamp).toLocaleString()}
										</p>
									</div>

									{entry.commandName ? (
										<p className="text-muted-foreground text-xs font-medium">
											Slash command: /{entry.commandName}
											{entry.commandArgument ? ` ${entry.commandArgument}` : ""}
										</p>
									) : null}

									<p className="text-sm font-medium">{entry.actionSummary}</p>

									{entry.sourceNoteIds.length > 0 ? (
										<p className="text-muted-foreground text-xs">
											Sources: {entry.sourceNoteIds.join(", ")}
										</p>
									) : null}

									<div className="border-border bg-background border px-3 py-2 text-xs whitespace-pre-wrap">
										{entry.prompt || "(No prompt recorded)"}
									</div>

									{entry.versionId ? (
										<div className="flex items-center gap-2">
											<Button
												variant="outline"
												size="sm"
												disabled={isRevertingVersionId === entry.versionId}
												onClick={() => void revertToVersion(entry.versionId!)}
											>
												{isRevertingVersionId === entry.versionId
													? "Reverting..."
													: "Revert to this version"}
											</Button>
											{entry.versionCreatedAt ? (
												<p className="text-muted-foreground text-xs">
													Snapshot {new Date(entry.versionCreatedAt).toLocaleString()}
												</p>
											) : null}
										</div>
									) : null}
								</div>
							))}
						</section>
					)}
				</>
			)}
		</div>
	);
}
