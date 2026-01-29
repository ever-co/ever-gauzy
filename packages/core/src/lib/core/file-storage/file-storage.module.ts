import { NestModule, MiddlewareConsumer, Module } from '@nestjs/common';
import { environment, getConfig } from '@gauzy/config';
import { getApiPublicPath } from '../util/path-util';
import { WasabiStorageProviderModule, WasabiConfigAdapter } from '@gauzy/file-wasabi-s3';
import { S3StorageProviderModule, S3ConfigAdapter } from '@gauzy/file-s3';
import { LocalStorageProviderModule, LocalConfigAdapter } from '@gauzy/file-local';
import { RequestContext } from '../context/request-context';
import { TenantSettingModule } from '../../tenant/tenant-setting/tenant-setting.module';
import { TenantSettingsMiddleware } from '../../tenant/tenant-setting/tenant-settings.middleware';

/**
 * Creates a request context provider for tenant-aware configuration.
 * This provider is shared between storage modules and provides access to
 * the current request context for tenant-aware file storage configuration.
 *
 * @returns
 */
const configProvider = () => ({
	/**
	 * Gets the current HTTP request from the RequestContext.
	 * Returns null if no request context is available (e.g., during startup or background jobs).
	 */
	currentRequest: () => RequestContext.currentRequest()
});

/**
 * Gets the root path for local file storage.
 * Handles Electron and standard environments.
 */
function getLocalRootPath(): string {
	// If running in Electron, use the user path
	if (environment.isElectron) {
		return require('path').resolve(environment.gauzyUserPath, 'public');
	}

	// Otherwise, use the default asset public path
	return getConfig().assetOptions?.assetPublicPath || getApiPublicPath();
}

/**
 * FileStorageModule
 *
 * This module configures file storage providers and middleware for the application.
 * It imports both LocalStorageProviderModule and WasabiStorageProviderModule with their respective
 * config adapters for tenant-aware file storage configuration.
 *
 * Supported storage providers:
 * - LOCAL: Local file system storage
 * - WASABI: Wasabi S3-compatible cloud storage
 */
@Module({
	imports: [
		TenantSettingModule,
		// Import Local storage module with explicit Gauzy configuration adapter
		LocalStorageProviderModule.register({
			isGlobal: false,
			configProvider: new LocalConfigAdapter({
				rootPath: getLocalRootPath(),
				baseUrl: environment.baseUrl,
				publicPath: 'public'
			})
		}),
		// Import S3 storage module with explicit Gauzy configuration adapter
		S3StorageProviderModule.register({
			isGlobal: false,
			configProvider: new S3ConfigAdapter(
				{
					accessKeyId: environment.awsConfig?.accessKeyId ?? '',
					secretAccessKey: environment.awsConfig?.secretAccessKey ?? '',
					region: environment.awsConfig?.region,
					bucket: environment.awsConfig?.s3?.bucket,
					forcePathStyle: environment.awsConfig?.s3?.forcePathStyle
				},
				// Pass RequestContext provider for tenant-aware configuration
				configProvider()
			)
		}),
		// Import Wasabi storage module with explicit Gauzy configuration adapter
		WasabiStorageProviderModule.register({
			isGlobal: false,
			configProvider: new WasabiConfigAdapter(
				{
					accessKeyId: environment.wasabi.accessKeyId,
					secretAccessKey: environment.wasabi.secretAccessKey,
					region: environment.wasabi.region,
					bucket: environment.wasabi.s3.bucket,
					forcePathStyle: environment.wasabi.s3.forcePathStyle
				},
				// Pass RequestContext provider for tenant-aware configuration
				configProvider()
			)
		})
	],
	providers: [TenantSettingsMiddleware],
	exports: [LocalStorageProviderModule, S3StorageProviderModule, WasabiStorageProviderModule]
})
export class FileStorageModule implements NestModule {
	/**
	 * Configures middleware for the application.
	 *
	 * @param {MiddlewareConsumer} consumer - The NestJS `MiddlewareConsumer` instance used to apply middleware.
	 *
	 * @description
	 * This method applies the `TenantSettingsMiddleware` to all routes (`'*'`).
	 * The middleware will be executed for every incoming request, allowing tenant-specific settings
	 * to be processed before handling requests.
	 */
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(TenantSettingsMiddleware).forRoutes('*');
	}
}
