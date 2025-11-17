import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import type { Database } from './schema';

export interface Env {
  DB: D1Database;
}

export class DatabaseService {
  private db: Kysely<Database>;

  constructor(env: Env) {
    this.db = new Kysely<Database>({
      dialect: new D1Dialect({ database: env.DB })
    });
  }

  // Test Profiles Operations
  async getTestProfiles(enabledOnly = true) {
    let query = this.db.selectFrom('test_profiles').selectAll();
    if (enabledOnly) {
      query = query.where('enabled', '=', 1);
    }
    return query.orderBy('category').orderBy('name').execute();
  }

  async getTestProfileById(id: number) {
    return this.db
      .selectFrom('test_profiles')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async createTestProfile(profile: Omit<Database['test_profiles'], 'id' | 'createdAt' | 'updatedAt'>) {
    return this.db
      .insertInto('test_profiles')
      .values(profile)
      .returning('id')
      .executeTakeFirst();
  }

  async updateTestProfile(id: number, updates: Partial<Omit<Database['test_profiles'], 'id' | 'createdAt'>>) {
    return this.db
      .updateTable('test_profiles')
      .set({ ...updates, updatedAt: Date.now() })
      .where('id', '=', id)
      .execute();
  }

  // Test Results Operations
  async createTestResult(result: Omit<Database['test_results'], 'id' | 'createdAt'>) {
    return this.db
      .insertInto('test_results')
      .values(result)
      .returning('id')
      .executeTakeFirst();
  }

  async updateTestResult(id: number, updates: Partial<Omit<Database['test_results'], 'id' | 'createdAt'>>) {
    return this.db
      .updateTable('test_results')
      .set(updates)
      .where('id', '=', id)
      .execute();
  }

  async getTestResults(limit = 100, offset = 0) {
    return this.db
      .selectFrom('test_results')
      .selectAll()
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();
  }

  async getTestResultsByRunId(runId: string) {
    return this.db
      .selectFrom('test_results')
      .selectAll()
      .where('runId', '=', runId)
      .orderBy('startedAt', 'asc')
      .execute();
  }

  async getTestResultsByProfile(profileId: number, limit = 50) {
    return this.db
      .selectFrom('test_results')
      .selectAll()
      .where('testProfileId', '=', profileId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .execute();
  }

  // AI Logs Operations
  async createAiLog(log: Omit<Database['ai_logs'], 'id' | 'createdAt'>) {
    return this.db
      .insertInto('ai_logs')
      .values(log)
      .returning('id')
      .executeTakeFirst();
  }

  async getAiLogsByTestResult(testResultId: number) {
    return this.db
      .selectFrom('ai_logs')
      .selectAll()
      .where('testResultId', '=', testResultId)
      .orderBy('createdAt', 'asc')
      .execute();
  }

  async getAiUsageStats(days = 30) {
    const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);

    return this.db
      .selectFrom('ai_logs')
      .select([
        'model',
        'provider',
        this.db.fn.count('id').as('totalRequests'),
        this.db.fn.sum('tokensUsed').as('totalTokens'),
        this.db.fn.sum('cost').as('totalCost'),
        this.db.fn.avg('latencyMs').as('avgLatency')
      ])
      .where('createdAt', '>=', cutoffDate)
      .where('success', '=', 1)
      .groupBy(['model', 'provider'])
      .orderBy('totalRequests', 'desc')
      .execute();
  }

  // Health Summaries Operations
  async createHealthSummary(summary: Omit<Database['health_summaries'], 'id' | 'createdAt'>) {
    return this.db
      .insertInto('health_summaries')
      .values(summary)
      .onConflict('date')
      .doUpdateSet(summary)
      .returning('id')
      .executeTakeFirst();
  }

  async getHealthSummaries(limit = 30) {
    return this.db
      .selectFrom('health_summaries')
      .selectAll()
      .orderBy('date', 'desc')
      .limit(limit)
      .execute();
  }

  async getLatestHealthSummary() {
    return this.db
      .selectFrom('health_summaries')
      .selectAll()
      .orderBy('date', 'desc')
      .limit(1)
      .executeTakeFirst();
  }

  // Complex queries with joins
  async getTestResultsWithProfiles(limit = 50) {
    return this.db
      .selectFrom('test_results')
      .innerJoin('test_profiles', 'test_results.testProfileId', 'test_profiles.id')
      .select([
        'test_results.id',
        'test_results.status',
        'test_results.durationMs',
        'test_results.errorMessage',
        'test_results.startedAt',
        'test_results.completedAt',
        'test_profiles.name',
        'test_profiles.category',
        'test_profiles.target'
      ])
      .orderBy('test_results.createdAt', 'desc')
      .limit(limit)
      .execute();
  }

  async getHealthDashboardData() {
    // Get latest health summary
    const latestSummary = await this.getLatestHealthSummary();

    // Get recent test results (last 24 hours)
    const yesterday = Date.now() - (24 * 60 * 60 * 1000);
    const recentResults = await this.db
      .selectFrom('test_results')
      .select([
        'status',
        this.db.fn.count('id').as('count')
      ])
      .where('createdAt', '>=', yesterday)
      .groupBy('status')
      .execute();

    // Get AI usage stats (last 7 days)
    const aiStats = await this.getAiUsageStats(7);

    // Get performance trends (last 7 days)
    const performanceTrends = await this.db
      .selectFrom('test_results')
      .select([
        this.db.fn.date('createdAt / 1000', 'unixepoch', 'localtime').as('date'),
        this.db.fn.avg('durationMs').as('avgDuration'),
        this.db.fn.count('id').as('totalTests'),
        this.db.fn.sum(this.db.fn.iif('status = "passed"', 1, 0)).as('passedTests')
      ])
      .where('createdAt', '>=', Date.now() - (7 * 24 * 60 * 60 * 1000))
      .groupBy(this.db.fn.date('createdAt / 1000', 'unixepoch', 'localtime'))
      .orderBy('date', 'asc')
      .execute();

    return {
      summary: latestSummary,
      recentResults,
      aiStats,
      performanceTrends
    };
  }

  // Cleanup operations
  async cleanupOldData(daysToKeep = 90) {
    const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    // Clean up old test results (keep last 1000 per profile)
    const oldResults = await this.db
      .selectFrom('test_results')
      .select(['testProfileId', 'id'])
      .where('createdAt', '<', cutoffDate)
      .orderBy('createdAt', 'desc')
      .execute();

    // Keep only the most recent results for each profile
    const toDelete = new Set<number>();
    const profileCounts = new Map<number, number>();

    for (const result of oldResults) {
      const count = profileCounts.get(result.testProfileId) || 0;
      if (count >= 1000) {
        toDelete.add(result.id);
      } else {
        profileCounts.set(result.testProfileId, count + 1);
      }
    }

    if (toDelete.size > 0) {
      await this.db
        .deleteFrom('test_results')
        .where('id', 'in', Array.from(toDelete))
        .execute();
    }

    // Clean up old AI logs (keep last 30 days)
    await this.db
      .deleteFrom('ai_logs')
      .where('createdAt', '<', cutoffDate)
      .execute();

    return { deletedResults: toDelete.size, deletedLogs: 'cleaned' };
  }

  async close() {
    await this.db.destroy();
  }
}
