import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { AiService } from '../services/aiService';
import { OrchestratorHealthClient } from '../services/healthDatabaseClient';

export interface HealthEnv {
  AI: any;
  ORCHESTRATOR_HEALTH: any;
}

export function createHealthApi(aiService: AiService, dbClient: OrchestratorHealthClient) {
  const app = new Hono<{ Bindings: HealthEnv }>();

  // Middleware
  app.use('*', cors());
  app.use('*', logger());

  // GET /api/health/status - Current health status
  app.get('/status', async (c) => {
    try {
      const latest = await dbClient.getLatestHealthSummary();

      if (!latest) {
        return c.json({
          status: 'unknown',
          message: 'No health data available yet',
          timestamp: new Date().toISOString()
        });
      }

      const status = {
        status: latest.overallStatus,
        tests: {
          total: latest.totalTests || 0,
          passed: latest.passedTests || 0,
          failed: latest.failedTests || 0,
          skipped: latest.skippedTests || 0
        },
        performance: {
          averageLatency: latest.averageLatency || 0
        },
        ai: {
          totalCost: latest.totalCost || 0,
          usageCount: latest.aiUsageCount || 0
        },
        issues: JSON.parse(latest.issues || '[]'),
        recommendations: JSON.parse(latest.recommendations || '[]'),
        timestamp: latest.createdAt
      };

      return c.json(status);
    } catch (error) {
      console.error('Health status API error:', error);
      return c.json({ error: 'Failed to retrieve health status' }, 500);
    }
  });

  // GET /api/health/results - Test results with pagination
  app.get('/results', async (c) => {
    try {
      const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
      const offset = parseInt(c.req.query('offset') || '0');
      const status = c.req.query('status'); // Optional filter
      const category = c.req.query('category'); // Optional filter

      let results;

      if (status || category) {
        // Get all results and filter
        const allResults = await dbService.getTestResults(1000, 0);
        results = allResults.filter(result => {
          if (status && result.status !== status) return false;
          // Note: category filtering would need a join with test_profiles
          // For now, return all and let client filter
          return true;
        });
      } else {
        results = await dbClient.getTestResults(limit, offset);
      }

      // Get full results with profile information
      const fullResults = await dbClient.getTestResultsWithProfiles(limit);

      return c.json({
        results: fullResults,
        pagination: {
          limit,
          offset,
          hasMore: fullResults.length === limit
        }
      });
    } catch (error) {
      console.error('Health results API error:', error);
      return c.json({ error: 'Failed to retrieve health results' }, 500);
    }
  });

  // POST /api/health/run - Trigger manual test run
  app.post('/run', async (c) => {
    try {
      // In a real implementation, this would trigger the HealthSpecialist
      // For now, return a mock response
      const runId = `manual-${Date.now()}`;

      return c.json({
        runId,
        status: 'started',
        message: 'Manual health check initiated',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Health run API error:', error);
      return c.json({ error: 'Failed to start health check' }, 500);
    }
  });

  // GET /api/health/dashboard - Dashboard data
  app.get('/dashboard', async (c) => {
    try {
      const dashboardData = await dbClient.getHealthDashboardData();

      return c.json(dashboardData);
    } catch (error) {
      console.error('Health dashboard API error:', error);
      return c.json({ error: 'Failed to retrieve dashboard data' }, 500);
    }
  });

  // GET /api/health/trends - Performance trends
  app.get('/trends', async (c) => {
    try {
      const days = Math.min(parseInt(c.req.query('days') || '7'), 30);
      const summaries = await dbService.getHealthSummaries(days);

      const trends = {
        dates: summaries.map(s => s.date),
        status: summaries.map(s => s.overallStatus),
        testResults: summaries.map(s => ({
          passed: s.passedTests || 0,
          failed: s.failedTests || 0,
          total: s.totalTests || 0
        })),
        performance: summaries.map(s => ({
          avgLatency: s.averageLatency || 0,
          aiCost: s.totalCost || 0
        }))
      };

      return c.json(trends);
    } catch (error) {
      console.error('Health trends API error:', error);
      return c.json({ error: 'Failed to retrieve trends data' }, 500);
    }
  });

  // GET /api/health/ai-insights - AI-powered insights
  app.get('/ai-insights', async (c) => {
    try {
      const recentResults = await dbService.getTestResults(20, 0);
      const failedTests = recentResults.filter(r => r.status === 'failed');

      if (failedTests.length === 0) {
        return c.json({
          insights: 'All recent tests are passing. System health is good.',
          recommendations: []
        });
      }

      // Use AI to generate insights
      const insights = await aiService.generateTestRecommendations(
        failedTests,
        {
          totalTests: recentResults.length,
          failedTests: failedTests.length,
          timeRange: 'last 24 hours'
        }
      );

      return c.json({
        insights: insights.reasoning,
        recommendations: insights.suggestions || [],
        confidence: insights.confidence
      });
    } catch (error) {
      console.error('AI insights API error:', error);
      return c.json({
        error: 'Failed to generate AI insights',
        fallback: 'Unable to analyze recent test failures with AI'
      }, 500);
    }
  });

  // GET /api/health/metrics - Raw metrics data
  app.get('/metrics', async (c) => {
    try {
      const timeRange = c.req.query('range') || '24h';

      // Get health summaries for trends
      const summaries = await dbClient.getHealthSummaries(30);

      const metrics = {
        timeRange,
        summary: {
          totalTests: summaries.length,
          passedTests: summaries.reduce((sum, s) => sum + (s.passedTests || 0), 0),
          failedTests: summaries.reduce((sum, s) => sum + (s.failedTests || 0), 0),
          avgDuration: summaries.length > 0
            ? summaries.reduce((sum, s) => sum + (s.averageLatency || 0), 0) / summaries.length
            : 0
        },
        byStatus: summaries.reduce((acc, summary) => {
          acc.passed = (acc.passed || 0) + (summary.passedTests || 0);
          acc.failed = (acc.failed || 0) + (summary.failedTests || 0);
          acc.skipped = (acc.skipped || 0) + (summary.skippedTests || 0);
          return acc;
        }, {} as Record<string, number>),
        timeline: summaries
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map(s => ({
            date: s.date,
            status: s.overallStatus,
            totalTests: s.totalTests || 0,
            passedTests: s.passedTests || 0,
            failedTests: s.failedTests || 0,
            avgLatency: s.averageLatency || 0
          }))
      };

      return c.json(metrics);
    } catch (error) {
      console.error('Health metrics API error:', error);
      return c.json({ error: 'Failed to retrieve metrics data' }, 500);
    }
  });

  // POST /api/health/cleanup - Clean up old data
  app.post('/cleanup', async (c) => {
    try {
      // Require admin authentication (not implemented yet)
      const daysToKeep = parseInt(c.req.query('days') || '90');

      if (daysToKeep < 30) {
        return c.json({ error: 'Cannot keep less than 30 days of data' }, 400);
      }

      const result = await dbClient.cleanupOldData(daysToKeep);

      return c.json({
        message: `Cleaned up old health data`,
        deletedResults: result.deletedResults,
        deletedLogs: result.deletedLogs,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Health cleanup API error:', error);
      return c.json({ error: 'Failed to cleanup health data' }, 500);
    }
  });

  return app;
}
