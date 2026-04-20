import { Button, Dialog, Input } from "@cloudflare/kumo";
import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";

export function TextPromptDialog({
	open,
	onOpenChange,
	title,
	description,
	label,
	defaultValue,
	placeholder,
	confirmLabel,
	onSubmit,
	confirmVariant = "primary",
	required = false,
	maxLength,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	label: string;
	defaultValue: string;
	placeholder?: string;
	confirmLabel: string;
	onSubmit: (value: string) => Promise<void> | void;
	confirmVariant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
	required?: boolean;
	maxLength?: number;
}) {
	const [value, setValue] = useState(defaultValue);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (open) {
			setValue(defaultValue);
			setError(null);
			setIsSubmitting(false);
		}
	}, [defaultValue, open]);

	const submit = async () => {
		const trimmed = value.trim();
		if (required && trimmed.length === 0) {
			setError(`${label} is required.`);
			return;
		}

		if (maxLength && trimmed.length > maxLength) {
			setError(`${label} must be ${maxLength} characters or fewer.`);
			return;
		}

		setError(null);
		setIsSubmitting(true);
		try {
			await onSubmit(value);
			onOpenChange(false);
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : `Failed to save ${label}.`);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog size="sm" className="space-y-4 p-6">
				<Dialog.Title className="text-kumo-default text-base font-semibold">{title}</Dialog.Title>
				{description ? (
					<Dialog.Description className="text-kumo-subtle text-sm leading-6">
						{description}
					</Dialog.Description>
				) : null}
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void submit();
					}}
					className="space-y-4"
				>
					<Input
						label={label}
						className="w-full"
						value={value}
						placeholder={placeholder}
						error={error ?? undefined}
						variant={error ? "error" : "default"}
						autoFocus
						onChange={(event: ChangeEvent<HTMLInputElement>) => {
							setValue(event.target.value);
							if (error) {
								setError(null);
							}
						}}
					/>
					<div className="flex justify-end gap-2">
						<Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
							Cancel
						</Button>
						<Button type="submit" variant={confirmVariant} disabled={isSubmitting}>
							{isSubmitting ? "Working..." : confirmLabel}
						</Button>
					</div>
				</form>
			</Dialog>
		</Dialog.Root>
	);
}
