/**
 * Unit tests for PatchBridge service
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PatchBridge, type FactoryOutput, type FactoryOperation } from '../../../../orchestrator/worker/services/patch/patchBridge'
import { PatchBatchSchema } from '@shared/contracts'

describe('PatchBridge', () => {
  let bridge: PatchBridge

  beforeEach(() => {
    bridge = new PatchBridge()
  })

  describe('convertToPatchBatch', () => {
    it('should convert agent-factory output to patch batch', () => {
      const factoryOutput: FactoryOutput = {
        type: 'agent-factory',
        orderId: 'agent-order-123',
        operations: [
          {
            type: 'create',
            target: 'src/agents/NewAgent.ts',
            content: 'export class NewAgent { }',
            position: 'append'
          }
        ],
        metadata: {
          generatedBy: 'agent-factory-v1',
          templateUsed: 'basic-agent'
        }
      }

      const batch = bridge.convertToPatchBatch(factoryOutput)

      expect(batch.patchId).toBe('agent-order-123')
      expect(batch.operations).toHaveLength(1)
      expect(batch.operations[0].op).toBe('add')
      expect(batch.operations[0].path).toBe('src/agents/NewAgent.ts')
      expect(batch.operations[0].value).toBe('export class NewAgent { }')
      expect(batch.metadata?.factoryType).toBe('agent-factory')
    })

    it('should convert multiple operations', () => {
      const factoryOutput: FactoryOutput = {
        type: 'ui-factory',
        operations: [
          {
            type: 'create',
            target: 'src/components/Button.tsx',
            content: 'export const Button = () => <button>Click</button>;'
          },
          {
            type: 'update',
            target: 'src/styles/main.css',
            content: '.button { color: blue; }',
            position: 'append'
          }
        ]
      }

      const batch = bridge.convertToPatchBatch(factoryOutput)

      expect(batch.operations).toHaveLength(2)
      expect(batch.operations[0].op).toBe('add')
      expect(batch.operations[1].op).toBe('replace')
    })

    it('should handle move operations', () => {
      const factoryOutput: FactoryOutput = {
        type: 'data-factory',
        operations: [
          {
            type: 'move',
            target: 'src/models/NewLocation.ts',
            source: 'src/models/OldLocation.ts'
          }
        ]
      }

      const batch = bridge.convertToPatchBatch(factoryOutput)

      expect(batch.operations[0].op).toBe('move')
      expect(batch.operations[0].path).toBe('src/models/NewLocation.ts')
      expect(batch.operations[0].from).toBe('src/models/OldLocation.ts')
    })

    it('should handle copy operations', () => {
      const factoryOutput: FactoryOutput = {
        type: 'custom',
        operations: [
          {
            type: 'copy',
            target: 'src/utils/copy.ts',
            source: 'src/templates/base.ts'
          }
        ]
      }

      const batch = bridge.convertToPatchBatch(factoryOutput)

      expect(batch.operations[0].op).toBe('copy')
      expect(batch.operations[0].path).toBe('src/utils/copy.ts')
      expect(batch.operations[0].from).toBe('src/templates/base.ts')
    })

    it('should generate patch ID when not provided', () => {
      const factoryOutput: FactoryOutput = {
        type: 'agent-factory',
        operations: [
          {
            type: 'create',
            target: 'test.ts',
            content: 'test'
          }
        ]
      }

      const batch = bridge.convertToPatchBatch(factoryOutput)

      expect(batch.patchId).toMatch(/^factory-agent-factory-\d+$/)
    })

    it('should validate factory output structure', () => {
      const invalidOutput = {
        operations: []
        // Missing type
      }

      expect(() => bridge.convertToPatchBatch(invalidOutput as any)).toThrow('Factory output must have a type')
    })

    it('should reject invalid factory types', () => {
      const invalidOutput: FactoryOutput = {
        type: 'invalid-type' as any,
        operations: []
      }

      expect(() => bridge.convertToPatchBatch(invalidOutput)).toThrow('Invalid factory type')
    })

    it('should reject operations without required fields', () => {
      const invalidOutput: FactoryOutput = {
        type: 'agent-factory',
        operations: [
          {
            type: 'create'
            // Missing target
          } as any
        ]
      }

      expect(() => bridge.convertToPatchBatch(invalidOutput)).toThrow('missing required fields')
    })
  })

  describe('groupOperations', () => {
    it('should group operations by file path', () => {
      const operations = [
        {
          op: 'add',
          path: 'src/components/Button.ts',
          value: 'button code'
        },
        {
          op: 'add',
          path: 'src/components/Input.ts',
          value: 'input code'
        },
        {
          op: 'replace',
          path: 'src/components/Button.ts',
          value: 'updated button'
        }
      ]

      const batches = bridge.groupOperations(operations as any)

      expect(batches.length).toBeGreaterThan(1)
      const buttonOps = batches.find(b => b.operations.some(op => op.path.includes('Button')))
      expect(buttonOps?.operations).toHaveLength(2)
    })

    it('should create valid patch batches', () => {
      const operations = [
        {
          op: 'add',
          path: 'test.ts',
          value: 'test code'
        }
      ]

      const batches = bridge.groupOperations(operations as any)

      batches.forEach(batch => {
        expect(() => PatchBatchSchema.parse(batch)).not.toThrow()
      })
    })
  })

  describe('mergeFactoryOutputs', () => {
    it('should merge multiple factory outputs', () => {
      const outputs: FactoryOutput[] = [
        {
          type: 'agent-factory',
          operations: [
            {
              type: 'create',
              target: 'agent1.ts',
              content: 'agent 1'
            }
          ]
        },
        {
          type: 'ui-factory',
          operations: [
            {
              type: 'create',
              target: 'component1.tsx',
              content: 'component 1'
            }
          ]
        }
      ]

      const merged = bridge.mergeFactoryOutputs(outputs)

      expect(merged.operations).toHaveLength(2)
      expect(merged.metadata?.mergedOutputs).toBe(2)
      expect(merged.metadata?.factoryTypes).toEqual(['agent-factory', 'ui-factory'])
    })

    it('should reject empty outputs array', () => {
      expect(() => bridge.mergeFactoryOutputs([])).toThrow('Cannot merge empty factory outputs')
    })
  })

  describe('operation conversion', () => {
    it('should convert create operations', () => {
      const factoryOp: FactoryOperation = {
        type: 'create',
        target: 'newfile.ts',
        content: 'file content',
        position: 'append'
      }

      const operations = (bridge as any).convertOperations([factoryOp], 'test-factory')

      expect(operations[0].op).toBe('add')
      expect(operations[0].path).toBe('newfile.ts')
      expect(operations[0].value).toBe('file content')
    })

    it('should convert update operations', () => {
      const factoryOp: FactoryOperation = {
        type: 'update',
        target: 'existing.ts',
        content: 'updated content',
        position: 'replace'
      }

      const operations = (bridge as any).convertOperations([factoryOp], 'test-factory')

      expect(operations[0].op).toBe('replace')
      expect(operations[0].path).toBe('existing.ts')
    })

    it('should convert delete operations', () => {
      const factoryOp: FactoryOperation = {
        type: 'delete',
        target: 'to-delete.ts'
      }

      const operations = (bridge as any).convertOperations([factoryOp], 'test-factory')

      expect(operations[0].op).toBe('remove')
      expect(operations[0].path).toBe('to-delete.ts')
    })

    it('should handle marker-based positioning', () => {
      const factoryOp: FactoryOperation = {
        type: 'create',
        target: 'marked.ts',
        content: 'content',
        marker: 'INSERT_HERE'
      }

      const operations = (bridge as any).convertOperations([factoryOp], 'test-factory')

      expect(operations[0].block).toBe('INSERT_HERE')
    })
  })
})
