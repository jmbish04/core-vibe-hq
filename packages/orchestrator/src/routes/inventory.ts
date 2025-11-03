import { Hono } from "hono";

import { inventoryFilterSchema } from "../models/zod";
import type { OrchestratorEnv } from "../types";
import { getDatabase } from "../utils/db";
import { requireApiKey } from "../utils/env";
import { jsonError, jsonOk } from "../utils/response";

const router = new Hono<OrchestratorEnv>();

router.get("/", async (c) => {
  if (!requireApiKey(c)) {
    return c.text("Unauthorized", 401);
  }

  const query = c.req.query();
  const parseResult = inventoryFilterSchema.safeParse({
    projectId: query.projectId ? Number(query.projectId) : undefined
  });

  if (!parseResult.success) {
    return jsonError(c, "Invalid query parameters", 400, parseResult.error.flatten());
  }

  const db = getDatabase(c);
  let q = db.selectFrom("inventory").select(["id", "projectId", "key", "location", "metadata", "createdAt"]);
  if (typeof parseResult.data.projectId === "number") {
    q = q.where("projectId", "=", parseResult.data.projectId);
  }

  const items = await q.execute();

  const response = items.map((item) => ({
    ...item,
    metadata: item.metadata ? JSON.parse(item.metadata) : null,
    createdAt: new Date(Number(item.createdAt ?? Date.now())).toISOString()
  }));

  return jsonOk(c, response);
});

export default router;
