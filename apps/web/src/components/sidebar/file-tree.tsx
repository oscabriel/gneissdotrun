import { ChevronRight } from "lucide-react";
import type { KeyboardEventHandler, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface FileTreeProps {
	children: ReactNode;
	label: string;
	onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}

export function FileTree({ children, label, onKeyDown }: FileTreeProps) {
	return (
		<div
			className="flex-1 overflow-y-auto overscroll-contain pr-1"
			role="tree"
			tabIndex={0}
			onKeyDown={onKeyDown}
			aria-label={label}
		>
			{children}
		</div>
	);
}

function TreeIndentGuides({ depth }: { depth: number }) {
	if (depth <= 0) {
		return null;
	}

	return (
		<span aria-hidden className="flex h-full shrink-0 items-stretch">
			{Array.from({ length: depth }).map((_, index) => (
				<span key={`${depth}-${index}`} className="flex w-4 justify-center">
					<span className="bg-kumo-line/70 h-full w-px" />
				</span>
			))}
		</span>
	);
}

interface FileTreeFolderProps {
	name: string;
	expanded: boolean;
	active: boolean;
	selected?: boolean;
	depth: number;
	onClick: () => void;
}

export function FileTreeFolder({
	name,
	expanded,
	active,
	selected = false,
	depth,
	onClick,
}: FileTreeFolderProps) {
	return (
		<button
			type="button"
			role="treeitem"
			aria-expanded={expanded}
			className={cn(
				"text-kumo-strong flex min-h-8 w-full items-stretch text-left text-sm transition-colors",
				selected ? "bg-kumo-tint/80" : "hover:bg-kumo-tint/60",
				active && !selected && "bg-kumo-tint/40",
			)}
			onClick={onClick}
		>
			<TreeIndentGuides depth={depth} />
			<span className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5">
				<ChevronRight
					className={cn(
						"text-kumo-subtle mt-px size-3 shrink-0 transition-transform duration-200",
						expanded ? "rotate-90" : "rotate-0",
					)}
					aria-hidden
				/>
				<span className="truncate font-medium">{name}</span>
			</span>
		</button>
	);
}

interface FileTreeItemProps {
	name: string;
	selected: boolean;
	active: boolean;
	depth: number;
	onClick: () => void;
}

export function FileTreeItem({ name, selected, active, depth, onClick }: FileTreeItemProps) {
	return (
		<button
			type="button"
			role="treeitem"
			aria-selected={selected}
			aria-current={selected ? "true" : undefined}
			className={cn(
				"flex min-h-8 w-full items-stretch text-left text-sm transition-colors",
				selected
					? "bg-kumo-tint/80 text-kumo-default"
					: "text-kumo-subtle hover:bg-kumo-tint/60 hover:text-kumo-default",
				active && !selected && "bg-kumo-tint/40 text-kumo-default",
			)}
			onClick={onClick}
		>
			<TreeIndentGuides depth={depth} />
			<span className="min-w-0 flex-1 px-2 py-1.5">
				<p className="truncate">{name}</p>
			</span>
		</button>
	);
}
