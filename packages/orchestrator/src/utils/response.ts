import type { Context } from "hono";

import type { OrchestratorEnv } from "../types";

export const jsonOk = <T>(c: Context<OrchestratorEnv>, data: T, status = 200) =>
  c.json({ data }, status);

export const jsonError = (c: Context<OrchestratorEnv>, message: string, status = 400, details?: unknown) =>
  c.json({ error: { message, details } }, status);
