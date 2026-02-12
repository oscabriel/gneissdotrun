import { env } from "@gneissdotrun/env/web";

const serverUrl = new URL(env.VITE_SERVER_URL);

export const agentClientConfig = {
	host: serverUrl.host,
	secure: serverUrl.protocol === "https:",
};

export const agentNamespaces = {
	rewrite: "rewrite-agent",
	index: "index-agent",
	router: "router-agent",
} as const;

export function createNoteSessionId(): string {
	return `note-${crypto.randomUUID()}`;
}
