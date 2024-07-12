import { APP_INTERCEPTOR, HttpAdapterHost } from '@nestjs/core';
import { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Integration } from '@sentry/types';
import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap } from '@gauzy/plugin';
import { SentryRequestMiddleware } from './sentry-request.middleware';
import { SentryTraceMiddleware } from './sentry-trace.middleware';
import { SentryPluginOptions } from './sentry.types';
import { SentryCustomInterceptor } from './sentry-custom.interceptor';
import { GraphqlInterceptor, SENTRY_MODULE_OPTIONS, SentryModule } from './ntegral';
import { createDefaultSentryIntegrations, parseOptions, removeDuplicateIntegrations } from './sentry.helper';

// Assuming createDefaultSentryIntegrations returns an array of Integrations
export const DefaultSentryIntegrations: Integration[] = createDefaultSentryIntegrations();

@Plugin({
	imports: [
		SentryModule.forRootAsync({
			useFactory: createSentryOptions,
			inject: [HttpAdapterHost]
		})
	],
	providers: [
		{
			provide: SENTRY_MODULE_OPTIONS,
			useFactory: createSentryOptions,
			inject: [HttpAdapterHost]
		},
		{
			provide: APP_INTERCEPTOR,
			useFactory: () => new SentryCustomInterceptor()
		},
		{
			provide: APP_INTERCEPTOR,
			useFactory: () => new GraphqlInterceptor()
		}
	]
})
export class SentryPlugin implements NestModule, IOnPluginBootstrap {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;
	static options: SentryPluginOptions = {} as any;

	/**
	 * Configures Sentry middleware for all routes
	 * @param consumer The middleware consumer
	 */
	configure(consumer: MiddlewareConsumer) {
		if (process.env.SENTRY_DSN) {
			consumer.apply(SentryRequestMiddleware).forRoutes('*');
			consumer.apply(SentryTraceMiddleware).forRoutes('*');
		}
	}

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${SentryPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${SentryPlugin.name} is being destroyed...`));
		}
	}

	/**
	 * Initializes the Sentry module with options
	 * @param options Sentry module options
	 * @returns The initialized Sentry module
	 */
	static init(options: SentryPluginOptions): typeof SentryPlugin {
		this.options = parseOptions(options);
		return this;
	}
}

/**
 * Creates Sentry module options based on the provided host.
 * @param {HttpAdapterHost} host - The host object from the NestJS framework.
 * @returns {SentryPluginOptions} The Sentry plugin options.
 */
function createSentryOptions(host: HttpAdapterHost): SentryPluginOptions {
	// Concatenate the integrations returned by createSentryIntegrations with the existing integrations
	SentryPlugin.options.integrations = removeDuplicateIntegrations(
		(SentryPlugin.options.integrations ?? []).concat(DefaultSentryIntegrations)
	);

	// Return the Sentry module options
	return SentryPlugin.options;
}
