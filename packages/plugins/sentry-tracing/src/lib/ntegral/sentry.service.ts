import { Inject, Injectable, ConsoleLogger, LogLevel, OnApplicationShutdown } from '@nestjs/common';
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
	 * Whether a message logged at `level` becomes its own Sentry event. `opts.logLevels` is the allow-list
	 * (the API passes SENTRY_LOG_LEVELS, default `error`); every other level is kept as a breadcrumb, so it
	 * still shows up on the next captured event. Capturing every Logger call made each request two events
	 * (RequestContextMiddleware logs its start and end), which used up the org's monthly error quota within
	 * hours of each reset. An unset or empty list keeps the previous behaviour of capturing every level.
	 */
	private captures(level: LogLevel): boolean {
		const levels = this.opts?.logLevels;
		return !levels?.length || levels.includes(level);
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
			if (asBreadcrumb || !this.captures('log')) {
				Sentry.addBreadcrumb({ message, level: 'log', data: { context } });
			} else {
				Sentry.captureMessage(message, 'log');
			}
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
			if (this.captures('error')) {
				Sentry.captureMessage(message, 'error');
			} else {
				Sentry.addBreadcrumb({ message, level: 'error', data: { context } });
			}
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
			if (asBreadcrumb || !this.captures('warn')) {
				Sentry.addBreadcrumb({ message, level: 'warning', data: { context } });
			} else {
				Sentry.captureMessage(message, 'warning');
			}
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
			if (asBreadcrumb || !this.captures('debug')) {
				Sentry.addBreadcrumb({ message, level: 'debug', data: { context } });
			} else {
				Sentry.captureMessage(message, 'debug');
			}
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
			if (asBreadcrumb || !this.captures('verbose')) {
				Sentry.addBreadcrumb({ message, level: 'info', data: { context } });
			} else {
				Sentry.captureMessage(message, 'info');
			}
		} catch (err) {
			// do nothing to avoid blocking the application
		}
	}

	/**
	 * A fatal log is at least as severe as an error, so it becomes an event whenever `fatal` or `error`
	 * is captured. Without this override Nest's ConsoleLogger.fatal printed it and Sentry never saw it.
	 *
	 * @param message
	 * @param context
	 */
	fatal(message: string, context?: string) {
		message = `${this.app} ${message}`;
		try {
			super.fatal(message, context);
			if (!this.isEnabled()) return;
			if (this.captures('fatal') || this.captures('error')) {
				Sentry.captureMessage(message, 'fatal');
			} else {
				Sentry.addBreadcrumb({ message, level: 'fatal', data: { context } });
			}
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
