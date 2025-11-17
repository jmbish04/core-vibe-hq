# Actors Framework Recommendations Beyond Containers

## Overview

This document identifies additional use cases where the Cloudflare Actors framework patterns would provide significant value beyond container management.

## Current Durable Objects

Based on the codebase analysis, there are **3 main Durable Objects**:

1. **CodeGeneratorAgent** (`SimpleCodeGeneratorAgent`) - Code generation lifecycle
2. **UserAppSandboxService** - Container instance management
3. **DORateLimitStore** - Rate limiting with bucketed sliding window

---

## 1. ✅ DORateLimitStore - Rate Limiting with Scheduled Cleanup

### Current Implementation
- Manual cleanup every 5 minutes (checked on each `increment()` call)
- Manual state persistence (`persistState()`)
- No lifecycle hooks
- No scheduled alarms

### Actors Benefits

#### **Alarms Helper** - Scheduled Cleanup
```typescript
// Current: Manual cleanup check
if (now - this.state.lastCleanup > 5 * 60 * 1000) {
    await this.cleanup(now, Math.max(mainWindow, burstWindow, dailyWindow));
}

// With Actors: Scheduled alarm
protected async onInit(): Promise<void> {
    // Schedule cleanup every 5 minutes
    await this.alarms.schedule(300, 'cleanupExpiredBuckets', {});
}

async cleanupExpiredBuckets() {
    const now = Date.now();
    await this.cleanup(now, this.getMaxWindow());
}
```

#### **Storage SQL Helpers** - Better State Management
```typescript
// Current: Manual Map serialization
private async persistState(): Promise<void> {
    await this.ctx.storage.put('state', {
        buckets: Array.from(this.state.buckets.entries()),
        lastCleanup: this.state.lastCleanup
    });
}

// With Actors: SQL-based storage
protected async initializeRateLimitStorage(): Promise<void> {
    await this.storage.sql`
        CREATE TABLE IF NOT EXISTS rate_limit_buckets (
            bucket_key TEXT PRIMARY KEY,
            count INTEGER NOT NULL,
            timestamp INTEGER NOT NULL
        )
    `;
    
    await this.storage.sql`
        CREATE INDEX IF NOT EXISTS idx_rate_limit_timestamp 
        ON rate_limit_buckets(timestamp)
    `;
}

async increment(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    // Use SQL for queries instead of Map
    const buckets = this.storage.sql`
        SELECT * FROM rate_limit_buckets 
        WHERE bucket_key LIKE ${`${key}:%`}
        AND timestamp > ${Date.now() - config.period * 1000}
    `;
    
    // Calculate counts using SQL
    const count = this.storage.sql`
        SELECT SUM(count) as total 
        FROM rate_limit_buckets 
        WHERE bucket_key LIKE ${`${key}:%`}
        AND timestamp > ${Date.now() - config.period * 1000}
    `;
}
```

### Recommendation: **HIGH VALUE** ⭐⭐⭐
- **Why**: Cleanup scheduling is currently inefficient (checked on every request)
- **Benefit**: Scheduled alarms reduce overhead, SQL storage is more efficient for queries
- **Effort**: Medium (requires migration from Map to SQL storage)

---

## 2. ✅ CodeGeneratorAgent - WebSocket & Lifecycle Management

### Current Implementation
- Uses `Agent` class (similar to Actors but different framework)
- Manual WebSocket handling
- Complex state management with manual persistence
- No lifecycle hooks for initialization/cleanup

### Actors Benefits

#### **WebSocket Helpers** - Simplified WebSocket Management
```typescript
// Current: Manual WebSocket handling
// See: apps/base/worker/agents/core/websocket.ts

// With Actors: Built-in WebSocket helpers
export class CodeGeneratorAgent extends Actor<Env> {
    static configuration(request: Request): ActorConfiguration {
        return {
            sockets: {
                upgradePath: '/ws',
                autoResponse: { ping: 'ping', pong: 'pong' }
            }
        };
    }
    
    protected async onWebSocketUpgrade(request: Request): Promise<Response> {
        // Actors handles WebSocket upgrade automatically
        // Just implement message handling
        return this.sockets.upgrade(request);
    }
    
    protected async onWebSocketMessage(ws: WebSocket, message: string): Promise<void> {
        // Handle WebSocket messages
        const parsed = JSON.parse(message);
        await this.handleWebSocketMessage(parsed);
    }
}
```

#### **Lifecycle Hooks** - Better Initialization
```typescript
// Current: Manual initialization in constructor
constructor(ctx: AgentContext, env: Env) {
    super(ctx, env);
    this.sql`CREATE TABLE IF NOT EXISTS full_conversations...`;
    // ... manual setup
}

// With Actors: Lifecycle hooks
protected async onInit(): Promise<void> {
    // Initialize tables
    await this.initializeConversationStorage();
    
    // Initialize services
    this.stateManager = new StateManager(...);
    this.fileManager = new FileManager(...);
    
    // Schedule cleanup alarms
    await this.alarms.schedule('0 0 * * *', 'cleanupOldConversations', {});
}

protected async onDestroy(): Promise<void> {
    // Save final state
    await this.persistFinalState();
    
    // Cleanup resources
    await this.cleanupResources();
}
```

#### **Storage SQL Helpers** - Better State Queries
```typescript
// Current: Manual SQL via this.sql()
this.sql`CREATE TABLE IF NOT EXISTS full_conversations (id TEXT PRIMARY KEY, messages TEXT)`;

// With Actors: Type-safe SQL helpers
protected async initializeConversationStorage(): Promise<void> {
    await this.storage.sql`
        CREATE TABLE IF NOT EXISTS full_conversations (
            id TEXT PRIMARY KEY,
            messages TEXT NOT NULL,
            created_at INTEGER DEFAULT (unixepoch()),
            updated_at INTEGER DEFAULT (unixepoch())
        )
    `;
    
    await this.storage.sql`
        CREATE INDEX IF NOT EXISTS idx_conversations_updated 
        ON full_conversations(updated_at)
    `;
}

async getRecentConversations(limit: number = 10) {
    return this.storage.sql<{ id: string; messages: string; updated_at: number }>`
        SELECT * FROM full_conversations 
        ORDER BY updated_at DESC 
        LIMIT ${limit}
    `;
}
```

### Recommendation: **MEDIUM VALUE** ⭐⭐
- **Why**: Already uses `Agent` class (similar pattern), but Actors provides better WebSocket helpers
- **Benefit**: Simplified WebSocket management, better lifecycle hooks, SQL helpers
- **Effort**: High (requires migration from `Agent` to `Actor` class)
- **Note**: Only migrate if WebSocket helpers provide significant value

---

## 3. ✅ Session Management - Potential New Durable Object

### Current Implementation
- `SessionService` uses D1 database (not Durable Objects)
- Stateless session management

### Potential Actors Use Case

If you need **stateful session management** with per-session Durable Objects:

```typescript
export class SessionActor extends Actor<Env> {
    protected async onInit(): Promise<void> {
        // Initialize session storage
        await this.initializeSessionStorage();
        
        // Schedule session expiration check
        await this.alarms.schedule(60, 'checkSessionExpiration', {});
    }
    
    protected async onDestroy(): Promise<void> {
        // Cleanup session resources
        await this.cleanupSession();
    }
    
    async checkSessionExpiration() {
        // Check if session expired
        const expired = await this.isSessionExpired();
        if (expired) {
            await this.destroy();
        }
    }
}
```

### Recommendation: **LOW VALUE** ⭐
- **Why**: Current D1-based session management is working fine
- **Benefit**: Only if you need per-session stateful logic
- **Effort**: Medium (new implementation)
- **Note**: Only consider if you need stateful session features

---

## 4. ✅ Task Queue Management - Potential New Durable Object

### Current Implementation
- Task management mentioned in docs but not implemented as DO
- Could benefit from Actors for task orchestration

### Potential Actors Use Case

```typescript
export class TaskQueueActor extends Actor<Env> {
    protected async onInit(): Promise<void> {
        // Initialize task storage
        await this.initializeTaskStorage();
        
        // Schedule task processing
        await this.alarms.schedule(30, 'processPendingTasks', {});
    }
    
    async processPendingTasks() {
        // Get pending tasks
        const tasks = this.storage.sql`
            SELECT * FROM tasks 
            WHERE status = 'pending' 
            ORDER BY priority DESC, created_at ASC 
            LIMIT 10
        `;
        
        // Process tasks
        for (const task of tasks) {
            await this.processTask(task);
        }
    }
}
```

### Recommendation: **MEDIUM VALUE** ⭐⭐
- **Why**: Task queue management could benefit from scheduled processing
- **Benefit**: Scheduled task processing, SQL-based task storage
- **Effort**: Medium (new implementation)
- **Note**: Only if implementing task queue system

---

## 5. ✅ WebSocket Connection Management - CodeGeneratorAgent Enhancement

### Current Implementation
- Manual WebSocket handling in `apps/base/worker/agents/core/websocket.ts`
- Connection tracking and broadcasting

### Actors Benefits

#### **WebSocket Helpers** - Connection Management
```typescript
// Current: Manual connection tracking
private connections: Map<string, Connection> = new Map();

// With Actors: Built-in WebSocket management
export class CodeGeneratorAgent extends Actor<Env> {
    protected async onWebSocketMessage(ws: WebSocket, message: string): Promise<void> {
        // Actors handles connection lifecycle automatically
        const parsed = JSON.parse(message);
        await this.handleMessage(parsed);
    }
    
    protected async broadcastToAll(message: any): Promise<void> {
        // Actors provides WebSocket management
        const connections = this.ctx.getWebSockets();
        for (const ws of connections) {
            ws.send(JSON.stringify(message));
        }
    }
}
```

### Recommendation: **MEDIUM VALUE** ⭐⭐
- **Why**: WebSocket management is complex, Actors simplifies it
- **Benefit**: Automatic connection lifecycle, built-in WebSocket helpers
- **Effort**: Medium (requires migration)
- **Note**: Only if WebSocket complexity is causing issues

---

## Summary Recommendations

| Use Case | Priority | Value | Effort | Recommendation |
|----------|----------|-------|--------|----------------|
| **DORateLimitStore** | HIGH | ⭐⭐⭐ | Medium | ✅ **Migrate** - Scheduled cleanup is inefficient |
| **CodeGeneratorAgent** | MEDIUM | ⭐⭐ | High | ⚠️ **Consider** - Only if WebSocket helpers add value |
| **Session Management** | LOW | ⭐ | Medium | ❌ **Skip** - Current D1-based solution is fine |
| **Task Queue** | MEDIUM | ⭐⭐ | Medium | ⚠️ **Consider** - Only if implementing task queue |
| **WebSocket Management** | MEDIUM | ⭐⭐ | Medium | ⚠️ **Consider** - Only if WebSocket complexity is an issue |

---

## Implementation Priority

### Phase 1: High-Value Migrations
1. ✅ **BaseContainerActor** (already planned)
2. ✅ **DORateLimitStore** - Migrate to Actors for scheduled cleanup

### Phase 2: Medium-Value Considerations
3. ⚠️ **CodeGeneratorAgent** - Evaluate WebSocket helpers value
4. ⚠️ **Task Queue** - If implementing task queue system

### Phase 3: Low Priority
5. ❌ **Session Management** - Skip (D1-based is fine)
6. ❌ **Other use cases** - Evaluate on case-by-case basis

---

## Key Takeaways

1. **DORateLimitStore** is the **highest value** migration after containers
   - Scheduled cleanup is currently inefficient
   - SQL storage would be more efficient than Map serialization

2. **CodeGeneratorAgent** migration is **optional**
   - Already uses similar `Agent` pattern
   - Only migrate if WebSocket helpers provide significant value

3. **New Durable Objects** should use Actors from the start
   - Task queues, session management (if needed), etc.

4. **Focus on BaseContainerActor first**
   - Then evaluate DORateLimitStore migration
   - Then consider CodeGeneratorAgent if WebSocket complexity is an issue

