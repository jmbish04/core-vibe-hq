#!/usr/bin/env python3
"""
Template Manager Tool CLI Entrypoint

Provides CLI commands for managing and analyzing templates.
All commands output JSON to stdout for agent consumption.
"""

import json
import sys
from typing import Optional

import typer

from template_manager_tool.manager import (
    create_template,
    list_templates,
    modify_template,
)
from template_manager_tool.analyzer import analyze_improve_templates
from template_manager_tool.manager import extract_placeholders

app = typer.Typer()


def output_json(data: dict, exit_code: int = 0) -> None:
    """Output JSON to stdout and exit."""
    print(json.dumps(data, indent=2))
    sys.exit(exit_code)


def output_error(message: str, details: Optional[dict] = None) -> None:
    """Output error JSON and exit."""
    error_data = {"ok": False, "error": message}
    if details:
        error_data["details"] = details
    output_json(error_data, exit_code=1)


@app.command()
def list_templates_cmd(
    factory_path: str = typer.Argument(..., help="Path to factory templates directory")
) -> None:
    """List all available templates in a factory directory."""
    try:
        templates = list_templates(factory_path)
        output_json({"ok": True, "templates": templates})
    except Exception as e:
        output_error(f"Failed to list templates: {str(e)}")


@app.command()
def extract_placeholders_cmd(
    template_path: str = typer.Argument(..., help="Path to template directory")
) -> None:
    """Extract all placeholders from template files."""
    try:
        result = extract_placeholders(template_path)
        output_json({"ok": True, **result})
    except Exception as e:
        output_error(f"Failed to extract placeholders: {str(e)}")


@app.command()
def create_template_cmd(
    path: str = typer.Argument(..., help="Path to create template file"),
    content: str = typer.Argument(..., help="Content for the template file")
) -> None:
    """Create a new template file."""
    try:
        result = create_template(path, content)
        output_json({"ok": True, **result})
    except Exception as e:
        output_error(f"Failed to create template: {str(e)}")


@app.command()
def modify_template_cmd(
    path: str = typer.Argument(..., help="Path to template file to modify"),
    content: str = typer.Argument(..., help="New content for the template file")
) -> None:
    """Modify an existing template file."""
    try:
        result = modify_template(path, content)
        output_json({"ok": True, **result})
    except Exception as e:
        output_error(f"Failed to modify template: {str(e)}")


@app.command()
def analyze_improve_cmd(
    template_path: str = typer.Argument(..., help="Path to template directory"),
    mcp_tool_name: str = typer.Argument(..., help="MCP tool name (e.g., 'cloudflare-docs')"),
    query: str = typer.Argument(..., help="Query to send to MCP tool")
) -> None:
    """Analyze and improve templates using MCP tools."""
    try:
        result = analyze_improve_templates(template_path, mcp_tool_name, query)
        output_json({"ok": True, **result})
    except Exception as e:
        output_error(f"Failed to analyze templates: {str(e)}")


if __name__ == "__main__":
    app()

