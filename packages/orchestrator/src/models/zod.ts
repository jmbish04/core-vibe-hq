import { OpenAPIBuilder, generateSchema } from "zod-openapi";
import { z } from "zod";

export const planInputSchema = z.object({
  projectId: z.number().int().positive().nullable().optional(),
  jsonBody: z.record(z.unknown()),
  version: z.number().int().positive().default(1)
});

export const orderCreateSchema = z.object({
  planId: z.number().int().positive(),
  projectId: z.number().int().positive().nullable().optional(),
  factory: z.string().min(1),
  payload: z.record(z.any()).default({})
});

export const deliverySchema = z.object({
  orderId: z.number().int().positive(),
  status: z.string().min(1),
  payload: z.record(z.any())
});

export const inventoryFilterSchema = z.object({
  projectId: z.number().int().positive().optional()
});

export const planResponseSchema = planInputSchema.extend({
  id: z.number().int().positive(),
  createdAt: z.string()
});

export const orderResponseSchema = orderCreateSchema.extend({
  id: z.number().int().positive(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional()
});

export const deliveryResponseSchema = deliverySchema.extend({
  id: z.number().int().positive(),
  receivedAt: z.string()
});

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "error"]),
  timestamp: z.string(),
  details: z.record(z.any()).optional()
});

export const openApiBuilder = new OpenAPIBuilder({
  openapi: "3.1.0",
  info: {
    title: "Mission Control Orchestrator API",
    version: "0.1.0",
    description: "Central coordination API for modular AI factories."
  }
});

openApiBuilder.addSchema("PlanInput", generateSchema(planInputSchema));
openApiBuilder.addSchema("PlanResponse", generateSchema(planResponseSchema));
openApiBuilder.addSchema("OrderCreate", generateSchema(orderCreateSchema));
openApiBuilder.addSchema("OrderResponse", generateSchema(orderResponseSchema));
openApiBuilder.addSchema("Delivery", generateSchema(deliverySchema));
openApiBuilder.addSchema("DeliveryResponse", generateSchema(deliveryResponseSchema));
openApiBuilder.addSchema("HealthResponse", generateSchema(healthResponseSchema));
