import { Inject, Injectable, ConsoleLogger } from '@nestjs/common';
import { OnApplicationShutdown } from '@nestjs/common';
import { ClientOptions, Client } from '@sentry/types';
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
				new Sentry.Integrations.OnUncaughtException({
					onFatalError: async (error) => {
						console.error('Uncaught Exception Handler in Sentry Service', error);
						if (error.name === 'SentryError') {
							console.log(error);
						} else {
							(
								Sentry.getCurrentHub().getClient<Client<ClientOptions>>() as Client<ClientOptions>
							).captureException(error);

							Sentry.flush(3000).then(() => {
								process.exit(1);
							});
						}
					}
				}),
				new Sentry.Integrations.OnUnhandledRejection({ mode: 'warn' }),
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
		} catch (err) { }
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
		} catch (err) { }
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
		} catch (err) { }
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
		} catch (err) { }
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
		} catch (err) { }
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
