# @gauzy/file-local

A flexible, reusable local file storage provider for NestJS applications.

This package is designed to be **loosely coupled** and can be used:

-   As a **standalone module** in any NestJS application
-   As a **plugin** for the Gauzy platform's FileStorageModule

## Features

-   **Standalone Usage**: Use the LocalProvider directly without any framework dependencies
-   **NestJS Integration**: Full support for NestJS dependency injection
-   **Tenant-Aware Configuration**: Dynamic configuration based on request context
-   **Multer Integration**: Seamless file upload handling with Multer
-   **Core Compatibility**: Fully compatible with @gauzy/core file storage system
-   **Plugin Ready**: Designed for loose coupling with Gauzy's plugin architecture

## Installation

```bash
npm install @gauzy/file-local
# or
yarn add @gauzy/file-local
```

## Usage

### Standalone Usage (Without DI)

```typescript
import { LocalProvider } from '@gauzy/file-local';

const provider = new LocalProvider();
provider.setConfig({
	rootPath: '/var/www/public',
	baseUrl: 'http://localhost:3000',
	publicPath: 'public'
});

// Upload a file
const uploadedFile = await provider.putFile(buffer, 'uploads/image.png');

// Get file URL
const url = await provider.url('uploads/image.png');

// Read file content
const content = await provider.getFile('uploads/image.png');

// Delete file
await provider.deleteFile('uploads/image.png');
```

### NestJS Module - Static Configuration

```typescript
import { Module } from '@nestjs/common';
import { LocalStorageModule } from '@gauzy/file-local';

@Module({
	imports: [
		LocalStorageModule.register({
			isGlobal: true,
			config: {
				rootPath: '/var/www/public',
				baseUrl: 'http://localhost:3000',
				publicPath: 'public'
			}
		})
	]
})
export class AppModule {}
```

### NestJS Module - Async Configuration

```typescript
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageModule } from '@gauzy/file-local';

@Module({
	imports: [
		LocalStorageModule.registerAsync({
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				config: {
					rootPath: configService.get('STORAGE_PATH'),
					baseUrl: configService.get('BASE_URL'),
					publicPath: configService.get('PUBLIC_PATH')
				}
			})
		})
	]
})
export class AppModule {}
```

### As a Gauzy Plugin

The `LocalStorageModule` can be integrated as a plugin to extend Gauzy's file storage capabilities:

```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { GauzyPlugin, GauzyPluginMetadata } from '@gauzy/plugin';
import { LocalStorageModule, LocalConfigAdapter } from '@gauzy/file-local';
import { environment, getConfig } from '@gauzy/config';
import { RequestContext, TenantSettingsMiddleware } from '@gauzy/core';

@GauzyPluginMetadata({
	id: 'gauzy-plugin-file-local',
	name: 'Local File Storage Plugin',
	description: 'Provides local file system storage for Gauzy',
	version: '0.1.0'
})
@Module({
	imports: [
		LocalStorageModule.register({
			isGlobal: true,
			configProvider: new LocalConfigAdapter(
				{
					rootPath: getConfig().assetOptions?.assetPublicPath || 'public',
					baseUrl: environment.baseUrl,
					publicPath: 'public'
				},
				{
					currentRequest: () => {
						try {
							return RequestContext.currentRequest();
						} catch {
							return null;
						}
					}
				}
			)
		})
	],
	exports: [LocalStorageModule]
})
export class LocalStoragePlugin extends GauzyPlugin implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(TenantSettingsMiddleware).forRoutes('*');
	}
}
```

Then register the plugin in your Gauzy configuration:

```typescript
// gauzy.config.ts
import { LocalStoragePlugin } from '@gauzy/plugin-file-local';

export default {
	plugins: [LocalStoragePlugin]
};
```

### Injecting the Provider

```typescript
import { Injectable } from '@nestjs/common';
import { LocalProvider } from '@gauzy/file-local';

@Injectable()
export class FileService {
	constructor(private readonly localProvider: LocalProvider) {}

	async uploadFile(content: Buffer, filename: string): Promise<string> {
		const uploaded = await this.localProvider.putFile(content, filename);
		return uploaded.url;
	}
}
```

## Configuration Options

| Option       | Type     | Default    | Description                     |
| ------------ | -------- | ---------- | ------------------------------- |
| `rootPath`   | `string` | `'public'` | Root directory for file storage |
| `baseUrl`    | `string` | `''`       | Base URL for serving files      |
| `publicPath` | `string` | `'public'` | Public path prefix for URLs     |

## API Reference

### LocalProvider

| Method                   | Description                          |
| ------------------------ | ------------------------------------ |
| `url(filePath)`          | Generate a URL for accessing a file  |
| `path(filePath)`         | Get the full storage path for a file |
| `getFile(filePath)`      | Read file content as Buffer          |
| `putFile(content, path)` | Write file content to storage        |
| `deleteFile(filePath)`   | Delete a file from storage           |
| `fileExists(filePath)`   | Check if a file exists               |
| `handler(options)`       | Get a Multer storage engine          |
| `getRootPath()`          | Get the configured root path         |

### LocalStorageModule

| Method                   | Description                                  |
| ------------------------ | -------------------------------------------- |
| `register(options)`      | Register with static configuration           |
| `registerAsync(options)` | Register with async configuration            |
| `forFeature(config)`     | Create a feature module with specific config |

### LocalConfigAdapter

An adapter for Gauzy-specific configuration that supports:

-   Environment-based default configuration
-   Tenant-aware configuration via RequestContext
-   Runtime configuration updates

## Constants

```typescript
import {
	LOCAL_CONFIG, // Injection token for static config
	LOCAL_CONFIG_PROVIDER, // Injection token for config provider
	LOCAL_STORAGE_PROVIDER, // Injection token for LocalProvider
	DEFAULT_ROOT_PATH, // Default: 'public'
	DEFAULT_PUBLIC_PATH, // Default: 'public'
	DEFAULT_BASE_URL // Default: ''
} from '@gauzy/file-local';
```

## License

AGPL-3.0
