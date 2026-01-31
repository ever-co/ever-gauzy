import { Inject, Injectable, ConsoleLogger, OnApplicationShutdown } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { RequestContext } from '@gauzy/core';
import { SENTRY_MODULE_OPTIONS } from './sentry.constants';
import { SentryModuleOptions } from './sentry.interfaces';

@Injectable()
export class SentryService extends ConsoleLogger implements OnApplicationShutdown {
	app = '@ntegral/nestjs-sentry: ';

	private static serviceInstance: SentryService;

	constructor(
		@Inject(SENTRY_MODULE_OPTIONS)
		readonly opts?: SentryModuleOptions
	) {
		super();
		if (!(opts && opts.dsn)) {
			console.log('Sentry options not found. Did you use SentryModule.forRoot?');
			return;
		}
		const { integrations = [], close, profilesSampleRate, ...sentryOptions } = opts;
		// Build the integrations array
		const allIntegrations = [
			Sentry.onUncaughtExceptionIntegration({
				onFatalError: async (error) => {
					console.error('Uncaught Exception Handler in Sentry Service', error);
					if (error.name === 'SentryError') {
						console.log(error);
					} else {
						Sentry.getClient()?.captureException(error);

						Sentry.flush(3000).then(() => {
							process.exit(1);
						});
					}
				}
			}),
			Sentry.onUnhandledRejectionIntegration({ mode: 'warn' }),
			...integrations
		];
		// Initialize Sentry with options
		Sentry.init({
			...sentryOptions,
			profilesSampleRate,
			integrations: allIntegrations
		} as Parameters<typeof Sentry.init>[0]);
	}

	/**
	 * Check if Sentry is enabled based on resolvedSettings or default config.
	 */
	private isEnabled(): boolean {
		try {
			const request = RequestContext.currentRequest();
			const settings = request?.['resolvedSettings'];
			if (settings?.sentryEnabled !== undefined) {
				return settings.sentryEnabled === 'true' || settings.sentryEnabled === true;
			}
		} catch {
			// No request context
		}
		return !!this.opts?.dsn;
	}

	/**
	 *
	 * @returns
	 */
	public static SentryServiceInstance(): SentryService {
		if (!SentryService.serviceInstance) {
			SentryService.serviceInstance = new SentryService();
		}
		return SentryService.serviceInstance;
	}

	/**
	 *
	 * @param message
	 * @param context
	 * @param asBreadcrumb
	 */
	log(message: string, context?: string, asBreadcrumb?: boolean) {
		message = `${this.app} ${message}`;
		try {
			super.log(message, context);
			if (!this.isEnabled()) return;
			asBreadcrumb
				? Sentry.addBreadcrumb({
						message,
						level: 'log',
						data: {
							context
						}
				  })
				: Sentry.captureMessage(message, 'log');
		} catch (err) {
			// do nothing to avoid blocking the application
		}
	}

	/**
	 *
	 * @param message
	 * @param trace
	 * @param context
	 */
	error(message: string, trace?: string, context?: string) {
		message = `${this.app} ${message}`;
		try {
			super.error(message, trace, context);
			if (!this.isEnabled()) return;
			Sentry.captureMessage(message, 'error');
		} catch (err) {
			// do nothing to avoid blocking the application
		}
	}

	/**
	 *
	 * @param message
	 * @param context
	 * @param asBreadcrumb
	 */
	warn(message: string, context?: string, asBreadcrumb?: boolean) {
		message = `${this.app} ${message}`;
		try {
			super.warn(message, context);
			if (!this.isEnabled()) return;
			asBreadcrumb
				? Sentry.addBreadcrumb({
						message,
						level: 'warning',
						data: {
							context
						}
				  })
				: Sentry.captureMessage(message, 'warning');
		} catch (err) {
			// do nothing to avoid blocking the application
		}
	}

	/**
	 *
	 * @param message
	 * @param context
	 * @param asBreadcrumb
	 */
	debug(message: string, context?: string, asBreadcrumb?: boolean) {
		message = `${this.app} ${message}`;
		try {
			super.debug(message, context);
			if (!this.isEnabled()) return;
			asBreadcrumb
				? Sentry.addBreadcrumb({
						message,
						level: 'debug',
						data: {
							context
						}
				  })
				: Sentry.captureMessage(message, 'debug');
		} catch (err) {
			// do nothing to avoid blocking the application
		}
	}

	/**
	 *
	 * @param message
	 * @param context
	 * @param asBreadcrumb
	 */
	verbose(message: string, context?: string, asBreadcrumb?: boolean) {
		message = `${this.app} ${message}`;
		try {
			super.verbose(message, context);
			if (!this.isEnabled()) return;
			asBreadcrumb
				? Sentry.addBreadcrumb({
						message,
						level: 'info',
						data: {
							context
						}
				  })
				: Sentry.captureMessage(message, 'info');
		} catch (err) {
			// do nothing to avoid blocking the application
		}
	}

	/**
	 *
	 * @returns
	 */
	instance() {
		return this.isEnabled() ? Sentry : null;
	}

	/**
	 *
	 * @param signal
	 */
	async onApplicationShutdown(signal?: string) {
		if (this.opts?.close?.enabled === true) {
			await Sentry.close(this.opts?.close.timeout);
		}
	}
}
