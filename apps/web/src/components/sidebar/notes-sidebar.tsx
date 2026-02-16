import { Button, Empty, Input } from "@cloudflare/kumo";
import { useMemo, useState, type ChangeEvent } from "react";

import { cn } from "@/lib/utils";
export interface SidebarNote {
	id: string;
	title: string;
	summary: string;
	content: string;
	updatedAt: number;
}
interface NotesSidebarProps {
	notes: SidebarNote[];
	selectedNoteId: string | null;
	onSelectNote: (noteId: string) => void;
	isLoading: boolean;
	error: string | null;
	usingFallback: boolean;
}
export function NotesSidebar({
	notes,
	selectedNoteId,
	onSelectNote,
	isLoading,
	error,
	usingFallback,
}: NotesSidebarProps) {
	const [query, setQuery] = useState("");
	const filteredNotes = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		if (!normalized) {
			return notes;
		}
		return notes.filter((note) => {
			return (
				note.title.toLowerCase().includes(normalized) ||
				note.summary.toLowerCase().includes(normalized)
			);
		});
	}, [notes, query]);
	return (
		<>
			<div className="mb-3 flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<p className="text-kumo-subtle text-xs font-medium tracking-[0.2em] uppercase">Notes</p>
					<span className="text-kumo-subtle text-xs">{notes.length}</span>
				</div>
				<Button size="sm" variant="secondary" disabled>
					New
				</Button>
			</div>
			<div className="mb-3">
				<Input
					aria-label="Filter notes"
					placeholder="Filter notes"
					className="w-full"
					value={query}
					onChange={(event: ChangeEvent<HTMLInputElement>) => {
						setQuery(event.target.value);
					}}
				/>
			</div>

			{error ? <p className="text-kumo-danger mb-3 text-xs">{error}</p> : null}

			{isLoading ? <p className="text-kumo-subtle mb-3 text-xs">Loading notes...</p> : null}
			<p className="text-kumo-subtle mb-3 text-[11px]">
				{usingFallback
					? "Index reconnecting — showing last synced notes."
					: "Live index updates enabled."}
			</p>
			{filteredNotes.length > 0 ? (
				<div className="space-y-2">
					{filteredNotes.map((note) => {
						const selected = note.id === selectedNoteId;
						return (
							<Button
								key={note.id}
								type="button"
								variant={selected ? "secondary" : "ghost"}
								size="sm"
								aria-label={`Open note ${note.title}`}
								aria-pressed={selected}
								onClick={() => {
									onSelectNote(note.id);
								}}
								className={cn(
									"h-auto w-full justify-start px-3 py-2 text-left transition-colors",
									selected ? "bg-kumo-tint ring-kumo-line ring-1" : "hover:bg-kumo-tint",
								)}
							>
								<span className="w-full">
									<p className="text-kumo-default truncate text-sm font-medium">{note.title}</p>
									{note.summary ? (
										<p className="text-kumo-subtle mt-1 text-xs">{note.summary}</p>
									) : (
										<p className="text-kumo-subtle mt-1 text-xs">No summary yet</p>
									)}
									<p className="text-kumo-subtle mt-2 text-[11px]">
										Updated {new Date(note.updatedAt).toLocaleString()}
									</p>
								</span>
							</Button>
						);
					})}
				</div>
			) : null}
			{!isLoading && filteredNotes.length === 0 ? (
				<Empty
					title={notes.length === 0 ? "Capture your first note" : "No notes match your filter"}
					description={
						notes.length === 0
							? "Start writing on the canvas, press Save, and your note will appear here automatically."
							: "Try a different keyword to find the note you need."
					}
					size="sm"
				/>
			) : null}
		</>
	);
}
