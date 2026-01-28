/**
 * Public API Surface of @gauzy/storage-provider-wasabi
 *
 * A flexible, reusable Wasabi S3-compatible storage provider that can be used:
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

// Main Wasabi provider
export * from './lib/wasabi-s3.provider';

// NestJS module
export { WasabiStorageModule, createConfigFromEnv } from './lib/wasabi-storage.module';

// Platform adapters
export * from './lib/adapters';
