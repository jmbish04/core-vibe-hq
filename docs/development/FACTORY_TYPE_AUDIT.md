# Factory Workers Type Definition Audit

**Date**: 2025-11-07  
**Purpose**: Identify all local type definitions in factory workers that should be replaced with shared contract imports from `@shared/contracts`

## Shared Contracts Available

The following types are available from `@shared/contracts`:

- `PatchOperation` / `PatchOperationSchema`
- `PatchBatch` / `PatchBatchSchema`
- `PatchEvent` / `PatchEventSchema`
- `WebSocketMessage` / `WebSocketMessageSchema`
- `PatchEvents` (constants from `@shared/contracts/patchEvents`)
- `WebSocketMessageRequests` / `WebSocketMessageResponses` (from `@shared/contracts/messages`)

## Audit Results

### Agent Factory (`apps/factories/agent-factory/`)

#### Worker Types (`worker/agents/core/types.ts`)
- **Status**: ✅ No patch/event types found
- **Local Types**: 
  - `AgentInitArgs` - Factory-specific, keep local
  - `AllIssues` - Factory-specific, keep local
  - `ScreenshotData` - Factory-specific, keep local
  - `AgentSummary` - Factory-specific, keep local
  - `UserContext` - Factory-specific, keep local
  - `PhaseExecutionResult` - Factory-specific, keep local
  - `DeepDebugResult` - Factory-specific, keep local

#### Tool Types (`worker/agents/tools/toolkit/*.ts`)
- **Status**: ✅ No patch/event types found
- **Local Types**: Tool-specific types (WebSearchArgs, WaitArgs, etc.) - keep local

**Recommendation**: No changes needed - agent factory doesn't define patch/event types locally.

### UI Factory (`apps/factories/ui-factory/`)

#### Worker Configuration (`worker-configuration.d.ts`)
- **Status**: ⚠️ Contains `AiGatewayPatchLog` type
- **Location**: Line 6101
- **Type Definition**:
  ```typescript
  type AiGatewayPatchLog = {
    // ... (Cloudflare-generated type)
  }
  ```
- **Action**: This is a Cloudflare-generated type definition file. Review if this should reference shared contracts.

**Recommendation**: Review `AiGatewayPatchLog` - if it's related to patch operations, consider if it should use `PatchEvent` from shared contracts.

### Data Factory (`apps/factories/data-factory/`)

**Status**: ✅ No patch/event types found

**Recommendation**: No changes needed.

### Services Factory (`apps/factories/services-factory/`)

**Status**: ✅ No patch/event types found

**Recommendation**: No changes needed.

## Summary

### Findings

1. **No Local Patch Type Definitions Found**: Factory workers do not currently define local types for `PatchOperation`, `PatchBatch`, `PatchEvent`, or `WebSocketMessage`.

2. **No Imports from Shared Contracts**: Factory workers are not currently importing from `@shared/contracts`, which suggests they may not be using patch operations yet, or are using them through other means.

3. **Cloudflare-Generated Types**: The `worker-configuration.d.ts` files contain Cloudflare-generated types that may reference patch operations but are auto-generated.

### Recommendations

1. **Proactive Import Setup**: When factory workers need to use patch operations, they should import from `@shared/contracts`:
   ```typescript
   import { PatchOperation, PatchBatch, PatchEvent } from '@shared/contracts'
   ```

2. **Review Cloudflare Types**: Review `AiGatewayPatchLog` in UI factory to determine if it should reference shared contract types.

3. **Future-Proofing**: Add import statements to factory workers that will use patch operations, even if not currently using them, to ensure consistency.

4. **Documentation**: Update factory worker documentation to specify that all patch-related types must come from `@shared/contracts`.

## Next Steps

1. ✅ Complete audit of all factory workers
2. ⏭️ Review `AiGatewayPatchLog` type definition
3. ⏭️ Add shared contract imports to factory workers that will use patch operations
4. ⏭️ Update factory worker documentation with contract import requirements
5. ⏭️ Create migration guide for replacing any local types with shared contracts


