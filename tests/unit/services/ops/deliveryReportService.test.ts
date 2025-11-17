import { describe, it, expect, beforeEach } from 'vitest';
import { DeliveryReportService } from '../../../../orchestrator/worker/services/ops/deliveryReportService';

class MockSelectBuilder {
  constructor(private readonly mockDb: MockKysely) {}

  select(arg: any) {
    if (typeof arg === 'function') {
      arg({
        fn: {
          count: () => ({ as: () => ({}) })
        }
      });
    }
    return this;
  }

  orderBy() {
    return this;
  }

  where(column: string, _operator: string, value: any) {
    this.mockDb.whereCalls.push({ column, value });
    return this;
  }

  limit(value: number) {
    this.mockDb.lastLimit = value;
    return this;
  }

  offset(value: number) {
    this.mockDb.lastOffset = value;
    return this;
  }

  if(condition: boolean, callback: (qb: MockSelectBuilder) => void) {
    if (condition) {
      callback(this);
    }
    return this;
  }

  execute() {
    if (this.mockDb.executeQueue.length > 0) {
      return this.mockDb.executeQueue.shift();
    }
    return [];
  }

  executeTakeFirst() {
    if (this.mockDb.selectTakeFirstQueue.length > 0) {
      return this.mockDb.selectTakeFirstQueue.shift();
    }
    return null;
  }
}

class MockInsertBuilder {
  constructor(private readonly mockDb: MockKysely) {}

  values(values: any) {
    this.mockDb.lastInsertValues = values;
    return this;
  }

  returning() {
    return this;
  }

  executeTakeFirst() {
    if (this.mockDb.insertReturnQueue.length > 0) {
      return this.mockDb.insertReturnQueue.shift();
    }
    return undefined;
  }
}

class MockUpdateBuilder {
  constructor(private readonly mockDb: MockKysely) {}

  set(values: any) {
    this.mockDb.lastUpdateValues = values;
    return this;
  }

  where(column: string, _operator: string, value: any) {
    this.mockDb.updateWhereCalls.push({ column, value });
    return this;
  }

  returning() {
    return this;
  }

  executeTakeFirst() {
    if (this.mockDb.updateReturnQueue.length > 0) {
      return this.mockDb.updateReturnQueue.shift();
    }
    return undefined;
  }
}

class MockKysely {
  executeQueue: any[] = [];
  selectTakeFirstQueue: any[] = [];
  insertReturnQueue: any[] = [];
  updateReturnQueue: any[] = [];
  whereCalls: Array<{ column: string; value: any }> = [];
  updateWhereCalls: Array<{ column: string; value: any }> = [];
  lastLimit?: number;
  lastOffset?: number;
  lastInsertValues?: any;
  lastUpdateValues?: any;

  enqueueExecute(result: any) {
    this.executeQueue.push(result);
  }

  enqueueTakeFirst(result: any) {
    this.selectTakeFirstQueue.push(result);
  }

  enqueueInsertReturn(result: any) {
    this.insertReturnQueue.push(result);
  }

  enqueueUpdateReturn(result: any) {
    this.updateReturnQueue.push(result);
  }

  selectFrom() {
    return new MockSelectBuilder(this);
  }

  insertInto() {
    return new MockInsertBuilder(this);
  }

  updateTable() {
    return new MockUpdateBuilder(this);
  }
}

const sampleRow = {
  id: 1,
  patch_id: 'patch-1',
  destination: 'factory-1',
  status: 'pending',
  attempts: 2,
  created_at: '2024-01-01T00:00:00Z',
  last_attempt_at: null,
  error: null,
  metadata: JSON.stringify({ foo: 'bar' }),
};

describe('DeliveryReportService', () => {
  let mockDb: MockKysely;
  let service: DeliveryReportService;

  beforeEach(() => {
    mockDb = new MockKysely();
    service = new DeliveryReportService(mockDb as any);
  });

  it('returns paginated reports with metadata parsed', async () => {
    mockDb.enqueueExecute([sampleRow]);
    mockDb.enqueueTakeFirst({ total: 1 });

    const result = await service.listReports();

    expect(result.reports).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
    expect(result.reports[0].metadata).toEqual({ foo: 'bar' });
    expect(mockDb.lastLimit).toBe(20);
    expect(mockDb.lastOffset).toBe(0);
  });

  it('applies filters and custom pagination', async () => {
    mockDb.enqueueExecute([sampleRow]);
    mockDb.enqueueTakeFirst({ total: 1 });

    await service.listReports({
      patchId: 'patch-123',
      destination: 'factory-2',
      status: 'completed',
      limit: 5,
      offset: 10,
      sortOrder: 'asc'
    });

    expect(mockDb.whereCalls).toEqual([
      { column: 'delivery_reports.patch_id', value: 'patch-123' },
      { column: 'delivery_reports.destination', value: 'factory-2' },
      { column: 'delivery_reports.status', value: 'completed' }
    ]);
    expect(mockDb.lastLimit).toBe(5);
    expect(mockDb.lastOffset).toBe(10);
  });

  it('returns report by id', async () => {
    mockDb.enqueueTakeFirst(sampleRow);

    const report = await service.getReportById(1);

    expect(report).not.toBeNull();
    expect(report?.id).toBe(1);
    expect(report?.metadata).toEqual({ foo: 'bar' });
  });

  it('returns null when report not found', async () => {
    mockDb.enqueueTakeFirst(null);

    const report = await service.getReportById(999);
    expect(report).toBeNull();
  });

  it('creates delivery report with default metadata', async () => {
    const insertedRow = { ...sampleRow, metadata: JSON.stringify({}) };
    mockDb.enqueueInsertReturn(insertedRow);

    const result = await service.triggerReportGeneration({
      patchId: 'patch-99',
      destination: 'factory-9',
    });

    expect(mockDb.lastInsertValues?.patch_id).toBe('patch-99');
    expect(mockDb.lastInsertValues?.destination).toBe('factory-9');
    expect(mockDb.lastInsertValues?.metadata).toBe(JSON.stringify({}));
    expect(result.metadata).toEqual({});
  });

  it('increments attempts on retry and clears error', async () => {
    mockDb.enqueueTakeFirst({ attempts: 2 });
    mockDb.enqueueUpdateReturn({
      ...sampleRow,
      attempts: 3,
      status: 'retrying',
      last_attempt_at: '2024-01-02T00:00:00Z',
      error: null
    });

    const result = await service.markReportRetry(1);

    expect(mockDb.updateWhereCalls).toEqual([{ column: 'delivery_reports.id', value: 1 }]);
    expect(mockDb.lastUpdateValues?.attempts).toBe(3);
    expect(mockDb.lastUpdateValues?.status).toBe('retrying');
    expect(mockDb.lastUpdateValues?.error).toBeNull();
    expect(result.attempts).toBe(3);
  });

  it('throws when retrying unknown report', async () => {
    mockDb.enqueueTakeFirst(null);

    await expect(service.markReportRetry(123)).rejects.toThrow('Delivery report not found');
  });
});
