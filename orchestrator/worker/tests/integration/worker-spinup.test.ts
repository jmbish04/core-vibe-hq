import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { healthRoutes } from '../../api/routes/healthRoutes';
import { Health } from '../../entrypoints/health';

// Mock the Health entrypoint
vi.mock('../../entrypoints/health', () => ({
	Health: vi.fn().mockImplementation(() => ({
		getConfiguredWorkers: vi.fn(),
		getLatestWorkerTest: vi.fn(),
		initiateHealthCheck: vi.fn(),
		getHealthCheckHistory: vi.fn(),
		getHealthCheckStatus: vi.fn(),
	})),
}));

// Mock authentication middleware
vi.mock('../../middleware/auth/routeAuth', () => ({
	setAuthLevel: vi.fn(() => vi.fn()),
	AuthConfig: {
		authenticated: 'authenticated',
	},
}));

describe('Worker Spin-up Integration Tests', () => {
	let app: Hono;
	let mockHealth: any;
	let mockEnv: any;

	beforeEach(() => {
		app = new Hono();
		app.route('/api/health', healthRoutes);

		mockHealth = {
			getConfiguredWorkers: vi.fn(),
			getLatestWorkerTest: vi.fn(),
			initiateHealthCheck: vi.fn(),
			getHealthCheckHistory: vi.fn(),
			getHealthCheckStatus: vi.fn(),
		};

		(Health as any).mockImplementation(() => mockHealth);

		mockEnv = {
			WORKER_NAME: 'test-factory',
			WORKER_TYPE: 'factory',
			HEALTH_WORKER_TARGETS: JSON.stringify({
				'test-factory': 'https://test-factory.workers.dev'
			})
		};
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('Worker Registration Process', () => {
		it('should register new worker in health system', async () => {
			// Simulate worker registration by adding to configured workers
			mockHealth.getConfiguredWorkers.mockReturnValue([
				{
					name: 'test-factory',
					type: 'factory',
					url: 'https://test-factory.workers.dev',
					binding: null
				}
			]);

			const res = await app.request('/api/health/workers', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.ok).toBe(true);
			expect(data.workers).toHaveLength(1);
			expect(data.workers[0].name).toBe('test-factory');
			expect(data.workers[0].type).toBe('factory');
		});

		it('should include worker count in response', async () => {
			mockHealth.getConfiguredWorkers.mockReturnValue([
				{ name: 'worker1', type: 'factory' },
				{ name: 'worker2', type: 'specialist' },
				{ name: 'worker3', type: 'factory' }
			]);

			const res = await app.request('/api/health/workers', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.count).toBe(3);
			expect(data.workers).toHaveLength(3);
		});
	});

	describe('Health Check Execution Flow', () => {
		it('should initiate health check for new worker', async () => {
			const mockResponse = {
				health_check_uuid: 'test-uuid-123',
				message: 'Health check initiated',
				total_workers: 1,
				timeout_minutes: 5
			};

			mockHealth.initiateHealthCheck.mockResolvedValue(mockResponse);

			const res = await app.request('/api/health/checks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					trigger_type: 'on_demand',
					worker_filters: ['test-factory'],
					timeout_minutes: 5
				})
			});

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.ok).toBe(true);
			expect(data.result.health_check_uuid).toBe('test-uuid-123');
			expect(data.result.total_workers).toBe(1);
		});

		it('should handle health check completion and result retrieval', async () => {
			// Mock completed health check
			const mockHistory = {
				health_checks: [{
					health_check_uuid: 'completed-uuid',
					status: 'completed',
					completed_at: '2025-11-10T11:00:00Z'
				}],
				total_count: 1
			};

			const mockStatus = {
				health_check_uuid: 'completed-uuid',
				status: 'completed',
				overall_health_score: 0.95,
				total_workers: 1,
				completed_workers: 1,
				passed_workers: 1,
				failed_workers: 0,
				worker_results: [{
					worker_name: 'test-factory',
					overall_status: 'healthy',
					health_score: 0.95
				}]
			};

			mockHealth.getHealthCheckHistory.mockResolvedValue(mockHistory);
			mockHealth.getHealthCheckStatus.mockResolvedValue(mockStatus);

			// Check that health check appears in history
			const historyRes = await app.request('/api/health/checks?page=1&limit=10', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(historyRes.status).toBe(200);
			const historyData = await historyRes.json();
			expect(historyData.ok).toBe(true);
			expect(historyData.history.health_checks).toHaveLength(1);

			// Check detailed results
			const statusRes = await app.request('/api/health/checks/completed-uuid', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(statusRes.status).toBe(200);
			const statusData = await statusRes.json();
			expect(statusData.ok).toBe(true);
			expect(statusData.result.status).toBe('completed');
			expect(statusData.result.worker_results[0].worker_name).toBe('test-factory');
		});

		it('should validate health check parameters', async () => {
			// Test invalid timeout_minutes
			const res1 = await app.request('/api/health/checks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					timeout_minutes: 2000 // Too high
				})
			});

			expect(res1.status).toBe(400);
			const data1 = await res1.json();
			expect(data1.error).toBe('Invalid timeout_minutes');

			// Test invalid worker_filters
			const res2 = await app.request('/api/health/checks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					worker_filters: 'invalid@worker'
				})
			});

			expect(res2.status).toBe(400);
			const data2 = await res2.json();
			expect(data2.error).toBe('Invalid worker filter format');
		});
	});

	describe('Result Submission and Storage', () => {
		it('should store and retrieve worker health results', async () => {
			const mockWorkerResult = {
				worker_check_uuid: 'worker-result-uuid',
				worker_name: 'test-factory',
				overall_status: 'healthy',
				health_score: 0.92,
				uptime_seconds: 3600,
				response_time_ms: 150,
				unit_tests_passed: 25,
				unit_tests_total: 25,
				created_at: '2025-11-10T11:00:00Z'
			};

			mockHealth.getLatestWorkerTest.mockResolvedValue(mockWorkerResult);

			const res = await app.request('/api/health/workers/test-factory/latest', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.ok).toBe(true);
			expect(data.result.worker_name).toBe('test-factory');
			expect(data.result.overall_status).toBe('healthy');
			expect(data.result.health_score).toBe(0.92);
		});

		it('should handle worker with no health check history', async () => {
			mockHealth.getLatestWorkerTest.mockResolvedValue(null);

			const res = await app.request('/api/health/workers/test-factory/latest', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(res.status).toBe(404);
			const data = await res.json();
			expect(data.ok).toBe(false);
			expect(data.error).toBe('No health check recorded for worker');
		});

		it('should validate worker name parameters', async () => {
			const res = await app.request('/api/health/workers/invalid@worker/latest', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(res.status).toBe(400);
			const data = await res.json();
			expect(data.ok).toBe(false);
			expect(data.error).toBe('Invalid worker name format');
		});
	});

	describe('Error Handling and Recovery', () => {
		it('should handle health check execution failures gracefully', async () => {
			mockHealth.initiateHealthCheck.mockRejectedValue(new Error('Database connection failed'));

			const res = await app.request('/api/health/checks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					worker_filters: ['test-factory']
				})
			});

			expect(res.status).toBe(500);
			const data = await res.json();
			expect(data.ok).toBe(false);
			expect(data.error).toBe('Failed to initiate health check');
		});

		it('should handle malformed JSON requests', async () => {
			const res = await app.request('/api/health/checks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: 'invalid json {'
			});

			expect(res.status).toBe(500);
			const data = await res.json();
			expect(data.ok).toBe(false);
			expect(data.error).toBe('Failed to initiate health check');
		});

		it('should handle database errors during worker queries', async () => {
			mockHealth.getConfiguredWorkers.mockImplementation(() => {
				throw new Error('Database query failed');
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

	describe('Integration with Mission Control', () => {
		it('should provide data in format expected by Mission Control UI', async () => {
			// Mock comprehensive health data
			mockHealth.getHealthCheckHistory.mockResolvedValue({
				health_checks: [{
					health_check_uuid: 'ui-test-uuid',
					status: 'completed',
					overall_health_score: 0.88,
					started_at: '2025-11-10T10:00:00Z',
					completed_at: '2025-11-10T10:05:00Z'
				}],
				total_count: 1
			});

			const mockStatus = {
				health_check_uuid: 'ui-test-uuid',
				status: 'completed',
				overall_health_score: 0.88,
				total_workers: 2,
				completed_workers: 2,
				passed_workers: 1,
				failed_workers: 1,
				ai_analysis: 'System performance is good with minor issues detected.',
				ai_recommendations: 'Review failed worker logs for optimization opportunities.',
				worker_results: [
					{
						worker_name: 'test-factory',
						overall_status: 'healthy',
						health_score: 0.95,
						uptime_seconds: 7200,
						response_time_ms: 120
					},
					{
						worker_name: 'data-factory',
						overall_status: 'degraded',
						health_score: 0.75,
						uptime_seconds: 3600,
						response_time_ms: 450
					}
				]
			};

			mockHealth.getHealthCheckStatus.mockResolvedValue(mockStatus);

			// Test summary endpoint
			const summaryRes = await app.request('/api/health/', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(summaryRes.status).toBe(200);
			const summaryData = await summaryRes.json();
			expect(summaryData.ok).toBe(true);
			expect(summaryData.summary.lastHealthScore).toBe(0.88);
			expect(summaryData.latest.overall_health_score).toBe(0.88);
			expect(summaryData.latest.worker_results).toHaveLength(2);

			// Test detailed status endpoint
			const detailRes = await app.request('/api/health/checks/ui-test-uuid', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			expect(detailRes.status).toBe(200);
			const detailData = await detailRes.json();
			expect(detailData.ok).toBe(true);
			expect(detailData.result.ai_analysis).toBeDefined();
			expect(detailData.result.worker_results[0].worker_name).toBe('test-factory');
			expect(detailData.result.worker_results[1].worker_name).toBe('data-factory');
		});
	});
});
