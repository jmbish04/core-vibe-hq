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
