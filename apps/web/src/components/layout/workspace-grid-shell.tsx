import { Button, Tooltip } from "@cloudflare/kumo";
import { Menu, PanelLeftClose, PanelLeftOpen, PanelRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface WorkspaceGridShellProps {
	leftRail: ReactNode;
	main: ReactNode;
	rightRail: ReactNode;
	leftCollapsed: boolean;
	rightCollapsed: boolean;
	onToggleLeft: () => void;
	onToggleRight: () => void;
	mobilePanel: "left" | "right" | null;
	onCloseMobilePanel: () => void;
}

export function WorkspaceGridShell({
	leftRail,
	main,
	rightRail,
	leftCollapsed,
	rightCollapsed,
	onToggleLeft,
	onToggleRight,
	mobilePanel,
	onCloseMobilePanel,
}: WorkspaceGridShellProps) {
	return (
		<>
			{/* Desktop left rail — always visible */}
			<aside className="fixed inset-y-0 left-0 z-40 hidden w-12 flex-col border-r border-kumo-line bg-kumo-elevated lg:flex">
				<div className="flex h-12 items-center justify-center border-b border-kumo-line">
					<Tooltip content={leftCollapsed ? "Open directory (⌘\\)" : "Close directory (⌘\\)"}>
						<Button
							size="sm"
							variant="ghost"
							shape="square"
							onClick={onToggleLeft}
							aria-label={leftCollapsed ? "Open notes directory" : "Close notes directory"}
						>
							{leftCollapsed ? (
								<PanelLeftOpen className="size-4" aria-hidden />
							) : (
								<PanelLeftClose className="size-4" aria-hidden />
							)}
						</Button>
					</Tooltip>
				</div>
			</aside>

			{/* Desktop left panel — slides in/out */}
			<aside
				id="workspace-left-rail"
				data-left-sidebar-open={leftCollapsed ? "false" : "true"}
				className={cn(
					"fixed inset-y-0 left-12 z-30 hidden w-64 flex-col border-kumo-line bg-kumo-elevated transition-transform duration-300 ease-out will-change-transform lg:flex",
					leftCollapsed ? "-translate-x-full" : "translate-x-0 border-r",
				)}
			>
				<div className="flex h-12 shrink-0 items-center justify-center border-b border-kumo-line">
					<p className="text-kumo-subtle text-xs font-medium tracking-[0.25em] uppercase">Gneiss.run</p>
				</div>
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">{leftRail}</div>
			</aside>

			{/* Desktop right sidebar — always visible, width changes */}
			<aside
				id="workspace-right-rail"
				data-right-sidebar-open={rightCollapsed ? "false" : "true"}
				className={cn(
					"fixed inset-y-0 right-0 z-40 hidden flex-col border-l border-kumo-line bg-kumo-elevated transition-[width] duration-300 ease-out lg:flex",
					rightCollapsed ? "w-12" : "w-48",
				)}
			>
				{rightRail}
			</aside>

			{/* Main content */}
			<main className="workspace-main h-screen pt-12 transition-[margin] duration-300 lg:pt-0">
				{main}
			</main>

			{/* Mobile top bar */}
			<header className="fixed inset-x-0 top-0 z-50 flex h-12 items-center justify-between border-b border-kumo-line bg-kumo-elevated px-3 lg:hidden">
				<Button size="sm" variant="ghost" shape="square" onClick={onToggleLeft} aria-label="Open notes directory">
					<Menu className="size-4" aria-hidden />
				</Button>
				<span className="text-kumo-strong text-sm font-semibold tracking-tight">Gneiss</span>
				<Button size="sm" variant="ghost" shape="square" onClick={onToggleRight} aria-label="Open utilities">
					<PanelRight className="size-4" aria-hidden />
				</Button>
			</header>

			{/* Mobile left drawer */}
			{mobilePanel === "left" ? (
				<div
					className="fixed inset-0 z-50 bg-kumo-overlay/70 lg:hidden"
					onClick={onCloseMobilePanel}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							onCloseMobilePanel();
						}
					}}
				>
					<aside
						className="h-full w-72 border-r border-kumo-line bg-kumo-elevated"
						onClick={(e) => {
							e.stopPropagation();
						}}
					>
						<div className="flex h-12 items-center justify-between border-b border-kumo-line px-3">
							<span className="text-kumo-strong text-sm font-semibold">Directory</span>
							<Button size="sm" variant="ghost" onClick={onCloseMobilePanel} aria-label="Close directory">
								Close
							</Button>
						</div>
						<div className="flex h-[calc(100%-3rem)] flex-col overflow-hidden">{leftRail}</div>
					</aside>
				</div>
			) : null}

			{/* Mobile right drawer */}
			{mobilePanel === "right" ? (
				<div
					className="fixed inset-0 z-50 bg-kumo-overlay/70 lg:hidden"
					onClick={onCloseMobilePanel}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							onCloseMobilePanel();
						}
					}}
				>
					<div className="flex h-full justify-end">
						<aside
							className="h-full w-12 border-l border-kumo-line bg-kumo-elevated"
							onClick={(e) => {
								e.stopPropagation();
							}}
						>
							{rightRail}
						</aside>
					</div>
				</div>
			) : null}
		</>
	);
}
