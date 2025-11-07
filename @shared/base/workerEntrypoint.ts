/**
 * @shared/base/workerEntrypoint.ts
 * 
 * Base class for Worker Entrypoints that provides common functionality
 * like database initialization.
 * 
 * Supports multiple D1 databases:
 * - db (default): DB_OPS - for operation_logs and most operational queries
 * - dbOps: DB_OPS - explicit access to operations database
 * - dbProjects: DB_PROJECTS - for project-related queries
 * - dbChats: DB_CHATS - for chat/conversation queries
 * - dbHealth: DB_HEALTH - for health check queries
 */

import { WorkerEntrypoint } from 'cloudflare:workers'
import { Kysely } from 'kysely'
import { D1Dialect } from 'kysely-d1'
import { Database } from '@shared/types/db'
import { CoreEnv } from '@shared/types/env'

export abstract class BaseWorkerEntrypoint<T extends CoreEnv = CoreEnv> extends WorkerEntrypoint<T> {
  // Default database connection (DB_OPS) - most operations use this
  protected db: Kysely<Database>
  
  // Explicit database connections for different databases
  protected dbOps: Kysely<Database>      // DB_OPS - operations, logs
  protected dbProjects: Kysely<Database>  // DB_PROJECTS - projects, PRDs, requirements
  protected dbChats: Kysely<Database>    // DB_CHATS - conversations
  protected dbHealth: Kysely<Database>    // DB_HEALTH - health checks

  constructor(ctx: ExecutionContext, env: T) {
    super(ctx, env)
    
    // Initialize Kysely database connections for each database
    // Default db points to DB_OPS for backwards compatibility (most operations use operation_logs)
    const dbOpsInstance = new Kysely<Database>({
      dialect: new D1Dialect({ database: env.DB_OPS }),
    })
    
    this.db = dbOpsInstance // Default for backwards compatibility
    this.dbOps = dbOpsInstance
    
    // Initialize other database connections
    this.dbProjects = new Kysely<Database>({
      dialect: new D1Dialect({ database: env.DB_PROJECTS }),
    })
    
    this.dbChats = new Kysely<Database>({
      dialect: new D1Dialect({ database: env.DB_CHATS }),
    })
    
    this.dbHealth = new Kysely<Database>({
      dialect: new D1Dialect({ database: env.DB_HEALTH }),
    })
  }
}
