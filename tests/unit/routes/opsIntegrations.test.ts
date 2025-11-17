/**
 * Updated unit tests for Ops & Integrations Routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { setupOpsIntegrationsRoutes } from '../../../orchestrator/worker/api/routes/opsIntegrations';

const createApp = () => {
  const app = new Hono();
  setupOpsIntegrationsRoutes(app);
  return app;
};

describe('Ops & Integrations Routes', () => {
  let app: ReturnType<typeof createApp>;
  let mockDeliveryReportService: { triggerReportGeneration: ReturnType<typeof vi.fn> };
  let mockOpsMonitorService: { runScan: ReturnType<typeof vi.fn> };
  let env: any;

  beforeEach(() => {
    app = createApp();
    mockDeliveryReportService = {
      triggerReportGeneration: vi.fn().mockResolvedValue({ success: true })
    };
    mockOpsMonitorService = {
      runScan: vi.fn()
    };

    env = {
      GITHUB_WEBHOOK_SECRET: 'test-secret',
      __deliveryReportService: mockDeliveryReportService,
      __opsMonitorService: mockOpsMonitorService
    };
  });

  describe('POST /api/ops/scan', () => {
    it('runs incremental scan by default', async () => {
      mockOpsMonitorService.runScan.mockResolvedValue({
        scanId: 'scan-123',
        scope: 'incremental',
        status: 'completed',
        processedLogs: 120,
        issuesFiled: 3,
        completedAt: '2024-02-01T00:00:00Z',
        findings: { notes: 'ok' }
      });

      const response = await app.request('/api/ops/scan', {
        method: 'POST',
        body: JSON.stringify({})
      }, env);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('completed');
      expect(body.type).toBe('incremental');
      expect(mockOpsMonitorService.runScan).toHaveBeenCalledWith({ scope: 'incremental' });
    });

    it('validates scan type', async () => {
      const response = await app.request('/api/ops/scan', {
        method: 'POST',
        body: JSON.stringify({ type: 'invalid' })
      }, env);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Invalid scan type');
      expect(mockOpsMonitorService.runScan).not.toHaveBeenCalled();
    });

    it('returns 500 when scan fails', async () => {
      mockOpsMonitorService.runScan.mockRejectedValue(new Error('boom'));

      const response = await app.request('/api/ops/scan', {
        method: 'POST',
        body: JSON.stringify({ type: 'full' })
      }, env);

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/integrations/github/webhook', () => {
    it('rejects webhook without signature', async () => {
      const response = await app.request('/api/integrations/github/webhook', {
        method: 'POST',
        body: JSON.stringify({ action: 'opened' })
      }, env);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Missing webhook signature');
    });

    it('accepts valid webhook for pull request events', async () => {
      const crypto = await import('crypto');
      const payload = JSON.stringify({
        action: 'opened',
        pull_request: { number: 42 },
        repository: {
          full_name: 'acme/widgets',
          name: 'widgets',
          owner: { login: 'acme' }
        }
      });
      const signature = crypto
        .createHmac('sha256', 'test-secret')
        .update(payload)
        .digest('hex');

      const response = await app.request('/api/integrations/github/webhook', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': `sha256=${signature}`
        },
        body: payload
      }, env);

      expect(response.status).toBe(200);
      expect(mockDeliveryReportService.triggerReportGeneration).toHaveBeenCalledWith(expect.objectContaining({
        patchId: expect.stringContaining('pr-42'),
        destination: 'github-pr-processing'
      }));
    });

    it('handles malformed payload', async () => {
      const crypto = await import('crypto');
      const payload = 'not json';
      const signature = crypto
        .createHmac('sha256', 'test-secret')
        .update(payload)
        .digest('hex');

      const response = await app.request('/api/integrations/github/webhook', {
        method: 'POST',
        headers: { 'x-hub-signature-256': `sha256=${signature}` },
        body: payload
      }, env);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Invalid webhook payload');
    });
  });
});
