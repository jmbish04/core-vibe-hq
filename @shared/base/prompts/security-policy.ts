/**
 * @shared/base/prompts/security-policy.ts
 *
 * Security guidelines and best practices for Cloudflare Workers.
 */

import type { PromptTemplate } from './types';

export const SECURITY_POLICY_PROMPT: PromptTemplate = {
  id: 'security-policy',
  name: 'Security Development Policy',
  description: 'Security guidelines and best practices',
  version: '1.0.0',
  tags: ['security', 'best-practices', 'validation'],
  dependencies: ['cloudflare-base'],
  priority: 95, // Very high priority for security
  content: `# Security Development Policy

## Authentication & Authorization
- Implement proper authentication mechanisms
- Use secure token handling
- Validate user permissions
- Implement rate limiting

## Input Validation
- Validate all user inputs
- Sanitize data before processing
- Use parameterized queries to prevent SQL injection
- Implement proper type checking

## Data Protection
- Encrypt sensitive data at rest
- Use secure communication protocols
- Implement proper session management
- Follow principle of least privilege

## CORS & Headers
- Configure CORS properly
- Set security headers appropriately
- Prevent clickjacking attacks
- Implement content security policies`
};

// Auto-register the template
if (typeof globalThis !== 'undefined' && (globalThis as any).promptBuilder) {
  (globalThis as any).promptBuilder.register(SECURITY_POLICY_PROMPT);
}
