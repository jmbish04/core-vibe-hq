# Task Assignment: Auto vs Codex

## Strategy Overview

**Auto (Me/cursor)** - Best at:
- Reading codebase, understanding context, architectural decisions
- Type safety, TypeScript, complex type definitions
- Database schema design and migrations
- Following complex rules and patterns
- Coordination, integration, and planning

**Codex** - Best at:
- Executing specific implementations following detailed instructions
- Generating boilerplate code and service implementations
- Running commands, tests, and migrations
- Iterative implementation work
- API route implementations

---

## Task Assignments

### 🤖 **Auto (Me/cursor) - Architecture & Foundation**

#### Phase 1: Foundation
- **Task 1: Shared Contracts Module** ✅ (Complete)
  - Foundation work requiring deep understanding of the system
  - Type safety and Zod schema definitions
  - **Status**: Completed (Codex implementation, ready for review/usage)

- **Task 2: Database Schema Extensions** ✅ (Complete — cursor)
  - Type safety with Kysely
  - Schema design and migration planning
  - **Dependencies**: Task 1
  - **Status**: Completed (Drizzle schema + migrations aligned; ready for downstream API work)
  - **Follow-up**: Coordinate with Codex on using the new tables in API routes

#### Phase 2: Core Integration
- **Task 7: PatchOps Entrypoint**
  - Complex integration work
  - Entrypoint architecture
  - **Dependencies**: Tasks 1, 5, 6

- **Task 16: AI Provider Router**
  - Strategic routing logic
  - Provider selection algorithms
  - **Dependencies**: Tasks 1, 5

- **Task 17: Secret Service**
  - Security and architecture
  - Environment variable management
  - **Dependencies**: Tasks 1, 13

#### Phase 7: Integration
- **Task 26: Service Bindings Config**
  - Coordination work
  - Wrangler configuration
  - **Dependencies**: Tasks 1, 7, 19

- **Task 27: Route Registration**
  - Integration work
  - Router coordination
  - **Dependencies**: Multiple route tasks

#### Phase 8: Quality
- **Task 29: TypeScript Type Checking**
  - Type safety critical
  - Fixing type errors properly
  - **Dependencies**: Most implementation tasks

- **Task 30: Code Linting**
  - Code quality oversight
  - Ensuring standards
  - **Dependencies**: Most implementation tasks

---

### 🚀 **Codex - Implementation & Execution**

#### Phase 1: Foundation
- **Task 3: Patch Manager Python Script** ⏳ (In Progress — codex)
  - Python implementation
  - Bash wrapper script
  - **Dependencies**: Tasks 1, 2
  - **Notes**: Core contracts integrated; next up is migrations + CLI polish

- **Task 4: Factory Base Dockerfile**
  - Following detailed Dockerfile instructions
  - **Dependencies**: Task 3

#### Phase 2: Core Services
- **Task 5: Patch Services Directory**
  - Service implementation
  - TypeScript services
  - **Dependencies**: Tasks 1, 2, 3

- **Task 6: WebSocket Hub**
  - WebSocket implementation
  - Connection management
  - **Dependencies**: Tasks 1, 5

- **Task 8: WebSocket Routes**
  - Route implementation
  - **Dependencies**: Tasks 6, 1

#### Phase 3: Analytics & APIs
- **Task 9: Patch Logs API**
  - API route implementation
  - **Dependencies**: Tasks 1, 2, 8

- **Task 10: Patch Stats API**
  - API route implementation
  - **Dependencies**: Tasks 1, 2, 9

- **Task 11: Patch Trends API**
  - API route implementation
  - **Dependencies**: Tasks 1, 2, 9, 10

- **Task 12: Delivery Reports API**
  - API route implementation
  - **Dependencies**: Tasks 1, 2

#### Phase 4: Ops & Integrations
- **Task 13: GitHub Integrations Module**
  - GitHub API integration
  - **Dependencies**: Task 1

- **Task 14: Ops Scan Entrypoint**
  - Entrypoint implementation
  - **Dependencies**: Tasks 1, 5

- **Task 15: Scheduled Cron Handler**
  - Cron job implementation
  - **Dependencies**: Task 14

#### Phase 5: AI Provider Integration
- **Task 18: CLI Agent Service**
  - Container execution work
  - **Dependencies**: Tasks 4, 17

- **Task 19: AIProviderOps Entrypoint**
  - RPC implementation
  - **Dependencies**: Tasks 1, 16, 17

- **Task 20: Patch Processor Service**
  - Processing logic
  - **Dependencies**: Tasks 1, 3, 5, 17, 18

- **Task 21: AIProviderOps Entrypoint** (DUPLICATE - needs review)
  - Same as Task 19

#### Phase 6: Multi-Pass Refinement
- **Task 22: Patch Events Endpoint**
  - API implementation
  - **Dependencies**: Tasks 1, 2, 3, 5, 6

- **Task 23: Documentation**
  - Writing documentation
  - **Dependencies**: Tasks 1, 18, 20, 22

#### Phase 7: Factory Updates
- **Task 24: Update Factories to Use Shared Contracts**
  - Code updates across factories
  - **Dependencies**: Tasks 1, 20, 22

- **Task 25: Update Factory-to-Orchestrator Calls**
  - Implementation work
  - **Dependencies**: Tasks 1, 7, 20, 22, 24

#### Phase 8: Testing
- **Task 28: Database Migration Execution**
  - Running commands
  - Verification
  - **Dependencies**: Task 2

---

## Execution Plan

### Current Status
- **Auto**: Working on Task 1 (Shared Contracts Module)
- **Codex**: Ready to start when dependencies are met

### Next Steps for Codex
1. **Wait for Task 1 completion** (Auto is working on it)
2. **Then start Task 2** (Database Schema) - But wait, Task 2 is assigned to Auto
3. **Actually, Codex should start with Task 3** (Python Patch Manager) after Tasks 1 and 2 are done

### Coordination Rules
1. **Auto** will work on foundation tasks first (1, 2)
2. **Codex** will wait for dependencies, then start implementation tasks
3. **Communication**: Update task status in task-master when starting/completing
4. **Conflicts**: If both need the same file, Auto has priority (Auto will coordinate)

### Dependency Chain
```
Auto: 1 → 2 → 7, 16, 17 → 26, 27 → 29, 30
Codex: (wait for 1,2) → 3 → 4, 5, 6, 8 → 9-15, 18-25 → 28
```

---

## Quick Reference Commands

### For Codex to start working:
```bash
# Get next task assigned to Codex
./scripts/codex-task.sh next

# Or work on specific task
./scripts/codex-task.sh 3  # Python Patch Manager
```

### For Auto to check Codex progress:
```bash
npx task-master-ai list --status=in-progress
```

---

## Notes
- Task 21 appears to be a duplicate of Task 19 - should be reviewed
- Task 2 is currently assigned to Auto but Codex could help with the SQL migration generation
- Both agents should update task status when starting/completing work

