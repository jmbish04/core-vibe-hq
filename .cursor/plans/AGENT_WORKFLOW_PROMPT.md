# Agent Workflow Prompt Template

Use this prompt when assigning work to agents (codex, cursor-composer1, cursor-composer-2, cursor-gpt5-codex):

---

## Prompt for Agents

You are working on the Core Vibe HQ Implementation Plan to reach stage smoke. Follow these instructions carefully:

### 1. Read the Plan First

Read the implementation plan at: `.cursor/plans/health-system-recon-worker-deployment-73d9b111.plan.md`

**CRITICAL**: The plan contains detailed workflow instructions at the top (section "⚠️ CRITICAL: Agent Workflow & Status Tracking"). Read this section completely before starting any work.

### 2. Check Your Assignments

**Find tasks assigned to you:**

- **codex**: Look for tasks assigned to "codex" - typically ops monitoring, AI provider work, factory tooling, specialist automation
- **cursor-composer1**: Look for tasks assigned to "cursor-composer1" - typically health system, RPC/API work, database consolidation
- **cursor-composer-2**: Look for tasks assigned to "cursor-composer-2" - typically UI work, frontend integration, telemetry dashboards
- **cursor-gpt5-codex**: Look for tasks assigned to "cursor-gpt5-codex" - typically testing infrastructure, smoke tests, bug fixes, tooling

**Search the plan file for**: `**Assigned To**: [your-agent-name]`

**IMPORTANT**: Only work on tasks explicitly assigned to you. Do NOT work on tasks assigned to other agents unless explicitly asked.

### 3. Before Starting Work

1. **Check task status**: Look for `**Status**: pending` or `**Status**: in-progress`
2. **Check dependencies**: Ensure all dependencies (listed in `**Dependencies**: [X, Y]`) are completed
3. **Update status**: Change `**Status**: pending` to `**Status**: in-progress`
4. **Add dates**: Add `**Started**: YYYY-MM-DD` and `**Last Updated**: YYYY-MM-DD`
5. **Verify assignment**: Confirm the task shows `**Assigned To**: [your-agent-name]`

### 4. During Work

**Track everything in the plan:**

- **Bugs found**: Add to task's "Notes" section or create new task if significant
- **Fixes implemented**: Document in "Implementation Steps"
- **Improvements made**: Add to task details
- **Blockers**: Update status to `**Status**: blocked` + add `**Blocker**: [description]`
- **Progress**: Update `**Last Updated**: YYYY-MM-DD` regularly

### 5. Code Quality Monitoring (CRITICAL)

**🚨 CODE QUALITY VIOLATIONS WILL RESULT IN IMMEDIATE QUARANTINE**

**Before ANY code change:**
1. **Check Mission Control**: Visit Mission Control UI → Code Quality Monitor tab
2. **Verify no active quarantine**: If you're quarantined, STOP ALL WORK immediately
3. **Check for violations**: Look for any violations assigned to your agent name

**During code implementation:**
- **Report ALL code changes**: Use the CodeQualityClient to report every file modification
- **NEVER drop placeholders**: If you see comments like:
  - `// ... (other agent methods)`
  - `// ... (scheduled handler remains the same)`
  - `// ... (handler implementation here)`
  - **IMPLEMENT THE FUNCTIONALITY** instead of dropping the comment
- **Complete all TODOs**: Never leave incomplete implementations or NotImplementedError throws
- **Watch for quarantine alerts**: If quarantined, cease all code modifications immediately

**If quarantined:**
1. **STOP ALL CODE CHANGES** - Do not make any more modifications
2. **Document the violation** - Add to task notes: `**QUARANTINE**: [violation details]`
3. **Wait for human review** - Contact human operator for release
4. **Resume only after release** - Status will change from "quarantined" to "clean"

**Violation types to avoid:**
- **PLACEHOLDER_DROPPED**: Dropping `// ... (other methods)` without implementation
- **INCOMPLETE_CODE**: Empty function bodies or NotImplementedError throws
- **MALFORMED_SYNTAX**: Broken brackets, incomplete statements
- **LOGIC_ERROR**: Incorrect logic implementations
- **SECURITY_RISK**: Security vulnerabilities introduced

### 6. Before Completing

**Complete the Status Update Checklist:**

- [ ] All implementation steps completed
- [ ] All files created/modified as specified
- [ ] Tests written and passing
- [ ] `npm run problems` passes
- [ ] Documentation updated
- [ ] **Code quality check**: No violations in Mission Control for your agent
- [ ] Task status updated: `**Status**: completed`
- [ ] Completion date added: `**Completed**: YYYY-MM-DD`
- [ ] To-dos section updated: `- [x] Complete Task XX: Task Name - [summary] (Completed: YYYY-MM-DD)`
- [ ] Any bugs found documented
- [ ] Any fixes implemented documented

### 7. Adding New Tasks

**If you find a bug or need to add work:**

1. **Check if it belongs to existing task**: Add to that task's "Notes" section
2. **If separate task needed**:
   - Use next available task number (check plan for highest number)
   - Add in appropriate phase section
   - Format: `### Task XX: [Description]`
   - Set: `**Status**: pending`, `**Priority**: [high/medium/low]`, `**Dependencies**: [list]`
   - Set: `**Assigned To**: [your-agent-name]`
   - Add to "To-dos" section at bottom

### 9. Status Update Format

**When updating task status, use this format:**

```markdown
### Task XX: Task Name

**Status**: in-progress | **Priority**: high | **Dependencies**: [39, 40]
**Assigned To**: [your-agent-name]
**Started**: 2025-11-09
**Last Updated**: 2025-11-09

[Implementation details...]

**Notes:**
- Bug found: [description] - Fixed in commit [hash]
- Improvement: [description]
- **QUARANTINE**: [violation details if quarantined]
```

**When completing:**

```markdown
**Status**: completed | **Priority**: high | **Dependencies**: [39, 40]
**Assigned To**: [your-agent-name]
**Started**: 2025-11-09
**Completed**: 2025-11-10
**Last Updated**: 2025-11-10
```

### 11. Stay Within Your Assignments

**DO:**
- ✅ Work only on tasks assigned to you
- ✅ Check dependencies before starting
- ✅ Update status regularly
- ✅ Document bugs and fixes
- ✅ Follow the plan's implementation steps
- ✅ **Check code quality status before starting work**
- ✅ **Report all code changes to quality monitor**
- ✅ **Stop immediately if quarantined**

**DON'T:**
- ❌ Work on tasks assigned to other agents
- ❌ Skip status updates
- ❌ Ignore dependencies
- ❌ Complete work without updating plan
- ❌ Use `as any` or type shortcuts (fix types properly)
- ❌ **Drop placeholder comments like `// ... (scheduled handler remains the same)`**
- ❌ **Remove `// ... (other agent methods)` without implementing the methods**
- ❌ **Leave incomplete TODOs or NotImplementedError throws**
- ❌ **Continue working while quarantined**

### 13. Example Workflow

```
1. Read plan file
2. Search for "Assigned To: [your-agent-name]"
3. Check Mission Control for quarantine status - STOP if quarantined
4. Find Task 39 (assigned to cursor-composer1)
5. Check status: pending
6. Check dependencies: [2] - verify Task 2 is completed
7. Update: Status → in-progress, Started → today's date
8. Report code changes to quality monitor as you work
9. Implement according to "Implementation Steps"
10. Update: Last Updated → today's date (as you progress)
11. Before completing: Check Mission Control for violations, run npm run problems
12. Update: Status → completed, Completed → today's date
13. Update To-dos section: - [x] Complete Task 39: Health Schema Consolidation
```

### 15. Questions?

If you're unsure about:
- **Assignment**: Search plan for your agent name
- **Dependencies**: Check if listed tasks are completed
- **Status format**: See examples in plan file
- **Adding tasks**: Follow format in plan's "How to Add New Tasks" section
- **Code quality**: Check Mission Control → Code Quality Monitor tab
- **Quarantine status**: Look for "QUARANTINED" badge in Mission Control

---

## Quick Reference

**Plan File**: `.cursor/plans/health-system-recon-worker-deployment-73d9b111.plan.md`

**Agent Assignments**:
- **codex**: Ops monitoring, AI providers, factory tooling, specialists
- **cursor-composer1**: Health system, RPC/API, database consolidation
- **cursor-composer-2**: UI, frontend, telemetry dashboards
- **cursor-gpt5-codex**: Testing, smoke tests, bug fixes, tooling, CI/CD

**Status Values**: `pending` → `in-progress` → `completed` (or `blocked`/`paused` if needed)

**Critical Commands**:
- `npm run problems` - Must pass before completing any task
- `npm run typecheck:all` - Check TypeScript errors
- `npm run lint:all` - Check linting errors

---

**Remember**: The plan is the source of truth. Always update it when working, and never complete work without updating the plan file.

