import {
	Children,
	type ComponentProps,
	type ComponentPropsWithoutRef,
	type ReactElement,
	type ReactNode,
	isValidElement,
} from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { HighlightedCodeBlock } from "@/components/highlighted-code-block";
import { detectCodeLanguage } from "@/lib/editor/code-language";
import { cn } from "@/lib/utils";

interface MarkdownPreviewProps {
	markdown: string;
	className?: string;
	emptyFallback?: string;
}

function isTaskListCheckbox(
	child: ReactNode,
): child is ReactElement<ComponentPropsWithoutRef<"input">> {
	if (!isValidElement(child)) {
		return false;
	}

	return (child.props as ComponentPropsWithoutRef<"input">).type === "checkbox";
}

function hasTaskListItemMarker(child: ReactNode): boolean {
	if (!isValidElement(child)) {
		return false;
	}

	const props = child.props as { children?: ReactNode; className?: string };
	return (
		props.className?.includes("task-list-item") === true ||
		Children.toArray(props.children).some((nestedChild) => isTaskListCheckbox(nestedChild))
	);
}

function MarkdownPreviewUnorderedList({ children, ...props }: ComponentPropsWithoutRef<"ul">) {
	const childArray = Children.toArray(children);

	return (
		<ul {...props} data-task-list={childArray.some(hasTaskListItemMarker) ? "true" : undefined}>
			{childArray}
		</ul>
	);
}

function MarkdownPreviewOrderedList({ children, ...props }: ComponentPropsWithoutRef<"ol">) {
	const childArray = Children.toArray(children);

	return (
		<ol {...props} data-task-list={childArray.some(hasTaskListItemMarker) ? "true" : undefined}>
			{childArray}
		</ol>
	);
}

function MarkdownPreviewInput(props: ComponentPropsWithoutRef<"input">) {
	if (props.type !== "checkbox") {
		return <input {...props} />;
	}

	return (
		<input
			{...props}
			checked={Boolean(props.checked)}
			disabled
			readOnly
			tabIndex={-1}
			aria-hidden="true"
			data-task-list-checkbox="true"
		/>
	);
}

function MarkdownPreviewListItem({ children, ...props }: ComponentPropsWithoutRef<"li">) {
	const childArray = Children.toArray(children);
	const checkboxIndex = childArray.findIndex((child) => isTaskListCheckbox(child));

	if (checkboxIndex < 0) {
		return <li {...props}>{children}</li>;
	}

	const checkbox = childArray[checkboxIndex];
	const content = childArray.filter(
		(child, index) =>
			index !== checkboxIndex && !(typeof child === "string" && child.trim().length === 0),
	);
	if (!isTaskListCheckbox(checkbox)) {
		return <li {...props}>{children}</li>;
	}

	return (
		<li {...props} data-task-list-item="true">
			<MarkdownPreviewInput {...checkbox.props} />
			<div data-task-list-content="true">{content}</div>
		</li>
	);
}

const markdownComponents = {
	ul: MarkdownPreviewUnorderedList,
	ol: MarkdownPreviewOrderedList,
	li: MarkdownPreviewListItem,
	input: MarkdownPreviewInput,
	pre: function MarkdownPreviewPre({ children }: ComponentPropsWithoutRef<"pre">) {
		return <>{children}</>;
	},
	code: function MarkdownPreviewCode({
		className,
		children,
		...props
	}: ComponentPropsWithoutRef<"code">) {
		const code = String(children ?? "").replace(/\n$/, "");
		const language = detectCodeLanguage(className);
		const isInline = !language && !code.includes("\n");

		if (isInline) {
			return (
				<code className={className} {...props}>
					{children}
				</code>
			);
		}

		return <HighlightedCodeBlock code={code} language={language} className={className} />;
	},
} satisfies ComponentProps<typeof ReactMarkdown>["components"];

export function MarkdownPreview({
	markdown,
	className,
	emptyFallback = "_Nothing to preview yet._",
}: MarkdownPreviewProps) {
	return (
		<article className={cn("prose prose-neutral text-kumo-default max-w-none", className)}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[rehypeSanitize]}
				components={markdownComponents}
			>
				{markdown.trim().length > 0 ? markdown : emptyFallback}
			</ReactMarkdown>
		</article>
	);
}
