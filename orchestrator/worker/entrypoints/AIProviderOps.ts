import type { ExecutionContext } from '@cloudflare/workers-types';
import type { CoreEnv, Env } from '@shared/types/env';
import { BaseWorkerEntrypoint } from '@shared/base/workerEntrypoint';
import { AIProviderRouter, ProviderSelectionCriteria } from '../services/ai-providers/router';
import { SecretService } from '../services/secrets/secretService';
import { CLIAgentService } from '../services/ai-providers/cli/cliAgentService';
import { createDatabaseService } from '../database/database';
import { eq, desc } from 'drizzle-orm';
import * as schema from '../database/schema';

/**
 * AIProviderOps entrypoint handles AI provider operations and task execution
 * providing RPC methods for provider assignment, task execution, and status checking.
 */
export class AIProviderOps extends BaseWorkerEntrypoint<Env> {
  private readonly logger = console;
  private providerRouter: AIProviderRouter;
  private secretService: SecretService;
  private cliAgentService: CLIAgentService;
  private dbService = createDatabaseService(this.env);

  constructor(ctx: ExecutionContext, env: Env) {
    super(ctx, env);
    this.providerRouter = new AIProviderRouter(this.logger, env);
    this.secretService = new SecretService(env);
    this.cliAgentService = new CLIAgentService(env, this.secretService);
  }

  /**
   * Assigns an AI provider to a task based on task requirements or manual preference
   * @param taskId The ID of the task to assign a provider for
   * @param criteria Optional criteria to override automatic selection
   * @param manualProvider Optional manual provider selection
   * @returns Provider assignment result
   */
  async assignProvider(params: {
    taskId: string;
    criteria?: Partial<ProviderSelectionCriteria>;
    manualProvider?: string;
  }): Promise<{
    success: boolean;
    providerId?: string;
    confidence?: number;
    reason?: string;
    error?: string;
  }> {
    try {
      const { taskId, criteria = {}, manualProvider } = params;

      // Build complete criteria for provider selection
      const selectionCriteria: ProviderSelectionCriteria = {
        taskType: criteria.taskType || 'generate',
        sourceContext: {
          isGitHub: criteria.sourceContext?.isGitHub ?? false,
          repoName: criteria.sourceContext?.repoName,
          branchName: criteria.sourceContext?.branchName,
          isLocalFactory: criteria.sourceContext?.isLocalFactory ?? true,
        },
        priority: criteria.priority || 'medium',
        costProfile: criteria.costProfile || 'balanced',
        preferredModel: criteria.preferredModel,
        manualOverride: manualProvider,
      };

      const result = await this.providerRouter.selectProvider(selectionCriteria);

      if (!result) {
        return {
          success: false,
          error: 'No suitable AI provider found for the given criteria',
        };
      }

      // Persist the assignment to database
      try {
        await this.dbService.ops.insert(schema.aiProviderAssignments).values({
          patchId: taskId,
          providerId: result.provider.id,
          status: 'assigned',
          priority: criteria.priority === 'high' ? 3 : criteria.priority === 'medium' ? 2 : 1,
          metadata: JSON.stringify({
            confidence: result.confidence,
            reason: result.reason,
            criteria,
            assignedAt: new Date().toISOString(),
          }),
        });

        this.logger.info(`Assigned and persisted provider ${result.provider.id} to task ${taskId}`, {
          taskId,
          providerId: result.provider.id,
          confidence: result.confidence,
          reason: result.reason,
        });

      } catch (dbError) {
        this.logger.error(`Failed to persist assignment for task ${taskId}:`, dbError);
        // Don't fail the assignment if persistence fails, but log it
      }

      return {
        success: true,
        providerId: result.provider.id,
        confidence: result.confidence,
        reason: result.reason,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to assign provider for task ${params.taskId}:`, error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Executes an AI task using the assigned or specified provider
   * @param taskId The ID of the task to execute
   * @param prompt The prompt/text to process
   * @param providerId Optional specific provider to use
   * @param options Additional execution options
   * @returns Task execution result
   */
  async executeTask(params: {
    taskId: string;
    prompt: string;
    providerId?: string;
    options?: {
      temperature?: number;
      maxTokens?: number;
      timeout?: number;
    };
  }): Promise<{
    success: boolean;
    result?: any;
    providerId?: string;
    executionTime?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const { taskId, prompt, providerId, options = {} } = params;

      // If no specific provider, assign one automatically
      let targetProviderId = providerId;
      if (!targetProviderId) {
        const assignment = await this.assignProvider({
          taskId,
          criteria: {
            taskType: 'generate', // Default task type
            priority: 'medium',
          },
        });

        if (!assignment.success || !assignment.providerId) {
          return {
            success: false,
            error: assignment.error || 'Failed to assign provider',
          };
        }

        targetProviderId = assignment.providerId;
      }

      // Get provider credentials
      const credentials = this.secretService.getLLMCredentials();

      // Prepare CLI command for AI execution
      const cliOptions = {
        command: 'ai-execute',
        args: [
          '--provider', targetProviderId,
          '--prompt', prompt,
          '--task-id', taskId,
        ],
        environmentVariables: {
          ...credentials,
          TEMPERATURE: options.temperature?.toString() || '0.7',
          MAX_TOKENS: options.maxTokens?.toString() || '1000',
        },
        timeout: options.timeout || 30000,
        outputFormat: 'json' as const,
      };

      // Update assignment status to in-progress
      try {
        await this.updateAssignmentStatus({
          assignmentId: await this.getLatestAssignmentId(taskId),
          status: 'in-progress',
        });
      } catch (statusError) {
        this.logger.warn(`Failed to update assignment status for task ${taskId}:`, statusError);
      }

      const cliResult = await this.cliAgentService.executeCommand(cliOptions);

      const executionTime = Date.now() - startTime;
      const completedAt = new Date().toISOString();

      // Create execution record
      try {
        const assignmentId = await this.getLatestAssignmentId(taskId);
        await this.dbService.ops.insert(schema.aiProviderExecutions).values({
          assignmentId,
          startedAt: Math.floor(startTime / 1000), // Convert to Unix timestamp
          completedAt: Math.floor(Date.now() / 1000), // Convert to Unix timestamp
          status: cliResult.success ? 'completed' : 'failed',
          result: cliResult.success ? cliResult.output : null,
          error: cliResult.success ? null : cliResult.error,
          executionTimeMs: executionTime,
          metadata: JSON.stringify({
            providerId: targetProviderId,
            options,
            executionTime,
          }),
        } as any);
      } catch (telemetryError) {
        this.logger.error(`Failed to record execution telemetry for task ${taskId}:`, telemetryError);
        // Don't fail the execution if telemetry fails
      }

      if (!cliResult.success) {
        // Update assignment status to failed
        try {
          await this.updateAssignmentStatus({
            assignmentId: await this.getLatestAssignmentId(taskId),
            status: 'failed',
            metadata: { error: cliResult.error, executionTime },
          });
        } catch (statusError) {
          this.logger.warn(`Failed to update assignment status to failed for task ${taskId}:`, statusError);
        }

        this.logger.error(`AI task execution failed for task ${taskId}`, {
          taskId,
          providerId: targetProviderId,
          executionTime,
          error: cliResult.error,
        });

        return {
          success: false,
          error: cliResult.error || 'AI execution failed',
          providerId: targetProviderId,
          executionTime,
        };
      }

      // Update assignment status to completed
      try {
        await this.updateAssignmentStatus({
          assignmentId: await this.getLatestAssignmentId(taskId),
          status: 'completed',
          metadata: { executionTime, resultSize: cliResult.output?.length },
        });
      } catch (statusError) {
        this.logger.warn(`Failed to update assignment status to completed for task ${taskId}:`, statusError);
      }

      this.logger.info(`AI task executed successfully for task ${taskId}`, {
        taskId,
        providerId: targetProviderId,
        executionTime,
        resultSize: cliResult.output?.length,
      });

      return {
        success: true,
        result: cliResult.output,
        providerId: targetProviderId,
        executionTime,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to execute AI task ${params.taskId}:`, error);
      return {
        success: false,
        error: errorMessage,
        executionTime,
      };
    }
  }

  /**
   * Checks the status and availability of AI providers
   * @param providerId Optional specific provider to check
   * @returns Provider status information
   */
  async checkProviderStatus(params: {
    providerId?: string;
  } = {}): Promise<{
    success: boolean;
    providers?: Array<{
      id: string;
      available: boolean;
      costTier: string;
      capabilities: string[];
      lastChecked?: Date;
    }>;
    error?: string;
  }> {
    try {
      const { providerId } = params;

      if (providerId) {
        // Check specific provider
        const providers = this.providerRouter.getProviders();
        const provider = providers.find(p => p.id === providerId);

        if (!provider) {
          return {
            success: false,
            error: `Provider '${providerId}' not found`,
          };
        }

        const isAvailable = await provider.isAvailable();

        return {
          success: true,
          providers: [{
            id: provider.id,
            available: isAvailable,
            costTier: provider.costTier,
            capabilities: provider.capabilities.taskTypes,
            lastChecked: new Date(),
          }],
        };
      } else {
        // Check all providers
        const providers = this.providerRouter.getProviders();
        const statusPromises = providers.map(async (provider) => {
          const isAvailable = await provider.isAvailable();
          return {
            id: provider.id,
            available: isAvailable,
            costTier: provider.costTier,
            capabilities: provider.capabilities.taskTypes,
            lastChecked: new Date(),
          };
        });

        const providerStatuses = await Promise.all(statusPromises);

        return {
          success: true,
          providers: providerStatuses,
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to check provider status:', error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Lists all available AI providers with their capabilities
   * @param filter Optional filter criteria
   * @returns List of available providers
   */
  async listAvailableProviders(params: {
    taskType?: string;
    costProfile?: string;
  } = {}): Promise<{
    success: boolean;
    providers?: Array<{
      id: string;
      name: string;
      costTier: string;
      capabilities: {
        taskTypes: string[];
        contextTypes: string[];
        priorityLevels: string[];
      };
      estimatedCost?: number;
    }>;
    error?: string;
  }> {
    try {
      const { taskType, costProfile } = params;

      let providers = this.providerRouter.getProviders();

      // Apply filters if specified
      if (taskType) {
        providers = providers.filter(p =>
          p.capabilities.taskTypes.includes(taskType as any),
        );
      }

      if (costProfile) {
        // Simple cost filtering - could be enhanced
        const costTiers = { 'economy': ['low'], 'balanced': ['low', 'medium'], 'performance': ['medium', 'high'] };
        const allowedTiers = costTiers[costProfile as keyof typeof costTiers] || [];
        providers = providers.filter(p => allowedTiers.includes(p.costTier));
      }

      const providerList = providers.map(provider => ({
        id: provider.id,
        name: provider.name,
        costTier: provider.costTier,
        capabilities: {
          taskTypes: provider.capabilities.taskTypes,
          contextTypes: provider.capabilities.contextTypes,
          priorityLevels: provider.capabilities.priorityLevels,
        },
        estimatedCost: provider.getEstimatedCost(1000), // Estimate for 1000 tokens
      }));

      return {
        success: true,
        providers: providerList,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to list available providers:', error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Gets provider statistics and system health
   * @returns Provider system statistics
   */
  async getProviderStats(): Promise<{
    success: boolean;
    stats?: {
      totalProviders: number;
      availableProviders: number;
      utilizationByTier: Record<string, number>;
      capabilities: Record<string, number>;
    };
    error?: string;
  }> {
    try {
      const stats = await this.providerRouter.getProviderStats();

      // Enhance with additional system stats
      const providers = this.providerRouter.getProviders();
      const utilizationByTier: Record<string, number> = {};
      const capabilities: Record<string, number> = {};

      providers.forEach(provider => {
        // Count by cost tier
        utilizationByTier[provider.costTier] = (utilizationByTier[provider.costTier] || 0) + 1;

        // Count capabilities
        provider.capabilities.taskTypes.forEach(taskType => {
          capabilities[taskType] = (capabilities[taskType] || 0) + 1;
        });
      });

      return {
        success: true,
        stats: {
          totalProviders: stats.total,
          availableProviders: stats.available,
          utilizationByTier,
          capabilities,
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get provider stats:', error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get assignment history for a task/patch
   */
  async getAssignmentHistory(params: { patchId: string }): Promise<{
    success: boolean;
    assignments?: Array<{
      id: number;
      providerId: string;
      status: string;
      priority: number;
      assignedAt: string;
      metadata?: any;
    }>;
    error?: string;
  }> {
    try {
      const assignments = await this.dbService.ops
        .select({
          id: schema.aiProviderAssignments.id,
          providerId: schema.aiProviderAssignments.providerId,
          status: schema.aiProviderAssignments.status,
          priority: schema.aiProviderAssignments.priority,
          createdAt: schema.aiProviderAssignments.createdAt,
          metadata: schema.aiProviderAssignments.metadata,
        })
        .from(schema.aiProviderAssignments)
        .where(eq(schema.aiProviderAssignments.patchId, params.patchId))
        .orderBy(desc(schema.aiProviderAssignments.createdAt));

      return {
        success: true,
        assignments: assignments.map(assignment => ({
          id: assignment.id,
          providerId: assignment.providerId,
          status: assignment.status,
          priority: assignment.priority || 0,
          assignedAt: assignment.createdAt?.toISOString() || '',
          metadata: assignment.metadata ? JSON.parse(assignment.metadata as string) : undefined,
        })),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get assignment history for patch ${params.patchId}:`, error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Cancel an assignment
   */
  async cancelAssignment(params: { assignmentId: number }): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const [existing] = await this.dbService.ops
        .select({ metadata: schema.aiProviderAssignments.metadata })
        .from(schema.aiProviderAssignments)
        .where(eq(schema.aiProviderAssignments.id, params.assignmentId))
        .limit(1);

      const updatedMetadata = existing?.metadata ?
        { ...JSON.parse(existing.metadata as string), cancelledAt: new Date().toISOString() } :
        { cancelledAt: new Date().toISOString() };

      await this.dbService.ops
        .update(schema.aiProviderAssignments)
        .set({
          status: 'cancelled',
          metadata: JSON.stringify(updatedMetadata),
        })
        .where(eq(schema.aiProviderAssignments.id, params.assignmentId));

      this.logger.info(`Cancelled assignment ${params.assignmentId}`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to cancel assignment ${params.assignmentId}:`, error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Update assignment status
   */
  async updateAssignmentStatus(params: {
    assignmentId: number;
    status: 'assigned' | 'in-progress' | 'completed' | 'failed' | 'cancelled';
    metadata?: Record<string, any>;
  }): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const [existing] = await this.dbService.ops
        .select({ metadata: schema.aiProviderAssignments.metadata })
        .from(schema.aiProviderAssignments)
        .where(eq(schema.aiProviderAssignments.id, params.assignmentId))
        .limit(1);

      const updatedMetadata = existing?.metadata ?
        { ...JSON.parse(existing.metadata as string), ...params.metadata, updatedAt: new Date().toISOString() } :
        { ...params.metadata, updatedAt: new Date().toISOString() };

      await this.dbService.ops
        .update(schema.aiProviderAssignments)
        .set({
          status: params.status,
          metadata: params.metadata ? JSON.stringify(updatedMetadata) : undefined,
        })
        .where(eq(schema.aiProviderAssignments.id, params.assignmentId));

      this.logger.info(`Updated assignment ${params.assignmentId} status to ${params.status}`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update assignment ${params.assignmentId} status:`, error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get the latest assignment ID for a task/patch
   */
  private async getLatestAssignmentId(patchId: string): Promise<number> {
    const assignments = await this.dbService.ops
      .select({ id: schema.aiProviderAssignments.id })
      .from(schema.aiProviderAssignments)
      .where(eq(schema.aiProviderAssignments.patchId, patchId))
      .orderBy(desc(schema.aiProviderAssignments.createdAt))
      .limit(1);

    if (!assignments || assignments.length === 0) {
      throw new Error(`No assignment found for patch ${patchId}`);
    }

    return assignments[0].id;
  }
}
