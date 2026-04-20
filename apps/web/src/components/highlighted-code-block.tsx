import { useEffect, useState } from "react";

interface HighlightedCodeBlockProps {
	code: string;
	language?: string | null;
	className?: string;
}

export function HighlightedCodeBlock({ code, language, className }: HighlightedCodeBlockProps) {
	const [html, setHtml] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		setHtml(null);

		void import("@/lib/editor/shiki")
			.then((module) => module.highlightCodeToHtml(code, language))
			.then((nextHtml) => {
				if (!cancelled) {
					setHtml(nextHtml);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setHtml(null);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [code, language]);

	if (!html) {
		return (
			<pre className={className}>
				<code>{code}</code>
			</pre>
		);
	}

	return <div className="not-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
