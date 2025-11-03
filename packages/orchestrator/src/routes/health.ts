import { Hono } from "hono";

import { runFullHealthCheck, runQuickHealthCheck } from "../services/health";
import type { OrchestratorEnv } from "../types";

const router = new Hono<OrchestratorEnv>();

router.get("/quick", async (c) => {
  const result = await runQuickHealthCheck(c);
  return c.json({ status: result.status, timestamp: result.timestamp });
});

router.get("/full", async (c) => {
  const result = await runFullHealthCheck(c);
  return c.json(result);
});

export default router;
