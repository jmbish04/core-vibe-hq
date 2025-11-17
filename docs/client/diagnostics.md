# Worker Diagnostics System

A comprehensive diagnostics and monitoring system for all downstream workers in the core-vibe-hq ecosystem.

## 🎯 Features

- **Real-time Health Monitoring** - Live status updates and metrics
- **WebSocket Integration** - Real-time log streaming and command execution
- **Orchestrator Connection Testing** - Verify RPC service bindings
- **Interactive Command Interface** - Execute diagnostic commands via web UI
- **Responsive Web Interface** - Beautiful, modern diagnostic dashboard
- **Unique Development Ports** - No port conflicts during local development

## 🏗️ Architecture

### Port Allocation
Each worker gets a unique development port to avoid conflicts:

| Worker | Port | URL |
|--------|------|-----|
| Orchestrator | 8787 | http://localhost:8787 |
| Agent Factory | 8788 | http://localhost:8788 |
| Data Factory | 8789 | http://localhost:8789 |
| Services Factory | 8790 | http://localhost:8790 |
| UI Factory | 8791 | http://localhost:8791 |
| Conflict Specialist | 8792 | http://localhost:8792 |
| Delivery Report Specialist | 8793 | http://localhost:8793 |

### Configuration
Each worker extends the shared `wrangler.base.jsonc` and includes:

```jsonc
{
  "dev": {
    "port": 8788, // Unique port
    "local_protocol": "http"
  },
  "vars": {
    "FACTORY_TYPE": "agent",
    "DEFAULT_MODEL": "@cf/openai/gpt-oss-120b",
    "WORKER_NAME": "Agent Factory",
    "DIAGNOSTICS_ENABLED": "true"
  }
}
```

## 🚀 Usage

### 1. Integration in Worker

```typescript
import { DiagnosticsHandler, DiagnosticsEnv } from '@shared/handlers/diagnosticsHandler'

interface WorkerEnv extends DiagnosticsEnv {
  ORCHESTRATOR_LOGGING?: any
  // ... other bindings
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const diagnostics = new DiagnosticsHandler()
    
    // Handle diagnostics routes
    if (url.pathname.startsWith('/diagnostics') || url.pathname === '/') {
      return await diagnostics.handleRequest(request, env)
    }
    
    // Your worker logic here...
  }
}
```

### 2. Accessing Diagnostics

- **Web Interface**: Visit `http://localhost:PORT/` or `http://localhost:PORT/diagnostics`
- **Health Check**: `GET /diagnostics/health`
- **Metrics API**: `GET /diagnostics/metrics`
- **WebSocket**: `ws://localhost:PORT/ws`

### 3. Available Commands

Execute these commands via the web interface or WebSocket:

- `status` - Show worker status and uptime
- `metrics` - Display current performance metrics
- `ping orchestrator` - Test orchestrator connection
- `clear metrics` - Reset metrics counters
- `help` - Show available commands

## 📊 Metrics Tracked

### System Metrics
- **Uptime** - How long the worker has been running
- **Memory Usage** - Current memory consumption (placeholder in Workers)
- **CPU Usage** - Current CPU usage (not available in Workers)

### Operation Metrics
- **Active Operations** - Currently processing requests
- **Total Processed** - Total requests handled
- **Success Rate** - Percentage of successful operations
- **Average Response Time** - Mean response time for operations

### Orchestrator Metrics
- **Connection Status** - Health of orchestrator service bindings
- **Last Ping** - Timestamp of last successful orchestrator communication
- **RPC Calls** - Total orchestrator RPC calls made
- **RPC Errors** - Number of failed RPC calls

## 🔧 Diagnostic Commands

### Basic Commands
```bash
# Check worker status
> status

# View current metrics
> metrics

# Test orchestrator connection
> ping orchestrator

# Clear metrics counters
> clear metrics

# Show help
> help
```

### WebSocket Events

The diagnostics system broadcasts real-time events:

```typescript
// Log events
{
  type: 'log',
  level: 'info' | 'warn' | 'error',
  message: 'Operation completed successfully'
}

// Metrics updates
{
  type: 'metrics',
  metrics: { /* DiagnosticsMetrics */ }
}

// Command results
{
  type: 'command_result',
  result: 'Command output here'
}
```

## 🎨 Web Interface Features

### Dashboard Sections
1. **System Status** - Worker health, uptime, resource usage
2. **Configuration** - Factory type, model, environment settings
3. **Operations** - Request processing metrics and performance
4. **Orchestrator Connection** - RPC service binding status

### Interactive Features
- **Real-time Logs** - Live log streaming with color-coded levels
- **Command Execution** - Interactive command input with history
- **WebSocket Status** - Connection indicator and controls
- **Auto-refresh** - Metrics update every 5 seconds
- **Responsive Design** - Works on desktop and mobile

## 🔍 Troubleshooting

### Common Issues

**Port Already in Use**
```bash
Error: listen EADDRINUSE: address already in use :::8788
```
Solution: Check if another worker is using the same port, or kill the process using that port.

**Diagnostics Not Loading**
- Verify `DIAGNOSTICS_ENABLED=true` in worker configuration
- Check that the worker is running on the expected port
- Ensure the diagnostics handler is properly integrated

**WebSocket Connection Failed**
- Verify WebSocket upgrade headers are being handled
- Check browser console for connection errors
- Ensure the `/ws` endpoint is properly routed

**Orchestrator Connection Issues**
- Verify service bindings are configured in `wrangler.jsonc`
- Check that the orchestrator is running and accessible
- Review RPC call logs for specific error messages

### Debug Mode

Enable verbose logging by setting environment variables:
```bash
export DEBUG=true
export LOG_LEVEL=debug
```

## 🚀 Development

### Local Development
```bash
# Start a worker with diagnostics
cd apps/agent-factory
wrangler dev

# Access diagnostics
open http://localhost:8788
```

### Testing Orchestrator Connections
```bash
# Test all RPC endpoints
curl http://localhost:8788/diagnostics/health

# Execute diagnostic commands
curl -X POST http://localhost:8788/diagnostics/command \
  -H "Content-Type: application/json" \
  -d '{"command": "ping orchestrator"}'
```

## 📈 Monitoring Best Practices

1. **Regular Health Checks** - Monitor `/diagnostics/health` endpoint
2. **WebSocket Monitoring** - Use WebSocket for real-time operational visibility
3. **Metrics Collection** - Regularly collect metrics for performance analysis
4. **Error Tracking** - Monitor RPC error rates and response times
5. **Capacity Planning** - Track operation counts and success rates

## 🔮 Future Enhancements

- **Distributed Tracing** - Cross-worker request tracing
- **Performance Profiling** - Detailed performance analysis
- **Alert System** - Automated alerts for health issues
- **Metrics Export** - Export metrics to external monitoring systems
- **Custom Dashboards** - Worker-specific diagnostic views

