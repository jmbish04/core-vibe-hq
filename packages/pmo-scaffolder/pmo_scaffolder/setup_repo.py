#!/usr/bin/env python3
"""
Project scaffolding script for factory automation system.

Parses a file_creation_plan.json and scaffolds a new project with micro-prompts
embedded as comments/docstrings.
"""

import json
import os
import shutil
import sys
from pathlib import Path
from typing import Dict, List, Optional

import typer
from pydantic import BaseModel, Field, ValidationError

app = typer.Typer()


class SkeletonFile(BaseModel):
    """Represents a skeleton file to be created."""
    filepath: str
    content: str


class CopyFile(BaseModel):
    """Represents a file to be copied."""
    source: str
    dest: str


class FileCreationPlan(BaseModel):
    """Schema for file creation plan JSON."""
    skeleton_files: List[SkeletonFile] = Field(default_factory=list)
    copy_files: List[CopyFile] = Field(default_factory=list)
    specialized_module_path: Optional[str] = None


def get_comment_format(filepath: str) -> tuple[str, str]:
    """
    Determine the comment format based on file extension.
    
    Returns:
        Tuple of (opening_comment, closing_comment)
    """
    ext = Path(filepath).suffix.lower()
    
    if ext in {'.ts', '.tsx', '.js', '.jsx'}:
        return ('/* ', ' */')
    elif ext == '.py':
        return ('# ', '')
    elif ext in {'.md', '.html', '.xml'}:
        return ('<!-- ', ' -->')
    elif ext in {'.yaml', '.yml', '.toml', '.ini', '.cfg'}:
        return ('# ', '')
    elif ext in {'.sh', '.bash'}:
        return ('# ', '')
    else:
        # Default to hash comment
        return ('# ', '')


def format_content_as_comment(filepath: str, content: str) -> str:
    """
    Format content as a comment/docstring based on file type.
    """
    opening, closing = get_comment_format(filepath)
    
    # Split content into lines and wrap each line
    lines = content.strip().split('\n')
    formatted_lines = [f"{opening}{line}{closing}" for line in lines if line.strip()]
    
    return '\n'.join(formatted_lines) if formatted_lines else f"{opening}{content}{closing}"


def create_skeleton_file(filepath: str, content: str, workspace: Path) -> None:
    """
    Create a skeleton file with content formatted as a comment.
    """
    full_path = workspace / filepath
    
    # Create directory structure
    full_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Format content as comment
    formatted_content = format_content_as_comment(filepath, content)
    
    # Write file
    with open(full_path, 'w', encoding='utf-8') as f:
        f.write(formatted_content)
        f.write('\n')
    
    print(f"Created skeleton file: {filepath}", file=sys.stderr)


def copy_file(source: str, dest: str, workspace: Path) -> None:
    """
    Copy a file from source to destination.
    """
    source_path = Path(source)
    dest_path = workspace / dest
    
    # Create destination directory if needed
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Copy file preserving metadata
    if source_path.is_absolute():
        shutil.copy2(source_path, dest_path)
    else:
        # Relative to workspace
        source_full = workspace / source
        shutil.copy2(source_full, dest_path)
    
    print(f"Copied file: {source} -> {dest}", file=sys.stderr)


def run_specialized_steps(plan: FileCreationPlan, workspace: Path) -> None:
    """
    Dynamically import and run specialized steps from a module.
    """
    if not plan.specialized_module_path:
        return
    
    try:
        import importlib
        module = importlib.import_module(plan.specialized_module_path)
        
        if hasattr(module, 'run_specialized_steps'):
            print(f"Running specialized steps from {plan.specialized_module_path}", file=sys.stderr)
            module.run_specialized_steps(plan)
        else:
            print(
                f"Warning: Module {plan.specialized_module_path} does not have "
                f"run_specialized_steps function",
                file=sys.stderr
            )
    except ImportError as e:
        print(
            f"Error importing specialized module {plan.specialized_module_path}: {e}",
            file=sys.stderr
        )
        sys.exit(1)
    except Exception as e:
        print(f"Error running specialized steps: {e}", file=sys.stderr)
        sys.exit(1)


@app.command()
def main(
    plan: str = typer.Option(..., "--plan", help="Path to file_creation_plan.json"),
    workspace: Optional[str] = typer.Option(None, "--workspace", help="Target workspace directory (default: current directory)")
) -> None:
    """
    Scaffold a project from a file creation plan.
    """
    # Determine workspace directory
    workspace_path = Path(workspace) if workspace else Path.cwd()
    workspace_path = workspace_path.resolve()
    
    # Load and parse plan
    plan_path = Path(plan)
    if not plan_path.exists():
        print(f"Error: Plan file not found: {plan}", file=sys.stderr)
        sys.exit(1)
    
    try:
        with open(plan_path, 'r', encoding='utf-8') as f:
            plan_data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in plan file: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Validate plan schema
    try:
        file_plan = FileCreationPlan(**plan_data)
    except ValidationError as e:
        print(f"Error: Invalid plan schema: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Create skeleton files
    for skeleton_file in file_plan.skeleton_files:
        try:
            create_skeleton_file(skeleton_file.filepath, skeleton_file.content, workspace_path)
        except Exception as e:
            print(f"Error creating skeleton file {skeleton_file.filepath}: {e}", file=sys.stderr)
            sys.exit(1)
    
    # Copy files
    for copy_file_item in file_plan.copy_files:
        try:
            copy_file(copy_file_item.source, copy_file_item.dest, workspace_path)
        except Exception as e:
            print(f"Error copying file {copy_file_item.source}: {e}", file=sys.stderr)
            sys.exit(1)
    
    # Run specialized steps if specified
    if file_plan.specialized_module_path:
        try:
            run_specialized_steps(file_plan, workspace_path)
        except Exception as e:
            print(f"Error running specialized steps: {e}", file=sys.stderr)
            sys.exit(1)
    
    print("Scaffolding completed successfully", file=sys.stderr)


if __name__ == "__main__":
    app()

