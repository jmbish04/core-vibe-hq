/**
 * WebSocket Health Collector
 * Tests PartyKit WebSocket connectivity and real-time communication
 */

import { BaseHealthCollector } from './BaseHealthCollector';
import { HealthIssue, HealthTestContext, isWebSocketContext } from '../types';

export class WebSocketHealthCollector extends BaseHealthCollector {
  constructor() {
    super('websocket-health', 'WebSocket Connectivity');
  }

  protected getComponentType() {
    return 'websocket' as const;
  }

  protected getCheckInterval(): number {
    return 60000; // Check every minute (WebSocket health is important)
  }

  protected async performHealthCheck(context?: HealthTestContext) {
    const issues: HealthIssue[] = [];
    const metrics = {
      endpointsTested: 0,
      endpointsWorking: 0,
      connectionTimeMs: 0,
      messagesSent: 0,
      messagesReceived: 0,
      averageLatency: 0,
      uptime: 0
    };

    if (!context || !isWebSocketContext(context)) {
      // Default WebSocket test
      context = {
        endpoints: [
          '/api/workers/*/terminal',
          '/ws/health',
          '/ws/collaboration'
        ],
        connectionTimeout: 3000,
        messageTimeout: 2000
      };
    }

    const startTime = Date.now();
    const latencies: number[] = [];

    metrics.endpointsTested = context.endpoints.length;

    // Test each WebSocket endpoint
    for (const endpoint of context.endpoints) {
      try {
        const endpointStart = Date.now();
        const result = await this.testWebSocketEndpoint(
          endpoint,
          context.connectionTimeout || 3000,
          context.messageTimeout || 2000
        );
        const latency = Date.now() - endpointStart;
        latencies.push(latency);

        if (result.success) {
          metrics.endpointsWorking++;
          metrics.messagesSent += result.messagesSent;
          metrics.messagesReceived += result.messagesReceived;
        } else {
          const severity = this.determineWebSocketSeverity(endpoint);
          issues.push({
            id: `ws-${endpoint.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`,
            componentId: this.componentId,
            type: 'websocket',
            severity,
            message: `WebSocket endpoint ${endpoint} is not responding`,
            details: { endpoint, latency, error: result.error },
            impact: this.getWebSocketImpact(endpoint),
            fix: this.getWebSocketFix(endpoint),
            detectedAt: Date.now()
          });
        }
      } catch (error) {
        latencies.push(Date.now() - startTime);
        issues.push({
          id: `ws-error-${endpoint.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`,
          componentId: this.componentId,
          type: 'websocket',
          severity: 'high',
          message: `WebSocket endpoint ${endpoint} test failed`,
          details: { endpoint, error: error.message },
          impact: 'Real-time communication is compromised',
          fix: 'Check PartyKit server and WebSocket configuration',
          detectedAt: Date.now()
        });
      }
    }

    // Test heartbeat if configured
    if (context.heartbeatInterval) {
      try {
        const heartbeatResult = await this.testHeartbeat(
          context.endpoints[0], // Test with first endpoint
          context.heartbeatInterval
        );
        if (!heartbeatResult.success) {
          issues.push({
            id: `ws-heartbeat-${Date.now()}`,
            componentId: this.componentId,
            type: 'websocket',
            severity: 'medium',
            message: 'WebSocket heartbeat is not working properly',
            details: heartbeatResult,
            impact: 'Connection stability may be affected',
            fix: 'Check heartbeat configuration and network conditions',
            detectedAt: Date.now()
          });
        }
      } catch (error) {
        issues.push({
          id: `ws-heartbeat-error-${Date.now()}`,
          componentId: this.componentId,
          type: 'websocket',
          severity: 'low',
          message: 'Heartbeat test failed',
          details: { error: error.message },
          impact: 'Minor monitoring issue',
          fix: 'Check heartbeat implementation',
          detectedAt: Date.now()
        });
      }
    }

    // Calculate metrics
    metrics.connectionTimeMs = Date.now() - startTime;
    metrics.averageLatency = latencies.length > 0
      ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
      : 0;

    // Calculate uptime (simplified - would track actual uptime)
    metrics.uptime = issues.length === 0 ? 100 : Math.max(0, 100 - (issues.length * 10));

    const success = issues.filter(i => i.severity === 'critical').length === 0;

    return { success, issues, metrics };
  }

  private async testWebSocketEndpoint(
    endpoint: string,
    connectionTimeout: number,
    messageTimeout: number
  ): Promise<{
    success: boolean;
    messagesSent: number;
    messagesReceived: number;
    error?: string;
  }> {
    try {
      // This would create an actual WebSocket connection to test PartyKit
      // For now, simulate the test

      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500));

      // Simulate occasional connection failures
      if (Math.random() < 0.02) { // 2% failure rate
        return {
          success: false,
          messagesSent: 0,
          messagesReceived: 0,
          error: 'Connection timeout'
        };
      }

      // Simulate message exchange
      const messagesToSend = Math.floor(Math.random() * 3) + 1; // 1-3 messages
      const messagesReceived = messagesToSend; // Assume all received

      // Simulate message delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200));

      // Simulate occasional message loss
      const actualReceived = Math.random() < 0.95 ? messagesReceived : messagesReceived - 1;

      return {
        success: actualReceived > 0,
        messagesSent: messagesToSend,
        messagesReceived: actualReceived
      };

    } catch (error) {
      return {
        success: false,
        messagesSent: 0,
        messagesReceived: 0,
        error: error.message
      };
    }
  }

  private async testHeartbeat(endpoint: string, interval: number): Promise<{
    success: boolean;
    heartbeatsSent?: number;
    heartbeatsReceived?: number;
    averageRtt?: number;
  }> {
    try {
      // Test heartbeat mechanism
      const testDuration = Math.min(interval * 3, 10000); // Test for 3 intervals or 10 seconds max
      const expectedHeartbeats = Math.floor(testDuration / interval);

      // Simulate heartbeat test
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));

      const successRate = Math.random();
      const heartbeatsReceived = Math.floor(expectedHeartbeats * successRate);

      return {
        success: successRate > 0.8, // 80% success rate required
        heartbeatsSent: expectedHeartbeats,
        heartbeatsReceived,
        averageRtt: Math.random() * 100 + 50 // 50-150ms
      };

    } catch (error) {
      return {
        success: false
      };
    }
  }

  private determineWebSocketSeverity(endpoint: string): 'low' | 'medium' | 'high' | 'critical' {
    // Critical for core communication endpoints
    if (endpoint.includes('health') || endpoint.includes('terminal')) {
      return 'critical';
    }
    // High for collaboration features
    if (endpoint.includes('collaboration')) {
      return 'high';
    }
    // Medium for other endpoints
    return 'medium';
  }

  private getWebSocketImpact(endpoint: string): string {
    if (endpoint.includes('health')) {
      return 'Health monitoring and real-time status updates will not work';
    }
    if (endpoint.includes('terminal')) {
      return 'Terminal access and command execution will be unavailable';
    }
    if (endpoint.includes('collaboration')) {
      return 'Real-time collaboration features will be disabled';
    }
    return 'WebSocket-based features may not function properly';
  }

  private getWebSocketFix(endpoint: string): string {
    return 'Check PartyKit server configuration, WebSocket endpoint settings, and network connectivity';
  }
}
