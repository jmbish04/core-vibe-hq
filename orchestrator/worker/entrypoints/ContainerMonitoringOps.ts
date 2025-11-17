/**
 * orchestrator/worker/entrypoints/ContainerMonitoringOps.ts
 * ------------------------------------------------------------
 * Container Monitoring Operations RPC Entrypoint
 *
 * Provides RPC methods for container monitoring operations.
 * This entrypoint allows containers to send monitoring data (errors, logs, processes)
 * to the orchestrator for centralized storage and management.
 *
 * Responsibilities:
 * - Store container errors with worker/container identification
 * - Store container logs with worker/container identification
 * - Track container process lifecycle
 * - Retrieve monitoring data for containers
 *
 * All operations use Drizzle ORM on DB_OPS database.
 * ------------------------------------------------------------
 */

import type { CoreEnv } from '@shared/types/env';
import { BaseWorkerEntrypoint } from '@shared/base/workerEntrypoint';
import { createDatabaseService } from '../database/database';
import { eq, and, desc, asc, gte, lte } from 'drizzle-orm';
import * as schema from '../database/ops/schema';

export interface ContainerErrorResponse {
    id: number;
    workerName: string;
    containerName: string | null;
    instanceId: string;
    processId: string;
    errorHash: string;
    timestamp: string;
    level: number;
    message: string;
    rawOutput: string;
    occurrenceCount: number;
    createdAt: number;
}

export interface ContainerLogResponse {
    id: number;
    workerName: string;
    containerName: string | null;
    instanceId: string;
    processId: string;
    sequence: number;
    timestamp: string;
    level: string;
    message: string;
    stream: string;
    source: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: number;
}

export interface ContainerProcessResponse {
    id: number;
    workerName: string;
    containerName: string | null;
    instanceId: string;
    processId: string | null;
    command: string;
    args: string[] | null;
    cwd: string;
    status: string;
    restartCount: number;
    startTime: number | null;
    endTime: number | null;
    exitCode: number | null;
    lastError: string | null;
    env: Record<string, string> | null;
    createdAt: number;
    updatedAt: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        limit: number;
        offset: number;
        total: number;
        hasMore: boolean;
    };
}

export class ContainerMonitoringOps extends BaseWorkerEntrypoint<CoreEnv> {
  private dbService = createDatabaseService(this.env);

  // ========================================
  // CONTAINER ERROR OPERATIONS
  // ========================================

  /**
     * Store a container error
     */
  async storeError(params: {
        workerName: string;
        containerName?: string;
        instanceId: string;
        processId: string;
        errorHash: string;
        timestamp: string;
        level: number;
        message: string;
        rawOutput: string;
    }): Promise<{ id: number; occurrenceCount: number }> {
    // Check if error with same hash already exists for this instance
    const existing = await this.dbService.ops
      .select()
      .from(schema.containerErrors)
      .where(
        and(
          eq(schema.containerErrors.instanceId, params.instanceId),
          eq(schema.containerErrors.errorHash, params.errorHash),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // Increment occurrence count
      const [updated] = await this.dbService.ops
        .update(schema.containerErrors)
        .set({
          occurrenceCount: existing[0].occurrenceCount + 1,
        })
        .where(eq(schema.containerErrors.id, existing[0].id))
        .returning();

      return {
        id: updated.id,
        occurrenceCount: updated.occurrenceCount,
      };
    }

    // Create new error record
    const [error] = await this.dbService.ops
      .insert(schema.containerErrors)
      .values({
        workerName: params.workerName,
        containerName: params.containerName ?? null,
        instanceId: params.instanceId,
        processId: params.processId,
        errorHash: params.errorHash,
        timestamp: params.timestamp,
        level: params.level,
        message: params.message,
        rawOutput: params.rawOutput,
        occurrenceCount: 1,
      })
      .returning();

    return {
      id: error.id,
      occurrenceCount: error.occurrenceCount,
    };
  }

  /**
     * Get container errors
     */
  async getErrors(params: {
        workerName?: string;
        containerName?: string;
        instanceId?: string;
        limit?: number;
        offset?: number;
    }): Promise<PaginatedResponse<ContainerErrorResponse>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const conditions = [];
    if (params.workerName) {
      conditions.push(eq(schema.containerErrors.workerName, params.workerName));
    }
    if (params.containerName) {
      conditions.push(eq(schema.containerErrors.containerName, params.containerName));
    }
    if (params.instanceId) {
      conditions.push(eq(schema.containerErrors.instanceId, params.instanceId));
    }

    const errors = await this.dbService.ops
      .select()
      .from(schema.containerErrors)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.containerErrors.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const allErrors = await this.dbService.ops
      .select()
      .from(schema.containerErrors)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = allErrors.length;

    return {
      data: errors.map(error => ({
        id: error.id,
        workerName: error.workerName,
        containerName: error.containerName,
        instanceId: error.instanceId,
        processId: error.processId,
        errorHash: error.errorHash,
        timestamp: error.timestamp,
        level: error.level,
        message: error.message,
        rawOutput: error.rawOutput,
        occurrenceCount: error.occurrenceCount,
        createdAt: error.createdAt,
      })),
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    };
  }

  // ========================================
  // CONTAINER LOG OPERATIONS
  // ========================================

  /**
     * Store a container log
     */
  async storeLog(params: {
        workerName: string;
        containerName?: string;
        instanceId: string;
        processId: string;
        sequence: number;
        timestamp: string;
        level: string;
        message: string;
        stream: string;
        source?: string;
        metadata?: Record<string, unknown>;
    }): Promise<{ id: number }> {
    const [log] = await this.dbService.ops
      .insert(schema.containerLogs)
      .values({
        workerName: params.workerName,
        containerName: params.containerName ?? null,
        instanceId: params.instanceId,
        processId: params.processId,
        sequence: params.sequence,
        timestamp: params.timestamp,
        level: params.level,
        message: params.message,
        stream: params.stream,
        source: params.source ?? null,
        metadata: params.metadata ?? null,
      })
      .returning();

    return { id: log.id };
  }

  /**
     * Store multiple container logs (batch operation)
     */
  async storeLogs(params: {
        workerName: string;
        containerName?: string;
        instanceId: string;
        processId: string;
        logs: Array<{
            sequence: number;
            timestamp: string;
            level: string;
            message: string;
            stream: string;
            source?: string;
            metadata?: Record<string, unknown>;
        }>;
    }): Promise<{ count: number }> {
    if (params.logs.length === 0) {
      return { count: 0 };
    }

    const values = params.logs.map(log => ({
      workerName: params.workerName,
      containerName: params.containerName ?? null,
      instanceId: params.instanceId,
      processId: params.processId,
      sequence: log.sequence,
      timestamp: log.timestamp,
      level: log.level,
      message: log.message,
      stream: log.stream,
      source: log.source ?? null,
      metadata: log.metadata ?? null,
    }));

    await this.dbService.ops
      .insert(schema.containerLogs)
      .values(values);

    return { count: params.logs.length };
  }

  /**
     * Get container logs
     */
  async getLogs(params: {
        workerName?: string;
        containerName?: string;
        instanceId?: string;
        since?: string;
        until?: string;
        limit?: number;
        offset?: number;
        sortOrder?: 'asc' | 'desc';
    }): Promise<PaginatedResponse<ContainerLogResponse>> {
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;
    const sortOrder = params.sortOrder ?? 'desc';

    const conditions = [];
    if (params.workerName) {
      conditions.push(eq(schema.containerLogs.workerName, params.workerName));
    }
    if (params.containerName) {
      conditions.push(eq(schema.containerLogs.containerName, params.containerName));
    }
    if (params.instanceId) {
      conditions.push(eq(schema.containerLogs.instanceId, params.instanceId));
    }
    if (params.since) {
      conditions.push(gte(schema.containerLogs.timestamp, params.since));
    }
    if (params.until) {
      conditions.push(lte(schema.containerLogs.timestamp, params.until));
    }

    const orderBy = sortOrder === 'asc'
      ? asc(schema.containerLogs.timestamp)
      : desc(schema.containerLogs.timestamp);

    const logs = await this.dbService.ops
      .select()
      .from(schema.containerLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Get total count
    const allLogs = await this.dbService.ops
      .select()
      .from(schema.containerLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = allLogs.length;

    return {
      data: logs.map(log => ({
        id: log.id,
        workerName: log.workerName,
        containerName: log.containerName,
        instanceId: log.instanceId,
        processId: log.processId,
        sequence: log.sequence,
        timestamp: log.timestamp,
        level: log.level,
        message: log.message,
        stream: log.stream,
        source: log.source,
        metadata: log.metadata as Record<string, unknown> | null,
        createdAt: log.createdAt,
      })),
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    };
  }

  // ========================================
  // CONTAINER PROCESS OPERATIONS
  // ========================================

  /**
     * Create or update a container process
     */
  async upsertProcess(params: {
        workerName: string;
        containerName?: string;
        instanceId: string;
        processId?: string;
        command: string;
        args?: string[];
        cwd: string;
        status: string;
        restartCount?: number;
        startTime?: number;
        endTime?: number;
        exitCode?: number;
        lastError?: string;
        env?: Record<string, string>;
    }): Promise<{ id: number }> {
    // Check if process exists
    const existing = await this.dbService.ops
      .select()
      .from(schema.containerProcesses)
      .where(eq(schema.containerProcesses.instanceId, params.instanceId))
      .limit(1);

    const processData = {
      workerName: params.workerName,
      containerName: params.containerName ?? null,
      instanceId: params.instanceId,
      processId: params.processId ?? null,
      command: params.command,
      args: params.args ?? null,
      cwd: params.cwd,
      status: params.status,
      restartCount: params.restartCount ?? 0,
      startTime: params.startTime ? new Date(params.startTime) : null,
      endTime: params.endTime ? new Date(params.endTime) : null,
      exitCode: params.exitCode ?? null,
      lastError: params.lastError ?? null,
      env: params.env ?? null,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      // Update existing process
      const [updated] = await this.dbService.ops
        .update(schema.containerProcesses)
        .set(processData)
        .where(eq(schema.containerProcesses.instanceId, params.instanceId))
        .returning();

      return { id: updated.id };
    }

    // Create new process
    const [created] = await this.dbService.ops
      .insert(schema.containerProcesses)
      .values({
        ...processData,
        createdAt: new Date(),
      })
      .returning();

    return { id: created.id };
  }

  /**
     * Get container process by instance ID
     */
  async getProcess(params: {
        instanceId: string;
    }): Promise<ContainerProcessResponse | null> {
    const [process] = await this.dbService.ops
      .select()
      .from(schema.containerProcesses)
      .where(eq(schema.containerProcesses.instanceId, params.instanceId))
      .limit(1);

    if (!process) {
      return null;
    }

    return {
      id: process.id,
      workerName: process.workerName,
      containerName: process.containerName,
      instanceId: process.instanceId,
      processId: process.processId,
      command: process.command,
      args: process.args as string[] | null,
      cwd: process.cwd,
      status: process.status,
      restartCount: process.restartCount,
      startTime: process.startTime ? process.startTime.getTime() : null,
      endTime: process.endTime ? process.endTime.getTime() : null,
      exitCode: process.exitCode,
      lastError: process.lastError,
      env: process.env as Record<string, string> | null,
      createdAt: process.createdAt,
      updatedAt: process.updatedAt,
    };
  }

  /**
     * Get container processes
     */
  async getProcesses(params: {
        workerName?: string;
        containerName?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<PaginatedResponse<ContainerProcessResponse>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const conditions = [];
    if (params.workerName) {
      conditions.push(eq(schema.containerProcesses.workerName, params.workerName));
    }
    if (params.containerName) {
      conditions.push(eq(schema.containerProcesses.containerName, params.containerName));
    }
    if (params.status) {
      conditions.push(eq(schema.containerProcesses.status, params.status));
    }

    const processes = await this.dbService.ops
      .select()
      .from(schema.containerProcesses)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.containerProcesses.updatedAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const allProcesses = await this.dbService.ops
      .select()
      .from(schema.containerProcesses)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = allProcesses.length;

    return {
      data: processes.map(process => ({
        id: process.id,
        workerName: process.workerName,
        containerName: process.containerName,
        instanceId: process.instanceId,
        processId: process.processId,
        command: process.command,
        args: process.args as string[] | null,
        cwd: process.cwd,
        status: process.status,
        restartCount: process.restartCount,
        startTime: process.startTime ? process.startTime.getTime() : null,
        endTime: process.endTime ? process.endTime.getTime() : null,
        exitCode: process.exitCode,
        lastError: process.lastError,
        env: process.env as Record<string, string> | null,
        createdAt: process.createdAt,
        updatedAt: process.updatedAt,
      })),
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    };
  }
}

