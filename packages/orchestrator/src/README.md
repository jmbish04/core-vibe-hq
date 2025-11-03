# Mission Control Orchestrator Worker

This Worker powers the Mission Control orchestrator backend. It accepts plans, dispatches orders to modular AI factories, receives deliveries, and exposes health and documentation endpoints.

## Development

```bash
npm install
npm run dev
```

Set the following environment variables when running locally:

- `WORKER_API_KEY` — bearer token for protected endpoints
- `D1_DATABASE_ID` and `CF_ACCOUNT_ID` — required for Drizzle migration tooling

## API Overview

- `POST /plans` — Register a new orchestration plan
- `POST /orders` — Create an order and enqueue for processing
- `GET /orders/:id` — Retrieve order status
- `POST /deliveries` — Record completed factory work
- `GET /inventory` — List artifacts in storage
- `GET /health/quick` — Lightweight health check
- `GET /health/full` — Comprehensive health check
- `GET /openapi.json` — OpenAPI 3.1 schema

Run `npm run openapi` to regenerate `openapi.json` from Zod schemas.
