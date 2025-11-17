import { Hono } from 'hono';
import { z } from 'zod';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';

import { AppEnv } from '../../types/appenv';
import type { Env } from '../../types';
import type { DB } from '../../db/schema';
import {
  DeliveryReportService,
  DeliveryReportListResult,
  DeliveryReportPayload,
} from '../../services/ops/deliveryReportService';

const ListQuerySchema = z.object({
  patchId: z.string().optional(),
  destination: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const CreateReportSchema = z.object({
  patchId: z.string().min(1, 'patchId is required'),
  destination: z.string().min(1, 'destination is required'),
  status: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Register delivery report routes under /api/delivery-reports
 */
export function setupDeliveryReportRoutes(app: Hono<AppEnv>): void {
  const router = new Hono<AppEnv>();

  router.get('/', async (c) => {
    try {
      const query = ListQuerySchema.parse({
        patchId: c.req.query('patchId') ?? c.req.query('patch_id'),
        destination: c.req.query('destination'),
        status: c.req.query('status'),
        limit: c.req.query('limit'),
        offset: c.req.query('offset'),
        order: c.req.query('order'),
      });

      const result = await withService(c.env, async (service) =>
        service.listReports({
          patchId: query.patchId,
          destination: query.destination,
          status: query.status,
          limit: query.limit,
          offset: query.offset,
          sortOrder: query.order,
        }),
      );

      return c.json(toListResponse(result));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: 'Invalid query parameters', details: error.flatten() }, 400);
      }

      console.error('Failed to list delivery reports', error);
      return c.json({ error: 'Failed to list delivery reports' }, 500);
    }
  });

  router.get('/:id', async (c) => {
    const id = Number.parseInt(c.req.param('id'), 10);
    if (Number.isNaN(id)) {
      return c.json({ error: 'Invalid delivery report id' }, 400);
    }

    try {
      const report = await withService(c.env, (service) => service.getReportById(id));
      if (!report) {
        return c.json({ error: 'Delivery report not found' }, 404);
      }

      return c.json({ data: report });
    } catch (error) {
      console.error('Failed to load delivery report', error);
      return c.json({ error: 'Failed to load delivery report' }, 500);
    }
  });

  router.post('/', async (c) => {
    try {
      const body = CreateReportSchema.parse(await c.req.json<DeliveryReportPayload>());

      const report = await withService(c.env, (service) =>
        service.triggerReportGeneration({
          patchId: body.patchId,
          destination: body.destination,
          status: body.status,
          metadata: body.metadata,
        }),
      );
      return c.json({ data: report }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: 'Invalid payload', details: error.flatten() }, 400);
      }

      console.error('Failed to create delivery report', error);
      return c.json({ error: 'Failed to create delivery report' }, 500);
    }
  });

  router.post('/:id/retry', async (c) => {
    const id = Number.parseInt(c.req.param('id'), 10);
    if (Number.isNaN(id)) {
      return c.json({ error: 'Invalid delivery report id' }, 400);
    }

    try {
      const report = await withService(c.env, (service) => service.markReportRetry(id));
      return c.json({ data: report, message: 'Retry initiated' });
    } catch (error) {
      if (error instanceof Error && error.message === 'Delivery report not found') {
        return c.json({ error: 'Delivery report not found' }, 404);
      }

      console.error('Failed to mark delivery report for retry', error);
      return c.json({ error: 'Failed to retry delivery report' }, 500);
    }
  });

  app.route('/api/delivery-reports', router);
}

async function withService<T>(env: Env, handler: (service: DeliveryReportService) => Promise<T>): Promise<T> {
  const db = new Kysely<DB>({ dialect: new D1Dialect({ database: env.DB_OPS }) });
  const service = new DeliveryReportService(db);

  try {
    return await handler(service);
  } finally {
    await db.destroy();
  }
}

function toListResponse(result: DeliveryReportListResult) {
  return {
    data: result.reports,
    pagination: {
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.offset + result.limit < result.total,
    },
  };
}
