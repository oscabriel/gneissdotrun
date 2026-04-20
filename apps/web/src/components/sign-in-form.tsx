import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Button, Input, Surface } from "@cloudflare/kumo";
import type { ChangeEvent } from "react";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { invalidateSessionQuery } from "@/lib/queries/session";
import { toast } from "@/lib/toast";

export default function SignInForm({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
	const queryClient = useQueryClient();
	const router = useRouter();

	const refreshAuthState = async () => {
		await invalidateSessionQuery(queryClient);
		await router.invalidate({ sync: true });
	};

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{
					email: value.email,
					password: value.password,
				},
				{
					onSuccess: () => {
						toast.success("Sign in successful");
						void refreshAuthState();
					},
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
				},
			);
		},
		validators: {
			onSubmit: z.object({
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	return (
		<Surface className="mx-auto mt-10 w-full max-w-md p-6">
			<h1 className="mb-6 text-center text-3xl font-semibold">Welcome Back</h1>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				className="space-y-4"
			>
				<div>
					<form.Field name="email">
						{(field) => {
							const errorMessage = field.state.meta.errors[0]?.message;
							const inputError = typeof errorMessage === "string" ? errorMessage : undefined;

							return (
								<div className="space-y-2">
									<Input
										id={field.name}
										label="Email"
										className="w-full"
										name={field.name}
										type="email"
										variant={inputError ? "error" : "default"}
										error={inputError}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											field.handleChange(event.target.value)
										}
									/>
								</div>
							);
						}}
					</form.Field>
				</div>

				<div>
					<form.Field name="password">
						{(field) => {
							const errorMessage = field.state.meta.errors[0]?.message;
							const inputError = typeof errorMessage === "string" ? errorMessage : undefined;

							return (
								<div className="space-y-2">
									<Input
										id={field.name}
										label="Password"
										className="w-full"
										name={field.name}
										type="password"
										variant={inputError ? "error" : "default"}
										error={inputError}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											field.handleChange(event.target.value)
										}
									/>
								</div>
							);
						}}
					</form.Field>
				</div>

				<form.Subscribe>
					{(state) => (
						<Button
							variant="secondary"
							type="submit"
							className="w-full"
							disabled={!state.canSubmit || state.isSubmitting}
						>
							{state.isSubmitting ? "Submitting..." : "Sign In"}
						</Button>
					)}
				</form.Subscribe>
			</form>

			<div className="mt-4 text-center">
				<Button variant="outline" onClick={onSwitchToSignUp}>
					Need an account? Sign Up
				</Button>
			</div>
		</Surface>
	);
}
