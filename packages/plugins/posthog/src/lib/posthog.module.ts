import { Module, DynamicModule } from '@nestjs/common';
import { PosthogCoreModule } from './posthog-core.module';
import { PosthogModuleOptions, PosthogModuleAsyncOptions } from './posthog.interfaces';

/**
 * Entry module for PostHog integration.
 */
@Module({})
export class PosthogModule {
	/**
	 * Static method to create a dynamic module with synchronous configuration.
	 */
	public static forRoot(options: PosthogModuleOptions): DynamicModule {
		return {
			module: PosthogModule,
			imports: [PosthogCoreModule.forRoot(options)]
		};
	}

	/**
	 * Static method to create a dynamic module with asynchronous configuration.
	 */
	public static forRootAsync(options: PosthogModuleAsyncOptions): DynamicModule {
		return {
			module: PosthogModule,
			imports: [PosthogCoreModule.forRootAsync(options)]
		};
	}
}
