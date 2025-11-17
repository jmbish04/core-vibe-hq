// drizzle.config.remote.ts
// For running Drizzle migrations directly against Cloudflare's remote D1 databases
//
// Note: For multiple databases, you'll need to specify which database to target
// when running migrations. Drizzle will use the database bindings from wrangler.jsonc

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  driver: 'd1-http',
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
