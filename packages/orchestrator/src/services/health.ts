import type { Context } from "hono";

import { getDatabase } from "../utils/db";
import type { OrchestratorEnv } from "../types";
import { logger } from "./logger";

export const runQuickHealthCheck = async (c: Context<OrchestratorEnv>) => {
  const db = getDatabase(c);
  try {
    await db.selectFrom("projects").select("id").limit(1).executeTakeFirst();
  } catch (error) {
    logger.error("Quick health check database failure", { error });
    return {
      status: "error" as const,
      timestamp: new Date().toISOString(),
      details: { db: "unreachable" }
    };
  }

  return {
    status: "ok" as const,
    timestamp: new Date().toISOString()
  };
};

export const runFullHealthCheck = async (c: Context<OrchestratorEnv>) => {
  const db = getDatabase(c);
  const details: Record<string, unknown> = {};
  let status: "ok" | "degraded" | "error" = "ok";

  try {
    await db.selectFrom("projects").select("id").limit(1).executeTakeFirst();
    details.db = "ok";
  } catch (error) {
    logger.error("Full health check database failure", { error });
    details.db = "error";
    status = "error";
  }

  try {
    const cacheKey = `health:last-check:${Date.now()}`;
    await c.env.CACHE.put(cacheKey, "ok", { expirationTtl: 60 });
    const value = await c.env.CACHE.get(cacheKey);
    details.kv = value === "ok" ? "ok" : "missing";
    if (value !== "ok" && status !== "error") {
      status = "degraded";
    }
  } catch (error) {
    logger.error("Full health check KV failure", { error });
    details.kv = "error";
    status = "error";
  }

  const queueHealthy = typeof c.env.ORDERS_QUEUE?.send === "function";
  details.queue = queueHealthy ? "ok" : "unbound";
  if (!queueHealthy && status === "ok") {
    status = "degraded";
  }

  await c.env.CACHE.put("health:last-run", new Date().toISOString());

  const serializedDetails = JSON.stringify(details);
  await db
    .insertInto("health_runs")
    .values({
      runType: "full",
      status,
      message: serializedDetails
    })
    .execute();

  logger.info("Full health check completed", { status, details });

  return {
    status,
    timestamp: new Date().toISOString(),
    details
  };
};
