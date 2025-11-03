/**
 * Minimal logger abstraction for the orchestrator.
 */
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => console.log(message, meta ?? {}),
  warn: (message: string, meta?: Record<string, unknown>) => console.warn(message, meta ?? {}),
  error: (message: string, meta?: Record<string, unknown>) => console.error(message, meta ?? {})
};
