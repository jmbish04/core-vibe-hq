"""
Template Manager - Core functions for managing templates.
"""

import json
import re
from pathlib import Path
from typing import Dict, List


def list_templates(factory_path: str) -> List[str]:
    """
    Scan factory_path directory and return list of template names.
    
    Templates are identified as directories containing .template files.
    
    Args:
        factory_path: Path to factory templates directory
        
    Returns:
        List of template directory names
    """
    factory_dir = Path(factory_path)
    if not factory_dir.exists():
        return []
    
    templates = []
    for item in factory_dir.iterdir():
        if item.is_dir():
            # Check if directory contains .template files
            template_files = list(item.rglob("*.template"))
            if template_files:
                templates.append(item.name)
    
    return sorted(templates)


def extract_placeholders(template_path: str) -> Dict:
    """
    Extract all {{PLACEHOLDER_...}} tags from template files.
    
    Args:
        template_path: Path to template directory
        
    Returns:
        Dictionary with template_files array containing placeholder information
    """
    template_dir = Path(template_path)
    if not template_dir.exists():
        return {"template_files": []}
    
    # Regex pattern to match {{PLACEHOLDER_NAME}} tags
    placeholder_pattern = re.compile(r'\{\{PLACEHOLDER_([A-Z0-9_]+)\}\}')
    
    template_files = []
    
    # Recursively scan all .template files
    for template_file in template_dir.rglob("*.template"):
        relative_path = template_file.relative_to(template_dir)
        
        try:
            content = template_file.read_text(encoding='utf-8')
            
            # Find all placeholders
            placeholders = []
            for match in placeholder_pattern.finditer(content):
                placeholder_name = match.group(1)
                full_placeholder = f"PLACEHOLDER_{placeholder_name}"
                if full_placeholder not in placeholders:
                    placeholders.append(full_placeholder)
            
            template_files.append({
                "filename": template_file.name,
                "path": str(relative_path),
                "placeholders": sorted(placeholders)
            })
        except Exception as e:
            # Skip files that can't be read
            continue
    
    return {
        "template_files": template_files
    }


def create_template(path: str, content: str) -> Dict:
    """
    Create a new template file.
    
    Args:
        path: Path where template file should be created
        content: Content for the template file
        
    Returns:
        Dictionary with ok status and path
    """
    template_path = Path(path)
    
    # Create parent directories if needed
    template_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Write template file
    template_path.write_text(content, encoding='utf-8')
    
    return {
        "ok": True,
        "path": str(template_path)
    }


def modify_template(path: str, content: str) -> Dict:
    """
    Modify an existing template file.
    
    Args:
        path: Path to template file to modify
        content: New content for the template file
        
    Returns:
        Dictionary with ok status and path
    """
    template_path = Path(path)
    
    if not template_path.exists():
        raise FileNotFoundError(f"Template file not found: {path}")
    
    # Write new content
    template_path.write_text(content, encoding='utf-8')
    
    return {
        "ok": True,
        "path": str(template_path)
    }

