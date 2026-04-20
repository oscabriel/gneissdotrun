import { Button, Dialog } from "@cloudflare/kumo";
import { useEffect, useState } from "react";

export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel,
	onConfirm,
	confirmVariant = "destructive",
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	confirmLabel: string;
	onConfirm: () => Promise<void> | void;
	confirmVariant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
}) {
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (!open) {
			setIsSubmitting(false);
		}
	}, [open]);

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog size="sm" className="space-y-4 p-6">
				<Dialog.Title className="text-kumo-default text-base font-semibold">{title}</Dialog.Title>
				{description ? (
					<Dialog.Description className="text-kumo-subtle text-sm leading-6">
						{description}
					</Dialog.Description>
				) : null}
				<div className="flex justify-end gap-2">
					<Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button
						variant={confirmVariant}
						disabled={isSubmitting}
						onClick={() => {
							void (async () => {
								setIsSubmitting(true);
								try {
									await onConfirm();
									onOpenChange(false);
								} finally {
									setIsSubmitting(false);
								}
							})();
						}}
					>
						{isSubmitting ? "Working..." : confirmLabel}
					</Button>
				</div>
			</Dialog>
		</Dialog.Root>
	);
}
