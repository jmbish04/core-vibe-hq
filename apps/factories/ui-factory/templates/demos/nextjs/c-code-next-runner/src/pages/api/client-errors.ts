import type { NextApiRequest, NextApiResponse } from 'next';

interface ClientErrorReport {
  message: string;
  url: string;
  userAgent: string;
  timestamp: string;
  stack?: string;
  componentStack?: string;
  errorBoundary?: boolean;
  errorBoundaryProps?: Record<string, unknown>;
  source?: string;
  lineno?: number;
  colno?: number;
  error?: unknown;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const errorReport = req.body as ClientErrorReport;

    // Validate required fields
    if (!errorReport.message || !errorReport.url || !errorReport.userAgent) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: message, url, or userAgent' 
      });
      return;
    }

    // Log to stderr (console.error in Node.js)
    console.error('[CLIENT ERROR]', JSON.stringify({
      timestamp: errorReport.timestamp || new Date().toISOString(),
      message: errorReport.message,
      url: errorReport.url,
      userAgent: errorReport.userAgent,
      stack: errorReport.stack,
      componentStack: errorReport.componentStack,
      errorBoundary: errorReport.errorBoundary,
      source: errorReport.source,
      lineno: errorReport.lineno,
      colno: errorReport.colno,
    }, null, 2));

    // Return success response
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[CLIENT ERROR HANDLER] Failed to process error report:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process error report' 
    });
  }
}