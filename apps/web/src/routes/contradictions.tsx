import { Button } from "@cloudflare/kumo";
import { env } from "@gneissdotrun/env/web";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";

interface ContradictionItem {
	id: string;
	status: string;
	updatedAt: number;
	factA: {
		id: string;
		text: string;
	};
	factB: {
		id: string;
		text: string;
	};
}

export const Route = createFileRoute("/contradictions")({
	component: ContradictionsRoute,
});

function ContradictionsRoute() {
	const { data: session, isPending } = authClient.useSession();
	const [contradictions, setContradictions] = useState<ContradictionItem[]>([]);
	const [workflowIdsByContradiction, setWorkflowIdsByContradiction] = useState<
		Record<string, string>
	>({});
	const [isLoading, setIsLoading] = useState(false);
	const [isWorkingId, setIsWorkingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const loadContradictions = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch(`${env.VITE_SERVER_URL}/api/contradictions`, {
				method: "GET",
				credentials: "include",
			});

			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? "Failed to load contradictions");
			}

			const payload = (await response.json()) as { contradictions: ContradictionItem[] };
			setContradictions(payload.contradictions ?? []);
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : "Failed to load contradictions");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!session?.user.id) {
			return;
		}

		void loadContradictions();
	}, [loadContradictions, session?.user.id]);

	const analyzeContradiction = async (contradictionId: string) => {
		setIsWorkingId(contradictionId);
		setError(null);
		setNotice(null);

		try {
			const response = await fetch(`${env.VITE_SERVER_URL}/api/contradictions/analyze`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({ contradictionId }),
			});

			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? "Failed to start contradiction analysis");
			}

			const payload = (await response.json()) as {
				workflowId?: string | null;
			};
			if (payload.workflowId) {
				setWorkflowIdsByContradiction((previous) => ({
					...previous,
					[contradictionId]: payload.workflowId!,
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

	const resolveContradiction = async (
		contradictionId: string,
		keep: "factA" | "factB",
		workflowId?: string,
	) => {
		if (!workflowId) {
			setError("Run Analyze first so a workflow can be approved.");
			return;
		}

		setIsWorkingId(contradictionId);
		setError(null);
		setNotice(null);

		const reason = window.prompt("Optional resolution reason", "") ?? undefined;

		try {
			const response = await fetch(`${env.VITE_SERVER_URL}/api/contradictions/resolve`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({ workflowId, keep, reason }),
			});

			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? "Failed to resolve contradiction");
			}

			setNotice("Contradiction resolved.");
			setWorkflowIdsByContradiction((previous) => {
				const next = { ...previous };
				delete next[contradictionId];
				return next;
			});
			await loadContradictions();
		} catch (resolveError) {
			setError(
				resolveError instanceof Error ? resolveError.message : "Failed to resolve contradiction",
			);
		} finally {
			setIsWorkingId(null);
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
				<p className="text-muted-foreground text-sm">Sign in to review contradictions.</p>
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
					<h1 className="text-3xl font-semibold tracking-tight">Contradictions</h1>
					<p className="text-muted-foreground mt-1 text-sm">
						Review open contradiction candidates and resolve with explicit approval.
					</p>
				</div>
				<div className="flex gap-2">
					<a href="/">
						<Button variant="outline">Back to workspace</Button>
					</a>
					<a href="/collections">
						<Button variant="ghost">Collections</Button>
					</a>
					<Button variant="outline" onClick={() => void loadContradictions()} disabled={isLoading}>
						{isLoading ? "Refreshing..." : "Refresh"}
					</Button>
				</div>
			</header>

			{error ? <p className="text-destructive text-xs">{error}</p> : null}
			{notice ? <p className="text-muted-foreground text-xs">{notice}</p> : null}

			{isLoading ? (
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
											void resolveContradiction(contradiction.id, "factA", workflowId);
										}}
									>
										Keep A
									</Button>
									<Button
										variant="ghost"
										size="sm"
										disabled={isWorking || !workflowId}
										onClick={() => {
											void resolveContradiction(contradiction.id, "factB", workflowId);
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
