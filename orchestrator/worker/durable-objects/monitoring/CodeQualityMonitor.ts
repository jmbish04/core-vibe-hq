/**
 * CodeQualityMonitor - PartyServer-based Durable Object for real-time code quality monitoring
 *
 * Monitors AI agent code changes for quality violations and triggers immediate alerts + quarantine.
 * Uses partysync for real-time state synchronization across all connected agents and monitoring systems.
 */

import { Server } from 'partykit/partyserver';
import type { Connection, ConnectionContext } from 'partykit/partyserver';
import type { DurableObjectState } from 'cloudflare:workers';

// Dynamic import for partysync - will be null if not available
let partysyncAvailable = false;
let createSync: any = null;

(async () => {
  try {
    const partysync = await import('partysync');
    createSync = partysync.createSync;
    partysyncAvailable = true;
  } catch (error) {
    console.warn('partysync not available - code quality monitoring running in degraded mode');
  }
})();

export interface CodeQualityMonitorEnv {
  CODE_QUALITY_MONITOR: DurableObjectNamespace;
  // Add partysync bindings when installed
}

export interface CodeChangeEvent {
  agentId: string;
  agentName: string;
  filePath: string;
  changeType: 'insert' | 'replace' | 'delete' | 'reformat';
  oldContent?: string;
  newContent: string;
  timestamp: string;
  taskId?: string;
  commitHash?: string;
}

export interface QualityViolation {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  type: 'PLACEHOLDER_DROPPED' | 'INCOMPLETE_CODE' | 'MALFORMED_SYNTAX' | 'LOGIC_ERROR' | 'SECURITY_RISK';
  message: string;
  agentId: string;
  agentName: string;
  filePath: string;
  lineNumber?: number;
  codeSnippet: string;
  detectedAt: string;
  quarantineRecommended: boolean;
}

/**
 * CodeQualityMonitor manages real-time code quality monitoring and agent quarantine
 */
export class CodeQualityMonitor extends Server<CodeQualityMonitorEnv> {
  private activeViolations = new Map<string, QualityViolation>();
  private quarantinedAgents = new Set<string>();
  private connections = new Map<string, Connection>();
  private qualityStateSync: any = null;

  constructor(ctx: DurableObjectState, env: CodeQualityMonitorEnv) {
    super(ctx, env);

    // Initialize partysync for quality state if available
    if (partysyncAvailable && createSync) {
      this.qualityStateSync = createSync('code-quality-state', {
        initialState: {
          activeViolations: [],
          quarantinedAgents: [],
          lastUpdate: new Date().toISOString(),
        },
        onStateChange: (newState: any) => {
          // Sync local state with remote state
          this.activeViolations = new Map(
            newState.activeViolations.map((v: QualityViolation) => [v.id, v])
          );
          this.quarantinedAgents = new Set(newState.quarantinedAgents);
        }
      });
    }
  }

  async onConnect(connection: Connection, ctx: ConnectionContext): Promise<void> {
    const clientId = ctx.request.url.searchParams.get('clientId') || 'unknown';
    this.connections.set(clientId, connection);

    // Send welcome with current status
    connection.send(JSON.stringify({
      type: 'connected',
      message: 'Code quality monitoring connection established',
      timestamp: new Date().toISOString(),
      activeViolations: Array.from(this.activeViolations.values()),
      quarantinedAgents: Array.from(this.quarantinedAgents),
    }));
  }

  async onClose(connection: Connection): Promise<void> {
    // Remove connection from tracking
    for (const [clientId, conn] of this.connections.entries()) {
      if (conn === connection) {
        this.connections.delete(clientId);
        break;
      }
    }
  }

  async onMessage(connection: Connection, message: string | ArrayBuffer): Promise<void> {
    try {
      const data = typeof message === 'string' ? JSON.parse(message) : JSON.parse(new TextDecoder().decode(message));

      if (data.type === 'code-change') {
        await this.analyzeCodeChange(data.payload as CodeChangeEvent);
      } else if (data.type === 'violation-acknowledged') {
        this.acknowledgeViolation(data.violationId);
      } else if (data.type === 'agent-released') {
        this.releaseAgent(data.agentId);
      }
    } catch (error) {
      console.error('Error handling code quality message:', error);
    }
  }

  /**
   * Analyze code change for quality violations
   */
  private async analyzeCodeChange(change: CodeChangeEvent): Promise<void> {
    const violations: QualityViolation[] = [];

    // Check for placeholder shortcuts
    const placeholderViolations = this.detectPlaceholderViolations(change);
    violations.push(...placeholderViolations);

    // Check for incomplete code patterns
    const incompleteViolations = this.detectIncompleteCode(change);
    violations.push(...incompleteViolations);

    // Check for syntax issues
    const syntaxViolations = await this.detectSyntaxIssues(change);
    violations.push(...syntaxViolations);

    // Process violations
    for (const violation of violations) {
      await this.handleViolation(violation, change);
    }

    // If no violations, log clean change
    if (violations.length === 0) {
      this.broadcastCleanChange(change);
    }
  }

  /**
   * Detect placeholder shortcuts that agents commonly drop
   */
  private detectPlaceholderViolations(change: CodeChangeEvent): QualityViolation[] {
    const violations: QualityViolation[] = [];
    const content = change.newContent;

    // Common placeholder patterns that get dropped
    const placeholderPatterns = [
      /\/\/ \.\.\. \(other .*?\)/gi,
      /\/\/ \.\.\. \(scheduled handler .*?\)/gi,
      /\/\/ \.\.\. \(.*?(?:handler|method|function|remains the same).*?\)/gi,
      /\/\/ TODO: .*?methods/gi,
      /\/\/ \.\.\. remaining .*?/gi,
      /\/\* \.\.\. \*\/$/gm,
      /\/\/ Implement .*? methods/gi,
      /\/\/ Add .*? handlers/gi,
      /\/\/ \.\.\. .*?(?:remains|stays|unchanged|same).*?/gi,
      /throw new Error\('Not implemented'\)/gi,
      /\/\/ FIXME: .*?/gi,
    ];

    // Check if placeholders were removed (content became shorter and lacks implementation)
    if (change.oldContent && change.oldContent.length > content.length) {
      const hadPlaceholders = placeholderPatterns.some(pattern => pattern.test(change.oldContent!));
      const hasPlaceholders = placeholderPatterns.some(pattern => pattern.test(content));

      if (hadPlaceholders && !hasPlaceholders && this.isIncompleteImplementation(content)) {
        // Find which specific placeholder was dropped
        const droppedPatterns = placeholderPatterns.filter(pattern => pattern.test(change.oldContent!));
        const droppedPatternText = droppedPatterns.length > 0 ? droppedPatterns[0].source : 'placeholder comment';

        violations.push({
          id: `placeholder-${Date.now()}-${Math.random()}`,
          severity: 'CRITICAL',
          type: 'PLACEHOLDER_DROPPED',
          message: `Agent dropped placeholder comment "${droppedPatternText}" without implementing functionality`,
          agentId: change.agentId,
          agentName: change.agentName,
          filePath: change.filePath,
          codeSnippet: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
          detectedAt: new Date().toISOString(),
          quarantineRecommended: true,
        });
      }
    }

    // Check for remaining empty placeholder methods (including the new pattern)
    const emptyMethodMatches = content.match(/\/\/ \.\.\. \(.*?(?:other|scheduled handler|handler|method|function).*?\)[\s\S]*?^\s*}\s*$/gm);
    if (emptyMethodMatches) {
      violations.push({
        id: `empty-methods-${Date.now()}-${Math.random()}`,
        severity: 'HIGH',
        type: 'INCOMPLETE_CODE',
        message: `Found ${emptyMethodMatches.length} empty method placeholders (e.g., "// ... (scheduled handler remains the same)")`,
        agentId: change.agentId,
        agentName: change.agentName,
        filePath: change.filePath,
        codeSnippet: emptyMethodMatches.slice(0, 2).join('\n\n') + (emptyMethodMatches.length > 2 ? '\n...' : ''),
        detectedAt: new Date().toISOString(),
        quarantineRecommended: false,
      });
    }

    return violations;
  }

  /**
   * Detect incomplete code implementations
   */
  private detectIncompleteCode(change: CodeChangeEvent): QualityViolation[] {
    const violations: QualityViolation[] = [];
    const content = change.newContent;

    // Check for methods that just throw NotImplementedError
    const notImplementedMatches = content.match(/throw new Error\(['"`]Not implemented['"`]\)/gi);
    if (notImplementedMatches && notImplementedMatches.length > 3) {
      violations.push({
        id: `not-implemented-${Date.now()}-${Math.random()}`,
        severity: 'HIGH',
        type: 'INCOMPLETE_CODE',
        message: `Found ${notImplementedMatches.length} unimplemented methods`,
        agentId: change.agentId,
        agentName: change.agentName,
        filePath: change.filePath,
        codeSnippet: 'Multiple "Not implemented" errors found',
        detectedAt: new Date().toISOString(),
        quarantineRecommended: false,
      });
    }

    // Check for empty function bodies
    const emptyFunctions = content.match(/function\s+\w+\s*\([^)]*\)\s*{\s*}/g);
    if (emptyFunctions && emptyFunctions.length > 2) {
      violations.push({
        id: `empty-functions-${Date.now()}-${Math.random()}`,
        severity: 'MEDIUM',
        type: 'INCOMPLETE_CODE',
        message: `Found ${emptyFunctions.length} empty function implementations`,
        agentId: change.agentId,
        agentName: change.agentName,
        filePath: change.filePath,
        codeSnippet: emptyFunctions.slice(0, 2).join('\n') + (emptyFunctions.length > 2 ? '\n...' : ''),
        detectedAt: new Date().toISOString(),
        quarantineRecommended: false,
      });
    }

    return violations;
  }

  /**
   * Detect syntax and logical issues
   */
  private async detectSyntaxIssues(change: CodeChangeEvent): Promise<QualityViolation[]> {
    const violations: QualityViolation[] = [];
    const content = change.newContent;

    // Basic syntax checks
    try {
      // Try to parse as JavaScript/TypeScript (basic check)
      if (change.filePath.endsWith('.ts') || change.filePath.endsWith('.js')) {
        // Look for obvious syntax errors
        const bracketCount = (content.match(/\{/g) || []).length - (content.match(/\}/g) || []).length;
        if (Math.abs(bracketCount) > 2) {
          violations.push({
            id: `syntax-brackets-${Date.now()}-${Math.random()}`,
            severity: 'HIGH',
            type: 'MALFORMED_SYNTAX',
            message: `Unmatched brackets detected (${bracketCount > 0 ? 'missing closing' : 'extra closing'} brackets)`,
            agentId: change.agentId,
            agentName: change.agentName,
            filePath: change.filePath,
            codeSnippet: 'Bracket mismatch detected',
            detectedAt: new Date().toISOString(),
            quarantineRecommended: true,
          });
        }

        // Check for incomplete statements
        const incompleteStatements = content.match(/^\s*(if|for|while|function|class|interface)\s*.*[^;{}\s]$/gm);
        if (incompleteStatements && incompleteStatements.length > 0) {
          violations.push({
            id: `incomplete-statements-${Date.now()}-${Math.random()}`,
            severity: 'MEDIUM',
            type: 'MALFORMED_SYNTAX',
            message: `Found ${incompleteStatements.length} potentially incomplete statements`,
            agentId: change.agentId,
            agentName: change.agentName,
            filePath: change.filePath,
            codeSnippet: incompleteStatements.slice(0, 2).join('\n') + (incompleteStatements.length > 2 ? '\n...' : ''),
            detectedAt: new Date().toISOString(),
            quarantineRecommended: false,
          });
        }
      }
    } catch (error) {
      // If we can't even parse basic structure, that's a violation
      violations.push({
        id: `parse-error-${Date.now()}-${Math.random()}`,
        severity: 'CRITICAL',
        type: 'MALFORMED_SYNTAX',
        message: 'Code contains unparseable syntax errors',
        agentId: change.agentId,
        agentName: change.agentName,
        filePath: change.filePath,
        codeSnippet: 'Syntax parsing failed',
        detectedAt: new Date().toISOString(),
        quarantineRecommended: true,
      });
    }

    return violations;
  }

  /**
   * Check if implementation looks incomplete
   */
  private isIncompleteImplementation(content: string): boolean {
    const lines = content.split('\n').filter(line => line.trim().length > 0);

    // If very short and has placeholders, likely incomplete
    if (lines.length < 10 && /\/\/ \.\.\./.test(content)) {
      return true;
    }

    // If mostly comments and placeholders
    const codeLines = lines.filter(line => !line.trim().startsWith('//') && !line.trim().startsWith('/*'));
    const commentLines = lines.filter(line => line.trim().startsWith('//') || line.trim().startsWith('/*'));

    return codeLines.length < commentLines.length * 0.5;
  }

  /**
   * Handle detected violation
   */
  private async handleViolation(violation: QualityViolation, change: CodeChangeEvent): Promise<void> {
    // Store violation
    this.activeViolations.set(violation.id, violation);

    // Quarantine agent if recommended
    if (violation.quarantineRecommended) {
      this.quarantinedAgents.add(violation.agentId);
      await this.quarantineAgent(violation.agentId, violation);
    }

    // Sync state via partysync if available
    if (this.qualityStateSync) {
      this.qualityStateSync.setState({
        activeViolations: Array.from(this.activeViolations.values()),
        quarantinedAgents: Array.from(this.quarantinedAgents),
        lastUpdate: new Date().toISOString(),
      });
    }

    // Broadcast violation to all connected clients
    this.broadcastViolation(violation, change);

    // Log to health monitoring system
    console.error(`🚨 CODE QUALITY VIOLATION: ${violation.message}`, {
      violation,
      change,
    });
  }

  /**
   * Quarantine an agent
   */
  private async quarantineAgent(agentId: string, violation: QualityViolation): Promise<void> {
    // Broadcast quarantine action
    this.broadcastQuarantine(agentId, violation);

    // In a real implementation, this would:
    // 1. Disable the agent's ability to make changes
    // 2. Notify human operators
    // 3. Log incident for review
    // 4. Trigger recovery workflow
  }

  /**
   * Release a quarantined agent
   */
  private releaseAgent(agentId: string): void {
    this.quarantinedAgents.delete(agentId);
    this.broadcastAgentRelease(agentId);
  }

  /**
   * Acknowledge a violation (mark as reviewed)
   */
  private acknowledgeViolation(violationId: string): void {
    const violation = this.activeViolations.get(violationId);
    if (violation) {
      violation.message += ' [ACKNOWLEDGED]';
      this.broadcastViolationUpdate(violation);
    }
  }

  // Broadcast methods
  private broadcastViolation(violation: QualityViolation, change: CodeChangeEvent): void {
    const message = JSON.stringify({
      type: 'quality-violation',
      violation,
      change,
      timestamp: new Date().toISOString(),
    });

    for (const connection of this.connections.values()) {
      connection.send(message);
    }
  }

  private broadcastCleanChange(change: CodeChangeEvent): void {
    const message = JSON.stringify({
      type: 'clean-code-change',
      change,
      timestamp: new Date().toISOString(),
    });

    for (const connection of this.connections.values()) {
      connection.send(message);
    }
  }

  private broadcastQuarantine(agentId: string, violation: QualityViolation): void {
    const message = JSON.stringify({
      type: 'agent-quarantined',
      agentId,
      violation,
      timestamp: new Date().toISOString(),
    });

    for (const connection of this.connections.values()) {
      connection.send(message);
    }
  }

  private broadcastAgentRelease(agentId: string): void {
    const message = JSON.stringify({
      type: 'agent-released',
      agentId,
      timestamp: new Date().toISOString(),
    });

    for (const connection of this.connections.values()) {
      connection.send(message);
    }
  }

  private broadcastViolationUpdate(violation: QualityViolation): void {
    const message = JSON.stringify({
      type: 'violation-update',
      violation,
      timestamp: new Date().toISOString(),
    });

    for (const connection of this.connections.values()) {
      connection.send(message);
    }
  }
}
