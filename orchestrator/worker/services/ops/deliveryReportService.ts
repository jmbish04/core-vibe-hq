import { Kysely, SelectQueryBuilder } from 'kysely';
import type { DB } from '../../db/schema';

export interface DeliveryReportFilters {
  patchId?: string;
  destination?: string;
  status?: string;
}

export interface ListDeliveryReportsOptions extends DeliveryReportFilters {
  limit?: number;
  offset?: number;
  sortOrder?: 'asc' | 'desc';
}

export interface DeliveryReportPayload {
  patchId: string;
  destination: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface DeliveryReport {
  id: number;
  patchId: string;
  destination: string;
  status: string;
  attempts: number;
  createdAt: string;
  lastAttemptAt: string | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
}

export interface DeliveryReportListResult {
  reports: DeliveryReport[];
  total: number;
  limit: number;
  offset: number;
}

const DEFAULT_LIMIT = 20;

export class DeliveryReportService {
  constructor(private readonly db: Kysely<DB>) {}

  async listReports(options: ListDeliveryReportsOptions = {}): Promise<DeliveryReportListResult> {
    const limit = options.limit ?? DEFAULT_LIMIT;
    const offset = options.offset ?? 0;
    const sortOrder = options.sortOrder ?? 'desc';

    let baseQuery: SelectQueryBuilder<DB, 'delivery_reports', object> = this.db
      .selectFrom('delivery_reports')
      .select([
        'delivery_reports.id',
        'delivery_reports.patch_id',
        'delivery_reports.destination',
        'delivery_reports.status',
        'delivery_reports.attempts',
        'delivery_reports.created_at',
        'delivery_reports.last_attempt_at',
        'delivery_reports.error',
        'delivery_reports.metadata',
      ])
      .orderBy('delivery_reports.created_at', sortOrder);

    if (options.patchId) {
      baseQuery = baseQuery.where('delivery_reports.patch_id', '=', options.patchId);
    }

    if (options.destination) {
      baseQuery = baseQuery.where('delivery_reports.destination', '=', options.destination);
    }

    if (options.status) {
      baseQuery = baseQuery.where('delivery_reports.status', '=', options.status);
    }

    const [reports, totalResult] = await Promise.all([
      baseQuery.limit(limit).offset(offset).execute(),
      this.db
        .selectFrom('delivery_reports')
        .select((eb) => eb.fn.count('delivery_reports.id').as('total'))
        .if(Boolean(options.patchId), (qb) =>
          qb.where('delivery_reports.patch_id', '=', options.patchId as string),
        )
        .if(Boolean(options.destination), (qb) =>
          qb.where('delivery_reports.destination', '=', options.destination as string),
        )
        .if(Boolean(options.status), (qb) =>
          qb.where('delivery_reports.status', '=', options.status as string),
        )
        .executeTakeFirst(),
    ]);

    const total = Number(totalResult?.total ?? 0);

    return {
      reports: reports.map(mapDeliveryReportRow),
      total,
      limit,
      offset,
    };
  }

  async getReportById(id: number): Promise<DeliveryReport | null> {
    const row = await this.db
      .selectFrom('delivery_reports')
      .select([
        'delivery_reports.id',
        'delivery_reports.patch_id',
        'delivery_reports.destination',
        'delivery_reports.status',
        'delivery_reports.attempts',
        'delivery_reports.created_at',
        'delivery_reports.last_attempt_at',
        'delivery_reports.error',
        'delivery_reports.metadata',
      ])
      .where('delivery_reports.id', '=', id)
      .executeTakeFirst();

    return row ? mapDeliveryReportRow(row) : null;
  }

  async triggerReportGeneration(payload: DeliveryReportPayload): Promise<DeliveryReport> {
    const now = new Date().toISOString();

    const inserted = await this.db
      .insertInto('delivery_reports')
      .values({
        patch_id: payload.patchId,
        destination: payload.destination,
        status: payload.status ?? 'generating',
        attempts: 0,
        created_at: now,
        metadata: payload.metadata ? JSON.stringify(payload.metadata) : JSON.stringify({}),
      })
      .returning([
        'delivery_reports.id',
        'delivery_reports.patch_id',
        'delivery_reports.destination',
        'delivery_reports.status',
        'delivery_reports.attempts',
        'delivery_reports.created_at',
        'delivery_reports.last_attempt_at',
        'delivery_reports.error',
        'delivery_reports.metadata',
      ])
      .executeTakeFirst();

    if (!inserted) {
      throw new Error('Failed to create delivery report');
    }

    return mapDeliveryReportRow(inserted);
  }

  async markReportRetry(id: number): Promise<DeliveryReport> {
    const current = await this.db
      .selectFrom('delivery_reports')
      .select(['delivery_reports.attempts'])
      .where('delivery_reports.id', '=', id)
      .executeTakeFirst();

    if (!current) {
      throw new Error('Delivery report not found');
    }

    const updateResult = await this.db
      .updateTable('delivery_reports')
      .set({
        status: 'retrying',
        attempts: (current.attempts ?? 0) + 1,
        last_attempt_at: new Date().toISOString(),
        error: null,
      })
      .where('delivery_reports.id', '=', id)
      .returning([
        'delivery_reports.id',
        'delivery_reports.patch_id',
        'delivery_reports.destination',
        'delivery_reports.status',
        'delivery_reports.attempts',
        'delivery_reports.created_at',
        'delivery_reports.last_attempt_at',
        'delivery_reports.error',
        'delivery_reports.metadata',
      ])
      .executeTakeFirst();

    if (!updateResult) {
      throw new Error('Delivery report not found');
    }

    return mapDeliveryReportRow(updateResult);
  }
}

function mapDeliveryReportRow(row: {
  id: number;
  patch_id: string;
  destination: string;
  status: string;
  attempts: number;
  created_at: string;
  last_attempt_at: string | null;
  error: string | null;
  metadata: unknown;
}): DeliveryReport {
  return {
    id: row.id,
    patchId: row.patch_id,
    destination: row.destination,
    status: row.status,
    attempts: row.attempts ?? 0,
    createdAt: row.created_at,
    lastAttemptAt: row.last_attempt_at,
    error: row.error,
    metadata: typeof row.metadata === 'string'
      ? parseMetadata(row.metadata)
      : (row.metadata as Record<string, unknown> | null),
  };
}

function parseMetadata(value: string): Record<string, unknown> | null {
  try {
    return value ? (JSON.parse(value) as Record<string, unknown>) : null;
  } catch (error) {
    console.warn('Failed to parse delivery report metadata', error);
    return null;
  }
}
