# Agent Development Guide - Database Operations

## Overview

This document provides guidance for AI agents working on the core-vibe-hq codebase, specifically regarding database operations and RPC service bindings.

## Architecture: Database Access Pattern

**CRITICAL**: Only the orchestrator worker has direct access to D1 databases. All apps/ workers MUST use orchestrator RPC endpoints for all database operations.

### Database Structure

The orchestrator manages **4 separate D1 databases**:

1. **DB_OPS** - Operations database (users, apps, sessions, apiKeys, templates, rules, operational logs)
   - RPC Entrypoint: `DataOps`
   - Service Binding: `ORCHESTRATOR_DATA`

2. **DB_PROJECTS** - Projects database (project requirements, overview cards, project metadata)
   - RPC Entrypoint: `ProjectsOps`
   - Service Binding: `ORCHESTRATOR_PROJECTS`

3. **DB_CHATS** - Chats database (conversation logs, chat messages, agent interactions)
   - RPC Entrypoint: `ChatsOps`
   - Service Binding: `ORCHESTRATOR_CHATS`

4. **DB_HEALTH** - Health database (health checks, worker monitoring, health logs)
   - RPC Entrypoint: `HealthOps`
   - Service Binding: `ORCHESTRATOR_HEALTH`

### Service Bindings

All service bindings are defined in `@shared/base/wrangler.base.jsonc` and automatically available to all workers that extend this base configuration.

## Adding New Database Operations

### Process: Adding New RPC Methods

When you need to add new database operations, follow this **strict order**:

#### Step 1: Add RPC Method to Orchestrator Entrypoint

1. **Identify the correct entrypoint** based on which database the operation targets:
   - `DB_OPS` → `orchestrator/worker/entrypoints/DataOps.ts`
   - `DB_PROJECTS` → `orchestrator/worker/entrypoints/ProjectsOps.ts`
   - `DB_CHATS` → `orchestrator/worker/entrypoints/ChatsOps.ts`
   - `DB_HEALTH` → `orchestrator/worker/entrypoints/HealthOps.ts`

2. **Add the RPC method** to the appropriate entrypoint class:
   ```typescript
   async yourNewMethod(params: {
       // Define parameters
   }): Promise<YourReturnType> {
       // Use this.dbService.[ops|projects|chats|health] to access the database
       // Use Drizzle ORM for queries
       const result = await this.dbService.ops
           .select()
           .from(schema.yourTable)
           .where(eq(schema.yourTable.id, params.id));
       
       return result;
   }
   ```

3. **Test the method** in the orchestrator context first.

#### Step 2: Update Base Worker Database Service

1. **Update the DataOpsClient type** in `apps/base/worker/database/database.ts`:
   ```typescript
   type DataOpsClient = {
       // ... existing methods
       yourNewMethod: (params: { /* params */ }) => Promise<YourReturnType>;
   };
   ```

2. **Repeat for other databases** if needed:
   - `ProjectsOpsClient` type (if adding to ProjectsOps)
   - `ChatsOpsClient` type (if adding to ChatsOps)
   - `HealthOpsClient` type (if adding to HealthOps)

#### Step 3: Update Data Factory Database Service

1. **Update the same client types** in `apps/factories/data-factory/worker/database/database.ts`

#### Step 4: Use in Services

1. **Access via RPC** in your service classes:
   ```typescript
   // In apps/base or apps/factories/data-factory services
   const result = await this.db.dataOpsClient.yourNewMethod({
       // params
   });
   ```

### Important Rules

1. **NEVER** add direct D1 bindings to apps/ workers
2. **NEVER** use `env.DB` or `env.DB_OPS` directly in apps/ workers
3. **ALWAYS** add RPC methods to orchestrator first
4. **ALWAYS** update client types in base workers after adding orchestrator methods
5. **ALWAYS** use the service binding (`ORCHESTRATOR_*`) to access database operations

### Example: Adding a New User Query

**Step 1 - Orchestrator** (`orchestrator/worker/entrypoints/DataOps.ts`):
```typescript
async getUserByUsername(params: { username: string }): Promise<UserResponse | null> {
    const [user] = await this.dbService.ops
        .select()
        .from(schema.users)
        .where(eq(schema.users.username, params.username))
        .limit(1);
    
    if (!user) return null;
    return this.mapUserToResponse(user);
}
```

**Step 2 - Base Worker** (`apps/base/worker/database/database.ts`):
```typescript
type DataOpsClient = {
    // ... existing methods
    getUserByUsername: (params: { username: string }) => Promise<UserResponse | null>;
};
```

**Step 3 - Data Factory** (`apps/factories/data-factory/worker/database/database.ts`):
```typescript
type DataOpsClient = {
    // ... existing methods
    getUserByUsername: (params: { username: string }) => Promise<UserResponse | null>;
};
```

**Step 4 - Use in Service**:
```typescript
const user = await this.db.dataOpsClient.getUserByUsername({ username: 'john' });
```

## Database Wrappers

The base template (`@shared/base/`) provides database service wrappers that route all operations through orchestrator RPC. These wrappers:

- Provide a compatibility layer for existing code
- Route operations to the correct orchestrator entrypoint
- Handle errors and type conversions
- Ensure all database access goes through RPC

## Migration Notes

When migrating existing code to use RPC:

1. Identify which database the operation targets
2. Check if an RPC method already exists
3. If not, add it following the process above
4. Replace direct Drizzle queries with RPC calls
5. Update types accordingly

## Questions?

- Check existing RPC methods in `orchestrator/worker/entrypoints/`
- Review `@shared/base/wrangler.base.jsonc` for available service bindings
- See `apps/base/worker/database/database.ts` for example client usage

