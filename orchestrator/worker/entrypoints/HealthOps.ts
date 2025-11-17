import { BaseWorkerEntrypoint } from '@shared/base/workerEntrypoint';
import { DatabaseService } from '../database/database';
import { HealthTestingService } from '../services/health/healthTestingService';
import { OrchestratorHealthTest } from '../services/health/orchestratorHealthTest';
import { AiService } from '../ai-providers/aiService';
import type { Env } from '../types';
import type {
  TestProfile,
  NewTestProfile,
  TestResult,
  NewTestResult,
  AiLog,
  NewAiLog,
  HealthSummary,
  NewHealthSummary
} from '../database/schema';

export interface HealthOpsRequest {
  // Test Profiles
  getTestProfiles?: { enabledOnly?: boolean };
  getTestProfileById?: { id: number };
  createTestProfile?: { profile: NewTestProfile };
  updateTestProfile?: { id: number; updates: Partial<NewTestProfile> };

  // Test Results
  createTestResult?: { result: NewTestResult };
  updateTestResult?: { id: number; updates: Partial<NewTestResult> };
  getTestResults?: { limit?: number; offset?: number };
  getTestResultsByRunId?: { runId: string };
  getTestResultsByProfile?: { profileId: number; limit?: number };

  // AI Logs
  createAiLog?: { log: NewAiLog };
  getAiLogsByTestResult?: { testResultId: number };
  getAiUsageStats?: { days?: number };

  // Health Summaries
  createHealthSummary?: { summary: NewHealthSummary };
  getHealthSummaries?: { limit?: number };
  getLatestHealthSummary?: {};

  // Complex queries
  getTestResultsWithProfiles?: { limit?: number };
  getHealthDashboardData?: {};
  cleanupOldData?: { daysToKeep?: number };

  // Health Testing Service
  testDependencySynchronization?: { context: any };
  testInterWorkerCommunication?: {};
  testWebSocketConnectivity?: {};
  testBuildHealth?: {};

  // Orchestrator Health Test Suite
  runOrchestratorHealthTest?: {};
}

export interface HealthOpsResponse {
  // Test Profiles
  testProfiles?: TestProfile[];
  testProfile?: TestProfile;

  // Test Results
  testResult?: TestResult;
  testResults?: TestResult[];
  testResultsWithProfiles?: any[];

  // AI Logs
  aiLog?: AiLog;
  aiLogs?: AiLog[];
  aiUsageStats?: any[];

  // Health Summaries
  healthSummary?: HealthSummary;
  healthSummaries?: HealthSummary[];
  dashboardData?: any;

  // Operations
  cleanupResult?: { deletedResults: number; deletedLogs: string };

  // Health Testing Service
  healthTestResult?: any;

  // Orchestrator Health Test Suite
  orchestratorHealthReport?: any;
}

export class HealthOps extends BaseWorkerEntrypoint<Env> {
  private get dbService(): DatabaseService {
    return new DatabaseService(this.env);
  }

  private get healthTestingService(): HealthTestingService {
    return new HealthTestingService(
      new AiService(this.env),
      this.dbService.health
    );
  }

  private get orchestratorHealthTest(): OrchestratorHealthTest {
    return new OrchestratorHealthTest(this.healthTestingService);
  }

  async handleRequest(request: HealthOpsRequest): Promise<HealthOpsResponse> {
    // Test Profiles Operations
    if (request.getTestProfiles) {
      const profiles = await this.getTestProfiles(request.getTestProfiles.enabledOnly);
      return { testProfiles: profiles };
    }

    if (request.getTestProfileById) {
      const profile = await this.getTestProfileById(request.getTestProfileById.id);
      return { testProfile: profile };
    }

    if (request.createTestProfile) {
      const profile = await this.createTestProfile(request.createTestProfile.profile);
      return { testProfile: profile };
    }

    if (request.updateTestProfile) {
      await this.updateTestProfile(request.updateTestProfile.id, request.updateTestProfile.updates);
      const updated = await this.getTestProfileById(request.updateTestProfile.id);
      return { testProfile: updated };
    }

    // Test Results Operations
    if (request.createTestResult) {
      const result = await this.createTestResult(request.createTestResult.result);
      return { testResult: result };
    }

    if (request.updateTestResult) {
      await this.updateTestResult(request.updateTestResult.id, request.updateTestResult.updates);
      // Don't return updated result to avoid extra query
      return {};
    }

    if (request.getTestResults) {
      const results = await this.getTestResults(
        request.getTestResults.limit,
        request.getTestResults.offset
      );
      return { testResults: results };
    }

    if (request.getTestResultsByRunId) {
      const results = await this.getTestResultsByRunId(request.getTestResultsByRunId.runId);
      return { testResults: results };
    }

    if (request.getTestResultsByProfile) {
      const results = await this.getTestResultsByProfile(
        request.getTestResultsByProfile.profileId,
        request.getTestResultsByProfile.limit
      );
      return { testResults: results };
    }

    // AI Logs Operations
    if (request.createAiLog) {
      const log = await this.createAiLog(request.createAiLog.log);
      return { aiLog: log };
    }

    if (request.getAiLogsByTestResult) {
      const logs = await this.getAiLogsByTestResult(request.getAiLogsByTestResult.testResultId);
      return { aiLogs: logs };
    }

    if (request.getAiUsageStats) {
      const stats = await this.getAiUsageStats(request.getAiUsageStats.days);
      return { aiUsageStats: stats };
    }

    // Health Summaries Operations
    if (request.createHealthSummary) {
      const summary = await this.createHealthSummary(request.createHealthSummary.summary);
      return { healthSummary: summary };
    }

    if (request.getHealthSummaries) {
      const summaries = await this.getHealthSummaries(request.getHealthSummaries.limit);
      return { healthSummaries: summaries };
    }

    if (request.getLatestHealthSummary) {
      const summary = await this.getLatestHealthSummary();
      return { healthSummary: summary };
    }

    // Complex queries
    if (request.getTestResultsWithProfiles) {
      const results = await this.getTestResultsWithProfiles(request.getTestResultsWithProfiles.limit);
      return { testResultsWithProfiles: results };
    }

    if (request.getHealthDashboardData) {
      const data = await this.getHealthDashboardData();
      return { dashboardData: data };
    }

    if (request.cleanupOldData) {
      const result = await this.cleanupOldData(request.cleanupOldData.daysToKeep);
      return { cleanupResult: result };
    }

    // Health Testing Service Operations
    if (request.testDependencySynchronization) {
      const result = await this.healthTestingService.testDependencySynchronization(
        request.testDependencySynchronization.context
      );
      return { healthTestResult: result };
    }

    if (request.testInterWorkerCommunication) {
      const result = await this.healthTestingService.testInterWorkerCommunication();
      return { healthTestResult: result };
    }

    if (request.testWebSocketConnectivity) {
      const result = await this.healthTestingService.testWebSocketConnectivity();
      return { healthTestResult: result };
    }

    if (request.testBuildHealth) {
      const result = await this.healthTestingService.testBuildHealth();
      return { healthTestResult: result };
    }

    // Orchestrator Health Test Suite
    if (request.runOrchestratorHealthTest) {
      const report = await this.orchestratorHealthTest.runFullHealthTest();
      return { orchestratorHealthReport: report };
    }

    throw new Error('Unknown health operation');
  }

  // Test Profiles Operations
  private async getTestProfiles(enabledOnly = true): Promise<TestProfile[]> {
    return this.dbService.kyselyHealth
      .selectFrom('test_profiles')
      .selectAll()
      .$if(enabledOnly, qb => qb.where('enabled', '=', 1))
      .orderBy('category')
      .orderBy('name')
      .execute();
  }

  private async getTestProfileById(id: number): Promise<TestProfile | undefined> {
    return this.dbService.kyselyHealth
      .selectFrom('test_profiles')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  private async createTestProfile(profile: NewTestProfile): Promise<TestProfile> {
    const result = await this.dbService.kyselyHealth
      .insertInto('test_profiles')
      .values(profile)
      .returning('id')
      .executeTakeFirst();

    if (!result?.id) {
      throw new Error('Failed to create test profile');
    }

    const created = await this.getTestProfileById(result.id);
    if (!created) {
      throw new Error('Failed to retrieve created test profile');
    }

    return created;
  }

  private async updateTestProfile(id: number, updates: Partial<NewTestProfile>): Promise<void> {
    await this.dbService.kyselyHealth
      .updateTable('test_profiles')
      .set({ ...updates, updatedAt: Date.now() })
      .where('id', '=', id)
      .execute();
  }

  // Test Results Operations
  private async createTestResult(result: NewTestResult): Promise<TestResult> {
    const dbResult = await this.dbService.kyselyHealth
      .insertInto('test_results')
      .values(result)
      .returning('id')
      .executeTakeFirst();

    if (!dbResult?.id) {
      throw new Error('Failed to create test result');
    }

    // Return the created result
    const created = await this.dbService.kyselyHealth
      .selectFrom('test_results')
      .selectAll()
      .where('id', '=', dbResult.id)
      .executeTakeFirst();

    if (!created) {
      throw new Error('Failed to retrieve created test result');
    }

    return created;
  }

  private async updateTestResult(id: number, updates: Partial<NewTestResult>): Promise<void> {
    await this.dbService.kyselyHealth
      .updateTable('test_results')
      .set(updates)
      .where('id', '=', id)
      .execute();
  }

  private async getTestResults(limit = 100, offset = 0): Promise<TestResult[]> {
    return this.dbService.kyselyHealth
      .selectFrom('test_results')
      .selectAll()
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();
  }

  private async getTestResultsByRunId(runId: string): Promise<TestResult[]> {
    return this.dbService.kyselyHealth
      .selectFrom('test_results')
      .selectAll()
      .where('runId', '=', runId)
      .orderBy('startedAt', 'asc')
      .execute();
  }

  private async getTestResultsByProfile(profileId: number, limit = 50): Promise<TestResult[]> {
    return this.dbService.kyselyHealth
      .selectFrom('test_results')
      .selectAll()
      .where('testProfileId', '=', profileId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .execute();
  }

  // AI Logs Operations
  private async createAiLog(log: NewAiLog): Promise<AiLog> {
    const result = await this.dbService.kyselyHealth
      .insertInto('ai_logs')
      .values(log)
      .returning('id')
      .executeTakeFirst();

    if (!result?.id) {
      throw new Error('Failed to create AI log');
    }

    const created = await this.dbService.kyselyHealth
      .selectFrom('ai_logs')
      .selectAll()
      .where('id', '=', result.id)
      .executeTakeFirst();

    if (!created) {
      throw new Error('Failed to retrieve created AI log');
    }

    return created;
  }

  private async getAiLogsByTestResult(testResultId: number): Promise<AiLog[]> {
    return this.dbService.kyselyHealth
      .selectFrom('ai_logs')
      .selectAll()
      .where('testResultId', '=', testResultId)
      .orderBy('createdAt', 'asc')
      .execute();
  }

  private async getAiUsageStats(days = 30): Promise<any[]> {
    const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);

    return this.dbService.kyselyHealth
      .selectFrom('ai_logs')
      .select([
        'model',
        'provider',
        this.dbService.kyselyHealth.fn.count('id').as('totalRequests'),
        this.dbService.kyselyHealth.fn.sum('tokensUsed').as('totalTokens'),
        this.dbService.kyselyHealth.fn.sum('cost').as('totalCost'),
        this.dbService.kyselyHealth.fn.avg('latencyMs').as('avgLatency')
      ])
      .where('createdAt', '>=', cutoffDate)
      .where('success', '=', 1)
      .groupBy(['model', 'provider'])
      .orderBy('totalRequests', 'desc')
      .execute();
  }

  // Health Summaries Operations
  private async createHealthSummary(summary: NewHealthSummary): Promise<HealthSummary> {
    const result = await this.dbService.kyselyHealth
      .insertInto('health_summaries')
      .values(summary)
      .onConflict('date')
      .doUpdateSet(summary)
      .returning('id')
      .executeTakeFirst();

    if (!result?.id) {
      throw new Error('Failed to create health summary');
    }

    const created = await this.getLatestHealthSummary();
    if (!created) {
      throw new Error('Failed to retrieve created health summary');
    }

    return created;
  }

  private async getHealthSummaries(limit = 30): Promise<HealthSummary[]> {
    return this.dbService.kyselyHealth
      .selectFrom('health_summaries')
      .selectAll()
      .orderBy('date', 'desc')
      .limit(limit)
      .execute();
  }

  private async getLatestHealthSummary(): Promise<HealthSummary | undefined> {
    return this.dbService.kyselyHealth
      .selectFrom('health_summaries')
      .selectAll()
      .orderBy('date', 'desc')
      .limit(1)
      .executeTakeFirst();
  }

  // Complex queries
  private async getTestResultsWithProfiles(limit = 50): Promise<any[]> {
    return this.dbService.kyselyHealth
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

  private async getHealthDashboardData(): Promise<any> {
    // Get latest health summary
    const latestSummary = await this.getLatestHealthSummary();

    // Get recent test results (last 24 hours)
    const yesterday = Date.now() - (24 * 60 * 60 * 1000);
    const recentResults = await this.dbService.kyselyHealth
      .selectFrom('test_results')
      .select([
        'status',
        this.dbService.kyselyHealth.fn.count('id').as('count')
      ])
      .where('createdAt', '>=', yesterday)
      .groupBy('status')
      .execute();

    // Get AI usage stats (last 7 days)
    const aiStats = await this.getAiUsageStats(7);

    // Get performance trends (last 7 days)
    const performanceTrends = await this.dbService.kyselyHealth
      .selectFrom('test_results')
      .select([
        this.dbService.kyselyHealth.fn.date('createdAt / 1000', 'unixepoch', 'localtime').as('date'),
        this.dbService.kyselyHealth.fn.avg('durationMs').as('avgDuration'),
        this.dbService.kyselyHealth.fn.count('id').as('totalTests'),
        this.dbService.kyselyHealth.fn.sum(
          this.dbService.kyselyHealth.fn.iif('status = "passed"', 1, 0)
        ).as('passedTests')
      ])
      .where('createdAt', '>=', Date.now() - (7 * 24 * 60 * 60 * 1000))
      .groupBy(this.dbService.kyselyHealth.fn.date('createdAt / 1000', 'unixepoch', 'localtime'))
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
  private async cleanupOldData(daysToKeep = 90): Promise<{ deletedResults: number; deletedLogs: string }> {
    const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    // Clean up old test results (keep last 1000 per profile)
    const oldResults = await this.dbService.kyselyHealth
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
      await this.dbService.kyselyHealth
        .deleteFrom('test_results')
        .where('id', 'in', Array.from(toDelete))
        .execute();
    }

    // Clean up old AI logs (keep last 30 days)
    await this.dbService.kyselyHealth
      .deleteFrom('ai_logs')
      .where('createdAt', '<', cutoffDate)
      .execute();

    return { deletedResults: toDelete.size, deletedLogs: 'cleaned' };
  }
}