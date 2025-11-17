/**
 * Health Registry - Central registry for all health-monitored components
 * Manages component registration, status tracking, and health state
 */

import { HealthComponent, HealthStatus, HealthIssue } from '../types';

export class HealthRegistry {
  private components = new Map<string, HealthComponent>();
  private issues = new Map<string, HealthIssue[]>();
  private listeners = new Set<(component: HealthComponent, issues: HealthIssue[]) => void>();

  /**
   * Register a new health component
   */
  registerComponent(component: Omit<HealthComponent, 'status' | 'lastChecked'>): void {
    const healthComponent: HealthComponent = {
      ...component,
      status: { status: 'unknown', timestamp: Date.now() },
      lastChecked: 0
    };

    this.components.set(component.id, healthComponent);
    this.issues.set(component.id, []);
  }

  /**
   * Update component health status
   */
  updateComponentStatus(
    componentId: string,
    status: HealthStatus,
    metrics: Record<string, any> = {}
  ): void {
    const component = this.components.get(componentId);
    if (!component) return;

    component.status = { ...status, timestamp: Date.now() };
    component.metrics = { ...component.metrics, ...metrics };
    component.lastChecked = Date.now();

    // Notify listeners
    const componentIssues = this.issues.get(componentId) || [];
    this.listeners.forEach(listener => listener(component, componentIssues));
  }

  /**
   * Add health issues for a component
   */
  addIssues(componentId: string, newIssues: HealthIssue[]): void {
    const existingIssues = this.issues.get(componentId) || [];
    const updatedIssues = [...existingIssues, ...newIssues];
    this.issues.set(componentId, updatedIssues);

    // Update component status based on issues
    const component = this.components.get(componentId);
    if (component) {
      const worstSeverity = this.getWorstIssueSeverity(updatedIssues);
      const status: HealthStatus['status'] = this.mapSeverityToStatus(worstSeverity);

      this.updateComponentStatus(componentId, {
        status,
        timestamp: Date.now(),
        message: updatedIssues.length > 0 ? `${updatedIssues.length} issue(s) detected` : undefined
      });
    }
  }

  /**
   * Resolve issues for a component
   */
  resolveIssues(componentId: string, issueIds: string[]): void {
    const existingIssues = this.issues.get(componentId) || [];
    const updatedIssues = existingIssues.filter(issue => !issueIds.includes(issue.id));

    // Mark resolved issues as resolved
    const resolvedIssues = existingIssues
      .filter(issue => issueIds.includes(issue.id))
      .map(issue => ({ ...issue, resolvedAt: Date.now() }));

    this.issues.set(componentId, updatedIssues);

    // Update component status
    const component = this.components.get(componentId);
    if (component && updatedIssues.length === 0) {
      this.updateComponentStatus(componentId, {
        status: 'healthy',
        timestamp: Date.now(),
        message: 'All issues resolved'
      });
    }
  }

  /**
   * Get component by ID
   */
  getComponent(componentId: string): HealthComponent | undefined {
    return this.components.get(componentId);
  }

  /**
   * Get all components
   */
  getAllComponents(): HealthComponent[] {
    return Array.from(this.components.values());
  }

  /**
   * Get components by type
   */
  getComponentsByType(type: HealthComponent['type']): HealthComponent[] {
    return this.getAllComponents().filter(comp => comp.type === type);
  }

  /**
   * Get issues for a component
   */
  getComponentIssues(componentId: string): HealthIssue[] {
    return this.issues.get(componentId) || [];
  }

  /**
   * Get all unresolved issues
   */
  getAllIssues(): HealthIssue[] {
    return Array.from(this.issues.values()).flat().filter(issue => !issue.resolvedAt);
  }

  /**
   * Subscribe to health updates
   */
  subscribe(listener: (component: HealthComponent, issues: HealthIssue[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get overall system health status
   */
  getOverallHealth(): { status: HealthStatus['status']; score: number } {
    const components = this.getAllComponents();
    if (components.length === 0) {
      return { status: 'unknown', score: 0 };
    }

    const statusCounts = components.reduce((counts, comp) => {
      counts[comp.status.status] = (counts[comp.status.status] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    // Calculate health score (weighted by severity)
    const weights = { healthy: 100, degraded: 50, critical: 0, unknown: 25 };
    const totalScore = components.reduce((sum, comp) => sum + (weights[comp.status.status] || 0), 0);
    const averageScore = Math.round(totalScore / components.length);

    // Determine overall status
    let overallStatus: HealthStatus['status'] = 'healthy';
    if (statusCounts.critical > 0) {
      overallStatus = 'critical';
    } else if (statusCounts.degraded > 0 || statusCounts.unknown > 0) {
      overallStatus = 'degraded';
    }

    return { status: overallStatus, score: averageScore };
  }

  private getWorstIssueSeverity(issues: HealthIssue[]): HealthIssue['severity'] {
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    return issues.reduce((worst, issue) =>
      severityOrder[issue.severity] > severityOrder[worst] ? issue.severity : worst,
      'low' as HealthIssue['severity']
    );
  }

  private mapSeverityToStatus(severity: HealthIssue['severity']): HealthStatus['status'] {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'critical';
      case 'medium': return 'degraded';
      case 'low': return 'healthy';
      default: return 'unknown';
    }
  }
}
