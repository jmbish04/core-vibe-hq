import { CLIAgentService } from '../../../../orchestrator/worker/services/ai-providers/cli/cliAgentService';
import { SecretService } from '../../../../orchestrator/worker/services/secrets/secretService';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('CLIAgentService', () => {
  let cliAgentService: CLIAgentService;
  let mockSecretService: SecretService;
  let mockEnv: any;

  beforeEach(() => {
    mockSecretService = {
      createContainerEnvironment: vi.fn().mockReturnValue({
        NODE_ENV: 'test',
        PATH: '/usr/bin:/bin'
      }),
      sanitizeForLogging: vi.fn().mockImplementation((env) => env)
    } as unknown as SecretService;

    mockEnv = {
      // Mock environment
    };

    cliAgentService = new CLIAgentService(mockEnv, mockSecretService);
  });

  describe('executeCommand', () => {
    it('should execute a successful echo command', async () => {
      const result = await cliAgentService.executeCommand({
        command: 'echo',
        args: ['Hello', 'World'],
        outputFormat: 'text'
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello World');
      expect(result.exitCode).toBe(0);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle command failure', async () => {
      const result = await cliAgentService.executeCommand({
        command: 'fail',
        outputFormat: 'text'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Command failed as requested');
      expect(result.exitCode).toBe(1);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should execute JSON output commands', async () => {
      const result = await cliAgentService.executeCommand({
        command: 'json-output',
        args: ['test', 'data'],
        outputFormat: 'json'
      });

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ status: 'success', data: ['test', 'data'] });
      expect(result.exitCode).toBe(0);
    });

    it('should handle timeout configuration', async () => {
      const result = await cliAgentService.executeCommand({
        command: 'echo',
        args: ['test'],
        timeout: 5000
      });

      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should merge environment variables', async () => {
      const result = await cliAgentService.executeCommand({
        command: 'echo',
        args: ['test'],
        environmentVariables: { CUSTOM_VAR: 'value' }
      });

      expect(result.success).toBe(true);
      expect(mockSecretService.createContainerEnvironment).toHaveBeenCalledWith('cli-agent', { CUSTOM_VAR: 'value' });
    });

    it('should handle execution errors gracefully', async () => {
      // Mock the secret service to throw an error
      mockSecretService.createContainerEnvironment = vi.fn().mockImplementation(() => {
        throw new Error('Environment setup failed');
      });

      const result = await cliAgentService.executeCommand({
        command: 'echo',
        args: ['test']
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Environment setup failed');
      expect(result.exitCode).toBe(-1);
    });

    it('should validate command options', async () => {
      const result = await cliAgentService.executeCommand({
        command: '', // Invalid empty command
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Command cannot be empty');
    });
  });

  describe('processQueueItem', () => {
    it('should process a valid queue item', async () => {
      const queueItem = {
        id: 'test-queue-item',
        command: 'echo',
        args: ['queued', 'command'],
        environmentVariables: { QUEUE_VAR: 'value' },
        workingDirectory: '/tmp',
        priority: 'high' as const,
        timeout: 30000
      };

      const result = await cliAgentService.processQueueItem(queueItem);

      expect(result.success).toBe(true);
      expect(result.output).toBe('queued command');
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle invalid queue items', async () => {
      const invalidQueueItem = {
        id: 'test',
        command: '',
        // Missing other required fields
      };

      const result = await cliAgentService.processQueueItem(invalidQueueItem as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Command cannot be empty');
    });
  });

  describe('parseCommandOutput', () => {
    it('should parse JSON output correctly', () => {
      const jsonOutput = '{"status": "success", "data": [1, 2, 3]}';
      const parsed = cliAgentService.parseCommandOutput(jsonOutput, 'json');

      expect(parsed).toEqual({
        status: 'success',
        data: [1, 2, 3]
      });
    });

    it('should return text output as-is', () => {
      const textOutput = 'Plain text output';
      const parsed = cliAgentService.parseCommandOutput(textOutput, 'text');

      expect(parsed).toBe('Plain text output');
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidJson = '{"invalid": json}';
      const parsed = cliAgentService.parseCommandOutput(invalidJson, 'json');

      expect(parsed).toBe('{"invalid": json}'); // Returns raw output on parse failure
    });
  });

  describe('validateCommand', () => {
    it('should validate safe commands', () => {
      const result = cliAgentService.validateCommand('echo', ['hello']);
      expect(result.valid).toBe(true);
    });

    it('should reject empty commands', () => {
      const result = cliAgentService.validateCommand('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('should reject dangerous commands', () => {
      const dangerousCommands = ['rm', 'del', 'format', 'fdisk', 'mkfs'];

      for (const cmd of dangerousCommands) {
        const result = cliAgentService.validateCommand(cmd);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('not allowed');
      }
    });

    it('should reject commands with problematic characters', () => {
      const problematicChars = [';', '&', '|', '`', '$', '(', ')', '{', '}', '[', ']', '<', '>'];

      for (const char of problematicChars) {
        const result = cliAgentService.validateCommand(`echo ${char}`);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('unsafe characters');
      }
    });
  });

  describe('getExecutionStats', () => {
    it('should return correct execution statistics', () => {
      const stats = cliAgentService.getExecutionStats();

      expect(stats).toEqual({
        activeExecutions: 0,
        maxConcurrent: 5,
        utilization: 0
      });
    });

    it('should reflect active executions', async () => {
      // Start multiple executions
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(cliAgentService.executeCommand({
          command: 'echo',
          args: [`test${i}`]
        }));
      }

      // Check stats while executions are running
      await new Promise(resolve => setTimeout(resolve, 100));
      const stats = cliAgentService.getExecutionStats();

      expect(stats.activeExecutions).toBeGreaterThan(0);
      expect(stats.utilization).toBeGreaterThan(0);

      // Wait for all to complete
      await Promise.all(promises);
      const finalStats = cliAgentService.getExecutionStats();
      expect(finalStats.activeExecutions).toBe(0);
      expect(finalStats.utilization).toBe(0);
    });
  });

  describe('createQueueItem', () => {
    it('should create a valid queue item', () => {
      const options = {
        command: 'npm',
        args: ['install'],
        environmentVariables: { CI: 'true' },
        workingDirectory: '/project',
        timeout: 120000
      };

      const queueItem = cliAgentService.createQueueItem(options, 'high');

      expect(queueItem.id).toBeDefined();
      expect(queueItem.command).toBe('npm');
      expect(queueItem.args).toEqual(['install']);
      expect(queueItem.environmentVariables).toEqual({ CI: 'true' });
      expect(queueItem.workingDirectory).toBe('/project');
      expect(queueItem.priority).toBe('high');
      expect(queueItem.timeout).toBe(120000);
      expect(queueItem.createdAt).toBeInstanceOf(Date);
    });

    it('should use default priority', () => {
      const options = {
        command: 'echo',
        args: ['test']
      };

      const queueItem = cliAgentService.createQueueItem(options);

      expect(queueItem.priority).toBe('medium');
    });
  });

  describe('executeBatch', () => {
    it('should execute multiple commands sequentially', async () => {
      const commands = [
        { command: 'echo', args: ['first'] },
        { command: 'echo', args: ['second'] },
        { command: 'echo', args: ['third'] }
      ];

      const results = await cliAgentService.executeBatch(commands);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[0].output).toBe('first');
      expect(results[1].success).toBe(true);
      expect(results[1].output).toBe('second');
      expect(results[2].success).toBe(true);
      expect(results[2].output).toBe('third');
    });

    it('should handle mixed success and failure in batch', async () => {
      const commands = [
        { command: 'echo', args: ['success'] },
        { command: 'fail', args: [] },
        { command: 'echo', args: ['also success'] }
      ];

      const results = await cliAgentService.executeBatch(commands);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });

    it('should continue executing after individual command failures', async () => {
      const commands = [
        { command: 'fail' },
        { command: 'echo', args: ['should still run'] }
      ];

      const results = await cliAgentService.executeBatch(commands);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
      expect(results[1].output).toBe('should still run');
    });
  });

  describe('Concurrency Limits', () => {
    it('should enforce maximum concurrent executions', async () => {
      // Mock a slow command that takes time
      const originalExecuteInContainer = (cliAgentService as any).executeInContainer;
      (cliAgentService as any).executeInContainer = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          output: 'slow command',
          exitCode: 0
        }), 1000))
      );

      // Start maximum allowed concurrent executions
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(cliAgentService.executeCommand({
          command: 'slow-cmd',
          args: [`cmd${i}`]
        }));
      }

      // This should fail due to concurrency limit
      const result = await cliAgentService.executeCommand({
        command: 'echo',
        args: ['should fail']
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum concurrent CLI executions reached');

      // Restore original method
      (cliAgentService as any).executeInContainer = originalExecuteInContainer;
    });
  });

  describe('Environment Variable Handling', () => {
    it('should prepare environment variables with container defaults', async () => {
      const result = await cliAgentService.executeCommand({
        command: 'echo',
        args: ['test'],
        environmentVariables: { CUSTOM: 'value' }
      });

      expect(mockSecretService.createContainerEnvironment).toHaveBeenCalledWith('cli-agent', { CUSTOM: 'value' });
    });

    it('should sanitize environment variables for logging', async () => {
      mockSecretService.sanitizeForLogging = vi.fn().mockReturnValue({
        NODE_ENV: 'test',
        API_KEY: '[REDACTED]'
      });

      await cliAgentService.executeCommand({
        command: 'echo',
        args: ['test']
      });

      expect(mockSecretService.sanitizeForLogging).toHaveBeenCalled();
    });
  });
});
