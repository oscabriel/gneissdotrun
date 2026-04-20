import { useQueryClient } from "@tanstack/react-query";
import { Button, buttonVariants } from "@cloudflare/kumo";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import { ensureSessionQueryData, invalidateSessionQuery } from "@/lib/queries/session";

export const Route = createFileRoute("/_protected/profile")({
	loader: async ({ context }) => {
		const session = await ensureSessionQueryData(context.queryClient);

		if (!session) {
			throw redirect({
				to: "/",
			});
		}

		return session;
	},
	component: ProfileRoute,
});

function ProfileRoute() {
	const session = Route.useLoaderData();
	const queryClient = useQueryClient();
	const router = useRouter();

	const refreshAuthState = async () => {
		await invalidateSessionQuery(queryClient);
		await router.invalidate({ sync: true });
	};

	return (
		<div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 px-4 py-6">
			<header className="border-border flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
						Account
					</p>
					<h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
					<p className="text-muted-foreground mt-1 text-sm">
						Review your account details and sign out of the workspace.
					</p>
				</div>
				<Link to="/" className={buttonVariants({ variant: "outline" })}>
					Back to workspace
				</Link>
			</header>

			<section className="border-border bg-card space-y-4 border p-4">
				<p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
					Profile info
				</p>
				<div className="grid gap-3 text-sm">
					<div className="border-border bg-background rounded-md border px-3 py-2">
						<p className="text-muted-foreground text-xs">Name</p>
						<p>{session.user.name || "Not set"}</p>
					</div>
					<div className="border-border bg-background rounded-md border px-3 py-2">
						<p className="text-muted-foreground text-xs">Email</p>
						<p>{session.user.email}</p>
					</div>
					<div className="border-border bg-background rounded-md border px-3 py-2">
						<p className="text-muted-foreground text-xs">User ID</p>
						<p className="font-mono text-xs break-all">{session.user.id}</p>
					</div>
				</div>
			</section>

			<section className="border-border bg-card space-y-3 border p-4">
				<p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
					Session
				</p>
				<p className="text-muted-foreground text-sm">Need to switch accounts? Sign out below.</p>
				<Button
					variant="destructive"
					onClick={() => {
						authClient.signOut({
							fetchOptions: {
								onSuccess: () => {
									void refreshAuthState();
								},
							},
						});
					}}
				>
					Sign out
				</Button>
			</section>
		</div>
	);
}
