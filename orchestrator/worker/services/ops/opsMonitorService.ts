import { Kysely } from 'kysely';

import type { DB } from '../../db/schema';

export type OpsScanScope = 'full' | 'incremental';

export interface OpsScanFilters {
  severity?: string;
  type?: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
}

export interface OpsScanOptions {
  scope?: OpsScanScope;
  filters?: OpsScanFilters;
}

export interface OpsScanResult {
  scanId: string;
  scope: OpsScanScope;
  processedLogs: number;
  issuesFiled: number;
  status: 'completed' | 'failed';
  completedAt: string;
  findings: Record<string, unknown> | null;
}

export interface OpsScanRecord {
  id: number;
  scope: OpsScanScope;
  status: string;
  createdAt: string;
  findings: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

export interface OpsIssueRecord {
  id: number;
  type: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  resolvedAt: string | null;
}

const DEFAULT_FINDINGS = (scope: OpsScanScope, counts: { processed: number; issues: number }) => ({
  scope,
  processedLogs: counts.processed,
  issuesFiled: counts.issues,
  completedAt: new Date().toISOString(),
});

const MOCK_LOG_COUNTS: Record<OpsScanScope, number> = {
  full: 1200,
  incremental: 180,
};

const MOCK_ISSUE_COUNTS: Record<OpsScanScope, number> = {
  full: 8,
  incremental: 2,
};

export type BroadcastCallback = (scanResult: OpsScanResult) => void | Promise<void>;

export class OpsMonitorService {
  private broadcastCallback?: BroadcastCallback;

  constructor(
    private readonly db: Kysely<DB>,
    broadcastCallback?: BroadcastCallback
  ) {
    this.broadcastCallback = broadcastCallback;
  }

  async runScan(options: OpsScanOptions = {}): Promise<OpsScanResult> {
    const scope: OpsScanScope = options.scope ?? 'incremental';
    const scanIdentifier = crypto.randomUUID();

    const inserted = await this.db
      .insertInto('ops_scans')
      .values({
        scan_type: scope,
        status: 'running',
        findings: JSON.stringify({
          scope,
          startedAt: new Date().toISOString(),
          filters: options.filters ?? null,
          scanId: scanIdentifier,
        }),
        metadata: JSON.stringify({
          scanId: scanIdentifier,
          filters: options.filters ?? null,
        }),
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    const scanId = inserted.id;

    const counts = {
      processed: await this.ingestLogs(scope),
      issues: await this.analyzeAndFile(scope),
    };

    await this.db
      .updateTable('ops_scans')
      .set({
        status: 'completed',
        findings: JSON.stringify(DEFAULT_FINDINGS(scope, counts)),
      })
      .where('id', '=', scanId)
      .execute();

    const result: OpsScanResult = {
      scanId: `scan-${scanId}`,
      scope,
      processedLogs: counts.processed,
      issuesFiled: counts.issues,
      status: 'completed',
      completedAt: new Date().toISOString(),
      findings: DEFAULT_FINDINGS(scope, counts),
    };

    // Broadcast scan result if callback is provided
    if (this.broadcastCallback) {
      try {
        await this.broadcastCallback(result);
      } catch (error) {
        console.error('Error broadcasting scan result:', error);
        // Don't fail the scan if broadcast fails
      }
    }

    return result;
  }

  async getRecentScans(limit = 10): Promise<OpsScanRecord[]> {
    const rows = await this.db
      .selectFrom('ops_scans')
      .select([
        'id',
        'scan_type',
        'status',
        'created_at',
        'findings',
        'metadata',
      ])
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute();

    return rows.map((row) => ({
      id: row.id,
      scope: (row.scan_type as OpsScanScope) ?? 'incremental',
      status: row.status,
      createdAt: row.created_at ?? new Date().toISOString(),
      findings: parseJson(row.findings),
      metadata: parseJson(row.metadata),
    }));
  }

  async getOpenIssues(limit = 50): Promise<OpsIssueRecord[]> {
    const rows = await this.db
      .selectFrom('ops_issues')
      .select([
        'id',
        'type',
        'severity',
        'status',
        'title',
        'description',
        'metadata',
        'created_at',
        'resolved_at',
      ])
      .where('status', '=', 'open')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute();

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      severity: row.severity,
      status: row.status,
      title: row.title,
      description: row.description,
      metadata: parseJson(row.metadata),
      createdAt: row.created_at ?? new Date().toISOString(),
      resolvedAt: row.resolved_at ?? null,
    }));
  }

  async resolveIssue(issueId: number, resolution: string): Promise<void> {
    const existing = await this.db
      .selectFrom('ops_issues')
      .select(['id', 'metadata'])
      .where('id', '=', issueId)
      .executeTakeFirst();

    if (!existing) {
      throw new Error(`Issue ${issueId} not found`);
    }

    const metadata = parseJson(existing.metadata) ?? {};
    metadata.resolution = {
      message: resolution,
      resolvedAt: new Date().toISOString(),
    };

    await this.db
      .updateTable('ops_issues')
      .set({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        metadata: JSON.stringify(metadata),
      })
      .where('id', '=', issueId)
      .execute();
  }

  private async ingestLogs(scope: OpsScanScope): Promise<number> {
    const processed = MOCK_LOG_COUNTS[scope] ?? MOCK_LOG_COUNTS.incremental;

    await this.db
      .insertInto('operation_logs')
      .values({
        source: 'ops-monitor',
        operation: `ops.ingestLogs.${scope}`,
        level: 'info',
        order_id: null,
        task_uuid: null,
        details: JSON.stringify({
          processed,
          scope,
          ingestedAt: new Date().toISOString(),
        }),
      })
      .execute();

    return processed;
  }

  private async analyzeAndFile(scope: OpsScanScope): Promise<number> {
    const issueCount = MOCK_ISSUE_COUNTS[scope] ?? MOCK_ISSUE_COUNTS.incremental;
    const issues = Array.from({ length: issueCount }).map((_, index) => ({
      type: index % 2 === 0 ? 'performance' : 'stability',
      severity: index % 3 === 0 ? 'high' : 'medium',
      title: `${scope} scan issue ${index + 1}`,
      description: `Automated detection from ${scope} scan iteration ${index + 1}`,
      metadata: {
        scope,
        index,
        detectedAt: new Date().toISOString(),
      },
    }));

    for (const issue of issues) {
      await this.db
        .insertInto('ops_issues')
        .values({
          type: issue.type,
          severity: issue.severity,
          status: 'open',
          title: issue.title,
          description: issue.description,
          metadata: JSON.stringify(issue.metadata),
        })
        .execute();
    }

    return issues.length;
  }
}

function parseJson(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch (error) {
      console.warn('Failed to parse JSON metadata', error);
      return null;
    }
  }

  return null;
}
