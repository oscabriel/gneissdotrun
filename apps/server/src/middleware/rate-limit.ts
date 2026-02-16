import { auth } from "@gneissdotrun/auth";
import type { Context, MiddlewareHandler } from "hono";

interface RateLimitBucket {
	count: number;
}

interface RateLimitMiddlewareOptions {
	bucket: string;
	maxRequests: number;
	windowSeconds: number;
	responseKind: "capture" | "generic";
	message: string;
}

const RATE_LIMIT_PREFIX = "rate_limit";
const MIN_KV_TTL_SECONDS = 60;

function resolveClientIp(request: Request): string {
	const direct = request.headers.get("cf-connecting-ip")?.trim();
	if (direct) {
		return direct;
	}

	const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	if (forwarded) {
		return forwarded;
	}

	return "unknown";
}

async function resolvePrincipal(request: Request): Promise<string> {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});
		if (session?.user?.id) {
			return `user:${session.user.id}`;
		}
	} catch {
		// Fall through to IP-based limiting.
	}

	return `ip:${resolveClientIp(request)}`;
}

function ttlUntilBucketReset(windowSeconds: number, nowMs: number): number {
	const windowMs = windowSeconds * 1000;
	const nextBoundary = Math.floor(nowMs / windowMs + 1) * windowMs;
	const remainingMs = Math.max(1_000, nextBoundary - nowMs);
	return Math.ceil(remainingMs / 1000);
}

function tooManyRequestsResponse(
	c: Context<{ Bindings: Env }>,
	options: RateLimitMiddlewareOptions,
	retryAfterSeconds: number,
) {
	c.header("Retry-After", String(retryAfterSeconds));
	if (options.responseKind === "capture") {
		return c.json(
			{
				error: {
					code: "RATE_LIMITED",
					message: options.message,
					recoverable: true,
				},
			},
			429,
		);
	}

	return c.json(
		{
			error: options.message,
		},
		429,
	);
}

export function rateLimitMiddleware(
	options: RateLimitMiddlewareOptions,
): MiddlewareHandler<{ Bindings: Env }> {
	return async (c, next) => {
		if (c.req.method === "OPTIONS") {
			await next();
			return;
		}

		const now = Date.now();
		const windowMs = options.windowSeconds * 1000;
		const bucketIndex = Math.floor(now / windowMs);
		const principal = await resolvePrincipal(c.req.raw);
		const rateLimitKey = `${RATE_LIMIT_PREFIX}:${options.bucket}:${principal}:${bucketIndex}`;
		const retryAfterSeconds = ttlUntilBucketReset(options.windowSeconds, now);
		const storageTtlSeconds = Math.max(MIN_KV_TTL_SECONDS, options.windowSeconds);

		try {
			const existing = await c.env.KV.get<RateLimitBucket>(rateLimitKey, "json");
			const nextCount = (existing?.count ?? 0) + 1;

			await c.env.KV.put(
				rateLimitKey,
				JSON.stringify({
					count: nextCount,
				}),
				{ expirationTtl: storageTtlSeconds },
			);

			if (nextCount > options.maxRequests) {
				return tooManyRequestsResponse(c, options, retryAfterSeconds);
			}
		} catch (error) {
			console.error("rate_limit.failed", {
				bucket: options.bucket,
				error,
			});
		}

		await next();
	};
}
