/**
 * Public API Surface of @gauzy/file-local
 *
 * A flexible, reusable local file storage provider that can be used:
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

// Main Local provider
export * from './lib/local.provider';

// NestJS module
export { LocalStorageProviderModule, createConfigFromEnv } from './lib/local-storage-provider.module';

// Platform adapters
export * from './lib/adapters';
