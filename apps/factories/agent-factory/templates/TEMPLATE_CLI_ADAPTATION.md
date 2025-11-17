# Template CLI Adaptation Plan

## Overview

The Cloudflare Templates CLI (`STAGING/templates/cli`) provides powerful template management capabilities that can be leveraged for our factory-based template organization.

## Key CLI Features

### 1. **Template Discovery**
- `getAllTemplates()` - Discovers templates ending with "-template" suffix
- `getPublishedTemplates()` - Filters by `package.json.cloudflare.publish` flag
- Works recursively through directories

### 2. **Template Linting**
- Validates `wrangler.jsonc`/`wrangler.json` configuration
- Checks `package.json` structure (private, version)
- Validates README format
- Checks `.gitignore` patterns
- Can auto-fix many issues

### 3. **Template Upload**
- Uploads templates to Cloudflare Templates API
- Handles seed repo metadata
- Version management

### 4. **Validation**
- Live demo link validation
- Deploy to Cloudflare button validation
- Package.json version validation

### 5. **Dependency Management**
- Dependency info tracking
- Dependency update automation

## Adaptation Strategy

### Option 1: Use CLI As-Is (Recommended)
The CLI already supports nested directories and can work with our structure:

```bash
# Lint all templates in agent-factory
cd apps/factories/agent-factory/templates
npx tsx ../../../../STAGING/templates/cli/src/index.ts lint .

# Lint specific template
npx tsx ../../../../STAGING/templates/cli/src/index.ts lint cloudflare-agents-sdk/agents-starter
```

### Option 2: Create Factory-Specific Wrapper
Create a wrapper script that:
- Discovers templates across all factories
- Maintains factory-specific metadata
- Integrates with our template catalog system

### Option 3: Copy and Adapt CLI
Copy the CLI and adapt it for our structure:
- Update `TEMPLATE_DIRECTORY_SUFFIX` logic
- Add factory categorization
- Integrate with our template catalog

## Recommended Approach

**Use CLI as-is with wrapper scripts** for each factory:

1. **Copy CLI to shared location**: `@shared/tools/template-cli/`
2. **Create factory-specific scripts**: Each factory gets a `scripts/templates.ts` that wraps the CLI
3. **Create root-level template manager**: `scripts/manage-templates.ts` that can operate across all factories

## Implementation

### Step 1: Copy CLI
```bash
cp -r STAGING/templates/cli @shared/tools/template-cli
```

### Step 2: Create Factory Wrappers
Each factory gets a script that:
- Points to its templates directory
- Uses factory-specific metadata
- Integrates with factory's template catalog

### Step 3: Create Root Manager
A root script that can:
- Operate on all factories
- Generate unified template catalog
- Validate cross-factory consistency

## Benefits

✅ **Reuse existing validation logic**
✅ **Consistent template structure**
✅ **Automated linting and validation**
✅ **Template upload capabilities** (if needed)
✅ **Dependency tracking**

## Next Steps

1. Copy CLI to `@shared/tools/template-cli/`
2. Create factory wrapper scripts
3. Create root template manager
4. Update template catalogs to use CLI discovery
5. Add CI/CD integration for template validation


