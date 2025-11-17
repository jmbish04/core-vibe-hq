import { Hono } from 'hono';
import { AppEnv } from '../../types/appenv';
import { AuthConfig, setAuthLevel } from '../../middleware/auth/routeAuth';
import { Health } from '../../entrypoints/health';
import type { Env } from '../../types';

type JsonRecord = Record<string, unknown>;

// Input validation helpers
const validatePaginationParams = (page: number, limit: number) => {
  if (!Number.isFinite(page) || page < 1) {
    throw new Error('Page must be a positive integer');
  }
  if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
    throw new Error('Limit must be between 1 and 100');
  }
};

const validateUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const validateWorkerName = (name: string): boolean => {
  // Worker names should be alphanumeric with hyphens/underscores, 1-50 chars
  const nameRegex = /^[a-zA-Z0-9_-]{1,50}$/;
  return nameRegex.test(name);
};

const healthRoutes = new Hono<AppEnv>();

// Request logging middleware for health routes
healthRoutes.use('*', async (c, next) => {
	const startTime = Date.now();
	const method = c.req.method;
	const path = c.req.url;

	console.log(`[HEALTH-API] ${method} ${path} - Start`);

	try {
		await next();
		const duration = Date.now() - startTime;
		console.log(`[HEALTH-API] ${method} ${path} - Completed in ${duration}ms`);
	} catch (error) {
		const duration = Date.now() - startTime;
		console.error(`[HEALTH-API] ${method} ${path} - Failed in ${duration}ms:`, error);
		throw error;
	}
});

healthRoutes.get(
	'/',
	setAuthLevel(AuthConfig.authenticated),
	async (c) => {
		try {
			const health = new Health(c.executionCtx, c.env as Env);

			const history = await health.getHealthCheckHistory(1, 1);
			const latestCheck = history.health_checks[0];
			const latestStatus = latestCheck
				? await health.getHealthCheckStatus(latestCheck.health_check_uuid)
				: null;

			return c.json({
				ok: true,
				summary: {
					totalChecks: history.total_count,
					lastCompletedAt: latestCheck?.completed_at ?? null,
					lastStatus: latestCheck?.status ?? null,
					lastHealthScore: latestStatus?.overall_health_score ?? null,
				},
				latest: latestStatus,
			});
		} catch (error: any) {
			console.error('Health summary error:', error);
			return c.json({
				ok: false,
				error: 'Failed to retrieve health summary',
				details: error.message
			}, 500);
		}
	},
);

healthRoutes.get(
	'/workers',
	setAuthLevel(AuthConfig.authenticated),
	async (c) => {
		try {
			const health = new Health(c.executionCtx, c.env as Env);
			const workers = health.getConfiguredWorkers().map((worker) => ({
				name: worker.name,
				type: worker.type,
				url: worker.url ?? null,
				binding: worker.binding ?? null,
			}));

			return c.json({
				ok: true,
				workers,
				count: workers.length,
			});
		} catch (error: any) {
			console.error('Health workers list error:', error);
			return c.json({
				ok: false,
				error: 'Failed to retrieve workers list',
				details: error.message
			}, 500);
		}
	},
);

healthRoutes.get(
	'/workers/:workerName/latest',
	setAuthLevel(AuthConfig.authenticated),
	async (c) => {
		try {
			const workerName = c.req.param('workerName');

			// Validate worker name format
			if (!validateWorkerName(workerName)) {
				return c.json({
					ok: false,
					error: 'Invalid worker name format',
					details: 'Worker name must be 1-50 alphanumeric characters with hyphens/underscores'
				}, 400);
			}

			const health = new Health(c.executionCtx, c.env as Env);
			const latest = await health.getLatestWorkerTest(workerName);

			if (!latest) {
				return c.json({
					ok: false,
					error: 'No health check recorded for worker',
					worker: workerName
				}, 404);
			}

			return c.json({ ok: true, result: latest });
		} catch (error: any) {
			console.error(`Health worker latest error for ${c.req.param('workerName')}:`, error);
			return c.json({
				ok: false,
				error: 'Failed to retrieve latest worker health check',
				details: error.message
			}, 500);
		}
	},
);

healthRoutes.post(
	'/checks',
	setAuthLevel(AuthConfig.authenticated),
	async (c) => {
		try {
			const body = (await c.req.json().catch(() => ({}))) as JsonRecord;

			// Validate trigger_type
			const validTriggerTypes = ['on_demand', 'cron'];
			const triggerType = typeof body.trigger_type === 'string' ? body.trigger_type.trim() : '';
			if (triggerType && !validTriggerTypes.includes(triggerType)) {
				return c.json({
					ok: false,
					error: 'Invalid trigger_type',
					details: `Must be one of: ${validTriggerTypes.join(', ')}`
				}, 400);
			}

			// Validate and process worker_filters
			let workerFilters: string[] | undefined;
			if (body.worker_filters !== undefined) {
				if (Array.isArray(body.worker_filters)) {
					const filters = body.worker_filters
						.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
						.map(f => f.trim());

					// Validate each worker name format
					const invalidFilters = filters.filter(f => !validateWorkerName(f));
					if (invalidFilters.length > 0) {
						return c.json({
							ok: false,
							error: 'Invalid worker filter format',
							details: `Invalid worker names: ${invalidFilters.join(', ')}`
						}, 400);
					}

					workerFilters = filters.length > 0 ? filters : undefined;
				} else if (typeof body.worker_filters === 'string') {
					const filter = body.worker_filters.trim();
					if (filter.length > 0) {
						if (!validateWorkerName(filter)) {
							return c.json({
								ok: false,
								error: 'Invalid worker filter format',
								details: 'Worker name must be 1-50 alphanumeric characters with hyphens/underscores'
							}, 400);
						}
						workerFilters = [filter];
					}
				} else {
					return c.json({
						ok: false,
						error: 'Invalid worker_filters format',
						details: 'Must be a string or array of strings'
					}, 400);
				}
			}

			// Validate timeout_minutes
			let timeoutMinutes: number | undefined;
			if (body.timeout_minutes !== undefined) {
				const timeoutRaw = typeof body.timeout_minutes === 'number'
					? body.timeout_minutes
					: Number(body.timeout_minutes);

				if (!Number.isFinite(timeoutRaw) || timeoutRaw <= 0 || timeoutRaw > 1440) { // Max 24 hours
					return c.json({
						ok: false,
						error: 'Invalid timeout_minutes',
						details: 'Must be a number between 1 and 1440 (minutes)'
					}, 400);
				}
				timeoutMinutes = timeoutRaw;
			}

			// Determine trigger source
			const triggerSource =
				(typeof body.trigger_source === 'string' && body.trigger_source.trim().length > 0 && body.trigger_source.trim()) ||
				c.get('user')?.email ||
				c.get('user')?.id ||
				'manual';

			const health = new Health(c.executionCtx, c.env as Env);
			const response = await health.initiateHealthCheck({
				trigger_type: triggerType || 'on_demand',
				trigger_source: triggerSource,
				timeout_minutes: timeoutMinutes,
				include_unit_tests: body.include_unit_tests !== undefined ? Boolean(body.include_unit_tests) : undefined,
				include_performance_tests: body.include_performance_tests !== undefined ? Boolean(body.include_performance_tests) : undefined,
				include_integration_tests: body.include_integration_tests !== undefined ? Boolean(body.include_integration_tests) : undefined,
				worker_filters: workerFilters,
			});

			return c.json({ ok: true, result: response });
		} catch (error: any) {
			console.error('Health check initiation error:', error);
			return c.json({
				ok: false,
				error: 'Failed to initiate health check',
				details: error.message
			}, 500);
		}
	},
);

healthRoutes.get(
	'/checks',
	setAuthLevel(AuthConfig.authenticated),
	async (c) => {
		try {
			// Parse and validate pagination parameters
			const pageRaw = Number.parseInt(c.req.query('page') ?? '1', 10);
			const limitRaw = Number.parseInt(c.req.query('limit') ?? '20', 10);

			try {
				validatePaginationParams(pageRaw, limitRaw);
			} catch (error: any) {
				return c.json({
					ok: false,
					error: 'Invalid pagination parameters',
					details: error.message
				}, 400);
			}

			const page = pageRaw;
			const limit = Math.min(limitRaw, 100); // Hard limit at 100

			// Validate triggerType filter
			const triggerType = c.req.query('triggerType');
			const validTriggerTypes = ['on_demand', 'cron'];
			if (triggerType && !validTriggerTypes.includes(triggerType)) {
				return c.json({
					ok: false,
					error: 'Invalid triggerType filter',
					details: `Must be one of: ${validTriggerTypes.join(', ')} or undefined`
				}, 400);
			}

			const health = new Health(c.executionCtx, c.env as Env);
			const history = await health.getHealthCheckHistory(page, limit, triggerType);

			return c.json({
				ok: true,
				history,
				pagination: {
					page,
					limit,
					total: history.total_count,
					total_pages: Math.ceil(history.total_count / limit)
				}
			});
		} catch (error: any) {
			console.error('Health checks list error:', error);
			return c.json({
				ok: false,
				error: 'Failed to retrieve health checks list',
				details: error.message
			}, 500);
		}
	},
);

healthRoutes.get(
	'/checks/:healthCheckUuid',
	setAuthLevel(AuthConfig.authenticated),
	async (c) => {
		try {
			const uuid = c.req.param('healthCheckUuid');

			// Validate UUID format
			if (!validateUUID(uuid)) {
				return c.json({
					ok: false,
					error: 'Invalid health check UUID format',
					details: 'Must be a valid UUID'
				}, 400);
			}

			const health = new Health(c.executionCtx, c.env as Env);
			const status = await health.getHealthCheckStatus(uuid);

			if (!status) {
				return c.json({
					ok: false,
					error: 'Health check not found',
					uuid: uuid
				}, 404);
			}

			return c.json({ ok: true, result: status });
		} catch (error: any) {
			console.error(`Health check status error for ${c.req.param('healthCheckUuid')}:`, error);
			return c.json({
				ok: false,
				error: 'Failed to retrieve health check status',
				details: error.message
			}, 500);
		}
	},
);

export { healthRoutes };
