import { Module, DynamicModule, Provider as NestProvider, Type } from '@nestjs/common';
import { WasabiS3Provider } from './wasabi-s3.provider';
import {
	IWasabiConfig,
	IWasabiConfigProvider,
	IWasabiStorageModuleOptions,
	IWasabiStorageModuleAsyncOptions
} from './interfaces';
import {
	WASABI_CONFIG,
	WASABI_CONFIG_PROVIDER,
	WASABI_S3_PROVIDER
} from './constants';

/**
 * Wasabi Storage Module
 *
 * A flexible NestJS module for integrating Wasabi S3-compatible storage.
 * Supports multiple configuration methods: static, async, and provider-based.
 *
 * @example
 * // Static configuration
 * WasabiStorageModule.register({
 *   config: {
 *     accessKeyId: 'your-access-key',
 *     secretAccessKey: 'your-secret-key',
 *     bucket: 'your-bucket',
 *     region: 'us-east-1'
 *   }
 * })
 *
 * @example
 * // Async configuration with factory
 * WasabiStorageModule.registerAsync({
 *   inject: [ConfigService],
 *   useFactory: (configService: ConfigService) => ({
 *     config: {
 *       accessKeyId: configService.get('WASABI_ACCESS_KEY'),
 *       secretAccessKey: configService.get('WASABI_SECRET_KEY'),
 *       bucket: configService.get('WASABI_BUCKET'),
 *       region: configService.get('WASABI_REGION')
 *     }
 *   })
 * })
 *
 * @example
 * // With custom config provider (e.g., tenant-aware)
 * WasabiStorageModule.registerAsync({
 *   useClass: TenantWasabiConfigProvider
 * })
 */
@Module({})
export class WasabiStorageModule {
	/**
	 * Register the module with static configuration.
	 *
	 * @param options - Module options including configuration
	 * @returns Dynamic module definition
	 */
	static register(options: IWasabiStorageModuleOptions = {}): DynamicModule {
		const { isGlobal = false, config, configProvider } = options;

		const providers: NestProvider[] = [];

		// Provide static config if available
		if (config) {
			providers.push({
				provide: WASABI_CONFIG,
				useValue: config
			});
		}

		// Provide config provider if available
		if (configProvider) {
			providers.push({
				provide: WASABI_CONFIG_PROVIDER,
				useValue: configProvider
			});
		}

		// Main provider
		providers.push(WasabiS3Provider);

		// Alias for injection token
		providers.push({
			provide: WASABI_S3_PROVIDER,
			useExisting: WasabiS3Provider
		});

		return {
			module: WasabiStorageModule,
			global: isGlobal,
			providers,
			exports: [WasabiS3Provider, WASABI_S3_PROVIDER]
		};
	}

	/**
	 * Register the module with async configuration.
	 *
	 * @param options - Async module options
	 * @returns Dynamic module definition
	 */
	static registerAsync(options: IWasabiStorageModuleAsyncOptions): DynamicModule {
		const { isGlobal = false, inject = [], useFactory, useClass, useExisting } = options;

		const providers: NestProvider[] = [];

		// Handle useClass - register a custom config provider
		if (useClass) {
			providers.push({
				provide: WASABI_CONFIG_PROVIDER,
				useClass
			});
		}
		// Handle useExisting - use an existing provider
		else if (useExisting) {
			providers.push({
				provide: WASABI_CONFIG_PROVIDER,
				useExisting
			});
		}
		// Handle useFactory - create config dynamically
		else if (useFactory) {
			providers.push({
				provide: WASABI_CONFIG,
				useFactory: async (...args: any[]) => {
					const result = await useFactory(...args);
					return result.config ?? null;
				},
				inject
			});

			// Also handle configProvider from factory result
			providers.push({
				provide: WASABI_CONFIG_PROVIDER,
				useFactory: async (...args: any[]) => {
					const result = await useFactory(...args);
					return result.configProvider ?? null;
				},
				inject
			});
		}

		// Main provider
		providers.push(WasabiS3Provider);

		// Alias for injection token
		providers.push({
			provide: WASABI_S3_PROVIDER,
			useExisting: WasabiS3Provider
		});

		return {
			module: WasabiStorageModule,
			global: isGlobal,
			providers,
			exports: [WasabiS3Provider, WASABI_S3_PROVIDER]
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
	static forFeature(config: IWasabiConfig): DynamicModule {
		const providers: NestProvider[] = [
			{
				provide: WASABI_CONFIG,
				useValue: config
			},
			WasabiS3Provider,
			{
				provide: WASABI_S3_PROVIDER,
				useExisting: WasabiS3Provider
			}
		];

		return {
			module: WasabiStorageModule,
			providers,
			exports: [WasabiS3Provider, WASABI_S3_PROVIDER]
		};
	}
}

/**
 * Factory function to create a config provider from environment variables.
 * Useful as a starting point for custom implementations.
 *
 * @param envPrefix - Prefix for environment variable names (default: 'WASABI')
 * @returns Configuration object
 */
export function createConfigFromEnv(envPrefix: string = 'WASABI'): IWasabiConfig {
	return {
		accessKeyId: process.env[`${envPrefix}_ACCESS_KEY_ID`] ?? '',
		secretAccessKey: process.env[`${envPrefix}_SECRET_ACCESS_KEY`] ?? '',
		bucket: process.env[`${envPrefix}_BUCKET`] ?? '',
		region: process.env[`${envPrefix}_REGION`],
		serviceUrl: process.env[`${envPrefix}_SERVICE_URL`],
		forcePathStyle: process.env[`${envPrefix}_FORCE_PATH_STYLE`] === 'true',
		rootPath: process.env[`${envPrefix}_ROOT_PATH`] ?? ''
	};
}
