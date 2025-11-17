"""
Integration tests for patch_manager.py

These tests verify end-to-end functionality including:
- Full patch workflow from file creation to application
- TypeScript validation integration
- Orchestrator webhook notifications
- Error handling with malformed patches
- Cross-platform compatibility
"""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from patch_manager import PatchBatch, PatchOperation, PatchManager


class PatchManagerIntegrationTest(unittest.TestCase):
    """Integration tests for the complete patch manager workflow."""

    def setUp(self):
        """Set up test environment."""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project_root = Path(self.temp_dir.name)

        # Create test files
        self.test_file = self.project_root / "test.py"
        self.test_file.write_text("def hello():\n    print('hello world')\n    return True\n")

        self.ts_test_file = self.project_root / "test.ts"
        self.ts_test_file.write_text("function hello(): boolean {\n    console.log('hello world');\n    return true;\n}\n")

    def tearDown(self):
        """Clean up test environment."""
        self.temp_dir.cleanup()

    def test_end_to_end_patch_workflow(self):
        """Test complete patch workflow from creation to application."""
        # Create a patch batch
        batch = PatchBatch(
            orderId="test-integration-123",
            patches=[
                PatchOperation(
                    op="replace-block",
                    file="test.py",
                    start=2,
                    end=2,
                    block="    print('hello universe')\n",
                    taskId="1"
                ),
                PatchOperation(
                    op="insert-after",
                    file="test.ts",
                    line=2,
                    block="    console.log('added line');\n",
                    taskId="2"
                )
            ]
        )

        # Save batch to file
        batch_file = self.project_root / "test_batch.json"
        with open(batch_file, 'w') as f:
            json.dump({
                "orderId": batch.orderId,
                "patches": [
                    {
                        "op": patch.op,
                        "file": patch.file,
                        "start": patch.start,
                        "end": patch.end,
                        "line": patch.line,
                        "block": patch.block,
                        "taskId": patch.taskId
                    }
                    for patch in batch.patches
                ]
            }, f, indent=2)

        # Run patch manager
        manager = PatchManager(project_root=self.project_root)
        result = manager.apply_batch(batch)

        # Verify results
        self.assertTrue(result["success"])
        self.assertEqual(len(result["results"]), 2)

        # Check file modifications
        py_content = self.test_file.read_text()
        self.assertIn("hello universe", py_content)
        self.assertNotIn("hello world", py_content)

        ts_content = self.ts_test_file.read_text()
        self.assertIn("added line", ts_content)

    def test_typescript_validation_integration(self):
        """Test TypeScript validation integration."""
        # Create invalid TypeScript
        invalid_ts = self.project_root / "invalid.ts"
        invalid_ts.write_text("function invalid(): {\n    return 'missing type';\n}\n")

        batch = PatchBatch(
            patches=[
                PatchOperation(
                    op="replace-block",
                    file="invalid.ts",
                    start=1,
                    end=1,
                    block="function invalid(): string {\n"
                )
            ]
        )

        manager = PatchManager(project_root=self.project_root)

        # Mock subprocess to simulate tsc success
        with mock.patch('subprocess.run') as mock_run:
            mock_run.return_value = mock.Mock(returncode=0, stdout="", stderr="")

            result = manager.apply_batch(batch)

            # Verify TypeScript check was called
            mock_run.assert_called()

    def test_orchestrator_webhook_integration(self):
        """Test orchestrator webhook notification integration."""
        batch = PatchBatch(
            orderId="webhook-test-123",
            patches=[
                PatchOperation(
                    op="append",
                    file="test.py",
                    block="\n# Added line\n",
                    taskId="1"
                )
            ]
        )

        manager = PatchManager(
            orchestrator_url="http://test-orchestrator:8787",
            project_root=self.project_root
        )

        # Mock requests to simulate webhook
        with mock.patch('requests.post') as mock_post:
            mock_post.return_value = mock.Mock(status_code=200, json=lambda: {"status": "ok"})

            result = manager.apply_batch(batch)

            # Verify webhook was called
            self.assertTrue(mock_post.called)
            call_args = mock_post.call_args
            self.assertIn("http://test-orchestrator:8787", call_args[0][0])

    def test_error_handling_malformed_patches(self):
        """Test error handling with malformed patch operations."""
        # Test with invalid file path
        batch = PatchBatch(
            patches=[
                PatchOperation(
                    op="replace-block",
                    file="nonexistent.py",
                    start=1,
                    end=1,
                    block="replacement"
                )
            ]
        )

        manager = PatchManager(project_root=self.project_root)
        result = manager.apply_batch(batch)

        # Should fail gracefully
        self.assertFalse(result["success"])
        self.assertIn("error", result["results"][0])

    def test_batch_processing_multiple_operations(self):
        """Test processing multiple operations in a batch."""
        # Create multiple test files
        files = []
        for i in range(3):
            file_path = self.project_root / f"test{i}.py"
            file_path.write_text(f"def func{i}():\n    return {i}\n")
            files.append(file_path)

        batch = PatchBatch(
            orderId="multi-op-test",
            patches=[
                PatchOperation(
                    op="insert-before",
                    file="test0.py",
                    line=1,
                    block="# Comment before func0\n",
                    taskId="1"
                ),
                PatchOperation(
                    op="append",
                    file="test1.py",
                    block="\n# Appended to func1\n",
                    taskId="2"
                ),
                PatchOperation(
                    op="replace-block",
                    file="test2.py",
                    start=2,
                    end=2,
                    block="    return 999\n",
                    taskId="3"
                )
            ]
        )

        manager = PatchManager(project_root=self.project_root)
        result = manager.apply_batch(batch)

        # Verify all operations succeeded
        self.assertTrue(result["success"])
        self.assertEqual(len(result["results"]), 3)
        self.assertTrue(all(op_result["success"] for op_result in result["results"]))

        # Verify file modifications
        self.assertIn("# Comment before func0", files[0].read_text())
        self.assertIn("# Appended to func1", files[1].read_text())
        self.assertIn("return 999", files[2].read_text())

    def test_dry_run_mode(self):
        """Test dry run mode doesn't modify files."""
        original_content = self.test_file.read_text()

        batch = PatchBatch(
            patches=[
                PatchOperation(
                    op="replace-block",
                    file="test.py",
                    start=2,
                    end=2,
                    block="    print('modified')\n"
                )
            ]
        )

        manager = PatchManager(dry_run=True, project_root=self.project_root)
        result = manager.apply_batch(batch)

        # Verify success but no file modification
        self.assertTrue(result["success"])
        self.assertEqual(self.test_file.read_text(), original_content)

    def test_unified_diff_generation(self):
        """Test unified diff generation for patch operations."""
        batch = PatchBatch(
            patches=[
                PatchOperation(
                    op="replace-block",
                    file="test.py",
                    start=2,
                    end=2,
                    block="    print('modified line')\n"
                )
            ]
        )

        manager = PatchManager(project_root=self.project_root)
        result = manager.apply_batch(batch)

        # Verify diff is included in results
        self.assertTrue(result["success"])
        operation_result = result["results"][0]
        self.assertIn("diff", operation_result)
        self.assertIsInstance(operation_result["diff"], str)

    def test_cross_platform_compatibility(self):
        """Test operations work with different line endings."""
        # Create file with Windows line endings
        win_file = self.project_root / "windows.py"
        win_file.write_text("def test():\r\n    return True\r\n")

        batch = PatchBatch(
            patches=[
                PatchOperation(
                    op="insert-after",
                    file="windows.py",
                    line=1,
                    block="    pass\r\n"
                )
            ]
        )

        manager = PatchManager(project_root=self.project_root)
        result = manager.apply_batch(batch)

        # Should handle line endings correctly
        self.assertTrue(result["success"])
        content = win_file.read_text()
        self.assertIn("pass", content)


class PatchManagerCLITest(unittest.TestCase):
    """Test the patch manager CLI interface."""

    def setUp(self):
        """Set up CLI test environment."""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project_root = Path(self.temp_dir.name)

        # Create test files
        self.test_file = self.project_root / "cli_test.py"
        self.test_file.write_text("def cli_test():\n    return 'original'\n")

    def tearDown(self):
        """Clean up CLI test environment."""
        self.temp_dir.cleanup()

    def test_cli_batch_application(self):
        """Test CLI batch application."""
        # Create batch file
        batch_data = {
            "orderId": "cli-test-123",
            "patches": [
                {
                    "op": "replace-block",
                    "file": "cli_test.py",
                    "start": 2,
                    "end": 2,
                    "block": "    return 'modified'\n",
                    "taskId": "1"
                }
            ]
        }

        batch_file = self.project_root / "cli_batch.json"
        with open(batch_file, 'w') as f:
            json.dump(batch_data, f)

        # Run CLI command
        result = subprocess.run(
            [sys.executable, "patch_manager.py", "--apply", str(batch_file), "--project-root", str(self.project_root)],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent.parent
        )

        # Verify success
        self.assertEqual(result.returncode, 0)

        # Verify file was modified
        content = self.test_file.read_text()
        self.assertIn("'modified'", content)
        self.assertNotIn("'original'", content)


if __name__ == '__main__':
    unittest.main()
