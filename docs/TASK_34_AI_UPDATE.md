# Task 34 Update: Add AI Integration Components

## Current Task 34 Scope

Task 34 currently migrates:
- Container monitoring system
- Terminal integration
- WebSocket integration
- Worker base templates
- Frontend components

## Required Additions

### 1. AI Demos Migration

Add to `migration_mappings`:
```python
"STAGING/ai/demos/evaluator-optimiser/": "@shared/worker-base/ai/evaluator-optimiser/",
"STAGING/ai/demos/agent-task-manager/": "@shared/worker-base/ai/agent-task-manager/",
"STAGING/ai/demos/agent-task-manager-human-in-the-loop/": "@shared/worker-base/ai/agent-task-manager-hitl/",
"STAGING/ai/demos/routing/": "@shared/worker-base/ai/routing/",
"STAGING/ai/demos/structured-output/": "@shared/worker-base/ai/structured-output/",
"STAGING/ai/demos/structured-output-node/": "@shared/worker-base/ai/structured-output-node/",
"STAGING/ai/demos/tool-calling/": "@shared/worker-base/ai/tool-calling/",
"STAGING/ai/demos/tool-calling-stream/": "@shared/worker-base/ai/tool-calling-stream/",
"STAGING/ai/demos/tool-calling-stream-traditional/": "@shared/worker-base/ai/tool-calling-stream-traditional/",
```

### 2. AI Packages Migration

Add to `migration_mappings`:
```python
"STAGING/ai/packages/ai-gateway-provider/": "@shared/ai-packages/ai-gateway-provider/",
"STAGING/ai/packages/workers-ai-provider/": "@shared/ai-packages/workers-ai-provider/",
```

### 3. AI Tools Migration

Add to `migration_mappings`:
```python
"STAGING/ai/tools/aicli/": "@shared/ai-tools/aicli/",
"STAGING/ai/tools/create-demo/": "@shared/ai-tools/create-demo/",
"STAGING/ai/tools/readme-generator/": "@shared/ai-tools/readme-generator/",
```

### 4. AI Utils Migration

Add to `migration_mappings`:
```python
"STAGING/ai/libs/utils/": "@shared/ai-utils/",
```

**Filter**: Exclude `logger.ts` or `logger.js` files (already handled via orchestrator)

### 5. Load Balancer Migration

Add to `migration_mappings`:
```python
"STAGING/containers-demos/load-balancer/": "@shared/container-load-balancer/",
```

### 6. Task Queue Migration

Add to `migration_mappings`:
```python
"STAGING/containers-demos/sqlite/": "@shared/container-task-queue/",
```

**Special Handling**: Replace SQLite database operations with orchestrator D1 RPC calls

### 7. Update Directory Structure

Add to `stage_folder_structure()`:
```python
directories = [
    "@shared/container/",
    "@shared/container-terminal/",
    "@shared/container-websocket/",
    "@shared/worker-base/",
    "@shared/frontend/",
    # AI directories
    "@shared/worker-base/ai/evaluator-optimiser/",
    "@shared/worker-base/ai/agent-task-manager/",
    "@shared/worker-base/ai/agent-task-manager-hitl/",
    "@shared/worker-base/ai/routing/",
    "@shared/worker-base/ai/structured-output/",
    "@shared/worker-base/ai/structured-output-node/",
    "@shared/worker-base/ai/tool-calling/",
    "@shared/worker-base/ai/tool-calling-stream/",
    "@shared/worker-base/ai/tool-calling-stream-traditional/",
    "@shared/ai-packages/ai-gateway-provider/",
    "@shared/ai-packages/workers-ai-provider/",
    "@shared/ai-tools/aicli/",
    "@shared/ai-tools/create-demo/",
    "@shared/ai-tools/readme-generator/",
    "@shared/ai-utils/",
    "@shared/container-load-balancer/",
    "@shared/container-task-queue/",
]
```

### 8. Import Path Replacements

Add patterns for AI components:
```python
# AI package imports
(r"from\s+['\"]ai-gateway-provider['\"]", "from '@shared/ai-packages/ai-gateway-provider'"),
(r"from\s+['\"]workers-ai-provider['\"]", "from '@shared/ai-packages/workers-ai-provider'"),

# AI demo imports
(r"from\s+['\"]\.\./demos/(.*?)['\"]", r"from '@shared/worker-base/ai/\1'"),

# Utils imports
(r"from\s+['\"]\.\./libs/utils/(.*?)['\"]", r"from '@shared/ai-utils/\1'"),

# Exclude logger imports
(r"from\s+['\"].*?logger['\"]", self._skip_logger_import),
```

### 9. Database Operation Replacement

Add function to replace SQLite operations:
```python
def replace_database_operations(self, file_path: Path) -> None:
    """Replace SQLite/local database operations with orchestrator RPC calls"""
    if file_path.suffix not in {'.ts', '.js', '.tsx', '.jsx'}:
        return
    
    content = file_path.read_text(encoding='utf-8')
    original_content = content
    
    # Replace SQLite exec calls with orchestrator RPC
    content = re.sub(
        r'this\.ctx\.storage\.sql\.exec\(',
        'await env.ORCHESTRATOR_TASK_QUEUE.executeSQL(',
        content
    )
    
    # Replace Durable Object storage with orchestrator RPC
    content = re.sub(
        r'this\.ctx\.storage\.(get|put|delete)',
        r'await env.ORCHESTRATOR_TASK_QUEUE.storage\1',
        content
    )
    
    if content != original_content:
        if not self.dry_run:
            file_path.write_text(content, encoding='utf-8')
        self.report.import_paths_updated.append(str(file_path))
```

### 10. Update File Filtering

Update `_should_copy_file()` to handle AI components:
```python
def _should_copy_file(self, file_path: Path, source_base: str) -> bool:
    """Determine if a file should be copied based on selection criteria"""
    # Skip certain file types
    skip_extensions = {'.pyc', '.pyo', '.pyd', '__pycache__', '.git', '.DS_Store'}
    if file_path.suffix in skip_extensions or file_path.name in skip_extensions:
        return False
    
    # Skip logger files
    if 'logger' in file_path.name.lower() and 'utils' in source_base:
        return False
    
    # Selective copying for worker and src directories
    if "worker" in source_base:
        # Copy all worker base files
        return True
    elif "src" in source_base:
        # Only copy React/shadcn components
        return any(keyword in str(file_path) for keyword in ['component', 'ui', '.tsx', '.jsx'])
    elif "ai" in source_base:
        # Copy all AI demo files
        return True
    elif "sqlite" in source_base:
        # Copy but mark for database operation replacement
        return True
        
    return True
```

### 11. Post-Migration Database Replacement

Add step after import path updates:
```python
# Step 4.5: Replace database operations
shared_path = Path("@shared")
if not self.dry_run or shared_path.exists():
    for file_path in shared_path.rglob("*"):
        if file_path.is_file():
            self.replace_database_operations(file_path)
```

## Migration Report Updates

Add to `MigrationReport`:
```python
@dataclass
class MigrationReport:
    files_copied: List[str]
    import_paths_updated: List[str]
    database_operations_replaced: List[str]  # NEW
    files_skipped: List[Tuple[str, str]]
    errors_encountered: List[str]
    backup_location: str
```

## Validation Updates

Add validation for:
- AI provider imports resolve correctly
- Database operations replaced with orchestrator RPC
- No local SQLite references remain
- Worker_name/container_name added to database calls

