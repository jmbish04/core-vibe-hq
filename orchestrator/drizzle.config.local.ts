// drizzle.config.local.ts
// For local development using Wrangler's SQLite mirror (handy for schema testing or mock data)
// 
// Note: For multiple databases, create separate config files or run migrations separately
// targeting each database binding in wrangler.jsonc

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  verbose: true,
  strict: true,

  // Schema files for all databases
  schema: [
    './worker/database/schema.ts',
    './worker/database/ops/schema.ts',
    './worker/database/projects/schema.ts',
    './worker/database/chat/schema.ts',
    './worker/database/health/schema.ts',
  ],

  out: './drizzle',
});
