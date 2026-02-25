import type { ReactNode } from "react";
import { Surface } from "@cloudflare/kumo";

import { cn } from "@/lib/utils";

interface AppShellProps {
	header: ReactNode;
	sidebar: ReactNode;
	main: ReactNode;
	className?: string;
	sidebarCollapsed?: boolean;
	sidebarId?: string;
}

export function AppShell({
	header,
	sidebar,
	main,
	className,
	sidebarCollapsed = false,
	sidebarId,
}: AppShellProps) {
	return (
		<div
			className={cn(
				"mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-3 px-4 py-6 sm:px-6",
				className,
			)}
		>
			<header className="px-1 pb-1 sm:px-2">{header}</header>

			<div
				className={cn(
					"grid flex-1 gap-3",
					sidebarCollapsed ? "lg:grid-cols-[minmax(0,1fr)]" : "lg:grid-cols-[22rem_minmax(0,1fr)]",
				)}
			>
				{!sidebarCollapsed ? (
					<Surface as="aside" id={sidebarId} className="order-2 p-4 lg:order-1">
						{sidebar}
					</Surface>
				) : null}

				<Surface as="section" className="order-1 p-4 sm:p-6 lg:order-2">
					{main}
				</Surface>
			</div>
		</div>
	);
}
