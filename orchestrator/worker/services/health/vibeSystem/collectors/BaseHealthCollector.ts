/**
 * Base Health Collector - Abstract base class for all health data collectors
 * Provides common functionality for collecting and reporting health data
 */

import { HealthCheckResult, HealthComponent, HealthTestContext } from '../types';

export abstract class BaseHealthCollector {
  protected componentId: string;
  protected componentName: string;

  constructor(componentId: string, componentName: string) {
    this.componentId = componentId;
    this.componentName = componentName;
  }

  /**
   * Get component information
   */
  getComponentInfo(): Omit<HealthComponent, 'status' | 'lastChecked'> {
    return {
      id: this.componentId,
      name: this.componentName,
      type: this.getComponentType(),
      metrics: {},
      checkInterval: this.getCheckInterval()
    };
  }

  /**
   * Perform health check
   */
  async checkHealth(context?: HealthTestContext): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const result = await this.performHealthCheck(context);
      const duration = Date.now() - startTime;

      return {
        componentId: this.componentId,
        success: result.success,
        duration,
        issues: result.issues,
        metrics: result.metrics,
        timestamp: Date.now()
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        componentId: this.componentId,
        success: false,
        duration,
        issues: [{
          id: `${this.componentId}-error-${Date.now()}`,
          componentId: this.componentId,
          type: 'performance',
          severity: 'high',
          message: `Health check failed: ${error.message}`,
          details: error,
          impact: 'Unable to determine component health',
          fix: 'Check component configuration and logs',
          detectedAt: Date.now()
        }],
        metrics: { error: error.message },
        timestamp: Date.now()
      };
    }
  }

  /**
   * Abstract method to be implemented by subclasses
   */
  protected abstract getComponentType(): HealthComponent['type'];

  /**
   * Abstract method to be implemented by subclasses
   */
  protected abstract getCheckInterval(): number;

  /**
   * Abstract method to be implemented by subclasses
   */
  protected abstract performHealthCheck(context?: HealthTestContext): Promise<{
    success: boolean;
    issues: any[];
    metrics: Record<string, any>;
  }>;
}
