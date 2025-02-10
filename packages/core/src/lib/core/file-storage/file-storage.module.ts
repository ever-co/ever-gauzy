import { NestModule, MiddlewareConsumer, Module } from '@nestjs/common';
import { TenantSettingModule } from '../../tenant/tenant-setting/tenant-setting.module';
import { TenantSettingsMiddleware } from '../../tenant/tenant-setting/tenant-settings.middleware';

@Module({
	imports: [TenantSettingModule],
	providers: [TenantSettingsMiddleware]
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
