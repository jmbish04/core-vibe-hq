interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  errorBoundary?: boolean;
  errorBoundaryProps?: Record<string, unknown>;
  url: string;
  userAgent: string;
  timestamp: string;
  source?: string;
  lineno?: number;
  colno?: number;
  error?: unknown;
}

interface ErrorSignature {
  message: string;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
}

class ErrorReporter {
  private reportedErrors: Map<string, number> = new Map();
  private errorQueue: ErrorReport[] = [];
  private isReporting = false;
  private readonly maxQueueSize = 10;
  private readonly reportingEndpoint = '/api/client-errors';
  private readonly deduplicationWindow = 5000; // 5 seconds
  private lastCleanup = Date.now();

  constructor() {
    // Only set up handlers on client side
    if (typeof window !== 'undefined') {
      // Set up global error handler
      this.setupGlobalErrorHandler();
      // Set up unhandled promise rejection handler
      this.setupUnhandledRejectionHandler();
      // Periodically clean up old error signatures
      setInterval(() => this.cleanupOldErrors(), 60000); // Every minute
    }
  }

  private setupGlobalErrorHandler() {
    const originalHandler = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      this.report({
        message: typeof message === 'string' ? message : 'Unknown error',
        stack: error?.stack,
        source: source || undefined,
        lineno: lineno || undefined,
        colno: colno || undefined,
        error: error,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      });

      // Call original handler if it exists
      if (originalHandler) {
        return originalHandler(message, source, lineno, colno, error);
      }
      return true; // Prevent default browser error handling
    };
  }

  private setupUnhandledRejectionHandler() {
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;
      this.report({
        message: error?.message || 'Unhandled Promise Rejection',
        stack: error?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        error: error,
      });
    });
  }

  private generateErrorSignature(error: ErrorSignature): string {
    // Create a unique signature for the error based on key properties
    const parts = [
      error.message,
      error.source || '',
      error.lineno?.toString() || '',
      error.colno?.toString() || '',
      // Include first few lines of stack trace for better deduplication
      error.stack?.split('\n').slice(0, 3).join('\n') || ''
    ];
    return parts.join('|');
  }

  private shouldReportError(error: ErrorSignature): boolean {
    const signature = this.generateErrorSignature(error);
    const now = Date.now();
    const lastReported = this.reportedErrors.get(signature);

    // Clean up old errors periodically
    if (now - this.lastCleanup > 60000) {
      this.cleanupOldErrors();
    }

    if (!lastReported) {
      // First time seeing this error
      this.reportedErrors.set(signature, now);
      return true;
    }

    if (now - lastReported > this.deduplicationWindow) {
      // Enough time has passed, report it again
      this.reportedErrors.set(signature, now);
      return true;
    }

    // Too soon, skip reporting
    return false;
  }

  private cleanupOldErrors() {
    const now = Date.now();
    const cutoff = now - 300000; // 5 minutes

    for (const [signature, timestamp] of this.reportedErrors.entries()) {
      if (timestamp < cutoff) {
        this.reportedErrors.delete(signature);
      }
    }
    this.lastCleanup = now;
  }

  public report(error: ErrorReport) {
    // Skip if on server side
    if (typeof window === 'undefined') return;

    // Check if we should report this error
    const errorSignature: ErrorSignature = {
      message: error.message,
      stack: error.stack,
      source: error.source,
      lineno: error.lineno,
      colno: error.colno,
    };

    if (!this.shouldReportError(errorSignature)) {
      console.log('[ErrorReporter] Skipping duplicate error:', error.message);
      return;
    }

    // Add to queue
    this.errorQueue.push(error);

    // Limit queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift(); // Remove oldest error
    }

    // Process queue
    this.processQueue();
  }

  private async processQueue() {
    if (this.isReporting || this.errorQueue.length === 0) {
      return;
    }

    this.isReporting = true;
    const errorsToReport = [...this.errorQueue];
    this.errorQueue = [];

    try {
      for (const error of errorsToReport) {
        await this.sendError(error);
      }
    } catch (err) {
      // If reporting fails, add errors back to queue
      console.error('[ErrorReporter] Failed to report errors:', err);
      this.errorQueue.unshift(...errorsToReport);
    } finally {
      this.isReporting = false;
    }
  }

  private async sendError(error: ErrorReport) {
    try {
      const response = await fetch(this.reportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(error),
      });

      if (!response.ok) {
        throw new Error(`Failed to report error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as { success: boolean; error?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error occurred');
      }

      console.log('[ErrorReporter] Error reported successfully:', error.message);
    } catch (err) {
      console.error('[ErrorReporter] Failed to send error:', err);
      throw err;
    }
  }

  // Manual error reporting method
  public reportError(error: Error, context?: Record<string, unknown>) {
    this.report({
      message: error.message,
      stack: error.stack,
      url: typeof window !== 'undefined' ? window.location.href : 'server',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      timestamp: new Date().toISOString(),
      ...context,
    });
  }
}

// Create singleton instance
export const errorReporter = new ErrorReporter();