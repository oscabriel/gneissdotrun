import { createFileRoute, redirect } from "@tanstack/react-router";

import { ensureSessionQueryData } from "@/lib/queries/session";

export const Route = createFileRoute("/_protected")({
	beforeLoad: async ({ context }) => {
		const session = await ensureSessionQueryData(context.queryClient);

		if (!session) {
			throw redirect({
				to: "/",
			});
		}

		return {
			session,
		};
	},
});
