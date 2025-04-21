import { DynamicModule, Global, Module, Provider, Type } from '@nestjs/common';
import { PosthogModuleOptions, PosthogModuleAsyncOptions, PosthogOptionsFactory } from './posthog.interfaces';
import { POSTHOG_MODULE_OPTIONS, POSTHOG_TOKEN } from './posthog.constants';
import { PosthogService } from './posthog.service';
import { createPosthogProviders } from './posthog.providers';

@Global()
@Module({})
export class PosthogCoreModule {
	/**
	 * Synchronous registration of the Posthog module
	 * @param options - Configuration object for Posthog
	 * @returns A dynamic module with providers and exports
	 */
	static forRoot(options: PosthogModuleOptions): DynamicModule {
		const provider = createPosthogProviders(options);

		return {
			module: PosthogCoreModule,
			providers: [provider, PosthogService],
			exports: [provider, PosthogService]
		};
	}

	/**
	 * Asynchronous registration of the Posthog module
	 * Supports useFactory, useClass, or useExisting strategies
	 * @param options - Async module options including factory or class
	 * @returns A dynamic module with async providers and exports
	 */
	static forRootAsync(options: PosthogModuleAsyncOptions): DynamicModule {
		const provider: Provider = {
			provide: POSTHOG_TOKEN,
			useFactory: (options: PosthogModuleOptions) => new PosthogService(options),
			inject: [POSTHOG_MODULE_OPTIONS]
		};

		return {
			module: PosthogCoreModule,
			imports: options.imports || [],
			providers: [...PosthogCoreModule.createAsyncProviders(options), provider, PosthogService],
			exports: [provider, PosthogService]
		};
	}

	/**
	 * Creates async providers based on the chosen async strategy
	 * @param options - Configuration for async provider setup
	 * @returns An array of providers to be used in the async module
	 */
	private static createAsyncProviders(options: PosthogModuleAsyncOptions): Provider[] {
		// If a factory function is provided directly
		if (options.useFactory) {
			return [
				{
					provide: POSTHOG_MODULE_OPTIONS,
					useFactory: options.useFactory,
					inject: options.inject || []
				}
			];
		}

		// Dependency injection array for useClass or useExisting
		if (!options.useClass && !options.useExisting) {
			throw new Error('Either useClass or useExisting must be provided for PosthogModule async configuration');
		}

		const inject = [(options.useClass || options.useExisting) as Type<PosthogOptionsFactory>];

		const providers: Provider[] = [
			{
				provide: POSTHOG_MODULE_OPTIONS,
				useFactory: async (factory: PosthogOptionsFactory) => await factory.createPosthogOptions(),
				inject
			}
		];

		// Register useClass as a provider if defined
		if (options.useClass) {
			providers.push({
				provide: options.useClass,
				useClass: options.useClass
			});
		}

		return providers;
	}
}
