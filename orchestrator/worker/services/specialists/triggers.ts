/**
 * Specialist Triggers Service
 *
 * Handles trigger detection and specialist queue enqueuing.
 * Monitors various system events and determines when to invoke specialists.
 */

import { SpecialistQueueManager, QueueTriggerEvent } from './queueManager';
import type { StructuredLogger } from '../../types';

export interface CodeGenerationEvent {
  orderId: string;
  factoryType: string;
  filesGenerated: number;
  totalLinesGenerated: number;
  templateUsed: string;
}

export interface LintErrorEvent {
  projectId: string;
  errorCount: number;
  errorTypes: string[];
  filesAffected: string[];
}

export interface DependencyChangeEvent {
  projectId: string;
  packageName: string;
  oldVersion: string;
  newVersion: string;
  changeType: 'patch' | 'minor' | 'major';
}

export class SpecialistTriggers {
  constructor(
    private queueManager: SpecialistQueueManager,
    private logger: StructuredLogger
  ) {}

  /**
   * Handle code generation completion event
   */
  async onCodeGenerationComplete(event: CodeGenerationEvent): Promise<void> {
    try {
      // Trigger DocString Architect for significant code generation
      if (event.totalLinesGenerated >= 50) {
        const triggerEvent: QueueTriggerEvent = {
          specialistType: 'docstring-architect',
          triggerEvent: 'code-generation-complete',
          payload: {
            orderId: event.orderId,
            factoryType: event.factoryType,
            filesGenerated: event.filesGenerated,
            totalLinesGenerated: event.totalLinesGenerated,
            templateUsed: event.templateUsed,
          },
          triggeredBy: 'factory-agent',
          orderId: event.orderId,
          priority: event.totalLinesGenerated >= 200 ? 2 : 1, // High priority for large generations
        };

        const result = await this.queueManager.triggerSpecialist(triggerEvent);
        if (result.success) {
          this.logger.info('Triggered DocString Architect for code generation', {
            orderId: event.orderId,
            queueId: result.queueId,
            linesGenerated: event.totalLinesGenerated,
          });
        } else {
          this.logger.warn('Failed to trigger DocString Architect', {
            orderId: event.orderId,
            reason: result.error,
          });
        }
      }
    } catch (error) {
      this.logger.error('Error handling code generation completion', {
        event,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle lint errors detected event
   */
  async onLintErrorsDetected(event: LintErrorEvent): Promise<void> {
    try {
      // Trigger Lint Surgeon for multiple lint errors
      if (event.errorCount >= 3) {
        const triggerEvent: QueueTriggerEvent = {
          specialistType: 'lint-surgeon',
          triggerEvent: 'lint-errors-detected',
          payload: {
            projectId: event.projectId,
            errorCount: event.errorCount,
            errorTypes: event.errorTypes,
            filesAffected: event.filesAffected,
          },
          triggeredBy: 'lint-runner',
          priority: event.errorCount >= 10 ? 2 : 1, // High priority for many errors
        };

        const result = await this.queueManager.triggerSpecialist(triggerEvent);
        if (result.success) {
          this.logger.info('Triggered Lint Surgeon for lint errors', {
            projectId: event.projectId,
            queueId: result.queueId,
            errorCount: event.errorCount,
          });
        } else {
          this.logger.warn('Failed to trigger Lint Surgeon', {
            projectId: event.projectId,
            reason: result.error,
          });
        }
      }
    } catch (error) {
      this.logger.error('Error handling lint errors detection', {
        event,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle dependency change event
   */
  async onDependencyChanged(event: DependencyChangeEvent): Promise<void> {
    try {
      // Trigger Dependency Auditor for major version changes
      if (event.changeType === 'major') {
        const triggerEvent: QueueTriggerEvent = {
          specialistType: 'dependency-auditor',
          triggerEvent: 'dependency-changed',
          payload: {
            projectId: event.projectId,
            packageName: event.packageName,
            oldVersion: event.oldVersion,
            newVersion: event.newVersion,
            changeType: event.changeType,
          },
          triggeredBy: 'dependency-scanner',
          priority: 2, // High priority for major version changes
        };

        const result = await this.queueManager.triggerSpecialist(triggerEvent);
        if (result.success) {
          this.logger.info('Triggered Dependency Auditor for major version change', {
            projectId: event.projectId,
            packageName: event.packageName,
            queueId: result.queueId,
            versionChange: `${event.oldVersion} → ${event.newVersion}`,
          });
        } else {
          this.logger.warn('Failed to trigger Dependency Auditor', {
            projectId: event.projectId,
            packageName: event.packageName,
            reason: result.error,
          });
        }
      }
    } catch (error) {
      this.logger.error('Error handling dependency change', {
        event,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle health check failure patterns
   */
  async onHealthCheckPatternDetected(
    workerName: string,
    pattern: 'repeated_failures' | 'performance_degradation' | 'new_error_types',
    details: Record<string, any>
  ): Promise<void> {
    try {
      // Could trigger Health Specialist or other specialists based on patterns
      // For now, just log the pattern detection
      this.logger.info('Health check pattern detected', {
        workerName,
        pattern,
        details,
        triggeredBy: 'health-monitor',
      });

      // Future: Trigger specialists based on health patterns
      // - Trigger Health Specialist for repeated failures
      // - Trigger Performance Specialist for degradation
      // - Trigger Error Analysis Specialist for new error types

    } catch (error) {
      this.logger.error('Error handling health check pattern', {
        workerName,
        pattern,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle AI provider performance issues
   */
  async onAiProviderIssue(
    providerName: string,
    issueType: 'rate_limit' | 'timeout' | 'quality_degradation',
    details: Record<string, any>
  ): Promise<void> {
    try {
      // Could trigger AI Provider Specialist
      this.logger.info('AI provider issue detected', {
        providerName,
        issueType,
        details,
        triggeredBy: 'ai-monitor',
      });

      // Future: Trigger AI Provider Specialist for persistent issues

    } catch (error) {
      this.logger.error('Error handling AI provider issue', {
        providerName,
        issueType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle patch application issues
   */
  async onPatchApplicationIssue(
    patchId: string,
    issueType: 'merge_conflict' | 'validation_failure' | 'deployment_error',
    details: Record<string, any>
  ): Promise<void> {
    try {
      // Could trigger Conflict Resolution Specialist or other specialists
      this.logger.info('Patch application issue detected', {
        patchId,
        issueType,
        details,
        triggeredBy: 'patch-manager',
      });

      // Future: Trigger appropriate specialists based on issue type

    } catch (error) {
      this.logger.error('Error handling patch application issue', {
        patchId,
        issueType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Generic trigger method for custom events
   */
  async triggerCustomEvent(
    specialistType: string,
    triggerEvent: string,
    payload: Record<string, any>,
    options: {
      triggeredBy: string;
      orderId?: string;
      taskUuid?: string;
      priority?: number;
    }
  ): Promise<boolean> {
    try {
      const triggerEventData: QueueTriggerEvent = {
        specialistType,
        triggerEvent,
        payload,
        triggeredBy: options.triggeredBy,
        orderId: options.orderId,
        taskUuid: options.taskUuid,
        priority: options.priority || 0,
      };

      const result = await this.queueManager.triggerSpecialist(triggerEventData);
      if (result.success) {
        this.logger.info('Custom specialist trigger successful', {
          specialistType,
          triggerEvent,
          triggeredBy: options.triggeredBy,
          queueId: result.queueId,
        });
        return true;
      } else {
        this.logger.warn('Custom specialist trigger failed', {
          specialistType,
          triggerEvent,
          triggeredBy: options.triggeredBy,
          reason: result.error,
        });
        return false;
      }
    } catch (error) {
      this.logger.error('Error in custom specialist trigger', {
        specialistType,
        triggerEvent,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
