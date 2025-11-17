#!/usr/bin/env python3
"""
Simple test script to verify schema validation functionality
"""

import json
import sys
import tempfile
from pathlib import Path

# Add current directory to path so we can import patch_manager
sys.path.insert(0, '.')

from patch_manager import PatchBatch, PatchOperation, PatchManager

def test_schema_validation():
    """Test schema validation functionality."""

    # Create temporary directory
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        # Create a task schema file
        schema_dir = temp_path / ".mission_control"
        schema_dir.mkdir()
        schema_file = schema_dir / "tasks.json"

        schema = {
            "tasks": [
                {
                    "id": "1",
                    "title": "Test Task",
                    "files": ["test.py", "main.py"],
                    "allowedOperations": ["replace-block", "insert-before"]
                }
            ]
        }

        with open(schema_file, 'w') as f:
            json.dump(schema, f)

        # Create patch manager with temp directory as project root
        manager = PatchManager(project_root=temp_path)

        # Test valid patch
        valid_batch = PatchBatch(
            patches=[
                PatchOperation(
                    op="replace-block",
                    file="test.py",
                    taskId="1"
                )
            ]
        )

        try:
            manager._validate_against_task_schema(valid_batch)
            print("✅ Valid patch passed schema validation")
        except ValueError as e:
            print(f"❌ Valid patch failed: {e}")
            return False

        # Test invalid file
        invalid_batch = PatchBatch(
            patches=[
                PatchOperation(
                    op="replace-block",
                    file="invalid.py",  # Not in allowed files
                    taskId="1"
                )
            ]
        )

        try:
            manager._validate_against_task_schema(invalid_batch)
            print("❌ Invalid file should have failed validation")
            return False
        except ValueError as e:
            print("✅ Invalid file correctly rejected:", str(e)[:100])

        # Test invalid operation
        invalid_op_batch = PatchBatch(
            patches=[
                PatchOperation(
                    op="delete",  # Not in allowed operations
                    file="test.py",
                    taskId="1"
                )
            ]
        )

        try:
            manager._validate_against_task_schema(invalid_op_batch)
            print("❌ Invalid operation should have failed validation")
            return False
        except ValueError as e:
            print("✅ Invalid operation correctly rejected:", str(e)[:100])

        # Test without schema file (should not raise error)
        schema_file.unlink()  # Remove schema file
        try:
            manager._validate_against_task_schema(valid_batch)
            print("✅ Validation gracefully skipped when no schema file exists")
        except ValueError:
            print("❌ Should not fail when no schema file exists")
            return False

    print("🎉 All schema validation tests passed!")
    return True

if __name__ == "__main__":
    success = test_schema_validation()
    sys.exit(0 if success else 1)
