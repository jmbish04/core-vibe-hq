# Template CLI

A handy CLI for developing and managing templates across factory workers.

## Installation

This CLI is located at `@shared/tools/template-cli/` and can be used directly:

```bash
npx tsx @shared/tools/template-cli/src/index.ts <command>
```

## Commands

See the main integration guide: `TEMPLATE_CLI_INTEGRATION.md`

## Quick Start

```bash
# Lint templates in a factory
npx tsx @shared/tools/template-cli/src/index.ts lint apps/factories/agent-factory/templates

# Lint with auto-fix
npx tsx @shared/tools/template-cli/src/index.ts lint apps/factories/agent-factory/templates --fix

# Validate live demo links
npx tsx @shared/tools/template-cli/src/index.ts validate-live-demo-links apps/factories/ui-factory/templates
```

## Template Requirements

Templates should:
- End with `-template` suffix (or be in a directory that does)
- Have a `package.json` file
- Have `package.json.cloudflare.publish = true` to be considered "published"
- Have a `README.md` file
- Use `wrangler.jsonc` or `wrangler.json` (not `wrangler.toml`)

## Source

Originally from Cloudflare's templates repository (`STAGING/templates/cli/`).

Adapted for use across multiple factory workers in the vibe-hq ecosystem.
