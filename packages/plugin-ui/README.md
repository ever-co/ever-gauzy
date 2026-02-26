## @gauzy/plugin-ui

The `@gauzy/plugin-ui` library provides the **core UI plugin infrastructure** for the Gauzy platform.
It contains the shared types, lifecycle interfaces, configuration loader, registry, and Angular module
used to bootstrap and manage UI plugins (such as job and integration UI plugins) at runtime.

### Features

- **Plugin type & config model**
    - `PluginUiDefinition` definition (id, module, location, options).
    - `PluginUiConfig` with language/locale settings and active plugins list.
    - `PLUGIN_UI_CONFIG` and `PLUGIN_OPTIONS` injection tokens.

- **Lifecycle interfaces**
    - `IOnPluginUiBootstrap` / `IOnPluginUiDestroy` (required).
    - `IOnPluginAfterBootstrap` / `IOnPluginBeforeDestroy` (optional, invoked automatically).
    - `IOnPluginBeforeRouteActivate` / `IOnPluginConfigChange` (optional, for guards and future config reload).

- **Config loader helpers**
    - `setPluginUiConfig`, `getPluginUiConfig`, `resetPluginUiConfig` for storing and reading
      the frozen UI configuration before Angular bootstrap.

- **Plugin lifecycle module**
    - `PluginUiModule.init()` registers an `APP_INITIALIZER` that:
        - Instantiates all configured plugin modules.
        - Invokes plugin lifecycle hooks (`ngOnPluginBootstrap` / `ngOnPluginDestroy`).
        - Registers instances in the shared registry.

- **Registry service**
    - `PluginUiRegistryService` tracks live plugin module instances and
      provides `destroyAll()` for graceful shutdown.

- **Plugin options**
    - Add `options?: Record<string, unknown>` to `PluginUiDefinition` for per-plugin metadata.
    - Access via `inject(PLUGIN_OPTIONS)` inside the plugin module constructor or lifecycle hooks.

- **definePlugin / definePluginGroup**
    - `definePlugin(id, module, options?)` — creates a simple plugin definition.
    - `definePluginGroup(id, module, { location, plugins, init? })` — creates a parent plugin with child plugins and optional init factory.

- **UI Bridge System**
    - Render React (or any other UI framework) components inside Angular.
    - Pluggable bridge design — implement `UiBridge` to support additional frameworks.
    - `FrameworkHostComponent` — generic Angular component for rendering framework components.
    - `defineFrameworkExtension()` — helper for defining non-Angular extensions in plugins.

---

## UI Bridge System

The UI Bridge system allows plugins to render React (or other framework) components inside Angular. Each framework has its own bridge implementation that can be optionally installed.

### Architecture

```
@gauzy/plugin-ui (Core)
├── UiBridge (abstract interface)
├── UiBridgeRegistryService (manages all bridges)
├── FrameworkHostComponent (generic host)
└── defineFrameworkExtension() (helper)
```

### Using the UI Bridge

#### 1. Install a Framework Bridge

```bash
# For React support
yarn add react react-dom
```

#### 2. Register the Bridge

```typescript
// In your app.config.ts or main providers
import { provideReactBridge } from '@gauzy/plugin-ui';

export const appConfig: ApplicationConfig = {
	providers: [
		provideReactBridge()
		// ... other providers
	]
};
```

#### 3. Use FrameworkHostComponent

```typescript
import { Component } from '@angular/core';
import { FrameworkHostComponent } from '@gauzy/plugin-ui';
import { MyReactWidget } from './react/MyReactWidget';

@Component({
	imports: [FrameworkHostComponent],
	template: ` <gz-framework-host frameworkId="react" [component]="reactWidget" [props]="widgetProps" /> `
})
export class MyComponent {
	reactWidget = MyReactWidget;
	widgetProps = { title: 'Hello from React!' };
}
```

#### 4. Define Framework Extensions in Plugins

```typescript
import {
	defineFrameworkExtension,
	UI_BRIDGE_FRAMEWORK,
	PAGE_EXTENSION_SLOTS,
	PluginUiDefinition
} from '@gauzy/plugin-ui';
import { MyReactWidget } from './react-components/MyReactWidget';

export const MyPlugin: PluginUiDefinition = {
	id: 'my-plugin',
	module: MyPluginModule,
	extensions: [
		defineFrameworkExtension({
			id: 'my-react-widget',
			slotId: PAGE_EXTENSION_SLOTS.DASHBOARD_WIDGETS,
			frameworkId: UI_BRIDGE_FRAMEWORK.REACT,
			frameworkComponent: MyReactWidget,
			frameworkProps: { title: 'Dashboard Widget' },
			order: 10
		})
	]
};
```

### Creating a Custom Bridge

To add support for a new framework, implement the `UiBridge` abstract class:

```typescript
import { UiBridge, UiBridgeConfig, UiBridgeMountOptions, UiBridgeMountResult } from '@gauzy/plugin-ui';

export class MyFrameworkBridge extends UiBridge {
	readonly config: UiBridgeConfig = {
		frameworkId: 'my-framework',
		name: 'My Framework Bridge',
		version: '1.0.0'
	};

	mount(options: UiBridgeMountOptions): UiBridgeMountResult {
		// Mount your framework component into options.hostElement
		// Use options.injector to provide Angular services
		return {
			unmount: () => {
				/* cleanup */
			},
			updateProps: (props) => {
				/* update props */
			}
		};
	}

	isCompatible(component: unknown): boolean {
		// Return true if this bridge can handle the component
		return false;
	}
}
```

### Available Bridges

| Framework | Package            | Status       |
| --------- | ------------------ | ------------ |
| React     | `@gauzy/plugin-ui` | ✅ Available |

---

### Getting Started

The `@gauzy/plugin-ui` library is generated with [Nx](https://nx.dev) and is intended to be used
within the Gauzy monorepo. It is primarily consumed by:

- **Gauzy web app** — the root bootstrap module imports `PluginUiModule.init()` to load config, instantiate plugin modules, and run lifecycle hooks.
- **UI plugin packages** — e.g. `@gauzy/plugin-jobs-ui`, `@gauzy/plugin-job-proposal-ui`, `@gauzy/plugin-videos-ui`, and other plugins that implement `IOnPluginUiBootstrap` / `IOnPluginUiDestroy` and are registered in the plugin config.

### Building

Run the following command to build the library:

```bash
yarn nx build plugin-ui
```

For a production build:

```bash
yarn nx build plugin-ui --configuration=production
```

### Running unit tests

Run the unit tests with:

```bash
yarn nx test plugin-ui
```

### Publishing

After building your library with `yarn nx build plugin-ui`, go to the dist folder `dist/packages/plugin-ui` and run `npm publish`.

### Installation

To install the Plugin UI, run:

```bash
npm install @gauzy/plugin-ui
# or
yarn add @gauzy/plugin-ui
```
