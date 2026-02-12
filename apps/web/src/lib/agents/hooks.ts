import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";

import { agentClientConfig, agentNamespaces } from "./client";

export interface RewriteRoutingContext {
	kind:
		| "new_note"
		| "update_existing"
		| "correction"
		| "split"
		| "fan_out"
		| "workspace_action"
		| "ephemeral_answer"
		| "store_preference"
		| "duplicate";
	confidence: number;
	reason: string;
	tags: string[];
	target: "rewrite-agent" | "organization-agent" | "none";
}

export interface RewriteAgentState {
	noteId: string;
	userId: string;
	noteContent: string;
	routingContext: RewriteRoutingContext;
	updatedAt: number;
}

interface UseRewriteAgentOptions {
	noteId: string;
	onStateUpdate?: (state: RewriteAgentState) => void;
}

export function useRewriteAgent({ noteId, onStateUpdate }: UseRewriteAgentOptions) {
	return useAgent<RewriteAgentState>({
		agent: agentNamespaces.rewrite,
		name: noteId,
		host: agentClientConfig.host,
		onStateUpdate,
	});
}

export function useRewriteAgentChat(options: UseRewriteAgentOptions) {
	const agent = useRewriteAgent(options);
	const chat = useAgentChat<RewriteAgentState>({
		agent,
		credentials: "include",
	});

	return {
		agent,
		...chat,
	};
}
