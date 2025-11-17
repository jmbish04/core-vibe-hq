/**
 * Database Service for Orchestrator
 * Provides Drizzle ORM and Kysely connections for multiple D1 databases
 */

import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import type { Env } from '../types';
import type { Database } from '@shared/types/db';
import type { DB } from '../db/schema';

// Import schemas for each database
import * as mainSchema from './schema'; // Main schema with consolidated health tables
import * as opsSchema from './ops/schema';
import * as projectsSchema from './projects/schema';
import * as chatSchema from './chat/schema';

/**
 * Database Service - Multiple Database Connections
 *
 * Provides database connections for all D1 databases:
 * - DB_OPS: Operations, templates, rules, logs, and main data-factory tables (users, apps, etc.)
 * - DB_PROJECTS: Projects, PRDs, requirements, tasks
 * - DB_CHATS: Chat conversations and agent interactions
 * - DB_HEALTH: Health check results and monitoring data
 *
 * Each database has both Drizzle ORM (for schema-based queries) and Kysely (for type-safe SQL queries)
 */
// Combined schema type for DB_OPS (main schema + ops schema)
type CombinedOpsSchema = typeof mainSchema & typeof opsSchema;

export class DatabaseService {
  // Drizzle ORM database connections
  // DB_OPS combines main schema (data-factory tables) with ops schema
  public readonly ops: DrizzleD1Database<CombinedOpsSchema>;
  public readonly projects: DrizzleD1Database<typeof projectsSchema>;
  public readonly chats: DrizzleD1Database<typeof chatSchema>;
  public readonly health: DrizzleD1Database<typeof healthSchema>;

  // Kysely database connections
  public readonly kyselyOps: Kysely<Database & DB>;
  public readonly kyselyProjects: Kysely<Database>;
  public readonly kyselyChats: Kysely<Database>;
  public readonly kyselyHealth: Kysely<Database>;

  // Raw D1 database instances
  private readonly d1Ops: D1Database;
  private readonly d1Projects: D1Database;
  private readonly d1Chats: D1Database;
  private readonly d1Health: D1Database;

  constructor(env: Env) {
    // Initialize D1 database instances
    this.d1Ops = env.DB_OPS;
    this.d1Projects = env.DB_PROJECTS;
    this.d1Chats = env.DB_CHATS;
    this.d1Health = env.DB_HEALTH;

    // Initialize Drizzle ORM connections
    // DB_OPS includes both main schema (data-factory tables) and ops schema
    // Combine schemas by merging all exports
    const combinedOpsSchema = {
      ...mainSchema,
      ...opsSchema,
    };
    this.ops = drizzle(this.d1Ops, { schema: combinedOpsSchema });
    this.projects = drizzle(this.d1Projects, { schema: projectsSchema });
    this.chats = drizzle(this.d1Chats, { schema: chatSchema });
    this.health = drizzle(this.d1Health, { schema: mainSchema });

    // Initialize Kysely connections for type-safe SQL queries
    this.kyselyOps = new Kysely<Database & DB>({
      dialect: new D1Dialect({ database: this.d1Ops }),
    });
    this.kyselyProjects = new Kysely<Database>({
      dialect: new D1Dialect({ database: this.d1Projects }),
    });
    this.kyselyChats = new Kysely<Database>({
      dialect: new D1Dialect({ database: this.d1Chats }),
    });
    this.kyselyHealth = new Kysely<Database>({
      dialect: new D1Dialect({ database: this.d1Health }),
    });
  }

  /**
     * Get the underlying D1 database instance for operations
     */
  public getD1Ops(): D1Database {
    return this.d1Ops;
  }

  /**
     * Get the underlying D1 database instance for projects
     */
  public getD1Projects(): D1Database {
    return this.d1Projects;
  }

  /**
     * Get the underlying D1 database instance for chats
     */
  public getD1Chats(): D1Database {
    return this.d1Chats;
  }

  /**
     * Get the underlying D1 database instance for health
     */
  public getD1Health(): D1Database {
    return this.d1Health;
  }
}

/**
 * Factory function to create database service instance
 */
export function createDatabaseService(env: Env): DatabaseService {
  return new DatabaseService(env);
}
