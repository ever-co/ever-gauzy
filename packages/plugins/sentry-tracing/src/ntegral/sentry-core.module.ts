import {
	Module,
	Global,
	Provider,
	Type,
	DynamicModule,
} from '@nestjs/common';
import {
	SentryModuleAsyncOptions,
	SentryOptionsFactory,
	SentryModuleOptions,
} from './sentry.interfaces';
import {
	SENTRY_MODULE_OPTIONS,
	SENTRY_TOKEN,
} from './sentry.constants';
import { SentryService } from './sentry.service';
import { createSentryProviders } from './sentry.providers';

@Global()
@Module({})
export class SentryCoreModule {

	/**
	 * Static method to create a dynamic module for Sentry integration.
	 * @param {SentryModuleOptions} options - Options for configuring the Sentry module.
	 * @returns {DynamicModule} A dynamic module configuration.
	 */
	public static forRoot(options: SentryModuleOptions): DynamicModule {
		const provider = createSentryProviders(options);

		return {
			exports: [provider, SentryService],
			module: SentryCoreModule,
			providers: [provider, SentryService],
		};
	}

	/**
	 * Static method to create a dynamic module for Sentry integration with asynchronous options.
	 * @param {SentryModuleAsyncOptions} options - Asynchronous options for configuring the Sentry module.
	 * @returns {DynamicModule} A dynamic module configuration.
	 */
	public static forRootAsync(
		options: SentryModuleAsyncOptions,
	): DynamicModule {
		const provider: Provider = {
			inject: [SENTRY_MODULE_OPTIONS],
			provide: SENTRY_TOKEN,
			useFactory: (options: SentryModuleOptions) => new SentryService(options),
		};

		return {
			exports: [provider, SentryService],
			imports: options.imports,
			module: SentryCoreModule,
			providers: [
				...this.createAsyncProviders(options),
				provider,
				SentryService,
			],
		};
	}

	/**
	 * Static method to create providers for asynchronous options in the Sentry module.
	 * @param {SentryModuleAsyncOptions} options - Asynchronous options for configuring the Sentry module.
	 * @returns {Provider[]} An array of providers for asynchronous options.
	 */
	private static createAsyncProviders(
		options: SentryModuleAsyncOptions,
	): Provider[] {
		if (options.useExisting || options.useFactory) {
			return [this.createAsyncOptionsProvider(options)];
		}

		const useClass = options.useClass as Type<SentryOptionsFactory>;

		return [
			this.createAsyncOptionsProvider(options),
			{
				provide: useClass,
				useClass,
			},
		];
	}

	/**
	 * Static method to create an options provider for asynchronous options in the Sentry module.
	 * @param {SentryModuleAsyncOptions} options - Asynchronous options for configuring the Sentry module.
	 * @returns {Provider} A provider for asynchronous options.
	 */
	private static createAsyncOptionsProvider(
		options: SentryModuleAsyncOptions,
	): Provider {
		if (options.useFactory) {
			return {
				inject: options.inject || [],
				provide: SENTRY_MODULE_OPTIONS,
				useFactory: options.useFactory,
			};
		}

		const inject = [
			(options.useClass || options.useExisting) as Type<SentryOptionsFactory>,
		];

		return {
			provide: SENTRY_MODULE_OPTIONS,
			useFactory: async (optionsFactory: SentryOptionsFactory) => await optionsFactory.createSentryModuleOptions(),
			inject,
		};
	}
}
