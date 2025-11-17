import { Hono } from 'hono';
import { z } from 'zod';
import { Specialist } from '../../entrypoints/specialist';
import type { Env } from '../../types';

const LogSchema = z.object({
  specialist: z.string().min(1),
  activity: z.string().min(1),
  identifier: z.string().optional(),
  level: z.enum(['info', 'warn', 'error', 'debug']).optional(),
  orderId: z.string().nullable().optional(),
  taskUuid: z.string().nullable().optional(),
  details: z.record(z.unknown()).optional(),
});

const specialistLogRoutes = new Hono<{ Bindings: Env }>();

specialistLogRoutes.post('/log', async (c) => {
  const json = await c.req.json<unknown>().catch(() => ({}));
  const body = LogSchema.safeParse(json);
  if (!body.success) {
    return c.json({ ok: false, error: 'Invalid payload', issues: body.error.flatten() }, 400);
  }

  const specialist = new Specialist(c.executionCtx, c.env as Env);
  await specialist.logSpecialistActivity(body.data);

  return c.json({ ok: true });
});

specialistLogRoutes.get('/log/:specialist', async (c) => {
  const specialistName = c.req.param('specialist');
  if (!specialistName) {
    return c.json({ ok: false, error: 'Specialist is required' }, 400);
  }

  const identifier = c.req.query('identifier') ?? undefined;
  const limitParam = c.req.query('limit');
  const limit = limitParam ? Math.min(100, Math.max(1, Number(limitParam))) : 25;

  const specialist = new Specialist(c.executionCtx, c.env as Env);
  const logs = await specialist.getSpecialistActivity({ specialist: specialistName, identifier, limit });

  return c.json({ ok: true, logs });
});

export { specialistLogRoutes };
