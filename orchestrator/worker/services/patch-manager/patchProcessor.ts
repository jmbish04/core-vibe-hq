import { z } from 'zod';
import { SecretService } from '../../secrets/secretService';
import { CLIAgentService } from '../../ai-providers/cli/cliAgentService';
import { D1Logger } from '../../patch/d1Logger';
import { PatchBatchSchema, PatchOperation } from '@shared/contracts';

/**
 * Schema for patch processing results
 */
const PatchProcessingResultSchema = z.object({
  success: z.boolean(),
  patchId: z.string(),
  validationResults: z.array(z.object({
    filePath: z.string(),
    status: z.enum(['success', 'error', 'warning']),
    message: z.string().optional(),
  })),
  executionResults: z.array(z.object({
    operationIndex: z.number(),
    filePath: z.string(),
    status: z.enum(['success', 'error', 'skipped']),
    message: z.string().optional(),
    executionTime: z.number().optional(),
  })).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  remediationActions: z.array(z.object({
    type: z.enum(['rollback', 'retry', 'notification', 'manual_review']),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
  })).optional(),
});

type PatchProcessingResult = z.infer<typeof PatchProcessingResultSchema>;

/**
 * Schema for patch validation result
 */
const PatchValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.object({
    operationIndex: z.number(),
    field: z.string(),
    message: z.string(),
  })),
  warnings: z.array(z.object({
    operationIndex: z.number(),
    field: z.string(),
    message: z.string(),
  })),
});

type PatchValidationResult = z.infer<typeof PatchValidationResultSchema>;

/**
 * PatchProcessor handles validation and processing of AI-generated patches
 * by interfacing with the Python-based patch manager script, logging operations,
 * and managing validation/remediation workflows.
 */
export class PatchProcessor {
  private readonly secretService: SecretService;
  private readonly cliAgentService: CLIAgentService;
  private readonly d1Logger: D1Logger;
  private readonly maxRetries: number = 3;
  private readonly validationTimeout: number = 30000; // 30 seconds
  private readonly executionTimeout: number = 120000; // 2 minutes

  constructor(
    secretService: SecretService,
    cliAgentService: CLIAgentService,
    d1Logger: D1Logger,
  ) {
    this.secretService = secretService;
    this.cliAgentService = cliAgentService;
    this.d1Logger = d1Logger;
  }

  /**
   * Main entry point for processing a patch batch
   */
  async processPatchBatch(patchBatch: z.infer<typeof PatchBatchSchema>): Promise<PatchProcessingResult> {
    const startTime = Date.now();
    const patchId = patchBatch.id || crypto.randomUUID();

    try {
      // Step 1: Validate the patch batch
      const validationResult = await this.validatePatchBatch(patchBatch);
      if (!validationResult.isValid) {
        return this.createValidationFailureResult(patchId, validationResult);
      }

      // Step 2: Log the start of processing
      await this.d1Logger.logEvent({
        patchId,
        eventType: 'PATCH_PROCESSING_STARTED',
        status: 'in_progress',
        metadata: {
          operationCount: patchBatch.patches.length,
          validationWarnings: validationResult.warnings.length,
          startedAt: new Date().toISOString(),
        },
      });

      // Step 3: Execute the patch operations
      const executionResults = await this.executePatchOperations(patchId, patchBatch.patches);

      // Step 4: Determine overall success
      const success = executionResults.every(result => result.status === 'success');
      const hasErrors = executionResults.some(result => result.status === 'error');

      // Step 5: Create remediation actions if needed
      const remediationActions = hasErrors ? this.createRemediationActions(executionResults) : [];

      // Step 6: Log completion
      await this.d1Logger.logEvent({
        patchId,
        eventType: success ? 'PATCH_PROCESSING_COMPLETED' : 'PATCH_PROCESSING_FAILED',
        status: success ? 'success' : 'error',
        metadata: {
          totalOperations: patchBatch.patches.length,
          successfulOperations: executionResults.filter(r => r.status === 'success').length,
          failedOperations: executionResults.filter(r => r.status === 'error').length,
          skippedOperations: executionResults.filter(r => r.status === 'skipped').length,
          executionTime: Date.now() - startTime,
          remediationActionsCount: remediationActions.length,
          completedAt: new Date().toISOString(),
        },
      });

      return PatchProcessingResultSchema.parse({
        success,
        patchId,
        validationResults: this.convertValidationToResults(validationResult),
        executionResults,
        metadata: {
          totalExecutionTime: Date.now() - startTime,
          operationCount: patchBatch.patches.length,
          validationWarnings: validationResult.warnings.length,
        },
        remediationActions: remediationActions.length > 0 ? remediationActions : undefined,
      });

    } catch (error) {
      // Log critical failure
      await this.d1Logger.logEvent({
        patchId,
        eventType: 'PATCH_PROCESSING_CRITICAL_ERROR',
        status: 'error',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime: Date.now() - startTime,
          errorAt: new Date().toISOString(),
        },
      });

      return PatchProcessingResultSchema.parse({
        success: false,
        patchId,
        validationResults: [],
        metadata: {
          error: error instanceof Error ? error.message : 'Critical processing error',
          executionTime: Date.now() - startTime,
        },
        remediationActions: [{
          type: 'manual_review',
          description: 'Critical error occurred during patch processing - manual review required',
          priority: 'critical',
        }],
      });
    }
  }

  /**
   * Validates a patch batch for structural integrity and business rules
   */
  private async validatePatchBatch(patchBatch: z.infer<typeof PatchBatchSchema>): Promise<PatchValidationResult> {
    const errors: Array<{ operationIndex: number; field: string; message: string }> = [];
    const warnings: Array<{ operationIndex: number; field: string; message: string }> = [];

    // Basic structural validation is handled by Zod schema
    // Additional business logic validation here

    for (let i = 0; i < patchBatch.patches.length; i++) {
      const operation = patchBatch.patches[i];

      // Validate file paths
      if (!this.isValidFilePath(operation.file)) {
        errors.push({
          operationIndex: i,
          field: 'file',
          message: `Invalid file path: ${operation.file}`,
        });
      }

      // Validate operation type compatibility
      if (!this.isValidOperationForFile(operation.op, operation.file)) {
        warnings.push({
          operationIndex: i,
          field: 'op',
          message: `Operation '${operation.op}' may not be suitable for file type of ${operation.file}`,
        });
      }

      // Check for potentially dangerous operations
      if (this.isDangerousOperation(operation)) {
        warnings.push({
          operationIndex: i,
          field: 'op',
          message: `Operation '${operation.op}' is potentially destructive - review carefully`,
        });
      }

      // Validate operation content
      if (!this.hasValidContent(operation)) {
        errors.push({
          operationIndex: i,
          field: 'content',
          message: 'Operation is missing required content',
        });
      }
    }

    // Check for duplicate file operations that might conflict
    const fileOperations = new Map<string, number[]>();
    patchBatch.patches.forEach((op, index) => {
      if (!fileOperations.has(op.file)) {
        fileOperations.set(op.file, []);
      }
      fileOperations.get(op.file)!.push(index);
    });

    for (const [file, indices] of fileOperations) {
      if (indices.length > 1) {
        warnings.push({
          operationIndex: indices[0],
          field: 'file',
          message: `Multiple operations on same file '${file}' - ensure operations are compatible`,
        });
      }
    }

    return PatchValidationResultSchema.parse({
      isValid: errors.length === 0,
      errors,
      warnings,
    });
  }

  /**
   * Executes patch operations through the Python patch manager
   */
  private async executePatchOperations(
    patchId: string,
    operations: PatchOperation[],
  ): Promise<Array<{
    operationIndex: number;
    filePath: string;
    status: 'success' | 'error' | 'skipped';
    message?: string;
    executionTime?: number;
  }>> {
    const results = [];

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      const operationStartTime = Date.now();

      try {
        // Prepare the patch batch for this single operation
        const singleOperationBatch = {
          id: `${patchId}-op-${i}`,
          patches: [operation],
        };

        // Execute via CLI agent service
        const cliResult = await this.cliAgentService.executeCommand({
          command: 'python3',
          args: ['patch_manager.py', 'apply-batch', JSON.stringify(singleOperationBatch)],
          timeout: this.executionTimeout,
          environmentVariables: {
            // Add any special environment variables needed for patch processing
            PATCH_PROCESSOR_MODE: 'single-operation',
            OPERATION_INDEX: i.toString(),
          },
          workingDirectory: process.cwd(), // Use current working directory
          outputFormat: 'json',
        });

        const executionTime = Date.now() - operationStartTime;

        if (cliResult.success) {
          results.push({
            operationIndex: i,
            filePath: operation.file,
            status: 'success',
            message: cliResult.output?.message || 'Operation completed successfully',
            executionTime,
          });

          // Log individual operation success
          await this.d1Logger.logEvent({
            patchId,
            eventType: 'PATCH_OPERATION_SUCCESS',
            status: 'success',
            metadata: {
              operationIndex: i,
              filePath: operation.file,
              executionTime,
              operationType: operation.op,
            },
          });
        } else {
          results.push({
            operationIndex: i,
            filePath: operation.file,
            status: 'error',
            message: cliResult.error || 'Operation failed',
            executionTime,
          });

          // Log individual operation failure
          await this.d1Logger.logEvent({
            patchId,
            eventType: 'PATCH_OPERATION_FAILED',
            status: 'error',
            metadata: {
              operationIndex: i,
              filePath: operation.file,
              executionTime,
              error: cliResult.error,
              operationType: operation.op,
            },
          });
        }

      } catch (error) {
        const executionTime = Date.now() - operationStartTime;

        results.push({
          operationIndex: i,
          filePath: operation.file,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown execution error',
          executionTime,
        });

        // Log execution error
        await this.d1Logger.logEvent({
          patchId,
          eventType: 'PATCH_OPERATION_ERROR',
          status: 'error',
          metadata: {
            operationIndex: i,
            filePath: operation.file,
            executionTime,
            error: error instanceof Error ? error.message : 'Unknown error',
            operationType: operation.op,
          },
        });
      }
    }

    return results;
  }

  /**
   * Creates remediation actions based on execution results
   */
  private createRemediationActions(executionResults: Array<{
    operationIndex: number;
    filePath: string;
    status: string;
    message?: string;
  }>): Array<{
    type: 'rollback' | 'retry' | 'notification' | 'manual_review';
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }> {
    const actions = [];
    const failedOperations = executionResults.filter(r => r.status === 'error');

    if (failedOperations.length > 0) {
      // Add rollback action for failed operations
      actions.push({
        type: 'rollback' as const,
        description: `Rollback ${failedOperations.length} failed operations`,
        priority: failedOperations.length > 3 ? 'critical' : 'high',
      });

      // Add manual review for critical failures
      if (failedOperations.some(op => this.isCriticalFile(op.filePath))) {
        actions.push({
          type: 'manual_review' as const,
          description: 'Critical files were affected by failed operations - manual review required',
          priority: 'critical',
        });
      }

      // Add retry action if failures seem recoverable
      const recoverableFailures = failedOperations.filter(op =>
        !op.message?.includes('permission') && !op.message?.includes('not found'),
      );

      if (recoverableFailures.length > 0 && failedOperations.length <= this.maxRetries) {
        actions.push({
          type: 'retry' as const,
          description: `Retry ${recoverableFailures.length} potentially recoverable operations`,
          priority: 'medium',
        });
      }
    }

    // Always add notification for any issues
    if (failedOperations.length > 0) {
      actions.push({
        type: 'notification' as const,
        description: `Notify stakeholders of ${failedOperations.length} patch operation failures`,
        priority: failedOperations.length > 5 ? 'high' : 'medium',
      });
    }

    return actions;
  }

  /**
   * Converts validation results to the expected format
   */
  private convertValidationToResults(validationResult: PatchValidationResult): Array<{
    filePath: string;
    status: 'success' | 'error' | 'warning';
    message?: string;
  }> {
    const results = [];

    // Add errors
    for (const error of validationResult.errors) {
      results.push({
        filePath: `operation-${error.operationIndex}`,
        status: 'error',
        message: `${error.field}: ${error.message}`,
      });
    }

    // Add warnings
    for (const warning of validationResult.warnings) {
      results.push({
        filePath: `operation-${warning.operationIndex}`,
        status: 'warning',
        message: `${warning.field}: ${warning.message}`,
      });
    }

    return results;
  }

  /**
   * Creates a result for validation failures
   */
  private createValidationFailureResult(
    patchId: string,
    validationResult: PatchValidationResult,
  ): PatchProcessingResult {
    return PatchProcessingResultSchema.parse({
      success: false,
      patchId,
      validationResults: this.convertValidationToResults(validationResult),
      metadata: {
        validationErrors: validationResult.errors.length,
        validationWarnings: validationResult.warnings.length,
      },
      remediationActions: [{
        type: 'manual_review',
        description: 'Patch validation failed - manual review required before processing',
        priority: 'high',
      }],
    });
  }

  /**
   * Helper methods for validation
   */
  private isValidFilePath(filePath: string): boolean {
    // Basic file path validation
    if (!filePath || filePath.trim().length === 0) {
      return false;
    }

    // Prevent directory traversal
    if (filePath.includes('../') || filePath.startsWith('/')) {
      return false;
    }

    // Allow reasonable file extensions for code files
    const allowedExtensions = ['.ts', '.js', '.py', '.json', '.md', '.txt', '.yml', '.yaml'];
    const hasAllowedExtension = allowedExtensions.some(ext => filePath.endsWith(ext));

    return hasAllowedExtension;
  }

  private isValidOperationForFile(operation: string, filePath: string): boolean {
    // Basic validation that operations are appropriate for file types
    const fileExtension = filePath.split('.').pop()?.toLowerCase();

    switch (fileExtension) {
      case 'json':
        return ['replace', 'add', 'remove'].includes(operation);
      case 'ts':
      case 'js':
        return ['replace', 'add', 'remove', 'create', 'update'].includes(operation);
      case 'md':
      case 'txt':
        return ['replace', 'add', 'remove'].includes(operation);
      default:
        return true; // Allow all operations for unknown file types
    }
  }

  private isDangerousOperation(operation: PatchOperation): boolean {
    // Flag operations that might be destructive
    return operation.op === 'remove' && operation.file.includes('package.json');
  }

  private hasValidContent(operation: PatchOperation): boolean {
    // Validate that operations have required content
    switch (operation.op) {
      case 'add':
      case 'replace':
      case 'create':
        return !!(operation.value || operation.content);
      case 'remove':
        return true; // Remove operations don't need content
      case 'update':
        return !!(operation.changes || operation.value);
      default:
        return false;
    }
  }

  private isCriticalFile(filePath: string): boolean {
    // Define critical files that require special attention
    const criticalFiles = [
      'package.json',
      'wrangler.jsonc',
      'tsconfig.json',
      '.env',
      'README.md',
    ];

    return criticalFiles.some(critical => filePath.includes(critical));
  }
}
