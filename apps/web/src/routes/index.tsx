import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

const TITLE_TEXT = `
 ██████╗ ███╗   ██╗███████╗██╗███████╗███████╗   ██████╗ ██╗   ██╗███╗   ██╗
██╔════╝ ████╗  ██║██╔════╝██║██╔════╝██╔════╝   ██╔══██╗██║   ██║████╗  ██║
██║  ███╗██╔██╗ ██║█████╗  ██║███████╗███████╗   ██████╔╝██║   ██║██╔██╗ ██║
██║   ██║██║╚██╗██║██╔══╝  ██║╚════██║╚════██║   ██╔══██╗██║   ██║██║╚██╗██║
╚██████╔╝██║ ╚████║███████╗██║███████║███████║██╗██║  ██║╚██████╔╝██║ ╚████║
 ╚═════╝ ╚═╝  ╚═══╝╚══════╝╚═╝╚══════╝╚══════╝╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
`;

function HomeComponent() {
	return (
		<div className="container mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-4 text-center">
			<pre className="mb-6 overflow-x-auto font-mono text-lg sm:text-xl">{TITLE_TEXT}</pre>
			<p className="mb-4 font-mono text-sm text-muted-foreground">/naɪs dɑt rʌn/</p>
			<p className="text-lg font-medium uppercase tracking-[0.35em] text-muted-foreground mt-2">
				THINK MORE SORT LESS
			</p>
			<p className="text-lg font-medium italic text-muted-foreground mt-32">
				Coming soon.
			</p>
		</div>
	);
}
