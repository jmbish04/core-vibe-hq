---
name: Smoke Test Failure
description: Report a smoke test failure
title: "[SMOKE FAIL] "
labels: ["smoke-test", "bug"]
assignees: []
---

## Smoke Test Failure

### Test Details
- **Test Name**: [e.g., infrastructure.test.ts, health.test.ts]
- **Test Category**: [infrastructure, health, api, workers, ui, factories, ai-providers, patches, automation, errors]
- **Failure Location**: [file path and line number]

### Error Details
**Error Message:**
```

```

**Stack Trace:**
```

```

**Test Output:**
```

```

### Environment
- **Component**: [e.g., health-system, ui-factory, orchestrator]
- **Worker**: [e.g., agent-factory, data-factory]
- **Test Environment**: [local, staging, production]
- **Node Version**: [e.g., 18.0.0]
- **Wrangler Version**: [e.g., 3.0.0]

### Steps to Reproduce
1. Run smoke test: `npm run smoke:[category]`
2. Observe failure in test output
3. Check logs for additional details

### Expected vs Actual
- **Expected**: Test should pass
- **Actual**: Test failed with above error

### Impact Assessment
- [ ] Blocks deployment
- [ ] Affects core functionality
- [ ] Minor issue, can be deferred
- [ ] Cosmetic only

### Recent Changes
List any recent changes that might have caused this failure:

### Additional Context
- Related test failures:
- Previous test status:
- Logs and diagnostics:
