# PartyKit Integration Guide

This document describes the PartyKit (PartyServer/Partysocket/Hono) integration for real-time features in the orchestrator.

## Overview

PartyKit packages have been imported into `third_party/partykit/` and integrated for:
1. **Terminal Streaming** - Real-time terminal output from containers to clients
2. **Ops Monitoring Broadcast** - Real-time ops scan results to dashboard clients

## Architecture

### Terminal Streaming

**Durable Object**: `TerminalServer` (`orchestrator/worker/durable-objects/terminal/TerminalServer.ts`)
- Extends PartyServer `Server` class
- Proxies WebSocket connections from clients to container terminals
- Manages container WebSocket lifecycle
- Broadcasts container output to all connected clients

**Route**: `/api/workers/:workerId/terminal`
- Uses `hono-party` middleware for PartyServer routing
- Accepts optional `sandboxId` query parameter
- Creates/retrieves TerminalServer DO instance per worker

**Usage**:
```typescript
// Client connects via PartySocket
import PartySocket from 'partysocket';

const socket = new PartySocket({
  host: 'your-orchestrator-domain.com',
  room: 'worker-123',
  party: 'terminal-server', // Maps to TERMINAL_SERVER DO binding
  query: { sandboxId: 'sandbox-456' }
});

socket.addEventListener('message', (event) => {
  // Terminal output data
  console.log(event.data);
});
```

### Ops Monitoring Broadcast

**Durable Object**: `OpsMonitorBroadcastServer` (`orchestrator/worker/durable-objects/ops/OpsMonitorBroadcastServer.ts`)
- Extends PartyServer `Server` class
- Broadcasts ops scan results to all connected clients
- Single broadcast channel (`main`) for all ops scans

**Route**: `/api/ops/broadcast`
- Uses `hono-party` middleware for PartyServer routing
- Clients connect to receive real-time scan results

**Integration**:
- `OpsMonitorService.runScan()` accepts optional `BroadcastCallback`
- `OpsMonitorOps` entrypoint provides broadcast callback
- Scheduled handler (`orchestrator/worker/index.ts`) also broadcasts

**Usage**:
```typescript
// Client connects via PartySocket
import PartySocket from 'partysocket';

const socket = new PartySocket({
  host: 'your-orchestrator-domain.com',
  room: 'main',
  party: 'ops-monitor-broadcast', // Maps to OPS_MONITOR_BROADCAST DO binding
});

socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'scan-result') {
    console.log('Scan completed:', data.data);
  }
});
```

## Configuration

### Wrangler Configuration

Both Durable Objects are registered in `orchestrator/wrangler.jsonc`:

```jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "class_name": "TerminalServer",
        "name": "TERMINAL_SERVER"
      },
      {
        "class_name": "OpsMonitorBroadcastServer",
        "name": "OPS_MONITOR_BROADCAST"
      }
    ]
  }
}
```

### Environment Types

The DOs are exported from `orchestrator/worker/index.ts` and available in the `Env` interface:

```typescript
interface Env {
  TERMINAL_SERVER: DurableObjectNamespace<TerminalServer>;
  OPS_MONITOR_BROADCAST: DurableObjectNamespace<OpsMonitorBroadcastServer>;
  Sandbox: DurableObjectNamespace<UserAppSandboxService>; // Required for TerminalServer
}
```

## Frontend Integration

### Updating xterm Component

The existing xterm component (`apps/base/src/routes/chat/components/terminal.tsx`) should be updated to use `partysocket` instead of raw WebSocket:

```typescript
import PartySocket from 'partysocket';

// Replace WebSocket connection with PartySocket
const socket = new PartySocket({
  host: window.location.host,
  room: workerId,
  party: 'terminal-server',
  query: { sandboxId },
});

// PartySocket automatically handles reconnection
socket.addEventListener('message', (event) => {
  // Forward to xterm
  terminal.write(event.data);
});
```

## Testing

### Terminal Streaming Tests

1. **Connection Test**: Verify WebSocket upgrade works
2. **Proxy Test**: Verify container output is forwarded to clients
3. **Reconnection Test**: Verify PartySocket reconnects gracefully

### Ops Broadcast Tests

1. **Broadcast Test**: Verify scan results are broadcast to connected clients
2. **Scheduled Test**: Verify scheduled scans trigger broadcasts
3. **Multiple Clients**: Verify all clients receive broadcasts

## Dependencies

- `partysocket` - Already in `package.json` (v1.1.6)
- `partyserver` - Imported from `third_party/partykit/packages/partyserver/`
- `hono-party` - Imported from `third_party/partykit/packages/hono-party/`
- `nanoid` - Already in `package.json` (used by partyserver)

## Notes

- PartyKit packages are imported directly from `third_party/partykit/` using relative paths
- No npm package installation needed for partyserver/hono-party
- PartySocket handles automatic reconnection and buffering
- All WebSocket connections use PartyServer's hibernation API for efficiency

