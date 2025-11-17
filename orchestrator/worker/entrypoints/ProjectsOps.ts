/**
 * orchestrator/worker/entrypoints/ProjectsOps.ts
 * ------------------------------------------------------------
 * Projects Database Operations RPC Entrypoint
 *
 * Provides RPC methods for database operations on DB_PROJECTS.
 * This entrypoint allows apps/ workers to access the projects database
 * through the orchestrator service binding instead of direct D1 bindings.
 *
 * Responsibilities:
 * - Project requirements operations (CRUD)
 * - Project overview cards operations (CRUD)
 * - Project metadata operations
 *
 * All operations use Drizzle ORM on DB_PROJECTS database.
 * ------------------------------------------------------------
 */

import type { CoreEnv } from '@shared/types/env';
import { BaseWorkerEntrypoint } from '@shared/base/workerEntrypoint';
import { createDatabaseService } from '../database/database';
import { eq, and, desc, asc } from 'drizzle-orm';
import * as schema from '../database/projects/schema';

export interface ProjectRequirementResponse {
    id: number;
    projectId: string;
    version: number;
    section: string;
    title: string;
    description: string | null;
    requirements: any;
    metadata: any;
    changeType: string | null;
    changeReason: string | null;
    agentName: string;
    conversationId: string | null;
    userId: string | null;
    createdAt: number;
    updatedAt: number;
}

export interface ProjectOverviewCardResponse {
    id: number;
    projectId: string;
    conversationId: string;
    title: string;
    description: string | null;
    sections: any;
    version: number;
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

export class ProjectsOps extends BaseWorkerEntrypoint<CoreEnv> {
  private dbService = createDatabaseService(this.env);

  // ========================================
  // PROJECT REQUIREMENTS OPERATIONS
  // ========================================

  /**
     * Get project requirements
     */
  async getProjectRequirements(params: {
        projectId: string;
        version?: number;
        section?: string;
        limit?: number;
        offset?: number;
    }): Promise<PaginatedResponse<ProjectRequirementResponse>> {
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;

    const conditions = [eq(schema.projectRequirements.projectId, params.projectId)];
    if (params.version !== undefined) {
      conditions.push(eq(schema.projectRequirements.version, params.version));
    }
    if (params.section) {
      conditions.push(eq(schema.projectRequirements.section, params.section));
    }

    const requirements = await this.dbService.projects
      .select()
      .from(schema.projectRequirements)
      .where(and(...conditions))
      .orderBy(desc(schema.projectRequirements.version), asc(schema.projectRequirements.section))
      .limit(limit)
      .offset(offset);

    // Get total count
    const allRequirements = await this.dbService.projects
      .select()
      .from(schema.projectRequirements)
      .where(and(...conditions));

    const total = allRequirements.length;

    return {
      data: requirements.map(r => ({
        id: r.id,
        projectId: r.projectId,
        version: r.version,
        section: r.section,
        title: r.title,
        description: r.description ?? null,
        requirements: r.requirements,
        metadata: r.metadata,
        changeType: r.changeType ?? null,
        changeReason: r.changeReason ?? null,
        agentName: r.agentName,
        conversationId: r.conversationId ?? null,
        userId: r.userId ?? null,
        createdAt: r.createdAt ?? Date.now(),
        updatedAt: r.updatedAt ?? Date.now(),
      })),
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    };
  }

  /**
     * Create project requirement
     */
  async createProjectRequirement(params: {
        projectId: string;
        version: number;
        section: string;
        title: string;
        description?: string;
        requirements?: any;
        metadata?: any;
        changeType?: string;
        changeReason?: string;
        agentName?: string;
        conversationId?: string;
        userId?: string;
    }): Promise<{ id: number }> {
    const [requirement] = await this.dbService.projects
      .insert(schema.projectRequirements)
      .values({
        projectId: params.projectId,
        version: params.version,
        section: params.section,
        title: params.title,
        description: params.description ?? null,
        requirements: params.requirements ?? null,
        metadata: params.metadata ?? null,
        changeType: params.changeType ?? null,
        changeReason: params.changeReason ?? null,
        agentName: params.agentName ?? 'project-clarification',
        conversationId: params.conversationId ?? null,
        userId: params.userId ?? null,
      })
      .returning();

    return { id: requirement.id };
  }

  /**
     * Update project requirement
     */
  async updateProjectRequirement(params: {
        id: number;
        title?: string;
        description?: string;
        requirements?: any;
        metadata?: any;
        changeType?: string;
        changeReason?: string;
    }): Promise<{ ok: boolean }> {
    const updateData: Partial<typeof schema.projectRequirements.$inferInsert> = {
      updatedAt: Date.now(),
    };

    if (params.title !== undefined) {
      updateData.title = params.title;
    }
    if (params.description !== undefined) {
      updateData.description = params.description;
    }
    if (params.requirements !== undefined) {
      updateData.requirements = params.requirements;
    }
    if (params.metadata !== undefined) {
      updateData.metadata = params.metadata;
    }
    if (params.changeType !== undefined) {
      updateData.changeType = params.changeType;
    }
    if (params.changeReason !== undefined) {
      updateData.changeReason = params.changeReason;
    }

    await this.dbService.projects
      .update(schema.projectRequirements)
      .set(updateData)
      .where(eq(schema.projectRequirements.id, params.id));

    return { ok: true };
  }

  /**
     * Delete project requirement
     */
  async deleteProjectRequirement(params: { id: number }): Promise<{ ok: boolean }> {
    await this.dbService.projects
      .delete(schema.projectRequirements)
      .where(eq(schema.projectRequirements.id, params.id));

    return { ok: true };
  }

  // ========================================
  // PROJECT OVERVIEW CARDS OPERATIONS
  // ========================================

  /**
     * Get project overview card
     */
  async getProjectOverviewCard(params: {
        projectId: string;
        conversationId: string;
    }): Promise<ProjectOverviewCardResponse | null> {
    const [card] = await this.dbService.projects
      .select()
      .from(schema.projectOverviewCards)
      .where(
        and(
          eq(schema.projectOverviewCards.projectId, params.projectId),
          eq(schema.projectOverviewCards.conversationId, params.conversationId),
        ),
      )
      .limit(1);

    if (!card) {
      return null;
    }

    return {
      id: card.id,
      projectId: card.projectId,
      conversationId: card.conversationId,
      title: card.title,
      description: card.description ?? null,
      sections: card.sections,
      version: card.version ?? 1,
      createdAt: card.createdAt ?? Date.now(),
      updatedAt: card.updatedAt ?? Date.now(),
    };
  }

  /**
     * Upsert project overview card
     */
  async upsertProjectOverviewCard(params: {
        projectId: string;
        conversationId: string;
        title: string;
        description?: string;
        sections: any;
        version?: number;
    }): Promise<{ id: number }> {
    // Check if exists
    const [existing] = await this.dbService.projects
      .select()
      .from(schema.projectOverviewCards)
      .where(
        and(
          eq(schema.projectOverviewCards.projectId, params.projectId),
          eq(schema.projectOverviewCards.conversationId, params.conversationId),
        ),
      )
      .limit(1);

    if (existing) {
      await this.dbService.projects
        .update(schema.projectOverviewCards)
        .set({
          title: params.title,
          description: params.description ?? null,
          sections: params.sections,
          version: params.version ?? existing.version + 1,
          updatedAt: Date.now(),
        })
        .where(eq(schema.projectOverviewCards.id, existing.id));

      return { id: existing.id };
    } else {
      const [card] = await this.dbService.projects
        .insert(schema.projectOverviewCards)
        .values({
          projectId: params.projectId,
          conversationId: params.conversationId,
          title: params.title,
          description: params.description ?? null,
          sections: params.sections,
          version: params.version ?? 1,
        })
        .returning();

      return { id: card.id };
    }
  }

  /**
     * Delete project overview card
     */
  async deleteProjectOverviewCard(params: {
        projectId: string;
        conversationId: string;
    }): Promise<{ ok: boolean }> {
    await this.dbService.projects
      .delete(schema.projectOverviewCards)
      .where(
        and(
          eq(schema.projectOverviewCards.projectId, params.projectId),
          eq(schema.projectOverviewCards.conversationId, params.conversationId),
        ),
      );

    return { ok: true };
  }
}

