import { Agent } from "agents";

import type {
	ActionItemStub,
	AgentEnv,
	CollectionStub,
	ContradictionStub,
	IndexedNote,
	IndexAgentState,
} from "./shared";

interface IndexActionPayload {
	action: "upsert" | "remove" | "clear" | "collections" | "action_items" | "contradictions";
	note?: IndexedNote;
	noteId?: string;
	collections?: CollectionStub[];
	actionItems?: ActionItemStub[];
	contradictions?: ContradictionStub[];
}

export class IndexAgent extends Agent<AgentEnv, IndexAgentState> {
	initialState: IndexAgentState = {
		notes: [],
		collections: [],
		actionItems: [],
		contradictions: [],
		updatedAt: Date.now(),
	};

	private writeState(notes: IndexedNote[]): void {
		const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
		this.setState({
			...this.state,
			notes: sorted,
			updatedAt: Date.now(),
		});
	}

	private upsert(note: IndexedNote): void {
		const deduped = this.state.notes.filter((existing) => existing.id !== note.id);
		deduped.push(note);
		this.writeState(deduped);
	}

	private remove(noteId: string): void {
		const filtered = this.state.notes.filter((note) => note.id !== noteId);
		this.writeState(filtered);
	}

	private clear(): void {
		this.writeState([]);
	}

	private updateCollections(collections: CollectionStub[]): void {
		this.setState({
			...this.state,
			collections: [...collections],
			updatedAt: Date.now(),
		});
	}

	private updateActionItems(items: ActionItemStub[]): void {
		this.setState({
			...this.state,
			actionItems: [...items],
			updatedAt: Date.now(),
		});
	}

	private updateContradictions(items: ContradictionStub[]): void {
		this.setState({
			...this.state,
			contradictions: [...items],
			updatedAt: Date.now(),
		});
	}

	private async handleMutation(payload: IndexActionPayload): Promise<Response> {
		if (payload.action === "upsert" && payload.note) {
			this.upsert(payload.note);
			return Response.json({ ok: true, state: this.state });
		}

		if (payload.action === "remove" && payload.noteId) {
			this.remove(payload.noteId);
			return Response.json({ ok: true, state: this.state });
		}

		if (payload.action === "clear") {
			this.clear();
			return Response.json({ ok: true, state: this.state });
		}

		if (payload.action === "collections" && payload.collections) {
			this.updateCollections(payload.collections);
			return Response.json({ ok: true, state: this.state });
		}

		if (payload.action === "action_items" && payload.actionItems) {
			this.updateActionItems(payload.actionItems);
			return Response.json({ ok: true, state: this.state });
		}

		if (payload.action === "contradictions" && payload.contradictions) {
			this.updateContradictions(payload.contradictions);
			return Response.json({ ok: true, state: this.state });
		}

		return Response.json({ error: "Invalid payload" }, { status: 400 });
	}

	async onRequest(request: Request): Promise<Response> {
		if (request.method === "GET") {
			return Response.json(this.state);
		}

		if (request.method === "POST") {
			const payload = (await request.json()) as IndexActionPayload;
			return this.handleMutation(payload);
		}

		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}
}
