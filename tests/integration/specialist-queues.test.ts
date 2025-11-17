/**
 * Integration Tests for Specialist Automation Queue System
 *
 * Tests the complete flow of specialist triggering, queueing, and processing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpecialistQueueManager } from '../../orchestrator/worker/services/specialists/queueManager';
import { SpecialistTriggers } from '../../orchestrator/worker/services/specialists/triggers';
import { DatabaseService } from '../../orchestrator/worker/database/database';

// Mock logger for testing
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

describe('Specialist Queue System', () => {
  let db: DatabaseService;
  let queueManager: SpecialistQueueManager;
  let triggers: SpecialistTriggers;

  beforeEach(async () => {
    // Initialize database service (would need actual test database)
    // For now, we'll mock the database operations
    db = {} as DatabaseService;
    queueManager = new SpecialistQueueManager(db, mockLogger);
    triggers = new SpecialistTriggers(queueManager, mockLogger);

    // Initialize default triggers
    await queueManager.initializeTriggers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Queue Manager', () => {
    it('should initialize default triggers', async () => {
      // Verify triggers were initialized
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Initialized specialist trigger',
        expect.objectContaining({
          specialistType: 'docstring-architect',
          triggerEvent: 'code-generation-complete',
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Initialized specialist trigger',
        expect.objectContaining({
          specialistType: 'lint-surgeon',
          triggerEvent: 'lint-errors-detected',
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Initialized specialist trigger',
        expect.objectContaining({
          specialistType: 'dependency-auditor',
          triggerEvent: 'dependency-changed',
        })
      );
    });

    it('should trigger specialist successfully', async () => {
      // Mock database insert
      const mockDb = {
        ops: {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              onConflictDoNothing: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: 123 }]),
              }),
            }),
          }),
        },
        opsSchema: {
          specialistTriggers: {},
          specialistQueues: { id: 'id' },
        },
      };
      (queueManager as any).db = mockDb;

      const result = await queueManager.triggerSpecialist({
        specialistType: 'docstring-architect',
        triggerEvent: 'code-generation-complete',
        payload: { test: 'data' },
        triggeredBy: 'test',
        orderId: 'order-123',
        priority: 1,
      });

      expect(result.success).toBe(true);
      expect(result.queueId).toBe(123);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Specialist queue item created',
        expect.objectContaining({
          queueId: 123,
          specialistType: 'docstring-architect',
        })
      );
    });

    it('should prevent duplicate queue items', async () => {
      // Mock database to return existing queue item
      const mockDb = {
        ops: {
          select: vi.fn().mockResolvedValue([{ id: 456 }]),
        },
        opsSchema: {
          specialistQueues: {},
        },
      };
      (queueManager as any).db = mockDb;

      const result = await queueManager.triggerSpecialist({
        specialistType: 'docstring-architect',
        triggerEvent: 'code-generation-complete',
        payload: { test: 'data' },
        triggeredBy: 'test',
        orderId: 'order-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Similar queue item already exists');
    });

    it('should get queue statistics', async () => {
      // Mock database stats query
      const mockDb = {
        ops: {
          select: vi.fn().mockResolvedValue([
            { status: 'pending', count: 5 },
            { status: 'processing', count: 2 },
            { status: 'completed', count: 10 },
            { status: 'failed', count: 1 },
          ]),
          count: vi.fn(),
        },
        opsSchema: {
          specialistQueues: { status: 'status' },
        },
      };
      (queueManager as any).db = mockDb;

      const stats = await queueManager.getQueueStats();

      expect(stats).toEqual({
        pending: 5,
        processing: 2,
        completed: 10,
        failed: 1,
        total: 18,
      });
    });

    it('should complete queue items', async () => {
      // Mock database update
      const mockDb = {
        ops: {
          update: vi.fn().mockResolvedValue(1),
        },
        opsSchema: {
          specialistQueues: {},
        },
      };
      (queueManager as any).db = mockDb;

      const result = await queueManager.completeQueueItem(123, { processed: true });

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Queue item completed',
        expect.objectContaining({
          queueId: 123,
          status: 'completed',
        })
      );
    });
  });

  describe('Specialist Triggers', () => {
    it('should trigger DocString Architect for large code generation', async () => {
      // Mock successful trigger
      const mockQueueManager = {
        triggerSpecialist: vi.fn().mockResolvedValue({ success: true, queueId: 789 }),
      };
      (triggers as any).queueManager = mockQueueManager;

      await triggers.onCodeGenerationComplete({
        orderId: 'order-456',
        factoryType: 'agent-factory',
        filesGenerated: 3,
        totalLinesGenerated: 150,
        templateUsed: 'basic-worker',
      });

      expect(mockQueueManager.triggerSpecialist).toHaveBeenCalledWith({
        specialistType: 'docstring-architect',
        triggerEvent: 'code-generation-complete',
        payload: expect.objectContaining({
          orderId: 'order-456',
          totalLinesGenerated: 150,
        }),
        triggeredBy: 'factory-agent',
        orderId: 'order-456',
        priority: 1,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Triggered DocString Architect for code generation',
        expect.objectContaining({
          orderId: 'order-456',
          queueId: 789,
        })
      );
    });

    it('should not trigger for small code generation', async () => {
      const mockQueueManager = {
        triggerSpecialist: vi.fn(),
      };
      (triggers as any).queueManager = mockQueueManager;

      await triggers.onCodeGenerationComplete({
        orderId: 'order-small',
        factoryType: 'agent-factory',
        filesGenerated: 1,
        totalLinesGenerated: 20, // Below threshold
        templateUsed: 'basic-worker',
      });

      expect(mockQueueManager.triggerSpecialist).not.toHaveBeenCalled();
    });

    it('should trigger Lint Surgeon for multiple errors', async () => {
      const mockQueueManager = {
        triggerSpecialist: vi.fn().mockResolvedValue({ success: true, queueId: 999 }),
      };
      (triggers as any).queueManager = mockQueueManager;

      await triggers.onLintErrorsDetected({
        projectId: 'project-789',
        errorCount: 5,
        errorTypes: ['no-unused-vars', 'missing-semicolon'],
        filesAffected: ['src/main.ts', 'src/utils.ts'],
      });

      expect(mockQueueManager.triggerSpecialist).toHaveBeenCalledWith({
        specialistType: 'lint-surgeon',
        triggerEvent: 'lint-errors-detected',
        payload: expect.objectContaining({
          projectId: 'project-789',
          errorCount: 5,
        }),
        triggeredBy: 'lint-runner',
        priority: 1,
      });
    });

    it('should trigger Dependency Auditor for major version changes', async () => {
      const mockQueueManager = {
        triggerSpecialist: vi.fn().mockResolvedValue({ success: true, queueId: 111 }),
      };
      (triggers as any).queueManager = mockQueueManager;

      await triggers.onDependencyChanged({
        projectId: 'project-999',
        packageName: 'react',
        oldVersion: '17.0.0',
        newVersion: '18.0.0',
        changeType: 'major',
      });

      expect(mockQueueManager.triggerSpecialist).toHaveBeenCalledWith({
        specialistType: 'dependency-auditor',
        triggerEvent: 'dependency-changed',
        payload: expect.objectContaining({
          projectId: 'project-999',
          changeType: 'major',
        }),
        triggeredBy: 'dependency-scanner',
        priority: 2,
      });
    });

    it('should handle custom trigger events', async () => {
      const mockQueueManager = {
        triggerSpecialist: vi.fn().mockResolvedValue({ success: true, queueId: 222 }),
      };
      (triggers as any).queueManager = mockQueueManager;

      const result = await triggers.triggerCustomEvent(
        'custom-specialist',
        'custom-event',
        { customData: 'test' },
        {
          triggeredBy: 'test-service',
          orderId: 'order-123',
          priority: 1,
        }
      );

      expect(result).toBe(true);
      expect(mockQueueManager.triggerSpecialist).toHaveBeenCalledWith({
        specialistType: 'custom-specialist',
        triggerEvent: 'custom-event',
        payload: { customData: 'test' },
        triggeredBy: 'test-service',
        orderId: 'order-123',
        priority: 1,
      });
    });
  });

  describe('Integration Flow', () => {
    it('should handle complete trigger-to-queue flow', async () => {
      // Mock database operations
      const mockDb = {
        ops: {
          select: vi.fn()
            .mockResolvedValueOnce([]) // No existing triggers
            .mockResolvedValueOnce([{ isActive: 1 }]) // Active trigger found
            .mockResolvedValueOnce([]), // No duplicate queue items
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              onConflictDoNothing: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: 333 }]),
              }),
            }),
          }),
        },
        opsSchema: {
          specialistTriggers: {},
          specialistQueues: { id: 'id' },
        },
      };
      (queueManager as any).db = mockDb;

      // Test complete flow
      const triggerResult = await triggers.onCodeGenerationComplete({
        orderId: 'integration-test',
        factoryType: 'agent-factory',
        filesGenerated: 2,
        totalLinesGenerated: 100,
        templateUsed: 'test-template',
      });

      // Verify trigger was created
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Triggered DocString Architect for code generation',
        expect.objectContaining({
          orderId: 'integration-test',
          queueId: 333,
        })
      );
    });

    it('should handle trigger failures gracefully', async () => {
      // Mock queue manager to fail
      const mockQueueManager = {
        triggerSpecialist: vi.fn().mockResolvedValue({
          success: false,
          error: 'Database connection failed'
        }),
      };
      (triggers as any).queueManager = mockQueueManager;

      await triggers.onCodeGenerationComplete({
        orderId: 'failure-test',
        factoryType: 'agent-factory',
        filesGenerated: 1,
        totalLinesGenerated: 80,
        templateUsed: 'test-template',
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to trigger DocString Architect',
        expect.objectContaining({
          orderId: 'failure-test',
          reason: 'Database connection failed',
        })
      );
    });
  });
});
