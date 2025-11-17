import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scheduled } from '../../worker/index';
import { OpsMonitorService } from '../../worker/services/ops/opsMonitorService';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';

// Mock all dependencies
vi.mock('../../worker/services/ops/opsMonitorService');
vi.mock('../../third_party/partykit/packages/partyserver/src/index');
vi.mock('../../worker/durable-objects/ops/OpsMonitorBroadcastServer');
vi.mock('kysely-d1');
vi.mock('../../worker/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Import logger mock
import { logger } from '../../worker/logger';

describe('Scheduled Handler', () => {
  let mockEnv: any;
  let mockCtx: any;
  let mockOpsMonitorService: any;
  let mockDb: any;
  let mockBroadcastServer: any;
  let mockGetServerByName: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mocks
    mockOpsMonitorService = {
      runScan: vi.fn(),
    };

    mockDb = {
      destroy: vi.fn(),
    };

    mockBroadcastServer = {
      fetch: vi.fn(),
    };

    mockGetServerByName = vi.fn().mockResolvedValue(mockBroadcastServer);

    // Mock the services
    (OpsMonitorService as any).mockImplementation(() => mockOpsMonitorService);
    (Kysely as any).mockImplementation(() => mockDb);

    // Mock the PartyServer imports
    const partykitMock = await import('../../third_party/partykit/packages/partyserver/src/index');
    partykitMock.getServerByName = mockGetServerByName;

    // Mock Durable Object namespace
    mockEnv = {
      DB_OPS: {},
      OPS_MONITOR_BROADCAST: {},
    };

    mockCtx = {};

    // Setup scan results
    mockOpsMonitorService.runScan.mockResolvedValue({
      scanId: 'test-scan-123',
      scope: 'full',
      status: 'completed',
      processedLogs: 1000,
      issuesFiled: 5,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Daily full scan (0 2 * * *)', () => {
    it('should run full scan at 2 AM schedule', async () => {
      const event = { cron: '0 2 * * *' };

      await scheduled.scheduled(event, mockEnv, mockCtx);

      expect(logger.info).toHaveBeenCalledWith('Running scheduled task: 0 2 * * *');
      expect(logger.info).toHaveBeenCalledWith('Running daily full operations scan');
      expect(logger.info).toHaveBeenCalledWith('Scheduled task completed successfully');

      expect(mockOpsMonitorService.runScan).toHaveBeenCalledWith({ scope: 'full' });
      expect(mockOpsMonitorService.runScan).toHaveBeenCalledTimes(1);

      expect(mockDb.destroy).toHaveBeenCalled();
    });

    it('should broadcast scan results', async () => {
      const event = { cron: '0 2 * * *' };
      const expectedScanResult = {
        scanId: 'test-scan-123',
        scope: 'full',
        status: 'completed',
        processedLogs: 1000,
        issuesFiled: 5,
      };

      await scheduled.scheduled(event, mockEnv, mockCtx);

      expect(mockGetServerByName).toHaveBeenCalledWith(
        mockEnv.OPS_MONITOR_BROADCAST,
        'main'
      );

      expect(mockBroadcastServer.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(expectedScanResult),
        })
      );
    });
  });

  describe('Incremental scans (0 */4 * * *)', () => {
    it('should run incremental scan every 4 hours', async () => {
      const event = { cron: '0 */4 * * *' };

      await scheduled.scheduled(event, mockEnv, mockCtx);

      expect(logger.info).toHaveBeenCalledWith('Running scheduled task: 0 */4 * * *');
      expect(logger.info).toHaveBeenCalledWith('Running incremental operations scan');
      expect(logger.info).toHaveBeenCalledWith('Scheduled task completed successfully');

      expect(mockOpsMonitorService.runScan).toHaveBeenCalledWith({ scope: 'incremental' });
      expect(mockOpsMonitorService.runScan).toHaveBeenCalledTimes(1);

      expect(mockDb.destroy).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle scan errors gracefully', async () => {
      const event = { cron: '0 2 * * *' };
      const scanError = new Error('Scan failed');

      mockOpsMonitorService.runScan.mockRejectedValue(scanError);

      await expect(scheduled.scheduled(event, mockEnv, mockCtx)).rejects.toThrow(scanError);

      expect(logger.error).toHaveBeenCalledWith('Error in scheduled task:', scanError);
      expect(mockDb.destroy).toHaveBeenCalled();
    });

    it('should handle broadcast errors gracefully', async () => {
      const event = { cron: '0 2 * * *' };
      const broadcastError = new Error('Broadcast failed');

      mockBroadcastServer.fetch.mockRejectedValue(broadcastError);

      await scheduled.scheduled(event, mockEnv, mockCtx);

      // Should still complete successfully despite broadcast error
      expect(logger.error).toHaveBeenCalledWith('Failed to broadcast scan result from scheduled handler:', broadcastError);
      expect(logger.info).toHaveBeenCalledWith('Scheduled task completed successfully');
    });

    it('should handle getServerByName errors gracefully', async () => {
      const event = { cron: '0 2 * * *' };
      const serverError = new Error('Server not found');

      mockGetServerByName.mockRejectedValue(serverError);

      await scheduled.scheduled(event, mockEnv, mockCtx);

      expect(logger.error).toHaveBeenCalledWith('Failed to broadcast scan result from scheduled handler:', serverError);
      expect(logger.info).toHaveBeenCalledWith('Scheduled task completed successfully');
    });
  });

  describe('Database lifecycle', () => {
    it('should always destroy database connection', async () => {
      const event = { cron: '0 2 * * *' };

      await scheduled.scheduled(event, mockEnv, mockCtx);

      expect(mockDb.destroy).toHaveBeenCalledTimes(1);
    });

    it('should destroy database even when scan fails', async () => {
      const event = { cron: '0 2 * * *' };
      mockOpsMonitorService.runScan.mockRejectedValue(new Error('Scan failed'));

      await expect(scheduled.scheduled(event, mockEnv, mockCtx)).rejects.toThrow();

      expect(mockDb.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Unhandled cron schedules', () => {
    it('should not run scan for unhandled cron schedules', async () => {
      const event = { cron: '0 12 * * *' }; // Noon schedule, not handled

      await scheduled.scheduled(event, mockEnv, mockCtx);

      expect(logger.info).toHaveBeenCalledWith('Running scheduled task: 0 12 * * *');
      expect(logger.info).toHaveBeenCalledWith('Scheduled task completed successfully');

      expect(mockOpsMonitorService.runScan).not.toHaveBeenCalled();
      expect(mockDb.destroy).toHaveBeenCalled();
    });
  });

  describe('Service initialization', () => {
    it('should initialize OpsMonitorService with broadcast callback', async () => {
      const event = { cron: '0 2 * * *' };

      await scheduled.scheduled(event, mockEnv, mockCtx);

      expect(OpsMonitorService).toHaveBeenCalledWith(mockDb, expect.any(Function));
    });

    it('should create Kysely database instance', async () => {
      const event = { cron: '0 2 * * *' };

      await scheduled.scheduled(event, mockEnv, mockCtx);

      expect(Kysely).toHaveBeenCalledWith({
        dialect: expect.any(D1Dialect),
      });
    });
  });
});
