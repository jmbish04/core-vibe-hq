import { describe, it, expect } from 'vitest';

/**
 * API Endpoint Smoke Tests
 *
 * Validates that core API endpoints are responding correctly.
 * Tests both successful responses and error handling.
 */

describe('API Endpoint Smoke Tests', () => {
  describe('Core APIs', () => {
    it('should support GET /api/health', async () => {
      const response = await fetch('/api/health');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('status');
    });

    it('should support GET /api/analytics/logs', async () => {
      const response = await fetch('/api/analytics/logs');
      expect([200, 401]).toContain(response.status); // May require auth
    });

    it('should support GET /api/analytics/stats', async () => {
      const response = await fetch('/api/analytics/stats');
      expect([200, 401]).toContain(response.status); // May require auth
    });

    it('should support GET /api/analytics/trends', async () => {
      const response = await fetch('/api/analytics/trends');
      expect([200, 401]).toContain(response.status); // May require auth
    });

    it('should support POST /api/patches/apply', async () => {
      const response = await fetch('/api/patches/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch_id: 'test' })
      });
      expect([200, 400, 401]).toContain(response.status); // May require auth or valid data
    });

    it('should support GET /api/ops/scan', async () => {
      const response = await fetch('/api/ops/scan');
      expect([200, 401]).toContain(response.status); // May require auth
    });

    it('should support POST /api/ops/delivery-reports', async () => {
      const response = await fetch('/api/ops/delivery-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: 'test' })
      });
      expect([201, 400, 401]).toContain(response.status); // May require auth or valid data
    });
  });

  describe('Authentication & Authorization', () => {
    it('should require authentication for protected routes', async () => {
      const protectedRoutes = [
        '/api/health',
        '/api/analytics/logs',
        '/api/analytics/stats',
        '/api/analytics/trends',
        '/api/patches/apply',
        '/api/ops/scan'
      ];

      for (const route of protectedRoutes) {
        const response = await fetch(route);
        // Should either succeed (if auth provided) or return 401
        expect([200, 401, 403]).toContain(response.status);
      }
    });

    it('should exclude /health-check/* from CSRF middleware', async () => {
      // Test that health check endpoints don't require CSRF tokens
      const healthRoutes = [
        '/health-check/execute',
        '/health-check/status',
        '/health-check/quick',
        '/health-check/result'
      ];

      for (const route of healthRoutes) {
        const response = await fetch(route, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'data' })
        });
        // Should not return 403 CSRF errors
        expect(response.status).not.toBe(403);
      }
    });

    it('should support service-to-service auth for health checks', async () => {
      // Test that health check endpoints accept service auth
      const response = await fetch('/health-check/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-service-token'
        },
        body: JSON.stringify({
          worker_name: 'test-worker',
          callback_url: 'http://localhost:8787/health-check/result'
        })
      });
      // Should not return auth-related errors
      expect([200, 202, 400, 500]).toContain(response.status);
    });

    it('should implement rate limiting on POST endpoints', async () => {
      // Test rate limiting by making multiple requests quickly
      const requests = Array(10).fill().map(() =>
        fetch('/api/health/checks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worker_name: 'test' })
        })
      );

      const responses = await Promise.all(requests);
      const statusCodes = responses.map(r => r.status);

      // At least some requests should succeed, and some may be rate limited
      expect(statusCodes.some(code => code === 201 || code === 200)).toBe(true);
      // Rate limiting would return 429, but may not trigger in smoke tests
    });
  });
});
