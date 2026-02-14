import { useNavigate } from "@tanstack/react-router";
import { Button, DropdownMenu, Loader } from "@cloudflare/kumo";
import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return (
			<div className="flex h-9 w-24 items-center justify-center">
				<Loader size="sm" />
			</div>
		);
	}

	if (!session) {
		return <Button variant="outline">Sign In</Button>;
	}

	return (
		<DropdownMenu>
			<DropdownMenu.Trigger render={<Button variant="outline" />}>
				{session.user.name}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content>
				<DropdownMenu.Group>
					<DropdownMenu.Label>My Account</DropdownMenu.Label>
					<DropdownMenu.Separator />
					<DropdownMenu.Item>{session.user.email}</DropdownMenu.Item>
					<DropdownMenu.Item
						variant="danger"
						onClick={() => {
							authClient.signOut({
								fetchOptions: {
									onSuccess: () => {
										navigate({
											to: "/",
										});
									},
								},
							});
						}}
					>
						Sign Out
					</DropdownMenu.Item>
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</DropdownMenu>
	);
}
