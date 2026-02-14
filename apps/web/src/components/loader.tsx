import { Loader as KumoLoader } from "@cloudflare/kumo";

export default function Loader() {
	return (
		<div className="flex h-full items-center justify-center pt-8">
			<KumoLoader size="base" />
		</div>
	);
}
