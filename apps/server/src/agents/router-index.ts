import type { RoutingDecision } from "./shared";

const ROUTER_INDEX_PREFIX = "router:index:";

export class RouterIndexCache {
	constructor(private readonly kv: KVNamespace) {}

	private key(input: string): string {
		return `${ROUTER_INDEX_PREFIX}${input}`;
	}

	async get(input: string): Promise<RoutingDecision | null> {
		const raw = await this.kv.get(this.key(input));
		if (!raw) {
			return null;
		}

		try {
			return JSON.parse(raw) as RoutingDecision;
		} catch {
			return null;
		}
	}

	async put(input: string, decision: RoutingDecision, ttlSeconds = 300): Promise<void> {
		await this.kv.put(this.key(input), JSON.stringify(decision), {
			expirationTtl: ttlSeconds,
		});
	}
}
