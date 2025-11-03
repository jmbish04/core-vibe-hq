import type { D1Database, KVNamespace, Queue, R2Bucket } from "@cloudflare/workers-types";
import type { Kysely } from "kysely";

import type { DatabaseTables } from "./models/schema";

/**
 * Bindings available to the orchestrator Worker.
 */
export interface Bindings {
  DB: D1Database;
  CACHE: KVNamespace;
  FILES: R2Bucket;
  ORDERS_QUEUE: Queue<OrderQueueMessage>;
  WORKER_API_KEY: string;
}

/**
 * Context variables injected at request handling time.
 */
export interface Variables {
  db: Kysely<DatabaseTables>;
}

export interface OrchestratorEnv {
  Bindings: Bindings;
  Variables: Variables;
}

/**
 * Message payload pushed into the ORDERS_QUEUE for downstream factory processing.
 */
export interface OrderQueueMessage {
  orderId: number;
  planId: number;
  projectId: number | null;
  factory: string;
  payload: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  details?: Record<string, unknown>;
}
