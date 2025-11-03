import { Hono } from "hono";

import { deliveryResponseSchema, deliverySchema } from "../models/zod";
import type { OrchestratorEnv } from "../types";
import { getDatabase } from "../utils/db";
import { requireApiKey } from "../utils/env";
import { jsonError, jsonOk } from "../utils/response";

const router = new Hono<OrchestratorEnv>();

router.post("/", async (c) => {
  if (!requireApiKey(c)) {
    return c.text("Unauthorized", 401);
  }

  const parseResult = deliverySchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return jsonError(c, "Invalid delivery payload", 400, parseResult.error.flatten());
  }

  const payload = parseResult.data;
  const db = getDatabase(c);

  const order = await db
    .selectFrom("orders")
    .select(["id", "status"])
    .where("id", "=", payload.orderId)
    .executeTakeFirst();

  if (!order) {
    return jsonError(c, "Order not found", 404);
  }

  const insertResult = await db
    .insertInto("deliveries")
    .values({
      orderId: payload.orderId,
      status: payload.status,
      payload: JSON.stringify(payload.payload)
    })
    .executeTakeFirst();

  await db
    .updateTable("orders")
    .set({ status: payload.status, updatedAt: Date.now() })
    .where("id", "=", payload.orderId)
    .execute();

  const deliveryId = Number(insertResult?.lastInsertRowid ?? 0);
  const delivery = await db
    .selectFrom("deliveries")
    .select(["id", "orderId", "status", "payload", "receivedAt"])
    .where("id", "=", deliveryId)
    .executeTakeFirst();

  if (!delivery) {
    return jsonError(c, "Failed to persist delivery", 500);
  }

  const response = deliveryResponseSchema.parse({
    id: delivery.id,
    orderId: delivery.orderId,
    status: delivery.status,
    payload: JSON.parse(delivery.payload ?? "{}"),
    receivedAt: new Date(Number(delivery.receivedAt ?? Date.now())).toISOString()
  });

  return jsonOk(c, response, 201);
});

export default router;
