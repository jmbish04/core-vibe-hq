# Usage instructions

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

API routes can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as API routes instead of React pages.

- Built with:
  * Next.js (Page Router) for hybrid static/server rendering and SEO optimization
  * Tailwind CSS** for utility-first styling and rapid prototyping
  * Lucide Icons** (React) for modern, consistent iconography
  * Framer Motion** for smooth, production-ready animations
  * ESLint and TypeScript for linting and type safety out of the box
  * ShadCN UI** (v2.3.0) for customizable and accessible UI components built on Radix UI primitives

- Restrictions:
  * When including `tailwind.config.js`, **hardcode custom colors** directly in the config file – do **not** define them in `globals.css` unless specified
  * Next.js cannot infer props for React Components, so YOU MUST provide default props
  * Use Page router and not App router

- Styling:
  * Must generate **fully responsive** and accessible layouts
  * Use Shadcn preinstalled components rather than writing custom ones when possible
  * Use **Tailwind's spacing, layout, and typography utilities** for all components

- Components:
  * All Shadcn components are available and can be imported from @/components/ui/...
  * Do not write custom components if shadcn components are available
  * Icons from Lucide should be imported directly from `lucide-react`

- Animation:
  * Use `framer-motion`'s `motion` components to animate sections on scroll or page load
  * You can integrate variants and transitions using Tailwind utility classes alongside motion props

---

Components available:
```sh
$ ls -1 src/components/ui
accordion.tsx
alert-dialog.tsx
alert.tsx
aspect-ratio.tsx
avatar.tsx
badge.tsx
breadcrumb.tsx
button.tsx
calendar.tsx
card.tsx
carousel.tsx
chart.tsx
checkbox.tsx
collapsible.tsx
command.tsx
context-menu.tsx
dialog.tsx
drawer.tsx
dropdown-menu.tsx
form.tsx
hover-card.tsx
input-otp.tsx
input.tsx
label.tsx
menubar.tsx
navigation-menu.tsx
pagination.tsx
popover.tsx
progress.tsx
radio-group.tsx
resizable.tsx
scroll-area.tsx
select.tsx
separator.tsx
sheet.tsx
sidebar.tsx
skeleton.tsx
slider.tsx
sonner.tsx
switch.tsx
table.tsx
tabs.tsx
textarea.tsx
toast.tsx
toggle-group.tsx
toggle.tsx
tooltip.tsx
```

### Usage Example

```tsx file="src/components/Hero.tsx"
'use client'

import { motion } from 'framer-motion'
import { ArrowRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Hero() {
  return (
    <section className="w-full bg-white py-20 text-center">
      <motion.div 
        initial={{ opacity: 0, y: 30 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-2xl px-6"
      >
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Build Stunning Landing Pages Fast
        </h1>
        <p className="mt-4 text-gray-600">
          A modern Next.js starter with Tailwind, Framer Motion, and Lucide.
        </p>
        <div className="mt-6 flex justify-center">
          <Button className="inline-flex items-center gap-2 rounded-md bg-black px-6 py-3 text-white hover:bg-gray-900 transition">
            Get Started
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>
      </motion.div>
    </section>
  )
}
```