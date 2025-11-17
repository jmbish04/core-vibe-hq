/**
 * VibeSystem Health Types - Shared TypeScript interfaces and types
 * for comprehensive health monitoring across the Vibecode platform
 */

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  timestamp: number;
  message?: string;
}

export interface HealthComponent {
  id: string;
  name: string;
  type: 'worker' | 'service' | 'database' | 'websocket' | 'external' | 'system';
  status: HealthStatus;
  metrics: Record<string, any>;
  lastChecked: number;
  checkInterval: number; // milliseconds
}

export interface HealthIssue {
  id: string;
  componentId: string;
  type: 'communication' | 'dependency' | 'websocket' | 'build' | 'security' | 'performance' | 'resource' | 'configuration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: any;
  impact: string;
  fix?: string;
  detectedAt: number;
  resolvedAt?: number;
}

export interface HealthMetrics {
  uptime: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  memoryUsage?: number;
  cpuUsage?: number;
  activeConnections?: number;
  queueDepth?: number;
}

export interface HealthCheckResult {
  componentId: string;
  success: boolean;
  duration: number;
  issues: HealthIssue[];
  metrics: HealthMetrics;
  timestamp: number;
}

export interface HealthReport {
  id: string;
  timestamp: number;
  period: {
    start: number;
    end: number;
  };
  overall: {
    status: HealthStatus['status'];
    score: number; // 0-100
    totalComponents: number;
    healthyComponents: number;
    degradedComponents: number;
    criticalComponents: number;
  };
  components: HealthComponent[];
  issues: HealthIssue[];
  recommendations: string[];
  aiAnalysis?: AIAnalysisResult;
}

export interface AIAnalysisResult {
  summary: string;
  rootCauses: string[];
  securityImplications: string[];
  recommendedActions: string[];
  confidence: number;
  generatedAt: number;
}

export interface HealthTestContext {
  repositoryUrl?: string;
  buildError?: string;
  serviceBindings?: string[];
  websocketEndpoints?: string[];
  rpcEndpoints?: string[];
  expectedDependencies?: string[];
  customConfig?: Record<string, any>;
}

export interface HealthTest {
  id: string;
  name: string;
  description: string;
  category: 'unit' | 'integration' | 'performance' | 'security' | 'communication' | 'websocket' | 'build';
  target: string;
  enabled: boolean;
  schedule: 'manual' | 'cron' | 'realtime';
  checkInterval?: number; // for realtime monitoring
  config: Record<string, any>;
  tags: string[];
}

export interface HealthAlert {
  id: string;
  issueId: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  component: string;
  triggeredAt: number;
  acknowledgedAt?: number;
  resolvedAt?: number;
}

export interface HealthThreshold {
  metric: string;
  warning: number;
  critical: number;
  unit: string;
  description: string;
}

export interface SystemHealthSnapshot {
  timestamp: number;
  components: Record<string, HealthComponent>;
  alerts: HealthAlert[];
  metrics: Record<string, HealthMetrics>;
  overall: {
    status: HealthStatus['status'];
    score: number;
  };
}

// Re-export for convenience
export type { HealthTestContext as TestContext } from './testContext';
