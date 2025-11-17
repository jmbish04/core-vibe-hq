import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './worker/src/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    // This will be handled by wrangler when using --remote flag
    url: 'remote',
  },
});
