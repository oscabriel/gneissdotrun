import { Suspense, lazy } from "react";

const RouterDevtools = import.meta.env.DEV
	? lazy(() =>
			import("@tanstack/react-router-devtools").then((module) => ({
				default: module.TanStackRouterDevtools,
			})),
		)
	: null;

const QueryDevtools = import.meta.env.DEV
	? lazy(() =>
			import("@tanstack/react-query-devtools").then((module) => ({
				default: module.ReactQueryDevtools,
			})),
		)
	: null;

export function TanStackDevtools() {
	if (!import.meta.env.DEV || !RouterDevtools || !QueryDevtools) {
		return null;
	}

	return (
		<Suspense fallback={null}>
			<RouterDevtools />
			<QueryDevtools initialIsOpen={false} />
		</Suspense>
	);
}
