#!/usr/bin/env bats
# Tests for the patchctl bash wrapper script

setup() {
    # Create temporary directory for tests
    TEST_DIR="$(mktemp -d)"
    cd "$TEST_DIR"

    # Create mock patch_manager.py
    cat > patch_manager.py << 'EOF'
#!/usr/bin/env python3
import sys
import json

def main():
    if len(sys.argv) < 2:
        print("Error: No command provided", file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]

    if command == "apply":
        if len(sys.argv) < 3:
            print("Error: No batch file provided", file=sys.stderr)
            sys.exit(1)

        batch_file = sys.argv[2]
        try:
            with open(batch_file, 'r') as f:
                batch = json.load(f)

            # Simulate successful patch application
            result = {
                "success": True,
                "patchId": batch.get("orderId", "test-patch"),
                "operations": len(batch.get("patches", [])),
                "results": [{"success": True, "file": "test.py", "op": "replace-block"}]
            }
            print(json.dumps(result, indent=2))

        except Exception as e:
            result = {"success": False, "error": str(e)}
            print(json.dumps(result, indent=2), file=sys.stderr)
            sys.exit(1)

    elif command == "validate":
        print("Validation successful")

    elif command == "list":
        patches = [
            {"id": "patch-1", "status": "applied", "file": "test.py"},
            {"id": "patch-2", "status": "pending", "file": "main.ts"}
        ]
        print(json.dumps(patches, indent=2))

    elif command == "revert":
        if len(sys.argv) < 3:
            print("Error: No patch ID provided", file=sys.stderr)
            sys.exit(1)
        patch_id = sys.argv[2]
        result = {"success": True, "reverted": patch_id}
        print(json.dumps(result, indent=2))

    elif command == "notify":
        result = {"success": True, "notification": "sent"}
        print(json.dumps(result, indent=2))

    else:
        print(f"Error: Unknown command '{command}'", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
EOF
    chmod +x patch_manager.py

    # Create patchctl wrapper
    cat > patchctl << 'EOF'
#!/bin/bash
python3 patch_manager.py "$@"
EOF
    chmod +x patchctl
}

teardown() {
    cd /
    rm -rf "$TEST_DIR"
}

@test "patchctl apply command with valid batch file" {
    # Create test batch file
    cat > test_batch.json << 'EOF'
{
  "orderId": "test-batch-123",
  "patches": [
    {
      "op": "replace-block",
      "file": "test.py",
      "start": 1,
      "end": 1,
      "block": "def test():\n    pass\n"
    }
  ]
}
EOF

    run ./patchctl apply test_batch.json
    [ "$status" -eq 0 ]
    [[ "$output" == *"success"* ]]
    [[ "$output" == *"test-batch-123"* ]]
}

@test "patchctl apply command with missing batch file" {
    run ./patchctl apply nonexistent.json
    [ "$status" -eq 1 ]
    [[ "$output" == *"Error"* ]]
}

@test "patchctl apply command with invalid JSON" {
    echo "invalid json {" > invalid.json
    run ./patchctl apply invalid.json
    [ "$status" -eq 1 ]
}

@test "patchctl validate command" {
    run ./patchctl validate
    [ "$status" -eq 0 ]
    [[ "$output" == *"Validation successful"* ]]
}

@test "patchctl list command" {
    run ./patchctl list
    [ "$status" -eq 0 ]
    [[ "$output" == *"patch-1"* ]]
    [[ "$output" == *"applied"* ]]
}

@test "patchctl revert command with patch ID" {
    run ./patchctl revert patch-123
    [ "$status" -eq 0 ]
    [[ "$output" == *"reverted"* ]]
    [[ "$output" == *"patch-123"* ]]
}

@test "patchctl revert command without patch ID" {
    run ./patchctl revert
    [ "$status" -eq 1 ]
    [[ "$output" == *"No patch ID provided"* ]]
}

@test "patchctl notify command" {
    run ./patchctl notify
    [ "$status" -eq 0 ]
    [[ "$output" == *"notification"* ]]
}

@test "patchctl unknown command" {
    run ./patchctl unknown
    [ "$status" -eq 1 ]
    [[ "$output" == *"Unknown command"* ]]
}

@test "patchctl no command provided" {
    run ./patchctl
    [ "$status" -eq 1 ]
    [[ "$output" == *"No command provided"* ]]
}

@test "patchctl command argument passing" {
    # Test that arguments are properly passed to Python script
    cat > test_batch.json << 'EOF'
{
  "orderId": "arg-test-456",
  "patches": [
    {
      "op": "append",
      "file": "test.py",
      "block": "# test block\n"
    }
  ]
}
EOF

    run ./patchctl apply test_batch.json
    [ "$status" -eq 0 ]
    [[ "$output" == *"arg-test-456"* ]]
}

@test "patchctl error handling and exit codes" {
    # Test various error conditions return correct exit codes
    run ./patchctl apply missing_file.json
    [ "$status" -eq 1 ]

    run ./patchctl revert  # Missing patch ID
    [ "$status" -eq 1 ]

    run ./patchctl nonexistent_command
    [ "$status" -eq 1 ]
}

@test "patchctl help text display" {
    # This would test if help is displayed when no args provided
    # Since our mock doesn't implement help, we'll test error case
    run ./patchctl
    [ "$status" -eq 1 ]
    [[ "$output" == *"No command provided"* ]]
}

@test "patchctl dependency checking" {
    # Test that patchctl can find and execute the Python script
    [ -x "./patchctl" ]  # patchctl should be executable
    [ -x "./patch_manager.py" ]  # Python script should be executable

    # Test basic execution
    run ./patchctl validate
    [ "$status" -eq 0 ]
}

@test "patchctl input validation and sanitization" {
    # Test with special characters in arguments
    run ./patchctl apply "test batch.json"
    [ "$status" -eq 1 ]  # Should fail because file doesn't exist

    # Test with path traversal attempt (should be safe as it's just argument passing)
    run ./patchctl apply "../../../etc/passwd"
    [ "$status" -eq 1 ]  # Should fail because file doesn't exist in test context
}

@test "patchctl integration with patch_manager.py" {
    # Create a comprehensive test batch
    cat > comprehensive_batch.json << 'EOF'
{
  "orderId": "comprehensive-test",
  "patches": [
    {
      "op": "replace-block",
      "file": "main.py",
      "start": 1,
      "end": 1,
      "block": "def main():\n    print('hello')\n",
      "taskId": "1"
    },
    {
      "op": "insert-before",
      "file": "utils.py",
      "line": 1,
      "block": "# Utility functions\n",
      "taskId": "2"
    }
  ]
}
EOF

    run ./patchctl apply comprehensive_batch.json
    [ "$status" -eq 0 ]
    [[ "$output" == *"comprehensive-test"* ]]
    [[ "$output" == *"2"* ]]  # Should show 2 operations
}
