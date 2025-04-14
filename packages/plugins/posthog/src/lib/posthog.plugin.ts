import { APP_INTERCEPTOR } from '@nestjs/core';
import { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap } from '@gauzy/plugin';
import { PosthogRequestMiddleware } from './posthog-request.middleware';
import { PosthogTraceMiddleware } from './posthog-trace.middleware';
import { PosthogModule } from './posthog.module';
import { PosthogModuleOptions } from './posthog.interfaces';
import { PosthogCustomInterceptor } from './post-custom.interceptor';
import { POSTHOG_MODULE_OPTIONS } from './posthog.constants';
import { PosthogService } from './posthog.service';
import { PosthogErrorInterceptor } from './posthog-error.interceptor';

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
			useFactory: () => new PosthogCustomInterceptor()
		}
	]
})
export class PosthogPlugin implements NestModule, IOnPluginBootstrap {
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
		this.options = parsePosthogOptions(options);
		return this;
	}

	/**
	 * Determines if tracking should be enabled
	 * @returns boolean indicating if tracking is enabled
	 */
	private shouldEnableTracking(): boolean {
		return !PosthogPlugin.options.mock && !!PosthogPlugin.options.apiKey;
	}
}

/**
 * Parses and validates PostHog options
 * @param options Raw PostHog options
 * @returns Normalized PostHog options
 */
function parsePosthogOptions(options: PosthogModuleOptions): PosthogModuleOptions {
	return {
		apiKey: options.apiKey,
		apiHost: options.apiHost || 'https://app.posthog.com',
		enableErrorTracking: options.enableErrorTracking ?? true,
		flushAt: options.flushAt || 20,
		flushInterval: options.flushInterval || 10000,
		personalApiKey: options.personalApiKey,
		autocapture: options.autocapture ?? false,
		mock: options.mock ?? false
	};
}
