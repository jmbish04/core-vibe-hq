import { Hono } from "hono";

import { planInputSchema, planResponseSchema } from "../models/zod";
import type { OrchestratorEnv } from "../types";
import { getDatabase } from "../utils/db";
import { requireApiKey } from "../utils/env";
import { jsonError, jsonOk } from "../utils/response";

const router = new Hono<OrchestratorEnv>();

router.post("/", async (c) => {
  if (!requireApiKey(c)) {
    return c.text("Unauthorized", 401);
  }

  const parseResult = planInputSchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return jsonError(c, "Invalid plan payload", 400, parseResult.error.flatten());
  }

  const payload = parseResult.data;
  const db = getDatabase(c);

  const insertResult = await db
    .insertInto("plans")
    .values({
      projectId: payload.projectId ?? null,
      jsonBody: JSON.stringify(payload.jsonBody),
      version: payload.version
    })
    .executeTakeFirst();

  const planId = Number(insertResult?.lastInsertRowid ?? 0);
  const plan = await db
    .selectFrom("plans")
    .select(["id", "projectId", "jsonBody", "version", "createdAt"])
    .where("id", "=", planId)
    .executeTakeFirst();

  if (!plan) {
    return jsonError(c, "Failed to persist plan", 500);
  }

  const response = planResponseSchema.parse({
    id: plan.id,
    projectId: plan.projectId,
    jsonBody: JSON.parse(plan.jsonBody ?? "{}"),
    version: plan.version ?? 1,
    createdAt: new Date(Number(plan.createdAt ?? Date.now())).toISOString()
  });

  return jsonOk(c, response, 201);
});

export default router;
