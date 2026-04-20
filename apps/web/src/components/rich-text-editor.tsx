import { Suspense, forwardRef, lazy } from "react";

import { cn } from "@/lib/utils";

const LazyRichTextEditorImpl = lazy(async () => {
	const module = await import("@/components/rich-text-editor-impl");
	return { default: module.RichTextEditorImpl };
});

export interface RichTextEditorHandle {
	focus: () => void;
}

export interface RichTextEditorProps {
	label: string;
	value: string;
	placeholder?: string;
	className?: string;
	autoFocus?: boolean;
	onChangeMarkdown: (value: string) => void;
	onBlur?: () => void;
	onRunShortcut?: () => void;
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
	function RichTextEditor(props, ref) {
		const { className, placeholder } = props;
		return (
			<Suspense
				fallback={
					<div className={cn("rich-text-editor bg-kumo-base min-h-40 p-4", className)}>
						{placeholder ?? "Loading editor..."}
					</div>
				}
			>
				<LazyRichTextEditorImpl ref={ref} {...props} />
			</Suspense>
		);
	},
);
