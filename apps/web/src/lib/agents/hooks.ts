import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { useCallback, useEffect, useRef } from "react";

import { agentClientConfig, agentNamespaces } from "./client";
import {
	consumeTransientDataChunk,
	type RewriteRoutingDataPart,
	type RewriteStatusDataPart,
} from "./data-parts";

export type { RewriteRoutingDataPart, RewriteStatusDataPart } from "./data-parts";

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
	title: string;
	noteContent: string;
	routingContext: RewriteRoutingContext;
	updatedAt: number;
}

export interface IndexedNote {
	id: string;
	title: string;
	summary: string;
	updatedAt: number;
}

export interface IndexAgentState {
	notes: IndexedNote[];
	collections: Array<{
		id: string;
		title: string;
		summary: string;
		status: string;
		updatedAt: number;
	}>;
	actionItems: Array<{
		id: string;
		description: string;
		status: string;
		deadline?: number | null;
		noteId?: string | null;
		updatedAt: number;
	}>;
	contradictions: Array<{
		id: string;
		factAId: string;
		factBId: string;
		status: string;
		updatedAt: number;
	}>;
	updatedAt: number;
}

interface UseRewriteAgentOptions {
	agentName: string;
	onStateUpdate?: (state: RewriteAgentState) => void;
}

interface UseRewriteAgentChatOptions extends UseRewriteAgentOptions {
	body?: Record<string, unknown> | (() => Record<string, unknown>);
	onRoutingData?: (payload: RewriteRoutingDataPart) => void;
	onStatusData?: (payload: RewriteStatusDataPart) => void;
}

export function useRewriteAgent({ agentName, onStateUpdate }: UseRewriteAgentOptions) {
	return useAgent<RewriteAgentState>({
		agent: agentNamespaces.rewrite,
		name: agentName,
		host: agentClientConfig.host,
		onStateUpdate,
	});
}

export function useRewriteAgentChat(options: UseRewriteAgentChatOptions) {
	const agent = useRewriteAgent(options);
	const seenTransientEventsRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		seenTransientEventsRef.current.clear();
	}, [options.agentName]);

	const handleData = useCallback(
		(chunk: unknown) => {
			const parsed = consumeTransientDataChunk(seenTransientEventsRef.current, chunk);
			if (!parsed) {
				return;
			}

			if (parsed.kind === "routing") {
				options.onRoutingData?.(parsed.payload);
				return;
			}

			options.onStatusData?.(parsed.payload);
		},
		[options],
	);

	const chat = useAgentChat<RewriteAgentState>({
		agent,
		credentials: "include",
		body: options.body,
		onData: handleData,
	});

	return {
		agent,
		...chat,
	};
}

export function useIndexAgent({
	userId,
	onStateUpdate,
}: {
	userId: string;
	onStateUpdate?: (state: IndexAgentState) => void;
}) {
	return useAgent<IndexAgentState>({
		agent: agentNamespaces.index,
		name: userId,
		host: agentClientConfig.host,
		onStateUpdate,
	});
}
