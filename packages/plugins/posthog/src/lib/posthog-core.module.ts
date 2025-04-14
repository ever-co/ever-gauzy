import { DynamicModule, Global, Module, Provider, Type } from '@nestjs/common';
import { PosthogModuleOptions, PosthogModuleAsyncOptions, PosthogOptionsFactory } from './posthog.interfaces';
import { POSTHOG_MODULE_OPTIONS, POSTHOG_TOKEN } from './posthog.constants';
import { PosthogService } from './posthog.service';
import { createPosthogProviders } from './posthog.providers';

@Global()
@Module({})
export class PosthogCoreModule {
	static forRoot(options: PosthogModuleOptions): DynamicModule {
		const provider = createPosthogProviders(options);

		return {
			module: PosthogCoreModule,
			providers: [provider, PosthogService],
			exports: [provider, PosthogService]
		};
	}

	static forRootAsync(options: PosthogModuleAsyncOptions): DynamicModule {
		const provider: Provider = {
			provide: POSTHOG_TOKEN,
			useFactory: (options: PosthogModuleOptions) => new PosthogService(options),
			inject: [POSTHOG_MODULE_OPTIONS]
		};

		return {
			module: PosthogCoreModule,
			imports: options.imports || [],
			providers: [...this.createAsyncProviders(options), provider, PosthogService],
			exports: [provider, PosthogService]
		};
	}

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

		const providers: Provider[] = [
			{
				provide: POSTHOG_MODULE_OPTIONS,
				useFactory: async (factory: PosthogOptionsFactory) => await factory.createPosthogOptions(),
				inject
			}
		];

		if (options.useClass) {
			providers.push({
				provide: options.useClass,
				useClass: options.useClass
			});
		}

		return providers;
	}
}
