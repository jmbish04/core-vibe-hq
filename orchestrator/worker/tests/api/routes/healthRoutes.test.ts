import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { healthRoutes } from '../../../api/routes/healthRoutes';
import { Health } from '../../../entrypoints/health';
import type { Env } from '../../../types';

// Mock the Health entrypoint
vi.mock('../../../entrypoints/health', () => ({
	Health: vi.fn().mockImplementation(() => ({
		getHealthCheckHistory: vi.fn(),
		getHealthCheckStatus: vi.fn(),
		getConfiguredWorkers: vi.fn(),
		getLatestWorkerTest: vi.fn(),
		initiateHealthCheck: vi.fn(),
	})),
}));

// Mock authentication middleware
vi.mock('../../../middleware/auth/routeAuth', () => ({
	setAuthLevel: vi.fn(() => vi.fn()),
	AuthConfig: {
		authenticated: 'authenticated',
	},
}));

describe('Health Routes', () => {
	let app: Hono;
	let mockHealth: any;
	let mockEnv: Env;

	beforeEach(() => {
		app = new Hono();
		app.route('/api/health', healthRoutes);

		mockHealth = {
			getHealthCheckHistory: vi.fn(),
			getHealthCheckStatus: vi.fn(),
			getConfiguredWorkers: vi.fn(),
			getLatestWorkerTest: vi.fn(),
			initiateHealthCheck: vi.fn(),
		};

		(Health as any).mockImplementation(() => mockHealth);

		mockEnv = {} as Env;
	});

	describe('GET /', () => {
		it('returns health summary successfully', async () => {
			const mockHistory = {
				health_checks: [{
					health_check_uuid: 'test-uuid',
					completed_at: '2025-11-10T10:00:00Z',
					status: 'completed'
				}],
				total_count: 1
			};

			const mockStatus = {
				overall_health_score: 0.95,
				total_workers: 3,
				completed_workers: 3
			};

			mockHealth.getHealthCheckHistory.mockResolvedValue(mockHistory);
			mockHealth.getHealthCheckStatus.mockResolvedValue(mockStatus);

			const res = await app.request('/api/health/', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.ok).toBe(true);
			expect(data.summary.totalChecks).toBe(1);
			expect(data.summary.lastHealthScore).toBe(0.95);
		});

		it('handles errors gracefully', async () => {
			mockHealth.getHealthCheckHistory.mockRejectedValue(new Error('Database error'));

			const res = await app.request('/api/health/', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(res.status).toBe(500);
			const data = await res.json();
			expect(data.ok).toBe(false);
			expect(data.error).toBe('Failed to retrieve health summary');
		});
	});

	describe('GET /workers', () => {
		it('returns configured workers list', async () => {
			const mockWorkers = [
				{ name: 'agent-factory', type: 'factory', url: 'https://agent.example.com', binding: null },
				{ name: 'data-factory', type: 'factory', url: null, binding: 'DATA_FACTORY' }
			];

			mockHealth.getConfiguredWorkers.mockReturnValue(mockWorkers);

			const res = await app.request('/api/health/workers', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.ok).toBe(true);
			expect(data.workers).toHaveLength(2);
			expect(data.count).toBe(2);
		});

		it('handles worker list errors', async () => {
			mockHealth.getConfiguredWorkers.mockImplementation(() => {
				throw new Error('Worker configuration error');
			});

			const res = await app.request('/api/health/workers', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(res.status).toBe(500);
			const data = await res.json();
			expect(data.ok).toBe(false);
			expect(data.error).toBe('Failed to retrieve workers list');
		});
	});

	describe('GET /workers/:workerName/latest', () => {
		it('returns latest worker health check', async () => {
			const mockResult = {
				worker_check_uuid: 'worker-uuid',
				health_score: 0.9,
				overall_status: 'healthy'
			};

			mockHealth.getLatestWorkerTest.mockResolvedValue(mockResult);

			const res = await app.request('/api/health/workers/agent-factory/latest', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.ok).toBe(true);
			expect(data.result.health_score).toBe(0.9);
		});

		it('validates worker name format', async () => {
			const res = await app.request('/api/health/workers/invalid@worker/latest', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(res.status).toBe(400);
			const data = await res.json();
			expect(data.ok).toBe(false);
			expect(data.error).toBe('Invalid worker name format');
		});

		it('returns 404 for worker with no health checks', async () => {
			mockHealth.getLatestWorkerTest.mockResolvedValue(null);

			const res = await app.request('/api/health/workers/agent-factory/latest', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(res.status).toBe(404);
			const data = await res.json();
			expect(data.ok).toBe(false);
			expect(data.error).toBe('No health check recorded for worker');
		});
	});

	describe('POST /checks', () => {
		it('initiates health check successfully', async () => {
			const mockResponse = {
				health_check_uuid: 'new-check-uuid',
				message: 'Health check initiated'
			};

			mockHealth.initiateHealthCheck.mockResolvedValue(mockResponse);

			const res = await app.request('/api/health/checks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					trigger_type: 'on_demand',
					timeout_minutes: 30,
					worker_filters: ['agent-factory']
				})
			});

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.ok).toBe(true);
			expect(data.result.health_check_uuid).toBe('new-check-uuid');
		});

		it('validates trigger_type', async () => {
			const res = await app.request('/api/health/checks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					trigger_type: 'invalid_type'
				})
			});

			expect(res.status).toBe(400);
			const data = await res.json();
			expect(data.ok).toBe(false);
			expect(data.error).toBe('Invalid trigger_type');
		});

		it('validates worker_filters format', async () => {
			const res = await app.request('/api/health/checks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					worker_filters: 'invalid@worker'
				})
			});

			expect(res.status).toBe(400);
			const data = await res.json();
			expect(data.ok).toBe(false);
			expect(data.error).toBe('Invalid worker filter format');
		});

		it('validates timeout_minutes range', async () => {
			const res = await app.request('/api/health/checks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					timeout_minutes: 2000 // Too high
				})
			});

			expect(res.status).toBe(400);
			const data = await res.json();
			expect(data.ok).toBe(false);
			expect(data.error).toBe('Invalid timeout_minutes');
		});

		it('handles JSON parse errors', async () => {
			const res = await app.request('/api/health/checks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: 'invalid json'
			});

			expect(res.status).toBe(500);
			const data = await res.json();
			expect(data.ok).toBe(false);
			expect(data.error).toBe('Failed to initiate health check');
		});
	});

	describe('GET /checks', () => {
		it('returns paginated health checks list', async () => {
			const mockHistory = {
				health_checks: [
					{ health_check_uuid: 'uuid1', status: 'completed' },
					{ health_check_uuid: 'uuid2', status: 'running' }
				],
				total_count: 25
			};

			mockHealth.getHealthCheckHistory.mockResolvedValue(mockHistory);

			const res = await app.request('/api/health/checks?page=2&limit=10', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.ok).toBe(true);
			expect(data.history.health_checks).toHaveLength(2);
			expect(data.pagination.page).toBe(2);
			expect(data.pagination.limit).toBe(10);
			expect(data.pagination.total).toBe(25);
			expect(data.pagination.total_pages).toBe(3);
		});

		it('validates pagination parameters', async () => {
			const res = await app.request('/api/health/checks?page=0&limit=150', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(res.status).toBe(400);
			const data = await res.json();
			expect(data.ok).toBe(false);
			expect(data.error).toBe('Invalid pagination parameters');
		});

		it('validates triggerType filter', async () => {
			const res = await app.request('/api/health/checks?triggerType=invalid', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(res.status).toBe(400);
			const data = await res.json();
			expect(data.ok).toBe(false);
			expect(data.error).toBe('Invalid triggerType filter');
		});
	});

	describe('GET /checks/:healthCheckUuid', () => {
		it('returns health check status', async () => {
			const mockStatus = {
				health_check_uuid: 'test-uuid',
				status: 'completed',
				overall_health_score: 0.95
			};

			mockHealth.getHealthCheckStatus.mockResolvedValue(mockStatus);

			const res = await app.request('/api/health/checks/12345678-1234-1234-1234-123456789012', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.ok).toBe(true);
			expect(data.result.status).toBe('completed');
		});

		it('validates UUID format', async () => {
			const res = await app.request('/api/health/checks/invalid-uuid', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(res.status).toBe(400);
			const data = await res.json();
			expect(data.ok).toBe(false);
			expect(data.error).toBe('Invalid health check UUID format');
		});

		it('returns 404 for non-existent health check', async () => {
			mockHealth.getHealthCheckStatus.mockResolvedValue(null);

			const res = await app.request('/api/health/checks/12345678-1234-1234-1234-123456789012', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(res.status).toBe(404);
			const data = await res.json();
			expect(data.ok).toBe(false);
			expect(data.error).toBe('Health check not found');
		});
	});

	describe('Request Logging', () => {
		it('logs all requests', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

			mockHealth.getConfiguredWorkers.mockReturnValue([]);

			await app.request('/api/health/workers', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('[HEALTH-API] GET')
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('Completed in')
			);

			consoleSpy.mockRestore();
		});

		it('logs errors', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			mockHealth.getConfiguredWorkers.mockImplementation(() => {
				throw new Error('Test error');
			});

			await app.request('/api/health/workers', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('[HEALTH-API]')
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('Failed in')
			);

			consoleSpy.mockRestore();
		});
	});
});
