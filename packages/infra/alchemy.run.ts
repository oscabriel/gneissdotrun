import alchemy from "alchemy";
import {
	DurableObjectNamespace,
	KVNamespace,
	R2Bucket,
	TanStackStart,
	VectorizeIndex,
	Workflow,
	Worker,
	D1Database,
} from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });
config({ path: "../../apps/server/.env" });

const app = await alchemy("gneissdotrun");

const db = await D1Database("database", {
	migrationsDir: "../../packages/db/src/migrations",
});

const rewriteAgent = DurableObjectNamespace("rewrite-agent", {
	className: "RewriteAgent",
	sqlite: true,
});

const indexAgent = DurableObjectNamespace("index-agent", {
	className: "IndexAgent",
	sqlite: true,
});

const routerAgent = DurableObjectNamespace("router-agent", {
	className: "RouterAgent",
	sqlite: true,
});

const organizeWorkflow = Workflow("organize-workflow", {
	workflowName: "organize-workflow",
	className: "OrganizeWorkflow",
});

const fanoutWorkflow = Workflow("fanout-workflow", {
	workflowName: "fanout-workflow",
	className: "FanOutWorkflow",
});

const contradictionWorkflow = Workflow("contradiction-workflow", {
	workflowName: "contradiction-workflow",
	className: "ContradictionWorkflow",
});

const kv = await KVNamespace("kv", {
	adopt: true,
});

const filesBucket = await R2Bucket("files", {
	name: "gneiss-files",
	adopt: true,
});

const vectorize = await VectorizeIndex("embeddings", {
	name: "gneiss-embeddings",
	dimensions: 768,
	metric: "cosine",
	adopt: true,
});

export const web = await TanStackStart("web", {
	cwd: "../../apps/web",
	bindings: {
		VITE_SERVER_URL: alchemy.env.VITE_SERVER_URL!,
		DB: db,
		CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
		BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
		BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
	},
	domains: ["gneiss.run"],
});

export const server = await Worker("server", {
	cwd: "../../apps/server",
	entrypoint: "src/index.ts",
	compatibility: "node",
	bindings: {
		DB: db,
		REWRITE_AGENT: rewriteAgent,
		INDEX_AGENT: indexAgent,
		ROUTER_AGENT: routerAgent,
		ORGANIZE_WORKFLOW: organizeWorkflow,
		FANOUT_WORKFLOW: fanoutWorkflow,
		CONTRADICTION_WORKFLOW: contradictionWorkflow,
		KV: kv,
		FILES: filesBucket,
		VECTORIZE: vectorize,
		CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
		BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
		BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
	},
	dev: {
		port: 3000,
	},
});

console.log(`Web    -> ${web.url}`);
console.log(`Server -> ${server.url}`);

await app.finalize();
