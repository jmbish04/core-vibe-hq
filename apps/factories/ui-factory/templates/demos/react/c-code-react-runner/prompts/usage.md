# Usage

## Built with
- React Router 6, ShadCN UI, Tailwind, Lucide Icons, ESLint, Vite
- Cloudflare Workers (serving/server-side when needed)

## Restrictions
- Tailwind: define custom colors in `tailwind.config.js` (not in `index.css`)

## Styling
- Responsive, accessible
- Prefer ShadCN components; Tailwind utilities for custom parts
- Icons from `lucide-react`
- Error boundaries are already implemented

## Animation
- Use `framer-motion` for small interactions when needed

## Components
- Import from `@/components/ui/*` (ShadCN). Avoid reinventing components.

## Example
```tsx
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function Example() {
  return (
    <Card className="max-w-sm">
      <CardContent className="p-4 flex gap-2">
        <Button>Click</Button>
      </CardContent>
    </Card>
  )
}
```

## Backend (optional)
- If you add Worker routes, do it in `worker/index.ts`. Follow the existing pattern carefully to avoid breakage.