# Template CLI Integration Guide

## Overview

The Cloudflare Templates CLI has been copied to `@shared/tools/template-cli/` and can be leveraged for template management across all factory workers.

## CLI Location

**Path**: `@shared/tools/template-cli/`

**Source**: Copied from `STAGING/templates/cli/`

## Available Commands

### 1. **Lint Templates**
Validates template structure, configuration files, and fixes common issues:

```bash
# Lint all templates in a factory
cd apps/factories/agent-factory/templates
npx tsx ../../../../@shared/tools/template-cli/src/index.ts lint .

# Lint with auto-fix
npx tsx ../../../../@shared/tools/template-cli/src/index.ts lint . --fix

# Lint specific template
npx tsx ../../../../@shared/tools/template-cli/src/index.ts lint cloudflare-agents-sdk/agents-starter
```

**What it checks**:
- `wrangler.jsonc`/`wrangler.json` configuration
- `package.json` structure (private, version)
- README format and content
- `.gitignore` patterns
- Template naming conventions (must end with "-template")

### 2. **Generate NPM Lockfiles**
Improves template install time:

```bash
npx tsx @shared/tools/template-cli/src/index.ts generate-npm-lockfiles apps/factories/agent-factory/templates
```

### 3. **Lint NPM Lockfiles**
Ensures lockfiles are up to date:

```bash
npx tsx @shared/tools/template-cli/src/index.ts lint-npm-lockfiles apps/factories/agent-factory/templates
```

### 4. **Validate Live Demo Links**
Ensures every template has a working live demo:

```bash
npx tsx @shared/tools/template-cli/src/index.ts validate-live-demo-links apps/factories/ui-factory/templates
```

### 5. **Validate Deploy to Cloudflare Buttons**
Ensures README has deploy button:

```bash
npx tsx @shared/tools/template-cli/src/index.ts validate-d2c-buttons apps/factories/agent-factory/templates
```

### 6. **Validate Package.json**
Ensures templates have private and non-versioned package.json:

```bash
npx tsx @shared/tools/template-cli/src/index.ts validate-version-private-package-json apps/factories/data-factory/templates
```

## Template Discovery

The CLI automatically discovers templates by:
1. Looking for directories ending with `-template` suffix
2. Checking for `package.json` in each directory
3. Filtering by `package.json.cloudflare.publish` flag (for published templates)

**Note**: Our templates may not follow the `-template` suffix convention. We can:
- Rename template directories to include `-template` suffix
- Adapt the CLI's `TEMPLATE_DIRECTORY_SUFFIX` constant
- Use the CLI's ability to target specific directories

## Integration Strategies

### Strategy 1: Use CLI As-Is (Current)

**Pros**:
- No modifications needed
- Works immediately
- Can target specific directories

**Cons**:
- Requires `-template` suffix or manual directory specification
- Doesn't understand our factory structure

**Usage**:
```bash
# Target specific template directory
npx tsx @shared/tools/template-cli/src/index.ts lint apps/factories/agent-factory/templates/cloudflare-agents-sdk/agents-starter
```

### Strategy 2: Create Factory Wrapper Scripts

Create a wrapper script for each factory that:
- Points to the factory's templates directory
- Handles factory-specific metadata
- Integrates with factory's template catalog

**Example**: `apps/factories/agent-factory/scripts/lint-templates.ts`
```typescript
import { lint } from '@shared/tools/template-cli/src/lint';

lint({
  templateDirectory: './templates',
  fix: process.argv.includes('--fix')
});
```

### Strategy 3: Adapt CLI for Factory Structure

Modify the CLI to:
- Support nested template structures
- Understand factory categorization
- Generate factory-specific catalogs

## Recommended Approach

**Use Strategy 1 (As-Is) for now**, with helper scripts:

### Create Helper Scripts

**`scripts/lint-all-templates.ts`**:
```typescript
// Lint templates across all factories
const factories = [
  'apps/factories/agent-factory/templates',
  'apps/factories/data-factory/templates',
  'apps/factories/services-factory/templates',
  'apps/factories/ui-factory/templates',
];

for (const factory of factories) {
  // Run lint on each factory
}
```

**`scripts/validate-all-templates.ts`**:
```typescript
// Run all validations across factories
```

## Template Naming Convention

The CLI expects templates to end with `-template`. Our current structure doesn't follow this. Options:

1. **Rename templates** to include `-template` suffix:
   - `agents-starter` → `agents-starter-template`
   - `r2-explorer` → `r2-explorer-template`

2. **Adapt CLI** to work without suffix requirement (modify `util.ts`)

3. **Use CLI on subdirectories** that match the pattern

## CI/CD Integration

Add template validation to CI:

```yaml
# .github/workflows/validate-templates.yml
- name: Lint Templates
  run: |
    npx tsx @shared/tools/template-cli/src/index.ts lint apps/factories/agent-factory/templates
    npx tsx @shared/tools/template-cli/src/index.ts lint apps/factories/data-factory/templates
    npx tsx @shared/tools/template-cli/src/index.ts lint apps/factories/services-factory/templates
    npx tsx @shared/tools/template-cli/src/index.ts lint apps/factories/ui-factory/templates
```

## Benefits

✅ **Consistent template structure** across all factories
✅ **Automated validation** of configuration files
✅ **Auto-fix capabilities** for common issues
✅ **Dependency tracking** and lockfile management
✅ **Live demo validation** ensures templates work
✅ **Deploy button validation** improves UX

## Next Steps

1. ✅ Copy CLI to `@shared/tools/template-cli/` (done)
2. ⏳ Create factory wrapper scripts
3. ⏳ Create root-level template manager script
4. ⏳ Decide on template naming convention (`-template` suffix?)
5. ⏳ Add CI/CD integration for template validation
6. ⏳ Update template catalogs to use CLI discovery

## Example Usage

```bash
# Lint all agent factory templates
cd apps/factories/agent-factory/templates
npx tsx ../../../../@shared/tools/template-cli/src/index.ts lint . --fix

# Validate UI factory templates
cd apps/factories/ui-factory/templates
npx tsx ../../../../@shared/tools/template-cli/src/index.ts validate-live-demo-links .
npx tsx ../../../../@shared/tools/template-cli/src/index.ts validate-d2c-buttons .

# Generate lockfiles for data factory templates
cd apps/factories/data-factory/templates
npx tsx ../../../../@shared/tools/template-cli/src/index.ts generate-npm-lockfiles .
```


