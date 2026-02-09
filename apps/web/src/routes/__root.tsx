import type { QueryClient } from "@tanstack/react-query";

import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";

import type { orpc } from "@/utils/orpc";
import appCss from "../index.css?url";
export interface RouterAppContext {
	orpc: typeof orpc;
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
		head: () => ({
			meta: [
				{
					charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
				{
					title: "GNEISS.RUN",
				},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),

	component: RootDocument,
});

function RootDocument() {
	return (
		<html lang="en" className="dark">
			<head>
				<HeadContent />
			</head>
			<body>
				<Outlet />
				<Scripts />
			</body>
		</html>
	);
}
