# @gauzy/storage-provider-wasabi

A flexible, reusable Wasabi S3-compatible storage provider for NestJS applications. This package can be used standalone, with NestJS dependency injection, or integrated with the Ever Gauzy platform.

## Features

-   **Standalone Usage**: Use without any framework dependencies
-   **NestJS Integration**: Full support for NestJS dependency injection
-   **Dynamic Configuration**: Support for runtime configuration changes (e.g., multi-tenant)
-   **Multiple Configuration Sources**: Static, async, or provider-based configuration
-   **Type-Safe**: Full TypeScript support with comprehensive interfaces
-   **Multer Integration**: Built-in support for file uploads via Multer
-   **Pre-signed URLs**: Generate secure, time-limited URLs for file access

## Installation

```bash
yarn add @gauzy/storage-provider-wasabi
```

## Usage

### 1. Standalone Usage (No Framework)

```typescript
import { WasabiS3Provider } from '@gauzy/storage-provider-wasabi';

const provider = new WasabiS3Provider();

// Configure the provider
provider.setConfig({
	accessKeyId: 'your-access-key',
	secretAccessKey: 'your-secret-key',
	bucket: 'your-bucket',
	region: 'us-east-1'
});

// Upload a file
const uploadedFile = await provider.putFile(Buffer.from('Hello, World!'), 'path/to/file.txt', 'text/plain');

// Get a pre-signed URL
const url = await provider.url('path/to/file.txt');

// Download a file
const content = await provider.getFile('path/to/file.txt');

// Delete a file
await provider.deleteFile('path/to/file.txt');
```

### 2. NestJS Module (Static Configuration)

```typescript
import { Module } from '@nestjs/common';
import { WasabiStorageModule } from '@gauzy/storage-provider-wasabi';

@Module({
	imports: [
		WasabiStorageModule.register({
			isGlobal: true,
			config: {
				accessKeyId: process.env.WASABI_ACCESS_KEY_ID,
				secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY,
				bucket: process.env.WASABI_BUCKET,
				region: 'us-east-1'
			}
		})
	]
})
export class AppModule {}
```

### 3. NestJS Module (Async Configuration)

```typescript
import { Module } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { WasabiStorageModule } from '@gauzy/storage-provider-wasabi';

@Module({
	imports: [
		WasabiStorageModule.registerAsync({
			isGlobal: true,
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				config: {
					accessKeyId: configService.get('WASABI_ACCESS_KEY_ID'),
					secretAccessKey: configService.get('WASABI_SECRET_ACCESS_KEY'),
					bucket: configService.get('WASABI_BUCKET'),
					region: configService.get('WASABI_REGION', 'us-east-1')
				}
			})
		})
	]
})
export class AppModule {}
```

### 4. Dynamic/Tenant-Aware Configuration

```typescript
import { Injectable } from '@nestjs/common';
import { WasabiStorageModule, IWasabiConfigProvider, IWasabiConfig } from '@gauzy/storage-provider-wasabi';

// Create a custom config provider
@Injectable()
class TenantConfigProvider implements IWasabiConfigProvider {
	constructor(private readonly tenantService: TenantService) {}

	getConfig(): IWasabiConfig | null {
		const tenant = this.tenantService.getCurrentTenant();

		return {
			accessKeyId: tenant?.wasabiAccessKey || process.env.WASABI_ACCESS_KEY_ID,
			secretAccessKey: tenant?.wasabiSecretKey || process.env.WASABI_SECRET_ACCESS_KEY,
			bucket: tenant?.wasabiBucket || process.env.WASABI_BUCKET,
			region: tenant?.wasabiRegion || 'us-east-1'
		};
	}
}

// Register with custom provider
@Module({
	imports: [
		WasabiStorageModule.registerAsync({
			useClass: TenantConfigProvider
		})
	]
})
export class AppModule {}
```

### 5. Using in Services

```typescript
import { Injectable } from '@nestjs/common';
import { WasabiS3Provider } from '@gauzy/storage-provider-wasabi';

@Injectable()
export class FileService {
	constructor(private readonly wasabiProvider: WasabiS3Provider) {}

	async uploadFile(file: Express.Multer.File): Promise<string> {
		const result = await this.wasabiProvider.putFile(file.buffer, `uploads/${file.originalname}`, file.mimetype);
		return result?.url;
	}

	async getSignedUrl(key: string): Promise<string> {
		return this.wasabiProvider.url(key, 3600); // 1 hour expiry
	}
}
```

### 6. Gauzy Platform Integration

```typescript
import { createWasabiStoragePlugin, GauzyWasabiConfigAdapter } from '@gauzy/storage-provider-wasabi';
import { environment } from '@gauzy/config';
import { RequestContext } from '@gauzy/core';

// Create adapter with Gauzy environment and request context
const configAdapter = new GauzyWasabiConfigAdapter(environment.wasabi, {
	currentRequest: () => RequestContext.currentRequest()
});

// Use in plugins.ts
export const plugins = [
	createWasabiStoragePlugin({
		configProvider: configAdapter
	})
];
```

## Configuration Options

| Option            | Type    | Required | Description                                  |
| ----------------- | ------- | -------- | -------------------------------------------- |
| `accessKeyId`     | string  | Yes      | Wasabi access key ID                         |
| `secretAccessKey` | string  | Yes      | Wasabi secret access key                     |
| `bucket`          | string  | Yes      | Wasabi bucket name                           |
| `region`          | string  | No       | Wasabi region (default: 'us-east-1')         |
| `serviceUrl`      | string  | No       | Custom service URL (auto-mapped from region) |
| `forcePathStyle`  | boolean | No       | Use path-style URLs (default: false)         |
| `rootPath`        | string  | No       | Root path prefix for all files               |

## Supported Wasabi Regions

| Region         | Service URL                             |
| -------------- | --------------------------------------- |
| us-east-1      | https://s3.wasabisys.com                |
| us-east-2      | https://s3.us-east-2.wasabisys.com      |
| us-central-1   | https://s3.us-central-1.wasabisys.com   |
| us-west-1      | https://s3.us-west-1.wasabisys.com      |
| eu-central-1   | https://s3.eu-central-1.wasabisys.com   |
| eu-west-1      | https://s3.eu-west-1.wasabisys.com      |
| eu-west-2      | https://s3.eu-west-2.wasabisys.com      |
| ap-northeast-1 | https://s3.ap-northeast-1.wasabisys.com |
| ap-northeast-2 | https://s3.ap-northeast-2.wasabisys.com |
| ap-southeast-1 | https://s3.ap-southeast-1.wasabisys.com |
| ap-southeast-2 | https://s3.ap-southeast-2.wasabisys.com |

## API Reference

### WasabiS3Provider

| Method                                | Description                     |
| ------------------------------------- | ------------------------------- |
| `setConfig(config)`                   | Set static configuration        |
| `setConfigProvider(provider)`         | Set dynamic config provider     |
| `url(key, expiresIn?)`                | Get pre-signed URL for a file   |
| `path(filePath)`                      | Get full storage path           |
| `getFile(key)`                        | Download file content as Buffer |
| `putFile(content, key, contentType?)` | Upload file to storage          |
| `deleteFile(key)`                     | Delete a file                   |
| `fileExists(key)`                     | Check if file exists            |
| `getBucket()`                         | Get configured bucket name      |
| `handler(options)`                    | Get Multer storage engine       |

### WasabiStorageModule

| Method                   | Description                                |
| ------------------------ | ------------------------------------------ |
| `register(options)`      | Register with static configuration         |
| `registerAsync(options)` | Register with async configuration          |
| `forFeature(config)`     | Create feature module with specific config |

## Environment Variables

You can use the `createConfigFromEnv()` helper to load configuration from environment variables:

```typescript
import { createConfigFromEnv } from '@gauzy/storage-provider-wasabi';

// Uses WASABI_* prefix by default
const config = createConfigFromEnv();

// Or use a custom prefix
const config = createConfigFromEnv('MY_WASABI');
```

Expected environment variables:

-   `WASABI_ACCESS_KEY_ID`
-   `WASABI_SECRET_ACCESS_KEY`
-   `WASABI_BUCKET`
-   `WASABI_REGION`
-   `WASABI_SERVICE_URL`
-   `WASABI_FORCE_PATH_STYLE`
-   `WASABI_ROOT_PATH`

## License

AGPL-3.0

## Links

-   [Wasabi Documentation](https://docs.wasabi.com/)
-   [Ever Gauzy](https://github.com/ever-co/ever-gauzy)
-   [Report Issues](https://github.com/ever-co/ever-gauzy/issues)
