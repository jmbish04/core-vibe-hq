#!/usr/bin/env python3
"""Taskmaster MCP server implemented with FastMCP.

This module re-uses the existing ``taskmaster_cli.py`` helper so that the
Python-based MCP server stays in sync with the CLI behaviour.  It exposes the
same tools as the Node.js implementation under ``scripts/mcp/taskmaster_mcp.mjs``
but runs entirely in Python, which makes it compatible with ``fastmcp`` and the
``fastmcp run`` command.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from typing import List, Optional

from mcp.server.fastmcp import FastMCP


ALLOWED_STATUSES = {
    "pending",
    "in-progress",
    "done",
    "deferred",
    "cancelled",
    "blocked",
    "review",
}


_HERE = Path(__file__).resolve()
_CLI_PATH = _HERE.parent.parent / "taskmaster_cli.py"


def _build_cli_args(tag: Optional[str], file: Optional[str]) -> List[str]:
    args: List[str] = []
    if file:
        args.extend(["--file", file])
    if tag:
        args.extend(["--tag", tag])
    return args


def _run_cli(*cli_args: str) -> str:
    if not _CLI_PATH.exists():
        raise FileNotFoundError(
            f"Taskmaster CLI helper not found at {_CLI_PATH}. "
            "Ensure you are running within the repository workspace."
        )

    env = os.environ.copy()
    proc = subprocess.run(  # noqa: S603 - intended command execution
        [sys.executable, str(_CLI_PATH), *cli_args],
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )

    if proc.returncode != 0:
        stderr = proc.stderr.strip()
        stdout = proc.stdout.strip()
        message = stderr or stdout or "Taskmaster CLI call failed"
        raise RuntimeError(message)

    return proc.stdout.strip()


mcp = FastMCP("taskmaster-mcp")


@mcp.tool()
def tasks_next(tag: Optional[str] = None, file: Optional[str] = None) -> str:
    """Get the next available Taskmaster task, respecting dependencies."""

    args = _build_cli_args(tag, file)
    args.append("next")
    return _run_cli(*args)


@mcp.tool()
def tasks_list_available(tag: Optional[str] = None, file: Optional[str] = None) -> str:
    """List pending Taskmaster tasks whose dependencies are satisfied."""

    args = _build_cli_args(tag, file)
    args.extend(["list", "--available"])
    return _run_cli(*args)


@mcp.tool()
def tasks_set_status(
    id: str,
    status: str,
    tag: Optional[str] = None,
    file: Optional[str] = None,
) -> str:
    """Update the status of a Taskmaster task or subtask."""

    status_normalised = status.strip()
    if status_normalised not in ALLOWED_STATUSES:
        allowed = ", ".join(sorted(ALLOWED_STATUSES))
        raise ValueError(f"Invalid status '{status_normalised}'. Allowed values: {allowed}")

    args = _build_cli_args(tag, file)
    args.extend(["set-status", "--id", id, "--status", status_normalised])
    return _run_cli(*args)


if __name__ == "__main__":
    mcp.run()


