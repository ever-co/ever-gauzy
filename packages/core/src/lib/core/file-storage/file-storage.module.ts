import { NestModule, MiddlewareConsumer, Module } from '@nestjs/common';
import { environment } from '@gauzy/config';
import { WasabiStorageModule, WasabiConfigAdapter } from '@gauzy/storage-provider-wasabi';
import { RequestContext } from '../context/request-context';
import { TenantSettingModule } from '../../tenant/tenant-setting/tenant-setting.module';
import { TenantSettingsMiddleware } from '../../tenant/tenant-setting/tenant-settings.middleware';

/**
 * FileStorageModule
 *
 * This module configures file storage providers and middleware for the application.
 * It imports the WasabiStorageModule with WasabiConfigAdapter for tenant-aware
 * file storage configuration.
 */
@Module({
	imports: [
		TenantSettingModule,
		// Import Wasabi storage module with explicit Gauzy configuration adapter
		WasabiStorageModule.register({
			isGlobal: false,
			configProvider: new WasabiConfigAdapter(
				// Pass Gauzy environment configuration
				environment?.wasabi,
				// Pass RequestContext provider for tenant-aware configuration
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
	providers: [TenantSettingsMiddleware],
	exports: [WasabiStorageModule]
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
