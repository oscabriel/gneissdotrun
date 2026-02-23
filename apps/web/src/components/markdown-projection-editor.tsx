import {
	parseProjectionMarkdown,
	type ProjectionInlineSegment,
	type ProjectionLine,
} from "@gneissdotrun/editor-core";
import { forwardRef, useMemo, type ReactNode, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ProjectionTone = "document" | "canvas";

const toneClasses: Record<ProjectionTone, string> = {
	document: "p-4 font-serif text-[15px] leading-7",
	canvas: "p-4 font-mono text-sm leading-relaxed",
};

interface MarkdownProjectionEditorProps extends Omit<
	TextareaHTMLAttributes<HTMLTextAreaElement>,
	"children" | "defaultValue" | "value"
> {
	label: string;
	value: string;
	tone?: ProjectionTone;
}

function renderInlineSegments(segments: ProjectionInlineSegment[], keyPrefix: string): ReactNode[] {
	const nodes: ReactNode[] = [];
	let partIndex = 0;

	for (const segment of segments) {
		switch (segment.kind) {
			case "text": {
				nodes.push(
					<span key={`${keyPrefix}-text-${partIndex++}`} className="text-kumo-default">
						{segment.value}
					</span>,
				);
				break;
			}
			case "strong": {
				nodes.push(
					<span key={`${keyPrefix}-marker-${partIndex++}`} className="text-kumo-subtle/70">
						**
					</span>,
					<strong key={`${keyPrefix}-strong-${partIndex++}`} className="font-semibold">
						{segment.value}
					</strong>,
					<span key={`${keyPrefix}-marker-${partIndex++}`} className="text-kumo-subtle/70">
						**
					</span>,
				);
				break;
			}
			case "emphasis": {
				nodes.push(
					<span key={`${keyPrefix}-marker-${partIndex++}`} className="text-kumo-subtle/70">
						*
					</span>,
					<em key={`${keyPrefix}-em-${partIndex++}`} className="italic">
						{segment.value}
					</em>,
					<span key={`${keyPrefix}-marker-${partIndex++}`} className="text-kumo-subtle/70">
						*
					</span>,
				);
				break;
			}
			case "inline-code": {
				nodes.push(
					<span key={`${keyPrefix}-marker-${partIndex++}`} className="text-kumo-subtle/70">
						`
					</span>,
					<code
						key={`${keyPrefix}-code-${partIndex++}`}
						className="bg-kumo-overlay rounded px-1 py-0.5 font-mono text-sm"
					>
						{segment.value}
					</code>,
					<span key={`${keyPrefix}-marker-${partIndex++}`} className="text-kumo-subtle/70">
						`
					</span>,
				);
				break;
			}
			case "wiki-link": {
				nodes.push(
					<span key={`${keyPrefix}-marker-${partIndex++}`} className="text-kumo-subtle/70">
						[[
					</span>,
					<span
						key={`${keyPrefix}-wikilink-${partIndex++}`}
						className="text-kumo-link underline underline-offset-2"
					>
						{segment.value}
					</span>,
					<span key={`${keyPrefix}-marker-${partIndex++}`} className="text-kumo-subtle/70">
						]]
					</span>,
				);
				break;
			}
			case "link": {
				nodes.push(
					<span key={`${keyPrefix}-marker-${partIndex++}`} className="text-kumo-subtle/70">
						[
					</span>,
					<span
						key={`${keyPrefix}-link-label-${partIndex++}`}
						className="text-kumo-link underline underline-offset-2"
					>
						{segment.label}
					</span>,
					<span key={`${keyPrefix}-marker-${partIndex++}`} className="text-kumo-subtle/70">
						](
					</span>,
					<span key={`${keyPrefix}-link-url-${partIndex++}`} className="text-kumo-subtle">
						{segment.url}
					</span>,
					<span key={`${keyPrefix}-marker-${partIndex++}`} className="text-kumo-subtle/70">
						)
					</span>,
				);
				break;
			}
		}
	}

	return nodes;
}

function renderLine(line: ProjectionLine, index: number): ReactNode {
	const lineKey = `line-${index}`;

	switch (line.kind) {
		case "blank": {
			return (
				<div key={lineKey} className="min-h-7">
					&nbsp;
				</div>
			);
		}
		case "fence": {
			return (
				<div key={lineKey} className="min-h-7 font-mono text-sm">
					<span className="text-kumo-subtle/80">```</span>
				</div>
			);
		}
		case "code": {
			return (
				<div key={lineKey} className="min-h-7 font-mono text-sm">
					{line.value}
				</div>
			);
		}
		case "heading": {
			const headingClass =
				line.level === 1
					? "text-3xl font-semibold"
					: line.level === 2
						? "text-2xl font-semibold"
						: line.level === 3
							? "text-xl font-semibold"
							: "text-lg font-semibold";
			return (
				<div key={lineKey} className={cn("min-h-7", headingClass)}>
					<span className="text-kumo-subtle/70">{line.prefix}</span>
					<span>{line.spacing}</span>
					{renderInlineSegments(line.content, `${lineKey}-heading`)}
				</div>
			);
		}
		case "task": {
			return (
				<div key={lineKey} className="min-h-7">
					<span className="text-kumo-subtle/70">{line.prefix}</span>
					{renderInlineSegments(line.content, `${lineKey}-task`)}
				</div>
			);
		}
		case "unordered": {
			return (
				<div key={lineKey} className="min-h-7">
					<span className="text-kumo-subtle/70">{line.prefix}</span>
					{renderInlineSegments(line.content, `${lineKey}-ul`)}
				</div>
			);
		}
		case "ordered": {
			return (
				<div key={lineKey} className="min-h-7">
					<span className="text-kumo-subtle/70">{line.prefix}</span>
					{renderInlineSegments(line.content, `${lineKey}-ol`)}
				</div>
			);
		}
		case "quote": {
			return (
				<div key={lineKey} className="min-h-7 italic">
					<span className="text-kumo-subtle/70">{line.prefix}</span>
					{renderInlineSegments(line.content, `${lineKey}-quote`)}
				</div>
			);
		}
		case "paragraph": {
			return (
				<div key={lineKey} className="min-h-7">
					{renderInlineSegments(line.content, `${lineKey}-text`)}
				</div>
			);
		}
	}
}

function renderProjection(value: string): ReactNode {
	const projection = parseProjectionMarkdown(value);
	return projection.lines.map((line, index) => renderLine(line, index));
}

export const MarkdownProjectionEditor = forwardRef<
	HTMLTextAreaElement,
	MarkdownProjectionEditorProps
>(function MarkdownProjectionEditor(
	{ label, tone = "document", className, value, onChange, placeholder, style, ...props },
	ref,
) {
	const projection = useMemo(() => renderProjection(value), [value]);
	const hasContent = value.trim().length > 0;

	return (
		<div
			className={cn(
				"border-kumo-line bg-kumo-base text-kumo-default relative w-full rounded-md border",
				toneClasses[tone],
				className,
			)}
		>
			<div aria-hidden className="pointer-events-none break-words whitespace-pre-wrap">
				{hasContent ? projection : <span className="text-kumo-subtle">{placeholder}</span>}
			</div>

			<textarea
				{...props}
				ref={ref}
				aria-label={props["aria-label"] ?? label}
				value={value}
				onChange={onChange}
				placeholder={placeholder}
				className="focus-visible:ring-kumo-line/40 absolute inset-0 w-full resize-none overflow-hidden border-none bg-transparent p-0 break-words whitespace-pre-wrap text-transparent outline-none focus-visible:ring-2"
				style={{
					...style,
					font: "inherit",
					lineHeight: "inherit",
					caretColor: "var(--text-color-kumo-default)",
				}}
			/>
		</div>
	);
});
