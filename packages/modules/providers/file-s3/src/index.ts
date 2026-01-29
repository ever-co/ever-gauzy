/**
 * Public API Surface of @gauzy/file-s3
 *
 * A flexible, reusable AWS S3 storage provider that can be used:
 * - Standalone without any framework
 * - With NestJS dependency injection
 * - With tenant-aware configuration
 */

// Core interfaces
export * from './lib/interfaces';

// Constants
export * from './lib/constants';

// Base provider class
export * from './lib/provider';

// Main S3 provider
export * from './lib/s3.provider';

// NestJS module
export { S3StorageProviderModule, createConfigFromEnv } from './lib/s3-storage-provider.module';

// Platform adapters
export * from './lib/adapters';
