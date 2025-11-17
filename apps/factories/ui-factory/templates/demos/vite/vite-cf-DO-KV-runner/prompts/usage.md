# Usage

> Deprecated template. Prefer `vite-cf-DO-v2-runner` or `vite-cf-DO-runner`.

## Overview
Workers + React with Durable Objects (DO) + KV. Type-safe APIs with mock fallback.
- Frontend: React Router 6 + TypeScript + ShadCN UI
- Backend: Hono Worker with DO + KV
- Shared: Types in `shared/types.ts`

## ⚠️ IMPORTANT: Demo Content
**The existing demo pages, mock data, and API endpoints are FOR TEMPLATE UNDERSTANDING ONLY.**
- Replace `HomePage.tsx` and `DemoPage.tsx` with actual application pages
- Remove or replace mock data in `shared/mock-data.ts` with real data structures
- Remove or replace demo API endpoints (`/api/demo`, `/api/seed`) and implement actual business logic
- The counter example is just to show DO patterns - replace with real functionality

## Tech
- React Router 6, ShadCN UI, Tailwind, Lucide, Hono, TypeScript

## Development Restrictions
- **Tailwind Colors**: Hardcode custom colors in `tailwind.config.js`, NOT in `index.css`
- **Components**: Use existing ShadCN components instead of writing custom ones
- **Icons**: Import from `lucide-react` directly
- **Error Handling**: ErrorBoundary components are pre-implemented
- **Worker Patterns**: Follow exact patterns in `worker/index.ts` to avoid breaking functionality

## Styling
- Responsive, accessible
- Prefer ShadCN components; Tailwind for layout/spacing/typography

## Code Organization

### Frontend Structure
- `src/pages/HomePage.tsx` - Homepage for user to see while you are working on the app
- `src/pages/DemoPage.tsx` - Main demo showcasing KV + DO features
- `src/components/ThemeToggle.tsx` - Theme switching component
- `src/hooks/useTheme.ts` - Theme management hook

### Backend Structure
- `worker/index.ts` - Worker entrypoint (registers routes; do not change patterns)
- `worker/userRoutes.ts` - Add routes here
- `worker/durableObject.ts` - DO methods (e.g., counter)
- `worker/core-utils.ts` - Core types/utilities (do not modify)

### Shared
- `shared/types.ts` - API/data types
- `shared/mock-data.ts` - Demo-only; replace
- `shared/seed-utils.ts` - Demo-only; remove when not needed

## API Patterns

### Adding Endpoints
Follow this pattern in `worker/userRoutes.ts`:
```typescript
// KV endpoint with mock fallback
app.get('/api/my-data', async (c) => {
  const items = await c.env.KVStore.get('my_key');
  const data: MyType[] = items ? JSON.parse(items) : MOCK_FALLBACK;
  return c.json({ success: true, data } satisfies ApiResponse<MyType[]>);
});

// Durable Object endpoint
app.post('/api/counter/action', async (c) => {
  const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
  const data = await stub.myMethod() as number;
  return c.json({ success: true, data } satisfies ApiResponse<number>);
});
```

### Type Safety
- Return `ApiResponse<T>`
- Share types via `shared/types.ts`
- Mock data must match types

## Bindings
CRITICAL: Only these bindings exist:
- `GlobalDurableObject` (stateful operations)
- `KVStore` (persistence)

## Frontend
- Call `/api/*` endpoints directly
- Handle loading/errors; use shared types
