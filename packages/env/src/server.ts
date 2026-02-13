// oxlint-disable-next-line typescript-eslint/triple-slash-reference
/// <reference path="../env.d.ts" />

// For Cloudflare Workers, env is accessed via cloudflare:workers module
// Types are defined in env.d.ts based on your alchemy.run.ts bindings
import { env as workerEnv } from "cloudflare:workers";

export const env = workerEnv satisfies Cloudflare.Env & {
	GOOGLE_GENERATIVE_AI_API_KEY: string;
};
