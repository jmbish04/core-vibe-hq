# Database Migrations

All database migrations for the shared `vibesdk-db` database are consolidated in `orchestrator/migrations/`.

## Migration Strategy

We use **Drizzle ORM** for schema definitions and **Drizzle Kit** to generate migrations:

1. **Define schemas in Drizzle** (`orchestrator/worker/database/schema.ts`)
2. **Generate migrations** using `npm run db:generate` (runs `drizzle-kit generate`)
3. **Apply migrations** using `npm run db:migrate:local` or `npm run db:migrate:remote`

## Current Migrations

### Manual SQL Migrations (Legacy)
These were created before full Drizzle adoption. They will remain for historical reference but new changes should use Drizzle:

- `002_ops_tables.sql` - Ops conflict resolutions, delivery reports, orders
- `003_health_check_tables.sql` - Health check system tables
- `004_agent_tables.sql` - Agent and project management tables

### Drizzle-Generated Migrations
When you run `npm run db:generate`, Drizzle Kit will create new migration files here based on changes in `schema.ts`.

## Database Schema

All table definitions are in `orchestrator/worker/database/schema.ts` using Drizzle ORM:

- **Operational Tracking**: `followups`, `operationLogs`
- **Agent & Project Management**: `projectRequirements`, `conversationLogs`, `projectOverviewCards`
- **Ops Management**: `opsConflictResolutions`, `opsDeliveryReports`, `opsOrders`
- **Health Checks**: `healthChecks`, `workerHealthChecks`, `healthCheckSchedules`

## Shared Database

All workers use the same D1 database, but **only the orchestrator has direct D1 access**:
- **Database Name**: `vibesdk-db`
- **Database ID**: `c4721a2b-b96a-428a-8b2a-b3d255b307e9`
- **Migrations Directory**: `orchestrator/migrations`

**Important**: Factories under `apps/` must access the database via orchestrator service bindings (RPC entrypoints), not direct D1 bindings.

## Usage

```bash
# Generate new migrations from schema changes
npm run db:generate

# Apply migrations locally
npm run db:migrate:local

# Apply migrations to remote
npm run db:migrate:remote
```

## Notes

- **Data Factory**: Has its own schema (`apps/data-factory/worker/database/schema.ts`) with users, apps, etc. These tables are managed separately but share the same database. Data factory accesses the database via orchestrator service bindings.
- **Legacy SQL Migrations**: The existing SQL migrations (002, 003, 004) remain for historical reference. New changes should use Drizzle schema definitions and generate migrations automatically.
- **Index Naming**: All indexes use consistent naming: `{table_name}_{column_name}_idx` matching Drizzle conventions.

