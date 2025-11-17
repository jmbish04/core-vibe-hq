/**
 * Authentication Middleware
 *
 * Provides middleware functions for handling authentication
 * in request/response cycles.
 */

import { SessionService } from '../../database/services/SessionService';
import { UserService } from '../../database/services/UserService';
import { AuthUser } from '../../types/auth-types';
import type { Env } from '../../types';

/**
 * Authentication middleware result
 */
export interface AuthResult {
    user: AuthUser;
    sessionId: string;
}

/**
 * Authenticate a request and return user/session info
 * Used by auth controller for manual authentication checks
 */
export async function authMiddleware(request: Request, env: Env): Promise<AuthResult> {
  // Extract session from cookies or headers
  const sessionId = extractSessionId(request);

  if (!sessionId) {
    throw new Error('No session found');
  }

  // Validate session
  const session = await SessionService.getValidSession(env.DB_SESSIONS, sessionId);
  if (!session) {
    throw new Error('Invalid or expired session');
  }

  // Get user
  const user = await UserService.getById(env.DB_USERS, session.userId);
  if (!user) {
    throw new Error('User not found');
  }

  return {
    user,
    sessionId,
  };
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
