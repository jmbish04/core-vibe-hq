import type { AiLog } from './healthTypes';
import type { HealthDatabaseClient } from './healthDatabaseClient';

export interface AiValidationResult {
  success: boolean;
  result: any;
  reasoning: string;
  suggestions?: string[];
  confidence: number;
}

export interface AiServiceOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface Env {
  AI: any; // Cloudflare AI binding
}

export class AiService {
  constructor(
    private env: Env,
    private dbClient: HealthDatabaseClient
  ) {}

  /**
   * Run AI validation and log the results
   */
  async runAiAndLog(
    prompt: string,
    options: AiServiceOptions = {},
    testResultId?: number,
    context?: Record<string, any>
  ): Promise<AiValidationResult> {
    const startTime = Date.now();
    const model = options.model || '@cf/meta/llama-3.1-8b-instruct';
    const maxTokens = options.maxTokens || 1000;
    const temperature = options.temperature || 0.7;

    let success = false;
    let result: any = null;
    let reasoning = '';
    let errorMessage = '';
    let tokensUsed = 0;
    let cost = 0;

    try {
      // Execute AI inference
      const aiResponse = await this.env.AI.run(model, {
        prompt,
        max_tokens: maxTokens,
        temperature,
        stream: false
      });

      success = true;
      result = aiResponse;
      tokensUsed = aiResponse.usage?.total_tokens || 0;

      // Calculate approximate cost (Cloudflare AI pricing)
      // This is a simplified calculation - adjust based on actual pricing
      cost = (tokensUsed / 1000) * 0.0005; // $0.0005 per 1K tokens

      // Parse reasoning from response
      reasoning = this.extractReasoning(aiResponse.response);

    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : String(error);
      console.error('AI service error:', error);
    }

    const latencyMs = Date.now() - startTime;

    // Log to database
    const aiLog: Omit<AiLog, 'id' | 'createdAt'> = {
      testResultId,
      model,
      provider: 'cloudflare-ai',
      prompt,
      response: success ? JSON.stringify(result) : null,
      tokensUsed,
      cost,
      latencyMs,
      success,
      errorMessage: success ? null : errorMessage,
      reasoning: JSON.stringify({
        extracted_reasoning: reasoning,
        confidence: success ? this.calculateConfidence(result) : 0,
        context
      }),
      metadata: JSON.stringify({
        options,
        latencyMs,
        model,
        timestamp: new Date().toISOString()
      })
    };

    await this.dbService.createAiLog(aiLog);

    // Parse result for return
    const validationResult: AiValidationResult = {
      success,
      result,
      reasoning,
      confidence: success ? this.calculateConfidence(result) : 0
    };

    if (success && result) {
      validationResult.suggestions = this.extractSuggestions(result);
    }

    return validationResult;
  }

  /**
   * Validate system health using AI
   */
  async validateSystemHealth(
    systemData: any,
    testType: string
  ): Promise<AiValidationResult> {
    const prompt = `Analyze the following ${testType} test data and determine if the system is healthy. Provide a detailed assessment with specific recommendations for any issues found.

Test Data: ${JSON.stringify(systemData, null, 2)}

Please respond with:
1. Overall health assessment (healthy/degraded/critical)
2. Specific issues identified (if any)
3. Recommended actions to resolve issues
4. Confidence level in the assessment (0-100)

Format your response as JSON with keys: assessment, issues, recommendations, confidence`;

    const result = await this.runAiAndLog(prompt, {
      model: '@cf/meta/llama-3.1-8b-instruct',
      temperature: 0.3 // Lower temperature for more consistent analysis
    });

    return result;
  }

  /**
   * Generate test recommendations using AI
   */
  async generateTestRecommendations(
    failedTests: any[],
    systemMetrics: any
  ): Promise<AiValidationResult> {
    const prompt = `Based on the following failed tests and system metrics, generate specific recommendations for improving system health and test reliability.

Failed Tests: ${JSON.stringify(failedTests, null, 2)}
System Metrics: ${JSON.stringify(systemMetrics, null, 2)}

Please provide:
1. Root cause analysis for each failure
2. Specific technical recommendations
3. Priority order for fixes (high/medium/low)
4. Expected impact of each recommendation

Format as JSON with keys: analysis, recommendations, priorities, expected_impact`;

    const result = await this.runAiAndLog(prompt, {
      model: '@cf/meta/llama-3.1-8b-instruct',
      temperature: 0.4
    });

    return result;
  }

  /**
   * Analyze performance trends using AI
   */
  async analyzePerformanceTrends(
    metrics: any[],
    timeRange: string
  ): Promise<AiValidationResult> {
    const prompt = `Analyze the following performance metrics over ${timeRange} and identify trends, anomalies, and optimization opportunities.

Metrics: ${JSON.stringify(metrics, null, 2)}

Please analyze:
1. Performance trends (improving/degrading/stable)
2. Anomalies or concerning patterns
3. Potential bottlenecks or issues
4. Optimization recommendations
5. Predicted future performance

Format as JSON with keys: trends, anomalies, recommendations, predictions, confidence`;

    const result = await this.runAiAndLog(prompt, {
      model: '@cf/meta/llama-3.1-8b-instruct',
      temperature: 0.2 // Very low temperature for analytical tasks
    });

    return result;
  }

  /**
   * Extract reasoning from AI response
   */
  private extractReasoning(response: any): string {
    if (typeof response === 'string') {
      return response;
    }

    if (response && typeof response === 'object') {
      // Try to extract from common response formats
      if (response.response) return response.response;
      if (response.result) return response.result;
      if (response.output) return response.output;
      if (response.text) return response.text;
    }

    return JSON.stringify(response);
  }

  /**
   * Calculate confidence score from AI response
   */
  private calculateConfidence(response: any): number {
    // Simple confidence calculation based on response structure
    // This could be enhanced with more sophisticated analysis
    if (!response) return 0;

    let confidence = 50; // Base confidence

    // Increase confidence for structured responses
    if (response && typeof response === 'object') {
      if (response.assessment) confidence += 20;
      if (response.issues && Array.isArray(response.issues)) confidence += 10;
      if (response.recommendations) confidence += 15;
      if (response.confidence && typeof response.confidence === 'number') {
        confidence = response.confidence;
      }
    }

    return Math.min(confidence, 100);
  }

  /**
   * Extract suggestions from AI response
   */
  private extractSuggestions(response: any): string[] {
    const suggestions: string[] = [];

    if (response && typeof response === 'object') {
      // Extract from common response formats
      if (response.recommendations) {
        if (Array.isArray(response.recommendations)) {
          suggestions.push(...response.recommendations);
        } else if (typeof response.recommendations === 'string') {
          suggestions.push(response.recommendations);
        }
      }

      if (response.suggestions && Array.isArray(response.suggestions)) {
        suggestions.push(...response.suggestions);
      }

      if (response.actions && Array.isArray(response.actions)) {
        suggestions.push(...response.actions);
      }
    }

    return suggestions;
  }

  /**
   * Get AI usage statistics
   */
  async getUsageStats(days = 30) {
    return this.dbClient.getAiUsageStats(days);
  }
}
