import { PatchProcessor } from '../../../../orchestrator/worker/services/patch-manager/patchProcessor';
import { D1Logger } from '../../../../orchestrator/worker/services/patch/d1Logger';
import { CLIAgentService } from '../../../../orchestrator/worker/services/ai-providers/cli/cliAgentService';
import { SecretService } from '../../../../orchestrator/worker/services/secrets/secretService';
import { PatchBatchSchema } from '@shared/contracts';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('PatchProcessor', () => {
  let patchProcessor: PatchProcessor;
  let mockLogger: D1Logger;
  let mockCLIAgent: CLIAgentService;
  let mockSecretService: SecretService;

  beforeEach(() => {
    mockLogger = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as D1Logger;

    mockCLIAgent = {
      executeCommand: vi.fn()
    } as unknown as CLIAgentService;

    mockSecretService = {
      // Mock any needed methods
    } as unknown as SecretService;

    patchProcessor = new PatchProcessor(mockSecretService, mockCLIAgent, mockLogger);
  });

  describe('processPatchBatch', () => {
    it('should successfully process a valid patch batch', async () => {
      const patchBatch = PatchBatchSchema.parse({
        id: 'test-batch-123',
        patches: [
          {
            file: 'test.ts',
            op: 'replace',
            path: '/function/name',
            value: 'newFunction'
          }
        ]
      });

      // Mock successful CLI execution
      mockCLIAgent.executeCommand = vi.fn().mockResolvedValue({
        success: true,
        output: { message: 'Patch applied successfully' },
        exitCode: 0,
        executionTime: 1000
      });

      const result = await patchProcessor.processPatchBatch(patchBatch);

      expect(result.success).toBe(true);
      expect(result.patchId).toBe('test-batch-123');
      expect(result.executionResults).toHaveLength(1);
      expect(result.executionResults![0].status).toBe('success');
      expect(result.remediationActions).toBeUndefined();

      expect(mockLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          patchId: 'test-batch-123',
          eventType: 'PATCH_PROCESSING_STARTED'
        })
      );

      expect(mockLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          patchId: 'test-batch-123',
          eventType: 'PATCH_PROCESSING_COMPLETED'
        })
      );
    });

    it('should fail validation for invalid patch batch', async () => {
      const invalidPatchBatch = {
        id: 'invalid-batch',
        patches: [
          {
            file: '../../../etc/passwd', // Invalid path
            op: 'replace',
            value: 'malicious'
          }
        ]
      };

      const result = await patchProcessor.processPatchBatch(invalidPatchBatch as any);

      expect(result.success).toBe(false);
      expect(result.validationResults).toContainEqual(
        expect.objectContaining({
          status: 'error',
          message: expect.stringContaining('Invalid file path')
        })
      );
      expect(result.remediationActions).toHaveLength(1);
      expect(result.remediationActions![0].type).toBe('manual_review');
    });

    it('should handle partial execution failures', async () => {
      const patchBatch = PatchBatchSchema.parse({
        id: 'mixed-batch',
        patches: [
          {
            file: 'success.ts',
            op: 'replace',
            value: 'success'
          },
          {
            file: 'fail.ts',
            op: 'replace',
            value: 'fail'
          }
        ]
      });

      // Mock mixed results
      mockCLIAgent.executeCommand = vi.fn()
        .mockResolvedValueOnce({
          success: true,
          output: { message: 'First patch successful' },
          exitCode: 0,
          executionTime: 500
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Second patch failed',
          exitCode: 1,
          executionTime: 300
        });

      const result = await patchProcessor.processPatchBatch(patchBatch);

      expect(result.success).toBe(false);
      expect(result.executionResults).toHaveLength(2);
      expect(result.executionResults![0].status).toBe('success');
      expect(result.executionResults![1].status).toBe('error');
      expect(result.remediationActions).toBeDefined();
      expect(result.remediationActions!.length).toBeGreaterThan(0);
    });

    it('should handle critical errors gracefully', async () => {
      const patchBatch = PatchBatchSchema.parse({
        id: 'error-batch',
        patches: [
          {
            file: 'test.ts',
            op: 'replace',
            value: 'test'
          }
        ]
      });

      // Mock CLI execution to throw an error
      mockCLIAgent.executeCommand = vi.fn().mockRejectedValue(new Error('CLI service unavailable'));

      const result = await patchProcessor.processPatchBatch(patchBatch);

      expect(result.success).toBe(false);
      expect(result.metadata?.error).toBe('CLI service unavailable');
      expect(result.remediationActions).toContainEqual(
        expect.objectContaining({
          type: 'manual_review',
          priority: 'critical'
        })
      );

      expect(mockLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PATCH_PROCESSING_CRITICAL_ERROR'
        })
      );
    });
  });

  describe('validatePatchBatch', () => {
    it('should pass validation for valid patches', async () => {
      const patchBatch = PatchBatchSchema.parse({
        id: 'valid-batch',
        patches: [
          {
            file: 'component.ts',
            op: 'replace',
            value: 'new code'
          }
        ]
      });

      // Access private method for testing
      const result = await (patchProcessor as any).validatePatchBatch(patchBatch);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for invalid file paths', async () => {
      const patchBatch = {
        id: 'invalid-batch',
        patches: [
          {
            file: '../../../etc/passwd',
            op: 'replace',
            value: 'hack'
          }
        ]
      };

      const result = await (patchProcessor as any).validatePatchBatch(patchBatch);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'file',
          message: expect.stringContaining('Invalid file path')
        })
      );
    });

    it('should warn about dangerous operations', async () => {
      const patchBatch = {
        id: 'dangerous-batch',
        patches: [
          {
            file: 'package.json',
            op: 'remove',
            path: '/dependencies/lodash'
          }
        ]
      };

      const result = await (patchProcessor as any).validatePatchBatch(patchBatch);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'op',
          message: expect.stringContaining('potentially destructive')
        })
      );
    });

    it('should warn about multiple operations on same file', async () => {
      const patchBatch = {
        id: 'multi-file-batch',
        patches: [
          {
            file: 'shared.ts',
            op: 'replace',
            value: 'first change'
          },
          {
            file: 'shared.ts',
            op: 'add',
            value: 'second change'
          }
        ]
      };

      const result = await (patchProcessor as any).validatePatchBatch(patchBatch);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('Multiple operations on same file')
        })
      );
    });

    it('should fail validation for operations without required content', async () => {
      const patchBatch = {
        id: 'incomplete-batch',
        patches: [
          {
            file: 'test.ts',
            op: 'replace'
            // Missing value
          }
        ]
      };

      const result = await (patchProcessor as any).validatePatchBatch(patchBatch);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'content',
          message: expect.stringContaining('missing required content')
        })
      );
    });
  });

  describe('executePatchOperations', () => {
    it('should execute operations successfully', async () => {
      const operations = [
        {
          file: 'test1.ts',
          op: 'replace',
          value: 'new content'
        },
        {
          file: 'test2.ts',
          op: 'add',
          value: 'added content'
        }
      ];

      mockCLIAgent.executeCommand = vi.fn().mockResolvedValue({
        success: true,
        output: { message: 'Operation completed' },
        exitCode: 0,
        executionTime: 500
      });

      const results = await (patchProcessor as any).executePatchOperations('test-patch', operations);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('success');
      expect(results[0].executionTime).toBeDefined();
      expect(results[1].status).toBe('success');

      expect(mockCLIAgent.executeCommand).toHaveBeenCalledTimes(2);
      expect(mockLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PATCH_OPERATION_SUCCESS'
        })
      );
    });

    it('should handle operation failures', async () => {
      const operations = [
        {
          file: 'fail.ts',
          op: 'replace',
          value: 'failing content'
        }
      ];

      mockCLIAgent.executeCommand = vi.fn().mockResolvedValue({
        success: false,
        error: 'Permission denied',
        exitCode: 1,
        executionTime: 300
      });

      const results = await (patchProcessor as any).executePatchOperations('fail-patch', operations);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('error');
      expect(results[0].message).toBe('Permission denied');

      expect(mockLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PATCH_OPERATION_FAILED'
        })
      );
    });

    it('should handle execution exceptions', async () => {
      const operations = [
        {
          file: 'error.ts',
          op: 'replace',
          value: 'error content'
        }
      ];

      mockCLIAgent.executeCommand = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const results = await (patchProcessor as any).executePatchOperations('error-patch', operations);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('error');
      expect(results[0].message).toBe('Network timeout');

      expect(mockLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PATCH_OPERATION_ERROR'
        })
      );
    });
  });

  describe('createRemediationActions', () => {
    it('should create appropriate remediation for failed operations', () => {
      const executionResults = [
        { operationIndex: 0, filePath: 'test.ts', status: 'success' },
        { operationIndex: 1, filePath: 'critical.json', status: 'error', message: 'Failed to apply' },
        { operationIndex: 2, filePath: 'normal.ts', status: 'error', message: 'Syntax error' }
      ];

      const actions = (patchProcessor as any).createRemediationActions(executionResults);

      expect(actions).toContainEqual(
        expect.objectContaining({
          type: 'rollback',
          description: expect.stringContaining('Rollback 2 failed operations'),
          priority: 'high'
        })
      );

      expect(actions).toContainEqual(
        expect.objectContaining({
          type: 'manual_review',
          priority: 'critical'
        })
      );

      expect(actions).toContainEqual(
        expect.objectContaining({
          type: 'retry',
          priority: 'medium'
        })
      );

      expect(actions).toContainEqual(
        expect.objectContaining({
          type: 'notification',
          priority: 'medium'
        })
      );
    });

    it('should handle recoverable vs non-recoverable failures', () => {
      const executionResults = [
        { operationIndex: 0, filePath: 'test.ts', status: 'error', message: 'Permission denied' },
        { operationIndex: 1, filePath: 'other.ts', status: 'error', message: 'Temporary network issue' }
      ];

      const actions = (patchProcessor as any).createRemediationActions(executionResults);

      // Should still include retry for the network issue
      expect(actions.some(action => action.type === 'retry')).toBe(true);
    });

    it('should not create remediation for successful operations', () => {
      const executionResults = [
        { operationIndex: 0, filePath: 'test.ts', status: 'success' }
      ];

      const actions = (patchProcessor as any).createRemediationActions(executionResults);

      expect(actions).toHaveLength(0);
    });
  });

  describe('Validation Helpers', () => {
    describe('isValidFilePath', () => {
      it('should accept valid file paths', () => {
        expect((patchProcessor as any).isValidFilePath('component.ts')).toBe(true);
        expect((patchProcessor as any).isValidFilePath('src/utils/helper.js')).toBe(true);
        expect((patchProcessor as any).isValidFilePath('README.md')).toBe(true);
      });

      it('should reject invalid file paths', () => {
        expect((patchProcessor as any).isValidFilePath('../../../etc/passwd')).toBe(false);
        expect((patchProcessor as any).isValidFilePath('/absolute/path')).toBe(false);
        expect((patchProcessor as any).isValidFilePath('')).toBe(false);
        expect((patchProcessor as any).isValidFilePath('invalid.xyz')).toBe(false);
      });
    });

    describe('isValidOperationForFile', () => {
      it('should validate operations based on file type', () => {
        expect((patchProcessor as any).isValidOperationForFile('replace', 'component.ts')).toBe(true);
        expect((patchProcessor as any).isValidOperationForFile('replace', 'data.json')).toBe(true);
        expect((patchProcessor as any).isValidOperationForFile('invalid', 'test.ts')).toBe(true); // Unknown ops allowed for unknown types
      });
    });

    describe('isDangerousOperation', () => {
      it('should identify dangerous operations', () => {
        expect((patchProcessor as any).isDangerousOperation({
          file: 'package.json',
          op: 'remove'
        })).toBe(true);

        expect((patchProcessor as any).isDangerousOperation({
          file: 'component.ts',
          op: 'replace'
        })).toBe(false);
      });
    });

    describe('hasValidContent', () => {
      it('should validate operation content requirements', () => {
        expect((patchProcessor as any).hasValidContent({
          file: 'test.ts',
          op: 'replace',
          value: 'content'
        })).toBe(true);

        expect((patchProcessor as any).hasValidContent({
          file: 'test.ts',
          op: 'remove'
        })).toBe(true);

        expect((patchProcessor as any).hasValidContent({
          file: 'test.ts',
          op: 'replace'
          // Missing value
        })).toBe(false);
      });
    });

    describe('isCriticalFile', () => {
      it('should identify critical files', () => {
        expect((patchProcessor as any).isCriticalFile('package.json')).toBe(true);
        expect((patchProcessor as any).isCriticalFile('wrangler.jsonc')).toBe(true);
        expect((patchProcessor as any).isCriticalFile('component.ts')).toBe(false);
      });
    });
  });
});
