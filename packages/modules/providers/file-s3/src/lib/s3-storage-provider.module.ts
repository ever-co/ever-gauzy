import { Module, DynamicModule, Provider as NestProvider } from '@nestjs/common';
import { S3Provider } from './s3.provider';
import { IS3Config, IS3StorageModuleOptions, IS3StorageModuleAsyncOptions } from './interfaces';
import { S3_CONFIG, S3_CONFIG_PROVIDER, S3_PROVIDER } from './constants';

/**
 * S3 Storage Provider Module
 *
 * A flexible NestJS module for integrating AWS S3 storage.
 * Supports multiple configuration methods: static, async, and provider-based.
 *
 * @example
 * // Static configuration
 * S3StorageProviderModule.register({
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
 * S3StorageProviderModule.registerAsync({
 *   inject: [ConfigService],
 *   useFactory: (configService: ConfigService) => ({
 *     config: {
 *       accessKeyId: configService.get('AWS_ACCESS_KEY_ID'),
 *       secretAccessKey: configService.get('AWS_SECRET_ACCESS_KEY'),
 *       bucket: configService.get('AWS_S3_BUCKET'),
 *       region: configService.get('AWS_REGION')
 *     }
 *   })
 * })
 *
 * @example
 * // With custom config provider (e.g., tenant-aware)
 * S3StorageProviderModule.registerAsync({
 *   useClass: TenantS3ConfigProvider
 * })
 */
@Module({})
export class S3StorageProviderModule {
	/**
	 * Register the module with static configuration.
	 *
	 * @param options - Module options including configuration
	 * @returns Dynamic module definition
	 */
	static register(options: IS3StorageModuleOptions = {}): DynamicModule {
		const { isGlobal = false, config, configProvider } = options;

		const providers: NestProvider[] = [];

		// Provide static config if available
		if (config) {
			providers.push({
				provide: S3_CONFIG,
				useValue: config
			});
		}

		// Provide config provider if available
		if (configProvider) {
			providers.push({
				provide: S3_CONFIG_PROVIDER,
				useValue: configProvider
			});
		}

		// Main provider
		providers.push(S3Provider);

		// Alias for injection token
		providers.push({
			provide: S3_PROVIDER,
			useExisting: S3Provider
		});

		return {
			module: S3StorageProviderModule,
			global: isGlobal,
			providers,
			exports: [S3Provider, S3_PROVIDER]
		};
	}

	/**
	 * Register the module with async configuration.
	 *
	 * @param options - Async module options
	 * @returns Dynamic module definition
	 */
	static registerAsync(options: IS3StorageModuleAsyncOptions): DynamicModule {
		const { isGlobal = false, inject = [], useFactory, useClass, useExisting } = options;

		const providers: NestProvider[] = [];

		// Handle useClass - register a custom config provider
		if (useClass) {
			providers.push({
				provide: S3_CONFIG_PROVIDER,
				useClass
			});
		}
		// Handle useExisting - use an existing provider
		else if (useExisting) {
			providers.push({
				provide: S3_CONFIG_PROVIDER,
				useExisting
			});
		}
		// Handle useFactory - create config dynamically
		else if (useFactory) {
			providers.push({
				provide: S3_CONFIG,
				useFactory: async (...args: any[]) => {
					const result = await useFactory(...args);
					return result.config ?? null;
				},
				inject
			});

			// Also handle configProvider from factory result
			providers.push({
				provide: S3_CONFIG_PROVIDER,
				useFactory: async (...args: any[]) => {
					const result = await useFactory(...args);
					return result.configProvider ?? null;
				},
				inject
			});
		}

		// Main provider
		providers.push(S3Provider);

		// Alias for injection token
		providers.push({
			provide: S3_PROVIDER,
			useExisting: S3Provider
		});

		return {
			module: S3StorageProviderModule,
			global: isGlobal,
			providers,
			exports: [S3Provider, S3_PROVIDER]
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
	static forFeature(config: IS3Config): DynamicModule {
		const providers: NestProvider[] = [
			{
				provide: S3_CONFIG,
				useValue: config
			},
			S3Provider,
			{
				provide: S3_PROVIDER,
				useExisting: S3Provider
			}
		];

		return {
			module: S3StorageProviderModule,
			providers,
			exports: [S3Provider, S3_PROVIDER]
		};
	}
}

/**
 * Factory function to create a config from environment variables.
 * Useful as a starting point for custom implementations.
 *
 * Environment variables expected (with default AWS prefix):
 * - AWS_ACCESS_KEY_ID - AWS access key ID
 * - AWS_SECRET_ACCESS_KEY - AWS secret access key
 * - AWS_REGION - AWS region (e.g., 'us-east-1')
 * - AWS_S3_BUCKET - S3 bucket name
 * - AWS_S3_FORCE_PATH_STYLE - Whether to use path-style URLs (optional, 'true'/'false')
 * - AWS_S3_ROOT_PATH - Root path prefix for files (optional)
 * - AWS_S3_SERVICE_URL - Custom S3 endpoint URL for S3-compatible storage (optional)
 *
 * @param envPrefix - Prefix for environment variable names (default: 'AWS')
 * @returns Configuration object
 *
 * @example
 * // With default prefix
 * const config = createConfigFromEnv();
 * // Uses: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET
 *
 * @example
 * // With custom prefix
 * const config = createConfigFromEnv('CUSTOM');
 * // Uses: CUSTOM_ACCESS_KEY_ID, CUSTOM_SECRET_ACCESS_KEY, CUSTOM_REGION, CUSTOM_S3_BUCKET
 */
export function createConfigFromEnv(envPrefix: string = 'AWS'): IS3Config {
	return {
		accessKeyId: process.env[`${envPrefix}_ACCESS_KEY_ID`] ?? '',
		secretAccessKey: process.env[`${envPrefix}_SECRET_ACCESS_KEY`] ?? '',
		region: process.env[`${envPrefix}_REGION`],
		bucket: process.env[`${envPrefix}_S3_BUCKET`] ?? '',
		forcePathStyle: process.env[`${envPrefix}_S3_FORCE_PATH_STYLE`] === 'true',
		rootPath: process.env[`${envPrefix}_S3_ROOT_PATH`] ?? '',
		serviceUrl: process.env[`${envPrefix}_S3_SERVICE_URL`]
	};
}
