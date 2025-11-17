# Implementation Prompt: BaseContainerActor

## Goal

Create a `BaseContainerActor` class that extends the Cloudflare Actors framework's `Actor` class to provide container lifecycle management capabilities for vibesdk base template. This will be used by Durable Objects that manage containers (like `UserAppSandboxService` and `CodeGeneratorAgent`).

## Context

- **Location**: `apps/actors/packages/core/src/` contains the Actors framework you copied
- **Target**: Create `apps/base/BaseContainerActor.ts` (or appropriate location in your structure)
- **Purpose**: Base class for Durable Objects that manage containers, providing:
  - Lifecycle hooks (`onInit`, `onDestroy`, `onAlarm`)
  - Storage SQL helpers for container state
  - Alarms helper for scheduled cleanup/health checks
  - Instance tracking for container management

## Implementation Steps

### Step 1: Create BaseContainerActor Class

Create `apps/base/BaseContainerActor.ts`:

```typescript
import { Actor } from '../actors/packages/core/src';
import { Alarms } from '../actors/packages/alarms/src';
import { Storage } from '../actors/packages/storage/src';

/**
 * BaseContainerActor - Base class for Durable Objects managing containers
 * 
 * Provides:
 * - Lifecycle hooks (onInit, onDestroy, onAlarm)
 * - Storage SQL helpers for container state queries
 * - Alarms helper for scheduled tasks (cleanup, health checks)
 * - Instance tracking for container management
 * 
 * Usage:
 *   export class UserAppSandboxService extends BaseContainerActor<Env> {
 *     protected async onInit(): Promise<void> {
 *       // Initialize container management
 *       await this.initializeContainers();
 *     }
 *     
 *     protected async onDestroy(): Promise<void> {
 *       // Cleanup all containers
 *       await this.cleanupAllContainers();
 *     }
 *   }
 */
export abstract class BaseContainerActor<E> extends Actor<E> {
  /**
   * Lifecycle hook: Called after Actor construction, before first request
   * Override to initialize container management, schedule cleanup alarms, etc.
   */
  protected async onInit(): Promise<void> {
    // Default: Schedule container cleanup alarm
    await this.scheduleContainerCleanup();
  }

  /**
   * Lifecycle hook: Called when Actor is being evicted/destroyed
   * Override to cleanup containers, save state, etc.
   */
  protected async onDestroy(): Promise<void> {
    // Default: Cleanup idle containers
    await this.cleanupIdleContainers();
  }

  /**
   * Lifecycle hook: Called when alarm is triggered
   * Override to handle scheduled tasks
   */
  protected async onAlarm(alarmInfo?: AlarmInvocationInfo): Promise<void> {
    // Default: Handle container cleanup alarms
    if (alarmInfo) {
      // Check if this is a container cleanup alarm
      // Handle accordingly
    }
  }

  /**
   * Schedule container cleanup alarm
   * Runs every hour to cleanup idle containers
   */
  protected async scheduleContainerCleanup(): Promise<void> {
    // Schedule cleanup every hour using cron
    await this.alarms.schedule('0 * * * *', 'cleanupIdleContainers', {});
    
    // Schedule health check every 5 minutes
    await this.alarms.schedule(300, 'healthCheckContainers', {});
  }

  /**
   * Cleanup idle containers (called by alarm)
   * Override to implement container-specific cleanup logic
   */
  protected async cleanupIdleContainers(): Promise<void> {
    // Default implementation - override in subclasses
    const idleContainers = await this.getIdleContainers();
    console.log(`Cleaning up ${idleContainers.length} idle containers`);
  }

  /**
   * Health check containers (called by alarm)
   * Override to implement container-specific health checks
   */
  protected async healthCheckContainers(): Promise<void> {
    // Default implementation - override in subclasses
    console.log('Running container health check');
  }

  /**
   * Get idle containers from storage
   * Uses Actors Storage SQL helpers
   */
  protected async getIdleContainers(): Promise<Array<{ id: string; lastActivity: number }>> {
    const idleThreshold = Date.now() - 3600000; // 1 hour ago
    
    // Use Actors Storage SQL helper
    const containers = this.storage.sql<{ id: string; last_activity: number }>`
      SELECT id, last_activity 
      FROM containers 
      WHERE status = 'running' 
      AND last_activity < ${idleThreshold}
    `;
    
    return containers.map(c => ({
      id: c.id,
      lastActivity: c.last_activity
    }));
  }

  /**
   * Track container instance
   * Uses Actors instance tracking
   */
  protected async trackContainer(containerId: string): Promise<void> {
    await this.track(containerId);
  }

  /**
   * Get all tracked container instances
   */
  protected async getTrackedContainers(): Promise<Array<{ identifier: string; last_accessed: string }>> {
    const trackerActor = (this.constructor as any).get('_cf_actors');
    const query = await trackerActor.sql`
      SELECT identifier, last_accessed 
      FROM actors 
      WHERE identifier LIKE 'container-%'
      ORDER BY last_accessed DESC
    `;
    return query;
  }

  /**
   * Store container state in SQL storage
   */
  protected async storeContainerState(containerId: string, state: any): Promise<void> {
    await this.storage.sql`
      INSERT OR REPLACE INTO containers (id, state, last_activity, updated_at)
      VALUES (${containerId}, ${JSON.stringify(state)}, ${Date.now()}, ${Date.now()})
    `;
  }

  /**
   * Get container state from SQL storage
   */
  protected async getContainerState(containerId: string): Promise<any | null> {
    const result = this.storage.sql<{ state: string }>`
      SELECT state FROM containers WHERE id = ${containerId}
    `;
    
    if (result.length === 0) return null;
    
    return JSON.parse(result[0].state);
  }

  /**
   * Initialize container storage schema
   * Call this in onInit() to set up tables
   */
  protected async initializeContainerStorage(): Promise<void> {
    await this.storage.sql`
      CREATE TABLE IF NOT EXISTS containers (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        state TEXT,
        last_activity INTEGER,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `;
    
    await this.storage.sql`
      CREATE INDEX IF NOT EXISTS idx_containers_status ON containers(status)
    `;
    
    await this.storage.sql`
      CREATE INDEX IF NOT EXISTS idx_containers_last_activity ON containers(last_activity)
    `;
  }
}
```

### Step 2: Update Wrangler Configuration

Ensure your `wrangler.jsonc` includes the Actors framework in migrations:

```jsonc
{
  "migrations": [
    {
      "new_sqlite_classes": ["BaseContainerActor", "UserAppSandboxService"],
      "tag": "v1"
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "class_name": "UserAppSandboxService",
        "name": "Sandbox"
      }
    ]
  }
}
```

### Step 3: Example Migration - UserAppSandboxService

Show how to migrate an existing Durable Object to use BaseContainerActor:

```typescript
import { BaseContainerActor } from '../base/BaseContainerActor';
import { handler } from '../actors/packages/core/src';

export class UserAppSandboxService extends BaseContainerActor<Env> {
  // Override lifecycle hooks
  protected async onInit(): Promise<void> {
    // Call parent to schedule cleanup alarms
    await super.onInit();
    
    // Initialize container storage schema
    await this.initializeContainerStorage();
    
    // Your custom initialization
    console.log(`Container actor ${this.name} initialized`);
  }

  protected async onDestroy(): Promise<void> {
    // Cleanup all containers before eviction
    const containers = await this.getAllContainers();
    for (const container of containers) {
      await this.shutdownInstance(container.id);
    }
    
    // Call parent cleanup
    await super.onDestroy();
  }

  protected async cleanupIdleContainers(): Promise<void> {
    // Get idle containers using base class helper
    const idleContainers = await this.getIdleContainers();
    
    for (const container of idleContainers) {
      await this.shutdownInstance(container.id);
      console.log(`Cleaned up idle container: ${container.id}`);
    }
  }

  protected async healthCheckContainers(): Promise<void> {
    // Use storage SQL helper to query containers
    const unhealthy = this.storage.sql`
      SELECT id FROM containers 
      WHERE status = 'running' 
      AND last_activity < ${Date.now() - 300000}
    `;
    
    for (const container of unhealthy) {
      // Check health and update status
      const healthy = await this.checkContainerHealth(container.id);
      if (!healthy) {
        await this.storage.sql`
          UPDATE containers 
          SET status = 'unhealthy' 
          WHERE id = ${container.id}
        `;
      }
    }
  }

  // Your existing methods...
  async createInstance(templateName: string, projectName: string) {
    // Create container
    const instanceId = await this.createContainer(templateName);
    
    // Track it
    await this.trackContainer(`container-${instanceId}`);
    
    // Store state
    await this.storeContainerState(instanceId, {
      templateName,
      projectName,
      status: 'running',
      createdAt: Date.now()
    });
    
    return instanceId;
  }

  async getAllContainers() {
    return this.storage.sql`
      SELECT * FROM containers ORDER BY created_at DESC
    `;
  }
}

export default handler(UserAppSandboxService);
```

## Key Features to Implement

### 1. Lifecycle Hooks
- ✅ `onInit()` - Initialize container management, schedule alarms
- ✅ `onDestroy()` - Cleanup containers before eviction
- ✅ `onAlarm()` - Handle scheduled tasks (cleanup, health checks)

### 2. Storage SQL Helpers
- ✅ Use `this.storage.sql` template literals for container state queries
- ✅ Create container storage schema
- ✅ Store/retrieve container state

### 3. Alarms Helper
- ✅ Schedule container cleanup (cron: every hour)
- ✅ Schedule health checks (every 5 minutes)
- ✅ Handle alarm callbacks

### 4. Instance Tracking
- ✅ Track container instances using `this.track()`
- ✅ Query tracked instances
- ✅ Manage container lifecycle

## Testing Checklist

- [ ] BaseContainerActor extends Actor correctly
- [ ] Lifecycle hooks (`onInit`, `onDestroy`, `onAlarm`) are called
- [ ] Storage SQL helpers work for container state queries
- [ ] Alarms schedule correctly (cleanup, health checks)
- [ ] Instance tracking works for containers
- [ ] Migration from existing Durable Object works
- [ ] Wrangler configuration includes new_sqlite_classes

## Notes

- The Actors framework provides `Actor`, `Alarms`, `Storage` classes
- Import from `apps/actors/packages/[module]/src`
- Use `handler()` function to export the Actor
- Ensure `new_sqlite_classes` includes your Actor class name in migrations
- The `name` property is available after `setName()` is called (handled by framework)

## Reference Files

- `apps/actors/packages/core/src/index.ts` - Actor base class
- `apps/actors/packages/alarms/src/index.ts` - Alarms helper
- `apps/actors/packages/storage/src/index.ts` - Storage SQL helpers
- `apps/actors/examples/lifecycle-hooks/src/index.ts` - Lifecycle hooks example
- `apps/actors/examples/durable-objects/src/index.ts` - Using helpers without Actor class

