# PartyServer Integration Plan

This document captures how the new PartyServer primitives will be wired into Core Vibe HQ, and what remains for a full end-to-end experience.

## Goals

1. Stream container terminals in real-time with automatic reconnection and state fan-out.
2. Broadcast ops monitor updates the moment `OpsMonitorService.runScan` completes.
3. Provide a simple API surface for front-end clients (`partysocket`) and orchestrator workers.

## Current Back-End State

- `TerminalServer` Durable Object (PartyServer) established at `orchestrator/worker/durable-objects/terminal/TerminalServer.ts`.
- `OpsMonitorBroadcastServer` PartyServer Durable Object ready for ops scan broadcasts.
- Hono routing (`setupTerminalRoutes`) proxies `/api/workers/:workerId/terminal` to the PartyServer DO.
- TypeScript path aliases point to `third_party/partykit` sources so both worker and app builds can import `partyserver`, `partysocket`, and `hono-party` without npm registry access.

## Front-End Integration Checklist

1. **Dependency wiring**
   - Update the front-end bundle to import from `partykit/partysocket`.
   - Provide a wrapper hook/component that handles connection state, retries, and message parsing (`useTerminalStream`).

2. **Terminal UI**
   - Extend the xterm.js wrapper to accept an external write stream and to buffer outbound keystrokes.
   - Attach Partysocket events:
     - `open`: reset terminal, show connection banner.
     - `message`: route chunk → xterm.
     - `close/error`: display transient notification and toggle reconnect spinner.

3. **Ops Dashboard Feed**
   - Create a `useOpsMonitorFeed` hook that connects to the `OPS_MONITOR_BROADCAST` PartyServer and exposes:
     - Latest scan summary
     - Historical events for activity log
     - Connection health (for UI badges)

4. **Pause/HIL Controls**
   - When a task is paused or marked for human review, emit a PartyServer message so connected terminals/dashboards can freeze activity and highlight HIL state.
   - Resume broadcasts once human approves.

5. **Testing**
   - Add Vitest unit coverage around the Partysocket hook (mock WebSocket).
   - Browser-level smoke test (Playwright) to ensure terminals reconnect and continue streaming after a simulated disconnect.

6. **Documentation**
   - Embed a real-time architecture diagram (Stitch mock) referencing: Orchestrator → PartyServer DO → Partysocket clients.
   - Update runbooks with troubleshooting steps (e.g., how to inspect PartyServer rooms via DO logs).

## Sequencing

1. Finish lint/test debt so the new code can ship with confidence.
2. Implement Partysocket client wrappers + xterm integration.
3. Hook ops dashboard widgets to PartyServer feeds.
4. Follow with observability dashboards (Durable Object metrics, WebSocket connection counts).

## Notes

- The PartyServer sources have been vendored; `nanoid` was replaced with `crypto.randomUUID` to avoid extra deps.
- If future features require scaling beyond a single PartyServer instance, investigate `partysub` for sharding support.
