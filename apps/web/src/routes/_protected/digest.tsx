import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button, buttonVariants } from "@cloudflare/kumo";

import { digestQueryOptions, generateDigestMutationOptions } from "@/lib/queries/digest";

export const Route = createFileRoute("/_protected/digest")({
	loader: ({ context }) => context.queryClient.ensureQueryData(digestQueryOptions()),
	component: DigestRoute,
});

function DigestRoute() {
	const queryClient = useQueryClient();
	const { data, isFetching } = useSuspenseQuery(digestQueryOptions());
	const generateDigestMutation = useMutation(generateDigestMutationOptions(queryClient));
	const [error, setError] = useState<string | null>(null);
	const digest = data.digest;

	const generateDigest = async () => {
		setError(null);

		try {
			await generateDigestMutation.mutateAsync(undefined);
		} catch (generationError) {
			setError(
				generationError instanceof Error ? generationError.message : "Digest generation failed",
			);
		}
	};

	return (
		<div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-4 py-6">
			<header className="border-border flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
						Optional review surface
					</p>
					<h1 className="text-3xl font-semibold tracking-tight">Weekly digest</h1>
					<p className="text-muted-foreground mt-1 text-sm">
						Use this when you want a periodic summary. Daily capture can stay in the workspace.
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
					<Button
						variant="outline"
						onClick={() => void generateDigest()}
						disabled={generateDigestMutation.isPending}
					>
						{generateDigestMutation.isPending ? "Generating..." : "Generate digest"}
					</Button>
				</div>
			</header>

			{error ? <p className="text-destructive text-xs">{error}</p> : null}

			{isFetching ? (
				<p className="text-muted-foreground text-sm">Loading latest digest...</p>
			) : digest ? (
				<section className="border-border bg-card space-y-4 border p-4 text-sm">
					<div>
						<h2 className="text-xl font-semibold">{digest.title}</h2>
						<p className="text-muted-foreground text-xs">
							{new Date(digest.rangeStart).toLocaleDateString()} -{" "}
							{new Date(digest.rangeEnd).toLocaleDateString()} · {digest.noteCount} notes ·{" "}
							{digest.pendingActionCount} open actions
						</p>
					</div>

					<div className="border-border bg-background border p-3 text-xs whitespace-pre-wrap">
						{digest.overview}
					</div>

					<StackList title="Highlights" items={digest.highlights} />
					<StackList title="Risks" items={digest.risks} />
					<StackList title="Next actions" items={digest.nextActions} />
				</section>
			) : (
				<section className="border-border bg-card border p-4 text-xs">
					<p className="text-muted-foreground">
						No digest generated yet. Generate one when you want a periodic review.
					</p>
				</section>
			)}
		</div>
	);
}

function StackList({ title, items }: { title: string; items: string[] }) {
	if (items.length === 0) {
		return null;
	}

	return (
		<div>
			<p className="text-muted-foreground mb-1 text-xs font-medium uppercase">{title}</p>
			<ul className="space-y-1 text-xs">
				{items.map((item) => (
					<li key={`${title}-${item}`} className="border-border bg-background border px-3 py-2">
						{item}
					</li>
				))}
			</ul>
		</div>
	);
}
