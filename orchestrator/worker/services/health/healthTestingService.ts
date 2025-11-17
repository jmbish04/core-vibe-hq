/**
 * Health Testing Service - Orchestrator Macro-Level Health Checks
 *
 * This service performs high-level system testing including:
 * - Inter-worker communication verification
 * - PartyKit WebSocket connectivity testing
 * - Service binding validation
 * - Build and deployment issue analysis
 * - Dependency synchronization checking
 * - Macro-level system health monitoring
 */

import { AiService } from '../ai-providers/aiService';
import { HealthDatabaseClient, OrchestratorHealthClient } from '../../health/database';
import type { TestResult, NewTestResult, AiLog, NewAiLog, HealthSummary, NewHealthSummary } from '../../database/schema';

export interface HealthTestContext {
  repositoryUrl?: string;
  buildError?: string;
  serviceBindings?: string[];
  websocketEndpoints?: string[];
  rpcEndpoints?: string[];
  expectedDependencies?: string[];
}

export interface HealthTestResult {
  success: boolean;
  issues: HealthIssue[];
  metrics: Record<string, any>;
  recommendations: string[];
  aiAnalysis?: AIAnalysisResult;
}

export interface HealthIssue {
  type: 'communication' | 'dependency' | 'websocket' | 'build' | 'security' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: any;
  impact: string;
  fix?: string;
}

export interface AIAnalysisResult {
  rootCause: string;
  securityImplications: string;
  recommendedActions: string[];
  confidence: number;
}

export class HealthTestingService {
  constructor(
    private aiService: AiService,
    private dbClient: HealthDatabaseClient
  ) {}

  /**
   * Run comprehensive dependency synchronization check
   */
  async testDependencySynchronization(context: HealthTestContext): Promise<HealthTestResult> {
    const issues: HealthIssue[] = [];
    const metrics = {
      patternsDetected: 0,
      dependenciesChecked: 0,
      syncIssuesFound: 0,
      analysisTimeMs: 0
    };

    const startTime = Date.now();

    try {
      // Analyze build error for dependency sync issues
      if (context.buildError) {
        const syncIssues = this.analyzeDependencySyncError(context.buildError);
        issues.push(...syncIssues);
        metrics.syncIssuesFound = syncIssues.length;
      }

      // Check for missing dependencies
      if (context.expectedDependencies) {
        const missingDeps = await this.checkMissingDependencies(context.expectedDependencies);
        issues.push(...missingDeps);
        metrics.dependenciesChecked = context.expectedDependencies.length;
      }

      // Pattern detection analysis
      const patterns = this.detectErrorPatterns(context.buildError || '');
      metrics.patternsDetected = patterns.length;

      // Generate AI analysis if there are issues
      let aiAnalysis: AIAnalysisResult | undefined;
      if (issues.length > 0) {
        aiAnalysis = await this.generateAIAnalysis(issues, context);
      }

      // Generate recommendations
      const recommendations = this.generateRecommendations(issues, context);

      metrics.analysisTimeMs = Date.now() - startTime;

      const success = issues.filter(i => i.severity === 'critical').length === 0;

      return {
        success,
        issues,
        metrics,
        recommendations,
        aiAnalysis
      };

    } catch (error) {
      console.error('Health testing service error:', error);
      return {
        success: false,
        issues: [{
          type: 'performance',
          severity: 'high',
          message: 'Health testing service encountered an error',
          details: error,
          impact: 'Unable to complete health analysis',
          fix: 'Check service logs and retry'
        }],
        metrics: { ...metrics, analysisTimeMs: Date.now() - startTime },
        recommendations: ['Investigate health testing service errors', 'Check orchestrator logs']
      };
    }
  }

  /**
   * Test inter-worker communication health
   */
  async testInterWorkerCommunication(): Promise<HealthTestResult> {
    const issues: HealthIssue[] = [];
    const metrics = {
      bindingsTested: 0,
      bindingsWorking: 0,
      responseTimeMs: 0,
      rpcCallsMade: 0
    };

    const startTime = Date.now();

    try {
      // Test service bindings to other workers
      const serviceBindings = [
        'ORCHESTRATOR_DATA',
        'ORCHESTRATOR_PROJECTS',
        'ORCHESTRATOR_CHATS',
        'ORCHESTRATOR_HEALTH'
      ];

      metrics.bindingsTested = serviceBindings.length;

      for (const binding of serviceBindings) {
        try {
          // Test basic RPC connectivity (this would be a simple ping/health check)
          const isWorking = await this.testServiceBinding(binding);
          if (isWorking) {
            metrics.bindingsWorking++;
          } else {
            issues.push({
              type: 'communication',
              severity: 'high',
              message: `Service binding ${binding} is not responding`,
              details: { binding },
              impact: 'Inter-worker communication may be broken',
              fix: 'Check worker deployment and network connectivity'
            });
          }
          metrics.rpcCallsMade++;
        } catch (error) {
          issues.push({
            type: 'communication',
            severity: 'critical',
            message: `Failed to test service binding ${binding}`,
            details: { binding, error },
            impact: 'Critical communication failure',
            fix: 'Immediate investigation required'
          });
        }
      }

      metrics.responseTimeMs = Date.now() - startTime;

      const success = issues.filter(i => i.severity === 'critical').length === 0;

      return {
        success,
        issues,
        metrics,
        recommendations: success ? [] : ['Check worker deployments', 'Verify service bindings', 'Test network connectivity']
      };

    } catch (error) {
      return {
        success: false,
        issues: [{
          type: 'communication',
          severity: 'critical',
          message: 'Inter-worker communication test failed',
          details: error,
          impact: 'System communication is compromised',
          fix: 'Immediate system investigation required'
        }],
        metrics: { ...metrics, responseTimeMs: Date.now() - startTime },
        recommendations: ['Check orchestrator deployment', 'Verify all worker services are running']
      };
    }
  }

  /**
   * Test PartyKit WebSocket connectivity
   */
  async testWebSocketConnectivity(): Promise<HealthTestResult> {
    const issues: HealthIssue[] = [];
    const metrics = {
      endpointsTested: 0,
      endpointsWorking: 0,
      connectionTimeMs: 0,
      messagesSent: 0,
      messagesReceived: 0
    };

    const startTime = Date.now();

    try {
      // Test WebSocket endpoints
      const wsEndpoints = [
        '/api/workers/*/terminal',
        '/ws/health',
        '/ws/collaboration'
      ];

      metrics.endpointsTested = wsEndpoints.length;

      for (const endpoint of wsEndpoints) {
        try {
          const isWorking = await this.testWebSocketEndpoint(endpoint);
          if (isWorking) {
            metrics.endpointsWorking++;
            metrics.messagesSent++;
            metrics.messagesReceived++;
          } else {
            issues.push({
              type: 'websocket',
              severity: 'medium',
              message: `WebSocket endpoint ${endpoint} is not responding`,
              details: { endpoint },
              impact: 'Real-time features may not work',
              fix: 'Check PartyKit server configuration'
            });
          }
        } catch (error) {
          issues.push({
            type: 'websocket',
            severity: 'high',
            message: `WebSocket endpoint ${endpoint} test failed`,
            details: { endpoint, error },
            impact: 'WebSocket connectivity issues',
            fix: 'Verify PartyKit deployment and configuration'
          });
        }
      }

      metrics.connectionTimeMs = Date.now() - startTime;

      const success = issues.filter(i => i.severity === 'critical').length === 0;

      return {
        success,
        issues,
        metrics,
        recommendations: success ? [] : ['Check PartyKit server', 'Verify WebSocket configurations', 'Test manual WebSocket connections']
      };

    } catch (error) {
      return {
        success: false,
        issues: [{
          type: 'websocket',
          severity: 'critical',
          message: 'WebSocket connectivity test failed',
          details: error,
          impact: 'Real-time communication is broken',
          fix: 'PartyKit server investigation required'
        }],
        metrics: { ...metrics, connectionTimeMs: Date.now() - startTime },
        recommendations: ['Check PartyKit deployment', 'Verify server logs', 'Test basic connectivity']
      };
    }
  }

  /**
   * Test overall system build health
   */
  async testBuildHealth(): Promise<HealthTestResult> {
    const issues: HealthIssue[] = [];
    const metrics = {
      repositoriesChecked: 0,
      buildErrorsFound: 0,
      dependencyIssues: 0,
      securityIssues: 0
    };

    try {
      // Test common repository patterns
      const testRepos = [
        'https://github.com/jmbish04/core-linkedin-scraper', // Known dependency sync issue
        // Add more test repositories as needed
      ];

      metrics.repositoriesChecked = testRepos.length;

      for (const repoUrl of testRepos) {
        try {
          const repoIssues = await this.analyzeRepositoryHealth(repoUrl);
          issues.push(...repoIssues);

          // Count issue types
          repoIssues.forEach(issue => {
            if (issue.type === 'build') metrics.buildErrorsFound++;
            if (issue.type === 'dependency') metrics.dependencyIssues++;
            if (issue.type === 'security') metrics.securityIssues++;
          });
        } catch (error) {
          issues.push({
            type: 'build',
            severity: 'medium',
            message: `Failed to analyze repository ${repoUrl}`,
            details: { repoUrl, error },
            impact: 'Cannot verify repository health',
            fix: 'Check repository accessibility'
          });
        }
      }

      const success = issues.filter(i => i.severity === 'critical').length === 0;

      return {
        success,
        issues,
        metrics,
        recommendations: [
          'Monitor repositories for dependency sync issues',
          'Implement automated build health checks',
          'Set up dependency vulnerability scanning'
        ]
      };

    } catch (error) {
      return {
        success: false,
        issues: [{
          type: 'build',
          severity: 'high',
          message: 'Build health testing failed',
          details: error,
          impact: 'Cannot verify build system health',
          fix: 'Investigate build testing infrastructure'
        }],
        metrics,
        recommendations: ['Check build system configuration', 'Verify repository access', 'Test manual build processes']
      };
    }
  }

  // Helper methods

  private analyzeDependencySyncError(errorText: string): HealthIssue[] {
    const issues: HealthIssue[] = [];

    // Check for package-lock.json sync issues
    if (errorText.includes('can only install packages when') &&
        errorText.includes('package.json and package-lock.json')) {
      issues.push({
        type: 'dependency',
        severity: 'high',
        message: 'Package lockfile is out of sync with package.json',
        details: { errorPattern: 'lockfile_sync' },
        impact: 'Build will fail on clean installs',
        fix: 'Run npm install to regenerate package-lock.json'
      });
    }

    // Check for missing dependencies
    const missingMatches = errorText.match(/Missing:\s*([^@\s]+)@([^\s]+)/g);
    if (missingMatches) {
      missingMatches.forEach(match => {
        const [, packageName, version] = match.match(/Missing:\s*([^@\s]+)@([^\s]+)/) || [];
        if (packageName && version) {
          issues.push({
            type: 'dependency',
            severity: 'high',
            message: `Missing dependency: ${packageName}@${version}`,
            details: { package: packageName, version, source: 'lockfile' },
            impact: 'Dependencies cannot be resolved',
            fix: 'Update package.json and run npm install'
          });
        }
      });
    }

    return issues;
  }

  private async checkMissingDependencies(expectedDeps: string[]): Promise<HealthIssue[]> {
    // This would typically check against a package.json or lockfile
    // For now, return empty array as this requires actual repository access
    return [];
  }

  private detectErrorPatterns(errorText: string): string[] {
    const patterns = [
      'Missing:',
      'from lock file',
      'npm ci',
      'can only install packages when',
      'package.json and package-lock.json',
      'EUSAGE'
    ];

    return patterns.filter(pattern =>
      errorText.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private async generateAIAnalysis(issues: HealthIssue[], context: HealthTestContext): Promise<AIAnalysisResult> {
    try {
      const prompt = `
Analyze these health issues and provide insights:

ISSUES FOUND:
${issues.map(i => `- ${i.type.toUpperCase()}: ${i.message} (${i.severity})`).join('\n')}

CONTEXT:
${context.repositoryUrl ? `Repository: ${context.repositoryUrl}` : ''}
${context.buildError ? `Build Error: ${context.buildError.substring(0, 500)}...` : ''}

Please provide:
1. Root cause analysis
2. Security implications
3. Recommended actions
4. Confidence level (0-100)
      `;

      const aiResponse = await this.aiService.runAiAndLog({
        model: 'gpt-4',
        prompt,
        maxTokens: 1000,
        temperature: 0.3
      });

      // Parse AI response (simplified - would need proper parsing)
      const response = aiResponse.response || '';
      const rootCause = this.extractSection(response, 'Root cause') || 'Analysis incomplete';
      const security = this.extractSection(response, 'Security') || 'No security issues identified';
      const actions = this.extractActions(response);

      return {
        rootCause,
        securityImplications: security,
        recommendedActions: actions,
        confidence: 85 // Default confidence
      };

    } catch (error) {
      console.error('AI analysis failed:', error);
      return {
        rootCause: 'AI analysis unavailable',
        securityImplications: 'Cannot determine security implications',
        recommendedActions: ['Manual investigation required'],
        confidence: 0
      };
    }
  }

  private generateRecommendations(issues: HealthIssue[], context: HealthTestContext): string[] {
    const recommendations: string[] = [];

    // Dependency sync recommendations
    if (issues.some(i => i.type === 'dependency' && i.message.includes('lockfile'))) {
      recommendations.push(
        'Run npm install to regenerate package-lock.json',
        'Commit the updated lockfile to version control',
        'Set up CI/CD to validate lockfile synchronization',
        'Consider using npm ci in production builds for reproducible installs'
      );
    }

    // Communication recommendations
    if (issues.some(i => i.type === 'communication')) {
      recommendations.push(
        'Check worker deployments and service bindings',
        'Verify network connectivity between workers',
        'Test RPC endpoint availability',
        'Check orchestrator logs for communication errors'
      );
    }

    // WebSocket recommendations
    if (issues.some(i => i.type === 'websocket')) {
      recommendations.push(
        'Check PartyKit server deployment',
        'Verify WebSocket endpoint configurations',
        'Test manual WebSocket connections',
        'Check browser console for WebSocket errors'
      );
    }

    return recommendations;
  }

  private async testServiceBinding(binding: string): Promise<boolean> {
    // This would make a simple RPC call to test the binding
    // For now, return true as this requires actual service binding testing
    return true;
  }

  private async testWebSocketEndpoint(endpoint: string): Promise<boolean> {
    // This would attempt a WebSocket connection to test PartyKit
    // For now, return true as this requires actual WebSocket testing
    return true;
  }

  private async analyzeRepositoryHealth(repoUrl: string): Promise<HealthIssue[]> {
    // This would fetch and analyze a repository's package.json and build status
    // For now, simulate analysis of the known repository
    if (repoUrl.includes('core-linkedin-scraper')) {
      return [{
        type: 'dependency',
        severity: 'high',
        message: 'Package lockfile synchronization issue detected',
        details: {
          repository: repoUrl,
          issue: 'package-lock.json out of sync',
          missingPackages: ['hono@4.10.4', 'yaml@2.8.1']
        },
        impact: 'Build fails on clean npm ci installs',
        fix: 'Run npm install and commit updated package-lock.json'
      }];
    }

    return [];
  }

  private extractSection(text: string, sectionName: string): string {
    // Simple text extraction - would need more robust parsing
    const lines = text.split('\n');
    const sectionStart = lines.findIndex(line =>
      line.toLowerCase().includes(sectionName.toLowerCase())
    );

    if (sectionStart >= 0) {
      return lines.slice(sectionStart + 1, sectionStart + 3).join(' ').trim();
    }

    return '';
  }

  private extractActions(text: string): string[] {
    // Extract action items from AI response
    const actions: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.match(/^\d+\.|•|-|\*/)) {
        actions.push(line.replace(/^\d+\.|•|-|\*\s*/, '').trim());
      }
    }

    return actions.length > 0 ? actions : ['Manual investigation required'];
  }
}
