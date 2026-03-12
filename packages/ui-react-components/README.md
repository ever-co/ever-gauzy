# @gauzy/ui-react-components

Reusable React UI components and design tokens for Gauzy dashboards. Pure React + TypeScript — no Angular or plugin-system dependencies.

## Components

- **StatCard** — Card displaying a label, value, and optional children (e.g. progress bar, dots)
- **ProgressBar** — Horizontal progress indicator with customizable color
- **ProjectDots** — Colored dot indicators for project counts

## Utilities

- `theme` — Design tokens matching Nebular / NbCard aesthetic
- `formatDuration(seconds)` — Converts seconds to `HH:mm:ss`
- `pad(n)` — Pads number to 2 digits
- `currentWeekRange()` — Returns Monday–Sunday date range
- `todayRange()` — Returns today's start/end timestamps

## Usage

```tsx
import { StatCard, ProgressBar, theme } from '@gauzy/ui-react-components';

function MyWidget() {
  return (
    <StatCard label="Weekly Activity" value="85.50%">
      <ProgressBar percent={85.5} color={theme.blue} />
    </StatCard>
  );
}
```
