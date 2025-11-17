/**
 * Route-level Authentication Middleware
 *
 * Provides middleware functions for enforcing authentication requirements
 * on HTTP routes using Hono middleware pattern.
 */

import { MiddlewareHandler } from 'hono';
import { AppEnv } from '../../types/appenv';
import { AuthUser } from '../../types/auth-types';
import { SessionService } from '../../database/services/SessionService';
import { UserService } from '../../database/services/UserService';

/**
 * Authentication requirement levels
 */
export enum AuthRequirement {
    public = 'public',
    authenticated = 'authenticated'
}

/**
 * Authentication configuration for routes
 */
export const AuthConfig = {
  public: AuthRequirement.public,
  authenticated: AuthRequirement.authenticated,
} as const;

/**
 * Create a middleware handler that enforces the specified auth requirement
 */
export function setAuthLevel(requirement: AuthRequirement): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set('authLevel', requirement);
    await next();
  };
}

/**
 * Enforce authentication requirement based on the context's auth level
 * Returns a Response if authentication fails, null if successful
 */
export async function enforceAuthRequirement(c: any): Promise<Response | null> {
  const requirement = c.get('authLevel') as AuthRequirement;

  // Public routes don't require authentication
  if (requirement === AuthRequirement.public) {
    return null;
  }

  // Extract session from cookies or headers
  const sessionId = extractSessionId(c.req.raw);

  if (!sessionId) {
    return new Response(JSON.stringify({
      error: 'Authentication required',
      message: 'No session found',
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Validate session
    const session = await SessionService.getValidSession(c.env.DB_SESSIONS, sessionId);
    if (!session) {
      return new Response(JSON.stringify({
        error: 'Authentication required',
        message: 'Invalid or expired session',
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user
    const user = await UserService.getById(c.env.DB_USERS, session.userId);
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Authentication required',
        message: 'User not found',
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Set user context
    c.set('user', user);
    c.set('sessionId', sessionId);

    return null; // Auth successful
  } catch (error) {
    console.error('Auth enforcement error:', error);
    return new Response(JSON.stringify({
      error: 'Authentication error',
      message: 'Internal server error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Extract session ID from request cookies or Authorization header
 */
function extractSessionId(request: Request): string | null {
  // Try Authorization header first (Bearer token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Try session cookie
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const sessionMatch = cookieHeader.match(/session=([^;]+)/);
    if (sessionMatch) {
      return sessionMatch[1];
    }
  }

  return null;
}
