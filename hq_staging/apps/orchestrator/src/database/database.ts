/**
 * Database Service for Orchestrator
 * Provides Drizzle ORM connections for multiple D1 databases
 */

import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { Env } from '../types';

// Import schemas for each database
import * as opsSchema from './ops/schema';
import * as projectsSchema from './projects/schema';
import * as chatSchema from './chat/schema';
import * as healthSchema from './health/schema';

/**
 * Database Service - Multiple Database Connections
 * 
 * Provides database connections for all D1 databases:
 * - DB_OPS: Operations, templates, rules, logs
 * - DB_PROJECTS: Projects, PRDs, requirements, tasks
 * - DB_CHATS: Chat conversations and agent interactions
 * - DB_HEALTH: Health check results and monitoring data
 */
export class DatabaseService {
    // Database connections
    public readonly ops: DrizzleD1Database<typeof opsSchema>;
    public readonly projects: DrizzleD1Database<typeof projectsSchema>;
    public readonly chats: DrizzleD1Database<typeof chatSchema>;
    public readonly health: DrizzleD1Database<typeof healthSchema>;

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
        this.ops = drizzle(this.d1Ops, { schema: opsSchema });
        this.projects = drizzle(this.d1Projects, { schema: projectsSchema });
        this.chats = drizzle(this.d1Chats, { schema: chatSchema });
        this.health = drizzle(this.d1Health, { schema: healthSchema });
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
