import { Hono } from "hono";
import { getAgentByName } from 'agents';
import { ChatAgent } from './agent';
import { API_RESPONSES } from './config';
import { Env, getAppController, registerSession, unregisterSession } from "./core-utils";

/**
 * DO NOT MODIFY THIS FUNCTION. Only for your reference.
 */
export function coreRoutes(app: Hono<{ Bindings: Env }>) {
    // Use this API for conversations. **DO NOT MODIFY**
    app.all('/api/chat/:sessionId/*', async (c) => {
        try {
        const sessionId = c.req.param('sessionId');
        const agent = await getAgentByName<Env, ChatAgent>(c.env.CHAT_AGENT, sessionId); // Get existing agent or create a new one if it doesn't exist, with sessionId as the name
        const url = new URL(c.req.url);
        url.pathname = url.pathname.replace(`/api/chat/${sessionId}`, '');
        return agent.fetch(new Request(url.toString(), {
            method: c.req.method,
            headers: c.req.header(),
            body: c.req.method === 'GET' || c.req.method === 'DELETE' ? undefined : c.req.raw.body
        }));
    
        } catch (error) {
        console.error('Agent routing error:', error);
        return c.json({ 
            success: false, 
            error: API_RESPONSES.AGENT_ROUTING_FAILED 
        }, { status: 500 });
        }
    });
}

export function userRoutes(app: Hono<{ Bindings: Env }>) {
    // Add your routes here
    /**
     * List all chat sessions
     * GET /api/sessions
     */
    app.get('/api/sessions', async (c) => {
        try {
            const controller = getAppController(c.env);
            const sessions = await controller.listSessions();
            return c.json({ success: true, data: sessions });
        } catch (error) {
            console.error('Failed to list sessions:', error);
            return c.json({ 
                success: false, 
                error: 'Failed to retrieve sessions' 
            }, { status: 500 });
        }
    });

    /**
     * Create a new chat session
     * POST /api/sessions
     * Body: { title?: string, sessionId?: string }
     */
    app.post('/api/sessions', async (c) => {
        try {
            const body = await c.req.json().catch(() => ({}));
            const { title, sessionId: providedSessionId, firstMessage } = body;
            
            const sessionId = providedSessionId || crypto.randomUUID();
            
            // Generate better session titles
            let sessionTitle = title;
            if (!sessionTitle) {
                const now = new Date();
                const dateTime = now.toLocaleString([], {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                if (firstMessage && firstMessage.trim()) {
                    const cleanMessage = firstMessage.trim().replace(/\s+/g, ' ');
                    const truncated = cleanMessage.length > 40 
                        ? cleanMessage.slice(0, 37) + '...' 
                        : cleanMessage;
                    sessionTitle = `${truncated} • ${dateTime}`;
                } else {
                    sessionTitle = `Chat ${dateTime}`;
                }
            }
            
            await registerSession(c.env, sessionId, sessionTitle);
            
            return c.json({ 
                success: true, 
                data: { sessionId, title: sessionTitle }
            });
        } catch (error) {
            console.error('Failed to create session:', error);
            return c.json({ 
                success: false, 
                error: 'Failed to create session' 
            }, { status: 500 });
        }
    });

    /**
     * Delete a chat session
     * DELETE /api/sessions/:sessionId
     */
    app.delete('/api/sessions/:sessionId', async (c) => {
        try {
            const sessionId = c.req.param('sessionId');
            const deleted = await unregisterSession(c.env, sessionId);
            
            if (!deleted) {
                return c.json({ 
                    success: false, 
                    error: 'Session not found' 
                }, { status: 404 });
            }
            
            return c.json({ success: true, data: { deleted: true } });
        } catch (error) {
            console.error('Failed to delete session:', error);
            return c.json({ 
                success: false, 
                error: 'Failed to delete session' 
            }, { status: 500 });
        }
    });

    /**
     * Update session title
     * PUT /api/sessions/:sessionId/title
     * Body: { title: string }
     */
    app.put('/api/sessions/:sessionId/title', async (c) => {
        try {
            const sessionId = c.req.param('sessionId');
            const { title } = await c.req.json();
            
            if (!title || typeof title !== 'string') {
                return c.json({ 
                    success: false, 
                    error: 'Title is required' 
                }, { status: 400 });
            }
            
            const controller = getAppController(c.env);
            const updated = await controller.updateSessionTitle(sessionId, title);
            
            if (!updated) {
                return c.json({ 
                    success: false, 
                    error: 'Session not found' 
                }, { status: 404 });
            }
            
            return c.json({ success: true, data: { title } });
        } catch (error) {
            console.error('Failed to update session title:', error);
            return c.json({ 
                success: false, 
                error: 'Failed to update session title' 
            }, { status: 500 });
        }
    });

    /**
     * Get session count and stats
     * GET /api/sessions/stats
     */
    app.get('/api/sessions/stats', async (c) => {
        try {
            const controller = getAppController(c.env);
            const count = await controller.getSessionCount();
            return c.json({ 
                success: true, 
                data: { totalSessions: count } 
            });
        } catch (error) {
            console.error('Failed to get session stats:', error);
            return c.json({ 
                success: false, 
                error: 'Failed to retrieve session stats' 
            }, { status: 500 });
        }
    });

    /**
     * Clear all chat sessions
     * DELETE /api/sessions
     */
    app.delete('/api/sessions', async (c) => {
        try {
            const controller = getAppController(c.env);
            const deletedCount = await controller.clearAllSessions();
            return c.json({ 
                success: true, 
                data: { deletedCount } 
            });
        } catch (error) {
            console.error('Failed to clear all sessions:', error);
            return c.json({ 
                success: false, 
                error: 'Failed to clear all sessions' 
            }, { status: 500 });
        }
    });

    // Example route - you can remove this
    app.get('/api/test', (c) => c.json({ success: true, data: { name: 'this works' }}));
    
    // 🤖 AI Extension Point: Add more custom routes here
}
