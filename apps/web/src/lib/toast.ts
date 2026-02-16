import type { ButtonProps } from "@cloudflare/kumo";

type ToastAction = {
	label: string;
	onClick: () => void;
};

type ToastOptions = {
	description?: string;
	action?: ToastAction;
};

type ToastManagerLike = {
	add: (options: {
		title?: string;
		description?: string;
		variant?: "default" | "error" | "warning";
		actions?: ButtonProps[];
	}) => string;
};

let manager: ToastManagerLike | null = null;

export function bindToastManager(nextManager: ToastManagerLike | null) {
	manager = nextManager;
}

function notify(variant: "default" | "error" | "warning", title: string, options?: ToastOptions) {
	if (!manager) {
		return;
	}

	const actions = options?.action
		? ([
				{
					children: options.action.label,
					onClick: options.action.onClick,
					variant: "secondary",
					size: "sm",
				},
			] satisfies ButtonProps[])
		: undefined;

	manager.add({
		title,
		description: options?.description,
		variant,
		actions,
	});
}

export const toast = {
	success(title: string, options?: ToastOptions) {
		notify("default", title, options);
	},
	error(title: string, options?: ToastOptions) {
		notify("error", title, options);
	},
	warning(title: string, options?: ToastOptions) {
		notify("warning", title, options);
	},
};
