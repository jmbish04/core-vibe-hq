# Vibecode Agents Documentation

This document describes the specialized agents in the Vibecode ecosystem, their responsibilities, and integration patterns.

## Agent Development System

### Overview

The Vibecode agent system is built on Cloudflare's Durable Objects infrastructure, providing:
- **Long-running AI conversations** with persistent state
- **Centralized prompt management** for consistent AI behavior
- **Factory-based architecture** for specialized agent types
- **D1 database integration** through orchestrator RPC
- **WebSocket real-time communication**

### Base Agent Architecture

All agents extend from shared base classes:

- **`BaseAgent`**: Core functionality (logging, error handling, WebSocket support)
- **`BaseFactoryAgent`**: Template management and order fulfillment for factory agents
- **Centralized Prompt System**: Composable prompts in `@shared/base/prompts/`

### Key Components

#### Prompt System (`@shared/base/prompts/`)
- **Composable templates**: Base Cloudflare guidelines + domain-specific policies
- **Type-safe management**: Versioned templates with dependency tracking
- **Context variables**: Dynamic prompt customization
- **Priority-based composition**: Consistent prompt ordering
- **Swarm overlays**: `composeFactorySwarmPrompt()` & `composeSpecialistSwarmPrompt()` wrap the Cloudflare base + swarm base + factory/specialist instructions automatically

#### Agent Types
- **Factory Agents**: Handle template-based code generation (Data Factory, UI Factory, etc.)
- **Specialist Agents**: Domain-specific operations (Health monitoring, testing, etc.)
- **Orchestrator Integration**: All agents communicate via RPC bindings

### Development Guidelines

- **Extend base classes**: Never create agents from scratch
- **Use prompt system**: Always use `buildAIPrompt()` for AI interactions
- **Use swarm helpers**: For PM/UX/SWE/SDET workflows call `composeFactorySwarmPrompt('factory-id', context)` or `composeSpecialistSwarmPrompt('specialist-id', context)`
- **Follow ORM policy**: Use Drizzle + Kysely for database operations
- **Implement WebSocket hibernation**: For real-time communication
- **Use structured logging**: Consistent logging across all agents

### Resources
- [Agent Development Guide](@shared/base/agents/AGENTS.md)
- [Prompt System Guide](@shared/base/prompts/AGENTS.md)
- [Swarm Prompt Resolver](@shared/base/prompts/swarm-prompts.ts)
- [Cursor Rules for Agents](.cursor/rules/agents.mdc)

### Swarm Prompt Overlays

Swarm prompts give every agent a ready-made cross-functional team persona. Each overlay lives under `@shared/base/prompts/swarm/` and is auto-registered by identifier. Factory agents should use:

```typescript
import { composeFactorySwarmPrompt } from 'apps/base/worker/agents/swarmPrompts';

const planningPrompt = composeFactorySwarmPrompt(
  'data-factory',
  { projectName: this.context.projectId },
  ['Inventory existing migrations and list risks.']
).content;
```

Specialists can do the same with `composeSpecialistSwarmPrompt('health-specialist', context)`. If a factory’s responsibilities change, update the corresponding `swarm-*.ts` file and bump its `version`, then ensure the resolver in `swarm-prompts.ts` maps identifiers correctly.

## Data Factory Agents

### Overview

The **Data Factory** provides specialized agents for database operations and ORM management across the Vibecode ecosystem.

### New Worker ORM Agent

#### Purpose
Automatically sets up Drizzle + Kysely ORM architecture for new Cloudflare Workers projects, ensuring consistent database access patterns from project inception.

#### Responsibilities
- **Schema Generation**: Creates Drizzle ORM schema definitions
- **Client Setup**: Initializes Drizzle + Kysely database clients
- **Migration Creation**: Generates initial database migrations
- **Service Layer**: Creates type-safe database service classes
- **Testing Setup**: Generates comprehensive test suites
- **Documentation**: Creates ORM usage documentation

#### Technical Implementation
- **Base Class**: `BaseFactoryAgent` (factory pattern for template-based generation)
- **Prompt System**: Uses `cloudflare-base` + `orm-policy` templates
- **Template Source**: `apps/factories/data-factory/templates/d1-template/`
- **State Management**: Durable Object storage for multi-step generation tracking
- **WebSocket Support**: Real-time progress updates during setup

#### API Endpoints
```
POST /api/orm/setup       # Start ORM setup for new project
GET  /api/orm/status      # Get current setup status
GET  /api/orm/files       # Get generated files
POST /api/orm/test        # Run validation tests
```

### Retrofit ORM Agent

#### Purpose
Analyzes existing Cloudflare Workers with raw D1 queries and retrofits them to use the standardized Drizzle + Kysely ORM architecture.

#### Responsibilities
- **Code Analysis**: Scans codebase for raw D1 query usage patterns
- **Schema Inference**: Generates Drizzle schemas from existing SQL
- **Query Migration**: Replaces `env.DB.prepare()` calls with ORM equivalents
- **Type Safety**: Adds TypeScript types throughout the codebase
- **Migration Generation**: Creates migrations for existing data
- **Validation**: Ensures functional equivalence post-retrofit

#### Technical Implementation
- **Base Class**: `BaseFactoryAgent` (handles complex multi-step refactoring)
- **Analysis Engine**: AST parsing and SQL pattern recognition
- **Patch Generation**: Creates search-replace patches for code transformation
- **State Tracking**: Durable Object storage for analysis and migration state
- **WebSocket Updates**: Real-time progress during complex retrofitting

#### API Endpoints
```
POST /api/retrofit/analyze   # Analyze existing worker for ORM retrofit
GET  /api/retrofit/status   # Get retrofit progress
POST /api/retrofit/execute  # Execute retrofit patches
GET  /api/retrofit/patches  # Get generated patches
```

### ORM Policy Enforcement

Both agents strictly enforce the **Drizzle + Kysely hybrid ORM policy**:

#### Schema Layer (Drizzle)
- Table definitions in `src/db/schema.ts`
- Migration generation via `drizzle-kit`
- Type inference for Kysely compatibility

#### Client Layer
- Dual client initialization (Drizzle + Kysely)
- Shared D1 binding connection
- Environment-based configuration

#### Query Layer
- **Drizzle**: Simple CRUD operations
- **Kysely**: Dynamic filtering, joins, analytics
- **Raw SQL**: Only with `// @native-sql` justification

### Database Integration

#### Via Orchestrator RPC
```typescript
// Agent accesses database through orchestrator
const users = await this.env.ORCHESTRATOR_DATA.getUsers({
  projectId: this.context.projectId
});
```

#### Direct D1 Access (Templates)
```typescript
// Generated code uses Drizzle + Kysely
const db = initDb(env);
await db.drizzle.insert(schema.users).values({ email }).run();
```

### Configuration

#### Wrangler Setup
```jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "NEW_WORKER_ORM_AGENT",
        "class_name": "NewWorkerORMAgent"
      },
      {
        "name": "RETROFIT_ORM_AGENT",
        "class_name": "RetrofitORMAgent"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["NewWorkerORMAgent", "RetrofitORMAgent"]
    }
  ]
}
```

#### Environment Variables
- `ORCHESTRATOR_DATA`: RPC access to data operations
- `ORCHESTRATOR_PROJECTS`: RPC access to project operations
- `AI`: Cloudflare AI for code generation
- `CLOUDFLARE_BASE_PROMPT`: Centralized prompt content

### Deployment

#### GitHub Actions
```yaml
name: Deploy Data Factory
on:
  push:
    branches: [main]
    paths: [apps/factories/data-factory/**]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy Factory
        uses: cloudflare/wrangler-action@v3
        with:
          workingDirectory: apps/factories/data-factory
```

### Integration with Other Systems

#### Template Factory Integration
- Data Factory agents generate database templates
- Templates used by other factory agents
- Consistent ORM setup across all generated projects

#### Health Specialist Integration
- Database health monitoring
- ORM performance validation
- Migration success verification

#### Orchestrator Integration
- Database schema management
- Migration coordination
- Cross-worker data consistency

## Health Specialist Agent

### Overview

The **Health Specialist** is a dedicated Cloudflare Worker that provides comprehensive health monitoring and testing capabilities across the entire Vibecode platform. It operates autonomously with daily cron-based health checks while also supporting on-demand testing and real-time monitoring.

### Core Responsibilities

- **Automated Health Monitoring**: Daily cron execution of comprehensive health tests
- **Multi-Category Testing**: Unit, integration, performance, security, and AI-specific tests
- **AI-Powered Analysis**: Intelligent failure analysis and improvement recommendations
- **Real-Time Monitoring**: WebSocket-based live updates during test execution
- **Historical Tracking**: Complete test result history and performance trends
- **Self-Healing Pipeline**: Automated issue detection and resolution suggestions

### Technical Architecture

#### Database Layer
The Health Specialist uses the orchestrator's health database via RPC calls. The database schema is maintained in the orchestrator:

**Test Profiles** (`test_profiles`):
- Test definitions and metadata
- Category classification (unit, integration, performance, security, ai)
- Scheduling configuration and retry policies
- Target worker/service specifications

**Test Results** (`test_results`):
- Individual test execution records
- Status tracking (pending, running, passed, failed, skipped)
- Performance metrics and error details
- Environment and triggering information

**AI Logs** (`ai_logs`):
- AI model usage tracking
- Token consumption and cost monitoring
- Response latency and success rates
- Reasoning and diagnostic information

**Health Summaries** (`health_summaries`):
- Aggregated daily health status
- Overall system health scoring
- AI-generated insights and recommendations

#### Service Components

**HealthSpecialist Agent** (`HealthSpecialist.ts`):
- Main orchestration logic
- Test execution coordination
- AI analysis integration
- WebSocket broadcasting

**AiService** (`aiService.ts`):
- Cloudflare AI binding integration
- Intelligent test analysis
- Cost optimization and usage tracking
- `runAiAndLog()` wrapper for consistent AI operations

**DatabaseService** (`database.ts`):
- Drizzle ORM for schema management
- Kysely for runtime queries
- Optimized data access patterns

**HealthCron** (`health-cron.ts`):
- Scheduled daily health check execution
- Parallel test processing with concurrency control
- Comprehensive result aggregation

### API Endpoints

#### HTTP APIs (`/api/health/*`)

**GET `/api/health/status`**
- Returns current overall health status
- Includes test counts, performance metrics, and AI usage
- Response includes issues and AI recommendations

**GET `/api/health/results`**
- Paginated test results with filtering
- Includes profile information via joins
- Supports status, category, and date filtering

**POST `/api/health/run`**
- Triggers manual health check execution
- Returns run ID for tracking progress
- Asynchronous execution with WebSocket updates

**GET `/api/health/dashboard`**
- Comprehensive dashboard data
- Includes recent results, AI stats, and performance trends
- Optimized for frontend dashboard consumption

**GET `/api/health/trends`**
- Historical performance and health trends
- Time-range filtering (1h, 24h, 7d, 30d)
- Aggregated metrics for charting

**GET `/api/health/ai-insights`**
- AI-powered analysis of recent failures
- Specific recommendations for issue resolution
- Confidence scores for analysis quality

**GET `/api/health/metrics`**
- Raw performance metrics and KPIs
- Custom time ranges and aggregation
- Real-time system monitoring data

**POST `/api/health/cleanup`**
- Automated cleanup of old health data
- Configurable retention policies
- Admin-only endpoint with authentication

#### WebSocket API (`/ws/health`)

**Real-Time Updates**:
- Test execution progress and results
- Live health status changes
- AI analysis completion notifications
- System alerts and notifications

**Connection Management**:
- Channel-based subscriptions (health, ai, performance)
- Heartbeat monitoring and reconnection
- Connection pooling and cleanup

### UI Integration

#### Health Badge Component
- Corner indicator showing current health status
- Color-coded status (healthy/degraded/critical)
- Click-to-expand dashboard access
- Real-time status updates

#### Health Dashboard Panel
- Comprehensive monitoring interface
- Tabbed views (Overview, Tests, Performance, AI)
- Interactive charts and metrics
- Real-time WebSocket updates
- Issue tracking and recommendations

### Test Categories

#### Unit Tests
- Component-level functionality validation
- Service connectivity checks
- Basic API endpoint testing
- Configuration validation

#### Integration Tests
- Cross-service communication
- Database operations
- External API integrations
- Webhook processing

#### Performance Tests
- Response time monitoring
- Throughput and scalability testing
- Resource utilization tracking
- Load testing simulation

#### Security Tests
- Authentication and authorization
- Input validation and sanitization
- Rate limiting effectiveness
- Security header verification

#### AI Tests
- Model availability and responsiveness
- AI provider failover testing
- Token usage and cost monitoring
- Response quality validation

### Cron Scheduling

**Daily Health Check** (`0 2 * * *` - 2 AM UTC):
- Comprehensive system-wide testing
- Parallel execution with concurrency control
- AI-powered analysis and recommendations
- Automated result storage and reporting

**Configuration Options**:
- Test timeout settings
- Concurrency limits
- Retry policies
- Notification thresholds

### AI Integration

#### Intelligent Analysis
- Automatic failure pattern recognition
- Root cause analysis suggestions
- Performance bottleneck identification
- Security vulnerability detection

#### Cost Optimization
- AI provider selection based on cost/performance
- Usage monitoring and budget alerts
- Automatic failover to cost-effective alternatives
- Predictive cost analysis

#### Self-Healing Recommendations
- Automated fix suggestions
- Configuration optimization advice
- Scaling recommendations
- Maintenance scheduling

### Data Flow

1. **Test Execution**: HealthCron triggers daily tests or manual execution
2. **Result Collection**: Individual test results stored in D1 via DatabaseService
3. **AI Analysis**: AiService analyzes failures and generates insights
4. **Aggregation**: Results aggregated into health summaries
5. **Broadcasting**: Real-time updates sent via WebSocket
6. **Storage**: Complete history maintained for trend analysis
7. **Reporting**: Dashboard provides comprehensive health overview

### Deployment & Configuration

#### Database Migration
Health database migrations are handled by the orchestrator. The Health Specialist uses RPC calls to access health data and does not require direct database access.

```bash
# Deploy health specialist (no database migration needed)
npm run deploy
```

#### Environment Variables
- `AI`: Cloudflare AI binding
- `ORCHESTRATOR_HEALTH`: RPC binding to orchestrator HealthOps entrypoint
- `HEALTH_WEBSOCKET`: Durable Object for WebSocket handling

#### Monitoring & Alerts
- Built-in observability with Cloudflare
- Custom alerting based on health status
- Integration with external monitoring systems
- Automated incident response

### Integration Patterns

#### With Orchestrator
- RPC communication via service bindings
- Health data sharing for system-wide insights
- Coordinated testing across all workers
- Unified health status reporting

#### With Base Worker
- Health badge UI component integration
- Dashboard panel for detailed monitoring
- WebSocket connection for real-time updates
- Shared health data access

#### With Specialist Workers
- Individual worker health monitoring
- Specialist-specific test execution
- Performance metric collection
- Failure analysis and recommendations

### Future Enhancements

- **Predictive Health Monitoring**: ML-based failure prediction
- **Automated Remediation**: Self-healing system actions
- **Custom Test Plugins**: Extensible test framework
- **Multi-Region Health Checks**: Global system monitoring
- **Integration Testing Suites**: Complex workflow validation
- **Performance Profiling**: Detailed bottleneck analysis
- **Security Scanning**: Advanced threat detection
- **Compliance Monitoring**: Regulatory requirement validation

### Troubleshooting

#### Common Issues
- **WebSocket Connection Failures**: Check authentication and network connectivity
- **Test Timeouts**: Review test configuration and resource allocation
- **AI Analysis Errors**: Verify AI provider configuration and rate limits
- **Database Connection Issues**: Check D1 database status and migration state

#### Debug Tools
- Health check API endpoints for manual testing
- WebSocket debugging tools for real-time monitoring
- Database inspection tools for result analysis
- AI service testing utilities for provider validation

---

This Health Specialist provides the critical monitoring and observability layer that ensures Vibecode's reliability and performance at enterprise scale.
