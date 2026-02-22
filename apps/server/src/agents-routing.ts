import { routeAgentRequest, type AgentOptions } from "agents";
import type { Hono } from "hono";

export type AgentRouteHandler = (
	request: Request,
	env: Env,
	options?: AgentOptions<Env>,
) => Promise<Response | null | undefined>;

export function registerAgentRoutes(
	app: Hono<{ Bindings: Env }>,
	routeHandler: AgentRouteHandler = routeAgentRequest,
): void {
	app.all("/agents/*", async (c) => {
		const response = await routeHandler(c.req.raw, c.env, {
			prefix: "agents",
		});

		if (response) {
			return response;
		}

		return c.json({ error: "Agent route not found" }, 404);
	});
}
