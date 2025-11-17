# Cloudflare Agents SDK Migration Recommendations

## Overview

This document analyzes where migrating to Cloudflare's Agents SDK (`agents` npm package) would provide the most value, split by:
- **apps/base** (vibesdk base template for factories/specialists)
- **orchestrator** (orchestrator worker)

Based on patterns from `STAGING/agents` and `STAGING/agents-starter`.

## Key Agents SDK Features

From reviewing the demo code, Cloudflare Agents SDK provides:

1. **`AIChatAgent`** - Built-in chat capabilities with message persistence
2. **Built-in WebSocket** - Automatic WebSocket handling via `routeAgentRequest()`
3. **State Management** - Automatic state sync between agent and clients
4. **MCP Integration** - Native Model Context Protocol support
5. **Scheduling** - Built-in task scheduling (one-time, delayed, cron)
6. **RPC Methods** - `@callable` decorator for exposing methods to clients
7. **Message Persistence** - Automatic message storage in SQL database
8. **Tool System** - Human-in-the-loop tool confirmation support
9. **Agent-to-Agent (A2A) Communication** - RPC-based communication between specialized agents
10. **Observability** - Built-in event system for analytics and monitoring

---

## 🎯 Key Insight from Gemini Analysis

**The single biggest opportunity for vibesdk is to refactor its custom agent orchestration and state management logic to use the primitives provided by the Cloudflare Agents SDK.**

**Current Pattern**: Single "smart" agent (`SimpleCodeGeneratorAgent`) using many tools (`exec-commands.ts`, `deploy-preview.ts`, `deep-debugger.ts`, etc.)

**Recommended Pattern**: Multiple specialized agents communicating via RPC (Agent-to-Agent pattern)

**Why This Matters**:
- vibesdk already implements many concepts (state, planning, tool use, agent-like assistants) that the Agents SDK formalizes
- Adopting Agents SDK would simplify the codebase, make it more robust, and align with native Cloudflare platform
- The A2A/RPC pattern enables better separation of concerns, reusability, and scalability
- Likely improves performance and unlocks new capabilities for agent-to-agent communication

**Architectural Shift**:
- **Before**: `CodingAgent` → `exec-commands` tool → Sandbox service
- **After**: `CodingAgent` → RPC call → `SandboxAgent` (stateful DO) → Sandbox service

---

# Part 1: apps/base (Vibesdk Base Template)

## Overview

The `apps/base` directory contains the vibesdk base template used by factories and specialist workers. This is where the main code generation agent lives.

---

## Current State Analysis

### 1. **SimpleCodeGeneratorAgent** ⭐⭐⭐ HIGH PRIORITY

**Location**: `apps/base/worker/agents/core/simpleGeneratorAgent.ts`

**Current Implementation**:
- Extends custom `Agent` class (similar pattern to Agents SDK)
- Manual WebSocket handling (`apps/base/worker/agents/core/websocket.ts`)
- Manual state management (`StateManager`)
- Manual SQL queries (`this.sql`)
- Manual message persistence
- Complex custom implementation (~2700 lines)

**Agents SDK Benefits**:
- ✅ **Built-in WebSocket** - Replace manual WebSocket handling
- ✅ **AIChatAgent** - Built-in chat message persistence
- ✅ **Automatic state sync** - Client-side state synchronization
- ✅ **MCP integration** - Native MCP support (you have custom MCP manager)
- ✅ **Scheduling** - Built-in task scheduling (you have manual alarms)

**Migration Value**: **HIGH** ⭐⭐⭐
- **Effort**: High (large codebase, but significant simplification)
- **Benefit**: Massive code reduction, better WebSocket handling, built-in features

---

# Part 2: Orchestrator Worker

## Overview

The `orchestrator/worker/agents/` directory contains agents that run on the orchestrator worker. These are currently stateless agents that extend `BaseAgent`.

---

## Current State Analysis

### 1. **ProjectClarificationAgent** ⭐⭐ MEDIUM PRIORITY

**Location**: `orchestrator/worker/agents/project-clarification/ProjectClarificationAgent.ts`

**Current Implementation**:
- Extends `BaseAgent` (stateless, not a Durable Object)
- Uses D1 database directly
- Manual WebSocket communication
- Manual conversation logging

**Agents SDK Benefits**:
- ✅ **AIChatAgent** - Built-in chat with message persistence
- ✅ **Automatic WebSocket** - Replace manual WebSocket handling
- ✅ **State sync** - Real-time card updates via built-in state sync
- ⚠️ **Durable Object requirement** - Would need to convert to DO

**Migration Value**: **MEDIUM** ⭐⭐
- **Effort**: Medium (convert to Durable Object, use AIChatAgent)
- **Benefit**: Better chat handling, automatic message persistence, WebSocket simplification
- **Note**: Currently stateless - migration would add stateful DO pattern

### 2. **AiProviderClarificationAgent** ⭐⭐ MEDIUM PRIORITY

**Location**: `orchestrator/worker/agents/AiProviderClarificationAgent.ts`

**Current Implementation**:
- Stateless agent (extends `BaseAgent`)
- Direct D1 database access
- Conversation logging to D1

**Agents SDK Benefits**:
- ✅ **AIChatAgent** - Built-in conversation management
- ⚠️ **Durable Object requirement** - Would need to convert to DO

**Migration Value**: **MEDIUM** ⭐⭐
- **Effort**: Medium (convert to DO, use AIChatAgent)
- **Benefit**: Better conversation handling, automatic persistence
- **Note**: Currently stateless - migration would add stateful DO pattern

### 3. **OrderInitAgent** ⭐ LOW PRIORITY (Skip)

**Location**: `orchestrator/worker/agents/OrderInitAgent.ts`

**Current Implementation**:
- Stateless agent (extends `BaseAgent`)
- Direct D1 database access
- No WebSocket or state management needed

**Agents SDK Benefits**:
- ❌ **Not applicable** - This is a stateless utility agent
- ⚠️ **No migration needed** - Current pattern is appropriate

**Migration Value**: **LOW** ⭐
- **Effort**: N/A
- **Benefit**: None - current stateless pattern is correct

### 4. **AnalyticsAgent** ⭐⭐ MEDIUM PRIORITY (New Opportunity)

**Current Implementation**:
- `orchestrator/staged_from_vibesdk/worker/services/analytics/AiGatewayAnalyticsService.ts`
- `orchestrator/staged_from_vibesdk/worker/database/services/AnalyticsService.ts`
- Traditional services called explicitly
- Analytics routes in `orchestrator/worker/api/routes/index.ts`

**Agents SDK Opportunity**: 
- Create autonomous `AnalyticsAgent` that subscribes to events from all agents
- Uses SDK's observability system (`packages/agents/src/observability/agent.ts`)
- Automatically logs: Agent:Call, Tool:Use, Token:Count, Error:Encountered
- Decouples analytics from core logic

**Benefits**:
- Zero coupling - analytics happens automatically
- No code changes needed in other agents
- Better separation of concerns
- Can aggregate analytics across all agents

**Migration Pattern**:
```typescript
// Current: Explicit analytics calls
const analyticsService = new AiGatewayAnalyticsService(env);
await analyticsService.logRequest(agentId, request);

// After: Autonomous AnalyticsAgent
export class AnalyticsAgent extends Agent<Env, AnalyticsState> {
  async onAgentEvent(event: ObservabilityEvent) {
    // Automatically receives events from all agents via SDK observability
    await this.logEvent(event);
  }
}
```

**Estimated Effort**: 1-2 weeks
**Benefit**: Automatic analytics, zero coupling, better observability

**Consideration**: Would need to evaluate if orchestrator agents should emit observability events that AnalyticsAgent can subscribe to

---

# Migration Recommendations

## apps/base Recommendations

### ✅ **HIGH PRIORITY: SimpleCodeGeneratorAgent**

**Location**: `apps/base/worker/agents/core/simpleGeneratorAgent.ts`

**Why Migrate**:
1. **Massive code simplification** - Replace ~2700 lines with Agents SDK patterns
2. **Built-in WebSocket** - Eliminate manual WebSocket handling (~500+ lines)
3. **AIChatAgent** - Built-in chat message persistence
4. **MCP integration** - Replace custom MCP manager with native support
5. **Scheduling** - Built-in task scheduling instead of manual alarms

**Migration Pattern**:
```typescript
// Current: Custom Agent class
export class SimpleCodeGeneratorAgent extends Agent<Env, CodeGenState> {
  // Manual WebSocket handling
  // Manual state management
  // Manual message persistence
}

// With Agents SDK: AIChatAgent
import { AIChatAgent } from "agents/ai-chat-agent";
import { routeAgentRequest } from "agents";

export class CodeGeneratorAgent extends AIChatAgent<Env, CodeGenState> {
  async onChatMessage(onFinish, options) {
    // Use built-in chat handling
    // Automatic message persistence
    // Built-in WebSocket streaming
  }
  
  // Built-in MCP support
  // Built-in scheduling
  // Built-in state sync
}

// Worker entry point
export default {
  async fetch(request, env, ctx) {
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
};
```

**Key Changes**:
1. Replace custom `Agent` with `AIChatAgent`
2. Remove manual WebSocket handling (`websocket.ts`)
3. Use `onChatMessage()` instead of custom message handling
4. Use built-in MCP support instead of custom `MCPManager`
5. Use built-in scheduling instead of manual alarms
6. Simplify state management (built-in sync)

**Estimated Effort**: 2-3 weeks
**Code Reduction**: ~1000-1500 lines
**Benefit**: Significant simplification, better maintainability

---

### 🎯 **CRITICAL OPPORTUNITY: Refactor Tools into Specialized Agents (A2A/RPC Pattern)**

**Gemini Analysis**: The single biggest opportunity for vibesdk is to refactor its custom agent orchestration and state management logic to use the primitives provided by the Cloudflare Agents SDK. Instead of a single "smart" agent using many tools, refactor vibesdk into a team of specialized agents that collaborate using the SDK's RPC and state management.

**Current Pattern**: Single `SimpleCodeGeneratorAgent` with many tools (`exec-commands.ts`, `deploy-preview.ts`, `deep-debugger.ts`, etc.)

**Recommended Pattern**: Multiple specialized agents communicating via RPC (Agent-to-Agent)

#### 1. **SandboxAgent** ⭐⭐⭐ HIGH PRIORITY

**Target Files**:
- `apps/base/worker/agents/tools/toolkit/exec-commands.ts`
- `apps/base/worker/services/sandbox/` (entire sandbox service)

**Current**: CodingAgent calls `exec-commands` tool → Sandbox service

**Recommended**: CodingAgent makes RPC call → `SandboxAgent` (stateful Durable Object)

**Benefits**:
- Encapsulates all sandbox logic (provisioning, file I/O, execution, terminal streams)
- Stateful agent maintains sandbox session state
- Better isolation and error handling
- Can be reused by other agents

**Migration Pattern**:
```typescript
// Current: Tool-based
const result = await agent.execCommands(['npm install'], true);

// After: Agent-to-Agent RPC
import { getCurrentAgent } from "agents";

const { agent } = getCurrentAgent<CodingAgent>();
const sandboxAgent = SandboxAgent.get(env.SandboxAgent, sandboxId);
const result = await sandboxAgent.executeCommands(['npm install'], { shouldSave: true });
```

**Estimated Effort**: 1-2 weeks
**Code Reduction**: ~300-400 lines (tool code + better encapsulation)

#### 2. **DebuggerAgent** ⭐⭐⭐ HIGH PRIORITY

**Target Files**:
- `apps/base/worker/agents/assistants/codeDebugger.ts`
- `apps/base/worker/agents/assistants/realtimeCodeFixer.ts`
- `apps/base/worker/agents/tools/toolkit/deep-debugger.ts`

**Current**: CodingAgent calls `deep_debug` tool → Debugger assistant

**Recommended**: OrchestratorAgent routes error → `DebuggerAgent` (stateful DO) → Returns fix

**Benefits**:
- Dedicated agent for debugging logic
- Maintains debugging session state
- Can be called by multiple agents (CodingAgent, OrchestratorAgent)
- Better separation of concerns

**Migration Pattern**:
```typescript
// Current: Tool-based
const debugResult = await agent.deepDebug({ issue: "Build failed" });

// After: Agent-to-Agent RPC
const debuggerAgent = DebuggerAgent.get(env.DebuggerAgent, sessionId);
const fix = await debuggerAgent.investigateAndFix({
  issue: "Build failed",
  codeContext: files,
  errorLogs: logs
});
```

**Estimated Effort**: 1-2 weeks
**Code Reduction**: ~200-300 lines

#### 3. **DeploymentAgent** ⭐⭐ MEDIUM PRIORITY

**Target Files**:
- `apps/base/worker/agents/tools/toolkit/deploy-preview.ts`
- Deployment-related code in `DeploymentManager`

**Current**: CodingAgent calls `deploy_preview` tool → Deployment logic

**Recommended**: CodingAgent makes RPC call → `DeploymentAgent` (stateful DO)

**Benefits**:
- Manages deployment history as part of its state
- Handles all Cloudflare API interactions
- Can track deployment status, rollbacks, etc.
- Better error recovery and retry logic

**Migration Pattern**:
```typescript
// Current: Tool-based
await agent.deployPreview(undefined, forceRedeploy);

// After: Agent-to-Agent RPC
const deploymentAgent = DeploymentAgent.get(env.DeploymentAgent, projectId);
const deployment = await deploymentAgent.deploy({
  files: generatedFiles,
  forceRedeploy: true
});
```

**Estimated Effort**: 1 week
**Code Reduction**: ~150-200 lines

#### 4. **OrchestratorAgent** ⭐⭐⭐ HIGH PRIORITY

**Target Files**:
- `apps/base/worker/agents/operations/PhaseGeneration.ts`
- `apps/base/worker/agents/operations/PhaseImplementation.ts`
- `apps/base/worker/agents/core/state.ts`
- `apps/base/worker/agents/services/implementations/StateManager.ts`

**Current**: Custom orchestration logic managing workflow (Plan → Implement → Debug → Deploy)

**Recommended**: `OrchestratorAgent` using Agents SDK manages workflow, calls specialized agents

**Benefits**:
- Replaces custom state management with SDK's built-in state
- Uses SDK's RPC for agent-to-agent communication
- Better workflow management (similar to LangGraph interest)
- Cleaner separation: OrchestratorAgent coordinates, specialized agents execute

**Migration Pattern**:
```typescript
// Current: Custom orchestration
export class SimpleCodeGeneratorAgent extends Agent {
  async generateAllFiles() {
    // Custom phase generation
    // Custom phase implementation
    // Custom state management
  }
}

// After: OrchestratorAgent with SDK
export class OrchestratorAgent extends AIChatAgent<Env, WorkflowState> {
  async executeWorkflow() {
    // Phase 1: Generate blueprint
    const blueprintAgent = BlueprintAgent.get(env.BlueprintAgent, sessionId);
    const blueprint = await blueprintAgent.generate(userPrompt);
    
    // Phase 2: Implement files
    const codingAgent = CodingAgent.get(env.CodingAgent, sessionId);
    const files = await codingAgent.implementPhase(blueprint);
    
    // Phase 3: Deploy
    const deploymentAgent = DeploymentAgent.get(env.DeploymentAgent, sessionId);
    await deploymentAgent.deploy({ files });
    
    // SDK manages state automatically
  }
}
```

**Estimated Effort**: 2-3 weeks
**Code Reduction**: ~500-700 lines (state management + orchestration)

---

### 🆕 **NEW AGENT OPPORTUNITIES** (Not Yet Realized)

These agents become possible with Agents SDK adoption:

#### 1. **AnalyticsAgent** ⭐⭐ MEDIUM PRIORITY

**Current**: 
- `apps/base/worker/services/analytics/AiGatewayAnalyticsService.ts`
- `apps/base/worker/database/services/AnalyticsService.ts`
- Traditional services that are called explicitly

**Opportunity**: Autonomous agent that subscribes to events from all other agents

**Benefits**:
- Decouples analytics from core logic
- Automatically logs: Agent:Call, Tool:Use, Token:Count, Error:Encountered
- Uses SDK's observability (`packages/agents/src/observability/agent.ts`)
- No code changes needed in other agents - analytics happens automatically

**Implementation**:
```typescript
export class AnalyticsAgent extends Agent<Env, AnalyticsState> {
  async onAgentEvent(event: ObservabilityEvent) {
    // Automatically receives events from all agents
    // Logs to D1 without other agents needing to know
    await this.logEvent(event);
  }
}
```

**Estimated Effort**: 1 week
**Benefit**: Automatic analytics, zero coupling

#### 2. **GuardrailAgent** ⭐⭐ MEDIUM PRIORITY

**Current**: 
- `apps/base/worker/agents/operations/Guardrail.md` (prompt-based)
- Guardrail logic embedded in agent

**Opportunity**: Formal "router" agent that validates requests before forwarding

**Benefits**:
- Validates user input for security, policy, intent
- Routes requests to appropriate agents using SDK RPC
- Can intercept agent-to-agent communication
- Better security isolation

**Implementation**:
```typescript
export class GuardrailAgent extends Agent<Env, GuardrailState> {
  @callable()
  async validateAndRoute(request: UserRequest) {
    // Validate security, policy, intent
    if (!this.isAllowed(request)) {
      throw new GuardrailViolationError();
    }
    
    // Route to appropriate agent
    const targetAgent = this.selectAgent(request);
    return await targetAgent.handle(request);
  }
}
```

**Estimated Effort**: 1-2 weeks
**Benefit**: Better security, policy enforcement, request routing

#### 3. **UserFeedbackAgent** (Human-in-the-Loop) ⭐⭐ MEDIUM PRIORITY

**Current**: 
- `apps/base/worker/agents/tools/toolkit/feedback.ts` (one-way operation)

**Opportunity**: Stateful agent for HITL workflows using SDK's elicitation patterns

**Benefits**:
- Pauses agent state when ambiguity detected
- Uses SDK transport to ask user for clarification
- Resumes state after user feedback
- More robust than simple "feedback" tool

**Implementation**:
```typescript
export class UserFeedbackAgent extends AIChatAgent<Env, FeedbackState> {
  async requestClarification(question: string, context: any) {
    // Pause current workflow
    this.pauseWorkflow();
    
    // Request user feedback via SDK elicitation
    const response = await this.elicitation.request({
      question,
      context
    });
    
    // Resume workflow with feedback
    this.resumeWorkflow(response);
  }
}
```

**Estimated Effort**: 1-2 weeks
**Benefit**: Better HITL workflows, stateful feedback handling

---

## Orchestrator Recommendations

### ⚠️ **MEDIUM PRIORITY: ProjectClarificationAgent**

**Location**: `orchestrator/worker/agents/project-clarification/ProjectClarificationAgent.ts`

**Why Migrate**:
1. **Better chat handling** - Built-in AIChatAgent for conversations
2. **Automatic WebSocket** - Replace manual WebSocket handling
3. **Message persistence** - Automatic conversation storage
4. **State sync** - Real-time card updates via built-in state sync

**Migration Pattern**:
```typescript
// Current: Stateless BaseAgent
export class ProjectClarificationAgent extends BaseAgent {
  // Manual WebSocket
  // Manual conversation logging
  // Manual state management
}

// With Agents SDK: AIChatAgent as Durable Object
import { AIChatAgent } from "agents/ai-chat-agent";

export class ProjectClarificationAgent extends AIChatAgent<Env, ClarificationState> {
  async onChatMessage(onFinish, options) {
    // Handle clarification conversation
    // Automatic message persistence
    // Built-in WebSocket streaming
  }
  
  // Use built-in state sync for card updates
  onStateUpdate(state: ClarificationState) {
    // Broadcast card updates via built-in state sync
  }
}
```

**Key Changes**:
1. Convert from stateless to stateful Durable Object
2. Use `AIChatAgent` for chat handling
3. Use built-in state sync for card updates
4. Remove manual WebSocket handling
5. Use built-in message persistence

**Estimated Effort**: 1-2 weeks
**Code Reduction**: ~200-300 lines
**Benefit**: Better chat UX, automatic persistence, WebSocket simplification

**Consideration**: Currently stateless - migration adds stateful DO pattern (may be beneficial for conversation state)

---

### ⚠️ **MEDIUM PRIORITY: AiProviderClarificationAgent**

**Location**: `orchestrator/worker/agents/AiProviderClarificationAgent.ts`

**Why Migrate**:
1. **Better conversation handling** - Built-in AIChatAgent
2. **Automatic persistence** - Built-in message storage
3. **Simpler code** - Less manual conversation management

**Migration Pattern**:
```typescript
// Current: Stateless BaseAgent
export class AiProviderClarificationAgent extends BaseAgent {
  // Manual conversation logging
}

// With Agents SDK: AIChatAgent as Durable Object
import { AIChatAgent } from "agents/ai-chat-agent";

export class AiProviderClarificationAgent extends AIChatAgent<Env, ClarificationState> {
  async onChatMessage(onFinish, options) {
    // Handle AI provider clarification
    // Automatic message persistence
  }
}
```

**Estimated Effort**: 1 week
**Code Reduction**: ~100-150 lines
**Benefit**: Better conversation handling, automatic persistence

**Consideration**: Currently stateless - migration adds stateful DO pattern

### ❌ **LOW PRIORITY: OrderInitAgent** (Skip)

**Location**: `orchestrator/worker/agents/OrderInitAgent.ts`

**Why NOT Migrate**:
- Stateless utility agent (no conversation, no WebSocket)
- Direct D1 database access is appropriate
- No state management needed
- Current pattern is correct

**Recommendation**: **DO NOT MIGRATE** - Current stateless pattern is appropriate

---

# Implementation Priority

## apps/base Priority

### Phase 1: Core Agent Migration (2-3 weeks)
1. ✅ **SimpleCodeGeneratorAgent** - Migrate to `AIChatAgent`
   - Biggest impact: ~1000-1500 lines of code reduction
   - Better WebSocket handling
   - Built-in MCP support
   - Built-in scheduling
   - **Location**: `apps/base/worker/agents/core/simpleGeneratorAgent.ts`

### Phase 2: Refactor Tools into Specialized Agents (4-6 weeks)
2. ✅ **SandboxAgent** - Refactor sandbox tools into dedicated agent
   - **Location**: `apps/base/worker/agents/tools/toolkit/exec-commands.ts` + `apps/base/worker/services/sandbox/`
   - **Impact**: ~300-400 lines reduction, better encapsulation
   
3. ✅ **DebuggerAgent** - Refactor debugging tools into dedicated agent
   - **Location**: `apps/base/worker/agents/assistants/codeDebugger.ts` + `deep-debugger.ts`
   - **Impact**: ~200-300 lines reduction, better separation
   
4. ✅ **DeploymentAgent** - Refactor deployment tools into dedicated agent
   - **Location**: `apps/base/worker/agents/tools/toolkit/deploy-preview.ts`
   - **Impact**: ~150-200 lines reduction, better state management

5. ✅ **OrchestratorAgent** - Refactor orchestration logic using SDK
   - **Location**: `apps/base/worker/agents/operations/` + state management
   - **Impact**: ~500-700 lines reduction, better workflow management

### Phase 3: New Agent Opportunities (2-4 weeks)
6. ⚠️ **AnalyticsAgent** - Autonomous analytics agent
   - **Impact**: Zero coupling, automatic analytics
   
7. ⚠️ **GuardrailAgent** - Request validation and routing agent
   - **Impact**: Better security, policy enforcement
   
8. ⚠️ **UserFeedbackAgent** - Human-in-the-loop agent
   - **Impact**: Better HITL workflows, stateful feedback

## Orchestrator Priority

### Phase 2: Medium-Value Migrations (2-3 weeks)
2. ⚠️ **ProjectClarificationAgent** - Migrate to `AIChatAgent` (if stateful DO pattern is desired)
   - **Location**: `orchestrator/worker/agents/project-clarification/ProjectClarificationAgent.ts`
   - **Consideration**: Currently stateless - migration adds stateful DO pattern

3. ⚠️ **AiProviderClarificationAgent** - Migrate to `AIChatAgent` (if stateful DO pattern is desired)
   - **Location**: `orchestrator/worker/agents/AiProviderClarificationAgent.ts`
   - **Consideration**: Currently stateless - migration adds stateful DO pattern

### Phase 3: New Agent Opportunities (1-2 weeks)
4. ⚠️ **AnalyticsAgent** - Autonomous analytics agent for orchestrator
   - **Location**: New agent using `orchestrator/staged_from_vibesdk/worker/services/analytics/`
   - **Consideration**: Would subscribe to observability events from orchestrator agents
   - **Benefit**: Automatic analytics, zero coupling

### Phase 4: Low Priority
5. ❌ **OrderInitAgent** - No migration needed (stateless pattern is correct)
   - **Location**: `orchestrator/worker/agents/OrderInitAgent.ts`

---

## Key Migration Patterns

### Pattern 1: Chat Agent Migration

```typescript
// Before: Custom Agent with manual WebSocket
export class MyAgent extends Agent<Env, State> {
  async onMessage(connection, message) {
    // Manual WebSocket handling
  }
}

// After: AIChatAgent with built-in features
import { AIChatAgent } from "agents/ai-chat-agent";

export class MyAgent extends AIChatAgent<Env, State> {
  async onChatMessage(onFinish, options) {
    // Built-in chat handling
    // Automatic message persistence
    // Built-in WebSocket streaming
  }
}
```

### Pattern 2: Worker Entry Point

```typescript
// Before: Manual routing
export default {
  async fetch(request, env, ctx) {
    // Manual WebSocket upgrade
    // Manual routing
  }
};

// After: routeAgentRequest helper
import { routeAgentRequest } from "agents";

export default {
  async fetch(request, env, ctx) {
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
};
```

### Pattern 3: MCP Integration

```typescript
// Before: Custom MCP manager
import { MCPManager } from './tools/mcpManager';

// After: Built-in MCP support
export class MyAgent extends AIChatAgent<Env, State> {
  async onChatMessage(onFinish, options) {
    // Access MCP tools via this.mcp.getAITools()
    const allTools = {
      ...tools,
      ...this.mcp.getAITools()
    };
  }
}
```

### Pattern 4: Scheduling

```typescript
// Before: Manual alarms
await this.alarms.schedule(300, 'cleanup', {});

// After: Built-in scheduling
import { getSchedulePrompt } from "agents/schedule";

// In tool definition
const scheduleTask = tool({
  description: "Schedule a task",
  inputSchema: scheduleSchema,
  execute: async ({ when, description }) => {
    const { agent } = getCurrentAgent<MyAgent>();
    agent!.schedule(when, "executeTask", description);
  }
});
```

### Pattern 5: Agent-to-Agent (A2A) RPC Communication

```typescript
// Before: Tool-based approach
const result = await agent.execCommands(['npm install']);

// After: Agent-to-Agent RPC
import { getCurrentAgent } from "agents";

// Get current agent context
const { agent } = getCurrentAgent<CodingAgent>();

// Call specialized agent via RPC
const sandboxAgent = SandboxAgent.get(env.SandboxAgent, sandboxId);
const result = await sandboxAgent.executeCommands(['npm install'], { shouldSave: true });
```

### Pattern 6: Specialized Agent with @callable Methods

```typescript
// SandboxAgent - Specialized agent for sandbox operations
export class SandboxAgent extends Agent<Env, SandboxState> {
  @callable({ description: "Execute commands in sandbox" })
  async executeCommands(commands: string[], options: { shouldSave?: boolean }) {
    // Sandbox-specific logic
    return await this.sandboxService.exec(commands, options);
  }
  
  @callable({ description: "Get sandbox logs" })
  async getLogs() {
    return await this.sandboxService.getLogs();
  }
}
```

### Pattern 7: Observability and Analytics Agent

```typescript
// AnalyticsAgent - Subscribes to events automatically
export class AnalyticsAgent extends Agent<Env, AnalyticsState> {
  async onAgentEvent(event: ObservabilityEvent) {
    // Automatically receives events from all agents via SDK observability
    await this.logEvent({
      type: event.type, // Agent:Call, Tool:Use, Token:Count, Error:Encountered
      agentId: event.agentId,
      timestamp: Date.now(),
      data: event.payload
    });
  }
}
```

---

---

# Migration Checklists

## apps/base Migration Checklist

### For SimpleCodeGeneratorAgent Migration

- [ ] Install `agents` package: `npm install agents`
- [ ] Update imports: Replace custom `Agent` with `AIChatAgent`
- [ ] Replace WebSocket handling: Use `onChatMessage()` instead of manual WebSocket
- [ ] Migrate MCP manager: Use built-in `this.mcp` instead of custom `MCPManager`
- [ ] Migrate scheduling: Use built-in scheduling tools instead of manual alarms
- [ ] Update worker entry point: Use `routeAgentRequest()` helper
- [ ] Test WebSocket connections: Verify automatic WebSocket handling works
- [ ] Test message persistence: Verify automatic message storage works
- [ ] Test state sync: Verify client-side state synchronization works
- [ ] Test MCP integration: Verify built-in MCP support works
- [ ] Test scheduling: Verify built-in scheduling works

### For SandboxAgent Migration (A2A Pattern)

- [ ] Create new `SandboxAgent` class extending `Agent`
- [ ] Add `@callable` methods for sandbox operations
- [ ] Migrate `exec-commands.ts` tool logic to SandboxAgent
- [ ] Update CodingAgent to use RPC calls instead of tools
- [ ] Add SandboxAgent DO binding to `wrangler.jsonc`
- [ ] Test RPC communication between agents
- [ ] Verify sandbox state persistence works

### For DebuggerAgent Migration (A2A Pattern)

- [ ] Create new `DebuggerAgent` class extending `AIChatAgent`
- [ ] Migrate `codeDebugger.ts` and `deep-debugger.ts` logic
- [ ] Add `@callable` methods for debugging operations
- [ ] Update CodingAgent to use RPC calls instead of tools
- [ ] Add DebuggerAgent DO binding to `wrangler.jsonc`
- [ ] Test debugging workflow via RPC

### For DeploymentAgent Migration (A2A Pattern)

- [ ] Create new `DeploymentAgent` class extending `Agent`
- [ ] Migrate `deploy-preview.ts` tool logic
- [ ] Add deployment history state management
- [ ] Add `@callable` methods for deployment operations
- [ ] Update CodingAgent to use RPC calls
- [ ] Add DeploymentAgent DO binding to `wrangler.jsonc`

### For OrchestratorAgent Migration

- [ ] Create new `OrchestratorAgent` class extending `AIChatAgent`
- [ ] Migrate phase generation/implementation logic
- [ ] Replace custom state management with SDK state
- [ ] Use RPC to call specialized agents (SandboxAgent, DebuggerAgent, etc.)
- [ ] Test workflow orchestration

## Orchestrator Migration Checklist

### For ProjectClarificationAgent Migration

- [ ] Convert to Durable Object: Add DO binding in `wrangler.jsonc`
- [ ] Migrate to AIChatAgent: Replace `BaseAgent` with `AIChatAgent`
- [ ] Update state management: Use built-in state sync
- [ ] Update WebSocket handling: Use built-in WebSocket
- [ ] Test conversation handling: Verify chat functionality works
- [ ] Test state sync: Verify real-time updates work

### For AiProviderClarificationAgent Migration

- [ ] Convert to Durable Object: Add DO binding in `wrangler.jsonc`
- [ ] Migrate to AIChatAgent: Replace `BaseAgent` with `AIChatAgent`
- [ ] Update conversation handling: Use built-in chat functionality
- [ ] Test conversation handling: Verify chat functionality works
- [ ] Test persistence: Verify automatic message storage works

### For AnalyticsAgent Migration (New Agent)

- [ ] Create new `AnalyticsAgent` class extending `Agent`
- [ ] Implement observability event subscription
- [ ] Migrate analytics service logic to agent
- [ ] Set up automatic event logging to D1
- [ ] Test observability event reception
- [ ] Verify analytics data is logged automatically
- [ ] Remove explicit analytics calls from other agents

---

# Benefits Summary

## apps/base Benefits

| Agent/Refactor | Current Lines | After Migration | Reduction | Key Benefits |
|-------|--------------|-----------------|-----------|-------------|
| **SimpleCodeGeneratorAgent** | ~2700 | ~1500-1700 | ~1000-1200 | WebSocket, MCP, scheduling, state sync |
| **SandboxAgent** (new) | ~400 (tool code) | ~200-300 | ~100-200 | Better encapsulation, stateful sessions |
| **DebuggerAgent** (new) | ~300 (tool code) | ~150-200 | ~100-150 | Better separation, reusable |
| **DeploymentAgent** (new) | ~200 (tool code) | ~100-150 | ~50-100 | Better state management, history tracking |
| **OrchestratorAgent** (refactor) | ~500 (orchestration) | ~200-300 | ~200-300 | SDK state management, RPC communication |

**apps/base Total Estimated Reduction**: ~1450-1950 lines of code

## Orchestrator Benefits

| Agent | Current Lines | After Migration | Reduction | Key Benefits |
|-------|--------------|-----------------|-----------|-------------|
| **ProjectClarificationAgent** | ~333 | ~200-250 | ~100-130 | Chat handling, WebSocket, persistence |
| **AiProviderClarificationAgent** | ~200 | ~100-150 | ~50-100 | Chat handling, persistence |
| **AnalyticsAgent** (new) | ~400 (service code) | ~200-300 | ~100-200 | Automatic analytics, zero coupling |

**Orchestrator Total Estimated Reduction**: ~250-430 lines of code

**Combined Total Estimated Reduction**: ~1700-2380 lines of code

---

## Risks and Considerations

### 1. **Durable Object Migration**
- **Risk**: Converting stateless agents to stateful DOs changes architecture
- **Mitigation**: Evaluate if stateful pattern is beneficial before migrating

### 2. **Breaking Changes**
- **Risk**: Agents SDK API may change
- **Mitigation**: Pin version, test thoroughly, monitor updates

### 3. **Learning Curve**
- **Risk**: Team needs to learn Agents SDK patterns
- **Mitigation**: Use demo code as reference, document patterns

### 4. **Custom Features**
- **Risk**: May lose some custom functionality
- **Mitigation**: Evaluate custom features vs Agents SDK features, adapt as needed

---

---

# Next Steps

## apps/base Next Steps

1. **Start with SimpleCodeGeneratorAgent** - Highest value migration
   - **Location**: `apps/base/worker/agents/core/simpleGeneratorAgent.ts`
   - **Impact**: ~1000-1200 lines of code reduction
2. **Create proof-of-concept** - Migrate a small portion first (e.g., WebSocket handling)
3. **Evaluate results** - Measure code reduction, performance, maintainability
4. **Refactor tools into specialized agents** - Implement A2A/RPC pattern:
   - Start with SandboxAgent (most used tool)
   - Then DebuggerAgent (complex logic)
   - Then DeploymentAgent (simpler)
   - Finally OrchestratorAgent (workflow coordination)
5. **Consider new agent opportunities** - Evaluate AnalyticsAgent, GuardrailAgent, UserFeedbackAgent
6. **Document patterns** - Create migration guide for future agents

## Orchestrator Next Steps

1. **Evaluate stateful DO pattern** - Decide if converting stateless agents to stateful DOs is beneficial
2. **If beneficial, start with ProjectClarificationAgent** - Most complex orchestrator agent
3. **Then migrate AiProviderClarificationAgent** - Simpler use case
4. **Consider AnalyticsAgent** - Evaluate if autonomous analytics agent would benefit orchestrator
   - Would subscribe to observability events from orchestrator agents
   - Could replace explicit analytics service calls
5. **Skip OrderInitAgent** - Current stateless pattern is correct

---

## References

- **Agents SDK Docs**: `STAGING/agents/packages/agents/README.md`
- **Demo Code**: `STAGING/agents-starter/src/server.ts`
- **MCP Examples**: `STAGING/agents/examples/mcp/src/server.ts`
- **Chat Examples**: `STAGING/agents/examples/playground/src/agents/chat.ts`
- **Official Docs**: https://developers.cloudflare.com/agents/

