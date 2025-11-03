import { Hono } from "hono";
import type { MessageBatch } from "@cloudflare/workers-types";

import plansRoute from "./routes/plans";
import ordersRoute from "./routes/orders";
import deliveriesRoute from "./routes/deliveries";
import inventoryRoute from "./routes/inventory";
import healthRoute from "./routes/health";
import openApiRoute from "./routes/openapi";
import type { OrchestratorEnv, OrderQueueMessage } from "./types";
import { handleOrdersQueue } from "./consumers/orders";

const app = new Hono<OrchestratorEnv>();

app.get("/", (c) =>
  c.json({
    name: "mission-control-orchestrator",
    version: "0.1.0",
    docs: "/openapi.json"
  })
);

app.route("/plans", plansRoute);
app.route("/orders", ordersRoute);
app.route("/deliveries", deliveriesRoute);
app.route("/inventory", inventoryRoute);
app.route("/health", healthRoute);
app.route("/openapi.json", openApiRoute);

export default app;

export const queue = {
  async queue(batch: MessageBatch<OrderQueueMessage>, env: OrchestratorEnv["Bindings"]) {
    await handleOrdersQueue(batch, env);
  }
};
