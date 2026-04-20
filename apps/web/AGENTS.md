# AGENTS.md (apps/web)

- Commands (repo root): `bun run dev:web`, `bun --filter web run build`, `bun --filter web run typecheck`.
- Notes: `../../docs/agents/workspaces.md#appsweb`.

<!-- intent-skills:start -->
# Skill mappings - when working in these areas, load the linked skill file into context.
skills:
  - task: "building TanStack Start app structure, document shell, and React Start wiring"
    load: "/Users/oscargabriel/Developer/projects/gneissdotrun/apps/web/node_modules/@tanstack/react-start/skills/react-start/SKILL.md"
  - task: "implementing TanStack Start server functions, request middleware, or server routes"
    load: "/Users/oscargabriel/Developer/projects/gneissdotrun/node_modules/.bun/@tanstack+start-client-core@1.167.3/node_modules/@tanstack/start-client-core/skills/start-core/server-functions/SKILL.md"
  - task: "protecting routes and auth flows with TanStack Router beforeLoad and redirects"
    load: "/Users/oscargabriel/Developer/projects/gneissdotrun/node_modules/.bun/@tanstack+router-core@1.168.3/node_modules/@tanstack/router-core/skills/router-core/auth-and-guards/SKILL.md"
  - task: "implementing route loaders, pending states, and router-managed data loading"
    load: "/Users/oscargabriel/Developer/projects/gneissdotrun/node_modules/.bun/@tanstack+router-core@1.168.3/node_modules/@tanstack/router-core/skills/router-core/data-loading/SKILL.md"
  - task: "building internal navigation, links, preloading, and router search param flows"
    load: "/Users/oscargabriel/Developer/projects/gneissdotrun/node_modules/.bun/@tanstack+router-core@1.168.3/node_modules/@tanstack/router-core/skills/router-core/navigation/SKILL.md"
  - task: "configuring TanStack Router plugin route generation and code splitting"
    load: "/Users/oscargabriel/Developer/projects/gneissdotrun/apps/web/node_modules/@tanstack/router-plugin/skills/router-plugin/SKILL.md"
  - task: "instrumenting custom TanStack devtools events for frontend runtime, editor, or workspace diagnostics"
    load: "/Users/oscargabriel/Developer/projects/gneissdotrun/node_modules/.bun/@tanstack+devtools-event-client@0.4.3/node_modules/@tanstack/devtools-event-client/skills/devtools-instrumentation/SKILL.md"
<!-- intent-skills:end -->
