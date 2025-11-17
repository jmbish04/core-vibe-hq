/**
 * Communication Health Collector
 * Tests inter-worker communication, RPC bindings, and service connectivity
 */

import { BaseHealthCollector } from './BaseHealthCollector';
import { HealthIssue, HealthTestContext, isCommunicationContext } from '../types';

export class CommunicationHealthCollector extends BaseHealthCollector {
  constructor() {
    super('communication-health', 'Inter-Worker Communication');
  }

  protected getComponentType() {
    return 'service' as const;
  }

  protected getCheckInterval(): number {
    return 30000; // Check every 30 seconds
  }

  protected async performHealthCheck(context?: HealthTestContext) {
    const issues: HealthIssue[] = [];
    const metrics = {
      bindingsTested: 0,
      bindingsWorking: 0,
      responseTimeMs: 0,
      rpcCallsMade: 0,
      averageLatency: 0
    };

    if (!context || !isCommunicationContext(context)) {
      // Default communication test
      const defaultBindings = [
        'ORCHESTRATOR_DATA',
        'ORCHESTRATOR_PROJECTS',
        'ORCHESTRATOR_CHATS',
        'ORCHESTRATOR_HEALTH'
      ];

      context = {
        serviceBindings: defaultBindings,
        rpcEndpoints: ['/api/status', '/api/health'],
        timeoutMs: 5000
      };
    }

    const startTime = Date.now();
    const latencies: number[] = [];

    // Test service bindings
    if (context.serviceBindings) {
      metrics.bindingsTested = context.serviceBindings.length;

      for (const binding of context.serviceBindings) {
        try {
          const bindingStart = Date.now();
          const isWorking = await this.testServiceBinding(binding, context.timeoutMs || 5000);
          const latency = Date.now() - bindingStart;
          latencies.push(latency);

          if (isWorking) {
            metrics.bindingsWorking++;
          } else {
            issues.push({
              id: `comm-${binding}-${Date.now()}`,
              componentId: this.componentId,
              type: 'communication',
              severity: 'high',
              message: `Service binding ${binding} is not responding`,
              details: { binding, latency },
              impact: 'Inter-worker communication may be broken',
              fix: 'Check worker deployment and network connectivity',
              detectedAt: Date.now()
            });
          }
          metrics.rpcCallsMade++;
        } catch (error) {
          latencies.push(Date.now() - startTime);
          issues.push({
            id: `comm-error-${binding}-${Date.now()}`,
            componentId: this.componentId,
            type: 'communication',
            severity: 'critical',
            message: `Failed to test service binding ${binding}`,
            details: { binding, error: error.message },
            impact: 'Critical communication failure',
            fix: 'Immediate investigation required',
            detectedAt: Date.now()
          });
        }
      }
    }

    // Test RPC endpoints
    if (context.rpcEndpoints) {
      for (const endpoint of context.rpcEndpoints) {
        try {
          const endpointStart = Date.now();
          const isWorking = await this.testRpcEndpoint(endpoint, context.timeoutMs || 5000);
          const latency = Date.now() - endpointStart;
          latencies.push(latency);

          if (!isWorking) {
            issues.push({
              id: `rpc-${endpoint}-${Date.now()}`,
              componentId: this.componentId,
              type: 'communication',
              severity: 'medium',
              message: `RPC endpoint ${endpoint} is not responding`,
              details: { endpoint, latency },
              impact: 'API calls may fail',
              fix: 'Check endpoint configuration and service health',
              detectedAt: Date.now()
            });
          }
        } catch (error) {
          issues.push({
            id: `rpc-error-${endpoint}-${Date.now()}`,
            componentId: this.componentId,
            type: 'communication',
            severity: 'high',
            message: `RPC endpoint ${endpoint} test failed`,
            details: { endpoint, error: error.message },
            impact: 'API communication issues',
            fix: 'Verify endpoint configuration',
            detectedAt: Date.now()
          });
        }
      }
    }

    // Calculate metrics
    metrics.responseTimeMs = Date.now() - startTime;
    metrics.averageLatency = latencies.length > 0
      ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
      : 0;

    const success = issues.filter(i => i.severity === 'critical').length === 0;

    return { success, issues, metrics };
  }

  private async testServiceBinding(binding: string, timeoutMs: number): Promise<boolean> {
    // This would make an actual RPC call to test the binding
    // For now, simulate the test
    try {
      // Simulate network call
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

      // Simulate occasional failures for testing
      if (Math.random() < 0.05) { // 5% failure rate for testing
        throw new Error('Service binding timeout');
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  private async testRpcEndpoint(endpoint: string, timeoutMs: number): Promise<boolean> {
    // This would make an HTTP call to test the endpoint
    // For now, simulate the test
    try {
      // Simulate HTTP call
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200));

      // Simulate occasional failures
      if (Math.random() < 0.03) { // 3% failure rate
        throw new Error('Endpoint not responding');
      }

      return true;
    } catch (error) {
      return false;
    }
  }
}
