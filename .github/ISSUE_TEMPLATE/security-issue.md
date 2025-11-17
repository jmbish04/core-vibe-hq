---
name: Security Issue
description: Report a security vulnerability
title: "[SECURITY] "
labels: ["security", "bug"]
assignees: []
---

## Security Vulnerability Report

⚠️ **URGENT**: This is a security issue. Do not discuss in public channels.

### Vulnerability Details

**Type of Vulnerability:**
- [ ] SQL Injection
- [ ] XSS (Cross-Site Scripting)
- [ ] CSRF (Cross-Site Request Forgery)
- [ ] Authentication Bypass
- [ ] Authorization Bypass
- [ ] Information Disclosure
- [ ] Denial of Service
- [ ] Other: __________

**Severity:**
- [ ] Critical (CVSS 9.0-10.0)
- [ ] High (CVSS 7.0-8.9)
- [ ] Medium (CVSS 4.0-6.9)
- [ ] Low (CVSS 0.1-3.9)
- [ ] Info (CVSS 0.0)

### Description
Detailed description of the security vulnerability.

### Proof of Concept
**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Code Location:**
```typescript
// Vulnerable code
```

**Exploit:**
```bash
# Exploit commands or payload
```

### Impact Assessment
**What an attacker could do:**
- [Data access]
- [System compromise]
- [Service disruption]
- [Other impacts]

**Affected Components:**
- [List affected systems/components]

### Environment
- **Component**: [e.g., health-system, api-routes]
- **Endpoint**: [e.g., /api/health, /api/users]
- **Authentication**: [required/not required]

### Mitigation
**Immediate Actions Taken:**
- [ ] Issue patched
- [ ] Monitoring added
- [ ] Access restricted

**Recommended Fix:**
```typescript
// Secure implementation
```

### CVSS Score Calculation
**Base Metrics:**
- Attack Vector: [Network/Adjacent/Local]
- Attack Complexity: [Low/High]
- Privileges Required: [None/Low/High]
- User Interaction: [None/Required]
- Scope: [Unchanged/Changed]
- Confidentiality: [None/Low/High]
- Integrity: [None/Low/High]
- Availability: [None/Low/High]

**CVSS Score:** [calculated score]

### Additional Context
- Related vulnerabilities:
- Discovery method:
- Timeframe of exposure:
- Patch availability:
