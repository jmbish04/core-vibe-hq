#!/usr/bin/env python3
"""Cloudflare AI overseer for Codex task orchestration.

This script continuously monitors Codex task status and recent supervisor logs,
sends them to the OpenAI-compatible Cloudflare Worker using the
`@cf/openai/gpt-oss-120b` model, and prints the model's analysis to stdout.

By default, it runs continuously with periodic checks. Use --once to run once
and exit, or --interval to change the check frequency.

Environment variables:
  WORKER_API_KEY   – required; bearer token for the worker
  OPENAI_API_BASE  – optional; defaults to https://openai-api-worker.hacolby.workers.dev
  CODEX_SUPERVISOR_LOG – optional; default log file to tail
  CODEX_ORCHESTRATOR_INTERVAL – optional; seconds between checks (default: 60)
  DEBUG – optional; set to enable debug output

Usage examples:
  ./scripts/codex-orchestrator.py                    # Run continuously, check every 60s
  ./scripts/codex-orchestrator.py --once              # Run once and exit
  ./scripts/codex-orchestrator.py --interval 30       # Check every 30 seconds
  CODEX_ORCHESTRATOR_INTERVAL=120 ./scripts/codex-orchestrator.py  # Check every 2 minutes
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import re
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


PROJECT_ROOT = Path("/Volumes/Projects/workers/core-vibe-hq").resolve()
TASK_FILE = PROJECT_ROOT / ".taskmaster" / "tasks" / "tasks.json"
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
ENV_FILE = SCRIPTS_DIR / ".env"
ENV_SUPERVISOR_FILE_SCRIPTS = SCRIPTS_DIR / ".env.supervisor"
ENV_SUPERVISOR_FILE_ROOT = PROJECT_ROOT / ".env.supervisor"


def load_env_file(path: Path) -> Dict[str, str]:
    values: Dict[str, str] = {}
    if not path.exists():
        return values

    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        # Strip quotes and whitespace from value
        value = value.strip().strip('"').strip("'")
        values[key.strip()] = value
    return values


# Load .env files (check multiple locations, later files take precedence)
env_values = {}
# Check scripts/.env.supervisor first
if ENV_SUPERVISOR_FILE_SCRIPTS.exists():
    env_values.update(load_env_file(ENV_SUPERVISOR_FILE_SCRIPTS))
# Check project root .env.supervisor
if ENV_SUPERVISOR_FILE_ROOT.exists():
    env_values.update(load_env_file(ENV_SUPERVISOR_FILE_ROOT))
# Check scripts/.env last (highest precedence)
if ENV_FILE.exists():
    env_values.update(load_env_file(ENV_FILE))

for key, value in env_values.items():
    os.environ.setdefault(key, value)


def load_tasks() -> Dict[str, Any]:
    try:
        with TASK_FILE.open("r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        raise SystemExit(f"tasks file not found at {TASK_FILE}")
    except json.JSONDecodeError as exc:
        raise SystemExit(f"failed to decode tasks file: {exc}")


def summarise_tasks(tasks_data: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    codex_tasks: List[Dict[str, Any]] = []
    other_tasks: List[Dict[str, Any]] = []

    for task in tasks_data.get("master", {}).get("tasks", []):
        entry = {
            "id": task.get("id"),
            "title": task.get("title"),
            "status": task.get("status"),
            "assignee": task.get("assignee"),
            "dependencies": task.get("dependencies", []),
        }
        if entry["assignee"] == "codex":
            codex_tasks.append(entry)
        else:
            other_tasks.append(entry)

        for sub in task.get("subtasks", []):
            sub_entry = {
                "id": f"{task.get('id')}.{sub.get('id')}",
                "title": sub.get("title"),
                "status": sub.get("status"),
                "assignee": sub.get("assignee"),
                "dependencies": sub.get("dependencies", []),
            }
            if sub_entry["assignee"] == "codex":
                codex_tasks.append(sub_entry)
            else:
                other_tasks.append(sub_entry)

    return codex_tasks, other_tasks


def tail_log(log_file: Path, max_lines: int) -> str:
    if not log_file.exists():
        return f"(log file {log_file} not found)"

    lines = log_file.read_text(encoding="utf-8", errors="ignore").splitlines()
    if max_lines <= 0 or len(lines) <= max_lines:
        return "\n".join(lines)
    return "\n".join(lines[-max_lines:])


def codex_running() -> bool:
    try:
        output = os.popen("ps -Ao pid=,command=").read().splitlines()
    except Exception:  # noqa: BLE001
        return False

    my_pid = os.getpid()
    for line in output:
        line = line.strip()
        if not line:
            continue
        try:
            pid_str, command = line.split(None, 1)
            pid = int(pid_str)
        except ValueError:
            continue

        if pid == my_pid:
            continue
        if "codex-supervisor" in command:
            continue
        if "codex " in command or command.endswith("/codex") or " codex:" in command:
            return True
    return False


def build_prompt(codex_tasks: List[Dict[str, Any]], other_tasks: List[Dict[str, Any]], codex_active: bool, log_excerpt: str) -> str:
    payload = {
        "codex_active": codex_active,
        "codex_tasks": codex_tasks,
        "other_tasks": other_tasks,
        "log_excerpt": log_excerpt,
    }
    return json.dumps(payload, indent=2)


def parse_sse_response(raw_response: str) -> str:
    """Parse Server-Sent Events (SSE) format response."""
    lines = raw_response.splitlines()
    content_parts = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Check for error messages
        if line.startswith("$error:"):
            error_msg = line[7:].strip()
            raise SystemExit(f"API error: {error_msg}")
        
        # Skip [DONE] marker
        if line == "data: [DONE]":
            break
        
        # Parse data: prefix (SSE format)
        if line.startswith("data: "):
            data_str = line[6:]  # Skip "data: "
            try:
                data_obj = json.loads(data_str)
                # Extract content from choices - handle both streaming and non-streaming
                choices = data_obj.get("choices", [])
                if choices:
                    choice = choices[0]
                    # Try delta format (streaming)
                    delta = choice.get("delta", {})
                    if delta:
                        content = delta.get("content", "")
                        if content:
                            content_parts.append(content)
                            continue
                    
                    # Try message format (complete message)
                    message = choice.get("message", {})
                    if message:
                        content = message.get("content", "")
                        if content:
                            # If we get a complete message, return it (non-streaming within SSE)
                            return content
                    
                    # Try direct content field
                    content = choice.get("content", "")
                    if content:
                        content_parts.append(content)
            except json.JSONDecodeError:
                # If not JSON, might be a plain text response
                if data_str and data_str != "[DONE]":
                    content_parts.append(data_str)
    
    if not content_parts:
        # Try to parse as a single JSON object (non-streaming response)
        try:
            data_obj = json.loads(raw_response)
            choices = data_obj.get("choices", [])
            if choices:
                message = choices[0].get("message", {})
                content = message.get("content", "")
                if content:
                    return content
        except json.JSONDecodeError:
            pass
        
        raise SystemExit(f"Could not extract content from SSE response. Raw: {raw_response[:200]}")
    
    return "".join(content_parts)


def call_cloudflare_api(prompt: str, api_key: str, api_base: str, stream: bool = False) -> str:
    endpoint = api_base.rstrip("/") + "/v1/chat/completions"
    body = {
        "model": "@cf/openai/gpt-oss-120b",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a Codex orchestration supervisor. Review the provided task and log summary, "
                    "determine whether Codex is behaving correctly, identify any anomalies, "
                    "and provide both a report AND actionable steps.\n\n"
                    "Your response should include:\n"
                    "1. A text report summarizing findings\n"
                    "2. A JSON actions block with specific actions to take\n\n"
                    "Available actions:\n"
                    "- reassign_to_cursor: {task_id} - Reassign task from codex to cursor\n"
                    "- set_task_status: {task_id, status} - Update task status (pending, in-progress, done, etc.)\n"
                    "- launch_codex: {task_id} - Launch Codex for a specific task\n"
                    "- check_stuck: {task_id, auto_reassign} - Check if task is stuck and optionally reassign\n\n"
                    "Format your response with the report first, then a JSON block like:\n"
                    "```json\n"
                    "{\n"
                    "  \"actions\": [\n"
                    "    {\"action\": \"reassign_to_cursor\", \"params\": {\"task_id\": \"3\"}},\n"
                    "    {\"action\": \"set_task_status\", \"params\": {\"task_id\": \"3\", \"status\": \"pending\"}}\n"
                    "  ]\n"
                    "}\n"
                    "```"
                ),
            },
            {
                "role": "user",
                "content": (
                    "Here is the current Codex state and recent supervisor log excerpt. "
                    "Analyse it and report on Codex responsiveness, any blocked work, and next actions.\n\n"
                    f"```json\n{prompt}\n```"
                ),
            },
        ],
        "temperature": 0.2,
        "max_tokens": 800,
        "stream": stream,
    }

    data = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            status_code = response.getcode()
            content_type = response.headers.get("Content-Type", "")
            
            # Read response - handle both streaming and non-streaming
            raw_response = response.read().decode("utf-8")
            
            if not raw_response:
                raise SystemExit(f"API returned empty response (status {status_code})")
            
            # Check for SSE format (either by content-type or content)
            is_sse = (
                "text/event-stream" in content_type or 
                "event-stream" in content_type or
                raw_response.startswith("data:") or 
                "$error:" in raw_response or
                "\ndata:" in raw_response
            )
            
            if is_sse:
                return parse_sse_response(raw_response)
            
            # Try to parse as JSON (non-streaming)
            try:
                response_data = json.loads(raw_response)
            except json.JSONDecodeError:
                print(f"[DEBUG] Response status: {status_code}", file=sys.stderr)
                print(f"[DEBUG] Response Content-Type: {content_type}", file=sys.stderr)
                print(f"[DEBUG] Raw response (first 500 chars): {raw_response[:500]}", file=sys.stderr)
                raise SystemExit(f"API returned invalid JSON (status {status_code}): {raw_response[:200]}")
            
            # Extract content from JSON response - handle nested structure
            # First try OpenAI-compatible format
            choices = response_data.get("choices", [])
            if choices:
                message = choices[0].get("message", {})
                content = message.get("content")
                if content:
                    return content
            
            # Try Cloudflare-specific format with output array
            output = response_data.get("output", [])
            if output:
                # Look for message type in output array
                for item in output:
                    if item.get("type") == "message":
                        content_list = item.get("content", [])
                        for content_item in content_list:
                            if content_item.get("type") == "output_text":
                                text = content_item.get("text")
                                if text:
                                    return text
                    # Also check for direct text in content
                    content_list = item.get("content", [])
                    if content_list:
                        for content_item in content_list:
                            text = content_item.get("text")
                            if text:
                                return text
            
            raise SystemExit("Could not extract text content from API response")
            
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise SystemExit(f"API request failed: {exc.code} {exc.reason}\n{detail}")
    except urllib.error.URLError as exc:
        raise SystemExit(f"API request error: {exc}")


def log(message: str) -> None:
    """Print timestamped log message."""
    timestamp: str = _dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [codex-orchestrator] {message}")
    sys.stdout.flush()


# Action handlers for Codex orchestration
def set_task_status_direct(task_id: str, status: str) -> None:
    """Update task status directly in tasks.json."""
    tasks_data = load_tasks()
    master_tasks = tasks_data.get("master", {}).get("tasks", [])
    
    if "." in task_id:
        parent_id, sub_id = task_id.split(".", 1)
        for task in master_tasks:
            if str(task.get("id")) == parent_id:
                for sub in task.get("subtasks", []):
                    if str(sub.get("id")) == sub_id:
                        sub["status"] = status
                        break
                break
    else:
        for task in master_tasks:
            if str(task.get("id")) == task_id:
                task["status"] = status
                break
    
    with TASK_FILE.open("w", encoding="utf-8") as f:
        json.dump(tasks_data, f, indent=2)
        f.write("\n")


def update_task_assignee(task_id: str, assignee: Optional[str] = None) -> None:
    """Update task assignee directly in tasks.json."""
    tasks_data = load_tasks()
    master_tasks = tasks_data.get("master", {}).get("tasks", [])
    
    if "." in task_id:
        parent_id, sub_id = task_id.split(".", 1)
        for task in master_tasks:
            if str(task.get("id")) == parent_id:
                for sub in task.get("subtasks", []):
                    if str(sub.get("id")) == sub_id:
                        if assignee:
                            sub["assignee"] = assignee
                        else:
                            sub.pop("assignee", None)
                        break
                break
    else:
        for task in master_tasks:
            if str(task.get("id")) == task_id:
                if assignee:
                    task["assignee"] = assignee
                else:
                    task.pop("assignee", None)
                break
    
    with TASK_FILE.open("w", encoding="utf-8") as f:
        json.dump(tasks_data, f, indent=2)
        f.write("\n")


def reassign_task_to_cursor(task_id: str) -> None:
    """Reassign a task from codex to cursor."""
    update_task_assignee(task_id, "cursor")
    log(f"reassigned task {task_id} from codex to cursor")


def check_codex_stuck(task_id: str, max_inactive_minutes: int = 30) -> bool:
    """Check if Codex appears stuck on a task (in-progress for too long without updates)."""
    tasks_data = load_tasks()
    
    # Find the task
    task = None
    for t in tasks_data.get("master", {}).get("tasks", []):
        if str(t.get("id")) == task_id:
            task = t
            break
        for sub in t.get("subtasks", []):
            if f"{t.get('id')}.{sub.get('id')}" == task_id:
                task = sub
                break
    
    if not task:
        return False
    
    status = task.get("status", "")
    if status != "in-progress":
        return False
    
    # If task has been in-progress but Codex is not running, it might be stuck
    if not codex_running():
        return True
    
    # TODO: Could check last update time from logs if available
    return False


def launch_codex_task(task_id: str) -> None:
    """Launch Codex for a specific task."""
    codex_script = PROJECT_ROOT / "scripts" / "codex-task.sh"
    if codex_script.exists():
        subprocess.Popen(
            [str(codex_script), task_id],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=str(PROJECT_ROOT),
        )
        log(f"launched Codex for task {task_id}")
    else:
        log(f"warning: codex-task.sh not found, cannot launch task {task_id}")


def execute_actions(actions: List[Dict[str, Any]]) -> None:
    """Execute a list of actions returned by the AI model."""
    for action in actions:
        action_type = action.get("action")
        params = action.get("params", {})
        
        try:
            if action_type == "reassign_to_cursor":
                task_id = params.get("task_id")
                if task_id:
                    reassign_task_to_cursor(task_id)
                    log(f"executed: reassign task {task_id} to cursor")
            
            elif action_type == "set_task_status":
                task_id = params.get("task_id")
                status = params.get("status")
                if task_id and status:
                    set_task_status_direct(task_id, status)
                    log(f"executed: set task {task_id} status to {status}")
            
            elif action_type == "launch_codex":
                task_id = params.get("task_id")
                if task_id:
                    launch_codex_task(task_id)
                    log(f"executed: launch Codex for task {task_id}")
            
            elif action_type == "check_stuck":
                task_id = params.get("task_id")
                if task_id:
                    is_stuck = check_codex_stuck(task_id)
                    if is_stuck:
                        log(f"detected: task {task_id} appears stuck")
                        # Optionally trigger reassignment
                        if params.get("auto_reassign", False):
                            reassign_task_to_cursor(task_id)
            
            elif action_type == "log_message":
                message = params.get("message", "")
                if message:
                    log(f"AI message: {message}")
            
            else:
                log(f"unknown action type: {action_type}")
        
        except Exception as exc:  # noqa: BLE001
            log(f"error executing action {action_type}: {exc}")


def parse_actions_from_response(response: str) -> tuple[str, List[Dict[str, Any]]]:
    """Parse actions from AI response. Returns (report_text, actions_list)."""
    actions = []
    report_text = response
    
    # Try to extract JSON actions block
    # Look for ```json or ``` blocks with actions
    
    # Pattern 1: ```json block with actions array (multi-line)
    json_block_pattern = r"```json\s*(\{[\s\S]*?\})\s*```"
    matches = re.findall(json_block_pattern, response, re.DOTALL)
    for match in matches:
        try:
            data = json.loads(match)
            if "actions" in data:
                actions.extend(data["actions"])
                # Remove the JSON block from report text
                report_text = re.sub(r"```json[\s\S]*?```", "", report_text, flags=re.DOTALL)
        except json.JSONDecodeError:
            pass
    
    # Pattern 2: Look for JSON-like structure in the text
    json_pattern = r'\{[^}]*"action"[^}]*\}'
    json_matches = re.findall(json_pattern, response)
    for match in json_matches:
        try:
            data = json.loads(match)
            if "action" in data:
                actions.append(data)
        except json.JSONDecodeError:
            pass
    
    # If no structured actions found, try to infer actions from text
    if not actions:
        # Check for common phrases that indicate actions
        if "stuck" in response.lower() or "not responding" in response.lower():
            # Try to find task IDs mentioned
            task_id_pattern = r"task\s+(\d+(?:\.\d+)?)"
            task_ids = re.findall(task_id_pattern, response, re.IGNORECASE)
            for task_id in task_ids:
                actions.append({
                    "action": "check_stuck",
                    "params": {"task_id": task_id, "auto_reassign": True}
                })
        
        if "reassign" in response.lower() or "assign to cursor" in response.lower():
            task_id_pattern = r"task\s+(\d+(?:\.\d+)?)"
            task_ids = re.findall(task_id_pattern, response, re.IGNORECASE)
            for task_id in task_ids:
                actions.append({
                    "action": "reassign_to_cursor",
                    "params": {"task_id": task_id}
                })
    
    return report_text.strip(), actions


def run_orchestration_check(api_key: str, api_base: str, log_file: Path, max_lines: int, stream: bool) -> None:
    """Run a single orchestration check, report, and execute actions."""
    try:
        tasks_data = load_tasks()
        codex_tasks, other_tasks = summarise_tasks(tasks_data)
        log_excerpt = tail_log(log_file, max_lines)
        codex_active = codex_running()

        prompt = build_prompt(codex_tasks, other_tasks, codex_active, log_excerpt)
        response = call_cloudflare_api(prompt, api_key=api_key, api_base=api_base, stream=stream)

        # Parse actions from response
        report_text, actions = parse_actions_from_response(response)

        log("=== Codex Orchestration Report ===")
        print(report_text)
        print()  # Blank line after report

        # Execute actions if any were found
        if actions:
            log(f"Executing {len(actions)} action(s)...")
            execute_actions(actions)
            log("Actions completed.")
        else:
            log("No actions to execute.")
        
        print()  # Blank line after actions
    except Exception as exc:  # noqa: BLE001
        log(f"Error during orchestration check: {exc}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Codex orchestration monitor via Cloudflare AI")
    parser.add_argument(
        "--log-file",
        type=Path,
        default=(Path(os.getenv("CODEX_SUPERVISOR_LOG", "logs/codex-supervisor.log")).expanduser()),
        help="Supervisor log file to analyse (default: logs/codex-supervisor.log)",
    )
    parser.add_argument(
        "--max-lines",
        type=int,
        default=40,
        help="Maximum number of log lines to include in the analysis (default: 40)",
    )
    parser.add_argument(
        "--api-base",
        default=os.getenv("OPENAI_API_BASE") or os.getenv("WORKER_API_BASE", "https://openai-api-worker.hacolby.workers.dev"),
        help="Base URL for the OpenAI-compatible worker",
    )
    parser.add_argument(
        "--stream",
        action="store_true",
        help="Enable streaming responses (default: non-streaming for more reliable connections)",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=int(os.getenv("CODEX_ORCHESTRATOR_INTERVAL", "60")),
        help="Interval between checks in seconds (default: 60, or CODEX_ORCHESTRATOR_INTERVAL env var)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run once and exit (default: run continuously)",
    )
    args = parser.parse_args()

    # Debug output - show which env files were found
    env_files_loaded = []
    if ENV_SUPERVISOR_FILE_SCRIPTS.exists():
        env_files_loaded.append("scripts/.env.supervisor")
    if ENV_SUPERVISOR_FILE_ROOT.exists():
        env_files_loaded.append(".env.supervisor (root)")
    if ENV_FILE.exists():
        env_files_loaded.append("scripts/.env")
    
    if os.getenv("DEBUG"):
        print(f"[DEBUG] Checking env files: {', '.join(env_files_loaded) if env_files_loaded else 'none found'}", file=sys.stderr)
    
    api_key = os.getenv("WORKER_API_KEY")
    if not api_key:
        print(f"[DEBUG] WORKER_API_KEY not found in environment", file=sys.stderr)
        print(f"[DEBUG] Available env vars starting with WORKER: {[k for k in os.environ.keys() if k.startswith('WORKER')]}", file=sys.stderr)
        raise SystemExit(
            f"WORKER_API_KEY environment variable is required.\n"
            f"Please set it in scripts/.env or scripts/.env.supervisor\n"
            f"Found env files: {', '.join(env_files_loaded) if env_files_loaded else 'none'}"
        )
    
    # Strip any remaining whitespace from API key
    api_key = api_key.strip()
    
    if os.getenv("DEBUG"):
        # Debug output (mask the key for security)
        if len(api_key) > 8:
            masked_key = api_key[:4] + "..." + api_key[-4:]
        else:
            masked_key = "***"
        print(f"[DEBUG] Using API key: {masked_key} (length: {len(api_key)})", file=sys.stderr)

    if args.once:
        # Run once and exit
        run_orchestration_check(api_key, args.api_base, args.log_file, args.max_lines, args.stream)
        return

    # Run continuously
    log(f"orchestrator started (interval: {args.interval}s). Press Ctrl+C to exit.")
    
    try:
        while True:
            run_orchestration_check(api_key, args.api_base, args.log_file, args.max_lines, args.stream)
            log(f"sleeping for {args.interval}s until next check...")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        log("orchestrator stopped by user.")
    except Exception as exc:  # noqa: BLE001
        log(f"unhandled error in orchestrator: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    # Ensure signals interrupt sleep promptly on some platforms.
    signal.signal(signal.SIGINT, signal.default_int_handler)
    main()

