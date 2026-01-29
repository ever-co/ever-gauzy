import { Module, DynamicModule, Provider as NestProvider } from '@nestjs/common';
import { LocalProvider } from './local.provider';
import {
	ILocalConfig,
	ILocalConfigProvider,
	ILocalStorageModuleOptions,
	ILocalStorageModuleAsyncOptions
} from './interfaces';
import { LOCAL_CONFIG, LOCAL_CONFIG_PROVIDER, LOCAL_STORAGE_PROVIDER } from './constants';

/**
 * Local Storage Provider Module
 *
 * A flexible NestJS module for integrating local file system storage.
 * Supports multiple configuration methods: static, async, and provider-based.
 *
 * @example
 * // Static configuration
 * LocalStorageProviderModule.register({
 *   config: {
 *     rootPath: '/var/www/public',
 *     baseUrl: 'http://localhost:3000',
 *     publicPath: 'public'
 *   }
 * })
 *
 * @example
 * // Async configuration with factory
 * LocalStorageProviderModule.registerAsync({
 *   inject: [ConfigService],
 *   useFactory: (configService: ConfigService) => ({
 *     config: {
 *       rootPath: configService.get('STORAGE_PATH'),
 *       baseUrl: configService.get('BASE_URL'),
 *       publicPath: configService.get('PUBLIC_PATH')
 *     }
 *   })
 * })
 *
 * @example
 * // With custom config provider (e.g., tenant-aware)
 * LocalStorageProviderModule.registerAsync({
 *   useClass: TenantLocalConfigProvider
 * })
 */
@Module({})
export class LocalStorageProviderModule {
	/**
	 * Register the module with static configuration.
	 *
	 * @param options - Module options including configuration
	 * @returns Dynamic module definition
	 */
	static register(options: ILocalStorageModuleOptions = {}): DynamicModule {
		const { isGlobal = false, config, configProvider } = options;

		const providers: NestProvider[] = [];

		// Provide static config if available
		if (config) {
			providers.push({
				provide: LOCAL_CONFIG,
				useValue: config
			});
		}

		// Provide config provider if available
		if (configProvider) {
			providers.push({
				provide: LOCAL_CONFIG_PROVIDER,
				useValue: configProvider
			});
		}

		// Main provider
		providers.push(LocalProvider);

		// Alias for injection token
		providers.push({
			provide: LOCAL_STORAGE_PROVIDER,
			useExisting: LocalProvider
		});

		return {
			module: LocalStorageProviderModule,
			global: isGlobal,
			providers,
			exports: [LocalProvider, LOCAL_STORAGE_PROVIDER]
		};
	}

	/**
	 * Register the module with async configuration.
	 *
	 * @param options - Async module options
	 * @returns Dynamic module definition
	 */
	static registerAsync(options: ILocalStorageModuleAsyncOptions): DynamicModule {
		const { isGlobal = false, inject = [], useFactory, useClass, useExisting } = options;

		const providers: NestProvider[] = [];

		// Handle useClass - register a custom config provider
		if (useClass) {
			providers.push({
				provide: LOCAL_CONFIG_PROVIDER,
				useClass
			});
		}
		// Handle useExisting - use an existing provider
		else if (useExisting) {
			providers.push({
				provide: LOCAL_CONFIG_PROVIDER,
				useExisting
			});
		}
		// Handle useFactory - create config dynamically
		else if (useFactory) {
			providers.push({
				provide: LOCAL_CONFIG,
				useFactory: async (...args: any[]) => {
					const result = await useFactory(...args);
					return result.config ?? null;
				},
				inject
			});

			// Also handle configProvider from factory result
			providers.push({
				provide: LOCAL_CONFIG_PROVIDER,
				useFactory: async (...args: any[]) => {
					const result = await useFactory(...args);
					return result.configProvider ?? null;
				},
				inject
			});
		}

		// Main provider
		providers.push(LocalProvider);

		// Alias for injection token
		providers.push({
			provide: LOCAL_STORAGE_PROVIDER,
			useExisting: LocalProvider
		});

		return {
			module: LocalStorageProviderModule,
			global: isGlobal,
			providers,
			exports: [LocalProvider, LOCAL_STORAGE_PROVIDER]
		};
	}

	/**
	 * Create a feature module for specific use cases.
	 * This is useful when you need different configurations
	 * in different parts of your application.
	 *
	 * @param config - Configuration for this feature
	 * @returns Dynamic module definition
	 */
	static forFeature(config: ILocalConfig): DynamicModule {
		const providers: NestProvider[] = [
			{
				provide: LOCAL_CONFIG,
				useValue: config
			},
			LocalProvider,
			{
				provide: LOCAL_STORAGE_PROVIDER,
				useExisting: LocalProvider
			}
		];

		return {
			module: LocalStorageProviderModule,
			providers,
			exports: [LocalProvider, LOCAL_STORAGE_PROVIDER]
		};
	}
}

/**
 * Factory function to create a config from environment variables.
 * Useful as a starting point for custom implementations.
 *
 * @param envPrefix - Prefix for environment variable names (default: 'LOCAL')
 * @returns Configuration object
 */
export function createConfigFromEnv(envPrefix: string = 'LOCAL'): ILocalConfig {
	return {
		rootPath: process.env[`${envPrefix}_ROOT_PATH`] ?? 'public',
		baseUrl: process.env[`${envPrefix}_BASE_URL`] ?? '',
		publicPath: process.env[`${envPrefix}_PUBLIC_PATH`] ?? 'public'
	};
}

