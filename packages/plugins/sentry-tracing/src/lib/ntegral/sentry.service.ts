import { Inject, Injectable, ConsoleLogger } from '@nestjs/common';
import { OnApplicationShutdown } from '@nestjs/common';
import * as Sentry from '@sentry/node';
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
		const { debug, integrations = [], ...sentryOptions } = opts;
		Sentry.init({
			...sentryOptions,
			integrations: [
				// V9 Migration: Updated integration names from Sentry.Integrations.OnUncaughtException to Sentry.onUncaughtExceptionIntegration
				// Reference: https://docs.sentry.io/platforms/javascript/guides/node/configuration/integrations/onuncaughtexception/
				Sentry.onUncaughtExceptionIntegration({
					onFatalError: async (error) => {
						console.error('Uncaught Exception Handler in Sentry Service', error);
						if (error.name === 'SentryError') {
							console.log(error);
						} else {
							// V9 Migration: getCurrentHub() was removed, use getClient() instead
							// Reference: https://docs.sentry.io/platforms/javascript/migration/v8-to-v9/#removed-apis
							Sentry.getClient()?.captureException(error);

							Sentry.flush(3000).then(() => {
								process.exit(1);
							});
						}
					}
				}),
				// V9 Migration: Updated integration names from Sentry.Integrations.OnUnhandledRejection to Sentry.onUnhandledRejectionIntegration
				// Reference: https://docs.sentry.io/platforms/javascript/guides/node/configuration/integrations/unhandledrejection/
				Sentry.onUnhandledRejectionIntegration({ mode: 'warn' }),
				...integrations
			]
		});
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
			asBreadcrumb
				? Sentry.addBreadcrumb({
						message,
						level: 'log',
						data: {
							context
						}
				  })
				: Sentry.captureMessage(message, 'log');
		} catch (err) {}
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
			Sentry.captureMessage(message, 'error');
		} catch (err) {}
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
			asBreadcrumb
				? Sentry.addBreadcrumb({
						message,
						level: 'warning',
						data: {
							context
						}
				  })
				: Sentry.captureMessage(message, 'warning');
		} catch (err) {}
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
			asBreadcrumb
				? Sentry.addBreadcrumb({
						message,
						level: 'debug',
						data: {
							context
						}
				  })
				: Sentry.captureMessage(message, 'debug');
		} catch (err) {}
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
			asBreadcrumb
				? Sentry.addBreadcrumb({
						message,
						level: 'info',
						data: {
							context
						}
				  })
				: Sentry.captureMessage(message, 'info');
		} catch (err) {}
	}

	/**
	 *
	 * @returns
	 */
	instance() {
		return Sentry;
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
