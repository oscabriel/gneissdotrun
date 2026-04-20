import { layout, layoutNextLine, prepare, prepareWithSegments } from "@chenglou/pretext";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const fallbackClampStyle = {
	WebkitBoxOrient: "vertical",
	WebkitLineClamp: 1,
	display: "-webkit-box",
	overflow: "hidden",
} as const;

const graphemeSegmenter =
	typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
		? new Intl.Segmenter(undefined, { granularity: "grapheme" })
		: null;

const preparedTextCache = new Map<string, ReturnType<typeof prepare>>();
const preparedSegmentsCache = new Map<string, ReturnType<typeof prepareWithSegments>>();

function buildCacheKey(text: string, font: string): string {
	return `${font}\n${text}`;
}

function getPreparedText(text: string, font: string) {
	const key = buildCacheKey(text, font);
	const cached = preparedTextCache.get(key);
	if (cached) {
		return cached;
	}

	const preparedText = prepare(text, font);
	preparedTextCache.set(key, preparedText);
	return preparedText;
}

function getPreparedSegments(text: string, font: string) {
	const key = buildCacheKey(text, font);
	const cached = preparedSegmentsCache.get(key);
	if (cached) {
		return cached;
	}

	const preparedText = prepareWithSegments(text, font);
	preparedSegmentsCache.set(key, preparedText);
	return preparedText;
}

function fitEllipsis(text: string, font: string, maxWidth: number, lineHeight: number): string {
	const trimmed = text.trimEnd();
	if (trimmed.length === 0) {
		return "...";
	}

	const graphemes = graphemeSegmenter
		? Array.from(graphemeSegmenter.segment(trimmed), (segment) => segment.segment)
		: Array.from(trimmed);

	let low = 0;
	let high = graphemes.length;
	let best = "...";

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const candidatePrefix = graphemes.slice(0, mid).join("").trimEnd();
		const candidate = `${candidatePrefix}...`;
		const preparedText = getPreparedText(candidate, font);
		const fits = layout(preparedText, maxWidth, lineHeight).lineCount <= 1;

		if (fits) {
			best = candidate;
			low = mid + 1;
			continue;
		}

		high = mid - 1;
	}

	return best;
}

function measurePreviewLines(
	text: string,
	font: string,
	maxWidth: number,
	lineHeight: number,
	maxLines: number,
): { lines: string[]; truncated: boolean } {
	if (maxWidth <= 0 || maxLines <= 0) {
		return { lines: [], truncated: false };
	}

	const preparedText = getPreparedSegments(text, font);
	const visibleLines: string[] = [];
	let cursor = { segmentIndex: 0, graphemeIndex: 0 };
	let truncated = false;

	for (let index = 0; index < maxLines; index += 1) {
		const line = layoutNextLine(preparedText, cursor, maxWidth);
		if (!line) {
			return { lines: visibleLines, truncated: false };
		}

		visibleLines.push(line.text.trimEnd());
		cursor = line.end;
	}

	const overflowLine = layoutNextLine(preparedText, cursor, maxWidth);
	if (overflowLine) {
		truncated = true;
	}

	if (truncated && visibleLines.length > 0) {
		visibleLines[visibleLines.length - 1] = fitEllipsis(
			visibleLines[visibleLines.length - 1] ?? "",
			font,
			maxWidth,
			lineHeight,
		);
	}

	return { lines: visibleLines, truncated };
}

export interface NotePreviewLinesProps {
	text: string;
	font: string;
	lineHeight: number;
	maxLines: number;
	className?: string;
	lineClassName?: string;
	emptyFallback?: string;
}

export function NotePreviewLines({
	text,
	font,
	lineHeight,
	maxLines,
	className,
	lineClassName,
	emptyFallback = "Nothing here yet.",
}: NotePreviewLinesProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [width, setWidth] = useState(0);
	const [measuredLines, setMeasuredLines] = useState<string[] | null>(null);

	const content = text.trim().length > 0 ? text : emptyFallback;

	useEffect(() => {
		const element = containerRef.current;
		if (!element) {
			return;
		}

		const updateWidth = (nextWidth: number) => {
			setWidth((currentWidth) => (Math.abs(currentWidth - nextWidth) < 1 ? currentWidth : nextWidth));
		};

		updateWidth(element.clientWidth);

		if (typeof ResizeObserver !== "function") {
			return;
		}

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) {
				return;
			}

			updateWidth(entry.contentRect.width);
		});

		observer.observe(element);
		return () => {
			observer.disconnect();
		};
	}, []);

	useEffect(() => {
		let cancelled = false;
		setMeasuredLines(null);

		async function measure(): Promise<void> {
			if (width <= 0) {
				return;
			}

			if (typeof document !== "undefined" && "fonts" in document) {
				await document.fonts.ready;
			}

			if (cancelled) {
				return;
			}

			const nextLines = measurePreviewLines(content, font, width, lineHeight, maxLines).lines;
			if (!cancelled) {
				setMeasuredLines(nextLines);
			}
		}

		void measure();

		return () => {
			cancelled = true;
		};
	}, [content, font, lineHeight, maxLines, width]);

	return (
		<div ref={containerRef} className={className} aria-label={content}>
			{measuredLines ? (
				measuredLines.map((line, index) => (
					<span key={`${index}-${line}`} className={cn("block", lineClassName)}>
						{line}
					</span>
				))
			) : (
				<span
					className={cn("block", lineClassName)}
					style={{
						...fallbackClampStyle,
						WebkitLineClamp: maxLines,
					}}
				>
					{content}
				</span>
			)}
		</div>
	);
}
