import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Button, Input } from "@cloudflare/kumo";

import { searchQueryOptions } from "@/lib/queries/search";

interface SearchBarProps {
	query: string;
	onQueryCommit: (nextQuery: string) => void;
}

export function SearchBar({ query, onQueryCommit }: SearchBarProps) {
	const [draftQuery, setDraftQuery] = useState(query);

	const activeQuery = query.trim();
	const resultQuery = useQuery({
		...searchQueryOptions(activeQuery),
		enabled: activeQuery.length > 0,
	});
	const result = activeQuery.length > 0 ? (resultQuery.data ?? null) : null;
	const error = resultQuery.error instanceof Error ? resultQuery.error.message : null;

	useEffect(() => {
		setDraftQuery(query);
	}, [query]);

	const commitQuery = (nextQuery: string) => {
		const trimmed = nextQuery.trim();
		if (trimmed.length === 0) {
			onQueryCommit("");
			return;
		}

		if (trimmed === activeQuery) {
			void resultQuery.refetch();
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
				<Button onClick={submit} disabled={resultQuery.isFetching || draftQuery.trim().length === 0}>
					{resultQuery.isFetching ? "Searching..." : "Search"}
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
