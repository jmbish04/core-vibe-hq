#!/usr/bin/env python3

import argparse
import json
import os
import sys
from typing import Any, Dict, List, Optional, Tuple


ALLOWED_STATUSES = {
    "pending",
    "in-progress",
    "done",
    "deferred",
    "cancelled",
    "blocked",
    "review",
}


def load_tasks(tasks_path: str, tag: Optional[str]) -> Tuple[str, List[Dict[str, Any]]]:
    if not os.path.exists(tasks_path):
        print(f"Error: tasks file not found at {tasks_path}", file=sys.stderr)
        sys.exit(1)
    with open(tasks_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Determine tag
    resolved_tag = tag
    if resolved_tag is None:
        if "master" in data:
            resolved_tag = "master"
        elif isinstance(data, dict) and len(data.keys()) == 1:
            resolved_tag = list(data.keys())[0]
        else:
            print("Error: unable to resolve tag; please pass --tag", file=sys.stderr)
            sys.exit(2)

    if resolved_tag not in data:
        print(f"Error: tag '{resolved_tag}' not found in tasks file", file=sys.stderr)
        sys.exit(2)

    tag_block = data[resolved_tag]
    tasks = tag_block.get("tasks", [])
    return resolved_tag, tasks


def build_index(tasks: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    index: Dict[str, Dict[str, Any]] = {}
    for t in tasks:
        tid = str(t.get("id"))
        index[tid] = t
        for st in t.get("subtasks", []) or []:
            st_id = str(st.get("id"))
            composite = f"{tid}.{st_id}"
            index[composite] = st
    return index


def get_status(index: Dict[str, Dict[str, Any]], task_id: str) -> Optional[str]:
    t = index.get(task_id)
    if t is None:
        return None
    return t.get("status")


def dependencies_satisfied(index: Dict[str, Dict[str, Any]], parent_id: str, item: Dict[str, Any]) -> bool:
    deps = item.get("dependencies", []) or []
    if not deps:
        return True

    def dep_is_done(dep_id: str) -> bool:
        status = get_status(index, dep_id)
        return status in {"done", "cancelled"}

    # Dependencies may be numbers (subtasks) or strings (top-level ids)
    for d in deps:
        if isinstance(d, int):
            dep_key = f"{parent_id}.{d}"
        else:
            dep_key = str(d)
        if not dep_is_done(dep_key):
            return False
    return True


def iter_flattened(tasks: List[Dict[str, Any]]):
    for t in tasks:
        tid = str(t.get("id"))
        yield (tid, None, t)  # (composite_id, parent_id, obj)
        for st in t.get("subtasks", []) or []:
            sid = f"{tid}.{st.get('id')}"
            yield (sid, tid, st)


def compute_priority_value(priority: Optional[str]) -> int:
    if priority == "high":
        return 0
    if priority == "medium":
        return 1
    if priority == "low":
        return 2
    return 1


def list_tasks(tasks_path: str, tag: Optional[str], only_available: bool, next_only: bool) -> int:
    resolved_tag, tasks = load_tasks(tasks_path, tag)
    index = build_index(tasks)

    available: List[Tuple[str, Dict[str, Any], Optional[str]]] = []  # (id, obj, parent_id)
    for cid, parent_id, obj in iter_flattened(tasks):
        status = (obj.get("status") or "").strip()
        if status != "pending":
            continue
        if not dependencies_satisfied(index, parent_id or cid, obj):
            continue
        available.append((cid, obj, parent_id))

    def sort_key(item: Tuple[str, Dict[str, Any], Optional[str]]):
        cid, obj, parent_id = item
        # Priority: use parent priority for subtasks, else own
        prio: Optional[str] = None
        if parent_id:
            parent = index.get(parent_id) or {}
            prio = parent.get("priority")
        else:
            prio = obj.get("priority")
        return (
            compute_priority_value((prio or "medium").lower()),
            tuple(int(p) for p in cid.split(".") if str(p).isdigit()),
        )

    available.sort(key=sort_key)

    if next_only:
        if not available:
            print("No next task available.")
            return 0
        cid, obj, _ = available[0]
        title = obj.get("title")
        status = obj.get("status")
        print(f"Next: {cid} | {status} | {title}")
        return 0

    if only_available:
        if not available:
            print("No available tasks (all blocked or already in-progress/done).")
            return 0
        for cid, obj, _ in available:
            title = obj.get("title")
            status = obj.get("status")
            print(f"{cid} | {status} | {title}")
        return 0

    # Full list
    for cid, parent_id, obj in iter_flattened(tasks):
        title = obj.get("title")
        status = obj.get("status")
        deps = obj.get("dependencies", []) or []
        deps_fmt: List[str] = []
        for d in deps:
            if isinstance(d, int):
                deps_fmt.append(f"{parent_id or cid}.{d}")
            else:
                deps_fmt.append(str(d))
        deps_str = ",".join(deps_fmt)
        print(f"{cid} | {status} | deps:[{deps_str}] | {title}")
    return 0


def set_status(tasks_path: str, tag: Optional[str], id_arg: str, status: str) -> int:
    status = status.strip()
    if status not in ALLOWED_STATUSES:
        print(
            f"Error: invalid status '{status}'. Allowed: {', '.join(sorted(ALLOWED_STATUSES))}",
            file=sys.stderr,
        )
        return 2

    with open(tasks_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    resolved_tag = tag or ("master" if "master" in data else list(data.keys())[0])
    if resolved_tag not in data:
        print(f"Error: tag '{resolved_tag}' not found", file=sys.stderr)
        return 2

    tasks = data[resolved_tag].get("tasks", [])
    target: Optional[Dict[str, Any]] = None

    if "." in id_arg:
        parent_id, sub_id = id_arg.split(".", 1)
        for t in tasks:
            if str(t.get("id")) == parent_id:
                for st in t.get("subtasks", []) or []:
                    if str(st.get("id")) == sub_id:
                        target = st
                        break
                break
    else:
        for t in tasks:
            if str(t.get("id")) == id_arg:
                target = t
                break

    if target is None:
        print(f"Error: task id '{id_arg}' not found", file=sys.stderr)
        return 3

    target["status"] = status

    # Write back with 2-space indentation, preserve key order
    tmp_path = tasks_path + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp_path, tasks_path)

    print(f"Updated {id_arg} -> {status}")
    return 0


def main():
    parser = argparse.ArgumentParser(description="Lightweight Taskmaster JSON helper")
    parser.add_argument(
        "--file",
        default=os.path.join(".taskmaster", "tasks", "tasks.json"),
        help="Path to tasks.json (default: .taskmaster/tasks/tasks.json)",
    )
    parser.add_argument("--tag", default=None, help="Tag to operate on (default: auto, prefers 'master')")

    sub = parser.add_subparsers(dest="cmd", required=True)

    ls = sub.add_parser("list", help="List tasks")
    ls.add_argument("--available", action="store_true", help="Show only available tasks (pending with deps satisfied)")
    ls.add_argument("--next", dest="next_only", action="store_true", help="Show only the next task")

    nx = sub.add_parser("next", help="Show the next available task")

    upd = sub.add_parser("set-status", help="Update status of a task or subtask")
    upd.add_argument("--id", required=True, help="Task id (e.g., 5 or 5.1)")
    upd.add_argument("--status", required=True, help=f"New status ({', '.join(sorted(ALLOWED_STATUSES))})")

    args = parser.parse_args()

    if args.cmd == "list":
        sys.exit(list_tasks(args.file, args.tag, args.available, args.next_only))
    if args.cmd == "next":
        sys.exit(list_tasks(args.file, args.tag, only_available=True, next_only=True))
    if args.cmd == "set-status":
        sys.exit(set_status(args.file, args.tag, args.id, args.status))


if __name__ == "__main__":
    main()


