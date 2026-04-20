import { Button, Empty, Input } from "@cloudflare/kumo";
import { LayoutGrid, Pencil } from "lucide-react";
import { useMemo, useState, type ChangeEvent } from "react";

import { NoteCardsView } from "@/components/sidebar/note-cards-view";
import type { SidebarNote } from "@/components/sidebar/sidebar-note";
import {
	buildBrowserSidebarNotes,
	filterBrowserSidebarNotes,
} from "@/lib/editor/note-browser";

type NoteProcessingState = "queued" | "streaming" | "persisting";

interface NoteBrowserPaneProps {
	notes: SidebarNote[];
	selectedNoteId: string | null;
	onSelectNote: (noteId: string) => void;
	onOpenEditor: () => void;
	onCreateNote: () => void;
	processingStatesByNoteId?: Record<string, NoteProcessingState>;
}

export function NoteBrowserPane({
	notes,
	selectedNoteId,
	onSelectNote,
	onOpenEditor,
	onCreateNote,
	processingStatesByNoteId = {},
}: NoteBrowserPaneProps) {
	const [query, setQuery] = useState("");
	const browserNotes = useMemo(() => buildBrowserSidebarNotes(notes), [notes]);
	const filteredNotes = useMemo(
		() => filterBrowserSidebarNotes(browserNotes, query),
		[browserNotes, query],
	);
	const selectedNote = useMemo(
		() => browserNotes.find((note) => note.id === selectedNoteId) ?? null,
		[browserNotes, selectedNoteId],
	);

	if (browserNotes.length === 0) {
		return (
			<div className="flex h-full items-center justify-center p-6">
				<div className="space-y-4 text-center">
					<Empty
						title="Start your note library"
						description="Create a note and it will appear here as a measured card view."
						size="sm"
						className="[&_h2]:text-lg [&_p]:text-sm"
					/>
					<div className="flex justify-center">
						<Button variant="secondary" onClick={onCreateNote}>
							Create new note
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-5 lg:p-6">
			<section className="border-kumo-line bg-kumo-elevated/70 relative overflow-hidden rounded-[1.75rem] border px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,211,209,0.3),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.7),transparent_60%)]" />
				<div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-2xl">
						<div className="text-kumo-subtle flex items-center gap-2 text-[11px] tracking-[0.24em] uppercase">
							<LayoutGrid className="size-3.5" aria-hidden />
							<span>Browser</span>
						</div>
						<h1 className="text-kumo-default mt-3 font-serif text-3xl leading-tight sm:text-4xl">
							Browse your note field
						</h1>
						<p className="text-kumo-subtle mt-3 max-w-xl text-sm leading-6 sm:text-[15px]">
							Cards respond to real measured text widths, so previews stay balanced as the
							workspace stretches from phone drawers to full desktop columns.
						</p>
					</div>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						<Button variant="secondary" onClick={onCreateNote}>
							Create new note
						</Button>
						<Button variant="outline" onClick={onOpenEditor} disabled={!selectedNoteId}>
							<Pencil className="mr-2 size-4" aria-hidden />
							Open selected note
						</Button>
					</div>
				</div>
				<div className="relative mt-5 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em]">
					<span className="bg-kumo-base text-kumo-default rounded-full px-3 py-1.5">
						{browserNotes.length} notes
					</span>
					{selectedNote ? (
						<span className="bg-kumo-base/70 text-kumo-subtle rounded-full px-3 py-1.5">
							Selected: {selectedNote.title}
						</span>
					) : null}
				</div>
			</section>

			<div className="mt-4 flex items-center gap-3">
				<Input
					aria-label="Filter note browser"
					placeholder="Filter notes by title, tag, preview, or folder"
					className="w-full"
					value={query}
					onChange={(event: ChangeEvent<HTMLInputElement>) => {
						setQuery(event.target.value);
					}}
				/>
			</div>

			<p className="text-kumo-subtle mt-3 text-[11px]">
				Select any card to jump straight back into the editor with that note loaded.
			</p>

			<div className="mt-4 flex min-h-0 flex-1">
				{filteredNotes.length > 0 ? (
					<NoteCardsView
						notes={filteredNotes}
						selectedNoteId={selectedNoteId}
						onSelectNote={(noteId) => {
							onSelectNote(noteId);
							onOpenEditor();
						}}
						processingStatesByNoteId={processingStatesByNoteId}
						variant="grid"
					/>
				) : (
					<div className="flex h-full items-center justify-center">
						<Empty
							title="No notes match this filter"
							description="Try a different keyword, folder path, or tag."
							size="sm"
							className="[&_h2]:text-lg [&_p]:text-sm"
						/>
					</div>
				)}
			</div>
		</div>
	);
}
