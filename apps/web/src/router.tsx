import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { Toasty, useKumoToastManager } from "@cloudflare/kumo";
import { useEffect } from "react";

import "./index.css";
import { DefaultCatchBoundary } from "./components/router/default-catch-boundary";
import Loader from "./components/loader";
import { bindToastManager } from "./lib/toast";
import { routeTree } from "./routeTree.gen";
import { createQueryClient, orpc } from "./utils/orpc";

function ToastManagerBridge() {
	const manager = useKumoToastManager();

	useEffect(() => {
		bindToastManager(manager);
		return () => {
			bindToastManager(null);
		};
	}, [manager]);

	return null;
}

export const getRouter = () => {
	const queryClient = createQueryClient();
	const router = createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		context: { orpc, queryClient },
		defaultPendingComponent: Loader,
		defaultErrorComponent: DefaultCatchBoundary,
		Wrap: ({ children }) => (
			<Toasty>
				<ToastManagerBridge />
				{children}
			</Toasty>
		),
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient,
	});

	return router;
};

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
