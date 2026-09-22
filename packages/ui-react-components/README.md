# @gauzy/ui-react-components

Reusable React UI components and design tokens for Gauzy dashboards. Pure React + TypeScript — no Angular or plugin-system dependencies. Built with `@nx/js:tsc` (no CSS pipeline: components style themselves inline and register the few rules that need a stylesheet through `useInjectedStyles`).

## Design tokens

- `themeTokens` — **theme-adaptive** CSS custom-property references (`var(--gauzy-card-2)`, `var(--gauzy-text-color-2)`, `var(--border-radius)`, `var(--color-primary-default)`, …). Use these for anything mounted inside the Gauzy shell through `@gauzy/ui-react`; the component then follows the light/dark/corporate/material theme the user picked, exactly like Angular SCSS that uses `nb-theme(...)`.
- `statusColor(status)` — `var(--color-<status>-default)` for a Nebular status name.
- `theme` — legacy flat object of hardcoded light-mode hex values. Kept for standalone previews; do not use it for in-app surfaces.

## Components

Theme-adaptive ports of the Nebular / Gauzy primitives the dashboards are built from:

- **CounterPoint** — port of `<gauzy-counter-point>`: a strip of up to 24 pill dots (`total`/`value`/`color`) or, with `progress`, a 10px progress bar. `computeCounterPoints()` / `counterPointBackground()` are exported for tests.
- **ProgressBar** — port of `<nb-progress-bar>` (`value`, `status`, `size`, `height`, `displayValue`), painted with `--progress-bar-<status>-*`.
- **Badge** — port of `<nb-badge>` in its unpositioned dashboard form (`text`, `status`).
- **Avatar** — port of `<ngx-avatar class="avatar-dashboard">` (`name`, `src`, `caption`, `appendCaption`, `size`, `presence`, `onClick`, `variant: 'dashboard' | 'activity'`).
- **Spinner** — port of the `[nbSpinner]` overlay (`active`, `status`, `size`, `message`); the parent must be `position: relative`.
- **Popover** — click-toggled floating panel like `[nbPopover]` (`content`, `placement`, controlled `open`/`onOpenChange`); portaled to `document.body`, closes on outside click / Escape. `computePopoverPosition()` is exported for tests.

Layout / legacy:

- **Card**, **CardHeader**, **CardTitle**, **CardDescription**, **CardAction**, **CardContent**, **CardFooter** — compound card layout.
- **WidgetCard** — label + value stat card built on `Card`.
- **Progress** — minimal 4px bar (`percent`, `color`).
- **ColorDots** — coloured dot indicators (`count`, `colors`).

## Utilities

- `formatDuration(seconds)` — `HH:mm:ss`
- `progressStatus(percent)` — Nebular status for a percentage (mirror of `@gauzy/ui-core/common`)
- `currentWeekRange()` / `todayRange()` — local date ranges
- `ensureStyleTag(id, css)` / `useInjectedStyles(id, css)` — one-time `<style>` registration

## Usage

```tsx
import { CounterPoint, ProgressBar, Spinner, themeTokens } from '@gauzy/ui-react-components';

function WorkedToday({ seconds, capacity, loading }: { seconds: number; capacity: number; loading: boolean }) {
  return (
    <div style={{ position: 'relative', background: themeTokens.card1, borderRadius: themeTokens.radius }}>
      <Spinner active={loading} />
      <div style={{ color: themeTokens.text2 }}>Worked today</div>
      <CounterPoint total={capacity} value={seconds} color="#00D68F" />
      <ProgressBar value={42} height="5px" />
    </div>
  );
}
```
