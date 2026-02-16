import { useEffect, useState } from "react";
import { CommandPalette as KumoCommandPalette } from "@cloudflare/kumo";
import { useNavigate } from "@tanstack/react-router";

interface CommandPaletteProps {
	onSelectCommand?: (command: string) => void;
	onOpenChange?: (open: boolean) => void;
}

interface PaletteItem {
	id: string;
	title: string;
	description: string;
	kind: "agent" | "navigation";
	command?: string;
	to?: "/collections" | "/digest";
}

const paletteItems: PaletteItem[] = [
	{
		id: "agent-ask",
		title: "Ask",
		description: "Ask a direct question about your notes",
		kind: "agent",
		command: "/ask",
	},
	{
		id: "agent-summarize",
		title: "Summarize",
		description: "Condense the current note into key points",
		kind: "agent",
		command: "/summarize",
	},
	{
		id: "agent-research",
		title: "Research",
		description: "Expand your note with related context",
		kind: "agent",
		command: "/research",
	},
	{
		id: "agent-link",
		title: "Link",
		description: "Create wiki-style links in the note",
		kind: "agent",
		command: "/link",
	},
	{
		id: "nav-collections",
		title: "Open Collections Review",
		description: "Optional review surface for grouped captures",
		kind: "navigation",
		to: "/collections",
	},
	{
		id: "nav-digest",
		title: "Open Weekly Digest",
		description: "Optional review surface for periodic summaries",
		kind: "navigation",
		to: "/digest",
	},
];

export function CommandPalette({ onSelectCommand, onOpenChange }: CommandPaletteProps) {
	const navigate = useNavigate();
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
		if (item.kind === "agent" && item.command) {
			onSelectCommand?.(item.command);
		}

		if (item.kind === "navigation" && item.to) {
			if (item.to === "/collections") {
				void navigate({ to: "/collections", search: { query: "" } });
			} else {
				void navigate({ to: "/digest" });
			}
		}

		setOpenState(false);
		setQuery("");
	};

	return (
		<KumoCommandPalette.Root
			open={open}
			onOpenChange={setOpenState}
			items={paletteItems}
			value={query}
			onValueChange={setQuery}
			itemToStringValue={(item) => `${item.title} ${item.description} ${item.command ?? ""}`}
			onSelect={(item) => {
				handleSelect(item);
			}}
			getSelectableItems={(items) => items}
		>
			<KumoCommandPalette.Input placeholder="Type a command or jump to a view..." />
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
								<span className="text-kumo-subtle text-xs">{item.command ?? item.description}</span>
							</div>
						</KumoCommandPalette.Item>
					)}
				</KumoCommandPalette.Results>
				<KumoCommandPalette.Empty>No commands found</KumoCommandPalette.Empty>
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
					<span>Select</span>
				</span>
			</KumoCommandPalette.Footer>
		</KumoCommandPalette.Root>
	);
}
