# Orchestrator - Mission Control Core

The orchestrator has been elevated to the top-level of the repository and now serves as the primary coordinator for all factory workers.

## Structure

```
orchestrator/
├── worker/
│   ├── api/routes/
│   │   ├── opsRoutes.ts     # New ops specialist API endpoints
│   │   └── index.ts         # Main route setup
│   ├── services/
│   │   ├── aigateway-proxy/
│   │   └── remediation/
│   │       └── githubRemediation.ts
│   ├── app.ts
│   ├── index.ts
│   └── types.ts
├── scripts/
├── package.json
├── wrangler.jsonc           # Updated to deploy as "orchestrator"
└── README.md
```

## Ops Specialist Module

The `ops-specialist` module is located in `apps/ops-specialists/ops-specialist/` and provides automated operational capabilities:

### Features
- **Conflict Resolution**: Automatically detects and resolves merge conflicts via GitHub API
- **Delivery Reports**: Generates comprehensive delivery reports from D1 logs and followups
- **Final QA**: Runs final quality assurance checks and creates issues for blockers

### API Endpoints
- `POST /ops/resolve-conflict` - Trigger conflict resolution
- `GET /ops/report/:orderId` - Generate delivery report
- `POST /ops/final-qa/:orderId` - Run final QA

### Usage
```typescript
import { OpsSpecialist } from '../../apps/ops-specialists/ops-specialist'

// Resolve conflicts
await OpsSpecialist.resolveConflict(env, 'owner/repo', 'feature-branch', ['file1.ts', 'file2.ts'])

// Generate delivery report
const report = await OpsSpecialist.generateDeliveryReport(env, 'order-123')

// Run final QA
const qaResult = await OpsSpecialist.finalQA(env, 'order-123')
```

## Changes Made

1. **Moved orchestrator** from `apps/orchestrator/` to top-level `orchestrator/`
2. **Updated imports** to reflect new structure (e.g., `../../../packages/shared-types/`)
3. **Fixed wrangler config** - now deploys as `orchestrator` worker
4. **Updated GitHub Actions** - workflow now uses `orchestrator/` working directory
6. **Added API routes** for ops specialist functionality

## Deployment

The orchestrator now deploys as a standalone worker at the top level:

```bash
cd orchestrator
npm install
npm run dev      # Local development
npm run deploy   # Deploy to Cloudflare
```

Or use the GitHub Actions workflow which triggers on changes to `orchestrator/**`.

## Validation Checklist

✅ Orchestrator moved to top-level  
✅ Import paths updated  
✅ Wrangler config updated  
✅ GitHub Actions workflow updated  
✅ Ops specialist module created  
✅ API routes for ops functionality added  
✅ Git history preserved during move  

The orchestrator is now positioned as the primary coordinator for all factory workers, with built-in operational automation capabilities.
