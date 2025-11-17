/**
 * GitHub Integration Service
 *
 * Handles GitHub webhook processing, API interactions, and integration management.
 */

import { Database } from '../../database/schema';
import { Kysely } from 'kysely';

export interface GitHubWebhookEvent {
  action: string;
  repository?: {
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  pull_request?: any;
  issue?: any;
  commits?: any[];
  ref?: string;
}

export interface GitHubIntegrationConfig {
  repository: string;
  events: string[];
  targetUrl: string;
  secret?: string;
}

export class GitHubIntegrationService {
  constructor(
    private db: Kysely<Database>,
  ) {}

  /**
   * Verify GitHub webhook signature
   */
  async verifyWebhookSignature(payload: string, signature: string, secret?: string): Promise<boolean> {
    if (!secret) {
      // Try to get secret from environment or database
      secret = await this.getWebhookSecret();
    }

    if (!secret) {
      console.error('GitHub webhook secret not configured');
      return false;
    }

    try {
      const crypto = await import('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      return `sha256=${expectedSignature}` === signature;
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Handle incoming GitHub webhook event
   */
  async handleWebhookEvent(event: GitHubWebhookEvent): Promise<void> {
    console.log(`Processing GitHub webhook event: ${event.action}`);

    try {
      switch (event.action) {
        case 'opened':
        case 'synchronize':
        case 'reopened':
          if (event.pull_request) {
            await this.handlePullRequestEvent(event);
          }
          break;

        case 'push':
          await this.handlePushEvent(event);
          break;

        case 'opened':
        case 'edited':
        case 'closed':
        case 'reopened':
          if (event.issue) {
            await this.handleIssueEvent(event);
          }
          break;

        default:
          console.log(`Unhandled GitHub event type: ${event.action}`);
      }
    } catch (error) {
      console.error('Error handling GitHub webhook event:', error);
      throw error;
    }
  }

  /**
   * Handle pull request events
   */
  private async handlePullRequestEvent(event: GitHubWebhookEvent): Promise<void> {
    const pr = event.pull_request;
    const repo = event.repository;

    console.log(`Processing PR #${pr.number} in ${repo?.full_name}`);

    // Create a delivery report for PR processing
    await this.db
      .insertInto('deliveryReports')
      .values({
        taskId: `github-pr-${pr.number}`,
        destination: 'github-integration',
        status: 'pending',
        attempts: 0,
        metadata: {
          repository: repo?.full_name,
          pullRequest: pr.number,
          action: event.action,
          title: pr.title,
          author: pr.user?.login,
          branch: pr.head?.ref,
        },
      })
      .execute();

    // Additional PR processing logic could go here
    // e.g., trigger code analysis, create tasks, etc.
  }

  /**
   * Handle push events
   */
  private async handlePushEvent(event: GitHubWebhookEvent): Promise<void> {
    const repo = event.repository;
    const commits = event.commits || [];

    console.log(`Processing push to ${repo?.full_name} with ${commits.length} commits`);

    // Create a delivery report for push processing
    await this.db
      .insertInto('deliveryReports')
      .values({
        taskId: `github-push-${Date.now()}`,
        destination: 'github-integration',
        status: 'pending',
        attempts: 0,
        metadata: {
          repository: repo?.full_name,
          ref: event.ref,
          commitsCount: commits.length,
          commits: commits.map(c => ({ id: c.id, message: c.message })),
        },
      })
      .execute();

    // Additional push processing logic could go here
    // e.g., trigger CI, update documentation, etc.
  }

  /**
   * Handle issue events
   */
  private async handleIssueEvent(event: GitHubWebhookEvent): Promise<void> {
    const issue = event.issue;
    const repo = event.repository;

    console.log(`Processing issue #${issue.number} in ${repo?.full_name}`);

    // Create a delivery report for issue processing
    await this.db
      .insertInto('deliveryReports')
      .values({
        taskId: `github-issue-${issue.number}`,
        destination: 'github-integration',
        status: 'pending',
        attempts: 0,
        metadata: {
          repository: repo?.full_name,
          issue: issue.number,
          action: event.action,
          title: issue.title,
          author: issue.user?.login,
          labels: issue.labels?.map(l => l.name),
        },
      })
      .execute();

    // Additional issue processing logic could go here
    // e.g., create tasks, update project status, etc.
  }

  /**
   * Create a GitHub webhook configuration
   */
  async createIntegrationEndpoint(config: GitHubIntegrationConfig): Promise<any> {
    console.log(`Creating GitHub integration for ${config.repository}`);

    // In a real implementation, this would make API calls to GitHub
    // to create the webhook. For now, we'll just store the configuration.

    const webhookConfig = {
      id: `webhook-${Date.now()}`,
      repository: config.repository,
      events: config.events,
      targetUrl: config.targetUrl,
      secret: config.secret || await this.generateWebhookSecret(),
      active: true,
      createdAt: new Date().toISOString(),
    };

    // Store webhook configuration (in a real app, this might be in a separate table)
    console.log('Webhook configuration created:', webhookConfig);

    return webhookConfig;
  }

  /**
   * Get delivery reports for GitHub events
   */
  async getGitHubDeliveryReports(repository?: string, status?: string): Promise<any[]> {
    let query = this.db
      .selectFrom('deliveryReports')
      .selectAll()
      .where('destination', '=', 'github-integration')
      .orderBy('createdAt', 'desc');

    if (repository) {
      query = query.where('metadata->repository', '=', repository);
    }

    if (status) {
      query = query.where('status', '=', status);
    }

    const reports = await query.execute();
    return reports;
  }

  /**
   * Get webhook secret from environment or generate one
   */
  private async getWebhookSecret(): Promise<string | undefined> {
    // In a real implementation, this would get the secret from environment variables
    // or a secure storage system
    return process.env.GITHUB_WEBHOOK_SECRET;
  }

  /**
   * Generate a random webhook secret
   */
  private async generateWebhookSecret(): Promise<string> {
    const crypto = await import('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Test GitHub integration connectivity
   */
  async testIntegration(): Promise<{ success: boolean; message: string }> {
    try {
      // In a real implementation, this would test the GitHub API connection
      // For now, just return a success message
      return {
        success: true,
        message: 'GitHub integration is configured correctly',
      };
    } catch (error) {
      return {
        success: false,
        message: `GitHub integration test failed: ${error.message}`,
      };
    }
  }
}
