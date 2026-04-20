import { ChevronRight } from "lucide-react";
import type { KeyboardEventHandler, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface FileTreeProps {
	children: ReactNode;
	label: string;
	onKeyDown: KeyboardEventHandler<HTMLElement>;
}

export function FileTree({ children, label, onKeyDown }: FileTreeProps) {
	return (
		<nav
			className="flex-1 overflow-y-auto overscroll-contain pr-1"
			onKeyDown={onKeyDown}
			aria-label={label}
		>
			<ul className="space-y-0.5">{children}</ul>
		</nav>
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
	id: string;
	name: string;
	expanded: boolean;
	active: boolean;
	selected?: boolean;
	depth: number;
	onClick: () => void;
	onFocus: () => void;
	children?: ReactNode;
}

export function FileTreeFolder({
	id,
	name,
	expanded,
	active,
	selected = false,
	depth,
	onClick,
	onFocus,
	children,
}: FileTreeFolderProps) {
	const childGroupId = `${id}-children`;
	const hasChildren = children !== undefined && children !== null;

	return (
		<li>
			<button
				id={id}
				type="button"
				aria-expanded={expanded}
				aria-controls={hasChildren ? childGroupId : undefined}
				tabIndex={active ? 0 : -1}
				className={cn(
					"text-kumo-strong flex min-h-8 w-full items-stretch rounded-md text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60",
					selected ? "bg-kumo-tint/80" : "hover:bg-kumo-tint/60",
					active && !selected && "bg-kumo-tint/40",
				)}
				onClick={onClick}
				onFocus={onFocus}
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
			{hasChildren ? (
				<ul id={childGroupId} className="space-y-0.5" hidden={!expanded}>
					{children}
				</ul>
			) : null}
		</li>
	);
}

interface FileTreeItemProps {
	id: string;
	name: string;
	description?: ReactNode;
	selected: boolean;
	active: boolean;
	depth: number;
	onClick: () => void;
	onFocus: () => void;
}

export function FileTreeItem({
	id,
	name,
	description,
	selected,
	active,
	depth,
	onClick,
	onFocus,
}: FileTreeItemProps) {
	return (
		<li>
			<button
				id={id}
				type="button"
				aria-current={selected ? "true" : undefined}
				tabIndex={active ? 0 : -1}
				className={cn(
					"flex min-h-8 w-full items-stretch rounded-md text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60",
					selected
						? "bg-kumo-tint/80 text-kumo-default"
						: "text-kumo-subtle hover:bg-kumo-tint/60 hover:text-kumo-default",
					active && !selected && "bg-kumo-tint/40 text-kumo-default",
				)}
				onClick={onClick}
				onFocus={onFocus}
			>
				<TreeIndentGuides depth={depth} />
				<span className="min-w-0 flex-1 px-2 py-1.5">
					<p className="truncate">{name}</p>
					{description ? <div className="mt-1 min-w-0">{description}</div> : null}
				</span>
			</button>
		</li>
	);
}
