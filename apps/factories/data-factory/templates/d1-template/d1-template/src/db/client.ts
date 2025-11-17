import { drizzle } from 'drizzle-orm/d1';
import { Kysely, D1Dialect } from 'kysely-d1';
import * as schema from './schema';
import type { Database } from './schema';

interface Env {
  DB: D1Database;
}

export const initDb = (env: Env) => ({
  drizzle: drizzle(env.DB, { schema }),
  kysely: new Kysely<Database>({
    dialect: new D1Dialect({ database: env.DB }),
  }),
});

export type DatabaseClients = ReturnType<typeof initDb>;
