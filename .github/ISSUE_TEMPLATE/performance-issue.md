---
name: Performance Issue
description: Report a performance problem
title: "[PERFORMANCE] "
labels: ["performance", "bug"]
assignees: []
---

## Performance Issue Report

### Issue Description
A clear description of the performance problem.

### Metrics
**Current Performance:**
- Response time: [e.g., 2.5s average]
- Memory usage: [e.g., 150MB]
- CPU usage: [e.g., 85%]
- Throughput: [e.g., 50 req/sec]

**Expected Performance:**
- Target response time: [e.g., <500ms]
- Target memory usage: [e.g., <100MB]
- Target CPU usage: [e.g., <50%]
- Target throughput: [e.g., 200 req/sec]

### Profiling Data
**Performance Analysis:**
```

```

**Hotspots Identified:**
- Function/File: [location]
- CPU Time: [percentage]
- Memory Allocation: [amount]

### Environment
- **Component**: [e.g., health-system, ui-factory]
- **Load**: [e.g., 100 concurrent users, 1000 req/min]
- **Data Size**: [e.g., 10k records, 1GB database]
- **Node Version**: [e.g., 18.0.0]

### Steps to Reproduce
1. [Load testing setup]
2. [Trigger high load scenario]
3. [Monitor performance metrics]
4. [Observe degradation]

### Root Cause Analysis
**Likely Causes:**
- [ ] N+1 queries
- [ ] Memory leaks
- [ ] Inefficient algorithms
- [ ] Database bottlenecks
- [ ] Network latency
- [ ] Resource contention

**Code Location:**
```typescript
// Relevant code section
```

### Optimization Options
**Option 1: [Description]**
```typescript
// Proposed optimization
```

**Option 2: [Description]**
```typescript
// Alternative approach
```

### Impact Assessment
- [ ] Affects user experience
- [ ] Increases costs
- [ ] Limits scalability
- [ ] Minor performance issue

### Additional Context
- Monitoring dashboards:
- Historical trends:
- Related issues:
