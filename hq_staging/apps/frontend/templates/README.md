# UI Factory Templates

This directory contains base templates for generating new UI components and applications.

## Template Structure

Each template is stored in its own subdirectory. Templates use `.template` file extensions and contain placeholder tags like `{{PLACEHOLDER_NAME}}` that will be filled in during order fulfillment.

## Usage

Templates are used by the Factory Automation System:
1. The `template-manager-tool` extracts placeholders from templates
2. The `BaseFactoryAgent` generates micro-prompts for each placeholder based on orders
3. The `pmo-scaffolder` creates skeleton files with micro-prompts
4. Code generation tools fill in the placeholders

## MCP Tools

The UI Factory uses the following MCP tools for template analysis:
- `cloudflare-docs` - Cloudflare Workers documentation
- `shadcn-mcp` - ShadCN UI component library
- `heroui-mcp` - HeroUI component library

