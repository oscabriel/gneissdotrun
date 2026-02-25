import { getAgentByName } from "agents";

import type { OrganizationAgent } from "./agents";

interface TriggerOrganizationRefreshOptions {
	reason?: string;
}

function normalizeNoteIds(noteIds: Array<string | null | undefined>): string[] {
	return Array.from(
		new Set(noteIds.map((noteId) => noteId?.trim() ?? "").filter((noteId) => noteId.length > 0)),
	);
}

export async function triggerOrganizationRefresh(
	env: Env,
	userId: string,
	noteIds: Array<string | null | undefined>,
	options: TriggerOrganizationRefreshOptions = {},
): Promise<{ triggered: boolean; noteIds: string[] }> {
	const normalizedNoteIds = normalizeNoteIds(noteIds);
	if (normalizedNoteIds.length === 0) {
		return {
			triggered: false,
			noteIds: [],
		};
	}

	try {
		const organizationAgent = await getAgentByName<Env, OrganizationAgent>(
			env.ORGANIZATION_AGENT,
			userId,
		);
		const response = await organizationAgent.fetch("https://organization-agent/internal", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				action: "run_organize",
				noteIds: normalizedNoteIds,
			}),
		});
		if (!response.ok) {
			throw new Error(`Organization refresh failed (${response.status})`);
		}

		return {
			triggered: true,
			noteIds: normalizedNoteIds,
		};
	} catch (error) {
		console.error("Failed to trigger organization refresh", {
			error,
			userId,
			noteIds: normalizedNoteIds,
			reason: options.reason ?? "unknown",
		});

		return {
			triggered: false,
			noteIds: normalizedNoteIds,
		};
	}
}

export { normalizeNoteIds };
