import json
import argparse
import shutil
from pathlib import Path

# Define ANSI color codes for logging
class bcolors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def log(color, action, message):
    """Helper function for colored logging."""
    print(f"[{color}{bcolors.BOLD}{action.upper()}{bcolors.ENDC}] {message}")

def migrate_files(plan_path, source_dir, target_dir):
    """
    Reads a migration plan and copies/moves files from a source
    directory to a target directory structure.
    """
    plan_path = Path(plan_path)
    source_dir = Path(source_dir)
    target_dir = Path(target_dir)

    if not plan_path.exists():
        log(bcolors.FAIL, "Error", f"Plan file not found: {plan_path}")
        return

    if not source_dir.exists():
        log(bcolors.FAIL, "Error", f"Source directory not found: {source_dir}")
        return

    # Create the root target directory if it doesn't exist
    target_dir.mkdir(parents=True, exist_ok=True)
    log(bcolors.OKGREEN, "Setup", f"Ensured target directory exists: {target_dir}")

    # Read and validate plan file
    try:
        with open(plan_path, 'r', encoding='utf-8') as f:
            content = f.read()
            if not content.strip():
                log(bcolors.FAIL, "Error", f"Plan file is empty: {plan_path}")
                return
            plan = json.loads(content)
    except json.JSONDecodeError as e:
        log(bcolors.FAIL, "Error", f"Invalid JSON in plan file: {plan_path}")
        log(bcolors.FAIL, "Error", f"JSON error: {e}")
        return
    except Exception as e:
        log(bcolors.FAIL, "Error", f"Failed to read plan file: {plan_path}")
        log(bcolors.FAIL, "Error", f"Error: {e}")
        return

    total_copied = 0
    total_ignored = 0

    for component_key, items in plan.items():
        if component_key == "ignore":
            for item in items:
                log(bcolors.WARNING, "Ignore", f"Ignoring '{item['source_path']}' ({item['notes']})")
                total_ignored += 1
            continue

        log(bcolors.HEADER, "Component", f"Processing: {component_key}")

        for item in items:
            action = item.get("action", "ignore").lower()
            if action == "ignore":
                log(bcolors.WARNING, "Ignore", f"Ignoring '{item['source_path']}'")
                total_ignored += 1
                continue

            source_path_str = item['source_path']
            target_repo_str = item['target_repo']
            
            source_full_path = source_dir / source_path_str
            target_base_repo_path = target_dir / target_repo_str
            target_full_path = target_base_repo_path / source_path_str

            if not source_full_path.exists():
                log(bcolors.FAIL, "Missing", f"Source not found, skipping: {source_full_path}")
                continue

            try:
                # Ensure the target parent directory exists
                target_full_path.parent.mkdir(parents=True, exist_ok=True)

                if source_full_path.is_dir():
                    # Copy directory contents
                    shutil.copytree(source_full_path, target_full_path, dirs_exist_ok=True)
                    log_action = bcolors.OKCYAN if action == "adapt" else bcolors.OKGREEN
                    log(log_action, action, f"Copied dir '{source_full_path}' to '{target_full_path}'")
                else:
                    # Copy single file
                    shutil.copy2(source_full_path, target_full_path)
                    log_action = bcolors.OKCYAN if action == "adapt" else bcolors.OKGREEN
                    log(log_action, action, f"Copied file '{source_full_path}' to '{target_full_path}'")
                
                total_copied += 1

            except Exception as e:
                log(bcolors.FAIL, "Error", f"Failed to copy '{source_full_path}' to '{target_full_path}': {e}")

    log(bcolors.HEADER, "Summary", "Migration complete.")
    print(f"  {bcolors.OKGREEN}Files/Dirs Copied: {total_copied}{bcolors.ENDC}")
    print(f"  {bcolors.WARNING}Items Ignored:     {total_ignored}{bcolors.ENDC}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Migrate vibesdk files to Mission Control architecture based on a JSON plan.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument(
        "--plan",
        default="plan.json",
        help="Path to the JSON migration plan file."
    )
    parser.add_argument(
        "--source",
        default="./vibesdk",
        help="Path to the source 'vibesdk' directory."
    )
    parser.add_argument(
        "--target",
        default="./mission-control",
        help="Path to the root 'mission-control' target directory."
    )
    
    args = parser.parse_args()
    
    migrate_files(args.plan, args.source, args.target)
