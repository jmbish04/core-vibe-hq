/**
 * @shared/base/prompts/orm-policy.ts
 *
 * ORM Architecture & Development Policy for Drizzle + Kysely hybrid standard.
 */

import type { PromptTemplate } from './types';

export const ORM_POLICY_PROMPT: PromptTemplate = {
  id: 'orm-policy',
  name: 'ORM Architecture & Development Policy',
  description: 'Drizzle + Kysely hybrid ORM standard for Cloudflare D1 database access',
  version: '1.0.0',
  tags: ['orm', 'drizzle', 'kysely', 'd1', 'database', 'typescript'],
  dependencies: ['cloudflare-base'],
  priority: 90, // High priority - domain-specific rules
  content: `# 🧭 ORM ARCHITECTURE & DEVELOPMENT POLICY

## Core Directive

All data-access and schema management for this Worker MUST follow the **Drizzle + Kysely hybrid standard**.

This hybrid ensures:

- ✅ Type-safe, migration-backed schema control (Drizzle)
- ✅ Dynamic, composable, SQL-grade query flexibility (Kysely)
- ✅ Native compatibility with Cloudflare D1 bindings and edge runtime
- ✅ Zero Node dependencies and minimal runtime overhead

---

## Implementation Rules

### 1. Schema & Migrations — Drizzle

- Define all tables using \`drizzle-orm/sqlite-core\` in \`src/db/schema.ts\`.
- Use \`drizzle-kit\` for schema introspection and migration generation.
- Schema types exported from Drizzle are the **single source of truth** for Kysely.

- Example:

  \`\`\`ts
  import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

  export const users = sqliteTable('users', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp' }),
  });
  \`\`\`

### 2. Database Client Layer

- Initialize both Drizzle and Kysely clients from the same D1 binding.
- Encapsulate in \`src/db/client.ts\`:

\`\`\`ts
import { drizzle } from 'drizzle-orm/d1';
import { Kysely, D1Dialect } from 'kysely-d1';
import * as schema from './schema';

export const initDb = (env: Env) => ({
  drizzle: drizzle(env.DB, { schema }),
  kysely: new Kysely<typeof schema>({
    dialect: new D1Dialect({ database: env.DB }),
  }),
});
\`\`\`

### 3. Query Layer

- Use Drizzle for simple CRUD and standard workflow logic:

\`\`\`ts
await db.drizzle.insert(schema.users).values({ email }).run();
const users = await db.drizzle.select().from(schema.users).all();
\`\`\`

- Use Kysely for dynamic filtering, joins, and analytics queries:

\`\`\`ts
const results = await db.kysely
  .selectFrom('users')
  .selectAll()
  .where('created_at', '>', cutoff)
  .orderBy('created_at', 'desc')
  .limit(100)
  .execute();
\`\`\`

### 4. Type Sharing

- Export Drizzle's inferred table types as a unified Database interface for Kysely:

\`\`\`ts
import * as schema from './schema';
export type Database = { [K in keyof typeof schema]: typeof schema[K]['$inferSelect']; };
\`\`\`

- All Kysely instances must use \`<Database>\` for generics.

### 5. Migrations & CI/CD

- Always run \`drizzle-kit generate\` before deployment.
- Include \`"migrate": "wrangler d1 migrations apply <DB_NAME>"\` in package.json.
- Migrations must be committed to version control.

### 6. Escape Hatch Policy

- Raw SQL or \`env.DB.prepare()\` calls are only allowed if:

  1. Drizzle or Kysely cannot express the query efficiently, and
  2. A \`// @native-sql\` comment is included above with justification.

---

## Enforcement

Any agent or developer modifying this repository must:

- Maintain ORM conformity with this document.
- Update schema via Drizzle only.
- Preserve shared type definitions between Drizzle and Kysely.
- Avoid introducing any ORM abstraction other than these two.

Pull requests or generated code violating this policy will be automatically rejected by CI lint rules.

---

## Context Summary

- Runtime: Cloudflare Workers (ESM, edge)
- Database: D1
- ORM Layer: Drizzle (schema + migrations) + Kysely (queries)
- Target: Type-safe, high-performance edge data access with minimal cognitive load.

---

## Authoritative Instruction for AI Agents

If you are an AI development agent operating on this repository (e.g., Gemini, Codex, Jules, Claude, or Cursor),

you must interpret all data-modeling and SQL-related tasks through this hybrid ORM policy and never revert

to direct SQL unless explicitly requested by the human owner (Justin Bishop).

---

# 🧩 RETROFIT PLAN

You are an expert Cloudflare Workers + TypeScript developer tasked with refactoring

an existing Worker project that currently uses raw D1 queries (\`env.DB.prepare\`, etc.)

into a robust, type-safe hybrid ORM architecture combining Drizzle ORM and Kysely.

### 🎯 Goal

Adopt Drizzle for schema definition, type inference, and migrations;

use Kysely for advanced/dynamic query composition; preserve all functional behavior.

---

## 🧩 Retrofit Plan

### 1. Analyze Current State

- Parse the current codebase to identify:
  - All calls to \`env.DB.prepare\`, \`.bind()\`, \`.all()\`, \`.run()\`, \`.get()\`
  - Inline SQL statements and their table/column references
- Generate a quick inventory of tables, columns, and relationships inferred from those SQL statements.

### 2. Create Schema Layer (Drizzle)

- Create \`src/db/schema.ts\` defining each table with Drizzle's D1 adapter:

  \`\`\`ts
  import { sqliteTable, integer, text, primaryKey } from 'drizzle-orm/sqlite-core';

  export const users = sqliteTable('users', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
  });
  \`\`\`

- Export inferred TypeScript types via Drizzle's \`InferModel<>\`.

### 3. Setup Migration System

- Add \`drizzle.config.ts\` and \`migrations/\` folder.
- Configure \`drizzle-kit\` for D1:

  \`\`\`ts
  import type { Config } from 'drizzle-kit';
  export default {
    schema: './src/db/schema.ts',
    out: './migrations',
    driver: 'd1',
  } satisfies Config;
  \`\`\`

- Generate initial migration: \`npx drizzle-kit generate\`
- Include command in package.json scripts: \`"migrate": "wrangler d1 migrations apply <DB_NAME>"\`

### 4. Initialize ORM Clients

- Create \`src/db/client.ts\`:

  \`\`\`ts
  import { drizzle } from 'drizzle-orm/d1';
  import { Kysely, D1Dialect } from 'kysely-d1';
  import * as schema from './schema';

  export const initDb = (env: Env) => ({
    drizzle: drizzle(env.DB, { schema }),
    kysely: new Kysely<typeof schema>({
      dialect: new D1Dialect({ database: env.DB }),
    }),
  });
  \`\`\`

- Use this in your Worker's fetch handler or Durable Object context.

### 5. Refactor Queries

- Replace simple CRUD with Drizzle equivalents:

  \`\`\`ts
  await db.drizzle.insert(schema.users).values({ name, email }).run();
  const allUsers = await db.drizzle.select().from(schema.users).all();
  \`\`\`

- Replace dynamic filtering, joins, and reporting logic with Kysely:

  \`\`\`ts
  const { kysely } = db;
  const results = await kysely.selectFrom('users')
    .selectAll()
    .where('email', 'like', \`%\${search}%\`)
    .limit(50)
    .execute();
  \`\`\`

- Preserve original routes, response structures, and business logic.

### 6. Type Inference Unification

- Export Drizzle's inferred types into a shared \`Database\` interface for Kysely:

  \`\`\`ts
  import * as schema from './schema';
  export type Database = {
    users: typeof schema.users.$inferSelect;
    // ... add each table
  };
  \`\`\`

  Update Kysely instantiation to use \`<Database>\` generic.

### 7. Testing & Validation

- Run migrations locally with \`wrangler d1 execute\`.
- Verify identical API outputs pre- and post-refactor.
- Lint and format code; remove direct SQL references.

### 8. Final Cleanup

- Delete legacy raw SQL utilities.
- Document ORM usage in \`README.md\` with examples for both Drizzle and Kysely.
- Ensure type safety passes (\`tsc --noEmit\` clean).

---

### ✅ Deliverables

- \`src/db/schema.ts\`
- \`src/db/client.ts\`
- \`drizzle.config.ts\`
- \`migrations/\` with initial SQL
- Fully refactored Worker code using Drizzle for structure + Kysely for dynamic queries
- CI/CD step running drizzle-kit + wrangler migrations

---

### 💡 Additional Constraints

- The final implementation must be fully compatible with Cloudflare Workers runtime (no Node-only imports).
- Use ESM syntax.
- Avoid heavy dependencies or ORM decorators.
- Respect D1 transaction and query-size limitations.`
};

// Auto-register the template
if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(ORM_POLICY_PROMPT);
}
