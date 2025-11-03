import type { Context } from "hono";

import type { OrchestratorEnv } from "../types";

/**
 * Extract strongly typed bindings from the request context.
 */
export const getBindings = (c: Context<OrchestratorEnv>) => c.env;

/**
 * Enforce Bearer token authentication for protected endpoints.
 */
export const requireApiKey = (c: Context<OrchestratorEnv>): boolean => {
  const key = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!key || key !== c.env.WORKER_API_KEY) {
    return false;
  }
  return true;
};
