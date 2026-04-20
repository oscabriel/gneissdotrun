import type { CSSProperties } from "react";

import { NotePreviewLines } from "@/components/sidebar/note-preview-lines";
import type { BrowserSidebarNote } from "@/lib/editor/note-browser";
import { cn } from "@/lib/utils";

type NoteProcessingState = "queued" | "streaming" | "persisting";

const cardContentVisibilityStyle = {
	contentVisibility: "auto",
	containIntrinsicSize: "180px",
} satisfies CSSProperties;

const updatedAtFormatter = new Intl.DateTimeFormat(undefined, {
	month: "short",
	day: "numeric",
});

function formatUpdatedAt(updatedAt: number): string {
	const deltaMs = Date.now() - updatedAt;
	if (deltaMs < 60 * 60 * 1000) {
		return `${Math.max(1, Math.round(deltaMs / (60 * 1000)))}m ago`;
	}
	if (deltaMs < 24 * 60 * 60 * 1000) {
		return `${Math.max(1, Math.round(deltaMs / (60 * 60 * 1000)))}h ago`;
	}
	return updatedAtFormatter.format(updatedAt);
}

function getProcessingLabel(state: NoteProcessingState): string {
	switch (state) {
		case "queued":
			return "Queued";
		case "streaming":
			return "Writing";
		case "persisting":
			return "Saving";
	}
	return state;
}

interface NoteCardsViewProps {
	notes: BrowserSidebarNote[];
	selectedNoteId: string | null;
	onSelectNote: (noteId: string) => void;
	processingStatesByNoteId?: Record<string, NoteProcessingState>;
	variant?: "rail" | "grid";
}

export function NoteCardsView({
	notes,
	selectedNoteId,
	onSelectNote,
	processingStatesByNoteId = {},
	variant = "rail",
}: NoteCardsViewProps) {
	const isGrid = variant === "grid";
	const bodyPreviewFont = isGrid ? '400 14px "Libre Baskerville"' : '400 13px "Libre Baskerville"';
	const titlePreviewFont = isGrid ? '600 17px "Libre Baskerville"' : '600 15px "Libre Baskerville"';
	const titleLineHeight = isGrid ? 24 : 22;
	const bodyLineHeight = isGrid ? 21 : 20;
	const titleMaxLines = isGrid ? 3 : 2;
	const bodyMaxLines = isGrid ? 5 : 4;

	return (
		<div className="flex-1 overflow-y-auto overscroll-contain pr-1">
			<div
				className={cn(
					"pb-2",
					isGrid
						? "grid grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] gap-4 lg:grid-cols-[repeat(auto-fit,minmax(20rem,1fr))]"
						: "space-y-3",
				)}
			>
				{notes.map((note) => {
					const selected = note.id === selectedNoteId;
					const processingState = processingStatesByNoteId[note.id];
					const visibleTags = note.displayTags.slice(0, 2);
					const hiddenTagCount = Math.max(0, note.displayTags.length - visibleTags.length);

					return (
						<button
							key={note.id}
							type="button"
							aria-current={selected ? "true" : undefined}
							onClick={() => {
								onSelectNote(note.id);
							}}
							className={cn(
								"group relative w-full overflow-hidden rounded-2xl border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/70",
								isGrid && "min-h-[18rem] p-5",
								selected
									? "border-stone-400/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,245,244,0.92))] shadow-[0_20px_45px_-28px_rgba(41,37,36,0.45)]"
									: "border-stone-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(250,250,249,0.88))] shadow-[0_16px_38px_-30px_rgba(41,37,36,0.4)] hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_22px_40px_-28px_rgba(41,37,36,0.45)]",
							)}
							style={cardContentVisibilityStyle}
						>
							<div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(120,113,108,0.35),transparent)]" />
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0 flex-1">
									<p className="text-kumo-subtle truncate text-[10px] tracking-[0.18em] uppercase">
										{note.folderLabel}
									</p>
								</div>
								<p className="text-kumo-subtle shrink-0 text-[10px] tracking-[0.16em] uppercase">
									{formatUpdatedAt(note.updatedAt)}
								</p>
							</div>
							<NotePreviewLines
								text={note.title}
								font={titlePreviewFont}
								lineHeight={titleLineHeight}
								maxLines={titleMaxLines}
								className="mt-3"
								lineClassName={cn(
									"font-serif font-semibold text-stone-800",
									isGrid ? "text-[17px] leading-[1.48]" : "text-[15px] leading-[1.45]",
								)}
								emptyFallback="Untitled note"
							/>
							<NotePreviewLines
								text={note.previewText}
								font={bodyPreviewFont}
								lineHeight={bodyLineHeight}
								maxLines={bodyMaxLines}
								className="mt-3"
								lineClassName={cn(
									"font-serif text-stone-600",
									isGrid ? "text-[14px] leading-[1.5]" : "text-[13px] leading-5",
								)}
							/>
							<div className="mt-4 flex flex-wrap items-center gap-1.5">
								{processingState ? (
									<span className="rounded-full border border-stone-300/80 bg-white/80 px-2 py-1 text-[10px] tracking-[0.12em] uppercase text-stone-700">
										{getProcessingLabel(processingState)}
									</span>
								) : null}
								{visibleTags.map((tag) => (
									<span
										key={`${note.id}-${tag}`}
										className="rounded-full border border-stone-200 bg-stone-50/90 px-2 py-1 text-[10px] tracking-[0.08em] uppercase text-stone-500"
									>
										{tag}
									</span>
								))}
								{hiddenTagCount > 0 ? (
									<span className="rounded-full border border-transparent px-1.5 py-1 text-[10px] tracking-[0.08em] uppercase text-stone-400">
										+{hiddenTagCount}
									</span>
								) : null}
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
