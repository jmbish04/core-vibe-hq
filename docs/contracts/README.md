# Shared Contracts

Canonical Zod schemas and TypeScript types for patches and WebSocket messages used across orchestrator and workers.

## Contents

- Patch operation and batch schemas
- Patch event schema and event constants
- WebSocket message schema and helpers

## Import

```ts
import { PatchBatchSchema, PatchEventSchema, WebSocketMessageSchema } from '@shared/contracts'
```

## Validation Examples

```ts
const batch = PatchBatchSchema.parse({ patchId: 'p1', operations: [{ op: 'add', path: '/a', value: 1 }] })
```

