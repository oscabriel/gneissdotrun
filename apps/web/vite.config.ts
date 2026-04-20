import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import alchemy from "alchemy/cloudflare/tanstack-start";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss(), tanstackStart(), viteReact(), alchemy()],
	resolve: {
		tsconfigPaths: true,
	},
	server: {
		port: 3001,
	},
});
