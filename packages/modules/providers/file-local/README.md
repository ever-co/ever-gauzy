# @gauzy/file-local

A flexible, reusable local file storage provider for NestJS applications.

This package is designed to be **loosely coupled** and can be used:

-   As a **standalone module** in any NestJS application
-   As part of the Gauzy platform's FileStorageModule

## Features

-   **Standalone Usage**: Use the LocalProvider directly without any framework dependencies
-   **NestJS Integration**: Full support for NestJS dependency injection
-   **Tenant-Aware Configuration**: Dynamic configuration based on request context
-   **Multer Integration**: Seamless file upload handling with Multer
-   **Core Compatibility**: Fully compatible with @gauzy/core file storage system

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
import { LocalStorageProviderModule } from '@gauzy/file-local';

@Module({
	imports: [
		LocalStorageProviderModule.register({
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
import { LocalStorageProviderModule } from '@gauzy/file-local';

@Module({
	imports: [
		LocalStorageProviderModule.registerAsync({
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

### With Config Adapter

For more advanced use cases, you can use the `LocalConfigAdapter`:

```typescript
import { Module } from '@nestjs/common';
import { LocalStorageProviderModule, LocalConfigAdapter } from '@gauzy/file-local';

@Module({
	imports: [
		LocalStorageProviderModule.register({
			isGlobal: false,
			configProvider: new LocalConfigAdapter({
				rootPath: '/var/www/public',
				baseUrl: 'http://localhost:3000',
				publicPath: 'public'
			})
		})
	]
})
export class AppModule {}
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

### LocalStorageProviderModule

| Method                   | Description                                  |
| ------------------------ | -------------------------------------------- |
| `register(options)`      | Register with static configuration           |
| `registerAsync(options)` | Register with async configuration            |
| `forFeature(config)`     | Create a feature module with specific config |

### LocalConfigAdapter

An adapter for configuration that supports:

-   Environment-based default configuration
-   Tenant-aware configuration via RequestContext
-   Runtime configuration updates

## Constants

```typescript
import {
	LOCAL_CONFIG, // Injection token for static config
	LOCAL_CONFIG_PROVIDER, // Injection token for config provider
	LOCAL_STORAGE_PROVIDER // Injection token for LocalProvider
} from '@gauzy/file-local';
```

## License

AGPL-3.0
