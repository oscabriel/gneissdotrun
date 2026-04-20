import { Link } from "@tanstack/react-router";

export function NotFound() {
	return (
		<div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-4 px-4 py-12">
			<p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
				Page missing
			</p>
			<h1 className="text-3xl font-semibold tracking-tight">That page does not exist.</h1>
			<p className="text-muted-foreground max-w-xl text-sm">
				The route could not be matched. Head back to the workspace and keep navigating from there.
			</p>
			<div>
				<Link
					to="/"
					className="border-kumo-line bg-kumo-base text-kumo-default inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
				>
					Back home
				</Link>
			</div>
		</div>
	);
}
