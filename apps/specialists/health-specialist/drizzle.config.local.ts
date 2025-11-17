import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './worker/src/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'file:./.wrangler/state/d1/DB.db',
  },
});
