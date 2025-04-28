import { APP_INTERCEPTOR } from '@nestjs/core';
import { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { PosthogModule } from './posthog.module';
import { parsePosthogOptions, PosthogModuleOptions } from './posthog.interfaces';
import { PosthogEventInterceptor } from './posthog-event.interceptor';
import { PosthogErrorInterceptor } from './posthog-error.interceptor';
import { PosthogRequestMiddleware } from './posthog-request.middleware';
import { PosthogTraceMiddleware } from './posthog-trace.middleware';
import { POSTHOG_MODULE_OPTIONS } from './posthog.constants';

@Plugin({
	imports: [
		PosthogModule.forRootAsync({
			useFactory: () => parsePosthogOptions(PosthogPlugin.options),
			inject: []
		})
	],
	providers: [
		{
			provide: POSTHOG_MODULE_OPTIONS,
			useValue: PosthogPlugin.options
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: PosthogErrorInterceptor
		},

		{
			provide: APP_INTERCEPTOR,
			useClass: PosthogEventInterceptor
		}
	]
})
export class PosthogPlugin implements NestModule, IOnPluginBootstrap, IOnPluginDestroy {
	private logEnabled = true;
	static options: PosthogModuleOptions;

	/**
	 * Configures PostHog middlewares for all routes
	 * @param consumer The middleware consumer
	 */
	configure(consumer: MiddlewareConsumer) {
		if (this.shouldEnableTracking()) {
			consumer.apply(PosthogRequestMiddleware).forRoutes('*').apply(PosthogTraceMiddleware).forRoutes('*');
		}
	}

	/**
	 * Called when plugin is initialized
	 */
	onPluginBootstrap(): void {
		if (this.logEnabled) {
			console.log('🚀 PostHog plugin initialized');
		}
	}

	/**
	 * Called when plugin is destroyed
	 */
	onPluginDestroy(): void {
		if (this.logEnabled) {
			console.log('🛑 PostHog plugin destroyed');
		}
	}

	/**
	 * Initialize plugin with options
	 * @param options PostHog configuration options
	 * @returns The plugin instance
	 */
	static init(options: PosthogModuleOptions): typeof PosthogPlugin {
		PosthogPlugin.options = parsePosthogOptions(options);
		return PosthogPlugin;
	}

	/**
	 * Determines if tracking should be enabled
	 * @returns boolean indicating if tracking is enabled
	 */
	private shouldEnableTracking(): boolean {
		return !PosthogPlugin.options.mock && !!PosthogPlugin.options.apiKey;
	}
}
