# Template Selection

General-purpose multi-entity storage on Cloudflare Workers using one Durable Object (DO) as the storage backend. The DO is wrapped so multiple entities (users, chats, orgs, etc.) can persist data via simple APIs.

Use when:
- Backend-heavy apps with multiple entities and server-side persistence
- Chats, ecommerce, dashboards
- Cost-effective persistence without KV
- General purpose storage for any multi-entity data

Avoid when:
- Static/SPAs with no backend
- SEO/SSR landing pages
- You need SSR or DO features like alarms/direct DO access

Note: No direct DO access. DO is storage-only; no alarms or extra DO features.

Built with:
- React Router, ShadCN UI, Tailwind, Lucide Icons, ESLint, Vite
- Cloudflare Workers + a single DO for persistence


