export enum SecurityErrorType {
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CSRF_TOKEN_INVALID = 'CSRF_TOKEN_INVALID',
  CSRF_TOKEN_MISSING = 'CSRF_TOKEN_MISSING',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  PERMISSION_DENIED = 'PERMISSION_DENIED'
}

export class SecurityError extends Error {
  public readonly type: SecurityErrorType;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    type: SecurityErrorType,
    message: string,
    statusCode: number = 403,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SecurityError';
    this.type = type;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class RateLimitExceededError extends SecurityError {
  constructor(message: string = 'Rate limit exceeded', details?: Record<string, unknown>) {
    super(SecurityErrorType.RATE_LIMIT_EXCEEDED, message, 429, details);
    this.name = 'RateLimitExceededError';
  }
}
