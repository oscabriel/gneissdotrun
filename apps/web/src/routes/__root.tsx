import type { ReactNode } from "react";
import type { QueryClient } from "@tanstack/react-query";

import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";

import { NotFound } from "@/components/router/not-found";
import { TanStackDevtools } from "@/components/router/tanstack-devtools";
import type { orpc } from "@/utils/orpc";
import appCss from "../index.css?url";

const KUMO_THEME_SCRIPT = `(function () {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const stored = localStorage.getItem("theme");
  const hasExplicitPreference = stored === "light" || stored === "dark";

  const applySystemTheme = function () {
    document.documentElement.setAttribute("data-mode", media.matches ? "dark" : "light");
  };

  if (hasExplicitPreference) {
    document.documentElement.setAttribute("data-mode", stored);
    return;
  }

  applySystemTheme();

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", applySystemTheme);
  }
})();`;

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
				rel: "preconnect",
				href: "https://fonts.googleapis.com",
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap",
			},
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	notFoundComponent: NotFound,
	component: RootComponent,
});

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
			<TanStackDevtools />
		</RootDocument>
	);
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: KUMO_THEME_SCRIPT }} />
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
