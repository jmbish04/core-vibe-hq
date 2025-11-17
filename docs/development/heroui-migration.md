# HeroUI Migration Audit

_Last updated: 2025-02-16_

## Current Frontend Stack Snapshot

- **Framework**: React 19 + Vite (rolldown variant)
- **State / Routing**: React Router v7, custom contexts (`auth-context`, etc.)
- **Component Primitives**: Shadcn-inspired UI layer (`src/components/ui/**`) built on top of Tailwind CSS 4 + Radix primitives.
- **Styling**: Tailwind (with custom design tokens in `index.css`), framer-motion for micro-interactions, sonner for toasts.
- **Real-time hooks**: Partysocket integrations pending (to be implemented during migration)

## Why Migrate to HeroUI

- Stitch mockups and AI Studio briefs assume HeroUI components (cards, tabs, data visualisations).
- Simplifies design consistency across orchestrator, admin, and mission control surfaces.
- Ready-made theming, responsive spacing, and motion primitives that match the new “Hero” visual language.

## Audit: What We Have vs. What We Need

| Area | Current Implementation | HeroUI Target | Notes |
| ---- | ---------------------- | ------------- | ----- |
| Buttons, Badges, Tabs, Cards | `src/components/ui` with cva + Tailwind | `@heroui/react` `Button`, `Badge`, `Tabs`, `Card` | Replace usages across routes (app, apps, home, chat, settings, discover) |
| Layout (Shell/Navigation) | Custom flex/grid layouts | `HeroLayout`, `Navbar`, `Sidebar` patterns | Align with Stitch “Mission Control” shell |
| Data Display (Tables, Stats) | Mixture of custom components and Recharts | HeroUI `Table`, `Stats`, `Progress`, `Meter` + custom charts | map analytics panels & ops dashboards |
| Forms / Inputs | Radix form primitives | HeroUI `Input`, `Textarea`, `Select`, `Switch` | Hooks for agent prompts, settings pages |
| Modals / Drawers | Radix Dialog + Vaul | HeroUI `Modal`, `Drawer`, `Popover` | unify overlay behaviour |
| Taskboard / Timeline Visuals | Custom Tailwind components | HeroUI containers + bespoke SVG/Canvas | integrate real-time state + animations |
| Terminal View | Custom terminal shell + Partysocket todo | HeroUI cards, status badges, command list | tie into PartyServer DO |

## Gaps & Considerations

1. **Dependency**: `@heroui/react` is not currently part of `orchestrator/package.json`. We’ll need to vendor the package (no network access) or add it to local node_modules manually.
2. **Theming**: Tailwind tokens need to align with HeroUI theme. Plan is to initialise `HeroProvider` with custom palette and gradually replace Tailwind utilities.
3. **Animations**: HeroUI ships with motion helpers; existing framer-motion usage must be reconciled.
4. **Testing**: Snapshot/unit tests must be updated once components change; ensure Storybook-like coverage or add Vitest render tests.
5. **Docs**: Create a living guide for developers (HeroUI usage, do/don’t) once migration is underway.

## Migration Strategy (High-level)

1. **Bootstrap HeroUI**
   - Vendor `@heroui/react` + peer dependencies (if offline, copy from existing project or bundle from CDN).
   - Wrap `App.tsx` with `HeroProvider` and configure design tokens.
   - Provide Tailwind interop helpers (`hero-ui.config.ts`).

2. **Component Swap**
   - Replace global primitives (Button, Card, Tabs, Badge, Input) by building adapters that forward to HeroUI components.
   - Update layout wrappers (sidebar/nav) to use HeroUI containers.

3. **Feature Views**
   - Taskboard + real-time presence: implement subway-map timeline using HeroUI Grid + custom SVG.
   - Factory / Ops dashboards: implement PartyServer data flows with HeroUI cards, meters, and charts.
   - Terminal experience: convert to HeroUI shell, integrate Partysocket connection indicators.

4. **Cleanup**
   - Remove unused Radix/shadcn modules after swap.
   - Update documentation (`docs/development/heroui-migration.md`, style guide).
   - Add UI test coverage (Vitest or Playwright snapshots).

## Next Steps

- ✅ Document current state (this file).
- ☐ Vendor/install HeroUI packages.
- ☐ Create HeroUI adapter layer and start swapping primitives.
- ☐ Implement high-fidelity dashboards per Stitch mockups.
- ☐ Update docs/tests and remove deprecated UI components.
