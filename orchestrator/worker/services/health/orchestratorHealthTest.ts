/**
 * Orchestrator Health Test - Macro-Level System Testing
 *
 * This module provides comprehensive testing of orchestrator-level functionality:
 * - Inter-worker communication verification
 * - PartyKit WebSocket connectivity
 * - Service binding validation
 * - Build and dependency issue analysis
 * - System-level health monitoring
 */

import { HealthTestingService } from './healthTestingService';

export interface OrchestratorHealthReport {
  timestamp: string;
  testSuite: string;
  overallStatus: 'healthy' | 'degraded' | 'critical';
  testResults: {
    dependencySync: HealthTestResult;
    interWorkerComms: HealthTestResult;
    websocketConnectivity: HealthTestResult;
    buildHealth: HealthTestResult;
  };
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    criticalIssues: number;
    recommendations: string[];
  };
}

export class OrchestratorHealthTest {
  constructor(private healthTestingService: HealthTestingService) {}

  /**
   * Run comprehensive orchestrator health test suite
   */
  async runFullHealthTest(): Promise<OrchestratorHealthReport> {
    console.log('🩺 Starting Orchestrator Macro-Level Health Test Suite');
    console.log('=' * 60);

    const startTime = Date.now();

    // Test 1: Dependency Synchronization (GitHub repo example)
    console.log('📋 Test 1: Dependency Synchronization Analysis');
    const dependencySync = await this.testDependencySynchronization();
    console.log(`✅ Dependency sync test: ${dependencySync.success ? 'PASSED' : 'FAILED'}`);

    // Test 2: Inter-Worker Communication
    console.log('📋 Test 2: Inter-Worker Communication');
    const interWorkerComms = await this.healthTestingService.testInterWorkerCommunication();
    console.log(`✅ Inter-worker comms test: ${interWorkerComms.success ? 'PASSED' : 'FAILED'}`);

    // Test 3: WebSocket Connectivity (PartyKit)
    console.log('📋 Test 3: WebSocket Connectivity (PartyKit)');
    const websocketConnectivity = await this.healthTestingService.testWebSocketConnectivity();
    console.log(`✅ WebSocket connectivity test: ${websocketConnectivity.success ? 'PASSED' : 'FAILED'}`);

    // Test 4: Build Health Analysis
    console.log('📋 Test 4: Build Health Analysis');
    const buildHealth = await this.healthTestingService.testBuildHealth();
    console.log(`✅ Build health test: ${buildHealth.success ? 'PASSED' : 'FAILED'}`);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Generate comprehensive report
    const report = this.generateHealthReport({
      dependencySync,
      interWorkerComms,
      websocketConnectivity,
      buildHealth
    }, duration);

    console.log('\n🎯 ORCHESTRATOR HEALTH TEST RESULTS');
    console.log('=' * 60);
    console.log(`Overall Status: ${report.overallStatus.toUpperCase()}`);
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passedTests}`);
    console.log(`Failed: ${report.summary.failedTests}`);
    console.log(`Critical Issues: ${report.summary.criticalIssues}`);
    console.log(`Test Duration: ${duration}ms`);

    if (report.summary.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      report.summary.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }

    return report;
  }

  /**
   * Test dependency synchronization with real-world example
   */
  private async testDependencySynchronization(): Promise<HealthTestResult> {
    // Use the real GitHub repository example that was failing
    const context: HealthTestContext = {
      repositoryUrl: 'https://github.com/jmbish04/core-linkedin-scraper',
      buildError: `
npm error code EUSAGE
npm error \`npm ci\` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with \`npm install\` before continuing.
npm error Missing: hono@4.10.4 from lock file
npm error Missing: yaml@2.8.1 from lock file
npm error Clean install a project
      `,
      expectedDependencies: ['hono@4.10.4', 'yaml@2.8.1']
    };

    return this.healthTestingService.testDependencySynchronization(context);
  }

  /**
   * Generate comprehensive health report
   */
  private generateHealthReport(
    testResults: {
      dependencySync: HealthTestResult;
      interWorkerComms: HealthTestResult;
      websocketConnectivity: HealthTestResult;
      buildHealth: HealthTestResult;
    },
    duration: number
  ): OrchestratorHealthReport {

    const allTests = Object.values(testResults);
    const totalTests = allTests.length;
    const passedTests = allTests.filter(t => t.success).length;
    const failedTests = totalTests - passedTests;

    // Count critical issues across all tests
    const criticalIssues = allTests.reduce((count, test) => {
      return count + test.issues.filter(issue => issue.severity === 'critical').length;
    }, 0);

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (criticalIssues > 0) {
      overallStatus = 'critical';
    } else if (failedTests > 0) {
      overallStatus = 'degraded';
    }

    // Collect all recommendations
    const recommendations = new Set<string>();
    allTests.forEach(test => {
      test.recommendations.forEach(rec => recommendations.add(rec));
    });

    return {
      timestamp: new Date().toISOString(),
      testSuite: 'orchestrator-macro-health',
      overallStatus,
      testResults,
      summary: {
        totalTests,
        passedTests,
        failedTests,
        criticalIssues,
        recommendations: Array.from(recommendations)
      }
    };
  }

  /**
   * Print detailed issue analysis
   */
  printDetailedAnalysis(report: OrchestratorHealthReport): void {
    console.log('\n🔍 DETAILED ISSUE ANALYSIS');
    console.log('=' * 60);

    const testNames = {
      dependencySync: 'Dependency Synchronization',
      interWorkerComms: 'Inter-Worker Communication',
      websocketConnectivity: 'WebSocket Connectivity',
      buildHealth: 'Build Health'
    };

    Object.entries(report.testResults).forEach(([testKey, result]) => {
      const testName = testNames[testKey as keyof typeof testNames];
      console.log(`\n📋 ${testName}:`);

      if (result.issues.length === 0) {
        console.log('  ✅ No issues detected');
      } else {
        result.issues.forEach((issue, index) => {
          const severityIcon = {
            'low': '🟢',
            'medium': '🟡',
            'high': '🟠',
            'critical': '🔴'
          }[issue.severity];

          console.log(`  ${index + 1}. ${severityIcon} ${issue.type.toUpperCase()}: ${issue.message}`);
          console.log(`     Impact: ${issue.impact}`);
          if (issue.fix) {
            console.log(`     Fix: ${issue.fix}`);
          }
        });
      }

      // Show metrics if available
      if (result.metrics && Object.keys(result.metrics).length > 0) {
        console.log('  📊 Metrics:');
        Object.entries(result.metrics).forEach(([key, value]) => {
          console.log(`     ${key}: ${value}`);
        });
      }

      // Show AI insights if available
      if (result.aiAnalysis) {
        console.log('  🤖 AI Insights:');
        console.log(`     Root Cause: ${result.aiAnalysis.rootCause}`);
        console.log(`     Security: ${result.aiAnalysis.securityImplications}`);
        console.log(`     Confidence: ${result.aiAnalysis.confidence}%`);
        if (result.aiAnalysis.recommendedActions.length > 0) {
          console.log('     Actions:');
          result.aiAnalysis.recommendedActions.forEach(action => {
            console.log(`       • ${action}`);
          });
        }
      }
    });
  }

  /**
   * Export report to JSON for external analysis
   */
  exportReport(report: OrchestratorHealthReport): string {
    return JSON.stringify(report, null, 2);
  }
}
