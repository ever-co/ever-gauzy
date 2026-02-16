# @gauzy/plugin-ui

Core UI plugin infrastructure for Gauzy. Provides types, loader, lifecycle module, extension registry, and conventions for building UI plugins.

## Quick Start

### 1. Define a plugin

```ts
import { definePlugin } from '@gauzy/plugin-ui';
import { MyPluginModule } from './my-plugin.module';

export const MyPlugin = definePlugin('my-plugin', MyPluginModule, {
	location: 'page-sections',
	options: {
		/* plugin-specific */
	}
});
```

### 2. Add to config

In `plugin-ui.config.ts`:

```ts
export const pluginUiConfig: PluginUiConfig = {
	defaultLanguage: 'en',
	defaultLocale: 'en-US',
	availableLanguages: ['en'],
	availableLocales: ['en-US'],
	plugins: [MyPlugin]
};
```

### 3. Use declarative registration

In your plugin module:

```ts
constructor() {
  const def = inject(PLUGIN_DEFINITION);
  applyDeclarativeRegistrations(def, {
    navBuilder: inject(NavMenuBuilderService),
    pageRouteRegistry: inject(PageRouteRegistryService),
    pageTabRegistry: inject(PageTabRegistryService),
    pageExtensionRegistry: inject(PageExtensionRegistryService)
  });
}
```

Define routes, nav sections, tabs, and extensions in the plugin definition.

---

## Conventions

### Plugin IDs

-   Use kebab-case: `job-employee`, `job-search`, `settings-email`
-   Must be unique across all plugins
-   Prefer namespacing: `jobs-employee`, `jobs-matching`

### Module structure

-   Implement `IOnPluginUiBootstrap` and `IOnPluginUiDestroy` for lifecycle hooks
-   Use `applyDeclarativeRegistrations()` in the constructor for routes, nav, tabs, extensions
-   Inject `PLUGIN_DEFINITION` and `PLUGIN_OPTIONS` when you need plugin metadata

### Extension slots

Use `EXTENSION_SLOTS` constants for consistency:

-   `EXTENSION_SLOTS.DASHBOARD_WIDGETS` – dashboard widgets
-   `EXTENSION_SLOTS.SETTINGS_TABS` – settings tabs
-   `EXTENSION_SLOTS.INTEGRATIONS_LIST` – integration tiles
-   `EXTENSION_SLOTS.USER_MENU_ITEMS` – user menu dropdown
-   `EXTENSION_SLOTS.HEADER_TOOLBAR` – header actions
-   Tab slots: `DASHBOARD_TABS`, `TIMESHEET_TABS`, `TIME_ACTIVITY_TABS`, `EMPLOYEE_EDIT_TABS`

---

## Features

### Declarative registration

Define `routes`, `navMenu`, `tabs`, and `extensions` in `PluginUiDefinition`. They are applied when the plugin calls `applyDeclarativeRegistrations()`. Use `navMenu` for both sections (parent menus) and items (children under existing sections).

### Conditional activation

Add `featureKey` and `permissionKeys` to the definition. Provide `PLUGIN_ACTIVATION_PREDICATE` to skip bootstrapping when features/permissions are disabled.

### Plugin dependencies

Use `dependsOn: ['other-plugin-id']` so dependencies load first. Circular dependencies throw at bootstrap.

### Lazy loading

Use `loadModule: () => import('@gauzy/my-plugin').then(m => m.MyPluginModule)` instead of `module` for code-splitting.

### Extension registry

Register components for named slots; host components render them:

```ts
pageExtensionRegistry.register({
	id: 'my-widget',
	slotId: EXTENSION_SLOTS.DASHBOARD_WIDGETS,
	component: MyWidgetComponent,
	order: 10
});
```

Extensions registered via `definition.extensions` are auto-deregistered when the plugin is destroyed.

---

## Lifecycle

1. **Bootstrap** (app init)

    - Plugins filtered by `PLUGIN_ACTIVATION_PREDICATE`
    - Ordered by `dependsOn`
    - Modules loaded (sync or via `loadModule`)
    - Instances created
    - `ngOnPluginBootstrap` called
    - `ngOnPluginAfterBootstrap` called

2. **Destroy** (app shutdown)
    - `ngOnPluginBeforeDestroy` called (sync)
    - `ngOnPluginDestroy` called
    - Extensions deregistered by plugin id
    - Plugin instances removed from registry

---

## API Reference

### Types

-   `PluginUiDefinition` – plugin config
-   `PluginRouteInput`, `PluginNavSectionInput`, `PluginTabInput` – declarative shapes
-   `ExtensionDefinition`, `EXTENSION_SLOTS` – extension slot system

### Tokens

-   `PLUGIN_DEFINITION` – current plugin definition
-   `PLUGIN_OPTIONS` – plugin options
-   `PLUGIN_ACTIVATION_PREDICATE` – optional activation filter

### Services

-   `PageExtensionRegistryService` – register/get extensions by slot
-   `PluginUiRegistryService` – tracks plugin instances

### Helpers

-   `definePlugin`, `definePluginGroup` – create definitions
-   `applyDeclarativeRegistrations` – apply routes, nav, tabs, extensions
