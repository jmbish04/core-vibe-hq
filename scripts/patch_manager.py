#!/usr/bin/env python3
"""
Patch Manager - Deterministic code mutation system for surgical file edits.

This script provides line-based surgical edits (replace-block, insert-before,
insert-after, append, prepend) with blank space padding preservation,
task validation, unified diff generation, orchestrator webhook callbacks,
and TypeScript type checking integration.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import difflib
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
import logging
import jsonschema

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class PatchOperation:
    """Represents a single patch operation."""
    op: str
    file: str
    start: Optional[int] = None
    end: Optional[int] = None
    line: Optional[int] = None
    block: Optional[str] = None
    blockFile: Optional[str] = None
    openSpace: bool = False
    taskId: Optional[str] = None


@dataclass
class PatchBatch:
    """Represents a batch of patch operations."""
    orderId: Optional[str] = None
    requester: str = "agent"
    reason: str = ""
    branch: str = ""
    patches: List[PatchOperation] = field(default_factory=list)


class PatchManager:
    """Main patch manager class for applying surgical code mutations."""
    
    def __init__(
        self,
        orchestrator_url: Optional[str] = None,
        dry_run: bool = False,
        project_root: Optional[str] = None
    ):
        self.orchestrator_url = orchestrator_url or os.getenv('ORCHESTRATOR_URL', 'http://localhost:8787')
        self.dry_run = dry_run
        self.project_root = Path(project_root) if project_root else Path.cwd()
        self.applied_patches: List[Dict[str, Any]] = []
        
    def _read_file(self, file_path: Path) -> List[str]:
        """Read a file and return its lines."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.readlines()
        except FileNotFoundError:
            logger.error(f"File not found: {file_path}")
            raise
        except Exception as e:
            logger.error(f"Error reading file {file_path}: {e}")
            raise
    
    def _write_file(self, file_path: Path, lines: List[str]) -> None:
        """Write lines to a file."""
        if self.dry_run:
            logger.info(f"[DRY RUN] Would write {len(lines)} lines to {file_path}")
            return
        
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)
        except Exception as e:
            logger.error(f"Error writing file {file_path}: {e}")
            raise
    
    def _get_content(self, operation: PatchOperation) -> str:
        """Get content from either block or blockFile."""
        if operation.block:
            return operation.block
        elif operation.blockFile:
            block_path = self.project_root / operation.blockFile
            try:
                with open(block_path, 'r', encoding='utf-8') as f:
                    return f.read()
            except Exception as e:
                logger.error(f"Error reading block file {block_path}: {e}")
                raise
        else:
            raise ValueError("Either 'block' or 'blockFile' must be provided")
    
    def _preserve_indentation(self, original_line: str, new_content: str) -> str:
        """Preserve indentation from original line for new content."""
        if not original_line.strip():
            return new_content
        
        # Get leading whitespace from original line
        indent = len(original_line) - len(original_line.lstrip())
        indent_str = original_line[:indent]
        
        # Apply indentation to new content (first line only, rest should maintain their own)
        lines = new_content.split('\n')
        if lines:
            lines[0] = indent_str + lines[0].lstrip()
        return '\n'.join(lines)
    
    def _generate_unified_diff(
        self,
        file_path: Path,
        original_lines: List[str],
        modified_lines: List[str]
    ) -> str:
        """Generate a unified diff between original and modified content."""
        diff = difflib.unified_diff(
            original_lines,
            modified_lines,
            fromfile=str(file_path),
            tofile=str(file_path),
            lineterm=''
        )
        return '\n'.join(diff)
    
    def replace_block(
        self,
        file_path: Path,
        start_line: int,
        end_line: int,
        new_content: str,
        preserve_indent: bool = True
    ) -> Tuple[List[str], str]:
        """
        Replace code between start_line and end_line with new_content.
        
        Args:
            file_path: Path to the file to modify
            start_line: Starting line number (1-indexed)
            end_line: Ending line number (1-indexed, inclusive)
            new_content: New content to insert
            preserve_indent: Whether to preserve indentation from the first line
        
        Returns:
            Tuple of (modified lines, unified diff)
        """
        lines = self._read_file(file_path)
        original_lines = lines.copy()
        
        # Convert to 0-indexed
        start_idx = start_line - 1
        end_idx = end_line
        
        if start_idx < 0 or end_idx > len(lines):
            raise ValueError(f"Line numbers out of range: {start_line}-{end_line} (file has {len(lines)} lines)")
        
        # Preserve indentation if requested
        if preserve_indent and start_idx < len(lines):
            new_content = self._preserve_indentation(lines[start_idx], new_content)
        
        # Split new content into lines
        new_lines = new_content.split('\n')
        if new_lines and not new_content.endswith('\n'):
            # If content doesn't end with newline, don't add trailing newline to last line
            pass
        else:
            # Ensure each line ends with newline
            new_lines = [line + '\n' if not line.endswith('\n') else line for line in new_lines]
        
        # Replace the block
        modified_lines = lines[:start_idx] + new_lines + lines[end_idx:]
        
        # Generate diff
        diff = self._generate_unified_diff(file_path, original_lines, modified_lines)
        
        return modified_lines, diff
    
    def insert_before(
        self,
        file_path: Path,
        line_number: int,
        new_content: str,
        preserve_indent: bool = True
    ) -> Tuple[List[str], str]:
        """
        Insert new_content before the specified line number.
        
        Args:
            file_path: Path to the file to modify
            line_number: Line number to insert before (1-indexed)
            new_content: Content to insert
            preserve_indent: Whether to preserve indentation from the target line
        
        Returns:
            Tuple of (modified lines, unified diff)
        """
        lines = self._read_file(file_path)
        original_lines = lines.copy()
        
        # Convert to 0-indexed
        insert_idx = line_number - 1
        
        if insert_idx < 0 or insert_idx > len(lines):
            raise ValueError(f"Line number out of range: {line_number} (file has {len(lines)} lines)")
        
        # Preserve indentation if requested
        if preserve_indent and insert_idx < len(lines):
            new_content = self._preserve_indentation(lines[insert_idx], new_content)
        
        # Split new content into lines
        new_lines = new_content.split('\n')
        new_lines = [line + '\n' if not line.endswith('\n') and line else line for line in new_lines]
        
        # Insert the content
        modified_lines = lines[:insert_idx] + new_lines + lines[insert_idx:]
        
        # Generate diff
        diff = self._generate_unified_diff(file_path, original_lines, modified_lines)
        
        return modified_lines, diff
    
    def insert_after(
        self,
        file_path: Path,
        line_number: int,
        new_content: str,
        preserve_indent: bool = True
    ) -> Tuple[List[str], str]:
        """
        Insert new_content after the specified line number.
        
        Args:
            file_path: Path to the file to modify
            line_number: Line number to insert after (1-indexed)
            new_content: Content to insert
            preserve_indent: Whether to preserve indentation from the target line
        
        Returns:
            Tuple of (modified lines, unified diff)
        """
        lines = self._read_file(file_path)
        original_lines = lines.copy()
        
        # Convert to 0-indexed
        insert_idx = line_number
        
        if insert_idx < 0 or insert_idx > len(lines):
            raise ValueError(f"Line number out of range: {line_number} (file has {len(lines)} lines)")
        
        # Preserve indentation if requested
        if preserve_indent and insert_idx > 0:
            new_content = self._preserve_indentation(lines[insert_idx - 1], new_content)
        
        # Split new content into lines
        new_lines = new_content.split('\n')
        new_lines = [line + '\n' if not line.endswith('\n') and line else line for line in new_lines]
        
        # Insert the content
        modified_lines = lines[:insert_idx] + new_lines + lines[insert_idx:]
        
        # Generate diff
        diff = self._generate_unified_diff(file_path, original_lines, modified_lines)
        
        return modified_lines, diff
    
    def append(self, file_path: Path, new_content: str) -> Tuple[List[str], str]:
        """
        Append new_content to the end of the file.
        
        Args:
            file_path: Path to the file to modify
            new_content: Content to append
        
        Returns:
            Tuple of (modified lines, unified diff)
        """
        lines = self._read_file(file_path)
        original_lines = lines.copy()
        
        # Ensure new content ends with newline
        if not new_content.endswith('\n'):
            new_content += '\n'
        
        # Split new content into lines
        new_lines = new_content.split('\n')
        new_lines = [line + '\n' if line else line for line in new_lines]
        
        # Append the content
        modified_lines = lines + new_lines
        
        # Generate diff
        diff = self._generate_unified_diff(file_path, original_lines, modified_lines)
        
        return modified_lines, diff
    
    def prepend(self, file_path: Path, new_content: str) -> Tuple[List[str], str]:
        """
        Prepend new_content to the beginning of the file.
        
        Args:
            file_path: Path to the file to modify
            new_content: Content to prepend
        
        Returns:
            Tuple of (modified lines, unified diff)
        """
        lines = self._read_file(file_path)
        original_lines = lines.copy()
        
        # Ensure new content ends with newline
        if not new_content.endswith('\n'):
            new_content += '\n'
        
        # Split new content into lines
        new_lines = new_content.split('\n')
        new_lines = [line + '\n' if line else line for line in new_lines]
        
        # Prepend the content
        modified_lines = new_lines + lines
        
        # Generate diff
        diff = self._generate_unified_diff(file_path, original_lines, modified_lines)
        
        return modified_lines, diff
    
    def apply_operation(self, operation: PatchOperation) -> Dict[str, Any]:
        """
        Apply a single patch operation.
        
        Args:
            operation: The patch operation to apply
        
        Returns:
            Dictionary with operation results including diff and status
        """
        file_path = self.project_root / operation.file
        
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Get content
        content = self._get_content(operation)
        
        # Apply operation based on type
        try:
            if operation.op == "replace-block":
                if operation.start is None or operation.end is None:
                    raise ValueError("replace-block requires 'start' and 'end' line numbers")
                modified_lines, diff = self.replace_block(
                    file_path,
                    operation.start,
                    operation.end,
                    content,
                    preserve_indent=not operation.openSpace
                )
            elif operation.op == "insert-before":
                if operation.line is None:
                    raise ValueError("insert-before requires 'line' number")
                modified_lines, diff = self.insert_before(
                    file_path,
                    operation.line,
                    content,
                    preserve_indent=not operation.openSpace
                )
            elif operation.op == "insert-after":
                if operation.line is None:
                    raise ValueError("insert-after requires 'line' number")
                modified_lines, diff = self.insert_after(
                    file_path,
                    operation.line,
                    content,
                    preserve_indent=not operation.openSpace
                )
            elif operation.op == "append":
                modified_lines, diff = self.append(file_path, content)
            elif operation.op == "prepend":
                modified_lines, diff = self.prepend(file_path, content)
            else:
                raise ValueError(f"Unknown operation type: {operation.op}")
            
            # Write the modified file
            self._write_file(file_path, modified_lines)
            
            # Check TypeScript if it's a TS file
            ts_check_ok = None
            if file_path.suffix in ['.ts', '.tsx']:
                ts_check_ok = self._check_typescript(file_path)
            
            result = {
                "success": True,
                "file": str(operation.file),
                "op": operation.op,
                "diff": diff,
                "ts_check_ok": ts_check_ok
            }
            
            logger.info(f"Successfully applied {operation.op} to {operation.file}")
            return result
            
        except Exception as e:
            logger.error(f"Error applying operation {operation.op} to {operation.file}: {e}")
            return {
                "success": False,
                "file": str(operation.file),
                "op": operation.op,
                "error": str(e),
                "ts_check_ok": False
            }
    
    def _check_typescript(self, file_path: Path) -> bool:
        """
        Check TypeScript syntax for a file.
        
        Args:
            file_path: Path to the TypeScript file
        
        Returns:
            True if type check passes, False otherwise
        """
        try:
            # Try to run tsc --noEmit on the file
            result = subprocess.run(
                ['npx', 'tsc', '--noEmit', str(file_path)],
                capture_output=True,
                text=True,
                cwd=self.project_root,
                timeout=30
            )
            
            if result.returncode == 0:
                logger.info(f"TypeScript check passed for {file_path}")
                return True
            else:
                logger.warning(f"TypeScript check failed for {file_path}: {result.stderr}")
                return False
        except subprocess.TimeoutExpired:
            logger.warning(f"TypeScript check timed out for {file_path}")
            return False
        except FileNotFoundError:
            logger.warning("TypeScript compiler (tsc) not found, skipping type check")
            return None
        except Exception as e:
            logger.warning(f"Error running TypeScript check: {e}")
            return False
    
    def _validate_against_task_schema(self, batch: PatchBatch) -> None:
        """
        Validate patch operations against .mission_control/tasks.json schema if it exists.

        Args:
            batch: The patch batch to validate

        Raises:
            ValueError: If schema validation fails
        """
        schema_path = self.project_root / ".mission_control" / "tasks.json"
        if not schema_path.exists():
            logger.debug("No task schema file found at .mission_control/tasks.json, skipping validation")
            return

        try:
            with open(schema_path, 'r', encoding='utf-8') as f:
                schema = json.load(f)

            # Validate each operation against the schema
            for i, operation in enumerate(batch.patches):
                if operation.taskId:
                    # Find the task in the schema
                    task_def = None
                    for task in schema.get('tasks', []):
                        if str(task.get('id')) == str(operation.taskId):
                            task_def = task
                            break

                    if task_def:
                        # Validate operation against task definition
                        expected_files = task_def.get('files', [])
                        if expected_files and operation.file not in expected_files:
                            raise ValueError(
                                f"Operation {i+1}: File '{operation.file}' not in allowed files "
                                f"for task {operation.taskId}: {expected_files}"
                            )

                        expected_ops = task_def.get('allowedOperations', [])
                        if expected_ops and operation.op not in expected_ops:
                            raise ValueError(
                                f"Operation {i+1}: Operation '{operation.op}' not in allowed operations "
                                f"for task {operation.taskId}: {expected_ops}"
                            )

                        logger.debug(f"Operation {i+1} validated against task {operation.taskId}")
                    else:
                        logger.warning(f"Operation {i+1}: Task {operation.taskId} not found in schema")

        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON in task schema file: {e}")
        except Exception as e:
            logger.error(f"Error validating against task schema: {e}")
            raise ValueError(f"Task schema validation failed: {e}")

    def apply_batch(self, batch: PatchBatch) -> Dict[str, Any]:
        """
        Apply a batch of patch operations.

        Args:
            batch: The patch batch to apply

        Returns:
            Dictionary with batch results
        """
        # Validate against task schema if available
        self._validate_against_task_schema(batch)

        results = []
        patch_id = batch.orderId or f"patch-{os.getpid()}-{int(time.time())}"
        
        logger.info(f"Applying patch batch: {patch_id} ({len(batch.patches)} operations)")
        
        for i, operation in enumerate(batch.patches):
            logger.info(f"Applying operation {i+1}/{len(batch.patches)}: {operation.op} on {operation.file}")
            result = self.apply_operation(operation)
            results.append(result)
            
            # Notify orchestrator for each operation
            if result.get("success"):
                self.notify_orchestrator(
                    patch_id=patch_id,
                    file=operation.file,
                    op=operation.op,
                    status="applied",
                    task_id=operation.taskId,
                    ts_check_ok=result.get("ts_check_ok"),
                    metadata={"operation_index": i, "total_operations": len(batch.patches)}
                )
        
        # Determine overall success
        all_success = all(r.get("success", False) for r in results)
        
        return {
            "patch_id": patch_id,
            "success": all_success,
            "operations": results,
            "total": len(results),
            "succeeded": sum(1 for r in results if r.get("success", False)),
            "failed": sum(1 for r in results if not r.get("success", False))
        }
    
    def notify_orchestrator(
        self,
        patch_id: str,
        file: str,
        op: str,
        status: str,
        task_id: Optional[str] = None,
        ts_check_ok: Optional[bool] = None,
        diff: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Send webhook notification to orchestrator about patch status.
        
        Args:
            patch_id: Unique identifier for the patch
            file: File that was patched
            op: Operation type
            status: Status of the patch (applied, failed, etc.)
            task_id: Optional task ID
            ts_check_ok: Optional TypeScript check result
            diff: Optional unified diff
            metadata: Optional additional metadata
        
        Returns:
            True if notification was sent successfully, False otherwise
        """
        try:
            import requests
            
            event_data = {
                "patch_id": patch_id,
                "file": file,
                "op": op,
                "status": status,
                "task_id": task_id,
                "ts_check_ok": ts_check_ok,
                "meta": metadata or {}
            }
            
            if diff:
                # Save diff to temp file and include path
                with tempfile.NamedTemporaryFile(mode='w', suffix='.diff', delete=False) as f:
                    f.write(diff)
                    event_data["diff_path"] = f.name
            
            url = f"{self.orchestrator_url}/api/patches/events"
            
            response = requests.post(url, json=event_data, timeout=10)
            response.raise_for_status()
            
            logger.info(f"Successfully notified orchestrator about patch {patch_id}")
            return True
            
        except ImportError:
            logger.warning("requests library not available, skipping orchestrator notification")
            return False
        except Exception as e:
            logger.error(f"Error notifying orchestrator: {e}")
            return False


def load_patch_batch(file_path: str) -> PatchBatch:
    """Load a patch batch from a JSON file."""
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    patches = []
    for patch_data in data.get("patches", []):
        patches.append(PatchOperation(**patch_data))
    
    return PatchBatch(
        orderId=data.get("orderId"),
        requester=data.get("requester", "agent"),
        reason=data.get("reason", ""),
        branch=data.get("branch", ""),
        patches=patches
    )


def main():
    """Main entry point for the patch manager script."""
    parser = argparse.ArgumentParser(
        description="Patch Manager - Deterministic code mutation system"
    )
    parser.add_argument(
        "--apply",
        type=str,
        help="Path to JSON file containing patch batch to apply"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show changes without applying them"
    )
    parser.add_argument(
        "--orchestrator-url",
        type=str,
        help="URL of the orchestrator service (default: from ORCHESTRATOR_URL env var or http://localhost:8787)"
    )
    parser.add_argument(
        "--project-root",
        type=str,
        help="Root directory of the project (default: current working directory)"
    )
    parser.add_argument(
        "--notify-only",
        action="store_true",
        help="Only send notification to orchestrator without applying patches"
    )
    
    args = parser.parse_args()
    
    if not args.apply and not args.notify_only:
        parser.print_help()
        sys.exit(1)
    
    manager = PatchManager(
        orchestrator_url=args.orchestrator_url,
        dry_run=args.dry_run,
        project_root=args.project_root
    )
    
    if args.notify_only:
        # Notification-only mode (for testing webhook)
        logger.info("Notification-only mode: sending test notification")
        manager.notify_orchestrator(
            patch_id="test-patch",
            file="test.ts",
            op="test",
            status="test",
            metadata={"mode": "notification_only"}
        )
        return
    
    # Load and apply patch batch
    try:
        batch = load_patch_batch(args.apply)
        result = manager.apply_batch(batch)
        
        # Print results
        print(json.dumps(result, indent=2))
        
        if not result["success"]:
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Error applying patch batch: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

