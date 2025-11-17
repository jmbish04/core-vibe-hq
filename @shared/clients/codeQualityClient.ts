/**
 * Code Quality Client - Client for reporting code changes to the CodeQualityMonitor
 *
 * Agents use this client to report code changes for real-time quality monitoring.
 */

import PartySocket from 'partysocket';

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
 * CodeQualityClient handles communication with the CodeQualityMonitor
 */
export class CodeQualityClient {
  private socket: PartySocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(
    private monitorUrl: string,
    private agentId: string,
    private agentName: string
  ) {
    this.connect();
  }

  /**
   * Connect to the CodeQualityMonitor
   */
  private connect(): void {
    try {
      this.socket = new PartySocket({
        host: this.monitorUrl,
        room: 'code-quality-monitor',
        query: {
          clientId: this.agentId,
          agentName: this.agentName,
        },
      });

      this.socket.addEventListener('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log(`🔍 Code quality monitoring connected for agent ${this.agentName}`);
      });

      this.socket.addEventListener('close', () => {
        this.isConnected = false;
        console.warn(`⚠️ Code quality monitoring disconnected for agent ${this.agentName}`);
        this.attemptReconnect();
      });

      this.socket.addEventListener('error', (error) => {
        console.error(`❌ Code quality monitoring error for agent ${this.agentName}:`, error);
      });

      this.socket.addEventListener('message', (event) => {
        this.handleMessage(event.data);
      });

    } catch (error) {
      console.error(`❌ Failed to connect to code quality monitor for agent ${this.agentName}:`, error);
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`❌ Max reconnect attempts reached for agent ${this.agentName}`);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Max 30 seconds

    setTimeout(() => {
      console.log(`🔄 Reconnecting code quality monitor for agent ${this.agentName} (attempt ${this.reconnectAttempts})`);
      this.connect();
    }, delay);
  }

  /**
   * Handle incoming messages from the monitor
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'connected':
          console.log(`✅ Code quality monitor connected: ${message.message}`);
          break;

        case 'quality-violation':
          this.handleViolationAlert(message.violation, message.change);
          break;

        case 'agent-quarantined':
          this.handleQuarantineAlert(message.agentId, message.violation);
          break;

        case 'agent-released':
          this.handleReleaseAlert(message.agentId);
          break;

        case 'violation-update':
          console.log(`📝 Violation update for agent ${this.agentName}:`, message.violation);
          break;

        default:
          console.log(`📨 Code quality message for agent ${this.agentName}:`, message);
      }
    } catch (error) {
      console.error(`❌ Error handling code quality message for agent ${this.agentName}:`, error);
    }
  }

  /**
   * Handle quality violation alert
   */
  private handleViolationAlert(violation: QualityViolation, change: CodeChangeEvent): void {
    if (violation.agentId === this.agentId) {
      // This violation is about us!
      console.error(`🚨 CRITICAL: Code quality violation detected in my changes!`);
      console.error(`   Type: ${violation.type}`);
      console.error(`   Message: ${violation.message}`);
      console.error(`   File: ${violation.filePath}`);
      console.error(`   Severity: ${violation.severity}`);

      if (violation.quarantineRecommended) {
        console.error(`🔒 I HAVE BEEN QUARANTINED! Stopping all code modifications.`);
        this.handleQuarantine(violation);
      }

      // Emit event for agent to handle
      this.emitViolationEvent(violation, change);
    } else {
      // Violation by another agent - log for awareness
      console.warn(`⚠️ Code quality violation by agent ${violation.agentName}: ${violation.message}`);
    }
  }

  /**
   * Handle quarantine alert
   */
  private handleQuarantineAlert(quarantinedAgentId: string, violation: QualityViolation): void {
    if (quarantinedAgentId === this.agentId) {
      console.error(`🔒 EMERGENCY: I have been quarantined due to code quality violation!`);
      this.handleQuarantine(violation);
    } else {
      console.warn(`🚧 Agent ${quarantinedAgentId} has been quarantined: ${violation.message}`);
    }
  }

  /**
   * Handle agent release
   */
  private handleReleaseAlert(releasedAgentId: string): void {
    if (releasedAgentId === this.agentId) {
      console.log(`✅ I have been released from quarantine and can resume work.`);
      this.handleRelease();
    } else {
      console.log(`✅ Agent ${releasedAgentId} has been released from quarantine.`);
    }
  }

  /**
   * Report a code change for quality monitoring
   */
  public async reportCodeChange(change: Omit<CodeChangeEvent, 'agentId' | 'agentName' | 'timestamp'>): Promise<void> {
    const fullChange: CodeChangeEvent = {
      ...change,
      agentId: this.agentId,
      agentName: this.agentName,
      timestamp: new Date().toISOString(),
    };

    if (this.isConnected && this.socket) {
      try {
        this.socket.send(JSON.stringify({
          type: 'code-change',
          payload: fullChange,
        }));

        console.log(`📊 Reported code change to quality monitor: ${change.filePath} (${change.changeType})`);
      } catch (error) {
        console.error(`❌ Failed to report code change for agent ${this.agentName}:`, error);
      }
    } else {
      console.warn(`⚠️ Cannot report code change - not connected to quality monitor (agent: ${this.agentName})`);
    }
  }

  /**
   * Acknowledge a violation (mark as reviewed)
   */
  public acknowledgeViolation(violationId: string): void {
    if (this.isConnected && this.socket) {
      this.socket.send(JSON.stringify({
        type: 'violation-acknowledged',
        violationId,
      }));
    }
  }

  /**
   * Request agent release from quarantine
   */
  public requestRelease(): void {
    if (this.isConnected && this.socket) {
      this.socket.send(JSON.stringify({
        type: 'agent-released',
        agentId: this.agentId,
      }));
    }
  }

  /**
   * Handle quarantine - override in subclasses for specific behavior
   */
  protected handleQuarantine(violation: QualityViolation): void {
    // Default behavior - agents should override this
    console.error(`🔒 AGENT QUARANTINE PROTOCOL ACTIVATED`);
    console.error(`   Reason: ${violation.message}`);
    console.error(`   Immediate action required: Stop all code modifications`);
    console.error(`   Contact human operator for release`);

    // Emit custom event that agents can listen for
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('agent-quarantined', {
        detail: { violation, agentId: this.agentId }
      }));
    }
  }

  /**
   * Handle release - override in subclasses for specific behavior
   */
  protected handleRelease(): void {
    console.log(`✅ Agent quarantine lifted - resuming normal operations`);

    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('agent-released', {
        detail: { agentId: this.agentId }
      }));
    }
  }

  /**
   * Emit violation event for external handling
   */
  private emitViolationEvent(violation: QualityViolation, change: CodeChangeEvent): void {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('code-violation', {
        detail: { violation, change, agentId: this.agentId }
      }));
    }
  }

  /**
   * Disconnect from the monitor
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  }

  /**
   * Check if connected to monitor
   */
  public get isMonitorConnected(): boolean {
    return this.isConnected;
  }
}

/**
 * Factory function to create a code quality client for an agent
 */
export function createCodeQualityClient(
  monitorUrl: string,
  agentId: string,
  agentName: string
): CodeQualityClient {
  return new CodeQualityClient(monitorUrl, agentId, agentName);
}


