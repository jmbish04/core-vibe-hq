// Health database types - matching orchestrator schema
export type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';

export interface TestProfile {
  id: number;
  name: string;
  description?: string;
  category: 'unit' | 'integration' | 'performance' | 'security' | 'ai';
  target: string;
  enabled: boolean;
  schedule?: string;
  timeoutSeconds?: number;
  retryAttempts?: number;
  config?: any;
  createdAt?: number;
  updatedAt?: number;
}

export interface NewTestProfile {
  name: string;
  description?: string;
  category: 'unit' | 'integration' | 'performance' | 'security' | 'ai';
  target: string;
  enabled?: boolean;
  schedule?: string;
  timeoutSeconds?: number;
  retryAttempts?: number;
  config?: any;
}

export interface TestResult {
  id: number;
  testProfileId: number;
  runId: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  durationMs?: number;
  errorMessage?: string;
  output?: any;
  metrics?: any;
  environment?: string;
  triggeredBy?: string;
  startedAt?: number;
  completedAt?: number;
  createdAt: number;
}

export interface NewTestResult {
  testProfileId: number;
  runId: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  durationMs?: number;
  errorMessage?: string;
  output?: any;
  metrics?: any;
  environment?: string;
  triggeredBy?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface AiLog {
  id: number;
  testResultId?: number;
  model: string;
  provider: string;
  prompt?: string;
  response?: string;
  tokensUsed?: number;
  cost?: number;
  latencyMs?: number;
  success?: boolean;
  errorMessage?: string;
  reasoning?: any;
  metadata?: any;
  createdAt: number;
}

export interface NewAiLog {
  testResultId?: number;
  model: string;
  provider: string;
  prompt?: string;
  response?: string;
  tokensUsed?: number;
  cost?: number;
  latencyMs?: number;
  success?: boolean;
  errorMessage?: string;
  reasoning?: any;
  metadata?: any;
}

export interface HealthSummary {
  id: number;
  date: string;
  overallStatus: HealthStatus;
  totalTests?: number;
  passedTests?: number;
  failedTests?: number;
  skippedTests?: number;
  averageLatency?: number;
  totalCost?: number;
  aiUsageCount?: number;
  issues?: any;
  recommendations?: any;
  createdAt: number;
}

export interface NewHealthSummary {
  date: string;
  overallStatus: HealthStatus;
  totalTests?: number;
  passedTests?: number;
  failedTests?: number;
  skippedTests?: number;
  averageLatency?: number;
  totalCost?: number;
  aiUsageCount?: number;
  issues?: any;
  recommendations?: any;
}

export interface HealthDashboardData {
  summary?: HealthSummary;
  recentResults?: Array<{
    status: string;
    count: number;
  }>;
  aiStats?: Array<{
    model: string;
    provider: string;
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    avgLatency: number;
  }>;
  performanceTrends?: Array<{
    date: string;
    avgDuration: number;
    totalTests: number;
    passedTests: number;
  }>;
}
