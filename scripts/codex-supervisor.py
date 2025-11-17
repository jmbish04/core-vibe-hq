#!/usr/bin/env python3
"""Simple supervisor that keeps Codex working through the task queue.

This script periodically checks `.taskmaster/tasks/tasks.json` for the next
task assigned to Codex. If Codex is not already running, it updates the task
state directly in the JSON file and spawns a Codex session for that task.

Run it with:

    ./scripts/codex-supervisor.py

Stop it with Ctrl+C. The interval defaults to 30 seconds but can be changed via
the `CODEX_SUPERVISOR_INTERVAL` environment variable (seconds).
"""

from __future__ import annotations

import datetime as _dt
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, Iterable, Optional


# --- Configuration ---
PROJECT_ROOT: Path = Path("/Volumes/Projects/workers/core-vibe-hq").resolve()
TASK_FILE: Path = PROJECT_ROOT / ".taskmaster" / "tasks" / "tasks.json"
CODEX_SCRIPT: Path = PROJECT_ROOT / "scripts" / "codex-task.sh"
SCRIPTS_DIR: Path = PROJECT_ROOT / "scripts"
ENV_FILE: Path = SCRIPTS_DIR / ".env"
ENV_SUPERVISOR_FILE_SCRIPTS: Path = SCRIPTS_DIR / ".env.supervisor"
ENV_SUPERVISOR_FILE_ROOT: Path = PROJECT_ROOT / ".env.supervisor"


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
env_values: Dict[str, str] = {}
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


LOG_FILE_ENV = os.getenv("CODEX_SUPERVISOR_LOG")
LOG_FILE: Optional[Path]

if LOG_FILE_ENV:
    log_path = Path(LOG_FILE_ENV).expanduser()
    if not log_path.is_absolute():
        log_path = PROJECT_ROOT / log_path
    LOG_FILE = log_path
else:
    LOG_FILE = None

# Seconds between checks. Can override with env var CODEX_SUPERVISOR_INTERVAL
# Type hint added for the constant/variable
CHECK_INTERVAL: float = float(os.getenv("CODEX_SUPERVISOR_INTERVAL", "30"))


# --- Helper Functions ---

def log(message: str) -> None:
    """Prints a timestamped message to standard output."""
    timestamp: str = _dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [codex-supervisor] {message}")
    sys.stdout.flush()
    if LOG_FILE is not None:
        try:
            LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
            with LOG_FILE.open("a", encoding="utf-8") as fh:
                fh.write(f"[{timestamp}] [codex-supervisor] {message}\n")
        except Exception as exc:  # noqa: BLE001
            print(f"[{timestamp}] [codex-supervisor] warning: failed to write log file: {exc}", file=sys.stderr)


def load_tasks() -> Dict[str, Any]:
    """Loads the tasks data structure from the central JSON file."""
    try:
        with TASK_FILE.open("r", encoding="utf-8") as f:
            # Using Dict[str, Any] as the task structure can be complex
            return json.load(f)
    except FileNotFoundError:
        log(f"tasks file not found at {TASK_FILE}")
    except json.JSONDecodeError as exc:
        log(f"failed to decode tasks file: {exc}")
    return {}


def iter_tasks(tasks_data: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    """A generator that iterates over all tasks, including subtasks."""
    # Annotate inner variable `master`
    master: list[Dict[str, Any]] = tasks_data.get("master", {}).get("tasks", [])
    for task in master:
        yield task
        for sub in task.get("subtasks", []):
            # Annotate inner variables for clarity
            parent_id: str = str(task.get("id"))
            subcopy: Dict[str, Any] = dict(sub)
            subcopy["id"] = f"{parent_id}.{sub.get('id')}"
            yield subcopy


def get_next_codex_task(tasks_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Finds the next task assigned to 'codex' that is in a runnable state."""
    for task in iter_tasks(tasks_data):
        # Annotate inner variables
        status: str = str(task.get("status", "")).lower()
        assignee: Optional[str] = task.get("assignee")
        if assignee == "codex" and status in {"pending", "ready", "in-progress"}:
            return task
    return None


def set_task_fields(task_id: str, *, status: Optional[str] = None, assignee: Optional[str] = None) -> None:
    """Updates the status and/or assignee fields for the given task ID."""

    tasks_data = load_tasks()
    master_tasks: list[Dict[str, Any]] = tasks_data.get("master", {}).get("tasks", [])

    target_parent: Optional[Dict[str, Any]] = None
    target_task: Optional[Dict[str, Any]] = None

    if "." in task_id:
        parent_id, sub_id = task_id.split(".", 1)
        for task in master_tasks:
            if str(task.get("id")) == parent_id:
                target_parent = task
                for sub in task.get("subtasks", []):
                    if str(sub.get("id")) == sub_id:
                        target_task = sub
                        break
                break
    else:
        for task in master_tasks:
            if str(task.get("id")) == task_id:
                target_task = task
                break

    if target_task is None:
        raise ValueError(f"Task {task_id} not found in tasks.json")

    if status is not None:
        target_task["status"] = status
    if assignee is not None:
        if assignee == "":
            target_task.pop("assignee", None)
        else:
            target_task["assignee"] = assignee

    with TASK_FILE.open("w", encoding="utf-8") as f:
        json.dump(tasks_data, f, indent=2)
        f.write("\n")


def codex_running() -> bool:
    """Checks if a separate Codex process is currently running.

    Uses `ps` to inspect all processes so we can filter out the supervisor itself
    and only consider real Codex CLI sessions (interactive or exec).
    """

    try:
        output = subprocess.check_output(["ps", "-Ao", "pid=,command="], text=True)
    except Exception as exc:  # noqa: BLE001
        log(f"warning: failed to inspect processes: {exc}; assuming codex not running")
        return False

    my_pid = os.getpid()

    for line in output.splitlines():
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


def mark_task_in_progress(task_id: str) -> None:
    """Sets the task to in-progress in tasks.json and assigns it to Codex."""
    try:
        set_task_fields(task_id, status="in-progress", assignee="codex")
        log(f"updated task {task_id} -> in-progress (assignee codex)")
    except Exception as exc:  # noqa: BLE001 (informational logging only)
        log(f"warning: could not update task {task_id}: {exc}")


def launch_codex(task_id: str) -> None:
    """Launches a new, non-blocking subprocess to execute the Codex agent
    for a specific task.
    """
    log(f"dispatching task {task_id}")
    # subprocess.Popen returns a Popen object, which is implicitly ignored here.
    subprocess.Popen(
        [str(CODEX_SCRIPT), task_id],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        cwd=str(PROJECT_ROOT),
    )


def main() -> None:
    """The main supervisor loop."""
    if not TASK_FILE.exists():
        log(f"tasks file does not exist: {TASK_FILE}")
        sys.exit(1)

    log("supervisor started. Press Ctrl+C to exit.")

    try:
        # Annotate variables used within the loop
        running: bool
        tasks_data: Dict[str, Any]
        next_task: Optional[Dict[str, Any]]
        task_id: str
        
        while True:
            running = codex_running()
            if not running:
                tasks_data = load_tasks()
                next_task = get_next_codex_task(tasks_data)
                if next_task:
                    task_id = str(next_task.get("id"))
                    mark_task_in_progress(task_id)
                    launch_codex(task_id)
            else:
                log("codex already running; sleeping")
            time.sleep(CHECK_INTERVAL)
    except KeyboardInterrupt:
        log("shutting down…")
        sys.exit(0)


# --- Execution ---

if __name__ == "__main__":
    # Ensure signals interrupt sleep promptly on some platforms.
    signal.signal(signal.SIGINT, signal.default_int_handler)
    main()