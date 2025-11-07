# Task Master Rules Setup

## Status: ✅ Configured

Task Master has been configured to use the same rules as Cursor.

## How It Works

Task Master uses the `.cursor/rules` directory directly, which means:

- ✅ **All Cursor rules are automatically available to Task Master**
- ✅ **No duplication needed** - rules are shared between both systems
- ✅ **Single source of truth** - update `.cursor/rules` and both systems use the updated rules

## Current Rules in `.cursor/rules/`

The following rules are available to both Cursor and Task Master:

1. **checklist.mdc** - Checklist for new features involving database access
2. **code-organization.mdc** - Code organization patterns (agents, entrypoints, imports)
3. **cursor_rules.mdc** - Guidelines for creating and maintaining Cursor rules
4. **database-architecture.mdc** - Database access patterns (orchestrator-only D1)
5. **database-technologies.mdc** - Drizzle ORM and Kysely usage, migration management
6. **deployment-requirements.mdc** - Every worker must have a deploy workflow
7. **documentation.mdc** - Documentation standards
8. **infrastructure-model.mdc** - Paid Workers only, NOT Workers for Platforms
9. **problem-resolution.mdc** - Clear all errors before reporting feature complete
10. **project-structure.mdc** - Core project structure and orchestrator location rules
11. **quick-reference.mdc** - Quick reference table and common mistakes
12. **self_improve.mdc** - Rule improvement and maintenance guidelines
13. **shared-configuration.mdc** - Shared configuration patterns
14. **typescript-best-practices.mdc** - TypeScript best practices (no shortcuts)

Plus Task Master specific rules:
- **taskmaster/dev_workflow.mdc** - Task Master development workflow
- **taskmaster/taskmaster.mdc** - Task Master tool and command reference

## Verification

To verify Task Master is using the rules:

```bash
# Check that cursor profile is added
task-master rules list

# The rules are automatically available since they're in .cursor/rules/
```

## Adding New Rules

When adding new rules:

1. **Add to `.cursor/rules/`** - This makes them available to both Cursor and Task Master
2. **Follow the rule format** - See `cursor_rules.mdc` for guidelines
3. **Use proper metadata** - Include `description`, `globs`, and `alwaysApply` in frontmatter

## Rule Profiles

Task Master supports multiple rule profiles:
- **cursor** - Uses `.cursor/rules/` (already configured)
- **windsurf** - Uses `.windsurf/rules/`
- **roo** - Uses `.roo/rules/`
- etc.

Since Cursor rules are in `.cursor/rules/`, the cursor profile is automatically configured.

## Summary

✅ **Task Master is configured to use Cursor rules**
✅ **All 14 Cursor rules are available to Task Master**
✅ **Rules are shared - no duplication needed**
✅ **Single source of truth in `.cursor/rules/`**

No further action needed - Task Master will use the same rules as Cursor automatically.

