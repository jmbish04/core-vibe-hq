import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scheduled } from '../../orchestrator/worker/index';

// Mock the OpsMonitorService
vi.mock('../../orchestrator/worker/services/ops/opsMonitorService', () => ({
  OpsMonitorService: vi.fn().mockImplementation(() => ({
    ingestLogs: vi.fn(),
    analyzeAndFile: vi.fn()
  }))
}));

// Mock the logger
vi.mock('../../orchestrator/worker/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn()
  }))
}));

describe('Scheduled Handler', () => {
  let mockEnv: any;
  let mockCtx: any;
  let mockEvent: any;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Setup mock environment and context
    mockEnv = {
      DB_OPS: {} // Mock database binding
    };
    mockCtx = {
      waitUntil: vi.fn()
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Daily full scan (0 2 * * *)', () => {
    beforeEach(() => {
      mockEvent = { cron: '0 2 * * *' };
    });

    it('should run full operations scan at 2 AM', async () => {
      const { OpsMonitorService } = await import('../../orchestrator/worker/services/ops/opsMonitorService');
      const mockOpsMonitor = OpsMonitorService.mock.results[0].value;

      await scheduled.scheduled(mockEvent, mockEnv, mockCtx);

      expect(OpsMonitorService).toHaveBeenCalledWith(mockEnv.DB_OPS);
      expect(mockOpsMonitor.ingestLogs).toHaveBeenCalledWith('full');
      expect(mockOpsMonitor.analyzeAndFile).toHaveBeenCalledWith('full');
    });

    it('should handle errors during full scan', async () => {
      const { OpsMonitorService } = await import('../../orchestrator/worker/services/ops/opsMonitorService');
      const mockOpsMonitor = OpsMonitorService.mock.results[0].value;

      // Make ingestLogs throw an error
      mockOpsMonitor.ingestLogs.mockRejectedValueOnce(new Error('Database error'));

      await expect(scheduled.scheduled(mockEvent, mockEnv, mockCtx)).rejects.toThrow('Database error');
    });
  });

  describe('Incremental scans (0 */4 * * *)', () => {
    beforeEach(() => {
      mockEvent = { cron: '0 */4 * * *' };
    });

    it('should run incremental operations scan every 4 hours', async () => {
      const { OpsMonitorService } = await import('../../orchestrator/worker/services/ops/opsMonitorService');
      const mockOpsMonitor = OpsMonitorService.mock.results[0].value;

      await scheduled.scheduled(mockEvent, mockEnv, mockCtx);

      expect(OpsMonitorService).toHaveBeenCalledWith(mockEnv.DB_OPS);
      expect(mockOpsMonitor.ingestLogs).toHaveBeenCalledWith('incremental');
      expect(mockOpsMonitor.analyzeAndFile).toHaveBeenCalledWith('incremental');
    });

    it('should handle errors during incremental scan', async () => {
      const { OpsMonitorService } = await import('../../orchestrator/worker/services/ops/opsMonitorService');
      const mockOpsMonitor = OpsMonitorService.mock.results[0].value;

      // Make analyzeAndFile throw an error
      mockOpsMonitor.analyzeAndFile.mockRejectedValueOnce(new Error('Analysis error'));

      await expect(scheduled.scheduled(mockEvent, mockEnv, mockCtx)).rejects.toThrow('Analysis error');
    });
  });

  describe('Unsupported cron schedules', () => {
    it('should not run operations for unsupported cron schedules', async () => {
      mockEvent = { cron: '0 12 * * *' }; // Noon schedule not supported

      const { OpsMonitorService } = await import('../../orchestrator/worker/services/ops/opsMonitorService');

      await scheduled.scheduled(mockEvent, mockEnv, mockCtx);

      // OpsMonitorService should not be instantiated for unsupported schedules
      expect(OpsMonitorService).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should re-throw errors to ensure cron job failure is recorded', async () => {
      mockEvent = { cron: '0 2 * * *' };

      const { OpsMonitorService } = await import('../../orchestrator/worker/services/ops/opsMonitorService');
      const mockOpsMonitor = OpsMonitorService.mock.results[0].value;

      const testError = new Error('Test error');
      mockOpsMonitor.ingestLogs.mockRejectedValueOnce(testError);

      await expect(scheduled.scheduled(mockEvent, mockEnv, mockCtx)).rejects.toThrow('Test error');
    });

    it('should handle database connection errors', async () => {
      mockEvent = { cron: '0 */4 * * *' };

      const { OpsMonitorService } = await import('../../orchestrator/worker/services/ops/opsMonitorService');
      const mockOpsMonitor = OpsMonitorService.mock.results[0].value;

      mockOpsMonitor.ingestLogs.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(scheduled.scheduled(mockEvent, mockEnv, mockCtx)).rejects.toThrow('Connection failed');
    });
  });

  describe('Logging', () => {
    it('should log the start of scheduled tasks', async () => {
      mockEvent = { cron: '0 2 * * *' };

      const { createLogger } = await import('../../orchestrator/worker/logger');
      const mockLogger = createLogger.mock.results[0].value;

      await scheduled.scheduled(mockEvent, mockEnv, mockCtx);

      expect(mockLogger.info).toHaveBeenCalledWith('Running scheduled task: 0 2 * * *');
      expect(mockLogger.info).toHaveBeenCalledWith('Running daily full operations scan');
      expect(mockLogger.info).toHaveBeenCalledWith('Scheduled task completed successfully');
    });

    it('should log errors that occur during execution', async () => {
      mockEvent = { cron: '0 */4 * * *' };

      const { OpsMonitorService } = await import('../../orchestrator/worker/services/ops/opsMonitorService');
      const mockOpsMonitor = OpsMonitorService.mock.results[0].value;
      const { createLogger } = await import('../../orchestrator/worker/logger');
      const mockLogger = createLogger.mock.results[0].value;

      const testError = new Error('Test error');
      mockOpsMonitor.ingestLogs.mockRejectedValueOnce(testError);

      await expect(scheduled.scheduled(mockEvent, mockEnv, mockCtx)).rejects.toThrow('Test error');

      expect(mockLogger.error).toHaveBeenCalledWith('Error in scheduled task:', testError);
    });
  });
});
