import { Agent } from "agents";

import type { AgentEnv, IndexedNote, IndexAgentState } from "./shared";

interface IndexActionPayload {
	action: "upsert" | "remove" | "clear";
	note?: IndexedNote;
	noteId?: string;
}

export class IndexAgent extends Agent<AgentEnv, IndexAgentState> {
	initialState: IndexAgentState = {
		notes: [],
		updatedAt: Date.now(),
	};

	private writeState(notes: IndexedNote[]): void {
		const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
		this.setState({
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
