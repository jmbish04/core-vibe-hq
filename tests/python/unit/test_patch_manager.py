import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from patch_manager import (
    PatchBatch,
    PatchManager,
    PatchOperation,
    load_patch_batch,
)


class PatchManagerTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self._temp_dir = tempfile.TemporaryDirectory()
        self.project_root = Path(self._temp_dir.name)
        self.manager = PatchManager(project_root=self.project_root)

    def tearDown(self) -> None:
        self._temp_dir.cleanup()

    def _write_file(self, relative_path: str, content: str) -> Path:
        file_path = self.project_root / relative_path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content, encoding="utf-8")
        return file_path

    def test_replace_block_preserves_indentation(self) -> None:
        self._write_file(
            "sample.py",
            "def greet():\n    message = 'hello'\n    return message\n",
        )

        operation = PatchOperation(
            op="replace-block",
            file="sample.py",
            start=2,
            end=2,
            block="message = 'hi there'\n",
        )

        result = self.manager.apply_operation(operation)

        self.assertTrue(result["success"])
        updated = (self.project_root / "sample.py").read_text(encoding="utf-8")
        self.assertIn("    message = 'hi there'\n", updated)

    def test_insert_before_inserts_at_expected_line(self) -> None:
        self._write_file("module.py", "def add(a, b):\n    return a + b\n")

        operation = PatchOperation(
            op="insert-before",
            file="module.py",
            line=2,
            block="    print('adding numbers')\n",
        )

        result = self.manager.apply_operation(operation)

        self.assertTrue(result["success"])
        updated_lines = (self.project_root / "module.py").read_text(encoding="utf-8").splitlines()
        self.assertEqual(updated_lines[1], "    print('adding numbers')")
        self.assertEqual(updated_lines[2], "    return a + b")

    def test_typescript_files_trigger_type_check(self) -> None:
        self._write_file("example.ts", "const value = 1;\n")

        operation = PatchOperation(
            op="append",
            file="example.ts",
            block="export const other = 2;\n",
        )

        with mock.patch.object(self.manager, "_check_typescript", return_value=True) as mock_check:
            result = self.manager.apply_operation(operation)

        self.assertTrue(result["success"])
        mock_check.assert_called_once()

        updated = (self.project_root / "example.ts").read_text(encoding="utf-8")
        self.assertIn("export const other = 2;", updated)

    def test_apply_batch_notifies_orchestrator(self) -> None:
        self._write_file("first.py", "value = 1\n")
        self._write_file("second.ts", "export const number = 1;\n")

        operations = [
            PatchOperation(op="append", file="first.py", block="value = 2\n"),
            PatchOperation(op="append", file="second.ts", block="export const other = 2;\n"),
        ]

        batch = PatchBatch(orderId="order-123", patches=operations)

        with mock.patch.object(self.manager, "notify_orchestrator", return_value=True) as mock_notify, \
             mock.patch.object(self.manager, "_check_typescript", return_value=True):
            result = self.manager.apply_batch(batch)

        self.assertTrue(result["success"])
        self.assertEqual(result["total"], 2)
        self.assertEqual(result["succeeded"], 2)
        mock_notify.assert_called()
        self.assertEqual(mock_notify.call_count, 2)

    def test_notify_orchestrator_sends_payload(self) -> None:
        mock_requests = SimpleNamespace()
        mock_response = SimpleNamespace(raise_for_status=lambda: None)
        mock_requests.post = mock.Mock(return_value=mock_response)

        payload = {
            "patch_id": "patch-1",
            "file": "file.ts",
            "op": "append",
            "status": "applied",
        }

        with mock.patch.dict(sys.modules, {"requests": mock_requests}):
            success = self.manager.notify_orchestrator(**payload)

        self.assertTrue(success)
        mock_requests.post.assert_called_once()
        args, kwargs = mock_requests.post.call_args
        self.assertTrue(args[0].endswith("/api/patches/events"))
        self.assertIn("json", kwargs)
        self.assertEqual(kwargs["json"]["patch_id"], "patch-1")

    def test_load_patch_batch_from_file(self) -> None:
        patch_json = {
            "orderId": "order-456",
            "patches": [
                {
                    "op": "append",
                    "file": "sample.py",
                    "block": "value = 42\n",
                }
            ],
        }

        json_path = self.project_root / "patch.json"
        json_path.write_text(json.dumps(patch_json), encoding="utf-8")

        batch = load_patch_batch(str(json_path))

        self.assertEqual(batch.orderId, "order-456")
        self.assertEqual(len(batch.patches), 1)
        self.assertEqual(batch.patches[0].op, "append")


if __name__ == "__main__":
    unittest.main()


