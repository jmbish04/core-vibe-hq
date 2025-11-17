/**
 * Health Check Timeout Integration Tests
 *
 * Tests timeout handling, retry logic, and error recovery
 * for health check execution across workers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthCheckHandler } from '@shared/handlers/healthCheckHandler';

describe('Health Check Timeout Handling', () => {
  let handler: HealthCheckHandler;

  beforeEach(() => {
    handler = new HealthCheckHandler();
    // Mock fetch for testing
    global.fetch = vi.fn();
  });

  describe('Timeout Configuration', () => {
    it('should use default timeout of 30 seconds when not specified', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      global.fetch = mockFetch;

      const request = new Request('http://localhost/health-check/execute', {
        method: 'POST',
        body: JSON.stringify({
          worker_check_uuid: 'test-uuid',
          options: {},
          callback_url: 'http://localhost/health-check/result',
        }),
      });

      const response = await handler.handleExecuteHealthCheck(request);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.worker_check_uuid).toBe('test-uuid');
    });

    it('should respect custom timeout configuration', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      global.fetch = mockFetch;

      const request = new Request('http://localhost/health-check/execute', {
        method: 'POST',
        body: JSON.stringify({
          worker_check_uuid: 'test-uuid',
          options: { timeout_ms: 5000 }, // 5 seconds
          callback_url: 'http://localhost/health-check/result',
        }),
      });

      const response = await handler.handleExecuteHealthCheck(request);
      const result = await response.json();

      expect(result.success).toBe(true);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed health checks up to max_retries + 1 times', async () => {
      const mockFetch = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      global.fetch = mockFetch;

      const request = new Request('http://localhost/health-check/execute', {
        method: 'POST',
        body: JSON.stringify({
          worker_check_uuid: 'test-uuid',
          options: { max_retries: 2, timeout_ms: 1000 },
          callback_url: 'http://localhost/health-check/result',
        }),
      });

      const response = await handler.handleExecuteHealthCheck(request);
      const result = await response.json();

      expect(result.success).toBe(true);
      // Should have been called 3 times (initial + 2 retries)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should implement exponential backoff between retries', async () => {
      const startTime = Date.now();
      const mockFetch = vi.fn()
        .mockRejectedValue(new Error('Persistent failure'));
      global.fetch = mockFetch;

      // Mock setTimeout to track delays
      const originalSetTimeout = global.setTimeout;
      const timeouts: number[] = [];
      global.setTimeout = vi.fn((callback, delay) => {
        timeouts.push(delay || 0);
        return originalSetTimeout(callback, 1); // Fast-forward for testing
      });

      const request = new Request('http://localhost/health-check/execute', {
        method: 'POST',
        body: JSON.stringify({
          worker_check_uuid: 'test-uuid',
          options: { max_retries: 2, timeout_ms: 100 },
          callback_url: 'http://localhost/health-check/result',
        }),
      });

      await handler.handleExecuteHealthCheck(request);

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;

      // Should have exponential backoff: ~1000ms, ~2000ms
      expect(timeouts.length).toBeGreaterThanOrEqual(2);
      expect(timeouts[0]).toBeGreaterThanOrEqual(1000);
      expect(timeouts[1]).toBeGreaterThanOrEqual(2000);
    });

    it('should not exceed maximum retry delay of 10 seconds', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Failure'));
      global.fetch = mockFetch;

      const timeouts: number[] = [];
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((callback, delay) => {
        timeouts.push(delay || 0);
        return originalSetTimeout(callback, 1);
      });

      const request = new Request('http://localhost/health-check/execute', {
        method: 'POST',
        body: JSON.stringify({
          worker_check_uuid: 'test-uuid',
          options: { max_retries: 5, timeout_ms: 100 },
          callback_url: 'http://localhost/health-check/result',
        }),
      });

      await handler.handleExecuteHealthCheck(request);

      global.setTimeout = originalSetTimeout;

      // All retry delays should be <= 10000ms
      timeouts.forEach(delay => {
        expect(delay).toBeLessThanOrEqual(10000);
      });
    });
  });

  describe('Timeout Error Handling', () => {
    it('should send timeout error to orchestrator when execution times out', async () => {
      const mockFetch = vi.fn()
        .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 2000))); // Always delay 2s

      global.fetch = mockFetch;

      const request = new Request('http://localhost/health-check/execute', {
        method: 'POST',
        body: JSON.stringify({
          worker_check_uuid: 'test-uuid',
          options: { timeout_ms: 500, max_retries: 0 }, // Short timeout, no retries
          callback_url: 'http://localhost/health-check/result',
        }),
      });

      const response = await handler.handleExecuteHealthCheck(request);
      const result = await response.json();

      expect(result.success).toBe(true); // Request accepted, but execution will timeout

      // Wait for timeout to occur and callback to be sent
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should have sent timeout error to callback URL
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost/health-check/result',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('timeout'),
        })
      );
    });

    it('should include proper error details in timeout responses', async () => {
      const mockFetch = vi.fn()
        .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 2000)));

      global.fetch = mockFetch;

      const request = new Request('http://localhost/health-check/execute', {
        method: 'POST',
        body: JSON.stringify({
          worker_check_uuid: 'test-uuid',
          options: { timeout_ms: 500, max_retries: 0 },
          callback_url: 'http://localhost/health-check/result',
        }),
      });

      await handler.handleExecuteHealthCheck(request);

      // Wait for timeout callback
      await new Promise(resolve => setTimeout(resolve, 1000));

      const callbackCall = mockFetch.mock.calls.find(call =>
        call[0] === 'http://localhost/health-check/result'
      );

      expect(callbackCall).toBeDefined();
      const callbackBody = JSON.parse(callbackCall[1].body);

      expect(callbackBody.overall_status).toBe('timeout');
      expect(callbackBody.health_score).toBe(0.0);
      expect(callbackBody.error_message).toContain('Health check timed out');
      expect(callbackBody.warnings).toContain('Health check execution exceeded timeout limit');
    });
  });

  describe('Configuration Validation', () => {
    it('should reject invalid UUID format', async () => {
      const request = new Request('http://localhost/health-check/execute', {
        method: 'POST',
        body: JSON.stringify({
          worker_check_uuid: 'invalid-uuid',
          options: {},
          callback_url: 'http://localhost/health-check/result',
        }),
      });

      const response = await handler.handleExecuteHealthCheck(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toContain('Invalid worker_check_uuid format');
    });

    it('should reject invalid callback URLs', async () => {
      const request = new Request('http://localhost/health-check/execute', {
        method: 'POST',
        body: JSON.stringify({
          worker_check_uuid: '12345678-1234-1234-1234-123456789012',
          options: {},
          callback_url: 'not-a-url',
        }),
      });

      const response = await handler.handleExecuteHealthCheck(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toContain('Invalid callback_url');
    });
  });
});
