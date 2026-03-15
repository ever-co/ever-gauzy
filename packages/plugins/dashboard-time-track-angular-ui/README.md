# @gauzy/plugin-dashboard-time-track-angular-ui

This library provides a standalone Angular plugin for the **Time Tracking** dashboard in the Ever Gauzy platform.

## Overview

The `dashboard-time-track-angular-ui` plugin extracts the time-tracking dashboard functionality from the monolithic dashboard module into a decoupled, pluggable package. It allows for better maintainability and lazy-loading of the time-tracking feature.

### Features

- **Decoupled Architecture**: Moves legacy time-tracking logic into a standalone library.
- **Lazy Loading**: Integrated with `defineDeclarativePlugin` for on-demand loading.
- **Dynamic Routing**: Registers the `time-tracking` route under the `dashboard-sections` location.
- **Dashboard Integration**: Automatically adds a "Time Tracking" tab to the Gauzy dashboard tabset.
- **I18n Support**: Full localization support for 13+ languages.
- **Permissions**: Respects `ADMIN_DASHBOARD_VIEW` and `TIME_TRACKING_DASHBOARD` permissions.

## Scripts

### Building

To build the library, run:
```bash
yarn nx build plugin-dashboard-time-track-angular-ui
```

### Testing

To run unit tests:
```bash
yarn nx test plugin-dashboard-time-track-angular-ui
```

### Linting

To run ESLint:
```bash
yarn nx lint plugin-dashboard-time-track-angular-ui
```

## Usage

Add the plugin to your `plugin-ui.config.ts` (located in `apps/gauzy/src/plugin-ui.config.ts`):

```typescript
import { PluginUiConfig } from '@gauzy/plugin-ui';
import { DashboardTimeTrackAngularUiPlugin } from '@gauzy/plugin-dashboard-time-track-angular-ui';

export const uiPluginConfig: PluginUiConfig = {
  plugins: [
    DashboardTimeTrackAngularUiPlugin,
    // ... other plugins
  ]
};
```

The plugin will automatically register its routes and UI components upon platform bootstrap.
