import type {
  TestProfile,
  NewTestProfile,
  TestResult,
  NewTestResult,
  AiLog,
  NewAiLog,
  HealthSummary,
  NewHealthSummary
} from './healthTypes';

export interface HealthDatabaseClient {
  // Test Profiles
  getTestProfiles(enabledOnly?: boolean): Promise<TestProfile[]>;
  getTestProfileById(id: number): Promise<TestProfile | undefined>;
  createTestProfile(profile: NewTestProfile): Promise<TestProfile>;
  updateTestProfile(id: number, updates: Partial<NewTestProfile>): Promise<void>;

  // Test Results
  createTestResult(result: NewTestResult): Promise<TestResult>;
  updateTestResult(id: number, updates: Partial<NewTestResult>): Promise<void>;
  getTestResults(limit?: number, offset?: number): Promise<TestResult[]>;
  getTestResultsByRunId(runId: string): Promise<TestResult[]>;
  getTestResultsByProfile(profileId: number, limit?: number): Promise<TestResult[]>;

  // AI Logs
  createAiLog(log: NewAiLog): Promise<AiLog>;
  getAiLogsByTestResult(testResultId: number): Promise<AiLog[]>;
  getAiUsageStats(days?: number): Promise<any[]>;

  // Health Summaries
  createHealthSummary(summary: NewHealthSummary): Promise<HealthSummary>;
  getHealthSummaries(limit?: number): Promise<HealthSummary[]>;
  getLatestHealthSummary(): Promise<HealthSummary | undefined>;

  // Complex queries
  getTestResultsWithProfiles(limit?: number): Promise<any[]>;
  getHealthDashboardData(): Promise<any>;
  cleanupOldData(daysToKeep?: number): Promise<{ deletedResults: number; deletedLogs: string }>;
}

export class OrchestratorHealthClient implements HealthDatabaseClient {
  constructor(private orchestratorHealth: any) {}

  // Test Profiles Operations
  async getTestProfiles(enabledOnly = true): Promise<TestProfile[]> {
    const response = await this.orchestratorHealth.handleRequest({
      getTestProfiles: { enabledOnly }
    });
    return response.testProfiles || [];
  }

  async getTestProfileById(id: number): Promise<TestProfile | undefined> {
    const response = await this.orchestratorHealth.handleRequest({
      getTestProfileById: { id }
    });
    return response.testProfile;
  }

  async createTestProfile(profile: NewTestProfile): Promise<TestProfile> {
    const response = await this.orchestratorHealth.handleRequest({
      createTestProfile: { profile }
    });
    if (!response.testProfile) {
      throw new Error('Failed to create test profile');
    }
    return response.testProfile;
  }

  async updateTestProfile(id: number, updates: Partial<NewTestProfile>): Promise<void> {
    await this.orchestratorHealth.handleRequest({
      updateTestProfile: { id, updates }
    });
  }

  // Test Results Operations
  async createTestResult(result: NewTestResult): Promise<TestResult> {
    const response = await this.orchestratorHealth.handleRequest({
      createTestResult: { result }
    });
    if (!response.testResult) {
      throw new Error('Failed to create test result');
    }
    return response.testResult;
  }

  async updateTestResult(id: number, updates: Partial<NewTestResult>): Promise<void> {
    await this.orchestratorHealth.handleRequest({
      updateTestResult: { id, updates }
    });
  }

  async getTestResults(limit = 100, offset = 0): Promise<TestResult[]> {
    const response = await this.orchestratorHealth.handleRequest({
      getTestResults: { limit, offset }
    });
    return response.testResults || [];
  }

  async getTestResultsByRunId(runId: string): Promise<TestResult[]> {
    const response = await this.orchestratorHealth.handleRequest({
      getTestResultsByRunId: { runId }
    });
    return response.testResults || [];
  }

  async getTestResultsByProfile(profileId: number, limit = 50): Promise<TestResult[]> {
    const response = await this.orchestratorHealth.handleRequest({
      getTestResultsByProfile: { profileId, limit }
    });
    return response.testResults || [];
  }

  // AI Logs Operations
  async createAiLog(log: NewAiLog): Promise<AiLog> {
    const response = await this.orchestratorHealth.handleRequest({
      createAiLog: { log }
    });
    if (!response.aiLog) {
      throw new Error('Failed to create AI log');
    }
    return response.aiLog;
  }

  async getAiLogsByTestResult(testResultId: number): Promise<AiLog[]> {
    const response = await this.orchestratorHealth.handleRequest({
      getAiLogsByTestResult: { testResultId }
    });
    return response.aiLogs || [];
  }

  async getAiUsageStats(days = 30): Promise<any[]> {
    const response = await this.orchestratorHealth.handleRequest({
      getAiUsageStats: { days }
    });
    return response.aiUsageStats || [];
  }

  // Health Summaries Operations
  async createHealthSummary(summary: NewHealthSummary): Promise<HealthSummary> {
    const response = await this.orchestratorHealth.handleRequest({
      createHealthSummary: { summary }
    });
    if (!response.healthSummary) {
      throw new Error('Failed to create health summary');
    }
    return response.healthSummary;
  }

  async getHealthSummaries(limit = 30): Promise<HealthSummary[]> {
    const response = await this.orchestratorHealth.handleRequest({
      getHealthSummaries: { limit }
    });
    return response.healthSummaries || [];
  }

  async getLatestHealthSummary(): Promise<HealthSummary | undefined> {
    const response = await this.orchestratorHealth.handleRequest({
      getLatestHealthSummary: {}
    });
    return response.healthSummary;
  }

  // Complex queries
  async getTestResultsWithProfiles(limit = 50): Promise<any[]> {
    const response = await this.orchestratorHealth.handleRequest({
      getTestResultsWithProfiles: { limit }
    });
    return response.testResultsWithProfiles || [];
  }

  async getHealthDashboardData(): Promise<any> {
    const response = await this.orchestratorHealth.handleRequest({
      getHealthDashboardData: {}
    });
    return response.dashboardData;
  }

  // Cleanup operations
  async cleanupOldData(daysToKeep = 90): Promise<{ deletedResults: number; deletedLogs: string }> {
    const response = await this.orchestratorHealth.handleRequest({
      cleanupOldData: { daysToKeep }
    });
    return response.cleanupResult || { deletedResults: 0, deletedLogs: 'none' };
  }
}
