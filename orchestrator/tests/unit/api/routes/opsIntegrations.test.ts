import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { setupOpsIntegrationsRoutes } from '../../../../worker/api/routes/opsIntegrations';
import { OpsMonitorService } from '../../../../worker/services/ops/opsMonitorService';
import { DeliveryReportService } from '../../../../worker/services/ops/deliveryReportService';
import type { AppEnv } from '../../../../worker/types/appenv';

// Mock the services
vi.mock('../../../../worker/services/ops/opsMonitorService');
vi.mock('../../../../worker/services/ops/deliveryReportService');

// Mock crypto for webhook signature verification
vi.mock('crypto', () => ({
  default: {
    createHmac: vi.fn(() => ({
      update: vi.fn(() => ({
        digest: vi.fn(() => 'mocked-digest'),
      })),
    })),
    timingSafeEqual: vi.fn(() => true),
  },
}));

describe('Ops Integrations Routes', () => {
  let app: Hono<AppEnv>;
  let mockEnv: any;
  let mockOpsMonitorService: any;
  let mockDeliveryReportService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock services
    mockOpsMonitorService = {
      runScan: vi.fn(),
    };
    mockDeliveryReportService = {
      triggerReportGeneration: vi.fn(),
    };

    // Mock the service constructors
    (OpsMonitorService as any).mockImplementation(() => mockOpsMonitorService);
    (DeliveryReportService as any).mockImplementation(() => mockDeliveryReportService);

    // Create mock environment
    mockEnv = {
      DB_OPS: {},
      GITHUB_WEBHOOK_SECRET: 'test-secret',
      __opsMonitorService: mockOpsMonitorService,
      __deliveryReportService: mockDeliveryReportService,
    };

    // Create app and setup routes
    app = new Hono<AppEnv>();
    setupOpsIntegrationsRoutes(app);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/ops/scan', () => {
    it('should trigger incremental scan by default', async () => {
      const scanResult = {
        scanId: 'test-scan-123',
        scope: 'incremental',
        status: 'completed',
        processedLogs: 42,
        issuesFiled: 3,
        completedAt: Date.now(),
        findings: ['Issue 1', 'Issue 2'],
      };

      mockOpsMonitorService.runScan.mockResolvedValue(scanResult);

      const req = new Request('http://localhost/api/ops/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await app.request(req, mockEnv);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({
        scanId: 'test-scan-123',
        type: 'incremental',
        status: 'completed',
        processedLogs: 42,
        issuesFiled: 3,
        completedAt: scanResult.completedAt,
        findings: ['Issue 1', 'Issue 2'],
        message: 'Operations scan (incremental) completed',
      });

      expect(mockOpsMonitorService.runScan).toHaveBeenCalledWith({ scope: 'incremental' });
    });

    it('should trigger full scan when specified', async () => {
      const scanResult = {
        scanId: 'test-scan-456',
        scope: 'full',
        status: 'completed',
        processedLogs: 100,
        issuesFiled: 7,
        completedAt: Date.now(),
        findings: ['Major issue found'],
      };

      mockOpsMonitorService.runScan.mockResolvedValue(scanResult);

      const req = new Request('http://localhost/api/ops/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'full' }),
      });

      const res = await app.request(req, mockEnv);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.type).toBe('full');
      expect(body.message).toBe('Operations scan (full) completed');
      expect(mockOpsMonitorService.runScan).toHaveBeenCalledWith({ scope: 'full' });
    });

    it('should reject invalid scan type', async () => {
      const req = new Request('http://localhost/api/ops/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'invalid' }),
      });

      const res = await app.request(req, mockEnv);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Invalid scan type');
      expect(mockOpsMonitorService.runScan).not.toHaveBeenCalled();
    });

    it('should handle scan errors', async () => {
      mockOpsMonitorService.runScan.mockRejectedValue(new Error('Scan failed'));

      const req = new Request('http://localhost/api/ops/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'full' }),
      });

      const res = await app.request(req, mockEnv);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe('Failed to trigger operations scan');
    });

    it('should handle malformed JSON in request body', async () => {
      const req = new Request('http://localhost/api/ops/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const res = await app.request(req, mockEnv);
      const body = await res.json();

      expect(res.status).toBe(200); // Default to incremental scan
      expect(mockOpsMonitorService.runScan).toHaveBeenCalledWith({ scope: 'incremental' });
    });
  });

  describe('POST /api/integrations/github/webhook', () => {
    const validPayload = {
      action: 'opened',
      repository: {
        name: 'test-repo',
        full_name: 'owner/test-repo',
        owner: { login: 'owner' },
      },
      pull_request: {
        number: 123,
        title: 'Test PR',
      },
    };

    const validSignature = 'sha256=mocked-digest';

    it('should reject requests without signature', async () => {
      const req = new Request('http://localhost/api/integrations/github/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      });

      const res = await app.request(req, mockEnv);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Missing webhook signature');
    });

    it('should reject requests with invalid signature', async () => {
      // Mock signature verification to fail
      const cryptoMock = await import('crypto');
      cryptoMock.default.createHmac.mockReturnValue({
        update: () => ({
          digest: () => 'wrong-digest',
        }),
      });

      const req = new Request('http://localhost/api/integrations/github/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': 'sha256=wrong-signature',
        },
        body: JSON.stringify(validPayload),
      });

      const res = await app.request(req, mockEnv);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toBe('Invalid webhook signature');
    });

    it('should process valid pull request webhook', async () => {
      const req = new Request('http://localhost/api/integrations/github/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': validSignature,
        },
        body: JSON.stringify(validPayload),
      });

      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: 'ok' });

      expect(mockDeliveryReportService.triggerReportGeneration).toHaveBeenCalledWith({
        patchId: 'pr-123',
        destination: 'github-pr-processing',
        status: 'pending',
        metadata: {
          repository: 'owner/test-repo',
          pullRequest: 123,
          action: 'opened',
        },
      });
    });

    it('should process push webhook', async () => {
      const pushPayload = {
        action: 'push',
        repository: {
          name: 'test-repo',
          full_name: 'owner/test-repo',
          owner: { login: 'owner' },
        },
        ref: 'refs/heads/main',
        commits: [{ id: 'abc123' }, { id: 'def456' }],
      };

      const req = new Request('http://localhost/api/integrations/github/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': validSignature,
        },
        body: JSON.stringify(pushPayload),
      });

      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockDeliveryReportService.triggerReportGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: 'github-push-processing',
          metadata: expect.objectContaining({
            repository: 'owner/test-repo',
            ref: 'refs/heads/main',
            commits: 2,
          }),
        }),
      );
    });

    it('should process issue webhook', async () => {
      const issuePayload = {
        action: 'opened',
        repository: {
          name: 'test-repo',
          full_name: 'owner/test-repo',
          owner: { login: 'owner' },
        },
        issue: {
          number: 456,
          title: 'Test Issue',
        },
      };

      const req = new Request('http://localhost/api/integrations/github/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': validSignature,
        },
        body: JSON.stringify(issuePayload),
      });

      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockDeliveryReportService.triggerReportGeneration).toHaveBeenCalledWith({
        patchId: 'issue-456',
        destination: 'github-issue-processing',
        status: 'pending',
        metadata: {
          repository: 'owner/test-repo',
          issue: 456,
          action: 'opened',
        },
      });
    });

    it('should handle malformed JSON payload', async () => {
      const req = new Request('http://localhost/api/integrations/github/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': validSignature,
        },
        body: 'invalid json',
      });

      const res = await app.request(req, mockEnv);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Invalid webhook payload: malformed JSON');
    });

    it('should handle invalid webhook payload schema', async () => {
      const invalidPayload = { invalid: 'payload' };

      const req = new Request('http://localhost/api/integrations/github/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': validSignature,
        },
        body: JSON.stringify(invalidPayload),
      });

      const res = await app.request(req, mockEnv);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Invalid webhook payload');
      expect(body.details).toBeDefined();
    });

    it('should handle service errors', async () => {
      mockDeliveryReportService.triggerReportGeneration.mockRejectedValue(new Error('Service error'));

      const req = new Request('http://localhost/api/integrations/github/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': validSignature,
        },
        body: JSON.stringify(validPayload),
      });

      const res = await app.request(req, mockEnv);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe('Failed to process webhook');
    });
  });
});
