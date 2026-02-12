import type { UIMessage } from "ai";

export function extractTextFromMessage(message: UIMessage): string {
	return message.parts
		.filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
		.map((part) => part.text)
		.join("")
		.trim();
}

export function getLatestUserInput(messages: UIMessage[]): string {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (!message || message.role !== "user") {
			continue;
		}

		const text = extractTextFromMessage(message);
		if (text.length > 0) {
			return text;
		}
	}

	return "";
}

export function splitIntoChunks(input: string, chunkSize = 96): string[] {
	if (input.length <= chunkSize) {
		return [input];
	}

	const chunks: string[] = [];
	for (let index = 0; index < input.length; index += chunkSize) {
		chunks.push(input.slice(index, index + chunkSize));
	}

	return chunks;
}
