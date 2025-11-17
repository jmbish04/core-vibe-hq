import { SecretService } from '../../secrets/secretService';
import { z } from 'zod';

/**
 * Schema for CLI agent execution options
 */
const CLIAgentOptionsSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  timeout: z.number().optional().default(60000), // Default timeout: 60 seconds
  environmentVariables: z.record(z.string(), z.string()).optional(),
  workingDirectory: z.string().optional(),
  outputFormat: z.enum(['json', 'text']).optional().default('text'),
});

type CLIAgentOptions = z.infer<typeof CLIAgentOptionsSchema>;

/**
 * Schema for CLI agent execution results
 */
const CLIAgentResultSchema = z.object({
  success: z.boolean(),
  output: z.any(),
  error: z.string().optional(),
  exitCode: z.number().optional(),
  executionTime: z.number(),
});

export type CLIAgentResult = z.infer<typeof CLIAgentResultSchema>;

/**
 * Schema for CLI task queue item
 */
const CLIQueueItemSchema = z.object({
  id: z.string(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  environmentVariables: z.record(z.string(), z.string()).optional(),
  workingDirectory: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  retryCount: z.number().optional().default(0),
  maxRetries: z.number().optional().default(3),
  createdAt: z.date().optional(),
  timeout: z.number().optional().default(60000),
});

type CLIQueueItem = z.infer<typeof CLIQueueItemSchema>;

/**
 * CLI Agent Service manages execution of CLI commands in containers
 * with environment variable injection and structured output parsing.
 */
export class CLIAgentService {
  private readonly env: Env;
  private readonly secretService: SecretService;
  private readonly maxConcurrentExecutions: number = 5;
  private activeExecutions: Set<string> = new Set();

  constructor(env: Env, secretService: SecretService) {
    this.env = env;
    this.secretService = secretService;
  }

  /**
   * Executes a CLI command in a container with full environment setup
   */
  async executeCommand(options: CLIAgentOptions): Promise<CLIAgentResult> {
    const validatedOptions = CLIAgentOptionsSchema.parse(options);
    const executionId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      // Check concurrent execution limits
      if (this.activeExecutions.size >= this.maxConcurrentExecutions) {
        throw new Error('Maximum concurrent CLI executions reached');
      }

      this.activeExecutions.add(executionId);

      // Prepare environment variables
      const envVars = await this.prepareEnvironmentVariables(
        validatedOptions.environmentVariables || {},
      );

      // Execute the command
      const result = await this.executeInContainer({
        ...validatedOptions,
        executionId,
        environmentVariables: envVars,
      });

      const executionTime = Date.now() - startTime;

      return CLIAgentResultSchema.parse({
        success: result.success,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
        executionTime,
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`CLI execution failed (${executionId}):`, error);

      return CLIAgentResultSchema.parse({
        success: false,
        output: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        exitCode: -1,
        executionTime,
      });
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Processes CLI tasks from the queue
   */
  async processQueueItem(queueItem: CLIQueueItem): Promise<CLIAgentResult> {
    const validatedItem = CLIQueueItemSchema.parse(queueItem);

    return this.executeCommand({
      command: validatedItem.command,
      args: validatedItem.args,
      timeout: validatedItem.timeout,
      environmentVariables: validatedItem.environmentVariables,
      workingDirectory: validatedItem.workingDirectory,
      outputFormat: 'json', // Queue items expect structured output
    });
  }

  /**
   * Prepares environment variables for container execution
   */
  private async prepareEnvironmentVariables(
    additionalVars: Record<string, string>,
  ): Promise<Record<string, string>> {
    // Get base environment from SecretService
    const baseEnv = this.secretService.createContainerEnvironment('cli-agent', additionalVars);

    // Add CLI-specific environment variables
    const cliEnv: Record<string, string> = {
      ...baseEnv,
      // CLI execution context
      CLI_EXECUTION_CONTEXT: 'vibe-hq-container',
      CLI_AGENT_VERSION: '1.0.0',
      // Safe defaults
      HOME: '/tmp',
      PATH: '/usr/local/bin:/usr/bin:/bin',
      SHELL: '/bin/bash',
    };

    // Add container-specific paths if available
    const containerPaths = this.getContainerPaths();
    if (containerPaths) {
      cliEnv.PATH = `${containerPaths}:${cliEnv.PATH}`;
    }

    return cliEnv;
  }

  /**
   * Executes command in container (placeholder for actual container execution)
   */
  private async executeInContainer(options: CLIAgentOptions & {
    executionId: string;
    environmentVariables: Record<string, string>;
  }): Promise<{ success: boolean; output: any; error?: string; exitCode?: number }> {
    const { command, args = [], timeout, environmentVariables, workingDirectory } = options;

    try {
      // In a real implementation, this would:
      // 1. Create/start a container with the specified environment
      // 2. Execute the command with timeout handling
      // 3. Capture stdout/stderr
      // 4. Parse output based on format
      // 5. Clean up container resources

      // For now, simulate container execution
      console.log(`[CLI-${options.executionId}] Executing: ${command} ${args.join(' ')}`);
      console.log(`[CLI-${options.executionId}] Environment:`, this.secretService.sanitizeForLogging(environmentVariables));
      if (workingDirectory) {
        console.log(`[CLI-${options.executionId}] Working directory: ${workingDirectory}`);
      }

      // Simulate command execution delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

      // Simulate different outcomes based on command
      if (command === 'echo') {
        return {
          success: true,
          output: args.join(' ') || 'Hello World',
          exitCode: 0,
        };
      }

      if (command === 'fail') {
        return {
          success: false,
          output: null,
          error: 'Command failed as requested',
          exitCode: 1,
        };
      }

      if (command === 'json-output') {
        return {
          success: true,
          output: { status: 'success', data: args },
          exitCode: 0,
        };
      }

      // Default successful execution
      return {
        success: true,
        output: `Executed: ${command} ${args.join(' ')}`,
        exitCode: 0,
      };

    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : 'Container execution failed',
        exitCode: -1,
      };
    }
  }

  /**
   * Parses and validates structured output from CLI commands
   */
  parseCommandOutput(output: string, expectedFormat: 'json' | 'text' = 'text'): any {
    try {
      if (expectedFormat === 'json') {
        // Try to parse as JSON
        const parsed = JSON.parse(output.trim());

        // Basic validation - could be enhanced with specific schemas
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed;
        }

        throw new Error('Invalid JSON structure');
      }

      // For text format, return as-is
      return output.trim();

    } catch (error) {
      console.warn('Failed to parse CLI output:', error);
      // Return raw output if parsing fails
      return output;
    }
  }

  /**
   * Validates CLI command before execution
   */
  validateCommand(command: string, args: string[] = []): { valid: boolean; error?: string } {
    // Basic command validation
    if (!command || command.trim().length === 0) {
      return { valid: false, error: 'Command cannot be empty' };
    }

    // Check for potentially dangerous commands
    const dangerousCommands = ['rm', 'del', 'format', 'fdisk', 'mkfs'];
    const commandBase = command.split(' ')[0].toLowerCase();

    if (dangerousCommands.includes(commandBase)) {
      return { valid: false, error: `Command '${commandBase}' is not allowed for security reasons` };
    }

    // Check for shell metacharacters that could be problematic
    const problematicChars = /[;&|`$(){}[\]<>]/;
    const fullCommand = [command, ...args].join(' ');

    if (problematicChars.test(fullCommand)) {
      return { valid: false, error: 'Command contains potentially unsafe characters' };
    }

    return { valid: true };
  }

  /**
   * Gets container-specific paths (if any)
   */
  private getContainerPaths(): string | null {
    // In a real implementation, this would check the container configuration
    // and return additional PATH entries if needed
    return null;
  }

  /**
   * Gets current execution statistics
   */
  getExecutionStats(): {
    activeExecutions: number;
    maxConcurrent: number;
    utilization: number;
    } {
    return {
      activeExecutions: this.activeExecutions.size,
      maxConcurrent: this.maxConcurrentExecutions,
      utilization: this.activeExecutions.size / this.maxConcurrentExecutions,
    };
  }

  /**
   * Creates a queue item from execution options
   */
  createQueueItem(options: CLIAgentOptions, priority: CLIQueueItem['priority'] = 'medium'): CLIQueueItem {
    return CLIQueueItemSchema.parse({
      id: crypto.randomUUID(),
      command: options.command,
      args: options.args,
      environmentVariables: options.environmentVariables,
      workingDirectory: options.workingDirectory,
      priority,
      timeout: options.timeout,
      createdAt: new Date(),
    });
  }

  /**
   * Batch executes multiple CLI commands
   */
  async executeBatch(commands: CLIAgentOptions[]): Promise<CLIAgentResult[]> {
    const results: CLIAgentResult[] = [];

    // Execute commands sequentially to avoid overwhelming the system
    for (const command of commands) {
      try {
        const result = await this.executeCommand(command);
        results.push(result);

        // Small delay between commands
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Add failed result for this command
        results.push(CLIAgentResultSchema.parse({
          success: false,
          output: null,
          error: error instanceof Error ? error.message : 'Batch execution failed',
          exitCode: -1,
          executionTime: 0,
        }));
      }
    }

    return results;
  }
}
