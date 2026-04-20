import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Button, buttonVariants } from "@cloudflare/kumo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { TextPromptDialog } from "@/components/dialogs/text-prompt-dialog";
import {
	analyzeContradictionMutationOptions,
	contradictionsQueryOptions,
	resolveContradictionMutationOptions,
} from "@/lib/queries/contradictions";

export const Route = createFileRoute("/_protected/contradictions")({
	loader: ({ context }) => context.queryClient.ensureQueryData(contradictionsQueryOptions()),
	component: ContradictionsRoute,
});

function ContradictionsRoute() {
	const queryClient = useQueryClient();
	const { data, refetch, isFetching } = useSuspenseQuery(contradictionsQueryOptions());
	const analyzeMutation = useMutation(analyzeContradictionMutationOptions());
	const resolveMutation = useMutation(resolveContradictionMutationOptions(queryClient));
	const [workflowIdsByContradiction, setWorkflowIdsByContradiction] = useState<
		Record<string, string>
	>({});
	const [isWorkingId, setIsWorkingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [pendingResolution, setPendingResolution] = useState<{
		contradictionId: string;
		keep: "factA" | "factB";
		workflowId: string;
	} | null>(null);
	const contradictions = data.contradictions ?? [];

	const analyzeContradiction = async (contradictionId: string) => {
		setIsWorkingId(contradictionId);
		setError(null);
		setNotice(null);

		try {
			const payload = await analyzeMutation.mutateAsync({ contradictionId });
			const workflowId = payload.workflowId;
			if (typeof workflowId === "string" && workflowId.length > 0) {
				setWorkflowIdsByContradiction((previous) => ({
					...previous,
					[contradictionId]: workflowId,
				}));
			}
			setNotice("Started contradiction analysis. Choose Keep A or Keep B to resolve.");
		} catch (analyzeError) {
			setError(
				analyzeError instanceof Error
					? analyzeError.message
					: "Failed to start contradiction analysis",
			);
		} finally {
			setIsWorkingId(null);
		}
	};

	const requestResolution = (
		contradictionId: string,
		keep: "factA" | "factB",
		workflowId?: string,
	) => {
		if (!workflowId || workflowId.length === 0) {
			setError("Run Analyze first so a workflow can be approved.");
			return;
		}

		setPendingResolution({ contradictionId, keep, workflowId });
	};

	const resolveContradiction = async (reason: string) => {
		if (!pendingResolution) {
			return;
		}

		const { contradictionId, keep, workflowId } = pendingResolution;

		setIsWorkingId(contradictionId);
		setError(null);
		setNotice(null);

		try {
			await resolveMutation.mutateAsync({ workflowId, keep, reason: reason.trim() || undefined });
			setNotice("Contradiction resolved.");
			setWorkflowIdsByContradiction((previous) => {
				const next = { ...previous };
				delete next[contradictionId];
				return next;
			});
		} catch (resolveError) {
			setError(
				resolveError instanceof Error ? resolveError.message : "Failed to resolve contradiction",
			);
		} finally {
			setIsWorkingId(null);
			setPendingResolution(null);
		}
	};

	return (
		<div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-6">
			<TextPromptDialog
				open={pendingResolution !== null}
				onOpenChange={(open) => {
					if (!open) {
						setPendingResolution(null);
					}
				}}
				title="Resolve contradiction"
				description={
					pendingResolution
						? `Confirm which fact to keep and optionally record a reason for choosing ${pendingResolution.keep === "factA" ? "Fact A" : "Fact B"}.`
						: undefined
				}
				label="Resolution reason"
				defaultValue=""
				placeholder="Optional context for this decision"
				confirmLabel="Resolve contradiction"
				onSubmit={resolveContradiction}
				maxLength={500}
			/>
			<header className="border-border flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
						Optional review surface
					</p>
					<h1 className="text-3xl font-semibold tracking-tight">Contradictions</h1>
					<p className="text-muted-foreground mt-1 text-sm">
						Review open contradiction candidates and resolve with explicit approval.
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
					<Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
						{isFetching ? "Refreshing..." : "Refresh"}
					</Button>
				</div>
			</header>

			{error ? <p className="text-destructive text-xs">{error}</p> : null}
			{notice ? <p className="text-muted-foreground text-xs">{notice}</p> : null}

			{isFetching ? (
				<p className="text-muted-foreground text-sm">Loading contradictions...</p>
			) : contradictions.length === 0 ? (
				<section className="border-border bg-card border p-4 text-xs">
					<p className="text-muted-foreground">No open contradictions right now.</p>
				</section>
			) : (
				<section className="space-y-3">
					{contradictions.map((contradiction) => {
						const workflowId = workflowIdsByContradiction[contradiction.id];
						const isWorking = isWorkingId === contradiction.id;

						return (
							<div key={contradiction.id} className="border-border bg-card space-y-3 border p-3">
								<div className="flex items-center justify-between gap-2 text-xs">
									<p className="text-muted-foreground uppercase">{contradiction.status}</p>
									<p className="text-muted-foreground">
										Updated {new Date(contradiction.updatedAt).toLocaleString()}
									</p>
								</div>

								<div className="grid gap-2 md:grid-cols-2">
									<div className="border-border bg-background border px-3 py-2 text-xs">
										<p className="text-muted-foreground mb-1 uppercase">Fact A</p>
										<p>{contradiction.factA.text}</p>
									</div>
									<div className="border-border bg-background border px-3 py-2 text-xs">
										<p className="text-muted-foreground mb-1 uppercase">Fact B</p>
										<p>{contradiction.factB.text}</p>
									</div>
								</div>

								<div className="flex flex-wrap gap-2">
									<Button
										variant="outline"
										size="sm"
										disabled={isWorking}
										onClick={() => {
											void analyzeContradiction(contradiction.id);
										}}
									>
										{isWorking ? "Running..." : "Analyze"}
									</Button>
									<Button
										variant="outline"
										size="sm"
										disabled={isWorking || !workflowId}
										onClick={() => {
											requestResolution(contradiction.id, "factA", workflowId);
										}}
									>
										Keep A
									</Button>
									<Button
										variant="ghost"
										size="sm"
										disabled={isWorking || !workflowId}
										onClick={() => {
											requestResolution(contradiction.id, "factB", workflowId);
										}}
									>
										Keep B
									</Button>
								</div>
							</div>
						);
					})}
				</section>
			)}
		</div>
	);
}
