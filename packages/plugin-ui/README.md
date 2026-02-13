## @gauzy/plugin-ui

The `@gauzy/plugin-ui` library provides the **core UI plugin infrastructure** for the Gauzy platform.
It contains the shared types, lifecycle interfaces, configuration loader, registry, and Angular module
used to bootstrap and manage UI plugins (such as job and integration UI plugins) at runtime.

### Features

-   **Plugin type & config model**

    -   `PluginUiDefinition` definition (id, module, location).
    -   `PluginUiConfig` with language/locale settings and active plugins list.
    -   `PLUGIN_UI_CONFIG` injection token.

-   **Lifecycle interfaces**

    -   `IOnPluginUiBootstrap` / `IOnPluginUiDestroy`.
    -   `IPluginUiLifecycleMethods` type for modules implementing both hooks.

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

### Getting Started

The `@gauzy/plugin-ui` library is generated with [Nx](https://nx.dev) and is intended to be used
within the Gauzy monorepo. It is primarily consumed by:

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
