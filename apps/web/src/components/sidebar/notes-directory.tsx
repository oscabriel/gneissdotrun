import { Empty, Input } from "@cloudflare/kumo";
import {
	type ChangeEvent,
	useEffect,
	useMemo,
	useState,
	type KeyboardEvent,
} from "react";

import { FileTree, FileTreeFolder, FileTreeItem } from "@/components/sidebar/file-tree";
import { NoteCardsView } from "@/components/sidebar/note-cards-view";
import { NotePreviewLines } from "@/components/sidebar/note-preview-lines";
import type { SidebarNote } from "@/components/sidebar/sidebar-note";
import {
	buildBrowserSidebarNotes,
	filterBrowserSidebarNotes,
	type BrowserSidebarNote,
} from "@/lib/editor/note-browser";
import { cn } from "@/lib/utils";

interface WorkspaceLeaf {
	id: string;
	name: string;
	noteId: string;
	previewText: string;
	searchText: string;
}

interface WorkspaceFolder {
	id: string;
	name: string;
	fullPath: string;
	folders: WorkspaceFolder[];
	notes: WorkspaceLeaf[];
}

type NoteProcessingState = "queued" | "streaming" | "persisting";
type NoteBrowserMode = "directory" | "cards";

const NOTE_BROWSER_MODE_STORAGE_KEY = "workspace-note-browser-mode";
const directoryPreviewFont = '400 11px "Libre Baskerville"';

interface NotesDirectoryProps {
	notes: SidebarNote[];
	selectedNoteId: string | null;
	onSelectNote: (noteId: string) => void;
	isLoading: boolean;
	error: string | null;
	usingFallback: boolean;
	processingStatesByNoteId?: Record<string, NoteProcessingState>;
}

interface RenderRow {
	id: string;
	type: "folder" | "note";
	depth: number;
	name: string;
	parentId: string | null;
	noteId?: string;
}
function compareByName(left: { name: string }, right: { name: string }): number {
	return left.name.localeCompare(right.name, undefined, {
		numeric: true,
		sensitivity: "base",
	});
}

function toFolderId(path: string): string {
	return `folder:${encodeURIComponent(path)}`;
}

function sortFolderTree(folder: WorkspaceFolder): WorkspaceFolder {
	return {
		...folder,
		folders: folder.folders.map(sortFolderTree).sort(compareByName),
		notes: [...folder.notes].sort(compareByName),
	};
}

function buildDirectoryTree(notes: BrowserSidebarNote[]): WorkspaceFolder[] {
	const root: WorkspaceFolder = {
		id: "root",
		name: "root",
		fullPath: "",
		folders: [],
		notes: [],
	};
	const foldersByPath = new Map<string, WorkspaceFolder>([["", root]]);

	for (const note of notes) {
		const pathSegments = note.folderSegments;
		let parent = root;
		let currentPath = "";

		for (const segment of pathSegments) {
			currentPath = currentPath ? `${currentPath}/${segment}` : segment;
			let folder = foldersByPath.get(currentPath);
			if (!folder) {
				folder = {
					id: toFolderId(currentPath),
					name: segment,
					fullPath: currentPath,
					folders: [],
					notes: [],
				};
				foldersByPath.set(currentPath, folder);
				parent.folders.push(folder);
			}

			parent = folder;
		}

		parent.notes.push({
			id: note.id,
			name: note.title,
			noteId: note.id,
			previewText: note.previewText,
			searchText: [note.searchText, parent.fullPath]
				.join(" ")
				.toLowerCase(),
		});
	}

	return root.folders.map(sortFolderTree).sort(compareByName);
}

function filterTree(nodes: WorkspaceFolder[], query: string): WorkspaceFolder[] {
	if (query.length === 0) {
		return nodes;
	}

	return nodes
		.map((node) => {
			const folderMatches = node.fullPath.toLowerCase().includes(query);
			if (folderMatches) {
				return node;
			}

			const folders = filterTree(node.folders, query);
			const notes = node.notes.filter((note) => note.searchText.includes(query));
			if (folders.length === 0 && notes.length === 0) {
				return null;
			}

			return {
				...node,
				folders,
				notes,
			};
		})
		.filter((node): node is WorkspaceFolder => node !== null);
}

function collectFolderIds(nodes: WorkspaceFolder[]): string[] {
	const ids: string[] = [];
	const visit = (items: WorkspaceFolder[]) => {
		for (const item of items) {
			ids.push(item.id);
			visit(item.folders);
		}
	};

	visit(nodes);
	return ids;
}

function findFolderTrail(
	nodes: WorkspaceFolder[],
	noteId: string,
	trail: string[] = [],
): string[] | null {
	for (const node of nodes) {
		const nextTrail = [...trail, node.id];
		if (node.notes.some((note) => note.noteId === noteId)) {
			return nextTrail;
		}

		const nested = findFolderTrail(node.folders, noteId, nextTrail);
		if (nested) {
			return nested;
		}
	}

	return null;
}

export function NotesDirectory({
	notes,
	selectedNoteId,
	onSelectNote,
	isLoading,
	error,
	usingFallback,
	processingStatesByNoteId = {},
}: NotesDirectoryProps) {
	const [query, setQuery] = useState("");
	const [browserMode, setBrowserMode] = useState<NoteBrowserMode>("directory");
	const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
	const [activeRowId, setActiveRowId] = useState<string | null>(null);

	const previewNotes = useMemo(() => buildBrowserSidebarNotes(notes), [notes]);

	const treeNodes = useMemo(() => buildDirectoryTree(previewNotes), [previewNotes]);
	const folderIds = useMemo(() => collectFolderIds(treeNodes), [treeNodes]);
	const normalizedQuery = query.trim().toLowerCase();
	const filteredTree = useMemo(() => filterTree(treeNodes, normalizedQuery), [normalizedQuery, treeNodes]);
	const filteredCards = useMemo(
		() => filterBrowserSidebarNotes(previewNotes, normalizedQuery),
		[normalizedQuery, previewNotes],
	);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const storedMode = window.localStorage.getItem(NOTE_BROWSER_MODE_STORAGE_KEY);
		if (storedMode === "directory" || storedMode === "cards") {
			setBrowserMode(storedMode);
		}
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		window.localStorage.setItem(NOTE_BROWSER_MODE_STORAGE_KEY, browserMode);
	}, [browserMode]);
	const selectedFolderTrail = useMemo(() => {
		if (!selectedNoteId) {
			return [];
		}

		return findFolderTrail(treeNodes, selectedNoteId) ?? [];
	}, [selectedNoteId, treeNodes]);

	useEffect(() => {
		if (folderIds.length === 0) {
			return;
		}

		setExpandedFolders((current) => {
			const next = { ...current };
			for (const folderId of folderIds) {
				if (next[folderId] === undefined) {
					next[folderId] = true;
				}
			}
			return next;
		});
	}, [folderIds]);

	useEffect(() => {
		if (selectedFolderTrail.length === 0) {
			return;
		}

		setExpandedFolders((current) => {
			const next = { ...current };
			let changed = false;
			for (const folderId of selectedFolderTrail) {
				if (!next[folderId]) {
					next[folderId] = true;
					changed = true;
				}
			}
			return changed ? next : current;
		});
	}, [selectedFolderTrail]);

	const rows = useMemo(() => {
		const output: RenderRow[] = [];

		const appendRows = (nodes: WorkspaceFolder[], depth: number, parentId: string | null) => {
			for (const folder of nodes) {
				output.push({
					id: folder.id,
					type: "folder",
					depth,
					name: folder.name,
					parentId,
				});

				if (normalizedQuery.length > 0 || expandedFolders[folder.id]) {
					appendRows(folder.folders, depth + 1, folder.id);
					for (const note of folder.notes) {
						output.push({
							id: `${folder.id}:note:${note.id}`,
							type: "note",
							depth: depth + 1,
							name: note.name,
							parentId: folder.id,
							noteId: note.noteId,
						});
					}
				}
			}
		};

		appendRows(filteredTree, 0, null);
		return output;
	}, [expandedFolders, filteredTree, normalizedQuery.length]);

	useEffect(() => {
		if (rows.length === 0) {
			setActiveRowId(null);
			return;
		}

		if (selectedNoteId) {
			const selectedRow = rows.find((row) => row.noteId === selectedNoteId);
			if (selectedRow) {
				setActiveRowId(selectedRow.id);
				return;
			}
		}

		setActiveRowId((current) => {
			if (current && rows.some((row) => row.id === current)) {
				return current;
			}
			return rows[0]?.id ?? null;
		});
	}, [rows, selectedNoteId]);

	const activeIndex = activeRowId ? rows.findIndex((row) => row.id === activeRowId) : -1;
	const selectedFolderIds = useMemo(() => new Set(selectedFolderTrail), [selectedFolderTrail]);

	const moveActive = (nextIndex: number) => {
		const next = rows[nextIndex];
		if (!next) {
			return;
		}

		setActiveRowId(next.id);
		if (typeof document !== "undefined") {
			(document.getElementById(next.id) as HTMLButtonElement | null)?.focus();
		}
	};

	const toggleFolder = (folderId: string) => {
		setExpandedFolders((current) => ({
			...current,
			[folderId]: !current[folderId],
		}));
	};

	const handleTreeKeyDown = (event: KeyboardEvent<HTMLElement>) => {
		if (rows.length === 0) {
			return;
		}

		if (event.key === "ArrowDown") {
			event.preventDefault();
			moveActive(Math.min(rows.length - 1, Math.max(0, activeIndex + 1)));
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			moveActive(Math.max(0, activeIndex - 1));
			return;
		}

		if (event.key === "ArrowRight") {
			event.preventDefault();
			const current = rows[Math.max(0, activeIndex)];
			if (current?.type === "folder" && !expandedFolders[current.id]) {
				toggleFolder(current.id);
				return;
			}

			moveActive(Math.min(rows.length - 1, Math.max(0, activeIndex + 1)));
			return;
		}

		if (event.key === "ArrowLeft") {
			event.preventDefault();
			const current = rows[Math.max(0, activeIndex)];
			if (!current) {
				return;
			}

			if (current.type === "folder" && expandedFolders[current.id]) {
				toggleFolder(current.id);
				return;
			}

			if (current.parentId) {
				const parentFolder = rows.findIndex((row) => row.id === current.parentId);
				if (parentFolder >= 0) {
					moveActive(parentFolder);
				}
			}
			return;
		}

		if (event.key === "Home") {
			event.preventDefault();
			moveActive(0);
			return;
		}

		if (event.key === "End") {
			event.preventDefault();
			moveActive(rows.length - 1);
		}
	};

	const renderNodes = (nodes: WorkspaceFolder[], depth: number) => {
		return nodes.map((folder) => {
			const showChildren = normalizedQuery.length > 0 || expandedFolders[folder.id];

			return (
				<FileTreeFolder
					key={folder.id}
					id={folder.id}
					name={folder.name}
					expanded={showChildren}
					active={folder.id === activeRowId}
					selected={selectedFolderIds.has(folder.id)}
					depth={depth}
					onClick={() => {
						setActiveRowId(folder.id);
						toggleFolder(folder.id);
					}}
					onFocus={() => {
						setActiveRowId(folder.id);
					}}
				>
					{showChildren ? (
						<>
							{renderNodes(folder.folders, depth + 1)}
							{folder.notes.map((note) => {
								const rowId = `${folder.id}:note:${note.id}`;

								return (
									<FileTreeItem
										key={rowId}
										id={rowId}
										name={note.name}
										description={
											<NotePreviewLines
												text={note.previewText}
												font={directoryPreviewFont}
												lineHeight={16}
												maxLines={2}
												lineClassName={cn(
													"font-serif text-[11px] leading-4",
													note.noteId === selectedNoteId ? "text-kumo-strong" : "text-kumo-subtle",
												)}
												emptyFallback="Empty note."
											/>
										}
										selected={note.noteId === selectedNoteId}
										active={rowId === activeRowId}
										depth={depth + 1}
										onClick={() => {
											setActiveRowId(rowId);
											onSelectNote(note.noteId);
										}}
										onFocus={() => {
											setActiveRowId(rowId);
										}}
									/>
								);
							})}
						</>
					) : null}
				</FileTreeFolder>
			);
		});
	};

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden p-3">
			<div className="mb-3 flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-kumo-subtle text-xs font-medium tracking-[0.2em] uppercase">Notes</p>
					<p className="text-kumo-subtle mt-1 text-[11px]">{notes.length} saved</p>
				</div>
				<div className="bg-kumo-tint inline-flex shrink-0 rounded-full p-1">
					{(["directory", "cards"] as const).map((mode) => (
						<button
							key={mode}
							type="button"
							onClick={() => {
								setBrowserMode(mode);
							}}
							className={cn(
								"rounded-full px-3 py-1.5 text-[10px] tracking-[0.14em] uppercase transition-colors",
								browserMode === mode
									? "bg-kumo-control text-kumo-default shadow-sm"
									: "text-kumo-subtle hover:text-kumo-default",
							)}
							aria-pressed={browserMode === mode}
						>
							{mode}
						</button>
					))}
				</div>
			</div>

			<div className="mb-3">
				<Input
					aria-label="Filter notes directory"
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
					? "Index reconnecting - showing last synced notes."
					: browserMode === "cards"
						? "Bear-style cards size their previews from measured text, not guesswork."
						: "Folders follow your note tags and stay keyboard navigable."}
			</p>

			{browserMode === "directory" && rows.length > 0 ? (
				<FileTree label="Notes directory" onKeyDown={handleTreeKeyDown}>
					{renderNodes(filteredTree, 0)}
				</FileTree>
			) : null}

			{browserMode === "cards" && filteredCards.length > 0 ? (
				<NoteCardsView
					notes={filteredCards}
					selectedNoteId={selectedNoteId}
					onSelectNote={onSelectNote}
					processingStatesByNoteId={processingStatesByNoteId}
					variant="rail"
				/>
			) : null}

			{!isLoading && (browserMode === "directory" ? rows.length === 0 : filteredCards.length === 0) ? (
				<Empty
					title={notes.length === 0 ? "Capture your first note" : "No notes match your filter"}
					description={
						notes.length === 0
							? "Start writing on the canvas, save the note, and it will appear here automatically."
							: browserMode === "cards"
								? "Try a different keyword or switch back to directory view."
								: "Try a different keyword, folder path, or tag."
					}
					size="sm"
					className="[&_h2]:text-lg [&_p]:text-xs"
				/>
			) : null}
		</div>
	);
}
