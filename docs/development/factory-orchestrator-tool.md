# Factory Orchestrator Tool (TypeScript)

The factory orchestrator workflow has been migrated from the legacy Python CLI to a TypeScript implementation that runs directly within the repository. This tool provides the same capabilities as the original script while aligning with the TypeScript-first architecture of the project.

## Quick Start

All commands are exposed through the root `package.json` script `factory-orchestrator`. Use `pnpm`, `npm`, or `yarn` to execute the CLI:

```bash
pnpm factory-orchestrator -- <command> [options]
```

### Available Commands

| Command | Description | Required Options |
| ------- | ----------- | ---------------- |
| `process-placeholders` | Injects agent prompts into template placeholders. | `--order-id`, `--placeholder-json`, `--workspace` |
| `validate-order` | Validates the structure of an order JSON file. | `--order-file` |
| `list-templates` | Lists the available templates in a factory directory. | `--factory-path` |
| `extract-placeholders` | Extracts placeholder identifiers from a template directory. | `--template-path` |

Each command prints a friendly status line followed by a JSON payload that can be parsed by automation.

## Example Usage

```bash
pnpm factory-orchestrator -- process-placeholders \
  --order-id ORD-123 \
  --placeholder-json /tmp/order.json \
  --workspace ./apps/agent-factory/templates/basic-worker
```

```bash
pnpm factory-orchestrator -- validate-order --order-file ./orders/sample-order.json
```

## Implementation Notes

- The CLI is implemented in `tools/factory-orchestrator/index.ts`.
- Commands rely on Node.js file system APIs and therefore expect to run inside containerized factory environments or development machines.
- Output mirrors the structure produced by the original Python tool to keep existing automation compatible.
- The base factory container no longer bundles the Python package. Use the TypeScript CLI exclusively for new automation.

## Updating Agents

Factory agents continue to call the orchestrator tool through `execCommand`. The command has been updated to use the `pnpm factory-orchestrator` script, so no additional installation steps are required within factory containers.


