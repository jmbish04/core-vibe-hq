import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { partyserverMiddleware } from 'partykit/hono-party';
import { getServerByName } from 'partykit/partyserver';

import { createHealthApi } from './api/health';
import { HealthCron } from './cron/health-cron';
import { AiService } from './services/aiService';
import { OrchestratorHealthClient } from './services/healthDatabaseClient';
import { HealthWebSocket } from './ws/health';
import { HealthSpecialist } from './agent/HealthSpecialist';

export interface Env {
  AI: any;
  HEALTH_WEBSOCKET: DurableObject<Env>;
  // Orchestrator RPC bindings
  ORCHESTRATOR_HEALTH: any;
}

const app = new Hono<{ Bindings: Env }>();

// Initialize services
let dbClient: OrchestratorHealthClient;
let aiService: AiService;
let healthSpecialist: HealthSpecialist;
let healthCron: HealthCron;

function initializeServices(env: Env) {
  if (!dbClient) {
    dbClient = new OrchestratorHealthClient(env.ORCHESTRATOR_HEALTH);
    aiService = new AiService(env, dbClient);
    healthSpecialist = new HealthSpecialist(env);
    healthCron = new HealthCron(env);
  }
}

// Middleware
app.use('*', cors());
app.use('*', logger());

// Initialize services on first request
app.use('*', async (c, next) => {
  initializeServices(c.env);
  await next();
});

// Health API routes
const healthApi = createHealthApi(aiService!, dbClient!);
app.route('/api/health', healthApi);

// WebSocket endpoint for real-time health updates
app.get(
  '/ws/health',
  partyserverMiddleware<Env>({
    options: {
      prefix: 'parties',
      onBeforeConnect: async (req, lobby, env) => {
        // Basic authentication check (could be enhanced)
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          throw new Error('Authentication required for WebSocket connection');
        }

        console.log('Health WebSocket connection authorized');
        return req;
      },
    },
  })
);

// Health dashboard route (serves static assets)
app.get('/dashboard', async (c) => {
  // In a real implementation, this would serve a React dashboard
  // For now, return a simple HTML page
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vibecode Health Dashboard</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: 500; }
        .status.healthy { background: #d4edda; color: #155724; }
        .status.degraded { background: #fff3cd; color: #856404; }
        .status.critical { background: #f8d7da; color: #721c24; }
        .status.unknown { background: #e2e3e5; color: #383d41; }
        .metric { background: white; padding: 15px; border-radius: 8px; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .metric-value { font-size: 24px; font-weight: bold; margin: 5px 0; }
        .metric-label { color: #666; font-size: 14px; }
        .websocket-status { position: fixed; top: 20px; right: 20px; padding: 10px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .websocket-status.connected { border-left: 4px solid #28a745; }
        .websocket-status.disconnected { border-left: 4px solid #dc3545; }
    </style>
</head>
<body>
    <div class="websocket-status" id="ws-status">
        <small>WebSocket: <span id="ws-state">Connecting...</span></small>
    </div>

    <div class="header">
        <h1>🩺 Vibecode Health Dashboard</h1>
        <p>Real-time health monitoring and diagnostics</p>
        <div class="status unknown" id="overall-status">Loading...</div>
    </div>

    <div class="metric-grid" id="metrics">
        <div class="metric">
            <div class="metric-value" id="total-tests">-</div>
            <div class="metric-label">Total Tests</div>
        </div>
        <div class="metric">
            <div class="metric-value" id="passed-tests">-</div>
            <div class="metric-label">Passed Tests</div>
        </div>
        <div class="metric">
            <div class="metric-value" id="failed-tests">-</div>
            <div class="metric-label">Failed Tests</div>
        </div>
        <div class="metric">
            <div class="metric-value" id="avg-latency">-</div>
            <div class="metric-label">Avg Latency (ms)</div>
        </div>
        <div class="metric">
            <div class="metric-value" id="ai-cost">-</div>
            <div class="metric-label">AI Cost ($)</div>
        </div>
        <div class="metric">
            <div class="metric-value" id="ai-usage">-</div>
            <div class="metric-label">AI Requests</div>
        </div>
    </div>

    <div class="metric">
        <h3>Recent Issues</h3>
        <div id="issues">Loading...</div>
    </div>

    <div class="metric">
        <h3>AI Recommendations</h3>
        <div id="recommendations">Loading...</div>
    </div>

    <script>
        let ws;
        const wsStatus = document.getElementById('ws-status');
        const wsState = document.getElementById('ws-state');

        function connectWebSocket() {
            ws = new WebSocket('wss://' + window.location.host + '/ws/health');

            ws.onopen = function(event) {
                wsStatus.className = 'websocket-status connected';
                wsState.textContent = 'Connected';
                console.log('WebSocket connected');
            };

            ws.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    handleWebSocketMessage(data);
                } catch (error) {
                    console.error('WebSocket message parse error:', error);
                }
            };

            ws.onclose = function(event) {
                wsStatus.className = 'websocket-status disconnected';
                wsState.textContent = 'Disconnected';
                console.log('WebSocket disconnected, reconnecting...');
                setTimeout(connectWebSocket, 5000);
            };

            ws.onerror = function(error) {
                console.error('WebSocket error:', error);
            };
        }

        function handleWebSocketMessage(data) {
            switch (data.type) {
                case 'health_update':
                    updateHealthStatus(data.data);
                    break;
                case 'test_result':
                    updateTestResult(data);
                    break;
                case 'run_status':
                    updateRunStatus(data);
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        }

        function updateHealthStatus(status) {
            const statusElement = document.getElementById('overall-status');
            statusElement.className = 'status ' + (status.status || 'unknown');
            statusElement.textContent = status.status || 'Unknown';

            // Update metrics
            document.getElementById('total-tests').textContent = status.tests?.total || '-';
            document.getElementById('passed-tests').textContent = status.tests?.passed || '-';
            document.getElementById('failed-tests').textContent = status.tests?.failed || '-';
            document.getElementById('avg-latency').textContent = status.performance?.averageLatency ? Math.round(status.performance.averageLatency) + 'ms' : '-';
            document.getElementById('ai-cost').textContent = status.ai?.totalCost ? '$' + status.ai.totalCost.toFixed(2) : '-';
            document.getElementById('ai-usage').textContent = status.ai?.usageCount || '-';

            // Update issues and recommendations
            document.getElementById('issues').innerHTML = (status.issues || []).map(issue =>
                '<div style="margin-bottom: 5px;">• ' + issue + '</div>'
            ).join('') || 'No issues detected';

            document.getElementById('recommendations').innerHTML = (status.recommendations || []).map(rec =>
                '<div style="margin-bottom: 5px;">• ' + rec + '</div>'
            ).join('') || 'No recommendations available';
        }

        function updateTestResult(data) {
            console.log('Test result:', data);
            // Could update a live test results table here
        }

        function updateRunStatus(data) {
            console.log('Run status:', data);
            // Could show run progress here
        }

        // Load initial data
        async function loadInitialData() {
            try {
                const response = await fetch('/api/health/status');
                const status = await response.json();
                updateHealthStatus(status);
            } catch (error) {
                console.error('Failed to load initial data:', error);
            }
        }

        // Initialize
        connectWebSocket();
        loadInitialData();

        // Refresh data every 30 seconds
        setInterval(loadInitialData, 30000);
    </script>
</body>
</html>`;
  return c.html(html);
});

// Health check endpoint (simple)
app.get('/health', async (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'health-specialist'
  });
});

// Export the main handler
export default {
  fetch: app.fetch,

  // Scheduled handler for daily cron
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    initializeServices(env);
    await healthCron.handleScheduled(event);
  },

  // Durable Object for WebSocket handling
  async webSocketHandler(ws: WebSocket, env: Env, ctx: ExecutionContext) {
    initializeServices(env);
    const webSocketHandler = new HealthWebSocket(ctx, env);
    return webSocketHandler.fetch(new Request('ws://internal/ws/health'));
  }
} satisfies ExportedHandler<Env>;
