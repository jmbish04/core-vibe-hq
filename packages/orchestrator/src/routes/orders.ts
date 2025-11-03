import { Hono } from "hono";

import { orderCreateSchema, orderResponseSchema } from "../models/zod";
import type { OrchestratorEnv } from "../types";
import { dispatchOrder } from "../services/dispatcher";
import { getDatabase } from "../utils/db";
import { requireApiKey } from "../utils/env";
import { jsonError, jsonOk } from "../utils/response";

const router = new Hono<OrchestratorEnv>();

router.post("/", async (c) => {
  if (!requireApiKey(c)) {
    return c.text("Unauthorized", 401);
  }

  const parseResult = orderCreateSchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return jsonError(c, "Invalid order payload", 400, parseResult.error.flatten());
  }

  const data = parseResult.data;
  const db = getDatabase(c);

  const planExists = await db
    .selectFrom("plans")
    .select(["id", "projectId"])
    .where("id", "=", data.planId)
    .executeTakeFirst();

  if (!planExists) {
    return jsonError(c, "Referenced plan not found", 404);
  }

  const insertResult = await db
    .insertInto("orders")
    .values({
      planId: data.planId,
      projectId: data.projectId ?? planExists.projectId ?? null,
      factory: data.factory,
      status: "queued",
      payload: JSON.stringify(data.payload)
    })
    .executeTakeFirst();

  const orderId = Number(insertResult?.lastInsertRowid ?? 0);
  const order = await db
    .selectFrom("orders")
    .select(["id", "planId", "projectId", "factory", "status", "payload", "createdAt", "updatedAt"])
    .where("id", "=", orderId)
    .executeTakeFirst();

  if (!order) {
    return jsonError(c, "Failed to persist order", 500);
  }

  await dispatchOrder(c.env, {
    orderId: order.id,
    planId: order.planId ?? data.planId,
    projectId: order.projectId ?? null,
    factory: order.factory ?? data.factory,
    payload: JSON.parse(order.payload ?? "{}")
  });

  const response = orderResponseSchema.parse({
    id: order.id,
    planId: order.planId,
    projectId: order.projectId,
    factory: order.factory,
    payload: JSON.parse(order.payload ?? "{}"),
    status: order.status,
    createdAt: new Date(Number(order.createdAt ?? Date.now())).toISOString(),
    updatedAt: new Date(Number(order.updatedAt ?? Date.now())).toISOString()
  });

  return jsonOk(c, response, 201);
});

router.get("/:id", async (c) => {
  if (!requireApiKey(c)) {
    return c.text("Unauthorized", 401);
  }

  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) {
    return jsonError(c, "Invalid order id", 400);
  }

  const db = getDatabase(c);
  const order = await db
    .selectFrom("orders")
    .select(["id", "planId", "projectId", "factory", "status", "payload", "createdAt", "updatedAt"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!order) {
    return jsonError(c, "Order not found", 404);
  }

  const response = orderResponseSchema.parse({
    id: order.id,
    planId: order.planId,
    projectId: order.projectId,
    factory: order.factory,
    payload: JSON.parse(order.payload ?? "{}"),
    status: order.status,
    createdAt: new Date(Number(order.createdAt ?? Date.now())).toISOString(),
    updatedAt: new Date(Number(order.updatedAt ?? Date.now())).toISOString()
  });

  return jsonOk(c, response);
});

export default router;
