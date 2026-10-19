<!-- BEGIN colby-ecosystem: managed by pull-agents, do not edit inside this block -->
## Machine-wide agent briefings (synced — do not edit here)

Pulled from `jmbish04/colby-ecosystem` by `.github/workflows/agents-sync.yml`, right-sized to this
repo's stack. Read them before your first load-bearing change; where they and the
notes below this block disagree, they win. Edit them in `jmbish04/colby-ecosystem`, never here.

@.agents/ecosystem/AGENTS.md
@.agents/ecosystem/AGENTS-maestro.md
@.agents/ecosystem/AGENTS-github.md
@.agents/ecosystem/AGENTS-cloudflare-workers.md
@.agents/ecosystem/AGENTS-frontend.md
@.agents/ecosystem/AGENTS-python.md
@.agents/ecosystem/AGENTS-mcp.md

The scripts in `scripts/` carrying a `colby-ecosystem: managed script` banner come from there too.
Use them rather than writing another: `scripts/gh.mjs` is the GitHub entry point
and wraps the `gh-tools` CLI, which already solves the auth this machine trips on.
`scripts/run.sh` is the verbose step runner: source it and put every step through
`run`, so a script that fails on its first line says so instead of reading as a
success. `bash scripts/run.sh --self-check` proves its own checks can fail.

Work is tracked in **colby-maestro** (`https://colby-maestro.hacolby.workers.dev/mcp`,
bearer `$(tokens show WORKER_API_KEY --value-only)`) — never in this repo and never
in colby-ecosystem, which only stores config. Refresh this block with
`.agents/ecosystem/pull-agents`.
<!-- END colby-ecosystem -->

# Mission Control Agents Manifest

## Agent Overview
- **Name:** Mission Control Orchestrator
- **Purpose:** Cloudflare Worker that coordinates plans, orders, and deliveries across modular AI factories.
- **Entry:** `packages/orchestrator/src/index.ts`
- **Bindings:**
  - `DB` (D1) — primary relational store
  - `CACHE` (KV) — transient metadata and health markers
  - `FILES` (R2) — artifact storage placeholder
  - `ORDERS_QUEUE` (Queue) — dispatch pipeline to factories
  - `WORKER_API_KEY` (Secret) — bearer auth for protected endpoints
- **Dependencies:** Hono, Zod, zod-openapi, Drizzle ORM, Kysely, Wrangler
- **Migration Tag:** `0001_init`
- **Usage Example:**
  ```bash
  curl -X POST https://<worker>/plans \
    -H "Authorization: Bearer $WORKER_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"jsonBody": {"steps": []}, "version": 1}'
  ```

## Contribution Notes
- Follow the existing Hono routing pattern (`router.get("/" ...)`) and reuse helpers in `src/utils`.
- When adding bindings, update `wrangler.part.toml`, this manifest, and relevant README sections.
- Keep Zod schemas in `models/zod.ts` in sync with any route payload changes; regenerate OpenAPI via `npm run openapi`.
- Queue consumers belong under `src/consumers/` and should be wired through `wrangler.part.toml`.
