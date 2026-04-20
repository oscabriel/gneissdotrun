import { Button, Dialog, Tooltip } from "@cloudflare/kumo";
import { Menu, PanelLeftClose, PanelLeftOpen, PanelRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface WorkspaceGridShellProps {
	leftRail: ReactNode;
	main: ReactNode;
	rightRail: ReactNode;
	mobileRightRail?: ReactNode;
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
	mobileRightRail,
	leftCollapsed,
	rightCollapsed,
	onToggleLeft,
	onToggleRight,
	mobilePanel,
	onCloseMobilePanel,
}: WorkspaceGridShellProps) {
	const rightMobileContent = mobileRightRail ?? rightRail;

	return (
		<>
			{/* Desktop left rail — always visible */}
			<aside className="border-kumo-line bg-kumo-elevated fixed inset-y-0 left-0 z-40 hidden w-12 flex-col border-r lg:flex">
				<div className="border-kumo-line flex h-12 items-center justify-center border-b">
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
					"border-kumo-line bg-kumo-elevated fixed inset-y-0 left-12 z-30 hidden w-64 flex-col transition-transform duration-300 ease-out will-change-transform lg:flex",
					leftCollapsed ? "-translate-x-full" : "translate-x-0 border-r",
				)}
			>
				<div className="border-kumo-line flex h-12 shrink-0 items-center justify-center border-b">
					<p className="text-kumo-subtle text-xs font-medium tracking-[0.25em] uppercase">
						Gneiss.run
					</p>
				</div>
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">{leftRail}</div>
			</aside>

			{/* Desktop right sidebar — always visible, width changes */}
			<aside
				id="workspace-right-rail"
				data-right-sidebar-open={rightCollapsed ? "false" : "true"}
				className={cn(
					"border-kumo-line bg-kumo-elevated fixed inset-y-0 right-0 z-40 hidden flex-col border-l transition-[width] duration-300 ease-out lg:flex",
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
			<header className="border-kumo-line bg-kumo-elevated fixed inset-x-0 top-0 z-50 flex h-12 items-center justify-between border-b px-3 lg:hidden">
				<Button
					size="sm"
					variant="ghost"
					shape="square"
					onClick={onToggleLeft}
					aria-haspopup="dialog"
					aria-expanded={mobilePanel === "left"}
					aria-controls="workspace-mobile-left-drawer"
					aria-label={mobilePanel === "left" ? "Close notes directory" : "Open notes directory"}
				>
					<Menu className="size-4" aria-hidden />
				</Button>
				<span className="text-kumo-strong text-sm font-semibold tracking-tight">Gneiss</span>
				<Button
					size="sm"
					variant="ghost"
					shape="square"
					onClick={onToggleRight}
					aria-haspopup="dialog"
					aria-expanded={mobilePanel === "right"}
					aria-controls="workspace-mobile-right-drawer"
					aria-label={mobilePanel === "right" ? "Close utilities" : "Open utilities"}
				>
					<PanelRight className="size-4" aria-hidden />
				</Button>
			</header>

			<Dialog.Root
				open={mobilePanel === "left"}
				onOpenChange={(open) => {
					if (!open) {
						onCloseMobilePanel();
					}
				}}
			>
				<Dialog
					size="sm"
					className="left-0 top-0 h-dvh w-[min(20rem,calc(100vw-1rem))] max-w-none translate-x-0 translate-y-0 rounded-none p-0 sm:left-0 sm:top-0 sm:w-80 sm:max-w-none sm:translate-x-0 sm:translate-y-0 lg:hidden"
				>
					<div id="workspace-mobile-left-drawer" className="flex h-full flex-col overflow-hidden">
						<div className="border-kumo-line flex h-12 shrink-0 items-center justify-between border-b px-3">
							<div>
								<Dialog.Title className="text-kumo-strong text-sm font-semibold">Directory</Dialog.Title>
								<Dialog.Description className="sr-only">
									Browse and filter saved notes.
								</Dialog.Description>
							</div>
							<Button size="sm" variant="ghost" onClick={onCloseMobilePanel} aria-label="Close directory">
								Close
							</Button>
						</div>
						<div className="flex min-h-0 flex-1 flex-col overflow-hidden">{leftRail}</div>
					</div>
				</Dialog>
			</Dialog.Root>

			<Dialog.Root
				open={mobilePanel === "right"}
				onOpenChange={(open) => {
					if (!open) {
						onCloseMobilePanel();
					}
				}}
			>
				<Dialog
					size="sm"
					className="left-auto right-0 top-0 h-dvh w-[min(20rem,calc(100vw-1rem))] max-w-none translate-x-0 translate-y-0 rounded-none p-0 sm:left-auto sm:right-0 sm:top-0 sm:w-72 sm:max-w-none sm:translate-x-0 sm:translate-y-0 lg:hidden"
				>
					<div id="workspace-mobile-right-drawer" className="flex h-full flex-col overflow-hidden">
						<div className="border-kumo-line flex h-12 shrink-0 items-center justify-between border-b px-3">
							<div>
								<Dialog.Title className="text-kumo-strong text-sm font-semibold">Utilities</Dialog.Title>
								<Dialog.Description className="sr-only">
									Workspace controls and review navigation.
								</Dialog.Description>
							</div>
							<Button size="sm" variant="ghost" onClick={onCloseMobilePanel} aria-label="Close utilities">
								Close
							</Button>
						</div>
						<div className="flex min-h-0 flex-1 flex-col overflow-hidden">{rightMobileContent}</div>
					</div>
				</Dialog>
			</Dialog.Root>
		</>
	);
}
