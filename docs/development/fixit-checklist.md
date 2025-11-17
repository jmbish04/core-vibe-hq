# Fixit Checklist

This checklist provides a structured approach to investigating, fixing, and validating bug fixes in the Core Vibe HQ codebase.

## Pre-Fix Investigation

### Issue Understanding
- [ ] Read the complete issue description and understand the problem
- [ ] Review all comments, attachments, and related issues
- [ ] Clarify any ambiguous requirements with the reporter
- [ ] Understand the expected vs actual behavior
- [ ] Assess the impact and urgency of the issue

### Environment Setup
- [ ] Set up local environment matching the issue conditions
- [ ] Ensure correct Node.js, Wrangler, and dependency versions
- [ ] Configure environment variables and secrets
- [ ] Set up test data if needed

### Reproduction
- [ ] Follow exact reproduction steps from the issue
- [ ] Test on multiple browsers/devices if UI-related
- [ ] Test with different data sets if data-related
- [ ] Verify the issue occurs consistently
- [ ] Document exact reproduction steps for future reference

## Root Cause Analysis

### Code Investigation
- [ ] Locate the relevant code files and functions
- [ ] Review recent changes that might have introduced the issue
- [ ] Check for similar issues in the codebase
- [ ] Analyze error messages and stack traces
- [ ] Use debugging tools to understand the execution flow

### Data Analysis
- [ ] Check database state and data integrity
- [ ] Review API request/response data
- [ ] Analyze network requests and responses
- [ ] Check configuration and environment settings
- [ ] Review logs and monitoring data

### Pattern Recognition
- [ ] Identify if this is a known issue pattern
- [ ] Check if similar issues exist in other components
- [ ] Look for systemic problems vs isolated bugs
- [ ] Consider edge cases and race conditions

## Fix Planning

### Solution Design
- [ ] Identify the root cause of the issue
- [ ] Design a minimal, targeted fix
- [ ] Consider multiple solution approaches
- [ ] Evaluate trade-offs (complexity, performance, maintainability)
- [ ] Plan for backward compatibility

### Impact Assessment
- [ ] Identify all components that might be affected
- [ ] Assess risk of introducing regressions
- [ ] Plan testing strategy for the fix
- [ ] Consider performance implications
- [ ] Plan rollback strategy if needed

### Resource Planning
- [ ] Estimate time required for the fix
- [ ] Identify required expertise or help
- [ ] Plan for code review and testing time
- [ ] Schedule deployment and monitoring

## Fix Implementation

### Code Changes
- [ ] Create a feature branch for the fix
- [ ] Implement the fix with clear, readable code
- [ ] Add appropriate comments explaining the fix
- [ ] Follow existing code style and patterns
- [ ] Avoid over-engineering or unnecessary changes

### Test Creation
- [ ] Write unit tests that reproduce the bug
- [ ] Ensure tests fail before the fix
- [ ] Verify tests pass after the fix
- [ ] Add integration tests if needed
- [ ] Update existing tests if behavior changes

### Documentation Updates
- [ ] Update code comments if logic changed
- [ ] Update API documentation if endpoints changed
- [ ] Update README or guides if user-facing changes
- [ ] Document any configuration changes

## Fix Validation

### Local Testing
- [ ] Run unit tests and verify they pass
- [ ] Run integration tests and verify they pass
- [ ] Run smoke tests to catch regressions
- [ ] Test the fix manually with reproduction steps
- [ ] Test edge cases and error conditions

### Code Quality Checks
- [ ] Run `npm run typecheck:all` - no TypeScript errors
- [ ] Run `npm run lint:all` - no linting errors
- [ ] Run `npm run problems` - clean results
- [ ] Check for security vulnerabilities
- [ ] Review code for performance issues

### Peer Review
- [ ] Create pull request with detailed description
- [ ] Explain the root cause and fix approach
- [ ] Include test results and before/after screenshots
- [ ] Request review from appropriate team members
- [ ] Address all review feedback

## Deployment Preparation

### Deployment Planning
- [ ] Plan deployment timing and coordination
- [ ] Identify required deployment environments
- [ ] Prepare rollback procedures
- [ ] Coordinate with other teams if needed

### Pre-Deployment Checks
- [ ] Verify deployment scripts and configurations
- [ ] Check environment-specific settings
- [ ] Validate database migrations if any
- [ ] Confirm monitoring and alerting are in place

## Deployment & Monitoring

### Deployment Execution
- [ ] Deploy to staging environment first
- [ ] Verify fix works in staging
- [ ] Monitor for any issues in staging
- [ ] Get approval for production deployment

### Production Deployment
- [ ] Execute production deployment
- [ ] Monitor deployment progress
- [ ] Verify fix works in production
- [ ] Monitor error rates and performance metrics

### Post-Deployment Monitoring
- [ ] Monitor for 24-48 hours after deployment
- [ ] Check error logs and monitoring dashboards
- [ ] Verify user reports of issue resolution
- [ ] Monitor performance and resource usage

## Issue Resolution

### Issue Closure
- [ ] Update issue with fix details and testing results
- [ ] Link to pull request and deployment
- [ ] Mark issue as resolved
- [ ] Add resolution labels (e.g., `fixed`, `deployed`)

### Documentation
- [ ] Update troubleshooting guides if needed
- [ ] Document the fix in known issues/fixes
- [ ] Create post-mortem for critical issues
- [ ] Update runbooks or playbooks

## Continuous Improvement

### Learning Capture
- [ ] Document root cause analysis
- [ ] Identify prevention measures
- [ ] Update code review checklists
- [ ] Improve monitoring and alerting

### Process Improvement
- [ ] Review the fixit process for this issue
- [ ] Identify areas for automation or tooling
- [ ] Update templates or checklists based on lessons learned
- [ ] Share learnings with the team

## Quick Fix Checklist (< 1 hour)

For simple fixes that can be resolved quickly:

- [ ] Understand the issue
- [ ] Locate the problematic code
- [ ] Implement the fix
- [ ] Run `npm run problems`
- [ ] Test the fix manually
- [ ] Commit with descriptive message
- [ ] Update issue status

## Complex Fix Checklist (> 4 hours)

For complex fixes requiring careful planning:

- [ ] Create detailed investigation plan
- [ ] Break down into smaller tasks
- [ ] Get stakeholder approval for approach
- [ ] Implement incrementally with testing
- [ ] Conduct thorough code review
- [ ] Plan phased rollout if needed
- [ ] Prepare detailed rollback plan
- [ ] Schedule deployment during low-traffic period

## Emergency Fix Checklist

For critical issues requiring immediate action:

- [ ] Assess immediate impact and risk
- [ ] Alert relevant team members
- [ ] Implement temporary workaround if possible
- [ ] Create rapid fix with minimal testing
- [ ] Deploy immediately to staging
- [ ] Deploy to production after minimal validation
- [ ] Monitor closely for issues
- [ ] Schedule proper fix and testing

## Category-Specific Checklists

### API Bug Fixes
- [ ] Test all HTTP methods (GET, POST, PUT, DELETE)
- [ ] Test with various payload sizes
- [ ] Test authentication and authorization
- [ ] Test error responses and edge cases
- [ ] Verify API documentation is updated

### UI Bug Fixes
- [ ] Test on multiple browsers and devices
- [ ] Test with various screen sizes
- [ ] Test keyboard navigation and accessibility
- [ ] Test with screen readers if applicable
- [ ] Verify visual regression tests pass

### Database Bug Fixes
- [ ] Test with various data sets
- [ ] Test concurrent access scenarios
- [ ] Verify data integrity after fix
- [ ] Test migration scripts if schema changed
- [ ] Verify backup and recovery procedures

### Performance Bug Fixes
- [ ] Measure before and after performance
- [ ] Test with production-like data volumes
- [ ] Test under load conditions
- [ ] Monitor memory usage and garbage collection
- [ ] Verify no performance regressions in related areas

---

Use this checklist to ensure systematic, high-quality bug fixes that maintain code quality and prevent regressions.
