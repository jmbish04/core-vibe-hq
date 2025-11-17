import { Hono } from "hono";
import { Env } from './core-utils';
import { seedAll, isKVSeeded } from '@shared/seed-utils';
import { MOCK_ITEMS } from '@shared/mock-data';
import type { DemoItem, ApiResponse } from '@shared/types';

export function userRoutes(app: Hono<{ Bindings: Env }>) {
    app.get('/api/test', (c) => c.json({ success: true, data: { name: 'CF Workers Demo' }}));

    // Seed endpoints
    app.post('/api/seed', async (c) => {
        const results = await seedAll(c.env);
        return c.json({ success: true, data: results });
    });

    // Simple demo endpoint showcasing KV with mock fallback
    app.get('/api/demo', async (c) => {
        const items = await c.env.KVStore.get('demo_items');
        const data: DemoItem[] = items ? JSON.parse(items) : MOCK_ITEMS;
        return c.json({ success: true, data } satisfies ApiResponse<DemoItem[]>);
    });

    // Counter using Durable Object
    app.get('/api/counter', async (c) => {
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await durableObjectStub.getCounterValue() as number;
        return c.json({ success: true, data } satisfies ApiResponse<number>);
    });
    
    app.post('/api/counter/increment', async (c) => {
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await durableObjectStub.increment() as number;
        return c.json({ success: true, data } satisfies ApiResponse<number>);
    });
}
