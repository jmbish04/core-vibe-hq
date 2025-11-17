# Health Check API Documentation

## Overview

The Health Check API provides REST endpoints for initiating, monitoring, and retrieving health check results across the Core Vibe HQ ecosystem. All endpoints require authentication and return structured JSON responses.

## Base URL

```
/api/health
```

## Authentication

All endpoints require authentication via session cookies or API tokens. CSRF protection is enforced on state-changing operations.

## Response Format

All responses follow a consistent format:

```json
{
  "ok": boolean,
  "result"?: any,
  "error"?: string,
  "details"?: string,
  "pagination"?: {
    "page": number,
    "limit": number,
    "total": number,
    "total_pages": number
  }
}
```

## Endpoints

### GET /

Get health system summary and latest health check status.

**Response:**
```json
{
  "ok": true,
  "summary": {
    "totalChecks": 42,
    "lastCompletedAt": "2025-11-10T10:30:00Z",
    "lastStatus": "completed",
    "lastHealthScore": 0.95
  },
  "latest": {
    "health_check_uuid": "uuid-here",
    "status": "completed",
    "overall_health_score": 0.95,
    "total_workers": 3,
    "passed_workers": 3,
    "failed_workers": 0
  }
}
```

### GET /workers

Get list of configured workers available for health checks.

**Response:**
```json
{
  "ok": true,
  "workers": [
    {
      "name": "agent-factory",
      "type": "factory",
      "url": "https://agent-factory.example.com",
      "binding": null
    },
    {
      "name": "data-factory",
      "type": "factory",
      "url": null,
      "binding": "DATA_FACTORY_BINDING"
    }
  ],
  "count": 2
}
```

### GET /workers/{workerName}/latest

Get the most recent health check result for a specific worker.

**Parameters:**
- `workerName` (path): Worker name (alphanumeric, hyphens, underscores, 1-50 chars)

**Response:**
```json
{
  "ok": true,
  "result": {
    "worker_check_uuid": "uuid-here",
    "worker_name": "agent-factory",
    "overall_status": "healthy",
    "health_score": 0.92,
    "uptime_seconds": 3600,
    "response_time_ms": 150,
    "orchestrator_connectivity": true,
    "database_connectivity": true,
    "unit_tests_passed": 15,
    "unit_tests_total": 15
  }
}
```

**Error Responses:**
- `400`: Invalid worker name format
- `404`: No health check found for worker

### POST /checks

Initiate a new distributed health check across workers.

**Request Body:**
```json
{
  "trigger_type": "on_demand" | "cron",
  "trigger_source": "manual" | "cron" | "user@example.com",
  "timeout_minutes": 30,
  "include_unit_tests": true,
  "include_performance_tests": true,
  "include_integration_tests": true,
  "worker_filters": ["agent-factory", "data-factory"] | "agent-factory"
}
```

**Parameters:**
- `trigger_type` (optional): `"on_demand"` or `"cron"` (default: `"on_demand"`)
- `trigger_source` (optional): Source identifier (default: current user or `"manual"`)
- `timeout_minutes` (optional): Timeout in minutes (1-1440, default: system default)
- `include_unit_tests` (optional): Whether to run unit tests (default: true)
- `include_performance_tests` (optional): Whether to run performance tests (default: true)
- `include_integration_tests` (optional): Whether to run integration tests (default: true)
- `worker_filters` (optional): Array of worker names or single worker name to target

**Response:**
```json
{
  "ok": true,
  "result": {
    "health_check_uuid": "uuid-here",
    "message": "Health check initiated",
    "total_workers": 3,
    "timeout_minutes": 30
  }
}
```

**Validation Errors:**
- `400`: Invalid `trigger_type`, `worker_filters` format, or `timeout_minutes` range

### GET /checks

Get paginated list of historical health checks.

**Query Parameters:**
- `page` (optional): Page number (default: 1, min: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `triggerType` (optional): Filter by `"on_demand"` or `"cron"`

**Response:**
```json
{
  "ok": true,
  "history": {
    "health_checks": [
      {
        "health_check_uuid": "uuid-1",
        "status": "completed",
        "overall_health_score": 0.95,
        "started_at": "2025-11-10T10:00:00Z",
        "completed_at": "2025-11-10T10:30:00Z"
      }
    ],
    "total_count": 42
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "total_pages": 3
  }
}
```

### GET /checks/{healthCheckUuid}

Get detailed status and results for a specific health check.

**Parameters:**
- `healthCheckUuid` (path): Valid UUID of the health check

**Response:**
```json
{
  "ok": true,
  "result": {
    "health_check_uuid": "uuid-here",
    "status": "completed",
    "trigger_type": "on_demand",
    "trigger_source": "user@example.com",
    "overall_health_score": 0.95,
    "total_workers": 3,
    "completed_workers": 3,
    "passed_workers": 3,
    "failed_workers": 0,
    "ai_analysis": "System is healthy with excellent performance...",
    "ai_recommendations": "Consider optimizing database queries...",
    "worker_results": [
      {
        "worker_name": "agent-factory",
        "overall_status": "healthy",
        "health_score": 0.98,
        "uptime_seconds": 7200,
        "unit_tests_passed": 25,
        "unit_tests_total": 25,
        "response_time_ms": 120
      }
    ]
  }
}
```

**Error Responses:**
- `400`: Invalid UUID format
- `404`: Health check not found

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request - Invalid parameters or validation error |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - CSRF validation failed |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error - Unexpected error |

## Rate Limiting

- Health check initiation: Limited per user/IP
- Status queries: No rate limiting (read-only)
- Worker list: No rate limiting (read-only)

## WebSocket Health Checks

For real-time health monitoring, use the WebSocket health check endpoints:

- `/health-check/execute` - Initiate health check
- `/health-check/status` - Get status updates
- `/health-check/quick` - Quick connectivity check

## Monitoring

All API requests are logged with timing information. Health checks include comprehensive AI analysis and recommendations for system optimization.

## Examples

### Initiate a Full Health Check

```bash
curl -X POST /api/health/checks \
  -H "Content-Type: application/json" \
  -d '{
    "trigger_type": "on_demand",
    "timeout_minutes": 30,
    "include_unit_tests": true,
    "include_performance_tests": true,
    "include_integration_tests": true
  }'
```

### Get Health Check Results

```bash
curl /api/health/checks?page=1&limit=10&triggerType=on_demand
```

### Monitor Worker Health

```bash
curl /api/health/workers/agent-factory/latest
```
