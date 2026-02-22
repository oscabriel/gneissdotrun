export class RetryableAgentError extends Error {
	readonly status?: number;

	constructor(message: string, options?: { status?: number; cause?: unknown }) {
		super(message, { cause: options?.cause });
		this.name = "RetryableAgentError";
		this.status = options?.status;
	}
}

const RETRYABLE_HTTP_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export function isRetryableHttpStatus(status: number): boolean {
	return RETRYABLE_HTTP_STATUSES.has(status);
}

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === "string") {
		return error;
	}

	return String(error);
}

function getErrorStatus(error: unknown): number | null {
	if (error instanceof RetryableAgentError && typeof error.status === "number") {
		return error.status;
	}

	if (
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		typeof (error as { status?: unknown }).status === "number"
	) {
		return (error as { status: number }).status;
	}

	return null;
}

export function shouldRetryTransientError(error: unknown): boolean {
	const status = getErrorStatus(error);
	if (status !== null) {
		return isRetryableHttpStatus(status);
	}

	if (typeof error === "object" && error !== null) {
		const typed = error as { retryable?: boolean; overloaded?: boolean };
		if (typed.retryable === true && typed.overloaded !== true) {
			return true;
		}
	}

	const message = toErrorMessage(error).toLowerCase();
	if (!message) {
		return false;
	}

	if (message.includes("api key is missing") || message.includes("invalid argument")) {
		return false;
	}

	return /timeout|timed out|temporar|network|fetch failed|connection|econnreset|rate limit|overloaded|gateway|unavailable|internal/.test(
		message,
	);
}
