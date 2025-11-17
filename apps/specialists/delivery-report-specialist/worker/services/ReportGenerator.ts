/**
 * Delivery Report Generator Service
 * Uses AI to evaluate code compliance and generate structured reports
 */

import type { DeliveryReport, DeliveryReportOrder, FactoryLog } from '../types';

export class ReportGenerator {
  private ai: any; // AI binding from Cloudflare Workers
  private db: D1Database | null; // TODO: Replace with orchestrator service binding

  constructor(ai: any, db: D1Database | null) {
    this.ai = ai;
    this.db = db;
  }

  /**
   * Generate delivery report from order spec and factory outputs
   */
  async generateReport(order: DeliveryReportOrder): Promise<DeliveryReport> {
    // Fetch additional context from D1
    const context = await this.fetchProjectContext(order.project_id);

    // Build evaluation prompt
    const prompt = this.buildEvaluationPrompt(order, context);

    // Use AI to evaluate compliance
    const aiResponse = await this.ai.run('@cf/meta/llama-3.1-70b-instruct', {
      messages: [
        {
          role: 'system',
          content: `You are the Delivery Report Specialist for Mission Control.

Your job is to compare the final merged code to the original order requirements.

Determine whether functional, UI, and data components meet the spec.

List major variances and improvement notes.

Return a JSON response with this exact structure:
{
  "compliance_score": 0.0-1.0,
  "summary": "Brief summary of compliance status",
  "issues": [
    {
      "severity": "critical|warning|info",
      "category": "functional|ui|data|security|performance",
      "description": "Issue description",
      "affected_components": ["component1", "component2"]
    }
  ],
  "recommendations": [
    {
      "priority": "high|medium|low",
      "category": "Category name",
      "description": "Recommendation description",
      "actionable": true/false
    }
  ]
}`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 4096,
      temperature: 0.3
    });

    // Parse AI response
    const report = this.parseAIResponse(aiResponse, order);

    return report;
  }

  private async fetchProjectContext(projectId: string): Promise<any> {
    // TODO: Refactor to fetch via orchestrator service binding instead of direct DB access
    if (!this.db) {
      throw new Error('Database access must go through orchestrator service binding');
    }
    // Fetch PR commits, factory logs, etc. from D1
    try {
      // Example: Fetch from various tables
      const prLogs = await this.db.prepare(
        'SELECT * FROM factory_logs WHERE project_id = ? ORDER BY created_at DESC'
      ).bind(projectId).all();

      return {
        prLogs: prLogs.results || []
      };
    } catch (error) {
      console.error('Failed to fetch project context:', error);
      return {};
    }
  }

  private buildEvaluationPrompt(order: DeliveryReportOrder, context: any): string {
    const factoryLogsText = order.factory_logs?.map(log => 
      `\n### ${log.factory_name}\n${log.logs}`
    ).join('\n') || 'No factory logs available';

    return `Evaluate the delivery compliance for project: ${order.project_id}

## Original Order Specification:
${order.original_order_spec}

## Factory Execution Logs:
${factoryLogsText}

## PR Commit Logs:
${order.pr_commit_logs?.join('\n') || 'No commit logs available'}

## Additional Context:
${JSON.stringify(context, null, 2)}

Please evaluate:
1. Functional compliance: Does the code implement the required functionality?
2. UI compliance: Does the UI match the specifications?
3. Data compliance: Are database schemas and migrations correct?
4. Security compliance: Are there any security concerns?
5. Performance considerations: Any performance issues?

Return the evaluation as JSON with compliance_score (0.0-1.0), summary, issues, and recommendations.`;
  }

  private parseAIResponse(aiResponse: any, order: DeliveryReportOrder): DeliveryReport {
    let parsed: any;

    try {
      // Try to extract JSON from response
      const responseText = typeof aiResponse === 'string' 
        ? aiResponse 
        : aiResponse.response || JSON.stringify(aiResponse);

      // Extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                       responseText.match(/```\n([\s\S]*?)\n```/) ||
                       [null, responseText];

      const jsonText = jsonMatch[1] || responseText;
      parsed = JSON.parse(jsonText);
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      // Fallback to default report
      parsed = {
        compliance_score: 0.5,
        summary: 'Unable to parse AI evaluation. Manual review required.',
        issues: [],
        recommendations: []
      };
    }

    // Ensure required fields
    return {
      project_id: order.project_id,
      phase: order.phase,
      compliance_score: Math.max(0, Math.min(1, parsed.compliance_score || 0.5)),
      summary: parsed.summary || 'Evaluation completed',
      issues: parsed.issues || [],
      recommendations: parsed.recommendations || [],
      version: '1.0'
    };
  }

  /**
   * Calculate compliance score from issues
   */
  static calculateComplianceScore(issues: DeliveryReport['issues']): number {
    if (issues.length === 0) return 1.0;

    let score = 1.0;
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 0.2;
          break;
        case 'warning':
          score -= 0.1;
          break;
        case 'info':
          score -= 0.05;
          break;
      }
    }

    return Math.max(0, Math.min(1, score));
  }
}

