## @gauzy/plugin-ui

The `@gauzy/plugin-ui` library provides the **core UI plugin infrastructure** for the Gauzy platform.
It contains the shared types, lifecycle interfaces, configuration loader, registry, and Angular module
used to bootstrap and manage UI plugins (such as job and integration UI plugins) at runtime.

### Features

-   **Plugin type & config model**

    -   `PluginUiDefinition` definition (id, module, location, options).
    -   `PluginUiConfig` with language/locale settings and active plugins list.
    -   `PLUGIN_UI_CONFIG` and `PLUGIN_OPTIONS` injection tokens.

-   **Lifecycle interfaces**

    -   `IOnPluginUiBootstrap` / `IOnPluginUiDestroy` (required).
    -   `IOnPluginAfterBootstrap` / `IOnPluginBeforeDestroy` (optional, invoked automatically).
    -   `IOnPluginBeforeRouteActivate` / `IOnPluginConfigChange` (optional, for guards and future config reload).

-   **Config loader helpers**

    -   `setPluginUiConfig`, `getPluginUiConfig`, `resetPluginUiConfig` for storing and reading
        the frozen UI configuration before Angular bootstrap.

-   **Plugin lifecycle module**

    -   `PluginUiModule.init()` registers an `APP_INITIALIZER` that:
        -   Instantiates all configured plugin modules.
        -   Invokes plugin lifecycle hooks (`ngOnPluginBootstrap` / `ngOnPluginDestroy`).
        -   Registers instances in the shared registry.

-   **Registry service**

    -   `PluginUiRegistryService` tracks live plugin module instances and
        provides `destroyAll()` for graceful shutdown.

-   **Plugin options**

    -   Add `options?: Record<string, unknown>` to `PluginUiDefinition` for per-plugin metadata.
    -   Access via `inject(PLUGIN_OPTIONS)` inside the plugin module constructor or lifecycle hooks.

-   **definePlugin / definePluginGroup**
    -   `definePlugin(id, module, options?)` — creates a simple plugin definition.
    -   `definePluginGroup(id, module, { location, plugins, init? })` — creates a parent plugin with child plugins and optional init factory.

### Getting Started

The `@gauzy/plugin-ui` library is generated with [Nx](https://nx.dev) and is intended to be used
within the Gauzy monorepo. It is primarily consumed by:

-   **Gauzy web app** — the root bootstrap module imports `PluginUiModule.init()` to load config, instantiate plugin modules, and run lifecycle hooks.
-   **UI plugin packages** — e.g. `@gauzy/plugin-jobs-ui`, `@gauzy/plugin-job-proposal-ui`, `@gauzy/plugin-videos-ui`, and other plugins that implement `IOnPluginUiBootstrap` / `IOnPluginUiDestroy` and are registered in the plugin config.

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
