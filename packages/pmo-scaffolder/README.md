# PMO Scaffolder

Project scaffolding tool for the factory automation system. This tool parses a `file_creation_plan.json` and scaffolds a new project with micro-prompts embedded as comments/docstrings.

## Installation

```bash
pip install -e .
```

## Usage

```bash
setup_repo --plan /path/to/file_creation_plan.json [--workspace /path/to/workspace]
```

## File Creation Plan Format

The `file_creation_plan.json` should have the following structure:

```json
{
  "skeleton_files": [
    {
      "filepath": "src/index.ts",
      "content": "Micro-prompt describing what should be implemented here"
    }
  ],
  "copy_files": [
    {
      "source": "templates/base.ts",
      "dest": "src/base.ts"
    }
  ],
  "specialized_module_path": "factories.agent_factory_setup"
}
```

## Features

- Creates skeleton files with micro-prompts as comments/docstrings
- Copies template files preserving metadata
- Supports dynamic module loading for factory-specific logic
- Automatic comment formatting based on file type (TS/JS, Python, Markdown, etc.)

