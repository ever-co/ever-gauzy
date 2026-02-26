# @gauzy/plugin-ui

Core UI plugin infrastructure for the Gauzy platform. Provides the types, lifecycle interfaces, Angular module, registries, and React bridge needed to build and register UI plugins.

---

## Table of Contents

- [Installation](#installation)
- [App-Level Setup](#app-level-setup)
- [Creating a Plugin](#creating-a-plugin)
  - [1. Declarative Plugin (recommended)](#1-declarative-plugin-recommended)
  - [2. NgModule Plugin](#2-ngmodule-plugin)
  - [3. Lazy-Loaded Plugin](#3-lazy-loaded-plugin)
  - [4. Plugin Group (parent + children)](#4-plugin-group-parent--children)
- [Plugin Definition Reference](#plugin-definition-reference)
- [Registering Plugins](#registering-plugins)
- [Lifecycle Hooks](#lifecycle-hooks)
- [Declarative Registrations](#declarative-registrations)
  - [Routes](#routes)
  - [Nav Menu](#nav-menu)
  - [Page Tabs](#page-tabs)
  - [Extensions](#extensions)
- [Activation Predicate (Feature Flags / Permissions)](#activation-predicate-feature-flags--permissions)
- [React Bridge](#react-bridge)
  - [Rendering React inside Angular](#rendering-react-inside-angular)
  - [Accessing Angular Services from React](#accessing-angular-services-from-react)
  - [Plugin Events](#plugin-events)
- [Extension Slots](#extension-slots)
- [Building](#building)

---

## Installation

```bash
yarn add @gauzy/plugin-ui
# peer deps
yarn add @angular/core @angular/common react react-dom
```

---

## App-Level Setup

Call `PluginUiModule.init()` once in your root bootstrap module. Pass the three registry services so that `defineDeclarativePlugin` can wire routes, tabs, and nav menu automatically.

```typescript
// bootstrap.module.ts
import { NgModule } from '@angular/core';
import { PluginUiModule, PLUGIN_UI_CONFIG, getPluginUiConfig } from '@gauzy/plugin-ui';
import { NavMenuBuilderService, PageRouteRegistryService, PageTabRegistryService } from '@gauzy/ui-core/core';
import { uiPluginConfig } from './plugin-ui.config';
import { AppModule } from './app.module';
import { AppComponent } from './app.component';

// Set config before Angular bootstrap
setPluginUiConfig(uiPluginConfig);

@NgModule({
  imports: [
    PluginUiModule.init({
      navBuilder:    NavMenuBuilderService,
      routeRegistry: PageRouteRegistryService,
      tabRegistry:   PageTabRegistryService,
    }),
    AppModule,
  ],
  providers: [
    { provide: PLUGIN_UI_CONFIG, useFactory: getPluginUiConfig },
  ],
  bootstrap: [AppComponent],
})
export class AppBootstrapModule {}
```

Then define your active plugins in a config file:

```typescript
// plugin-ui.config.ts
import { PluginUiConfig } from '@gauzy/plugin-ui';
import { MyPlugin } from '@gauzy/plugin-my-ui';

export const uiPluginConfig: PluginUiConfig = {
  defaultLanguage: 'en',
  defaultLocale: 'en-US',
  availableLanguages: ['en'],
  availableLocales: ['en-US'],
  plugins: [MyPlugin],
};
```

---

## Creating a Plugin

### 1. Declarative Plugin (recommended)

Use `defineDeclarativePlugin` when your plugin only needs to register routes, tabs, nav items, or page extensions. No Angular `NgModule` or service boilerplate required.

```typescript
// my-plugin.ts
import { defineDeclarativePlugin, PluginRouteInput } from '@gauzy/plugin-ui';
import { MY_ROUTE } from './my-plugin.routes';

export const MyPlugin = defineDeclarativePlugin('my-plugin', {
  location: 'my-sections',
  routes: [MY_ROUTE as PluginRouteInput],
  tabs: [
    {
      tabsetId: 'dashboard-page',
      tabId: 'my-tab',
      tabsetType: 'route',
      path: '/pages/dashboard/my-tab',
      tabTitle: () => 'My Tab',
      tabIcon: 'star-outline',
      order: 5,
    },
  ],
  navMenu: [
    {
      type: 'section',
      sectionId: 'reports',
      items: [
        {
          id: 'my-plugin-report',
          link: '/pages/my-report',
          data: { translationKey: 'MY_PLUGIN.REPORT' },
        },
      ],
    },
  ],
});
```

`defineDeclarativePlugin` auto-generates a `bootstrap` callback that injects the services registered in `PluginUiModule.init(services)`. No manual injector calls needed.

---

### 2. NgModule Plugin

Use `definePlugin` (or a plain `PluginUiDefinition` object) when your plugin needs Angular DI-managed class instances, lifecycle hooks, or complex initialization logic.

```typescript
// my-plugin.module.ts
import { NgModule } from '@angular/core';
import { inject } from '@angular/core';
import {
  IOnPluginUiBootstrap,
  IOnPluginUiDestroy,
  applyDeclarativeRegistrations,
  PLUGIN_DEFINITION,
} from '@gauzy/plugin-ui';
import { NavMenuBuilderService, PageRouteRegistryService } from '@gauzy/ui-core/core';

@NgModule({})
export class MyPluginModule implements IOnPluginUiBootstrap, IOnPluginUiDestroy {
  private readonly _nav = inject(NavMenuBuilderService);
  private readonly _routes = inject(PageRouteRegistryService);
  private readonly _def = inject(PLUGIN_DEFINITION);

  ngOnPluginBootstrap(): void {
    applyDeclarativeRegistrations(this._def, {
      navBuilder: this._nav,
      pageRouteRegistry: this._routes,
    });
    console.log('[MyPlugin] bootstrapped');
  }

  ngOnPluginDestroy(): void {
    console.log('[MyPlugin] destroyed');
  }
}
```

```typescript
// my-plugin.ts
import { definePlugin } from '@gauzy/plugin-ui';
import { MyPluginModule } from './my-plugin.module';

export const MyPlugin = definePlugin('my-plugin', MyPluginModule, {
  location: 'my-sections',
});
```

Plugin options are available inside the module via `inject(PLUGIN_OPTIONS)`:

```typescript
const options = inject(PLUGIN_OPTIONS) as { featureFlag: boolean };
```

---

### 3. Lazy-Loaded Plugin

For code-splitting heavy plugins, use `loadModule` to defer the module load until bootstrap:

```typescript
export const MyPlugin: PluginUiDefinition = {
  id: 'my-plugin',
  location: 'my-sections',
  loadModule: () =>
    import('@gauzy/plugin-my-ui').then((m) => m.MyPluginModule),
};
```

---

### 4. Plugin Group (parent + children)

Use `definePluginGroup` to create a parent plugin that groups child plugins under a shared location. The parent module typically provides a shell route; children register sub-routes beneath it.

```typescript
// jobs-plugin.ts
import { definePluginGroup } from '@gauzy/plugin-ui';
import { JobsModule } from './jobs.module';
import { JobEmployeePlugin } from './job-employee/job-employee.plugin';
import { JobSearchPlugin } from './job-search/job-search.plugin';

export const JobsPlugin = definePluginGroup('jobs', JobsModule, {
  location: 'jobs-sections',
  plugins: [JobEmployeePlugin, JobSearchPlugin],
});
```

Consumer can customise the child list at registration time:

```typescript
// plugin-ui.config.ts
plugins: [
  JobsPlugin.init({
    plugins: [JobEmployeePlugin, JobSearchPlugin, JobMatchingPlugin],
  }),
]
```

---

## Plugin Definition Reference

```typescript
interface PluginUiDefinition {
  /** Unique identifier — must be stable across builds. */
  id: string;

  /** Angular NgModule class (eager). */
  module?: Type<any>;

  /** Async factory for lazy loading. */
  loadModule?: () => Promise<Type<any>>;

  /**
   * Lightweight callback for declarative-only plugins.
   * Auto-generated by defineDeclarativePlugin().
   * Called instead of creating a module instance.
   */
  bootstrap?: (injector: Injector) => void | Promise<void>;

  /** Page-route registry location (e.g. 'page-sections'). */
  location?: string;

  /** Child plugins (for plugin groups). */
  plugins?: PluginUiDefinition[];

  /** Per-plugin options — available via inject(PLUGIN_OPTIONS). */
  options?: Record<string, unknown>;

  /** Declarative routes registered at bootstrap. */
  routes?: PluginRouteInput[];

  /** Declarative nav menu contributions. */
  navMenu?: PluginNavContribution[];

  /** Declarative page tabs. */
  tabs?: PluginTabInput[];

  /** Declarative page extensions. */
  extensions?: PageExtensionDefinition[];

  /** Feature key for PLUGIN_ACTIVATION_PREDICATE checks. */
  featureKey?: unknown;

  /** Permission keys for PLUGIN_ACTIVATION_PREDICATE checks. */
  permissionKeys?: unknown[];

  /** Plugin IDs that must bootstrap before this plugin. */
  dependsOn?: string[];
}
```

---

## Registering Plugins

Add plugins to the `plugins` array in your `PluginUiConfig`:

```typescript
export const uiPluginConfig: PluginUiConfig = {
  defaultLanguage: 'en',
  defaultLocale: 'en-US',
  availableLanguages: ['en', 'fr'],
  availableLocales: ['en-US', 'fr-FR'],
  plugins: [
    IntegrationPlugin,
    JobsPlugin.init({ plugins: [JobEmployeePlugin, JobSearchPlugin] }),
    ReactUiPlugin,
  ],
};
```

Plugins are initialized in declaration order, respecting `dependsOn` for explicit ordering.

---

## Lifecycle Hooks

NgModule-based plugins can implement these interfaces:

| Interface                  | Method                        | Timing                             |
| -------------------------- | ----------------------------- | ---------------------------------- |
| `IOnPluginUiBootstrap`     | `ngOnPluginBootstrap()`       | After all modules instantiated     |
| `IOnPluginAfterBootstrap`  | `ngOnPluginAfterBootstrap()`  | After all bootstrap hooks complete |
| `IOnPluginBeforeDestroy`   | `ngOnPluginBeforeDestroy()`   | Synchronous, before destroy loop   |
| `IOnPluginUiDestroy`       | `ngOnPluginDestroy()`         | On application shutdown            |

```typescript
@NgModule({})
export class MyPluginModule
  implements IOnPluginUiBootstrap, IOnPluginAfterBootstrap, IOnPluginUiDestroy
{
  ngOnPluginBootstrap(): void { /* register routes, tabs, nav */ }
  ngOnPluginAfterBootstrap(): void { /* post-bootstrap setup */ }
  ngOnPluginDestroy(): void { /* cleanup */ }
}
```

> **Declarative plugins** (`defineDeclarativePlugin`) do not support lifecycle hooks. If you need hooks, use an NgModule plugin instead.

---

## Declarative Registrations

The `applyDeclarativeRegistrations` helper applies routes, nav, tabs, and extensions from a `PluginUiDefinition` object. It's called automatically by `defineDeclarativePlugin`; call it manually in NgModule lifecycle hooks.

```typescript
applyDeclarativeRegistrations(pluginDefinition, {
  navBuilder: inject(NavMenuBuilderService),
  pageRouteRegistry: inject(PageRouteRegistryService),
  pageTabRegistry: inject(PageTabRegistryService),
  pageExtensionRegistry: inject(PageExtensionRegistryService),
});
```

### Routes

```typescript
routes: [
  {
    location: 'page-sections',
    path: 'my-feature',
    loadChildren: () =>
      import('./my-feature/my-feature.module').then((m) => m.MyFeatureModule),
  },
],
```

### Nav Menu

Add a new top-level section:

```typescript
navMenu: [
  {
    type: 'config',
    config: {
      id: 'my-plugin',
      link: '/pages/my-feature',
      data: { translationKey: 'MY_PLUGIN.TITLE' },
    },
  },
],
```

Add items to an existing section:

```typescript
navMenu: [
  {
    type: 'section',
    sectionId: 'reports',
    items: [
      {
        id: 'my-report',
        link: '/pages/reports/my-report',
        data: { translationKey: 'MY_PLUGIN.REPORT' },
      },
    ],
  },
],
```

### Page Tabs

```typescript
tabs: [
  {
    tabsetId: 'dashboard-page',
    tabId: 'my-widget-tab',
    tabsetType: 'route',
    path: '/pages/dashboard/my-widget',
    tabTitle: (i18n) => i18n.getTranslation('MY_PLUGIN.WIDGET_TAB'),
    tabIcon: 'star-outline',
    responsive: true,
    activeLinkOptions: { exact: false },
    order: 10,
    permissions: [PermissionsEnum.ADMIN_DASHBOARD_VIEW],
  },
],
```

### Extensions

```typescript
import { defineReactExtension } from '@gauzy/plugin-ui';
import { MyReactWidget } from './components/MyReactWidget';

extensions: [
  defineReactExtension({
    id: 'my-react-widget',
    slotId: PAGE_EXTENSION_SLOTS.DASHBOARD_WIDGETS,
    component: MyReactWidget,
    props: { title: 'My Widget' },
    order: 5,
  }),
],
```

---

## Activation Predicate (Feature Flags / Permissions)

Provide `PLUGIN_ACTIVATION_PREDICATE` to skip plugins whose feature flag is disabled or whose permissions the user lacks. The predicate runs before each plugin is bootstrapped.

```typescript
// In your root module providers:
{
  provide: PLUGIN_ACTIVATION_PREDICATE,
  useFactory: () => {
    const store = inject(Store);
    return (def: PluginUiDefinition): boolean => {
      if (def.featureKey && !store.hasFeatureEnabled(def.featureKey)) {
        return false;
      }
      if (def.permissionKeys?.length && !store.hasAnyPermission(...def.permissionKeys)) {
        return false;
      }
      return true;
    };
  },
}
```

Then annotate plugins:

```typescript
export const MyPlugin = defineDeclarativePlugin('my-plugin', {
  featureKey: FeatureEnum.MY_FEATURE,
  permissionKeys: [PermissionsEnum.MY_PERMISSION],
  routes: [...],
  tabs: [...],
});
```

---

## React Bridge

`@gauzy/plugin-ui` includes a React-Angular bridge that lets you render React components inside Angular templates, and access Angular services from React.

### Rendering React inside Angular

#### Using `ReactHostDirective` (eager component)

```typescript
import { Component } from '@angular/core';
import { ReactHostDirective } from '@gauzy/plugin-ui';
import { MyReactWidget } from './components/MyReactWidget';

@Component({
  standalone: true,
  imports: [ReactHostDirective],
  template: `
    <div
      [reactHost]="component"
      [reactHostProps]="props"
    ></div>
  `,
})
export class MyAngularComponent {
  component = MyReactWidget;
  props = { title: 'Hello from React!' };
}
```

#### Using `LazyReactHostDirective` (lazy component)

```typescript
import { LazyReactHostDirective } from '@gauzy/plugin-ui';

@Component({
  standalone: true,
  imports: [LazyReactHostDirective],
  template: `
    <div
      [lazyReactHost]="componentLoader"
      [lazyReactHostProps]="props"
    ></div>
  `,
})
export class MyAngularComponent {
  componentLoader = () =>
    import('./components/MyReactWidget').then((m) => m.MyReactWidget);
  props = { title: 'Lazy Loaded!' };
}
```

---

### Accessing Angular Services from React

Use the `useInjector` hook to access any Angular service from within a React component. The Angular `Injector` is provided automatically via the `NgContextProvider`.

```tsx
// MyReactWidget.tsx
import React from 'react';
import { useInjector } from '@gauzy/plugin-ui';
import { TimesheetStatisticsService } from '@gauzy/ui-core/core';

export function MyReactWidget() {
  const injector = useInjector();
  const stats = injector.get(TimesheetStatisticsService);

  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    stats.getStatistics().subscribe((result) => setData(result));
  }, []);

  return <div>{data ? JSON.stringify(data) : 'Loading...'}</div>;
}
```

---

### Plugin Events

Use `usePluginEvents` to subscribe to or emit events across plugin boundaries via the `PluginEventBusService`.

```tsx
import { usePluginEvents } from '@gauzy/plugin-ui';

export function MyReactWidget() {
  const { emit, subscribe } = usePluginEvents();

  React.useEffect(() => {
    const sub = subscribe('timer:started', (payload) => {
      console.log('Timer started', payload);
    });
    return () => sub.unsubscribe();
  }, []);

  return (
    <button onClick={() => emit('widget:clicked', { id: 'my-widget' })}>
      Click Me
    </button>
  );
}
```

---

## Extension Slots

Page extension slots let plugins inject components into pre-defined areas of the host app without modifying its templates.

### Using a slot in a host template

```typescript
import { PageExtensionSlotComponent } from '@gauzy/plugin-ui';

@Component({
  standalone: true,
  imports: [PageExtensionSlotComponent],
  template: `
    <gz-page-extension-slot slotId="dashboard-widgets" />
  `,
})
export class DashboardComponent {}
```

### Registering a React component as an extension

```typescript
import { defineReactExtension, PAGE_EXTENSION_SLOTS } from '@gauzy/plugin-ui';
import { MyWidget } from './MyWidget';

// In your plugin definition:
extensions: [
  defineReactExtension({
    id: 'my-dashboard-widget',
    slotId: PAGE_EXTENSION_SLOTS.DASHBOARD_WIDGETS,
    component: MyWidget,
    props: { mode: 'compact' },
    order: 1,
  }),
],
```

---

## Building

```bash
# Development build
yarn nx build plugin-ui

# Production build
yarn nx build plugin-ui --configuration=production

# Run tests
yarn nx test plugin-ui
```
