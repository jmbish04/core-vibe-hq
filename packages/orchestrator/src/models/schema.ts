import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
  repoUrl: text("repo_url"),
  status: text("status"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`)
});

export const plans = sqliteTable("plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").references(() => projects.id),
  jsonBody: text("json_body"),
  version: integer("version"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`)
});

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  planId: integer("plan_id").references(() => plans.id),
  projectId: integer("project_id").references(() => projects.id),
  factory: text("factory"),
  status: text("status"),
  payload: text("payload"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`)
});

export const deliveries = sqliteTable("deliveries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").references(() => orders.id),
  status: text("status"),
  payload: text("payload"),
  receivedAt: integer("received_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`)
});

export const inventory = sqliteTable("inventory", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").references(() => projects.id),
  key: text("key"),
  location: text("location"),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`)
});

export const errors = sqliteTable("errors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").references(() => orders.id),
  message: text("message"),
  context: text("context"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`)
});

export const healthRuns = sqliteTable("health_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runType: text("run_type"),
  status: text("status"),
  message: text("message"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`)
});

export type DatabaseTables = {
  projects: typeof projects.$inferSelect;
  plans: typeof plans.$inferSelect;
  orders: typeof orders.$inferSelect;
  deliveries: typeof deliveries.$inferSelect;
  inventory: typeof inventory.$inferSelect;
  errors: typeof orchestrationErrors.$inferSelect;
  health_runs: typeof healthRuns.$inferSelect;
};

export type ProjectInsert = typeof projects.$inferInsert;
export type PlanInsert = typeof plans.$inferInsert;
export type OrderInsert = typeof orders.$inferInsert;
export type DeliveryInsert = typeof deliveries.$inferInsert;
export type InventoryInsert = typeof inventory.$inferInsert;
export type ErrorInsert = typeof orchestrationErrors.$inferInsert;
export type HealthRunInsert = typeof healthRuns.$inferInsert;
