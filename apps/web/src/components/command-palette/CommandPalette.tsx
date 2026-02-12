import { useEffect, useMemo, useState } from "react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface CommandPaletteProps {
	onSelectCommand?: (command: string) => void;
}

const defaultCommands = [
	{ command: "/ask", description: "Ask a direct question" },
	{ command: "/summarize", description: "Condense current note" },
	{ command: "/research", description: "Expand with missing context" },
	{ command: "/link", description: "Create wiki-style links" },
];

export function CommandPalette({ onSelectCommand }: CommandPaletteProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	useEffect(() => {
		const listener = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setOpen((value) => !value);
			}

			if (event.key === "Escape") {
				setOpen(false);
			}
		};

		window.addEventListener("keydown", listener);
		return () => {
			window.removeEventListener("keydown", listener);
		};
	}, []);

	const filtered = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		if (normalized.length === 0) {
			return defaultCommands;
		}

		return defaultCommands.filter((item) => {
			return (
				item.command.toLowerCase().includes(normalized) ||
				item.description.toLowerCase().includes(normalized)
			);
		});
	}, [query]);

	return (
		<div className="relative">
			<div className="border-border bg-card flex items-center justify-between rounded-none border px-3 py-2">
				<p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">Command palette</p>
				<Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>
					Cmd/Ctrl + K
				</Button>
			</div>

			{open ? (
				<div className="border-border bg-background absolute z-20 mt-2 w-full rounded-none border p-3 shadow-sm">
					<div className="mb-3">
						<Input
							value={query}
							onChange={(event) => {
								setQuery(event.target.value);
							}}
							placeholder="Find command"
						/>
					</div>
					<div className="space-y-2">
						{filtered.map((item) => (
							<Button
								key={item.command}
								variant="ghost"
								className="flex w-full items-center justify-between"
								onClick={() => {
									onSelectCommand?.(item.command);
									setOpen(false);
									setQuery("");
								}}
							>
								<span>{item.command}</span>
								<span className="text-muted-foreground">{item.description}</span>
							</Button>
						))}
					</div>
				</div>
			) : null}
		</div>
	);
}
