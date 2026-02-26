import { Empty, Input } from "@cloudflare/kumo";
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useMemo,
	useState,
	type ChangeEvent,
	type KeyboardEvent,
} from "react";

import { FileTree, FileTreeFolder, FileTreeItem } from "@/components/sidebar/file-tree";
import type { SidebarNote } from "@/components/sidebar/notes-sidebar";

interface WorkspaceNode {
	id: string;
	type: "folder" | "note";
	name: string;
	noteId?: string;
	parentId: string | null;
	updatedAt?: number;
}

interface NotesDirectoryProps {
	notes: SidebarNote[];
	selectedNoteId: string | null;
	onSelectNote: (noteId: string) => void;
	isLoading: boolean;
	error: string | null;
	usingFallback: boolean;
}

export interface NotesDirectoryHandle {
	focusSearch: () => void;
}

interface RenderRow {
	id: string;
	type: "folder" | "note";
	depth: number;
	name: string;
	noteId?: string;
	updatedAt?: number;
	childCount?: number;
}

function monthBucketLabel(updatedAt: number): string {
	const date = new Date(updatedAt);
	return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

function buildDirectoryTree(notes: SidebarNote[]): WorkspaceNode[] {
	const buckets = new Map<string, WorkspaceNode>();
	const nodes: WorkspaceNode[] = [];

	for (const note of notes) {
		const bucket = monthBucketLabel(note.updatedAt);
		if (!buckets.has(bucket)) {
			const folderId = `folder-${bucket.toLowerCase().replace(/\s+/g, "-")}`;
			const folderNode: WorkspaceNode = {
				id: folderId,
				type: "folder",
				name: bucket,
				parentId: null,
			};
			buckets.set(bucket, folderNode);
			nodes.push(folderNode);
		}

		nodes.push({
			id: note.id,
			type: "note",
			name: note.title,
			noteId: note.id,
			parentId: buckets.get(bucket)?.id ?? null,
			updatedAt: note.updatedAt,
		});
	}

	return nodes;
}

export const NotesDirectory = forwardRef<NotesDirectoryHandle, NotesDirectoryProps>(function NotesDirectory(
	{ notes, selectedNoteId, onSelectNote, isLoading, error, usingFallback },
	ref,
) {
	const [query, setQuery] = useState("");
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

	const folders = useMemo(() => treeNodes.filter((node) => node.type === "folder"), [treeNodes]);

	useEffect(() => {
		if (folders.length === 0) {
			return;
		}

		setExpandedFolders((current) => {
			const next = { ...current };
			for (const folder of folders) {
				if (next[folder.id] === undefined) {
					next[folder.id] = true;
				}
			}
			return next;
		});
	}, [folders]);

	const rows = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		const folderRows = folders
			.slice()
			.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))
			.reverse();
		const output: RenderRow[] = [];

		for (const folder of folderRows) {
			const children = treeNodes
				.filter((node) => node.parentId === folder.id && node.type === "note")
				.sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));

			const filteredChildren =
				normalized.length === 0
					? children
					: children.filter((node) => {
						return node.name.toLowerCase().includes(normalized);
					});

			if (filteredChildren.length === 0 && normalized.length > 0) {
				continue;
			}

			output.push({
				id: folder.id,
				type: "folder",
				depth: 0,
				name: folder.name,
				childCount: filteredChildren.length,
			});

			if (expandedFolders[folder.id] || normalized.length > 0) {
				for (const child of filteredChildren) {
					output.push({
						id: `${folder.id}:${child.id}`,
						type: "note",
						depth: 1,
						name: child.name,
						noteId: child.noteId,
						updatedAt: child.updatedAt,
					});
				}
			}
		}

		return output;
	}, [expandedFolders, folders, query, treeNodes]);

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

	const moveActive = (nextIndex: number) => {
		const next = rows[nextIndex];
		if (!next) {
			return;
		}
		setActiveRowId(next.id);
	};

	const toggleFolder = (folderId: string) => {
		setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
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
			if (current?.type === "folder" && expandedFolders[current.id]) {
				toggleFolder(current.id);
			} else if (current?.type === "note") {
				const parentFolder = rows.findIndex(
					(row) => row.type === "folder" && current.id.startsWith(`${row.id}:`),
				);
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
			<div className="mb-3 flex items-center gap-2">
				<p className="text-kumo-subtle text-xs font-medium tracking-[0.2em] uppercase">Directory</p>
				<span className="text-kumo-subtle text-xs">{notes.length}</span>
			</div>

			<div className="mb-3">
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
			</div>

			{error ? <p className="text-kumo-danger mb-3 text-xs">{error}</p> : null}
			{isLoading ? <p className="text-kumo-subtle mb-3 text-xs">Loading notes...</p> : null}
			<p className="text-kumo-subtle mb-3 text-[11px]">
				{usingFallback ? "Index reconnecting — showing last synced notes." : "Live index updates enabled."}
			</p>

			{rows.length > 0 ? (
				<FileTree label="Notes directory" onKeyDown={handleTreeKeyDown}>
					{rows.map((row) => {
						const isActive = row.id === activeRowId;

						if (row.type === "folder") {
							return (
								<FileTreeFolder
									key={row.id}
									name={row.name}
									count={row.childCount}
									expanded={Boolean(expandedFolders[row.id])}
									active={isActive}
									depth={row.depth}
									onClick={() => {
										setActiveRowId(row.id);
										toggleFolder(row.id);
									}}
								/>
							);
						}

						const selected = row.noteId === selectedNoteId;

						return (
							<FileTreeItem
								key={row.id}
								name={row.name}
								subtitle={row.updatedAt ? `Updated ${new Date(row.updatedAt).toLocaleDateString()}` : undefined}
								selected={selected}
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
					description="Try a different keyword to find the note you need."
					size="sm"
					className="[&_h2]:text-lg [&_p]:text-xs"
				/>
			) : null}
		</div>
	);
});
