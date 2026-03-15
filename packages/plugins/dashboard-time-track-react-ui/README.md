# @gauzy/plugin-dashboard-time-track-react-ui

React dashboard plugin for Time Tracking widgets, using `@gauzy/plugin-ui`, `@gauzy/ui-react`, and `@gauzy/ui-react-components`.

## Architecture

```
@gauzy/plugin-ui                 (core plugin infrastructure, Angular-only)
       │
       └── @gauzy/ui-react       (React-to-Angular bridge)
                  │
                  ├── @gauzy/ui-react-components   (reusable React UI primitives)
                  │
                  └── @gauzy/plugin-dashboard-time-track-react-ui   (this plugin)
```

## Widgets

- **MembersWorkedWidget** — Count of team members who worked
- **ProjectsWorkedWidget** — Count of projects with colored dot indicators
- **TodayActivityWidget** — Today's activity percentage
- **WorkedTodayWidget** — Total duration worked today
- **WorkedThisWeekWidget** — Duration worked this week with progress bar
- **WeeklyActivityWidget** — Weekly activity percentage with progress bar

## Features

- Settings-driven widget visibility (each widget can be toggled)
- Configurable auto-refresh interval
- Type-safe inter-plugin events (`DashboardRefreshedEvent`, `WidgetVisibilityChangedEvent`)
- Translation namespace isolation (`REACT_UI`)
- Permission-gated dashboard tab

## Usage

```typescript
import { DashboardTimeTrackReactUiPlugin } from '@gauzy/plugin-dashboard-time-track-react-ui';

export const uiPluginConfig: PluginUiConfig = {
  plugins: [DashboardTimeTrackReactUiPlugin]
};
```
