# Template Selection

Single Durable Object (DO) app on Cloudflare Workers. Minimal setup that uses one global DO for persistence and DO features.

Use when:
- You need server-side state with one global DO
- Real-time/stateful services, dashboards, counters

Avoid when:
- Static/SPAs with no backend
- SEO/SSR landing pages
- You only need database-like storage across many entities (see DO v2 runner)

Built with:
- React Router, ShadCN UI, Tailwind, Lucide Icons, ESLint, Vite
- Cloudflare Workers + single DO for persistence


