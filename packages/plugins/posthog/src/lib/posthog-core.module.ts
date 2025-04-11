import { DynamicModule, Global, Module, Provider, Type } from '@nestjs/common';
import { PosthogModuleOptions, PosthogModuleAsyncOptions, PosthogOptionsFactory } from './posthog.interfaces';
import { POSTHOG_MODULE_OPTIONS } from './posthog.constants';
import { PosthogService } from './posthog.service';

@Global()
@Module({})
export class PosthogCoreModule {
	/**
	 * Creates a dynamic module with synchronous options.
	 */
	static forRoot(options: PosthogModuleOptions): DynamicModule {
		const optionsProvider: Provider = {
			provide: POSTHOG_MODULE_OPTIONS,
			useValue: options
		};

		return {
			module: PosthogCoreModule,
			providers: [optionsProvider, PosthogService],
			exports: [PosthogService]
		};
	}

	/**
	 * Creates a dynamic module with asynchronous options.
	 */
	static forRootAsync(options: PosthogModuleAsyncOptions): DynamicModule {
		const asyncProviders = this.createAsyncProviders(options);

		return {
			module: PosthogCoreModule,
			imports: options.imports || [],
			providers: [...asyncProviders, PosthogService],
			exports: [PosthogService]
		};
	}

	/**
	 * Creates providers based on async options (useFactory, useClass, etc.).
	 */
	private static createAsyncProviders(options: PosthogModuleAsyncOptions): Provider[] {
		if (options.useFactory) {
			return [
				{
					provide: POSTHOG_MODULE_OPTIONS,
					useFactory: options.useFactory,
					inject: options.inject || []
				}
			];
		}

		const inject = [(options.useClass || options.useExisting) as Type<PosthogOptionsFactory>];

		return [
			{
				provide: POSTHOG_MODULE_OPTIONS,
				useFactory: async (optionsFactory: PosthogOptionsFactory) =>
					await optionsFactory.createPosthogOptions(),
				inject
			},
			...(options.useClass
				? [
						{
							provide: options.useClass,
							useClass: options.useClass
						}
				  ]
				: [])
		];
	}
}
