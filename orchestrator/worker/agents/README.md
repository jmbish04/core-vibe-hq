# Orchestrator Agents

This directory contains agents that run on the orchestrator to handle various tasks.

## Current Agents

### Project Clarification Agent (`project-clarification/`)
An interactive agent that communicates with users via chat interface to:
- Understand and confirm project requirements through conversation
- Display a generative UI card in chat showing real-time project overview
- Update the PRD (Product Requirements Document) as the conversation evolves
- Log all conversations and actions to D1 and observability
- Store requirements in versioned D1 tables for traceability
- Push real-time updates to frontend via WebSocket when requirements change

**Example Flow:**
1. User describes a Discord bot worker
2. Agent shows card with: Backend (API, Auth, Webhook, Actions)
3. User confirms and adds: "Also needs a frontend that does X"
4. Card updates to show Frontend section added
5. PRD version incremented and stored in D1
6. Frontend receives WebSocket update showing new requirements

## Architecture

- **Base Agent Class**: All agents extend `BaseAgent` from `@shared/agents/base/BaseAgent.ts`
  - Provides common functionality: logging, error handling, WebSocket communication
  - Works in both orchestrator (direct DB access) and apps workers (via service bindings)
  - Automatically routes logging to D1 via orchestrator for apps workers
- **Database Schema**: Versioned requirements storage, conversation logs
- **WebSocket Integration**: Real-time updates to frontend
- **Observability**: Comprehensive logging to D1 and console

## Future Agents

- Code generation agent
- Deployment agent
- Testing agent
- Review agent

