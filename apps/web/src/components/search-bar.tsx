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
	query: string;
	onQueryCommit: (nextQuery: string) => void;
}

export function SearchBar({ query, onQueryCommit }: SearchBarProps) {
	const [draftQuery, setDraftQuery] = useState(query);
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

	const activeQuery = query.trim();

	useEffect(() => {
		setDraftQuery(query);
	}, [query]);

	useEffect(() => {
		if (activeQuery.length === 0) {
			setResult(null);
			setError(null);
			return;
		}

		void runSearch(activeQuery);
	}, [activeQuery, runSearch]);

	const commitQuery = (nextQuery: string) => {
		const trimmed = nextQuery.trim();
		if (trimmed.length === 0) {
			onQueryCommit("");
			return;
		}

		if (trimmed === activeQuery) {
			void runSearch(trimmed);
			return;
		}

		onQueryCommit(trimmed);
	};

	const submit = () => {
		commitQuery(draftQuery);
	};

	return (
		<section className="border-kumo-line bg-kumo-elevated space-y-3 rounded-md border p-4">
			<div className="flex items-center justify-between gap-2">
				<p className="text-kumo-subtle text-xs font-medium tracking-[0.2em] uppercase">
					Targeted retrieval
				</p>
				{result ? (
					<span className="text-kumo-subtle text-xs">{result.citations.length} citations</span>
				) : null}
			</div>

			<div className="flex flex-col gap-2 sm:flex-row">
				<Input
					className="w-full"
					value={draftQuery}
					aria-label="Search query"
					onChange={(event: ChangeEvent<HTMLInputElement>) => {
						setDraftQuery(event.target.value);
					}}
					onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
						if (event.key === "Enter") {
							event.preventDefault();
							submit();
						}
					}}
					placeholder="Ask about projects, topics, or open questions"
				/>
				<Button onClick={submit} disabled={isLoading || draftQuery.trim().length === 0}>
					{isLoading ? "Searching..." : "Search"}
				</Button>
			</div>

			{error ? <p className="text-kumo-danger text-xs">{error}</p> : null}

			{result ? (
				<div className="space-y-3 text-xs leading-relaxed">
					<div className="border-kumo-line bg-kumo-base text-kumo-default rounded-md border p-3 whitespace-pre-wrap">
						{result.answer}
					</div>

					{result.citations.length > 0 ? (
						<div>
							<p className="text-kumo-subtle mb-1 text-[11px] uppercase">Citations</p>
							<div className="flex flex-wrap gap-2">
								{result.citations.map((citation) => (
									<span
										key={citation.id}
										className="border-kumo-line bg-kumo-base text-kumo-default rounded border px-2 py-1"
									>
										{citation.title}
									</span>
								))}
							</div>
						</div>
					) : null}

					{result.relatedCollections.length > 0 ? (
						<div>
							<p className="text-kumo-subtle mb-1 text-[11px] uppercase">Related collections</p>
							<div className="space-y-2">
								{result.relatedCollections.map((collection) => (
									<div
										key={collection.id}
										className="border-kumo-line bg-kumo-base rounded-md border p-2"
									>
										<p className="text-kumo-default font-medium">{collection.title}</p>
										{collection.summary ? (
											<p className="text-kumo-subtle mt-1">{collection.summary}</p>
										) : null}
									</div>
								))}
							</div>
						</div>
					) : null}

					{result.followUps.length > 0 ? (
						<div>
							<p className="text-kumo-subtle mb-1 text-[11px] uppercase">Follow-ups</p>
							<div className="flex flex-wrap gap-2">
								{result.followUps.map((followUp) => (
									<Button
										key={followUp}
										variant="outline"
										size="sm"
										onClick={() => {
											setDraftQuery(followUp);
											commitQuery(followUp);
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
