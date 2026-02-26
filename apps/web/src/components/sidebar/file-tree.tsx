import { ChevronRight, FileText } from "lucide-react";
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
			className="flex-1 overflow-y-auto overscroll-contain"
			role="tree"
			tabIndex={0}
			onKeyDown={onKeyDown}
			aria-label={label}
		>
			{children}
		</div>
	);
}

interface FileTreeFolderProps {
	name: string;
	count?: number;
	expanded: boolean;
	active: boolean;
	depth: number;
	onClick: () => void;
}

export function FileTreeFolder({
	name,
	count,
	expanded,
	active,
	depth,
	onClick,
}: FileTreeFolderProps) {
	return (
		<button
			type="button"
			role="treeitem"
			aria-expanded={expanded}
			className={cn(
				"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
				"hover:bg-kumo-tint",
				active && "ring-kumo-line ring-1",
			)}
			style={{ paddingLeft: `${depth * 12 + 8}px` }}
			onClick={onClick}
		>
			<ChevronRight
				className={cn(
					"text-kumo-subtle size-3 shrink-0 transition-transform duration-200",
					expanded ? "rotate-90" : "rotate-0",
				)}
				aria-hidden
			/>
			<span className="text-kumo-default truncate text-sm font-medium">{name}</span>
			{count !== undefined ? (
				<span className="text-kumo-subtle ml-auto shrink-0 text-[11px]">{count}</span>
			) : null}
		</button>
	);
}

interface FileTreeItemProps {
	name: string;
	subtitle?: string;
	selected: boolean;
	active: boolean;
	depth: number;
	onClick: () => void;
}

export function FileTreeItem({
	name,
	subtitle,
	selected,
	active,
	depth,
	onClick,
}: FileTreeItemProps) {
	return (
		<button
			type="button"
			role="treeitem"
			aria-selected={selected}
			aria-current={selected ? "true" : undefined}
			className={cn(
				"flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left",
				selected ? "bg-kumo-tint ring-kumo-line ring-1" : "hover:bg-kumo-tint",
				active && !selected && "ring-kumo-line ring-1",
			)}
			style={{ paddingLeft: `${depth * 12 + 8}px` }}
			onClick={onClick}
		>
			<FileText className="text-kumo-subtle mt-0.5 size-3 shrink-0" aria-hidden />
			<span className="min-w-0 flex-1">
				<p className="text-kumo-default truncate text-sm">{name}</p>
				{subtitle ? <p className="text-kumo-subtle mt-0.5 text-[11px]">{subtitle}</p> : null}
			</span>
		</button>
	);
}
