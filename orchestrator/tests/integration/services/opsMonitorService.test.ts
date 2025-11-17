import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpsMonitorService } from '../../../../worker/services/ops/opsMonitorService';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';

// Mock D1 database
const mockDb = {
  insertInto: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => ({
        executeTakeFirstOrThrow: vi.fn(),
      })),
    })),
  })),
  updateTable: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        execute: vi.fn(),
      })),
    })),
  })),
  selectFrom: vi.fn(() => ({
    select: vi.fn(() => ({
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          execute: vi.fn(),
        })),
      })),
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            execute: vi.fn(),
          })),
        })),
      })),
    })),
  })),
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        where: vi.fn(() => ({
          execute: vi.fn(),
        })),
      })),
    })),
  })),
};

vi.mock('kysely-d1', () => ({
  D1Dialect: vi.fn(),
}));

describe('OpsMonitorService Integration', () => {
  let service: OpsMonitorService;
  let mockBroadcastCallback: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockBroadcastCallback = vi.fn();

    // Reset all db mock chains
    Object.values(mockDb).forEach(mock => {
      if (typeof mock === 'function') {
        mock.mockClear();
        // Reset nested mocks
        if (mock.mockReturnValue) {
          const returnValue = mock.mockReturnValue;
          if (returnValue && typeof returnValue === 'object') {
            Object.values(returnValue).forEach(nestedMock => {
              if (typeof nestedMock === 'function' && nestedMock.mockClear) {
                nestedMock.mockClear();
              }
            });
          }
        }
      }
    });

    service = new OpsMonitorService(mockDb as any, mockBroadcastCallback);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('runScan', () => {
    it('should execute a full scan successfully', async () => {
      // Mock database operations
      const mockInsertResult = { id: 123 };
      const mockProcessedLogs = 1200;
      const mockIssuesFiled = 8;

      // Setup mock chains
      mockDb.insertInto.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue({
            executeTakeFirstOrThrow: vi.fn().mockResolvedValue(mockInsertResult),
          }),
        }),
      });

      mockDb.updateTable.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      });

      // Mock the private methods by accessing them through prototype
      const ingestLogsSpy = vi.spyOn(OpsMonitorService.prototype as any, 'ingestLogs')
        .mockResolvedValue(mockProcessedLogs);
      const analyzeAndFileSpy = vi.spyOn(OpsMonitorService.prototype as any, 'analyzeAndFile')
        .mockResolvedValue(mockIssuesFiled);

      const result = await service.runScan({ scope: 'full' });

      expect(result).toEqual({
        scanId: 'scan-123',
        scope: 'full',
        processedLogs: mockProcessedLogs,
        issuesFiled: mockIssuesFiled,
        status: 'completed',
        completedAt: expect.any(String),
        findings: expect.objectContaining({
          scope: 'full',
          processedLogs: mockProcessedLogs,
          issuesFiled: mockIssuesFiled,
          completedAt: expect.any(String),
        }),
      });

      expect(mockDb.insertInto).toHaveBeenCalledWith('ops_scans');
      expect(mockDb.updateTable).toHaveBeenCalledWith('ops_scans');
      expect(ingestLogsSpy).toHaveBeenCalledWith('full');
      expect(analyzeAndFileSpy).toHaveBeenCalledWith('full');
      expect(mockBroadcastCallback).toHaveBeenCalledWith(result);
    });

    it('should execute an incremental scan by default', async () => {
      const mockInsertResult = { id: 456 };
      const mockProcessedLogs = 180;
      const mockIssuesFiled = 2;

      mockDb.insertInto.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue({
            executeTakeFirstOrThrow: vi.fn().mockResolvedValue(mockInsertResult),
          }),
        }),
      });

      mockDb.updateTable.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      });

      const ingestLogsSpy = vi.spyOn(OpsMonitorService.prototype as any, 'ingestLogs')
        .mockResolvedValue(mockProcessedLogs);
      const analyzeAndFileSpy = vi.spyOn(OpsMonitorService.prototype as any, 'analyzeAndFile')
        .mockResolvedValue(mockIssuesFiled);

      const result = await service.runScan();

      expect(result.scope).toBe('incremental');
      expect(result.processedLogs).toBe(mockProcessedLogs);
      expect(result.issuesFiled).toBe(mockIssuesFiled);
    });

    it('should handle broadcast callback errors gracefully', async () => {
      const mockInsertResult = { id: 789 };

      mockDb.insertInto.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue({
            executeTakeFirstOrThrow: vi.fn().mockResolvedValue(mockInsertResult),
          }),
        }),
      });

      mockDb.updateTable.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      });

      const ingestLogsSpy = vi.spyOn(OpsMonitorService.prototype as any, 'ingestLogs')
        .mockResolvedValue(100);
      const analyzeAndFileSpy = vi.spyOn(OpsMonitorService.prototype as any, 'analyzeAndFile')
        .mockResolvedValue(1);

      mockBroadcastCallback.mockRejectedValue(new Error('Broadcast failed'));

      const result = await service.runScan({ scope: 'full' });

      expect(result.status).toBe('completed');
      expect(mockBroadcastCallback).toHaveBeenCalled();
      // Should not throw despite broadcast error
    });

    it('should handle database errors during scan insertion', async () => {
      mockDb.insertInto.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue({
            executeTakeFirstOrThrow: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      await expect(service.runScan()).rejects.toThrow('Database error');
    });
  });

  describe('getRecentScans', () => {
    it('should return recent scans with default limit', async () => {
      const mockScans = [
        {
          id: 1,
          scan_type: 'full',
          status: 'completed',
          created_at: '2024-01-01T00:00:00Z',
          findings: JSON.stringify({ processedLogs: 1200, issuesFiled: 8 }),
          metadata: null,
        },
        {
          id: 2,
          scan_type: 'incremental',
          status: 'completed',
          created_at: '2024-01-02T00:00:00Z',
          findings: JSON.stringify({ processedLogs: 180, issuesFiled: 2 }),
          metadata: null,
        },
      ];

      mockDb.selectFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue(mockScans),
            }),
          }),
        }),
      });

      const result = await service.getRecentScans();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        scope: 'full',
        status: 'completed',
        createdAt: '2024-01-01T00:00:00Z',
        findings: { processedLogs: 1200, issuesFiled: 8 },
        metadata: null,
      });
      expect(result[1].scope).toBe('incremental');
    });

    it('should respect custom limit', async () => {
      const mockScans = [
        {
          id: 1,
          scan_type: 'full',
          status: 'completed',
          created_at: '2024-01-01T00:00:00Z',
          findings: JSON.stringify({ processedLogs: 1200 }),
          metadata: null,
        },
      ];

      const mockSelectChain = {
        select: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue(mockScans),
            }),
          }),
        }),
      };

      mockDb.selectFrom.mockReturnValue(mockSelectChain);

      const result = await service.getRecentScans(5);

      expect(mockSelectChain.select).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('getScanById', () => {
    it('should return scan details by ID', async () => {
      const mockScan = {
        id: 123,
        scan_type: 'full',
        status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
        findings: JSON.stringify({ processedLogs: 1200, issuesFiled: 8 }),
        metadata: JSON.stringify({ scanId: 'test-123' }),
      };

      mockDb.selectFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([mockScan]),
          }),
        }),
      });

      const result = await (service as any).getScanById(123);

      expect(result).toEqual({
        id: 123,
        scope: 'full',
        status: 'completed',
        createdAt: '2024-01-01T00:00:00Z',
        findings: { processedLogs: 1200, issuesFiled: 8 },
        metadata: { scanId: 'test-123' },
      });
    });

    it('should return null for non-existent scan', async () => {
      mockDb.selectFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await (service as any).getScanById(999);

      expect(result).toBeNull();
    });
  });

  describe('getScansByStatus', () => {
    it('should filter scans by status', async () => {
      const mockScans = [
        {
          id: 1,
          scan_type: 'full',
          status: 'completed',
          created_at: '2024-01-01T00:00:00Z',
          findings: JSON.stringify({ processedLogs: 1200 }),
          metadata: null,
        },
      ];

      mockDb.selectFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                execute: vi.fn().mockResolvedValue(mockScans),
              }),
            }),
          }),
        }),
      });

      const result = await (service as any).getScansByStatus('completed', 10);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('completed');
    });
  });
});
