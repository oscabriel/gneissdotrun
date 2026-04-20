import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Button, buttonVariants } from "@cloudflare/kumo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import {
	noteHistoryQueryOptions,
	revertNoteMutationOptions,
	type HistoryEntry,
	type NoteHistoryPayload,
} from "@/lib/queries/history";

interface HistorySearch {
	noteId?: string;
}

function validateHistorySearch(search: Record<string, unknown>): HistorySearch {
	const noteId =
		typeof search.noteId === "string" && search.noteId.trim().length > 0
			? search.noteId
			: undefined;
	return { noteId };
}

export const Route = createFileRoute("/_protected/history")({
	validateSearch: validateHistorySearch,
	loaderDeps: ({ search }) => ({ noteId: search.noteId }),
	loader: ({ context, deps }) => {
		if (!deps.noteId) {
			return null;
		}

		return context.queryClient.ensureQueryData(noteHistoryQueryOptions(deps.noteId));
	},
	component: HistoryRoute,
});

function HistoryRoute() {
	const search = Route.useSearch();

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
					<Link to="/" className={buttonVariants({ variant: "outline" })}>
						Back to workspace
					</Link>
					<Link
						to="/collections"
						search={{ query: "" }}
						className={buttonVariants({ variant: "ghost" })}
					>
						Collections
					</Link>
				</div>
			</header>

			{!search.noteId ? (
				<section className="border-border bg-card border p-4 text-sm">
					<p className="text-muted-foreground">
						Select a note from the workspace, then open Note history from the More menu.
					</p>
				</section>
			) : (
				<HistoryContent noteId={search.noteId} />
			)}
		</div>
	);
}

function HistoryContent({ noteId }: { noteId: string }) {
	const queryClient = useQueryClient();
	const { data, isFetching } = useSuspenseQuery(noteHistoryQueryOptions(noteId));
	const revertNoteMutation = useMutation(revertNoteMutationOptions(queryClient));
	const [isRevertingVersionId, setIsRevertingVersionId] = useState<string | null>(null);
	const [pendingRevertVersionId, setPendingRevertVersionId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const revertToVersion = async () => {
		if (!pendingRevertVersionId) {
			return;
		}

		const versionId = pendingRevertVersionId;
		setIsRevertingVersionId(versionId);
		setError(null);
		setNotice(null);

		try {
			await revertNoteMutation.mutateAsync({ noteId, versionId });
			setNotice("Reverted note to selected version.");
		} catch (revertError) {
			setError(revertError instanceof Error ? revertError.message : "Revert failed");
		} finally {
			setIsRevertingVersionId(null);
			setPendingRevertVersionId(null);
		}
	};

	return (
		<>
			<ConfirmDialog
				open={pendingRevertVersionId !== null}
				onOpenChange={(open) => {
					if (!open) {
						setPendingRevertVersionId(null);
					}
				}}
				title="Revert note"
				description="Reverting creates a new snapshot and makes the selected version the current note content."
				confirmLabel="Revert note"
				onConfirm={revertToVersion}
			/>
			<HistoryView
				data={data}
				error={error}
				isFetching={isFetching}
				isRevertingVersionId={isRevertingVersionId}
				notice={notice}
				onRevert={(versionId) => {
					setPendingRevertVersionId(versionId);
					return Promise.resolve();
				}}
			/>
		</>
	);
}

function HistoryView({
	data,
	error,
	isFetching,
	isRevertingVersionId,
	notice,
	onRevert,
}: {
	data: NoteHistoryPayload;
	error: string | null;
	isFetching: boolean;
	isRevertingVersionId: string | null;
	notice: string | null;
	onRevert: (versionId: string) => Promise<void>;
}) {
	const note = data.note;
	const history = data.history;

	return (
		<>
			<section className="border-border bg-card border p-4">
				<p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
					Active note
				</p>
				<p className="mt-1 text-sm font-medium">{note.title}</p>
			</section>

			{error ? <p className="text-destructive text-xs">{error}</p> : null}
			{notice ? <p className="text-muted-foreground text-xs">{notice}</p> : null}
			{isFetching ? <p className="text-muted-foreground text-sm">Refreshing history...</p> : null}

			{history.length === 0 ? (
				<section className="border-border bg-card border p-4 text-xs">
					<p className="text-muted-foreground">No history entries yet for this note.</p>
				</section>
			) : (
				<section className="space-y-3">
					{history.map((entry: HistoryEntry) => (
						<div key={entry.id} className="border-border bg-card space-y-2 border p-3">
							<div className="flex flex-wrap items-center justify-between gap-2 text-xs">
								<p className="text-muted-foreground uppercase">
									{entry.interactionType.replaceAll("_", " ")} - {entry.routeKind.replaceAll("_", " ")}
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
										onClick={() => void onRevert(entry.versionId!)}
									>
										{isRevertingVersionId === entry.versionId ? "Reverting..." : "Revert to this version"}
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
	);
}
