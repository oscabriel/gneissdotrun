import { CommandPalette as KumoCommandPalette } from "@cloudflare/kumo";
import { useEffect, useState } from "react";

export type WorkspacePaletteAction =
	| { kind: "run"; command: string }
	| { kind: "workflow"; workflow: "organize" | "fan_out" }
	| { kind: "navigation"; to: "/collections" | "/digest" | "/history" | "/contradictions" }
	| { kind: "layout"; target: "left" | "right" }
	| { kind: "focus"; target: "editor" }
	| { kind: "utility"; section: "review" | "controls" | "utility" };

interface CommandPaletteProps {
	onSelectAction?: (action: WorkspacePaletteAction) => void;
	onOpenChange?: (open: boolean) => void;
}

interface PaletteItem {
	id: string;
	title: string;
	description: string;
	action: WorkspacePaletteAction;
	shortcutHint?: string;
}

export const workspacePaletteItems: PaletteItem[] = [
	{
		id: "layout-left",
		title: "Toggle left directory",
		description: "Show or hide the notes directory rail",
		action: { kind: "layout", target: "left" },
		shortcutHint: "⌘\\",
	},
	{
		id: "layout-right",
		title: "Toggle right utilities",
		description: "Show or hide the workspace utility rail",
		action: { kind: "layout", target: "right" },
		shortcutHint: "⌘.",
	},
	{
		id: "focus-editor",
		title: "Focus editor",
		description: "Move focus to the note editor",
		action: { kind: "focus", target: "editor" },
		shortcutHint: "⌘⇧2",
	},
	{
		id: "utility-review",
		title: "Open review utilities",
		description: "Focus review actions in the right sidebar",
		action: { kind: "utility", section: "review" },
		shortcutHint: "Review",
	},
	{
		id: "utility-controls",
		title: "Open workspace controls",
		description: "Focus theme/font/mode controls",
		action: { kind: "utility", section: "controls" },
		shortcutHint: "Controls",
	},
	{
		id: "utility-footer",
		title: "Open utility footer",
		description: "Focus profile/settings/info actions",
		action: { kind: "utility", section: "utility" },
		shortcutHint: "Utility",
	},
	{
		id: "run-summarize",
		title: "Insert summarize command",
		description: "Add `/summarize` to the active note",
		action: { kind: "run", command: "/summarize" },
		shortcutHint: "Run",
	},
	{
		id: "run-research",
		title: "Insert research command",
		description: "Add `/research` to the active note",
		action: { kind: "run", command: "/research" },
		shortcutHint: "Run",
	},
	{
		id: "run-link",
		title: "Insert link command",
		description: "Add `/link` using grounded note matches",
		action: { kind: "run", command: "/link" },
		shortcutHint: "Run",
	},
	{
		id: "run-ask",
		title: "Insert ask command",
		description: "Add `/ask` to the active note",
		action: { kind: "run", command: "/ask" },
		shortcutHint: "Run",
	},
	{
		id: "workflow-organize",
		title: "Run organization now",
		description: "Trigger organization refresh for pending notes",
		action: { kind: "workflow", workflow: "organize" },
		shortcutHint: "Workflow",
	},
	{
		id: "workflow-fanout",
		title: "Run fan-out from active note",
		description: "Trigger the fan-out workflow using the current note",
		action: { kind: "workflow", workflow: "fan_out" },
		shortcutHint: "Workflow",
	},
	{
		id: "nav-history",
		title: "Open note history",
		description: "Open history for the current note",
		action: { kind: "navigation", to: "/history" },
		shortcutHint: "Go",
	},
	{
		id: "nav-collections",
		title: "Open collections review",
		description: "Open grouped capture review",
		action: { kind: "navigation", to: "/collections" },
		shortcutHint: "Go",
	},
	{
		id: "nav-digest",
		title: "Open weekly digest",
		description: "Open periodic summary review",
		action: { kind: "navigation", to: "/digest" },
		shortcutHint: "Go",
	},
	{
		id: "nav-contradictions",
		title: "Open contradictions review",
		description: "Review and resolve open contradiction candidates",
		action: { kind: "navigation", to: "/contradictions" },
		shortcutHint: "Go",
	},
];

export function CommandPalette({ onSelectAction, onOpenChange }: CommandPaletteProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	const setOpenState = (nextOpen: boolean) => {
		setOpen(nextOpen);
		onOpenChange?.(nextOpen);
	};

	useEffect(() => {
		const listener = (event: KeyboardEvent) => {
			if (event.repeat) {
				return;
			}

			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setOpenState(true);
				return;
			}

			if (event.key === "Escape") {
				setOpenState(false);
			}
		};

		window.addEventListener("keydown", listener);
		return () => {
			window.removeEventListener("keydown", listener);
		};
	}, [onOpenChange]);

	const handleSelect = (item: PaletteItem) => {
		onSelectAction?.(item.action);
		setOpenState(false);
		setQuery("");
	};

	return (
		<KumoCommandPalette.Root
			open={open}
			onOpenChange={setOpenState}
			items={workspacePaletteItems}
			value={query}
			onValueChange={setQuery}
			itemToStringValue={(item) => `${item.title} ${item.description}`}
			onSelect={(item) => {
				handleSelect(item);
			}}
			getSelectableItems={(items) => items}
		>
			<KumoCommandPalette.Input placeholder="Run an action, toggle rails, or jump to a view..." />
			<KumoCommandPalette.List>
				<KumoCommandPalette.Results>
					{(item: PaletteItem) => (
						<KumoCommandPalette.Item
							key={item.id}
							value={item}
							onClick={() => {
								handleSelect(item);
							}}
						>
							<div className="flex w-full items-center justify-between gap-3">
								<span className="text-kumo-default">{item.title}</span>
								<span className="text-kumo-subtle text-xs">
									{item.shortcutHint ?? item.description}
								</span>
							</div>
						</KumoCommandPalette.Item>
					)}
				</KumoCommandPalette.Results>
				<KumoCommandPalette.Empty>No actions found</KumoCommandPalette.Empty>
			</KumoCommandPalette.List>
			<KumoCommandPalette.Footer>
				<span className="flex items-center gap-2">
					<kbd className="border-kumo-line bg-kumo-base rounded border px-1.5 py-0.5 text-[10px]">
						↑↓
					</kbd>
					<span>Navigate</span>
				</span>
				<span className="flex items-center gap-2">
					<kbd className="border-kumo-line bg-kumo-base rounded border px-1.5 py-0.5 text-[10px]">
						↵
					</kbd>
					<span>Run</span>
				</span>
			</KumoCommandPalette.Footer>
		</KumoCommandPalette.Root>
	);
}
