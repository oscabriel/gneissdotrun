function fnv1a64(input: string): string {
	let hash = 0xcbf29ce484222325n;
	const prime = 0x100000001b3n;
	const mask = 0xffffffffffffffffn;

	for (let index = 0; index < input.length; index += 1) {
		hash ^= BigInt(input.charCodeAt(index));
		hash = (hash * prime) & mask;
	}

	return hash.toString(36);
}
export function createId(prefix: string): string {
	return `${prefix}_${crypto.randomUUID()}`;
}

export function createStableId(prefix: string, seed: string): string {
	const normalizedSeed = seed.trim().toLowerCase();
	return `${prefix}_${fnv1a64(normalizedSeed)}`;
}
