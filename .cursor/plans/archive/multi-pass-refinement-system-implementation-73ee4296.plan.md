<!-- 73ee4296-4ccf-47d5-877d-c1724f18a174 1c0d56d7-e65f-43e9-8ca2-89a47ccfce98 -->
# Multi-Pass Refinement System Implementation

This plan implements the complete surgical multi-pass refinement pipeline system from the surgical_incremental_multipass_refinement_approach.md document.

## 1. Patch Manager Implementation

### Files to Create:

- `patch_manager.py` - Core Python script for deterministic code mutations
- `patchctl` - Bash wrapper for easy agent invocation
- `.mission_control/` directory structure (created automatically by script)

### Features:

- Line-based surgical edits (replace-block, insert-before, insert-after, append, prepend)
- Blank space padding for safe sequential edits
- Task validation via `.mission_control/tasks.json`
- Unified diff generation and logging
- Orchestrator webhook callbacks
- TypeScript type checking integration
- Dry-run mode for preview

### Integration Points:

- Orchestrator callback endpoint: `/api/patches/events` (needs to be added to orchestrator)
- Task file format: `.mission_control/tasks.json` (orchestrator generates this)
- Environment variables: `ORCHESTRATOR_URL`, `ORCHESTRATOR_TOKEN`

## 2. Documentation Creation

### Files to Create:

- `docs/development/patch-manager.md` - Comprehensive Patch Manager guide
- `docs/development/multi-pass-refinement.md` - Specialist agent system overview
- `docs/development/specialist-agents.md` - Detailed specialist agent specifications

### Documentation Updates:

- Update `docs/OVERVIEW.md` with new documentation entries
- Cross-reference with existing agent-instructions.md

### Content:

- Problem statement (clobbering agent issue)
- Solution architecture (Patch Manager as deterministic proxy)
- Workflow diagrams and data flow
- Usage examples and CLI reference
- Integration with orchestrator and factories
- Specialist agent roles and responsibilities

## 3. Multi-Pass Specialist Agent System

### Architecture Components:

#### Specialist Agent Types (from document):

1. **Macro Tier Specialists:**

- Template Synthesizer (clones templates, injects placeholders)
- AI Coder (fills placeholders with business logic)
- DocString Architect (adds consistent docstrings)

2. **Micro Tier Specialists:**

- Lint & Syntax Surgeon (runs lint, tsc, formatting)
- Dependency Auditor (validates imports, versions)
- Schema Guardian (ensures Zod schemas, Drizzle alignment)
- Optimization Advisor (detects inefficient patterns)
- Test Fabricator (builds test stubs)
- Replay Verifier (re-runs traces for verification)
- Delivery Judge (cross-checks NL → task → code)

3. **Ops Tier Specialists:**

- Conflict Resolver (already exists)
- Follow-Up Analyst (scans blocked tasks)
- Delivery Publisher (consolidates reports)

### Implementation Approach:

#### Phase 1: Foundation

- Create specialist agent base classes/interfaces
- Define specialist queue/worker structure
- Create orchestrator endpoints for specialist coordination
- Add patch event endpoint to orchestrator (`/api/patches/events`)

#### Phase 2: Core Specialists

- Implement DocString Architect specialist
- Implement Lint & Syntax Surgeon specialist
- Implement Dependency Auditor specialist
- Create specialist worker structure in `apps/ops-specialists/`

#### Phase 3: Advanced Specialists

- Implement Schema Guardian
- Implement Optimization Advisor
- Implement Test Fabricator
- Implement Replay Verifier
- Implement Delivery Judge

### Integration Points:

- Queue system: Cloudflare Queues for specialist job distribution
- Orchestrator coordination: RPC endpoints for specialist handoff
- D1 logging: `operation_logs` table for traceability
- GitHub integration: Use existing GitHubOrchestratorClient for branch management

## 4. Summary/Overview Document

### Files to Create:

- `docs/development/multi-pass-overview.md` - High-level system overview
- Update main README.md if needed

### Content:

- Executive summary of the multi-pass approach
- Problem → Solution → Architecture flow
- Key benefits and safety guarantees
- Visual workflow diagrams
- Quick reference for specialist roles
- Integration with existing orchestrator/factory system

## Implementation Order

1. **Patch Manager** (Foundation - required for all specialists)
2. **Documentation** (Can be done in parallel with implementation)
3. **Specialist Agent Base Architecture** (Infrastructure and base classes)
4. **Orchestrator Integration** (Patch events endpoint, specialist dispatch service)
5. **Core Specialists** (DocString, Code Hygienist, Dependency, DatabaseORM, Modularization)
6. **Quality Specialists** (Schema Guardian, Schema Validation, Interfaces, Optimization, Documentation)
7. **Testing Specialists** (Test Fabricator, Replay Verifier, Delivery Judge)
8. **Ops Specialists** (Health Check, Cost Tracking, Health Advisor, enhancements to existing)
9. **Coordinating Agents** (Planner, Code Review, Tech Debt, ColbyRules)
10. **Overview Document** (Final summary and integration guide)

## Key Considerations

- All specialists must use `patchctl` for code changes (no direct file writes)
- Task validation via `.mission_control/tasks.json` with `allowed_spans`
- Sequential specialist execution via orchestrator queue management
- Full audit trail via D1 `operation_logs` and patch diff files
- Integration with existing orchestrator entrypoints and service bindings