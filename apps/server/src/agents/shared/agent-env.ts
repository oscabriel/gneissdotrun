export type RouteKind =
	| "new_note"
	| "update_existing"
	| "correction"
	| "split"
	| "fan_out"
	| "workspace_action"
	| "ephemeral_answer"
	| "store_preference"
	| "duplicate";

export interface RoutingDecision {
	kind: RouteKind;
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
	routingContext: RoutingDecision;
	updatedAt: number;
}

export interface IndexedNote {
	id: string;
	title: string;
	summary: string;
	updatedAt: number;
}

export interface CollectionStub {
	id: string;
	title: string;
	summary: string;
	status: string;
	updatedAt: number;
}

export interface ActionItemStub {
	id: string;
	description: string;
	status: string;
	deadline?: number | null;
	noteId?: string | null;
	updatedAt: number;
}

export interface ContradictionStub {
	id: string;
	factAId: string;
	factBId: string;
	status: string;
	updatedAt: number;
}

export interface IndexAgentState {
	notes: IndexedNote[];
	collections: CollectionStub[];
	actionItems: ActionItemStub[];
	contradictions: ContradictionStub[];
	updatedAt: number;
}

export interface RouterAgentState {
	recentDecisions: Array<RoutingDecision & { at: number; noteId: string }>;
	updatedAt: number;
}

export interface OrganizationAgentState {
	collections: CollectionStub[];
	actionItems: ActionItemStub[];
	contradictions: ContradictionStub[];
	lastRunAt: number | null;
	updatedAt: number;
}

export type AgentEnv = Env;
