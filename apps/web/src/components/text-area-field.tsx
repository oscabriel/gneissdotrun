import { forwardRef, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type TextAreaTone = "document" | "command" | "canvas";

const toneClasses: Record<TextAreaTone, string> = {
	document: "min-h-90 p-4 font-serif text-[15px] leading-7",
	command: "min-h-28 font-mono text-sm leading-relaxed",
	canvas: "min-h-40 p-4 font-mono text-sm leading-relaxed",
};

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
	label: string;
	tone?: TextAreaTone;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
	function TextAreaField({ label, tone = "command", className, ...props }, ref) {
		return (
			<textarea
				{...props}
				ref={ref}
				aria-label={props["aria-label"] ?? label}
				className={cn(
					"border-kumo-line bg-kumo-base text-kumo-default focus-visible:border-kumo-line focus-visible:ring-kumo-line/40 w-full rounded-md border p-3 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
					toneClasses[tone],
					className,
				)}
			/>
		);
	},
);
