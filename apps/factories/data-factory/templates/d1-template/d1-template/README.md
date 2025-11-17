# Worker + D1 Database (Drizzle + Kysely ORM)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/d1-template)

![Worker + D1 Template Preview](https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/cb7cb0a9-6102-4822-633c-b76b7bb25900/public)

<!-- dash-content-start -->

D1 is Cloudflare's native serverless SQL database ([docs](https://developers.cloudflare.com/d1/)). This project demonstrates the **Drizzle + Kysely hybrid ORM standard** for type-safe, high-performance edge data access.

## 🧭 ORM Architecture

This template follows the **Drizzle + Kysely hybrid standard**:

- **Drizzle ORM**: Schema definition, type inference, and migrations
- **Kysely**: Dynamic query composition and advanced SQL operations
- **Type Safety**: Full TypeScript inference across the entire data layer

### Query Examples

**Simple CRUD with Drizzle:**
```ts
const comments = await db.drizzle.select().from(schema.comments).limit(3);
const newComment = await db.drizzle.insert(schema.comments).values(data).returning();
```

**Dynamic queries with Kysely:**
```ts
const results = await db.kysely
  .selectFrom('comments')
  .selectAll()
  .where('author', 'like', `%${search}%`)
  .orderBy('created_at', 'desc')
  .limit(10)
  .execute();
```

The D1 database is initialized with a `comments` table and sample data.

> [!IMPORTANT]
> When using C3 to create this project, select "no" when it asks if you want to deploy. You need to follow this project's [setup steps](https://github.com/cloudflare/templates/tree/main/d1-template#setup-steps) before deploying.

<!-- dash-content-end -->

## Getting Started

Outside of this repo, you can start a new project with this template using [C3](https://developers.cloudflare.com/pages/get-started/c3/) (the `create-cloudflare` CLI):

```
npm create cloudflare@latest -- --template=cloudflare/templates/d1-template
```

A live public deployment of this template is available at [https://d1-template.templates.workers.dev](https://d1-template.templates.workers.dev)

## Setup Steps

1. Install the project dependencies with a package manager of your choice:
   ```bash
   npm install
   ```
2. Create a [D1 database](https://developers.cloudflare.com/d1/get-started/) with the name "d1-template-database":
   ```bash
   npx wrangler d1 create d1-template-database
   ```
   ...and update the `database_id` field in `wrangler.json` with the new database ID.
3. Generate and apply migrations to initialize the database:
   ```bash
   # Generate migration from schema (if needed)
   npm run migrate:generate

   # Apply migrations locally
   npm run migrate:local

   # Apply migrations to production
   npm run migrate:remote
   ```
4. Deploy the project!
   ```bash
   npx wrangler deploy
   ```

## 🧩 ORM Architecture Details

### File Structure
```
src/
├── db/
│   ├── schema.ts     # Drizzle schema definition
│   └── client.ts     # Drizzle + Kysely clients
├── index.ts          # Main worker logic
└── renderHtml.ts     # HTML rendering utility

drizzle.config.ts     # Drizzle configuration
migrations/           # SQL migration files
```

### Schema Definition (`src/db/schema.ts`)
- Defines all tables using Drizzle's `sqliteTable`
- Exports inferred TypeScript types
- Single source of truth for table structure

### Client Initialization (`src/db/client.ts`)
- Initializes both Drizzle and Kysely clients
- Shares the same D1 database connection
- Exports unified client interface

### Migration Workflow
- Define schema changes in `schema.ts`
- Run `npm run migrate:generate` to create SQL migrations
- Run `npm run migrate:local` or `npm run migrate:remote` to apply
- Migrations are committed to version control

### Query Patterns
- **Drizzle**: Simple CRUD, static queries, transactions
- **Kysely**: Dynamic filtering, joins, complex aggregations
- Both share the same type definitions for consistency
