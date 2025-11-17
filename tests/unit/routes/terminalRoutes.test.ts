import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import type { DurableObjectNamespace } from '@cloudflare/workers-types';
import { setupTerminalRoutes } from '../../../orchestrator/worker/api/routes/terminalRoutes';

const partyserverMiddlewareMock = vi.fn(() => async (_ctx: any, next: any) => {
  await next();
});

const getServerByNameMock = vi.fn();

vi.mock('partykit/hono-party', () => ({
  partyserverMiddleware: partyserverMiddlewareMock,
}));

vi.mock('partykit/partyserver', () => ({
  getServerByName: getServerByNameMock,
}));

describe('terminal routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers middleware and proxies to Durable Object', async () => {
    const app = new Hono();
    setupTerminalRoutes(app as any);

    expect(partyserverMiddlewareMock).toHaveBeenCalledWith({
      options: expect.objectContaining({ prefix: 'parties' }),
    });

    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    getServerByNameMock.mockResolvedValue({ fetch: fetchMock });

    const env = {
      TERMINAL_SERVER: {} as DurableObjectNamespace<any>,
    } as any;

    const res = await app.request('/api/workers/worker-123/terminal', {}, env);

    expect(getServerByNameMock).toHaveBeenCalledWith(env.TERMINAL_SERVER, 'worker-123', {
      props: { workerId: 'worker-123', sandboxId: '' },
    });
    expect(fetchMock).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('returns 400 when workerId missing', async () => {
    const app = new Hono();
    setupTerminalRoutes(app as any);

    const res = await app.request('/api/workers//terminal');
    expect(res.status).toBe(400);
  });
});
