import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { Toasty, useKumoToastManager } from "@cloudflare/kumo";
import { useEffect } from "react";

import "./index.css";
import Loader from "./components/loader";
import { bindToastManager } from "./lib/toast";
import { routeTree } from "./routeTree.gen";
import { orpc, queryClient } from "./utils/orpc";

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
	const router = createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreloadStaleTime: 0,
		context: { orpc, queryClient },
		defaultPendingComponent: () => <Loader />,
		defaultNotFoundComponent: () => <div>Not Found</div>,
		Wrap: ({ children }) => (
			<QueryClientProvider client={queryClient}>
				<Toasty>
					<ToastManagerBridge />
					{children}
				</Toasty>
			</QueryClientProvider>
		),
	});
	return router;
};

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
