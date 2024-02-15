import { Module, DynamicModule } from '@nestjs/common';
import { SentryCoreModule } from './sentry-core.module';
import { SentryModuleOptions, SentryModuleAsyncOptions } from './sentry.interfaces';

@Module({})
export class SentryModule {
	/**
	 * Static method to create a dynamic module for Sentry integration.
	 * @param {SentryModuleOptions} options - Options for configuring the Sentry module.
	 * @returns {DynamicModule} A dynamic module configuration.
	 */
	public static forRoot(options: SentryModuleOptions): DynamicModule {
		return {
			module: SentryModule,
			imports: [SentryCoreModule.forRoot(options)],
		};
	}

	/**
	 * Static method to create a dynamic module for Sentry integration with asynchronous options.
	 * @param {SentryModuleAsyncOptions} options - Asynchronous options for configuring the Sentry module.
	 * @returns {DynamicModule} A dynamic module configuration.
	 */
	public static forRootAsync(options: SentryModuleAsyncOptions): DynamicModule {
		return {
			module: SentryModule,
			imports: [SentryCoreModule.forRootAsync(options)],
		};
	}
}
