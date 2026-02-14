import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { env } from "@gneissdotrun/env/web";
import { Button } from "@cloudflare/kumo";

import { authClient } from "@/lib/auth-client";

interface WeeklyDigest {
	title: string;
	overview: string;
	highlights: string[];
	risks: string[];
	nextActions: string[];
	generatedAt: number;
	rangeStart: number;
	rangeEnd: number;
	noteCount: number;
	pendingActionCount: number;
}

export const Route = createFileRoute("/digest")({
	component: DigestRoute,
});

function DigestRoute() {
	const { data: session, isPending } = authClient.useSession();
	const [digest, setDigest] = useState<WeeklyDigest | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const loadDigest = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch(`${env.VITE_SERVER_URL}/api/surfacing/digest`, {
				method: "GET",
				credentials: "include",
			});

			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? "Failed to load digest");
			}

			const payload = (await response.json()) as {
				digest: WeeklyDigest | null;
			};
			setDigest(payload.digest ?? null);
		} catch (digestError) {
			setError(digestError instanceof Error ? digestError.message : "Digest load failed");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!session?.user.id) {
			return;
		}

		void loadDigest();
	}, [loadDigest, session?.user.id]);

	const generateDigest = async () => {
		setIsGenerating(true);
		setError(null);

		try {
			const response = await fetch(`${env.VITE_SERVER_URL}/api/surfacing/digest`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({ action: "digest" }),
			});

			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? "Digest generation failed");
			}

			const payload = (await response.json()) as {
				digest: WeeklyDigest;
			};
			setDigest(payload.digest);
		} catch (generationError) {
			setError(
				generationError instanceof Error ? generationError.message : "Digest generation failed",
			);
		} finally {
			setIsGenerating(false);
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
				<p className="text-muted-foreground text-sm">Sign in to view digests.</p>
				<a href="/" className="underline">
					Back to home
				</a>
			</div>
		);
	}

	return (
		<div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-4 py-6">
			<header className="border-border flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
						Phase 4 Surfacing
					</p>
					<h1 className="text-3xl font-semibold tracking-tight">Weekly digest</h1>
				</div>
				<div className="flex gap-2">
					<a href="/">
						<Button variant="outline">Capture</Button>
					</a>
					<a href="/collections">
						<Button variant="outline">Collections</Button>
					</a>
					<Button onClick={() => void generateDigest()} disabled={isGenerating}>
						{isGenerating ? "Generating..." : "Generate digest"}
					</Button>
				</div>
			</header>

			{error ? <p className="text-destructive text-xs">{error}</p> : null}

			{isLoading ? (
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
						No digest generated yet. Create one to surface trends.
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
