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
	 * Log messages are only printed to console, NOT sent to Sentry
	 * @param message
	 * @param context
	 * @param asBreadcrumb
	 */
	log(message: string, context?: string, asBreadcrumb?: boolean) {
		message = `${this.app} ${message}`;
		try {
			super.log(message, context);
			// console.log() messages are NOT sent to Sentry at all
			// Only console.warn() and console.error() are sent to Sentry
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
			// Only add as breadcrumb, don't send to Sentry
			Sentry.addBreadcrumb({
				message,
				level: 'debug',
				data: {
					context
				}
			});
		} catch (err) {}
	}

	/**
	 * Verbose messages are only printed to console, NOT sent to Sentry
	 * @param message
	 * @param context
	 * @param asBreadcrumb
	 */
	verbose(message: string, context?: string, asBreadcrumb?: boolean) {
		message = `${this.app} ${message}`;
		try {
			super.verbose(message, context);
			// Verbose messages are NOT sent to Sentry at all
			// Only console.warn() and console.error() are sent to Sentry
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
