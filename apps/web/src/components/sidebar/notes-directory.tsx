import { Empty } from "@cloudflare/kumo";
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useMemo,
	useState,
	type KeyboardEvent,
} from "react";

import { FileTree, FileTreeFolder, FileTreeItem } from "@/components/sidebar/file-tree";
import type { SidebarNote } from "@/components/sidebar/notes-sidebar";

interface WorkspaceLeaf {
	id: string;
	name: string;
	noteId: string;
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

interface NotesDirectoryProps {
	notes: SidebarNote[];
	selectedNoteId: string | null;
	onSelectNote: (noteId: string) => void;
	isLoading: boolean;
	error: string | null;
	usingFallback: boolean;
	processingStatesByNoteId?: Record<string, NoteProcessingState>;
}

export interface NotesDirectoryHandle {
	focusSearch: () => void;
}

interface RenderRow {
	id: string;
	type: "folder" | "note";
	depth: number;
	name: string;
	parentId: string | null;
	noteId?: string;
	processingStatus?: NoteProcessingState;
}

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

function normalizeTag(tag: string): string {
	return tag.trim().replace(/^#+/, "").replace(/\s+/g, " ");
}

function splitTagPath(tag: string): string[] {
	return normalizeTag(tag)
		.split(TAG_PATH_SEPARATOR)
		.map((segment) => segment.trim())
		.filter(Boolean);
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

function deriveFolderSegments(note: SidebarNote): string[] {
	const noteTags = note.tags ?? [];
	const semanticTags = Array.from(
		new Set(
			noteTags
				.map((tag) => normalizeTag(tag))
				.filter((tag) => tag.length > 0 && !SYSTEM_TAGS.has(tag.toLowerCase())),
		),
	);

	const nestedPath = semanticTags
		.map((tag) => splitTagPath(tag))
		.filter((segments) => segments.length > 1)
		.sort(
			(left, right) => right.length - left.length || left.join("/").localeCompare(right.join("/")),
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

function sortFolderTree(folder: WorkspaceFolder): WorkspaceFolder {
	return {
		...folder,
		folders: folder.folders.map(sortFolderTree).sort(compareByName),
		notes: [...folder.notes].sort(compareByName),
	};
}

function buildDirectoryTree(notes: SidebarNote[]): WorkspaceFolder[] {
	const root: WorkspaceFolder = {
		id: "root",
		name: "root",
		fullPath: "",
		folders: [],
		notes: [],
	};
	const foldersByPath = new Map<string, WorkspaceFolder>([["", root]]);

	for (const note of notes) {
		const pathSegments = deriveFolderSegments(note);
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
			searchText: [note.title, note.summary, (note.tags ?? []).join(" "), parent.fullPath]
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

export const NotesDirectory = forwardRef<NotesDirectoryHandle, NotesDirectoryProps>(
	function NotesDirectory(
		{
			notes,
			selectedNoteId,
			onSelectNote,
			isLoading,
			error,
			usingFallback: _usingFallback,
			processingStatesByNoteId = {},
		},
		ref,
	) {
		const [query] = useState("");
		const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
		const [activeRowId, setActiveRowId] = useState<string | null>(null);

		useImperativeHandle(ref, () => ({
			focusSearch: () => {
				const input = document.getElementById("notes-directory-search") as HTMLInputElement | null;
				input?.focus();
				input?.select();
			},
		}));

		const treeNodes = useMemo(() => buildDirectoryTree(notes), [notes]);
		const folderIds = useMemo(() => collectFolderIds(treeNodes), [treeNodes]);
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
			const normalized = query.trim().toLowerCase();
			const filteredTree = filterTree(treeNodes, normalized);
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

					if (normalized.length > 0 || expandedFolders[folder.id]) {
						appendRows(folder.folders, depth + 1, folder.id);
						for (const note of folder.notes) {
							output.push({
								id: `${folder.id}:note:${note.id}`,
								type: "note",
								depth: depth + 1,
								name: note.name,
								parentId: folder.id,
								noteId: note.noteId,
								processingStatus: processingStatesByNoteId[note.noteId],
							});
						}
					}
				}
			};

			appendRows(filteredTree, 0, null);
			return output;
		}, [expandedFolders, processingStatesByNoteId, query, treeNodes]);

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
		};

		const toggleFolder = (folderId: string) => {
			setExpandedFolders((current) => ({
				...current,
				[folderId]: !current[folderId],
			}));
		};

		const handleTreeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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
				} else {
					moveActive(Math.min(rows.length - 1, Math.max(0, activeIndex + 1)));
				}
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
				return;
			}

			if (event.key === "Enter") {
				event.preventDefault();
				const current = rows[Math.max(0, activeIndex)];
				if (!current) {
					return;
				}

				if (current.type === "folder") {
					toggleFolder(current.id);
					return;
				}

				if (current.noteId) {
					onSelectNote(current.noteId);
				}
			}
		};

		return (
			<div className="flex h-full min-h-0 flex-col overflow-hidden p-3">
				{/*<div className="mb-3 flex items-center gap-2">
					<p className="text-kumo-subtle text-xs font-medium tracking-[0.2em] uppercase">
						Directory
					</p>
					<span className="text-kumo-subtle text-xs">{notes.length}</span>
				</div>*/}

				{/*<div className="mb-3">
					<Input
						id="notes-directory-search"
						aria-label="Filter notes directory"
						placeholder="Filter notes"
						className="w-full"
						value={query}
						onChange={(event: ChangeEvent<HTMLInputElement>) => {
							setQuery(event.target.value);
						}}
					/>
				</div>*/}

				{error ? <p className="text-kumo-danger mb-3 text-xs">{error}</p> : null}
				{isLoading ? <p className="text-kumo-subtle mb-3 text-xs">Loading notes...</p> : null}
				{/*<p className="text-kumo-subtle mb-3 text-[11px]">
					{usingFallback
						? "Index reconnecting - showing last synced notes."
						: "Tree view follows your nested tags."}
				</p>*/}

				{rows.length > 0 ? (
					<FileTree label="Notes directory" onKeyDown={handleTreeKeyDown}>
						{rows.map((row) => {
							const isActive = row.id === activeRowId;
							if (row.type === "folder") {
								return (
									<FileTreeFolder
										key={row.id}
										name={row.name}
										expanded={Boolean(expandedFolders[row.id])}
										active={isActive}
										selected={selectedFolderIds.has(row.id)}
										depth={row.depth}
										onClick={() => {
											setActiveRowId(row.id);
											toggleFolder(row.id);
										}}
									/>
								);
							}

							return (
								<FileTreeItem
									key={row.id}
									name={row.name}
									selected={row.noteId === selectedNoteId}
									active={isActive}
									depth={row.depth}
									onClick={() => {
										setActiveRowId(row.id);
										if (row.noteId) {
											onSelectNote(row.noteId);
										}
									}}
								/>
							);
						})}
					</FileTree>
				) : null}

				{!isLoading && rows.length === 0 && notes.length > 0 ? (
					<Empty
						title="No notes match your filter"
						description="Try a different keyword, folder path, or tag."
						size="sm"
						className="[&_h2]:text-lg [&_p]:text-xs"
					/>
				) : null}
			</div>
		);
	},
);
