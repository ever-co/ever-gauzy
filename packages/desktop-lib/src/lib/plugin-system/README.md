# Plugin System

A robust, extensible plugin architecture for the desktop application that enables dynamic loading, installation, and management of plugins from multiple sources.

## Overview

The plugin system provides a complete lifecycle management solution for plugins, including:

- Dynamic plugin discovery and loading
- Multiple installation sources (CDN, local, npm)
- Plugin activation/deactivation
- Persistent metadata storage
- Event-driven architecture
- Menu integration
- Secure download and extraction with validation

## Architecture

### Core Components

#### 1. PluginManager (`data-access/plugin-manager.ts`)

The central orchestrator for all plugin operations. Implements singleton pattern to ensure a single source of truth.

**Key Responsibilities:**

- Plugin lifecycle management (install, update, uninstall)
- Plugin state management (activate, deactivate)
- Loading plugins on application startup
- Coordinating with metadata service and event system

**Main Methods:**

- `downloadPlugin()` - Downloads and installs plugins from various sources
- `installPlugin()` - Installs a plugin from a local directory
- `updatePlugin()` - Updates an existing plugin to a new version
- `activatePlugin()` - Activates a plugin and calls its lifecycle hooks
- `deactivatePlugin()` - Deactivates a plugin and cleans up resources
- `uninstallPlugin()` - Completely removes a plugin
- `loadPlugins()` - Loads all installed plugins on startup

#### 2. PluginMetadataService (`database/plugin-metadata.service.ts`)

Manages persistent storage of plugin metadata using the application's database.

**Stored Information:**

- Plugin name, version, description
- File paths (main entry point, renderer component)
- Installation metadata (marketplace ID, version ID, installation ID)
- Activation state
- Installation directory path

#### 3. PluginEventManager (`events/plugin-event.manager.ts`)

Event-driven notification system using Node.js EventEmitter pattern.

**Events:**

- `NOTIFY` - Broadcasts plugin system state changes

**Usage:**

```typescript
const eventManager = PluginEventManager.getInstance();
eventManager.listen((message) => {
	console.log('Plugin system updated:', message);
});
```

#### 4. Download Strategies (`data-access/strategies/`)

Strategy pattern implementation for different plugin sources:

- **CdnDownloadStrategy** - Downloads from CDN URLs (with streaming support)
- **LocalDownloadStrategy** - Installs from local file system
- **NpmDownloadStrategy** - Installs from npm registry

#### 5. DownloadContextFactory (`data-access/download-context.factory.ts`)

Factory pattern for creating appropriate download strategies based on context type.

## Plugin Structure

### Required Files

Every plugin must include a `manifest.json` file:

```json
{
	"name": "my-plugin",
	"version": "1.0.0",
	"description": "Plugin description",
	"main": "index.js",
	"renderer": "renderer.js",
	"author": "Author Name",
	"logo": "logo.png"
}
```

### Plugin Interface

Plugins must implement the `IPlugin` interface:

```typescript
interface IPlugin {
	name: string;
	version: string;
	initialize(): Promise<void> | void;
	dispose(): Promise<void> | void;
	activate(): Promise<void> | void;
	deactivate(): Promise<void> | void;
	component?(): void;
	menu?: Electron.MenuItemConstructorOptions;
}
```

### Lifecycle Hooks

1. **activate()** - Called when plugin is activated
2. **initialize()** - Called after activation to set up resources
3. **dispose()** - Called before deactivation to clean up resources
4. **deactivate()** - Called when plugin is deactivated

## Installation Flow

### CDN Installation

```typescript
const pluginManager = PluginManager.getInstance();

await pluginManager.downloadPlugin({
	contextType: PluginDownloadContextType.CDN,
	url: 'https://cdn.example.com/plugin.zip',
	marketplaceId: 'marketplace-id',
	versionId: 'version-id'
});
```

**Process:**

1. Validates URL and file extension
2. Downloads zip file (with retry logic and timeout)
3. Extracts to temporary directory with security checks
4. Validates manifest.json
5. Creates unique plugin directory (timestamp-pluginname)
6. Stores metadata in database
7. Loads plugin module using lazy loader
8. Cleans up temporary files

### Security Features

The CDN download strategy includes comprehensive security measures:

- **Path Traversal Protection** - Validates all extracted paths
- **Size Limits** - Per-file (500MB) and total extraction (1GB) limits
- **Protocol Validation** - Only allows HTTPS/HTTP
- **Extension Validation** - Only accepts .zip files
- **Timeout Protection** - 5-minute download timeout
- **Retry Logic** - Up to 3 attempts with exponential backoff

### Streaming Mode

For memory efficiency, the system supports direct streaming from URL to extraction:

```typescript
private static readonly USE_STREAMING = true;
```

This avoids saving the zip file to disk, reducing I/O operations and disk space usage.

## Plugin Storage

Plugins are stored in the application's user data directory:

```
{userData}/plugins/
  ├── 1234567890123-plugin-name/
  │   ├── manifest.json
  │   ├── index.js
  │   └── renderer.js
  └── 1234567890124-another-plugin/
      └── ...
```

Each plugin gets a unique directory with timestamp prefix to prevent conflicts.

## Usage Examples

### Loading Plugins on Startup

```typescript
const pluginManager = PluginManager.getInstance();
await pluginManager.loadPlugins();
```

### Installing a Plugin

```typescript
await pluginManager.installPlugin(
	{
		name: 'my-plugin',
		version: '1.0.0',
		main: 'index.js',
		description: 'My awesome plugin'
	},
	'/path/to/plugin/directory'
);
```

### Activating/Deactivating

```typescript
// Activate
await pluginManager.activatePlugin('my-plugin');

// Deactivate
await pluginManager.deactivatePlugin('my-plugin');
```

### Uninstalling

```typescript
const installationId = await pluginManager.uninstallPlugin({
	name: 'my-plugin'
});
```

### Getting Plugin Information

```typescript
// Get all plugins
const allPlugins = await pluginManager.getAllPlugins();

// Get specific plugin
const plugin = await pluginManager.getOnePlugin('my-plugin');

// Check if plugin is installed
const installed = await pluginManager.checkInstallation('marketplace-id');
```

### Menu Integration

Active plugins can contribute menu items to the application:

```typescript
const menuItems = pluginManager.getMenuPlugins();
// Returns array of Electron MenuItemConstructorOptions
```

## Event System

Listen for plugin system changes:

```typescript
const eventManager = PluginEventManager.getInstance();

eventManager.listen((message) => {
	// Handle plugin system updates
	console.log('Plugin event:', message);
});
```

## Error Handling

The system includes comprehensive error handling:

- Download failures trigger automatic retries
- Failed installations clean up partial files
- Validation errors prevent corrupted plugins
- Database errors are logged and propagated
- Cleanup operations use force and retry options

## Best Practices

1. **Always validate manifest.json** - Ensure required fields are present
2. **Implement all lifecycle hooks** - Even if empty, for consistency
3. **Clean up resources in dispose()** - Prevent memory leaks
4. **Use async/await** - All lifecycle methods support promises
5. **Handle errors gracefully** - Don't crash the host application
6. **Version your plugins** - Use semantic versioning
7. **Test activation/deactivation** - Ensure plugins can be toggled

## Lazy Loading

Plugins are loaded dynamically using the `lazyLoader` utility:

```typescript
const plugin = await lazyLoader('/path/to/plugin/index.js');
```

This uses Node.js `require()` to load the module and returns either the default export or the module itself.

## Database Schema

The plugin metadata table stores:

```typescript
interface IPluginMetadataPersistance {
	id: string;
	name: string;
	version: string;
	description?: string;
	main: string;
	renderer?: string;
	pathname: string;
	isActivate: boolean;
	marketplaceId?: string;
	versionId?: string;
	installationId?: string;
}
```

## Future Enhancements

Potential areas for expansion:

- Plugin dependency management
- Plugin sandboxing for enhanced security
- Hot reloading during development
- Plugin marketplace integration
- Version conflict resolution
- Plugin communication API
- Resource usage monitoring
- Plugin permissions system
