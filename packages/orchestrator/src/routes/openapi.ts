import { Hono } from "hono";

import {
  deliveryResponseSchema,
  deliverySchema,
  healthResponseSchema,
  openApiBuilder,
  orderCreateSchema,
  orderResponseSchema,
  planInputSchema,
  planResponseSchema
} from "../models/zod";
import type { OrchestratorEnv } from "../types";

const router = new Hono<OrchestratorEnv>();

openApiBuilder.addSecurityScheme("bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "API Key"
});

openApiBuilder.addPath("/plans", {
  post: {
    summary: "Create a new plan",
    requestBody: {
      content: {
        "application/json": {
          schema: planInputSchema.openapi({ ref: "PlanInput" })
        }
      }
    },
    responses: {
      201: {
        description: "Plan created",
        content: {
          "application/json": {
            schema: planResponseSchema.openapi({ ref: "PlanResponse" })
          }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  }
});

openApiBuilder.addPath("/orders", {
  post: {
    summary: "Create a new order",
    requestBody: {
      content: {
        "application/json": {
          schema: orderCreateSchema.openapi({ ref: "OrderCreate" })
        }
      }
    },
    responses: {
      201: {
        description: "Order queued",
        content: {
          "application/json": {
            schema: orderResponseSchema.openapi({ ref: "OrderResponse" })
          }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  }
});

openApiBuilder.addPath("/orders/{id}", {
  get: {
    summary: "Fetch an order by id",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "integer" }
      }
    ],
    responses: {
      200: {
        description: "Order details",
        content: {
          "application/json": {
            schema: orderResponseSchema.openapi({ ref: "OrderResponse" })
          }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  }
});

openApiBuilder.addPath("/deliveries", {
  post: {
    summary: "Submit a delivery",
    requestBody: {
      content: {
        "application/json": {
          schema: deliverySchema.openapi({ ref: "Delivery" })
        }
      }
    },
    responses: {
      201: {
        description: "Delivery accepted",
        content: {
          "application/json": {
            schema: deliveryResponseSchema.openapi({ ref: "DeliveryResponse" })
          }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  }
});

openApiBuilder.addPath("/health/quick", {
  get: {
    summary: "Quick health check",
    responses: {
      200: {
        description: "Health status",
        content: {
          "application/json": {
            schema: healthResponseSchema.openapi({ ref: "HealthResponse" })
          }
        }
      }
    }
  }
});

openApiBuilder.addPath("/health/full", {
  get: {
    summary: "Full health check",
    responses: {
      200: {
        description: "Detailed health status",
        content: {
          "application/json": {
            schema: healthResponseSchema.openapi({ ref: "HealthResponse" })
          }
        }
      }
    }
  }
});

router.get("/", (c) => {
  return c.json(openApiBuilder.getSpec());
});

export default router;
