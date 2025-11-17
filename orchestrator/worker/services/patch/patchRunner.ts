/**
 * Patch Runner Service
 *
 * Executes patch operations safely with proper error handling and streaming results.
 * Interfaces with the Python patch_manager.py script and manages patch execution lifecycle.
 */

import { PatchBatchSchema, PatchOperationSchema, type PatchBatch, type PatchOperation } from '@shared/contracts';
import { D1Logger } from './d1Logger';
import { spawn } from 'child_process';
import { ReadableStream } from '@cloudflare/workers-types';

export interface PatchResult {
  success: boolean;
  file: string;
  op: string;
  error?: string;
  diff?: string;
  taskId?: string;
}

export interface PatchExecutionResult {
  success: boolean;
  patchId: string;
  operations: number;
  results: PatchResult[];
  duration: number;
  timestamp: Date;
}

/**
 * PatchRunner executes patch operations using the Python patch manager script.
 * Provides streaming results and comprehensive error handling.
 */
export class PatchRunner {
  private logger: D1Logger;
  private scriptPath: string;

  constructor(logger: D1Logger, scriptPath: string = 'patch_manager.py') {
    this.logger = logger;
    this.scriptPath = scriptPath;
  }

  /**
   * Executes patch commands safely with proper error handling.
   * Returns a stream of patch execution results.
   *
   * @param patchBatch - The batch of patches to execute
   * @returns ReadableStream of PatchResult objects
   */
  async executePatchBatch(patchBatch: PatchBatch): Promise<ReadableStream<PatchResult>> {
    // Validate input
    const validatedBatch = PatchBatchSchema.parse(patchBatch);

    const startTime = Date.now();
    const patchId = validatedBatch.patchId || `patch-${Date.now()}`;

    // Create a readable stream for results
    const { readable, writable } = new TransformStream<PatchResult, PatchResult>();
    const writer = writable.getWriter();

    // Execute patches asynchronously
    this.executeBatchAsync(validatedBatch, writer, patchId, startTime)
      .catch(async (error) => {
        console.error('Error executing patch batch:', error);
        await writer.write({
          success: false,
          file: 'batch',
          op: 'batch',
          error: error.message,
        });
        await writer.close();
      });

    return readable;
  }

  /**
   * Executes a batch of patches asynchronously and streams results.
   */
  private async executeBatchAsync(
    batch: PatchBatch,
    writer: WritableStreamDefaultWriter<PatchResult>,
    patchId: string,
    startTime: number,
  ): Promise<void> {
    try {
      // Create temporary batch file
      const batchFile = await this.createBatchFile(batch);

      // Execute the Python patch manager
      const results = await this.executePythonScript(batchFile);

      // Stream results
      for (const result of results) {
        await writer.write(result);
      }

      // Log batch completion
      const duration = Date.now() - startTime;
      await this.logger.logPatchEvent({
        id: `batch-${patchId}`,
        patchId,
        eventType: 'PATCH_BATCH_COMPLETED',
        status: 'success',
        createdAt: new Date(),
        metadata: {
          operations: batch.operations.length,
          duration,
          results: results.length,
        },
      });

    } catch (error) {
      // Log batch failure
      await this.logger.logPatchEvent({
        id: `batch-${patchId}-error`,
        patchId,
        eventType: 'PATCH_BATCH_FAILED',
        status: 'failure',
        createdAt: new Date(),
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    } finally {
      await writer.close();
    }
  }

  /**
   * Creates a temporary JSON file with the patch batch data.
   */
  private async createBatchFile(batch: PatchBatch): Promise<string> {
    const tempFile = `/tmp/patch-batch-${Date.now()}.json`;

    // Convert batch to the format expected by patch_manager.py
    const batchData = {
      orderId: batch.patchId,
      patches: batch.operations.map(op => ({
        op: op.op,
        file: op.file,
        start: op.start,
        end: op.end,
        line: op.line,
        block: op.block,
        blockFile: op.blockFile,
        openSpace: op.openSpace,
        taskId: op.taskId,
      })),
    };

    // Write to file (in a real implementation, this would use Workers KV or similar)
    // For now, we'll simulate this
    console.log(`Would create batch file: ${tempFile}`, JSON.stringify(batchData, null, 2));
    return tempFile;
  }

  /**
   * Executes the Python patch manager script.
   */
  private async executePythonScript(batchFile: string): Promise<PatchResult[]> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [this.scriptPath, '--apply', batchFile, '--dry-run'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            if (result.success) {
              resolve(result.results || []);
            } else {
              reject(new Error(result.error || 'Patch execution failed'));
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse patch result: ${parseError}`));
          }
        } else {
          reject(new Error(`Patch script failed with code ${code}: ${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start patch script: ${error.message}`));
      });
    });
  }

  /**
   * Validates a patch batch before execution.
   */
  validatePatchBatch(batch: unknown): asserts batch is PatchBatch {
    PatchBatchSchema.parse(batch);
  }

  /**
   * Validates a single patch operation.
   */
  validatePatchOperation(operation: unknown): asserts operation is PatchOperation {
    PatchOperationSchema.parse(operation);
  }
}
