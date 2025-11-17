/**
 * Patch Bridge Service
 *
 * Converts factory outputs to standardized patch batches and groups operations logically.
 * Acts as an adapter between factory systems and the patch execution pipeline.
 */

import { PatchBatchSchema, PatchOperationSchema, type PatchBatch, type PatchOperation } from '@shared/contracts';

export interface FactoryOutput {
  type: 'agent-factory' | 'ui-factory' | 'data-factory' | 'custom';
  operations: FactoryOperation[];
  metadata?: Record<string, any>;
  orderId?: string;
}

export interface FactoryOperation {
  type: 'create' | 'update' | 'delete' | 'move' | 'copy';
  target: string; // File path or identifier
  content?: string;
  source?: string; // For copy/move operations
  position?: 'before' | 'after' | 'replace' | 'append' | 'prepend';
  marker?: string; // Named marker for precise positioning
  metadata?: Record<string, any>;
}

/**
 * PatchBridge converts factory outputs to standardized patch batches.
 * Handles different factory types and normalizes operations for execution.
 */
export class PatchBridge {
  /**
   * Converts factory outputs to standardized patch batches.
   *
   * @param factoryOutput - Raw output from a factory process
   * @returns A validated patch batch ready for execution
   */
  convertToPatchBatch(factoryOutput: FactoryOutput): PatchBatch {
    // Validate input structure
    this.validateFactoryOutput(factoryOutput);

    // Convert operations based on factory type
    const operations = this.convertOperations(factoryOutput.operations, factoryOutput.type);

    // Create patch batch
    const patchBatch: PatchBatch = {
      patchId: factoryOutput.orderId || `factory-${factoryOutput.type}-${Date.now()}`,
      operations,
      metadata: {
        factoryType: factoryOutput.type,
        sourceMetadata: factoryOutput.metadata || {},
        convertedAt: new Date().toISOString(),
        operationCount: operations.length,
      },
    };

    // Validate the final batch
    return PatchBatchSchema.parse(patchBatch);
  }

  /**
   * Groups related patch operations into logical batches.
   *
   * @param operations - Array of individual patch operations
   * @returns Array of patch batches grouped by related functionality
   */
  groupOperations(operations: PatchOperation[]): PatchBatch[] {
    const groups = new Map<string, PatchOperation[]>();

    // Group by file path (simplified grouping strategy)
    for (const operation of operations) {
      const filePath = operation.path.split('/').slice(0, -1).join('/') || 'root';
      const key = `${filePath}-${operation.op}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(operation);
    }

    // Create batches from groups
    const batches: PatchBatch[] = [];
    let batchIndex = 0;

    for (const [groupKey, groupOperations] of groups) {
      if (groupOperations.length > 0) {
        const batch: PatchBatch = {
          patchId: `grouped-batch-${batchIndex++}`,
          operations: groupOperations,
          metadata: {
            groupKey,
            operationCount: groupOperations.length,
            groupedAt: new Date().toISOString(),
          },
        };
        batches.push(batch);
      }
    }

    return batches;
  }

  /**
   * Converts factory-specific operations to standardized patch operations.
   */
  private convertOperations(factoryOps: FactoryOperation[], factoryType: string): PatchOperation[] {
    const operations: PatchOperation[] = [];

    for (const factoryOp of factoryOps) {
      const patchOp = this.convertSingleOperation(factoryOp, factoryType);
      if (patchOp) {
        operations.push(patchOp);
      }
    }

    return operations;
  }

  /**
   * Converts a single factory operation to a patch operation.
   */
  private convertSingleOperation(factoryOp: FactoryOperation, factoryType: string): PatchOperation | null {
    const baseOperation: Partial<PatchOperation> = {
      path: factoryOp.target,
    };

    switch (factoryOp.type) {
      case 'create':
        return {
          ...baseOperation,
          op: 'add',
          path: factoryOp.target,
          value: factoryOp.content || '',
          ...this.getPositionDetails(factoryOp),
        } as PatchOperation;

      case 'update':
        return {
          ...baseOperation,
          op: 'replace',
          path: factoryOp.target,
          value: factoryOp.content || '',
          ...this.getPositionDetails(factoryOp),
        } as PatchOperation;

      case 'delete':
        return {
          ...baseOperation,
          op: 'remove',
          path: factoryOp.target,
          ...this.getPositionDetails(factoryOp),
        } as PatchOperation;

      case 'move':
        if (!factoryOp.source) {
          throw new Error(`Move operation requires source: ${JSON.stringify(factoryOp)}`);
        }
        return {
          ...baseOperation,
          op: 'move',
          path: factoryOp.target,
          from: factoryOp.source,
          ...this.getPositionDetails(factoryOp),
        } as PatchOperation;

      case 'copy':
        if (!factoryOp.source) {
          throw new Error(`Copy operation requires source: ${JSON.stringify(factoryOp)}`);
        }
        return {
          ...baseOperation,
          op: 'copy',
          path: factoryOp.target,
          from: factoryOp.source,
          ...this.getPositionDetails(factoryOp),
        } as PatchOperation;

      default:
        console.warn(`Unsupported factory operation type: ${factoryOp.type} from ${factoryType}`);
        return null;
    }
  }

  /**
   * Extracts position details from factory operation.
   */
  private getPositionDetails(factoryOp: FactoryOperation): Partial<PatchOperation> {
    const details: Partial<PatchOperation> = {};

    // Handle marker-based positioning
    if (factoryOp.marker) {
      details.block = factoryOp.marker;
    }

    // Position details don't affect the operation type, just positioning
    // The operation type is set in convertSingleOperation based on factoryOp.type
    return details;
  }

  /**
   * Validates factory output structure.
   */
  private validateFactoryOutput(output: FactoryOutput): void {
    if (!output.type) {
      throw new Error('Factory output must have a type');
    }

    if (!Array.isArray(output.operations)) {
      throw new Error('Factory output must have operations array');
    }

    const validTypes = ['agent-factory', 'ui-factory', 'data-factory', 'custom'];
    if (!validTypes.includes(output.type)) {
      throw new Error(`Invalid factory type: ${output.type}. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate each operation
    for (const op of output.operations) {
      if (!op.type || !op.target) {
        throw new Error(`Factory operation missing required fields: ${JSON.stringify(op)}`);
      }

      const validOpTypes = ['create', 'update', 'delete', 'move', 'copy'];
      if (!validOpTypes.includes(op.type)) {
        throw new Error(`Invalid operation type: ${op.type}. Must be one of: ${validOpTypes.join(', ')}`);
      }
    }
  }

  /**
   * Merges multiple factory outputs into a single patch batch.
   */
  mergeFactoryOutputs(outputs: FactoryOutput[]): PatchBatch {
    if (outputs.length === 0) {
      throw new Error('Cannot merge empty factory outputs');
    }

    // Convert each output to operations
    const allOperations: PatchOperation[] = [];
    const metadata = {
      mergedOutputs: outputs.length,
      factoryTypes: [...new Set(outputs.map(o => o.type))],
      mergedAt: new Date().toISOString(),
      totalOperations: 0,
    };

    for (const output of outputs) {
      const operations = this.convertOperations(output.operations, output.type);
      allOperations.push(...operations);
    }

    metadata.totalOperations = allOperations.length;

    // Create merged batch
    const mergedBatch: PatchBatch = {
      patchId: `merged-${Date.now()}`,
      operations: allOperations,
      metadata,
    };

    return PatchBatchSchema.parse(mergedBatch);
  }
}
