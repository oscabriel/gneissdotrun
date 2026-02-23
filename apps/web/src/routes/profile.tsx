import { Button } from "@cloudflare/kumo";
import { createFileRoute } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/profile")({
	component: ProfileRoute,
});

function ProfileRoute() {
	const { data: session, isPending } = authClient.useSession();
	const navigate = Route.useNavigate();

	if (isPending) {
		return (
			<div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4">
				<p className="text-muted-foreground text-sm">Loading session...</p>
			</div>
		);
	}

	if (!session) {
		return (
			<div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-3 px-4">
				<p className="text-muted-foreground text-sm">Sign in to view your profile.</p>
				<a href="/" className="underline">
					Back to home
				</a>
			</div>
		);
	}

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
				<a href="/">
					<Button variant="outline">Back to workspace</Button>
				</a>
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
									void navigate({ to: "/" });
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
