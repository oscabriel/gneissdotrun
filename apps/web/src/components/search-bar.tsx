import { useCallback, useEffect, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { env } from "@gneissdotrun/env/web";
import { Button, Input } from "@cloudflare/kumo";

interface QueryResult {
	answer: string;
	citations: Array<{ id: string; title: string }>;
	relatedCollections: Array<{ id: string; title: string; summary: string }>;
	followUps: string[];
}

interface SearchBarProps {
	initialQuery?: string;
}

export function SearchBar({ initialQuery = "" }: SearchBarProps) {
	const [query, setQuery] = useState(initialQuery);
	const [result, setResult] = useState<QueryResult | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const runSearch = useCallback(async (question: string) => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch(`${env.VITE_SERVER_URL}/api/surfacing/query`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({ question }),
			});

			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? "Search failed");
			}

			setResult((await response.json()) as QueryResult);
		} catch (searchError) {
			setError(searchError instanceof Error ? searchError.message : "Search failed");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		const trimmed = initialQuery.trim();
		setQuery(initialQuery);
		if (trimmed.length > 0) {
			void runSearch(trimmed);
		}
	}, [initialQuery, runSearch]);

	const submit = async () => {
		const trimmed = query.trim();
		if (trimmed.length === 0) {
			return;
		}

		await runSearch(trimmed);
	};

	return (
		<section className="border-border bg-card space-y-3 border p-4">
			<div className="flex items-center justify-between gap-2">
				<p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
					Hybrid search
				</p>
				{result ? (
					<span className="text-muted-foreground text-xs">{result.citations.length} citations</span>
				) : null}
			</div>

			<div className="flex flex-col gap-2 sm:flex-row">
				<Input
					className="w-full"
					value={query}
					aria-label="Search query"
					onChange={(event: ChangeEvent<HTMLInputElement>) => {
						setQuery(event.target.value);
					}}
					onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
						if (event.key === "Enter") {
							event.preventDefault();
							void submit();
						}
					}}
					placeholder="Ask about projects, topics, or open questions"
				/>
				<Button onClick={() => void submit()} disabled={isLoading}>
					{isLoading ? "Searching..." : "Search"}
				</Button>
			</div>

			{error ? <p className="text-destructive text-xs">{error}</p> : null}

			{result ? (
				<div className="space-y-3 text-xs leading-relaxed">
					<div className="border-border bg-background border p-3 whitespace-pre-wrap">
						{result.answer}
					</div>

					{result.citations.length > 0 ? (
						<div>
							<p className="text-muted-foreground mb-1 text-[11px] uppercase">Citations</p>
							<div className="flex flex-wrap gap-2">
								{result.citations.map((citation) => (
									<span key={citation.id} className="border-border bg-background border px-2 py-1">
										{citation.title}
									</span>
								))}
							</div>
						</div>
					) : null}

					{result.relatedCollections.length > 0 ? (
						<div>
							<p className="text-muted-foreground mb-1 text-[11px] uppercase">
								Related collections
							</p>
							<div className="space-y-2">
								{result.relatedCollections.map((collection) => (
									<div key={collection.id} className="border-border bg-background border p-2">
										<p className="font-medium">{collection.title}</p>
										{collection.summary ? (
											<p className="text-muted-foreground mt-1">{collection.summary}</p>
										) : null}
									</div>
								))}
							</div>
						</div>
					) : null}

					{result.followUps.length > 0 ? (
						<div>
							<p className="text-muted-foreground mb-1 text-[11px] uppercase">Follow-ups</p>
							<div className="flex flex-wrap gap-2">
								{result.followUps.map((followUp) => (
									<Button
										key={followUp}
										variant="outline"
										size="sm"
										onClick={() => {
											setQuery(followUp);
											void runSearch(followUp);
										}}
									>
										{followUp}
									</Button>
								))}
							</div>
						</div>
					) : null}
				</div>
			) : null}
		</section>
	);
}
