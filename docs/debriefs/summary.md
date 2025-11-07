# Debrief: Shared Contracts and DB Extensions

## Overview

- Added `@shared/contracts` with Zod schemas and message types.
- Extended Kysely DB schema for patch events, delivery reports, AI provider, and ops logs.

## Files Added

- `@shared/contracts/contracts.ts`
- `@shared/contracts/patchEvents.ts`
- `@shared/contracts/messages.ts`
- `@shared/contracts/index.ts`
- `docs/contracts/README.md`

## Files Updated

- `orchestrator/worker/db/schema.ts` — new tables added.

## Next Steps

- Add SQL migrations corresponding to new tables.
- Wire event publishing to use `PatchEvents` constants.

