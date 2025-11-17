/**
 * Health Test Context Types
 * Specialized contexts for different types of health tests
 */

export interface DependencyTestContext {
  repositoryUrl?: string;
  buildError?: string;
  expectedDependencies?: string[];
  lockfilePath?: string;
  packageJsonPath?: string;
  checkTransitiveDeps?: boolean;
}

export interface CommunicationTestContext {
  serviceBindings: string[];
  rpcEndpoints: string[];
  timeoutMs?: number;
  retryAttempts?: number;
  expectedResponseTime?: number;
}

export interface WebSocketTestContext {
  endpoints: string[];
  protocols?: string[];
  heartbeatInterval?: number;
  connectionTimeout?: number;
  messageTimeout?: number;
}

export interface BuildTestContext {
  repositoryUrl?: string;
  buildCommand?: string;
  buildTimeout?: number;
  expectedArtifacts?: string[];
  checkDependencies?: boolean;
  validatePackageLock?: boolean;
}

export interface SecurityTestContext {
  checkSecrets?: boolean;
  validatePermissions?: boolean;
  scanForVulnerabilities?: boolean;
  checkConfigurations?: boolean;
  auditDependencies?: boolean;
}

export interface PerformanceTestContext {
  targetResponseTime?: number;
  maxMemoryUsage?: number;
  maxCpuUsage?: number;
  concurrentUsers?: number;
  testDuration?: number;
  loadPattern?: 'constant' | 'ramp-up' | 'spike';
}

export interface ResourceTestContext {
  checkDiskSpace?: boolean;
  checkMemory?: boolean;
  checkCpu?: boolean;
  checkNetwork?: boolean;
  thresholds?: {
    diskSpaceWarning?: number;
    diskSpaceCritical?: number;
    memoryWarning?: number;
    memoryCritical?: number;
    cpuWarning?: number;
    cpuCritical?: number;
  };
}

// Union type for all test contexts
export type HealthTestContext =
  | DependencyTestContext
  | CommunicationTestContext
  | WebSocketTestContext
  | BuildTestContext
  | SecurityTestContext
  | PerformanceTestContext
  | ResourceTestContext
  | Record<string, any>; // For custom contexts

// Type guards for context identification
export function isDependencyContext(context: HealthTestContext): context is DependencyTestContext {
  return 'expectedDependencies' in context || 'lockfilePath' in context;
}

export function isCommunicationContext(context: HealthTestContext): context is CommunicationTestContext {
  return 'serviceBindings' in context || 'rpcEndpoints' in context;
}

export function isWebSocketContext(context: HealthTestContext): context is WebSocketTestContext {
  return 'endpoints' in context && 'protocols' in context;
}

export function isBuildContext(context: HealthTestContext): context is BuildTestContext {
  return 'buildCommand' in context || 'expectedArtifacts' in context;
}

export function isSecurityContext(context: HealthTestContext): context is SecurityTestContext {
  return 'checkSecrets' in context || 'auditDependencies' in context;
}

export function isPerformanceContext(context: HealthTestContext): context is PerformanceTestContext {
  return 'targetResponseTime' in context || 'concurrentUsers' in context;
}

export function isResourceContext(context: HealthTestContext): context is ResourceTestContext {
  return 'checkDiskSpace' in context || 'thresholds' in context;
}
