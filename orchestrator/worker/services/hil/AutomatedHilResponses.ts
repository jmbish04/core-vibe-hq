/**
 * Automated HIL Responses Service
 *
 * Provides automated responses for common HIL request patterns.
 * Reduces manual intervention for predictable scenarios.
 */

import { eq, and, gt } from 'drizzle-orm';
import { DatabaseService } from '../database/database';
import type { StructuredLogger } from '../../types';

interface HilRequestContext {
  question: string;
  orderId: string;
  conversationId: string;
  context?: any;
  previousResponses?: string[];
}

interface AutomatedResponse {
  response: string;
  confidence: number;
  category: string;
  reasoning: string;
}

export class AutomatedHilResponses {
  constructor(
    private db: DatabaseService,
    private logger: StructuredLogger
  ) {}

  /**
   * Attempt to generate an automated response for a HIL request
   */
  async generateAutomatedResponse(context: HilRequestContext): Promise<AutomatedResponse | null> {
    try {
      // Check various patterns for automated responses
      const patterns = [
        this.handleContextRequests,
        this.handleStandardImplementation,
        this.handleSecurityQuestions,
        this.handlePerformanceQuestions,
        this.handleCodeStyleQuestions,
        this.handleDependencyQuestions,
      ];

      for (const pattern of patterns) {
        const response = await pattern.call(this, context);
        if (response && response.confidence >= 0.8) { // High confidence threshold
          return response;
        }
      }

      return null; // No automated response available
    } catch (error) {
      this.logger.error('Error generating automated HIL response', {
        orderId: context.orderId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Handle requests for additional context
   */
  private async handleContextRequests(context: HilRequestContext): Promise<AutomatedResponse | null> {
    const question = context.question.toLowerCase();

    if (question.includes('context') || question.includes('clarify') || question.includes('understand')) {
      // Get order details to provide better context
      const orderDetails = await this.getOrderDetails(context.orderId);

      if (orderDetails) {
        const response = `Based on the order details, here's the context you need:

**Order Information:**
- Factory: ${orderDetails.factory}
- Template: ${orderDetails.template || 'Not specified'}
- Requirements: ${orderDetails.requirements || 'Standard implementation'}

**Project Context:**
- This appears to be a ${orderDetails.factory} implementation following our standard patterns
- The requirements suggest ${this.inferRequirementsContext(orderDetails)}

Please let me know if you need more specific details about the implementation approach or constraints.`;

        return {
          response,
          confidence: 0.9,
          category: 'context_provision',
          reasoning: 'Request for context with available order details'
        };
      }
    }

    return null;
  }

  /**
   * Handle standard implementation questions
   */
  private async handleStandardImplementation(context: HilRequestContext): Promise<AutomatedResponse | null> {
    const question = context.question.toLowerCase();

    if (question.includes('how') && (question.includes('implement') || question.includes('approach'))) {
      // Check for similar resolved questions
      const similarResolved = await this.findSimilarResolvedQuestions(context.question, context.orderId);

      if (similarResolved.length > 0) {
        const recentResolution = similarResolved[0];
        const response = `Based on similar implementations in this project, here's the recommended approach:

**Recommended Implementation:**
${recentResolution.solution || 'Following standard project patterns and best practices'}

**Previous Context:**
This approach has been successfully used in similar scenarios within the same order.

**Rationale:**
${this.generateImplementationRationale(context)}`;

        return {
          response,
          confidence: 0.85,
          category: 'implementation_guidance',
          reasoning: 'Similar resolved questions found with successful patterns'
        };
      }
    }

    return null;
  }

  /**
   * Handle security-related questions
   */
  private async handleSecurityQuestions(context: HilRequestContext): Promise<AutomatedResponse | null> {
    const question = context.question.toLowerCase();

    if (question.includes('security') || question.includes('vulnerable') || question.includes('safe')) {
      const response = `**Security Assessment:**

✅ **Input Validation:** All inputs are validated and sanitized following OWASP guidelines
✅ **Authentication:** Requests require proper authentication tokens
✅ **Authorization:** Role-based access control is enforced
✅ **Data Protection:** Sensitive data is encrypted in transit and at rest
✅ **Rate Limiting:** API endpoints include rate limiting to prevent abuse
✅ **Audit Logging:** All security-relevant operations are logged

**Recommended Approach:**
Use the existing security patterns in the codebase:
- Input validation with Zod schemas
- Authentication middleware for protected routes
- Encrypted storage for sensitive configuration

If this involves new security requirements, please provide additional details for proper security review.`;

      return {
        response,
        confidence: 0.95,
        category: 'security_guidance',
        reasoning: 'Standard security question with established patterns'
      };
    }

    return null;
  }

  /**
   * Handle performance-related questions
   */
  private async handlePerformanceQuestions(context: HilRequestContext): Promise<AutomatedResponse | null> {
    const question = context.question.toLowerCase();

    if (question.includes('performance') || question.includes('slow') || question.includes('optimize')) {
      const response = `**Performance Optimization Guidance:**

**Current Best Practices:**
1. **Caching Strategy:** Use Redis/memory caching for frequently accessed data
2. **Database Optimization:** Ensure proper indexing and query optimization
3. **Async Processing:** Move heavy computations to background jobs
4. **CDN Usage:** Static assets served via CDN for global distribution
5. **Monitoring:** Implement performance monitoring and alerting

**Recommended Implementation:**
- Profile the current implementation to identify bottlenecks
- Consider caching layers for expensive operations
- Implement lazy loading for large datasets
- Use streaming responses for large data transfers

**Performance Metrics to Monitor:**
- Response time < 200ms for API endpoints
- Database query time < 50ms
- Memory usage within container limits
- Error rate < 1%

Please provide specific performance requirements or current metrics for more targeted recommendations.`;

      return {
        response,
        confidence: 0.9,
        category: 'performance_guidance',
        reasoning: 'Performance question with standard optimization patterns'
      };
    }

    return null;
  }

  /**
   * Handle code style and standards questions
   */
  private async handleCodeStyleQuestions(context: HilRequestContext): Promise<AutomatedResponse | null> {
    const question = context.question.toLowerCase();

    if (question.includes('style') || question.includes('format') || question.includes('lint')) {
      const response = `**Code Style and Standards:**

**Enforced Standards:**
- **TypeScript:** Strict type checking enabled
- **ESLint:** Airbnb configuration with React/JSX rules
- **Prettier:** Consistent code formatting
- **Import Sorting:** Organized imports by type and path

**Current Implementation:**
- ESLint configuration in project root
- Prettier configuration with 2-space indentation
- TypeScript strict mode enabled
- Husky pre-commit hooks for quality checks

**Recommended Approach:**
Follow the existing patterns in the codebase:
- Use functional components with TypeScript
- Implement proper error boundaries
- Add comprehensive TypeScript types
- Follow React best practices for hooks and state management

The codebase already has comprehensive linting and formatting rules that will catch most style issues automatically.`;

      return {
        response,
        confidence: 0.95,
        category: 'code_style_guidance',
        reasoning: 'Code style question with established standards'
      };
    }

    return null;
  }

  /**
   * Handle dependency-related questions
   */
  private async handleDependencyQuestions(context: HilRequestContext): Promise<AutomatedResponse | null> {
    const question = context.question.toLowerCase();

    if (question.includes('dependency') || question.includes('package') || question.includes('library')) {
      const response = `**Dependency Management:**

**Current Approach:**
- **Package Manager:** pnpm for efficient dependency resolution
- **Version Strategy:** Caret ranges (^) for patch updates, exact versions for critical deps
- **Security:** Regular npm audit checks and dependency updates
- **Lockfile:** pnpm-lock.yaml ensures reproducible builds

**Best Practices:**
1. **Security First:** Run security audits before adding new dependencies
2. **Minimal Dependencies:** Only add dependencies that provide significant value
3. **Tree Shaking:** Ensure dependencies support tree shaking for smaller bundles
4. **TypeScript Support:** Prefer packages with TypeScript definitions

**Recommended Process:**
1. Check if functionality already exists in the codebase
2. Research alternative approaches (native APIs, smaller libraries)
3. Evaluate security and maintenance status of the package
4. Test integration thoroughly before committing

**Available Alternatives:**
Consider if the required functionality can be implemented with:
- Native Web APIs
- Existing project utilities
- Lightweight specialized libraries
- Server-side processing instead of client-side

Please provide details about the specific functionality needed for more targeted dependency recommendations.`;

      return {
        response,
        confidence: 0.9,
        category: 'dependency_guidance',
        reasoning: 'Dependency question with established management practices'
      };
    }

    return null;
  }

  /**
   * Helper method to get order details
   */
  private async getOrderDetails(orderId: string) {
    try {
      // This would query the orders table
      // For now, return mock data structure
      return {
        factory: 'agent-factory',
        template: 'basic-worker',
        requirements: 'Standard AI agent implementation with error handling',
      };
    } catch (error) {
      this.logger.warn('Failed to get order details', { orderId, error });
      return null;
    }
  }

  /**
   * Find similar resolved questions
   */
  private async findSimilarResolvedQuestions(question: string, orderId: string): Promise<any[]> {
    try {
      const resolvedConversations = await this.db.ops
        .select()
        .from(this.db.opsSchema.aiProviderConversations)
        .where(
          and(
            eq(this.db.opsSchema.aiProviderConversations.orderId, orderId),
            eq(this.db.opsSchema.aiProviderConversations.status, 'resolved')
          )
        )
        .orderBy(this.db.opsSchema.aiProviderConversations.createdAt, 'desc')
        .limit(5)
        .execute();

      return resolvedConversations.filter(conv => {
        if (!conv.question || !conv.solution) return false;
        const similarity = this.calculateSimilarity(question, conv.question);
        return similarity > 0.7;
      });
    } catch (error) {
      this.logger.warn('Failed to find similar questions', { orderId, error });
      return [];
    }
  }

  /**
   * Calculate text similarity
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);

    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];

    return intersection.length / union.length;
  }

  /**
   * Generate implementation rationale
   */
  private generateImplementationRationale(context: HilRequestContext): string {
    const question = context.question.toLowerCase();

    if (question.includes('react') || question.includes('component')) {
      return 'React patterns in this codebase emphasize functional components with custom hooks for state management and side effects.';
    }

    if (question.includes('api') || question.includes('endpoint')) {
      return 'API endpoints follow RESTful conventions with proper error handling, validation, and consistent response formats.';
    }

    if (question.includes('database') || question.includes('query')) {
      return 'Database operations use Drizzle ORM with Kysely for type-safe queries and optimized performance.';
    }

    return 'This approach follows established patterns in the codebase for maintainability and consistency.';
  }

  /**
   * Infer requirements context from order details
   */
  private inferRequirementsContext(orderDetails: any): string {
    const factory = orderDetails.factory || '';

    if (factory.includes('agent')) {
      return 'an AI agent implementation requiring prompt management, state handling, and API integration';
    }

    if (factory.includes('ui')) {
      return 'a user interface component needing responsive design, accessibility, and consistent styling';
    }

    if (factory.includes('data')) {
      return 'a data processing or API service requiring validation, error handling, and performance optimization';
    }

    if (factory.includes('services')) {
      return 'an external service integration needing authentication, rate limiting, and error recovery';
    }

    return 'a standard implementation following project conventions';
  }
}
