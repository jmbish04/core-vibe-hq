import type { Context } from "hono";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import type { OrchestratorEnv } from "../types";
import type { DatabaseTables } from "../models/schema";

/**
 * Lazily construct a Kysely instance backed by the Cloudflare D1 binding.
 */
export const getDatabase = (c: Context<OrchestratorEnv>) => {
  let db = c.get("db") as Kysely<DatabaseTables> | undefined;
  if (!db) {
    db = new Kysely<DatabaseTables>({
      dialect: new D1Dialect({ database: c.env.DB })
    });
    c.set("db", db);
  }
  return db;
};
