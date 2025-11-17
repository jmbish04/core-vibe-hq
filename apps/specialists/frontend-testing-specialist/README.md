# Frontend Testing Specialist

A Cloudflare Worker specialist for configuring and running Playwright and Puppeteer tests on frontend applications. This specialist focuses on testing applications in both local development environments and live Cloudflare Worker deployments.

## Features

- **Configuration Generation**: Automatically generate Playwright and Puppeteer configurations for different frameworks (React, Vue, Angular, Next.js, Nuxt.js, Vanilla)
- **Local Testing**: Run tests against localhost development servers
- **Cloudflare Testing**: Run tests against live Cloudflare Worker deployments using Cloudflare's Browser Rendering API
- **Multiple Frameworks**: Support for both Playwright and Puppeteer testing frameworks
- **Test Types**: Smoke tests, integration tests, E2E tests, and visual regression tests

## API Endpoints

### Health Check
```http
GET /health
```
Returns service status and capabilities.

### Configuration Generation
```http
POST /config/generate
Content-Type: application/json

{
  "framework": "playwright" | "puppeteer",
  "environment": "local" | "cloudflare" | "production",
  "projectType": "react" | "vue" | "angular" | "next" | "nuxt" | "vanilla",
  "targetUrl": "https://your-app.com",
  "cloudflareWorkerName": "my-worker",
  "customOptions": {}
}
```

### Test Execution
```http
POST /tests/execute
Content-Type: application/json

{
  "framework": "playwright" | "puppeteer",
  "environment": "local" | "cloudflare" | "production",
  "testType": "smoke" | "integration" | "e2e" | "visual-regression",
  "config": {
    "framework": "playwright",
    "browser": "chromium",
    "headless": true,
    "timeout": 30000
  },
  "targetUrl": "https://your-app.com"
}
```

### Quick Setup
```http
POST /setup/quick
Content-Type: application/json

{
  "projectType": "react",
  "environment": "local",
  "framework": "playwright"
}
```

### Cloudflare Worker Testing
```http
POST /cloudflare/test
Content-Type: application/json

{
  "workerName": "my-app",
  "zoneId": "your-zone-id",
  "framework": "playwright",
  "testType": "smoke"
}
```

### Local Development Testing
```http
POST /local/test
Content-Type: application/json

{
  "port": 3000,
  "framework": "playwright",
  "testType": "smoke"
}
```

### Get Test Results
```http
GET /tests/results/{executionId}
```

### Get Available Templates
```http
GET /templates
```

## Usage Examples

### 1. Generate Configuration for React App

```bash
curl -X POST http://localhost:8787/config/generate \
  -H "Content-Type: application/json" \
  -d '{
    "framework": "playwright",
    "environment": "local",
    "projectType": "react"
  }'
```

### 2. Test Live Cloudflare Worker

```bash
curl -X POST http://localhost:8787/cloudflare/test \
  -H "Content-Type: application/json" \
  -d '{
    "workerName": "my-react-app",
    "framework": "playwright",
    "testType": "smoke"
  }'
```

### 3. Test Local Development Server

```bash
curl -X POST http://localhost:8787/local/test \
  -H "Content-Type: application/json" \
  -d '{
    "port": 3000,
    "framework": "playwright",
    "testType": "e2e"
  }'
```

## Configuration Files

The specialist includes pre-configured files for different environments:

### Playwright Configurations
- `playwright-configs/playwright.config.local.ts` - Local development testing
- `playwright-configs/playwright.config.cloudflare.ts` - Cloudflare Worker testing

### Puppeteer Configurations
- `puppeteer-configs/puppeteer-config.local.ts` - Local development testing
- `puppeteer-configs/puppeteer-config.cloudflare.ts` - Cloudflare Worker testing

## Environment Variables

Set these in your `wrangler.jsonc` or `.env` file:

```jsonc
{
  "vars": {
    "TEST_ENVIRONMENT": "cloudflare",
    "TEST_BASE_URL": "https://your-app.workers.dev",
    "CLOUDFLARE_ACCOUNT_ID": "your-account-id",
    "CLOUDFLARE_API_TOKEN": "your-api-token",
    "PLAYWRIGHT_PROJECT": "frontend-tests"
  }
}
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the worker locally:
```bash
npx wrangler dev
```

3. Test the API:
```bash
curl http://localhost:8787/health
```

## Deployment

The specialist is deployed as part of the ops-specialists workflow. Make sure your `wrangler.jsonc` includes the browser binding:

```jsonc
{
  "browser": {
    "binding": "BROWSER"
  }
}
```

## Integration with Orchestrator

This specialist integrates with the orchestrator via service bindings. The orchestrator can call this specialist to:

1. Generate test configurations for new frontend projects
2. Run automated tests as part of deployment pipelines
3. Monitor frontend health via smoke tests
4. Perform visual regression testing

## Test Types Supported

- **Smoke Tests**: Basic page load and element presence checks
- **Integration Tests**: Component interaction and API integration testing
- **E2E Tests**: Full user journey testing with complex interactions
- **Visual Regression Tests**: Screenshot comparison for UI changes

## Framework-Specific Features

### React/Next.js
- Detects React root elements
- Tests component mounting and rendering
- Handles client-side routing

### Vue/Nuxt.js
- Detects Vue instances and components
- Tests Vue-specific directives and reactivity
- Handles Vue Router navigation

### Angular
- Detects Angular applications and components
- Tests Angular change detection
- Handles Angular routing

### Vanilla JavaScript
- Tests standard DOM manipulation
- Validates basic web functionality
- Handles traditional web applications

## Error Handling

The specialist provides detailed error messages for common issues:

- Missing target URLs
- Browser launch failures
- Network timeouts
- Element not found errors
- Configuration validation errors

All errors include timestamps and execution IDs for debugging.
