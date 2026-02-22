import assert from "node:assert/strict";
import { describe, it, mock } from "bun:test";
import { Hono } from "hono";
import { cors } from "hono/cors";

mock.module("agents", () => ({
	Agent: class Agent {},
	callable: () => (target: unknown) => target,
	getAgentByName: async <T>(
		namespace: { idFromName: (name: string) => string; get: (id: string) => T },
		name: string,
	): Promise<T> => {
		const id = namespace.idFromName(name);
		return namespace.get(id);
	},
	routeAgentRequest: async () => null,
}));

const { registerAgentRoutes } = await import("./agents-routing");

type RouteHandler = (
	request: Request,
	env: Env,
	options?: { prefix?: string },
) => Promise<Response | null | undefined>;

function createRoutingApp(routeHandler: RouteHandler) {
	const app = new Hono<{ Bindings: Env }>();
	app.use(
		"/*",
		cors({
			origin: "https://web.gneiss.local",
			allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
			allowHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		}),
	);
	registerAgentRoutes(app, routeHandler);

	return app;
}

describe("/agents routing contract", () => {
	it("routes websocket upgrades through the canonical handler", async () => {
		const requests: Request[] = [];
		const app = createRoutingApp(async (request) => {
			requests.push(request);
			if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
				return new Response(null, { status: 101 });
			}

			return null;
		});

		const response = await app.fetch(
			new Request("https://server.local/agents/rewrite-agent/note-1", {
				method: "GET",
				headers: {
					upgrade: "websocket",
				},
			}),
			{} as Env,
		);

		assert.equal(response.status, 101);
		assert.equal(requests.length, 1);
		const firstRequest = requests[0];
		assert.ok(firstRequest);
		assert.equal(new URL(firstRequest.url).pathname, "/agents/rewrite-agent/note-1");
	});

	it("returns explicit 404 for plain HTTP /agents requests", async () => {
		const app = createRoutingApp(async () => null);

		const response = await app.fetch(
			new Request("https://server.local/agents/rewrite-agent/note-1", {
				method: "GET",
			}),
			{} as Env,
		);

		assert.equal(response.status, 404);
		assert.deepEqual(await response.json(), { error: "Agent route not found" });
	});

	it("preserves CORS preflight behavior for cross-domain clients", async () => {
		let called = false;
		const app = createRoutingApp(async () => {
			called = true;
			return null;
		});

		const response = await app.fetch(
			new Request("https://server.local/agents/rewrite-agent/note-1", {
				method: "OPTIONS",
				headers: {
					origin: "https://web.gneiss.local",
					"access-control-request-method": "POST",
					"access-control-request-headers": "content-type,authorization",
				},
			}),
			{} as Env,
		);

		assert.equal(response.status, 204);
		assert.equal(response.headers.get("access-control-allow-origin"), "https://web.gneiss.local");
		assert.equal(called, false);
	});
});
