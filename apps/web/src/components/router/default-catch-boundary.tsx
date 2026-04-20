import { Button } from "@cloudflare/kumo";
import { ErrorComponent, Link, type ErrorComponentProps, useRouter } from "@tanstack/react-router";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
	const router = useRouter();

	return (
		<div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-4 py-12">
			<div className="space-y-2">
				<p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
					Application error
				</p>
				<h1 className="text-3xl font-semibold tracking-tight">Something went wrong.</h1>
				<p className="text-muted-foreground text-sm">
					This route failed to load. Retry it or head back to the workspace.
				</p>
			</div>

			<div className="border-kumo-line bg-kumo-base rounded-md border p-4">
				<ErrorComponent error={error} />
			</div>

			<div className="flex flex-wrap gap-3">
				<Button
					onClick={() => {
						void router.invalidate();
					}}
				>
					Try again
				</Button>
				<Link
					to="/"
					className="border-kumo-line bg-kumo-base text-kumo-default inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
				>
					Go home
				</Link>
			</div>
		</div>
	);
}
