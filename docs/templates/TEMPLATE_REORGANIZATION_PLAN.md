# Template Reorganization Plan

## Overview
This document outlines the reorganization of templates and agent frameworks from STAGING into the appropriate factory workers and shared template repositories.

## Target Structure

```
apps/factories/
├── agent-factory/
│   └── templates/
│       ├── cloudflare-agents-sdk/
│       ├── ai-sdk/
│       ├── openai-sdk/
│       ├── gemini-genai/
│       ├── patterns/
│       │   ├── vectorize/
│       │   ├── embeddings/
│       │   ├── autorag/
│       │   └── rag/
│       └── demos/
│           └── [agentic patterns from STAGING/ai/demos]
│
├── data-factory/
│   └── templates/
│       ├── r2-explorer/
│       ├── d1-template/
│       ├── d1-explorer/
│       ├── r2-data-catalog/
│       ├── kv-handling/
│       └── pipelines/
│
├── services-factory/
│   └── templates/
│       ├── queues/
│       ├── web-crawler/
│       └── browser-render/
│           ├── playwright/
│           ├── puppeteer/
│           └── utilities/
│               ├── tojson/
│               ├── tomarkdown/
│               ├── extract-text/
│               ├── extract-html/
│               ├── convert-pdf/
│               └── run-testing/
│
└── ui-factory/
    └── templates/
        └── demos/
            ├── react/
            ├── nextjs/
            ├── remix/
            ├── vite/
            └── react-router/

@shared/templates/
├── durable-objects/
├── actors/
├── workflows/
└── queues/
```

## Migration Steps

### Phase 1: Agent Factory Templates
1. Move Cloudflare Agents SDK templates
2. Move AI SDK templates  
3. Move OpenAI SDK templates
4. Move Gemini GenAI templates
5. Move AI libraries (libs, packages, types)
6. Move AI demos (agentic patterns)
7. Add vectorize, embeddings, AutoRAG, RAG patterns

### Phase 2: Data Factory Templates
1. Move r2-explorer-template
2. Move d1-template
3. Move d1-explorer (if exists)
4. Move r2-data-catalog-examples
5. Move kv-handling templates
6. Move pipelines-starter

### Phase 3: Services Factory Templates
1. Move queues-web-crawler
2. Create browser-render templates (playwright, puppeteer, utilities)

### Phase 4: UI Factory Templates
1. Organize frontend demos by framework
2. Organize by implementation (vite, react-router, etc.)

### Phase 5: Shared Templates
1. Create @shared/templates structure
2. Move Durable Objects templates
3. Move Actors templates
4. Move Workflows templates
5. Move Queues templates

## Execution Order
1. Create target directory structure
2. Move files systematically
3. Update references and imports
4. Create README files for each section
5. Update template catalogs


