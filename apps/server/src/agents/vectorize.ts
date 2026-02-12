import { embed } from "ai";
import { google } from "@ai-sdk/google";

interface EmbeddingResult {
	id: string;
	embedding: number[];
}

export async function embedNoteForVectorize(id: string, content: string): Promise<EmbeddingResult> {
	const { embedding } = await embed({
		model: google.embedding("gemini-embedding-001"),
		value: content,
		providerOptions: {
			google: {
				outputDimensionality: 768,
				taskType: "SEMANTIC_SIMILARITY",
			},
		},
	});

	return {
		id,
		embedding,
	};
}

export async function upsertEmbeddings(
	index: VectorizeIndex,
	items: EmbeddingResult[],
): Promise<void> {
	if (!items.length) {
		return;
	}

	await index.upsert(
		items.map((item) => ({
			id: item.id,
			values: item.embedding,
		})),
	);
}
