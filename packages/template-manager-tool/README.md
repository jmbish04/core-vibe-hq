# Template Manager Tool

Agent toolkit for managing and analyzing templates in the factory automation system. This tool provides CLI commands that agents can execute via subprocess to manage templates, extract placeholders, and analyze templates using MCP tools.

## Installation

```bash
pip install -e .
```

## Usage

```bash
template-manager list-templates <factory_path>
template-manager extract-placeholders <template_path>
template-manager create-template <path> <content>
template-manager modify-template <path> <content>
template-manager analyze-improve <template_path> <mcp_tool_name> <query>
```

## Commands

- `list-templates`: Scan a factory directory and return JSON list of available template names
- `extract-placeholders`: Extract all `{{PLACEHOLDER_...}}` tags from template files
- `create-template`: Create a new template file
- `modify-template`: Modify an existing template file
- `analyze-improve`: Use MCP tools to analyze and improve templates

All commands output JSON to stdout for agent consumption.

