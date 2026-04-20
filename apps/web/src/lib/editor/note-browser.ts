import type { SidebarNote } from "@/components/sidebar/sidebar-note";

import { getNotePreviewText } from "@/lib/editor/note-preview";

const TAG_PATH_SEPARATOR = /\s*(?:\/|::|>)\s*/;
const SYSTEM_TAGS = new Set([
	"auto_rewrite",
	"background",
	"command",
	"correction",
	"duplicate",
	"edit",
	"ephemeral",
	"explicit_run",
	"fallback",
	"fanout",
	"memory",
	"multi-note",
	"multi-step",
	"new_note",
	"post_save",
	"preference",
	"question",
	"rewrite",
	"slash_command",
	"split",
	"update",
	"workspace",
]);

export interface BrowserSidebarNote extends SidebarNote {
	previewText: string;
	displayTags: string[];
	folderSegments: string[];
	folderLabel: string;
	searchText: string;
}

export function normalizeNoteTag(tag: string): string {
	return tag.trim().replace(/^#+/, "").replace(/\s+/g, " ");
}

function splitTagPath(tag: string): string[] {
	return normalizeNoteTag(tag)
		.split(TAG_PATH_SEPARATOR)
		.map((segment) => segment.trim())
		.filter(Boolean);
}

export function deriveFolderSegments(note: Pick<SidebarNote, "tags">): string[] {
	const noteTags = note.tags ?? [];
	const semanticTags = Array.from(
		new Set(
			noteTags
				.map((tag) => normalizeNoteTag(tag))
				.filter((tag) => tag.length > 0 && !SYSTEM_TAGS.has(tag.toLowerCase())),
		),
	);

	const nestedPath = semanticTags
		.map((tag) => splitTagPath(tag))
		.filter((segments) => segments.length > 1)
		.sort(
			(left, right) =>
				right.length - left.length || left.join("/").localeCompare(right.join("/")),
		)[0];

	if (nestedPath) {
		return nestedPath;
	}

	if (semanticTags.length > 1) {
		return semanticTags.map((tag) => splitTagPath(tag)[0] ?? tag).filter(Boolean);
	}

	if (semanticTags[0]) {
		return splitTagPath(semanticTags[0]);
	}

	return ["Unfiled"];
}

export function buildBrowserSidebarNotes(notes: SidebarNote[]): BrowserSidebarNote[] {
	return notes.map((note) => {
		const displayTags = Array.from(
			new Set(
				(note.tags ?? [])
					.map((tag) => normalizeNoteTag(tag))
					.filter((tag) => tag.length > 0 && !SYSTEM_TAGS.has(tag.toLowerCase())),
			),
		);
		const folderSegments = deriveFolderSegments(note);
		const previewText = getNotePreviewText(note.content) || note.summary;
		const folderLabel = folderSegments.join(" / ");

		return {
			...note,
			previewText,
			displayTags,
			folderSegments,
			folderLabel,
			searchText: [note.title, previewText, note.summary, displayTags.join(" "), folderLabel]
				.join(" ")
				.toLowerCase(),
		};
	});
}

export function filterBrowserSidebarNotes(
	notes: BrowserSidebarNote[],
	query: string,
): BrowserSidebarNote[] {
	const normalizedQuery = query.trim().toLowerCase();
	if (normalizedQuery.length === 0) {
		return notes;
	}

	return notes.filter((note) => note.searchText.includes(normalizedQuery));
}
